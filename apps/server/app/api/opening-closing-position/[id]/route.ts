import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";
import { toZonedTime } from "date-fns-tz";
import fs from "fs";
import path from "path";
import { uploadDynamicFiles } from "../../../../utils/callDynamicFilesApi";

export const runtime = "nodejs";

type OpeningClosingImageInput = {
    file_base64: string;
    extension?: string;
    original_name?: string;
};

function safeParseJson<T>(value: any, fallback: T): T {
    try {
        if (typeof value === "string") {
            const trimmed = value.trim();
            if (trimmed.length === 0) return fallback;
            return JSON.parse(trimmed) as T;
        }
        if (value === null || value === undefined) return fallback;
        return value as T;
    } catch {
        return fallback;
    }
}

export async function PUT(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id, 10);
        const {
            cliente_id,
            corpo_id,
            puesto_id,
            division_id,
            fecha,
            tipo,
            nombre_representante_cliente,
            nombre_representante_empresa_entrante,
            nombre_representante_empresa_saliente,
            actividades,
            inventario,
            otras_observaciones,
            firma_representante_cliente,
            firma_representante_empresa_entrante,
            firma_representante_empresa_saliente,
            firma_responsable,
            imagenes,
            delete_imagenes,
        } = await req.json();

        if (!id) {
            return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
        }

        // Manejo de imágenes: opcionalmente borrar por IDs, y agregar nuevas
        const deleteIds: number[] = delete_imagenes ? safeParseJson<number[]>(delete_imagenes, []) : [];
        if (deleteIds.length > 0) {
            const imagesToDelete = await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "c_imagenes_apertura_cierre_puesto",
                    operation: "findMany",
                    where: { apetura_cierre_id: id, id: { in: deleteIds } },
                },
            });

            const imagesArray = Array.isArray(imagesToDelete) ? imagesToDelete : [];
            const dir = path.join(process.cwd(), "public", "uploads", "opening-closing-position", `${id}`);
            for (const img of imagesArray) {
                const imgObj = img as any;
                const p = path.join(dir, imgObj.name);
                try {
                    if (fs.existsSync(p)) fs.rmSync(p, { force: true });
                } catch {
                    // ignore
                }
            }

            await callDynamicPrisma({
                req,
                data: {
                    action: "DELETE",
                    table: "c_imagenes_apertura_cierre_puesto",
                    operation: "deleteMany",
                    where: { apetura_cierre_id: id, id: { in: deleteIds } },
                },
            });
        }

        let imagesParsed: OpeningClosingImageInput[] = [];
        if (imagenes) imagesParsed = safeParseJson<OpeningClosingImageInput[]>(imagenes, []);
        if (imagesParsed.length > 0) {
            const uploadResp = await uploadDynamicFiles({
                req,
                folderPath: `opening-closing-position/${id}`,
                files: imagesParsed
                    .filter((img) => img?.file_base64)
                    .map((img) => ({
                        type: "image",
                        extension: String(img.extension || "jpg").replace(".", "").trim() || "jpg",
                        original_name: img.original_name,
                        file_base64: img.file_base64,
                    })),
            });

            const uploadedFiles = Array.isArray(uploadResp?.files) ? uploadResp.files : [];
            for (const uploaded of uploadedFiles) {
                await callDynamicPrisma({
                    req,
                    data: {
                        action: "POST",
                        table: "c_imagenes_apertura_cierre_puesto",
                        operation: "create",
                        data: {
                            name: uploaded.name,
                            original_name: uploaded.original_name || uploaded.name,
                            apetura_cierre_id: id,
                        },
                    },
                });
            }
        }

        const existing = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_apertura_cierre_puesto",
                operation: "findUnique",
                where: { id },
            },
        });
        if (!existing) {
            return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
        }
        const existingObj = existing as any;

        const updateData: any = {};
        if (cliente_id !== undefined) updateData.cliente_id = parseInt(String(cliente_id), 10);
        if (corpo_id !== undefined) updateData.corpo_id = parseInt(String(corpo_id), 10);
        if (puesto_id !== undefined) updateData.puesto_id = parseInt(String(puesto_id), 10);
        if (division_id !== undefined) updateData.division_id = parseInt(String(division_id), 10);
        if (fecha !== undefined) updateData.fecha = new Date(String(fecha)).toISOString();
        if (tipo !== undefined) updateData.tipo = String(tipo);
        if (nombre_representante_cliente !== undefined) updateData.nombre_representante_cliente = String(nombre_representante_cliente);
        if (nombre_representante_empresa_entrante !== undefined) updateData.nombre_representante_empresa_entrante = String(nombre_representante_empresa_entrante);
        if (nombre_representante_empresa_saliente !== undefined) updateData.nombre_representante_empresa_saliente = String(nombre_representante_empresa_saliente);
        if (actividades !== undefined) updateData.actividades = String(actividades);
        if (inventario !== undefined) updateData.inventario = String(inventario);
        if (otras_observaciones !== undefined) updateData.otras_observaciones = otras_observaciones ? String(otras_observaciones) : null;
        if (firma_representante_cliente !== undefined) updateData.firma_representante_cliente = String(firma_representante_cliente);
        if (firma_representante_empresa_entrante !== undefined) updateData.firma_representante_empresa_entrante = String(firma_representante_empresa_entrante);
        if (firma_representante_empresa_saliente !== undefined) updateData.firma_representante_empresa_saliente = String(firma_representante_empresa_saliente);
        if (firma_responsable !== undefined) updateData.firma_responsable = String(firma_responsable);

        // Registrar cambios (solo campos actualizados, excluyendo firmas)
        const eq = (a: any, b: any) => {
            if (a === b) return true;
            if (a == null && b == null) return true;
            const da = a instanceof Date ? a : (typeof a === "string" && /^\d{4}-\d{2}-\d{2}T/.test(a) ? new Date(a) : null);
            const db = b instanceof Date ? b : (typeof b === "string" && /^\d{4}-\d{2}-\d{2}T/.test(b) ? new Date(b) : null);
            if (da && db) return da.getTime() === db.getTime();
            return false;
        };

        const cambiosArr: Array<{ prop: string; before: any; after: any }> = [];
        for (const [k, v] of Object.entries(updateData)) {
            if (k.startsWith("firma_")) continue; // Excluir firmas

            const before = existingObj[k];
            const after = v;
            if (!eq(before, after)) {
                const beforeValue = before instanceof Date ? before.toISOString() : (typeof before === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(before) ? before : before);
                const afterValue = after instanceof Date ? after.toISOString() : (typeof after === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(after) ? after : after);
                cambiosArr.push({
                    prop: k,
                    before: beforeValue,
                    after: afterValue,
                });
            }
        }

        const updated_record = await callDynamicPrisma({
            req,
            data: {
                action: "UPDATE",
                table: "c_apertura_cierre_puesto",
                operation: "update",
                where: { id },
                data: updateData
            },
        });

        if (cambiosArr.length > 0) {
            const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
            await callDynamicPrisma({
                req,
                data: {
                    action: "POST",
                    table: "c_cambios_apps_modules",
                    operation: "create",
                    data: {
                        nombre_tabla: "c_apertura_cierre_puesto",
                        registro_id: id,
                        cambios: JSON.stringify(cambiosArr),
                        created_at: toZonedTime(new Date(), "America/Costa_Rica").toISOString(),
                        created_by: createdBy,
                    },
                },
            });
        }

        const fullRecord = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_apertura_cierre_puesto",
                operation: "findUnique",
                where: { id },
                include: {
                    c_imagenes_apertura_cierre_puesto: true,
                    e_estructura_cliente: { select: { nombre: true } },
                    e_estructura_sucursal: { select: { nombre: true } },
                    e_estructura_puesto: { select: { nombre: true } },
                    n_division: { select: { nombre: true } },
                },
            },
        });

        const baseUrl = req.nextUrl.origin;

        return NextResponse.json({
            status: true,
            message: "Apertura-Cierre de Puesto actualizado correctamente",
            data: {
                ...(fullRecord ?? updated_record),
                id_local: "",
                cliente_nombre: (fullRecord as any)?.e_estructura_cliente?.nombre || null,
                corpo_nombre: (fullRecord as any)?.e_estructura_sucursal?.nombre || null,
                puesto_nombre: (fullRecord as any)?.e_estructura_puesto?.nombre || null,
                division_nombre: (fullRecord as any)?.n_division?.nombre || null,
                images: (((fullRecord as any)?.c_imagenes_apertura_cierre_puesto) || []).map((f: any) => ({
                    id: f.id,
                    name: f.name,
                    original_name: f.original_name,
                    url: baseUrl ? `${baseUrl}/api/opening-closing-position/${id}/get-image/${f.name}` : "",
                })),
            }
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

export async function DELETE(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id, 10);

        if (!id) {
            return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
        }

        const existing = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_apertura_cierre_puesto",
                operation: "findUnique",
                where: { id },
            },
        });
        if (!existing) {
            return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
        }

        const existingObj = existing as any;
        // Registrar cambio de eliminación antes de eliminar
        const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
        const createdAt = toZonedTime(new Date(), "America/Costa_Rica");
        const fechaValue = existingObj.fecha instanceof Date ? existingObj.fecha.toISOString() : (typeof existingObj.fecha === 'string' ? existingObj.fecha : null);
        await callDynamicPrisma({
            req,
            data: {
                action: "POST",
                table: "c_cambios_apps_modules",
                operation: "create",
                data: {
                    nombre_tabla: "c_apertura_cierre_puesto",
                    registro_id: id,
                    cambios: JSON.stringify([{
                        prop: "__deleted__",
                        before: {
                            id: existingObj.id,
                            cliente_id: existingObj.cliente_id,
                            corpo_id: existingObj.corpo_id,
                            puesto_id: existingObj.puesto_id,
                            division_id: existingObj.division_id,
                            fecha: fechaValue,
                            tipo: existingObj.tipo,
                            nombre_representante_cliente: existingObj.nombre_representante_cliente,
                            nombre_representante_empresa_entrante: existingObj.nombre_representante_empresa_entrante,
                            nombre_representante_empresa_saliente: existingObj.nombre_representante_empresa_saliente,
                            actividades: existingObj.actividades,
                            inventario: existingObj.inventario,
                            otras_observaciones: existingObj.otras_observaciones,
                        },
                        after: null,
                    }]),
                    created_at: createdAt.toISOString(),
                    created_by: createdBy,
                },
            },
        });

        // Borrar carpeta física de imágenes (si existe)
        const dir = path.join(process.cwd(), "public", "uploads", "opening-closing-position", `${id}`);
        if (fs.existsSync(dir)) {
            try {
                fs.rmSync(dir, { recursive: true, force: true });
            } catch {
                // ignore
            }
        }

        await callDynamicPrisma({
            req,
            data: {
                action: "DELETE",
                table: "c_apertura_cierre_puesto",
                operation: "delete",
                where: { id },
            },
        });

        return NextResponse.json({
            status: true,
            message: "Apertura-Cierre de Puesto eliminado correctamente"
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

