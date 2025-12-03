/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../utils/verifyToken";
import { toZonedTime } from "date-fns-tz";
import { prisma } from "../../../utils/prismaClient";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { createVehicleImage } from "../../../utils/createVehicleImage";
import { sendNotificationByRole } from "../../../utils/sendNotification";

export async function GET(req: NextRequest) {
    try {
        const { valid, payload, message } = verifyAccessToken(req);

        if (!valid) {
            return NextResponse.json(
                { status: false, message: message },
                { status: 401 }
            );
        }
        const searchParams = req.nextUrl.searchParams;
        const marca = searchParams.get("m");

        if (!marca) {
            return NextResponse.json({ status: false, message: "Marca no especificada" }, { status: 200 });
        }

        const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id: parseInt(marca) } });
        if (!marcaDia) {
            return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 200 });
        }

        const lastMarca = await prisma.c_marca_dia.findFirst({ where: { empleadoFijo_id: marcaDia.empleadoFijo_id }, orderBy: { id: "desc" } });
        if (!lastMarca) {
            return NextResponse.json({ status: false, message: "No se encontró la última marca" }, { status: 200 });
        }

        if (marcaDia.id !== lastMarca.id) {
            return NextResponse.json({ status: false, message: "Hay una nueva marca más reciente" }, { status: 200 });
        }

        const vehiculos = await prisma.e_registro_vehiculos.findMany({ where: { corpo_id: marcaDia.corpo_id } });

        const vehiculos_return: any[] = [];
        for (const v of vehiculos) {

            const responsable = await prisma.c_empleado.findUnique({ where: { id: v.responsable_id } });
            if (!responsable) {
                return NextResponse.json({ status: false, message: "Responsable no encontrado" }, { status: 200 });
            }

            vehiculos_return.push({
                id: v.id,
                tipo: v.tipo,
                placa: v.placa,
                nombre_propietario: v.nombre,
                cedula_propietario: v.cedula,
                hora_entrada: v.hora_entrada,
                hora_salida: v.hora_salida,
                razon_visita: v.razon_visita,
                responsable: {
                    id: v.responsable_id,
                    nombre: responsable.nombre + " " + responsable.primer_apellido + " " + responsable.segundo_apellido,
                },
                created_at: v.created_at,
                id_local: "",
                base64_image: ""
            });
        }

        return NextResponse.json({ status: true, data: vehiculos_return }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const { valid, payload, message } = verifyAccessToken(req);

        if (!valid) {
            return NextResponse.json(
                { status: false, message: message },
                { status: 401 }
            );
        }

        const { marca_id, tipo, placa, nombre, cedula, hora_entrada, hora_salida, razon_visita, file } = await req.json();

        if (!marca_id || !tipo || !placa || !nombre || !cedula || !hora_entrada || !razon_visita) {
            return NextResponse.json({ status: false, message: "Datos incompletos" }, { status: 200 });
        }

        const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id: parseInt(marca_id) } });
        if (!marcaDia) {
            return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 200 });
        }

        const new_vehicle = await prisma.e_registro_vehiculos.create({
            data: {
                cliente_id: marcaDia.cliente_id,
                corpo_id: marcaDia.corpo_id,
                puesto_id: marcaDia.puesto_id,
                responsable_id: payload.id,
                created_at: toZonedTime(new Date(), "America/Costa_Rica"),
                updated_at: toZonedTime(new Date(), "America/Costa_Rica"),
                tipo: tipo,
                placa: placa,
                nombre: nombre,
                cedula: cedula,
                hora_entrada: new Date(hora_entrada),
                hora_salida: hora_salida ? new Date(hora_salida) : null,
                razon_visita: razon_visita,
            }
        });

        // Guardar imagen si existe
        if (new_vehicle) {
            if (file) {
                const result = await createVehicleImage(new_vehicle.id, file);
                console.log("result", result);
            }
            const empleado = await prisma.c_empleado.findUnique({ where: { id: payload.id } });
            if (empleado) {
                const entrada = new_vehicle.hora_entrada.toISOString();
                const fecha_entrada = entrada.split("T")[0];
                const hora_entrada = entrada.split("T")[1].split(".")[0];
                const desc = `El empleado ${empleado.nombre} ${empleado.primer_apellido} ha registrado la visita de un vehículo de tipo ${tipo} con la placa ${placa} el día ${fecha_entrada} a las ${hora_entrada}. Razón de la visita: ${razon_visita}`;
                await sendNotificationByRole(marca_id, "Vehículo registrado", desc, ["ADMINISTRATIVO", "SUPERVISOR"]);    
            }
        }

        return NextResponse.json({ status: true, message: "Vehículo registrado correctamente" }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}
