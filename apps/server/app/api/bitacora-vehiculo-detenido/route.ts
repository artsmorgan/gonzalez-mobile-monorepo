/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";
import { toZonedTime } from "date-fns-tz";
import { sendNotificationByRole } from "../../../utils/sendNotification";

function safeParseJson<T>(value: any, fallback: T): T {
  try {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length === 0) return fallback;
      return JSON.parse(trimmed) as T;
    }
    if (value === null || value === undefined) return fallback;
    return value as T;
  } catch {
    return fallback;
  }
}

function normalizeToStringifiedJson(value: any): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value ?? []);
}

export async function GET(req: NextRequest) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });
    }
    // Soporte para filtros directos por estructura (sin depender de marca)
    const empresaIdStr = req.nextUrl.searchParams.get("empresa_id");
    const clienteIdStr = req.nextUrl.searchParams.get("cliente_id");
    const sucursalIdStr = req.nextUrl.searchParams.get("sucursal_id");

    let empresaId: number | null = empresaIdStr ? parseInt(String(empresaIdStr), 10) : null;
    let clienteId: number | null = clienteIdStr ? parseInt(String(clienteIdStr), 10) : null;
    let sucursalId: number | null = sucursalIdStr ? parseInt(String(sucursalIdStr), 10) : null;

    // Compat: si no vienen ids directos, usamos marca (comportamiento anterior)
    if (!empresaId || !clienteId || !sucursalId) {
      const marcaIdStr = req.nextUrl.searchParams.get("m");
      if (!marcaIdStr) {
        return NextResponse.json(
          { status: false, message: "Marca no especificada" },
          { status: 200 }
        );
      }

      const marcaDia = await callDynamicPrisma({
        req,
        data: { action: "GET", table: "c_marca_dia", operation: "findUnique", where: { id: parseInt(marcaIdStr) } }
      });
      if (!marcaDia) {
        return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 200 });
      }

      if (!marcaDia.empleadoFijo_id) {
        return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 200 });
      }

      // Obtener la última marca del empleado (simplificado: obtener la más reciente)
      const lastMarca = await callDynamicPrisma({
        req,
        data: {
          action: "GET",
          table: "c_marca_dia",
          operation: "findFirst",
          where: { empleadoFijo_id: marcaDia.empleadoFijo_id },
          orderBy: [{ fecha: "desc" }, { hora_inicio: "desc" }]
        }
      });
      if (!lastMarca) {
        return NextResponse.json({ status: false, message: "No se encontró la última marca" }, { status: 200 });
      }
      if (marcaDia.id !== lastMarca.id) {
        return NextResponse.json({ status: false, message: "Hay una nueva marca más reciente" }, { status: 200 });
      }

      empresaId = marcaDia.empresa_id;
      clienteId = marcaDia.cliente_id;
      sucursalId = marcaDia.corpo_id;
    }

    const rows = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_bitacora_vehiculo_detenido",
        operation: "findMany",
        where: { sucursal_id: Number(sucursalId) },
        orderBy: { id: "desc" }
      }
    });

    const mapped = rows.map((r: any) => ({
      id: r.id,
      empresa_id: r.empresa_id,
      cliente_id: r.cliente_id,
      sucursal_id: r.sucursal_id,
      vehiculo_id: r.vehiculo_id ?? null,
      uso_id: r.uso_id ?? null,
      tipo: r.tipo,
      informacion_general: safeParseJson<any[]>(r.informacion_general, []),
      informacion_revision: safeParseJson<any[]>(r.informacion_revision, []),
      movimientos_vehiculos: safeParseJson<any[]>(r.movimientos_vehiculos, []),
      observaciones: r.observaciones,
      firma_responsable: r.firma_responsable,
      created_by: r.created_by,
      created_at: r.created_at,
      id_local: "",
    }));

    return NextResponse.json({ status: true, data: mapped }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in GET /api/bitacora-vehiculo-detenido:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });
    }

    const body = await req.json();
    const {
      marca_id,
      empresa_id,
      cliente_id,
      sucursal_id,
      vehiculo_id,
      uso_id,
      tipo,
      informacion_general,
      informacion_revision,
      movimientos_vehiculos,
      observaciones,
      firma_responsable,
    } = body ?? {};

    // marca_id era requerido previamente. Ahora permitimos crear por estructura directa.
    if ((!marca_id && (!empresa_id || !cliente_id || !sucursal_id)) || !tipo || !observaciones || !firma_responsable) {
      return NextResponse.json({ status: false, message: "Datos incompletos" }, { status: 200 });
    }

    let empresaId = empresa_id ? Number(empresa_id) : 0;
    let clienteId = cliente_id ? Number(cliente_id) : 0;
    let sucursalId = sucursal_id ? Number(sucursal_id) : 0;

    if (marca_id) {
      const marcaDia = await callDynamicPrisma({
        req,
        data: { action: "GET", table: "c_marca_dia", operation: "findUnique", where: { id: parseInt(String(marca_id)) } }
      });
      if (!marcaDia) {
        return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 200 });
      }
      // Si no vienen ids explícitos, usamos los de marca
      if (!empresaId) empresaId = marcaDia.empresa_id;
      if (!clienteId) clienteId = marcaDia.cliente_id;
      if (!sucursalId) sucursalId = marcaDia.corpo_id;
    }

    if (!empresaId || !clienteId || !sucursalId) {
      return NextResponse.json({ status: false, message: "Estructura incompleta" }, { status: 200 });
    }

    const createdAt = toZonedTime(new Date(), "America/Costa_Rica") as Date;

    const created = await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_bitacora_vehiculo_detenido",
        data: {
          empresa_id: empresaId,
          cliente_id: clienteId,
          sucursal_id: sucursalId,
          vehiculo_id: vehiculo_id ? Number(vehiculo_id) : null,
          uso_id: uso_id ? Number(uso_id) : null,
          tipo: String(tipo),
          informacion_general: normalizeToStringifiedJson(informacion_general),
          informacion_revision: normalizeToStringifiedJson(informacion_revision),
          movimientos_vehiculos: normalizeToStringifiedJson(movimientos_vehiculos),
          observaciones: String(observaciones),
          firma_responsable: String(firma_responsable),
          created_by: parseInt(String((payload as any)?.id ?? 0)) || 0,
          created_at: createdAt.toISOString(),
        }
      }
    });

    // Vinculación: si viene `uso_id`, marcamos el uso con `bitacora_id = created.id`
    let description = "";
    let empNombre = "Desconocido";
    let sucursalNombre = "Desconocida";
    const fechaEntrada = createdAt.toISOString().split("T")[0];
    const horaEntrada = createdAt.toISOString().split("T")[1].split(".")[0];
    if (created.created_by) {
      const empleado = await callDynamicPrisma({
        req,
        data: { action: "GET", table: "c_empleado", operation: "findUnique", where: { id: created.created_by } }
      });
      if (empleado) {
        empNombre = empleado.nombre + " " + empleado.primer_apellido + " " + empleado.segundo_apellido;
      }
    }
    if (sucursalId) {
      const sucursal = await callDynamicPrisma({
        req,
        data: { action: "GET", table: "e_estructura_sucursal", operation: "findUnique", where: { id: sucursalId } }
      });
      if (sucursal) {
        sucursalNombre = sucursal.nombre;
      }
    }
    if (created) {
      description = "El empleado " + empNombre + " ha creado una bitácora de vehículo detenido de tipo " + tipo;
      if (uso_id) {
        try {
          const uso = await callDynamicPrisma({
            req,
            data: {
              action: "UPDATE",
              table: "c_usos_vehiculos_corporativos",
              where: { id: Number(uso_id) },
              data: { bitacora_id: created.id }
            }
          });
          if (uso) {
            const vehiculo = await callDynamicPrisma({
              req,
              data: { action: "GET", table: "c_vehiculos_corporativos", operation: "findUnique", where: { id: uso.vehiculo_id } }
            });
            if (vehiculo) {
              description += " para el vehículo con la placa " + vehiculo.placa;
            }
          }
        } catch {
          // si falla, no rompemos el create de bitácora
        }
      }
      description += " en la sucursal " + sucursalNombre + " el día " + fechaEntrada + " a las " + horaEntrada;
      await sendNotificationByRole(req, sucursalId, [], "Bitácora de vehículo detenido creada", description, ["ADMINISTRATIVO", "SUPERVISOR"]);
    }

    // Registrar cambio de creación
    await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_cambios_apps_modules",
        data: {
          nombre_tabla: "c_bitacora_vehiculo_detenido",
          registro_id: created.id,
          cambios: JSON.stringify([{
            prop: "__created__",
            before: null,
            after: {
              id: created.id,
              empresa_id: created.empresa_id,
              cliente_id: created.cliente_id,
              sucursal_id: created.sucursal_id,
              tipo: created.tipo,
              observaciones: created.observaciones,
              firma_responsable: created.firma_responsable,
            },
          }]),
          created_at: createdAt.toISOString(),
          created_by: created.created_by,
        }
      }
    });

    return NextResponse.json({ status: true, message: "Bitácora creada correctamente", id: created.id }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in POST /api/bitacora-vehiculo-detenido:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}


