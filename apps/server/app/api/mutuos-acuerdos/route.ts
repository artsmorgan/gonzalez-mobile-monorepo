import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";
import { uploadDynamicFiles } from "../../../utils/callDynamicFilesApi";
import { toZonedTime } from "date-fns-tz";
import { sendNotificationByEmployee } from "../../../utils/sendNotification";

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

export async function GET(req: NextRequest) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) return NextResponse.json({ status: false, expired, message, data: [] }, { status: expired ? 401 : 403 });

    const currentEmployeeId = parseIntStrict((payload as any)?.id);
    if (!currentEmployeeId) return NextResponse.json({ status: false, message: "Empleado inválido", data: [] }, { status: 400 });

    const empleado = await callDynamicPrisma({
      req,
      data: { action: "GET", table: "c_empleado", operation: "findUnique", where: { id: currentEmployeeId } },
    });
    const myEjecutivoCuentaId = empleado?.supervisor_id ?? null;

    const where: any = {
      OR: [
        { empleadoReemplaza_id: currentEmployeeId },
        { empleadoAusente_id: currentEmployeeId },
      ],
    };
    if (myEjecutivoCuentaId) {
      // Incluir también los registros del ejecutivo asignado (supervisor_id del empleado),
      // sin condicionarlos al estado de aceptación para que siempre sean visibles.
      where.OR.push({ ejecutivo_cuenta: myEjecutivoCuentaId });
    }

    const records = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "e_mutuos_acuerdos",
        operation: "findMany",
        where,
        orderBy: { created_at: "desc" },
        include: {
          e_estructura_cliente: { select: { nombre: true } },
          e_estructura_sucursal: { select: { nombre: true, nro_sucursal: true } },
          n_ejecutivo_cuenta: { select: { id: true, nombre: true } },
        },
      },
    });

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
        ? callDynamicPrisma({
          req,
          data: {
            action: "GET",
            table: "c_marca_dia",
            operation: "findMany",
            where: { id: { in: marcaIds } },
            include: {
              e_estructura_cliente: { select: { nombre: true } },
              e_estructura_sucursal: { select: { nombre: true } },
              e_estructura_puesto: { select: { nombre: true } },
            },
          },
        })
        : [],
      empleadoIds.length > 0
        ? callDynamicPrisma({
          req,
          data: {
            action: "GET",
            table: "c_empleado",
            operation: "findMany",
            where: { id: { in: empleadoIds } },
            select: { id: true, nombre: true, primer_apellido: true, segundo_apellido: true },
          },
        })
        : [],
      plazaIds.length > 0
        ? callDynamicPrisma({
          req,
          data: {
            action: "GET",
            table: "e_estructura_plazas",
            operation: "findMany",
            where: { id: { in: plazaIds } },
            select: { id: true, nombre: true },
          },
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
      return NextResponse.json({ status: false, message: "Las marcas de ausente y reemplaza deben ser diferentes" }, { status: 400 });
    }

    const [marcaAusente, marcaReemplaza] = await Promise.all([
      callDynamicPrisma({
        req,
        data: {
          action: "GET",
          table: "c_marca_dia",
          operation: "findUnique",
          where: { id: marcaDiaAusente_id },
        },
      }),
      callDynamicPrisma({
        req,
        data: {
          action: "GET",
          table: "c_marca_dia",
          operation: "findUnique",
          where: { id: marcaDiaReemplaza_id },
        },
      }),
    ]);

    if (!marcaAusente || !marcaReemplaza) {
      return NextResponse.json({ status: false, message: "No se encontraron las marcas seleccionadas" }, { status: 404 });
    }

    if (!marcaAusente.empleadoFijo_id || !marcaReemplaza.empleadoFijo_id || !marcaAusente.plaza_id || !marcaReemplaza.plaza_id) {
      return NextResponse.json({ status: false, message: "Las marcas seleccionadas no tienen empleado/plaza válidos" }, { status: 400 });
    }

    if (!marcaAusente.cliente_id || !marcaAusente.corpo_id || !marcaReemplaza.cliente_id || !marcaReemplaza.corpo_id) {
      return NextResponse.json({ status: false, message: "Las marcas seleccionadas no tienen cliente/sucursal válidos" }, { status: 400 });
    }

    // Obtener ejecutivo_cuenta desde la sucursal (corpo_id) asociada a las marcas
    const sucursal = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "e_estructura_sucursal",
        operation: "findUnique",
        where: { id: Number(marcaAusente.corpo_id) },
        select: { ejecutivoCuenta_id: true },
      },
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
          OR: [
            { marcaDiaAusente_id: { in: [marcaDiaAusente_id, marcaDiaReemplaza_id] } },
            { marcaDiaReemplaza_id: { in: [marcaDiaAusente_id, marcaDiaReemplaza_id] } },
          ],
        },
      },
    });
    if (alreadyUsed) {
      return NextResponse.json({ status: false, message: "Una de las marcas seleccionadas ya está asociada a otro mutuo acuerdo" }, { status: 400 });
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

    const empleadoAusente = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_empleado",
        operation: "findUnique",
        where: { id: Number(marcaAusente.empleadoFijo_id) },
      },
    });
    const empleadoReemplaza = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_empleado",
        operation: "findUnique",
        where: { id: Number(marcaReemplaza.empleadoFijo_id) },
      },
    });

    const recipients = new Set<number>();
    const employeePlazas = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_empleado_plaza",
        operation: "findMany",
        where: { ejecutivoCuenta_id: ejecutivo_cuenta },
        select: { empleado_id: true },
      },
    });
    for (const row of Array.isArray(employeePlazas) ? employeePlazas : []) {
      const empId = parseIntStrict((row as any)?.empleado_id);
      if (empId) recipients.add(empId);
    }

    if (recipients.size > 0) {
      const empleados_ejecutivos = await callDynamicPrisma({
        req,
        data: {
          action: "GET",
          table: "c_empleado",
          operation: "findMany",
          where: { supervisor_id: ejecutivo_cuenta },
        },
      });

      const puestoAusente = await callDynamicPrisma({
        req,
        data: {
          action: "GET",
          table: "e_estructura_puesto",
          operation: "findUnique",
          where: { id: marcaAusente.puesto_id },
        },
      });

      let sucursalNombreAusente = "Desconocida";
      let clienteNombreAusente = "Desconocido";
      if (puestoAusente) {
        const sucursalAusente = await callDynamicPrisma({
          req,
          data: {
            action: "GET",
            table: "e_estructura_sucursal",
            operation: "findUnique",
            where: { id: marcaAusente.corpo_id },
          },
        });
        if (sucursalAusente) {
          sucursalNombreAusente = sucursalAusente.nombre;
          let clienteAusente = await callDynamicPrisma({
            req,
            data: {
              action: "GET",
              table: "e_estructura_cliente",
              operation: "findUnique",
              where: { id: marcaAusente.cliente_id },
            },
          });
          if (clienteAusente) {
            clienteNombreAusente = clienteAusente.nombre;
          }
        }
      }

      const puestoReemplaza = await callDynamicPrisma({
        req,
        data: {
          action: "GET",
          table: "e_estructura_puesto",
          operation: "findUnique",
          where: { id: marcaReemplaza.puesto_id },
        },
      });

      let sucursalNombreReemplaza = "Desconocida";
      let clienteNombreReemplaza = "Desconocido";
      if (puestoReemplaza) {
        const sucursalReemplaza = await callDynamicPrisma({
          req,
          data: {
            action: "GET",
            table: "e_estructura_sucursal",
            operation: "findUnique",
            where: { id: marcaReemplaza.corpo_id },
          },
        });
        if (sucursalReemplaza) {
          sucursalNombreReemplaza = sucursalReemplaza.nombre;
          let clienteReemplaza = await callDynamicPrisma({
            req,
            data: {
              action: "GET",
              table: "e_estructura_cliente",
              operation: "findUnique",
              where: { id: marcaReemplaza.cliente_id },
            },
          });
          if (clienteReemplaza) {
            clienteNombreReemplaza = clienteReemplaza.nombre;
          }
        }
      }

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
        `Se creó un mutuo acuerdo el día ${fecha} a las ${hora}. El empleado ${ausenteNombre} (cédula ${ausenteCedula || "N/A"}) acuerda cambiar el turno del día ${fecha_ausente_cambio} a las ${hora_inicio_ausente} para el puesto ${puestoNombreAusente} (Sucursal ${sucursalNombreAusente} del cliente ${clienteNombreAusente}) por el turno del día ${fecha_reemplaza_cambio} a las ${hora_inicio_reemplaza} para el puesto ${puestoNombreReemplaza} (Sucursal ${sucursalNombreReemplaza} del cliente ${clienteNombreReemplaza}) del empleado ${reemplazaNombre} (cédula ${reemplazaCedula || "N/A"}).`,
        (Array.isArray(empleados_ejecutivos) ? empleados_ejecutivos : []).map((e: any) => e.id)
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
