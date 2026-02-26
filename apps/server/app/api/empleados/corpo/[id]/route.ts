import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { toZonedTime } from "date-fns-tz";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);

        const corpo = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "e_estructura_sucursal", operation: "findFirst", where: { id } }
        });
        if (!corpo) return NextResponse.json({ message: "Corpo no encontrado" }, { status: 404 });

        const empleados_return: { id: number, nombre: string, cedula: string, codigo: string, fecha_contratacion: string }[] = [];
        const puestos = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "e_estructura_puesto", operation: "findMany", where: { sucursal_id: corpo.id } }
        });
        for (const puesto of puestos) {
            const plazas = await callDynamicPrisma({
                req,
                data: { action: "GET", table: "e_estructura_plazas", operation: "findMany", where: { puesto_id: puesto.id } }
            });
            for (const plaza of plazas) {
                const empleados_plazas = await callDynamicPrisma({
                    req,
                    data: { action: "GET", table: "c_empleado_plaza", operation: "findMany", where: { plaza_id: plaza.id } }
                });
                for (const emp_pl of empleados_plazas) {
                    if (emp_pl.empleado_id) {
                        const empleado = await callDynamicPrisma({
                            req,
                            data: { action: "GET", table: "c_empleado", operation: "findUnique", where: { id: emp_pl.empleado_id } }
                        });
                        if (empleado) {
                            if (empleado.fecha_contratacion == null) continue;
                            if (empleado.estado == "BA") continue;
                            // Buscar el empleado en empleados_return para no duplicarlo
                            const empleado_duplicado = empleados_return.find((e) => e.id === empleado.id);
                            if (!empleado_duplicado) {
                                const nombre = (empleado.nombre || "") + " " + (empleado.primer_apellido || "") + " " + (empleado.segundo_apellido || "");
                                const fechaContratacion = empleado.fecha_contratacion instanceof Date 
                                    ? empleado.fecha_contratacion.toISOString() 
                                    : empleado.fecha_contratacion;
                                empleados_return.push({ id: empleado.id, nombre: nombre, cedula: empleado.cedula || "", codigo: empleado.codigo || "", fecha_contratacion: fechaContratacion || "" });
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