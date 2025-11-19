import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../utils/verifyToken";
import { toZonedTime } from "date-fns-tz";
import { prisma } from "../../../utils/prismaClient";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";

export async function POST(req: NextRequest) {
    try {
        const { valid, payload, message } = verifyAccessToken(req);
        if (!valid) {
            return NextResponse.json(
                { status: false, message: message },
                { status: 401 }
            );
        }

        const { marca_id, firma_evaluador, tipo, evaluacion } = await req.json();

        console.log("marca_id", marca_id);
        console.log("tipo", tipo);
        console.log("evaluacion", evaluacion);
        console.log("firma_evaluador", firma_evaluador);
        console.log("--------------------------------");
        if (!marca_id || !tipo || !firma_evaluador) {
            console.log("Datos incompletos");
            return NextResponse.json({ message: "Datos incompletos" }, { status: 400 });
        }

        const marca = await prisma.c_marca_dia.findUnique({ where: { id: marca_id } });
        if (!marca) return NextResponse.json({ message: "Marca no encontrada" }, { status: 404 });

        if (!marca.empleadoFijo_id) return NextResponse.json({ message: "Empleado no encontrado" }, { status: 404 });

        const corpo = await prisma.e_estructura_sucursal.findUnique({ where: { id: marca.corpo_id } });
        if (!corpo) return NextResponse.json({ message: "Corpo no encontrado" }, { status: 404 });

        const puesto = await prisma.e_estructura_puesto.findUnique({ where: { id: marca.puesto_id } });
        if (!puesto) return NextResponse.json({ message: "Puesto no encontrado" }, { status: 404 });

        const plaza = await prisma.e_estructura_plazas.findUnique({ where: { id: marca.plaza_id } });
        if (!plaza) return NextResponse.json({ message: "Plaza no encontrada" }, { status: 404 });

        // Deconvertir firma_evaluador de base64 a texto
        const firma_evaluador_text = atob(firma_evaluador);
        const empleado_id = firma_evaluador_text.split(":")[1];

        if (!empleado_id) return NextResponse.json({ message: "ID del empleado no encontrado" }, { status: 404 });

        const empleado = await prisma.c_empleado.findUnique({ where: { id: parseInt(empleado_id) } });
        if (!empleado) return NextResponse.json({ message: "Evaluador no encontrado" }, { status: 404 });
        if (empleado.fecha_contratacion == null) return NextResponse.json({ message: "Evaluador no ha sido contratado" }, { status: 400 });
        if (empleado.estado == "BA") return NextResponse.json({ message: "Evaluador fue dado de baja" }, { status: 400 });

        const evaluacion_empleado = await prisma.c_evaluacion.create({
            data: {
                corpo_id: corpo.id,
                puesto_id: puesto.id,
                plaza_id: plaza.id,
                tipo: tipo,
                evaluation: evaluacion,
                firma_evaluador: firma_evaluador,
                created_at: toZonedTime(new Date(), "America/Costa_Rica"),
                created_by: marca.empleadoFijo_id
            }
        });

        return NextResponse.json({ status: true, message: "Evaluación creada correctamente" }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}