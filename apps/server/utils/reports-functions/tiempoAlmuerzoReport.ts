/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ReportDataAccess } from "../reportDynamicPrisma";
import ExcelJS from "exceljs";

export type TiempoAlmuerzoModuleFilters = {
    /** Combinación fecha+hora sin conversión de zona (filtro sobre columna `inicio`). */
    inicioDesde?: string | null;
    /** Combinación fecha+hora sin conversión de zona (filtro sobre columna `fin`). */
    finHasta?: string | null;
    empresaIds?: number[] | null;
    clienteIds?: number[] | null;
    divisionIds?: number[] | null;
    contratoIds?: number[] | null;
    corpoIds?: number[] | null;
    puestoIds?: number[] | null;
    empleadoIds?: number[] | null;
    cedulas?: string[] | null;
};

export type TiempoAlmuerzoOrderKey =
    | "empresa_id"
    | "cliente_id"
    | "division_id"
    | "contrato_id"
    | "corpo_id"
    | "puesto_id"
    | "inicio"
    | "fin";

function toValidIds(raw: unknown): number[] {
    if (!Array.isArray(raw)) return [];
    return [...new Set(raw.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0))];
}

function parseCedulas(v: unknown): string[] {
    if (!Array.isArray(v)) return [];
    return [...new Set(v.map((x) => String(x ?? "").trim().replace(/\s+/g, "")).filter((s) => s.length > 0))];
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

export function normalizeTiempoAlmuerzoFilters(raw: unknown): TiempoAlmuerzoModuleFilters {
    const o = raw != null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const next: TiempoAlmuerzoModuleFilters = {};
    const id = o.inicioDesde != null ? String(o.inicioDesde).trim() : "";
    const fh = o.finHasta != null ? String(o.finHasta).trim() : "";
    if (id) next.inicioDesde = id;
    if (fh) next.finHasta = fh;
    const emp = toValidIds(o.empresaIds);
    const cli = toValidIds(o.clienteIds);
    const div = toValidIds(o.divisionIds);
    const con = toValidIds(o.contratoIds);
    const cor = toValidIds(o.corpoIds);
    const pue = toValidIds(o.puestoIds);
    const eids = toValidIds(o.empleadoIds);
    const ceds = parseCedulas(o.cedulas);
    if (emp.length) next.empresaIds = emp;
    if (cli.length) next.clienteIds = cli;
    if (div.length) next.divisionIds = div;
    if (con.length) next.contratoIds = con;
    if (cor.length) next.corpoIds = cor;
    if (pue.length) next.puestoIds = pue;
    if (eids.length) next.empleadoIds = eids;
    if (ceds.length) next.cedulas = ceds;
    return next;
}

export function hasTiempoAlmuerzoListModuleFiltersContent(f: TiempoAlmuerzoModuleFilters): boolean {
    if (f.inicioDesde || f.finHasta) return true;
    if (f.empresaIds?.length || f.clienteIds?.length || f.divisionIds?.length) return true;
    if (f.contratoIds?.length || f.corpoIds?.length || f.puestoIds?.length) return true;
    if (f.empleadoIds?.length || f.cedulas?.length) return true;
    return false;
}

export function filtersMatchTiempoAlmuerzoListQuery(parsedRowFilters: any, listModuleFilters?: TiempoAlmuerzoModuleFilters): boolean {
    if (!listModuleFilters) return true;
    const saved = normalizeTiempoAlmuerzoFilters((parsedRowFilters?.moduleFilters || {}) as any);
    const overlaps = (left?: number[] | null, right?: number[] | null) => {
        if (!left || left.length === 0) return true;
        if (!right || right.length === 0) return false;
        return left.some((x) => right.includes(x));
    };
    if (listModuleFilters.inicioDesde && String(saved.inicioDesde || "") !== String(listModuleFilters.inicioDesde)) return false;
    if (listModuleFilters.finHasta && String(saved.finHasta || "") !== String(listModuleFilters.finHasta)) return false;
    if (!overlaps(listModuleFilters.empresaIds ?? undefined, saved.empresaIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.clienteIds ?? undefined, saved.clienteIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.divisionIds ?? undefined, saved.divisionIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.contratoIds ?? undefined, saved.contratoIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.corpoIds ?? undefined, saved.corpoIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.puestoIds ?? undefined, saved.puestoIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.empleadoIds ?? undefined, saved.empleadoIds ?? undefined)) return false;
    const lc = listModuleFilters.cedulas ?? [];
    const sc = saved.cedulas ?? [];
    if (lc.length) {
        if (!sc.length) return false;
        const setS = new Set(sc.map((x) => String(x).toLowerCase().trim()));
        for (const c of lc) {
            if (!setS.has(String(c).toLowerCase().trim())) return false;
        }
    }
    return true;
}

type PausaParsed = {
    startTime: string;
    endTime: string;
    reason: string;
};

function parsePausasJson(raw: string | null | undefined): PausaParsed[] {
    if (!raw || !String(raw).trim()) return [];
    let parsed: unknown;
    try {
        parsed = JSON.parse(String(raw));
    } catch {
        return [];
    }
    if (!Array.isArray(parsed)) return [];
    const out: PausaParsed[] = [];
    for (const p of parsed) {
        if (!p || typeof p !== "object") continue;
        const o = p as Record<string, unknown>;
        const startRaw = o.startTime ?? o.inicio ?? o.start;
        const endRaw = o.endTime ?? o.fin ?? o.end;
        const reasonRaw = o.reason ?? o.razon ?? "";
        const startTime = startRaw != null ? fmtDateTimeCol(startRaw as any) : "";
        const endTime = endRaw != null ? fmtDateTimeCol(endRaw as any) : "";
        const reason = String(reasonRaw ?? "").trim();
        if (!startTime && !endTime && !reason) continue;
        out.push({ startTime, endTime, reason });
    }
    return out;
}

export async function queryTiempoAlmuerzoRows(
    prisma: ReportDataAccess,
    filters: TiempoAlmuerzoModuleFilters,
    orderKey: TiempoAlmuerzoOrderKey,
) {
    const where: any = { isActive: true };
    const desde = parseLocalDateTime(filters.inicioDesde ?? undefined);
    const hasta = parseLocalDateTime(filters.finHasta ?? undefined);
    if (desde) where.inicio = { ...(where.inicio || {}), gte: desde };
    if (hasta) where.fin = { ...(where.fin || {}), lte: hasta };
    if (filters.empresaIds?.length) where.empresa_id = { in: filters.empresaIds };
    if (filters.clienteIds?.length) where.cliente_id = { in: filters.clienteIds };
    if (filters.divisionIds?.length) where.division_id = { in: filters.divisionIds };
    if (filters.contratoIds?.length) where.contrato_id = { in: filters.contratoIds };
    if (filters.corpoIds?.length) where.corpo_id = { in: filters.corpoIds };
    if (filters.puestoIds?.length) where.puesto_id = { in: filters.puestoIds };
    if (filters.empleadoIds?.length) where.empleadoId = { in: filters.empleadoIds };
    if (filters.cedulas?.length) {
        where.OR = filters.cedulas.map((c) => ({
            cedula_empleado: { contains: c },
        }));
    }

    const rows = await prisma.c_empleado_almuerzo.findMany({
        where,
        orderBy: { id: "desc" },
        take: 50_000,
    });

    const ids = <T>(vals: T[]) => [...new Set(vals.map((x: any) => Number(x)).filter((n) => Number.isFinite(n) && n > 0))];
    const [empresaIds, clienteIds, divisionIds, contratoIds, corpoIds, puestoIds] = [
        ids(rows.map((x) => x.empresa_id)),
        ids(rows.map((x) => x.cliente_id)),
        ids(rows.map((x) => x.division_id)),
        ids(rows.map((x) => x.contrato_id)),
        ids(rows.map((x) => x.corpo_id)),
        ids(rows.map((x) => x.puesto_id)),
    ];

    const [empresas, clientes, divisiones, contratos, corpos, puestos] = await Promise.all([
        empresaIds.length
            ? prisma.e_estructura_empresa.findMany({ where: { id: { in: empresaIds } }, select: { id: true, nombre: true, codigo: true } })
            : [],
        clienteIds.length ? prisma.e_estructura_cliente.findMany({ where: { id: { in: clienteIds } }, select: { id: true, nombre: true } }) : [],
        divisionIds.length ? prisma.n_division.findMany({ where: { id: { in: divisionIds } }, select: { id: true, nombre: true, codigo: true } }) : [],
        contratoIds.length
            ? prisma.e_estructura_contrato.findMany({ where: { id: { in: contratoIds } }, select: { id: true, nombre: true, nro_contrato: true } })
            : [],
        corpoIds.length
            ? prisma.e_estructura_sucursal.findMany({ where: { id: { in: corpoIds } }, select: { id: true, nombre: true, nro_sucursal: true } })
            : [],
        puestoIds.length
            ? prisma.e_estructura_puesto.findMany({ where: { id: { in: puestoIds } }, select: { id: true, nombre: true, codigo: true } })
            : [],
    ]);

    const empresaById = new Map(empresas.map((x) => [x.id, x]));
    const clienteById = new Map(clientes.map((x) => [x.id, x]));
    const divisionById = new Map(divisiones.map((x) => [x.id, x]));
    const contratoById = new Map(contratos.map((x) => [x.id, x]));
    const corpoById = new Map(corpos.map((x) => [x.id, x]));
    const puestoById = new Map(puestos.map((x) => [x.id, x]));

    const enriched = rows.map((r) => {
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
            division_nombre: division ? `${division.codigo ? `${division.codigo} - ` : ""}${division.nombre}` : String(r.division_id),
            contrato_nombre: contrato ? `${contrato.nro_contrato ? `${contrato.nro_contrato} - ` : ""}${contrato.nombre}` : String(r.contrato_id),
            corpo_nombre: corpo ? `${corpo.nro_sucursal ? `${corpo.nro_sucursal} - ` : ""}${corpo.nombre}` : String(r.corpo_id),
            puesto_nombre: puesto ? `${puesto.codigo ? `${puesto.codigo} - ` : ""}${puesto.nombre}` : String(r.puesto_id),
            inicio_txt: fmtDateTimeCol(r.inicio),
            fin_txt: fmtDateTimeCol(r.fin),
            pausas_list: parsePausasJson(r.pausas),
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
            case "inicio":
                return String(a.inicio_txt).localeCompare(String(b.inicio_txt), "es");
            case "fin":
                return String(a.fin_txt).localeCompare(String(b.fin_txt), "es");
            default:
                return 0;
        }
    });
}

