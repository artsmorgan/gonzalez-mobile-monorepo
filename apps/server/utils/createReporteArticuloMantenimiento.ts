import { NextRequest } from "next/server";
import { callDynamicPrisma } from "./callDynamicPrisma";
import { toZonedTime } from "date-fns-tz";

export async function createReport(req: NextRequest, articulos_reporte: any[]) {
    for (const articulo of articulos_reporte) {

        const art_id = parseInt(articulo.id);
            await callDynamicPrisma({
                req,
                data: {
                    action: "POST",
                    table: "c_articulo_mantenimiento",
                    data: {
                        articulo_plan_id: articulo.tipo === "Plan" ? art_id : null,
                        articulo_asignado_id: articulo.tipo === "Asignado" ? art_id : null,
                        estado: articulo.estado,
                        cantidad_necesaria: articulo.cantidad_requerida,
                        cantidad_real: articulo.cantidad_real,
                        observaciones: articulo.observaciones,
                        marca: articulo.marca,
                        serie_placa: articulo.serie,
                        created_at: articulo.created_at,
                        updated_at: articulo.updated_at,
                    },
                },
            });
    }
}

export async function updateReport(req: NextRequest, articulos_reporte_update: any[]) {
    for (const reporte of articulos_reporte_update) {
        const data: Record<string, any> = {};
        if ("estado" in reporte) {
            data.estado = reporte.estado == null ? "" : String(reporte.estado);
        }
        if (reporte.cantidad_real !== undefined) data.cantidad_real = reporte.cantidad_real;
        if (Object.prototype.hasOwnProperty.call(reporte, "fecha_solucion")) {
            data.fecha_solucion = reporte.fecha_solucion;
        }
        if (reporte.cantidad_necesaria !== undefined) {
            data.cantidad_necesaria = reporte.cantidad_necesaria;
        }
        if (reporte.observaciones !== undefined) data.observaciones = reporte.observaciones;
        if (reporte.marca !== undefined) data.marca = reporte.marca;
        const seriePlaca =
            reporte.serie_placa !== undefined ? reporte.serie_placa : reporte.serie;
        if (seriePlaca !== undefined) data.serie_placa = seriePlaca;
        if (reporte.updated_by !== undefined) data.updated_by = reporte.updated_by;
        await callDynamicPrisma({
            req,
            data: {
                action: "UPDATE",
                table: "c_articulo_mantenimiento",
                operation: "update",
                where: { id: reporte.id },
                data,
                returning: false,
                updated_at: reporte.updated_at,
            },
        });
    }
}