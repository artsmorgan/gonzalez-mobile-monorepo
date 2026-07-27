import { NextRequest, NextResponse } from "next/server";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";
import { prisma } from "../../../utils/prismaClient";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";

export async function GET(req: NextRequest) {
    try {

        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const searchParams = req.nextUrl.searchParams;
        const m = searchParams.get("m");
        const e = searchParams.get("e");

        if (!m || !e) {
            return NextResponse.json({ status: false, message: "Marca o empleado no especificados" }, { status: 200 });
        }

        const marca = await prisma.c_marca_dia.findUnique({ where: { id: parseInt(m) } });
        if (!marca) {
            return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 200 });
        }

        if (!marca.plaza_id || !marca.empleadoFijo_id) {
            return NextResponse.json({ status: false, message: "Plaza o empleado no encontrados" }, { status: 200 });
        }

        const plaza_notifications = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_plaza_notification",
                operation: "findMany",
                where: { plazaId: marca.plaza_id }
            }
        });

        const empleado_notifications = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_empleado_notification",
                operation: "findMany",
                where: { empleadoId: parseInt(e) }
            }
        });

        const notifications_return: { id: number, title: string, description: string, watched: boolean, is_plaza: boolean, created_at: string }[] = [];

        const plaza_noti_ids = plaza_notifications.map((not: { notificationId: number }) => not.notificationId);
        const empleado_noti_ids = empleado_notifications.map((not: { notificationId: number }) => not.notificationId);

        const plazaWatchedByNotificationId = new Map<number, boolean>(
            (Array.isArray(plaza_notifications) ? plaza_notifications : []).map(
                (row: { notificationId: number; watched?: boolean }) => [row.notificationId, row.watched === true]
            )
        );
        const empleadoWatchedByNotificationId = new Map<number, boolean>(
            (Array.isArray(empleado_notifications) ? empleado_notifications : []).map(
                (row: { notificationId: number; watched?: boolean }) => [row.notificationId, row.watched === true]
            )
        );
        
        const plaza_notifications_data = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "c_notifications", operation: "findMany", where: { id: { in: plaza_noti_ids } } }
        });
        const empleado_notifications_data = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "c_notifications", operation: "findMany", where: { id: { in: empleado_noti_ids } } }
        });

        for (const not of plaza_notifications_data) {
            notifications_return.push({
                id: not.id,
                title: not.title,
                description: not.description,
                watched: plazaWatchedByNotificationId.get(not.id) === true,
                is_plaza: true,
                created_at: not.created_at
            });
        }

        for (const not of empleado_notifications_data) {
            notifications_return.push({
                id: not.id,
                title: not.title,
                description: not.description,
                watched: empleadoWatchedByNotificationId.get(not.id) === true,
                is_plaza: false,
                created_at: not.created_at
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
        const { notifications } = await req.json();
        if (notifications === undefined || notifications.length === 0) {
            return NextResponse.json({ status: false, message: "Notificaciones no especificadas" }, { status: 200 });
        }

        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        let plaza_not_ids: number[] = [];
        plaza_not_ids.push(...notifications.filter((not: { is_plaza: boolean }) => not.is_plaza).map((not: { id: number }) => Number(not.id)));
        let empleado_not_ids: number[] = [];
        empleado_not_ids.push(...notifications.filter((not: { is_plaza: boolean }) => !not.is_plaza).map((not: { id: number }) => Number(not.id)));

        const employeeId = parseInt(String((payload as { id?: number })?.id ?? ""), 10);

        if (plaza_not_ids.length > 0) {
            await callDynamicPrisma({
                req,
                data: {
                    action: "UPDATE",
                    table: "c_plaza_notification",
                    operation: "updateMany",
                    where: { notificationId: { in: plaza_not_ids } },
                    data: { watched: true },
                },
            });
        }

        if (empleado_not_ids.length > 0 && Number.isFinite(employeeId) && employeeId > 0) {
            await callDynamicPrisma({
                req,
                data: {
                    action: "UPDATE",
                    table: "c_empleado_notification",
                    operation: "updateMany",
                    where: { notificationId: { in: empleado_not_ids }, empleadoId: employeeId },
                    data: { watched: true },
                },
            });
        }

        return NextResponse.json({ status: true, message: "Notificaciones actualizadas correctamente" }, { status: 200 });
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}