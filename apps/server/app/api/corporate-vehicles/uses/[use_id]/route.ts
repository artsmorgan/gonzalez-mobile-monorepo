import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { toZonedTime } from "date-fns-tz";

export const runtime = "nodejs";

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
        ...usoObj,
        bitacora: bitacora,
      },
    }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in GET /api/corporate-vehicles/uses/[use_id]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
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

    const fechaExisting = existingObj.fecha instanceof Date ? existingObj.fecha : (typeof existingObj.fecha === 'string' ? new Date(existingObj.fecha) : new Date());
    const inicioExisting = existingObj.inicio instanceof Date
      ? existingObj.inicio
      : (typeof existingObj.inicio === 'string'
          ? new Date(existingObj.inicio)
          : (typeof existingObj.hora_inicio === 'string' ? new Date(existingObj.hora_inicio) : new Date()));
    const finExisting = existingObj.fin instanceof Date
      ? existingObj.fin
      : (typeof existingObj.fin === 'string'
          ? new Date(existingObj.fin)
          : (typeof existingObj.hora_fin === 'string' ? new Date(existingObj.hora_fin) : new Date()));

    const updateData: any = {
      nombre_conductor: nombre_conductor !== undefined ? String(nombre_conductor ?? "") : existingObj.nombre_conductor,
      codigo_conductor: codigo_conductor !== undefined ? String(codigo_conductor ?? "") : existingObj.codigo_conductor,
      fecha: fecha !== undefined ? (fecha ? new Date(fecha) : new Date()) : fechaExisting,
      inicio: inicio !== undefined
        ? (inicio ? new Date(inicio) : new Date())
        : (hora_inicio !== undefined ? (hora_inicio ? new Date(hora_inicio) : new Date()) : inicioExisting),
      fin: fin !== undefined
        ? (fin ? new Date(fin) : new Date())
        : (hora_fin !== undefined ? (hora_fin ? new Date(hora_fin) : new Date()) : finExisting),
      combustible_inicio:
        combustible_inicio !== undefined ? String(combustible_inicio ?? "") : existingObj.combustible_inicio,
      combustible_fin: combustible_fin !== undefined ? String(combustible_fin ?? "") : existingObj.combustible_fin,
      km_inicio: km_inicio !== undefined ? Number(km_inicio ?? 0) : existingObj.km_inicio,
      km_fin: km_fin !== undefined ? Number(km_fin ?? 0) : existingObj.km_fin,
      motivo: motivo !== undefined ? String(motivo ?? "") : existingObj.motivo,
      firma_conductor:
        firma_conductor !== undefined ? String(firma_conductor ?? "") : existingObj.firma_conductor,
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

    return NextResponse.json({ status: true, data: updated }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in PUT /api/corporate-vehicles/uses/[use_id]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
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
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}


