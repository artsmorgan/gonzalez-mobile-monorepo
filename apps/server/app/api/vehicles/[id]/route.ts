import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../utils/verifyToken";
import { toZonedTime } from "date-fns-tz";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "../../../../utils/prismaClient";
import { createVehicleImage } from "../../../../utils/createVehicleImage";

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

        if (!id) {
            return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });
        }

        const { marca_id, tipo, placa, nombre, cedula, hora_entrada, hora_salida, razon_visita, file } = await req.json();

        const vehicle = await prisma.e_registro_vehiculos.findUnique({ where: { id } });
        if (!vehicle) {
            return NextResponse.json({ status: false, message: "Vehículo no encontrado" }, { status: 200 });
        }

        const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id: parseInt(marca_id) } });
        if (!marcaDia) {
            return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 200 });
        }

        // Guardar imagen si existe primero, para obtener el file_name actualizado
        let updatedFileName = vehicle.file_name;
        if (vehicle && file) {
            const result = await createVehicleImage(vehicle.id, file);
            console.log("result", result);
            if (result) {
                // Obtener el vehículo actualizado para incluir el nuevo file_name
                const updatedVehicle = await prisma.e_registro_vehiculos.findUnique({ where: { id } });
                if (updatedVehicle) {
                    updatedFileName = updatedVehicle.file_name;
                }
            }
        }

        // Actualizar los demás campos del vehículo
        await prisma.e_registro_vehiculos.update({
            where: { id },
            data: {
                tipo: tipo,
                placa: placa,
                nombre: nombre,
                cedula: cedula,
                hora_entrada: new Date(hora_entrada),
                hora_salida: hora_salida ? new Date(hora_salida) : null,
                razon_visita: razon_visita,
                updated_at: toZonedTime(new Date(), "America/Costa_Rica"),
                file_name: updatedFileName // Preservar el file_name actualizado si existe
            }
        });

        return NextResponse.json({ status: true, message: "Vehículo actualizado correctamente" }, { status: 200 });
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
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

        if (!id) {
            return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });
        }

        const vehicle = await prisma.e_registro_vehiculos.findUnique({ where: { id } });
        if (!vehicle) {
            return NextResponse.json({ status: false, message: "Vehículo no encontrado" }, { status: 200 });
        }

        const id_vehicle = vehicle.id;
        const file_name = vehicle.file_name;

        await prisma.e_registro_vehiculos.delete({ where: { id } });

        if (file_name) {
            const path_file = path.join(process.cwd(), "public", "uploads", "vehicles", id_vehicle.toString(), file_name);
            if (fs.existsSync(path_file)) {
                fs.unlinkSync(path_file);
            }
        }

        return NextResponse.json({ status: true, message: "Vehículo eliminado correctamente" }, { status: 200 });
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}
