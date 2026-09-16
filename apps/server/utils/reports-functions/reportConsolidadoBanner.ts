/* eslint-disable @typescript-eslint/no-explicit-any */
import ExcelJS from "exceljs";
import type { ReportDataAccess } from "../reportDynamicPrisma";

/** Copia del mapeo módulo -> etiqueta de `apps/mobile/screens/ReportesScreen.tsx` (MODULO_PICKER_OPTIONS). */
export const MODULO_LABELS: Record<string, string> = {
    acciones_personales: "Acciones de personal",
    acta_entrega_productos: "Acta de entrega de productos",
    actividades: "Actividades",
    articulos_puesto: "Artículos del puesto",
    agenda_minuta: "Agenda minuta",
    apertura_cierre_puesto: "Apertura/Cierre de puesto",
    apreciacion_vulnerabilidad: "Apreciación de vulnerabilidad",
    bitacora_novedades: "Bitácora de novedades",
    cambios_ubicacion_puesto: "Cambios en ubicación del puesto",
    checklist_supervision: "Checklist de supervisión",
    control_asistencia: "Control de asistencia",
    documentos_entregados: "Documentos entregados",
    encuesta_satisfaccion: "Encuestas de satisfacción",
    entrega_puesto: "Entrega de puesto",
    evaluacion_personal: "Evaluación de personal",
    incidentes: "Incidentes",
    ingresos_usuario: "Ingresos de usuario",
    llaveros: "Llaveros",
    login_marca: "Login de marca",
    llaves: "Llaves",
    maestro_quejas: "Maestro de quejas y reclamos",
    manuales_puesto: "Manuales de trabajo",
    mantenimiento_articulos: "Mantenimiento de artículos",
    notas_voz: "Notas de voz",
    mutuos_acuerdos: "Mutuos acuerdos",
    producto_no_conforme: "Producto no conforme",
    registro_induccion_recorrido: "Registro de inducción y recorrido",
    registro_induccion_general: "Registro de inducción general",
    registro_vehiculos_corporativos: "Registro de vehículos",
    revision_vehiculos: "Revisión de vehículos",
    registro_visitas: "Personas",
    visitas_vehiculos: "Visitas de vehículos",
    registro_capacitaciones: "Registro de capacitaciones",
    solicitudes_permiso: "Solicitudes de permiso",
    tiempo_almuerzo: "Tiempo de almuerzo",
};

export function resolveModuleLabel(moduleKey: string): string {
    return MODULO_LABELS[moduleKey] ?? moduleKey;
}

/** Metadatos del reporte usados para armar el banner de contexto de cada hoja "Consolidado". */
export type ConsolidadoBannerMeta = {
    moduleKey: string;
    tipoReporte: string;
    nomenclatura: string;
    /** Nombre del reporte ya reconstruido con saltos de línea reales (control de versiones). */
    nombreEstructurado: string;
    filtersSummary: string;
};

function pad2(n: number): string {
    return String(n).padStart(2, "0");
}

