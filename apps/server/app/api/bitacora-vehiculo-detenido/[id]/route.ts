/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../utils/verifyToken";
import { prisma } from "../../../../utils/prismaClient";
import { toZonedTime } from "date-fns-tz";

function normalizeToStringifiedJson(value: any): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value ?? []);
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, expired, payload, message } = verifyAccessToken(req);
    if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams.id);
    if (!id) {
      return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });
    }

    const existing = await prisma.c_bitacora_vehiculo_detenido.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 200 });
    }

    const body = await req.json();
    const {
      tipo,
      vehiculo_id,
      uso_id,
      informacion_general,
      informacion_revision,
      movimientos_vehiculos,
      observaciones,
      firma_responsable,
    } = body ?? {};

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
      tipo: typeof tipo === "string" ? tipo : existing.tipo,
      vehiculo_id: vehiculo_id !== undefined ? (vehiculo_id ? Number(vehiculo_id) : null) : existing.vehiculo_id ?? null,
      uso_id: uso_id !== undefined ? (uso_id ? Number(uso_id) : null) : existing.uso_id ?? null,
      informacion_general: informacion_general !== undefined ? normalizeToStringifiedJson(informacion_general) : existing.informacion_general,
      informacion_revision: informacion_revision !== undefined ? normalizeToStringifiedJson(informacion_revision) : existing.informacion_revision,
      movimientos_vehiculos: movimientos_vehiculos !== undefined ? normalizeToStringifiedJson(movimientos_vehiculos) : existing.movimientos_vehiculos,
      observaciones: typeof observaciones === "string" ? observaciones : existing.observaciones,
      firma_responsable: typeof firma_responsable === "string" ? firma_responsable : existing.firma_responsable,
      created_at: existing.created_at ?? (toZonedTime(new Date(), "America/Costa_Rica") as Date),
      created_by: existing.created_by ?? (parseInt(String((payload as any)?.id ?? 0)) || 0),
    };

    // Comparar cambios (excluir firma_responsable)
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

    const updated = await prisma.c_bitacora_vehiculo_detenido.update({
      where: { id },
      data: updateData,
    });

    if (cambiosArr.length > 0) {
      const createdBy = parseInt(String((payload as any)?.id ?? 0)) || 0;
      await prisma.c_cambios_apps_modules.create({
        data: {
          nombre_tabla: "c_bitacora_vehiculo_detenido",
          registro_id: id,
          cambios: JSON.stringify(cambiosArr),
          created_at: toZonedTime(new Date(), "America/Costa_Rica"),
          created_by: createdBy,
        },
      });
    }

    // Si se setea `uso_id`, actualizamos el uso con `bitacora_id`
    if (uso_id) {
      try {
        await prisma.c_usos_vehiculos_corporativos.update({
          where: { id: Number(uso_id) },
          data: { bitacora_id: id },
        });
      } catch {
        // ignore
      }
    }

    return NextResponse.json({ status: true, message: "Bitácora actualizada correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in PUT /api/bitacora-vehiculo-detenido/[id]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, expired, payload, message } = verifyAccessToken(req);
    if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams.id);
    if (!id) {
      return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });
    }

    const existing = await prisma.c_bitacora_vehiculo_detenido.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 200 });
    }

    await prisma.c_bitacora_vehiculo_detenido.delete({ where: { id } });

    // Registrar cambio de eliminación
    const createdBy = parseInt(String((payload as any)?.id ?? 0)) || 0;
    await prisma.c_cambios_apps_modules.create({
      data: {
        nombre_tabla: "c_bitacora_vehiculo_detenido",
        registro_id: id,
        cambios: JSON.stringify([{
          prop: "__deleted__",
          before: {
            id: existing.id,
            tipo: existing.tipo,
            observaciones: existing.observaciones,
          },
          after: null,
        }]),
        created_at: toZonedTime(new Date(), "America/Costa_Rica"),
        created_by: createdBy,
      },
    });

    return NextResponse.json({ status: true, message: "Bitácora eliminada correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in DELETE /api/bitacora-vehiculo-detenido/[id]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}


