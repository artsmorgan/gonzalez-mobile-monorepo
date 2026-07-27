import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";
import { toZonedTime, format } from "date-fns-tz";
import { transporter } from '../../../transporter';

import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";
import { prisma } from "../../../utils/prismaClient";
import { sendNotificationByRole } from "../../../utils/sendNotification";
import { hydratePreexistentRelations, splitIncludeByTableGroup } from "../../../utils/hydratePreexistentIncludes";

const ENCUESTA_NPS_ESTRUCTURA_INCLUDE = {
  e_estructura_empresa: { select: { id: true, nombre: true } },
  e_estructura_cliente: { select: { id: true, nombre: true } },
  e_estructura_sucursal: { select: { id: true, nombre: true } },
  e_estructura_puesto: { select: { id: true, nombre: true } },
  n_division: { select: { id: true, nombre: true } },
};

function escapeHtmlForEmail(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/** Soporta legado `[{ question, value|result }]` y formato móvil `{ form, know_process }`. */
function buildEvaluacionesEmailHtml(evaluacionesRaw: string): string {
    if (!evaluacionesRaw || !String(evaluacionesRaw).trim()) return "";
    let parsed: unknown;
    try {
        parsed = JSON.parse(evaluacionesRaw);
    } catch {
        return `<p>${escapeHtmlForEmail(String(evaluacionesRaw))}</p><br>`;
    }
    if (Array.isArray(parsed)) {
        let html = "";
        for (const item of parsed) {
            if (!item || typeof item !== "object") continue;
            const row = item as Record<string, unknown>;
            const q = String(row.question ?? "").trim();
            const v = row.result ?? row.value ?? "";
            html += `<p><strong>${escapeHtmlForEmail(q)}</strong>: ${escapeHtmlForEmail(String(v))}</p><br>`;
        }
        return html;
    }
    if (
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed) &&
        Array.isArray((parsed as Record<string, unknown>).form)
    ) {
        const o = parsed as { form: unknown[]; know_process?: unknown };
        let html = "";
        for (const sec of o.form) {
            if (!sec || typeof sec !== "object") continue;
            const secObj = sec as Record<string, unknown>;
            const title = String(secObj.section_title ?? "").trim();
            if (title) html += `<h3>${escapeHtmlForEmail(title)}</h3>`;
            const questions = Array.isArray(secObj.questions) ? secObj.questions : [];
            for (const q of questions) {
                if (!q || typeof q !== "object") continue;
                const qRow = q as Record<string, unknown>;
                const qt = String(qRow.question ?? "").trim();
                const apply = Boolean(qRow.apply);
                const val = apply ? Number(qRow.value) : 0;
                const valLabel = apply && Number.isFinite(val) ? `Calificación: ${val} / 5` : "Calificación: N/A (0)";
                html += `<p><strong>${escapeHtmlForEmail(qt)}</strong> — Aplica: ${apply ? "Sí" : "No"} — ${valLabel}</p>`;
            }
            const obs = String(secObj.observations ?? "").trim();
            if (obs) html += `<p><em>Observaciones:</em> ${escapeHtmlForEmail(obs)}</p>`;
            html += "<br>";
        }
        const kp = Boolean(o.know_process);
        html += `<p><strong>¿Conoce el procedimiento de atención de quejas de la compañía?</strong> ${kp ? "Sí" : "No"}</p><br>`;
        return html;
    }
    return `<p>${escapeHtmlForEmail(JSON.stringify(parsed))}</p><br>`;
}

