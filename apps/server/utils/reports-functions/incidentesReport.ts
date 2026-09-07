/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ReportDataAccess } from "../reportDynamicPrisma";
import ExcelJS from "exceljs";
import fs from "fs/promises";
import path from "path";
import { normalizeActaEntregaFilters, type ActaEntregaModuleFilters } from "./actaEntregaProductos";
import { fitImageExtInsideBox, getImageDimensionsFromFile } from "./imageDimensions";
import {
    hydratePreexistentChildRelations,
    hydratePreexistentRelations,
    splitIncludeByTableGroup,
} from "../hydratePreexistentIncludes";

const INCIDENTES_REPORT_INCLUDE = {
    n_clasificacion_incidente: { select: { id: true, nombre: true } },
    n_ejecutivo_cuenta: { select: { id: true, nombre: true } },
    c_contribucion_incidente: {
        orderBy: { created_at: "desc" },
    },
};

const CONTRIBUCION_EMPLEADO_SPEC = {
    relation: "c_empleado",
    fkField: "empleado_id",
    select: { id: true, codigo: true, nombre: true, primer_apellido: true, segundo_apellido: true },
};

export type IncidenteModuleFilters = ActaEntregaModuleFilters & {
    solucionadoDesde?: string | null;
    solucionadoHasta?: string | null;
    solucionadoRealDesde?: string | null;
    solucionadoRealHasta?: string | null;
    clasificacionId?: number | null;
    estado?: boolean | null;
    /** Rango sobre `fecha_reporte` (fecha de reporte del incidente). */
    fechaReporteDesde?: string | null;
    fechaReporteHasta?: string | null;
    ejecutivoCuentaIds?: number[] | null;
};

export type IncidenteOrderKey = "empresa_id" | "cliente_id" | "division_id" | "contrato_id" | "corpo_id" | "puesto_id" | "created_at";

function parseBoundaryDate(s: string | undefined | null): Date | null {
    if (!s || String(s).trim() === "") return null;
    const t = String(s).trim();
    const d = new Date(t.includes("T") ? t : t.replace(" ", "T"));
    return Number.isNaN(d.getTime()) ? null : d;
}

function parseBool(v: unknown): boolean | null {
    if (typeof v === "boolean") return v;
    const s = String(v ?? "").trim().toLowerCase();
    if (s === "1" || s === "true" || s === "solucionado") return true;
    if (s === "0" || s === "false" || s === "no_solucionado") return false;
    return null;
}

function excelCellString(v: unknown): string {
    const s = String(v ?? "");
    return s.length > 32767 ? s.slice(0, 32767) : s;
}

function parseJsonArray(raw: unknown): any[] {
    if (!raw || String(raw).trim() === "") return [];
    try {
        const arr = JSON.parse(String(raw));
        return Array.isArray(arr) ? arr : [];
    } catch {
        return [];
    }
}

function normalizeSignatureDataUri(raw: unknown): string | null {
    const s = String(raw ?? "").trim();
    if (!s) return null;
    if (s.startsWith("data:image/")) return s;
    return `data:image/png;base64,${s}`;
}

function parseSignatureDataForExcel(dataUriOrBase64: unknown): { extension: "png" | "jpeg"; base64: string } | null {
    const d = normalizeSignatureDataUri(dataUriOrBase64);
    if (!d) return null;
    const m = /^data:image\/(png|jpeg|jpg);base64,([\s\S]+)$/i.exec(d);
    if (m) {
        return { extension: m[1].toLowerCase() === "png" ? "png" : "jpeg", base64: String(m[2]).replace(/\s+/g, "") };
    }
    return { extension: "png", base64: d.replace(/^data:image\/\w+;base64,/, "").replace(/\s+/g, "") };
}

function fmtDate(v: unknown): string {
    const d = v instanceof Date ? v : new Date(String(v ?? ""));
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
}

function parseIds(v: unknown): number[] {
    if (!Array.isArray(v)) return [];
    return [...new Set(v.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0))];
}

async function resolveLogoPathByEmpresaId(empresaId: number): Promise<string | null> {
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

function toValidIdsIncident(raw: unknown): number[] {
    if (!Array.isArray(raw)) return [];
    return [...new Set(raw.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0))];
}

