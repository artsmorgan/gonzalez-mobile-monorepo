import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";
import { prisma } from "../../../utils/prismaClient";
import { uploadDynamicFiles } from "../../../utils/callDynamicFilesApi";
import { toZonedTime } from "date-fns-tz";
import { sendNotificationByEmployee } from "../../../utils/sendNotification";
import { hydratePreexistentRelations, splitIncludeByTableGroup } from "../../../utils/hydratePreexistentIncludes";
import { reportError } from "../../../utils/reportError";
import {
  dateAtUtcMidnight,
  parseIntStrict,
  parseMarcaIdsArray,
  stringifyMarcaIds,
  ymdFromFecha,
} from "../../../utils/mutuosAcuerdosMarcas";

const MUTUOS_ACUERDOS_LIST_INCLUDE = {
  e_estructura_cliente: { select: { nombre: true } },
  e_estructura_sucursal: { select: { nombre: true, nro_sucursal: true } },
  n_ejecutivo_cuenta: { select: { id: true, nombre: true } },
};

const turnoTexto = (tipoTurno?: string | null) => {
  const first = String(tipoTurno || "").trim().charAt(0).toUpperCase();
  if (first === "D") return "Diurno";
  if (first === "M") return "Mixto";
  if (first === "N") return "Nocturno";
  return "Sin definir";
};

const marcaResumen = (marca: any) => {
  if (!marca) return null;
  return {
    id: marca.id,
    fecha: marca.fecha ? new Date(marca.fecha).toISOString() : null,
    cliente_id: marca.cliente_id ?? null,
    corpo_id: marca.corpo_id ?? null,
    plaza_id: marca.plaza_id ?? null,
    empleadoFijo_id: marca.empleadoFijo_id ?? null,
    cliente: marca.e_estructura_cliente?.nombre || null,
    sucursal: marca.e_estructura_sucursal?.nombre || null,
    puesto: marca.e_estructura_puesto?.nombre || null,
    hora_inicio: marca.hora_inicio ? new Date(marca.hora_inicio).toISOString() : null,
    hora_fin: marca.hora_fin ? new Date(marca.hora_fin).toISOString() : null,
    tipo_turno: marca.tipo_turno || null,
    tipo_turno_texto: turnoTexto(marca.tipo_turno),
  };
};

const parseDateInputToDate = (input: unknown): Date | null => {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  const s = String(input).trim();
  if (!s) return null;
  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? null : parsed;
};

type ShiftInterval = { startMs: number; endMs: number; marcaId: number };

const parseClockFromDb = (value: unknown): { h: number; m: number; s: number } | null => {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? value : new Date(String(value));
  if (isNaN(d.getTime())) return null;
  return { h: d.getUTCHours(), m: d.getUTCMinutes(), s: d.getUTCSeconds() };
};

const ymdFromMarcaFecha = (fecha: unknown): { y: number; m: number; d: number } | null => {
  if (!fecha) return null;
  const d = fecha instanceof Date ? fecha : new Date(String(fecha));
  if (isNaN(d.getTime())) return null;
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate() };
};

/** Rango efectivo del turno: fecha + hora_entrada … fecha(+1 si aplica) + hora_salida. */
const buildShiftIntervalFromMarca = (marca: any): ShiftInterval | null => {
  const ymd = ymdFromMarcaFecha(marca?.fecha);
  if (!ymd) return null;
  const marcaId = parseIntStrict(marca?.id);
  if (!marcaId) return null;

  const entrada = parseClockFromDb(marca?.hora_entrada) ?? parseClockFromDb(marca?.hora_inicio);
  const salida = parseClockFromDb(marca?.hora_salida) ?? parseClockFromDb(marca?.hora_fin);
  if (!entrada || !salida) return null;

  const startMs = Date.UTC(ymd.y, ymd.m, ymd.d, entrada.h, entrada.m, entrada.s);
  const entSec = entrada.h * 3600 + entrada.m * 60 + entrada.s;
  const salSec = salida.h * 3600 + salida.m * 60 + salida.s;

  let endY = ymd.y;
  let endM = ymd.m;
  let endD = ymd.d;
  if (salSec <= entSec) {
    const next = new Date(Date.UTC(ymd.y, ymd.m, ymd.d));
    next.setUTCDate(next.getUTCDate() + 1);
    endY = next.getUTCFullYear();
    endM = next.getUTCMonth();
    endD = next.getUTCDate();
  }
  const endMs = Date.UTC(endY, endM, endD, salida.h, salida.m, salida.s);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;

  return { startMs, endMs, marcaId };
};

const isInstantInsideShift = (instantMs: number, interval: ShiftInterval): boolean =>
  instantMs > interval.startMs && instantMs < interval.endMs;

/** Conflicto si entrada/salida del turno a cubrir cae dentro de un turno original o los rangos se solapan. */
const shiftIntervalsConflict = (candidate: ShiftInterval, original: ShiftInterval): boolean => {
  if (isInstantInsideShift(candidate.startMs, original)) return true;
  if (isInstantInsideShift(candidate.endMs, original)) return true;
  if (isInstantInsideShift(original.startMs, candidate)) return true;
  if (isInstantInsideShift(original.endMs, candidate)) return true;
  return candidate.startMs < original.endMs && original.startMs < candidate.endMs;
};

