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
        await callDynamicPrisma({
            req,
            data: {
                action: "UPDATE",
                table: "c_articulo_mantenimiento",
                operation: "update",
                where: { id: reporte.id },
                data: { estado: reporte.estado, fecha_solucion: reporte.fecha_solucion, cantidad_real: reporte.cantidad_real, updated_by: reporte.updated_by },
                returning: false,
                updated_at: reporte.updated_at,
            },
        });
    }
}