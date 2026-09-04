import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { prisma } from "../../../../../utils/prismaClient";
import axios from "axios";
import { reportError } from "../../../../../utils/reportError";

export const runtime = "nodejs";

export async function PUT(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);

        if (!valid) {
            return NextResponse.json(
                { status: false, expired: expired, message: message },
                { status: expired ? 401 : 403 }
            );
        }

        const planillasToken =
            decodeURIComponent(req.headers.get("Planillas-Token") ?? req.headers.get("planillas-token") ?? "") ||
            null;
        if (!planillasToken) {
            await reportError(req, "api/traslado-plaza/[id]/upload-file", "PUT", 400, "Token de Planillas requerido");
            return NextResponse.json(
                { status: false, message: "Token de Planillas requerido" },
                { status: 400 }
            );
        }

        const resolvedParams = await context.params;
        const { id } = resolvedParams;
        const accionId = parseInt(String(id), 10);
        if (!accionId) {
            await reportError(req, "api/traslado-plaza/[id]/upload-file", "PUT", 400, "ID no especificado");
            return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 400 });
        }

        const { file_base64, extension, original_name, type } = await req.json();

        if (!file_base64 || !extension) {
            await reportError(req, "api/traslado-plaza/[id]/upload-file", "PUT", 400, "Archivo no válido");
            return NextResponse.json({ status: false, message: "Archivo no válido" }, { status: 400 });
        }

        const existingRecord = await prisma.c_accion_personal.findUnique({ where: { id: accionId } });

        if (!existingRecord) {
            await reportError(req, "api/traslado-plaza/[id]/upload-file", "PUT", 404, "Registro no encontrado");
            return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
        }

        const tokenEmployeeId = payload?.id ? parseInt(String(payload.id), 10) : 0;
        const recordEmployeeId = existingRecord?.empleado_id ? parseInt(String(existingRecord.empleado_id), 10) : 0;
        if (!tokenEmployeeId || tokenEmployeeId !== recordEmployeeId) {
            await reportError(req, "api/traslado-plaza/[id]/upload-file", "PUT", 400, "No autorizado para subir archivo en este registro");
            return NextResponse.json(
                { status: false, message: "No autorizado para subir archivo en este registro" },
                { status: 400 }
            );
        }

        if (existingRecord.document) {
            await reportError(req, "api/traslado-plaza/[id]/upload-file", "PUT", 400, "Ya existe un archivo subido. No se pueden subir más archivos.");
            return NextResponse.json(
                { status: false, message: "Ya existe un archivo subido. No se pueden subir más archivos." },
                { status: 400 }
            );
        }

        const ext = String(extension).replace(".", "").trim() || "dat";
        const fileType = type === "image" || type === "video" || type === "audio" ? type : "file";
        const documentName = String(original_name || "").trim() || `archivo.${ext}`;

        const planillasUrl = process.env.PLANILLAS_URL?.trim();
        if (!planillasUrl) {
            await reportError(req, "api/traslado-plaza/[id]/upload-file", "PUT", 500, "PLANILLAS_URL no configurado");
            return NextResponse.json(
                { status: false, message: "PLANILLAS_URL no configurado" },
                { status: 500 }
            );
        }

        const planillasResponse = await axios.post(
            `${planillasUrl}/acciones/${accionId}/archivo`,
            {
                archivo_base64: file_base64,
                nombre: documentName,
                extension: ext,
                tipo: fileType,
            },
            {
                headers: {
                    Authorization: `Bearer ${planillasToken}`,
                    "Content-Type": "application/json",
                },
            }
        );

        if (!planillasResponse.data?.success) {
            await reportError(req, "api/traslado-plaza/[id]/upload-file", "PUT", 500, "Error al subir el archivo");
            return NextResponse.json(
                { status: false, message: "Error al subir el archivo" },
                { status: 500 }
            );
        }

        const updatedRecord = await prisma.c_accion_personal.findUnique({ where: { id: accionId } });
        const baseUrl = req.nextUrl.origin;
        const finalDocument = updatedRecord?.document || documentName;

        return NextResponse.json(
            {
                status: true,
                message: "Archivo subido correctamente",
                data: {
                    id: accionId,
                    document: finalDocument,
                    mobile_upload: updatedRecord?.mobile_upload ?? true,
                    url: baseUrl
                        ? `${baseUrl}/api/traslado-plaza/${accionId}/get-file/${encodeURIComponent(finalDocument)}`
                        : "",
                },
            },
            { status: 200 }
        );
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error("Error in PUT /api/traslado-plaza/[id]/upload-file:", errorMessage);
        await reportError(req, "api/traslado-plaza/[id]/upload-file", "PUT", 500, errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}
