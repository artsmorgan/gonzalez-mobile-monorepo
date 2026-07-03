/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ReportDataAccess } from "../reportDynamicPrisma";
import ExcelJS from "exceljs";
import { normalizeActaEntregaFilters, type ActaEntregaModuleFilters } from "./actaEntregaProductos";

export type BitacoraNovedadesModuleFilters = ActaEntregaModuleFilters & {
    categoriaId?: number | null;
    relevancia?: string | null;
};

export type BitacoraNovedadesOrderKey =
    | "titulo"
    | "empresa_id"
    | "cliente_id"
    | "division_id"
    | "contrato_id"
    | "corpo_id"
    | "puesto_id"
    | "updated_at";

function parseBoundaryDate(s: string | undefined | null): Date | null {
    if (!s || String(s).trim() === "") return null;
    const t = String(s).trim();
    const d = new Date(t.includes("T") ? t : t.replace(" ", "T"));
    return Number.isNaN(d.getTime()) ? null : d;
}

function excelCellString(v: unknown, max = 32767): string {
    const s = String(v ?? "");
    return s.length > max ? s.slice(0, max) : s;
}

function fmtDate(v: unknown): string {
    const d = v instanceof Date ? v : new Date(String(v ?? ""));
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
}

function fmtDateTime(v: unknown): string {
    const d = v instanceof Date ? v : new Date(String(v ?? ""));
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().replace("T", " ").slice(0, 19);
}

function parseIds(v: unknown): number[] {
    if (!Array.isArray(v)) return [];
    return [...new Set(v.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0))];
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

export function normalizeBitacoraNovedadesFilters(raw: unknown): BitacoraNovedadesModuleFilters {
    const base = normalizeActaEntregaFilters(raw);
    const o = raw != null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    let categoriaId: number | null | undefined;
    if (o.categoriaId != null && String(o.categoriaId).trim() !== "") {
        const n = Number(o.categoriaId);
        if (Number.isFinite(n) && n > 0) categoriaId = n;
    }
    const rel = String(o.relevancia ?? "").trim();
    const relevancia =
        rel === "Alta" || rel === "Media" || rel === "Baja" ? rel : null;
    return {
        ...base,
        categoriaId: categoriaId ?? null,
        relevancia,
    };
}

export function hasBitacoraNovedadesListModuleFiltersContent(f: BitacoraNovedadesModuleFilters): boolean {
    if (f.creadoDesde || f.creadoHasta) return true;
    if (f.empresaIds?.length || f.clienteIds?.length || f.divisionIds?.length) return true;
    if (f.contratoIds?.length || f.corpoIds?.length || f.puestoIds?.length) return true;
    if (f.categoriaId != null && f.categoriaId > 0) return true;
    if (f.relevancia) return true;
    return false;
}

export function filtersMatchBitacoraNovedadesListQuery(parsedRowFilters: any, listModuleFilters?: BitacoraNovedadesModuleFilters): boolean {
    if (!listModuleFilters) return true;
    const saved = normalizeBitacoraNovedadesFilters((parsedRowFilters?.moduleFilters || {}) as any);
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
    if (listModuleFilters.categoriaId && Number(saved.categoriaId || 0) !== Number(listModuleFilters.categoriaId)) return false;
    if (listModuleFilters.relevancia && String(saved.relevancia || "") !== String(listModuleFilters.relevancia)) return false;
    return true;
}

