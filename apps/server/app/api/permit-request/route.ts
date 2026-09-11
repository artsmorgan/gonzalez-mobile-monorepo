import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";
import { toZonedTime } from "date-fns-tz";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";
import { prisma } from "../../../utils/prismaClient";
import { sendNotificationByEmployee } from "../../../utils/sendNotification";
import { uploadDynamicFiles } from "../../../utils/callDynamicFilesApi";
import { getPermitTurnosFromPlanillasRange } from "../../../utils/getPermitTurnosFromPlanillasRange";
import { parseMarcaIdsArray, ymdFromFecha } from "../../../utils/mutuosAcuerdosMarcas";
import { reportError } from "../../../utils/reportError";

const parseIntStrict = (value: unknown): number | null => {
  const n = parseInt(String(value), 10);
  return Number.isNaN(n) ? null : n;
};

/** Acepta base64 puro o data URL (`data:*;base64,...`). */
const stripDataUrlBase64 = (raw: string): string => {
  const s = String(raw || "").trim();
  if (!s) return "";
  const comma = s.indexOf(",");
  if (s.toLowerCase().startsWith("data:") && comma >= 0) return s.slice(comma + 1).trim();
  return s;
};

const parseDateInputToDate = (input: unknown): Date | null => {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  const s = String(input).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-");
    const parsed = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10), 0, 0, 0, 0);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? null : parsed;
};

const getTurnosFromRange = async (
  planillasToken: string,
  empleadoCodigo: string,
  fechaInicio: Date,
  fechaFin: Date,
  plazaId: number | null
) => {
  return getPermitTurnosFromPlanillasRange({
    planillasToken,
    empleadoCodigo,
    fechaInicio,
    fechaFin,
    plazaId,
  });
};

