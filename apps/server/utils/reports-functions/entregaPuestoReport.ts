/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ReportDataAccess } from "../reportDynamicPrisma";
import ExcelJS from "exceljs";
import fs from "fs/promises";
import path from "path";

/** Mismos filtros geográficos / fechas que acta + campos propios de `e_registro_entrega_puesto`. */
export type EntregaPuestoModuleFilters = {
    creadoDesde?: string | null;
    creadoHasta?: string | null;
    empresaIds?: number[] | null;
    clienteIds?: number[] | null;
    divisionIds?: number[] | null;
    contratoIds?: number[] | null;
    corpoIds?: number[] | null;
    puestoIds?: number[] | null;
    oficialEntregaContains?: string | null;
    oficialRecibeContains?: string | null;
    fechaEntradaEntregaYmd?: string | null;
    fechaSalidaEntregaYmd?: string | null;
    fechaEntradaRecibeYmd?: string | null;
    fechaSalidaRecibeYmd?: string | null;
    /** Filtro opcional por hora del registro (`HH:mm`, coincide con columna TIME). */
    horaEntradaEntregaHm?: string | null;
    horaSalidaEntregaHm?: string | null;
    horaEntradaRecibeHm?: string | null;
    horaSalidaRecibeHm?: string | null;
    turnoEntregaContains?: string | null;
    turnoRecibeContains?: string | null;
};

export type EntregaPuestoOrderKey =
    | "empresa_id"
    | "cliente_id"
    | "division_id"
    | "contrato_id"
    | "corpo_id"
    | "puesto_id"
    | "fecha";

function parseBoundaryDate(s: string | undefined | null): Date | null {
    if (!s || String(s).trim() === "") return null;
    const t = String(s).trim();
    const d = new Date(t.includes("T") ? t : t.replace(" ", "T"));
    return Number.isNaN(d.getTime()) ? null : d;
}

function toValidIds(raw: unknown): number[] {
    if (!Array.isArray(raw)) return [];
    const out = raw.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0);
    return [...new Set(out)];
}

function trimStr(v: unknown): string | null {
    if (v == null) return null;
    const s = String(v).trim();
    return s === "" ? null : s;
}

function parseYmdBoundary(ymd: string | null | undefined, endOfDay: boolean): Date | null {
    const s = trimStr(ymd);
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const [y, m, d] = s.split("-").map(Number);
    if (!y || !m || !d) return null;
    if (endOfDay) return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
    return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
}

/** `HH:mm` → `Date` alineado con columnas `@db.Time` (misma convención que `fmtTime`). */
function parseHmBoundary(hm: string | null | undefined): Date | null {
    const s = trimStr(hm);
    if (!s || !/^\d{2}:\d{2}$/.test(s)) return null;
    const [hh, mm] = s.split(":").map((x) => parseInt(String(x), 10));
    if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
    return new Date(Date.UTC(1970, 0, 1, hh, mm, 0, 0));
}

export function normalizeEntregaPuestoFilters(raw: unknown): EntregaPuestoModuleFilters {
    const o = raw != null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const next: EntregaPuestoModuleFilters = {};
    if (o.creadoDesde != null && String(o.creadoDesde).trim() !== "") next.creadoDesde = String(o.creadoDesde);
    if (o.creadoHasta != null && String(o.creadoHasta).trim() !== "") next.creadoHasta = String(o.creadoHasta);
    const eids = toValidIds(o.empresaIds);
    const cids = toValidIds(o.clienteIds);
    const dids = toValidIds(o.divisionIds);
    const coids = toValidIds(o.contratoIds);
    const sids = toValidIds(o.corpoIds);
    const pids = toValidIds(o.puestoIds);
    if (eids.length) next.empresaIds = eids;
    if (cids.length) next.clienteIds = cids;
    if (dids.length) next.divisionIds = dids;
    if (coids.length) next.contratoIds = coids;
    if (sids.length) next.corpoIds = sids;
    if (pids.length) next.puestoIds = pids;
    const oe = trimStr(o.oficialEntregaContains ?? o.oficial_entrega);
    const or = trimStr(o.oficialRecibeContains ?? o.oficial_recibe);
    if (oe) next.oficialEntregaContains = oe;
    if (or) next.oficialRecibeContains = or;
    const fee = trimStr(o.fechaEntradaEntregaYmd ?? o.fecha_entrada_entrega);
    const fse = trimStr(o.fechaSalidaEntregaYmd ?? o.fecha_salida_entrega);
    const fer = trimStr(o.fechaEntradaRecibeYmd ?? o.fecha_recibe_entrega);
    const fsr = trimStr(o.fechaSalidaRecibeYmd ?? o.fecha_salida_recibe);
    if (fee) next.fechaEntradaEntregaYmd = fee;
    if (fse) next.fechaSalidaEntregaYmd = fse;
    if (fer) next.fechaEntradaRecibeYmd = fer;
    if (fsr) next.fechaSalidaRecibeYmd = fsr;
    const hee = trimStr(o.horaEntradaEntregaHm ?? o.hora_entrada_entrega_hm);
    const hse = trimStr(o.horaSalidaEntregaHm ?? o.hora_salida_entrega_hm);
    const her = trimStr(o.horaEntradaRecibeHm ?? o.hora_entrada_recibe_hm);
    const hsr = trimStr(o.horaSalidaRecibeHm ?? o.hora_salida_recibe_hm);
    if (hee) next.horaEntradaEntregaHm = hee;
    if (hse) next.horaSalidaEntregaHm = hse;
    if (her) next.horaEntradaRecibeHm = her;
    if (hsr) next.horaSalidaRecibeHm = hsr;
    const te = trimStr(o.turnoEntregaContains ?? o.turno_entrega);
    const tr = trimStr(o.turnoRecibeContains ?? o.turno_recibe);
    if (te) next.turnoEntregaContains = te;
    if (tr) next.turnoRecibeContains = tr;
    return next;
}

