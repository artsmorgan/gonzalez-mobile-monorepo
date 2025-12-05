import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../utils/verifyToken";
import { prisma } from "../../../utils/prismaClient";

export async function GET(req: NextRequest) {
    try {
        const { valid, payload, message } = verifyAccessToken(req);
        if (!valid) {
            return NextResponse.json(
                { status: false, message: message },
                { status: 401 }
            );
        }

        const searchParams = req.nextUrl.searchParams;
        const m = searchParams.get("m");

        if (!m) {
            return NextResponse.json({ status: false, message: "Marca no especificada" }, { status: 200 });
        }

        const marca = await prisma.c_marca_dia.findUnique({ where: { id: parseInt(m) } });
        if (!marca) {
            return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 200 });
        }

        if (!marca.plaza_id || !marca.empleadoFijo_id) {
            return NextResponse.json({ status: false, message: "Plaza o empleado no encontrados" }, { status: 200 });
        }

        const plaza_notifications = await prisma.c_plaza_notification.findMany({ where: { plazaId: marca.plaza_id } });

        const empleado_notifications = await prisma.c_empleado_notification.findMany({ where: { empleadoId: marca.empleadoFijo_id } });

        const notifications_return: { id: number, title: string, description: string, watched: boolean, is_plaza: boolean, created_at: string }[] = [];

        for (const not of plaza_notifications) {
            const notificationData = await prisma.c_notifications.findUnique({ where: { id: not.notificationId } });
            if (!notificationData) continue;
            notifications_return.push({
                id: not.id,
                title: notificationData.title,
                description: notificationData.description,
                watched: not.watched,
                is_plaza: true,
                created_at: notificationData.created_at.toISOString()
            });
        }

        for (const not of empleado_notifications) {
            const notificationData = await prisma.c_notifications.findUnique({ where: { id: not.notificationId } });
            if (!notificationData) continue;
            notifications_return.push({
                id: not.id,
                title: notificationData.title,
                description: notificationData.description,
                watched: not.watched,
                is_plaza: false,
                created_at: notificationData.created_at.toISOString()
            });
        }

        notifications_return.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        return NextResponse.json({ status: true, notifications: notifications_return }, { status: 200 });
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const { valid, payload, message } = verifyAccessToken(req);
        if (!valid) {
            return NextResponse.json(
                { status: false, message: message },
                { status: 401 }
            );
        }

        const { notifications } = await req.json();
        if (notifications === undefined || notifications.length === 0) {
            return NextResponse.json({ status: false, message: "Notificaciones no especificadas" }, { status: 200 });
        }

        for (const not of notifications) {
            if (not.is_plaza) {
                await prisma.c_plaza_notification.update({ where: { id: not.id }, data: { watched: true } });
            } else {
                await prisma.c_empleado_notification.update({ where: { id: not.id }, data: { watched: true } });
            }
        }

        return NextResponse.json({ status: true, message: "Notificaciones actualizadas correctamente" }, { status: 200 });
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}