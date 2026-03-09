/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";
import { getUserMarca } from "../../../utils/getUserMarca";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";

type TipoMantenimientoArticuloDTO = { id: number; nombre: string };

async function getMarcaDiaOrFail(req: NextRequest, marcaId: number) {
  const marcaDia = await callDynamicPrisma({
    req,
    data: { action: "GET", table: "c_marca_dia", operation: "findUnique", where: { id: marcaId } }
  });
  if (!marcaDia) return { ok: false as const, marcaDia: null, message: "Marca no encontrada" };
  if (!marcaDia.empleadoFijo_id) return { ok: false as const, marcaDia: null, message: "Empleado no encontrado" };

  const lastMarca = await getUserMarca(req, marcaDia.empleadoFijo_id);
  if (!lastMarca) return { ok: false as const, marcaDia: null, message: "No se encontró la última marca" };
  if (marcaDia.id !== lastMarca.id) return { ok: false as const, marcaDia: null, message: "Hay una nueva marca más reciente" };
  return { ok: true as const, marcaDia, message: "" };
}

export async function GET(req: NextRequest) {
  console.log('Entramos a la ruta de mantenimiento de equipo');
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });
    }

    // Nuevo contrato: este endpoint puede consultarse por puesto directamente.
    // - `p` / `puesto_id` (requerido para filtrar por jerarquía)
    // - `m` (opcional) se usa solo para validar marca actual si el cliente lo envía
    const puestoParam = req.nextUrl.searchParams.get("p") ?? req.nextUrl.searchParams.get("puesto_id");
    const puestoId = puestoParam ? parseInt(puestoParam) : NaN;
    if (!Number.isFinite(puestoId)) {
      return NextResponse.json({ status: false, message: "Puesto inválido / no especificado" }, { status: 200 });
    }

    console.log('puestoId: ', puestoId);

    const marcaIdStr = req.nextUrl.searchParams.get("m");
    if (marcaIdStr) {
      const marcaId = parseInt(marcaIdStr);
      if (Number.isFinite(marcaId)) {
        const marcaRes = await getMarcaDiaOrFail(req, marcaId);
        if (!marcaRes.ok) return NextResponse.json({ status: false, message: marcaRes.message }, { status: 200 });
      }
    }

    // Obtener artículos del puesto replicando la lógica de `main-structure`:
    // - Incluir comboArticulosCP (si existe)
    // - Incluir plan directo del puesto evitando duplicados
    // - Incluir asignados (entrega) del puesto
    const puesto = await callDynamicPrisma({
      req,
      data: { action: "GET", table: "e_estructura_puesto", operation: "findUnique", where: { id: puestoId } }
    });
    if (!puesto) return NextResponse.json({ status: true, data: [] }, { status: 200 });

    const planRows: any[] = [];

    // 1) Artículos del combo del puesto (si existe)
    if ((puesto as any).comboArticulosCP_id) {
      const combo = await callDynamicPrisma({
        req,
        data: { action: "GET", table: "e_estructura_combo_articulo_cp", operation: "findUnique", where: { id: (puesto as any).comboArticulosCP_id } }
      });
      if (combo) {
        const comboPlan = await callDynamicPrisma({
          req,
          data: { action: "GET", table: "e_estructura_articulo_corpo_puesto_plan", operation: "findMany", where: { combo_id: combo.id }, include: { n_articulo_corpo_puesto: { select: { id: true, nombre: true } } }, orderBy: { id: "asc" } }
        });
        planRows.push(...comboPlan);
      }
    }

    // 2) Plan directo del puesto (evitar duplicados por id)
    const directPlan = await callDynamicPrisma({
      req,
      data: { action: "GET", table: "e_estructura_articulo_corpo_puesto_plan", operation: "findMany", where: { OR: [
        { puesto_id: puestoId },
        { corpo_id: puesto.corpo_id }
      ], id: { notIn: planRows.map((p) => p.id) } }, include: { n_articulo_corpo_puesto: { select: { id: true, nombre: true } } }, orderBy: { id: "asc" } }
    });
    planRows.push(...directPlan);

    // 3) Asignados del puesto (entrega)
    const asignadosRows = await callDynamicPrisma({
      req,
      data: { action: "GET", table: "e_estructura_articulo_corpo_puesto_entrega", operation: "findMany", where: { OR: [{ puesto_id: puestoId }, { corpo_id: puesto.corpo_id }] }, include: { n_articulo_corpo_puesto: { select: { id: true, nombre: true } } }, orderBy: { id: "asc" } }
    });

    // Cargar tipos de mantenimiento por nomenclador (en bulk)
    const articuloIds = Array.from(
      new Set(
        [...planRows.map((p: any) => p.articuloCP_id), ...asignadosRows.map((a: any) => a.nomencladorArticuloCP_id)]
          .filter((id): id is number => typeof id === "number" && Number.isFinite(id))
      )
    );

    const tiposRows = articuloIds.length
      ? await callDynamicPrisma({
        req,
        data: { action: "GET", table: "n_tipo_mantenimiento_articulo", operation: "findMany", where: { articulo_id: { in: articuloIds } }, select: { id: true, articulo_id: true, nombre: true }, orderBy: { id: "asc" } }
      })
      : [];
    const tiposByArticuloId = new Map<number, TipoMantenimientoArticuloDTO[]>();
    for (const t of tiposRows) {
      const list = tiposByArticuloId.get(t.articulo_id) ?? [];
      list.push({ id: t.id, nombre: t.nombre });
      tiposByArticuloId.set(t.articulo_id, list);
    }

    // Para mantenimientos y movimientos, preferimos exactitud (últimos 8 por item), aunque sea N+1.
    const planItems = await Promise.all(
      planRows.map(async (p) => {
        const articuloNomencladorId = p.articuloCP_id ?? null;
        const articuloNombre = p.n_articulo_corpo_puesto?.nombre ?? "Desconocido";

        const mantenimientos = await callDynamicPrisma({
          req,
          data: { action: "GET", table: "c_articulo_mantenimiento", operation: "findMany", where: { articulo_plan_id: p.id }, include: { c_archivos_adjuntos_articulo_mantenimiento: { select: { id: true, name: true, original_name: true, type: true, extension: true } } }, orderBy: { id: "desc" }, take: 8 }
        });

        const movimientos = await callDynamicPrisma({
          req,
          data: { action: "GET", table: "c_movimientos_articulo_mantenimiento", operation: "findMany", where: { articulo_plan_id: p.id }, orderBy: { id: "desc" } }
        });

        const ultimo = mantenimientos[0] ?? null;
        return {
          key: `plan-${p.id}`,
          source: "plan" as const,
          estructura_id: p.id,
          puesto_id: p.puesto_id ?? null,
          articulo_nomenclador_id: articuloNomencladorId,
          articulo_nombre: articuloNombre,
          tipo: ultimo?.articulo_plan_id ? "Plan de puesto" : "Plan de puesto",
          // Nota: e_estructura_articulo_corpo_puesto_plan no tiene marca/serie. Las exponemos desde el último mantenimiento si existe.
          marca: ultimo?.marca ?? null,
          serie: ultimo?.serie_placa ?? null,
          cantidad_plan: p.cantidad ?? null,
          tipos_mantenimiento: articuloNomencladorId ? tiposByArticuloId.get(articuloNomencladorId) ?? [] : [],
          mantenimientos,
          movimientos,
          ultimo_mantenimiento: ultimo
            ? {
              id: ultimo.id,
              estado: ultimo.estado,
              cantidad_necesaria: ultimo.cantidad_necesaria,
              cantidad_real: ultimo.cantidad_real,
              observaciones: ultimo.observaciones,
            }
            : null,
        };
      })
    );

    const asignadoItems = await Promise.all(
      asignadosRows.map(async (a: any) => {
        const articuloNomencladorId = a.nomencladorArticuloCP_id ?? null;
        const articuloNombre = a.n_articulo_corpo_puesto?.nombre ?? "Desconocido";

        const mantenimientos = await callDynamicPrisma({
          req,
          data: { action: "GET", table: "c_articulo_mantenimiento", operation: "findMany", where: { articulo_asignado_id: a.id }, include: { c_archivos_adjuntos_articulo_mantenimiento: { select: { id: true, name: true, original_name: true, type: true, extension: true } } }, orderBy: { id: "desc" }, take: 8 }
        });

        const movimientos = await callDynamicPrisma({
          req,
          data: { action: "GET", table: "c_movimientos_articulo_mantenimiento", operation: "findMany", where: { articulo_asignado_id: a.id }, orderBy: { id: "desc" } }
        });

        const ultimo = mantenimientos[0] ?? null;
        return {
          key: `asignado-${a.id}`,
          source: "asignado" as const,
          estructura_id: a.id,
          puesto_id: a.puesto_id ?? null,
          articulo_nomenclador_id: articuloNomencladorId,
          articulo_nombre: articuloNombre,
          tipo: ultimo?.articulo_asignado_id ? "Asignado al puesto" : "Asignado al puesto",
          // Según requerimiento: setear marca/serie como null para asignados
          marca: null,
          serie: null,
          tipos_mantenimiento: articuloNomencladorId ? tiposByArticuloId.get(articuloNomencladorId) ?? [] : [],
          mantenimientos,
          movimientos,
          ultimo_mantenimiento: ultimo
            ? {
              id: ultimo.id,
              estado: ultimo.estado,
              cantidad_necesaria: ultimo.cantidad_necesaria,
              cantidad_real: ultimo.cantidad_real,
              observaciones: ultimo.observaciones,
            }
            : null,
        };
      })
    );

    return NextResponse.json({ status: true, data: [...planItems, ...asignadoItems] }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in GET /api/mantenimiento-equipo:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}


