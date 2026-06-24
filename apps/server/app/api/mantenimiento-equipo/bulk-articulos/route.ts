/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";

export const runtime = "nodejs";

type BulkArticuloInput = {
  numero_articulo: number;
  cantidad: number;
  serie: string;
  marca: string;
  fecha_entrega: string;
};

function parseFechaEntregaParts(value: string): {
  dd: string;
  mm: string;
  yyyy: string;
  hh: string;
  mi: string;
  ss: string;
} | null {
  const s = String(value ?? "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const [, dd, mm, yyyy, hh, mi, ss = "0"] = m;
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  const hour = Number(hh);
  const minute = Number(mi);
  const second = Number(ss || 0);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) return null;
  if (Number.isNaN(year)) return null;
  return {
    dd: String(day).padStart(2, "0"),
    mm: String(month).padStart(2, "0"),
    yyyy: String(year),
    hh: String(hour).padStart(2, "0"),
    mi: String(minute).padStart(2, "0"),
    ss: String(second).padStart(2, "0"),
  };
}

function isValidFechaEntrega(value: string): boolean {
  return parseFechaEntregaParts(value) != null;
}

/** Solo para persistir en BD; el string del payload se conserva tal cual. */
function fechaEntregaStringToDbDate(value: string): Date | null {
  const parts = parseFechaEntregaParts(value);
  if (!parts) return null;
  const d = new Date(
    Number(parts.yyyy),
    Number(parts.mm) - 1,
    Number(parts.dd),
    Number(parts.hh),
    Number(parts.mi),
    Number(parts.ss),
  );
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function POST(req: NextRequest) {
  try {
    const { valid, expired, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json({ status: false, expired, message }, { status: expired ? 401 : 403 });
    }

    const body = await req.json();
    const puestoIdsRaw = body?.puesto_ids;
    const articulosRaw = body?.articulos;

    if (!Array.isArray(puestoIdsRaw) || puestoIdsRaw.length === 0) {
      return NextResponse.json({ status: false, message: "Debe indicar al menos un puesto." }, { status: 200 });
    }
    if (!Array.isArray(articulosRaw) || articulosRaw.length === 0) {
      return NextResponse.json({ status: false, message: "Debe indicar al menos un artículo." }, { status: 200 });
    }

    const puestoIds = Array.from(
      new Set(
        puestoIdsRaw.map((id: unknown) => Number(id)).filter((id: number) => Number.isFinite(id) && id > 0),
      ),
    );
    if (puestoIds.length === 0) {
      return NextResponse.json({ status: false, message: "IDs de puesto inválidos." }, { status: 200 });
    }

    const articulos: BulkArticuloInput[] = [];
    const validationErrors: string[] = [];

    for (let i = 0; i < articulosRaw.length; i++) {
      const row = articulosRaw[i] as Record<string, unknown>;
      const numero = Number(row?.numero_articulo);
      const cantidad = Number(row?.cantidad);
      const serie = String(row?.serie ?? "").trim();
      const marca = String(row?.marca ?? "").trim();
      const fechaEntrega = String(row?.fecha_entrega ?? "").trim();

      if (!Number.isFinite(numero) || numero <= 0) {
        validationErrors.push(`Artículo ${i + 1}: número inválido.`);
        continue;
      }
      if (!Number.isFinite(cantidad) || cantidad < 0) {
        validationErrors.push(`Artículo ${i + 1}: cantidad inválida.`);
        continue;
      }
      if (!serie) {
        validationErrors.push(`Artículo ${i + 1}: serie obligatoria.`);
        continue;
      }
      if (!marca) {
        validationErrors.push(`Artículo ${i + 1}: marca obligatoria.`);
        continue;
      }
      if (!fechaEntrega || !isValidFechaEntrega(fechaEntrega)) {
        validationErrors.push(`Artículo ${i + 1}: fecha de entrega inválida (DD-MM-YYYY HH:MM:SS).`);
        continue;
      }

      articulos.push({
        numero_articulo: Math.trunc(numero),
        cantidad: Math.trunc(cantidad),
        serie,
        marca,
        fecha_entrega: fechaEntrega,
      });
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { status: false, message: "Datos de artículos inválidos.", errors: validationErrors },
        { status: 200 },
      );
    }

    const articuloNums = Array.from(new Set(articulos.map((a) => a.numero_articulo)));
    const catalogRows = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "n_articulo_corpo_puesto",
        operation: "findMany",
        where: { id: { in: articuloNums } },
      },
    });
    const catalogIds = new Set(
      (Array.isArray(catalogRows) ? catalogRows : []).map((a: { id: number }) => Number(a.id)),
    );
    for (const n of articuloNums) {
      if (!catalogIds.has(n)) {
        validationErrors.push(`El artículo #${n} no existe.`);
      }
    }
    if (validationErrors.length > 0) {
      return NextResponse.json(
        { status: false, message: "Algunos artículos no existen.", errors: validationErrors },
        { status: 200 },
      );
    }

    const puestos = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "e_estructura_puesto",
        operation: "findMany",
        where: { id: { in: puestoIds } },
      },
    });
    const puestoById = new Map<number, { id: number; sucursal_id: number | null }>();
    for (const p of Array.isArray(puestos) ? puestos : []) {
      puestoById.set(Number(p.id), {
        id: Number(p.id),
        sucursal_id: p.sucursal_id != null ? Number(p.sucursal_id) : null,
      });
    }
    for (const pid of puestoIds) {
      if (!puestoById.has(pid)) {
        validationErrors.push(`El puesto #${pid} no existe.`);
      }
    }
    if (validationErrors.length > 0) {
      return NextResponse.json(
        { status: false, message: "Algunos puestos no existen.", errors: validationErrors },
        { status: 200 },
      );
    }

    const existingPlans = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "e_estructura_articulo_corpo_puesto_plan",
        operation: "findMany",
        where: {
          puesto_id: { in: puestoIds },
          articuloCP_id: { in: articuloNums },
        },
      },
    });
    const existingEntregas = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "e_estructura_articulo_corpo_puesto_entrega",
        operation: "findMany",
        where: {
          puesto_id: { in: puestoIds },
          nomencladorArticuloCP_id: { in: articuloNums },
        },
      },
    });

    const planKeys = new Set<string>();
    for (const p of Array.isArray(existingPlans) ? existingPlans : []) {
      if (p.puesto_id != null && p.articuloCP_id != null) {
        planKeys.add(`${p.puesto_id}:${p.articuloCP_id}`);
      }
    }
    const entregaKeys = new Set<string>();
    for (const e of Array.isArray(existingEntregas) ? existingEntregas : []) {
      if (e.puesto_id != null && e.nomencladorArticuloCP_id != null) {
        entregaKeys.add(
          `${e.puesto_id}:${e.nomencladorArticuloCP_id}:${String(e.marca ?? "").trim()}:${String(e.serie ?? "").trim()}`,
        );
      }
    }

    const skipped: string[] = [];
    let createdPlans = 0;
    let createdEntregas = 0;

    for (const puestoId of puestoIds) {
      const puesto = puestoById.get(puestoId)!;

      for (const art of articulos) {
        const planKey = `${puestoId}:${art.numero_articulo}`;
        const entregaKey = `${puestoId}:${art.numero_articulo}:${art.marca}:${art.serie}`;
        const fechaEntregaDb = fechaEntregaStringToDbDate(art.fecha_entrega);
        if (!fechaEntregaDb) continue;

        if (!planKeys.has(planKey)) {
          await callDynamicPrisma({
            req,
            data: {
              action: "POST",
              table: "e_estructura_articulo_corpo_puesto_plan",
              operation: "create",
              data: {
                puesto_id: puestoId,
                corpo_id: null,
                cantidad: art.cantidad,
                articuloCP_id: art.numero_articulo,
                combo_id: null,
              },
            },
          });
          planKeys.add(planKey);
          createdPlans++;
        } else {
          skipped.push(
            `Plan ya existente: puesto #${puestoId}, artículo #${art.numero_articulo}.`,
          );
        }

        if (!entregaKeys.has(entregaKey)) {
          await callDynamicPrisma({
            req,
            data: {
              action: "POST",
              table: "e_estructura_articulo_corpo_puesto_entrega",
              operation: "create",
              data: {
                puesto_id: puestoId,
                corpo_id: null,
                marca: art.marca,
                serie: art.serie,
                fechaEntrega: fechaEntregaDb,
                nomencladorArticuloCP_id: art.numero_articulo,
              },
            },
          });
          entregaKeys.add(entregaKey);
          createdEntregas++;
        } else {
          skipped.push(
            `Entrega ya existente: puesto #${puestoId}, artículo #${art.numero_articulo}, marca «${art.marca}», serie «${art.serie}».`,
          );
        }
      }
    }

    return NextResponse.json(
      {
        status: true,
        message: `Se crearon ${createdPlans} plan(es) y ${createdEntregas} entrega(s).`,
        created_plans: createdPlans,
        created_entregas: createdEntregas,
        skipped,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in POST /api/mantenimiento-equipo/bulk-articulos:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}
