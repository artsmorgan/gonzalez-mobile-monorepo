import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { prisma } from "../../../../utils/prismaClient";

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

export async function GET(req: NextRequest) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) return NextResponse.json({ status: false, expired, message, data: [] }, { status: expired ? 401 : 403 });

    const empleadoId = Number((payload as any)?.id || 0);
    if (!empleadoId) return NextResponse.json({ status: false, message: "Empleado inválido", data: [] }, { status: 400 });

    const fechaInicio = `${req.nextUrl.searchParams.get("fecha_inicio")}T00:00:00.000Z`;
    const fechaFin = `${req.nextUrl.searchParams.get("fecha_fin")}T00:00:00.000Z`;

    if (!fechaInicio || !fechaFin) {
      return NextResponse.json({ status: false, message: "Debes enviar fecha_inicio y fecha_fin válidas", data: [] }, { status: 400 });
    }
    if (new Date(fechaInicio).getTime() > new Date(fechaFin).getTime()) {
      return NextResponse.json({ status: false, message: "fecha_inicio no puede ser mayor a fecha_fin", data: [] }, { status: 400 });
    }

    const plazaIdParam = req.nextUrl.searchParams.get("plaza_id");
    const plazaId = plazaIdParam ? Number(plazaIdParam) : null;

    const where: any = {
      empleadoFijo_id: empleadoId,
      fecha: { gte: fechaInicio, lte: fechaFin },
    };
    if (plazaId != null && !Number.isNaN(plazaId)) where.plaza_id = plazaId;

    const rows = await prisma.c_marca_dia.findMany({
      where,
      orderBy: [{ fecha: "asc" }, { hora_inicio: "asc" }],
      include: {
        e_estructura_cliente: { select: { nombre: true } },
        e_estructura_sucursal: { select: { nombre: true } },
        e_estructura_puesto: { select: { nombre: true } },
      },
    });

    const data = rows.map((m) => ({
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

    return NextResponse.json({ status: true, message: data.length ? "Turnos encontrados" : "El usuario está libre en ese rango", data }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ status: false, message: errorMessage, data: [] }, { status: 400 });
  }
}
