import { NextRequest } from "next/server";
import { callDynamicPrisma } from "./callDynamicPrisma";

export type CreatedMantenimientoReport = {
  articuloId: number;
  mantenimientoId: number;
  tipo: string;
};

/** Contexto de puesto/sucursal para resolver datos de entrega en artículos Plan. */
export type ArticuloEstructuraContext = {
  puestoId?: number | null;
  /** corpo_id / sucursal_id del puesto */
  sucursalId?: number | null;
};

function pickNonEmptyString(...values: unknown[]): string | null {
  for (const v of values) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s !== "") return s;
  }
  return null;
}

function positiveInt(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

function isPlanArticuloTipo(tipo: unknown): boolean {
  const s = String(tipo ?? "").trim().toLowerCase();
  if (!s) return false;
  if (s === "plan" || s.includes("plan de")) return true;
  if (s === "asignado" || s.includes("asignado")) return false;
  return s === "plan";
}

function belongsToPuestoOrCorpo(
  row: { puesto_id?: number | null; corpo_id?: number | null },
  puestoId: number,
  sucursalId: number,
): boolean {
  if (puestoId > 0 && row.puesto_id === puestoId) return true;
  if (sucursalId > 0 && row.corpo_id === sucursalId) return true;
  return false;
}

function preferPuestoMatch<T extends { puesto_id?: number | null }>(
  candidates: T[],
  puestoId: number,
): T | null {
  if (candidates.length === 0) return null;
  if (puestoId > 0) {
    const byPuesto = candidates.find((r) => Number(r.puesto_id) === puestoId);
    if (byPuesto) return byPuesto;
  }
  return candidates[0];
}

/** Datos generales del artículo en el payload (sin consultar BD). */
export function resolveMarcaModeloSerieFromArticuloPayload(
  articulo: any,
): { marca: string | null; modelo: string | null; serie: string | null } {
  return {
    marca: pickNonEmptyString(articulo?.marca),
    modelo: pickNonEmptyString(articulo?.modelo),
    serie: pickNonEmptyString(articulo?.serie, articulo?.serie_placa),
  };
}

function resolveContextFromArticulo(
  articulo: any,
  context?: ArticuloEstructuraContext,
): { puestoId: number; sucursalId: number } {
  return {
    puestoId:
      positiveInt(context?.puestoId) ??
      positiveInt(articulo?.puesto_id) ??
      0,
    sucursalId:
      positiveInt(context?.sucursalId) ??
      positiveInt(articulo?.corpo_id) ??
      positiveInt(articulo?.sucursal_id) ??
      0,
  };
}

async function resolvePuestoContext(
  req: NextRequest,
  planRow: any,
  articulo: any,
  context?: ArticuloEstructuraContext,
): Promise<{ puestoId: number; sucursalId: number }> {
  let { puestoId, sucursalId } = resolveContextFromArticulo(articulo, context);

  if (!puestoId) puestoId = positiveInt(planRow?.puesto_id) ?? 0;
  if (!sucursalId) sucursalId = positiveInt(planRow?.corpo_id) ?? 0;

  if (puestoId > 0 && !sucursalId) {
    const puesto = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "e_estructura_puesto",
        operation: "findUnique",
        where: { id: puestoId },
      },
    });
    sucursalId =
      positiveInt(puesto?.sucursal_id) ??
      positiveInt(puesto?.corpo_id) ??
      0;
  }

  return { puestoId, sucursalId };
}

/**
 * Para artículos Plan: busca marca/modelo/serie en entregas vinculadas por nomenclador
 * (misma lógica que main-structure/findEntregaDatosForPlan).
 */
