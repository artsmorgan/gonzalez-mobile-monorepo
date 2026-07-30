import axios from "axios";
import { prisma } from "./prismaClient";

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

export type PermitTurnoRow = {
  id: number;
  cliente: string | null;
  sucursal: string | null;
  puesto: string | null;
  hora_inicio: string | null;
  hora_fin: string | null;
  tipo_turno: string;
  horas_duracion: string | null;
  reemplazo_id: null;
};

/** 1 GET a PLANILLAS_URL/marcas por día; retorna ids únicos. */
export async function collectPlanillasMarcaIdsForDateRange(params: {
  planillasToken: string;
  empleadoCedula: string;
  fechaInicio: Date;
  fechaFin: Date;
}): Promise<number[]> {
  const planillasUrl = String(process.env.PLANILLAS_URL || "").trim().replace(/\/+$/, "");
  if (!planillasUrl) {
    throw new Error("PLANILLAS_URL no configurada");
  }

  const start = new Date(params.fechaInicio.toISOString().split("T")[0]);
  const end = new Date(params.fechaFin.toISOString().split("T")[0]);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start.getTime() > end.getTime()) {
    return [];
  }

  const marcasIdsSet = new Set<number>();
  let dateCursor = new Date(start.getTime());

  while (dateCursor.getTime() <= end.getTime()) {
    const fechaParam = dateCursor.toISOString().split("T")[0];
    try {
      const planillasResponse = await axios.get(`${planillasUrl}/marcas`, {
        headers: {
          Authorization: `Bearer ${params.planillasToken}`,
        },
        params: {
          empleado_codigo: params.empleadoCedula,
          fecha: fechaParam,
        },
      });

      const dayMarcas = planillasResponse?.data?.data?.marcas;
      if (Array.isArray(dayMarcas)) {
        for (const marca of dayMarcas) {
          const marcaId = Number(marca?.id);
          if (Number.isFinite(marcaId) && marcaId > 0) {
            marcasIdsSet.add(marcaId);
          }
        }
      }
    } catch (dayError: unknown) {
      const dayMsg = dayError instanceof Error ? dayError.message : "Error desconocido";
      console.error(`Error consultando Planillas /marcas para ${fechaParam}:`, dayMsg);
    }

    dateCursor = new Date(dateCursor.getTime() + 1 * 24 * 60 * 60 * 1000);
  }

  return Array.from(marcasIdsSet);
}

/**
 * Consulta PLANILLAS_URL/marcas un día a la vez en el rango, junta ids y
 * resuelve turnos desde c_marca_dia (opcionalmente filtrados por plaza).
 */
export async function getPermitTurnosFromPlanillasRange(params: {
  planillasToken: string;
  empleadoCedula: string;
  fechaInicio: Date;
  fechaFin: Date;
  plazaId?: number | null;
}): Promise<PermitTurnoRow[]> {
  const marcasIds = await collectPlanillasMarcaIdsForDateRange(params);
  if (marcasIds.length === 0) return [];

  const where: any = { id: { in: marcasIds } };
  if (params.plazaId != null) where.plaza_id = params.plazaId;

  const marcaArray = await prisma.c_marca_dia.findMany({
    where,
    orderBy: [{ fecha: "asc" }, { hora_inicio: "asc" }],
    include: {
      e_estructura_cliente: { select: { nombre: true } },
      e_estructura_sucursal: { select: { nombre: true } },
      e_estructura_puesto: { select: { nombre: true } },
    },
  });

  return marcaArray.map((m: any) => ({
    id: m.id,
    cliente: m.e_estructura_cliente?.nombre || null,
    sucursal: m.e_estructura_sucursal?.nombre || null,
    puesto: m.e_estructura_puesto?.nombre || null,
    hora_inicio: formatHoraLabel(m.hora_inicio ? new Date(m.hora_inicio).toISOString() : null),
    hora_fin: formatHoraLabel(m.hora_fin ? new Date(m.hora_fin).toISOString() : null),
    tipo_turno: turnoTexto(m.tipo_turno),
    horas_duracion:
      m.horas_duracion !== null && m.horas_duracion !== undefined ? String(m.horas_duracion) : null,
    reemplazo_id: null,
  }));
}
