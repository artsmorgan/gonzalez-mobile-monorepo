/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "fs/promises";
import path from "path";
import type { ReportDataAccess } from "../reportDynamicPrisma";
import ExcelJS from "exceljs";
import {
    normalizeActaEntregaFilters,
    type ActaEntregaModuleFilters,
} from "./actaEntregaProductos";
import {
    attachLocationChainToPuestos,
    flattenChildRows,
    hydratePreexistentChildRelations,
    splitIncludeByTableGroup,
} from "../hydratePreexistentIncludes";
import {
    addMainRow,
    applyConsolidadoReportBanner,
    fetchLatestCambiosPorRegistro,
    formatDateOnlyDMY,
    formatTimeOnlyHMS,
    type ConsolidadoBannerMeta,
} from "./reportConsolidadoBanner";

const ACTIVIDADES_REPORT_INCLUDE = {
    e_actividades_puesto: {
        include: {
            e_actividades_puesto_plaza: true,
        },
    },
};

export type ActividadesModuleFilters = ActaEntregaModuleFilters & { tipoTurno?: string | null };
export type ActividadesOrderKey = "fecha" | "nombre_actividad";

function parseBoundaryDate(s: string | undefined | null): Date | null {
    if (!s || String(s).trim() === "") return null;
    const t = String(s).trim();
    const d = new Date(t.includes("T") ? t : t.replace(" ", "T"));
    return Number.isNaN(d.getTime()) ? null : d;
}

export function normalizeActividadesFilters(raw: unknown): ActividadesModuleFilters {
    const base = normalizeActaEntregaFilters(raw);
    const tipoTurnoRaw = String((raw as Record<string, unknown> | null | undefined)?.tipoTurno ?? "").trim().toUpperCase();
    return {
        ...base,
        tipoTurno: ["D", "M", "N"].includes(tipoTurnoRaw) ? tipoTurnoRaw : null,
    };
}

export function hasActividadesListModuleFiltersContent(f: ActividadesModuleFilters): boolean {
    if (f.creadoDesde) return true;
    if (f.creadoHasta) return true;
    if (f.empresaIds && f.empresaIds.length > 0) return true;
    if (f.clienteIds && f.clienteIds.length > 0) return true;
    if (f.divisionIds && f.divisionIds.length > 0) return true;
    if (f.contratoIds && f.contratoIds.length > 0) return true;
    if (f.corpoIds && f.corpoIds.length > 0) return true;
    if (f.puestoIds && f.puestoIds.length > 0) return true;
    if (f.tipoTurno) return true;
    return false;
}

export function filtersMatchActividadesListQuery(parsedRowFilters: any, listModuleFilters?: ActividadesModuleFilters): boolean {
    if (!listModuleFilters) return true;
    const mf = (parsedRowFilters?.moduleFilters || {}) as Record<string, unknown>;
    const saved = normalizeActividadesFilters(mf);
    const overlaps = (left?: number[] | null, right?: number[] | null) => {
        if (!left || left.length === 0) return true;
        if (!right || right.length === 0) return false;
        return left.some((x) => right.includes(x));
    };
    if (listModuleFilters.creadoDesde && String(saved.creadoDesde || "") !== String(listModuleFilters.creadoDesde)) return false;
    if (listModuleFilters.creadoHasta && String(saved.creadoHasta || "") !== String(listModuleFilters.creadoHasta)) return false;
    if (!overlaps(listModuleFilters.empresaIds ?? undefined, saved.empresaIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.clienteIds ?? undefined, saved.clienteIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.divisionIds ?? undefined, saved.divisionIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.contratoIds ?? undefined, saved.contratoIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.corpoIds ?? undefined, saved.corpoIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.puestoIds ?? undefined, saved.puestoIds ?? undefined)) return false;
    if (listModuleFilters.tipoTurno && String(saved.tipoTurno || "") !== String(listModuleFilters.tipoTurno)) return false;
    return true;
}

const now = () => new Date();
const inactiveOk = () => [{ fecha_inactivacion: null }, { fecha_inactivacion: { gte: now() } }] as const;

function puestoActiveWhere() {
    return { deleted: null as Date | null, OR: [...inactiveOk()] };
}

function intersectIds(acc: number[] | null, next: number[]): number[] {
    if (acc === null) return [...new Set(next)];
    const set = new Set(next);
    return acc.filter((x) => set.has(x));
}