async function resolveEntregaDatosForPlan(
  req: NextRequest,
  planRow: any,
  articulo: any,
  context?: ArticuloEstructuraContext,
): Promise<{ marca: string | null; modelo: string | null; serie: string | null } | null> {
  const articuloCP_id = planRow?.articuloCP_id;
  if (articuloCP_id == null) return null;

  const { puestoId, sucursalId } = await resolvePuestoContext(req, planRow, articulo, context);

  const entregaWhere: Record<string, unknown> = {
    nomencladorArticuloCP_id: articuloCP_id,
  };
  if (puestoId > 0 && sucursalId > 0) {
    entregaWhere.OR = [{ puesto_id: puestoId }, { corpo_id: sucursalId }];
  } else if (puestoId > 0) {
    entregaWhere.puesto_id = puestoId;
  } else if (sucursalId > 0) {
    entregaWhere.corpo_id = sucursalId;
  }

  const entregas = await callDynamicPrisma({
    req,
    data: {
      action: "GET",
      table: "e_estructura_articulo_corpo_puesto_entrega",
      operation: "findMany",
      where: entregaWhere,
    },
  });
  const list = Array.isArray(entregas) ? entregas : [];

  const candidates =
    puestoId > 0 || sucursalId > 0
      ? list.filter((e: any) => belongsToPuestoOrCorpo(e, puestoId, sucursalId))
      : list;

  const match = preferPuestoMatch(candidates, puestoId);
  if (!match) return null;

  return {
    marca: pickNonEmptyString(match.marca),
    modelo: pickNonEmptyString(match.modelo),
    serie: pickNonEmptyString(match.serie),
  };
}

/**
 * Al crear un nuevo c_articulo_mantenimiento, hereda marca/modelo/serie del artículo
 * vinculado en estructura (entrega/plan), no del último registro de mantenimiento.
 */
export async function resolveMarcaModeloSerieFromArticuloEstructura(
  req: NextRequest,
  articulo: any,
  context?: ArticuloEstructuraContext,
): Promise<{ marca: string | null; modelo: string | null; serie: string | null }> {
  const fromPayload = resolveMarcaModeloSerieFromArticuloPayload(articulo);
  const artId = Number(articulo?.id);
  if (!Number.isFinite(artId) || artId <= 0) {
    return fromPayload;
  }

  if (!isPlanArticuloTipo(articulo?.tipo)) {
    const asignadoRow = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "e_estructura_articulo_corpo_puesto_entrega",
        operation: "findUnique",
        where: { id: artId },
      },
    });
    return {
      marca: pickNonEmptyString(fromPayload.marca, asignadoRow?.marca),
      modelo: pickNonEmptyString(fromPayload.modelo, asignadoRow?.modelo),
      serie: pickNonEmptyString(fromPayload.serie, asignadoRow?.serie),
    };
  }

  const planRow = await callDynamicPrisma({
    req,
    data: {
      action: "GET",
      table: "e_estructura_articulo_corpo_puesto_plan",
      operation: "findUnique",
      where: { id: artId },
    },
  });

  const planEntregaDatos = await resolveEntregaDatosForPlan(
    req,
    planRow,
    articulo,
    context,
  );

  return {
    marca: pickNonEmptyString(fromPayload.marca, planEntregaDatos?.marca),
    modelo: pickNonEmptyString(fromPayload.modelo, planEntregaDatos?.modelo),
    serie: pickNonEmptyString(fromPayload.serie, planEntregaDatos?.serie),
  };
}

export async function createReport(
  req: NextRequest,
  articulos_reporte: any[]
): Promise<CreatedMantenimientoReport[]> {
  const created: CreatedMantenimientoReport[] = [];

  for (const articulo of articulos_reporte) {
    const art_id = parseInt(articulo.id);
    const tipoStr = String(articulo.tipo ?? "");
    const isPlan =
      tipoStr === "Plan" ||
      tipoStr.trim().toLowerCase() === "plan" ||
      tipoStr.toLowerCase().includes("plan de");

    const result = await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_articulo_mantenimiento",
        data: {
          articulo_plan_id: isPlan ? art_id : null,
          articulo_asignado_id: isPlan ? null : art_id,
          estado: articulo.estado,
          cantidad_necesaria: articulo.cantidad_requerida,
          cantidad_real: articulo.cantidad_real,
          observaciones: articulo.observaciones,
          marca: articulo.marca,
          modelo: articulo.modelo ?? null,
          serie_placa: articulo.serie,
          created_at: articulo.created_at,
          updated_at: articulo.updated_at,
        },
      },
    });

    const mantenimientoId = Number((result as any)?.id ?? 0);
    if (Number.isFinite(mantenimientoId) && mantenimientoId > 0) {
      created.push({
        articuloId: art_id,
        mantenimientoId,
        tipo: articulo.tipo,
      });
    }
  }

  return created;
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
    if (reporte.modelo !== undefined) data.modelo = reporte.modelo;
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
