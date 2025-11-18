import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../../utils/verifyToken";
import { prisma } from "../../../../../utils/prismaClient";
import { toZonedTime } from "date-fns-tz";

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);

        const { dev } = await req.json();

        const newMarca = await prisma.c_marca_dia.create({
            data: {
                fecha: toZonedTime(new Date(), "America/Costa_Rica"),
                cliente_id: 176,
                contrato_id: 314,
                corpo_id: 967,
                empleadoFijo_id: id,
                empresa_id: 9,
                horario_id: 1808,
                plaza_id: 6801,
                puesto_id: 1728,
                hora_fin: "18:00:00",
                hora_fin_plan: "18:00:00",
                hora_inicio: "09:00:00",
                hora_inicio_plan: "09:00:00",
                horas_duracion: 9,
                is_dia_excepcion: false,
                is_puesto_no_cubierto: false,
                is_reposicion_de_horas: false,
                teorico: false,
                tipo_turno: "D",
            }
        });

        return NextResponse.json({ status: true, message: "Marca creada correctamente", data: newMarca }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}