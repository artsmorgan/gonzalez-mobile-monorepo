/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";
import { createReport, updateReport } from "../../../utils/createReporteArticuloMantenimiento";
import { uploadArticuloMantenimientoFiles } from "../../../utils/uploadArticuloMantenimientoFiles";
import {
  sanitizeArticulosPuestoForPersistence,
  stripMantenimientoFilesFromArticulosPuesto,
} from "../../../utils/sanitizeArticulosPuestoForPersistence";

function articuloIncomingTimestamp(articulo: any, fallback: Date): Date {
  if (articulo?.created_at != null && String(articulo.created_at).trim()) {
    const d = new Date(articulo.created_at);
    if (!isNaN(d.getTime())) return d;
  }
  return fallback;
}

function cantidadNecesariaFromArticulo(articulo: any): number {
  const n = Number(articulo?.cantidad_necesaria ?? articulo?.cantidad_requerida ?? 0);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.floor(n));
}

function isPlanTipo(tipo: unknown): boolean {
  const s = String(tipo ?? "").trim().toLowerCase();
  if (!s) return false;
  if (s === "plan" || s.includes("plan de")) return true;
  if (s === "asignado" || s.includes("asignado")) return false;
  return s === "plan";
}

export type ProcessEntregaArticulosResult = {
  articulos_puesto_stored: string;
  send_notification: boolean;
  articulos_desc: string;
};

/**
 * Crea/actualiza c_articulo_mantenimiento, sube archivos adjuntos y devuelve
 * articulos_puesto sanitizado para persistir en e_registro_entrega_puesto.
 */
