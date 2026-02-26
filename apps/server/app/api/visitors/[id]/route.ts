import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";
import { toZonedTime } from "date-fns-tz";
import path from "path";
import fs from "fs";
import { uploadDynamicFiles } from "../../../../utils/callDynamicFilesApi";

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
            nombre,
            cedula,
            hora_entrada,
            hora_salida,
            razon_visita,
            es_funcionario,
            observaciones,
            tipo_accion,
            pers_autoriza_salida,
            foto_cedula, // viene en base64
            activos,
        } = await req.json();

        const visitor = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "e_registro_personas", operation: "findUnique", where: { id } }
        });
        if (!visitor) {
            return NextResponse.json({ status: false, message: "Visita no encontrada" }, { status: 200 });
        }

        // Preparar datos de actualización
        const updateData: any = {
            nombre,
            cedula,
            hora_entrada: new Date(hora_entrada).toISOString(),
            hora_salida: hora_salida ? new Date(hora_salida).toISOString() : null,
            razon_visita,
            es_funcionario,
            observaciones,
            tipo_accion,
            pers_autoriza_salida,
            updated_at: toZonedTime(new Date(), "America/Costa_Rica").toISOString(),
        };

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
            detalles: a.detalles ? JSON.parse(a.detalles) : [],
            numero_serie: a.numero_serie,
            numero_activo: a.numero_activo,
        }));

        const cambiosArr: Array<{ prop: string; before: any; after: any }> = [];
        for (const [k, v] of Object.entries(updateData)) {
            // No registramos archivos: esos vienen en `foto_cedula` y se guardan aparte.
            if (k === "foto_cedula") continue;

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
                                detalles: JSON.stringify(a.detalles),
                                numero_serie: a.numero_serie,
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

        return NextResponse.json({ status: true, message: "Visita actualizada correctamente" }, { status: 200 });
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
            return NextResponse.json({ status: false, message: "Visita no encontrada" }, { status: 200 });
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

        return NextResponse.json({ status: true, message: "Visita eliminada correctamente" }, { status: 200 });
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}
