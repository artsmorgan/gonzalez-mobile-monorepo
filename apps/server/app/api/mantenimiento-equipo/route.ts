/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";
import { getUserMarca } from "../../../utils/getUserMarca";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";
import { prisma } from "../../../utils/prismaClient";

type TipoMantenimientoArticuloDTO = { id: number; nombre: string };

async function getMarcaDiaOrFail(req: NextRequest, marcaId: number) {
  const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id: marcaId } });
  if (!marcaDia) return { ok: false as const, marcaDia: null, message: "Marca no encontrada" };
  if (!marcaDia.empleadoFijo_id) return { ok: false as const, marcaDia: null, message: "Empleado no encontrado" };

  const lastMarca = await getUserMarca(req, marcaDia.empleadoFijo_id);
  if (!lastMarca) return { ok: false as const, marcaDia: null, message: "No se encontró la última marca" };
  return { ok: true as const, marcaDia, message: "" };
}

export async function GET(req: NextRequest) {
  console.log('Entramos a la ruta de mantenimiento de equipo');
  try {
    const { valid, expired, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });
    }

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

    const puesto = await prisma.e_estructura_puesto.findUnique({ where: { id: puestoId } });
    if (!puesto) return NextResponse.json({ status: true, data: [] }, { status: 200 });
    const corpoId = puesto.sucursal_id;

    const planRows: any[] = [];

    if (puesto.comboArticulosCP_id) {
      const combo = await prisma.e_estructura_combo_articulo_cp.findUnique({
        where: { id: puesto.comboArticulosCP_id },
      });
      if (combo) {
        const comboPlan = await prisma.e_estructura_articulo_corpo_puesto_plan.findMany({
          where: { combo_id: combo.id },
          include: { n_articulo_corpo_puesto: { select: { id: true, nombre: true } } },
          orderBy: { id: "asc" },
        });
        planRows.push(...comboPlan);
      }
    }

    const planOr: { puesto_id?: number; corpo_id?: number }[] = [{ puesto_id: puestoId }];
    if (corpoId != null) planOr.push({ corpo_id: corpoId });
    const directPlan = await prisma.e_estructura_articulo_corpo_puesto_plan.findMany({
      where: {
        OR: planOr,
        id: { notIn: planRows.map((p: any) => p.id) },
      },
      include: { n_articulo_corpo_puesto: { select: { id: true, nombre: true } } },
      orderBy: { id: "asc" },
    });
    planRows.push(...directPlan);

    const entregaOr: { puesto_id?: number; corpo_id?: number }[] = [{ puesto_id: puestoId }];
    if (corpoId != null) entregaOr.push({ corpo_id: corpoId });
    const asignadosRows = await prisma.e_estructura_articulo_corpo_puesto_entrega.findMany({
      where: { OR: entregaOr },
      include: { n_articulo_corpo_puesto: { select: { id: true, nombre: true } } },
      orderBy: { id: "asc" },
    });

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
          tipo: "Plan de puesto",
          marca: ultimo?.marca ?? null,
          modelo: ultimo?.modelo ?? null,
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
          tipo: "Asignado al puesto",
          marca: a.marca ?? null,
          modelo: a.modelo ?? null,
          serie: a.serie ?? null,
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
