import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";
import { prisma } from "../../../utils/prismaClient";
import { toZonedTime } from "date-fns-tz";
import { sendNotificationByRole } from "../../../utils/sendNotification";
import { hydratePreexistentRelations, splitIncludeByTableGroup } from "../../../utils/hydratePreexistentIncludes";

const AGENDA_MINUTA_ESTRUCTURA_INCLUDE = {
  e_estructura_cliente: { select: { nombre: true } },
  e_estructura_sucursal: { select: { nombre: true, nro_sucursal: true } },
  e_estructura_puesto: { select: { nombre: true, codigo: true } },
};

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
    // UTC to avoid timezone shift: stored time = displayed time
    return new Date(Date.UTC(1970, 0, 1, hh, mm, 0, 0));
  }
  return undefined;
}

/** Returns "HH:mm" from DB value (Date or ISO string) so client shows same time as saved. */
function timeToHHmm(val: any): string | null {
  if (val == null) return null;
  const d = val instanceof Date ? val : (typeof val === "string" ? new Date(val) : null);
  if (!d || Number.isNaN(d.getTime())) return null;
  const hh = d.getUTCHours();
  const mm = d.getUTCMinutes();
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
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

export async function GET(req: NextRequest) {
  try {
    const { valid, expired, message } = await verifyAccessTokenByApi(req);
    if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

    // Parámetros de la jerarquía completa
    const empresaIdStr = req.nextUrl.searchParams.get("empresa_id");
    const clienteIdStr = req.nextUrl.searchParams.get("cliente_id");
    const divisionIdStr = req.nextUrl.searchParams.get("division_id");
    const contratoIdStr = req.nextUrl.searchParams.get("contrato_id");
    const corpoIdStr = req.nextUrl.searchParams.get("corpo_id");
    const puestoIdStr = req.nextUrl.searchParams.get("puesto_id");

    const where: any = { isActive: true };

    // Filtro por empresa: filtrar clientes que pertenecen a esa empresa
    // Solo se aplica si no hay filtro más específico de cliente
    if (empresaIdStr && !clienteIdStr) {
      const empresaId = parseInt(empresaIdStr);
      const clientes = await prisma.e_estructura_cliente.findMany({
        where: { empresa_id: empresaId },
        select: { id: true },
      });
      const clienteIds = clientes.map((c) => c.id);
      if (clienteIds.length > 0) {
        where.cliente_id = { in: clienteIds };
      } else {
        // Si no hay clientes, retornar vacío
        return NextResponse.json({ status: true, data: [] }, { status: 200 });
      }
    }

    // Filtro directo por cliente (tiene prioridad sobre empresa)
    if (clienteIdStr) {
      where.cliente_id = parseInt(clienteIdStr);
    }

    // Filtro por división: usar el campo division (String)
    // Nota: c_agenda_minuta no tiene campo division, pero podemos filtrar por contrato
    // que está relacionado con division

    // Filtro por contrato: filtrar sucursales que pertenecen a ese contrato
    // Solo se aplica si no hay filtro más específico de corpo
    if (contratoIdStr && !corpoIdStr) {
      const contratoId = parseInt(contratoIdStr);
      const sucursales = await prisma.e_estructura_sucursal.findMany({
        where: { contrato_id: contratoId },
        select: { id: true },
      });
      const sucursalIds = sucursales.map((s) => s.id);
      if (sucursalIds.length > 0) {
        where.corpo_id = { in: sucursalIds };
      } else {
        // Si no hay sucursales, retornar vacío
        return NextResponse.json({ status: true, data: [] }, { status: 200 });
      }
    }

    // Filtro directo por corpo (tiene prioridad sobre contrato)
    if (corpoIdStr) {
      where.corpo_id = parseInt(corpoIdStr);
    }

    // Filtro directo por puesto
    if (puestoIdStr) {
      where.puesto_id = parseInt(puestoIdStr);
    }

    const { sameGroupInclude, preexistentSpecs } = splitIncludeByTableGroup(AGENDA_MINUTA_ESTRUCTURA_INCLUDE);

    const records = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_agenda_minuta",
        operation: "findMany",
        where,
        orderBy: { created_at: "desc" },
        ...(sameGroupInclude ? { include: sameGroupInclude } : {}),
      },
    });
    await hydratePreexistentRelations(records, preexistentSpecs);

    const recordsArray = Array.isArray(records) ? records : [];
    const recordsWithNames = recordsArray.map((r: any) => ({
      ...r,
      id_local: "",
      hora_inicio: timeToHHmm(r.hora_inicio) ?? r.hora_inicio,
      hora_fin: timeToHHmm(r.hora_fin) ?? r.hora_fin,
      cliente_nombre: r.e_estructura_cliente?.nombre || null,
      corpo_nombre: r.e_estructura_sucursal ? `${r.e_estructura_sucursal.nro_sucursal ? `${r.e_estructura_sucursal.nro_sucursal} - ` : ''}${r.e_estructura_sucursal.nombre}` : null,
      puesto_nombre: r.e_estructura_puesto
        ? `${r.e_estructura_puesto.codigo ? `${r.e_estructura_puesto.codigo} - ` : ""}${r.e_estructura_puesto.nombre}`
        : null,
    }));

    return NextResponse.json(
      { status: true, message: "Agendas minuta obtenidas correctamente", data: recordsWithNames },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error(errorMessage);
    return NextResponse.json({ status: false, message: errorMessage, data: [] }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });

    const {
      empresa_id,
      cliente_id,
      division_id,
      contrato_id,
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
      temas_a_tratar,
      observaciones,
      firma_responsable,
      estado,
    } = await req.json();

    const required: Array<[string, any]> = [
      ["cliente_id", cliente_id],
      ["empresa_id", empresa_id],
      ["division_id", division_id],
      ["contrato_id", contrato_id],
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
      ["firma_responsable", firma_responsable],
    ];
    for (const [k, v] of required) {
      if (v === undefined || v === null || String(v).trim().length === 0) {
        return NextResponse.json({ status: false, message: `El campo ${k} es requerido` }, { status: 400 });
      }
    }

    const empresaIdNum = parseInt(String(empresa_id), 10);
    const clienteIdNum = parseInt(String(cliente_id), 10);
    const divisionIdNum = parseInt(String(division_id), 10);
    const contratoIdNum = parseInt(String(contrato_id), 10);
    const corpoIdNum = parseInt(String(corpo_id), 10);
    const puestoIdNum = parseInt(String(puesto_id), 10);
    const numeroNum = parseInt(String(numero), 10);
    if ([empresaIdNum, clienteIdNum, divisionIdNum, contratoIdNum, corpoIdNum, puestoIdNum, numeroNum].some((n) => Number.isNaN(n) || n <= 0)) {
      return NextResponse.json({ status: false, message: "IDs inválidos" }, { status: 400 });
    }

    const fechaParsed = parseFechaInput(fecha);
    if (!fechaParsed) return NextResponse.json({ status: false, message: "Fecha inválida" }, { status: 400 });
    const horaInicioParsed = parseTimeInput(hora_inicio);
    if (!horaInicioParsed) return NextResponse.json({ status: false, message: "Hora inicio inválida" }, { status: 400 });
    const horaFinParsed = parseTimeInput(hora_fin);
    if (!horaFinParsed) return NextResponse.json({ status: false, message: "Hora fin inválida" }, { status: 400 });

    const createdAt = toZonedTime(new Date(), "America/Costa_Rica");
    const { preexistentSpecs } = splitIncludeByTableGroup(AGENDA_MINUTA_ESTRUCTURA_INCLUDE);
    const record = await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_agenda_minuta",
        data: {
          empresa_id: empresaIdNum,
          cliente_id: clienteIdNum,
          division_id: divisionIdNum,
          contrato_id: contratoIdNum,
          corpo_id: corpoIdNum,
          puesto_id: puestoIdNum,
          numero: numeroNum,
          titulo: String(titulo).trim(),
          fecha: fechaParsed instanceof Date ? fechaParsed.toISOString() : fechaParsed,
          hora_inicio: horaInicioParsed instanceof Date ? horaInicioParsed.toISOString() : horaInicioParsed,
          hora_fin: horaFinParsed instanceof Date ? horaFinParsed.toISOString() : horaFinParsed,
          autor: String(autor),
          participantes: ensureStringJson(participantes, "[]"),
          acuerdos: ensureStringJson(acuerdos, "[]"),
          temas_a_tratar: temas_a_tratar !== undefined ? ensureStringJson(temas_a_tratar, "[]") : "[]",
          observaciones: String(observaciones ?? "-"),
          firma_responsable: String(firma_responsable),
          estado: Boolean(estado),
          created_at: createdAt.toISOString(),
          created_by: payload.id?.toString?.() || "",
        },
      },
    });
    await hydratePreexistentRelations(record, preexistentSpecs);

    if (record) {
      let empNombre = "Desconocido";
      let sucursalNombre = "Desconocida";
      let puestoNombre = "Desconocido";
      let fechaRegistro = createdAt.toISOString().split("T")[0];
      let horaRegistro = createdAt.toISOString().split("T")[1].split(".")[0];
      if (record.created_by) {
        const empleado = await prisma.c_empleado.findUnique({
          where: { id: parseInt(String(record.created_by), 10) },
        });
        if (empleado && empleado.id) {
          empNombre = (empleado.nombre || "") + " " + (empleado.primer_apellido || "") + " " + (empleado.segundo_apellido || "");
        }
      }
      if (record.corpo_id) {
        const sucursal = await prisma.e_estructura_sucursal.findUnique({ where: { id: record.corpo_id } });
        if (sucursal && sucursal.id) {
          sucursalNombre = sucursal.nombre || "Desconocida";
        }
      }
      if (record.puesto_id) {
        const puesto = await prisma.e_estructura_puesto.findUnique({ where: { id: record.puesto_id } });
        if (puesto && puesto.id) {
          puestoNombre = (puesto.nombre || "") + " (" + (puesto.codigo || "") + ")";
        }
      }
      const description = "El empleado " + empNombre + " ha registrado una agenda minuta titulada " + record.titulo + " en el puesto " + puestoNombre + " de la sucursal " + sucursalNombre + " el día " + fechaRegistro + " a las " + horaRegistro;
      await sendNotificationByRole(req, record.corpo_id, [parseInt(String(record.created_by), 10)], "Agenda minuta registrada", description, ["ADMINISTRATIVO", "SUPERVISOR"]);
    }

    // Registrar cambio de creación
    const createdBy = parseInt(String(payload.id ?? 0), 10) || 0;
    const fechaRecord = record.fecha instanceof Date ? record.fecha : new Date(record.fecha);
    const horaInicioRecord = record.hora_inicio instanceof Date ? record.hora_inicio : new Date(record.hora_inicio);
    const horaFinRecord = record.hora_fin instanceof Date ? record.hora_fin : new Date(record.hora_fin);
    await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_cambios_apps_modules",
        data: {
          nombre_tabla: "c_agenda_minuta",
          registro_id: record.id,
          cambios: JSON.stringify([{
            prop: "__created__",
            before: null,
            after: {
              id: record.id,
              cliente_id: record.cliente_id,
              empresa_id: (record as any).empresa_id,
              division_id: (record as any).division_id,
              contrato_id: (record as any).contrato_id,
              corpo_id: record.corpo_id,
              puesto_id: record.puesto_id,
              numero: record.numero,
              titulo: record.titulo,
              fecha: fechaRecord.toISOString(),
              hora_inicio: horaInicioRecord.toISOString(),
              hora_fin: horaFinRecord.toISOString(),
              autor: record.autor,
              participantes: record.participantes,
              acuerdos: record.acuerdos,
              observaciones: record.observaciones,
              firma_responsable: record.firma_responsable,
              estado: (record as any).estado ?? false,
            },
          }]),
          created_at: createdAt.toISOString(),
          created_by: createdBy,
        },
      },
    });

    const recordAny = record as any;
    return NextResponse.json(
      {
        status: true,
        message: "Agenda minuta creada correctamente",
        data: {
          ...record,
          id_local: "",
          hora_inicio: timeToHHmm(recordAny.hora_inicio) ?? recordAny.hora_inicio,
          hora_fin: timeToHHmm(recordAny.hora_fin) ?? recordAny.hora_fin,
          cliente_nombre: recordAny.e_estructura_cliente?.nombre || null,
          corpo_nombre: recordAny.e_estructura_sucursal ? `${recordAny.e_estructura_sucursal.nro_sucursal} - ${recordAny.e_estructura_sucursal.nombre}` : null,
          puesto_nombre: recordAny.e_estructura_puesto
            ? `${recordAny.e_estructura_puesto.codigo ? `${recordAny.e_estructura_puesto.codigo} - ` : ""}${recordAny.e_estructura_puesto.nombre}`
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