/** Resuelve puestos activos según filtros estructurales (AND entre niveles). Sin filtros estructurales → undefined (no restringir por puesto). */
export async function resolvePuestoIdsForActividades(prisma: ReportDataAccess, f: ActividadesModuleFilters): Promise<number[] | undefined> {
    const has =
        (f.puestoIds?.length ?? 0) > 0 ||
        (f.corpoIds?.length ?? 0) > 0 ||
        (f.contratoIds?.length ?? 0) > 0 ||
        (f.divisionIds?.length ?? 0) > 0 ||
        (f.clienteIds?.length ?? 0) > 0 ||
        (f.empresaIds?.length ?? 0) > 0;

    if (!has) return undefined;

    let acc: number[] | null = null;
    const pw = puestoActiveWhere();
    const corpWhere = { deleted: null as Date | null, OR: [...inactiveOk()] };
    const ctrWhere = { deleted: null as Date | null, OR: [...inactiveOk()] };

    const puestosFromSucursales = async (sucursalIds: number[]) => {
        if (sucursalIds.length === 0) return [] as number[];
        const rows = await prisma.e_estructura_puesto.findMany({
            where: { sucursal_id: { in: sucursalIds }, ...pw },
            select: { id: true },
        });
        return rows.map((r) => r.id);
    };

    const sucursalesFromContratos = async (contratoIds: number[]) => {
        if (contratoIds.length === 0) return [] as number[];
        const rows = await prisma.e_estructura_sucursal.findMany({
            where: { contrato_id: { in: contratoIds }, ...corpWhere },
            select: { id: true },
        });
        return rows.map((r) => r.id);
    };

    const contratosFromDivisiones = async (divisionIds: number[]) => {
        if (divisionIds.length === 0) return [] as number[];
        const rows = await prisma.e_estructura_contrato.findMany({
            where: { division_id: { in: divisionIds }, ...ctrWhere },
            select: { id: true },
        });
        return rows.map((r) => r.id);
    };

    const contratosFromClientes = async (clienteIds: number[]) => {
        if (clienteIds.length === 0) return [] as number[];
        const rows = await prisma.e_estructura_contrato.findMany({
            where: { cliente_id: { in: clienteIds }, ...ctrWhere },
            select: { id: true },
        });
        return rows.map((r) => r.id);
    };

    const contratosFromEmpresas = async (empresaIds: number[]) => {
        if (empresaIds.length === 0) return [] as number[];
        const rows = await prisma.e_estructura_contrato.findMany({
            where: { empresa_id: { in: empresaIds }, ...ctrWhere },
            select: { id: true },
        });
        return rows.map((r) => r.id);
    };

    if (f.puestoIds?.length) {
        const rows = await prisma.e_estructura_puesto.findMany({
            where: { id: { in: f.puestoIds }, ...pw },
            select: { id: true },
        });
        acc = intersectIds(acc, rows.map((r) => r.id));
    }
    if (f.corpoIds?.length) {
        const rows = await prisma.e_estructura_puesto.findMany({
            where: { sucursal_id: { in: f.corpoIds }, ...pw },
            select: { id: true },
        });
        acc = intersectIds(acc, rows.map((r) => r.id));
    }
    if (f.contratoIds?.length) {
        const sids = await sucursalesFromContratos(f.contratoIds);
        const pids = await puestosFromSucursales(sids);
        acc = intersectIds(acc, pids);
    }
    if (f.divisionIds?.length) {
        const cids = await contratosFromDivisiones(f.divisionIds);
        const sids = await sucursalesFromContratos(cids);
        const pids = await puestosFromSucursales(sids);
        acc = intersectIds(acc, pids);
    }
    if (f.clienteIds?.length) {
        const cids = await contratosFromClientes(f.clienteIds);
        const sids = await sucursalesFromContratos(cids);
        const pids = await puestosFromSucursales(sids);
        acc = intersectIds(acc, pids);
    }
    if (f.empresaIds?.length) {
        const cids = await contratosFromEmpresas(f.empresaIds);
        const sids = await sucursalesFromContratos(cids);
        const pids = await puestosFromSucursales(sids);
        acc = intersectIds(acc, pids);
    }

    return acc === null ? [] : acc;
}

export function frecuenciaTitleOnly(raw: string | null | undefined, separator = ", "): string {
    if (!raw || String(raw).trim() === "") return "";
    try {
        const p = JSON.parse(String(raw));
        if (Array.isArray(p)) {
            return p
                .map((x: any) => (x && typeof x === "object" && x.title != null ? String(x.title) : ""))
                .filter(Boolean)
                .join(separator);
        }
        if (p && typeof p === "object" && p.title != null) return String(p.title);
    } catch {
        return String(raw).slice(0, 200);
    }
    return "";
}

/** Horarios HH:mm (propiedad opcional `schedule` en JSON de frecuencia). */
export function frecuenciaScheduleStr(raw: string | null | undefined): string {
    if (!raw || String(raw).trim() === "") return "";
    try {
        const p = JSON.parse(String(raw));
        const pick = (obj: unknown) => {
            if (!obj || typeof obj !== "object") return;
            const s = (obj as Record<string, unknown>).schedule;
            if (!Array.isArray(s)) return;
            return s.filter((x) => typeof x === "string" && /^\d{2}:\d{2}$/.test(String(x).trim())).map((x) => String(x).trim());
        };
        let parts: string[] = [];
        if (Array.isArray(p)) {
            for (const x of p) {
                const t = pick(x);
                if (t?.length) parts = parts.concat(t);
            }
        } else if (p && typeof p === "object") {
            const t = pick(p);
            if (t?.length) parts = t;
        }
        const uniq = [...new Set(parts)].sort();
        return uniq.join(", ");
    } catch {
        return "";
    }
}

