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
    if (!valid) return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });

    const resolvedParams = await context.params;
    const idNum = parseInt(String(resolvedParams.id), 10);
    if (Number.isNaN(idNum) || idNum <= 0) {
      return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
    }

    const existing = await prisma.e_mutuos_acuerdos.findUnique({ where: { id: idNum } });
    if (!existing) {
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
    }

    const body = await req.json();
    const data: any = {};

    if (body.cliente_id !== undefined) {
      const n = parseInt(String(body.cliente_id), 10);
      if (Number.isNaN(n) || n <= 0) return NextResponse.json({ status: false, message: "cliente_id inválido" }, { status: 400 });
      data.cliente_id = n;
    }
    if (body.corpo_id !== undefined) {
      const n = parseInt(String(body.corpo_id), 10);
      if (Number.isNaN(n) || n <= 0) return NextResponse.json({ status: false, message: "corpo_id inválido" }, { status: 400 });
      data.corpo_id = n;
    }
    if (body.ejecutivo_cuenta !== undefined) {
      const n = parseInt(String(body.ejecutivo_cuenta), 10);
      if (Number.isNaN(n) || n <= 0) return NextResponse.json({ status: false, message: "ejecutivo_cuenta inválido" }, { status: 400 });
      data.ejecutivo_cuenta = n;
    }
    if (body.fecha !== undefined) {
      const d = parseFechaInput(body.fecha);
      if (!d) return NextResponse.json({ status: false, message: "Fecha inválida" }, { status: 400 });
      data.fecha = d;
    }
    if (body.turno !== undefined) data.turno = String(body.turno).trim();
    if (body.informacion_oficial_interesado !== undefined) data.informacion_oficial_interesado = ensureStringJson(body.informacion_oficial_interesado, "[]");
    if (body.informacion_oficial_colaborador !== undefined) data.informacion_oficial_colaborador = ensureStringJson(body.informacion_oficial_colaborador, "[]");
    if (body.motivo !== undefined) data.motivo = String(body.motivo);
    if (body.firma_responsable !== undefined) data.firma_responsable = String(body.firma_responsable);

    // Nota: firma_ejecutivo_cuenta se actualiza en endpoint dedicado con validación owned
    if (body.firma_ejecutivo_cuenta !== undefined) {
      return NextResponse.json(
        { status: false, message: "Use el endpoint de firma de ejecutivo para modificar firma_ejecutivo_cuenta" },
        { status: 400 }
      );
    }

    // Registrar cambios (solo campos actualizados)
    const eq = (a: any, b: any) => {
      if (a === b) return true;
      if (a == null && b == null) return true;
      const da = a instanceof Date ? a : (typeof a === "string" && /^\d{4}-\d{2}-\d{2}T/.test(a) ? new Date(a) : null);
      const db = b instanceof Date ? b : (typeof b === "string" && /^\d{4}-\d{2}-\d{2}T/.test(b) ? new Date(b) : null);
      if (da && db) return da.getTime() === db.getTime();
      return false;
    };

    const cambiosArr: Array<{ prop: string; before: any; after: any }> = [];
    for (const [k, v] of Object.entries(data)) {
      // No registramos firmas: esas se guardan aparte y no son "datos escritos"
      if (k === "firma_responsable" || k === "firma_ejecutivo_cuenta") continue;

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

    const updated = await prisma.e_mutuos_acuerdos.update({
      where: { id: idNum },
      data,
      include: {
        e_estructura_cliente: { select: { nombre: true } },
        e_estructura_sucursal: { select: { nombre: true, nro_sucursal: true } },
        n_ejecutivo_cuenta: { select: { id: true, nombre: true } },
      },
    });

    if (cambiosArr.length > 0) {
      const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
      await prisma.c_cambios_apps_modules.create({
        data: {
          nombre_tabla: "e_mutuos_acuerdos",
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
        message: "Mutuo acuerdo actualizado correctamente",
        data: {
          ...updated,
          id_local: "",
          cliente_nombre: (updated as any).e_estructura_cliente?.nombre || null,
          corpo_nombre: (updated as any).e_estructura_sucursal
            ? `${(updated as any).e_estructura_sucursal.nro_sucursal ? `${(updated as any).e_estructura_sucursal.nro_sucursal} - ` : ""}${(updated as any).e_estructura_sucursal.nombre}`
            : null,
          ejecutivo_nombre: (updated as any).n_ejecutivo_cuenta?.nombre || null,
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
    if (!valid) return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });

    const resolvedParams = await context.params;
    const idNum = parseInt(String(resolvedParams.id), 10);
    if (Number.isNaN(idNum) || idNum <= 0) {
      return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
    }

    const existing = await prisma.e_mutuos_acuerdos.findUnique({ where: { id: idNum } });
    if (!existing) {
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
    }

    await prisma.e_mutuos_acuerdos.delete({ where: { id: idNum } });

    // Registrar cambio de eliminación
    const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
    await prisma.c_cambios_apps_modules.create({
      data: {
        nombre_tabla: "e_mutuos_acuerdos",
        registro_id: idNum,
        cambios: JSON.stringify([{
          prop: "__deleted__",
          before: {
            id: existing.id,
            fecha: existing.fecha.toISOString(),
            turno: existing.turno,
            motivo: existing.motivo,
          },
          after: null,
        }]),
        created_at: toZonedTime(new Date(), "America/Costa_Rica"),
        created_by: createdBy,
      },
    });

    return NextResponse.json({ status: true, message: "Mutuo acuerdo eliminado correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error(errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}


