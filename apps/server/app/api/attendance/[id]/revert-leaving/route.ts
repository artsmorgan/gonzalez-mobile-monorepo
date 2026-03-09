import { NextRequest, NextResponse } from "next/server";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { sendNotificationByRole } from "../../../../../utils/sendNotification";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const { id } = await context.params;
        const idNum = parseInt(String(id), 10);
        if (!idNum) return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });

        const marcaDia = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "c_marca_dia", operation: "findUnique", where: { id: idNum } }
        });
        if (!marcaDia) return NextResponse.json({ status: false, message: "Marca del dia no encontrada" }, { status: 404 });
        
        marcaDia.hora_salida_digitada = null;
        marcaDia.salida_anticipada_id = null;
        const updated = await callDynamicPrisma({
            req,
            data: { action: "UPDATE", table: "c_marca_dia", where: { id: idNum }, data: marcaDia }
        });
        if (!updated) return NextResponse.json({ status: false, message: "No se pudo actualizar la marca del dia" }, { status: 400 });
        
        return NextResponse.json({ status: true, message: "Salida revertida correctamente" }, { status: 200 });
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}