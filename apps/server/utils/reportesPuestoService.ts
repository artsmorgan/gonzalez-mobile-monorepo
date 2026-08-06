/* eslint-disable @typescript-eslint/no-explicit-any */
import { toZonedTime } from "date-fns-tz";
import type { NextRequest } from "next/server";
import { callDynamicPrisma } from "./callDynamicPrisma";
import type { ReportDataAccess } from "./reportDynamicPrisma";
import { drainPendingReportJobs } from "./runReportJobCycle";
import { resolveUserAccessToken } from "./resolveUserAccessToken";
import {
  buildMobileReportJobCreateData,
  buildPuestoModuleFiltersRaw,
  signalReportJobsCreated,
} from "./reportModuleJobHelpers";

export const REPORTES_PUESTO_EXCLUDED_MODULES = new Set([
  "acciones_personales",
  "ingresos_usuario",
  "login_marca",
]);

export type ReportePuestoSelection = {
  modulo: string;
  tipo_reporte: "Individual" | "Consolidado";
};

export type CreateReportePuestoParams = {
  nombre: string;
  numero: string;
  nomenclatura: string;
  descripcion?: string;
  puestoId: number;
  firma_responsable: string;
  creadoDesde?: string | null;
  creadoHasta?: string | null;
  selections: ReportePuestoSelection[];
  empleadoId: number;
  serviceAccessToken?: string;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatReportMetaTimestamp(at: Date = new Date()): string {
  const dd = pad2(at.getDate());
  const mm = pad2(at.getMonth() + 1);
  const aa = pad2(at.getFullYear() % 100);
  const hh = pad2(at.getHours());
  const mi = pad2(at.getMinutes());
  const ss = pad2(at.getSeconds());
  return `${dd}${mm}${aa}${hh}${mi}${ss}`;
}

function buildChildReportMeta(modulo: string, tipo: string, ts: string) {
  return {
    nombre: `${modulo} ${tipo} ${ts}`,
    numero: ts,
    nomenclatura: `${modulo} ${tipo} ${ts}`,
  };
}

function enrichModuleFiltersForTipo(
  modulo: string,
  tipo: string,
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...raw };
  if (modulo === "registro_induccion_general") {
    out.reportOutputType = tipo;
  }
  return out;
}

