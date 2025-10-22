import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { verifyAccessToken } from "../../../../utils/verifyToken";
import { toZonedTime } from "date-fns-tz";

const prisma = new PrismaClient();

export async function PUT(req: NextRequest, context: { params: Promise<{ "actividad-id": string }> }) {
    try {
        const { valid, payload, message } = verifyAccessToken(req);

        if (!valid) {
            return NextResponse.json(
                { status: false, message: message },
                { status: 401 }
            );
        }

        const resolvedParams = await context.params;
        const actividad_id = parseInt(resolvedParams["actividad-id"]);

        const { e, estado, bitacora } = await req.json();

        const empleado = await prisma.c_empleado.findUnique({ where: { id: e } });
        if (!empleado) {
            return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 200 });
        }

        const actividad = await prisma.e_actividad_corpo.findUnique({ where: { id: actividad_id } });
        if (!actividad) {
            return NextResponse.json({ status: false, message: "Actividad no encontrada" }, { status: 200 });
        }

        if (estado === "marcar") {
            const actividad_marcada = await prisma.e_actividad_corpo_marcada.findFirst({ where: { actividadCorpo_id: actividad_id } });
            if (!actividad_marcada || actividad_marcada.marcada) {
                return NextResponse.json({ status: false, message: "Actividad ya marcada" }, { status: 200 });
            }

            await prisma.e_actividad_corpo_marcada.update({ where: { id: actividad_marcada.id }, data: { empleado_id: e, marcada: true, bitacora: bitacora, updated_at: toZonedTime(new Date(), "America/Costa_Rica") } });

            return NextResponse.json({ status: true, message: "Actividad marcada correctamente" }, { status: 200 });
        }
        else {
            const actividad_marcada = await prisma.e_actividad_corpo_marcada.findFirst({ where: { actividadCorpo_id: actividad_id } });
            if (!actividad_marcada || !actividad_marcada.marcada) {
                return NextResponse.json({ status: false, message: "Actividad no marcada" }, { status: 200 });
            }
            await prisma.e_actividad_corpo_marcada.update({ where: { id: actividad_marcada.id }, data: { empleado_id: e, marcada: false, updated_at: toZonedTime(new Date(), "America/Costa_Rica") } });

            return NextResponse.json({ status: true, message: "Actividad desmarcada correctamente" }, { status: 200 });
        }
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}