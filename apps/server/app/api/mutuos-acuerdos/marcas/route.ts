import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";
import { prisma } from "../../../../utils/prismaClient";
import { collectPlanillasMarcaIdsForDateRange } from "../../../../utils/getPermitTurnosFromPlanillasRange";

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

    const planillasToken =
      decodeURIComponent(req.headers.get("Planillas-Token") ?? "").trim() || null;
    if (!planillasToken) {
      return NextResponse.json(
        { status: false, message: "Token de Planillas no encontrado", data: [] },
        { status: 200 }
      );
    }

    const { searchParams } = new URL(req.url);
    const empleadoId = parseIntStrict(searchParams.get("empleado_id"));
    const fecha = String(searchParams.get("fecha") || "").trim();
    if (!empleadoId || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return NextResponse.json({ status: false, message: "Parámetros inválidos", data: [] }, { status: 400 });
    }

    const empleado = await prisma.c_empleado.findUnique({ where: { id: empleadoId } });
    if (!empleado) {
      return NextResponse.json({ status: false, message: "Empleado no encontrado", data: [] }, { status: 200 });
    }

    const dayDate = new Date(`${fecha}T00:00:00.000Z`);
    const marcasIds = await collectPlanillasMarcaIdsForDateRange({
      planillasToken,
      empleadoCedula: String(empleado.cedula || ""),
      fechaInicio: dayDate,
      fechaFin: dayDate,
    });

    if (marcasIds.length === 0) {
      return NextResponse.json({ status: true, message: "El empleado está libre ese día", data: [] }, { status: 200 });
    }

    const marcas = await prisma.c_marca_dia.findMany({
      where: { id: { in: marcasIds } },
      include: {
        e_estructura_cliente: { select: { nombre: true } },
        e_estructura_sucursal: { select: { nombre: true } },
        e_estructura_puesto: { select: { nombre: true } },
      },
      orderBy: [{ hora_inicio: "asc" }, { id: "asc" }],
    });

    const contratoIds = Array.from(
      new Set(
        (marcas || [])
          .map((m: any) => parseIntStrict(m?.contrato_id))
          .filter((x: number | null): x is number => x != null && x > 0)
      )
    );
    const contratos =
      contratoIds.length > 0
        ? await prisma.e_estructura_contrato.findMany({
            where: { id: { in: contratoIds } },
            select: { id: true, division_id: true },
          })
        : [];
    const divisionByContratoId = new Map<number, number | null>(
      (contratos || []).map((c: any) => [Number(c.id), c?.division_id != null ? Number(c.division_id) : null])
    );

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
          AND: [
            { isActive: true },
            {
              OR: [
                { marcaDiaAusente_id: { in: marcaIds } },
                { marcaDiaReemplaza_id: { in: marcaIds } },
              ],
            },
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
      .map((m: any) => {
        const cId = m.contrato_id != null ? Number(m.contrato_id) : null;
        const divRaw = cId != null && cId > 0 ? divisionByContratoId.get(cId) : null;
        const divId = divRaw != null && Number.isFinite(Number(divRaw)) && Number(divRaw) > 0 ? Number(divRaw) : null;
        return {
          id: m.id,
          cliente_id: m.cliente_id ?? null,
          corpo_id: m.corpo_id ?? null,
          plaza_id: m.plaza_id ?? null,
          empleadoFijo_id: m.empleadoFijo_id ?? null,
          empresa_id: m.empresa_id != null ? Number(m.empresa_id) : null,
          puesto_id: m.puesto_id != null ? Number(m.puesto_id) : null,
          contrato_id: cId != null && cId > 0 ? cId : null,
          division_id: divId,
          cliente: m.e_estructura_cliente?.nombre || null,
          sucursal: m.e_estructura_sucursal?.nombre || null,
          puesto: m.e_estructura_puesto?.nombre || null,
          hora_inicio: m.hora_inicio ? new Date(m.hora_inicio).toISOString() : null,
          hora_fin: m.hora_fin ? new Date(m.hora_fin).toISOString() : null,
          tipo_turno: m.tipo_turno || null,
          tipo_turno_texto: turnoTexto(m.tipo_turno),
        };
      });

    if (data.length === 0) {
      return NextResponse.json({ status: true, message: "El empleado está libre ese día", data: [] }, { status: 200 });
    }

    return NextResponse.json({ status: true, message: "Marcas obtenidas", data }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ status: false, message: errorMessage, data: [] }, { status: 400 });
  }
}