/** `DD-MM-YYYY`. Acepta Date, string parseable o null/undefined. */
export function formatDateOnlyDMY(v: unknown): string {
    if (!v) return "";
    const d = v instanceof Date ? v : new Date(String(v));
    if (Number.isNaN(d.getTime())) return "";
    return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`;
}

/** `HH:MM:SS`. Acepta Date, string parseable o null/undefined. */
export function formatTimeOnlyHMS(v: unknown): string {
    if (!v) return "";
    const d = v instanceof Date ? v : new Date(String(v));
    if (Number.isNaN(d.getTime())) return "";
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/** `DD-MM-YYYY HH:MM:SS`. Acepta Date, string parseable o null/undefined. */
export function formatDateTimeDMY(v: unknown): string {
    if (!v) return "";
    const d = v instanceof Date ? v : new Date(String(v));
    if (Number.isNaN(d.getTime())) return "";
    return `${formatDateOnlyDMY(d)} ${formatTimeOnlyHMS(d)}`;
}

function humanizeFilterKey(key: string): string {
    const spaced = key
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/_/g, " ")
        .toLowerCase();
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function stringifyFilterValue(value: unknown): string {
    if (value == null) return "";
    if (Array.isArray(value)) {
        return value.map((v) => stringifyFilterValue(v)).filter((s) => s.length > 0).join(", ");
    }
    if (typeof value === "object") {
        try {
            return JSON.stringify(value);
        } catch {
            return "";
        }
    }
    return String(value).trim();
}

/**
 * Resumen genérico "Clave: valor; Clave: valor" de los filtros aplicados a la consulta del reporte.
 * No cura etiquetas por módulo (~33 formas de filtro distintas) — humaniza la clave y muestra el valor tal cual.
 */
export function buildFiltersSummary(moduleFilters: Record<string, unknown> | null | undefined): string {
    if (!moduleFilters || typeof moduleFilters !== "object") return "Sin filtros aplicados";
    const parts: string[] = [];
    for (const [key, rawValue] of Object.entries(moduleFilters)) {
        const value = stringifyFilterValue(rawValue);
        if (!value) continue;
        parts.push(`${humanizeFilterKey(key)}: ${value}`);
    }
    return parts.length > 0 ? parts.join("; ") : "Sin filtros aplicados";
}

const BORDER_THIN_BLACK: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FF000000" } },
    left: { style: "thin", color: { argb: "FF000000" } },
    bottom: { style: "thin", color: { argb: "FF000000" } },
    right: { style: "thin", color: { argb: "FF000000" } },
};

const WHITE_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };

/**
 * Aplica el banner de contexto estándar (filas 1-11) a la hoja principal de un reporte "Consolidado":
 * fondo blanco en todo el documento, título del módulo, datos del reporte, filtros aplicados y
 * el banner de nomenclatura/nombre. Deja la fila 11 "tocada" para que el próximo `addMainRow`
 * del caller escriba los encabezados de la tabla en la fila 12.
 */
export function applyConsolidadoReportBanner(
    ws: ExcelJS.Worksheet,
    meta: ConsolidadoBannerMeta,
    opts: { headerFillArgb: string; mainColumnCount: number },
): void {
    const lastCol = Math.max(13, opts.mainColumnCount + 2);
    for (let c = 1; c <= lastCol; c++) {
        ws.getColumn(c).fill = WHITE_FILL;
    }

    ws.mergeCells(2, 2, 2, 11); // B2:K2
    const titleCell = ws.getCell(2, 2);
    titleCell.value = "MÓDULO DE REPORTES";
    titleCell.font = { bold: true, size: 14 };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    titleCell.fill = WHITE_FILL;

    const labelValueRow = (row: number, label: string, value: string) => {
        const labelCell = ws.getCell(row, 2);
        labelCell.value = label;
        labelCell.font = { bold: true };
        labelCell.fill = WHITE_FILL;
        const valueCell = ws.getCell(row, 3);
        valueCell.value = value;
        valueCell.fill = WHITE_FILL;
    };

    labelValueRow(4, "Reporte", resolveModuleLabel(meta.moduleKey));
    labelValueRow(5, "Tipo de reporte", meta.tipoReporte);
    labelValueRow(6, "Exportación", "Excel");
    labelValueRow(8, "FILTROS", meta.filtersSummary);

    ws.mergeCells(10, 2, 10, 10); // B10:J10
    const nomenclaturaCell = ws.getCell(10, 2);
    nomenclaturaCell.value = meta.nomenclatura;
    nomenclaturaCell.font = { bold: true };
    nomenclaturaCell.alignment = { horizontal: "center", vertical: "middle" };
    nomenclaturaCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: opts.headerFillArgb } };
    for (let c = 2; c <= 10; c++) {
        ws.getCell(10, c).border = BORDER_THIN_BLACK;
        ws.getCell(10, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: opts.headerFillArgb } };
    }

    ws.mergeCells(10, 11, 10, 13); // K10:M10
    const nombreCell = ws.getCell(10, 11);
    nombreCell.value = meta.nombreEstructurado;
    nombreCell.font = { bold: true };
    nombreCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    for (let c = 11; c <= 13; c++) {
        ws.getCell(10, c).border = BORDER_THIN_BLACK;
        ws.getCell(10, c).fill = WHITE_FILL;
    }
    ws.getRow(10).height = 45;

    // Toca la fila 11 (en blanco) para que el próximo addRow del caller aterrice en la fila 12.
    ws.getCell(11, 2).value = null;
}

/** Escribe una fila en la hoja principal corrida una columna a la derecha (A queda vacía de margen). */
export function addMainRow(ws: ExcelJS.Worksheet, arr: unknown[]): ExcelJS.Row {
    return ws.addRow(["", ...arr]);
}

export type CambioRegistroInfo = { cedula: string; fechaHoraTexto: string };

/**
 * Trae, para cada `registro_id`, el último cambio registrado en `c_cambios_apps_modules` para
 * `nombreTabla`, resuelto a cédula del empleado que lo hizo. Un solo query + un batch de empleados.
 */
export async function fetchLatestCambiosPorRegistro(
    reportDb: ReportDataAccess,
    nombreTabla: string,
    registroIds: number[],
): Promise<Map<number, CambioRegistroInfo>> {
    const uniqueIds = [...new Set(registroIds.filter((n) => Number.isFinite(n) && n > 0))];
    if (uniqueIds.length === 0) return new Map();

    const cambios = (await reportDb.c_cambios_apps_modules.findMany({
        where: { nombre_tabla: nombreTabla, registro_id: { in: uniqueIds } },
        orderBy: { created_at: "desc" },
    })) as Array<{ registro_id: number; created_by: number; created_at: string | Date }>;

    const latestByRegistro = new Map<number, { created_by: number; created_at: string | Date }>();
    for (const c of cambios) {
        if (!latestByRegistro.has(c.registro_id)) {
            latestByRegistro.set(c.registro_id, { created_by: c.created_by, created_at: c.created_at });
        }
    }
    if (latestByRegistro.size === 0) return new Map();

    const empleadoIds = [...new Set([...latestByRegistro.values()].map((v) => v.created_by).filter((id) => id > 0))];
    const empleados = empleadoIds.length
        ? ((await reportDb.c_empleado.findMany({
              where: { id: { in: empleadoIds } },
              select: { id: true, cedula: true },
          })) as Array<{ id: number; cedula: string | null }>)
        : [];
    const cedulaById = new Map(empleados.map((e) => [e.id, e.cedula ?? ""]));

    const out = new Map<number, CambioRegistroInfo>();
    for (const [registroId, info] of latestByRegistro.entries()) {
        out.set(registroId, {
            cedula: cedulaById.get(info.created_by) ?? "",
            fechaHoraTexto: formatDateTimeDMY(info.created_at),
        });
    }
    return out;
}
