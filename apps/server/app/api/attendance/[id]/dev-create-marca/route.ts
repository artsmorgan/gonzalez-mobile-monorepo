import { NextRequest, NextResponse } from "next/server";
import { toZonedTime } from "date-fns-tz";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";

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

        let info_laboral = { empresa_id: 9, cliente_id: 53, contrato_id: 314, corpo_id: 967, puesto_id: 1728, plaza_id: 6801, horario_id: 1808 }
        switch (id) {
            case 11915:
                info_laboral = { empresa_id: 10, cliente_id: 53, contrato_id: 47, corpo_id: 341, puesto_id: 702, plaza_id: 1804, horario_id: 2734 }
                break;
            case 11916:
                info_laboral = { empresa_id: 10, cliente_id: 53, contrato_id: 47, corpo_id: 341, puesto_id: 702, plaza_id: 3077, horario_id: 2734 }
                break;
            case 11917:
                info_laboral = { empresa_id: 10, cliente_id: 53, contrato_id: 47, corpo_id: 341, puesto_id: 719, plaza_id: 1805, horario_id: 2734 }
                break;
            case 11918:
                info_laboral = { empresa_id: 10, cliente_id: 53, contrato_id: 47, corpo_id: 341, puesto_id: 719, plaza_id: 3066, horario_id: 2734 }
                break;
            case 11919:
                info_laboral = { empresa_id: 10, cliente_id: 53, contrato_id: 47, corpo_id: 341, puesto_id: 719, plaza_id: 3577, horario_id: 2734 }
                break;
            case 11920:
                info_laboral = { empresa_id: 10, cliente_id: 53, contrato_id: 46, corpo_id: 340, puesto_id: 260, plaza_id: 4461, horario_id: 2734 }
                break;
            case 11921:
                info_laboral = { empresa_id: 10, cliente_id: 53, contrato_id: 46, corpo_id: 340, puesto_id: 260, plaza_id: 2714, horario_id: 2734 }
                break;
            case 11922:
                info_laboral = { empresa_id: 10, cliente_id: 53, contrato_id: 46, corpo_id: 340, puesto_id: 260, plaza_id: 2542, horario_id: 2734 }
                break;
            case 11923:
                info_laboral = { empresa_id: 10, cliente_id: 53, contrato_id: 46, corpo_id: 340, puesto_id: 260, plaza_id: 2540, horario_id: 2734 }
                break;
            case 11924:
                info_laboral = { empresa_id: 10, cliente_id: 53, contrato_id: 46, corpo_id: 340, puesto_id: 260, plaza_id: 2530, horario_id: 2734 }
                break;
        }

        const newMarca = await callDynamicPrisma({
            req,
            data: { action: "POST", table: "c_marca_dia", operation: "create", data: {
                fecha: toZonedTime(new Date(), "America/Costa_Rica"),
                cliente_id: info_laboral.cliente_id,
                contrato_id: info_laboral.contrato_id,
                corpo_id: info_laboral.corpo_id,
                empleadoFijo_id: id,
                empresa_id: info_laboral.empresa_id,
                horario_id: info_laboral.horario_id,
                plaza_id: info_laboral.plaza_id,
                puesto_id: info_laboral.puesto_id,
                hora_fin: new Date("1970-01-01 " + hora_salida),
                hora_fin_plan: new Date("1970-01-01 " + hora_salida),
                hora_inicio: new Date("1970-01-01 " + hora_entrada),
                hora_inicio_plan: new Date("1970-01-01 " + hora_entrada),
                horas_duracion: 8,
                is_dia_excepcion: false,
                is_puesto_no_cubierto: false,
                is_reposicion_de_horas: false,
                teorico: false,
                tipo_turno: tipo_turno,
            }}
        });

        return NextResponse.json({ status: true, message: "Marca creada correctamente", data: newMarca }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}