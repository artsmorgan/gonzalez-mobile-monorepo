import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../utils/verifyToken";
import { prisma } from "../../../../utils/prismaClient";

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

function parseTimeInput(time: any): Date | undefined {
  if (!time) return undefined;
  if (time instanceof Date) return time;
  if (typeof time === "string") {
    const m = time.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return undefined;
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    if (Number.isNaN(hh) || Number.isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return undefined;
    return new Date(1970, 0, 1, hh, mm, 0, 0);
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

    const body = await req.json();
    const existingRecord = await prisma.c_agenda_minuta.findUnique({ where: { id: idNum } });
    if (!existingRecord) {
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
    }

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
    if (body.puesto_id !== undefined) {
      const n = parseInt(String(body.puesto_id), 10);
      if (Number.isNaN(n) || n <= 0) return NextResponse.json({ status: false, message: "puesto_id inválido" }, { status: 400 });
      data.puesto_id = n;
    }
    if (body.numero !== undefined) {
      const n = parseInt(String(body.numero), 10);
      if (Number.isNaN(n) || n <= 0) return NextResponse.json({ status: false, message: "numero inválido" }, { status: 400 });
      data.numero = n;
    }
    if (body.titulo !== undefined) data.titulo = String(body.titulo).trim();

    if (body.fecha !== undefined) {
      const d = parseFechaInput(body.fecha);
      if (!d) return NextResponse.json({ status: false, message: "Fecha inválida" }, { status: 400 });
      data.fecha = d;
    }
    if (body.hora_inicio !== undefined) {
      const t = parseTimeInput(body.hora_inicio);
      if (!t) return NextResponse.json({ status: false, message: "Hora inicio inválida" }, { status: 400 });
      data.hora_inicio = t;
    }
    if (body.hora_fin !== undefined) {
      const t = parseTimeInput(body.hora_fin);
      if (!t) return NextResponse.json({ status: false, message: "Hora fin inválida" }, { status: 400 });
      data.hora_fin = t;
    }
    if (body.autor !== undefined) data.autor = String(body.autor);
    if (body.participantes !== undefined) data.participantes = ensureStringJson(body.participantes, "[]");
    if (body.acuerdos !== undefined) data.acuerdos = ensureStringJson(body.acuerdos, "[]");
    if (body.observaciones !== undefined) data.observaciones = String(body.observaciones);
    if (body.firma_responsable !== undefined) data.firma_responsable = String(body.firma_responsable);

    const updatedRecord = await prisma.c_agenda_minuta.update({
      where: { id: idNum },
      data,
      include: {
        e_estructura_cliente: { select: { nombre: true } },
        e_estructura_sucursal: { select: { nombre: true, nro_sucursal: true } },
        e_estructura_puesto: { select: { nombre: true, codigo: true } },
      },
    });

    return NextResponse.json(
      {
        status: true,
        message: "Agenda minuta actualizada correctamente",
        data: {
          ...updatedRecord,
          id_local: "",
          cliente_nombre: (updatedRecord as any).e_estructura_cliente?.nombre || null,
          corpo_nombre: (updatedRecord as any).e_estructura_sucursal
            ? `${(updatedRecord as any).e_estructura_sucursal.nro_sucursal} - ${(updatedRecord as any).e_estructura_sucursal.nombre}`
            : null,
          puesto_nombre: (updatedRecord as any).e_estructura_puesto
            ? `${(updatedRecord as any).e_estructura_puesto.codigo ? `${(updatedRecord as any).e_estructura_puesto.codigo} - ` : ""}${(updatedRecord as any).e_estructura_puesto.nombre}`
            : null,
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

    const existingRecord = await prisma.c_agenda_minuta.findUnique({ where: { id: idNum } });
    if (!existingRecord) {
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
    }

    await prisma.c_agenda_minuta.delete({ where: { id: idNum } });

    return NextResponse.json({ status: true, message: "Agenda minuta eliminada correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error(errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}


