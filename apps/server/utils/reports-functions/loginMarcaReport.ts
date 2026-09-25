/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ReportDataAccess } from "../reportDynamicPrisma";
import ExcelJS from "exceljs";
import {
    addMainRow,
    applyConsolidadoReportBanner,
    formatDateOnlyDMY,
    formatTimeOnlyHMS,
    type ConsolidadoBannerMeta,
} from "./reportConsolidadoBanner";

export type LoginMarcaModuleFilters = {
    /** Combinación fecha+hora sin conversión de zona (filtro sobre `fecha_hora`). */
    creadoDesde?: string | null;
    /** Combinación fecha+hora sin conversión de zona (filtro sobre `fecha_hora`). */
    creadoHasta?: string | null;
    empleadoIds?: number[] | null;
};

export type LoginMarcaOrderKey = "cedula_empleado" | "nombre_empleado" | "fecha_hora" | "puesto_id";

function toValidIds(raw: unknown): number[] {
    if (!Array.isArray(raw)) return [];
    return [...new Set(raw.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0))];
}

/** Interpreta "YYYY-MM-DDTHH:mm:ss" o "YYYY-MM-DD HH:mm:ss" como fecha local (sin UTC). */
function parseLocalDateTime(s: string | null | undefined): Date | null {
    if (!s || String(s).trim() === "") return null;
    const t = String(s).trim();
    const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(t);
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    const h = Number(m[4]);
    const mi = Number(m[5]);
    const sec = m[6] != null ? Number(m[6]) : 0;
    const dt = new Date(y, mo, d, h, mi, sec);
    return Number.isNaN(dt.getTime()) ? null : dt;
}

function fmtDateTimeCol(d: Date | string | null | undefined): string {
    if (d == null) return "";
    if (d instanceof Date) return d.toISOString().replace("T", " ").slice(0, 19);
    const s = String(d).trim();
    if (!s) return "";
    return s.length >= 19 ? s.slice(0, 19).replace("T", " ") : s;
}

export function normalizeLoginMarcaFilters(raw: unknown): LoginMarcaModuleFilters {
    const o = raw != null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const next: LoginMarcaModuleFilters = {};
    const cds = o.creadoDesde != null ? String(o.creadoDesde).trim() : "";
    const chs = o.creadoHasta != null ? String(o.creadoHasta).trim() : "";
    if (cds) next.creadoDesde = cds;
    if (chs) next.creadoHasta = chs;
    const eids = toValidIds(o.empleadoIds);
    if (eids.length) next.empleadoIds = eids;
    return next;
}

export function hasLoginMarcaListModuleFiltersContent(f: LoginMarcaModuleFilters): boolean {
    if (f.creadoDesde || f.creadoHasta) return true;
    if (f.empleadoIds?.length) return true;
    return false;
}

export function filtersMatchLoginMarcaListQuery(parsedRowFilters: any, listModuleFilters?: LoginMarcaModuleFilters): boolean {
    if (!listModuleFilters) return true;
    const saved = normalizeLoginMarcaFilters((parsedRowFilters?.moduleFilters || {}) as any);
    if (listModuleFilters.creadoDesde && String(saved.creadoDesde || "") !== String(listModuleFilters.creadoDesde)) return false;
    if (listModuleFilters.creadoHasta && String(saved.creadoHasta || "") !== String(listModuleFilters.creadoHasta)) return false;
    const le = listModuleFilters.empleadoIds ?? [];
    const se = saved.empleadoIds ?? [];
    if (le.length) {
        if (!se.length) return false;
        const setS = new Set(se);
        for (const id of le) {
            if (!setS.has(id)) return false;
        }
    }
    return true;
}

export async function queryLoginMarcaRows(
    prisma: ReportDataAccess,
    filters: LoginMarcaModuleFilters,
    orderKey: LoginMarcaOrderKey,
) {
    const where: any = {};
    const desde = parseLocalDateTime(filters.creadoDesde ?? undefined);
    const hasta = parseLocalDateTime(filters.creadoHasta ?? undefined);
    if (desde || hasta) {
        where.fecha_hora = {};
        if (desde) where.fecha_hora.gte = desde;
        if (hasta) where.fecha_hora.lte = hasta;
    }

    if (filters.empleadoIds?.length) {
        const empleados = await prisma.c_empleado.findMany({
            where: {
                id: { in: filters.empleadoIds },
                NOT: [{ cedula: { contains: "@" } }],
            },
            select: { cedula: true },
        });
        const cedulas = [...new Set(empleados.map((e) => String(e.cedula ?? "").trim()).filter(Boolean))];
        if (!cedulas.length) {
            return [];
        }
        where.cedula_empleado = { in: cedulas };
    }

    const rows = await prisma.c_login_marca_almuerzo.findMany({
        where,
        orderBy: { id: "desc" },
        take: 50_000,
    });

    const puestoIds = [...new Set(rows.map((r) => Number(r.puesto_id)).filter((n) => Number.isFinite(n) && n > 0))];
    const puestos = puestoIds.length
        ? await prisma.e_estructura_puesto.findMany({
              where: { id: { in: puestoIds } },
              select: { id: true, nombre: true, codigo: true },
          })
        : [];
    const puestoById = new Map(puestos.map((p) => [p.id, p]));

    const enriched = rows.map((r) => {
        const puesto = r.puesto_id != null ? puestoById.get(Number(r.puesto_id)) : undefined;
        const puestoNombre = puesto
            ? `${puesto.codigo ? `${puesto.codigo} - ` : ""}${puesto.nombre}`
            : r.puesto_id != null
              ? String(r.puesto_id)
              : "";
        return {
            ...r,
            puesto_nombre: puestoNombre,
            fecha_hora_txt: fmtDateTimeCol(r.fecha_hora),
        };
    });

    return [...enriched].sort((a: any, b: any) => {
        switch (orderKey) {
            case "nombre_empleado":
                return String(a.nombre_empleado ?? "").localeCompare(String(b.nombre_empleado ?? ""), "es");
            case "fecha_hora":
                return String(a.fecha_hora_txt).localeCompare(String(b.fecha_hora_txt), "es");
            case "puesto_id":
                return String(a.puesto_nombre ?? "").localeCompare(String(b.puesto_nombre ?? ""), "es");
            case "cedula_empleado":
            default:
                return String(a.cedula_empleado ?? "").localeCompare(String(b.cedula_empleado ?? ""), "es");
        }
    });
}