export function hasEntregaPuestoListModuleFiltersContent(f: EntregaPuestoModuleFilters): boolean {
    return !!(
        f.creadoDesde ||
        f.creadoHasta ||
        f.empresaIds?.length ||
        f.clienteIds?.length ||
        f.divisionIds?.length ||
        f.contratoIds?.length ||
        f.corpoIds?.length ||
        f.puestoIds?.length ||
        f.oficialEntregaContains ||
        f.oficialRecibeContains ||
        f.fechaEntradaEntregaYmd ||
        f.fechaSalidaEntregaYmd ||
        f.fechaEntradaRecibeYmd ||
        f.fechaSalidaRecibeYmd ||
        f.horaEntradaEntregaHm ||
        f.horaSalidaEntregaHm ||
        f.horaEntradaRecibeHm ||
        f.horaSalidaRecibeHm ||
        f.turnoEntregaContains ||
        f.turnoRecibeContains
    );
}

export function filtersMatchEntregaPuestoListQuery(parsedRowFilters: any, listModuleFilters?: EntregaPuestoModuleFilters): boolean {
    if (!listModuleFilters) return true;
    const mf = (parsedRowFilters?.moduleFilters || {}) as Record<string, unknown>;
    const saved = normalizeEntregaPuestoFilters(mf);
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
    const strEqIfSet = (want?: string | null, got?: string | null) => {
        if (!want || String(want).trim() === "") return true;
        return String(want) === String(got || "");
    };
    if (!strEqIfSet(listModuleFilters.oficialEntregaContains, saved.oficialEntregaContains)) return false;
    if (!strEqIfSet(listModuleFilters.oficialRecibeContains, saved.oficialRecibeContains)) return false;
    if (!strEqIfSet(listModuleFilters.fechaEntradaEntregaYmd, saved.fechaEntradaEntregaYmd)) return false;
    if (!strEqIfSet(listModuleFilters.fechaSalidaEntregaYmd, saved.fechaSalidaEntregaYmd)) return false;
    if (!strEqIfSet(listModuleFilters.fechaEntradaRecibeYmd, saved.fechaEntradaRecibeYmd)) return false;
    if (!strEqIfSet(listModuleFilters.fechaSalidaRecibeYmd, saved.fechaSalidaRecibeYmd)) return false;
    if (!strEqIfSet(listModuleFilters.horaEntradaEntregaHm, saved.horaEntradaEntregaHm)) return false;
    if (!strEqIfSet(listModuleFilters.horaSalidaEntregaHm, saved.horaSalidaEntregaHm)) return false;
    if (!strEqIfSet(listModuleFilters.horaEntradaRecibeHm, saved.horaEntradaRecibeHm)) return false;
    if (!strEqIfSet(listModuleFilters.horaSalidaRecibeHm, saved.horaSalidaRecibeHm)) return false;
    if (!strEqIfSet(listModuleFilters.turnoEntregaContains, saved.turnoEntregaContains)) return false;
    if (!strEqIfSet(listModuleFilters.turnoRecibeContains, saved.turnoRecibeContains)) return false;
    return true;
}

const ENTREGA_NA = "N/A";

function isEmptyEntregaValue(v: unknown): boolean {
    if (v == null) return true;
    if (typeof v === "string" && v.trim() === "") return true;
    return false;
}

function fmtDate(d: unknown): string {
    if (d == null || d === "") return "";
    if (d instanceof Date) return d.toISOString().slice(0, 10);
    const s = String(d).trim();
    if (s.includes("T")) return s.split("T")[0];
    const ymd = s.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
    return s;
}

function fmtTime(d: unknown): string {
    if (d == null || d === "") return "";
    if (d instanceof Date) {
        const hh = String(d.getUTCHours()).padStart(2, "0");
        const mm = String(d.getUTCMinutes()).padStart(2, "0");
        return `${hh}:${mm}`;
    }
    const s = String(d).trim();
    if (/^\d{2}:\d{2}/.test(s)) return s.slice(0, 5);
    if (s.includes("T")) {
        const part = s.split("T")[1]?.split(".")[0];
        if (part && part.length >= 5) return part.slice(0, 5);
    }
    return s;
}

function fmtTipoTurno(turno: unknown): string {
    const t = String(turno ?? "").trim().toUpperCase();
    if (t === "D") return "Diurno";
    if (t === "M") return "Mixto";
    if (t === "N") return "Nocturno";
    return String(turno ?? "").trim();
}

function displayEntregaText(v: unknown): string {
    return isEmptyEntregaValue(v) ? ENTREGA_NA : String(v).trim();
}

function displayEntregaDate(v: unknown): string {
    if (isEmptyEntregaValue(v)) return ENTREGA_NA;
    const formatted = fmtDate(v);
    return formatted === "" ? ENTREGA_NA : formatted;
}

function displayEntregaTime(v: unknown): string {
    if (isEmptyEntregaValue(v)) return ENTREGA_NA;
    const formatted = fmtTime(v);
    return formatted === "" ? ENTREGA_NA : formatted;
}

function displayEntregaTurno(v: unknown): string {
    if (isEmptyEntregaValue(v)) return ENTREGA_NA;
    const formatted = fmtTipoTurno(v);
    return formatted === "" ? ENTREGA_NA : formatted;
}

function displayMarcaId(v: unknown): string {
    if (v == null || v === "") return ENTREGA_NA;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? String(Math.floor(n)) : ENTREGA_NA;
}

function normalizeSignatureDataUri(raw: string | null | undefined): string | null {
    if (!raw || String(raw).trim() === "") return null;
    const s = String(raw).trim();
    if (s.startsWith("data:image/")) return s;
    return `data:image/png;base64,${s}`;
}

function normalizeBase64Payload(raw: string): string {
    let b64 = raw.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
    const mod = b64.length % 4;
    if (mod > 0) b64 = `${b64}${"=".repeat(4 - mod)}`;
    return b64;
}

