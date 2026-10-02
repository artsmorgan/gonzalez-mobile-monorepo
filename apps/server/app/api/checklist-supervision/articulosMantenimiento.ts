/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";
import { prisma } from "../../../utils/prismaClient";
import { sendNotificationByRole } from "../../../utils/sendNotification";
import { createReport, updateReport, resolveMarcaModeloSerieFromArticuloEstructura } from "../../../utils/createReporteArticuloMantenimiento";
import { uploadArticuloMantenimientoFiles } from "../../../utils/uploadArticuloMantenimientoFiles";

export function articuloIncomingTimestamp(articulo: any, fallbackAccion: Date): Date {
  if (articulo?.created_at != null && String(articulo.created_at).trim()) {
    const d = new Date(articulo.created_at);
    if (!isNaN(d.getTime())) return d;
  }
  return fallbackAccion;
}

export function cantidadNecesariaFromArticulo(articulo: any): number {
  const n = Number(articulo?.cantidad_necesaria ?? articulo?.cantidad_requerida ?? 0);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.floor(n));
}

export type ProcessChecklistArticulosOpts = {
  req: NextRequest;
  articulos_puesto: any;
  accionAt: Date;
  corpo_id: number;
  puesto_id: number;
  payload: any;
  /** Para `sendNotificationByRole` (p. ej. `created_by` del checklist). */
  notifySenderIds: number[];
  /** Fecha/hora mostrada en la notificación (texto). */
  fechaNotificacion: Date;
  isUpdate?: boolean;
};

/**
 * Misma lógica que en POST /api/checklist-supervision: crear/actualizar c_articulo_mantenimiento
 * y notificar si un artículo pasa de Bueno a otro estado.
 */