/** Excluye plazas usadas solo para “huecos virtuales”. */
export function plazaCodigoExcluyeArroba(codigoPlaza: string | null | undefined): boolean {
    return String(codigoPlaza ?? "").includes("@");
}

/** Incluir fila de plaza en Excel consolidado (misma regla que Individual / maestros). */ // Consolidado
function actividadPuestoPlazaIncluyeReporteConsolidado(pl: {
    e_estructura_plazas?: { codigo_plaza?: string | null } | null;
}): boolean {
    return !plazaCodigoExcluyeArroba(pl?.e_estructura_plazas?.codigo_plaza);
}

async function resolveActividadesLogoPath(empresaId: number): Promise<string | null> {
    const logoName = empresaId === 9 ? "9.png" : empresaId === 10 ? "10.png" : null;
    if (!logoName) return null;
    const p = path.resolve(process.cwd(), "app", "logo-images", logoName);
    try {
        await fs.access(p);
        return p;
    } catch {
        return null;
    }
}

/** Dimensiones píxeles del PNG (IHDR); null si no es PNG válido. */
function readPngIntrinsicPx(buf: Buffer): { w: number; h: number } | null {
    if (buf.length < 24 || buf[0] !== 0x89) return null;
    if (buf.toString("ascii", 1, 4) !== "PNG") return null;
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
    return { w, h };
}

/** Tamaño de visualización en píxeles: proporción original, encaja en caja sin deformar. */
async function logoDisplayPx(logoPath: string, maxW: number, maxH: number): Promise<{ w: number; h: number }> {
    try {
        const buf = await fs.readFile(logoPath);
        const dim = readPngIntrinsicPx(buf);
        if (!dim) return { w: Math.min(200, maxW), h: Math.min(56, maxH) };
        const scale = Math.min(maxW / dim.w, maxH / dim.h, 1);
        return { w: Math.max(1, Math.round(dim.w * scale)), h: Math.max(1, Math.round(dim.h * scale)) };
    } catch {
        return { w: Math.min(200, maxW), h: Math.min(56, maxH) };
    }
}

const BLACK: Partial<ExcelJS.Border> = { color: { argb: "FF000000" } };
const borderThinBlack: Partial<ExcelJS.Borders> = {
    top: { style: "thin", ...BLACK },
    left: { style: "thin", ...BLACK },
    bottom: { style: "thin", ...BLACK },
    right: { style: "thin", ...BLACK },
};

function setCellBorderSides(
    ws: ExcelJS.Worksheet,
    row: number,
    col: number,
    sides: { top?: ExcelJS.BorderStyle; bottom?: ExcelJS.BorderStyle; left?: ExcelJS.BorderStyle; right?: ExcelJS.BorderStyle },
) {
    const cell = ws.getCell(row, col);
    const prev = (cell.border || {}) as Partial<ExcelJS.Borders>;
    cell.border = {
        top: sides.top ? { style: sides.top, ...BLACK } : prev.top,
        bottom: sides.bottom ? { style: sides.bottom, ...BLACK } : prev.bottom,
        left: sides.left ? { style: sides.left, ...BLACK } : prev.left,
        right: sides.right ? { style: sides.right, ...BLACK } : prev.right,
    };
}

/** Relleno blanco y borde exterior negro grueso en [r1,c1]-[r2,c2]. */
function applyOuterWhiteFrame(ws: ExcelJS.Worksheet, r1: number, c1: number, r2: number, c2: number) {
    const white = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } } as const;
    for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
            ws.getCell(r, c).fill = white;
        }
    }
    for (let c = c1; c <= c2; c++) {
        setCellBorderSides(ws, r1, c, { top: "medium" });
        setCellBorderSides(ws, r2, c, { bottom: "medium" });
    }
    for (let r = r1; r <= r2; r++) {
        setCellBorderSides(ws, r, c1, { left: "medium" });
        setCellBorderSides(ws, r, c2, { right: "medium" });
    }
}