export async function queryBitacoraNovedadesRows(prisma: ReportDataAccess, filters: BitacoraNovedadesModuleFilters, orderKey: BitacoraNovedadesOrderKey) {
    const where: any = { isActive: true };
    const desde = parseBoundaryDate(filters.creadoDesde ?? undefined);
    const hasta = parseBoundaryDate(filters.creadoHasta ?? undefined);
    if (desde || hasta) {
        where.created_at = {};
        if (desde) where.created_at.gte = desde;
        if (hasta) where.created_at.lte = hasta;
    }
    if (filters.empresaIds?.length) where.empresa_id = { in: filters.empresaIds };
    if (filters.clienteIds?.length) where.cliente_id = { in: filters.clienteIds };
    if (filters.divisionIds?.length) where.division_id = { in: filters.divisionIds };
    if (filters.contratoIds?.length) where.contrato_id = { in: filters.contratoIds };
    if (filters.corpoIds?.length) where.corpo_id = { in: filters.corpoIds };
    if (filters.puestoIds?.length) where.puesto_id = { in: filters.puestoIds };
    if (filters.categoriaId != null && filters.categoriaId > 0) where.categoria_id = filters.categoriaId;
    if (filters.relevancia) where.relevancia = filters.relevancia;

    const rows = await prisma.c_puesto_notas.findMany({
        where,
        orderBy: { id: "desc" },
        take: 50_000,
    });

    const empresaIds = parseIds(rows.map((x) => x.empresa_id));
    const clienteIds = parseIds(rows.map((x) => x.cliente_id));
    const divisionIds = parseIds(rows.map((x) => x.division_id));
    const contratoIds = parseIds(rows.map((x) => x.contrato_id));
    const corpoIds = parseIds(rows.map((x) => x.corpo_id));
    const puestoIds = parseIds(rows.map((x) => x.puesto_id));
    const catIds = parseIds(rows.map((x) => x.categoria_id));

    const [empresas, clientes, divisiones, contratos, corpos, puestos, categorias] = await Promise.all([
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
        catIds.length ? prisma.n_novedades_categoria.findMany({ where: { id: { in: catIds } }, select: { id: true, nombre: true } }) : [],
    ]);

    const empresaById = new Map(empresas.map((x) => [x.id, x]));
    const clienteById = new Map(clientes.map((x) => [x.id, x]));
    const divisionById = new Map(divisiones.map((x) => [x.id, x]));
    const contratoById = new Map(contratos.map((x) => [x.id, x]));
    const corpoById = new Map(corpos.map((x) => [x.id, x]));
    const puestoById = new Map(puestos.map((x) => [x.id, x]));
    const catById = new Map(categorias.map((x) => [x.id, x]));

    const enriched = rows.map((r) => {
        const empresa = empresaById.get(Number(r.empresa_id));
        const cliente = clienteById.get(Number(r.cliente_id));
        const division = divisionById.get(Number(r.division_id));
        const contrato = contratoById.get(Number(r.contrato_id));
        const corpo = corpoById.get(Number(r.corpo_id));
        const puesto = puestoById.get(Number(r.puesto_id));
        const cat = r.categoria_id != null ? catById.get(Number(r.categoria_id)) : undefined;
        return {
            ...r,
            empresa_nombre: empresa ? `${empresa.codigo ? `${empresa.codigo} - ` : ""}${empresa.nombre}` : String(r.empresa_id),
            cliente_nombre: cliente?.nombre ?? String(r.cliente_id),
            division_nombre: division?.nombre ?? String(r.division_id),
            contrato_nombre: contrato ? `${contrato.nro_contrato ? `${contrato.nro_contrato} - ` : ""}${contrato.nombre}` : String(r.contrato_id),
            corpo_nombre: corpo ? `${corpo.nro_sucursal ? `${corpo.nro_sucursal} - ` : ""}${corpo.nombre}` : String(r.corpo_id),
            puesto_nombre: puesto ? `${puesto.codigo ? `${puesto.codigo} - ` : ""}${puesto.nombre}` : String(r.puesto_id),
            categoria_nombre: cat?.nombre ?? (r.categoria_id != null ? String(r.categoria_id) : ""),
        };
    });

    return sortRowsForExcelOrder(enriched, orderKey);
}

function sortRowsForExcelOrder(rows: any[], orderKey: BitacoraNovedadesOrderKey): any[] {
    const copy = [...rows];
    copy.sort((a, b) => {
        if (orderKey === "updated_at") {
            return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        }
        if (orderKey === "titulo") {
            return String(a.titulo ?? "").localeCompare(String(b.titulo ?? ""), undefined, { sensitivity: "base" });
        }
        const av = a[orderKey];
        const bv = b[orderKey];
        if (typeof av === "number" && typeof bv === "number") return av - bv;
        return String(av ?? "").localeCompare(String(bv ?? ""));
    });
    return copy;
}

