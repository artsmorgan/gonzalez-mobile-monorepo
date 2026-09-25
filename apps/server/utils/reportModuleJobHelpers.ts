/* eslint-disable @typescript-eslint/no-explicit-any */
import { toZonedTime } from "date-fns-tz";
import type { ReportDataAccess } from "./reportDynamicPrisma";
import { DEFAULT_REPORT_MAX_ATTEMPTS } from "./reportJobQueue";
import { signalReportWorkerActivity } from "./reportWorkerSchedule";
import { normalizeMobileReportTipo, resolveMobileReportTipoFromModuleFilters } from "./mobileReportTipo";
import { normalizeActaEntregaFilters } from "./reports-functions/actaEntregaProductos";
import { normalizeLoginMarcaFilters } from "./reports-functions/loginMarcaReport";
import { normalizeSolicitudesPermisoFilters } from "./reports-functions/solicitudesPermisoReport";
import type { UserLoginModuleFilters } from "./reports-functions/userLogin";
import { normalizeAgendaMinutaFilters } from "./reports-functions/agendaMinutaReport";
import { normalizeAperturaCierrePuestoFilters } from "./reports-functions/aperturaCierrePuestoReport";
import { normalizeVulnerabilidadFilters } from "./reports-functions/vulnerabilidadReport";
import { normalizeActividadesFilters } from "./reports-functions/actividadesReport";
import { normalizeControlAsistenciaFilters } from "./reports-functions/controlAsistenciaReport";
import { normalizeDocumentosEntregadosFilters } from "./reports-functions/documentosEntregadosReport";
import { normalizeEncuestaSatisfaccionFilters } from "./reports-functions/encuestaSatisfaccionReport";
import { normalizeMutuosAcuerdosFilters } from "./reports-functions/mutuosAcuerdosReport";
import { normalizeAccionesPersonalesFilters } from "./reports-functions/accionesPersonalesReport";
import { normalizeEntregaPuestoFilters } from "./reports-functions/entregaPuestoReport";
import { normalizeIncidenteFilters } from "./reports-functions/incidentesReport";
import { normalizeLlavesFilters } from "./reports-functions/llavesReport";
import { normalizeLlaverosFilters } from "./reports-functions/llaverosReport";
import { normalizeBitacoraNovedadesFilters } from "./reports-functions/bitacoraNovedadesReport";
import { normalizeMaestroQuejasFilters } from "./reports-functions/maestroQuejasReport";
import { normalizeChecklistSupervisionFilters } from "./reports-functions/checklistSupervisionReport";
import { normalizeEvaluacionPersonalFilters } from "./reports-functions/evaluacionEmpleadoReport";
import { normalizeProductoNoConformeFilters } from "./reports-functions/productoNoConformeReport";
import { normalizeInduccionRecorridoFilters } from "./reports-functions/induccionRecorridoReport";
import { normalizeManualesPuestoFilters } from "./reports-functions/manualesPuestoReport";
import { normalizeArticulosPuestoFilters } from "./reports-functions/articulosPuestoReport";
import { normalizeMantenimientoArticulosFilters } from "./reports-functions/mantenimientoArticulosReport";
import { normalizeRegistroVehiculosCorporativosFilters } from "./reports-functions/registroVehiculosCorporativosReport";
import { normalizeRevisionVehiculosFilters } from "./reports-functions/revisionVehiculosReport";
import { normalizeRegistroVisitasFilters } from "./reports-functions/registroVisitasReport";
import { normalizeVisitasVehiculosFilters } from "./reports-functions/visitasVehiculosReport";
import { normalizeNotasVozFilters } from "./reports-functions/notasVozReport";
import { normalizeCambiosUbicacionPuestoFilters } from "./reports-functions/cambiosUbicacionPuestoReport";
import { normalizeRegistroCapacitacionesFilters } from "./reports-functions/registroCapacitacionesReport";
import { normalizeRegistroInduccionGeneralFilters } from "./reports-functions/registroInduccionGeneralReport";
import { normalizeTiempoAlmuerzoFilters } from "./reports-functions/tiempoAlmuerzoReport";

