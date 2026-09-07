import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";
import { prisma } from "../../../../utils/prismaClient";
import { collectPlanillasMarcaIdsForDateRange } from "../../../../utils/getPermitTurnosFromPlanillasRange";
import {
  dateAtUtcMidnight,
  parseIntStrict,
  ymdFromFecha,
} from "../../../../utils/mutuosAcuerdosMarcas";
import { reportError } from "../../../../utils/reportError";

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
      await reportError(req, "api/mutuos-acuerdos/marcas", "GET", 400, "Token de Planillas no encontrado");
      return NextResponse.json(
        { status: false, message: "Token de Planillas no encontrado", data: [] },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(req.url);
    const empleadoId = parseIntStrict(searchParams.get("empleado_id"));
    const fecha = String(searchParams.get("fecha") || "").trim();
    if (!empleadoId || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      await reportError(req, "api/mutuos-acuerdos/marcas", "GET", 400, "Parámetros inválidos");
      return NextResponse.json({ status: false, message: "Parámetros inválidos", data: [] }, { status: 400 });
    }

    const empleado = await prisma.c_empleado.findUnique({ where: { id: empleadoId } });
    if (!empleado) {
      await reportError(req, "api/mutuos-acuerdos/marcas", "GET", 404, "Empleado no encontrado");
      return NextResponse.json({ status: false, message: "Empleado no encontrado", data: [] }, { status: 404 });
    }

    const dayDate = new Date(`${fecha}T00:00:00.000Z`);
    const dayIso = dateAtUtcMidnight(fecha).toISOString();

    // Si el empleado ya tiene mutuo/permiso ese día, no ofrecer turnos
    const mutuoConflict = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "e_mutuos_acuerdos",
        operation: "findFirst",
        where: {
          isActive: true,
          estado: { in: ["pendiente", "aprobado"] },
          OR: [
            {
              AND: [
                { OR: [{ empleadoAusente_id: empleadoId }, { empleadoReemplaza_id: empleadoId }] },
                { OR: [{ fecha_ausente: dayIso }, { fecha_reemplaza: dayIso }] },
              ],
            },
          ],
        },
      },
    });
    if (mutuoConflict) {
      return NextResponse.json(
        {
          status: true,
          message: "El empleado ya tiene un mutuo acuerdo pendiente/aprobado para esa fecha",
          data: [],
        },
        { status: 200 },
      );
    }

    const permitConflict = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_solicitud_permiso",
        operation: "findFirst",
        where: {
          empleado_id: empleadoId,
          isActive: true,
          estado: { in: ["pendiente", "aprobado"] },
          fecha_inicio: { lte: dayIso },
          fecha_fin: { gte: dayIso },
        },
      },
    });
    if (permitConflict) {
      const pInicio = ymdFromFecha(permitConflict.fecha_inicio);
      const pFin = ymdFromFecha(permitConflict.fecha_fin);
      return NextResponse.json(
        {
          status: true,
          message: `El empleado tiene un permiso ${permitConflict.estado} del ${pInicio} al ${pFin} que cubre esa fecha`,
          data: [],
        },
        { status: 200 },
      );
    }

    const marcasIds = await collectPlanillasMarcaIdsForDateRange({
      planillasToken,
      empleadoCodigo: String(empleado.codigo || ""),
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

    if ((marcas || []).length === 0) {
      return NextResponse.json({ status: true, message: "El empleado está libre ese día", data: [] }, { status: 200 });
    }

    const data = (marcas || []).map((m: any) => {
      const cId = m.contrato_id != null ? Number(m.contrato_id) : null;
      const divRaw = cId != null && cId > 0 ? divisionByContratoId.get(cId) : null;
      const divId = divRaw != null && Number.isFinite(Number(divRaw)) && Number(divRaw) > 0 ? Number(divRaw) : null;
      return {
        id: m.id,
        fecha: m.fecha ? new Date(m.fecha).toISOString() : null,
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

    return NextResponse.json({ status: true, message: "Marcas obtenidas", data }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    await reportError(req, "api/mutuos-acuerdos/marcas", "GET", 400, errorMessage);
    return NextResponse.json({ status: false, message: errorMessage, data: [] }, { status: 400 });
  }
}
