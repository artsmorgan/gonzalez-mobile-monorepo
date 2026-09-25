/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";
import { prisma } from "../../../utils/prismaClient";
import { toZonedTime } from "date-fns-tz";
import { uploadDynamicFiles } from "../../../utils/callDynamicFilesApi";
import { sendNotificationByRole } from "../../../utils/sendNotification";
import { visitorsResolveHierarchyFromPuestoId } from "../../../utils/visitorsResolveHierarchyFromPuesto";
import {
    assertCorpoAllowedForMarca,
    resolveClienteYPuestoParaAlta,
} from "../../../utils/registroCorpoPuesto";
import { reportError } from "../../../utils/reportError";

export async function GET(req: NextRequest) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }
        const searchParams = req.nextUrl.searchParams;
        const marca = searchParams.get("m");
        const corpoParam = searchParams.get("corpo_id");

        if (!marca) {
            // No se corrige a 400: el cliente móvil (visitorsCacheHelpers.ts) revisa
            // `!response.ok` antes de leer el body y perdería este mensaje específico.
            await reportError(req, "api/visitors", "GET", 400, "Marca no especificada");
            return NextResponse.json({ status: false, message: "Marca no especificada" }, { status: 400 });
        }

        const corpoIdReq = corpoParam != null && corpoParam !== "" ? parseInt(String(corpoParam), 10) : NaN;
        if (!Number.isFinite(corpoIdReq) || corpoIdReq <= 0) {
            await reportError(req, "api/visitors", "GET", 400, "Sucursal no especificada");
            return NextResponse.json({ status: false, message: "Sucursal no especificada" }, { status: 400 });
        }

        const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id: parseInt(marca) } });
        if (!marcaDia) {
            await reportError(req, "api/visitors", "GET", 404, "Marca no encontrada");
            return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 404 });
        }

        const corpoOk = await assertCorpoAllowedForMarca(req, marcaDia, corpoIdReq);
        if (!corpoOk.ok) {
            await reportError(req, "api/visitors", "GET", 400, corpoOk.message);
            return NextResponse.json({ status: false, message: corpoOk.message }, { status: 400 });
        }

        if (!marcaDia.empleadoFijo_id) {
            await reportError(req, "api/visitors", "GET", 404, "Empleado no encontrado");
            return NextResponse.json(
                { status: false, message: "Empleado no encontrado" },
                { status: 200 }
            );
        }

        const visitas = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "e_registro_personas",
                operation: "findMany",
                where: { corpo_id: corpoIdReq, isActive: true }
            }
        });

        const visitas_return: any[] = [];
        for (const v of visitas) {

            const responsable = await prisma.c_empleado.findUnique({ where: { id: v.responsable_id } });
            if (!responsable) {
                return NextResponse.json({ status: false, message: "Responsable no encontrado" }, { status: 200 });
            }

            const activos = [];
            const activo_visitante = await callDynamicPrisma({
                req,
                data: { action: "GET", table: "e_activo_visitante", operation: "findMany", where: { visitante_id: v.id } }
            });
            if (activo_visitante.length > 0) {
                for (const a of activo_visitante) {
                    const tipo_activo = await callDynamicPrisma({
                        req,
                        data: { action: "GET", table: "n_tipo_activo_visitas", operation: "findUnique", where: { id: a.tipo_id } }
                    });
                    if (tipo_activo) {
                        activos.push({
                            tipo: {
                                id: tipo_activo.id,
                                nombre: tipo_activo.nombre,
                            },
                            nombre: a.nombre,
                            detalles: a.detalles,
                            numero_id: a.numero_id,
                            numero_activo: a.numero_activo,
                        });
                    }
                }
            }

            let puesto_nombre: string | null = null;
            const puestoIdNum = v.puesto_id != null ? Number(v.puesto_id) : NaN;
            if (Number.isFinite(puestoIdNum) && puestoIdNum > 0) {
                const puestoRow = await prisma.e_estructura_puesto.findUnique({ where: { id: puestoIdNum } });
                puesto_nombre = puestoRow?.nombre != null ? String(puestoRow.nombre) : null;
            }

            let puesto_salida: { id: number; nombre: string; codigo: string | null } | null = null;
            if (v.puesto_salida_id) {
                const puestoSalidaRow = await prisma.e_estructura_puesto.findUnique({ where: { id: v.puesto_salida_id } });
                if (puestoSalidaRow) {
                    puesto_salida = { id: puestoSalidaRow.id, nombre: puestoSalidaRow.nombre, codigo: puestoSalidaRow.codigo };
                }
            }

            visitas_return.push({
                id: v.id,
                nombre: v.nombre,
                cedula: v.cedula,
                hora_entrada: v.hora_entrada,
                hora_salida: v.hora_salida,
                razon_visita: v.razon_visita,
                dep_pers_visita: v.dep_pers_visita ?? null,
                responsable: {
                    id: v.responsable_id,
                    nombre: responsable.nombre + " " + responsable.primer_apellido + " " + responsable.segundo_apellido,
                },
                es_funcionario: v.es_funcionario,
                observaciones: v.observaciones,
                tipo_accion: v.tipo_accion,
                pers_autoriza_salida: v.pers_autoriza_salida,
                firma_visitante: v.firma_visitante,
                foto_cedula: v.foto_cedula,
                updated_at: v.updated_at,
                activos: activos,
                corpo_id: v.corpo_id,
                puesto_id: v.puesto_id,
                puesto_nombre,
                puesto_salida_id: v.puesto_salida_id ?? null,
                puesto_salida,
                id_local: "",
                empresa_id: v.empresa_id,
                division_id: v.division_id,
                contrato_id: v.contrato_id,
                cliente_id: v.cliente_id,
                isActive: v.isActive,
            });
        }

        return NextResponse.json({ status: true, data: visitas_return }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const {
            marca_id,
            corpo_id: bodyCorpoId,
            puesto_id: bodyPuestoId,
            nombre,
            cedula,
            hora_entrada,
            hora_salida, // Opcional
            razon_visita,
            dep_pers_visita, // Opcional
            es_funcionario,
            observaciones, // Opcional
            tipo_accion, // Opcional
            pers_autoriza_salida, // Opcional
            foto_cedula, // viene en base64 y opcional
            firma_visitante, // viene en base64 y opcional
            activos,
            puesto_salida_id,
        } = await req.json();

        console.log(activos);

        let puestoSalidaIdFinal: number | null = null;
        if (puesto_salida_id != null && puesto_salida_id !== "") {
            const parsedPuestoSalida = parseInt(String(puesto_salida_id), 10);
            if (!Number.isFinite(parsedPuestoSalida) || parsedPuestoSalida <= 0) {
                return NextResponse.json({ status: false, message: "Puesto de salida inválido" }, { status: 200 });
            }
            const puestoSalidaBd = await prisma.e_estructura_puesto.findUnique({ where: { id: parsedPuestoSalida } });
            if (!puestoSalidaBd) {
                return NextResponse.json({ status: false, message: "El puesto de salida no existe" }, { status: 200 });
            }
            puestoSalidaIdFinal = parsedPuestoSalida;
        }


        // Verificar marca
        const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id: parseInt(marca_id) } });
        if (!marcaDia) {
            return NextResponse.json(
                { status: false, message: "Marca no encontrada" },
                { status: 200 }
            );
        }

        const bodyCorpoParsed =
            bodyCorpoId != null && bodyCorpoId !== ""
                ? parseInt(String(bodyCorpoId), 10)
                : NaN;
        const targetCorpoId =
            Number.isFinite(bodyCorpoParsed) && bodyCorpoParsed > 0
                ? bodyCorpoParsed
                : Number(marcaDia.corpo_id);

        const corpoOkPost = await assertCorpoAllowedForMarca(req, marcaDia, targetCorpoId);
        if (!corpoOkPost.ok) {
            return NextResponse.json({ status: false, message: corpoOkPost.message }, { status: 200 });
        }

        const resolvedCp = await resolveClienteYPuestoParaAlta(req, marcaDia, targetCorpoId, bodyPuestoId);
        if (!resolvedCp.ok) {
            return NextResponse.json({ status: false, message: resolvedCp.message }, { status: 200 });
        }
        const clienteIdFinal = resolvedCp.cliente_id;
        const puestoIdFinal = resolvedCp.puesto_id;

        const hierarchy = await visitorsResolveHierarchyFromPuestoId(req, puestoIdFinal, targetCorpoId);
        if (!hierarchy.ok) {
            return NextResponse.json({ status: false, message: hierarchy.message }, { status: 200 });
        }
        if (Number(hierarchy.cliente_id) !== Number(clienteIdFinal)) {
            return NextResponse.json(
                { status: false, message: "Inconsistencia entre cliente resuelto y jerarquía del puesto" },
                { status: 200 }
            );
        }

        // Crear registro
        const createdAt = toZonedTime(new Date(), "America/Costa_Rica");
        const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;

        const new_visita = await callDynamicPrisma({
            req,
            data: {
                action: "POST",
                table: "e_registro_personas",
                data: {
                    cliente_id: hierarchy.cliente_id,
                    corpo_id: targetCorpoId,
                    puesto_id: puestoIdFinal,
                    empresa_id: hierarchy.empresa_id,
                    division_id: hierarchy.division_id,
                    contrato_id: hierarchy.contrato_id,
                    responsable_id: createdBy,
                    created_at: createdAt.toISOString(),
                    updated_at: createdAt.toISOString(),
                    nombre,
                    cedula,
                    hora_entrada: new Date(hora_entrada).toISOString(),
                    hora_salida: hora_salida ? new Date(hora_salida).toISOString() : null,
                    razon_visita,
                    dep_pers_visita: dep_pers_visita ?? null,
                    es_funcionario,
                    observaciones,
                    tipo_accion,
                    pers_autoriza_salida,
                    firma_visitante,
                    isActive: true,
                    puesto_salida_id: puestoSalidaIdFinal,
                }
            }
        });

        // Registrar cambio de creación
        await callDynamicPrisma({
            req,
            data: {
                action: "POST",
                table: "c_cambios_apps_modules",
                data: {
                    nombre_tabla: "e_registro_personas",
                    registro_id: new_visita.id,
                    cambios: JSON.stringify([{
                        prop: "__created__",
                        before: null,
                        after: {
                            id: new_visita.id,
                            nombre: new_visita.nombre,
                            cedula: new_visita.cedula,
                            hora_entrada: new_visita.hora_entrada,
                            hora_salida: new_visita.hora_salida ? new_visita.hora_salida : null,
                            razon_visita: new_visita.razon_visita,
                            dep_pers_visita: new_visita.dep_pers_visita ?? null,
                            es_funcionario: new_visita.es_funcionario,
                            observaciones: new_visita.observaciones,
                            tipo_accion: new_visita.tipo_accion,
                            pers_autoriza_salida: new_visita.pers_autoriza_salida,
                            firma_visitante: new_visita.firma_visitante,
                            activos: activos,
                        },
                    }]),
                    created_at: createdAt.toISOString(),
                    created_by: createdBy,
                }
            }
        });

        if (new_visita) {
            const empleado = await prisma.c_empleado.findUnique({ where: { id: payload.id } });
            if (empleado && marcaDia.plaza_id) {
                const entrada = new_visita.hora_entrada;
                const fecha_entrada = entrada.split("T")[0];
                const hora_entrada = entrada.split("T")[1].split(".")[0];
                const tipo_visitante = es_funcionario ? "Funcionario" : "Visitante";
                const desc = `El empleado ${empleado.nombre} ${empleado.primer_apellido} ha registrado la visita de ${nombre} con la cedula ${cedula} el día ${fecha_entrada} a las ${hora_entrada}. Tipo de persona: ${tipo_visitante}. Razón de la visita: ${razon_visita}`;
                await sendNotificationByRole(req, targetCorpoId, [marcaDia.plaza_id], "Persona registrada", desc, ["ADMINISTRATIVO", "SUPERVISOR"]);
            }

            if (activos.length > 0) {
                for (const a of activos) {
                    const tipo_activo = await callDynamicPrisma({
                        req,
                        data: { action: "GET", table: "n_tipo_activo_visitas", operation: "findUnique", where: { id: a.tipo_id } }
                    });
                    if (tipo_activo) {
                        await callDynamicPrisma({
                            req,
                            data: {
                                action: "POST",
                                table: "e_activo_visitante",
                                data: {
                                    visitante_id: new_visita.id,
                                    tipo_id: tipo_activo.id,
                                    nombre: (a.nombre != null && String(a.nombre).trim() !== '') ? String(a.nombre).trim() : tipo_activo.nombre,
                                    detalles: JSON.stringify(a.detalles),
                                    numero_id: a.numero_id != null ? String(a.numero_id) : '',
                                    numero_activo: a.numero_activo ? a.numero_activo : null,
                                }
                            }
                        });
                    }
                }
            }

            if (foto_cedula) {
                const matches = foto_cedula.match(/^data:(.+);base64,(.+)$/);
                if (!matches) throw new Error("Formato base64 inválido");
                const extension = matches[1].split("/")[1]?.replace("jpeg", "jpg") || "jpg";
                const uploadResp = await uploadDynamicFiles({
                    req,
                    folderPath: `visitors/${new_visita.id}/cedula`,
                    files: [{ type: "image", extension, file_base64: foto_cedula }],
                });
                const uploaded = Array.isArray(uploadResp?.files) ? uploadResp.files : [];
                const file_name = uploaded[0]?.name || "";
                if (file_name) {
                    await callDynamicPrisma({
                        req,
                        data: {
                            action: "UPDATE",
                            table: "e_registro_personas",
                            where: { id: new_visita.id },
                            data: { foto_cedula: file_name }
                        }
                    });
                }
            }
        }

        return NextResponse.json(
            {
                status: true,
                message: "Persona registrada correctamente", 
                data: { id: new_visita?.id != null ? Number(new_visita.id) : null }
            },
            { status: 200 }
        );
    } catch (error: unknown) {
        const errorMessage =
            error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}