function sanitizeSheetName(name: string, fallback: string): string {
    const cleaned = String(name || "")
        .replace(/[:\\/?*[\]]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    let s = cleaned || fallback;
    if (s.length > 31) s = s.slice(0, 31).trim();
    return s || fallback;
}

function uniqSheetNames(plazasMeta: Array<{ plazaId: number; label: string }>): Map<number, string> {
    const used = new Set<string>();
    const map = new Map<number, string>();
    for (const { plazaId, label } of plazasMeta) {
        let base = sanitizeSheetName(label, `Plaza ${plazaId}`);
        let candidate = base;
        let n = 0;
        while (used.has(candidate)) {
            n += 1;
            const suffix = ` (${n})`;
            candidate = sanitizeSheetName(`${base.slice(0, Math.max(1, 31 - suffix.length))}${suffix}`, `P-${plazaId}`);
        }
        used.add(candidate);
        map.set(plazaId, candidate);
    }
    return map;
}

function parseArticles(raw: string | null | undefined): any[] {
    if (!raw || String(raw).trim() === "") return [];
    try {
        const p = JSON.parse(String(raw));
        return Array.isArray(p) ? p : [];
    } catch {
        return [];
    }
}

export async function queryActividadesReportRows(prisma: ReportDataAccess, filters: ActividadesModuleFilters, orderKey: ActividadesOrderKey) {
    const desde = parseBoundaryDate(filters.creadoDesde ?? undefined);
    const hasta = parseBoundaryDate(filters.creadoHasta ?? undefined);

    const resolvedPuestoIds = await resolvePuestoIdsForActividades(prisma, filters);

    const fechaWhere: any = {};
    if (desde) fechaWhere.gte = desde;
    if (hasta) fechaWhere.lte = hasta;

    const puestoClause =
        resolvedPuestoIds === undefined
            ? undefined
            : resolvedPuestoIds.length === 0
              ? { none: {} }
              : { some: { puesto_id: { in: resolvedPuestoIds } } };

    const { sameGroupInclude } = splitIncludeByTableGroup(ACTIVIDADES_REPORT_INCLUDE);

    const acts = await prisma.e_actividades.findMany({
        where: {
            ...(Object.keys(fechaWhere).length ? { fecha_inicio: fechaWhere } : {}),
            ...(puestoClause ? { e_actividades_puesto: puestoClause } : {}),
            ...(filters.tipoTurno ? { tipo_turno: filters.tipoTurno } : {}),
        },
        ...(sameGroupInclude ? { include: sameGroupInclude } : {}),
        take: 50_000,
    });

    const actividadesPuesto = flattenChildRows(acts, "e_actividades_puesto");
    await hydratePreexistentChildRelations(acts, "e_actividades_puesto", [
        {
            relation: "e_estructura_puesto",
            fkField: "puesto_id",
            select: { id: true, nombre: true, codigo: true, sucursal_id: true },
        },
    ]);
    await attachLocationChainToPuestos(
        actividadesPuesto.map((ap: any) => ap.e_estructura_puesto).filter(Boolean),
    );
    await hydratePreexistentChildRelations(actividadesPuesto, "e_actividades_puesto_plaza", [
        {
            relation: "e_estructura_plazas",
            fkField: "plaza_id",
            select: { id: true, nombre: true, codigo_plaza: true },
        },
    ]);

    const sorted = [...acts].sort((a, b) => {
        if (orderKey === "nombre_actividad") {
            return String(a.nombre_actividad).localeCompare(String(b.nombre_actividad), "es");
        }
        const ta = new Date(a.fecha_inicio).getTime();
        const tb = new Date(b.fecha_inicio).getTime();
        return tb - ta;
    });

    return sorted.map((r) => ({
        ...r,
        frecuencia_titulo: frecuenciaTitleOnly(r.frecuencia),
        frecuencia_horario: frecuenciaScheduleStr(r.frecuencia),
        fecha_txt: r.fecha_inicio instanceof Date ? r.fecha_inicio.toISOString().slice(0, 10) : String(r.fecha_inicio ?? ""),
    }));
}

const MAIN_SHEET = "Actividades";

/**
 * Resuelve el nombre completo del empleado de cada plaza (`c_empleado_plaza` → `c_empleado`).
 * Si una plaza tiene varias asignaciones se usa la más reciente (mayor `id`).
 */
async function fetchNombreEmpleadoPorPlaza(reportDb: ReportDataAccess, plazaIds: number[]): Promise<Map<number, string>> {
    const uniquePlazaIds = [...new Set(plazaIds.filter((n) => Number.isFinite(n) && n > 0))];
    const out = new Map<number, string>();
    if (uniquePlazaIds.length === 0) return out;

    const asignaciones = (await reportDb.c_empleado_plaza.findMany({
        where: { plaza_id: { in: uniquePlazaIds }, empleado_id: { not: null } },
        select: { id: true, plaza_id: true, empleado_id: true },
        orderBy: { id: "desc" },
    })) as Array<{ id: number; plaza_id: number | null; empleado_id: number | null }>;

    const empleadoIdByPlaza = new Map<number, number>();
    for (const a of asignaciones) {
        if (a.plaza_id == null || a.empleado_id == null) continue;
        if (!empleadoIdByPlaza.has(a.plaza_id)) empleadoIdByPlaza.set(a.plaza_id, a.empleado_id);
    }
    const empleadoIds = [...new Set(empleadoIdByPlaza.values())];
    if (empleadoIds.length === 0) return out;

    const empleados = (await reportDb.c_empleado.findMany({
        where: { id: { in: empleadoIds } },
        select: { id: true, nombre: true, primer_apellido: true, segundo_apellido: true },
    })) as Array<{ id: number; nombre: string | null; primer_apellido: string | null; segundo_apellido: string | null }>;
    const nombreByEmpleado = new Map(
        empleados.map((e) => [e.id, [e.nombre, e.primer_apellido, e.segundo_apellido].filter(Boolean).join(" ").trim()]),
    );
    for (const [plazaId, empleadoId] of empleadoIdByPlaza.entries()) {
        out.set(plazaId, nombreByEmpleado.get(empleadoId) ?? "");
    }
    return out;
}

export async function buildActividadesExcelConsolidado(
    activities: any[],
    reportDb: ReportDataAccess,
    bannerMeta: ConsolidadoBannerMeta,
): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const borderThin: Partial<ExcelJS.Borders> = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
    };
    const hdrFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAF7" } } as const;

    const wsMain = wb.addWorksheet(MAIN_SHEET);

    // `e_actividades` no tiene `created_by`: no hay ancla para "Creado por".
    const cambiosByRegistro = await fetchLatestCambiosPorRegistro(
        reportDb,
        "e_actividades",
        activities.map((a) => Number(a.id)),
    );

    const plazaIds: number[] = [];
    for (const act of activities) {
        for (const ap of act.e_actividades_puesto || []) {
            for (const pl of ap.e_actividades_puesto_plaza || []) plazaIds.push(Number(pl.plaza_id));
        }
    }
    const nombreEmpleadoByPlaza = await fetchNombreEmpleadoPorPlaza(reportDb, plazaIds);

    /** Una sola tabla plana: los valores de los niveles superiores (actividad → puesto) se repiten en cada fila hija. */
    const headers = [
        "ID Actividad",
        "Nombre actividad",
        "Fecha inicio",
        "Fecha fin",
        "Frecuencia (título)",
        "Tipo de turno",
        "Es revisión equipo",
        "Descripción",
        "Puesto",
        "Código puesto",
        "ID Actividad de usuario",
        "Usuario",
        "Marcada",
        "Fecha creación",
        "Hora creación",
        "Nombre artículo",
        "Tipo artículo",
        "Marca artículo",
        "Modelo artículo",
        "Serie artículo",
        "Cant. Req. artículo",
        "Cant. Real artículo",
        "Estado artículo",
        "Observaciones artículo",
        "Usuario modifica",
        "Fecha modifica",
        "Hora modifica",
    ];

    applyConsolidadoReportBanner(wsMain, bannerMeta, { headerFillArgb: "FFD9EAF7", mainColumnCount: headers.length });

    const mh = addMainRow(wsMain, headers);
    mh.font = { bold: true };
    mh.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    mh.eachCell((c, colNumber) => {
        if (colNumber === 1) return;
        c.fill = hdrFill;
        c.border = borderThin;
    });
    // Fondo blanco en todo el documento: se oculta la cuadrícula de Excel, así solo se ven los bordes dibujados.
    wsMain.views = [{ showGridLines: false }];
    wsMain.columns = [
        { width: 3 },
        { width: 12 },
        { width: 40 },
        { width: 14 },
        { width: 14 },
        { width: 30 },
        { width: 14 },
        { width: 18 },
        { width: 55 },
        { width: 32 },
        { width: 16 },
        { width: 16 },
        { width: 32 },
        { width: 12 },
        { width: 14 },
        { width: 12 },
        { width: 34 },
        { width: 24 },
        { width: 24 },
        { width: 24 },
        { width: 24 },
        { width: 16 },
        { width: 16 },
        { width: 20 },
        { width: 40 },
        { width: 36 },
        { width: 14 },
        { width: 12 },
    ];

    const styleDataRow = (row: ExcelJS.Row) => {
        row.eachCell((c, colNumber) => {
            if (colNumber === 1) return;
            c.border = borderThin;
            c.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
        });
        row.height = 22;
    };

    const tipoTurnoLabel = (v: unknown): string => {
        const s = String(v ?? "").trim().toUpperCase();
        if (s === "D") return "Diurno";
        if (s === "M") return "Mixto";
        if (s === "N") return "Nocturno";
        return "";
    };

    /** Los artículos de la tarea se unen en una sola celda por columna, separados por punto y coma (;). */
    const joinDetalle = (articulos: Array<Record<string, unknown>>, key: string): string => {
        const parts = articulos.map((item) => String(item?.[key] ?? ""));
        return parts.every((x) => x.trim() === "") ? "" : parts.join(";");
    };

    let totalDataRows = 0;
    for (const act of activities) {
        const cambio = cambiosByRegistro.get(Number(act.id));
        const actCols = [
            String(act.id),
            act.nombre_actividad,
            formatDateOnlyDMY(act.fecha_inicio),
            formatDateOnlyDMY(act.fecha_fin),
            frecuenciaTitleOnly(act.frecuencia, ";"),
            tipoTurnoLabel(act.tipo_turno),
            act.es_revision_equipo ? "Sí" : "No",
            String(act.descripcion_actividad ?? "").slice(0, 5000),
        ];
        const cambioCols = [cambio?.nombreCompleto ?? "", cambio?.fechaTexto ?? "", cambio?.horaTexto ?? ""];
        const emptyUsuarioCols = ["", "", "", "", "", "", "", "", "", "", "", "", "", ""]; // ID act. usuario … observaciones artículo

        const puestos: any[] = act.e_actividades_puesto || [];
        const writeRow = (puestoCols: unknown[], usuarioCols: unknown[]) => {
            styleDataRow(addMainRow(wsMain, [...actCols, ...puestoCols, ...usuarioCols, ...cambioCols]));
            totalDataRows += 1;
        };

        if (puestos.length === 0) {
            writeRow(["", ""], emptyUsuarioCols);
            continue;
        }
        for (const ap of puestos) {
            const puestoCols = [ap.e_estructura_puesto?.nombre ?? String(ap.puesto_id ?? ""), ap.e_estructura_puesto?.codigo ?? ""];
            const plazas = (ap.e_actividades_puesto_plaza || []).filter(actividadPuestoPlazaIncluyeReporteConsolidado);
            if (plazas.length === 0) {
                writeRow(puestoCols, emptyUsuarioCols);
                continue;
            }
            for (const pl of plazas) {
                const articulos = parseArticles(pl.articles);
                writeRow(puestoCols, [
                    String(pl.id),
                    nombreEmpleadoByPlaza.get(Number(pl.plaza_id)) ?? "",
                    pl.marcada ? "Sí" : "No",
                    formatDateOnlyDMY(pl.created_at),
                    formatTimeOnlyHMS(pl.created_at),
                    joinDetalle(articulos, "nombre"),
                    joinDetalle(articulos, "tipo"),
                    joinDetalle(articulos, "marca"),
                    joinDetalle(articulos, "modelo"),
                    joinDetalle(articulos, "serie"),
                    joinDetalle(articulos, "cantidad_requerida"),
                    joinDetalle(articulos, "cantidad_real"),
                    joinDetalle(articulos, "estado"),
                    joinDetalle(articulos, "observaciones"),
                ]);
            }
        }
    }

    wsMain.autoFilter = {
        from: { row: 12, column: 2 },
        to: { row: Math.max(12, totalDataRows + 12), column: headers.length + 1 },
    };

    return Buffer.from(await wb.xlsx.writeBuffer());
}