function normalizeUserLoginModuleFilters(raw: unknown): UserLoginModuleFilters {
  const o = raw != null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const next: UserLoginModuleFilters = {};
  const cds = o.creadoDesde;
  const chs = o.creadoHasta;
  if (cds != null && String(cds).trim() !== "") next.creadoDesde = String(cds);
  if (chs != null && String(chs).trim() !== "") next.creadoHasta = String(chs);
  if (o.soloMultiDispositivo === true || o.soloMultiDispositivo === 1 || o.soloMultiDispositivo === "1") {
    next.soloMultiDispositivo = true;
  }
  let ids: number[] = [];
  if (o.empleadoIngresoId != null && o.empleadoIngresoId !== "") {
    const n = Number(o.empleadoIngresoId);
    if (Number.isFinite(n) && n > 0) ids.push(n);
  }
  if (Array.isArray(o.empleadoIngresoIds)) {
    for (const x of o.empleadoIngresoIds) {
      const n = Number(x);
      if (Number.isFinite(n) && n > 0) ids.push(n);
    }
  }
  ids = [...new Set(ids)];
  if (ids.length > 0) next.empleadoIngresoIds = ids;
  const structureKeys = ["empresaIds", "clienteIds", "divisionIds", "contratoIds", "corpoIds", "puestoIds"] as const;
  for (const key of structureKeys) {
    const val = o[key];
    if (Array.isArray(val)) {
      const parsed = val.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0);
      if (parsed.length > 0) (next as Record<string, unknown>)[key] = parsed;
    }
  }
  return next;
}

export function coerceModuleFiltersInput(raw: unknown): unknown {
  if (raw == null) return {};
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      return typeof p === "object" && p !== null && !Array.isArray(p) ? p : {};
    } catch {
      return {};
    }
  }
  return raw;
}

export function normalizeModuleFiltersForModulo(modulo: string, raw: unknown): Record<string, unknown> {
  const input = coerceModuleFiltersInput(raw);
  switch (modulo) {
    case "acta_entrega_productos":
      return normalizeActaEntregaFilters(input) as Record<string, unknown>;
    case "entrega_puesto":
      return normalizeEntregaPuestoFilters(input) as Record<string, unknown>;
    case "agenda_minuta":
      return normalizeAgendaMinutaFilters(input) as Record<string, unknown>;
    case "apertura_cierre_puesto":
      return normalizeAperturaCierrePuestoFilters(input) as Record<string, unknown>;
    case "apreciacion_vulnerabilidad":
      return normalizeVulnerabilidadFilters(input) as Record<string, unknown>;
    case "actividades":
      return normalizeActividadesFilters(input) as Record<string, unknown>;
    case "control_asistencia":
      return normalizeControlAsistenciaFilters(input) as Record<string, unknown>;
    case "documentos_entregados":
      return normalizeDocumentosEntregadosFilters(input) as Record<string, unknown>;
    case "encuesta_satisfaccion":
      return normalizeEncuestaSatisfaccionFilters(input) as Record<string, unknown>;
    case "registro_visitas":
      return normalizeRegistroVisitasFilters(input) as Record<string, unknown>;
    case "visitas_vehiculos":
      return normalizeVisitasVehiculosFilters(input) as Record<string, unknown>;
    case "notas_voz":
      return normalizeNotasVozFilters(input) as Record<string, unknown>;
    case "cambios_ubicacion_puesto":
      return normalizeCambiosUbicacionPuestoFilters(input) as Record<string, unknown>;
    case "registro_capacitaciones":
      return normalizeRegistroCapacitacionesFilters(input) as Record<string, unknown>;
    case "registro_induccion_general":
      return normalizeRegistroInduccionGeneralFilters(input) as Record<string, unknown>;
    case "tiempo_almuerzo":
      return normalizeTiempoAlmuerzoFilters(input) as Record<string, unknown>;
    case "solicitudes_permiso":
      return normalizeSolicitudesPermisoFilters(input) as Record<string, unknown>;
    case "mutuos_acuerdos":
      return normalizeMutuosAcuerdosFilters(input) as Record<string, unknown>;
    case "evaluacion_personal":
      return normalizeEvaluacionPersonalFilters(input) as Record<string, unknown>;
    case "producto_no_conforme":
      return normalizeProductoNoConformeFilters(input) as Record<string, unknown>;
    case "registro_induccion_recorrido":
      return normalizeInduccionRecorridoFilters(input) as Record<string, unknown>;
    case "manuales_puesto":
      return normalizeManualesPuestoFilters(input) as Record<string, unknown>;
    case "articulos_puesto":
      return normalizeArticulosPuestoFilters(input) as Record<string, unknown>;
    case "mantenimiento_articulos":
      return normalizeMantenimientoArticulosFilters(input) as Record<string, unknown>;
    case "registro_vehiculos_corporativos":
      return normalizeRegistroVehiculosCorporativosFilters(input) as Record<string, unknown>;
    case "revision_vehiculos":
      return normalizeRevisionVehiculosFilters(input) as Record<string, unknown>;
    case "acciones_personales":
      return normalizeAccionesPersonalesFilters(input) as Record<string, unknown>;
    case "incidentes":
      return normalizeIncidenteFilters(input) as Record<string, unknown>;
    case "llaves":
      return normalizeLlavesFilters(input) as Record<string, unknown>;
    case "llaveros":
      return normalizeLlaverosFilters(input) as Record<string, unknown>;
    case "bitacora_novedades":
      return normalizeBitacoraNovedadesFilters(input) as Record<string, unknown>;
    case "maestro_quejas":
      return normalizeMaestroQuejasFilters(input) as Record<string, unknown>;
    case "checklist_supervision":
      return normalizeChecklistSupervisionFilters(input) as Record<string, unknown>;
    case "login_marca":
      return normalizeLoginMarcaFilters(input) as Record<string, unknown>;
    default:
      return normalizeUserLoginModuleFilters(input) as Record<string, unknown>;
  }
}

