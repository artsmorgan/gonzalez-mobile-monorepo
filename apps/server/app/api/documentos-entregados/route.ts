/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";
import { sendNotificationByRole } from "../../../utils/sendNotification";
import { toZonedTime } from "date-fns-tz";

function parseDateOnly(value: any): Date | null {
  if (!value) return null;
  const s = String(value);
  const d = s.includes("T") ? new Date(s) : new Date(`${s}T00:00:00`);
  if (isNaN(d.getTime())) return null;
  return d;
}

export async function GET(req: NextRequest) {
  try {
    const { valid, expired, message } = await verifyAccessTokenByApi(req);
    if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

    const marcaIdStr = req.nextUrl.searchParams.get("m");
    if (!marcaIdStr) {
      return NextResponse.json({ status: false, message: "Marca no especificada" }, { status: 200 });
    }

    const marcaDia = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_marca_dia",
        operation: "findUnique",
        where: { id: parseInt(marcaIdStr) },
      },
    });
    if (!marcaDia || !marcaDia.id) {
      return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 200 });
    }
    if (!marcaDia.empleadoFijo_id) {
      return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 200 });
    }

    // Obtener última marca usando callDynamicPrisma directamente
    const now = toZonedTime(new Date(), "America/Costa_Rica");
    const nowPlus15 = new Date(now.getTime() + 15 * 60 * 1000);
    const currentDate = new Date(now.toISOString().split("T")[0]);
    const currentTime = new Date("1970-01-01 " + now.toTimeString().slice(0, 8));

    const proximo = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_marca_dia",
        operation: "findFirst",
        where: {
          empleadoFijo_id: marcaDia.empleadoFijo_id,
          OR: [
            { fecha: { gt: now } },
            {
              fecha: { equals: currentDate },
              hora_inicio: { gte: currentTime },
            },
          ],
        },
        orderBy: [{ fecha: "asc" }, { hora_inicio: "asc" }],
      },
    });

    let lastMarca = null;
    if (proximo && proximo.id) {
      const proximoFecha = proximo.fecha instanceof Date ? proximo.fecha : new Date(proximo.fecha);
      const proximoHoraInicio = proximo.hora_inicio instanceof Date ? proximo.hora_inicio : (proximo.hora_inicio ? new Date("1970-01-01T" + String(proximo.hora_inicio)) : null);
      if (proximoHoraInicio && !isNaN(proximoHoraInicio.getTime())) {
        const proximoDateTime = new Date(`${proximoFecha.toISOString().split("T")[0]}T${proximoHoraInicio.toTimeString().slice(0, 8)}`);
        if (!isNaN(proximoDateTime.getTime()) && proximoDateTime <= nowPlus15) {
          lastMarca = proximo;
        }
      }
    }

    if (!lastMarca || !lastMarca.id) {
      const ultimo = await callDynamicPrisma({
        req,
        data: {
          action: "GET",
          table: "c_marca_dia",
          operation: "findFirst",
          where: { empleadoFijo_id: marcaDia.empleadoFijo_id },
          orderBy: [{ fecha: "desc" }, { hora_inicio: "desc" }],
        },
      });
      lastMarca = ultimo;
    }

    if (!lastMarca || !lastMarca.id) {
      return NextResponse.json({ status: false, message: "No se encontró la última marca" }, { status: 200 });
    }
    if (marcaDia.id !== lastMarca.id) {
      return NextResponse.json({ status: false, message: "Hay una nueva marca más reciente" }, { status: 200 });
    }

    const rows = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "e_control_documento_entregado_cliente",
        operation: "findMany",
        where: {
          corpo_id: marcaDia.corpo_id,
        },
        orderBy: { id: "desc" },
      },
    });

    const rowsArray = Array.isArray(rows) ? rows : [];
    const mapped = rowsArray.map((r: any) => ({
      id: r.id,
      cliente_id: r.cliente_id,
      corpo_id: r.corpo_id,
      fecha: r.fecha instanceof Date ? r.fecha.toISOString() : r.fecha,
      nombre_oficial_entrega: r.nombre_oficial_entrega,
      nombre_oficial_recibe: r.nombre_oficial_recibe,
      tipo_documento: r.tipo_documento,
      descripcion: r.descripcion,
      firma_representante_cliente: r.firma_representante_cliente,
      firma_responsable: r.firma_responsable,
      id_local: "",
    }));

    return NextResponse.json({ status: true, data: mapped }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in GET /api/documentos-entregados:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

    const body = await req.json();
    const {
      marca_id,
      fecha,
      nombre_oficial_entrega,
      nombre_oficial_recibe,
      tipo_documento,
      descripcion,
      firma_representante_cliente,
      firma_responsable,
    } = body ?? {};

    if (
      !marca_id ||
      !fecha ||
      !nombre_oficial_entrega ||
      !nombre_oficial_recibe ||
      !tipo_documento ||
      !descripcion ||
      !firma_responsable
    ) {
      return NextResponse.json({ status: false, message: "Datos incompletos" }, { status: 200 });
    }

    const marcaDia = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_marca_dia",
        operation: "findUnique",
        where: { id: parseInt(String(marca_id)) },
      },
    });
    if (!marcaDia || !marcaDia.id) {
      return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 200 });
    }

    const fechaDate = parseDateOnly(fecha);
    if (!fechaDate) {
      return NextResponse.json({ status: false, message: "Fecha inválida" }, { status: 200 });
    }

    const created = await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "e_control_documento_entregado_cliente",
        data: {
          cliente_id: marcaDia.cliente_id,
          corpo_id: marcaDia.corpo_id,
          fecha: fechaDate.toISOString(),
          nombre_oficial_entrega: String(nombre_oficial_entrega),
          nombre_oficial_recibe: String(nombre_oficial_recibe),
          tipo_documento: String(tipo_documento),
          descripcion: String(descripcion),
          firma_representante_cliente:
            firma_representante_cliente != null && String(firma_representante_cliente).trim() !== ""
              ? String(firma_representante_cliente)
              : null,
          firma_responsable: String(firma_responsable),
        },
      },
    });

    if (created && created.id) {
      let empleadoNombre = "Desconocido";
      const empleadoId = payload?.id || payload?.empleadoId;
      if (empleadoId) {
        const empleado = await callDynamicPrisma({
          req,
          data: {
            action: "GET",
            table: "c_empleado",
            operation: "findUnique",
            where: { id: typeof empleadoId === 'number' ? empleadoId : parseInt(String(empleadoId)) },
          },
        });
        if (empleado && empleado.id) {
          empleadoNombre = (empleado.nombre || "") + " " + (empleado.primer_apellido || "") + " " + (empleado.segundo_apellido || "");
        }
      }
      let sucursalNombre = "Desconocida";
      let clienteNombre = "Desconocido";
      if (marcaDia.cliente_id) {
        const cliente = await callDynamicPrisma({
          req,
          data: {
            action: "GET",
            table: "e_estructura_cliente",
            operation: "findUnique",
            where: { id: marcaDia.cliente_id },
          },
        });
        if (cliente && cliente.id) {
          clienteNombre = cliente.nombre || "Desconocido";
        }
      }
      if (marcaDia.corpo_id) {
        const sucursal = await callDynamicPrisma({
          req,
          data: {
            action: "GET",
            table: "e_estructura_sucursal",
            operation: "findUnique",
            where: { id: marcaDia.corpo_id },
          },
        });
        if (sucursal && sucursal.id) {
          sucursalNombre = sucursal.nombre || "Desconocida";
        }
      }
      const fechaFormatted = fechaDate.toISOString().split("T")[0];
      const descriptionNotificacion = "El empleado " + empleadoNombre + " ha registrado un documento entregado para la sucursal del cliente " + clienteNombre + " con la fecha " + fechaFormatted;
      await sendNotificationByRole(req, marcaDia.corpo_id, [typeof empleadoId === 'number' ? empleadoId : parseInt(String(empleadoId || "0"), 10)], "Documento entregado registrado", descriptionNotificacion, ["ADMINISTRATIVO", "SUPERVISOR"]);
    }

    // Registrar cambio de creación
    const createdBy = typeof payload?.id === 'number' ? payload.id : (payload?.id ? parseInt(String(payload.id), 10) : 0);
    const createdAt = toZonedTime(new Date(), "America/Costa_Rica");
    await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_cambios_apps_modules",
        data: {
          nombre_tabla: "e_control_documento_entregado_cliente",
          registro_id: created.id,
          cambios: JSON.stringify([{
            prop: "__created__",
            before: null,
            after: {
              id: created.id,
              cliente_id: created.cliente_id,
              corpo_id: created.corpo_id,
              fecha: fechaDate.toISOString(),
              nombre_oficial_entrega: created.nombre_oficial_entrega,
              nombre_oficial_recibe: created.nombre_oficial_recibe,
              tipo_documento: created.tipo_documento,
              descripcion: created.descripcion,
              firma_representante_cliente: created.firma_representante_cliente,
              firma_responsable: created.firma_responsable,
            },
          }]),
          created_at: createdAt.toISOString(),
          created_by: createdBy,
        },
      },
    });

    return NextResponse.json(
      { status: true, message: "Documento entregado creado correctamente", id: created.id },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in POST /api/documentos-entregados:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}