const GUIA_FUNCS_TITLE = "Guía de Funciones del Puesto";

type PlazaAggIndividual = {
    plazaId: number;
    empresaId: number | null;
    clienteNombre: string;
    puestoCodigo: string;
    puestoNombre: string;
    plazaNombre: string;
    /** Base para nombre de hoja Excel (codigo_plaza o `P{id}`). */
    plazaSheetLabel: string;
    ordenActividadIds: number[];
    rowByActividadId: Map<number, { tareaTxt: string; frecTit: string; horario: string }>;
};

/** Etiqueta para nombre de hoja: preferir `codigo_plaza`; si falta, `P{id}`. */
function plazaSheetLabelFromRow(z: { id?: number; codigo_plaza?: string | null }): string {
    const id = Number(z?.id ?? 0);
    const c = String(z?.codigo_plaza ?? "").trim();
    if (c) return c;
    return Number.isFinite(id) && id > 0 ? `P${id}` : "Plaza";
}

function collectPlazasForGuíaIndividual(activities: any[]): Map<number, PlazaAggIndividual> {
    const plazaMap = new Map<number, PlazaAggIndividual>();

    for (const act of activities) {
        const aid = Number(act?.id ?? 0);
        if (!Number.isFinite(aid) || aid <= 0) continue;
        const nom = String(act.nombre_actividad ?? "").trim();
        const tareaTxt = nom.slice(0, 8000);

        const frecTit = frecuenciaTitleOnly(act.frecuencia);
        const horario = frecuenciaScheduleStr(act.frecuencia);

        for (const ap of act.e_actividades_puesto || []) {
            const pu = ap.e_estructura_puesto as any;
            const contrato = pu?.e_estructura_sucursal?.e_estructura_contrato as any;
            const cliente = contrato?.e_estructura_cliente;
            const empresaIdRaw = contrato?.empresa_id;
            const empresaId =
                empresaIdRaw != null && Number.isFinite(Number(empresaIdRaw)) ? Number(empresaIdRaw) : null;
            const clienteNombre = String(cliente?.nombre ?? "").trim();
            const puestoCodigoRaw = pu?.codigo != null ? String(pu.codigo).trim() : "";
            const puestoCodigo = puestoCodigoRaw || String(pu?.id ?? "");
            const puestoNombre = String(pu?.nombre ?? "").trim();

            for (const pl of ap.e_actividades_puesto_plaza || []) {
                const z = pl.e_estructura_plazas as { id?: number; nombre?: string; codigo_plaza?: string | null } | null;
                if (!z || z.id == null) continue;
                if (plazaCodigoExcluyeArroba(z.codigo_plaza)) continue;
                const plazaId = Number(z.id);

                let agg = plazaMap.get(plazaId);
                const sheetLabel = plazaSheetLabelFromRow(z);
                if (!agg) {
                    agg = {
                        plazaId,
                        empresaId,
                        clienteNombre,
                        puestoCodigo,
                        puestoNombre,
                        plazaNombre: String(z.nombre ?? "").trim(),
                        plazaSheetLabel: sheetLabel,
                        ordenActividadIds: [],
                        rowByActividadId: new Map(),
                    };
                    plazaMap.set(plazaId, agg);
                } else {
                    if (agg.empresaId == null && empresaId != null) agg.empresaId = empresaId;
                    if (!agg.clienteNombre && clienteNombre) agg.clienteNombre = clienteNombre;
                    if (!agg.puestoNombre && puestoNombre) agg.puestoNombre = puestoNombre;
                    if (!agg.puestoCodigo && puestoCodigo) agg.puestoCodigo = puestoCodigo;
                    if (!agg.plazaNombre) agg.plazaNombre = String(z.nombre ?? "").trim();
                    const sl = plazaSheetLabelFromRow(z);
                    if (!/^P\d+$/.test(sl)) agg.plazaSheetLabel = sl;
                }
                if (!agg.rowByActividadId.has(aid)) {
                    agg.rowByActividadId.set(aid, { tareaTxt, frecTit, horario });
                    agg.ordenActividadIds.push(aid);
                }
            }
        }
    }
    return plazaMap;
}