function parseDataUri(dataUri: string | null): { extension: "png" | "jpeg"; base64: string } | null {
    if (!dataUri) return null;
    const m = /^data:image\/(png|jpeg|jpg);base64,([\s\S]+)$/i.exec(dataUri);
    if (m) {
        const ext = m[1].toLowerCase() === "png" ? "png" : "jpeg";
        return { extension: ext, base64: normalizeBase64Payload(m[2]) };
    }
    return { extension: "png", base64: normalizeBase64Payload(dataUri) };
}

function parseArticulos(raw: string | null | undefined): Array<Record<string, unknown>> {
    if (!raw || String(raw).trim() === "") return [];
    try {
        const p = JSON.parse(String(raw));
        return Array.isArray(p) ? p : [];
    } catch {
        return [];
    }
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

export async function queryEntregaPuestoRows(
    prisma: ReportDataAccess,
    filters: EntregaPuestoModuleFilters,
    orderKey: EntregaPuestoOrderKey,
): Promise<any[]> {
    const where: any = {};
    const desde = parseBoundaryDate(filters.creadoDesde ?? undefined);
    const hasta = parseBoundaryDate(filters.creadoHasta ?? undefined);
    if (desde || hasta) {
        where.created_at = {};
        if (desde) where.created_at.gte = desde;
        if (hasta) where.created_at.lte = hasta;
    }
    if (filters.clienteIds?.length) where.cliente_id = { in: filters.clienteIds };
    if (filters.corpoIds?.length) where.corpo_id = { in: filters.corpoIds };
    if (filters.puestoIds?.length) where.puesto_id = { in: filters.puestoIds };
    if (filters.oficialEntregaContains) {
        where.oficial_entrega = { contains: filters.oficialEntregaContains };
    }
    if (filters.oficialRecibeContains) {
        where.oficial_recibe = { contains: filters.oficialRecibeContains };
    }
    if (filters.turnoEntregaContains) {
        where.turno_entrega = { contains: filters.turnoEntregaContains };
    }
    if (filters.turnoRecibeContains) {
        where.turno_recibe = { contains: filters.turnoRecibeContains };
    }
    const d1 = parseYmdBoundary(filters.fechaEntradaEntregaYmd, false);
    const d1e = parseYmdBoundary(filters.fechaEntradaEntregaYmd, true);
    if (d1 && d1e) where.fecha_entrada_entrega = { gte: d1, lte: d1e };
    const d2 = parseYmdBoundary(filters.fechaSalidaEntregaYmd, false);
    const d2e = parseYmdBoundary(filters.fechaSalidaEntregaYmd, true);
    if (d2 && d2e) where.fecha_salida_entrega = { gte: d2, lte: d2e };
    const d3 = parseYmdBoundary(filters.fechaEntradaRecibeYmd, false);
    const d3e = parseYmdBoundary(filters.fechaEntradaRecibeYmd, true);
    if (d3 && d3e) where.fecha_entrada_recibe = { gte: d3, lte: d3e };
    const d4 = parseYmdBoundary(filters.fechaSalidaRecibeYmd, false);
    const d4e = parseYmdBoundary(filters.fechaSalidaRecibeYmd, true);
    if (d4 && d4e) where.fecha_salida_recibe = { gte: d4, lte: d4e };

    const tHee = parseHmBoundary(filters.horaEntradaEntregaHm);
    if (tHee) where.hora_entrada_entrega = tHee;
    const tHse = parseHmBoundary(filters.horaSalidaEntregaHm);
    if (tHse) where.hora_salida_entrega = tHse;
    const tHer = parseHmBoundary(filters.horaEntradaRecibeHm);
    if (tHer) where.hora_entrada_recibe = tHer;
    const tHsr = parseHmBoundary(filters.horaSalidaRecibeHm);
    if (tHsr) where.hora_salida_recibe = tHsr;

    if (filters.empresaIds?.length) {
        where.e_estructura_cliente = { empresa_id: { in: filters.empresaIds } };
    }
    const sucursalFilter: any = {};
    if (filters.contratoIds?.length) sucursalFilter.contrato_id = { in: filters.contratoIds };
    if (filters.divisionIds?.length) sucursalFilter.e_estructura_contrato = { division_id: { in: filters.divisionIds } };
    if (Object.keys(sucursalFilter).length) where.e_estructura_sucursal = sucursalFilter;

    const rows = await prisma.e_registro_entrega_puesto.findMany({
        where,
        take: 50_000,
        orderBy: { id: "desc" },
        include: {
            e_estructura_cliente: { select: { id: true, nombre: true, empresa_id: true } },
            e_estructura_sucursal: {
                select: {
                    id: true,
                    nombre: true,
                    nro_sucursal: true,
                    contrato_id: true,
                    e_estructura_contrato: {
                        select: { id: true, nombre: true, nro_contrato: true, division_id: true, n_division: { select: { id: true, nombre: true } } },
                    },
                },
            },
            e_estructura_puesto: { select: { id: true, nombre: true, codigo: true } },
        },
    });

    const enriched = rows.map((r: any) => {
        const empId = Number(r.e_estructura_cliente?.empresa_id ?? 0) || 0;
        const corpo = r.e_estructura_sucursal;
        const contrato = corpo?.e_estructura_contrato;
        const division = contrato?.n_division;
        return {
            ...r,
            empresa_id_resolved: empId,
            empresa_nombre: "",
            cliente_nombre: r.e_estructura_cliente?.nombre ?? String(r.cliente_id),
            division_nombre: division?.nombre ?? (contrato?.division_id != null ? String(contrato.division_id) : ""),
            contrato_nombre: contrato ? `${contrato.nro_contrato ? `${contrato.nro_contrato} — ` : ""}${contrato.nombre}` : "",
            corpo_nombre: corpo ? `${corpo.nro_sucursal ? `${corpo.nro_sucursal} — ` : ""}${corpo.nombre}` : String(r.corpo_id),
            puesto_nombre: r.e_estructura_puesto
                ? `${r.e_estructura_puesto.codigo ? `${r.e_estructura_puesto.codigo} — ` : ""}${r.e_estructura_puesto.nombre}`
                : String(r.puesto_id),
            fecha_sort: r.created_at,
            firma_entrega_data_uri: normalizeSignatureDataUri(r.firma_entrega),
            firma_recibe_data_uri: normalizeSignatureDataUri(r.firma_recibe),
            articulos_puesto_preview: String(r.articulos_puesto ?? "").slice(0, 400),
            oficial_entrega_display: displayEntregaText(r.oficial_entrega),
            fecha_entrada_entrega_display: displayEntregaDate(r.fecha_entrada_entrega),
            fecha_salida_entrega_display: displayEntregaDate(r.fecha_salida_entrega),
            hora_entrada_entrega_display: displayEntregaTime(r.hora_entrada_entrega),
            hora_salida_entrega_display: displayEntregaTime(r.hora_salida_entrega),
            turno_entrega_display: displayEntregaTurno(r.turno_entrega),
            marca_entrega_id_display: displayMarcaId(r.marca_entrega_id),
            marca_recibe_id_display: displayMarcaId(r.marca_recibe_id),
        };
    });

    const empresaIds = [...new Set(enriched.map((x) => x.empresa_id_resolved).filter((n: number) => Number.isFinite(n) && n > 0))];
    const empresas =
        empresaIds.length > 0
            ? await prisma.e_estructura_empresa.findMany({
                  where: { id: { in: empresaIds } },
                  select: { id: true, nombre: true, codigo: true },
              })
            : [];
    const empMap = new Map(empresas.map((e) => [e.id, e]));
    for (const r of enriched) {
        const e = empMap.get(r.empresa_id_resolved);
        r.empresa_nombre = e ? `${e.codigo ? `${e.codigo} — ` : ""}${e.nombre}` : String(r.empresa_id_resolved || "");
    }

    const cmp = (a: string, b: string) => a.localeCompare(b, "es");
    return [...enriched].sort((a: any, b: any) => {
        switch (orderKey) {
            case "empresa_id":
                return cmp(a.empresa_nombre, b.empresa_nombre);
            case "cliente_id":
                return cmp(a.cliente_nombre, b.cliente_nombre);
            case "division_id":
                return cmp(a.division_nombre, b.division_nombre);
            case "contrato_id":
                return cmp(a.contrato_nombre, b.contrato_nombre);
            case "corpo_id":
                return cmp(a.corpo_nombre, b.corpo_nombre);
            case "puesto_id":
                return cmp(a.puesto_nombre, b.puesto_nombre);
            case "fecha":
            default:
                return new Date(b.fecha_sort).getTime() - new Date(a.fecha_sort).getTime();
        }
    });
}

function applyThinBorderToRange(ws: ExcelJS.Worksheet, fromRow: number, toRow: number, fromCol: number, toCol: number) {
    const border: Partial<ExcelJS.Borders> = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
    };
    for (let r = fromRow; r <= toRow; r++) {
        for (let c = fromCol; c <= toCol; c++) {
            ws.getRow(r).getCell(c).border = border;
        }
    }
}