const GRP_HDR = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAF7" } } as const;
const borderThin: Partial<ExcelJS.Borders> = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
};

export async function buildLoginMarcaExcelConsolidado(
    rows: any[],
    reportDb: ReportDataAccess,
    bannerMeta: ConsolidadoBannerMeta,
): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Login de marca", {
        properties: { outlineProperties: { summaryBelow: false, summaryRight: false } },
    });

    const headers = [
        "ID",
        "Cédula empleado",
        "Nombre empleado",
        "Fecha",
        "Hora",
        "Puesto",
        "Dispositivo",
        "Latitud",
        "Longitud",
        "Marca ID",
        "Marca entrada teórica",
        "Marca entrada teórica (hora)",
        "Marca entrada real",
        "Marca entrada real (hora)",
        "Marca salida teórica",
        "Marca salida teórica (hora)",
        "Marca salida real",
        "Marca salida real (hora)",
        "Hora inicio almuerzo",
        "Hora inicio almuerzo (hora)",
        "Hora fin almuerzo",
        "Hora fin almuerzo (hora)",
        "Id de sesión",
    ];

    applyConsolidadoReportBanner(ws, bannerMeta, { headerFillArgb: "FFD9EAF7", mainColumnCount: headers.length });

    addMainRow(ws, headers);
    const h = ws.getRow(12);
    h.font = { bold: true };
    for (let c = 2; c <= headers.length + 1; c++) {
        const cell = h.getCell(c);
        cell.fill = GRP_HDR;
        cell.border = borderThin;
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    }
    // Fondo blanco en todo el documento: se oculta la cuadrícula de Excel, así solo se ven los bordes que dibujamos manualmente.
    ws.views = [{ showGridLines: false }];

    const widthByHeader: Record<string, number> = {
        ID: 8,
        "Cédula empleado": 20,
        "Nombre empleado": 20,
        Fecha: 14,
        Hora: 12,
        Puesto: 20,
        Dispositivo: 28,
        Latitud: 20,
        Longitud: 20,
        "Marca ID": 20,
        "Marca entrada teórica": 14,
        "Marca entrada teórica (hora)": 12,
        "Marca entrada real": 14,
        "Marca entrada real (hora)": 12,
        "Marca salida teórica": 14,
        "Marca salida teórica (hora)": 12,
        "Marca salida real": 14,
        "Marca salida real (hora)": 12,
        "Hora inicio almuerzo": 14,
        "Hora inicio almuerzo (hora)": 12,
        "Hora fin almuerzo": 14,
        "Hora fin almuerzo (hora)": 12,
        "Id de sesión": 20,
    };
    ws.columns = [
        { width: 3 },
        ...headers.map((label) => ({ width: widthByHeader[label] ?? 20, outlineLevel: 1 })),
    ];

    for (const r of rows) {
        const row = addMainRow(ws, [
            r.id,
            String(r.cedula_empleado ?? ""),
            String(r.nombre_empleado ?? ""),
            formatDateOnlyDMY(r.fecha_hora),
            formatTimeOnlyHMS(r.fecha_hora),
            String(r.puesto_nombre ?? ""),
            String(r.device ?? ""),
            String(r.lat ?? ""),
            String(r.lng ?? ""),
            r.marca_id ?? "",
            formatDateOnlyDMY(r.marca_entrada_teorica),
            formatTimeOnlyHMS(r.marca_entrada_teorica),
            formatDateOnlyDMY(r.marca_entrada_real),
            formatTimeOnlyHMS(r.marca_entrada_real),
            formatDateOnlyDMY(r.marca_salida_teorica),
            formatTimeOnlyHMS(r.marca_salida_teorica),
            formatDateOnlyDMY(r.marca_salida_real),
            formatTimeOnlyHMS(r.marca_salida_real),
            formatDateOnlyDMY(r.hora_inicio_almuerzo),
            formatTimeOnlyHMS(r.hora_inicio_almuerzo),
            formatDateOnlyDMY(r.hora_fin_almuerzo),
            formatTimeOnlyHMS(r.hora_fin_almuerzo),
            String(r.session_id ?? ""),
        ]);
        row.eachCell((cell, colNumber) => {
            if (colNumber === 1) return;
            cell.border = borderThin;
            cell.alignment = { vertical: "top", wrapText: true };
        });
    }

    ws.autoFilter = {
        from: { row: 12, column: 2 },
        to: { row: Math.max(12, rows.length + 12), column: headers.length + 1 },
    };

    return Buffer.from(await wb.xlsx.writeBuffer());
}
