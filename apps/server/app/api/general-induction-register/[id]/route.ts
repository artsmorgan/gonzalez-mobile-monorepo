import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../utils/verifyToken";
import { prisma } from "../../../../utils/prismaClient";
import { toZonedTime } from "date-fns-tz";

function parseFechaInput(fecha: any): Date | undefined {
  if (!fecha) return undefined;
  if (fecha instanceof Date) return fecha;
  if (typeof fecha === "string") {
    if (fecha.includes("/")) {
      const parts = fecha.split("/");
      if (parts.length === 3) {
        const [dd, mm, yyyy] = parts;
        const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
        if (!Number.isNaN(d.getTime())) return d;
      }
    }
    const d = new Date(fecha);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return undefined;
}

function ensureStringJson(value: any, fallback: string) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, expired, payload, message } = verifyAccessToken(req);
    if (!valid) {
      return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });
    }

    const resolvedParams = await context.params;
    const idNum = parseInt(String(resolvedParams.id), 10);
    if (Number.isNaN(idNum) || idNum <= 0) {
      return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
    }

    const { division, fecha, temas_a_tratar, colaboradores, capacitadores, firma_responsable } = await req.json();

    const existing = await prisma.c_registro_induccion_general.findUnique({
      where: { id: idNum }
    });
    if (!existing) {
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
    }

    const fechaParsed = parseFechaInput(fecha);
    if (fecha !== undefined && fecha !== null && !fechaParsed) {
      return NextResponse.json({ status: false, message: "Fecha inválida" }, { status: 400 });
    }

    const updateData: any = {
      division: division !== undefined ? String(division).trim() : undefined,
      ...(fecha !== undefined ? (fechaParsed ? { fecha: fechaParsed } : {}) : {}),
      temas_a_tratar: temas_a_tratar !== undefined ? ensureStringJson(temas_a_tratar, "[]") : undefined,
      colaboradores: colaboradores !== undefined ? ensureStringJson(colaboradores, "[]") : undefined,
      capacitadores: capacitadores !== undefined ? ensureStringJson(capacitadores, "[]") : undefined,
      firma_responsable: firma_responsable !== undefined ? String(firma_responsable) : undefined,
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
      if (v === undefined) continue; // Solo procesar campos que se están actualizando
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

    const updated = await prisma.c_registro_induccion_general.update({
      where: { id: idNum },
      data: updateData,
      include: {
        e_estructura_empresa: { select: { nombre: true, codigo: true } },
        e_estructura_cliente: { select: { nombre: true } },
        e_estructura_sucursal: { select: { nombre: true, nro_sucursal: true } },
      },
    });

    if (cambiosArr.length > 0) {
      const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
      await prisma.c_cambios_apps_modules.create({
        data: {
          nombre_tabla: "c_registro_induccion_general",
          registro_id: idNum,
          cambios: JSON.stringify(cambiosArr),
          created_at: toZonedTime(new Date(), "America/Costa_Rica"),
          created_by: createdBy,
        },
      });
    }

    return NextResponse.json(
      {
        status: true,
        message: "Registro de inducción general actualizado correctamente",
        data: {
          ...updated,
          id_local: "",
          empresa_nombre: updated.e_estructura_empresa ? `${updated.e_estructura_empresa.codigo} - ${updated.e_estructura_empresa.nombre}` : null,
          cliente_nombre: updated.e_estructura_cliente?.nombre || null,
          corpo_nombre: updated.e_estructura_sucursal ? `${updated.e_estructura_sucursal.nro_sucursal} - ${updated.e_estructura_sucursal.nombre}` : null,
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error(errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, expired, payload, message } = verifyAccessToken(req);
    if (!valid) {
      return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });
    }

    const resolvedParams = await context.params;
    const idNum = parseInt(String(resolvedParams.id), 10);
    if (Number.isNaN(idNum) || idNum <= 0) {
      return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
    }

    const existing = await prisma.c_registro_induccion_general.findUnique({
      where: { id: idNum }
    });
    if (!existing) {
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
    }

    // Registrar cambio de eliminación antes de eliminar
    const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
    const createdAt = toZonedTime(new Date(), "America/Costa_Rica");
    await prisma.c_cambios_apps_modules.create({
      data: {
        nombre_tabla: "c_registro_induccion_general",
        registro_id: idNum,
        cambios: JSON.stringify([{
          prop: "__deleted__",
          before: {
            id: existing.id,
            empresa_id: existing.empresa_id,
            cliente_id: existing.cliente_id,
            corpo_id: existing.corpo_id,
            division: existing.division,
            fecha: existing.fecha ? existing.fecha.toISOString() : null,
            temas_a_tratar: existing.temas_a_tratar,
            colaboradores: existing.colaboradores,
            capacitadores: existing.capacitadores,
          },
          after: null,
        }]),
        created_at: createdAt,
        created_by: createdBy,
      },
    });

    await prisma.c_registro_induccion_general.delete({ where: { id: idNum } });

    return NextResponse.json({ status: true, message: "Registro de inducción general eliminado correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error(errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}