/** Borde exterior grueso (réplica plantilla impresa). */
function applyMediumOutsideBorder(ws: ExcelJS.Worksheet, r1: number, r2: number, c1: number, c2: number) {
    const medium: Partial<ExcelJS.Border> = { style: "medium", color: { argb: "FF000000" } };
    for (let c = c1; c <= c2; c++) {
        const topCell = ws.getCell(r1, c);
        topCell.border = { ...topCell.border, top: medium as ExcelJS.Border };
        const botCell = ws.getCell(r2, c);
        botCell.border = { ...botCell.border, bottom: medium as ExcelJS.Border };
    }
    for (let r = r1; r <= r2; r++) {
        const leftCell = ws.getCell(r, c1);
        leftCell.border = { ...leftCell.border, left: medium as ExcelJS.Border };
        const rightCell = ws.getCell(r, c2);
        rightCell.border = { ...rightCell.border, right: medium as ExcelJS.Border };
    }
}

/** Valores de fila para columnas del formulario individual (solo campos guardados en `articulos_puesto`). */
function articuloIndividualRowCells(item: Record<string, unknown>): [string, string, string, string] {
    const estado = item.estado != null && String(item.estado).trim() !== "" ? String(item.estado) : "";
    const reqRaw = item.cantidad_requerida ?? item.cantidad;
    const cantReq =
        reqRaw === null || reqRaw === undefined || (typeof reqRaw === "string" && String(reqRaw).trim() === "")
            ? ""
            : String(reqRaw);
    const crRaw = item.cantidad_real;
    const cantReal =
        crRaw === null || crRaw === undefined || (typeof crRaw === "string" && String(crRaw).trim() === "")
            ? ""
            : String(crRaw);
    const obs = item.observaciones != null ? String(item.observaciones) : "";
    return [estado, cantReq, cantReal, obs];
}

/** Columnas plantilla: Equipo, SI, NO, Cantidad, Condición. */
function articuloTemplateRowCells(item: Record<string, unknown>): [string, string, string, string, string] {
    const nombre = item.nombre != null ? String(item.nombre) : "";
    const estado = String(item.estado ?? "").trim();
    const si = estado === "Bueno" ? "X" : "";
    const no = estado === "Malo" || estado === "No está" ? "X" : "";
    const crRaw = item.cantidad_real;
    const cantidad =
        crRaw === null || crRaw === undefined || (typeof crRaw === "string" && String(crRaw).trim() === "")
            ? ""
            : String(crRaw);
    const obs = item.observaciones != null ? String(item.observaciones).trim() : "";
    const condicion = [estado, obs].filter(Boolean).join(" — ");
    return [nombre, si, no, cantidad, condicion];
}

