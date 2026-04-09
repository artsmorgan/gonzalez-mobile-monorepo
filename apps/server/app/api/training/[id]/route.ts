import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, expired, message } = await verifyAccessTokenByApi(req);
        if (!valid) {
            return NextResponse.json({ status: false, expired, message }, { status: expired ? 401 : 403 });
        }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id, 10);
        if (!id || Number.isNaN(id)) {
            return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
        }

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
            return NextResponse.json({ status: false, message: "Capacitación no encontrada" }, { status: 404 });
        }

        await callDynamicPrisma({
            req,
            data: {
                action: "DELETE",
                table: "e_capacitacion_empleado",
                operation: "deleteMany",
                where: { capacitacion_id: id },
            },
        });
        await callDynamicPrisma({
            req,
            data: {
                action: "DELETE",
                table: "e_capacitacion_puesto",
                operation: "deleteMany",
                where: { capacitacion_id: id },
            },
        });
        await callDynamicPrisma({
            req,
            data: {
                action: "DELETE",
                table: "e_registro_capacitaciones",
                operation: "delete",
                where: { id },
            },
        });

        return NextResponse.json({ status: true, message: "Capacitación eliminada" }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error("DELETE training:", errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}
