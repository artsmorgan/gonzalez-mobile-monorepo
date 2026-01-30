import { prisma } from "./prismaClient";
import { toZonedTime } from "date-fns-tz";

export async function createReport(clienteId: number, corpoId: number, puestoId: number, division: number, articulos_reporte: any[], createdBy: number) {

    const division_data = await prisma.n_division.findUnique({
        where: {
            id: division
        }
    });

    if (!division_data) {
        throw new Error("División no encontrada");
    }

    const reporte = await prisma.c_reporte_articulo_mantenimiento.create({
        data: {
            cliente_id: clienteId,
            corpo_id: corpoId,
            puesto_id: puestoId,
            division: division_data.nombre,
            fecha_reporte: toZonedTime(new Date(), "America/Costa_Rica"),
            created_by: createdBy,
            solucionado: false,
        }
    });

    if (reporte) {
        for (const articulo of articulos_reporte) {
            await prisma.c_activo_mantenimiento.create({
                data: {
                    reporte_id: reporte.id,
                    articulo_id: articulo.id,
                    estado: articulo.estado,
                    cantidad_necesaria: articulo.cantidad_requerida,
                    cantidad_real: articulo.cantidad_real,
                    observaciones: articulo.observaciones
                }
            });
        }
    }
}