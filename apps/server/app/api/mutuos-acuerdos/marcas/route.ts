import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";

const parseIntStrict = (value: any) => {
  const n = parseInt(String(value), 10);
  return Number.isNaN(n) ? null : n;
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
    const { valid, expired, message } = await verifyAccessTokenByApi(req);
    if (!valid) return NextResponse.json({ status: false, expired, message, data: [] }, { status: expired ? 401 : 403 });

    const { searchParams } = new URL(req.url);
    const empleadoId = parseIntStrict(searchParams.get("empleado_id"));
    const fecha = String(searchParams.get("fecha") || "").trim();
    if (!empleadoId || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return NextResponse.json({ status: false, message: "Parámetros inválidos", data: [] }, { status: 400 });
    }

    console.log("fecha", fecha);

    const start = new Date(`${fecha}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const marcas = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_marca_dia",
        operation: "findMany",
        where: {
          empleadoFijo_id: empleadoId,
          fecha: fecha,
        },
        include: {
          e_estructura_cliente: { select: { nombre: true } },
          e_estructura_sucursal: { select: { nombre: true } },
          e_estructura_puesto: { select: { nombre: true } },
        },
        orderBy: [{ hora_inicio: "asc" }, { id: "asc" }],
      },
    });

    console.log("marcas", marcas);

    const marcaIds = (marcas || []).map((m: any) => Number(m.id)).filter(Boolean);
    if (marcaIds.length === 0) {
      return NextResponse.json({ status: true, message: "El empleado está libre ese día", data: [] }, { status: 200 });
    }

    const usados = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "e_mutuos_acuerdos",
        operation: "findMany",
        where: {
          OR: [
            { marcaDiaAusente_id: { in: marcaIds } },
            { marcaDiaReemplaza_id: { in: marcaIds } },
          ],
        },
        select: { marcaDiaAusente_id: true, marcaDiaReemplaza_id: true },
      },
    });

    const usedIds = new Set<number>();
    (usados || []).forEach((u: any) => {
      if (u?.marcaDiaAusente_id) usedIds.add(Number(u.marcaDiaAusente_id));
      if (u?.marcaDiaReemplaza_id) usedIds.add(Number(u.marcaDiaReemplaza_id));
    });

    const data = (marcas || [])
      .filter((m: any) => !usedIds.has(Number(m.id)))
      .map((m: any) => ({
        id: m.id,
        cliente_id: m.cliente_id ?? null,
        corpo_id: m.corpo_id ?? null,
        plaza_id: m.plaza_id ?? null,
        empleadoFijo_id: m.empleadoFijo_id ?? null,
        cliente: m.e_estructura_cliente?.nombre || null,
        sucursal: m.e_estructura_sucursal?.nombre || null,
        puesto: m.e_estructura_puesto?.nombre || null,
        hora_inicio: m.hora_inicio ? new Date(m.hora_inicio).toISOString() : null,
        hora_fin: m.hora_fin ? new Date(m.hora_fin).toISOString() : null,
        tipo_turno: m.tipo_turno || null,
        tipo_turno_texto: turnoTexto(m.tipo_turno),
      }));

    if (data.length === 0) {
      return NextResponse.json({ status: true, message: "El empleado está libre ese día", data: [] }, { status: 200 });
    }

    return NextResponse.json({ status: true, message: "Marcas obtenidas", data }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ status: false, message: errorMessage, data: [] }, { status: 400 });
  }
}
