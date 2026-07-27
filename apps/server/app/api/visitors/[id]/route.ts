import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";
import { prisma } from "../../../../utils/prismaClient";
import { toZonedTime } from "date-fns-tz";
import path from "path";
import fs from "fs";
import { uploadDynamicFiles } from "../../../../utils/callDynamicFilesApi";
import { visitorsResolveHierarchyFromPuestoId } from "../../../../utils/visitorsResolveHierarchyFromPuesto";

async function getClienteIdForSucursalPut(_req: NextRequest, sucursalId: number): Promise<number | null> {
    const sucursal = await prisma.e_estructura_sucursal.findUnique({ where: { id: sucursalId } });
    if (!sucursal?.contrato_id) {
        return null;
    }
    const contrato = await prisma.e_estructura_contrato.findUnique({ where: { id: Number(sucursal.contrato_id) } });
    const cliente_id = contrato?.cliente_id != null ? Number(contrato.cliente_id) : NaN;
    return Number.isFinite(cliente_id) && cliente_id > 0 ? cliente_id : null;
}

async function clienteAndPuestoForCorpoPut(
    _req: NextRequest,
    corpoId: number
): Promise<{ cliente_id: number; puesto_id: number } | null> {
    const sucursal = await prisma.e_estructura_sucursal.findUnique({ where: { id: corpoId } });
    if (!sucursal?.contrato_id) {
        return null;
    }
    const contrato = await prisma.e_estructura_contrato.findUnique({ where: { id: Number(sucursal.contrato_id) } });
    const cliente_id = contrato?.cliente_id != null ? Number(contrato.cliente_id) : NaN;
    if (!Number.isFinite(cliente_id) || cliente_id <= 0) {
        return null;
    }
    const puestos = await prisma.e_estructura_puesto.findMany({ where: { sucursal_id: corpoId } });
    const puesto_id = puestos[0]?.id != null ? Number(puestos[0].id) : NaN;
    if (!Number.isFinite(puesto_id) || puesto_id <= 0) {
        return null;
    }
    return { cliente_id, puesto_id };
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);

        if (!id) {
            return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });
        }

        const {
            corpo_id: bodyCorpoId,
            puesto_id: bodyPuestoId,
            nombre,
            cedula,
            hora_entrada,
            hora_salida,
            razon_visita,
            dep_pers_visita,
            es_funcionario,
            observaciones,
            tipo_accion,
            pers_autoriza_salida,
            foto_cedula, // viene en base64
            firma_visitante, // viene en base64 y opcional
            activos,
        } = await req.json();

        const visitor = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "e_registro_personas", operation: "findUnique", where: { id } }
        });
        if (!visitor) {
            return NextResponse.json({ status: false, message: "Persona no encontrada" }, { status: 200 });
        }

        // Preparar datos de actualización
        const updateData: any = {
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
            updated_at: toZonedTime(new Date(), "America/Costa_Rica").toISOString(),
        };

        const bodyCorpoParsed =
            bodyCorpoId != null && bodyCorpoId !== ""
                ? parseInt(String(bodyCorpoId), 10)
                : NaN;
        const bodyPuestoParsed =
            bodyPuestoId != null && bodyPuestoId !== ""
                ? parseInt(String(bodyPuestoId), 10)
                : NaN;

        const corpoChanging =
            Number.isFinite(bodyCorpoParsed) &&
            bodyCorpoParsed > 0 &&
            bodyCorpoParsed !== Number(visitor.corpo_id);

        if (corpoChanging) {
            const cp = await clienteAndPuestoForCorpoPut(req, bodyCorpoParsed);
            if (!cp) {
                return NextResponse.json(
                    { status: false, message: "No se pudo resolver cliente/puesto para la sucursal indicada" },
                    { status: 200 }
                );
            }
            if (Number(cp.cliente_id) !== Number(visitor.cliente_id)) {
                return NextResponse.json(
                    { status: false, message: "La sucursal indicada no pertenece al mismo cliente del registro" },
                    { status: 200 }
                );
            }
            updateData.corpo_id = bodyCorpoParsed;
            if (Number.isFinite(bodyPuestoParsed) && bodyPuestoParsed > 0) {
                const puestoRow = await prisma.e_estructura_puesto.findUnique({ where: { id: bodyPuestoParsed } });
                if (!puestoRow) {
                    return NextResponse.json({ status: false, message: "Puesto no encontrado" }, { status: 200 });
                }
                if (Number(puestoRow.sucursal_id) !== bodyCorpoParsed) {
                    return NextResponse.json(
                        { status: false, message: "El puesto no pertenece a la sucursal indicada" },
                        { status: 200 }
                    );
                }
                updateData.puesto_id = bodyPuestoParsed;
            } else {
                updateData.puesto_id = cp.puesto_id;
            }
        } else if (Number.isFinite(bodyPuestoParsed) && bodyPuestoParsed > 0 && bodyPuestoParsed !== Number(visitor.puesto_id)) {
            const puestoRow = await prisma.e_estructura_puesto.findUnique({ where: { id: bodyPuestoParsed } });
            if (!puestoRow) {
                return NextResponse.json({ status: false, message: "Puesto no encontrado" }, { status: 200 });
            }
            if (Number(puestoRow.sucursal_id) !== Number(visitor.corpo_id)) {
                return NextResponse.json(
                    { status: false, message: "El puesto no pertenece a la sucursal del registro" },
                    { status: 200 }
                );
            }
            const clienteDelPuesto = await getClienteIdForSucursalPut(req, Number(visitor.corpo_id));
            if (clienteDelPuesto == null || Number(clienteDelPuesto) !== Number(visitor.cliente_id)) {
                return NextResponse.json(
                    { status: false, message: "No se pudo validar el cliente del puesto" },
                    { status: 200 }
                );
            }
            updateData.puesto_id = bodyPuestoParsed;
        }

        const hierarchyChanged = updateData.corpo_id != null || updateData.puesto_id != null;
        if (hierarchyChanged) {
            const finalCorpo = updateData.corpo_id != null ? Number(updateData.corpo_id) : Number(visitor.corpo_id);
            const finalPuesto = updateData.puesto_id != null ? Number(updateData.puesto_id) : Number(visitor.puesto_id);
            if (Number.isFinite(finalCorpo) && finalCorpo > 0 && Number.isFinite(finalPuesto) && finalPuesto > 0) {
                const h = await visitorsResolveHierarchyFromPuestoId(req, finalPuesto, finalCorpo);
                if (!h.ok) {
                    return NextResponse.json({ status: false, message: h.message }, { status: 200 });
                }
                updateData.cliente_id = h.cliente_id;
                updateData.empresa_id = h.empresa_id;
                updateData.division_id = h.division_id;
                updateData.contrato_id = h.contrato_id;
            }
        }

        // Registrar cambios (solo campos actualizados)
        const eq = (a: any, b: any) => {
            if (a === b) return true;
            if (a == null && b == null) return true;
            const da = a instanceof Date ? a : (typeof a === "string" && /^\d{4}-\d{2}-\d{2}T/.test(a) ? new Date(a) : null);
            const db = b instanceof Date ? b : (typeof b === "string" && /^\d{4}-\d{2}-\d{2}T/.test(b) ? new Date(b) : null);
            if (da && db) return da.getTime() === db.getTime();
            return false;
        };

        // Obtener activos existentes antes de eliminarlos
        const activosExistentes = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "e_activo_visitante", operation: "findMany", where: { visitante_id: visitor.id } }
        });
        const activosExistentesArray = activosExistentes.map((a: any) => ({
            tipo_id: a.tipo_id,
            nombre: a.nombre,
            detalles: a.detalles ? (typeof a.detalles === 'string' ? JSON.parse(a.detalles) : a.detalles) : [],
            numero_id: a.numero_id,
            numero_activo: a.numero_activo,
        }));

        const cambiosArr: Array<{ prop: string; before: any; after: any }> = [];
        for (const [k, v] of Object.entries(updateData)) {
            // No registramos archivos: esos vienen en `foto_cedula` y se guardan aparte.
            if (k === "foto_cedula" || k === "firma_visitante") continue;

            const before = (visitor as any)[k];
            const after = v;
            if (!eq(before, after)) {
                cambiosArr.push({
                    prop: k,
                    before: before instanceof Date ? before.toISOString() : before,
                    after: after instanceof Date ? after.toISOString() : after,
                });
            }
        }

        // Comparar activos (como array completo)
        const activosBeforeStr = JSON.stringify(activosExistentesArray);
        const activosAfterStr = JSON.stringify(activos);
        if (activosBeforeStr !== activosAfterStr) {
            cambiosArr.push({
                prop: "activos",
                before: activosExistentesArray,
                after: activos,
            });
        }

        await callDynamicPrisma({
            req,
            data: {
                action: "UPDATE",
                table: "e_registro_personas",
                where: { id },
                data: updateData
            }
        });

        if (cambiosArr.length > 0) {
            const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
            await callDynamicPrisma({
                req,
                data: {
                    action: "POST",
                    table: "c_cambios_apps_modules",
                    data: {
                        nombre_tabla: "e_registro_personas",
                        registro_id: id,
                        cambios: JSON.stringify(cambiosArr),
                        created_at: toZonedTime(new Date(), "America/Costa_Rica").toISOString(),
                        created_by: createdBy,
                    }
                }
            });
        }

        // Eliminar activos existentes
        await callDynamicPrisma({
            req,
            data: {
                action: "DELETE",
                table: "e_activo_visitante",
                many: true,
                where: { visitante_id: visitor.id }
            }
        });

        // Crear nuevos activos
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
                                visitante_id: visitor.id,
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

        console.log(foto_cedula);

        if (foto_cedula) {
            if (visitor.foto_cedula) {
                const path_file = path.join(process.cwd(), "public", "uploads", "visitors", visitor.id.toString(), "cedula", visitor.foto_cedula);
                if (fs.existsSync(path_file)) fs.unlinkSync(path_file);
            }
            const matches = foto_cedula.match(/^data:(.+);base64,(.+)$/);
            if (!matches) throw new Error("Formato base64 inválido");
            const extension = matches[1].split("/")[1]?.replace("jpeg", "jpg") || "jpg";
            const uploadResp = await uploadDynamicFiles({
                req,
                folderPath: `visitors/${visitor.id}/cedula`,
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
                        where: { id: visitor.id },
                        data: { foto_cedula: file_name }
                    }
                });
            }
        }

        return NextResponse.json({ status: true, message: "Persona actualizada correctamente" }, { status: 200 });
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);

        if (!id) {
            return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });
        }

        const existing = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "e_registro_personas", operation: "findUnique", where: { id } }
        });
        if (!existing) {
            return NextResponse.json({ status: false, message: "Persona no encontrada" }, { status: 200 });
        }

        await callDynamicPrisma({
            req,
            data: { action: "DELETE", table: "e_registro_personas", where: { id } }
        });

        // Registrar cambio de eliminación
        const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
        await callDynamicPrisma({
            req,
            data: {
                action: "POST",
                table: "c_cambios_apps_modules",
                data: {
                    nombre_tabla: "e_registro_personas",
                    registro_id: id,
                    cambios: JSON.stringify([{
                        prop: "__deleted__",
                        before: {
                            id: existing.id,
                            nombre: existing.nombre,
                            cedula: existing.cedula,
                            razon_visita: existing.razon_visita,
                        },
                        after: null,
                    }]),
                    created_at: toZonedTime(new Date(), "America/Costa_Rica").toISOString(),
                    created_by: createdBy,
                }
            }
        });

        return NextResponse.json({ status: true, message: "Persona eliminada correctamente" }, { status: 200 });
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}