const formatShiftIntervalLabel = (marca: any, interval: ShiftInterval): string => {
  const ymd = ymdFromMarcaFecha(marca?.fecha);
  const fechaStr = ymd
    ? `${String(ymd.d).padStart(2, "0")}/${String(ymd.m + 1).padStart(2, "0")}/${ymd.y}`
    : "?";
  const fmt = (ms: number) => {
    const d = new Date(ms);
    return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  };
  return `marca #${interval.marcaId} (${fechaStr} ${fmt(interval.startMs)}–${fmt(interval.endMs)})`;
};

const fetchMarcasOriginalesEmpleado = async (
  empleadoId: number,
  fechaGte: Date,
  fechaLte: Date
) => {
  const rows = await prisma.c_marca_dia.findMany({
    where: {
      empleadoFijo_id: empleadoId,
      fecha: { gte: fechaGte, lte: fechaLte },
    },
    select: {
      id: true,
      fecha: true,
      hora_entrada: true,
      hora_salida: true,
      hora_inicio: true,
      hora_fin: true,
    },
  });
  return Array.isArray(rows) ? rows : [];
};

type ExchangeConflictResult = { ok: true } | { ok: false; message: string };

type OriginalShiftConflict = { marca: any; interval: ShiftInterval; marcaId: number };

/**
 * Evalúa conflictos del turno a cubrir contra todos los turnos originales del empleado.
 * Solo se permiten conflictos con los turnos que el empleado cede en el acuerdo.
 * Con 2+ conflictos fuera de los cedidos (o múltiples no cedidos) se rechaza.
 */
const validateEmployeeTakingExchangedShift = (
  coveringTurnLabel: string,
  shiftToTake: any,
  shiftToTakeLabel: string,
  /** Marcas del turno que cede en el acuerdo (las tomará el otro). */
  marcaCedidaIds: number[],
  originalMarcas: any[]
): ExchangeConflictResult => {
  const cedidas = new Set(
    (marcaCedidaIds || []).map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0),
  );
  const candidate = buildShiftIntervalFromMarca(shiftToTake);
  if (!candidate) {
    return {
      ok: false,
      message: `No se pudo determinar el horario (entrada/salida) de ${coveringTurnLabel} al cubrir el ${shiftToTakeLabel}.`,
    };
  }

  const conflicts: OriginalShiftConflict[] = [];
  const seenMarcaIds = new Set<number>();

  for (const original of originalMarcas) {
    const originalId = parseIntStrict(original?.id);
    if (!originalId || seenMarcaIds.has(originalId)) continue;

    const origInterval = buildShiftIntervalFromMarca(original);
    if (!origInterval) continue;

    if (shiftIntervalsConflict(candidate, origInterval)) {
      seenMarcaIds.add(originalId);
      conflicts.push({ marca: original, interval: origInterval, marcaId: originalId });
    }
  }

  if (conflicts.length === 0) return { ok: true };

  const nonCedidos = conflicts.filter((c) => !cedidas.has(c.marcaId));
  if (nonCedidos.length === 0) return { ok: true };

  const conflictLabels = conflicts.map((c) => formatShiftIntervalLabel(c.marca, c.interval)).join("; ");
  const cedidasLabel = [...cedidas].map((id) => `#${id}`).join(", ") || "(ninguna)";

  return {
    ok: false,
    message:
      `El intercambio no es válido: ${coveringTurnLabel} al cubrir el ${shiftToTakeLabel} ` +
      `choca con turnos originales (${conflictLabels}) que no son los que cede en este acuerdo (${cedidasLabel}).`,
  };
};

const validateMutuoAcuerdoShiftExchange = async (
  marcasAusente: any[],
  marcasReemplaza: any[]
): Promise<ExchangeConflictResult> => {
  if (!marcasAusente.length || !marcasReemplaza.length) {
    return {
      ok: false,
      message: "Ambos lados del mutuo acuerdo deben incluir al menos una marca/turno.",
    };
  }

  const intervalsAusente = marcasAusente.map(buildShiftIntervalFromMarca).filter(Boolean) as ShiftInterval[];
  const intervalsReemplaza = marcasReemplaza.map(buildShiftIntervalFromMarca).filter(Boolean) as ShiftInterval[];
  if (intervalsAusente.length !== marcasAusente.length || intervalsReemplaza.length !== marcasReemplaza.length) {
    return {
      ok: false,
      message:
        "No se pudo validar el intercambio: todas las marcas deben tener fecha y horarios de entrada/salida (o inicio/fin) definidos.",
    };
  }

  const allStarts = [...intervalsAusente, ...intervalsReemplaza].map((i) => i.startMs);
  const allEnds = [...intervalsAusente, ...intervalsReemplaza].map((i) => i.endMs);
  const minStart = Math.min(...allStarts);
  const maxEnd = Math.max(...allEnds);
  const fechaGte = new Date(minStart - 24 * 60 * 60 * 1000);
  const fechaLte = new Date(maxEnd + 24 * 60 * 60 * 1000);

  const empleadoAusenteId = Number(marcasAusente[0].empleadoFijo_id);
  const empleadoReemplazaId = Number(marcasReemplaza[0].empleadoFijo_id);
  const idsAusente = marcasAusente.map((m) => Number(m.id)).filter((n) => Number.isFinite(n) && n > 0);
  const idsReemplaza = marcasReemplaza.map((m) => Number(m.id)).filter((n) => Number.isFinite(n) && n > 0);

  const [originalesAusente, originalesReemplaza] = await Promise.all([
    fetchMarcasOriginalesEmpleado(empleadoAusenteId, fechaGte, fechaLte),
    fetchMarcasOriginalesEmpleado(empleadoReemplazaId, fechaGte, fechaLte),
  ]);

  return { ok: true };
};

