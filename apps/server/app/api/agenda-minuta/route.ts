import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../utils/verifyToken";
import { prisma } from "../../../utils/prismaClient";
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

function parseTimeInput(time: any): Date | undefined {
  if (!time) return undefined;
  if (time instanceof Date) return time;
  if (typeof time === "string") {
    const m = time.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return undefined;
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    if (Number.isNaN(hh) || Number.isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return undefined;
    // Date placeholder; Prisma @db.Time cares about time component
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

export async function POST(req: NextRequest) {
  try {
    const { valid, payload, message } = verifyAccessToken(req);
    if (!valid) return NextResponse.json({ status: false, message }, { status: 401 });

    const {
      cliente_id,
      corpo_id,
      puesto_id,
      numero,
      titulo,
      fecha,
      hora_inicio,
      hora_fin,
      autor,
      participantes,
      acuerdos,
      observaciones,
      firma_responsable,
    } = await req.json();

    const required: Array<[string, any]> = [
      ["cliente_id", cliente_id],
      ["corpo_id", corpo_id],
      ["puesto_id", puesto_id],
      ["numero", numero],
      ["titulo", titulo],
      ["fecha", fecha],
      ["hora_inicio", hora_inicio],
      ["hora_fin", hora_fin],
      ["autor", autor],
      ["participantes", participantes],
      ["acuerdos", acuerdos],
      ["observaciones", observaciones],
      ["firma_responsable", firma_responsable],
    ];
    for (const [k, v] of required) {
      if (v === undefined || v === null || String(v).trim().length === 0) {
        return NextResponse.json({ status: false, message: `El campo ${k} es requerido` }, { status: 400 });
      }
    }

    const clienteIdNum = parseInt(String(cliente_id), 10);
    const corpoIdNum = parseInt(String(corpo_id), 10);
    const puestoIdNum = parseInt(String(puesto_id), 10);
    const numeroNum = parseInt(String(numero), 10);
    if ([clienteIdNum, corpoIdNum, puestoIdNum, numeroNum].some((n) => Number.isNaN(n) || n <= 0)) {
      return NextResponse.json({ status: false, message: "IDs inválidos" }, { status: 400 });
    }

    const fechaParsed = parseFechaInput(fecha);
    if (!fechaParsed) return NextResponse.json({ status: false, message: "Fecha inválida" }, { status: 400 });
    const horaInicioParsed = parseTimeInput(hora_inicio);
    if (!horaInicioParsed) return NextResponse.json({ status: false, message: "Hora inicio inválida" }, { status: 400 });
    const horaFinParsed = parseTimeInput(hora_fin);
    if (!horaFinParsed) return NextResponse.json({ status: false, message: "Hora fin inválida" }, { status: 400 });

    const createdAt = toZonedTime(new Date(), "America/Costa_Rica");
    const record = await prisma.c_agenda_minuta.create({
      data: {
        cliente_id: clienteIdNum,
        corpo_id: corpoIdNum,
        puesto_id: puestoIdNum,
        numero: numeroNum,
        titulo: String(titulo).trim(),
        fecha: fechaParsed,
        hora_inicio: horaInicioParsed,
        hora_fin: horaFinParsed,
        autor: String(autor),
        participantes: ensureStringJson(participantes, "[]"),
        acuerdos: ensureStringJson(acuerdos, "[]"),
        observaciones: String(observaciones),
        firma_responsable: String(firma_responsable),
        created_at: createdAt,
        created_by: payload.id?.toString?.() || "",
      },
      include: {
        e_estructura_cliente: { select: { nombre: true } },
        e_estructura_sucursal: { select: { nombre: true, nro_sucursal: true } },
        e_estructura_puesto: { select: { nombre: true, codigo: true } },
      },
    });

    return NextResponse.json(
      {
        status: true,
        message: "Agenda minuta creada correctamente",
        data: {
          ...record,
          id_local: "",
          cliente_nombre: (record as any).e_estructura_cliente?.nombre || null,
          corpo_nombre: (record as any).e_estructura_sucursal ? `${(record as any).e_estructura_sucursal.nro_sucursal} - ${(record as any).e_estructura_sucursal.nombre}` : null,
          puesto_nombre: (record as any).e_estructura_puesto
            ? `${(record as any).e_estructura_puesto.codigo ? `${(record as any).e_estructura_puesto.codigo} - ` : ""}${(record as any).e_estructura_puesto.nombre}`
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


