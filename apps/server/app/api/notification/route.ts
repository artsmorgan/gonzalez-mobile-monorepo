import { NextRequest, NextResponse } from "next/server";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";
import { prisma } from "../../../utils/prismaClient";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";
import { reportError } from "../../../utils/reportError";

export async function GET(req: NextRequest) {
    try {

        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const searchParams = req.nextUrl.searchParams;
        const m = searchParams.get("m");
        const e = searchParams.get("e");

        // El empleado es lo único indispensable: las notificaciones propias de la persona no dependen de que tenga un turno.
        const empleadoId = parseInt(String(e ?? ""), 10);
        if (!Number.isFinite(empleadoId) || empleadoId <= 0) {
            await reportError(req, "api/notification", "GET", 400, "Empleado no especificado");
            return NextResponse.json({ status: false, message: "Empleado no especificado" }, { status: 400 });
        }

        // La marca (turno) y su plaza son opcionales: sin turno (marca ausente o 0) o con la plaza en 0, no se toman en cuenta las notificaciones de plaza y se
        // muestran solo las del empleado. Antes esto terminaba en un 404 y la persona sin turno no veía ninguna notificación.
        const marcaId = parseInt(String(m ?? ""), 10);
        const marca = Number.isFinite(marcaId) && marcaId > 0 ? await prisma.c_marca_dia.findUnique({ where: { id: marcaId } }) : null;
        const plazaId = marca?.plaza_id && marca.plaza_id > 0 ? marca.plaza_id : null;

        const plaza_notifications = plazaId
            ? await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "c_plaza_notification",
                    operation: "findMany",
                    where: { plazaId }
                }
            })
            : [];

        const empleado_notifications = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_empleado_notification",
                operation: "findMany",
                where: { empleadoId }
            }
        });

        const notifications_return: { id: number, title: string, description: string, watched: boolean, is_plaza: boolean, created_at: string }[] = [];

        const plaza_noti_ids = (Array.isArray(plaza_notifications) ? plaza_notifications : []).map((not: { notificationId: number }) => not.notificationId);
        const empleado_noti_ids = (Array.isArray(empleado_notifications) ? empleado_notifications : []).map((not: { notificationId: number }) => not.notificationId);

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
        
        const plaza_notifications_data = plaza_noti_ids.length > 0
            ? await callDynamicPrisma({
                req,
                data: { action: "GET", table: "c_notifications", operation: "findMany", where: { id: { in: plaza_noti_ids } } }
            })
            : [];
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
        await reportError(req, "api/notification", "GET", 500, errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const { notifications } = await req.json();
        if (notifications === undefined || notifications.length === 0) {
            await reportError(req, "api/notification", "POST", 400, "Notificaciones no especificadas");
            return NextResponse.json({ status: false, message: "Notificaciones no especificadas" }, { status: 400 });
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
        await reportError(req, "api/notification", "POST", 500, errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}