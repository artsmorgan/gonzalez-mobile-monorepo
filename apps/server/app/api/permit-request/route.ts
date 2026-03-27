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
      return NextResponse.json({ status: false, message: "Empleado inválido", data: [] }, { status: 400 });
    }

    const empleado = await callDynamicPrisma({
      req,
      data: { action: "GET", table: "c_empleado", operation: "findUnique", where: { id: currentEmployeeId } },
    });
    const mySupervisorId = parseIntStrict(empleado?.supervisor_id);

    // Siempre incluir:
    // 1) Solicitudes propias del empleado autenticado.
    // 2) Solicitudes donde el ejecutivo_cuenta coincide con supervisor_id del empleado.
    // Esto garantiza visibilidad cuando ejecutivo_cuenta === supervisor_id.
    const where: any = mySupervisorId
      ? { OR: [{ empleado_id: currentEmployeeId }, { ejecutivo_cuenta: mySupervisorId }] }
      : { empleado_id: currentEmployeeId };

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
    const horaAccion = parseDateInputToDate(body?.hora_accion);
    const comentarios = String(body?.comentarios || "").trim();
    const firmaResponsable = String(body?.firma_responsable || "").trim();

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
        file_base64: String(f?.file_base64 || "").trim(),
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
      return NextResponse.json({ status: false, message: "Tipo inválido. Debe ser Con goce o Sin goce" }, { status: 400 });
    }
    if (!fechaInicio || !fechaFin) {
      return NextResponse.json({ status: false, message: "Debes enviar fecha_inicio y fecha_fin válidas" }, { status: 400 });
    }
    if (new Date(fechaInicio).getTime() > new Date(fechaFin).getTime()) {
      return NextResponse.json({ status: false, message: "fecha_inicio no puede ser mayor a fecha_fin" }, { status: 400 });
    }
    if (!firmaResponsable || firmaResponsable.length < 10) {
      return NextResponse.json({ status: false, message: "La firma responsable es obligatoria" }, { status: 400 });
    }
    if (!plazaId) {
      return NextResponse.json({ status: false, message: "Debes seleccionar una plaza" }, { status: 400 });
    }

    // Resolver ejecutivo_cuenta a partir de la sucursal asociada a la plaza seleccionada
    const plaza = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "e_estructura_plazas",
        operation: "findFirst",
        where: { id: plazaId },
        select: { puesto_id: true },
      },
    });

    const plazaPuestoId = parseIntStrict((plaza as any)?.puesto_id);
    if (!plazaPuestoId) {
      return NextResponse.json(
        { status: false, message: "La plaza seleccionada no tiene un puesto asociado" },
        { status: 400 }
      );
    }

    const puesto = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "e_estructura_puesto",
        operation: "findFirst",
        where: { id: plazaPuestoId },
      },
    });

    const sucursalId = parseIntStrict((puesto as any)?.sucursal_id);
    if (!sucursalId) {
      return NextResponse.json(
        { status: false, message: "El puesto asociado a la plaza no tiene una sucursal válida" },
        { status: 400 }
      );
    }

    const sucursal = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "e_estructura_sucursal",
        operation: "findFirst",
        where: { id: sucursalId },
      },
    });

    const contrato = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "e_estructura_contrato",
        operation: "findFirst",
        where: { id: sucursalId },
      },
    });

    let nombre_cliente = "";
    if (contrato) {
      const cliente = await callDynamicPrisma({
        req,
        data: {
          action: "GET",
          table: "e_estructura_cliente",
          operation: "findFirst",
          where: { id: contrato.cliente_id },
        },
      });
      if (cliente) {
        nombre_cliente = cliente.nombre;
      }
    }

    const ejecutivoCuenta = parseIntStrict((sucursal as any)?.ejecutivoCuenta_id);
    if (!ejecutivoCuenta) {
      return NextResponse.json(
        { status: false, message: "La sucursal seleccionada no tiene un ejecutivo de cuenta asignado" },
        { status: 400 }
      );
    }

    const turnos = await getTurnosFromRange(req, currentEmployeeId, new Date(fechaInicio), new Date(fechaFin), plazaId);
    if (!turnos.length) {
      return NextResponse.json(
        { status: false, message: "No hay turnos en el rango de fechas. El usuario está libre esos días." },
        { status: 400 }
      );
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
          comentarios: comentarios || null,
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
      // No bloquear la respuesta por notificaciones; si falla, el registro ya fue creado.

      const empleado = await callDynamicPrisma({
        req,
        data: {
          action: "GET",
          table: "c_empleado",
          operation: "findUnique",
          where: { id: currentEmployeeId },
        },
      });

      if (empleado) {
        const empleados_ejecutivos = await callDynamicPrisma({
          req,
          data: {
            action: "GET",
            table: "c_empleado",
            operation: "findMany",
            where: { supervisor_id: ejecutivoCuenta },
          },
        });

        let empleado_nombre = "";
        if (empleado) {
          empleado_nombre = `${empleado.nombre??"" } ${empleado.primer_apellido??""} ${empleado.segundo_apellido??""}`;
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
          `El empleado ${empleado_nombre} con cédula ${empleado.cedula??""} ha creado una nueva solicitud de permiso ${tipo_lowercase} para el puesto ${puesto.nombre} (Sucursal ${sucursal.nombre} del cliente ${nombre_cliente}) en las fechas desde ${fecha_desde} hasta ${fecha_hasta} el día ${fecha} a las ${hora}`,
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
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}