/** Excel consolidado: principal + hoja Detalles con hipervínculos y outline por bloque. */ // Consolidado
export async function buildEntregaPuestoExcelConsolidado(rows: any[]): Promise<Buffer> { // Consolidado
    const wb = new ExcelJS.Workbook();
    const main = wb.addWorksheet("Entrega puesto");
    const details = wb.addWorksheet("Detalles");
    const borderThin: Partial<ExcelJS.Borders> = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
    };

    const mainHeaders = [
        "ID",
        "Empresa",
        "Cliente",
        "División",
        "Contrato",
        "Sucursal",
        "Puesto",
        "Creado",
        "Oficial entrega",
        "Fecha de entrada (entrega)",
        "Fecha de salida (entrega)",
        "Hora de entrada (entrega)",
        "Hora de salida (entrega)",
        "Turno entrega",
        "Marca entrega ID",
        "Oficial recibe",
        "Fecha de entrada (recibe)",
        "Fecha de salida (recibe)",
        "Hora de entrada (recibe)",
        "Hora de salida (recibe)",
        "Marca recibe ID",
        "Artículos puesto",
        "Firma entrega",
        "Firma recibe",
    ];
    const h = main.addRow(mainHeaders);
    h.font = { bold: true };
    h.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    h.eachCell((c) => {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAF7" } };
        c.border = borderThin;
    });
    main.views = [{ state: "frozen", ySplit: 1 }];
    main.columns = [
        { width: 10 },
        { width: 28 },
        { width: 26 },
        { width: 22 },
        { width: 28 },
        { width: 26 },
        { width: 26 },
        { width: 20 },
        { width: 24 },
        { width: 22 },
        { width: 22 },
        { width: 14 },
        { width: 14 },
        { width: 16 },
        { width: 14 },
        { width: 14 },
        { width: 22 },
        { width: 22 },
        { width: 14 },
        { width: 14 },
        { width: 14 },
        { width: 24 },
        { width: 18 },
        { width: 18 },
        { width: 18 },
    ];

    const detailsStartById = new Map<number, number>();
    let dRow = 1;
    const rowsDesc = [...rows].sort((a, b) => Number(b.id) - Number(a.id));

    for (const r of rowsDesc) {
        const start = dRow;
        detailsStartById.set(Number(r.id), start);
        const blockStart = dRow;

        details.getCell(dRow, 1).value = `Registro #${r.id}`;
        details.getCell(dRow, 1).font = { bold: true, size: 12 };
        details.getCell(dRow, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } };
        details.getRow(dRow).outlineLevel = 0;
        dRow++;

        details.getCell(dRow, 1).value = `${r.empresa_nombre} · ${r.cliente_nombre} · ${r.puesto_nombre}`;
        details.getRow(dRow).outlineLevel = 1;
        dRow++;

        details.getCell(dRow, 1).value = "Datos del registro";
        details.getCell(dRow, 1).font = { bold: true };
        details.getCell(dRow, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAF7" } };
        details.mergeCells(dRow, 1, dRow, 4);
        details.getRow(dRow).outlineLevel = 1;
        dRow++;

        const infoRows: [string, string, string, string][] = [
            ["Oficial entrega", displayEntregaText(r.oficial_entrega), "", ""],
            [
                "Fecha de entrada (entrega)",
                displayEntregaDate(r.fecha_entrada_entrega),
                "Hora de entrada (entrega)",
                displayEntregaTime(r.hora_entrada_entrega),
            ],
            [
                "Fecha de salida (entrega)",
                displayEntregaDate(r.fecha_salida_entrega),
                "Hora de salida (entrega)",
                displayEntregaTime(r.hora_salida_entrega),
            ],
            ["Turno entrega", displayEntregaTurno(r.turno_entrega), "Marca entrega ID", displayMarcaId(r.marca_entrega_id)],
            ["Oficial recibe", String(r.oficial_recibe ?? ""), "Marca recibe ID", displayMarcaId(r.marca_recibe_id)],
            [
                "Fecha de entrada (recibe)",
                displayEntregaDate(r.fecha_entrada_recibe),
                "Hora de entrada (recibe)",
                displayEntregaTime(r.hora_entrada_recibe),
            ],
            [
                "Fecha de salida (recibe)",
                displayEntregaDate(r.fecha_salida_recibe),
                "Hora de salida (recibe)",
                displayEntregaTime(r.hora_salida_recibe),
            ],
        ];
        for (const [label1, value1, label2, value2] of infoRows) {
            details.getCell(dRow, 1).value = label1;
            details.getCell(dRow, 1).font = { bold: true };
            details.getCell(dRow, 2).value = value1;
            if (label2) {
                details.getCell(dRow, 3).value = label2;
                details.getCell(dRow, 3).font = { bold: true };
                details.getCell(dRow, 4).value = value2;
            }
            details.getRow(dRow).eachCell((c) => {
                c.border = borderThin;
            });
            details.getRow(dRow).outlineLevel = 1;
            dRow++;
        }

        const articulos = parseArticulos(r.articulos_puesto);
        details.getCell(dRow, 1).value = "Artículos";
        details.getCell(dRow, 1).font = { bold: true };
        details.getCell(dRow, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4DCCB" } };
        dRow++;
        details.getRow(dRow).values = ["Nombre", "Tipo", "Cant. req.", "Cant. real", "Estado", "Observaciones"];
        details.getRow(dRow).font = { bold: true };
        details.getRow(dRow).eachCell((c) => {
            c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4DCCB" } };
            c.border = borderThin;
        });
        details.getRow(dRow).outlineLevel = 1;
        dRow++;
        for (const item of articulos) {
            details.getRow(dRow).values = [
                String(item.nombre ?? ""),
                String(item.tipo ?? ""),
                String(item.cantidad_requerida ?? ""),
                String(item.cantidad_real ?? ""),
                String(item.estado ?? ""),
                String(item.observaciones ?? ""),
            ];
            details.getRow(dRow).eachCell((c) => {
                c.border = borderThin;
            });
            details.getRow(dRow).outlineLevel = 1;
            dRow++;
        }

        details.getCell(dRow, 1).value = "Firma entrega";
        details.getCell(dRow, 2).value = displayEntregaText(r.oficial_entrega);
        details.getCell(dRow, 6).value = "Firma recibe";
        details.getCell(dRow, 7).value = String(r.oficial_recibe ?? "");
        details.getCell(dRow, 1).font = { bold: true };
        details.getCell(dRow, 6).font = { bold: true };
        details.getCell(dRow, 2).font = { italic: true };
        details.getCell(dRow, 7).font = { italic: true };
        details.getCell(dRow, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2F0D9" } };
        details.getCell(dRow, 6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2F0D9" } };
        details.getRow(dRow).outlineLevel = 1;
        dRow++;
        const sigEntrega = parseDataUri(normalizeSignatureDataUri(r.firma_entrega));
        const sigRecibe = parseDataUri(normalizeSignatureDataUri(r.firma_recibe));
        const imgRow = dRow;
        if (sigEntrega) {
            const imgId = wb.addImage({ base64: sigEntrega.base64, extension: sigEntrega.extension });
            details.addImage(imgId, { tl: { col: 0, row: imgRow - 1 }, ext: { width: 220, height: 100 } });
        }
        if (sigRecibe) {
            const imgId = wb.addImage({ base64: sigRecibe.base64, extension: sigRecibe.extension });
            details.addImage(imgId, { tl: { col: 5, row: imgRow - 1 }, ext: { width: 220, height: 100 } });
        }
        details.getRow(dRow).height = 85;
        details.getRow(dRow).outlineLevel = 1;
        dRow += 2;

        for (let rr = blockStart; rr < dRow; rr++) {
            details.getRow(rr).outlineLevel = Math.min(1, details.getRow(rr).outlineLevel ?? 1);
        }
    }

    details.columns = [{ width: 28 }, { width: 22 }, { width: 28 }, { width: 14 }, { width: 14 }, { width: 18 }, { width: 28 }];
    details.properties.outlineProperties = {
        summaryBelow: true,
        summaryRight: true,
    };

    for (const r of rows) {
        const anchor = detailsStartById.get(Number(r.id)) ?? 1;
        const row = main.addRow([
            r.id,
            r.empresa_nombre,
            r.cliente_nombre,
            r.division_nombre,
            r.contrato_nombre,
            r.corpo_nombre,
            r.puesto_nombre,
            r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at ?? ""),
            displayEntregaText(r.oficial_entrega),
            displayEntregaDate(r.fecha_entrada_entrega),
            displayEntregaDate(r.fecha_salida_entrega),
            displayEntregaTime(r.hora_entrada_entrega),
            displayEntregaTime(r.hora_salida_entrega),
            displayEntregaTurno(r.turno_entrega),
            displayMarcaId(r.marca_entrega_id),
            r.oficial_recibe,
            displayEntregaDate(r.fecha_entrada_recibe),
            displayEntregaDate(r.fecha_salida_recibe),
            displayEntregaTime(r.hora_entrada_recibe),
            displayEntregaTime(r.hora_salida_recibe),
            displayMarcaId(r.marca_recibe_id),
            "Ver artículos / firmas",
            "Ver artículos / firmas",
            "Ver artículos / firmas",
        ]);
        const link = `#'Detalles'!A${anchor}`;
        row.getCell(22).value = { text: "Ver artículos / firmas", hyperlink: link };
        row.getCell(23).value = { text: "Ver artículos / firmas", hyperlink: link };
        row.getCell(24).value = { text: "Ver artículos / firmas", hyperlink: link };
        [22, 23, 24].forEach((i) => {
            row.getCell(i).font = { color: { argb: "FF0563C1" }, underline: true };
        });
        row.eachCell((c) => {
            c.border = borderThin;
            c.alignment = { vertical: "middle", wrapText: true };
        });
    }

    main.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: Math.max(1, rows.length + 1), column: mainHeaders.length },
    };

    return Buffer.from(await wb.xlsx.writeBuffer());
}

