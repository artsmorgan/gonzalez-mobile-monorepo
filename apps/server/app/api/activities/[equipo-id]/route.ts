import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { verifyAccessToken } from "../../../../utils/verifyToken";
import { toZonedTime } from "date-fns-tz";

const prisma = new PrismaClient();

export async function PUT(req: NextRequest, context: { params: Promise<{ "equipo-id": string }> }) {
    try {
        const { valid, payload, message } = verifyAccessToken(req);

        if (!valid) {
            return NextResponse.json(
                { status: false, message: message },
                { status: 401 }
            );
        }

        const resolvedParams = await context.params;
        const revision_equipo_id = parseInt(resolvedParams["equipo-id"]);

        const { e, es_correcto, motivo_incorrecto } = await req.json();

        const empleado = await prisma.c_empleado.findUnique({ where: { id: e } });
        if (!empleado) {
            return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 200 });
        }

        const revision_equipo = await prisma.e_actividad_corpo_revision_equipo.findUnique({ where: { id: revision_equipo_id } });
        if (!revision_equipo) {
            return NextResponse.json({ status: false, message: "Revision de equipo no encontrado" }, { status: 200 });
        }

        const updatedRevisionEquipo = await prisma.e_actividad_corpo_revision_equipo.update({ where: { id: revision_equipo_id }, data: { empleado_id: e, es_correcto: es_correcto, marcada: true, motivo_incorrecto: motivo_incorrecto, updated_at: toZonedTime(new Date(), "America/Costa_Rica") } });
        return NextResponse.json({ status: true, message: "Revision de equipo actualizada correctamente" }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}