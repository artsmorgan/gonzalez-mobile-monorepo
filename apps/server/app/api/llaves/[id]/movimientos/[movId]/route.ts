/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../../utils/callDynamicPrisma";
import { toZonedTime } from "date-fns-tz";

function parseDateOnly(value: any): Date | null {
  if (!value) return null;
  const s = String(value);
  const d = s.includes("T") ? new Date(s) : new Date(`${s}T00:00:00`);
  if (isNaN(d.getTime())) return null;
  return d;
}

function parseTimeOnly(value: any): Date | null {
  if (!value) return null;
  const s = String(value);
  const d = s.includes("T") ? new Date(s) : new Date(`1970-01-01T${s}`);
  if (isNaN(d.getTime())) return null;
  return d;
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

async function validateOwnership(req: NextRequest, llaveId: number, movId: number, marcaId: number) {
  const marcaRes = await getMarcaDiaOrFail(req, marcaId);
  if (!marcaRes.ok) return { ok: false as const, marcaDia: null, llave: null, mov: null, message: marcaRes.message };
  const marcaDia = marcaRes.marcaDia!;

  const llave = await callDynamicPrisma({
    req,
    data: { action: "GET", table: "e_llave", operation: "findUnique", where: { id: llaveId } }
  });
  if (!llave) return { ok: false as const, marcaDia: null, llave: null, mov: null, message: "Llave no encontrada" };
  if (llave.cliente_id !== marcaDia.cliente_id) {
    return { ok: false as const, marcaDia: null, llave: null, mov: null, message: "No autorizado" };
  }

  const mov = await callDynamicPrisma({
    req,
    data: { action: "GET", table: "e_movimiento_llave", operation: "findUnique", where: { id: movId } }
  });
  if (!mov || mov.llave_id !== llaveId) {
    return { ok: false as const, marcaDia: null, llave: null, mov: null, message: "Movimiento no encontrado" };
  }

  return { ok: true as const, marcaDia, llave, mov, message: "" };
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string; movId: string }> }) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });

    const resolvedParams = await context.params;
    const llaveId = parseInt(resolvedParams.id);
    const movId = parseInt(resolvedParams.movId);
    if (!llaveId || !movId) return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });

    const body = await req.json();
    const {
      marca_id,
      nombre_persona_recibe,
      nombre_persona_entrega,
      departamento,
      telefono,
      fecha,
      hora,
      firma_entrega,
      firma_recibe,
      firma_responsable,
    } = body ?? {};

    if (!marca_id) return NextResponse.json({ status: false, message: "Marca no especificada" }, { status: 200 });

    const own = await validateOwnership(req, llaveId, movId, parseInt(String(marca_id)));
    if (!own.ok) return NextResponse.json({ status: false, message: own.message }, { status: 200 });

    const fechaDate = fecha ? parseDateOnly(fecha) : null;
    const horaDate = hora ? parseTimeOnly(hora) : null;
    if ((fecha && !fechaDate) || (hora && !horaDate)) {
      return NextResponse.json({ status: false, message: "Fecha u hora inválida" }, { status: 200 });
    }

    const horaRaw = hora !== undefined ? String(hora ?? "").trim() : null;
    const horaNormalized = '1970-01-01T' + horaRaw + '.000Z';

    console.log('horaNormalized', horaNormalized);

    // Registrar cambios (solo campos actualizados, excluyendo firmas)
    const eq = (a: any, b: any) => {
      if (a === b) return true;
      if (a == null && b == null) return true;
      const da = a instanceof Date ? a : (typeof a === "string" && /^\d{4}-\d{2}-\d{2}T/.test(a) ? new Date(a) : null);
      const db = b instanceof Date ? b : (typeof b === "string" && /^\d{4}-\d{2}-\d{2}T/.test(b) ? new Date(b) : null);
      if (da && db) return da.getTime() === db.getTime();
      return false;
    };

    const cambiosArr: Array<{ prop: string; before: any; after: any }> = [];
    const updateData: any = {
      nombre_persona_recibe: typeof nombre_persona_recibe === "string" ? nombre_persona_recibe : own.mov!.nombre_persona_recibe,
      nombre_persona_entrega: typeof nombre_persona_entrega === "string" ? nombre_persona_entrega : own.mov!.nombre_persona_entrega,
      departamento: typeof departamento === "string" ? departamento : own.mov!.departamento,
      telefono: typeof telefono === "string" ? telefono : own.mov!.telefono,
      fecha: fechaDate ?? own.mov!.fecha,
      // si viene hora en el body, guardamos solo HH:mm:ss como string; si no, dejamos la anterior
      hora: horaNormalized !== null ? horaNormalized : own.mov!.hora,
      firma_entrega:
        firma_entrega !== undefined
          ? (firma_entrega != null && String(firma_entrega).trim().length > 0
              ? String(firma_entrega).trim()
              : null)
          : own.mov!.firma_entrega,
      firma_recibe:
        firma_recibe !== undefined
          ? (firma_recibe != null && String(firma_recibe).trim().length > 0
              ? String(firma_recibe).trim()
              : null)
          : own.mov!.firma_recibe,
      firma_responsable: typeof firma_responsable === "string" ? firma_responsable : own.mov!.firma_responsable,
    };

    // Comparar cambios (incluir firmas)
    for (const [k, v] of Object.entries(updateData)) {
      const before = (own.mov as any)[k];
      const after = v;
      if (!eq(before, after)) {
        cambiosArr.push({
          prop: k,
          before: before instanceof Date ? before.toISOString() : before,
          after: after instanceof Date ? after.toISOString() : after,
        });
      }
    }

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
        table: "e_movimiento_llave",
        where: { id: movId },
        data: updateDataForApi
      }
    });

    // Registrar cambios si hay alguno
    if (cambiosArr.length > 0) {
      const createdBy = parseInt(String((payload as any)?.id ?? 0)) || 0;
      const createdAt = toZonedTime(new Date(), "America/Costa_Rica") as Date;
      await callDynamicPrisma({
        req,
        data: {
          action: "POST",
          table: "c_cambios_apps_modules",
          data: {
            nombre_tabla: "e_movimiento_llave",
            registro_id: movId,
            cambios: JSON.stringify(cambiosArr),
            created_at: createdAt.toISOString(),
            created_by: createdBy,
          }
        }
      });
    }

    return NextResponse.json({ status: true, message: "Movimiento actualizado correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in PUT /api/llaves/[id]/movimientos/[movId]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string; movId: string }> }) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });

    const resolvedParams = await context.params;
    const llaveId = parseInt(resolvedParams.id);
    const movId = parseInt(resolvedParams.movId);
    if (!llaveId || !movId) return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });

    const marcaIdStr = req.nextUrl.searchParams.get("m");
    if (!marcaIdStr) return NextResponse.json({ status: false, message: "Marca no especificada" }, { status: 200 });

    const own = await validateOwnership(req, llaveId, movId, parseInt(marcaIdStr));
    if (!own.ok) return NextResponse.json({ status: false, message: own.message }, { status: 200 });

    // Registrar cambio de eliminación antes de eliminar
    const createdBy = parseInt(String((payload as any)?.id ?? 0)) || 0;
    const createdAt = toZonedTime(new Date(), "America/Costa_Rica") as Date;
    const fechaMov = own.mov!.fecha instanceof Date ? own.mov!.fecha.toISOString() : own.mov!.fecha;
    const horaMov = own.mov!.hora instanceof Date ? own.mov!.hora.toISOString() : own.mov!.hora;
    await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_cambios_apps_modules",
        data: {
          nombre_tabla: "e_movimiento_llave",
          registro_id: movId,
          cambios: JSON.stringify([{
            prop: "__deleted__",
            before: {
              id: own.mov!.id,
              llave_id: own.mov!.llave_id,
              nombre_persona_recibe: own.mov!.nombre_persona_recibe,
              nombre_persona_entrega: own.mov!.nombre_persona_entrega,
              departamento: own.mov!.departamento,
              telefono: own.mov!.telefono,
              fecha: fechaMov,
              hora: horaMov,
            },
            after: null,
          }]),
          created_at: createdAt.toISOString(),
          created_by: createdBy,
        }
      }
    });

    await callDynamicPrisma({
      req,
      data: { action: "DELETE", table: "e_movimiento_llave", where: { id: movId } }
    });
    return NextResponse.json({ status: true, message: "Movimiento eliminado correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in DELETE /api/llaves/[id]/movimientos/[movId]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}


