import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { verifyAccessToken } from "../../../utils/verifyToken";
import { toZonedTime } from "date-fns-tz";

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
    try {
        return NextResponse.json({ status: true, message: "Método GET" }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        /*
        const { valid, payload, message } = verifyAccessToken(req);

        if (!valid) {
            return NextResponse.json(
                { status: false, message: message },
                { status: 401 }
            );
        }

        const { actividad_id, marca_id, empleado_id, estado, bitacora } = await req.json();

        const actividad = await prisma.e_actividad_corpo.findUnique({ where: { id: actividad_id } });
        if (!actividad) {
            return NextResponse.json({ status: false, message: "Actividad no encontrada" }, { status: 200 });
        }

        const marca = await prisma.c_marca_dia.findUnique({ where: { id: marca_id } });
        if (!marca) {
            return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 200 });
        }

        if (!marca.hora_inicio || !marca.hora_fin) {
            return NextResponse.json({ status: false, message: "Hora de inicio o fin no establecida" }, { status: 200 });
        }

        const empleado = await prisma.c_empleado.findUnique({ where: { id: empleado_id } });
        if (!empleado) {
            return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 200 });
        }

        const fecha_inicio = new Date(marca.fecha);
        fecha_inicio.setHours(marca.hora_inicio.getHours(), marca.hora_inicio.getMinutes(), marca.hora_inicio.getSeconds(), marca.hora_inicio.getMilliseconds());
        const fecha_fin = toZonedTime(new Date(), "America/Costa_Rica");

        if (estado === "marcar") {
            const marcada = await prisma.e_actividad_corpo_marcada.findFirst({ where: { actividadCorpo_id: actividad_id, created_at: { gte: fecha_inicio, lte: fecha_fin } } });
            if (marcada) {
                return NextResponse.json({ status: false, message: "Actividad ya marcada" }, { status: 200 });
            }

            await prisma.e_actividad_corpo_marcada.create({ data: { actividadCorpo_id: actividad_id, empleado_id: empleado_id, bitacora: bitacora, created_at: toZonedTime(new Date(), "America/Costa_Rica"), updated_at: toZonedTime(new Date(), "America/Costa_Rica"), e_actividad_corpo: { connect: { id: actividad_id } } } });

            return NextResponse.json({ status: true, message: "Actividad marcada correctamente" }, { status: 200 });
        }
        else {
            const marcada = await prisma.e_actividad_corpo_marcada.findFirst({ where: { actividadCorpo_id: actividad_id, created_at: { gte: fecha_inicio, lte: fecha_fin } } });
            if (!marcada) {
                return NextResponse.json({ status: false, message: "Actividad no marcada" }, { status: 200 });
            }
            await prisma.e_actividad_corpo_marcada.delete({ where: { id: marcada.id } });

            return NextResponse.json({ status: true, message: "Actividad desmarcada correctamente" }, { status: 200 });
        }
*/
        return NextResponse.json({ status: false, message: "Acción no válida" }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}