const safeParseTurnos = (raw: unknown) => {
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

type PermitFileInput = {
  type: string;
  extension: string;
  original_name?: string;
  file_base64: string;
  mimeType?: string;
  is_main?: boolean;
};

export async function GET(req: NextRequest) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) return NextResponse.json({ status: false, expired, message, data: [] }, { status: expired ? 401 : 403 });

    const currentEmployeeId = parseIntStrict((payload as any)?.id);
    if (!currentEmployeeId) {
      await reportError(req, "api/permit-request", "GET", 400, "Empleado inválido");
      return NextResponse.json({ status: false, message: "Empleado inválido", data: [] }, { status: 400 });
    }

    const empleado = await prisma.c_empleado.findUnique({ where: { id: currentEmployeeId } });
    const mySupervisorId = parseIntStrict(empleado?.supervisor_id);

    const mode = String(req.nextUrl.searchParams.get("mode") ?? "").trim().toLowerCase();

    // mode=mine: solo solicitudes propias del empleado autenticado.
    // Sin mode (ejecutivo): propias + solicitudes donde ejecutivo_cuenta === supervisor_id.
    const visibilityWhere: any =
      mode === "mine"
        ? { empleado_id: currentEmployeeId }
        : mySupervisorId
          ? { OR: [{ empleado_id: currentEmployeeId }, { ejecutivo_cuenta: mySupervisorId }] }
          : { empleado_id: currentEmployeeId };

    const where: any = { AND: [visibilityWhere, { isActive: true }] };

    const records = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_solicitud_permiso",
        operation: "findMany",
        where,
        orderBy: { created_at: "desc" },
      },
    });

    const rows = Array.isArray(records) ? records : [];
    const empleadoIds = Array.from(
      new Set(
        rows
          .flatMap((r: any) => {
            const turnos = safeParseTurnos(r.turnos);
            const perTurno = turnos.map((t: any) => parseIntStrict(t?.reemplazo_id)).filter(Boolean) as number[];
            return [parseIntStrict(r.empleado_id), parseIntStrict(r.reemplazo_obligatorio), ...perTurno];
          })
          .filter(Boolean)
      )
    ) as number[];

    const empleados = empleadoIds.length
      ? await prisma.c_empleado.findMany({
          where: { id: { in: empleadoIds } },
          select: { id: true, nombre: true, primer_apellido: true, segundo_apellido: true, codigo: true },
        })
      : [];

    const empleadoById = new Map<number, any>(empleados.map((e: any) => [e.id, e]));
    const empleadoNombre = (id?: number | null) => {
      if (!id) return null;
      const e = empleadoById.get(id);
      if (!e) return null;
      return [e.nombre, e.primer_apellido, e.segundo_apellido].filter(Boolean).join(" ").trim() || null;
    };

    const recordIds = rows.map((r: any) => parseIntStrict(r?.id)).filter(Boolean) as number[];
    const files = recordIds.length
      ? await callDynamicPrisma({
          req,
          data: {
            action: "GET",
            table: "c_archivos_solicitud_permiso",
            operation: "findMany",
            where: { solicitud_id: { in: recordIds } },
            orderBy: [{ is_main: "desc" }, { id: "asc" }],
          },
        })
      : [];
    const filesArray = Array.isArray(files) ? files : [];
    const filesBySolicitud = new Map<number, any[]>();
    for (const f of filesArray) {
      const solicitudId = parseIntStrict((f as any)?.solicitud_id);
      if (!solicitudId) continue;
      const prev = filesBySolicitud.get(solicitudId) || [];
      prev.push({
        id: f.id,
        name: f.name,
        original_name: f.original_name,
        type: f.type,
        extension: f.extension,
        is_main: Boolean(f.is_main),
      });
      filesBySolicitud.set(solicitudId, prev);
    }

    const mapped = rows.map((r: any) => {
      const turnos = safeParseTurnos(r.turnos).map((t: any) => ({
        ...t,
        reemplazo_nombre: empleadoNombre(parseIntStrict(t?.reemplazo_id)),
      }));
      const isOwn = Number(r.empleado_id) === currentEmployeeId;
      // Ejecutivo: el usuario actual es el asignado (por id o por supervisor_id). Si envía a su nombre y se asigna a sí mismo, también puede completar y descargar.
      const isExecutiveForRecord =
        Number(r.ejecutivo_cuenta) === currentEmployeeId ||
        (Boolean(mySupervisorId) && Number(r.ejecutivo_cuenta) === Number(mySupervisorId));
      const estado = String((r as any)?.estado || "").trim().toLowerCase();
      const canCompleteByExecutive =
        isExecutiveForRecord &&
        estado === "pendiente" &&
        (!r.firma_ejecutivo_cuenta_digital || !r.firma_ejecutivo_cuenta_manual);
      return {
        ...r,
        turnos,
        archivos: filesBySolicitud.get(Number(r.id)) || [],
        empleado_nombre: empleadoNombre(parseIntStrict(r.empleado_id)),
        reemplazo_obligatorio_nombre: empleadoNombre(parseIntStrict(r.reemplazo_obligatorio)),
        is_own_record: isOwn,
        can_complete_by_executive: canCompleteByExecutive,
        is_executive_for_record: isExecutiveForRecord,
      };
    });

    return NextResponse.json({ status: true, message: "Solicitudes obtenidas correctamente", data: mapped }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    await reportError(req, "api/permit-request", "GET", 500, errorMessage);
    return NextResponse.json({ status: false, message: errorMessage, data: [] }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) return NextResponse.json({ status: false, expired, message }, { status: expired ? 401 : 403 });

    const currentEmployeeId = parseIntStrict((payload as any)?.id);
    if (!currentEmployeeId) {
      await reportError(req, "api/permit-request", "POST", 400, "Empleado inválido");
      return NextResponse.json({ status: false, message: "Empleado inválido" }, { status: 400 });
    }

    const planillasToken =
      decodeURIComponent(req.headers.get("Planillas-Token") ?? "").trim() || null;
    if (!planillasToken) {
      await reportError(req, "api/permit-request", "POST", 400, "Token de Planillas no encontrado");
      return NextResponse.json(
        { status: false, message: "Token de Planillas no encontrado" },
        { status: 400 }
      );
    }

    const empleadoForTurnos = await prisma.c_empleado.findUnique({ where: { id: currentEmployeeId } });
    if (!empleadoForTurnos) {
      await reportError(req, "api/permit-request", "POST", 404, "Empleado no encontrado");
      return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 404 });
    }

    const body = await req.json();
    const tipo = String(body?.tipo || "").trim();
    const plazaId = parseIntStrict(body?.plaza_id);

    const fechaInicio = `${body?.fecha_inicio}T00:00:00.000Z`;
    const fechaFin = `${body?.fecha_fin}T00:00:00.000Z`;
    const horaAccion = parseDateInputToDate(body?.hora_accion);
    const motivo = String(body?.motivo ?? body?.comentarios ?? "").trim();
    const firmaResponsable = String(body?.firma_responsable || "").trim();
    const firmaEmpleadoManual = stripDataUrlBase64(String(body?.firma_empleado_manual || "").trim());

    const rawFiles = Array.isArray(body?.files) ? body.files : [];
    const legacyFileBase64 = String(body?.file_base64 || "").trim();
    const legacyExtension = String(body?.extension || "").replace(".", "").trim();
    const legacyOriginalName = String(body?.original_name || "").trim();
    const legacyFileType = String(body?.type || "file").trim();
    const legacyMimeType = String(body?.mimeType || "").trim();

    const normalizedFilesRaw: PermitFileInput[] = [
      ...rawFiles,
      ...(legacyFileBase64 && legacyExtension
        ? [
            {
              type: legacyFileType || "file",
              extension: legacyExtension,
              original_name: legacyOriginalName || `solicitud-permiso.${legacyExtension}`,
              file_base64: legacyFileBase64,
              mimeType: legacyMimeType || undefined,
              is_main: true,
            } as PermitFileInput,
          ]
        : []),
    ]
      .map((f: any) => ({
        type: String(f?.type || "file").trim() || "file",
        extension: String(f?.extension || "").replace(".", "").trim(),
        original_name: String(f?.original_name || "").trim(),
        file_base64: stripDataUrlBase64(String(f?.file_base64 || "").trim()),
        mimeType: String(f?.mimeType || "").trim() || undefined,
        is_main: Boolean(f?.is_main),
      }))
      .filter((f) => f.extension && f.file_base64);

    const mainMarkedIndex = normalizedFilesRaw.findIndex((f) => f.is_main);
    const normalizedFiles = normalizedFilesRaw.map((f, idx) => ({
      ...f,
      is_main: mainMarkedIndex >= 0 ? idx === mainMarkedIndex : idx === 0,
    }));

    if (!tipo || (tipo !== "Con goce" && tipo !== "Sin goce")) {
      await reportError(req, "api/permit-request", "POST", 400, "Tipo inválido. Debe ser Con goce o Sin goce");
      return NextResponse.json({ status: false, message: "Tipo inválido. Debe ser Con goce o Sin goce" }, { status: 400 });
    }
    if (!fechaInicio || !fechaFin) {
      await reportError(req, "api/permit-request", "POST", 400, "Debes enviar fecha_inicio y fecha_fin válidas");
      return NextResponse.json({ status: false, message: "Debes enviar fecha_inicio y fecha_fin válidas" }, { status: 400 });
    }
    if (new Date(fechaInicio).getTime() > new Date(fechaFin).getTime()) {
      await reportError(req, "api/permit-request", "POST", 400, "fecha_inicio no puede ser mayor a fecha_fin");
      return NextResponse.json({ status: false, message: "fecha_inicio no puede ser mayor a fecha_fin" }, { status: 400 });
    }

    // Conflicto si el nuevo rango se solapa con otro permiso pendiente o aprobado del mismo empleado
    const overlappingPermit = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_solicitud_permiso",
        operation: "findFirst",
        where: {
          empleado_id: currentEmployeeId,
          isActive: true,
          estado: { in: ["pendiente", "aprobado"] },
          fecha_inicio: { lte: fechaFin },
          fecha_fin: { gte: fechaInicio },
        },
        orderBy: { fecha_inicio: "asc" },
      },
    });

    if (overlappingPermit) {
      const overlapInicio = new Date(overlappingPermit.fecha_inicio).toISOString().split("T")[0];
      const overlapFin = new Date(overlappingPermit.fecha_fin).toISOString().split("T")[0];
      const conflictMessage = `Ya tienes un permiso ${overlappingPermit.estado} del ${overlapInicio} al ${overlapFin} que entra en conflicto con las fechas seleccionadas. No se puede crear la solicitud.`;
      await reportError(req, "api/permit-request", "POST", 400, conflictMessage);
      return NextResponse.json(
        {
          status: false,
          message: conflictMessage,
        },
        { status: 400 }
      );
    }

    // Conflicto si hay mutuo acuerdo pendiente/aprobado del empleado cuya marca cae en el rango
    const overlappingMutuos = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "e_mutuos_acuerdos",
        operation: "findMany",
        where: {
          isActive: true,
          estado: { in: ["pendiente", "aprobado"] },
          OR: [
            { empleadoAusente_id: currentEmployeeId },
            { empleadoReemplaza_id: currentEmployeeId },
          ],
        },
      },
    });

    const mutuosRows = Array.isArray(overlappingMutuos)
      ? overlappingMutuos
      : overlappingMutuos
        ? [overlappingMutuos]
        : [];

    if (mutuosRows.length > 0) {
      const permitStartYmd = ymdFromFecha(fechaInicio);
      const permitEndYmd = ymdFromFecha(fechaFin);
      const permitStartMs = permitStartYmd ? new Date(`${permitStartYmd}T00:00:00.000Z`).getTime() : new Date(fechaInicio).getTime();
      const permitEndMs = permitEndYmd ? new Date(`${permitEndYmd}T00:00:00.000Z`).getTime() : new Date(fechaFin).getTime();

      const ymdInPermitRange = (ymd: string | null): boolean => {
        if (!ymd) return false;
        const dayMs = new Date(`${ymd}T00:00:00.000Z`).getTime();
        return dayMs >= permitStartMs && dayMs <= permitEndMs;
      };

      // Legacy: mutuos sin fecha_ausente/fecha_reemplaza → resolver por marcas
      const legacyWithoutFechas = mutuosRows.filter(
        (m: any) => !ymdFromFecha(m?.fecha_ausente) && !ymdFromFecha(m?.fecha_reemplaza),
      );
      const legacyMarcaIds = Array.from(
        new Set(
          legacyWithoutFechas.flatMap((m: any) => [
            ...parseMarcaIdsArray(m?.marcas_ausente ?? m?.marcaDiaAusente_id),
            ...parseMarcaIdsArray(m?.marcas_reemplaza ?? m?.marcaDiaReemplaza_id),
          ]),
        ),
      );
      const marcasMutuo =
        legacyMarcaIds.length > 0
          ? await prisma.c_marca_dia.findMany({
              where: { id: { in: legacyMarcaIds } },
              select: { id: true, fecha: true },
            })
          : [];
      const marcaFechaById = new Map<number, string>(
        marcasMutuo
          .map((m) => [m.id, ymdFromFecha(m.fecha)] as const)
          .filter((entry): entry is [number, string] => !!entry[1]),
      );

      const mutuoDatesForEmployee = (mutuo: any): string[] => {
        const dates: string[] = [];
        const isAusente = Number(mutuo.empleadoAusente_id) === currentEmployeeId;
        const isReemplaza = Number(mutuo.empleadoReemplaza_id) === currentEmployeeId;

        if (isAusente || (!isAusente && !isReemplaza)) {
          const fa = ymdFromFecha(mutuo?.fecha_ausente);
          if (fa) dates.push(fa);
          else {
            for (const id of parseMarcaIdsArray(mutuo?.marcas_ausente ?? mutuo?.marcaDiaAusente_id)) {
              const y = marcaFechaById.get(id);
              if (y) dates.push(y);
            }
          }
        }
        if (isReemplaza || (!isAusente && !isReemplaza)) {
          const fr = ymdFromFecha(mutuo?.fecha_reemplaza);
          if (fr) dates.push(fr);
          else {
            for (const id of parseMarcaIdsArray(mutuo?.marcas_reemplaza ?? mutuo?.marcaDiaReemplaza_id)) {
              const y = marcaFechaById.get(id);
              if (y) dates.push(y);
            }
          }
        }
        return [...new Set(dates)];
      };

      const conflictingMutuo = mutuosRows.find((mutuo: any) =>
        mutuoDatesForEmployee(mutuo).some((ymd) => ymdInPermitRange(ymd)),
      );

      if (conflictingMutuo) {
        const estadoMutuo = String(conflictingMutuo.estado || "pendiente").trim() || "pendiente";
        const relatedDates = mutuoDatesForEmployee(conflictingMutuo);
        const fechasTxt = relatedDates.length ? relatedDates.join(" / ") : "fechas asociadas";
        const conflictMutuoMessage = `Ya tienes un mutuo acuerdo ${estadoMutuo} (${fechasTxt}) que entra en conflicto con las fechas seleccionadas. No se puede crear la solicitud.`;

        await reportError(req, "api/permit-request", "POST", 400, conflictMutuoMessage);
        return NextResponse.json(
          {
            status: false,
            message: conflictMutuoMessage,
          },
          { status: 400 }
        );
      }
    }

    if (!motivo) {
      await reportError(req, "api/permit-request", "POST", 400, "El motivo es obligatorio");
      return NextResponse.json({ status: false, message: "El motivo es obligatorio" }, { status: 400 });
    }
    if (!firmaResponsable || firmaResponsable.length < 10) {
      await reportError(req, "api/permit-request", "POST", 400, "La firma responsable es obligatoria");
      return NextResponse.json({ status: false, message: "La firma responsable es obligatoria" }, { status: 400 });
    }
    if (!firmaEmpleadoManual || firmaEmpleadoManual.length < 20) {
      await reportError(req, "api/permit-request", "POST", 400, "La firma manual del empleado es obligatoria");
      return NextResponse.json({ status: false, message: "La firma manual del empleado es obligatoria" }, { status: 400 });
    }
    if (!plazaId) {
      await reportError(req, "api/permit-request", "POST", 400, "Debes seleccionar una plaza");
      return NextResponse.json({ status: false, message: "Debes seleccionar una plaza" }, { status: 400 });
    }

    // Resolver ejecutivo_cuenta a partir de la sucursal asociada a la plaza seleccionada
    const plaza = await prisma.e_estructura_plazas.findFirst({
      where: { id: plazaId },
      select: { puesto_id: true },
    });

    const plazaPuestoId = parseIntStrict(plaza?.puesto_id);
    if (!plazaPuestoId) {
      await reportError(req, "api/permit-request", "POST", 400, "La plaza seleccionada no tiene un puesto asociado");
      return NextResponse.json(
        { status: false, message: "La plaza seleccionada no tiene un puesto asociado" },
        { status: 400 }
      );
    }

    const puesto = await prisma.e_estructura_puesto.findFirst({ where: { id: plazaPuestoId } });

    const sucursalId = parseIntStrict(puesto?.sucursal_id);
    if (!sucursalId) {
      await reportError(req, "api/permit-request", "POST", 400, "El puesto asociado a la plaza no tiene una sucursal válida");
      return NextResponse.json(
        { status: false, message: "El puesto asociado a la plaza no tiene una sucursal válida" },
        { status: 400 }
      );
    }

    const sucursal = await prisma.e_estructura_sucursal.findFirst({ where: { id: sucursalId } });

    const contratoIdFromSucursal = parseIntStrict(sucursal?.contrato_id);
    if (!contratoIdFromSucursal) {
      await reportError(req, "api/permit-request", "POST", 400, "La sucursal asociada no tiene un contrato válido");
      return NextResponse.json(
        { status: false, message: "La sucursal asociada no tiene un contrato válido" },
        { status: 400 }
      );
    }

    const contrato = await prisma.e_estructura_contrato.findFirst({ where: { id: contratoIdFromSucursal } });
    if (!contrato) {
      await reportError(req, "api/permit-request", "POST", 404, "No se encontró el contrato de la sucursal");
      return NextResponse.json({ status: false, message: "No se encontró el contrato de la sucursal" }, { status: 404 });
    }

    let nombre_cliente = "";
    if (contrato) {
      const cliente = await prisma.e_estructura_cliente.findFirst({
        where: { id: contrato.cliente_id ?? undefined },
      });
      if (cliente) {
        nombre_cliente = cliente.nombre;
      }
    }

    const ejecutivoCuenta = parseIntStrict(sucursal?.ejecutivoCuenta_id);
    if (!ejecutivoCuenta) {
      await reportError(req, "api/permit-request", "POST", 400, "La sucursal seleccionada no tiene un ejecutivo de cuenta asignado");
      return NextResponse.json(
        { status: false, message: "La sucursal seleccionada no tiene un ejecutivo de cuenta asignado" },
        { status: 400 }
      );
    }

    const turnos = await getTurnosFromRange(
      planillasToken,
      String(empleadoForTurnos.codigo || ""),
      new Date(fechaInicio),
      new Date(fechaFin),
      plazaId
    );
    if (!turnos.length) {
      await reportError(req, "api/permit-request", "POST", 400, "No hay turnos en el rango de fechas. El usuario está libre esos días.");
      return NextResponse.json(
        { status: false, message: "No hay turnos en el rango de fechas. El usuario está libre esos días." },
        { status: 400 }
      );
    }

    const resolvedHierarchy = {
      empresa_id: parseIntStrict((contrato as any)?.empresa_id),
      cliente_id: parseIntStrict((contrato as any)?.cliente_id),
      division_id: parseIntStrict((contrato as any)?.division_id),
      contrato_id: contratoIdFromSucursal,
      corpo_id: sucursalId,
      puesto_id: plazaPuestoId,
    };

    const bodyHierarchy = {
      empresa_id: parseIntStrict(body?.empresa_id),
      cliente_id: parseIntStrict(body?.cliente_id),
      division_id: parseIntStrict(body?.division_id),
      contrato_id: parseIntStrict(body?.contrato_id),
      corpo_id: parseIntStrict(body?.corpo_id),
      puesto_id: parseIntStrict(body?.puesto_id),
    };

    const hierarchyKeys = ["empresa_id", "cliente_id", "division_id", "contrato_id", "corpo_id", "puesto_id"] as const;
    const bodyHierarchyComplete = hierarchyKeys.every((k) => bodyHierarchy[k] != null);

    if (bodyHierarchyComplete) {
      for (const k of hierarchyKeys) {
        if (
          k === "division_id" &&
          resolvedHierarchy.division_id == null &&
          bodyHierarchy.division_id != null
        ) {
          const restKeys = hierarchyKeys.filter((x) => x !== "division_id");
          const restOk = restKeys.every((rk) => Number(bodyHierarchy[rk]) === Number(resolvedHierarchy[rk]));
          if (!restOk) {
            const hierarchyMismatchMessage =
              "La jerarquía enviada no coincide con la plaza seleccionada. Revisa tu marca actual y la plaza del permiso.";
            await reportError(req, "api/permit-request", "POST", 400, hierarchyMismatchMessage);
            return NextResponse.json(
              {
                status: false,
                message: hierarchyMismatchMessage,
              },
              { status: 400 }
            );
          }
          continue;
        }
        if (Number(bodyHierarchy[k]) !== Number(resolvedHierarchy[k])) {
          const hierarchyMismatchMessage =
            "La jerarquía enviada no coincide con la plaza seleccionada. Revisa tu marca actual y la plaza del permiso.";
          await reportError(req, "api/permit-request", "POST", 400, hierarchyMismatchMessage);
          return NextResponse.json(
            {
              status: false,
              message: hierarchyMismatchMessage,
            },
            { status: 400 }
          );
        }
      }
    }

    const hierarchyForCreate = {
      ...resolvedHierarchy,
      division_id: resolvedHierarchy.division_id ?? bodyHierarchy.division_id,
    };

    for (const k of hierarchyKeys) {
      if (hierarchyForCreate[k] == null) {
        const resolveMessage = `No se pudo resolver ${k} para guardar la solicitud`;
        await reportError(req, "api/permit-request", "POST", 400, resolveMessage);
        return NextResponse.json(
          { status: false, message: resolveMessage },
          { status: 400 }
        );
      }
    }

    const now = horaAccion ? horaAccion.toISOString() : toZonedTime(new Date(), "America/Costa_Rica").toISOString();
    const created = await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_solicitud_permiso",
        operation: "create",
        data: {
          empleado_id: currentEmployeeId,
          plaza_id: plazaId,
          tipo,
          estado: "pendiente",
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
          ejecutivo_cuenta: ejecutivoCuenta,
          motivo,
          reemplazo_obligatorio: null,
          turnos: JSON.stringify(turnos),
          firma_responsable: firmaResponsable,
          firma_empleado_manual: firmaEmpleadoManual,
          observaciones: null,
          firma_ejecutivo_cuenta_digital: null,
          firma_ejecutivo_cuenta_manual: null,
          created_at: now,
          created_by: currentEmployeeId,
          empresa_id: hierarchyForCreate.empresa_id,
          cliente_id: hierarchyForCreate.cliente_id,
          division_id: hierarchyForCreate.division_id,
          contrato_id: hierarchyForCreate.contrato_id,
          corpo_id: hierarchyForCreate.corpo_id,
          puesto_id: hierarchyForCreate.puesto_id,
          isActive: true,
        },
      },
    });

    const uploadedFiles: any[] = [];
    for (const file of normalizedFiles) {
      const uploadResp = await uploadDynamicFiles({
        req,
        folderPath: `permit-request/${created.id}`,
        files: [
          {
            type: file.type,
            extension: file.extension,
            original_name: file.original_name || `adjunto.${file.extension}`,
            mime_type: file.mimeType || undefined,
            file_base64: file.file_base64,
          },
        ],
      });
      const uploaded = Array.isArray(uploadResp?.files) ? uploadResp.files : [];
      const uploadedFile = uploaded[0];
      const storedName = String(uploadedFile?.name || "").trim();
      if (!storedName) continue;

      const createdFile = await callDynamicPrisma({
        req,
        data: {
          action: "POST",
          table: "c_archivos_solicitud_permiso",
          operation: "create",
          data: {
            solicitud_id: created.id,
            name: storedName,
            type: file.type,
            extension: file.extension,
            original_name: file.original_name || storedName,
            is_main: Boolean(file.is_main),
          },
        },
      });
      uploadedFiles.push(createdFile);
    }

    await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_cambios_apps_modules",
        operation: "create",
        data: {
          nombre_tabla: "c_solicitud_permiso",
          registro_id: created.id,
          cambios: JSON.stringify([{ prop: "__created__", before: null, after: { id: created.id } }]),
          created_at: now,
          created_by: currentEmployeeId,
        },
      },
    });

    const recipients = new Set<number>();
    const employeePlazas = await prisma.c_empleado_plaza.findMany({
      where: { ejecutivoCuenta_id: ejecutivoCuenta },
      select: { empleado_id: true },
    });
    for (const row of employeePlazas) {
      const empId = parseIntStrict(row.empleado_id);
      if (empId) recipients.add(empId);
    }
    if (recipients.size > 0) {
      // No bloquear la respuesta por notificaciones; si falla, el registro ya fue creado.

      const empleadoNotify = await prisma.c_empleado.findUnique({ where: { id: currentEmployeeId } });

      if (empleadoNotify) {
        const empleados_ejecutivos = await prisma.c_empleado.findMany({ where: { supervisor_id: ejecutivoCuenta } });

        let empleado_nombre = "";
        if (empleadoNotify) {
          empleado_nombre = `${empleadoNotify.nombre??"" } ${empleadoNotify.primer_apellido??""} ${empleadoNotify.segundo_apellido??""}`;
        }

        let tipo_lowercase = tipo.toLowerCase();

        let fecha = now.split("T")[0];
        let hora = now.split("T")[1];

        let fecha_desde = fechaInicio.split("T")[0];
        let fecha_hasta = fechaFin.split("T")[0];

        console.log("puesto", puesto);

        await sendNotificationByEmployee(
          req,
          0,
          Array.from(recipients),
          `Nueva solicitud de permiso ${tipo_lowercase}`,
          `El empleado ${empleado_nombre} con cédula ${empleadoNotify.cedula??""} ha creado una nueva solicitud de permiso ${tipo_lowercase} para el puesto ${puesto?.nombre ?? ""} (Sucursal ${sucursal?.nombre ?? ""} del cliente ${nombre_cliente}) en las fechas desde ${fecha_desde} hasta ${fecha_hasta} el día ${fecha} a las ${hora}`,
           empleados_ejecutivos.map((e: any) => e.id),
        ).catch((error) => {
          const msg = error instanceof Error ? error.message : "Error desconocido";
          console.error("Error sending permit-request notifications:", msg);
        });
      }
    }

    return NextResponse.json(
      {
        status: true,
        message: "Solicitud de permiso creada correctamente",
        data: { ...created, turnos, archivos: uploadedFiles },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    await reportError(req, "api/permit-request", "POST", 500, errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}