export async function buildBitacoraNovedadesExcelConsolidado(rows: any[]): Promise<Buffer> { // Consolidado
    const wb = new ExcelJS.Workbook();
    const wsMain = wb.addWorksheet("Bitácora de novedades");
    const border: Partial<ExcelJS.Borders> = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
    const hdrFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3D63" } } as const;

    const headers = [
        "ID",
        "Título",
        "Descripción",
        "Empresa",
        "Cliente",
        "División",
        "Contrato",
        "Sucursal",
        "Puesto",
        "Categoría",
        "Relevancia",
        "Creado",
        "Actualizado",
        "Firma manual cliente",
        "Firma responsable (texto)",
    ];
    const hr = wsMain.addRow(headers);
    hr.font = { bold: true, color: { argb: "FFFFFFFF" } };
    hr.eachCell((cell) => {
        cell.fill = hdrFill;
        cell.border = border;
        cell.alignment = { vertical: "middle", wrapText: true };
    });
    wsMain.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };

    const wsFirma = wb.addWorksheet("Firmas");
    const fh = wsFirma.addRow(["Nota ID", "Contenido firma manual cliente"]);
    fh.font = { bold: true, color: { argb: "FFFFFFFF" } };
    fh.eachCell((cell) => {
        cell.fill = hdrFill;
        cell.border = border;
        cell.alignment = { vertical: "middle", wrapText: true };
    });

    const byIdDesc = [...rows].sort((a, b) => Number(b.id) - Number(a.id));
    const anchorByNotaId = new Map<number, number>();
    let fr = 2;
    for (const r of byIdDesc) {
        anchorByNotaId.set(Number(r.id), fr);
        const sig = parseSignatureDataForExcel(r.firma_manual_responsable);
        const row = wsFirma.addRow([String(r.id), sig ? "" : excelCellString(r.firma_manual_responsable ?? "")]);
        row.eachCell((cell) => {
            cell.border = border;
            cell.alignment = { vertical: "top", wrapText: true };
        });
        row.height = sig ? 72 : Math.min(120, Math.max(28, String(r.firma_manual_responsable ?? "").split("\n").length * 14));
        if (sig) {
            try {
                const imgId = wb.addImage({ base64: sig.base64, extension: sig.extension });
                wsFirma.addImage(imgId, { tl: { col: 1 + 0.05, row: fr - 1 + 0.05 }, ext: { width: 220, height: 80 }, editAs: "oneCell" });
            } catch {
                wsFirma.getCell(fr, 2).value = excelCellString(r.firma_manual_responsable ?? "");
            }
        }
        fr += 1;
    }
    wsFirma.columns = [12, 56].map((w) => ({ width: w }));

    const firmaColIdx = 14;
    for (const r of rows) {
        const descShort = excelCellString(r.description ?? "").length > 800 ? `${excelCellString(r.description ?? "").slice(0, 800)}…` : excelCellString(r.description ?? "");
        const firmaRespShort =
            excelCellString(r.firma_responsable ?? "").length > 500
                ? `${excelCellString(r.firma_responsable ?? "").slice(0, 500)}…`
                : excelCellString(r.firma_responsable ?? "");

        const row = wsMain.addRow([
            String(r.id),
            excelCellString(r.titulo),
            descShort,
            excelCellString(r.empresa_nombre),
            excelCellString(r.cliente_nombre),
            excelCellString(r.division_nombre),
            excelCellString(r.contrato_nombre),
            excelCellString(r.corpo_nombre),
            excelCellString(r.puesto_nombre),
            excelCellString(r.categoria_nombre),
            excelCellString(r.relevancia ?? ""),
            fmtDateTime(r.created_at),
            fmtDateTime(r.updated_at),
            r.firma_manual_responsable ? "Ver firma manual" : "",
            firmaRespShort,
        ]);
        row.eachCell((cell) => {
            cell.border = border;
            cell.alignment = { vertical: "top", wrapText: true };
        });
        const anchor = anchorByNotaId.get(Number(r.id));
        if (anchor && r.firma_manual_responsable) {
            const c = wsMain.getCell(row.number, firmaColIdx);
            c.value = { text: "Ver firma manual", hyperlink: `#'Firmas'!A${anchor}` };
            c.font = { color: { argb: "FF0563C1" }, underline: true };
        }
    }

    wsMain.columns = [8, 28, 42, 22, 22, 18, 22, 22, 22, 18, 12, 18, 18, 18, 36].map((w) => ({ width: w }));
    return Buffer.from(await wb.xlsx.writeBuffer());
}