export async function GET(req: NextRequest) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) return NextResponse.json({ status: false, expired, message, data: [] }, { status: expired ? 401 : 403 });

    const currentEmployeeId = parseIntStrict((payload as any)?.id);
    if (!currentEmployeeId) {
      await reportError(req, "api/mutuos-acuerdos", "GET", 400, "Empleado inválido");
      return NextResponse.json({ status: false, message: "Empleado inválido", data: [] }, { status: 400 });
    }

    const empleado = await prisma.c_empleado.findUnique({ where: { id: currentEmployeeId } });
    const myEjecutivoCuentaId = empleado?.supervisor_id ?? null;

    const where: any = {
      AND: [
        { isActive: true },
        {
          OR: [
            { empleadoReemplaza_id: currentEmployeeId },
            { empleadoAusente_id: currentEmployeeId },
            ...(myEjecutivoCuentaId
              ? [
                  {
                    // Ejecutivo: solo pendientes a firmar / ya firmados (ambos involucrados aceptaron).
                    AND: [
                      { ejecutivo_cuenta: myEjecutivoCuentaId },
                      { ausente_acepta: true },
                      { reemplaza_acepta: true },
                    ],
                  },
                ]
              : []),
          ],
        },
      ],
    };

    const { sameGroupInclude, preexistentSpecs } = splitIncludeByTableGroup(MUTUOS_ACUERDOS_LIST_INCLUDE);

    const records = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "e_mutuos_acuerdos",
        operation: "findMany",
        where,
        orderBy: { created_at: "desc" },
        ...(sameGroupInclude ? { include: sameGroupInclude } : {}),
      },
    });
    await hydratePreexistentRelations(records, preexistentSpecs);

    const marcaIds = Array.from(
      new Set(
        (records || [])
          .flatMap((r: any) => [
            ...parseMarcaIdsArray(r.marcas_ausente ?? r.marcaDiaAusente_id),
            ...parseMarcaIdsArray(r.marcas_reemplaza ?? r.marcaDiaReemplaza_id),
          ])
          .filter(Boolean)
      )
    ) as number[];

    const empleadoIds = Array.from(
      new Set(
        (records || [])
          .flatMap((r: any) => [r.empleadoAusente_id, r.empleadoReemplaza_id])
          .map((x: any) => parseIntStrict(x))
          .filter(Boolean)
      )
    ) as number[];

    const plazaIds = Array.from(
      new Set(
        (records || [])
          .flatMap((r: any) => [r.plazaAusente_id, r.plazaReemplaza_id])
          .map((x: any) => parseIntStrict(x))
          .filter(Boolean)
      )
    ) as number[];

    const [marcas, empleados, plazas] = await Promise.all([
      marcaIds.length > 0
        ? prisma.c_marca_dia.findMany({
          where: { id: { in: marcaIds } },
          include: {
            e_estructura_cliente: { select: { nombre: true } },
            e_estructura_sucursal: { select: { nombre: true } },
            e_estructura_puesto: { select: { nombre: true } },
          },
        })
        : [],
      empleadoIds.length > 0
        ? prisma.c_empleado.findMany({
          where: { id: { in: empleadoIds } },
          select: { id: true, nombre: true, primer_apellido: true, segundo_apellido: true },
        })
        : [],
      plazaIds.length > 0
        ? prisma.e_estructura_plazas.findMany({
          where: { id: { in: plazaIds } },
          select: { id: true, nombre: true },
        })
        : [],
    ]);

    const marcaById = new Map<number, any>((marcas || []).map((m: any) => [m.id, m]));
    const empleadoById = new Map<number, any>((empleados || []).map((e: any) => [e.id, e]));
    const plazaById = new Map<number, any>((plazas || []).map((p: any) => [p.id, p]));

    const getEmpleadoNombre = (id: number) => {
      const e = empleadoById.get(id);
      if (!e) return null;
      return [e.nombre, e.primer_apellido, e.segundo_apellido].filter(Boolean).join(" ").trim();
    };

    const mapped = (records || []).map((r: any) => {
      const idsAusente = parseMarcaIdsArray(r.marcas_ausente ?? r.marcaDiaAusente_id);
      const idsReemplaza = parseMarcaIdsArray(r.marcas_reemplaza ?? r.marcaDiaReemplaza_id);
      const marcasAusenteList = idsAusente.map((id) => marcaResumen(marcaById.get(id))).filter(Boolean);
      const marcasReemplazaList = idsReemplaza.map((id) => marcaResumen(marcaById.get(id))).filter(Boolean);
      const marcaAusente = marcasAusenteList[0] || null;
      const marcaReemplaza = marcasReemplazaList[0] || null;
      const estado = String(r?.estado || "").trim().toLowerCase() || "pendiente";
      const pending = estado === "pendiente";

      return {
        ...r,
        marcas_ausente: stringifyMarcaIds(idsAusente),
        marcas_reemplaza: stringifyMarcaIds(idsReemplaza),
        fecha_ausente: ymdFromFecha(r.fecha_ausente) || ymdFromFecha((marcaAusente as any)?.fecha) || null,
        fecha_reemplaza: ymdFromFecha(r.fecha_reemplaza) || ymdFromFecha((marcaReemplaza as any)?.fecha) || null,
        cliente_nombre: r.e_estructura_cliente?.nombre || null,
        corpo_nombre: r.e_estructura_sucursal
          ? `${r.e_estructura_sucursal.nro_sucursal ? `${r.e_estructura_sucursal.nro_sucursal} - ` : ""}${r.e_estructura_sucursal.nombre}`
          : null,
        ejecutivo_nombre: r.n_ejecutivo_cuenta?.nombre || null,
        empleado_ausente_nombre: getEmpleadoNombre(r.empleadoAusente_id),
        empleado_reemplaza_nombre: getEmpleadoNombre(r.empleadoReemplaza_id),
        puesto_ausente_nombre: plazaById.get(r.plazaAusente_id)?.nombre || null,
        puesto_reemplaza_nombre: plazaById.get(r.plazaReemplaza_id)?.nombre || null,
        marcas_ausente_detalle: marcasAusenteList,
        marcas_reemplaza_detalle: marcasReemplazaList,
        marca_ausente: marcaAusente,
        marca_reemplaza: marcaReemplaza,
        can_accept_ausente: Number(r.empleadoAusente_id) === currentEmployeeId && !r.ausente_acepta,
        can_accept_reemplaza: Number(r.empleadoReemplaza_id) === currentEmployeeId && !r.reemplaza_acepta,
        can_sign_ejecutivo:
          pending &&
          Boolean(myEjecutivoCuentaId) &&
          Number(r.ejecutivo_cuenta) === Number(myEjecutivoCuentaId) &&
          r.ausente_acepta === true &&
          r.reemplaza_acepta === true &&
          !r.firma_ejecutivo_cuenta_digital &&
          !r.firma_ejecutivo_cuenta_manual,
        can_reject_ejecutivo:
          pending &&
          Boolean(myEjecutivoCuentaId) &&
          Number(r.ejecutivo_cuenta) === Number(myEjecutivoCuentaId) &&
          r.ausente_acepta === true &&
          r.reemplaza_acepta === true &&
          !r.firma_ejecutivo_cuenta_digital &&
          !r.firma_ejecutivo_cuenta_manual,
      };
    });

    return NextResponse.json({ status: true, message: "Mutuos acuerdos obtenidos correctamente", data: mapped }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    await reportError(req, "api/mutuos-acuerdos", "GET", 400, errorMessage);
    return NextResponse.json({ status: false, message: errorMessage, data: [] }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) return NextResponse.json({ status: false, expired, message }, { status: expired ? 401 : 403 });

    const body = await req.json();
    const marcasAusenteIds = parseMarcaIdsArray(
      body?.marcas_ausente ?? body?.marcaDiaAusente_id ?? body?.marcaDiaAusenteIds,
    );
    const marcasReemplazaIds = parseMarcaIdsArray(
      body?.marcas_reemplaza ?? body?.marcaDiaReemplaza_id ?? body?.marcaDiaReemplazaIds,
    );
    const fechaAusenteYmd = ymdFromFecha(body?.fecha_ausente);
    const fechaReemplazaYmd = ymdFromFecha(body?.fecha_reemplaza);
    const motivo = String(body?.motivo || "").trim();
    const horaAccion = parseDateInputToDate(body?.hora_accion);
    const firma_responsable = String(body?.firma_responsable || "").trim();
    const file_base64 = String(body?.file_base64 || "").trim();
    const extension = String(body?.extension || "").replace(".", "").trim();
    const original_name = String(body?.original_name || "").trim();
    const file_type = String(body?.type || "").trim().toLowerCase();
    const mime_type = String(body?.mimeType || "").trim();

    if (!fechaAusenteYmd || !fechaReemplazaYmd || !motivo || !firma_responsable) {
      const msg = "Datos incompletos: se requieren fecha_ausente, fecha_reemplaza, motivo y firma_responsable";
      await reportError(req, "api/mutuos-acuerdos", "POST", 400, msg);
      return NextResponse.json(
        {
          status: false,
          message: msg,
        },
        { status: 400 },
      );
    }

    if (marcasAusenteIds.length === 0 || marcasReemplazaIds.length === 0) {
      const msg = "Ambas fechas deben tener al menos 1 marca/turno (marcas_ausente y marcas_reemplaza no pueden estar vacíos)";
      await reportError(req, "api/mutuos-acuerdos", "POST", 400, msg);
      return NextResponse.json(
        {
          status: false,
          message: msg,
        },
        { status: 400 },
      );
    }

    const overlapIds = marcasAusenteIds.filter((id) => marcasReemplazaIds.includes(id));
    if (overlapIds.length > 0) {
      await reportError(req, "api/mutuos-acuerdos", "POST", 400, "Las marcas del primer y segundo turno no pueden solaparse");
      return NextResponse.json(
        { status: false, message: "Las marcas del primer y segundo turno no pueden solaparse" },
        { status: 400 },
      );
    }

    const [marcasAusenteRows, marcasReemplazaRows] = await Promise.all([
      prisma.c_marca_dia.findMany({ where: { id: { in: marcasAusenteIds } } }),
      prisma.c_marca_dia.findMany({ where: { id: { in: marcasReemplazaIds } } }),
    ]);

    if (marcasAusenteRows.length !== marcasAusenteIds.length || marcasReemplazaRows.length !== marcasReemplazaIds.length) {
      await reportError(req, "api/mutuos-acuerdos", "POST", 404, "No se encontraron todas las marcas indicadas");
      return NextResponse.json({ status: false, message: "No se encontraron todas las marcas indicadas" }, { status: 404 });
    }

    const marcaByIdLocal = new Map<number, any>(
      [...marcasAusenteRows, ...marcasReemplazaRows].map((m: any) => [Number(m.id), m]),
    );
    const marcasAusente = marcasAusenteIds.map((id) => marcaByIdLocal.get(id)).filter(Boolean);
    const marcasReemplaza = marcasReemplazaIds.map((id) => marcaByIdLocal.get(id)).filter(Boolean);
    const marcaAusente = marcasAusente[0];
    const marcaReemplaza = marcasReemplaza[0];
    if (!marcaAusente || !marcaReemplaza) {
      await reportError(req, "api/mutuos-acuerdos", "POST", 404, "No se encontraron las marcas seleccionadas");
      return NextResponse.json({ status: false, message: "No se encontraron las marcas seleccionadas" }, { status: 404 });
    }

    for (const m of marcasAusente) {
      const day = ymdFromFecha(m.fecha);
      if (day !== fechaAusenteYmd) {
        const msg = `La marca #${m.id} no corresponde a fecha_ausente (${fechaAusenteYmd})`;
        await reportError(req, "api/mutuos-acuerdos", "POST", 400, msg);
        return NextResponse.json(
          { status: false, message: msg },
          { status: 400 },
        );
      }
      if (Number(m.empleadoFijo_id) !== Number(marcaAusente.empleadoFijo_id)) {
        await reportError(req, "api/mutuos-acuerdos", "POST", 400, "Todas las marcas del primer turno deben pertenecer al mismo empleado");
        return NextResponse.json(
          { status: false, message: "Todas las marcas del primer turno deben pertenecer al mismo empleado" },
          { status: 400 },
        );
      }
    }
    for (const m of marcasReemplaza) {
      const day = ymdFromFecha(m.fecha);
      if (day !== fechaReemplazaYmd) {
        const msg = `La marca #${m.id} no corresponde a fecha_reemplaza (${fechaReemplazaYmd})`;
        await reportError(req, "api/mutuos-acuerdos", "POST", 400, msg);
        return NextResponse.json(
          { status: false, message: msg },
          { status: 400 },
        );
      }
      if (Number(m.empleadoFijo_id) !== Number(marcaReemplaza.empleadoFijo_id)) {
        await reportError(req, "api/mutuos-acuerdos", "POST", 400, "Todas las marcas del segundo turno deben pertenecer al mismo empleado");
        return NextResponse.json(
          { status: false, message: "Todas las marcas del segundo turno deben pertenecer al mismo empleado" },
          { status: 400 },
        );
      }
    }

    if (Number(marcaAusente.empleadoFijo_id) === Number(marcaReemplaza.empleadoFijo_id)) {
      await reportError(req, "api/mutuos-acuerdos", "POST", 400, "El primer y segundo turno deben corresponder a empleados distintos");
      return NextResponse.json(
        { status: false, message: "El primer y segundo turno deben corresponder a empleados distintos" },
        { status: 400 },
      );
    }

    const bodyEmpresa = parseIntStrict((body as any)?.empresa_id);
    const bodyDivision = parseIntStrict((body as any)?.division_id);
    const bodyContrato = parseIntStrict((body as any)?.contrato_id);
    const bodyPuesto = parseIntStrict((body as any)?.puesto_id);

    let resolvedContratoId = bodyContrato != null && bodyContrato > 0 ? bodyContrato : parseIntStrict(marcaAusente.contrato_id);
    if (!resolvedContratoId || resolvedContratoId <= 0) {
      await reportError(req, "api/mutuos-acuerdos", "POST", 400, "No se pudo determinar el contrato (marca o formulario)");
      return NextResponse.json({ status: false, message: "No se pudo determinar el contrato (marca o formulario)" }, { status: 400 });
    }

    const contrRow = await prisma.e_estructura_contrato.findUnique({
      where: { id: resolvedContratoId },
      select: { id: true, division_id: true },
    });
    const divisionFromContrato = parseIntStrict((contrRow as any)?.division_id);
    const resolvedDivisionId =
      bodyDivision != null && bodyDivision > 0 ? bodyDivision : divisionFromContrato;
    if (!resolvedDivisionId || resolvedDivisionId <= 0) {
      await reportError(req, "api/mutuos-acuerdos", "POST", 400, "No se pudo determinar la división");
      return NextResponse.json({ status: false, message: "No se pudo determinar la división" }, { status: 400 });
    }

    const resolvedEmpresaId =
      bodyEmpresa != null && bodyEmpresa > 0 ? bodyEmpresa : parseIntStrict(marcaAusente.empresa_id);
    const resolvedPuestoId =
      bodyPuesto != null && bodyPuesto > 0 ? bodyPuesto : parseIntStrict(marcaAusente.puesto_id);
    if (!resolvedEmpresaId || resolvedEmpresaId <= 0) {
      await reportError(req, "api/mutuos-acuerdos", "POST", 400, "empresa_id requerido");
      return NextResponse.json({ status: false, message: "empresa_id requerido" }, { status: 400 });
    }
    if (!resolvedPuestoId || resolvedPuestoId <= 0) {
      await reportError(req, "api/mutuos-acuerdos", "POST", 400, "puesto_id requerido");
      return NextResponse.json({ status: false, message: "puesto_id requerido" }, { status: 400 });
    }

    if (!marcaAusente.empleadoFijo_id || !marcaReemplaza.empleadoFijo_id || !marcaAusente.plaza_id || !marcaReemplaza.plaza_id) {
      await reportError(req, "api/mutuos-acuerdos", "POST", 400, "Las marcas seleccionadas no tienen empleado/plaza válidos");
      return NextResponse.json({ status: false, message: "Las marcas seleccionadas no tienen empleado/plaza válidos" }, { status: 400 });
    }

    if (!marcaAusente.cliente_id || !marcaAusente.corpo_id || !marcaReemplaza.cliente_id || !marcaReemplaza.corpo_id) {
      await reportError(req, "api/mutuos-acuerdos", "POST", 400, "Las marcas seleccionadas no tienen cliente/sucursal válidos");
      return NextResponse.json({ status: false, message: "Las marcas seleccionadas no tienen cliente/sucursal válidos" }, { status: 400 });
    }

    const sucursal = await prisma.e_estructura_sucursal.findUnique({
      where: { id: Number(marcaAusente.corpo_id) },
      select: { ejecutivoCuenta_id: true },
    });
    const ejecutivo_cuenta = parseIntStrict((sucursal as any)?.ejecutivoCuenta_id ?? (sucursal as any)?.ejecutivo_cuenta_id);
    if (!ejecutivo_cuenta) {
      await reportError(req, "api/mutuos-acuerdos", "POST", 400, "La sucursal de las marcas no tiene un ejecutivo de cuenta asignado");
      return NextResponse.json(
        { status: false, message: "La sucursal de las marcas no tiene un ejecutivo de cuenta asignado" },
        { status: 400 }
      );
    }

    const shiftValidation = await validateMutuoAcuerdoShiftExchange(marcasAusente, marcasReemplaza);
    if (!shiftValidation.ok) {
      await reportError(req, "api/mutuos-acuerdos", "POST", 400, shiftValidation.message);
      return NextResponse.json({ status: false, message: shiftValidation.message }, { status: 400 });
    }

    const empleadoAusenteId = Number(marcaAusente.empleadoFijo_id);
    const empleadoReemplazaId = Number(marcaReemplaza.empleadoFijo_id);
    const conflictDays = Array.from(new Set([fechaAusenteYmd, fechaReemplazaYmd]));
    const conflictDayStart = dateAtUtcMidnight(conflictDays.reduce((a, b) => (a < b ? a : b)));
    const conflictDayEnd = dateAtUtcMidnight(conflictDays.reduce((a, b) => (a > b ? a : b)));
    const employeeChecks: Array<{ id: number; label: string }> = [
      { id: empleadoAusenteId, label: "del primer turno" },
      { id: empleadoReemplazaId, label: "del segundo turno" },
    ];

    for (const emp of employeeChecks) {
      const overlappingPermit = await callDynamicPrisma({
        req,
        data: {
          action: "GET",
          table: "c_solicitud_permiso",
          operation: "findFirst",
          where: {
            empleado_id: emp.id,
            isActive: true,
            estado: { in: ["pendiente", "aprobado"] },
            fecha_inicio: { lte: conflictDayEnd.toISOString() },
            fecha_fin: { gte: conflictDayStart.toISOString() },
          },
          orderBy: { fecha_inicio: "asc" },
        },
      });

      if (overlappingPermit) {
        const pInicio = ymdFromFecha(overlappingPermit.fecha_inicio);
        const pFin = ymdFromFecha(overlappingPermit.fecha_fin);
        const coversDay =
          pInicio &&
          pFin &&
          conflictDays.some((day) => day >= pInicio && day <= pFin);

        if (coversDay) {
          const msg = `El empleado ${emp.label} tiene un permiso ${overlappingPermit.estado} del ${pInicio} al ${pFin} que entra en conflicto con las fechas del mutuo acuerdo.`;
          await reportError(req, "api/mutuos-acuerdos", "POST", 400, msg);
          return NextResponse.json(
            {
              status: false,
              message: msg,
            },
            { status: 400 }
          );
        }
      }

      const otherMutuos = await callDynamicPrisma({
        req,
        data: {
          action: "GET",
          table: "e_mutuos_acuerdos",
          operation: "findMany",
          where: {
            isActive: true,
            estado: { in: ["pendiente", "aprobado"] },
            OR: [{ empleadoAusente_id: emp.id }, { empleadoReemplaza_id: emp.id }],
          },
        },
      });

      const otherMutuosRows = Array.isArray(otherMutuos) ? otherMutuos : otherMutuos ? [otherMutuos] : [];
      const conflictingOther = otherMutuosRows.find((mutuo: any) => {
        const days = [
          ymdFromFecha(mutuo?.fecha_ausente),
          ymdFromFecha(mutuo?.fecha_reemplaza),
        ].filter((d): d is string => Boolean(d));

        // Compatibilidad con registros legacy (sin fecha_*): inferir desde marcas
        if (days.length === 0) {
          const legacyIds = [
            ...parseMarcaIdsArray(mutuo?.marcas_ausente ?? mutuo?.marcaDiaAusente_id),
            ...parseMarcaIdsArray(mutuo?.marcas_reemplaza ?? mutuo?.marcaDiaReemplaza_id),
          ];
          return false; // se resuelve abajo con carga de marcas si hace falta
        }
        return days.some((day) => conflictDays.includes(day));
      });

      if (conflictingOther) {
        const msg = `El empleado ${emp.label} ya tiene un mutuo acuerdo ${String(conflictingOther.estado || "pendiente")} cuyas fechas entran en conflicto con este intercambio.`;
        await reportError(req, "api/mutuos-acuerdos", "POST", 400, msg);
        return NextResponse.json(
          {
            status: false,
            message: msg,
          },
          { status: 400 }
        );
      }

      // Legacy: mutuos sin fecha_ausente/fecha_reemplaza → comparar por fechas de marcas
      const legacyWithoutFechas = otherMutuosRows.filter(
        (m: any) => !ymdFromFecha(m?.fecha_ausente) && !ymdFromFecha(m?.fecha_reemplaza),
      );
      if (legacyWithoutFechas.length > 0) {
        const otherMarcaIds = Array.from(
          new Set(
            legacyWithoutFechas.flatMap((m: any) => [
              ...parseMarcaIdsArray(m?.marcas_ausente ?? m?.marcaDiaAusente_id),
              ...parseMarcaIdsArray(m?.marcas_reemplaza ?? m?.marcaDiaReemplaza_id),
            ]),
          ),
        );
        const otherMarcas =
          otherMarcaIds.length > 0
            ? await prisma.c_marca_dia.findMany({
                where: { id: { in: otherMarcaIds } },
                select: { id: true, fecha: true },
              })
            : [];
        const otherFechaById = new Map<number, string>(
          otherMarcas
            .map((m) => {
              const ymd = ymdFromFecha(m.fecha);
              return ymd ? ([m.id, ymd] as const) : null;
            })
            .filter((x): x is readonly [number, string] => x != null),
        );
        const legacyConflict = legacyWithoutFechas.find((mutuo: any) => {
          const ids = [
            ...parseMarcaIdsArray(mutuo?.marcas_ausente ?? mutuo?.marcaDiaAusente_id),
            ...parseMarcaIdsArray(mutuo?.marcas_reemplaza ?? mutuo?.marcaDiaReemplaza_id),
          ];
          return ids.some((id) => {
            const day = otherFechaById.get(id);
            return day != null && conflictDays.includes(day);
          });
        });
        if (legacyConflict) {
          const msg = `El empleado ${emp.label} ya tiene un mutuo acuerdo ${String(legacyConflict.estado || "pendiente")} cuyas fechas entran en conflicto con este intercambio.`;
          await reportError(req, "api/mutuos-acuerdos", "POST", 400, msg);
          return NextResponse.json(
            {
              status: false,
              message: msg,
            },
            { status: 400 }
          );
        }
      }
    }

    const createdBy = parseIntStrict((payload as any)?.id) || 0;
    const createdAt = horaAccion ? horaAccion : toZonedTime(new Date(), "America/Costa_Rica");
    const marcasAusenteStr = stringifyMarcaIds(marcasAusenteIds);
    const marcasReemplazaStr = stringifyMarcaIds(marcasReemplazaIds);

    const record = await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "e_mutuos_acuerdos",
        data: {
          cliente_id: Number(marcaAusente.cliente_id),
          corpo_id: Number(marcaAusente.corpo_id),
          empresa_id: Number(resolvedEmpresaId),
          division_id: Number(resolvedDivisionId),
          contrato_id: Number(resolvedContratoId),
          puesto_id: Number(resolvedPuestoId),
          isActive: true,
          estado: "pendiente",
          ejecutivo_cuenta,
          empleadoReemplaza_id: Number(marcaReemplaza.empleadoFijo_id),
          plazaReemplaza_id: Number(marcaReemplaza.plaza_id),
          marcas_reemplaza: marcasReemplazaStr,
          fecha_reemplaza: dateAtUtcMidnight(fechaReemplazaYmd).toISOString(),
          reemplaza_acepta: false,
          reemplaza_acepta_at: null,
          empleadoAusente_id: Number(marcaAusente.empleadoFijo_id),
          plazaAusente_id: Number(marcaAusente.plaza_id),
          marcas_ausente: marcasAusenteStr,
          fecha_ausente: dateAtUtcMidnight(fechaAusenteYmd).toISOString(),
          ausente_acepta: false,
          ausente_acepta_at: null,
          motivo,
          firma_ejecutivo_cuenta_manual: null,
          firma_ejecutivo_cuenta_digital: "",
          firma_responsable,
          file_name: null,
          created_at: createdAt.toISOString(),
          created_by: createdBy,
        },
      },
    });

    let uploadedFileOriginalName: string | null = null;
    if (file_base64 && extension) {
      const documentName = original_name || `archivo.${extension}`;
      const normalizedType = file_type === "document" ? "file" : "file";
      const uploadResp = await uploadDynamicFiles({
        req,
        folderPath: `mutuos-acuerdos/${record.id}`,
        files: [
          {
            type: normalizedType,
            extension,
            name: documentName,
            original_name: documentName,
            mime_type: mime_type || undefined,
            file_base64,
          },
        ],
      });
      const uploaded = Array.isArray(uploadResp?.files) ? uploadResp.files : [];
      if (uploaded[0]?.name) {
        uploadedFileOriginalName = documentName;
      }
    }

    let finalRecord = record;
    if (uploadedFileOriginalName) {
      finalRecord = await callDynamicPrisma({
        req,
        data: {
          action: "UPDATE",
          table: "e_mutuos_acuerdos",
          where: { id: record.id },
          data: { file_name: uploadedFileOriginalName },
        },
      });
    }

    await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_cambios_apps_modules",
        data: {
          nombre_tabla: "e_mutuos_acuerdos",
          registro_id: finalRecord.id,
          cambios: JSON.stringify([{ prop: "__created__", before: null, after: { id: record.id } }]),
          created_at: createdAt.toISOString(),
          created_by: createdBy,
        },
      },
    });

    const empleadoAusente = await prisma.c_empleado.findUnique({
      where: { id: Number(marcaAusente.empleadoFijo_id) },
    });
    const empleadoReemplaza = await prisma.c_empleado.findUnique({
      where: { id: Number(marcaReemplaza.empleadoFijo_id) },
    });

    const recipients = new Set<number>();
    recipients.add(createdBy);

    if (recipients.size > 0) {
      // Al crear: notificar solo a los involucrados (no al ejecutivo; se notifica cuando ambos firmen).
      const puestoAusente = await prisma.e_estructura_puesto.findUnique({
        where: { id: Number(marcaAusente.puesto_id) },
      });

      let sucursalNombreAusente = "Desconocida";
      let clienteNombreAusente = "Desconocido";
      if (puestoAusente) {
        const sucursalAusente = await prisma.e_estructura_sucursal.findUnique({
          where: { id: marcaAusente.corpo_id },
        });
        if (sucursalAusente) {
          sucursalNombreAusente = sucursalAusente.nombre;
          let clienteAusente = await prisma.e_estructura_cliente.findUnique({
            where: { id: marcaAusente.cliente_id },
          });
          if (clienteAusente) {
            clienteNombreAusente = clienteAusente.nombre;
          }
        }
      }

      const puestoReemplaza = await prisma.e_estructura_puesto.findUnique({
        where: { id: Number(marcaReemplaza.puesto_id) },
      });

      let sucursalNombreReemplaza = "Desconocida";
      let clienteNombreReemplaza = "Desconocido";
      if (puestoReemplaza) {
        const sucursalReemplaza = await prisma.e_estructura_sucursal.findUnique({
          where: { id: marcaReemplaza.corpo_id },
        });
        if (sucursalReemplaza) {
          sucursalNombreReemplaza = sucursalReemplaza.nombre;
          let clienteReemplaza = await prisma.e_estructura_cliente.findUnique({
            where: { id: marcaReemplaza.cliente_id },
          });
          if (clienteReemplaza) {
            clienteNombreReemplaza = clienteReemplaza.nombre;
          }
        }
      }

      const employeeIds: number[] = [];
      if (empleadoAusente?.id) employeeIds.push(empleadoAusente.id);
      if (empleadoReemplaza?.id) employeeIds.push(empleadoReemplaza.id);

      const puestoNombreAusente = puestoAusente ? puestoAusente.nombre : "Desconocido";
      const puestoNombreReemplaza = puestoReemplaza ? puestoReemplaza.nombre : "Desconocido";
      const ausenteNombre = empleadoAusente
        ? `${empleadoAusente.nombre ?? ""} ${empleadoAusente.primer_apellido ?? ""} ${empleadoAusente.segundo_apellido ?? ""}`.trim()
        : `ID ${marcaAusente.empleadoFijo_id}`;
      const reemplazaNombre = empleadoReemplaza
        ? `${empleadoReemplaza.nombre ?? ""} ${empleadoReemplaza.primer_apellido ?? ""} ${empleadoReemplaza.segundo_apellido ?? ""}`.trim()
        : `ID ${marcaReemplaza.empleadoFijo_id}`;
      const ausenteCedula = String((empleadoAusente as any)?.cedula ?? "");
      const reemplazaCedula = String((empleadoReemplaza as any)?.cedula ?? "");
      const fecha = createdAt.toISOString().split("T")[0];
      const hora = createdAt.toISOString().split("T")[1];

      const fecha_ausente_cambio = fechaAusenteYmd;
      const fecha_reemplaza_cambio = fechaReemplazaYmd;
      const hora_inicio_ausente = marcaAusente.hora_inicio ? new Date(marcaAusente.hora_inicio).toISOString().split("T")[1].split(".")[0] : '-Sin hora-';
      const hora_inicio_reemplaza = marcaReemplaza.hora_inicio ? new Date(marcaReemplaza.hora_inicio).toISOString().split("T")[1].split(".")[0] : '-Sin hora-';

      await sendNotificationByEmployee(
        req,
        0,
        Array.from(recipients), 
        `Nuevo mutuo acuerdo`,
        `Se creó un mutuo acuerdo el día ${fecha} a las ${hora}. ` +
        `Primer turno: ${ausenteNombre} (cédula ${ausenteCedula || "N/A"}) cede el turno del día ${fecha_ausente_cambio} a las ${hora_inicio_ausente} ` +
        `para el puesto ${puestoNombreAusente} (Sucursal ${sucursalNombreAusente} del cliente ${clienteNombreAusente}) ` +
        `a cambio del segundo turno del día ${fecha_reemplaza_cambio} a las ${hora_inicio_reemplaza} ` +
        `para el puesto ${puestoNombreReemplaza} (Sucursal ${sucursalNombreReemplaza} del cliente ${clienteNombreReemplaza}) ` +
        `de ${reemplazaNombre} (cédula ${reemplazaCedula || "N/A"}).`,
        employeeIds
      ).catch((error) => {
        const msg = error instanceof Error ? error.message : "Error desconocido";
        console.error("Error sending mutuos-acuerdos notifications:", msg);
      });
    }

    return NextResponse.json({ status: true, message: "Mutuo acuerdo creado correctamente", data: finalRecord }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    await reportError(req, "api/mutuos-acuerdos", "POST", 400, errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}
