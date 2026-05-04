import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { deleteDynamicFile } from "../../../../../utils/callDynamicFilesApi";

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, expired, message } = await verifyAccessTokenByApi(req);
        if (!valid) {
            return NextResponse.json(
                { status: false, expired, message },
                { status: expired ? 401 : 403 }
            );
        }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id, 10);
        if (!Number.isFinite(id) || id <= 0) {
            return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });
        }

        const vehicle = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "e_registro_vehiculos", operation: "findUnique", where: { id } },
        });
        if (!vehicle) {
            return NextResponse.json({ status: false, message: "Vehículo no encontrado" }, { status: 200 });
        }

        const fn = vehicle.file_name ? String(vehicle.file_name) : "";
        if (fn) {
            try {
                await deleteDynamicFile({
                    req,
                    url: `vehicles/${id}/${fn}`,
                    shouldVerifyAccessToken: true,
                });
            } catch (e) {
                console.warn("deleteDynamicFile (vehicle attachment route):", e);
            }
        }

        await callDynamicPrisma({
            req,
            data: {
                action: "UPDATE",
                table: "e_registro_vehiculos",
                where: { id },
                data: { file_name: null },
                returning: false,
            },
        });

        return NextResponse.json({ status: true, message: "Adjunto eliminado correctamente" }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}
