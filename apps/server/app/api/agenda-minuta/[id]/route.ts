import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";
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
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });

    const resolvedParams = await context.params;
    const idNum = parseInt(String(resolvedParams.id), 10);
    if (Number.isNaN(idNum) || idNum <= 0) {
      return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
    }

    const body = await req.json();
    const existingRecord = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_agenda_minuta",
        operation: "findUnique",
        where: { id: idNum },
      },
    });
    if (!existingRecord || !existingRecord.id) {
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
      data.fecha = d instanceof Date ? d.toISOString() : d;
    }
    if (body.hora_inicio !== undefined) {
      const t = parseTimeInput(body.hora_inicio);
      if (!t) return NextResponse.json({ status: false, message: "Hora inicio inválida" }, { status: 400 });
      data.hora_inicio = t instanceof Date ? t.toISOString() : t;
    }
    if (body.hora_fin !== undefined) {
      const t = parseTimeInput(body.hora_fin);
      if (!t) return NextResponse.json({ status: false, message: "Hora fin inválida" }, { status: 400 });
      data.hora_fin = t instanceof Date ? t.toISOString() : t;
    }
    if (body.autor !== undefined) data.autor = String(body.autor);
    if (body.participantes !== undefined) data.participantes = ensureStringJson(body.participantes, "[]");
    if (body.acuerdos !== undefined) data.acuerdos = ensureStringJson(body.acuerdos, "[]");
    if (body.temas_a_tratar !== undefined) data.temas_a_tratar = ensureStringJson(body.temas_a_tratar, "[]");
    if (body.observaciones !== undefined) data.observaciones = String(body.observaciones);
    if (body.firma_responsable !== undefined) data.firma_responsable = String(body.firma_responsable);

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
    for (const [k, v] of Object.entries(data)) {
      // No registramos firmas: esas se guardan aparte y no son "datos escritos"
      if (k === "firma_responsable") continue;

      const before = (existingRecord as any)[k];
      const after = typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v) ? new Date(v) : v;
      if (!eq(before, after)) {
        const beforeDate = before instanceof Date ? before : (typeof before === "string" && /^\d{4}-\d{2}-\d{2}T/.test(before) ? new Date(before) : null);
        const afterDate = after instanceof Date ? after : (typeof after === "string" && /^\d{4}-\d{2}-\d{2}T/.test(after) ? new Date(after) : null);
        cambiosArr.push({
          prop: k,
          before: beforeDate ? beforeDate.toISOString() : before,
          after: afterDate ? afterDate.toISOString() : after,
        });
      }
    }

    const updatedRecord = await callDynamicPrisma({
      req,
      data: {
        action: "UPDATE",
        table: "c_agenda_minuta",
        where: { id: idNum },
        data,
        include: {
          e_estructura_cliente: { select: { nombre: true } },
          e_estructura_sucursal: { select: { nombre: true, nro_sucursal: true } },
          e_estructura_puesto: { select: { nombre: true, codigo: true } },
        },
      },
    });

    // Registrar cambios si hay alguno
    if (cambiosArr.length > 0) {
      const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
      const createdAt = toZonedTime(new Date(), "America/Costa_Rica");
      await callDynamicPrisma({
        req,
        data: {
          action: "POST",
          table: "c_cambios_apps_modules",
          data: {
            nombre_tabla: "c_agenda_minuta",
            registro_id: idNum,
            cambios: JSON.stringify(cambiosArr),
            created_at: createdAt.toISOString(),
            created_by: createdBy,
          },
        },
      });
    }

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
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });

    const resolvedParams = await context.params;
    const idNum = parseInt(String(resolvedParams.id), 10);
    if (Number.isNaN(idNum) || idNum <= 0) {
      return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
    }

    const existingRecord = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_agenda_minuta",
        operation: "findUnique",
        where: { id: idNum },
      },
    });
    if (!existingRecord || !existingRecord.id) {
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
    }

    // Registrar cambio de eliminación antes de eliminar
    const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
    const createdAt = toZonedTime(new Date(), "America/Costa_Rica");
    const fechaRecord = existingRecord.fecha instanceof Date ? existingRecord.fecha : new Date(existingRecord.fecha);
    const horaInicioRecord = existingRecord.hora_inicio instanceof Date ? existingRecord.hora_inicio : new Date(existingRecord.hora_inicio);
    const horaFinRecord = existingRecord.hora_fin instanceof Date ? existingRecord.hora_fin : new Date(existingRecord.hora_fin);
    await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_cambios_apps_modules",
        data: {
          nombre_tabla: "c_agenda_minuta",
          registro_id: idNum,
          cambios: JSON.stringify([{
            prop: "__deleted__",
            before: {
              id: existingRecord.id,
              cliente_id: existingRecord.cliente_id,
              corpo_id: existingRecord.corpo_id,
              puesto_id: existingRecord.puesto_id,
              numero: existingRecord.numero,
              titulo: existingRecord.titulo,
              fecha: fechaRecord.toISOString(),
              hora_inicio: horaInicioRecord.toISOString(),
              hora_fin: horaFinRecord.toISOString(),
              autor: existingRecord.autor,
              participantes: existingRecord.participantes,
              acuerdos: existingRecord.acuerdos,
              observaciones: existingRecord.observaciones,
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
        table: "c_agenda_minuta",
        where: { id: idNum },
      },
    });

    return NextResponse.json({ status: true, message: "Agenda minuta eliminada correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error(errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}


