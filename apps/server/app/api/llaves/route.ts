/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../utils/verifyToken";
import { prisma } from "../../../utils/prismaClient";
import { getUserMarca } from "../../../utils/getUserMarca";
import { toZonedTime } from "date-fns-tz";
import { sendNotificationByRole } from "../../../utils/sendNotification";

export async function GET(req: NextRequest) {
  try {
    const { valid, expired, payload, message } = verifyAccessToken(req);
    if (!valid) {
      return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });
    }

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

    const rows = await prisma.e_llave.findMany({
      where: {
        cliente_id: marcaDia.cliente_id,
        corpo_id: marcaDia.corpo_id,
      },
      include: {
        e_movimiento_llave: {
          orderBy: { id: "desc" },
        },
      },
      orderBy: { id: "desc" },
    });

    const mapped = rows.map((r) => ({
      id: r.id,
      cliente_id: r.cliente_id,
      corpo_id: r.corpo_id,
      puesto_id: r.puesto_id,
      lugar_abre: r.lugar_abre,
      cantidad_copias: r.cantidad_copias,
      observaciones: r.observaciones,
      firma_responsable: r.firma_responsable,
      created_by: r.created_by,
      created_at: r.created_at,
      id_local: "",
      movimientos: (r.e_movimiento_llave || []).map((m) => ({
        id: m.id,
        llave_id: m.llave_id,
        nombre_persona_recibe: m.nombre_persona_recibe,
        nombre_persona_entrega: m.nombre_persona_entrega,
        departamento: m.departamento,
        telefono: m.telefono,
        entrega: m.entrega,
        recibe: m.recibe,
        fecha: m.fecha,
        hora: m.hora,
        firma_entrega: m.firma_entrega,
        firma_recibe: m.firma_recibe,
        firma_responsable: m.firma_responsable,
        id_local: "",
      })),
    }));

    return NextResponse.json({ status: true, data: mapped }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in GET /api/llaves:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { valid, expired, payload, message } = verifyAccessToken(req);
    if (!valid) {
      return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });
    }

    const body = await req.json();
    const { marca_id, lugar_abre, cantidad_copias, observaciones, firma_responsable } = body ?? {};

    if (!marca_id || !lugar_abre || cantidad_copias === undefined || cantidad_copias === null || !firma_responsable) {
      return NextResponse.json({ status: false, message: "Datos incompletos" }, { status: 200 });
    }

    const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id: parseInt(String(marca_id)) } });
    if (!marcaDia) {
      return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 200 });
    }
    if (!marcaDia.puesto_id) {
      return NextResponse.json({ status: false, message: "Puesto no encontrado en marca" }, { status: 200 });
    }

    const createdAt = toZonedTime(new Date(), "America/Costa_Rica") as Date;
    const created = await prisma.e_llave.create({
      data: {
        cliente_id: marcaDia.cliente_id,
        corpo_id: marcaDia.corpo_id,
        puesto_id: marcaDia.puesto_id,
        lugar_abre: String(lugar_abre),
        cantidad_copias: parseInt(String(cantidad_copias)) || 0,
        observaciones: typeof observaciones === "string" ? observaciones : "",
        firma_responsable: String(firma_responsable),
        created_by: parseInt(String((payload as any)?.id ?? 0)) || 0,
        created_at: createdAt,
      },
    });

    if (created) {
      let empNombre = "Desconocido";
      let sucursalNombre = "Desconocida";
      let puestoNombre = "Desconocido";
      let fechaRegistro = createdAt.toISOString().split("T")[0];
      let horaRegistro = createdAt.toISOString().split("T")[1].split(".")[0];
      if (created.created_by) {
        const empleado = await prisma.c_empleado.findUnique({ where: { id: created.created_by } });
        if (empleado) {
          empNombre = empleado.nombre + " " + empleado.primer_apellido + " " + empleado.segundo_apellido;
        }
      }
      if (marcaDia.corpo_id) {
        const sucursal = await prisma.e_estructura_sucursal.findUnique({ where: { id: marcaDia.corpo_id } });
        if (sucursal) {
          sucursalNombre = sucursal.nombre;
        }
      }
      if (marcaDia.puesto_id) {
        const puesto = await prisma.e_estructura_puesto.findUnique({ where: { id: marcaDia.puesto_id } });
        if (puesto) {
          puestoNombre = puesto.nombre + " (" + puesto.codigo + ")";
        }
      }
      const description = "El empleado " + empNombre + " ha creado una llave en la sucursal " + sucursalNombre + " el día " + fechaRegistro + " a las " + horaRegistro;
      sendNotificationByRole(marcaDia.corpo_id, [created.created_by], "Llave registrada", description, ["ADMINISTRATIVO", "SUPERVISOR"]);
    }

    return NextResponse.json({ status: true, message: "Llave creada correctamente", id: created.id }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in POST /api/llaves:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}


