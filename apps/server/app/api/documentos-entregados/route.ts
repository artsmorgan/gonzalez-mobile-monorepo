/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../utils/verifyToken";
import { prisma } from "../../../utils/prismaClient";
import { getUserMarca } from "../../../utils/getUserMarca";
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
    const { valid, expired, payload, message } = verifyAccessToken(req);
    if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

    const marcaIdStr = req.nextUrl.searchParams.get("m");
    if (!marcaIdStr) {
      return NextResponse.json({ status: false, message: "Marca no especificada" }, { status: 200 });
    }

    const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id: parseInt(marcaIdStr) } });
    if (!marcaDia) {
      return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 200 });
    }
    if (!marcaDia.empleadoFijo_id) {
      return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 200 });
    }

    const lastMarca = await getUserMarca(marcaDia.empleadoFijo_id);
    if (!lastMarca) {
      return NextResponse.json({ status: false, message: "No se encontró la última marca" }, { status: 200 });
    }
    if (marcaDia.id !== lastMarca.id) {
      return NextResponse.json({ status: false, message: "Hay una nueva marca más reciente" }, { status: 200 });
    }

    const rows = await prisma.e_control_documento_entregado_cliente.findMany({
      where: {
        corpo_id: marcaDia.corpo_id,
      },
      orderBy: { id: "desc" },
    });

    const mapped = rows.map((r) => ({
      id: r.id,
      cliente_id: r.cliente_id,
      corpo_id: r.corpo_id,
      fecha: r.fecha,
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
    const { valid, expired, payload, message } = verifyAccessToken(req);
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
      !firma_representante_cliente ||
      !firma_responsable
    ) {
      return NextResponse.json({ status: false, message: "Datos incompletos" }, { status: 200 });
    }

    const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id: parseInt(String(marca_id)) } });
    if (!marcaDia) {
      return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 200 });
    }

    const fechaDate = parseDateOnly(fecha);
    if (!fechaDate) {
      return NextResponse.json({ status: false, message: "Fecha inválida" }, { status: 200 });
    }

    const created = await prisma.e_control_documento_entregado_cliente.create({
      data: {
        cliente_id: marcaDia.cliente_id,
        corpo_id: marcaDia.corpo_id,
        fecha: fechaDate,
        nombre_oficial_entrega: String(nombre_oficial_entrega),
        nombre_oficial_recibe: String(nombre_oficial_recibe),
        tipo_documento: String(tipo_documento),
        descripcion: String(descripcion),
        firma_representante_cliente: String(firma_representante_cliente),
        firma_responsable: String(firma_responsable),
      },
    });

    if (created) {
      const payload = (req.body as any)?.payload;
      let empleadoNombre = "Desconocido";
      if (payload.id) {
        const empleado = await prisma.c_empleado.findUnique({ where: { id: payload.id } });
        if (empleado) {
          empleadoNombre = empleado.nombre + " " + empleado.primer_apellido + " " + empleado.segundo_apellido;
        }
      }
      let sucursalNombre = "Desconocida";
      let clienteNombre = "Desconocido";
      if (marcaDia.cliente_id) {
        const cliente = await prisma.e_estructura_cliente.findUnique({ where: { id: marcaDia.cliente_id } });
        if (cliente) {
          clienteNombre = cliente.nombre;
        }
      }
      if (marcaDia.corpo_id) {
        const sucursal = await prisma.e_estructura_sucursal.findUnique({ where: { id: marcaDia.corpo_id } });
        if (sucursal) {
          sucursalNombre = sucursal.nombre;
        }
      }
      const descriptionNotificacion = "El empleado " + empleadoNombre + " ha registrado un documento entregado para la sucursal del cliente " + clienteNombre + " con la fecha " + fechaDate.toISOString().split("T")[0];
      sendNotificationByRole(marcaDia.corpo_id, [parseInt(String(payload?.id ?? "0"), 10)], "Documento entregado registrado", descriptionNotificacion, ["ADMINISTRATIVO", "SUPERVISOR"]);
    }

    // Registrar cambio de creación
    const createdBy = parseInt(String(payload?.id ?? 0), 10) || 0;
    const createdAt = toZonedTime(new Date(), "America/Costa_Rica");
    await prisma.c_cambios_apps_modules.create({
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
            fecha: created.fecha.toISOString(),
            nombre_oficial_entrega: created.nombre_oficial_entrega,
            nombre_oficial_recibe: created.nombre_oficial_recibe,
            tipo_documento: created.tipo_documento,
            descripcion: created.descripcion,
          },
        }]),
        created_at: createdAt,
        created_by: createdBy,
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


