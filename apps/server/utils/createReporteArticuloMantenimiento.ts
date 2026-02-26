import { NextRequest } from "next/server";
import { callDynamicPrisma } from "./callDynamicPrisma";

export async function createReport(req: NextRequest, articulos_reporte: any[]) {
    for (const articulo of articulos_reporte) {

        const art_id = parseInt(articulo.id);

        let was_good = false;

        if (articulo.tipo == "Plan") {
            const last_mantenimiento = await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "c_articulo_mantenimiento",
                    operation: "findFirst",
                    where: { articulo_plan_id: art_id },
                    orderBy: { fecha_solucion: "desc" },
                },
            });
            if (last_mantenimiento && last_mantenimiento.id) {
                if (last_mantenimiento.estado == "Bueno") {
                    was_good = true;
                }
            }
        }
        else {
            const last_mantenimiento = await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "c_articulo_mantenimiento",
                    operation: "findFirst",
                    where: { articulo_asignado_id: art_id },
                    orderBy: { fecha_solucion: "desc" },
                },
            });
            if (last_mantenimiento && last_mantenimiento.id) {
                if (last_mantenimiento.estado == "Bueno") {
                    was_good = true;
                }
            }
        }

        if (articulo.estado != "Bueno" && was_good) {
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
                    },
                },
            });
        }
    }
}