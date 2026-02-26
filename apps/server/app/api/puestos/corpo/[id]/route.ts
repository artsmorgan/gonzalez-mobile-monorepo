import { NextRequest, NextResponse } from "next/server";
import { toZonedTime, format } from "date-fns-tz";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);

        const corpo = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "e_estructura_sucursal",
                operation: "findFirst",
                where: { id }
            }
        });
        if (!corpo) return NextResponse.json({ status: false, message: "Corpo no encontrado" }, { status: 404 });

        const puestos = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "e_estructura_puesto",
                operation: "findMany",
                where: { sucursal_id: corpo.id }
            }
        });

        const puestos_return: { id: number, nombre: string, plazas: { id: number, nombre: string }[] }[] = [];
        for (const puesto of puestos) {
            const plazas = await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "e_estructura_plazas",
                    operation: "findMany",
                    where: { puesto_id: puesto.id }
                }
            });
            const plazas_return: { id: number, nombre: string, empleados: { nombre: string, primer_apellido: string, segundo_apellido: string }[] }[] = [];
            for (const plaza of plazas) {
                const empleados_plaza = await callDynamicPrisma({
                    req,
                    data: {
                        action: "GET",
                        table: "c_empleado_plaza",
                        operation: "findMany",
                        where: { plaza_id: plaza.id }
                    }
                });
                const empleados_plaza_return: { nombre: string, primer_apellido: string, segundo_apellido: string }[] = [];
                for (const empleado_plaza of empleados_plaza) {
                    if (empleado_plaza.empleado_id) {
                        const empleado = await callDynamicPrisma({
                            req,
                            data: {
                                action: "GET",
                                table: "c_empleado",
                                operation: "findUnique",
                                where: { id: empleado_plaza.empleado_id }
                            }
                        });
                        if (empleado == null) continue;
                        if (empleado.fecha_contratacion == null) continue;
                        if (empleado.estado == "BA") continue;
                        empleados_plaza_return.push({ nombre: empleado.nombre || "", primer_apellido: empleado.primer_apellido || "", segundo_apellido: empleado.segundo_apellido || "" });
                    }
                }
                plazas_return.push({ id: plaza.id, nombre: plaza.nombre, empleados: empleados_plaza_return });
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