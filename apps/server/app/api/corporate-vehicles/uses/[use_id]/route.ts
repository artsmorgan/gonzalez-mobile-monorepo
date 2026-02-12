import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../../utils/verifyToken";
import { prisma } from "../../../../../utils/prismaClient";
import { toZonedTime } from "date-fns-tz";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ use_id: string }> }
) {
  try {
    const { valid, expired, payload, message } = verifyAccessToken(req);
    if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

    const { use_id } = await context.params;
    const usoId = parseInt(String(use_id), 10);
    if (!usoId) {
      return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 400 });
    }

    const uso = await prisma.c_usos_vehiculos_corporativos.findUnique({ where: { id: usoId } });
    if (!uso) {
      return NextResponse.json({ status: false, message: "Uso no encontrado" }, { status: 404 });
    }

    // Adjuntar bitácora si existe
    let bitacora = null;
    if (uso.bitacora_id) {
      bitacora = await prisma.c_bitacora_vehiculo_detenido.findUnique({ where: { id: uso.bitacora_id } });
    }

    return NextResponse.json({
      status: true,
      data: {
        ...uso,
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
    const { valid, expired, payload, message } = verifyAccessToken(req);
    if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

    const { use_id } = await context.params;
    const usoId = parseInt(String(use_id), 10);
    if (!usoId) {
      return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 400 });
    }

    const existing = await prisma.c_usos_vehiculos_corporativos.findUnique({ where: { id: usoId } });
    if (!existing) {
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
    }

    const body = await req.json();
    const {
      nombre_conductor,
      fecha,
      hora_inicio,
      hora_fin,
      combustible_inicio,
      combustible_fin,
      km_inicio,
      km_fin,
      motivo,
      firma_responsable,
      // bitacora_id: ignorado por solicitud
    } = body || {};

    const updateData: any = {
      nombre_conductor: nombre_conductor !== undefined ? String(nombre_conductor ?? "") : existing.nombre_conductor,
      fecha: fecha !== undefined ? (fecha ? new Date(fecha) : new Date()) : existing.fecha,
      hora_inicio: hora_inicio !== undefined ? (hora_inicio ? new Date(hora_inicio) : new Date()) : existing.hora_inicio,
      hora_fin: hora_fin !== undefined ? (hora_fin ? new Date(hora_fin) : new Date()) : existing.hora_fin,
      combustible_inicio:
        combustible_inicio !== undefined ? Number(combustible_inicio ?? 0) : existing.combustible_inicio,
      combustible_fin: combustible_fin !== undefined ? Number(combustible_fin ?? 0) : existing.combustible_fin,
      km_inicio: km_inicio !== undefined ? Number(km_inicio ?? 0) : existing.km_inicio,
      km_fin: km_fin !== undefined ? Number(km_fin ?? 0) : existing.km_fin,
      motivo: motivo !== undefined ? String(motivo ?? "") : existing.motivo,
      firma_responsable:
        firma_responsable !== undefined ? String(firma_responsable ?? "") : existing.firma_responsable,
    };

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
      if (k === "firma_responsable") continue; // Excluir firmas

      const before = (existing as any)[k];
      const after = v;
      if (!eq(before, after)) {
        cambiosArr.push({
          prop: k,
          before: before instanceof Date ? before.toISOString() : before,
          after: after instanceof Date ? after.toISOString() : after,
        });
      }
    }

    const updated = await prisma.c_usos_vehiculos_corporativos.update({
      where: { id: usoId },
      data: updateData,
    });

    if (cambiosArr.length > 0) {
      const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
      await prisma.c_cambios_apps_modules.create({
        data: {
          nombre_tabla: "c_usos_vehiculos_corporativos",
          registro_id: usoId,
          cambios: JSON.stringify(cambiosArr),
          created_at: toZonedTime(new Date(), "America/Costa_Rica"),
          created_by: createdBy,
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
    const { valid, expired, payload, message } = verifyAccessToken(req);
    if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

    const { use_id } = await context.params;
    const usoId = parseInt(String(use_id), 10);
    if (!usoId) {
      return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 400 });
    }

    const existing = await prisma.c_usos_vehiculos_corporativos.findUnique({ where: { id: usoId } });
    if (!existing) {
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
    }

    // Registrar cambio de eliminación antes de eliminar
    const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
    const createdAt = toZonedTime(new Date(), "America/Costa_Rica");
    await prisma.c_cambios_apps_modules.create({
      data: {
        nombre_tabla: "c_usos_vehiculos_corporativos",
        registro_id: usoId,
        cambios: JSON.stringify([{
          prop: "__deleted__",
          before: {
            id: existing.id,
            vehiculo_id: existing.vehiculo_id,
            nombre_conductor: existing.nombre_conductor,
            fecha: existing.fecha.toISOString(),
            hora_inicio: existing.hora_inicio.toISOString(),
            hora_fin: existing.hora_fin.toISOString(),
            combustible_inicio: existing.combustible_inicio,
            combustible_fin: existing.combustible_fin,
            km_inicio: existing.km_inicio,
            km_fin: existing.km_fin,
            motivo: existing.motivo,
          },
          after: null,
        }]),
        created_at: createdAt,
        created_by: createdBy,
      },
    });

    await prisma.c_usos_vehiculos_corporativos.delete({ where: { id: usoId } });

    return NextResponse.json({ status: true, message: "Uso eliminado correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in DELETE /api/corporate-vehicles/uses/[use_id]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}


