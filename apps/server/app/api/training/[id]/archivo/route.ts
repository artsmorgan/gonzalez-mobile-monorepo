import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { deleteDynamicFile } from "../../../../../utils/callDynamicFilesApi";
import { reportError } from "../../../../../utils/reportError";
import { parseTrainingFileField, serializeTrainingFileItems } from "../../trainingFileField";

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, expired, message } = await verifyAccessTokenByApi(req);
        if (!valid) {
            return NextResponse.json({ status: false, expired, message }, { status: expired ? 401 : 403 });
        }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id, 10);
        if (!id || Number.isNaN(id)) {
            await reportError(req, "api/training/[id]/archivo", "DELETE", 400, "ID inválido");
            return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
        }

        const fileName = req.nextUrl.searchParams.get("name")?.trim();
        if (!fileName) {
            await reportError(req, "api/training/[id]/archivo", "DELETE", 400, "Parámetro name requerido");
            return NextResponse.json({ status: false, message: "Parámetro name requerido" }, { status: 400 });
        }
        const decodedName = decodeURIComponent(fileName);

        const existing = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "e_registro_capacitaciones",
                operation: "findUnique",
                where: { id },
            },
        });
        if (!existing) {
            await reportError(req, "api/training/[id]/archivo", "DELETE", 404, "Capacitación no encontrada");
            return NextResponse.json({ status: false, message: "Capacitación no encontrada" }, { status: 404 });
        }

        const adjRows = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_archivos_adjuntos_capacitaciones",
                operation: "findMany",
                where: { capacitacion_id: id, name: decodedName },
            },
        });
        const adjunto = Array.isArray(adjRows) && adjRows[0] ? adjRows[0] : null;

        if (adjunto) {
            const adj = adjunto as any;
            await deleteDynamicFile({
                req,
                url: `training/${id}/${adj.name}`,
                shouldVerifyAccessToken: true,
            });
            await callDynamicPrisma({
                req,
                data: {
                    action: "DELETE",
                    table: "c_archivos_adjuntos_capacitaciones",
                    operation: "delete",
                    where: { id: adj.id },
                },
            });
            return NextResponse.json({ status: true, message: "Archivo eliminado" }, { status: 200 });
        }

        const row = existing as any;
        const items = parseTrainingFileField(row.file);
        const next = items.filter((x) => x.name !== decodedName);
        if (next.length === items.length) {
            await reportError(req, "api/training/[id]/archivo", "DELETE", 404, "Archivo no asociado al registro");
            return NextResponse.json({ status: false, message: "Archivo no asociado al registro" }, { status: 404 });
        }

        await deleteDynamicFile({
            req,
            url: `training/${id}/${decodedName}`,
            shouldVerifyAccessToken: true,
        });

        await callDynamicPrisma({
            req,
            data: {
                action: "UPDATE",
                table: "e_registro_capacitaciones",
                operation: "update",
                where: { id },
                data: { file: serializeTrainingFileItems(next) },
            },
        });

        return NextResponse.json({ status: true, message: "Archivo eliminado" }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error("DELETE training archivo:", errorMessage);
        await reportError(req, "api/training/[id]/archivo", "DELETE", 500, errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}
