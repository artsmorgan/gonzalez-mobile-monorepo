/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../utils/verifyToken";
import { prisma } from "../../../../utils/prismaClient";
import { toZonedTime } from "date-fns-tz";

function parseDateTime(value: any): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  if (isNaN(d.getTime())) return null;
  return d;
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

    const existing = await prisma.c_boleta_apreciacion_vulnerabilidad.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 200 });
    }

    const body = await req.json();
    const {
      cliente_id,
      corpo_id,
      puesto_id,
      fecha,
      enlace,
      nombre_solicitante,
      boleta,
      metricas_vulnerablidad,
      observaciones,
      firma_solicitante,
      firma_responsable,
    } = body ?? {};

    const fechaDate = fecha ? parseDateTime(fecha) : null;
    if (fecha && !fechaDate) {
      return NextResponse.json({ status: false, message: "Fecha inválida" }, { status: 200 });
    }

    // Validar IDs si vienen
    if (cliente_id) {
      const cliente = await prisma.e_estructura_cliente.findUnique({ where: { id: parseInt(String(cliente_id)) } });
      if (!cliente) return NextResponse.json({ status: false, message: "Cliente inválido" }, { status: 200 });
    }
    if (corpo_id) {
      const corpo = await prisma.e_estructura_sucursal.findUnique({ where: { id: parseInt(String(corpo_id)) } });
      if (!corpo) return NextResponse.json({ status: false, message: "Corpo inválido" }, { status: 200 });
    }
    if (puesto_id) {
      const puesto = await prisma.e_estructura_puesto.findUnique({ where: { id: parseInt(String(puesto_id)) } });
      if (!puesto) return NextResponse.json({ status: false, message: "Puesto inválido" }, { status: 200 });
    }

    const updateData: any = {
      cliente_id: cliente_id ? parseInt(String(cliente_id)) : existing.cliente_id,
      corpo_id: corpo_id ? parseInt(String(corpo_id)) : existing.corpo_id,
      puesto_id: puesto_id ? parseInt(String(puesto_id)) : existing.puesto_id,
      fecha: fechaDate ?? existing.fecha,
      enlace: typeof enlace === "string" ? enlace : existing.enlace,
      nombre_solicitante: typeof nombre_solicitante === "string" ? nombre_solicitante : existing.nombre_solicitante,
      boleta: typeof boleta === "string" ? boleta : existing.boleta,
      metricas_vulnerablidad:
        typeof metricas_vulnerablidad === "string" ? metricas_vulnerablidad : existing.metricas_vulnerablidad,
      observaciones: typeof observaciones === "string" ? observaciones : existing.observaciones,
      firma_solicitante: typeof firma_solicitante === "string" ? firma_solicitante : existing.firma_solicitante,
      firma_responsable: typeof firma_responsable === "string" ? firma_responsable : existing.firma_responsable,
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
      // Excluir firmas
      if (k === "firma_solicitante" || k === "firma_responsable") continue;

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

    await prisma.c_boleta_apreciacion_vulnerabilidad.update({
      where: { id },
      data: updateData,
    });

    // Registrar cambios si hay alguno
    if (cambiosArr.length > 0) {
      const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
      await prisma.c_cambios_apps_modules.create({
        data: {
          nombre_tabla: "c_boleta_apreciacion_vulnerabilidad",
          registro_id: id,
          cambios: JSON.stringify(cambiosArr),
          created_at: toZonedTime(new Date(), "America/Costa_Rica"),
          created_by: createdBy,
        },
      });
    }

    return NextResponse.json({ status: true, message: "Registro actualizado correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in PUT /api/apreciacion-vulnerabilidad/[id]:", errorMessage);
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

    const existing = await prisma.c_boleta_apreciacion_vulnerabilidad.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 200 });
    }

    // Registrar cambio de eliminación antes de eliminar
    const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
    const createdAt = toZonedTime(new Date(), "America/Costa_Rica");
    await prisma.c_cambios_apps_modules.create({
      data: {
        nombre_tabla: "c_boleta_apreciacion_vulnerabilidad",
        registro_id: id,
        cambios: JSON.stringify([{
          prop: "__deleted__",
          before: {
            id: existing.id,
            cliente_id: existing.cliente_id,
            corpo_id: existing.corpo_id,
            puesto_id: existing.puesto_id,
            fecha: existing.fecha.toISOString(),
            enlace: existing.enlace,
            nombre_solicitante: existing.nombre_solicitante,
            boleta: existing.boleta,
            metricas_vulnerablidad: existing.metricas_vulnerablidad,
            observaciones: existing.observaciones,
          },
          after: null,
        }]),
        created_at: createdAt,
        created_by: createdBy,
      },
    });

    await prisma.c_boleta_apreciacion_vulnerabilidad.delete({ where: { id } });
    return NextResponse.json({ status: true, message: "Registro eliminado correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in DELETE /api/apreciacion-vulnerabilidad/[id]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}