export async function processChecklistSupervisionArticulosMantenimiento(
  opts: ProcessChecklistArticulosOpts
): Promise<void> {
  const {
    req,
    articulos_puesto,
    accionAt,
    corpo_id,
    puesto_id,
    payload,
    notifySenderIds,
    fechaNotificacion,
    isUpdate,
  } = opts;

  let empNombre = "Desconocido";
  let sucursalNombre = "Desconocida";
  let puestoNombre = "Desconocido";
  if (puesto_id) {
    const puesto = await prisma.e_estructura_puesto.findUnique({ where: { id: puesto_id } });
    if (puesto) {
      puestoNombre = puesto.nombre + " (" + puesto.codigo + ")";
    }
  }
  const empleado = await prisma.c_empleado.findUnique({
    where: { id: parseInt(String((payload as any)?.id ?? 0)) || 0 },
  });
  if (empleado) {
    empNombre = empleado.nombre + " " + empleado.primer_apellido + " " + empleado.segundo_apellido;
  }
  const sucursal = await prisma.e_estructura_sucursal.findUnique({ where: { id: corpo_id } });
  if (sucursal) {
    sucursalNombre = sucursal.nombre;
  }

  const fechaRegistro = fechaNotificacion.toISOString().split("T")[0];
  const horaRegistro = fechaNotificacion.toISOString().split("T")[1].split(".")[0];

  let articulos_desc = ".";
  let send_notification = false;
  const articulos_reporte: any[] = [];
  const articulos_reporte_update: any[] = [];

  if (!articulos_puesto) return;

  try {
    const articulos_puesto_array =
      typeof articulos_puesto === "string" ? JSON.parse(articulos_puesto) : articulos_puesto;
    if (Array.isArray(articulos_puesto_array) && articulos_puesto_array.length > 0) {
      let init_desc = false;
      const estructuraContext = { puestoId: puesto_id, sucursalId: corpo_id };
      for (const articulo of articulos_puesto_array) {
        const articulo_desc = `- ${articulo.cantidad_real} de ${articulo.cantidad_requerida} unidades de "${articulo.nombre}" (Estado: ${articulo.estado})\n`;

        const incomingTs = articuloIncomingTimestamp(articulo, accionAt);
        const cantidadNec = cantidadNecesariaFromArticulo(articulo);
        const serverNow = new Date();
        const estado_actual = String(articulo.estado || "").trim();

        const isPlanTipo =
          String(articulo.tipo ?? "").trim().toLowerCase() === "plan" ||
          String(articulo.tipo ?? "").toLowerCase().includes("plan de");
        const whereByTipo = isPlanTipo
          ? { articulo_plan_id: articulo.id }
          : { articulo_asignado_id: articulo.id };

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

        const pushCreate = async () => {
          const ts = articuloIncomingTimestamp(articulo, accionAt);
          const { marca, modelo, serie } = await resolveMarcaModeloSerieFromArticuloEstructura(
            req,
            articulo,
            estructuraContext,
          );
          articulos_reporte.push({
            id: articulo.id,
            nombre: articulo.nombre,
            tipo: articulo.tipo,
            marca,
            modelo,
            serie,
            cantidad_requerida: cantidadNec,
            cantidad_real: Number(articulo.cantidad_real ?? 0),
            estado: estado_actual,
            observaciones: articulo.observaciones ?? "",
            created_at: ts,
            updated_at: ts,
            mantenimiento_files: mantenimientoFiles,
          });
        };

        if (!last_mantenimiento?.id) {
          await pushCreate();
          if (estado_actual !== "Bueno") {
            send_notification = true;
            if (!init_desc) {
              articulos_desc = ". Sin embargo, los artículos registrados presentan los siguientes detalles:\n";
              init_desc = true;
            }
            articulos_desc += articulo_desc;
          }
          continue;
        }

        const last_estado = String(last_mantenimiento.estado || "").trim();

        if (last_estado !== "Bueno" && estado_actual === "Bueno") {
          articulos_reporte_update.push({
            id: last_mantenimiento.id,
            estado: estado_actual,
            cantidad_real: cantidadNec,
            cantidad_necesaria: cantidadNec,
            fecha_solucion: serverNow,
            observaciones: articulo.observaciones ?? "",
            marca: articulo.marca,
            modelo: articulo.modelo ?? null,
            serie_placa: articulo.serie,
            updated_at: serverNow,
            mantenimiento_files: mantenimientoFiles,
          });
        } else if (last_estado !== "Bueno" && estado_actual !== "Bueno") {
          const upd: Record<string, unknown> = {
            id: last_mantenimiento.id,
            estado: estado_actual,
            cantidad_real: Number(articulo.cantidad_real ?? 0),
            cantidad_necesaria: cantidadNec,
            observaciones: articulo.observaciones ?? "",
            marca: articulo.marca,
            modelo: articulo.modelo ?? null,
            serie_placa: articulo.serie,
            updated_at: serverNow,
            mantenimiento_files: mantenimientoFiles,
          };
          if (last_estado !== estado_actual) {
            upd.fecha_solucion = null;
          }
          articulos_reporte_update.push(upd);
        } else if (last_estado === "Bueno" && estado_actual !== "Bueno") {
          send_notification = true;
          if (!init_desc) {
            articulos_desc = ". Sin embargo, los artículos registrados presentan los siguientes detalles:\n";
            init_desc = true;
          }
          articulos_desc += articulo_desc;
          await pushCreate();
        } else {
          articulos_reporte_update.push({
            id: last_mantenimiento.id,
            estado: estado_actual,
            cantidad_real: Number(articulo.cantidad_real ?? 0),
            cantidad_necesaria: cantidadNec,
            observaciones: articulo.observaciones ?? "",
            marca: articulo.marca,
            modelo: articulo.modelo ?? null,
            serie_placa: articulo.serie,
            updated_at: serverNow,
            mantenimiento_files: mantenimientoFiles,
          });
        }
      }
    }
  } catch (error) {
    console.error("Error procesando artículos para notificación y reportes (checklist):", error);
  }

  if (articulos_reporte_update.length > 0) {
    await updateReport(req, articulos_reporte_update);
    for (const upd of articulos_reporte_update) {
      const files = Array.isArray(upd.mantenimiento_files) ? upd.mantenimiento_files : [];
      if (files.length > 0 && upd.id) {
        try {
          await uploadArticuloMantenimientoFiles(req, Number(upd.id), files);
        } catch (e) {
          console.error("Error subiendo archivos de mantenimiento (update checklist):", e);
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
          console.error("Error subiendo archivos de mantenimiento (create checklist):", e);
        }
      }
    }
  }

  if (send_notification) {
    const verb = isUpdate ? "ha actualizado" : "ha registrado";
    const title = isUpdate ? "Checklist de supervisión actualizado" : "Checklist de supervisión registrado";
    const description =
      "El empleado " +
      empNombre +
      " " +
      verb +
      " un checklist de supervisión en el puesto " +
      puestoNombre +
      " en la sucursal " +
      sucursalNombre +
      " el día " +
      fechaRegistro +
      " a las " +
      horaRegistro +
      articulos_desc;
    await sendNotificationByRole(req, corpo_id, notifySenderIds, title, description, [
      "ADMINISTRATIVO",
      "SUPERVISOR",
    ]);
  }
}
