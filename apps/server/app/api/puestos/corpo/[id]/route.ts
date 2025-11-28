import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../../utils/verifyToken";
import { toZonedTime, format } from "date-fns-tz";

import { prisma } from "../../../../../utils/prismaClient";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, payload, message } = verifyAccessToken(req);
        if (!valid) {
            return NextResponse.json({ status: false, message: message }, { status: 401 });
        }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);

        const corpo = await prisma.e_estructura_sucursal.findFirst({ where: { id } });
        if (!corpo) return NextResponse.json({ status: false, message: "Corpo no encontrado" }, { status: 404 });

        const puestos = await prisma.e_estructura_puesto.findMany({ where: { sucursal_id: corpo.id } });

        const puestos_return: { id: number, nombre: string, plazas: { id: number, nombre: string }[] }[] = [];
        for (const puesto of puestos) {
            const plazas = await prisma.e_estructura_plazas.findMany({ where: { puesto_id: puesto.id } });
            const plazas_return: { id: number, nombre: string }[] = [];
            for (const plaza of plazas) {
                plazas_return.push({ id: plaza.id, nombre: plaza.nombre });
            }
            puestos_return.push({ id: puesto.id, nombre: puesto.nombre, plazas: plazas_return });
        }
        return NextResponse.json({ status: true, puestos: puestos_return }, { status: 200 });
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}