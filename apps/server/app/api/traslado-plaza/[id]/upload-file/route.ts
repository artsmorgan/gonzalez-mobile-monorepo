import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { uploadDynamicFiles } from "../../../../../utils/callDynamicFilesApi";

export const runtime = "nodejs";

export async function PUT(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const { id } = resolvedParams;
        const accionId = parseInt(String(id), 10);
        if (!accionId) {
            return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 400 });
        }

        const { file_base64, extension, original_name, type, mimeType } = await req.json();

        if (!file_base64 || !extension) {
            return NextResponse.json({ status: false, message: "Archivo no válido" }, { status: 400 });
        }

        const existingRecord = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "c_accion_personal", operation: "findUnique", where: { id: accionId } }
        });

        if (!existingRecord) {
            return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
        }

        const tokenEmployeeId = payload?.id ? parseInt(String(payload.id), 10) : 0;
        const recordEmployeeId = existingRecord?.empleado_id ? parseInt(String(existingRecord.empleado_id), 10) : 0;
        if (!tokenEmployeeId || tokenEmployeeId !== recordEmployeeId) {
            return NextResponse.json({ status: false, message: "No autorizado para subir archivo en este registro" }, { status: 403 });
        }

        // Verificar si ya existe un archivo subido
        if (existingRecord.document) {
            return NextResponse.json(
                { status: false, message: "Ya existe un archivo subido. No se pueden subir más archivos." },
                { status: 400 }
            );
        }

        const ext = String(extension).replace(".", "").trim() || "dat";
        const fileType = (type === "image" || type === "video" || type === "audio") ? type : "file";
        const documentName = String(original_name || "").trim() || `archivo.${ext}`;
        const uploadResp = await uploadDynamicFiles({
            req,
            folderPath: `archivos-acciones/${accionId}`,
            files: [{ type: fileType, extension: ext, name: documentName, original_name: documentName, file_base64: file_base64 }],
        });
        const uploaded = Array.isArray(uploadResp?.files) ? uploadResp.files : [];
        const fileName = uploaded[0]?.name || "";

        if (!fileName) {
            return NextResponse.json({ status: false, message: "Error al subir el archivo" }, { status: 400 });
        }

        // Actualizar registro con el nombre original del archivo (no el generado)
        const updatedRecord = await callDynamicPrisma({
            req,
            data: {
                action: "UPDATE",
                table: "c_accion_personal",
                where: { id: accionId },
                data: {
                    document: documentName,
                    mobile_upload: true,
                }
            }
        });

        const baseUrl = req.nextUrl.origin;
        return NextResponse.json(
            {
                status: true,
                message: "Archivo subido correctamente",
                data: {
                    id: updatedRecord.id,
                    document: updatedRecord.document,
                    mobile_upload: updatedRecord.mobile_upload ?? false,
                    url: baseUrl ? `${baseUrl}/api/traslado-plaza/${accionId}/get-file/${encodeURIComponent(fileName)}` : "",
                },
            },
            { status: 200 }
        );
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error("Error in PUT /api/traslado-plaza/[id]/upload-file:", errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}

