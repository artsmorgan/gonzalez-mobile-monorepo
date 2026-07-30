import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";
import { prisma } from "../../../utils/prismaClient";
import { uploadDynamicFiles } from "../../../utils/callDynamicFilesApi";
import { toZonedTime } from "date-fns-tz";
import { sendNotificationByEmployee } from "../../../utils/sendNotification";
import { hydratePreexistentRelations, splitIncludeByTableGroup } from "../../../utils/hydratePreexistentIncludes";

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

const parseIntStrict = (value: any) => {
  const n = parseInt(String(value), 10);
  return Number.isNaN(n) ? null : n;
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
 * Solo se permite 1 conflicto y únicamente si ese turno es el que cede en el acuerdo (lo tomará el otro).
 * Con 2+ conflictos se rechaza aunque uno sea el turno cedido al otro empleado.
 */
const validateEmployeeTakingExchangedShift = (
  coveringTurnLabel: string,
  shiftToTake: any,
  shiftToTakeLabel: string,
  /** Marca del turno que cede en el acuerdo (lo tomará el otro turno). */
  marcaCedidaEnAcuerdoId: number,
  originalMarcas: any[]
): ExchangeConflictResult => {
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

  if (conflicts.length === 1 && conflicts[0]!.marcaId === marcaCedidaEnAcuerdoId) {
    return { ok: true };
  }

  const conflictLabels = conflicts.map((c) => formatShiftIntervalLabel(c.marca, c.interval)).join("; ");

  if (conflicts.length >= 2) {
    return {
      ok: false,
      message:
        `El intercambio no es válido: ${coveringTurnLabel} al cubrir el ${shiftToTakeLabel} ` +
        `choca con ${conflicts.length} turnos originales (${conflictLabels}). ` +
        `No se permite el mutuo acuerdo cuando hay más de un conflicto horario, ` +
        `aunque uno de esos turnos sea el que el otro turno asumirá en el acuerdo.`,
    };
  }

  const only = conflicts[0]!;
  return {
    ok: false,
    message:
      `El intercambio no es válido: ${coveringTurnLabel} al cubrir el ${shiftToTakeLabel} ` +
      `choca con un turno original ${formatShiftIntervalLabel(only.marca, only.interval)}, ` +
      `que no es el turno que cede en este acuerdo (marca #${marcaCedidaEnAcuerdoId}).`,
  };
};

const validateMutuoAcuerdoShiftExchange = async (
  marcaAusente: any,
  marcaReemplaza: any
): Promise<ExchangeConflictResult> => {
  const intervalAusente = buildShiftIntervalFromMarca(marcaAusente);
  const intervalReemplaza = buildShiftIntervalFromMarca(marcaReemplaza);
  if (!intervalAusente || !intervalReemplaza) {
    return {
      ok: false,
      message:
        "No se pudo validar el intercambio: ambas marcas deben tener fecha y horarios de entrada/salida (o inicio/fin) definidos.",
    };
  }

  const minStart = Math.min(intervalAusente.startMs, intervalReemplaza.startMs);
  const maxEnd = Math.max(intervalAusente.endMs, intervalReemplaza.endMs);
  const fechaGte = new Date(minStart - 24 * 60 * 60 * 1000);
  const fechaLte = new Date(maxEnd + 24 * 60 * 60 * 1000);

  const empleadoAusenteId = Number(marcaAusente.empleadoFijo_id);
  const empleadoReemplazaId = Number(marcaReemplaza.empleadoFijo_id);
  const marcaDiaAusenteId = Number(marcaAusente.id);
  const marcaDiaReemplazaId = Number(marcaReemplaza.id);

  const [marcasAusente, marcasReemplaza] = await Promise.all([
    fetchMarcasOriginalesEmpleado(empleadoAusenteId, fechaGte, fechaLte),
    fetchMarcasOriginalesEmpleado(empleadoReemplazaId, fechaGte, fechaLte),
  ]);

  const checkSegundoTurno = validateEmployeeTakingExchangedShift(
    "el segundo turno",
    marcaAusente,
    "primer turno",
    marcaDiaReemplazaId,
    marcasReemplaza
  );
  if (!checkSegundoTurno.ok) return checkSegundoTurno;

  const checkPrimerTurno = validateEmployeeTakingExchangedShift(
    "el primer turno",
    marcaReemplaza,
    "segundo turno",
    marcaDiaAusenteId,
    marcasAusente
  );
  if (!checkPrimerTurno.ok) return checkPrimerTurno;

  return { ok: true };
};

export async function GET(req: NextRequest) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) return NextResponse.json({ status: false, expired, message, data: [] }, { status: expired ? 401 : 403 });

    const currentEmployeeId = parseIntStrict((payload as any)?.id);
    if (!currentEmployeeId) return NextResponse.json({ status: false, message: "Empleado inválido", data: [] }, { status: 400 });

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
                    // Ejecutivo asignado: visibles aunque no sean partes
                    ejecutivo_cuenta: myEjecutivoCuentaId,
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
          .flatMap((r: any) => [r.marcaDiaAusente_id, r.marcaDiaReemplaza_id])
          .map((x: any) => parseIntStrict(x))
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
      const marcaAusente = marcaById.get(r.marcaDiaAusente_id);
      const marcaReemplaza = marcaById.get(r.marcaDiaReemplaza_id);
      const estado = String(r?.estado || "").trim().toLowerCase() || "pendiente";
      const pending = estado === "pendiente";

      return {
        ...r,
        cliente_nombre: r.e_estructura_cliente?.nombre || null,
        corpo_nombre: r.e_estructura_sucursal
          ? `${r.e_estructura_sucursal.nro_sucursal ? `${r.e_estructura_sucursal.nro_sucursal} - ` : ""}${r.e_estructura_sucursal.nombre}`
          : null,
        ejecutivo_nombre: r.n_ejecutivo_cuenta?.nombre || null,
        empleado_ausente_nombre: getEmpleadoNombre(r.empleadoAusente_id),
        empleado_reemplaza_nombre: getEmpleadoNombre(r.empleadoReemplaza_id),
        puesto_ausente_nombre: plazaById.get(r.plazaAusente_id)?.nombre || null,
        puesto_reemplaza_nombre: plazaById.get(r.plazaReemplaza_id)?.nombre || null,
        marca_ausente: marcaResumen(marcaAusente),
        marca_reemplaza: marcaResumen(marcaReemplaza),
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
    return NextResponse.json({ status: false, message: errorMessage, data: [] }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) return NextResponse.json({ status: false, expired, message }, { status: expired ? 401 : 403 });

    const body = await req.json();
    const marcaDiaAusente_id = parseIntStrict(body?.marcaDiaAusente_id);
    const marcaDiaReemplaza_id = parseIntStrict(body?.marcaDiaReemplaza_id);
    const motivo = String(body?.motivo || "").trim();
    const horaAccion = parseDateInputToDate(body?.hora_accion);
    const firma_responsable = String(body?.firma_responsable || "").trim();
    const file_base64 = String(body?.file_base64 || "").trim();
    const extension = String(body?.extension || "").replace(".", "").trim();
    const original_name = String(body?.original_name || "").trim();
    const file_type = String(body?.type || "").trim().toLowerCase();
    const mime_type = String(body?.mimeType || "").trim();

    if (!marcaDiaAusente_id || !marcaDiaReemplaza_id || !motivo || !firma_responsable) {
      return NextResponse.json({ status: false, message: "Datos incompletos para crear el mutuo acuerdo" }, { status: 400 });
    }

    if (marcaDiaAusente_id === marcaDiaReemplaza_id) {
      return NextResponse.json({ status: false, message: "Las marcas de primer y segundo turno deben ser diferentes" }, { status: 400 });
    }

    const [marcaAusente, marcaReemplaza] = await Promise.all([
      prisma.c_marca_dia.findUnique({ where: { id: marcaDiaAusente_id } }),
      prisma.c_marca_dia.findUnique({ where: { id: marcaDiaReemplaza_id } }),
    ]);

    if (!marcaAusente || !marcaReemplaza) {
      return NextResponse.json({ status: false, message: "No se encontraron las marcas seleccionadas" }, { status: 404 });
    }

    const bodyEmpresa = parseIntStrict((body as any)?.empresa_id);
    const bodyDivision = parseIntStrict((body as any)?.division_id);
    const bodyContrato = parseIntStrict((body as any)?.contrato_id);
    const bodyPuesto = parseIntStrict((body as any)?.puesto_id);

    let resolvedContratoId = bodyContrato != null && bodyContrato > 0 ? bodyContrato : parseIntStrict(marcaAusente.contrato_id);
    if (!resolvedContratoId || resolvedContratoId <= 0) {
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
      return NextResponse.json({ status: false, message: "No se pudo determinar la división" }, { status: 400 });
    }

    const resolvedEmpresaId =
      bodyEmpresa != null && bodyEmpresa > 0 ? bodyEmpresa : parseIntStrict(marcaAusente.empresa_id);
    const resolvedPuestoId =
      bodyPuesto != null && bodyPuesto > 0 ? bodyPuesto : parseIntStrict(marcaAusente.puesto_id);
    if (!resolvedEmpresaId || resolvedEmpresaId <= 0) {
      return NextResponse.json({ status: false, message: "empresa_id requerido" }, { status: 400 });
    }
    if (!resolvedPuestoId || resolvedPuestoId <= 0) {
      return NextResponse.json({ status: false, message: "puesto_id requerido" }, { status: 400 });
    }

    if (!marcaAusente.empleadoFijo_id || !marcaReemplaza.empleadoFijo_id || !marcaAusente.plaza_id || !marcaReemplaza.plaza_id) {
      return NextResponse.json({ status: false, message: "Las marcas seleccionadas no tienen empleado/plaza válidos" }, { status: 400 });
    }

    if (!marcaAusente.cliente_id || !marcaAusente.corpo_id || !marcaReemplaza.cliente_id || !marcaReemplaza.corpo_id) {
      return NextResponse.json({ status: false, message: "Las marcas seleccionadas no tienen cliente/sucursal válidos" }, { status: 400 });
    }

    const exchangeValidation = await validateMutuoAcuerdoShiftExchange(marcaAusente, marcaReemplaza);
    if (!exchangeValidation.ok) {
      return NextResponse.json({ status: false, message: exchangeValidation.message }, { status: 400 });
    }

    // Obtener ejecutivo_cuenta desde la sucursal (corpo_id) asociada a las marcas
    const sucursal = await prisma.e_estructura_sucursal.findUnique({
      where: { id: Number(marcaAusente.corpo_id) },
      select: { ejecutivoCuenta_id: true },
    });
    const ejecutivo_cuenta = parseIntStrict((sucursal as any)?.ejecutivoCuenta_id ?? (sucursal as any)?.ejecutivo_cuenta_id);
    if (!ejecutivo_cuenta) {
      return NextResponse.json(
        { status: false, message: "La sucursal de las marcas no tiene un ejecutivo de cuenta asignado" },
        { status: 400 }
      );
    }

    const alreadyUsed = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "e_mutuos_acuerdos",
        operation: "findFirst",
        where: {
          AND: [
            { isActive: true },
            {
              OR: [
                { marcaDiaAusente_id: { in: [marcaDiaAusente_id, marcaDiaReemplaza_id] } },
                { marcaDiaReemplaza_id: { in: [marcaDiaAusente_id, marcaDiaReemplaza_id] } },
              ],
            },
          ],
        },
      },
    });
    if (alreadyUsed) {
      return NextResponse.json({ status: false, message: "Una de las marcas seleccionadas ya está asociada a otro mutuo acuerdo" }, { status: 400 });
    }

    // Conflicto con permisos / otros mutuos (ambas fechas, ambos empleados)
    const empleadoAusenteId = Number(marcaAusente.empleadoFijo_id);
    const empleadoReemplazaId = Number(marcaReemplaza.empleadoFijo_id);
    const ymdFromFecha = (fecha: Date | string | null | undefined): string | null => {
      if (!fecha) return null;
      const d = fecha instanceof Date ? fecha : new Date(String(fecha));
      if (Number.isNaN(d.getTime())) return null;
      return d.toISOString().split("T")[0];
    };
    const dayAusente = ymdFromFecha(marcaAusente.fecha);
    const dayReemplaza = ymdFromFecha(marcaReemplaza.fecha);
    const conflictDays = Array.from(new Set([dayAusente, dayReemplaza].filter(Boolean) as string[]));
    if (conflictDays.length === 0) {
      return NextResponse.json(
        { status: false, message: "No se pudieron determinar las fechas de las marcas seleccionadas" },
        { status: 400 }
      );
    }

    const conflictDayStart = `${conflictDays.reduce((a, b) => (a < b ? a : b))}T00:00:00.000Z`;
    const conflictDayEnd = `${conflictDays.reduce((a, b) => (a > b ? a : b))}T00:00:00.000Z`;
    const employeeChecks: Array<{ id: number; label: string }> = [
      { id: empleadoAusenteId, label: "ausente" },
      { id: empleadoReemplazaId, label: "reemplazo" },
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
            fecha_inicio: { lte: conflictDayEnd },
            fecha_fin: { gte: conflictDayStart },
          },
          orderBy: { fecha_inicio: "asc" },
        },
      });

      if (overlappingPermit) {
        // Confirmar que el permiso cubre al menos uno de los días del mutuo (no solo el hueco intermedio)
        const pInicio = ymdFromFecha(overlappingPermit.fecha_inicio);
        const pFin = ymdFromFecha(overlappingPermit.fecha_fin);
        const coversDay =
          pInicio &&
          pFin &&
          conflictDays.some((day) => day >= pInicio && day <= pFin);

        if (coversDay) {
          return NextResponse.json(
            {
              status: false,
              message: `El empleado ${emp.label} tiene un permiso ${overlappingPermit.estado} del ${pInicio} al ${pFin} que entra en conflicto con las fechas del mutuo acuerdo.`,
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
      if (otherMutuosRows.length > 0) {
        const otherMarcaIds = Array.from(
          new Set(
            otherMutuosRows
              .flatMap((m: any) => [parseIntStrict(m?.marcaDiaAusente_id), parseIntStrict(m?.marcaDiaReemplaza_id)])
              .filter((id): id is number => id != null && id > 0)
          )
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
            .filter((x): x is readonly [number, string] => x != null)
        );

        const conflictingOther = otherMutuosRows.find((mutuo: any) => {
          const ids = [
            parseIntStrict(mutuo?.marcaDiaAusente_id),
            parseIntStrict(mutuo?.marcaDiaReemplaza_id),
          ].filter((id): id is number => id != null && id > 0);
          return ids.some((id) => {
            const day = otherFechaById.get(id);
            return day != null && conflictDays.includes(day);
          });
        });

        if (conflictingOther) {
          return NextResponse.json(
            {
              status: false,
              message: `El empleado ${emp.label} ya tiene un mutuo acuerdo ${String(conflictingOther.estado || "pendiente")} cuyas fechas entran en conflicto con este intercambio.`,
            },
            { status: 400 }
          );
        }
      }
    }

    const createdBy = parseIntStrict((payload as any)?.id) || 0;
    const createdAt = horaAccion ? horaAccion : toZonedTime(new Date(), "America/Costa_Rica");

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
          marcaDiaReemplaza_id,
          reemplaza_acepta: false,
          reemplaza_acepta_at: null,
          empleadoAusente_id: Number(marcaAusente.empleadoFijo_id),
          plazaAusente_id: Number(marcaAusente.plaza_id),
          marcaDiaAusente_id,
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
    const employeePlazas = await prisma.c_empleado_plaza.findMany({
      where: { ejecutivoCuenta_id: ejecutivo_cuenta },
      select: { empleado_id: true },
    });
    
    recipients.add(createdBy)

    if (recipients.size > 0) {
      const empleados_ejecutivos = await prisma.c_empleado.findMany({
        where: { supervisor_id: ejecutivo_cuenta },
      });

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

      const employeeIds = (Array.isArray(empleados_ejecutivos) ? empleados_ejecutivos : []).map((e: any) => e.id);
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

      const fecha_ausente_cambio = marcaAusente.fecha ? new Date(marcaAusente.fecha).toISOString().split("T")[0] : '-Sin fecha-';
      const fecha_reemplaza_cambio = marcaReemplaza.fecha ? new Date(marcaReemplaza.fecha).toISOString().split("T")[0] : '-Sin fecha-';
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
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}
