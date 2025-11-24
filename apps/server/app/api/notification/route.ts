import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../utils/verifyToken";
import { prisma } from "../../../utils/prismaClient";

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

        // Updatemany where id in notifications
        await prisma.c_plaza_notification.updateMany({ where: { id: { in: notifications.map((notification: { id: number }) => notification.id) } }, data: { watched: true } });

        return NextResponse.json({ status: true, message: "Notificaciones actualizadas correctamente" }, { status: 200 });
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}