export async function GET(req: NextRequest) {
    try {
        const { valid, expired, message } = await verifyAccessTokenByApi(req);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        // Parámetros de la jerarquía completa
        const empresaIdStr = req.nextUrl.searchParams.get("empresa_id");
        const clienteIdStr = req.nextUrl.searchParams.get("cliente_id");
        const divisionIdStr = req.nextUrl.searchParams.get("division_id");
        const contratoIdStr = req.nextUrl.searchParams.get("contrato_id");
        const corpoIdStr = req.nextUrl.searchParams.get("corpo_id");
        const puestoIdStr = req.nextUrl.searchParams.get("puesto_id");

        const where: any = {};

        // Filtro por empresa: filtrar clientes que pertenecen a esa empresa
        // Solo se aplica si no hay filtro más específico de cliente
        if (empresaIdStr && !clienteIdStr) {
            const empresaId = parseInt(empresaIdStr);
            const clientes = await prisma.e_estructura_cliente.findMany({
                where: { empresa_id: empresaId },
                select: { id: true },
            });
            const clientesArray = clientes;
            const clienteIds = clientesArray.map((c: any) => c.id);
            if (clienteIds.length > 0) {
                where.cliente_id = { in: clienteIds };
            } else {
                // Si no hay clientes, retornar vacío
                return NextResponse.json({ status: true, encuestas: [] }, { status: 200 });
            }
        }

        // Filtro directo por cliente (tiene prioridad sobre empresa)
        if (clienteIdStr) {
            where.cliente_id = parseInt(clienteIdStr);
        }

        // Filtro directo por división
        if (divisionIdStr) {
            where.division_id = parseInt(divisionIdStr);
        }

        // Filtro por contrato: filtrar sucursales que pertenecen a ese contrato
        // Solo se aplica si no hay filtro más específico de corpo
        if (contratoIdStr && !corpoIdStr) {
            const contratoId = parseInt(contratoIdStr);
            const sucursales = await prisma.e_estructura_sucursal.findMany({
                where: { contrato_id: contratoId },
                select: { id: true },
            });
            const sucursalesArray = sucursales;
            const sucursalIds = sucursalesArray.map((s: any) => s.id);
            if (sucursalIds.length > 0) {
                where.corpo_id = { in: sucursalIds };
            } else {
                // Si no hay sucursales, retornar vacío
                return NextResponse.json({ status: true, encuestas: [] }, { status: 200 });
            }
        }

        // Filtro directo por corpo (tiene prioridad sobre contrato)
        if (corpoIdStr) {
            where.corpo_id = parseInt(corpoIdStr);
        }

        // Filtro directo por puesto
        if (puestoIdStr) {
            where.puesto_id = parseInt(puestoIdStr);
        }

        where.isActive = true;

        const { sameGroupInclude, preexistentSpecs } = splitIncludeByTableGroup(ENCUESTA_NPS_ESTRUCTURA_INCLUDE);

        const encuestas = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_encuesta_cliente",
                operation: "findMany",
                where,
                orderBy: { created_at: "desc" },
                ...(sameGroupInclude ? { include: sameGroupInclude } : {}),
            },
        });
        await hydratePreexistentRelations(encuestas, preexistentSpecs);
        const encuestasArray = Array.isArray(encuestas) ? encuestas : [];

        const encuestas_return: { id: number, nombre_firma: string, persona_evaluada: string, cedula_persona_evaluada: string, empresa: { id: number, nombre: string }, cliente: { id: number, nombre: string }, sucursal: { id: number, nombre: string }, puesto: { id: number, nombre: string }, division: { id: number, nombre: string }, responsable_id: number, responsable: { nombre: string, cedula: string }, firma_responsable: string, fecha: string, evaluaciones: string }[] = [];
        for (const encuesta of encuestasArray) {
            const encuestaObj = encuesta as any;
            let nombre_firma = "No disponible";
            if (encuestaObj.firma_responsable) {
                const id_firma = atob(encuestaObj.firma_responsable).split(":")[1];
                const firma = await prisma.c_empleado.findUnique({ where: { id: parseInt(id_firma) } });
                if (firma) {
                    const firmaObj = firma as any;
                    nombre_firma = (firmaObj.nombre || "") + " " + (firmaObj.primer_apellido || "") + " " + (firmaObj.segundo_apellido || "");
                    if (firmaObj.cedula) {
                        nombre_firma += " (" + firmaObj.cedula + ")";
                    }
                }
            }
            const fechaValue = encuestaObj.fecha instanceof Date ? encuestaObj.fecha : (typeof encuestaObj.fecha === 'string' ? new Date(encuestaObj.fecha) : new Date());
            const encuesta_return: { id: number, nombre_firma: string, empresa_evaluada: string, persona_evaluada: string, cedula_persona_evaluada: string, telefono_persona_evaluada: string, email_persona_evaluada: string, firma_persona_evaluada: string, empresa: { id: number, nombre: string }, cliente: { id: number, nombre: string }, sucursal: { id: number, nombre: string }, puesto: { id: number, nombre: string }, division: { id: number, nombre: string }, responsable_id: number, responsable: { nombre: string, cedula: string }, firma_responsable: string, fecha: string, evaluaciones: string, observations: string } = {
                id: encuestaObj.id,
                empresa_evaluada: encuestaObj.empresa_evaluado || "",
                persona_evaluada: encuestaObj.nombre_evaluado || "",
                cedula_persona_evaluada: encuestaObj.cedula_evaluado || "",
                telefono_persona_evaluada: encuestaObj.telefono_evaluado || "",
                email_persona_evaluada: encuestaObj.email_evaluado || "",
                firma_persona_evaluada: encuestaObj.firma_evaluado || "",
                empresa: {
                    id: encuestaObj.e_estructura_empresa?.id || encuestaObj.empresa_id,
                    nombre: encuestaObj.e_estructura_empresa?.nombre || ""
                },
                cliente: {
                    id: encuestaObj.e_estructura_cliente?.id || encuestaObj.cliente_id,
                    nombre: encuestaObj.e_estructura_cliente?.nombre || ""
                },
                sucursal: {
                    id: encuestaObj.e_estructura_sucursal?.id || encuestaObj.corpo_id,
                    nombre: encuestaObj.e_estructura_sucursal?.nombre || ""
                },
                puesto: {
                    id: encuestaObj.e_estructura_puesto?.id || encuestaObj.puesto_id,
                    nombre: encuestaObj.e_estructura_puesto?.nombre || ""
                },
                division: {
                    id: encuestaObj.n_division?.id || encuestaObj.division_id,
                    nombre: encuestaObj.n_division?.nombre || ""
                },
                responsable_id: encuestaObj.responsable_id,
                responsable: {
                    nombre: encuestaObj.nombre_responsable,
                    cedula: encuestaObj.cedula_responsable || ""
                },
                firma_responsable: encuestaObj.firma_responsable || "",
                nombre_firma: nombre_firma,
                fecha: fechaValue.toISOString(),
                evaluaciones: encuestaObj.evaluaciones,
                observations: encuestaObj.observaciones
            };
            encuestas_return.push(encuesta_return);
        }

        return NextResponse.json({ status: true, encuestas: encuestas_return }, { status: 200 });
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const {
            marca_id,
            empresa_id,
            cliente_id,
            division_id,
            corpo_id,
            puesto_id,
            contrato_id,
            fecha,
            evaluaciones,
            persona_evaluada,
            cedula_persona_evaluada,
            telefono_persona_evaluada,
            email_persona_evaluada,
            nombre_responsable,
            cedula_responsable,
            firma_responsable,
            firma_persona_evaluada,
            empresa_evaluada,
            observaciones
        } = await req.json();

        console.log("marca_id", marca_id);
        console.log("puesto_id", puesto_id);
        console.log("fecha", fecha);
        console.log("evaluaciones", evaluaciones);
        console.log("persona_evaluada", persona_evaluada);
        console.log("cedula_persona_evaluada", cedula_persona_evaluada);
        console.log("telefono_persona_evaluada", telefono_persona_evaluada);
        console.log("email_persona_evaluada", email_persona_evaluada);
        console.log("nombre_responsable", nombre_responsable);
        console.log("cedula_responsable", cedula_responsable);
        console.log("firma_responsable", firma_responsable);
        console.log("firma_persona_evaluada", firma_persona_evaluada);
        console.log("empresa_evaluada", empresa_evaluada);
        console.log("observaciones", observaciones);
        console.log("--------------------------------");

        if (!marca_id || !empresa_evaluada || !puesto_id || !fecha || !evaluaciones || !persona_evaluada || !cedula_persona_evaluada || !nombre_responsable || !cedula_responsable || !firma_responsable || !observaciones) {
            return NextResponse.json({ status: false, message: "Datos incompletos" }, { status: 200 });
        }

        // Validar que los IDs de la jerarquía estén presentes
        if (!empresa_id || !cliente_id || !division_id || !corpo_id || !puesto_id) {
            return NextResponse.json({ status: false, message: "IDs de jerarquía incompletos" }, { status: 200 });
        }

        const contratoIdNum =
            contrato_id != null && String(contrato_id).trim() !== "" ? parseInt(String(contrato_id), 10) : 0;
        const contratoIdFinal = Number.isFinite(contratoIdNum) && contratoIdNum > 0 ? contratoIdNum : 0;

        const marca = await prisma.c_marca_dia.findUnique({ where: { id: parseInt(marca_id) } });
        if (!marca) {
            return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 200 });
        }

        const marcaObj = marca as any;
        if (!marcaObj.empleadoFijo_id) {
            return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 200 });
        }

        const empleado = await prisma.c_empleado.findUnique({ where: { id: marcaObj.empleadoFijo_id } });
        if (!empleado) {
            return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 200 });
        }

        const empresa = await prisma.e_estructura_empresa.findUnique({ where: { id: parseInt(String(empresa_id)) } });
        if (!empresa) {
            return NextResponse.json({ status: false, message: "Empresa no encontrada" }, { status: 200 });
        }

        const cliente = await prisma.e_estructura_cliente.findUnique({ where: { id: parseInt(String(cliente_id)) } });
        if (!cliente) {
            return NextResponse.json({ status: false, message: "Cliente no encontrado" }, { status: 200 });
        }

        const corpo = await prisma.e_estructura_sucursal.findUnique({ where: { id: parseInt(String(corpo_id)) } });
        if (!corpo) {
            return NextResponse.json({ status: false, message: "Corpo no encontrado" }, { status: 200 });
        }

        const puesto_db = await prisma.e_estructura_puesto.findUnique({ where: { id: parseInt(String(puesto_id)) } });
        if (!puesto_db) {
            return NextResponse.json({ status: false, message: "Puesto no encontrado" }, { status: 200 });
        }

        const division = await prisma.n_division.findUnique({ where: { id: parseInt(String(division_id)) } });
        if (!division) {
            return NextResponse.json({ status: false, message: "Division no encontrada" }, { status: 200 });
        }

        const responsable = await prisma.c_empleado.findUnique({ where: { id: marcaObj.empleadoFijo_id } });
        if (!responsable) {
            return NextResponse.json({ status: false, message: "Responsable no encontrada" }, { status: 200 });
        }

        const empresaObj = empresa as any;
        const clienteObj = cliente as any;
        const corpoObj = corpo as any;
        const puestoObj = puesto_db as any;
        const divisionObj = division as any;
        const responsableObj = responsable as any;

        const fechaDate = fecha instanceof Date ? fecha : new Date(fecha);
        const createdAtStamp = toZonedTime(new Date(), "America/Costa_Rica");
        const encuesta = await callDynamicPrisma({
            req,
            data: {
                action: "POST",
                table: "c_encuesta_cliente",
                operation: "create",
                data: {
                    empresa_id: empresaObj.id,
                    cliente_id: clienteObj.id,
                    corpo_id: corpoObj.id,
                    puesto_id: puestoObj.id,
                    division_id: divisionObj.id,
                    responsable_id: responsableObj.id,
                    contrato_id: contratoIdFinal,
                    empresa_evaluado: empresa_evaluada,
                    firma_responsable: firma_responsable,
                    created_at: createdAtStamp.toISOString(),
                    fecha: fechaDate.toISOString(),
                    evaluaciones: evaluaciones,
                    nombre_evaluado: persona_evaluada,
                    cedula_evaluado: cedula_persona_evaluada,
                    telefono_evaluado: telefono_persona_evaluada,
                    email_evaluado: email_persona_evaluada,
                    firma_evaluado: (firma_persona_evaluada != null && String(firma_persona_evaluada).trim() !== '') ? firma_persona_evaluada : null,
                    nombre_responsable: nombre_responsable,
                    cedula_responsable: cedula_responsable,
                    observaciones: observaciones
                }
            }
        });

        if (encuesta) {
            const encuestaObj = encuesta as any;
            const createdByNum = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
            await callDynamicPrisma({
                req,
                data: {
                    action: "POST",
                    table: "c_cambios_apps_modules",
                    operation: "create",
                    data: {
                        nombre_tabla: "c_encuesta_cliente",
                        registro_id: encuestaObj.id,
                        cambios: JSON.stringify([{
                            prop: "__created__",
                            before: null,
                            after: {
                                id: encuestaObj.id,
                                empresa_id: empresaObj.id,
                                cliente_id: clienteObj.id,
                                corpo_id: corpoObj.id,
                                puesto_id: puestoObj.id,
                                division_id: divisionObj.id,
                                responsable_id: responsableObj.id,
                                fecha: fechaDate.toISOString(),
                                evaluaciones: encuestaObj.evaluaciones ?? evaluaciones,
                                firma_responsable: encuestaObj.firma_responsable ?? firma_responsable,
                                nombre_evaluado: encuestaObj.nombre_evaluado ?? persona_evaluada,
                                cedula_evaluado: encuestaObj.cedula_evaluado ?? cedula_persona_evaluada,
                                telefono_evaluado: encuestaObj.telefono_evaluado ?? telefono_persona_evaluada,
                                email_evaluado: encuestaObj.email_evaluado ?? email_persona_evaluada,
                                firma_evaluado: encuestaObj.firma_evaluado ?? null,
                                nombre_responsable: encuestaObj.nombre_responsable ?? nombre_responsable,
                                cedula_responsable: encuestaObj.cedula_responsable ?? cedula_responsable,
                                empresa_evaluado: encuestaObj.empresa_evaluado ?? empresa_evaluada,
                                observaciones: encuestaObj.observaciones ?? observaciones,
                            },
                        }]),
                        created_at: createdAtStamp.toISOString(),
                        created_by: createdByNum,
                    },
                },
            });
            const evaluaciones_html = buildEvaluacionesEmailHtml(evaluaciones);

            // Solo enviar correo si hay un email válido
            if (email_persona_evaluada && email_persona_evaluada.trim() !== '') {
                try {
                    await transporter.sendMail({
                        from: `Encuesta NPS - <${process.env.EMAIL_USER}>`,
                        to: email_persona_evaluada,
                        subject: "Encuesta de satisfacción del puesto " + puesto_db.nombre,
                        html: `
                            <h1>Buenos días, estimado(a) ${persona_evaluada} (${cedula_persona_evaluada}) de la organización ${empresa_evaluada}</h1>
                            <p>Gracias por tu tiempo y esfuerzo en completar la encuesta de satisfacción del puesto ${puesto_db.nombre}.</p>
                            <p>A continuación, te mostramos un resumen de la encuesta:</p><br>
                            ${evaluaciones_html}
                            <p>Gracias por tu colaboración.</p>
                        `
                    });
                } catch (emailError) {
                    console.error("Error al enviar correo:", emailError);
                    // Continuar con el proceso aunque falle el envío del correo
                }
            }

            const fecha_encuesta_string = fechaDate.toISOString().split('T')[0];
            const hora_encuesta_string = fechaDate.toISOString().split('T')[1].split('.')[0];
            const emailInfo = email_persona_evaluada && email_persona_evaluada.trim() !== ''
                ? `Se ha enviado un correo de confirmación a ${email_persona_evaluada}.`
                : 'No se envió correo de confirmación (no se proporcionó email).';
            const desc_notification = `La encuesta de satisfacción del puesto "${puestoObj.nombre}" realizada el día ${fecha_encuesta_string} a las ${hora_encuesta_string} por parte de "${persona_evaluada}" (${cedula_persona_evaluada}) de la empresa "${empresa_evaluada}" ha sido agregada. ${emailInfo}`;
            await sendNotificationByRole(req, marcaObj.corpo_id, [marcaObj.plaza_id], "Encuesta de satisfacción agregada", desc_notification, ["ADMINISTRATIVO", "SUPERVISOR"]);
        }

        const createdId = (encuesta as any)?.id != null ? Number((encuesta as any).id) : undefined;
        return NextResponse.json(
            {
                status: true,
                message: "Encuesta creada correctamente",
                data: createdId != null && Number.isFinite(createdId) ? { id: createdId } : undefined,
            },
            { status: 200 }
        );
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}