export function resolveTipoReporteForJob(
  modulo: string,
  tipoReporte: string | undefined,
  rawModuleFilters: Record<string, unknown>
): string {
  let tipo =
    normalizeMobileReportTipo(tipoReporte) ??
    normalizeMobileReportTipo(rawModuleFilters.tipo_reporte as string) ??
    "Grupal";
  const fromFilters = resolveMobileReportTipoFromModuleFilters(rawModuleFilters);
  if (fromFilters === "Individual" || fromFilters === "Consolidado") {
    tipo = fromFilters;
  }
  if (
    [
      "ingresos_usuario",
      "acciones_personales",
      "bitacora_novedades",
      "checklist_supervision",
      "evaluacion_personal",
      "manuales_puesto",
      "notas_voz",
      "cambios_ubicacion_puesto",
      "registro_capacitaciones",
      "tiempo_almuerzo",
      "login_marca",
    ].includes(modulo)
  ) {
    tipo = "Grupal";
  }
  if (
    ["articulos_puesto", "mantenimiento_articulos", "registro_vehiculos_corporativos", "login_marca"].includes(
      modulo
    )
  ) {
    tipo = "Consolidado";
  }
  if (modulo === "revision_vehiculos" && tipo !== "Individual") {
    tipo = "Consolidado";
  }
  return tipo;
}

export function defaultOrderByForModulo(modulo: string): string {
  const structureDefault = [
    "acta_entrega_productos",
    "entrega_puesto",
    "agenda_minuta",
    "apreciacion_vulnerabilidad",
    "control_asistencia",
    "documentos_entregados",
    "encuesta_satisfaccion",
    "mutuos_acuerdos",
    "evaluacion_personal",
    "producto_no_conforme",
    "registro_induccion_recorrido",
    "registro_visitas",
    "visitas_vehiculos",
    "notas_voz",
    "cambios_ubicacion_puesto",
    "registro_capacitaciones",
    "registro_induccion_general",
    "tiempo_almuerzo",
    "solicitudes_permiso",
    "manuales_puesto",
    "articulos_puesto",
    "mantenimiento_articulos",
    "registro_vehiculos_corporativos",
    "revision_vehiculos",
    "incidentes",
    "llaves",
    "llaveros",
    "bitacora_novedades",
    "maestro_quejas",
    "checklist_supervision",
  ];
  if (structureDefault.includes(modulo)) {
    if (modulo === "incidentes") return "created_at";
    if (modulo === "bitacora_novedades") return "titulo";
    if (modulo === "manuales_puesto") return "title";
    return "empresa_id";
  }
  if (modulo === "actividades") return "fecha";
  if (modulo === "apertura_cierre_puesto") return "created_by";
  return "nombre_usuario";
}

