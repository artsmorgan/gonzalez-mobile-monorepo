import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../../utils/verifyToken";
import { toZonedTime } from "date-fns-tz";

import { prisma } from "../../../../../utils/prismaClient";

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

        const corpo = await prisma.e_estructura_sucursal.findFirst({ where: { id } });
        if (!corpo) return NextResponse.json({ message: "Corpo no encontrado" }, { status: 404 });

        const empleados_return: { id: number, nombre: string, cedula: string, fecha_contratacion: string }[] = [];
        const puestos = await prisma.e_estructura_puesto.findMany({ where: { sucursal_id: corpo.id } });
        for (const puesto of puestos) {
            const plazas = await prisma.e_estructura_plazas.findMany({ where: { puesto_id: puesto.id } });
            for (const plaza of plazas) {
                const empleados_plazas = await prisma.c_empleado_plaza.findMany({ where: { plaza_id: plaza.id } });
                for (const emp_pl of empleados_plazas) {
                    if (emp_pl.empleado_id) {
                        const empleado = await prisma.c_empleado.findUnique({ where: { id: emp_pl.empleado_id } });
                        if (empleado) {
                            if (empleado.fecha_contratacion == null) continue;
                            if (empleado.estado == "BA") continue;
                            // Buscar el empleado en empleados_return para no duplicarlo
                            const empleado_duplicado = empleados_return.find((e) => e.id === empleado.id);
                            if (!empleado_duplicado) {
                                const nombre = (empleado.nombre || "") + " " + (empleado.primer_apellido || "") + " " + (empleado.segundo_apellido || "");
                                empleados_return.push({ id: empleado.id, nombre: nombre, cedula: empleado.cedula || "", fecha_contratacion: empleado.fecha_contratacion.toISOString() || "" });
                            }
                        }
                    }
                }
            }
        }

        return NextResponse.json({ status: true, empleados: empleados_return }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}