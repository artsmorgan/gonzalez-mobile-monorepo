/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../utils/verifyToken";
import { prisma } from "../../../utils/prismaClient";
import { toZonedTime } from "date-fns-tz";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

export async function GET(req: NextRequest) {
    try {
        const { valid, expired, payload, message } = verifyAccessToken(req);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        // ?emp=[id]&plaza=[id]
        const searchParams = new URL(req.url).searchParams;
        const emp = searchParams.get('emp');
        const plaza = searchParams.get('plaza');

        if (!emp || !plaza) {
            return NextResponse.json({ status: false, message: "Empleado o plaza no especificados" }, { status: 400 });
        }

        const empleado = await prisma.c_empleado.findFirst({ where: { id: parseInt(emp) } });
        if (!empleado) {
            return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 404 });
        }

        const intercambio_return: any = [];

        const intercambio_empleado = await prisma.c_intercambio_linea.findMany({ where: { empleado_id: parseInt(emp), OR: [{ plazaInicio_id: parseInt(plaza) }, { plazaFin_id: parseInt(plaza) }] } });

        for (const intercambio of intercambio_empleado) {
            if (intercambio.intercambio_id === null) continue;

            const intercambio_data = await prisma.c_intercambio.findFirst({ where: { id: intercambio.intercambio_id } });
            if (!intercambio_data) continue;

            let empleado_sustituido = null;
            if (intercambio.empleadoSustituido_id !== null) {
                empleado_sustituido = await prisma.c_empleado.findFirst({ where: { id: intercambio.empleadoSustituido_id } });
            }

            let plaza_inicio = null;
            if (intercambio.plazaInicio_id !== null) {
                plaza_inicio = await prisma.e_estructura_plazas.findFirst({ where: { id: intercambio.plazaInicio_id } });
            }

            let plaza_fin = null;
            if (intercambio.plazaFin_id !== null) {
                plaza_fin = await prisma.e_estructura_plazas.findFirst({ where: { id: intercambio.plazaFin_id } });
            }

            intercambio_return.push({
                intercambio: intercambio_data,
                intercambio_linea: intercambio,
                empleado_sustituido: empleado_sustituido,
                plaza_inicio: plaza_inicio,
                plaza_fin: plaza_fin,
            });
        }

        return NextResponse.json({ status: true, intercambio_return: intercambio_return }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ status: false, message: "Error al obtener los traslados de plaza" }, { status: 500 });
    }
}