export type InsertMobileReportJobParams = {
  modulo: string;
  nombre: string;
  numero: string;
  nomenclatura: string;
  descripcion?: string;
  tipo_reporte: string;
  order_by?: string;
  firma_responsable: string;
  moduleFilters: Record<string, unknown>;
  serviceAccessToken?: string;
  empleadoId: number;
  /** Marcador opcional para recuperar filas tras `createMany`. */
  batchId?: string;
};

export type MobileReportJobCreateRow = {
  nombre: string;
  numero: string;
  nomenclatura: string;
  descripcion: string | null;
  modulo: string;
  tipo_reporte: string;
  created_by: number;
  created_at: Date;
  estado: string;
  filters: string;
  order_by: string;
  firma_responsable: string;
  attemps: number;
  max_attempts: number;
  progress: number;
};

/** Construye el payload de fila para `e_reportes_mobile` (sin insertar). */
export function buildMobileReportJobCreateData(
  params: InsertMobileReportJobParams
): MobileReportJobCreateRow {
  const modulo = String(params.modulo || "").trim();
  const moduleFilters = normalizeModuleFiltersForModulo(modulo, params.moduleFilters);
  const tipo = resolveTipoReporteForJob(modulo, params.tipo_reporte, moduleFilters);
  const orderByVal = String(params.order_by || defaultOrderByForModulo(modulo)).trim();

  const filtersObj = {
    moduleKey: modulo,
    moduleFilters,
    ...(params.serviceAccessToken ? { serviceAccessToken: params.serviceAccessToken } : {}),
    ...(params.batchId ? { puestoBatchId: params.batchId } : {}),
    formMeta: {
      nombre: params.nombre,
      numero: params.numero,
      nomenclatura: params.nomenclatura,
      descripcion: params.descripcion ?? "",
      tipo_reporte: tipo,
      reportOutputType: tipo,
    },
  };

  return {
    nombre: params.nombre,
    numero: params.numero,
    nomenclatura: params.nomenclatura,
    descripcion: params.descripcion ?? null,
    modulo,
    tipo_reporte: tipo,
    created_by: params.empleadoId,
    created_at: toZonedTime(new Date(), "America/Costa_Rica"),
    estado: "pendiente",
    filters: JSON.stringify(filtersObj),
    order_by: orderByVal,
    firma_responsable: params.firma_responsable,
    attemps: 0,
    max_attempts: DEFAULT_REPORT_MAX_ATTEMPTS,
    progress: 0,
  };
}

export async function insertMobileReportJob(
  reportDb: ReportDataAccess,
  params: InsertMobileReportJobParams
): Promise<{ id: number; estado: string }> {
  const created = await reportDb.e_reportes_mobile.create({
    data: buildMobileReportJobCreateData(params),
  });

  return { id: created.id, estado: String(created.estado || "pendiente") };
}

export function buildPuestoModuleFiltersRaw(params: {
  modulo: string;
  puestoId: number;
  creadoDesde?: string | null;
  creadoHasta?: string | null;
}): Record<string, unknown> {
  const base: Record<string, unknown> = {
    empresaIds: [],
    clienteIds: [],
    divisionIds: [],
    contratoIds: [],
    corpoIds: [],
    puestoIds: [params.puestoId],
  };

  if (params.modulo === "articulos_puesto") {
    return base;
  }

  const desde = params.creadoDesde ? String(params.creadoDesde).trim() : "";
  const hasta = params.creadoHasta ? String(params.creadoHasta).trim() : "";

  if (params.modulo === "mutuos_acuerdos") {
    if (desde) base.fechaReporteDesde = desde;
    if (hasta) base.fechaReporteHasta = hasta;
    return base;
  }

  if (params.modulo === "tiempo_almuerzo") {
    if (desde) base.inicioDesde = desde;
    if (hasta) base.finHasta = hasta;
    return base;
  }

  if (params.modulo === "incidentes" || params.modulo === "checklist_supervision") {
    if (desde) base.fechaReporteDesde = desde;
    if (hasta) base.fechaReporteHasta = hasta;
    return base;
  }

  if (desde) base.creadoDesde = desde;
  if (hasta) base.creadoHasta = hasta;
  return base;
}

export function signalReportJobsCreated(): void {
  signalReportWorkerActivity("createReportePuesto");
}