function safeSheetName(clienteNombre: string, id: number): string {
    const base = String(clienteNombre || `Cliente_${id}`)
        .replace(/[:\\/?*[\]]/g, " ")
        .trim()
        .slice(0, 24);
    return `${base || "Cli"}`.slice(0, 31);
}

function colLetter(n: number): string {
    let s = "";
    let c = n;
    while (c > 0) {
        const r = (c - 1) % 26;
        s = String.fromCharCode(65 + r) + s;
        c = Math.floor((c - 1) / 26);
    }
    return s || "A";
}

function cellAddr(row: number, col: number): string {
    return `${colLetter(col)}${row}`;
}

function mergeRng(ws: ExcelJS.Worksheet, r1: number, c1: number, r2: number, c2: number) {
    const range = `${cellAddr(r1, c1)}:${cellAddr(r2, c2)}`;
    try {
        ws.mergeCells(range);
    } catch (err: any) {
        const msg = err?.message ? String(err.message) : "";
        // Si ya está combinada, ignoramos silenciosamente; cualquier otro error se relanza.
        if (!msg.includes("Cannot merge already merged cells")) {
            throw err;
        }
    }
}

/** Bloque izquierdo A–E; bloque derecho G–K; F separador (plantilla impresa). */
const ENTREGA_FORM_LEFT_C0 = 1;
const ENTREGA_FORM_RIGHT_C0 = 7;
const ENTREGA_FORM_BLOCK_COLS = 5;

/**
 * Formulario SEG-F-023 réplica de plantilla: encabezado global A–K (solo primera hoja, fila 1),
 * cada registro en columnas A–E o G–K (5 columnas).
 */
