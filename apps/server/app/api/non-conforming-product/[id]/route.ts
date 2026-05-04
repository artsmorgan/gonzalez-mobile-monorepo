import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";
import { toZonedTime } from "date-fns-tz";
import fs from "fs";
import path from "path";
import { uploadDynamicFiles } from "../../../../utils/callDynamicFilesApi";

export const runtime = "nodejs";

type PncFileInput = {
    type: string;
    extension: string;
    original_name?: string;
    file_base64: string;
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

function buildFileUrl(baseUrl: string, recordId: number, file: { name: string; type: string }): string {
    const fileName = file.name;
    const type = String(file.type || "file").toLowerCase();
    let urlPath: string;
    if (type === "image") {
        urlPath = `/api/non-conforming-product/${recordId}/get-image/${fileName}`;
    } else if (type === "audio") {
        urlPath = `/api/non-conforming-product/${recordId}/get-audio/${fileName}`;
    } else if (type === "video") {
        urlPath = `/api/non-conforming-product/${recordId}/get-video/${fileName}`;
    } else {
        urlPath = `/api/non-conforming-product/${recordId}/get-file/${fileName}`;
    }
    return `${baseUrl}${urlPath}`;
}

function parseDateOnly(input: any): Date | null {
    if (!input) return null;
    const s = String(input).trim();
    if (s.length === 0) return null;
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return null;
    return d;
}

export async function PUT(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const { id } = resolvedParams;
        const pncId = parseInt(String(id), 10);
        if (!pncId) {
            return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 400 });
        }

        const {
            cliente_id,
            corpo_id,
            empresa_id,
            division_id,
            contrato_id,
            puesto_id,
            fecha_identificacion,
            responsable_cuenta,
            tipo_servicio_no_conforme,
            persona_identifico_pnc,
            firma_persona_identifico_pnc,
            descripcion,
            persona_origino_pnc,
            firma_persona_origino_pnc,
            accion_implementada,
            fecha_solucion,
            responsable_aprobar,
            firma_responsable,
            archivos,
        } = await req.json();

        const existingRecord = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_producto_no_conforme",
                operation: "findUnique",
                where: { id: pncId },
                include: { e_archivos_producto_no_conforme: true },
            },
        });

        if (!existingRecord) {
            return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
        }
        const existingRecordObj = existingRecord as any;

        const fechaIdentExisting = existingRecordObj.fecha_identificacion instanceof Date ? existingRecordObj.fecha_identificacion : (typeof existingRecordObj.fecha_identificacion === 'string' ? new Date(existingRecordObj.fecha_identificacion) : null);
        const fechaSolExisting = existingRecordObj.fecha_solucion instanceof Date ? existingRecordObj.fecha_solucion : (typeof existingRecordObj.fecha_solucion === 'string' ? new Date(existingRecordObj.fecha_solucion) : null);

        const updateData: any = {
            cliente_id: cliente_id !== undefined ? Number(cliente_id) : existingRecordObj.cliente_id,
            corpo_id: corpo_id !== undefined ? Number(corpo_id) : existingRecordObj.corpo_id,
            empresa_id: empresa_id !== undefined ? Number(empresa_id) : existingRecordObj.empresa_id,
            division_id: division_id !== undefined ? Number(division_id) : existingRecordObj.division_id,
            contrato_id: contrato_id !== undefined ? Number(contrato_id) : existingRecordObj.contrato_id,
            puesto_id: puesto_id !== undefined ? Number(puesto_id) : existingRecordObj.puesto_id,
            fecha_identificacion:
                fecha_identificacion !== undefined ? (parseDateOnly(fecha_identificacion) ?? fechaIdentExisting) : fechaIdentExisting,
            responsable_cuenta: responsable_cuenta !== undefined ? String(responsable_cuenta ?? "") : existingRecordObj.responsable_cuenta,
            tipo_servicio_no_conforme: tipo_servicio_no_conforme !== undefined ? String(tipo_servicio_no_conforme ?? "") : existingRecordObj.tipo_servicio_no_conforme,
            persona_identifico_pnc: persona_identifico_pnc !== undefined ? String(persona_identifico_pnc ?? "") : existingRecordObj.persona_identifico_pnc,
            firma_persona_identifico_pnc:
                firma_persona_identifico_pnc !== undefined
                    ? (firma_persona_identifico_pnc != null && String(firma_persona_identifico_pnc).trim().length > 0
                        ? String(firma_persona_identifico_pnc).trim()
                        : null)
                    : existingRecordObj.firma_persona_identifico_pnc,
            descripcion: descripcion !== undefined ? String(descripcion ?? "") : existingRecordObj.descripcion,
            persona_origino_pnc: persona_origino_pnc !== undefined ? String(persona_origino_pnc ?? "") : existingRecordObj.persona_origino_pnc,
            firma_persona_origino_pnc:
                firma_persona_origino_pnc !== undefined
                    ? (firma_persona_origino_pnc != null && String(firma_persona_origino_pnc).trim().length > 0
                        ? String(firma_persona_origino_pnc).trim()
                        : null)
                    : existingRecordObj.firma_persona_origino_pnc,
            accion_implementada: accion_implementada !== undefined ? String(accion_implementada ?? "") : existingRecordObj.accion_implementada,
            fecha_solucion: fecha_solucion !== undefined ? (parseDateOnly(fecha_solucion) ?? fechaSolExisting) : fechaSolExisting,
            responsable_aprobar: responsable_aprobar !== undefined ? String(responsable_aprobar ?? "") : existingRecordObj.responsable_aprobar,
            firma_responsable: firma_responsable !== undefined ? String(firma_responsable ?? existingRecordObj.firma_responsable) : existingRecordObj.firma_responsable,
        };

        // Convertir fechas a ISO strings para callDynamicPrisma
        if (updateData.fecha_identificacion instanceof Date) {
            updateData.fecha_identificacion = updateData.fecha_identificacion.toISOString();
        }
        if (updateData.fecha_solucion instanceof Date) {
            updateData.fecha_solucion = updateData.fecha_solucion.toISOString();
        }

        // Registrar cambios (solo campos actualizados, incluyendo firmas)
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
            const before = existingRecordObj[k];
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

        const updatedRecord = await callDynamicPrisma({
            req,
            data: {
                action: "UPDATE",
                table: "c_producto_no_conforme",
                operation: "update",
                where: { id: pncId },
                data: updateData,
                include: { e_archivos_producto_no_conforme: true },
            },
        });
        const updatedRecordObj = updatedRecord as any;

        // Registrar cambios si hay alguno
        if (cambiosArr.length > 0) {
            const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
            await callDynamicPrisma({
                req,
                data: {
                    action: "POST",
                    table: "c_cambios_apps_modules",
                    operation: "create",
                    data: {
                        nombre_tabla: "c_producto_no_conforme",
                        registro_id: pncId,
                        cambios: JSON.stringify(cambiosArr),
                        created_at: toZonedTime(new Date(), "America/Costa_Rica").toISOString(),
                        created_by: createdBy,
                    },
                },
            });
        }

        // Adjuntos: `archivos` añade nuevos; los existentes se mantienen. Quitar uno: DELETE /archivo/[archivoId].
        if (archivos !== undefined) {
            const filesParsed = safeParseJson<PncFileInput[]>(archivos, []);

            if (filesParsed.length > 0) {
                const uploadResp = await uploadDynamicFiles({
                    req,
                    folderPath: `non-conforming-product/${updatedRecordObj.id}`,
                    files: filesParsed
                        .filter((f) => f?.file_base64 && f?.extension && f?.type)
                        .map((f) => ({
                            type: f.type,
                            extension: f.extension,
                            original_name: f.original_name,
                            file_base64: f.file_base64,
                        })),
                });

                const uploadedFiles = Array.isArray(uploadResp?.files) ? uploadResp.files : [];
                for (const uploaded of uploadedFiles) {
                    await callDynamicPrisma({
                        req,
                        data: {
                            action: "POST",
                            table: "e_archivos_producto_no_conforme",
                            operation: "create",
                            data: {
                                name: uploaded.name,
                                original_name: uploaded.original_name || uploaded.name,
                                type: uploaded.type,
                                extension: uploaded.extension,
                                pnc_id: updatedRecordObj.id,
                            },
                        },
                    });
                }
            }
        }

        const fullRecord = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_producto_no_conforme",
                operation: "findUnique",
                where: { id: updatedRecordObj.id },
                include: { e_archivos_producto_no_conforme: true },
            },
        });

        const fullRecordObj = fullRecord as any;
        const archivosArray = Array.isArray(fullRecordObj?.e_archivos_producto_no_conforme) ? fullRecordObj.e_archivos_producto_no_conforme : [];
        const baseUrl = req.nextUrl.origin;
        return NextResponse.json(
            {
                status: true,
                message: "Producto no conforme actualizado correctamente",
                data: {
                    ...(fullRecordObj ?? updatedRecordObj),
                    id: updatedRecordObj.id,
                    id_local: "",
                    files: archivosArray.map((f: any) => ({
                        id: f.id,
                        name: f.name,
                        original_name: f.original_name,
                        type: f.type,
                        extension: f.extension,
                        url: buildFileUrl(baseUrl, updatedRecordObj.id, f),
                    })),
                },
            },
            { status: 200 }
        );
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
        const { id } = resolvedParams;
        const pncId = parseInt(String(id), 10);
        if (!pncId) {
            return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 400 });
        }

        const existingRecord = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_producto_no_conforme",
                operation: "findUnique",
                where: { id: pncId },
            },
        });

        if (!existingRecord) {
            return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
        }

        const existingRecordObj = existingRecord as any;
        // Registrar cambio de eliminación antes de eliminar
        const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
        const createdAt = toZonedTime(new Date(), "America/Costa_Rica");
        const fechaIdentValue = existingRecordObj.fecha_identificacion instanceof Date ? existingRecordObj.fecha_identificacion.toISOString() : (typeof existingRecordObj.fecha_identificacion === 'string' ? existingRecordObj.fecha_identificacion : null);
        const fechaSolValue = existingRecordObj.fecha_solucion instanceof Date ? existingRecordObj.fecha_solucion.toISOString() : (typeof existingRecordObj.fecha_solucion === 'string' ? existingRecordObj.fecha_solucion : null);
        await callDynamicPrisma({
            req,
            data: {
                action: "POST",
                table: "c_cambios_apps_modules",
                operation: "create",
                data: {
                    nombre_tabla: "c_producto_no_conforme",
                    registro_id: pncId,
                    cambios: JSON.stringify([{
                        prop: "__deleted__",
                        before: {
                            id: existingRecordObj.id,
                            cliente_id: existingRecordObj.cliente_id,
                            corpo_id: existingRecordObj.corpo_id,
                            fecha_identificacion: fechaIdentValue,
                            responsable_cuenta: existingRecordObj.responsable_cuenta,
                            tipo_servicio_no_conforme: existingRecordObj.tipo_servicio_no_conforme,
                            persona_identifico_pnc: existingRecordObj.persona_identifico_pnc,
                            descripcion: existingRecordObj.descripcion,
                            persona_origino_pnc: existingRecordObj.persona_origino_pnc,
                            accion_implementada: existingRecordObj.accion_implementada,
                            fecha_solucion: fechaSolValue,
                            responsable_aprobar: existingRecordObj.responsable_aprobar,
                        },
                        after: null,
                    }]),
                    created_at: createdAt.toISOString(),
                    created_by: createdBy,
                },
            },
        });

        await callDynamicPrisma({
            req,
            data: {
                action: "DELETE",
                table: "c_producto_no_conforme",
                operation: "delete",
                where: { id: pncId },
            },
        });

        const dir = path.join(process.cwd(), "public", "uploads", "non-conforming-product", `${pncId}`);
        if (fs.existsSync(dir)) {
            try {
                fs.rmSync(dir, { recursive: true, force: true });
            } catch {
                // ignore
            }
        }

        return NextResponse.json({ status: true, message: "Producto no conforme eliminado correctamente" }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