export async function processEntregaPuestosArticulosMantenimiento(
  req: NextRequest,
  articulos_puesto: any,
  accionAt: Date,
): Promise<ProcessEntregaArticulosResult> {
  const empty: ProcessEntregaArticulosResult = {
    articulos_puesto_stored: sanitizeArticulosPuestoForPersistence(articulos_puesto),
    send_notification: false,
    articulos_desc: ".",
  };
  if (!articulos_puesto) return empty;

  let articulos_desc = ".";
  let send_notification = false;
  const articulos_reporte: any[] = [];
  const articulos_reporte_update: any[] = [];

  try {
    const articulos_puesto_array =
      typeof articulos_puesto === "string" ? JSON.parse(articulos_puesto) : articulos_puesto;
    if (!Array.isArray(articulos_puesto_array) || articulos_puesto_array.length === 0) {
      return empty;
    }

    let init_desc = false;
    for (const articulo of articulos_puesto_array) {
      const articulo_desc = `- ${articulo.cantidad_real} de ${articulo.cantidad_requerida} unidades de "${articulo.nombre}" (Estado: ${articulo.estado})\n`;
      const newEst = String(articulo.estado ?? "").trim();
      const cantidadNec = cantidadNecesariaFromArticulo(articulo);
      const serverNow = new Date();
      const incomingTs = articuloIncomingTimestamp(articulo, accionAt);
      const plan = isPlanTipo(articulo.tipo);
      const whereByTipo = plan ? { articulo_plan_id: articulo.id } : { articulo_asignado_id: articulo.id };

      const last_mantenimiento = await callDynamicPrisma({
        req,
        data: {
          action: "GET",
          table: "c_articulo_mantenimiento",
          operation: "findFirst",
          where: whereByTipo,
          orderBy: { updated_at: "desc" },
        },
      });

      if (last_mantenimiento?.updated_at) {
        const lastUpMs = new Date(last_mantenimiento.updated_at).getTime();
        if (!isNaN(lastUpMs) && incomingTs.getTime() < lastUpMs) {
          continue;
        }
      }

      const mantenimientoFiles = Array.isArray(articulo.mantenimiento_files)
        ? articulo.mantenimiento_files
        : [];

      const pushCreate = () => {
        const ts = articuloIncomingTimestamp(articulo, accionAt);
        articulos_reporte.push({
          id: articulo.id,
          nombre: articulo.nombre,
          tipo: articulo.tipo,
          marca: articulo.marca,
          serie: articulo.serie,
          cantidad_requerida: cantidadNec,
          cantidad_real: Number(articulo.cantidad_real ?? 0),
          estado: newEst,
          observaciones: articulo.observaciones ?? "",
          created_at: ts,
          updated_at: ts,
          mantenimiento_files: mantenimientoFiles,
        });
      };

      if (!last_mantenimiento?.id) {
        pushCreate();
        if (newEst !== "Bueno") {
          send_notification = true;
          if (!init_desc) {
            articulos_desc = ". Sin embargo, los artículos registrados presentan los siguientes detalles:\n";
            init_desc = true;
          }
          articulos_desc += articulo_desc;
        }
        continue;
      }

      const lastEst = String(last_mantenimiento.estado ?? "").trim();

      if (lastEst !== "Bueno" && newEst === "Bueno") {
        articulos_reporte_update.push({
          id: last_mantenimiento.id,
          estado: newEst,
          cantidad_real: cantidadNec,
          cantidad_necesaria: cantidadNec,
          fecha_solucion: serverNow,
          observaciones: articulo.observaciones ?? "",
          marca: articulo.marca,
          serie_placa: articulo.serie,
          updated_at: serverNow,
          mantenimiento_files: mantenimientoFiles,
        });
      } else if (lastEst !== "Bueno" && newEst !== "Bueno") {
        const upd: Record<string, unknown> = {
          id: last_mantenimiento.id,
          estado: newEst,
          cantidad_real: Number(articulo.cantidad_real ?? 0),
          cantidad_necesaria: cantidadNec,
          observaciones: articulo.observaciones ?? "",
          marca: articulo.marca,
          serie_placa: articulo.serie,
          updated_at: serverNow,
          mantenimiento_files: mantenimientoFiles,
        };
        if (lastEst !== newEst) upd.fecha_solucion = null;
        articulos_reporte_update.push(upd);
      } else if (lastEst === "Bueno" && newEst !== "Bueno") {
        send_notification = true;
        if (!init_desc) {
          articulos_desc = ". Sin embargo, los artículos registrados presentan los siguientes detalles:\n";
          init_desc = true;
        }
        articulos_desc += articulo_desc;
        pushCreate();
      } else {
        articulos_reporte_update.push({
          id: last_mantenimiento.id,
          estado: newEst,
          cantidad_real: Number(articulo.cantidad_real ?? 0),
          cantidad_necesaria: cantidadNec,
          observaciones: articulo.observaciones ?? "",
          marca: articulo.marca,
          serie_placa: articulo.serie,
          updated_at: serverNow,
          mantenimiento_files: mantenimientoFiles,
        });
      }
    }
  } catch (error) {
    console.error("Error procesando artículos de entrega de puesto:", error);
  }

  if (articulos_reporte_update.length > 0) {
    await updateReport(req, articulos_reporte_update);
    for (const upd of articulos_reporte_update) {
      const files = Array.isArray(upd.mantenimiento_files) ? upd.mantenimiento_files : [];
      if (files.length > 0 && upd.id) {
        try {
          await uploadArticuloMantenimientoFiles(req, Number(upd.id), files);
        } catch (e) {
          console.error("Error subiendo archivos de mantenimiento (update entrega):", e);
        }
      }
    }
  }

  if (articulos_reporte.length > 0) {
    const created = await createReport(req, articulos_reporte);
    const reporteByArticuloId = new Map(
      articulos_reporte.map((art) => [Number(art.id), art] as const),
    );
    for (const item of created) {
      const art = reporteByArticuloId.get(item.articuloId);
      const files = Array.isArray(art?.mantenimiento_files) ? art.mantenimiento_files : [];
      if (files.length > 0 && item.mantenimientoId) {
        try {
          await uploadArticuloMantenimientoFiles(req, item.mantenimientoId, files);
        } catch (e) {
          console.error("Error subiendo archivos de mantenimiento (create entrega):", e);
        }
      }
    }
  }

  const articulos_puesto_stored = stripMantenimientoFilesFromArticulosPuesto(
    sanitizeArticulosPuestoForPersistence(articulos_puesto),
  );

  return { articulos_puesto_stored, send_notification, articulos_desc };
}
