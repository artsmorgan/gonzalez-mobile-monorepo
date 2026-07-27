import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { prisma } from "../../../../../utils/prismaClient";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);

        if (!id) {
            return NextResponse.json({ status: false, message: "Plaza no especificado" }, { status: 200 });
        }

        const plaza = await prisma.e_estructura_plazas.findUnique({ where: { id } });
        if (!plaza) {
            return NextResponse.json({ status: false, message: "Plaza no encontrada" }, { status: 200 });
        }

        // limit to 50 notifications at a time
        const plaza_notifications = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "c_plaza_notification", operation: "findMany", where: { plazaId: id }, take: 100 }
        });
        const notifications_return: { id: number, title: string, description: string, watched: boolean, created_at: string }[] = [];
        for (const plaza_notification of plaza_notifications) {
            const notificationData = await callDynamicPrisma({
                req,
                data: { action: "GET", table: "c_notifications", operation: "findUnique", where: { id: plaza_notification.notificationId } }
            });
            if (!notificationData) continue;
            notifications_return.push({
                id: plaza_notification.id,
                title: notificationData.title,
                description: notificationData.description,
                watched: plaza_notification.watched,
                created_at: notificationData.created_at.toISOString()
            });
        }

        return NextResponse.json({ status: true, notifications: notifications_return }, { status: 200 });
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}