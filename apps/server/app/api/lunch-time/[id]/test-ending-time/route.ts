import { NextRequest, NextResponse } from "next/server";
import { authorizeMarcaAccess, denialBody, isDevRouteEnabled } from "../../../../../utils/objectAccess";
import { isSuperAdminEmpleado } from "../../../../../utils/isSuperAdminEmpleado";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { toZonedTime } from "date-fns-tz";
import { prisma } from "../../../../../utils/prismaClient";
import { reportError } from "../../../../../utils/reportError";


export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    // Ruta de desarrollo: no existe en producción (issue #181).
    if (!isDevRouteEnabled()) { return NextResponse.json({ status: false, message: "No encontrado" }, { status: 404 }); }
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }
        const resolvedParams = await context.params;

        const id = parseInt(resolvedParams.id);

        // Params obtenidos con "?"
        const searchParams = req.nextUrl.searchParams;
        const endingTime = searchParams.get("endingTime");

        console.log("endingTime", endingTime);

        if (!endingTime) {
            await reportError(req, "api/lunch-time/[id]/test-ending-time", "GET", 400, "Tiempo de finalización no especificado");
            return NextResponse.json({ status: false, message: "Tiempo de finalización no especificado" }, { status: 400 });
        }

        const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id } });
        if (!marcaDia) {
            await reportError(req, "api/lunch-time/[id]/test-ending-time", "GET", 404, "Marca del dia no encontrada");
            return NextResponse.json({ status: false, message: "Marca del dia no encontrada" }, { status: 404 });
        }
        // Issue #181: la marca es de su titular o de quien lo reemplaza (o de un administrador).
        const access = await authorizeMarcaAccess({ callerId: payload.id, marca: marcaDia, isAdmin: () => isSuperAdminEmpleado(req, Number(payload.id)) });
        if (!access.allowed) { return NextResponse.json(denialBody(access), { status: access.status }); }

        if (!marcaDia.hora_fin || !marcaDia.hora_inicio) {
            await reportError(req, "api/lunch-time/[id]/test-ending-time", "GET", 400, "Hora de finalización o inicio no establecidas");
            return NextResponse.json({ status: false, message: "Hora de finalización o inicio no establecidas" }, { status: 400 });
        }

        if (!marcaDia.fecha) {
            await reportError(req, "api/lunch-time/[id]/test-ending-time", "GET", 400, "Fecha no establecida");
            return NextResponse.json({ status: false, message: "Fecha no establecida" }, { status: 400 });
        }

        const endDate = new Date(marcaDia.hora_fin);
        endDate.setFullYear(marcaDia.fecha.getFullYear(), marcaDia.fecha.getMonth(), marcaDia.hora_inicio > marcaDia.hora_fin ? marcaDia.fecha.getDate() + 1 : marcaDia.fecha.getDate());

        const endingTime_converted = toZonedTime(new Date(parseInt(endingTime)), "America/Costa_Rica");

        if (endingTime_converted.getTime() > endDate.getTime()) {
            await reportError(req, "api/lunch-time/[id]/test-ending-time", "GET", 400, "Tiempo de finalización de almuerzo es mayor a la hora de finalización");
            return NextResponse.json({ status: false, message: "Tiempo de finalización de almuerzo es mayor a la hora de finalización" }, { status: 400 });
        }

        return NextResponse.json({ status: true, message: "Tiempo de finalización de almuerzo es menor a la hora de finalización" }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        await reportError(req, "api/lunch-time/[id]/test-ending-time", "GET", 500, errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}