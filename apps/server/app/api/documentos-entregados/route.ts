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

    const corpoIdStr = req.nextUrl.searchParams.get("corpo_id");
    if (!corpoIdStr) {
      return NextResponse.json({ status: false, message: "Sucursal (corpo_id) no especificada" }, { status: 200 });
    }
    const corpoId = parseInt(corpoIdStr, 10);
    if (!Number.isFinite(corpoId) || corpoId <= 0) {
      return NextResponse.json({ status: false, message: "corpo_id inválido" }, { status: 200 });
    }

    const rows = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "e_control_documento_entregado_cliente",
        operation: "findMany",
        where: {
          corpo_id: corpoId,
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
      cliente_id,
      corpo_id,
      fecha,
      nombre_oficial_entrega,
      nombre_oficial_recibe,
      tipo_documento,
      descripcion,
      firma_representante_cliente,
      firma_responsable,
    } = body ?? {};

    if (
      cliente_id == null ||
      corpo_id == null ||
      !fecha ||
      !nombre_oficial_entrega ||
      !nombre_oficial_recibe ||
      !tipo_documento ||
      !descripcion ||
      !firma_responsable
    ) {
      return NextResponse.json({ status: false, message: "Datos incompletos" }, { status: 200 });
    }

    const clienteIdNum = parseInt(String(cliente_id), 10);
    const corpoIdNum = parseInt(String(corpo_id), 10);
    if (!Number.isFinite(clienteIdNum) || clienteIdNum <= 0 || !Number.isFinite(corpoIdNum) || corpoIdNum <= 0) {
      return NextResponse.json({ status: false, message: "cliente_id o corpo_id inválidos" }, { status: 200 });
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
          cliente_id: clienteIdNum,
          corpo_id: corpoIdNum,
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
      const cliente = await callDynamicPrisma({
        req,
        data: {
          action: "GET",
          table: "e_estructura_cliente",
          operation: "findUnique",
          where: { id: clienteIdNum },
        },
      });
      if (cliente && cliente.id) {
        clienteNombre = cliente.nombre || "Desconocido";
      }
      const sucursal = await callDynamicPrisma({
        req,
        data: {
          action: "GET",
          table: "e_estructura_sucursal",
          operation: "findUnique",
          where: { id: corpoIdNum },
        },
      });
      if (sucursal && sucursal.id) {
        sucursalNombre = sucursal.nombre || "Desconocida";
      }
      const fechaFormatted = fechaDate.toISOString().split("T")[0];
      const descriptionNotificacion = "El empleado " + empleadoNombre + " ha registrado un documento entregado para la sucursal " + sucursalNombre + " del cliente " + clienteNombre + " con la fecha " + fechaFormatted;
      await sendNotificationByRole(req, corpoIdNum, [typeof empleadoId === 'number' ? empleadoId : parseInt(String(empleadoId || "0"), 10)], "Documento entregado registrado", descriptionNotificacion, ["ADMINISTRATIVO", "SUPERVISOR"]);
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

