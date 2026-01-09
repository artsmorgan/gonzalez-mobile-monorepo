/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../utils/verifyToken";
import { prisma } from "../../../utils/prismaClient";

function parseDateTime(value: any): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  if (isNaN(d.getTime())) return null;
  return d;
}

export async function GET(req: NextRequest) {
  try {
    const { valid, message } = verifyAccessToken(req);
    if (!valid) {
      return NextResponse.json({ status: false, message }, { status: 401 });
    }

    const rows = await prisma.c_boleta_apreciacion_vulnerabilidad.findMany({
      include: {
        e_estructura_cliente: { select: { nombre: true } },
        e_estructura_sucursal: { select: { nombre: true } },
        e_estructura_puesto: { select: { nombre: true } },
      },
      orderBy: { id: "desc" },
    });

    const mapped = rows.map((r) => ({
      id: r.id,
      cliente_id: r.cliente_id,
      cliente_nombre: (r as any).e_estructura_cliente?.nombre ?? "",
      corpo_id: r.corpo_id,
      corpo_nombre: (r as any).e_estructura_sucursal?.nombre ?? "",
      puesto_id: r.puesto_id,
      puesto_nombre: (r as any).e_estructura_puesto?.nombre ?? "",
      fecha: r.fecha,
      enlace: r.enlace,
      nombre_solicitante: r.nombre_solicitante,
      boleta: r.boleta,
      metricas_vulnerablidad: r.metricas_vulnerablidad,
      observaciones: r.observaciones ?? "",
      firma_solicitante: r.firma_solicitante,
      firma_responsable: r.firma_responsable,
      id_local: "",
    }));

    return NextResponse.json({ status: true, data: mapped }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in GET /api/apreciacion-vulnerabilidad:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { valid, message } = verifyAccessToken(req);
    if (!valid) {
      return NextResponse.json({ status: false, message }, { status: 401 });
    }

    const body = await req.json();
    const {
      cliente_id,
      corpo_id,
      puesto_id,
      fecha,
      enlace,
      nombre_solicitante,
      boleta,
      metricas_vulnerablidad,
      observaciones,
      firma_solicitante,
      firma_responsable,
    } = body ?? {};

    if (
      !cliente_id ||
      !corpo_id ||
      !puesto_id ||
      !fecha ||
      !enlace ||
      !nombre_solicitante ||
      !boleta ||
      !metricas_vulnerablidad ||
      !firma_solicitante ||
      !firma_responsable
    ) {
      return NextResponse.json({ status: false, message: "Datos incompletos" }, { status: 200 });
    }

    const fechaDate = parseDateTime(fecha);
    if (!fechaDate) {
      return NextResponse.json({ status: false, message: "Fecha inválida" }, { status: 200 });
    }

    // Validar IDs existan (mínimo)
    const [cliente, corpo, puesto] = await Promise.all([
      prisma.e_estructura_cliente.findUnique({ where: { id: parseInt(String(cliente_id)) } }),
      prisma.e_estructura_sucursal.findUnique({ where: { id: parseInt(String(corpo_id)) } }),
      prisma.e_estructura_puesto.findUnique({ where: { id: parseInt(String(puesto_id)) } }),
    ]);
    if (!cliente) return NextResponse.json({ status: false, message: "Cliente inválido" }, { status: 200 });
    if (!corpo) return NextResponse.json({ status: false, message: "Corpo inválido" }, { status: 200 });
    if (!puesto) return NextResponse.json({ status: false, message: "Puesto inválido" }, { status: 200 });

    const created = await prisma.c_boleta_apreciacion_vulnerabilidad.create({
      data: {
        cliente_id: parseInt(String(cliente_id)),
        corpo_id: parseInt(String(corpo_id)),
        puesto_id: parseInt(String(puesto_id)),
        fecha: fechaDate,
        enlace: String(enlace),
        nombre_solicitante: String(nombre_solicitante),
        boleta: String(boleta),
        metricas_vulnerablidad: String(metricas_vulnerablidad),
        observaciones: typeof observaciones === "string" ? observaciones : "",
        firma_solicitante: String(firma_solicitante),
        firma_responsable: String(firma_responsable),
      },
    });

    return NextResponse.json(
      { status: true, message: "Registro creado correctamente", id: created.id },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in POST /api/apreciacion-vulnerabilidad:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}


