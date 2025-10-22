import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { verifyAccessToken } from "../../../../utils/verifyToken";
import { toZonedTime } from "date-fns-tz";

const prisma = new PrismaClient();

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
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

        const empleado = await prisma.c_empleado.findUnique({ where: { id } });

        if (!empleado) return NextResponse.json({ message: "Empleado no encontrado" }, { status: 404 });

        const empleado_plaza = await prisma.c_empleado_plaza.findFirst({
            where: {
                empleado_id: empleado.id
            }
        });

        if (!empleado_plaza || !empleado_plaza.horario_id) return NextResponse.json({ message: "Empleado no encontrado" }, { status: 404 });

        const horario = await prisma.c_horario.findUnique({
            where: {
                id: empleado_plaza.horario_id
            }
        });

        if (!horario) return NextResponse.json({ message: "Horario no encontrado" }, { status: 404 });

        // Solamente los que corresponden al dia de hoy
        const startOfDay = toZonedTime(new Date(), "America/Costa_Rica");
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = toZonedTime(new Date(), "America/Costa_Rica");
        endOfDay.setHours(23, 59, 59, 999);

        // Obtener siempre la última marca agregada
        const marcaDia = await prisma.c_marca_dia.findFirst({ where: { empleadoFijo_id: id }, orderBy: { id: "desc" } });
        if (!marcaDia) {
            return NextResponse.json({ status: false, message: "No se encontró la marca del dia" }, { status: 200 });
        }

        if (!marcaDia.hora_entrada_digitada) {
            return NextResponse.json({ status: false, message: "No se ha marcado la entrada del dia" }, { status: 200 });
        }

        const horas = await prisma.c_empleado_almuerzo.findMany({
            where: {
                empleadoId: empleado.id
            }
        });

        for (const hora of horas) {
            hora.pausas = JSON.parse(hora.pausas);
        }

        return NextResponse.json({ status: true, minutos: horario.minutos_almuerzo ? horario.minutos_almuerzo : 0, horas: horas, marcaDiaId: marcaDia.id }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}