function buildPuestoBatchId(empleadoId: number): string {
  return `rp-${empleadoId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function createReportePuestoBatch(
  req: NextRequest,
  reportDb: ReportDataAccess,
  params: CreateReportePuestoParams,
): Promise<{ reportePuestoId: number; reporteIds: number[] }> {
  const puestoId = Number(params.puestoId);
  if (!Number.isFinite(puestoId) || puestoId <= 0) {
    throw new Error("puestoId es obligatorio");
  }

  const selections = (params.selections || []).filter(
    (s) => s?.modulo && !REPORTES_PUESTO_EXCLUDED_MODULES.has(String(s.modulo)),
  );
  if (selections.length === 0) {
    throw new Error("Seleccione al menos un módulo/tipo de reporte");
  }

  const drainWorkerId = `api-puesto-${params.empleadoId}-${Date.now()}`;
  await drainPendingReportJobs(reportDb, drainWorkerId);

  const ts = formatReportMetaTimestamp();
  const batchId = buildPuestoBatchId(params.empleadoId);

  const jobRows = selections.map((sel) => {
    const modulo = String(sel.modulo).trim();
    const tipo = sel.tipo_reporte === "Individual" ? "Individual" : "Consolidado";
    const rawFilters = buildPuestoModuleFiltersRaw({
      modulo,
      puestoId,
      creadoDesde: params.creadoDesde,
      creadoHasta: params.creadoHasta,
    });
    const moduleFilters = enrichModuleFiltersForTipo(modulo, tipo, rawFilters);
    const meta = buildChildReportMeta(modulo, tipo, ts);

    return buildMobileReportJobCreateData({
      modulo,
      nombre: meta.nombre,
      numero: meta.numero,
      nomenclatura: meta.nomenclatura,
      descripcion: params.descripcion ?? "",
      tipo_reporte: tipo,
      firma_responsable: params.firma_responsable,
      moduleFilters,
      serviceAccessToken: params.serviceAccessToken,
      empleadoId: params.empleadoId,
      batchId,
    });
  });

  await callDynamicPrisma({
    req,
    data: {
      action: "POST",
      table: "e_reportes_mobile",
      operation: "createMany",
      data: jobRows,
    },
  });

  const createdJobs = await callDynamicPrisma({
    req,
    data: {
      action: "GET",
      table: "e_reportes_mobile",
      operation: "findMany",
      where: {
        created_by: params.empleadoId,
        filters: { contains: batchId },
      },
      select: { id: true },
      orderBy: { id: "asc" },
      take: jobRows.length,
    },
  });

  const reporteIds = (Array.isArray(createdJobs) ? createdJobs : [])
    .map((r: any) => Number(r.id))
    .filter((id: number) => Number.isFinite(id) && id > 0);

  if (reporteIds.length !== jobRows.length) {
    throw new Error(
      `No se pudieron recuperar todos los reportes creados (${reporteIds.length}/${jobRows.length})`,
    );
  }

  const filtersSnapshot = JSON.stringify({
    puestoId,
    creadoDesde: params.creadoDesde ?? null,
    creadoHasta: params.creadoHasta ?? null,
    selections,
    batchId,
  });

  const reportePuestoRow = await callDynamicPrisma({
    req,
    data: {
      action: "POST",
      table: "e_reportes_puesto",
      operation: "create",
      data: {
        nombre: params.nombre,
        numero: params.numero,
        nomenclatura: params.nomenclatura,
        descripcion: params.descripcion ?? null,
        puesto_id: puestoId,
        filters: filtersSnapshot,
        firma_responsable: params.firma_responsable,
        created_at: toZonedTime(new Date(), "America/Costa_Rica"),
        created_by: params.empleadoId,
      },
    },
  });

  const reportePuestoId = Number((reportePuestoRow as any)?.id);
  if (!Number.isFinite(reportePuestoId) || reportePuestoId <= 0) {
    throw new Error("No se pudo crear el registro de reporte por puesto");
  }

  await callDynamicPrisma({
    req,
    data: {
      action: "POST",
      table: "e_reportes_puesto_list",
      operation: "createMany",
      data: reporteIds.map((reporteId) => ({
        reporte_puesto_id: reportePuestoId,
        reporte_id: reporteId,
      })),
    },
  });

  signalReportJobsCreated();

  return { reportePuestoId, reporteIds };
}

export type ReportePuestoListFilters = {
  puestoId?: number | null;
  createdDesde?: string | null;
  createdHasta?: string | null;
};

export async function listReportesPuesto(
  req: NextRequest,
  reportDb: ReportDataAccess,
  filters: ReportePuestoListFilters,
): Promise<any[]> {
  const where: Record<string, unknown> = {};

  const puestoId = filters.puestoId != null ? Number(filters.puestoId) : null;
  if (puestoId != null && Number.isFinite(puestoId) && puestoId > 0) {
    where.puesto_id = puestoId;
  }

  if (filters.createdDesde || filters.createdHasta) {
    const createdAt: Record<string, unknown> = {};
    if (filters.createdDesde) createdAt.gte = filters.createdDesde;
    if (filters.createdHasta) createdAt.lte = filters.createdHasta;
    where.created_at = createdAt;
  }

  const rows = await callDynamicPrisma({
    req,
    data: {
      action: "GET",
      table: "e_reportes_puesto",
      operation: "findMany",
      where,
      orderBy: { id: "desc" },
      take: 200,
    },
  });

  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 0) return [];

  const puestoIds = [...new Set(list.map((r: any) => Number(r.puesto_id)).filter((id) => id > 0))];
  const puestoMap = new Map<number, string>();
  if (puestoIds.length > 0) {
    const puestos = await reportDb.e_estructura_puesto.findMany({
      where: { id: { in: puestoIds } },
      select: { id: true, nombre: true, codigo: true },
    });
    for (const p of puestos) {
      puestoMap.set(p.id, [p.codigo, p.nombre].filter(Boolean).join(" — ") || String(p.id));
    }
  }

  const reportePuestoIds = list.map((r: any) => Number(r.id)).filter((id) => id > 0);
  const links = reportePuestoIds.length
    ? await callDynamicPrisma({
        req,
        data: {
          action: "GET",
          table: "e_reportes_puesto_list",
          operation: "findMany",
          where: { reporte_puesto_id: { in: reportePuestoIds } },
        },
      })
    : [];

  const linkArr = Array.isArray(links) ? links : [];
  const reporteIds = [...new Set(linkArr.map((l: any) => Number(l.reporte_id)).filter((id) => id > 0))];

  const reporteRows =
    reporteIds.length > 0
      ? await reportDb.e_reportes_mobile.findMany({
          where: { id: { in: reporteIds } },
          select: {
            id: true,
            modulo: true,
            tipo_reporte: true,
            estado: true,
            nombre: true,
            progress: true,
          },
        })
      : [];

  const reporteById = new Map(reporteRows.map((r) => [r.id, r]));
  const linksByPuestoId = new Map<number, any[]>();
  for (const link of linkArr) {
    const pid = Number(link.reporte_puesto_id);
    const arr = linksByPuestoId.get(pid) ?? [];
    arr.push(link);
    linksByPuestoId.set(pid, arr);
  }

  return list.map((row: any) => {
    const id = Number(row.id);
    const childLinks = linksByPuestoId.get(id) ?? [];
    const childReports = childLinks
      .map((l) => reporteById.get(Number(l.reporte_id)))
      .filter(Boolean)
      .map((r: any) => ({
        id: r.id,
        modulo: r.modulo,
        tipo_reporte: r.tipo_reporte,
        estado: r.estado,
        nombre: r.nombre,
        progress: r.progress,
      }));

    const estados = childReports.map((c) => String(c.estado || "").toLowerCase());
    let aggregateEstado = "pendiente";
    if (estados.length > 0 && estados.every((e) => e === "completado")) aggregateEstado = "completado";
    else if (estados.some((e) => e === "error" || e === "fallido")) aggregateEstado = "error";
    else if (estados.some((e) => e === "procesando" || e === "en_proceso")) aggregateEstado = "procesando";

    return {
      ...row,
      puesto_label: puestoMap.get(Number(row.puesto_id)) ?? String(row.puesto_id),
      childReports,
      aggregateEstado,
      completadosCount: estados.filter((e) => e === "completado").length,
      totalCount: childReports.length,
    };
  });
}

export function resolveServiceAccessToken(req: NextRequest, token?: string): string | undefined {
  return resolveUserAccessToken(req, token) || undefined;
}
