import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { verifyAccessToken } from "../../../../utils/verifyToken";
import { toZonedTime, format } from "date-fns-tz";

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

        const searchParams = req.nextUrl.searchParams;
        const latitude = searchParams.get("lat");
        const longitude = searchParams.get("long");

        if (!latitude || !longitude) {
            return NextResponse.json({ status: false, message: "Latitude y longitude no especificadas" }, { status: 200 });
        }

        const empleado = await prisma.c_empleado.findUnique({ where: { id } });
        if (!empleado) {
            return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 200 });
        }

        // Obtener siempre la última marca agregada
        const marcaDia = await prisma.c_marca_dia.findFirst({ where: { empleadoFijo_id: id }, orderBy: { id: "desc" } });
        if (!marcaDia) {
            return NextResponse.json({ status: false, message: "No se encontró la marca del dia" }, { status: 200 });
        }

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

        if (corpo.coordenadas_gpslat && corpo.coordenadas_gpslng) {
            const distance = getDistanceFromLatLonInMeters(
                parseFloat(latitude),
                parseFloat(longitude),
                parseFloat(corpo.coordenadas_gpslat),
                parseFloat(corpo.coordenadas_gpslng)
            );
            if (distance > 50) {
                return NextResponse.json({ status: false, message: "Ubicación no válida" }, { status: 200 });
            }
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

        const estado = marcaDia.hora_entrada_digitada != null ? "Ingresado" : "No ingresado";
        if (marcaDia.hora_salida_digitada != null) {
            return NextResponse.json({ status: false, message: "Ya has marcado la salida" }, { status: 200 });
        }

        let change_available = true;
        let is_late = false;
        let next_time = null;
        if (marcaDia.hora_inicio && marcaDia.hora_fin) {

            const hora_inicio = toZonedTime(new Date(), "America/Costa_Rica");
            hora_inicio.setHours(marcaDia.hora_inicio.getHours(), marcaDia.hora_inicio.getMinutes(), marcaDia.hora_inicio.getSeconds(), 0);
            const hora_fin = toZonedTime(new Date(), "America/Costa_Rica");
            hora_fin.setHours(marcaDia.hora_fin.getHours(), marcaDia.hora_fin.getMinutes(), marcaDia.hora_fin.getSeconds(), 0);

            if (toZonedTime(new Date(), "America/Costa_Rica") > hora_fin && marcaDia.hora_entrada_digitada == null) {
                return NextResponse.json({ status: false, absent: true, message: "No has marcado la entrada y has sido declarado como ausente" }, { status: 200 });
            }

            next_time = new Date(estado == "No ingresado" ? hora_inicio : hora_fin);
            const next_change_time = new Date(next_time.getTime());
            next_change_time.setMinutes(next_change_time.getMinutes() - 15);
            if (toZonedTime(new Date(), "America/Costa_Rica") < next_change_time) { // Si la fecha del parámetro es menor a la fecha de la marca menos 15 menos minutos
                change_available = false;
            }

            if (toZonedTime(new Date(), "America/Costa_Rica") > next_time) {
                is_late = true;
            }
        }
        else {
            return NextResponse.json({ status: false, message: "Horario de entrada y salida no configurado" }, { status: 200 });
        }

        const data = {
            status: true,
            estado: estado,
            is_late: is_late,
            change_available: change_available,
            next_time: next_time,
            current_time: toZonedTime(new Date(), "America/Costa_Rica"),
            empresa: empresa.nombre,
            cliente: cliente.nombre,
            contrato: contrato.nombre,
            corpo: corpo.nombre,
            puesto: puesto.nombre,
            plaza: plaza.nombre
        }

        console.log(data);

        return NextResponse.json(data, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}

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

        let marca_return = {};
        switch (type) {
            case "entrada":
                if (marcaDia.hora_entrada_digitada != null) {
                    return NextResponse.json({ status: false, message: "Ya has marcado la entrada" }, { status: 200 });
                }
                marcaDia.hora_entrada_digitada = toZonedTime(new Date(), "America/Costa_Rica");

                marca_return = {
                    id: marcaDia.id,
                    hora_inicio: marcaDia.hora_inicio,
                    hora_fin: marcaDia.hora_fin,
                    fecha: marcaDia.fecha,
                    tipo_turno: marcaDia.tipo_turno,
                    horas_duracion: marcaDia.horas_duracion,
                    empresa: marcaDia.empresa_id,
                    cliente: marcaDia.cliente_id,
                    contrato: marcaDia.contrato_id,
                    corpo: marcaDia.corpo_id,
                    puesto: marcaDia.puesto_id,
                    plaza: marcaDia.plaza_id,
                    horario: marcaDia.horario_id
                };
                break;
            case "salida":
                if (marcaDia.hora_salida_digitada != null) {
                    return NextResponse.json({ status: false, message: "Ya has marcado la salida" }, { status: 200 });
                }

                const now = toZonedTime(new Date(), "America/Costa_Rica");

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

        return NextResponse.json({ status: true, message: type == "entrada" ? "Ingreso de trabajo confirmado" : "Salida de trabajo confirmada", marca: marca_return }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}

function getDistanceFromLatLonInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371000; // radio de la Tierra en metros
    const toRad = (value: number) => (value * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}