export function normalizeIncidenteFilters(raw: unknown): IncidenteModuleFilters {
    const base = normalizeActaEntregaFilters(raw);
    const o = raw != null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const cls = Number(o.clasificacionId ?? o.clasificacion ?? o.classificationId);
    const ej = toValidIdsIncident(o.ejecutivoCuentaIds);
    const frd = String(o.fechaReporteDesde ?? "").trim();
    const frh = String(o.fechaReporteHasta ?? "").trim();
    return {
        ...base,
        solucionadoDesde: String(o.solucionadoDesde ?? "").trim() || null,
        solucionadoHasta: String(o.solucionadoHasta ?? "").trim() || null,
        solucionadoRealDesde: String(o.solucionadoRealDesde ?? "").trim() || null,
        solucionadoRealHasta: String(o.solucionadoRealHasta ?? "").trim() || null,
        clasificacionId: Number.isFinite(cls) && cls > 0 ? cls : null,
        estado: parseBool(o.estado),
        fechaReporteDesde: frd || null,
        fechaReporteHasta: frh || null,
        ejecutivoCuentaIds: ej.length ? ej : null,
    };
}

export function hasIncidenteListModuleFiltersContent(f: IncidenteModuleFilters): boolean {
    if (f.creadoDesde || f.creadoHasta) return true;
    if (f.fechaReporteDesde || f.fechaReporteHasta) return true;
    if (f.solucionadoDesde || f.solucionadoHasta) return true;
    if (f.solucionadoRealDesde || f.solucionadoRealHasta) return true;
    if (f.clasificacionId != null || f.estado != null) return true;
    if (f.empresaIds?.length || f.clienteIds?.length || f.divisionIds?.length) return true;
    if (f.contratoIds?.length || f.corpoIds?.length || f.puestoIds?.length) return true;
    if (f.ejecutivoCuentaIds?.length) return true;
    return false;
}

export function filtersMatchIncidenteListQuery(parsedRowFilters: any, listModuleFilters?: IncidenteModuleFilters): boolean {
    if (!listModuleFilters) return true;
    const saved = normalizeIncidenteFilters((parsedRowFilters?.moduleFilters || {}) as any);
    const overlaps = (left?: number[] | null, right?: number[] | null) => {
        if (!left || left.length === 0) return true;
        if (!right || right.length === 0) return false;
        return left.some((x) => right.includes(x));
    };
    if (listModuleFilters.creadoDesde && String(saved.creadoDesde || "") !== String(listModuleFilters.creadoDesde)) return false;
    if (listModuleFilters.creadoHasta && String(saved.creadoHasta || "") !== String(listModuleFilters.creadoHasta)) return false;
    if (listModuleFilters.fechaReporteDesde && String(saved.fechaReporteDesde || "") !== String(listModuleFilters.fechaReporteDesde)) return false;
    if (listModuleFilters.fechaReporteHasta && String(saved.fechaReporteHasta || "") !== String(listModuleFilters.fechaReporteHasta)) return false;
    if (listModuleFilters.solucionadoDesde && String(saved.solucionadoDesde || "") !== String(listModuleFilters.solucionadoDesde)) return false;
    if (listModuleFilters.solucionadoHasta && String(saved.solucionadoHasta || "") !== String(listModuleFilters.solucionadoHasta)) return false;
    if (listModuleFilters.solucionadoRealDesde && String(saved.solucionadoRealDesde || "") !== String(listModuleFilters.solucionadoRealDesde))
        return false;
    if (listModuleFilters.solucionadoRealHasta && String(saved.solucionadoRealHasta || "") !== String(listModuleFilters.solucionadoRealHasta))
        return false;
    if (listModuleFilters.clasificacionId != null && Number(saved.clasificacionId ?? 0) !== Number(listModuleFilters.clasificacionId)) return false;
    if (listModuleFilters.estado != null && Boolean(saved.estado) !== Boolean(listModuleFilters.estado)) return false;
    if (!overlaps(listModuleFilters.empresaIds ?? undefined, saved.empresaIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.clienteIds ?? undefined, saved.clienteIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.divisionIds ?? undefined, saved.divisionIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.contratoIds ?? undefined, saved.contratoIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.corpoIds ?? undefined, saved.corpoIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.puestoIds ?? undefined, saved.puestoIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.ejecutivoCuentaIds ?? undefined, saved.ejecutivoCuentaIds ?? undefined)) return false;
    return true;
}