async function writeGuíaPlazaWorksheet(
    wb: ExcelJS.Workbook,
    sheetName: string,
    reportNombre: string,
    agg: PlazaAggIndividual,
): Promise<void> {
    const ws = wb.addWorksheet(sheetName);
    ws.views = [{ showGridLines: false }];

    const titleFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3A5F" } } as const;
    const bottomData: Partial<ExcelJS.Borders> = {
        bottom: { style: "thin", color: { argb: "FF000000" } },
    };

    ws.columns = [
        { width: 2.1 },
        { width: 11.5 },
        { width: 11.5 },
        { width: 50 },
        { width: 13.5 },
        { width: 13.5 },
        { width: 2.1 },
    ];

    const logoPath = agg.empresaId != null ? await resolveActividadesLogoPath(agg.empresaId) : null;
    const maxLogoW = 600;
    const maxLogoH = 72;
    const logoPx = logoPath ? await logoDisplayPx(logoPath, maxLogoW, maxLogoH) : { w: 0, h: 0 };
    ws.getRow(1).height = Math.max(34, Math.min(68, Math.round((logoPx.h * 72) / 96 + 3)));

    ws.mergeCells("A1:C1");
    ws.getCell("A1").alignment = { vertical: "middle", horizontal: "center", wrapText: true };

    ws.getCell("D1").value = GUIA_FUNCS_TITLE;
    ws.getCell("D1").fill = titleFill;
    ws.getCell("D1").font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    ws.getCell("D1").alignment = { horizontal: "center", vertical: "middle", wrapText: true };

    ws.mergeCells("E1:G1");
    ws.getCell("E1").value = String(reportNombre ?? "").trim();
    ws.getCell("E1").alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    ws.getCell("E1").font = { size: 10 };

    for (let c = 1; c <= 7; c++) {
        ws.getCell(1, c).border = { ...borderThinBlack };
    }

    ws.getRow(2).height = 16;
    ws.getRow(3).height = 16;

    ws.mergeCells("B4:C4");
    ws.getCell("B4").value = "Cliente";
    ws.getCell("B4").alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    ws.getCell("B4").font = { bold: true };
    ws.getCell("D4").value = agg.clienteNombre;
    ws.getCell("D4").alignment = { vertical: "bottom", horizontal: "left", wrapText: true };

    ws.getCell("E4").value = "Puesto No.";
    ws.getCell("E4").font = { bold: true };
    ws.getCell("E4").alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    ws.getCell("F4").value = agg.puestoCodigo;
    ws.getCell("F4").alignment = { vertical: "bottom", horizontal: "left", wrapText: true };

    ws.mergeCells("B5:C5");
    ws.getCell("B5").value = "Nombre del puesto";
    ws.getCell("B5").alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    ws.getCell("B5").font = { bold: true };
    ws.getCell("D5").value = agg.puestoNombre;
    ws.getCell("D5").alignment = { vertical: "bottom", horizontal: "left", wrapText: true };

    ws.getCell("E5").value = "Plaza";
    ws.getCell("E5").font = { bold: true };
    ws.getCell("E5").alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    ws.getCell("F5").value = agg.plazaNombre || `ID ${agg.plazaId}`;
    ws.getCell("F5").alignment = { vertical: "bottom", horizontal: "left", wrapText: true };

    for (let r = 4; r <= 5; r++) {
        for (let c = 1; c <= 7; c++) {
            ws.getCell(r, c).border = {};
        }
    }
    ws.getCell("D4").border = { ...bottomData };
    ws.getCell("F4").border = { ...bottomData };
    ws.getCell("D5").border = { ...bottomData };
    ws.getCell("F5").border = { ...bottomData };

    ws.getRow(6).height = 5;

    const R_HEADER = 8;
    ws.getCell(R_HEADER, 2).value = "#";
    ws.mergeCells(`C${R_HEADER}:D${R_HEADER}`);
    ws.getCell(`C${R_HEADER}`).value = "Lo que debo hacer en el puesto";
    ws.getCell(R_HEADER, 5).value = "Frecuencia";
    ws.getCell(R_HEADER, 6).value = "Horario (si aplica)";
    ws.getRow(R_HEADER).font = { bold: true };
    ws.getRow(R_HEADER).alignment = { horizontal: "center", vertical: "middle", wrapText: true };

    const th: ExcelJS.BorderStyle = "thin";
    let n = 0;
    let rData = R_HEADER + 1;
    for (const aid of agg.ordenActividadIds) {
        const row = agg.rowByActividadId.get(aid);
        if (!row) continue;
        n += 1;
        ws.getCell(rData, 2).value = n;
        ws.mergeCells(rData, 3, rData, 4);
        ws.getCell(rData, 3).value = row.tareaTxt;
        ws.getCell(rData, 5).value = row.frecTit;
        ws.getCell(rData, 6).value = row.horario || "";
        rData += 1;
    }

    if (n === 0) {
        ws.mergeCells("B8:F8");
        ws.getCell("B8").value = "No hay actividades asignadas a esta plaza en el filtro actual.";
        ws.getCell("B8").alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    }

    const lastTableRow = n === 0 ? R_HEADER : rData - 1;

    for (let r = R_HEADER; r <= lastTableRow; r++) {
        for (let c = 2; c <= 6; c++) {
            const cell = ws.getCell(r, c);
            cell.border = {
                top: { style: th, ...BLACK },
                bottom: { style: th, ...BLACK },
                left: { style: th, ...BLACK },
                right: { style: th, ...BLACK },
            };
            cell.alignment = {
                vertical: "top",
                horizontal: c === 2 || c === 5 || c === 6 ? "center" : "left",
                wrapText: true,
            };
        }
    }

    ws.getRow(R_HEADER).alignment = { horizontal: "center", vertical: "middle", wrapText: true };

    if (n > 0) {
        for (let r = R_HEADER + 1; r <= lastTableRow; r++) {
            ws.getCell(r, 3).alignment = { vertical: "top", horizontal: "left", wrapText: true };
        }
    }

    for (let c = 2; c <= 6; c++) {
        setCellBorderSides(ws, R_HEADER, c, { top: "medium" });
        setCellBorderSides(ws, lastTableRow, c, { bottom: "medium" });
    }
    for (let r = R_HEADER; r <= lastTableRow; r++) {
        setCellBorderSides(ws, r, 2, { left: "medium" });
        setCellBorderSides(ws, r, 6, { right: "medium" });
    }

    const lastUsedRow = Math.max(lastTableRow, 6);
    applyOuterWhiteFrame(ws, 1, 1, lastUsedRow, 7);

    ws.getCell("D1").value = GUIA_FUNCS_TITLE;
    ws.getCell("D1").fill = titleFill;
    ws.getCell("D1").font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    ws.getCell("E1").value = String(reportNombre ?? "").trim();

    if (logoPath && logoPx.w > 0 && logoPx.h > 0) {
        const imgId = wb.addImage({ filename: logoPath, extension: "png" });
        ws.addImage(imgId, {
            tl: { col: 0.02, row: 0.02 },
            ext: { width: logoPx.w, height: logoPx.h },
        });
    }
}

