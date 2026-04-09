/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../../../utils/callDynamicPrisma";

function parseDateOnly(value: any): Date | null {
  if (!value) return null;
  const s = String(value);
  const d = s.includes("T") ? new Date(s) : new Date(`${s}T00:00:00`);
  if (isNaN(d.getTime())) return null;
  return d;
}

function parseTimeOnly(value: any): Date | null {
  if (!value) return null;
  const s = String(value).trim();
  if (s.includes("T")) return new Date(s);
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const hh = Math.min(23, Math.max(0, Number(m[1])));
  const mm = Math.min(59, Math.max(0, Number(m[2])));
  const ss = m[3] != null ? Math.min(59, Math.max(0, Number(m[3]))) : 0;
  return new Date(Date.UTC(1970, 0, 1, hh, mm, ss, 0));
}

async function getMarcaDiaOrFail(req: NextRequest, marcaId: number) {
  const marcaDia = await callDynamicPrisma({
    req,
    data: { action: "GET", table: "c_marca_dia", operation: "findUnique", where: { id: marcaId } }
  });
  if (!marcaDia) return { ok: false as const, marcaDia: null, message: "Marca no encontrada" };
  if (!marcaDia.empleadoFijo_id) return { ok: false as const, marcaDia: null, message: "Empleado no encontrado" };

  const lastMarca = await callDynamicPrisma({
    req,
    data: {
      action: "GET",
      table: "c_marca_dia",
      operation: "findFirst",
      where: { empleadoFijo_id: marcaDia.empleadoFijo_id },
      orderBy: [{ fecha: "desc" }, { hora_inicio: "desc" }]
    }
  });
  if (!lastMarca) return { ok: false as const, marcaDia: null, message: "No se encontró la última marca" };
  return { ok: true as const, marcaDia, message: "" };
}

