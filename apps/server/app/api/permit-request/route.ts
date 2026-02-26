import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";
import { toZonedTime } from "date-fns-tz";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";
import { sendNotificationByEmployee } from "../../../utils/sendNotification";
import { uploadDynamicFiles } from "../../../utils/callDynamicFilesApi";

const parseIntStrict = (value: unknown): number | null => {
  const n = parseInt(String(value), 10);
  return Number.isNaN(n) ? null : n;
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

const formatHoraLabel = (value?: string | null) => {
  if (!value) return null;
  const str = String(value).trim();
  if (!str) return null;
  if (str.includes("T")) {
    const afterT = str.split("T")[1] || "";
    return afterT.replace(/\.\d+Z?$/i, "").trim() || null;
  }
  return str.replace(/\.\d+Z?$/i, "").trim() || null;
};

const turnoTexto = (tipoTurno?: string | null) => {
  const first = String(tipoTurno || "").trim().charAt(0).toUpperCase();
  if (first === "D") return "Diurno";
  if (first === "M") return "Mixto";
  if (first === "N") return "Nocturno";
  return "Sin definir";
};

const getTurnosFromRange = async (
  req: NextRequest,
  empleadoId: number,
  fechaInicio: Date,
  fechaFin: Date,
  plazaId: number | null
) => {
  const where: any = {
    empleadoFijo_id: empleadoId,
    fecha: {
      gte: fechaInicio.toISOString(),
      lte: fechaFin.toISOString(),
    },
  };
  if (plazaId != null) where.plaza_id = plazaId;

  const marcas = await callDynamicPrisma({
    req,
    data: {
      action: "GET",
      table: "c_marca_dia",
      operation: "findMany",
      where,
      orderBy: [{ fecha: "asc" }, { hora_inicio: "asc" }],
      include: {
        e_estructura_cliente: { select: { nombre: true } },
        e_estructura_sucursal: { select: { nombre: true } },
        e_estructura_puesto: { select: { nombre: true } },
      },
    },
  });

  const marcaArray = Array.isArray(marcas) ? marcas : [];
  return marcaArray.map((m: any) => ({
    id: m.id,
    cliente: m.e_estructura_cliente?.nombre || null,
    sucursal: m.e_estructura_sucursal?.nombre || null,
    puesto: m.e_estructura_puesto?.nombre || null,
    hora_inicio: formatHoraLabel(m.hora_inicio ? new Date(m.hora_inicio).toISOString() : null),
    hora_fin: formatHoraLabel(m.hora_fin ? new Date(m.hora_fin).toISOString() : null),
    tipo_turno: turnoTexto(m.tipo_turno),
    horas_duracion: m.horas_duracion !== null && m.horas_duracion !== undefined ? String(m.horas_duracion) : null,
    reemplazo_id: null,
  }));
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

export async function GET(req: NextRequest) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) return NextResponse.json({ status: false, expired, message, data: [] }, { status: expired ? 401 : 403 });

    const currentEmployeeId = parseIntStrict((payload as any)?.id);
    if (!currentEmployeeId) {
      return NextResponse.json({ status: false, message: "Empleado inválido", data: [] }, { status: 400 });
    }

    const queryMode = String(req.nextUrl.searchParams.get("mode") || "").trim().toLowerCase();
    const includeExecutiveAssigned = queryMode !== "mine";

    const empleado = await callDynamicPrisma({
      req,
      data: { action: "GET", table: "c_empleado", operation: "findUnique", where: { id: currentEmployeeId } },
    });
    const myEjecutivoCuentaId = parseIntStrict(empleado?.supervisor_id);

    const where: any = { empleado_id: currentEmployeeId };
    if (includeExecutiveAssigned && myEjecutivoCuentaId) {
      where.OR = [{ empleado_id: currentEmployeeId }, { ejecutivo_cuenta: myEjecutivoCuentaId }];
    }

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
      ? await callDynamicPrisma({
          req,
          data: {
            action: "GET",
            table: "c_empleado",
            operation: "findMany",
            where: { id: { in: empleadoIds } },
            select: { id: true, nombre: true, primer_apellido: true, segundo_apellido: true, codigo: true },
          },
        })
      : [];

    const empleadoById = new Map<number, any>((Array.isArray(empleados) ? empleados : []).map((e: any) => [e.id, e]));
    const empleadoNombre = (id?: number | null) => {
      if (!id) return null;
      const e = empleadoById.get(id);
      if (!e) return null;
      return [e.nombre, e.primer_apellido, e.segundo_apellido].filter(Boolean).join(" ").trim() || null;
    };

    const mapped = rows.map((r: any) => {
      const turnos = safeParseTurnos(r.turnos).map((t: any) => ({
        ...t,
        reemplazo_nombre: empleadoNombre(parseIntStrict(t?.reemplazo_id)),
      }));
      const isOwn = Number(r.empleado_id) === currentEmployeeId;
      // Ejecutivo: el usuario actual es el asignado (por id o por supervisor_id). Si envía a su nombre y se asigna a sí mismo, también puede completar y descargar.
      const isExecutiveForRecord =
        Number(r.ejecutivo_cuenta) === currentEmployeeId ||
        (Boolean(myEjecutivoCuentaId) && Number(r.ejecutivo_cuenta) === Number(myEjecutivoCuentaId));
      const canCompleteByExecutive =
        isExecutiveForRecord &&
        (!r.firma_ejecutivo_cuenta_digital || !r.firma_ejecutivo_cuenta_manual);
      return {
        ...r,
        turnos,
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
    return NextResponse.json({ status: false, message: errorMessage, data: [] }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) return NextResponse.json({ status: false, expired, message }, { status: expired ? 401 : 403 });

    const currentEmployeeId = parseIntStrict((payload as any)?.id);
    if (!currentEmployeeId) {
      return NextResponse.json({ status: false, message: "Empleado inválido" }, { status: 400 });
    }

    const body = await req.json();
    const tipo = String(body?.tipo || "").trim();
    const plazaId = parseIntStrict(body?.plaza_id);

    const fechaInicio = `${body?.fecha_inicio}T00:00:00.000Z`;
    const fechaFin = `${body?.fecha_fin}T00:00:00.000Z`;
    const ejecutivoCuenta = parseIntStrict(body?.ejecutivo_cuenta);
    const comentarios = String(body?.comentarios || "").trim();
    const firmaResponsable = String(body?.firma_responsable || "").trim();

    const fileBase64 = String(body?.file_base64 || "").trim();
    const extension = String(body?.extension || "").replace(".", "").trim();
    const originalName = String(body?.original_name || "").trim();
    const fileType = String(body?.type || "file").trim();
    const mimeType = String(body?.mimeType || "").trim();

    if (!tipo || (tipo !== "Con goce" && tipo !== "Sin goce")) {
      return NextResponse.json({ status: false, message: "Tipo inválido. Debe ser Con goce o Sin goce" }, { status: 400 });
    }
    if (!fechaInicio || !fechaFin) {
      return NextResponse.json({ status: false, message: "Debes enviar fecha_inicio y fecha_fin válidas" }, { status: 400 });
    }
    if (new Date(fechaInicio).getTime() > new Date(fechaFin).getTime()) {
      return NextResponse.json({ status: false, message: "fecha_inicio no puede ser mayor a fecha_fin" }, { status: 400 });
    }
    if (!ejecutivoCuenta) {
      return NextResponse.json({ status: false, message: "Debes seleccionar ejecutivo_cuenta" }, { status: 400 });
    }
    if (!firmaResponsable || firmaResponsable.length < 10) {
      return NextResponse.json({ status: false, message: "La firma responsable es obligatoria" }, { status: 400 });
    }
    if (!plazaId) {
      return NextResponse.json({ status: false, message: "Debes seleccionar una plaza" }, { status: 400 });
    }

    const turnos = await getTurnosFromRange(req, currentEmployeeId, new Date(fechaInicio), new Date(fechaFin), plazaId);
    if (!turnos.length) {
      return NextResponse.json(
        { status: false, message: "No hay turnos en el rango de fechas. El usuario está libre esos días." },
        { status: 400 }
      );
    }

    const now = toZonedTime(new Date(), "America/Costa_Rica").toISOString();
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
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
          ejecutivo_cuenta: ejecutivoCuenta,
          comentarios: comentarios || null,
          file_name: null,
          reemplazo_obligatorio: null,
          turnos: JSON.stringify(turnos),
          firma_responsable: firmaResponsable,
          firma_ejecutivo_cuenta_digital: null,
          firma_ejecutivo_cuenta_manual: null,
          created_at: now,
          created_by: currentEmployeeId,
        },
      },
    });

    let finalFileName: string | null = null;
    if (fileBase64 && extension) {
      const documentName = originalName || `solicitud-permiso.${extension}`;
      await uploadDynamicFiles({
        req,
        folderPath: `permit-request/${created.id}`,
        files: [
          {
            type: fileType || "file",
            extension,
            name: documentName,
            original_name: documentName,
            mime_type: mimeType || undefined,
            file_base64: fileBase64,
          },
        ],
      });
      finalFileName = documentName;
      await callDynamicPrisma({
        req,
        data: {
          action: "UPDATE",
          table: "c_solicitud_permiso",
          operation: "update",
          where: { id: created.id },
          data: { file_name: finalFileName },
        },
      });
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
    const employeePlazas = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_empleado_plaza",
        operation: "findMany",
        where: { ejecutivoCuenta_id: ejecutivoCuenta },
        select: { empleado_id: true },
      },
    });
    for (const row of Array.isArray(employeePlazas) ? employeePlazas : []) {
      const empId = parseIntStrict((row as any)?.empleado_id);
      if (empId) recipients.add(empId);
    }
    if (recipients.size > 0) {
      await sendNotificationByEmployee(
        req,
        0,
        [currentEmployeeId],
        "Nueva solicitud de permiso",
        `Se ha creado una nueva solicitud de permiso (${tipo})`,
        Array.from(recipients)
      );
    }

    return NextResponse.json(
      {
        status: true,
        message: "Solicitud de permiso creada correctamente",
        data: { ...created, file_name: finalFileName, turnos },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}