/** Una hoja por plaza (omitidas plazas con `@` en `codigo_plaza`). */
export async function buildActividadesExcelIndividual(activities: any[], reportNombre: string): Promise<Buffer> {
    const plazaMap = collectPlazasForGuíaIndividual(activities);

    const wb = new ExcelJS.Workbook();

    if (plazaMap.size === 0) {
        const ws = wb.addWorksheet("Sin plazas");
        ws.getCell("B2").value =
            "No hay plazas aplicables para generar esta guía: todas están excluidas (codigo_plaza contiene «@») o no hay vínculos en el resultado filtrado.";
        ws.getCell("B4").value = String(reportNombre ?? "").trim();
        return Buffer.from(await wb.xlsx.writeBuffer());
    }

    const plazaIdsSorted = [...plazaMap.keys()].sort((a, b) => {
        const ca = plazaMap.get(a)?.plazaSheetLabel || "";
        const cb = plazaMap.get(b)?.plazaSheetLabel || "";
        const cmp = ca.localeCompare(cb, "es", { numeric: true });
        return cmp !== 0 ? cmp : a - b;
    });

    const namesInputs = plazaIdsSorted.map((id) => {
        const agg = plazaMap.get(id)!;
        return {
            plazaId: id,
            label: agg.plazaSheetLabel?.trim() || `P${id}`,
        };
    });
    const nameByPlazaId = uniqSheetNames(namesInputs);

    for (const plazaId of plazaIdsSorted) {
        const agg = plazaMap.get(plazaId)!;
        await writeGuíaPlazaWorksheet(wb, nameByPlazaId.get(plazaId)!, reportNombre, agg);
    }

    return Buffer.from(await wb.xlsx.writeBuffer());
}
