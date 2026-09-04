import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { toZonedTime } from "date-fns-tz";
import { reportError } from "../../../../../utils/reportError";

export const runtime = "nodejs";

const normalizeHora = (raw?: any): string | null => {
  if (raw == null) return null;
  const v = String(raw).trim();
  if (!v) return null;
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(v)) {
    const parts = v.split(":");
    const hh = parts[0].padStart(2, "0");
    const mm = (parts[1] || "00").padStart(2, "0");
    const ss = (parts[2] || "00").padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }
  if (v.includes("T")) {
    const timePart = v.split("T")[1] || "";
    return timePart.substring(0, 8);
  }
  return null;
};

const toIsoSafe = (value: any): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value.trim()) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
};

const useToApiShape = (u: any) => {
  const inicioIso = toIsoSafe(u?.inicio || u?.hora_inicio);
  const finIso = toIsoSafe(u?.fin || u?.hora_fin);
  const fechaIso = toIsoSafe(u?.fecha || u?.fecha_inicio || inicioIso);
  const fechaInicioIso = toIsoSafe(u?.fecha_inicio || fechaIso);
  const fechaFinIso = toIsoSafe(u?.fecha_fin || fechaIso);
  return {
    ...u,
    fecha_inicio: fechaInicioIso,
    fecha_fin: fechaFinIso,
    hora_inicio: inicioIso,
    hora_fin: finIso,
  };
};

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ use_id: string }> }
) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

    const { use_id } = await context.params;
    const usoId = parseInt(String(use_id), 10);
    if (!usoId) {
      await reportError(req, "api/corporate-vehicles/uses/[use_id]", "GET", 400, "ID no especificado");
      return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 400 });
    }

    const uso = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_usos_vehiculos_corporativos",
        operation: "findUnique",
        where: { id: usoId },
      },
    });
    if (!uso) {
      await reportError(req, "api/corporate-vehicles/uses/[use_id]", "GET", 404, "Uso no encontrado");
      return NextResponse.json({ status: false, message: "Uso no encontrado" }, { status: 404 });
    }

    const usoObj = uso as any;
    // Adjuntar bitácora si existe
    let bitacora = null;
    if (usoObj.bitacora_id) {
      bitacora = await callDynamicPrisma({
        req,
        data: {
          action: "GET",
          table: "c_bitacora_vehiculo_detenido",
          operation: "findUnique",
          where: { id: usoObj.bitacora_id },
        },
      });
    }

    return NextResponse.json({
      status: true,
      data: {
        ...useToApiShape(usoObj),
        bitacora: bitacora,
      },
    }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in GET /api/corporate-vehicles/uses/[use_id]:", errorMessage);
    await reportError(req, "api/corporate-vehicles/uses/[use_id]", "GET", 500, errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ use_id: string }> }
) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

    const { use_id } = await context.params;
    const usoId = parseInt(String(use_id), 10);
    if (!usoId) {
      await reportError(req, "api/corporate-vehicles/uses/[use_id]", "PUT", 400, "ID no especificado");
      return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 400 });
    }

    const existing = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_usos_vehiculos_corporativos",
        operation: "findUnique",
        where: { id: usoId },
      },
    });
    if (!existing) {
      await reportError(req, "api/corporate-vehicles/uses/[use_id]", "PUT", 404, "Registro no encontrado");
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
    }
    const existingObj = existing as any;

    const body = await req.json();
    const {
      nombre_conductor,
      codigo_conductor,
      fecha,
      inicio,
      fin,
      fecha_inicio,
      fecha_fin,
      hora_inicio,
      hora_fin,
      combustible_inicio,
      combustible_fin,
      km_inicio,
      km_fin,
      motivo,
      firma_conductor,
      firma_responsable,
      // bitacora_id: ignorado por solicitud
    } = body || {};

    console.log('body', body);

    const fechaExisting = existingObj.fecha instanceof Date
      ? existingObj.fecha
      : (typeof existingObj.fecha === 'string' ? new Date(existingObj.fecha) : new Date());

    const horaInicioExisting = normalizeHora(existingObj.hora_inicio || existingObj.inicio);
    const horaFinExisting = normalizeHora(existingObj.hora_fin || existingObj.fin);
    const horaInicioNorm =
      hora_inicio !== undefined || inicio !== undefined
        ? normalizeHora(hora_inicio || inicio)
        : horaInicioExisting;
    const horaFinNorm =
      hora_fin !== undefined || fin !== undefined
        ? normalizeHora(hora_fin || fin)
        : horaFinExisting;

    const buildDateTimeFromFechaAndHora = (fechaBase: Date, horaNorm: string | null): Date => {
      const base = fechaBase instanceof Date ? new Date(fechaBase) : new Date(fechaBase || new Date());
      if (!horaNorm) return base;
      const [hh, mm, ss] = horaNorm.split(':');
      base.setHours(Number(hh) || 0, Number(mm) || 0, Number(ss) || 0, 0);
      return base;
    };

    const inicioExisting = buildDateTimeFromFechaAndHora(fechaExisting, horaInicioExisting);
    const finExisting = buildDateTimeFromFechaAndHora(fechaExisting, horaFinExisting);

    const fechaValue = fecha !== undefined
      ? (fecha ? new Date(fecha) : new Date())
      : (fecha_inicio !== undefined
          ? (fecha_inicio ? new Date(fecha_inicio) : new Date())
          : (fecha_fin !== undefined ? (fecha_fin ? new Date(fecha_fin) : new Date()) : fechaExisting));
    const inicioValue = fecha_inicio.split('T')[0] + 'T' + hora_inicio.split('T')[1];
    const finValue = fecha_fin.split('T')[0] + 'T' + hora_fin.split('T')[1];

    const updateData: any = {
      nombre_conductor: nombre_conductor !== undefined ? String(nombre_conductor ?? "") : existingObj.nombre_conductor,
      codigo_conductor: codigo_conductor !== undefined ? String(codigo_conductor ?? "") : existingObj.codigo_conductor,
      fecha: fechaValue,
      inicio: inicioValue,
      fin: finValue,
      combustible_inicio:
        combustible_inicio !== undefined ? String(combustible_inicio ?? "") : existingObj.combustible_inicio,
      combustible_fin: combustible_fin !== undefined ? String(combustible_fin ?? "") : existingObj.combustible_fin,
      km_inicio: km_inicio !== undefined ? Number(km_inicio ?? 0) : existingObj.km_inicio,
      km_fin: km_fin !== undefined ? Number(km_fin ?? 0) : existingObj.km_fin,
      motivo: motivo !== undefined ? String(motivo ?? "") : existingObj.motivo,
      firma_conductor:
        firma_conductor !== undefined
          ? (firma_conductor != null && String(firma_conductor).trim().length > 0
              ? String(firma_conductor).trim()
              : null)
          : existingObj.firma_conductor,
      firma_responsable:
        firma_responsable !== undefined ? String(firma_responsable ?? "") : existingObj.firma_responsable,
    };

    // Convertir fechas a ISO strings para callDynamicPrisma
    if (updateData.fecha instanceof Date) {
      updateData.fecha = updateData.fecha.toISOString();
    }
    if (updateData.inicio instanceof Date) {
      updateData.inicio = updateData.inicio.toISOString();
    }
    if (updateData.fin instanceof Date) {
      updateData.fin = updateData.fin.toISOString();
    }

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
    for (const [k, v] of Object.entries(updateData)) {
      if (k === "firma_responsable" || k === "firma_conductor") continue; // Excluir firmas

      const before = existingObj[k];
      const after = v;
      if (!eq(before, after)) {
        const beforeValue = before instanceof Date ? before.toISOString() : (typeof before === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(before) ? before : before);
        const afterValue = after instanceof Date ? after.toISOString() : (typeof after === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(after) ? after : after);
        cambiosArr.push({
          prop: k,
          before: beforeValue,
          after: afterValue,
        });
      }
    }

    const updated = await callDynamicPrisma({
      req,
      data: {
        action: "UPDATE",
        table: "c_usos_vehiculos_corporativos",
        operation: "update",
        where: { id: usoId },
        data: updateData,
      },
    });

    if (cambiosArr.length > 0) {
      const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
      await callDynamicPrisma({
        req,
        data: {
          action: "POST",
          table: "c_cambios_apps_modules",
          operation: "create",
          data: {
            nombre_tabla: "c_usos_vehiculos_corporativos",
            registro_id: usoId,
            cambios: JSON.stringify(cambiosArr),
            created_at: toZonedTime(new Date(), "America/Costa_Rica").toISOString(),
            created_by: createdBy,
          },
        },
      });
    }

    return NextResponse.json({ status: true, data: useToApiShape(updated) }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in PUT /api/corporate-vehicles/uses/[use_id]:", errorMessage);
    await reportError(req, "api/corporate-vehicles/uses/[use_id]", "PUT", 500, errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ use_id: string }> }
) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

    const { use_id } = await context.params;
    const usoId = parseInt(String(use_id), 10);
    if (!usoId) {
      await reportError(req, "api/corporate-vehicles/uses/[use_id]", "DELETE", 400, "ID no especificado");
      return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 400 });
    }

    const existing = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_usos_vehiculos_corporativos",
        operation: "findUnique",
        where: { id: usoId },
      },
    });
    if (!existing) {
      await reportError(req, "api/corporate-vehicles/uses/[use_id]", "DELETE", 404, "Registro no encontrado");
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
    }

    const existingObj = existing as any;
    // Registrar cambio de eliminación antes de eliminar
    const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
    const createdAt = toZonedTime(new Date(), "America/Costa_Rica");
    const fechaValue = existingObj.fecha instanceof Date ? existingObj.fecha.toISOString() : (typeof existingObj.fecha === 'string' ? existingObj.fecha : null);
    const inicioValue = existingObj.inicio instanceof Date
      ? existingObj.inicio.toISOString()
      : (typeof existingObj.inicio === 'string' ? existingObj.inicio : (typeof existingObj.hora_inicio === 'string' ? existingObj.hora_inicio : null));
    const finValue = existingObj.fin instanceof Date
      ? existingObj.fin.toISOString()
      : (typeof existingObj.fin === 'string' ? existingObj.fin : (typeof existingObj.hora_fin === 'string' ? existingObj.hora_fin : null));
    await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_cambios_apps_modules",
        operation: "create",
        data: {
          nombre_tabla: "c_usos_vehiculos_corporativos",
          registro_id: usoId,
          cambios: JSON.stringify([{
            prop: "__deleted__",
            before: {
              id: existingObj.id,
              vehiculo_id: existingObj.vehiculo_id,
              nombre_conductor: existingObj.nombre_conductor,
              codigo_conductor: existingObj.codigo_conductor,
              fecha: fechaValue,
              inicio: inicioValue,
              fin: finValue,
              combustible_inicio: existingObj.combustible_inicio,
              combustible_fin: existingObj.combustible_fin,
              km_inicio: existingObj.km_inicio,
              km_fin: existingObj.km_fin,
              motivo: existingObj.motivo,
              firma_conductor: existingObj.firma_conductor,
            },
            after: null,
          }]),
          created_at: createdAt.toISOString(),
          created_by: createdBy,
        },
      },
    });

    await callDynamicPrisma({
      req,
      data: {
        action: "DELETE",
        table: "c_usos_vehiculos_corporativos",
        operation: "delete",
        where: { id: usoId },
      },
    });

    return NextResponse.json({ status: true, message: "Uso eliminado correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in DELETE /api/corporate-vehicles/uses/[use_id]:", errorMessage);
    await reportError(req, "api/corporate-vehicles/uses/[use_id]", "DELETE", 500, errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}


