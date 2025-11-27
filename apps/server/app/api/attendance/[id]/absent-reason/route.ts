import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../../utils/verifyToken";
import { toZonedTime } from "date-fns-tz";
import { prisma } from "../../../../../utils/prismaClient";
import { sendNotificationByRole } from "../../../../../utils/sendNotification";

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, payload, message } = verifyAccessToken(req);

        if (!valid) {
            return NextResponse.json(
                { status: false, message: message },
                { status: 401 }
            );
        }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);

        const { type, reason } = await req.json();

        // Obtener siempre la última marca agregada
        const marcaDia = await prisma.c_marca_dia.findFirst({ where: { empleadoFijo_id: id }, orderBy: { id: "desc" } });
        if (!marcaDia) {
            return NextResponse.json({ status: false, message: "No se encontró la marca del dia" }, { status: 200 });
        }

        const empleado = await prisma.c_empleado.findUnique({ where: { id: marcaDia.empleadoFijo_id ?? 0 } });
        if (!empleado) {
            return NextResponse.json({ status: false, message: "No se encontró el empleado" }, { status: 200 });
        }

        marcaDia.motivo_ausente = reason;

        const updated = await prisma.c_marca_dia.update({ where: { id: marcaDia.id }, data: marcaDia });

        if (!updated) {
            return NextResponse.json({ status: false, message: "No se pudo actualizar el motivo de ausencia" }, { status: 200 });
        }
        else {
            const title = "Motivo de ausencia confirmado";
            const description = `El empleado ${empleado.nombre} ${empleado.primer_apellido} ha confirmado el motivo de ausencia: ${reason}`;
            await sendNotificationByRole(marcaDia.id, title, description, ["ADMINISTRATIVO", "SUPERVISOR"]);
        }

        return NextResponse.json({ status: true, message: "Motivo de ausencia confirmado" }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}