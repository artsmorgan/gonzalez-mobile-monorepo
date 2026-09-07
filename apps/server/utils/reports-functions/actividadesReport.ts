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

const ACTIVIDADES_REPORT_INCLUDE = {
    e_actividades_puesto: {
        include: {
            e_actividades_puesto_plaza: true,
        },
    },
};

export type ActividadesModuleFilters = ActaEntregaModuleFilters;
export type ActividadesOrderKey = "fecha" | "nombre_actividad";

function parseBoundaryDate(s: string | undefined | null): Date | null {
    if (!s || String(s).trim() === "") return null;
    const t = String(s).trim();
    const d = new Date(t.includes("T") ? t : t.replace(" ", "T"));
    return Number.isNaN(d.getTime()) ? null : d;
}

export function normalizeActividadesFilters(raw: unknown): ActividadesModuleFilters {
    return normalizeActaEntregaFilters(raw);
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

export function frecuenciaTitleOnly(raw: string | null | undefined): string {
    if (!raw || String(raw).trim() === "") return "";
    try {
        const p = JSON.parse(String(raw));
        if (Array.isArray(p)) {
            return p
                .map((x: any) => (x && typeof x === "object" && x.title != null ? String(x.title) : ""))
                .filter(Boolean)
                .join(", ");
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
const SHEET_PUESTOS = "Puestos de la actividad";
const SHEET_USUARIOS = "Actividades de usuarios";
const SHEET_ARTICULOS = "Articulos de la tarea";

export async function buildActividadesExcelConsolidado(activities: any[]): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const borderThin: Partial<ExcelJS.Borders> = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
    };
    const hdrFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAF7" } } as const;

    const wsMain = wb.addWorksheet(MAIN_SHEET);
    const wsP = wb.addWorksheet(SHEET_PUESTOS);
    const wsU = wb.addWorksheet(SHEET_USUARIOS);
    const wsA = wb.addWorksheet(SHEET_ARTICULOS);

    const plazaToArticulosRow = new Map<number, number>();
    const activitiesDesc = [...activities].sort((a, b) => Number(b.id) - Number(a.id));

    const writeArticlesBlocks = () => {
        for (const act of activitiesDesc) {
            for (const ap of act.e_actividades_puesto || []) {
                for (const pl of ap.e_actividades_puesto_plaza || []) {
                    if (!actividadPuestoPlazaIncluyeReporteConsolidado(pl)) continue;
                    const titleRow = wsA.rowCount + 1;
                    plazaToArticulosRow.set(pl.id, titleRow);
                    wsA.mergeCells(titleRow, 1, titleRow, 9);
                    wsA.getCell(titleRow, 1).value = `Actividad: ${act.nombre_actividad} — Puesto: ${ap.e_estructura_puesto?.nombre ?? ap.puesto_id} — Plaza: ${pl.e_estructura_plazas?.nombre ?? pl.plaza_id} (registro #${pl.id})`;
                    wsA.getCell(titleRow, 1).font = { bold: true };
                    wsA.getCell(titleRow, 1).fill = hdrFill;
                    for (let c = 1; c <= 9; c++) wsA.getCell(titleRow, c).border = borderThin;

                    const ah = wsA.addRow(["Nombre", "Tipo", "Marca", "Modelo", "Serie", "Cant. req.", "Cant. real", "Estado", "Observaciones"]);
                    ah.font = { bold: true };
                    ah.eachCell((c) => {
                        c.fill = hdrFill;
                        c.border = borderThin;
                        c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
                    });
                    for (const art of parseArticles(pl.articles)) {
                        const row = wsA.addRow([
                            String(art?.nombre ?? ""),
                            String(art?.tipo ?? ""),
                            String(art?.marca ?? ""),
                            String(art?.modelo ?? ""),
                            String(art?.serie ?? ""),
                            art?.cantidad_requerida != null ? String(art.cantidad_requerida) : "",
                            art?.cantidad_real != null ? String(art.cantidad_real) : "",
                            String(art?.estado ?? ""),
                            String(art?.observaciones ?? ""),
                        ]);
                        row.eachCell((c) => {
                            c.border = borderThin;
                            c.alignment = { vertical: "middle", wrapText: true };
                        });
                    }
                    wsA.addRow([]);
                }
            }
        }
    };
    writeArticlesBlocks();

    const apToUsuariosRow = new Map<number, number>();
    for (const act of activitiesDesc) {
        for (const ap of act.e_actividades_puesto || []) {
            const secRow = wsU.rowCount + 1;
            apToUsuariosRow.set(ap.id, secRow);
            wsU.mergeCells(secRow, 1, secRow, 5);
            wsU.getCell(secRow, 1).value = `${act.nombre_actividad} — Puesto: ${ap.e_estructura_puesto?.nombre ?? ap.puesto_id}`;
            wsU.getCell(secRow, 1).font = { bold: true };
            wsU.getCell(secRow, 1).fill = hdrFill;
            for (let c = 1; c <= 5; c++) wsU.getCell(secRow, c).border = borderThin;

            const h = wsU.addRow(["ID", "Plaza", "Artículos", "Marcada", "Creado"]);
            h.font = { bold: true };
            h.eachCell((c) => {
                c.fill = hdrFill;
                c.border = borderThin;
            });
            for (const pl of ap.e_actividades_puesto_plaza || []) {
                if (!actividadPuestoPlazaIncluyeReporteConsolidado(pl)) continue; // Consolidado
                const artRow = plazaToArticulosRow.get(pl.id) ?? 1;
                const row = wsU.addRow([
                    pl.id,
                    pl.e_estructura_plazas?.nombre ?? pl.plaza_id,
                    "",
                    pl.marcada ? "Sí" : "No",
                    pl.created_at instanceof Date ? pl.created_at.toISOString().slice(0, 19) : String(pl.created_at ?? ""),
                ]);
                row.getCell(3).value = {
                    text: "Ver artículos",
                    hyperlink: `#'${SHEET_ARTICULOS}'!A${artRow}`,
                };
                row.getCell(3).font = { color: { argb: "FF0563C1" }, underline: true };
                row.eachCell((c, col) => {
                    c.border = borderThin;
                    if (col !== 3) c.alignment = { vertical: "middle", wrapText: true };
                });
            }
            wsU.addRow([]);
        }
    }

    const actToPuestosRow = new Map<number, number>();
    for (const act of activitiesDesc) {
        const secRow = wsP.rowCount + 1;
        actToPuestosRow.set(act.id, secRow);
        wsP.mergeCells(secRow, 1, secRow, 6);
        wsP.getCell(secRow, 1).value = `Actividad #${act.id}: ${act.nombre_actividad}`;
        wsP.getCell(secRow, 1).font = { bold: true };
        wsP.getCell(secRow, 1).fill = hdrFill;
        for (let c = 1; c <= 6; c++) wsP.getCell(secRow, c).border = borderThin;

        const h = wsP.addRow(["ID vínculo", "Actividad", "Puesto", "Código puesto", "Plazas", "Actividades de usuarios"]);
        h.font = { bold: true };
        h.eachCell((c) => {
            c.fill = hdrFill;
            c.border = borderThin;
        });
        for (const ap of act.e_actividades_puesto || []) {
            const uRow = apToUsuariosRow.get(ap.id) ?? 1;
            const nPlazas = (ap.e_actividades_puesto_plaza || []).filter(actividadPuestoPlazaIncluyeReporteConsolidado).length; // Consolidado
            const row = wsP.addRow([ap.id, act.nombre_actividad, ap.e_estructura_puesto?.nombre ?? "", ap.e_estructura_puesto?.codigo ?? "", nPlazas, ""]);
            row.getCell(6).value = {
                text: "Actividades de usuarios",
                hyperlink: `#'${SHEET_USUARIOS}'!A${uRow}`,
            };
            row.getCell(6).font = { color: { argb: "FF0563C1" }, underline: true };
            row.eachCell((c, col) => {
                c.border = borderThin;
                if (col !== 6) c.alignment = { vertical: "middle", wrapText: true };
            });
        }
        wsP.addRow([]);
    }

    /** Cuadrícula jerárquica: Actividad (nivel 0) → Puesto vinculado (nivel 1) → Plaza vinculada (nivel 2) → Artículo (nivel 3). */
    wsMain.properties.outlineProperties = { summaryBelow: false, summaryRight: false };

    const headers = [
        "ID de fila",
        "ID fila padre",
        "Nivel",
        "Tipo de fila",
        "ID Actividad",
        "Nombre actividad",
        "Fecha inicio",
        "Fecha fin",
        "Frecuencia (título)",
        "Es revisión equipo",
        "Descripción",
        "Puestos vinculados",
        "Puesto (vínculo)",
        "Código puesto (vínculo)",
        "Plaza (vínculo)",
        "Marcada (vínculo)",
        "Creado (vínculo)",
        "Nombre artículo",
        "Tipo artículo",
        "Marca artículo",
        "Modelo artículo",
        "Serie artículo",
        "Cant. req. artículo",
        "Cant. real artículo",
        "Estado artículo",
        "Observaciones artículo",
    ];
    const COL_PUESTOS_VINCULADOS = 12;

    const mh = wsMain.addRow(headers);
    mh.font = { bold: true };
    mh.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    mh.eachCell((c) => {
        c.fill = hdrFill;
        c.border = borderThin;
    });
    wsMain.views = [{ state: "frozen", ySplit: 1 }];
    wsMain.columns = [
        { width: 12 },
        { width: 14 },
        { width: 8 },
        { width: 20 },
        { width: 12 },
        { width: 40 },
        { width: 16 },
        { width: 16 },
        { width: 36 },
        { width: 20 },
        { width: 65 },
        { width: 20 },
        { width: 36 },
        { width: 20 },
        { width: 30 },
        { width: 14 },
        { width: 20 },
        { width: 32 },
        { width: 18 },
        { width: 18 },
        { width: 22 },
        { width: 14 },
        { width: 14 },
        { width: 14 },
        { width: 22 },
        { width: 48 },
    ];

    const blank = (n: number) => Array.from({ length: n }, () => "");

    const styleDataRow = (row: ExcelJS.Row, nivel: number) => {
        row.eachCell((c) => {
            c.border = borderThin;
            c.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
        });
        row.getCell(4).alignment = { vertical: "middle", horizontal: "left", wrapText: true, indent: nivel };
        row.outlineLevel = nivel;
        if (nivel === 0) row.getCell(4).font = { bold: true };
    };

    let totalDataRows = 0;
    for (const act of activities) {
        const pRow = actToPuestosRow.get(act.id) ?? 1;
        const frecTit = frecuenciaTitleOnly(act.frecuencia);
        const general = [
            String(act.id),
            act.nombre_actividad,
            act.fecha_inicio instanceof Date ? act.fecha_inicio.toISOString().slice(0, 10) : String(act.fecha_inicio ?? ""),
            act.fecha_fin ? (act.fecha_fin instanceof Date ? act.fecha_fin.toISOString().slice(0, 10) : String(act.fecha_fin)) : "",
            frecTit,
            act.es_revision_equipo ? "Sí" : "No",
            String(act.descripcion_actividad ?? "").slice(0, 5000),
        ];

        const rootRow = wsMain.addRow([
            String(act.id),
            "",
            0,
            "Actividad",
            ...general,
            "Puestos vinculados",
            ...blank(2),
            ...blank(3),
            ...blank(9),
        ]);
        rootRow.getCell(COL_PUESTOS_VINCULADOS).value = { text: "Puestos vinculados", hyperlink: `#'${SHEET_PUESTOS}'!A${pRow}` };
        rootRow.getCell(COL_PUESTOS_VINCULADOS).font = { color: { argb: "FF0563C1" }, underline: true };
        styleDataRow(rootRow, 0);
        totalDataRows += 1;

        for (const ap of act.e_actividades_puesto || []) {
            const apRow = wsMain.addRow([
                String(ap.id),
                String(act.id),
                1,
                "Puesto vinculado",
                ...general,
                "",
                String(ap.e_estructura_puesto?.nombre ?? ap.puesto_id ?? ""),
                String(ap.e_estructura_puesto?.codigo ?? ""),
                ...blank(3),
                ...blank(9),
            ]);
            styleDataRow(apRow, 1);
            totalDataRows += 1;

            for (const pl of ap.e_actividades_puesto_plaza || []) {
                if (!actividadPuestoPlazaIncluyeReporteConsolidado(pl)) continue; // Consolidado
                const plRow = wsMain.addRow([
                    String(pl.id),
                    String(ap.id),
                    2,
                    "Plaza vinculada",
                    ...general,
                    ...blank(3),
                    String(pl.e_estructura_plazas?.nombre ?? pl.plaza_id ?? ""),
                    pl.marcada ? "Sí" : "No",
                    pl.created_at instanceof Date ? pl.created_at.toISOString().slice(0, 19) : String(pl.created_at ?? ""),
                    ...blank(9),
                ]);
                styleDataRow(plRow, 2);
                totalDataRows += 1;

                parseArticles(pl.articles).forEach((art, idx) => {
                    const artRow = wsMain.addRow([
                        `${pl.id}.art${idx + 1}`,
                        String(pl.id),
                        3,
                        "Artículo",
                        ...general,
                        ...blank(6),
                        String(art?.nombre ?? ""),
                        String(art?.tipo ?? ""),
                        String(art?.marca ?? ""),
                        String(art?.modelo ?? ""),
                        String(art?.serie ?? ""),
                        art?.cantidad_requerida != null ? String(art.cantidad_requerida) : "",
                        art?.cantidad_real != null ? String(art.cantidad_real) : "",
                        String(art?.estado ?? ""),
                        String(art?.observaciones ?? ""),
                    ]);
                    styleDataRow(artRow, 3);
                    totalDataRows += 1;
                });
            }
        }
    }

    wsMain.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: Math.max(1, totalDataRows + 1), column: headers.length },
    };

    wsP.columns = [{ width: 14 }, { width: 42 }, { width: 36 }, { width: 20 }, { width: 14 }, { width: 32 }];
    wsU.columns = [{ width: 14 }, { width: 40 }, { width: 26 }, { width: 14 }, { width: 24 }];
    wsA.columns = [{ width: 32 }, { width: 18 }, { width: 18 }, { width: 22 }, { width: 14 }, { width: 14 }, { width: 22 }, { width: 48 }];

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
