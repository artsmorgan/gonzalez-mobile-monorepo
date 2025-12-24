import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../../utils/verifyToken";
import { prisma } from "../../../../../utils/prismaClient";
import { toZonedTime } from "date-fns-tz";

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);

        const { dev } = await req.json();

        let hora_entrada = "06:00:00";
        let hora_salida = "14:00:00";
        let tipo_turno = "D";
        if (toZonedTime(new Date(), "America/Costa_Rica").getHours() >= 14 && toZonedTime(new Date(), "America/Costa_Rica").getHours() < 22) {
            hora_entrada = "14:00:00";
            hora_salida = "22:00:00";
            tipo_turno = "M";
        }
        else if (toZonedTime(new Date(), "America/Costa_Rica").getHours() >= 22 && toZonedTime(new Date(), "America/Costa_Rica").getHours() < 6) {
            hora_entrada = "22:00:00";
            hora_salida = "06:00:00";
            tipo_turno = "N";
        }

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
                hora_fin: new Date("1970-01-01 " + hora_salida),
                hora_fin_plan: new Date("1970-01-01 " + hora_salida),
                hora_inicio: new Date("1970-01-01 " + hora_entrada),
                hora_inicio_plan: new Date("1970-01-01 " + hora_entrada),
                horas_duracion: 14,
                is_dia_excepcion: false,
                is_puesto_no_cubierto: false,
                is_reposicion_de_horas: false,
                teorico: false,
                tipo_turno: tipo_turno,
            }
        });

        return NextResponse.json({ status: true, message: "Marca creada correctamente", data: newMarca }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}