const GRP_HDR = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAF7" } } as const;
const PAUSA_HDR = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2EFDA" } } as const;
const borderThin: Partial<ExcelJS.Borders> = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
};

function appendPausasDetailBlock(wsPausas: ExcelJS.Worksheet, r: any): number {
    const titleRow = wsPausas.addRow([
        `Registro #${r.id}`,
        String(r.empleado_nombre || ""),
        `Cédula: ${String(r.cedula_empleado || "")}`,
    ]);
    titleRow.font = { bold: true };
    titleRow.eachCell((c) => {
        c.fill = GRP_HDR;
        c.border = borderThin;
        c.alignment = { vertical: "middle", wrapText: true };
    });

    const hdr = wsPausas.addRow(["startTime", "endTime", "reason"]);
    hdr.font = { bold: true };
    hdr.eachCell((c) => {
        c.fill = PAUSA_HDR;
        c.border = borderThin;
        c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    });
    const anchorRow = hdr.number;

    const pausas: PausaParsed[] = r.pausas_list?.length ? r.pausas_list : parsePausasJson(r.pausas);
    if (!pausas.length) {
        const empty = wsPausas.addRow(["—", "—", "Sin pausas registradas"]);
        empty.eachCell((c) => {
            c.border = borderThin;
            c.alignment = { vertical: "top", wrapText: true };
        });
    } else {
        for (const p of pausas) {
            const row = wsPausas.addRow([p.startTime, p.endTime, p.reason]);
            row.eachCell((c) => {
                c.border = borderThin;
                c.alignment = { vertical: "top", wrapText: true };
            });
        }
    }
    wsPausas.addRow([]);
    return anchorRow;
}

