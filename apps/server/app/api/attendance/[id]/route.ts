import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../utils/verifyToken";
import { prisma } from "../../../../utils/prismaClient";

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

        const { type, reason, horaAccion } = await req.json();

        // Obtener siempre la última marca agregada
        const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id } });
        if (!marcaDia) {
            return NextResponse.json({ status: false, message: "No se encontró la marca" }, { status: 200 });
        }

        switch (type) {
            case "entrada":
                if (marcaDia.hora_entrada_digitada != null) {
                    return NextResponse.json({ status: false, message: "Ya has marcado la entrada" }, { status: 200 });
                }
                marcaDia.hora_entrada_digitada = new Date(horaAccion);

                const empresa = await prisma.e_estructura_empresa.findUnique({ where: { id: marcaDia.empresa_id } });
                if (!empresa) {
                    return NextResponse.json({ status: false, message: "Empresa no encontrada" }, { status: 200 });
                }

                const cliente = await prisma.e_estructura_cliente.findUnique({ where: { id: marcaDia.cliente_id } });
                if (!cliente) {
                    return NextResponse.json({ status: false, message: "Cliente no encontrado" }, { status: 200 });
                }

                const contrato = await prisma.e_estructura_contrato.findUnique({ where: { id: marcaDia.contrato_id } });
                if (!contrato) {
                    return NextResponse.json({ status: false, message: "Contrato no encontrado" }, { status: 200 });
                }

                const corpo = await prisma.e_estructura_sucursal.findUnique({ where: { id: marcaDia.corpo_id } });
                if (!corpo) {
                    return NextResponse.json({ status: false, message: "Corpo no encontrado" }, { status: 200 });
                }

                const puesto = await prisma.e_estructura_puesto.findUnique({ where: { id: marcaDia.puesto_id } });
                if (!puesto) {
                    return NextResponse.json({ status: false, message: "Puesto no encontrado" }, { status: 200 });
                }

                const plaza = await prisma.e_estructura_plazas.findUnique({ where: { id: marcaDia.plaza_id } });
                if (!plaza) {
                    return NextResponse.json({ status: false, message: "Plaza no encontrada" }, { status: 200 });
                }

                const horario = await prisma.c_horario.findUnique({ where: { id: marcaDia.horario_id } });
                if (!horario) {
                    return NextResponse.json({ status: false, message: "Horario no encontrado" }, { status: 200 });
                }
                break;
            case "salida":
                if (marcaDia.hora_salida_digitada != null) {
                    return NextResponse.json({ status: false, message: "Ya has marcado la salida" }, { status: 200 });
                }

                const now = new Date(horaAccion);

                marcaDia.hora_salida_digitada = now;

                if (!marcaDia.hora_fin || !marcaDia.hora_inicio) {
                    return NextResponse.json({ status: false, message: "Hora de finalización no establecida" }, { status: 200 });
                }

                if (!marcaDia.fecha) {
                    return NextResponse.json({ status: false, message: "Fecha no establecida" }, { status: 200 });
                }

                const endDate = new Date(marcaDia.hora_fin);
                endDate.setFullYear(marcaDia.fecha.getFullYear(), marcaDia.fecha.getMonth(), marcaDia.hora_inicio > marcaDia.hora_fin ? marcaDia.fecha.getDate() + 1 : marcaDia.fecha.getDate());

                if (now.getTime() < (endDate.getTime() - 15 * 60 * 1000)) {
                    const salidaAnticipada = await prisma.c_salida_anticipada.create({
                        data: {
                            tipo_turno: marcaDia.tipo_turno,
                            horario_str: `${marcaDia.hora_inicio.getHours().toString().padStart(2, '0')}:${marcaDia.hora_inicio.getMinutes().toString().padStart(2, '0')}-${marcaDia.hora_fin.getHours().toString().padStart(2, '0')}:${marcaDia.hora_fin.getMinutes().toString().padStart(2, '0')}`,
                            cantidad_horas: marcaDia.horas_duracion || 0,
                            hora_salida_anticipada: now,
                            minutos_descuento: (endDate.getTime() - now.getTime()) / 60000,
                            motivo: reason
                        }
                    });

                    marcaDia.hora_salida_anticipada = now;
                    marcaDia.salida_anticipada_id = salidaAnticipada.id;
                }
                break;
        }

        await prisma.c_marca_dia.update({ where: { id: marcaDia.id }, data: marcaDia });

        return NextResponse.json({ status: true, message: type == "entrada" ? "Ingreso de trabajo confirmado" : "Salida de trabajo confirmada" }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}