async function validateOwnership(req: NextRequest, planId: number, movId: number, marcaId: number) {
  const marcaRes = await getMarcaDiaOrFail(req, marcaId);
  if (!marcaRes.ok) return { ok: false as const, plan: null, mov: null, message: marcaRes.message };
  const marcaDia = marcaRes.marcaDia!;

  const plan = await callDynamicPrisma({
    req,
    data: { action: "GET", table: "e_estructura_articulo_corpo_puesto_plan", operation: "findUnique", where: { id: planId } }
  });
  if (!plan) return { ok: false as const, plan: null, mov: null, message: "Artículo plan no encontrado" };

  if (plan.puesto_id && marcaDia.puesto_id && plan.puesto_id !== marcaDia.puesto_id) {
    return { ok: false as const, plan: null, mov: null, message: "No autorizado" };
  }
  if (plan.corpo_id && marcaDia.corpo_id && plan.corpo_id !== marcaDia.corpo_id) {
    return { ok: false as const, plan: null, mov: null, message: "No autorizado" };
  }

  const mov = await callDynamicPrisma({
    req,
    data: { action: "GET", table: "c_movimientos_articulo_mantenimiento", operation: "findUnique", where: { id: movId } }
  });
  if (!mov || mov.articulo_plan_id !== planId) return { ok: false as const, plan: null, mov: null, message: "Movimiento no encontrado" };

  return { ok: true as const, plan, mov, message: "" };
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string; movId: string }> }) {
  try {
    const { valid, expired, message, payload } = await verifyAccessTokenByApi(req);
    if (!valid) return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });

    const resolvedParams = await context.params;
    const planId = parseInt(resolvedParams.id);
    const movId = parseInt(resolvedParams.movId);
    if (!planId || !movId) return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });

    const body = await req.json();
    const {
      marca_id,
      nombre_persona_recibe,
      nombre_persona_entrega,
      departamento,
      telefono,
      entrega,
      recibe,
      fecha,
      hora,
      firma_entrega,
      firma_recibe,
      firma_responsable,
    } = body ?? {};

    if (!marca_id) return NextResponse.json({ status: false, message: "Marca no especificada" }, { status: 200 });

    const own = await validateOwnership(req, planId, movId, parseInt(String(marca_id)));
    if (!own.ok) return NextResponse.json({ status: false, message: own.message }, { status: 200 });

    const fechaDate = fecha ? parseDateOnly(fecha) : null;
    const horaDate = hora ? parseTimeOnly(hora) : null;
    if ((fecha && !fechaDate) || (hora && !horaDate)) return NextResponse.json({ status: false, message: "Fecha u hora inválida" }, { status: 200 });

    const updateData: any = {
      nombre_persona_recibe: typeof nombre_persona_recibe === "string" ? nombre_persona_recibe : own.mov!.nombre_persona_recibe,
      nombre_persona_entrega: typeof nombre_persona_entrega === "string" ? nombre_persona_entrega : own.mov!.nombre_persona_entrega,
      departamento: typeof departamento === "string" ? departamento : own.mov!.departamento,
      telefono: typeof telefono === "string" ? telefono : own.mov!.telefono,
      entrega: typeof entrega === "string" ? entrega : own.mov!.entrega,
      recibe: typeof recibe === "string" ? recibe : own.mov!.recibe,
      fecha: fechaDate ?? own.mov!.fecha,
      hora: horaDate ?? own.mov!.hora,
      firma_entrega: typeof firma_entrega === "string" ? firma_entrega : own.mov!.firma_entrega,
      firma_recibe: typeof firma_recibe === "string" ? firma_recibe : own.mov!.firma_recibe,
      firma_responsable: typeof firma_responsable === "string" ? firma_responsable : own.mov!.firma_responsable,
    };

    // Convertir fechas a ISO strings para la API dinámica
    const updateDataForApi: any = {};
    for (const [k, v] of Object.entries(updateData)) {
      if (v instanceof Date) {
        updateDataForApi[k] = v.toISOString();
      } else {
        updateDataForApi[k] = v;
      }
    }

    await callDynamicPrisma({
      req,
      data: {
        action: "UPDATE",
        table: "c_movimientos_articulo_mantenimiento",
        where: { id: movId },
        data: updateDataForApi
      }
    });

    const cambiosArr: Array<{ prop: string; before: any; after: any }> = [];
    for (const [k, v] of Object.entries(updateData)) {
      const before = (own.mov as any)[k];
      const after = v;
      const beforeNorm = before instanceof Date ? before.toISOString() : before;
      const afterNorm = after instanceof Date ? after.toISOString() : after;
      if (beforeNorm !== afterNorm) cambiosArr.push({ prop: k, before: beforeNorm, after: afterNorm });
    }

    if (cambiosArr.length > 0) {
      const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
      await callDynamicPrisma({
        req,
        data: {
          action: "POST",
          table: "c_cambios_apps_modules",
          data: {
            nombre_tabla: "c_movimientos_articulo_mantenimiento",
            registro_id: movId,
            cambios: JSON.stringify(cambiosArr),
            created_at: new Date().toISOString(),
            created_by: createdBy,
          }
        }
      });
    }

    return NextResponse.json({ status: true, message: "Movimiento actualizado correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in PUT /api/articulo-mantenimiento/plan/[id]/movimientos/[movId]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string; movId: string }> }) {
  try {
    const { valid, expired, message, payload } = await verifyAccessTokenByApi(req);
    if (!valid) return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });

    const resolvedParams = await context.params;
    const planId = parseInt(resolvedParams.id);
    const movId = parseInt(resolvedParams.movId);
    if (!planId || !movId) return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });

    const marcaIdStr = req.nextUrl.searchParams.get("m");
    if (!marcaIdStr) return NextResponse.json({ status: false, message: "Marca no especificada" }, { status: 200 });

    const own = await validateOwnership(req, planId, movId, parseInt(marcaIdStr));
    if (!own.ok) return NextResponse.json({ status: false, message: own.message }, { status: 200 });

    const before = own.mov;
    await callDynamicPrisma({
      req,
      data: { action: "DELETE", table: "c_movimientos_articulo_mantenimiento", where: { id: movId } }
    });

    const beforeLimited = before
      ? {
        id: before.id,
        articulo_plan_id: before.articulo_plan_id,
        articulo_asignado_id: before.articulo_asignado_id,
        nombre_persona_recibe: before.nombre_persona_recibe,
        nombre_persona_entrega: before.nombre_persona_entrega,
        departamento: before.departamento,
        telefono: before.telefono,
        entrega: before.entrega,
        recibe: before.recibe,
        fecha: before.fecha instanceof Date ? before.fecha.toISOString() : before.fecha,
        hora: before.hora instanceof Date ? before.hora.toISOString() : before.hora,
        firma_entrega: before.firma_entrega,
        firma_recibe: before.firma_recibe,
        firma_responsable: before.firma_responsable,
      }
      : null;

    const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
    await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_cambios_apps_modules",
        data: {
          nombre_tabla: "c_movimientos_articulo_mantenimiento",
          registro_id: movId,
          cambios: JSON.stringify([{ prop: "__deleted__", before: beforeLimited, after: null }]),
          created_at: new Date().toISOString(),
          created_by: createdBy,
        }
      }
    });
    return NextResponse.json({ status: true, message: "Movimiento eliminado correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in DELETE /api/articulo-mantenimiento/plan/[id]/movimientos/[movId]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}