async function drawEntregaForm(
    wb: ExcelJS.Workbook,
    ws: ExcelJS.Worksheet,
    r: any,
    startRow: number,
    c0: number,
): Promise<number> {
    let row = startRow;
    const cEnd = c0 + ENTREGA_FORM_BLOCK_COLS - 1;

    if (c0 === ENTREGA_FORM_LEFT_C0 && startRow === 1) {
        const headerRow = row;
        const colA = 1;
        const colTitleStart = 2;
        const colTitleEnd = 9;
        const colMetaStart = 10;
        const colMetaEnd = 11;

        ws.getRow(headerRow).height = 52;

        const widths = [20, 16, 16, 11, 20, 2.8, 20, 16, 16, 11, 20];
        widths.forEach((w, i) => {
            ws.getColumn(i + 1).width = w;
        });

        const titleFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF1F2A3A" } };
        for (let c = colTitleStart; c <= colTitleEnd; c++) {
            ws.getCell(headerRow, c).fill = titleFill;
        }

        mergeRng(ws, headerRow, colTitleStart, headerRow, colTitleEnd);
        const titleCell = ws.getCell(headerRow, colTitleStart);
        titleCell.value = "CONTROL DE ENTREGA DE PUESTO";
        titleCell.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
        titleCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };

        ws.getCell(headerRow, colA).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };

        mergeRng(ws, headerRow, colMetaStart, headerRow, colMetaEnd);
        const metaCell = ws.getCell(headerRow, colMetaStart);
        metaCell.value = "SEG-F-023, V1, 30/10/2015\nGerente de Operaciones en Seguridad";
        metaCell.font = { size: 9, color: { argb: "FF000000" } };
        metaCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        metaCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
        applyMediumOutsideBorder(ws, headerRow, headerRow, 1, 11);

        const logoPx = 44;
        const logoPath = await resolveLogoPathByEmpresaId(Number(r.empresa_id_resolved));
        if (logoPath) {
            const imgId = wb.addImage({ filename: logoPath, extension: "png" });
            ws.addImage(imgId, {
                tl: { col: colA - 1 + 0.28, row: headerRow - 1 + 0.28 },
                ext: { width: logoPx, height: logoPx },
                editAs: "oneCell",
            });
        }

        ws.getCell(headerRow, colA).alignment = { horizontal: "center", vertical: "middle" };

        const spacerRow = headerRow + 1;
        mergeRng(ws, spacerRow, 1, spacerRow, 11);
        for (let cc = 1; cc <= 11; cc++) {
            const cell = ws.getCell(spacerRow, cc);
            cell.value = null;
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
        }
        ws.getRow(spacerRow).height = 8;

        row = headerRow + 2;
    } else if (c0 === ENTREGA_FORM_RIGHT_C0 && startRow === 1) {
        // Alinear el bloque derecho de la primera fila con el izquierdo (mismo offset del encabezado global).
        row = startRow + 2;
    }

    const formFirstRow = row + 1;

    mergeRng(ws, row, c0, row, cEnd);
    const subTitle = ws.getCell(row, c0);
    subTitle.value = "Control de Entrega de Puesto";
    subTitle.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    subTitle.font = { bold: true, size: 10 };
    row++;

    mergeRng(ws, row, c0, row, cEnd);
    ws.getCell(row, c0).value = "";
    row++;

    const datosTopRow = row;

    const leftTop = datosTopRow;
    mergeRng(ws, leftTop, c0, leftTop, c0 + 1);
    ws.getCell(leftTop, c0).value = `Corpo: ${r.corpo_nombre ?? ""}`;
    ws.getCell(leftTop, c0).alignment = { horizontal: "left", vertical: "middle", wrapText: true };

    mergeRng(ws, leftTop + 1, c0, leftTop + 1, c0 + 1);
    ws.getCell(leftTop + 1, c0).value = `Fecha entrada: ${displayEntregaDate(r.fecha_entrada_entrega)}`;
    ws.getCell(leftTop + 1, c0).alignment = { horizontal: "left", vertical: "middle", wrapText: true };

    mergeRng(ws, leftTop + 2, c0, leftTop + 2, c0 + 1);
    ws.getCell(leftTop + 2, c0).value = `Hora entrada: ${displayEntregaTime(r.hora_entrada_entrega)}`;
    ws.getCell(leftTop + 2, c0).alignment = { horizontal: "left", vertical: "middle", wrapText: true };

    mergeRng(ws, leftTop + 3, c0, leftTop + 3, c0 + 1);
    ws.getCell(leftTop + 3, c0).value = `Turno: ${displayEntregaTurno(r.turno_entrega)}`;
    ws.getCell(leftTop + 3, c0).alignment = { horizontal: "left", vertical: "middle", wrapText: true };

    const rightTop = datosTopRow;
    // Dejar la primera fila de la cuadrícula derecha vacía; los datos inician una fila más abajo.
    mergeRng(ws, rightTop + 1, c0 + 2, rightTop + 1, c0 + 4);
    ws.getCell(rightTop + 1, c0 + 2).value = `Fecha de salida: ${displayEntregaDate(r.fecha_salida_entrega)}`;
    ws.getCell(rightTop + 1, c0 + 2).alignment = { horizontal: "left", vertical: "middle", wrapText: true };

    mergeRng(ws, rightTop + 2, c0 + 2, rightTop + 2, c0 + 4);
    ws.getCell(rightTop + 2, c0 + 2).value = `Hora de salida: ${displayEntregaTime(r.hora_salida_entrega)}`;
    ws.getCell(rightTop + 2, c0 + 2).alignment = { horizontal: "left", vertical: "middle", wrapText: true };

    mergeRng(ws, rightTop + 3, c0 + 2, rightTop + 3, c0 + 4);
    ws.getCell(rightTop + 3, c0 + 2).value = `Cliente: ${String(r.cliente_nombre ?? "")}`;
    ws.getCell(rightTop + 3, c0 + 2).alignment = { horizontal: "left", vertical: "middle", wrapText: true };

    const datosBottomRow = datosTopRow + 3;
    for (let rr = datosTopRow; rr <= datosBottomRow; rr++) {
        for (let cc = c0; cc <= c0 + 4; cc++) {
            ws.getCell(rr, cc).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
        }
    }
    applyMediumOutsideBorder(ws, datosTopRow, datosBottomRow, c0, c0 + 1);
    applyMediumOutsideBorder(ws, datosTopRow, datosBottomRow, c0 + 2, c0 + 4);

    row = datosBottomRow + 1;

    mergeRng(ws, row, c0, row, c0 + 2);
    ws.getCell(row, c0).value = `Día: ${displayEntregaDate(r.fecha_entrada_entrega)}`;
    ws.getCell(row, c0).alignment = { horizontal: "left", vertical: "middle", wrapText: true };
    mergeRng(ws, row, c0 + 3, row, c0 + 4);
    ws.getCell(row, c0 + 3).value = `Turno: ${displayEntregaTurno(r.turno_entrega)}`;
    ws.getCell(row, c0 + 3).alignment = { horizontal: "left", vertical: "middle", wrapText: true };
    applyMediumOutsideBorder(ws, row, row, c0, c0 + 2);
    applyMediumOutsideBorder(ws, row, row, c0 + 3, c0 + 4);
    row++;

    const hdrLabels = ["Nombre", "Cantidad requerida", "Cantidad real", "Estado", "Observaciones"];
    for (let i = 0; i < hdrLabels.length; i++) {
        const cell = ws.getCell(row, c0 + i);
        cell.value = hdrLabels[i];
        cell.font = { bold: true, size: 9 };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    }
    applyThinBorderToRange(ws, row, row, c0, cEnd);
    row++;

    const arts = parseArticulos(r.articulos_puesto);
    const minDataRows = 21;
    const dataCount = Math.max(arts.length, minDataRows);
    for (let i = 0; i < dataCount; i++) {
        const raw = arts[i];
        if (raw && typeof raw === "object") {
            const item = raw as Record<string, unknown>;
            const [estado, cantReq, cantReal, obs] = articuloIndividualRowCells(item);
            ws.getCell(row, c0).value = String(item.nombre ?? "");
            ws.getCell(row, c0 + 1).value = cantReq;
            ws.getCell(row, c0 + 2).value = cantReal;
            ws.getCell(row, c0 + 3).value = estado;
            ws.getCell(row, c0 + 4).value = obs;
        }
        ws.getCell(row, c0).alignment = { horizontal: "left", vertical: "top", wrapText: true };
        ws.getCell(row, c0 + 1).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        ws.getCell(row, c0 + 2).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        ws.getCell(row, c0 + 3).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        ws.getCell(row, c0 + 4).alignment = { horizontal: "left", vertical: "top", wrapText: true };
        applyThinBorderToRange(ws, row, row, c0, cEnd);
        row++;
    }

    for (let k = 0; k < 2; k++) {
        applyThinBorderToRange(ws, row, row, c0, cEnd);
        row++;
    }

    mergeRng(ws, row, c0, row, cEnd);
    ws.getCell(row, c0).value = `Oficial q/entrega: ${displayEntregaText(r.oficial_entrega)}`;
    ws.getCell(row, c0).alignment = { vertical: "middle", wrapText: true };
    applyThinBorderToRange(ws, row, row, c0, cEnd);
    row++;

    mergeRng(ws, row, c0, row, cEnd);
    ws.getCell(row, c0).value = `Oficial q/recibe: ${r.oficial_recibe ?? ""}`;
    ws.getCell(row, c0).alignment = { vertical: "middle", wrapText: true };
    applyThinBorderToRange(ws, row, row, c0, cEnd);
    row++;

    mergeRng(ws, row, c0, row, cEnd);
    ws.getCell(row, c0).value = `Observaciones:\n${String(r.observaciones ?? "")}`;
    ws.getCell(row, c0).alignment = { vertical: "top", wrapText: true };
    ws.getRow(row).height = 48;
    applyThinBorderToRange(ws, row, row, c0, cEnd);
    row++;

    const formLastRow = row - 1;
    applyMediumOutsideBorder(ws, formFirstRow, formLastRow, c0, cEnd);

    return row;
}

