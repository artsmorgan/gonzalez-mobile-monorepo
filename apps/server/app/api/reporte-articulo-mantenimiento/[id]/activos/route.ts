/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../../utils/verifyToken";
import { prisma } from "../../../../../utils/prismaClient";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, expired, payload, message } = verifyAccessToken(req);
    if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

    const resolvedParams = await context.params;
    const reporteId = parseInt(resolvedParams.id);
    if (!reporteId) {
      return NextResponse.json({ status: false, message: "ID de reporte no especificado" }, { status: 200 });
    }

    const activos = await prisma.c_activo_mantenimiento.findMany({
      where: { reporte_id: reporteId },
      include: {
        c_reporte_articulo_mantenimiento: {
          select: { id: true },
        },
        c_archivos_adjuntos_archivo_mantenimiento: {
          select: {
            id: true,
            name: true,
            original_name: true,
            type: true,
            extension: true,
          },
        },
      },
      orderBy: { id: "asc" },
    });

    // Obtener nombres de artículos
    const activosConNombres = await Promise.all(
      activos.map(async (activo) => {
        // Buscar el artículo en e_estructura_articulo_corpo_puesto_plan primero
        const articuloPlan = await prisma.e_estructura_articulo_corpo_puesto_plan.findUnique({
          where: { id: activo.articulo_id },
          include: {
            n_articulo_corpo_puesto: {
              select: { id: true, nombre: true },
            },
          },
        });

        let nombreArticulo = "Desconocido";
        if (articuloPlan?.n_articulo_corpo_puesto) {
          nombreArticulo = articuloPlan.n_articulo_corpo_puesto.nombre;
        } else {
          // Si no está en el plan, buscar directamente en n_articulo_corpo_puesto
          const articuloDirecto = await prisma.n_articulo_corpo_puesto.findUnique({
            where: { id: activo.articulo_id },
          });
          if (articuloDirecto) {
            nombreArticulo = articuloDirecto.nombre;
          }
        }

        return {
          id: activo.id,
          reporte_id: activo.reporte_id,
          articulo_id: activo.articulo_id,
          articulo_nombre: nombreArticulo,
          estado: activo.estado,
          cantidad_necesaria: activo.cantidad_necesaria,
          cantidad_real: activo.cantidad_real,
          observaciones: activo.observaciones,
          fecha_solucion: activo.fecha_solucion,
          accion: activo.accion,
          fecha_inicio: activo.fecha_inicio,
          tipo: activo.tipo,
          marca: activo.marca,
          modelo: activo.modelo,
          serie_placa: activo.serie_placa,
          categoria: activo.categoria,
          fecha_salida: activo.fecha_salida,
          fecha_entrada: activo.fecha_entrada,
          kilometraje: activo.kilometraje,
          categoria_mantinimiento: activo.categoria_mantinimiento,
          detalle: activo.detalle,
          numero_fc: activo.numero_fc,
          proveedor: activo.proveedor,
          costo_mo: activo.costo_mo,
          costo_i: activo.costo_i,
          iva: activo.iva,
          costo_total: activo.costo_total,
          fecha_fin: activo.fecha_fin,
          reincidencia_treinta_dias: activo.reincidencia_treinta_dias,
          archivos: activo.c_archivos_adjuntos_archivo_mantenimiento.map(archivo => ({
            id: archivo.id,
            name: archivo.name,
            original_name: archivo.original_name,
            type: archivo.type,
            extension: archivo.extension,
          })),
        };
      })
    );

    return NextResponse.json({ status: true, data: activosConNombres }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in GET /api/reporte-articulo-mantenimiento/[id]/activos:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}