export async function buildTiempoAlmuerzoExcelConsolidado(rows: any[]): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const wsMain = wb.addWorksheet("Tiempo de almuerzo");
    const wsPausas = wb.addWorksheet("Pausas");
    const anchorPausasById = new Map<number, number>();

    for (const r of [...rows].sort((a, b) => Number(b.id) - Number(a.id))) {
        anchorPausasById.set(Number(r.id), appendPausasDetailBlock(wsPausas, r));
    }

    const headers = [
        "ID",
        "Empresa",
        "Cliente",
        "División",
        "Contrato",
        "Sucursal",
        "Puesto",
        "Empleado",
        "Cédula",
        "Inicio",
        "Fin",
        "Minutos almuerzo",
        "Es manual",
        "Pausas",
    ];
    const h = wsMain.addRow(headers);
    h.font = { bold: true };
    h.eachCell((c) => {
        c.fill = GRP_HDR;
        c.border = borderThin;
        c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    });
    wsMain.views = [{ state: "frozen", ySplit: 1 }];
    wsMain.columns = [
        { width: 8, outlineLevel: 1 },
        { width: 26, outlineLevel: 1 },
        { width: 22, outlineLevel: 1 },
        { width: 20, outlineLevel: 1 },
        { width: 22, outlineLevel: 1 },
        { width: 22, outlineLevel: 1 },
        { width: 22, outlineLevel: 1 },
        { width: 28, outlineLevel: 1 },
        { width: 16, outlineLevel: 1 },
        { width: 18, outlineLevel: 1 },
        { width: 18, outlineLevel: 1 },
        { width: 14, outlineLevel: 1 },
        { width: 10, outlineLevel: 1 },
        { width: 14, outlineLevel: 1 },
    ];

    const colPausas = headers.length;

    for (const r of rows) {
        const paRow = anchorPausasById.get(Number(r.id)) ?? 1;
        const row = wsMain.addRow([
            r.id,
            r.empresa_nombre,
            r.cliente_nombre,
            r.division_nombre,
            r.contrato_nombre,
            r.corpo_nombre,
            r.puesto_nombre,
            String(r.empleado_nombre ?? ""),
            String(r.cedula_empleado ?? ""),
            r.inicio_txt,
            r.fin_txt,
            Number(r.minutos_almuerzo ?? 0),
            r.es_manual ? "Sí" : "No",
            "",
        ]);
        row.getCell(colPausas).value = { text: "Ver pausas", hyperlink: `#'Pausas'!A${paRow}` };
        row.getCell(colPausas).font = { color: { argb: "FF0563C1" }, underline: true };
        row.eachCell((cell, col) => {
            cell.border = borderThin;
            if (col !== colPausas) {
                cell.alignment = { vertical: "top", wrapText: true };
            }
        });
    }

    wsMain.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: Math.max(1, rows.length + 1), column: headers.length },
    };

    wsPausas.columns = [{ width: 22 }, { width: 22 }, { width: 42 }];
    return Buffer.from(await wb.xlsx.writeBuffer());
}