export async function queryIncidenteRows(prisma: ReportDataAccess, filters: IncidenteModuleFilters, orderKey: IncidenteOrderKey) {
    const where: any = { isActive: true };
    const frDesde = parseBoundaryDate(filters.fechaReporteDesde ?? undefined);
    const frHasta = parseBoundaryDate(filters.fechaReporteHasta ?? undefined);
    if (frDesde || frHasta) {
        where.fecha_reporte = {};
        if (frDesde) where.fecha_reporte.gte = frDesde;
        if (frHasta) where.fecha_reporte.lte = frHasta;
    } else {
        const desde = parseBoundaryDate(filters.creadoDesde ?? undefined);
        const hasta = parseBoundaryDate(filters.creadoHasta ?? undefined);
        if (desde || hasta) {
            where.created_at = {};
            if (desde) where.created_at.gte = desde;
            if (hasta) where.created_at.lte = hasta;
        }
    }
    const sDesde = parseBoundaryDate(filters.solucionadoDesde ?? undefined);
    const sHasta = parseBoundaryDate(filters.solucionadoHasta ?? undefined);
    if (sDesde || sHasta) {
        where.fecha_solucion = {};
        if (sDesde) where.fecha_solucion.gte = sDesde;
        if (sHasta) where.fecha_solucion.lte = sHasta;
    }
    const srDesde = parseBoundaryDate(filters.solucionadoRealDesde ?? undefined);
    const srHasta = parseBoundaryDate(filters.solucionadoRealHasta ?? undefined);
    if (srDesde || srHasta) {
        where.fecha_real_solucion = {};
        if (srDesde) where.fecha_real_solucion.gte = srDesde;
        if (srHasta) where.fecha_real_solucion.lte = srHasta;
    }
    if (filters.empresaIds?.length) where.empresa_id = { in: filters.empresaIds };
    if (filters.clienteIds?.length) where.cliente_id = { in: filters.clienteIds };
    if (filters.divisionIds?.length) where.division_id = { in: filters.divisionIds };
    if (filters.contratoIds?.length) where.contrato_id = { in: filters.contratoIds };
    if (filters.corpoIds?.length) where.corpo_id = { in: filters.corpoIds };
    if (filters.puestoIds?.length) where.puesto_id = { in: filters.puestoIds };
    if (filters.ejecutivoCuentaIds?.length) where.ejecutivo_cuenta = { in: filters.ejecutivoCuentaIds };
    if (filters.clasificacionId != null) where.clasificacion = filters.clasificacionId;
    if (filters.estado != null) where.estado = filters.estado;

    const { sameGroupInclude, preexistentSpecs } = splitIncludeByTableGroup(INCIDENTES_REPORT_INCLUDE);

    const rows = await prisma.c_incidente.findMany({
        where,
        ...(sameGroupInclude ? { include: sameGroupInclude } : {}),
        orderBy: { id: "desc" },
        take: 50_000,
    });
    await hydratePreexistentRelations(rows, preexistentSpecs);
    await hydratePreexistentChildRelations(rows, "c_contribucion_incidente", [CONTRIBUCION_EMPLEADO_SPEC]);

    const empresaIds = parseIds(rows.map((x) => x.empresa_id));
    const clienteIds = parseIds(rows.map((x) => x.cliente_id));
    const divisionIds = parseIds(rows.map((x) => x.division_id));
    const contratoIds = parseIds(rows.map((x) => x.contrato_id));
    const corpoIds = parseIds(rows.map((x) => x.corpo_id));
    const puestoIds = parseIds(rows.map((x) => x.puesto_id));

    const [empresas, clientes, divisiones, contratos, corpos, puestos] = await Promise.all([
        empresaIds.length ? prisma.e_estructura_empresa.findMany({ where: { id: { in: empresaIds } }, select: { id: true, nombre: true, codigo: true } }) : [],
        clienteIds.length ? prisma.e_estructura_cliente.findMany({ where: { id: { in: clienteIds } }, select: { id: true, nombre: true } }) : [],
        divisionIds.length ? prisma.n_division.findMany({ where: { id: { in: divisionIds } }, select: { id: true, nombre: true } }) : [],
        contratoIds.length
            ? prisma.e_estructura_contrato.findMany({ where: { id: { in: contratoIds } }, select: { id: true, nombre: true, nro_contrato: true } })
            : [],
        corpoIds.length
            ? prisma.e_estructura_sucursal.findMany({ where: { id: { in: corpoIds } }, select: { id: true, nombre: true, nro_sucursal: true } })
            : [],
        puestoIds.length ? prisma.e_estructura_puesto.findMany({ where: { id: { in: puestoIds } }, select: { id: true, nombre: true, codigo: true } }) : [],
    ]);
    const empresaById = new Map(empresas.map((x) => [x.id, x]));
    const clienteById = new Map(clientes.map((x) => [x.id, x]));
    const divisionById = new Map(divisiones.map((x) => [x.id, x]));
    const contratoById = new Map(contratos.map((x) => [x.id, x]));
    const corpoById = new Map(corpos.map((x) => [x.id, x]));
    const puestoById = new Map(puestos.map((x) => [x.id, x]));

    const enriched = rows.map((r: any) => {
        const empresa = empresaById.get(Number(r.empresa_id));
        const cliente = clienteById.get(Number(r.cliente_id));
        const division = divisionById.get(Number(r.division_id));
        const contrato = contratoById.get(Number(r.contrato_id));
        const corpo = corpoById.get(Number(r.corpo_id));
        const puesto = puestoById.get(Number(r.puesto_id));
        return {
            ...r,
            empresa_nombre: empresa ? `${empresa.codigo ? `${empresa.codigo} - ` : ""}${empresa.nombre}` : String(r.empresa_id),
            cliente_nombre: cliente?.nombre ?? String(r.cliente_id),
            division_nombre: division?.nombre ?? String(r.division_id),
            contrato_nombre: contrato ? `${contrato.nro_contrato ? `${contrato.nro_contrato} - ` : ""}${contrato.nombre}` : String(r.contrato_id),
            corpo_nombre: corpo ? `${corpo.nro_sucursal ? `${corpo.nro_sucursal} - ` : ""}${corpo.nombre}` : String(r.corpo_id),
            puesto_nombre: puesto ? `${puesto.codigo ? `${puesto.codigo} - ` : ""}${puesto.nombre}` : String(r.puesto_id),
            clasificacion_nombre: r.n_clasificacion_incidente?.nombre || String(r.clasificacion ?? ""),
            ejecutivo_cuenta_nombre: String(r.n_ejecutivo_cuenta?.nombre || "").trim(),
            involucrados_list: parseJsonArray(r.involucrados),
            libro_novedades_list: parseJsonArray(r.fecha_libro_novedades),
        };
    });

    return [...enriched].sort((a: any, b: any) => {
        switch (orderKey) {
            case "empresa_id":
                return a.empresa_nombre.localeCompare(b.empresa_nombre, "es");
            case "cliente_id":
                return a.cliente_nombre.localeCompare(b.cliente_nombre, "es");
            case "division_id":
                return a.division_nombre.localeCompare(b.division_nombre, "es");
            case "contrato_id":
                return a.contrato_nombre.localeCompare(b.contrato_nombre, "es");
            case "corpo_id":
                return a.corpo_nombre.localeCompare(b.corpo_nombre, "es");
            case "puesto_id":
                return a.puesto_nombre.localeCompare(b.puesto_nombre, "es");
            case "created_at":
            default:
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
    });
}

export async function buildIncidenteExcelConsolidado(rows: any[]): Promise<Buffer> { // Consolidado
    const wb = new ExcelJS.Workbook();
    const wsMain = wb.addWorksheet("Incidentes");
    const wsDet = wb.addWorksheet("Detalles");
    const border: Partial<ExcelJS.Borders> = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
    const hdrFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAF7" } } as const;

    const detAnchorById = new Map<number, number>();
    for (const r of [...rows].sort((a, b) => Number(b.id) - Number(a.id))) {
        const start = wsDet.rowCount + 1;
        detAnchorById.set(Number(r.id), start);
        wsDet.mergeCells(start, 1, start, 8);
        wsDet.getCell(start, 1).value = `Incidente #${r.id} | ${r.corpo_nombre} | ${fmtDate(r.created_at)}`;
        wsDet.getCell(start, 1).font = { bold: true };
        wsDet.getCell(start, 1).fill = hdrFill;
        for (let c = 1; c <= 8; c++) wsDet.getCell(start, c).border = border;
        const h = wsDet.addRow(["Rol", "Empleado", "Nombre tercero", "Aporte", "Firma tercero", "Fecha", "Archivos", "ID"]);
        h.font = { bold: true };
        h.eachCell((cell) => {
            cell.fill = hdrFill;
            cell.border = border;
            cell.alignment = { vertical: "middle", wrapText: true };
        });
        for (const c of r.c_contribucion_incidente || []) {
            const emp = [c.c_empleado?.nombre, c.c_empleado?.primer_apellido, c.c_empleado?.segundo_apellido].filter(Boolean).join(" ").trim();
            const row = wsDet.addRow([
                excelCellString(c.rol_aporte),
                excelCellString(emp || c.c_empleado?.codigo || ""),
                excelCellString(c.nombre_aporte || ""),
                excelCellString(c.aporte || ""),
                "Pendiente",
                fmtDate(c.created_at),
                String(Array.isArray(c.c_archivos_aporte_incidente) ? c.c_archivos_aporte_incidente.length : 0),
                String(c.id),
            ]);
            row.eachCell((cell) => (cell.border = border));
            const sig = parseSignatureDataForExcel(c.firma_aporte_tercero);
            if (sig) {
                try {
                    const imgId = wb.addImage({ base64: sig.base64, extension: sig.extension });
                    wsDet.addImage(imgId, {
                        tl: { col: 4 + 0.08, row: row.number - 1 + 0.08 },
                        ext: { width: 120, height: 44 },
                        editAs: "oneCell",
                    });
                    wsDet.getCell(row.number, 5).value = "";
                } catch {
                    wsDet.getCell(row.number, 5).value = "Firma inválida";
                }
            } else {
                wsDet.getCell(row.number, 5).value = "Sin firma";
            }
        }
        wsDet.addRow([]);
    }

    /** Cuadrícula jerárquica: Incidente (nivel 0) → Involucrado / Novedad (libro) / Aporte, hermanos (nivel 1). */
    wsMain.properties.outlineProperties = { summaryBelow: false, summaryRight: false };

    const headers = [
        "ID de fila",
        "ID fila padre",
        "Nivel",
        "Tipo de fila",
        "ID Incidente",
        "Empresa",
        "Cliente",
        "División",
        "Contrato",
        "Corpo",
        "Puesto",
        "Clasificación",
        "Estado",
        "Responsable",
        "Responsable atención",
        "Descripción",
        "Fecha incidente",
        "Fecha reporte",
        "Solución propuesta",
        "Fecha solución",
        "Fecha solución real",
        "Costo asociado",
        "Consecutivo informe",
        "Link informe",
        "Ver detalle",
        "Nombre (involucrado)",
        "Código (involucrado)",
        "Número (novedad libro)",
        "Fecha (novedad libro)",
        "Rol (aporte)",
        "Empleado (aporte)",
        "Nombre tercero (aporte)",
        "Aporte",
        "Tiene firma tercero (aporte)",
        "Fecha (aporte)",
        "Archivos adjuntos (aporte)",
    ];
    const COL_VER_DETALLE = headers.indexOf("Ver detalle") + 1;
    const COL_TIPO_FILA = headers.indexOf("Tipo de fila") + 1;

    const hr = wsMain.addRow(headers);
    hr.font = { bold: true };
    hr.eachCell((cell) => {
        cell.fill = hdrFill;
        cell.border = border;
        cell.alignment = { vertical: "middle", wrapText: true };
    });

    const styleDataRow = (row: ExcelJS.Row, nivel: number) => {
        row.eachCell((cell) => {
            cell.border = border;
            cell.alignment = { vertical: "top", wrapText: true };
        });
        row.getCell(COL_TIPO_FILA).alignment = { vertical: "top", horizontal: "left", wrapText: true, indent: nivel };
        row.outlineLevel = nivel;
        if (nivel === 0) row.getCell(COL_TIPO_FILA).font = { bold: true };
    };

    for (const r of rows) {
        const invol = Array.isArray(r.involucrados_list) ? r.involucrados_list : [];
        const libro = Array.isArray(r.libro_novedades_list) ? r.libro_novedades_list : [];
        const aportes = Array.isArray(r.c_contribucion_incidente) ? r.c_contribucion_incidente : [];
        const general: Record<number, unknown> = {
            [headers.indexOf("ID Incidente") + 1]: r.id,
            [headers.indexOf("Empresa") + 1]: excelCellString(r.empresa_nombre),
            [headers.indexOf("Cliente") + 1]: excelCellString(r.cliente_nombre),
            [headers.indexOf("División") + 1]: excelCellString(r.division_nombre),
            [headers.indexOf("Contrato") + 1]: excelCellString(r.contrato_nombre),
            [headers.indexOf("Corpo") + 1]: excelCellString(r.corpo_nombre),
            [headers.indexOf("Puesto") + 1]: excelCellString(r.puesto_nombre),
            [headers.indexOf("Clasificación") + 1]: excelCellString(r.clasificacion_nombre),
            [headers.indexOf("Estado") + 1]: r.estado ? "Solucionado" : "No solucionado",
            [headers.indexOf("Responsable") + 1]: excelCellString(r.nombre_responsable),
            [headers.indexOf("Responsable atención") + 1]: excelCellString(r.nombre_responsable_atencion),
            [headers.indexOf("Descripción") + 1]: excelCellString(r.descripcion),
            [headers.indexOf("Fecha incidente") + 1]: fmtDate(r.fecha_incidente),
            [headers.indexOf("Fecha reporte") + 1]: fmtDate(r.fecha_reporte),
            [headers.indexOf("Solución propuesta") + 1]: excelCellString(r.solucion || ""),
            [headers.indexOf("Fecha solución") + 1]: fmtDate(r.fecha_solucion),
            [headers.indexOf("Fecha solución real") + 1]: fmtDate(r.fecha_real_solucion),
            [headers.indexOf("Costo asociado") + 1]: excelCellString(r.costo_asociado),
            [headers.indexOf("Consecutivo informe") + 1]: excelCellString(r.consecutivo_informe),
            [headers.indexOf("Link informe") + 1]: excelCellString(r.link_informe),
        };

        const rootValues = new Array(headers.length).fill("");
        rootValues[0] = String(r.id);
        rootValues[2] = 0;
        rootValues[3] = "Incidente";
        for (const [col, val] of Object.entries(general)) rootValues[Number(col) - 1] = val;
        const detRow = detAnchorById.get(Number(r.id));
        if (detRow) rootValues[COL_VER_DETALLE - 1] = "Ver detalle";
        const rootRow = wsMain.addRow(rootValues);
        if (detRow) {
            const c = rootRow.getCell(COL_VER_DETALLE);
            c.value = { text: "Ver detalle", hyperlink: `#'Detalles'!A${detRow}` };
            c.font = { color: { argb: "FF0563C1" }, underline: true };
        }
        styleDataRow(rootRow, 0);

        invol.forEach((x: any, idx: number) => {
            const values = new Array(headers.length).fill("");
            values[0] = `${r.id}.inv${idx + 1}`;
            values[1] = String(r.id);
            values[2] = 1;
            values[3] = "Involucrado";
            for (const [col, val] of Object.entries(general)) values[Number(col) - 1] = val;
            values[headers.indexOf("Nombre (involucrado)")] = excelCellString(x?.nombre ?? "");
            values[headers.indexOf("Código (involucrado)")] = excelCellString(x?.codigo ?? "");
            const row = wsMain.addRow(values);
            styleDataRow(row, 1);
        });

        libro.forEach((x: any, idx: number) => {
            const values = new Array(headers.length).fill("");
            values[0] = `${r.id}.nov${idx + 1}`;
            values[1] = String(r.id);
            values[2] = 1;
            values[3] = "Novedad (libro)";
            for (const [col, val] of Object.entries(general)) values[Number(col) - 1] = val;
            values[headers.indexOf("Número (novedad libro)")] = excelCellString(x?.numero ?? "");
            values[headers.indexOf("Fecha (novedad libro)")] = excelCellString(x?.fecha ?? "");
            const row = wsMain.addRow(values);
            styleDataRow(row, 1);
        });

        aportes.forEach((c: any, idx: number) => {
            const emp = [c.c_empleado?.nombre, c.c_empleado?.primer_apellido, c.c_empleado?.segundo_apellido].filter(Boolean).join(" ").trim();
            const values = new Array(headers.length).fill("");
            values[0] = `${r.id}.ap${idx + 1}`;
            values[1] = String(r.id);
            values[2] = 1;
            values[3] = "Aporte";
            for (const [col, val] of Object.entries(general)) values[Number(col) - 1] = val;
            values[headers.indexOf("Rol (aporte)")] = excelCellString(c.rol_aporte);
            values[headers.indexOf("Empleado (aporte)")] = excelCellString(emp || c.c_empleado?.codigo || "");
            values[headers.indexOf("Nombre tercero (aporte)")] = excelCellString(c.nombre_aporte || "");
            values[headers.indexOf("Aporte")] = excelCellString(c.aporte || "");
            values[headers.indexOf("Tiene firma tercero (aporte)")] = c.firma_aporte_tercero ? "Sí" : "No";
            values[headers.indexOf("Fecha (aporte)")] = fmtDate(c.created_at);
            values[headers.indexOf("Archivos adjuntos (aporte)")] = String(
                Array.isArray(c.c_archivos_aporte_incidente) ? c.c_archivos_aporte_incidente.length : 0,
            );
            const row = wsMain.addRow(values);
            styleDataRow(row, 1);
        });
    }

    wsMain.columns = [
        12, 14, 8, 20, 10,
        24, 24, 18, 24, 24, 24, 18, 14, 24, 24, 44, 14, 14, 40, 14, 18, 16, 18, 24,
        14,
        24, 14,
        16, 16,
        16, 24, 24, 34, 18, 14, 18,
    ].map((w) => ({ width: w }));
    wsDet.columns = [14, 24, 24, 60, 24, 14, 10, 10].map((w) => ({ width: w }));

    return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function buildIncidenteExcelIndividual(rows: any[], reportName?: string): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Incidentes");
    const borderThin: Partial<ExcelJS.Borders> = {
        top: { style: "thin", color: { argb: "FF000000" } },
        left: { style: "thin", color: { argb: "FF000000" } },
        bottom: { style: "thin", color: { argb: "FF000000" } },
        right: { style: "thin", color: { argb: "FF000000" } },
    };
    const borderMedium: Partial<ExcelJS.Borders> = {
        top: { style: "medium", color: { argb: "FF000000" } },
        left: { style: "medium", color: { argb: "FF000000" } },
        bottom: { style: "medium", color: { argb: "FF000000" } },
        right: { style: "medium", color: { argb: "FF000000" } },
    };
    const hdrFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3D63" } } as const;

    ws.columns = [16, 16, 16, 14, 14, 24, 16, 30, 28, 30, 24, 16, 16, 16, 18, 24, 14, 18, 10].map((w) => ({ width: w }));

    const first = rows[0];
    ws.mergeCells("A1:C2");
    ws.mergeCells("D1:P2");
    ws.mergeCells("Q1:S2");
    ws.mergeCells("A3:S3");

    ws.getCell("D1").value = "CONTROL DE INCIDENTES";
    ws.getCell("D1").font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
    ws.getCell("D1").alignment = { horizontal: "center", vertical: "middle" };
    ws.getCell("D1").fill = hdrFill;

    ws.getCell("Q1").value = excelCellString(reportName || "SEG-F-004");
    ws.getCell("Q1").font = { bold: true, size: 10 };
    ws.getCell("Q1").alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    ws.getRow(1).height = 34;
    ws.getRow(2).height = 34;
    ws.getRow(3).height = 14;
    ws.getCell("A3").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
    ws.getCell("A3").value = "";

    // Borde exterior negro para el encabezado completo (A1:S2).
    for (let c = 1; c <= 19; c++) {
        ws.getCell(1, c).border = {
            ...ws.getCell(1, c).border,
            top: borderMedium.top,
        };
        ws.getCell(2, c).border = {
            ...ws.getCell(2, c).border,
            bottom: borderMedium.bottom,
        };
    }
    for (let r = 1; r <= 2; r++) {
        ws.getCell(r, 1).border = {
            ...ws.getCell(r, 1).border,
            left: borderMedium.left,
        };
        ws.getCell(r, 19).border = {
            ...ws.getCell(r, 19).border,
            right: borderMedium.right,
        };
    }
    // Borde exterior negro para la línea 3 combinada (A3:S3).
    for (let c = 1; c <= 19; c++) {
        ws.getCell(3, c).border = {
            ...ws.getCell(3, c).border,
            top: borderMedium.top,
            bottom: borderMedium.bottom,
        };
    }
    ws.getCell(3, 1).border = {
        ...ws.getCell(3, 1).border,
        left: borderMedium.left,
    };
    ws.getCell(3, 19).border = {
        ...ws.getCell(3, 19).border,
        right: borderMedium.right,
    };

    const logo = await resolveLogoPathByEmpresaId(Number(first?.empresa_id || 0));
    if (logo) {
        try {
            const ext = path.extname(logo).toLowerCase() === ".png" ? "png" : "jpeg";
            const imgId = wb.addImage({ filename: logo, extension: ext as "png" | "jpeg" });
            const original = await getImageDimensionsFromFile(logo);
            const originalW = original?.width ?? 300;
            const originalH = original?.height ?? 120;
            // Ajuste "contain" dentro de A1:C2, preservando proporción.
            const maxW = 150;
            const maxH = 58;
            const { width: drawW, height: drawH } = fitImageExtInsideBox(originalW, originalH, maxW, maxH);
            const xPad = (maxW - drawW) / 2;
            const yPad = (maxH - drawH) / 2;
            ws.addImage(imgId, {
                tl: { col: 0.2 + xPad / 64, row: 0.2 + yPad / 20 },
                ext: { width: drawW, height: drawH },
                editAs: "oneCell",
            });
        } catch {
            // ignore logo errors
        }
    }

    const formatInvolucrados = (arr: any[]): string =>
        arr
            .map((x) => {
                const nombre = String(x?.nombre ?? "").trim();
                const codigo = String(x?.codigo ?? "").trim();
                if (!nombre) return "";
                return codigo ? `${nombre} (${codigo})` : nombre;
            })
            .filter(Boolean)
            .join(", ");
    const formatLibroNovedades = (arr: any[]): string =>
        arr
            .map((x) => {
                const numero = String(x?.numero ?? "").trim();
                const fecha = String(x?.fecha ?? "").trim();
                if (!numero && !fecha) return "";
                if (numero && fecha) return `${numero} (${fecha})`;
                return numero || fecha;
            })
            .filter(Boolean)
            .join(", ");

    const headers = [
        "N°",
        "Sociedad",
        "Cliente",
        "Corpo",
        "Ejecutivo de cuenta",
        "Fecha de incidente",
        "Fecha del reporte",
        "Nombre de quien reporta incidente",
        "Clasificación",
        "Descripción del incidente",
        "Involucrado(s) Incidente",
        "Fecha de Libro de Novedades y # Folio",
        "Nombre responsable de atención del incidente",
        "Solución propuesta",
        "Fecha propuesta de solución",
        "Fecha real de solución",
        "Costo asociado de incidente",
        "Consecutivo de informe",
        "Link informe",
    ];
    const hdrRow = ws.getRow(4);
    headers.forEach((h, i) => {
        const cell = hdrRow.getCell(i + 1);
        cell.value = h;
        cell.font = { bold: true, size: 9, color: { argb: "FFFFFFFF" } };
        cell.fill = hdrFill;
        cell.border = borderThin;
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    });
    hdrRow.height = 38;

    let rowNo = 5;
    for (const [idx, r] of rows.entries()) {
        const row = ws.getRow(rowNo);
        row.values = [
            idx + 1,
            excelCellString(r.empresa_nombre || ""),
            excelCellString(r.cliente_nombre || ""),
            excelCellString(r.corpo_nombre || ""),
            excelCellString(r.ejecutivo_cuenta_nombre || ""),
            fmtDate(r.fecha_incidente),
            fmtDate(r.fecha_reporte),
            excelCellString(r.nombre_responsable || ""),
            excelCellString(r.clasificacion_nombre || ""),
            excelCellString(r.descripcion || ""),
            excelCellString(formatInvolucrados(Array.isArray(r.involucrados_list) ? r.involucrados_list : [])),
            excelCellString(formatLibroNovedades(Array.isArray(r.libro_novedades_list) ? r.libro_novedades_list : [])),
            excelCellString(r.nombre_responsable_atencion || ""),
            excelCellString(r.solucion || ""),
            fmtDate(r.fecha_solucion),
            fmtDate(r.fecha_real_solucion),
            excelCellString(r.costo_asociado || ""),
            excelCellString(r.consecutivo_informe || ""),
            excelCellString(r.link_informe || ""),
        ];
        for (let c = 1; c <= 19; c++) {
            const cell = row.getCell(c);
            cell.border = borderThin;
            cell.alignment = { vertical: "top", wrapText: true };
            cell.font = { size: 9 };
        }
        row.height = 42;
        rowNo += 1;
    }

    const lastRow = Math.max(4, rowNo - 1);
    for (let c = 1; c <= 19; c++) {
        ws.getCell(4, c).border = {
            ...ws.getCell(4, c).border,
            top: borderMedium.top,
        };
        ws.getCell(lastRow, c).border = {
            ...ws.getCell(lastRow, c).border,
            bottom: borderMedium.bottom,
        };
    }
    for (let r = 4; r <= lastRow; r++) {
        ws.getCell(r, 1).border = {
            ...ws.getCell(r, 1).border,
            left: borderMedium.left,
        };
        ws.getCell(r, 19).border = {
            ...ws.getCell(r, 19).border,
            right: borderMedium.right,
        };
    }

    return Buffer.from(await wb.xlsx.writeBuffer());
}
