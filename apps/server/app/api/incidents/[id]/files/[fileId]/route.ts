import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../../utils/callDynamicPrisma";
import { deleteDynamicFile } from "../../../../../../utils/callDynamicFilesApi";
import { reportError } from "../../../../../../utils/reportError";
import fs from "fs";
import path from "path";

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string; fileId: string }> }) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
        if (!valid) {
            return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });
        }

        const resolvedParams = await context.params;
        const incidentId = parseInt(resolvedParams.id);
        const fileId = parseInt(resolvedParams.fileId);

        if (!incidentId || !fileId) {
            await reportError(req, "api/incidents/[id]/files/[fileId]", "DELETE", 400, "Parámetros inválidos");
            return NextResponse.json({ status: false, message: "Parámetros inválidos" }, { status: 400 });
        }

        const file = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "c_archivos_incidente", operation: "findUnique", where: { id: fileId } }
        });
        if (!file || file.incidente_id !== incidentId) {
            await reportError(req, "api/incidents/[id]/files/[fileId]", "DELETE", 404, "Archivo no encontrado");
            return NextResponse.json({ status: false, message: "Archivo no encontrado" }, { status: 404 });
        }

        await callDynamicPrisma({
            req,
            data: { action: "DELETE", table: "c_archivos_incidente", where: { id: fileId } }
        });

        const dynamicUrl = `incidents/${incidentId}/${file.name}`;
        try {
            await deleteDynamicFile({ req, url: dynamicUrl, shouldVerifyAccessToken: true });
        } catch {
            const filePath = path.join(process.cwd(), "public", "uploads", "incidents", `${incidentId}`, file.name);
            if (fs.existsSync(filePath)) {
                try {
                    fs.unlinkSync(filePath);
                } catch {
                    // ignore
                }
            }
        }

        return NextResponse.json({ status: true, message: "Archivo eliminado correctamente" }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error("Error in DELETE /api/incidents/[id]/files/[fileId]:", errorMessage);
        await reportError(req, "api/incidents/[id]/files/[fileId]", "DELETE", 500, errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}