/**
 * Una hoja por cliente; dos formularios por fila: A–E y G–K; columna F separador.
 */
export async function buildEntregaPuestoExcelIndividual(rows: any[], reportName?: string): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const byCliente = new Map<number, any[]>();
    for (const r of rows) {
        const cid = Number(r.cliente_id);
        if (!byCliente.has(cid)) byCliente.set(cid, []);
        byCliente.get(cid)!.push(r);
    }

    for (const [clienteId, list] of byCliente) {
        const name0 = list[0]?.cliente_nombre || `Cliente ${clienteId}`;
        const ws = wb.addWorksheet(safeSheetName(name0, clienteId));
        ws.columns = Array.from({ length: 11 }, (_, i) => ({
            width: [20, 8, 20, 11, 20, 2.8, 20, 20, 20, 11, 20][i] ?? 9,
        }));
        let rowPtr = 1;
        for (let i = 0; i < list.length; i += 2) {
            const left = list[i];
            const right = list[i + 1];
            const base = rowPtr;
            let end = base;
            if (left) end = Math.max(end, await drawEntregaForm(wb, ws, left, base, ENTREGA_FORM_LEFT_C0));
            if (right) end = Math.max(end, await drawEntregaForm(wb, ws, right, base, ENTREGA_FORM_RIGHT_C0));
            // Columna F como separador blanco desde la fila siguiente al header.
            const fStartRow = Math.max(base, 2);
            for (let rr = fStartRow; rr <= end; rr++) {
                const fCell = ws.getCell(rr, 6);
                fCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
                fCell.border = {};
            }
            rowPtr = end + 2;
        }
        void reportName;
    }

    if (wb.worksheets.length === 0) {
        const ws = wb.addWorksheet("Vacío");
        ws.getCell(1, 1).value = "Sin registros para exportar.";
    }

    return Buffer.from(await wb.xlsx.writeBuffer());
}
