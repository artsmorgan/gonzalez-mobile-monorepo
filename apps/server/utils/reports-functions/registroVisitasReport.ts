/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Prisma } from "@prisma/client";
import type { ReportDataAccess } from "../reportDynamicPrisma";
import ExcelJS from "exceljs";
import archiver from "archiver";
import fs from "fs/promises";
import path from "path";
import { normalizeActaEntregaFilters, type ActaEntregaModuleFilters } from "./actaEntregaProductos";
import { fitImageExtInsideBox, getImageDimensionsFromBuffer } from "./imageDimensions";

export type RegistroVisitasModuleFilters = ActaEntregaModuleFilters & {
    /** Filtro por `responsable_id` (empleado responsable en `e_registro_personas`). */
    responsableIds?: number[] | null;
    cedulaVisitante?: string | null;
    /** todos | normal (no funcionario) | funcionario */
    tipoVisitante?: "todos" | "normal" | "funcionario" | null;
};

export type RegistroVisitasOrderKey =
    | "empresa_id"
    | "cliente_id"
    | "division_id"
    | "contrato_id"
    | "corpo_id"
    | "puesto_id"
    | "created_at"
    | "nombre";

function toValidIds(raw: unknown): number[] {
    if (!Array.isArray(raw)) return [];
    const out = raw.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0);
    return [...new Set(out)];
}

export function normalizeRegistroVisitasFilters(raw: unknown): RegistroVisitasModuleFilters {
    const base = normalizeActaEntregaFilters(raw);
    const o = raw != null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const rids = toValidIds(o.responsableIds);
    const ced = o.cedulaVisitante != null ? String(o.cedulaVisitante).trim() : "";
    const tv = String(o.tipoVisitante || "todos").trim().toLowerCase();
    const tipoVisitante =
        tv === "normal" || tv === "funcionario" ? (tv as "normal" | "funcionario") : ("todos" as const);
    const next: RegistroVisitasModuleFilters = { ...base };
    if (rids.length) next.responsableIds = rids;
    if (ced) next.cedulaVisitante = ced;
    if (tipoVisitante !== "todos") next.tipoVisitante = tipoVisitante;
    return next;
}

export function hasRegistroVisitasListModuleFiltersContent(f: RegistroVisitasModuleFilters): boolean {
    if (f.creadoDesde || f.creadoHasta) return true;
    if (f.empresaIds?.length || f.clienteIds?.length || f.divisionIds?.length) return true;
    if (f.contratoIds?.length || f.corpoIds?.length || f.puestoIds?.length) return true;
    if (f.responsableIds?.length) return true;
    if (f.cedulaVisitante && String(f.cedulaVisitante).trim() !== "") return true;
    if (f.tipoVisitante && f.tipoVisitante !== "todos") return true;
    return false;
}

export function filtersMatchRegistroVisitasListQuery(parsedRowFilters: any, listModuleFilters?: RegistroVisitasModuleFilters): boolean {
    if (!listModuleFilters) return true;
    const saved = normalizeRegistroVisitasFilters((parsedRowFilters?.moduleFilters || {}) as any);
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
    if (!overlaps(listModuleFilters.responsableIds ?? undefined, saved.responsableIds ?? undefined)) return false;
    if (listModuleFilters.cedulaVisitante && String(saved.cedulaVisitante || "") !== String(listModuleFilters.cedulaVisitante)) return false;
    if (listModuleFilters.tipoVisitante && listModuleFilters.tipoVisitante !== "todos") {
        if (String(saved.tipoVisitante || "todos") !== String(listModuleFilters.tipoVisitante)) return false;
    }
    return true;
}

/** Interpreta `YYYY-MM-DD HH:mm:ss` como fecha/hora local (sin UTC). */
export function parseNaiveDateTime(s: string | undefined | null): Date | null {
    if (!s || String(s).trim() === "") return null;
    const t = String(s).trim();
    const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(t);
    if (m) {
        const sec = m[6] != null ? Number(m[6]) : 0;
        return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), sec, 0);
    }
    const d = new Date(t.includes("T") ? t : t.replace(" ", "T"));
    return Number.isNaN(d.getTime()) ? null : d;
}

/** Normaliza fechas desde Prisma directo, JSON (`callDynamicPrisma`) u otros formatos. */
function toDateValue(v: unknown): Date | null {
    if (v == null || v === "") return null;
    if (typeof v === "number" && Number.isFinite(v)) {
        const d = new Date(v);
        return Number.isNaN(d.getTime()) ? null : d;
    }
    if (typeof v === "string") {
        const naive = parseNaiveDateTime(v);
        if (naive) return naive;
        const t = v.trim();
        if (!t) return null;
        const d = new Date(t.includes("T") ? t : t.replace(" ", "T"));
        return Number.isNaN(d.getTime()) ? null : d;
    }
    if (typeof v === "object") {
        const obj = v as { getTime?: () => unknown; toISOString?: () => string };
        if (typeof obj.getTime === "function") {
            try {
                const t = obj.getTime();
                if (typeof t === "number" && !Number.isNaN(t)) {
                    const d = v instanceof Date ? v : new Date(t);
                    return Number.isNaN(d.getTime()) ? null : d;
                }
            } catch {
                return null;
            }
        }
        if (typeof obj.toISOString === "function") {
            try {
                const d = new Date(obj.toISOString());
                return Number.isNaN(d.getTime()) ? null : d;
            } catch {
                return null;
            }
        }
    }
    return null;
}

function formatDt(v: unknown): string {
    const d = toDateValue(v);
    if (!d) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Parte horaria `HH:mm:ss` desde el mismo origen que `formatDt`. */
function formatTimePartFromDt(v: unknown): string {
    const s = formatDt(v);
    if (!s) return "";
    const parts = s.split(" ");
    return parts.length >= 2 ? parts[1] : "";
}

function excelWorksheetNameForPuesto(puestoNombre: string | null | undefined, puestoId: number): string {
    let base = excelCellString(puestoNombre).trim().replace(/[\\/?*[\]:'"]/g, "_");
    if (!base) base = `Puesto`;
    const suf = `_${puestoId}`;
    const maxBase = Math.max(1, 31 - suf.length);
    if (base.length > maxBase) base = base.slice(0, maxBase);
    return `${base}${suf}`.slice(0, 31);
}

/** Ruta absoluta a `public/uploads/visitors/{id}/cedula/{foto}` (solo nombre de archivo, sin path traversal). */
function resolveCedulaFotoFilePath(registroId: number, fotoCedula: string | null | undefined): string | null {
    const base = path.basename(String(fotoCedula ?? "").trim());
    if (!base || base === "." || base === "..") return null;
    if (!Number.isFinite(registroId) || registroId <= 0) return null;
    return path.join(process.cwd(), "public", "uploads", "visitors", String(registroId), "cedula", base);
}

function excelImageExtForCedulaFileName(fileName: string): "png" | "jpeg" | "gif" {
    const lower = fileName.toLowerCase();
    if (lower.endsWith(".png")) return "png";
    if (lower.endsWith(".gif")) return "gif";
    return "jpeg";
}

/** Firma guardada como `data:image/...;base64,...` en `e_registro_personas.firma_visitante`. */
function trySignatureImageFromField(raw: string | null | undefined): { buffer: Buffer; extension: "png" | "jpeg" | "gif" } | null {
    const s = String(raw ?? "").trim();
    if (!s) return null;
    const m = /^data:(image\/(png|jpeg|jpg|gif));base64,([\s\S]+)$/i.exec(s);
    if (!m) return null;
    const kind = m[1].toLowerCase();
    const b64 = m[3].replace(/\s/g, "");
    try {
        const buffer = Buffer.from(b64, "base64");
        if (!buffer.length) return null;
        let extension: "png" | "jpeg" | "gif" = "png";
        if (kind.includes("jpeg") || kind.includes("jpg")) extension = "jpeg";
        else if (kind.includes("gif")) extension = "gif";
        return { buffer, extension };
    } catch {
        return null;
    }
}

function excelCellString(v: unknown): string {
    if (v === null || v === undefined) return "";
    return String(v);
}

/** Lista de `{ detalle, descripcion }` desde JSON o array; una línea por ítem `detalle: descripcion`. */
function formatActivosDetallesForExcelCell(detalles: unknown): string {
    if (detalles == null) return "";
    let arr: any[] = [];
    if (Array.isArray(detalles)) {
        arr = detalles;
    } else if (typeof detalles === "string") {
        const s = detalles.trim();
        if (!s) return "";
        try {
            const p = JSON.parse(s);
            arr = Array.isArray(p) ? p : [];
        } catch {
            return s;
        }
    } else {
        return String(detalles);
    }
    const lines = arr
        .map((d) => {
            const det = d?.detalle != null ? String(d.detalle).trim() : "";
            const desc = d?.descripcion != null ? String(d.descripcion).trim() : "";
            if (!det && !desc) return "";
            if (det && desc) return `${det}: ${desc}`;
            return det || desc;
        })
        .filter(Boolean);
    return lines.join("\n");
}

function orderByClause(key: RegistroVisitasOrderKey): Prisma.e_registro_personasOrderByWithRelationInput {
    switch (key) {
        case "cliente_id":
            return { cliente_id: "asc" };
        case "division_id":
            return { division_id: "asc" };
        case "contrato_id":
            return { contrato_id: "asc" };
        case "corpo_id":
            return { corpo_id: "asc" };
        case "puesto_id":
            return { puesto_id: "asc" };
        case "created_at":
            return { created_at: "asc" };
        case "nombre":
            return { nombre: "asc" };
        case "empresa_id":
        default:
            return { empresa_id: "asc" };
    }
}

async function enrichRows(prisma: ReportDataAccess, raw: any[]): Promise<any[]> {
    const empIds = [...new Set(raw.map((r) => Number(r.empresa_id)).filter((n) => n > 0))];
    const divIds = [...new Set(raw.map((r) => Number(r.division_id)).filter((n) => n > 0))];
    const conIds = [...new Set(raw.map((r) => Number(r.contrato_id)).filter((n) => n > 0))];
    const [emps, divs, cons] = await Promise.all([
        empIds.length
            ? prisma.e_estructura_empresa.findMany({ where: { id: { in: empIds } }, select: { id: true, nombre: true } })
            : [],
        divIds.length ? prisma.n_division.findMany({ where: { id: { in: divIds } }, select: { id: true, nombre: true } }) : [],
        conIds.length
            ? prisma.e_estructura_contrato.findMany({ where: { id: { in: conIds } }, select: { id: true, nombre: true } })
            : [],
    ]);
    const empMap = new Map(emps.map((e) => [e.id, e.nombre]));
    const divMap = new Map(divs.map((e) => [e.id, e.nombre]));
    const conMap = new Map(cons.map((e) => [e.id, e.nombre]));
    return raw.map((r) => ({
        ...r,
        empresa_nombre: empMap.get(r.empresa_id) ?? "",
        division_nombre: divMap.get(r.division_id) ?? "",
        contrato_nombre: conMap.get(r.contrato_id) ?? "",
        responsable_label: r.c_empleado
            ? [r.c_empleado.nombre, r.c_empleado.primer_apellido, r.c_empleado.segundo_apellido].filter(Boolean).join(" ").trim() ||
              r.c_empleado.codigo
            : "",
    }));
}

export async function queryRegistroVisitasRows(
    prisma: ReportDataAccess,
    filters: RegistroVisitasModuleFilters,
    orderKey: RegistroVisitasOrderKey,
    opts?: { take?: number },
): Promise<any[]> {
    const where: Prisma.e_registro_personasWhereInput = { isActive: true };
    const d0 = parseNaiveDateTime(filters.creadoDesde ?? null);
    const d1 = parseNaiveDateTime(filters.creadoHasta ?? null);
    if (d0 || d1) {
        where.created_at = {};
        if (d0) (where.created_at as any).gte = d0;
        if (d1) (where.created_at as any).lte = d1;
    }
    if (filters.empresaIds?.length) where.empresa_id = { in: filters.empresaIds };
    if (filters.clienteIds?.length) where.cliente_id = { in: filters.clienteIds };
    if (filters.divisionIds?.length) where.division_id = { in: filters.divisionIds };
    if (filters.contratoIds?.length) where.contrato_id = { in: filters.contratoIds };
    if (filters.corpoIds?.length) where.corpo_id = { in: filters.corpoIds };
    if (filters.puestoIds?.length) where.puesto_id = { in: filters.puestoIds };
    if (filters.responsableIds?.length) where.responsable_id = { in: filters.responsableIds };
    if (filters.cedulaVisitante && filters.cedulaVisitante.trim() !== "") {
        where.cedula = { contains: filters.cedulaVisitante.trim() };
    }
    if (filters.tipoVisitante === "normal") where.es_funcionario = false;
    if (filters.tipoVisitante === "funcionario") where.es_funcionario = true;

    const raw = await prisma.e_registro_personas.findMany({
        where,
        include: {
            e_activo_visitante: { include: { n_tipo_activo_visitas: { select: { nombre: true } } } },
            c_empleado: { select: { id: true, codigo: true, nombre: true, primer_apellido: true, segundo_apellido: true } },
            e_estructura_cliente: { select: { id: true, nombre: true } },
            e_estructura_sucursal: { select: { id: true, nombre: true, nro_sucursal: true } },
            e_estructura_puesto: { select: { id: true, nombre: true, codigo: true } },
        },
        orderBy: [orderByClause(orderKey), { id: "asc" }],
        take: opts?.take != null && opts.take > 0 ? opts.take : undefined,
    });
    return enrichRows(prisma, raw);
}

const NO_BORDER: Partial<ExcelJS.Borders> = {};
const THIN_BLACK: ExcelJS.Border = { style: "thin", color: { argb: "FF000000" } };
const BOTTOM_ONLY_CLIENT: Partial<ExcelJS.Borders> = {
    bottom: THIN_BLACK,
};
const NAVY = "FF1B365D";
const BORDER: Partial<ExcelJS.Borders> = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
};
const HDR_FILL_CONSOLIDADO = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAF7" } } as const;

function applyOuterBlackBorderRow1ColsAtoK(ws: ExcelJS.Worksheet) {
    for (let c = 1; c <= 11; c++) {
        const cell = ws.getCell(1, c);
        const border: Partial<ExcelJS.Borders> = {
            top: THIN_BLACK,
            bottom: THIN_BLACK,
        };
        if (c === 1) border.left = THIN_BLACK;
        if (c === 11) border.right = THIN_BLACK;
        cell.border = border as ExcelJS.Borders;
    }
}

function applyRightBlackBorderKRows2To4(ws: ExcelJS.Worksheet) {
    for (let rr = 2; rr <= 4; rr++) {
        const cell = ws.getCell(rr, 11);
        const prev = cell.border;
        cell.border = {
            top: prev?.top,
            left: prev?.left,
            bottom: prev?.bottom,
            right: THIN_BLACK,
        } as ExcelJS.Borders;
    }
}

function styleConsolidadoHeaderRow(row: ExcelJS.Row) {
    row.font = { bold: true };
    row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    row.eachCell((c) => {
        c.fill = HDR_FILL_CONSOLIDADO;
        c.border = BORDER;
    });
}

export async function buildRegistroVisitasExcelConsolidado(rows: any[]): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const wsMain = wb.addWorksheet("Registro visitas");
    const wsDet = wb.addWorksheet("Detalles");

    const anchorByVisitId = new Map<number, number>();

    const sortedForAct = [...rows].sort((a, b) => Number(b.id) - Number(a.id));
    for (const r of sortedForAct) {
        const vid = Number(r.id);
        const movs = Array.isArray(r.e_activo_visitante) ? r.e_activo_visitante : [];
        const tieneFotoCedula = String(r.foto_cedula ?? "").trim() !== "";
        const sigParsed = trySignatureImageFromField(r.firma_visitante);
        const tieneFirma = sigParsed != null;
        if (movs.length === 0 && !tieneFotoCedula && !tieneFirma) continue;

        const start = wsDet.rowCount + 1;
        anchorByVisitId.set(vid, start);
        wsDet.mergeCells(start, 1, start, 8);
        wsDet.getCell(start, 1).value = `Visita #${vid} | ${excelCellString(r.nombre)} | ${excelCellString(r.cedula)}`;
        wsDet.getCell(start, 1).font = { bold: true };
        wsDet.getCell(start, 1).fill = HDR_FILL_CONSOLIDADO;
        for (let c = 1; c <= 8; c++) wsDet.getCell(start, c).border = BORDER;

        if (tieneFotoCedula || tieneFirma) {
            const hdrRow = wsDet.addRow(["", "", "", "", "", "", "", ""]);
            wsDet.mergeCells(hdrRow.number, 1, hdrRow.number, 4);
            wsDet.mergeCells(hdrRow.number, 5, hdrRow.number, 8);
            hdrRow.getCell(1).value = "Foto cédula";
            hdrRow.getCell(5).value = "Firma visitante";
            for (const col of [1, 5] as const) {
                const cell = hdrRow.getCell(col);
                cell.font = { bold: true };
                cell.fill = HDR_FILL_CONSOLIDADO;
                cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
            }
            for (let c = 1; c <= 8; c++) {
                hdrRow.getCell(c).border = BORDER;
            }

            const rowImg = wsDet.addRow(["", "", "", "", "", "", "", ""]);
            wsDet.mergeCells(rowImg.number, 1, rowImg.number, 4);
            wsDet.mergeCells(rowImg.number, 5, rowImg.number, 8);
            for (let c = 1; c <= 8; c++) {
                rowImg.getCell(c).border = BORDER;
                rowImg.getCell(c).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
            }

            let maxImgH = 36;
            const BOX_W = 150;
            const BOX_H = 100;
            const row0 = rowImg.number - 1;

            if (tieneFotoCedula) {
                const cedPath = resolveCedulaFotoFilePath(vid, r.foto_cedula);
                if (cedPath) {
                    try {
                        const imgBuf = await fs.readFile(cedPath);
                        const ext = excelImageExtForCedulaFileName(path.basename(cedPath));
                        const natural = getImageDimensionsFromBuffer(imgBuf);
                        const nw = natural?.width ?? BOX_W;
                        const nh = natural?.height ?? BOX_H;
                        const { width: drawW, height: drawH } = fitImageExtInsideBox(nw, nh, BOX_W, BOX_H);
                        const imgId = wb.addImage({ buffer: imgBuf as any, extension: ext });
                        wsDet.addImage(imgId, {
                            tl: { col: 0.06, row: row0 + 0.08 },
                            ext: { width: drawW, height: drawH },
                            editAs: "oneCell",
                        } as any);
                        maxImgH = Math.max(maxImgH, Math.round(drawH * 1.08 + 14));
                    } catch {
                        rowImg.getCell(1).value = "(imagen no encontrada)";
                        maxImgH = Math.max(maxImgH, 28);
                    }
                } else {
                    rowImg.getCell(1).value = "(sin archivo)";
                    maxImgH = Math.max(maxImgH, 28);
                }
            } else {
                rowImg.getCell(1).value = "—";
            }

            if (tieneFirma && sigParsed) {
                try {
                    const natural = getImageDimensionsFromBuffer(sigParsed.buffer);
                    const nw = natural?.width ?? BOX_W;
                    const nh = natural?.height ?? BOX_H;
                    const { width: drawW, height: drawH } = fitImageExtInsideBox(nw, nh, BOX_W, BOX_H);
                    const imgId = wb.addImage({ buffer: sigParsed.buffer as any, extension: sigParsed.extension });
                    wsDet.addImage(imgId, {
                        tl: { col: 4.06, row: row0 + 0.08 },
                        ext: { width: drawW, height: drawH },
                        editAs: "oneCell",
                    } as any);
                    maxImgH = Math.max(maxImgH, Math.round(drawH * 1.08 + 14));
                } catch {
                    rowImg.getCell(5).value = "(firma no legible)";
                    maxImgH = Math.max(maxImgH, 28);
                }
            } else {
                rowImg.getCell(5).value = "—";
            }

            rowImg.height = Math.min(130, Math.max(44, maxImgH));
        }

        if (movs.length > 0) {
            const actHeaders = [
                "Registro ID",
                "Visitante",
                "Cédula",
                "Tipo activo",
                "Nombre activo",
                "N° identificación",
                "N° activo",
                "Detalles",
            ];
            const ah = wsDet.addRow(actHeaders);
            ah.font = { bold: true };
            ah.eachCell((cell) => {
                cell.border = BORDER;
                cell.fill = HDR_FILL_CONSOLIDADO;
                cell.alignment = { vertical: "middle", wrapText: true };
            });

            for (const a of movs) {
                const dr = wsDet.addRow([
                    vid,
                    r.nombre,
                    r.cedula,
                    a?.n_tipo_activo_visitas?.nombre ?? "",
                    a?.nombre ?? "",
                    a?.numero_id ?? "",
                    a?.numero_activo ?? "",
                    formatActivosDetallesForExcelCell(a?.detalles),
                ]);
                dr.eachCell((c) => {
                    c.border = BORDER;
                    c.alignment = { vertical: "top", wrapText: true };
                });
                dr.getCell(8).font = { size: 10 };
            }
        }
        wsDet.addRow([]);
    }

    const mainHeaders = [
        "ID",
        "Empresa",
        "Cliente",
        "División",
        "Contrato",
        "Sucursal",
        "Puesto",
        "Visitante",
        "Cédula",
        "Foto cédula",
        "Firma",
        "Hora entrada",
        "Hora salida",
        "Motivo / visita",
        "Depto / pers. visita",
        "Funcionario",
        "Responsable",
        "Creado en",
        "N° activos",
        "Activos",
    ];
    const fotoCedulaCol = 10;
    const firmaCol = 11;
    const activosLinkCol = 20;

    const h = wsMain.addRow(mainHeaders);
    styleConsolidadoHeaderRow(h);
    wsMain.views = [{ state: "frozen", ySplit: 1 }];
    wsMain.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: mainHeaders.length },
    };
    wsMain.columns = [
        { width: 8 },
        { width: 22 },
        { width: 22 },
        { width: 18 },
        { width: 22 },
        { width: 22 },
        { width: 20 },
        { width: 24 },
        { width: 14 },
        { width: 28 },
        { width: 22 },
        { width: 16 },
        { width: 16 },
        { width: 26 },
        { width: 28 },
        { width: 12 },
        { width: 26 },
        { width: 16 },
        { width: 10 },
        { width: 18 },
    ];

    for (const r of rows) {
        const vid = Number(r.id);
        const anchor = anchorByVisitId.get(vid);
        const row = wsMain.addRow([
            vid,
            excelCellString(r.empresa_nombre),
            excelCellString(r.e_estructura_cliente?.nombre),
            excelCellString(r.division_nombre),
            excelCellString(r.contrato_nombre),
            excelCellString(r.e_estructura_sucursal?.nombre),
            excelCellString(r.e_estructura_puesto?.nombre),
            excelCellString(r.nombre),
            excelCellString(r.cedula),
            "",
            "",
            formatDt(r.hora_entrada),
            formatDt(r.hora_salida),
            excelCellString(r.razon_visita),
            [r.dep_pers_visita, r.pers_autoriza_salida].filter(Boolean).join(" / "),
            r.es_funcionario ? "Sí" : "No",
            excelCellString(r.responsable_label),
            formatDt(r.created_at),
            Array.isArray(r.e_activo_visitante) ? r.e_activo_visitante.length : 0,
            "",
        ]);
        row.eachCell((c) => {
            c.border = BORDER;
            c.alignment = { vertical: "top", wrapText: true };
        });

        const fotoCell = row.getCell(fotoCedulaCol);
        const tieneFotoCedula = String(r.foto_cedula ?? "").trim() !== "";
        const tieneFirmaRow = trySignatureImageFromField(r.firma_visitante) != null;
        if (tieneFotoCedula && anchor) {
            fotoCell.value = { text: "Ver foto cédula", hyperlink: `#'Detalles'!A${anchor}` };
            fotoCell.font = { color: { argb: "FF0563C1" }, underline: true };
        } else {
            fotoCell.value = "";
        }

        const firmaCell = row.getCell(firmaCol);
        if (tieneFirmaRow && anchor) {
            firmaCell.value = { text: "Ver firma", hyperlink: `#'Detalles'!A${anchor}` };
            firmaCell.font = { color: { argb: "FF0563C1" }, underline: true };
        } else {
            firmaCell.value = "";
        }

        if (anchor && (r.e_activo_visitante?.length ?? 0) > 0) {
            const c = row.getCell(activosLinkCol);
            c.value = { text: "Ver activos", hyperlink: `#'Detalles'!A${anchor}` };
            c.font = { color: { argb: "FF0563C1" }, underline: true };
        }
    }

    wsDet.columns = [10, 24, 14, 18, 22, 18, 14, 52].map((w) => ({ width: w }));

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
}

const DOC_META_VISITAS_DEFAULT = "SEG-F-052, V1, 02/07/2018\nGerente de Operaciones en Seguridad";

/** Metadocumento por defecto para hojas individuales de activos de visitantes (J1:K1). */
const DOC_META_ACTIVOS_VISITANTES_DEFAULT = "SEG-F-024, V1, 30/10/2015\nGerente de Operaciones en Seguridad";

async function resolveLogoPathByEmpresaIdVisitas(empresaId: number): Promise<string | null> {
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

async function fillControlVisitantesSheet(
    ws: ExcelJS.Worksheet,
    wb: ExcelJS.Workbook,
    rowsForPuesto: any[],
    reportNombre: string,
): Promise<void> {
    const first = rowsForPuesto[0] ?? {};
    const empId = Number(first?.empresa_id ?? 0);
    const logoPath = await resolveLogoPathByEmpresaIdVisitas(empId);

    ws.views = [{ showGridLines: false }];

    ws.columns = [
        { width: 22 },
        { width: 28 },
        { width: 16 },
        { width: 12 },
        { width: 12 },
        { width: 42 },
        { width: 30 },
    ];

    ws.getRow(1).height = 84;
    for (let r = 2; r <= 5; r++) ws.getRow(r).height = 18;

    ws.mergeCells("B1:F1");
    const titleCell = ws.getCell("B1");
    titleCell.value = "Control de Visitantes";
    titleCell.font = { bold: true, size: 15, color: { argb: "FFFFFFFF" } };
    titleCell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    for (let c = 2; c <= 6; c++) {
        ws.getCell(1, c).border = BORDER;
    }

    const metaText = String(reportNombre ?? "").trim() || DOC_META_VISITAS_DEFAULT;
    const g1 = ws.getCell("G1");
    g1.value = metaText;
    g1.font = { size: 10 };
    g1.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    g1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
    g1.border = BORDER;

    const a1 = ws.getCell("A1");
    a1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
    a1.border = BORDER;
    a1.alignment = { horizontal: "center", vertical: "middle" };

    if (logoPath) {
        try {
            const buf = await fs.readFile(logoPath);
            const lower = logoPath.toLowerCase();
            const ext: "png" | "jpeg" = lower.endsWith(".png") ? "png" : "jpeg";
            const natural = getImageDimensionsFromBuffer(buf);
            /** Caja del logo dentro de A1 (fila ~84 pt); más pequeña para no salirse de la casilla. */
            const BOX_W = 82;
            const BOX_H = 62;
            const nw = natural?.width ?? BOX_W;
            const nh = natural?.height ?? BOX_H;
            const { width: drawW, height: drawH } = fitImageExtInsideBox(nw, nh, BOX_W, BOX_H);
            const imgId = wb.addImage({ buffer: buf as any, extension: ext });
            ws.addImage(imgId, {
                tl: { col: 0.04, row: 0.05 },
                ext: { width: drawW, height: drawH },
                editAs: "oneCell",
            } as any);
        } catch {
            /* sin logo */
        }
    }

    for (let row = 2; row <= 5; row++) {
        for (let col = 1; col <= 7; col++) {
            const cell = ws.getCell(row, col);
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
        }
    }

    const bottomOnly: Partial<ExcelJS.Borders> = {
        bottom: { style: "thin", color: { argb: "FF000000" } },
    };

    ws.getCell("A3").value = "Lugar:";
    ws.getCell("A3").font = { bold: false, size: 11 };
    ws.getCell("A3").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
    ws.getCell("A3").alignment = { vertical: "bottom" };
    ws.mergeCells("B3:G3");
    const b3 = ws.getCell("B3");
    b3.value = excelCellString(first?.e_estructura_sucursal?.nombre);
    b3.font = { size: 11 };
    b3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
    b3.alignment = { vertical: "bottom", wrapText: true };
    for (let c = 2; c <= 7; c++) ws.getCell(3, c).border = bottomOnly as ExcelJS.Borders;

    ws.getCell("A4").value = "Puesto:";
    ws.getCell("A4").font = { size: 11 };
    ws.getCell("A4").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
    ws.getCell("A4").alignment = { vertical: "bottom" };
    ws.mergeCells("B4:G4");
    const b4 = ws.getCell("B4");
    b4.value = excelCellString(first?.e_estructura_puesto?.nombre);
    b4.font = { size: 11 };
    b4.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
    b4.alignment = { vertical: "bottom", wrapText: true };
    for (let c = 2; c <= 7; c++) ws.getCell(4, c).border = bottomOnly as ExcelJS.Borders;

    const blackRight: ExcelJS.Border = { style: "thin", color: { argb: "FF000000" } };
    for (let row = 2; row <= 5; row++) {
        const gCell = ws.getCell(row, 7);
        const prev = gCell.border;
        gCell.border = {
            top: prev?.top,
            left: prev?.left,
            bottom: prev?.bottom,
            right: blackRight,
        };
    }

    const hdr = [
        "Fecha",
        "Nombre Visitante",
        "# Identificación",
        "Hora Entrada",
        "Hora Salida",
        "Motivo, Persona, Departamento Visita",
        "Firma",
    ];
    for (let c = 1; c <= 7; c++) {
        const cell = ws.getCell(6, c);
        cell.value = hdr[c - 1];
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.border = BORDER;
    }

    let rowPtr = 7;
    for (const r of rowsForPuesto) {
        const ent = formatDt(r.hora_entrada);
        const sal = formatDt(r.hora_salida);
        const entParts = ent.split(" ");
        const salParts = sal.split(" ");
        const vals = [
            entParts[0] || "",
            excelCellString(r.nombre),
            excelCellString(r.cedula),
            entParts[1] || "",
            sal ? salParts[1] || "" : "",
            [r.razon_visita, r.dep_pers_visita, r.pers_autoriza_salida].filter(Boolean).join(" — "),
            "",
        ];
        for (let c = 1; c <= 7; c++) {
            const cell = ws.getCell(rowPtr, c);
            cell.value = vals[c - 1];
            cell.border = BORDER;
            cell.alignment = { vertical: "top", wrapText: true };
        }
        const sigParsed = trySignatureImageFromField(r.firma_visitante);
        if (sigParsed) {
            try {
                const natural = getImageDimensionsFromBuffer(sigParsed.buffer);
                const BOX_W = 110;
                const BOX_H = 50;
                const nw = natural?.width ?? BOX_W;
                const nh = natural?.height ?? BOX_H;
                const { width: drawW, height: drawH } = fitImageExtInsideBox(nw, nh, BOX_W, BOX_H);
                const imgId = wb.addImage({ buffer: sigParsed.buffer as any, extension: sigParsed.extension });
                ws.addImage(imgId, {
                    tl: { col: 6 + 0.03, row: rowPtr - 1 + 0.05 },
                    ext: { width: drawW, height: drawH },
                    editAs: "oneCell",
                } as any);
                const rh = Math.min(72, Math.max(38, Math.round(drawH * 1.08 + 10)));
                const curH = ws.getRow(rowPtr).height;
                const baseH = typeof curH === "number" && !Number.isNaN(curH) ? curH : 15;
                ws.getRow(rowPtr).height = Math.max(baseH, rh);
            } catch {
                /* sin imagen */
            }
        }
        rowPtr += 1;
    }
}

async function fillActivosVisitanteSheet(
    ws: ExcelJS.Worksheet,
    wb: ExcelJS.Workbook,
    r: any,
    reportNombre: string,
): Promise<void> {
    const acts = r.e_activo_visitante || [];
    if (!acts.length) return;

    ws.views = [{ showGridLines: false }];

    ws.columns = [
        { width: 12 },
        { width: 12 },
        { width: 12 },
        { width: 22 },
        { width: 22 },
        { width: 18 },
        { width: 16 },
        { width: 28 },
        { width: 18 },
        { width: 14 },
        { width: 40 },
    ];

    const metaActivosText = String(reportNombre ?? "").trim() || DOC_META_ACTIVOS_VISITANTES_DEFAULT;
    const logoPathAct = await resolveLogoPathByEmpresaIdVisitas(Number(r?.empresa_id ?? 0));

    ws.getRow(1).height = 76;

    ws.mergeCells(1, 1, 1, 3);
    ws.mergeCells(1, 4, 1, 9);
    ws.mergeCells(1, 10, 1, 11);

    for (let c = 1; c <= 3; c++) {
        const cell = ws.getCell(1, c);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
        cell.border = NO_BORDER as ExcelJS.Borders;
    }
    const d1 = ws.getCell("D1");
    d1.value = "CONTROL DE ACTIVOS DE VISITANTES";
    d1.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
    d1.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    d1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    for (let c = 4; c <= 9; c++) {
        const cell = ws.getCell(1, c);
        if (c !== 4) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
        }
        cell.border = NO_BORDER as ExcelJS.Borders;
    }

    const j1 = ws.getCell("J1");
    j1.value = metaActivosText;
    j1.font = { size: 10 };
    j1.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    j1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
    for (let c = 10; c <= 11; c++) {
        const cell = ws.getCell(1, c);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
        cell.border = NO_BORDER as ExcelJS.Borders;
    }

    if (logoPathAct) {
        try {
            const buf = await fs.readFile(logoPathAct);
            const lower = logoPathAct.toLowerCase();
            const ext: "png" | "jpeg" = lower.endsWith(".png") ? "png" : "jpeg";
            const natural = getImageDimensionsFromBuffer(buf);
            const BOX_W = 200;
            const BOX_H = 88;
            const nw = natural?.width ?? BOX_W;
            const nh = natural?.height ?? BOX_H;
            const { width: drawW, height: drawH } = fitImageExtInsideBox(nw, nh, BOX_W, BOX_H);
            const imgId = wb.addImage({ buffer: buf as any, extension: ext });
            ws.addImage(imgId, {
                tl: { col: 0.04, row: 0.06 },
                ext: { width: drawW, height: drawH },
                editAs: "oneCell",
            } as any);
        } catch {
            /* sin logo */
        }
    }

    applyOuterBlackBorderRow1ColsAtoK(ws);

    const whiteFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } } as const;
    for (let rr = 2; rr <= 3; rr++) {
        for (let cc = 1; cc <= 11; cc++) {
            const cell = ws.getCell(rr, cc);
            cell.fill = whiteFill;
            cell.border = NO_BORDER as ExcelJS.Borders;
        }
    }

    ws.getRow(4).height = 10;
    for (let cc = 1; cc <= 11; cc++) {
        const cell = ws.getCell(4, cc);
        cell.fill = whiteFill;
        cell.border = NO_BORDER as ExcelJS.Borders;
    }

    applyRightBlackBorderKRows2To4(ws);

    const b3 = ws.getCell("B3");
    b3.value = "Cliente";
    b3.font = { size: 11 };
    b3.fill = whiteFill;
    b3.alignment = { vertical: "bottom", horizontal: "left" };
    b3.border = NO_BORDER as ExcelJS.Borders;

    ws.mergeCells(3, 3, 3, 5);
    const c3 = ws.getCell("C3");
    c3.value = excelCellString(r.e_estructura_cliente?.nombre);
    c3.font = { size: 11 };
    c3.fill = whiteFill;
    c3.alignment = { vertical: "bottom", horizontal: "left", wrapText: true };
    for (let cc = 3; cc <= 5; cc++) {
        ws.getCell(3, cc).border = BOTTOM_ONLY_CLIENT as ExcelJS.Borders;
    }

    for (const cc of [1, 6, 7, 8, 9, 10, 11]) {
        const cell = ws.getCell(3, cc);
        cell.fill = whiteFill;
        cell.border = NO_BORDER as ExcelJS.Borders;
    }

    const actHdrLabels = [
        "Fecha",
        "Nº Corpo",
        "Nº Puesto",
        "Identificación del dueño del activo",
        "Nombre dueño del activo",
        "Tipo de activo",
        "Nº Serie del activo",
        "Lugar o persona que visita",
        "Hora ingreso",
        "Hora de salida",
        "Observaciones",
    ];
    for (let c = 1; c <= 11; c++) {
        const cell = ws.getCell(5, c);
        cell.value = actHdrLabels[c - 1];
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.border = BORDER;
    }

    let dataRow = 6;
    for (const a of acts) {
        const row = ws.getRow(dataRow);
        const vals = [
            formatDt(r.hora_entrada).split(" ")[0] || "",
            r.e_estructura_sucursal?.nro_sucursal ?? "",
            r.e_estructura_puesto?.codigo ?? "",
            r.cedula,
            r.nombre,
            a?.n_tipo_activo_visitas?.nombre ?? "",
            a?.numero_id ?? "",
            r.razon_visita,
            formatTimePartFromDt(r.hora_entrada),
            formatTimePartFromDt(r.hora_salida),
            String(formatActivosDetallesForExcelCell(a?.detalles)).slice(0, 32000),
        ];
        for (let c = 1; c <= 11; c++) {
            const cell = row.getCell(c);
            cell.value = vals[c - 1];
            cell.border = BORDER;
            cell.alignment = { vertical: "top", wrapText: true };
            if (c === 11) cell.font = { size: 10 };
        }
        dataRow += 1;
    }
}

async function buildVisitasMultiPuestoVisitantesWorkbook(rows: any[], reportNombre: string): Promise<Buffer> {
    const byPuesto = new Map<number, any[]>();
    for (const r of rows) {
        const pid = Number(r.puesto_id);
        if (!Number.isFinite(pid) || pid <= 0) continue;
        const arr = byPuesto.get(pid) ?? [];
        arr.push(r);
        byPuesto.set(pid, arr);
    }
    const wb = new ExcelJS.Workbook();
    const ordered = [...byPuesto.entries()].sort((a, b) => a[0] - b[0]);
    if (ordered.length === 0) {
        const ws0 = wb.addWorksheet("Vacío");
        ws0.addRow(["Sin registros para exportar"]);
        return Buffer.from(await wb.xlsx.writeBuffer());
    }
    for (const [puestoId, list] of ordered) {
        const sheetName = excelWorksheetNameForPuesto(list[0]?.e_estructura_puesto?.nombre, puestoId);
        const ws = wb.addWorksheet(sheetName);
        await fillControlVisitantesSheet(ws, wb, list, reportNombre);
    }
    return Buffer.from(await wb.xlsx.writeBuffer());
}

async function buildActivosVisitantesMasterWorkbook(rows: any[], reportNombre: string): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const sorted = [...rows].sort((a, b) => Number(a.id) - Number(b.id));
    let added = 0;
    for (const r of sorted) {
        const acts = r.e_activo_visitante || [];
        if (!acts.length) continue;
        const safeName = `Act_${r.id}`.replace(/[/\\?*:[\]]/g, "_").slice(0, 31);
        const ws = wb.addWorksheet(safeName);
        await fillActivosVisitanteSheet(ws, wb, r, reportNombre);
        added += 1;
    }
    if (added === 0) {
        const ws0 = wb.addWorksheet("Vacío");
        ws0.getCell(1, 1).value = "Sin activos de visitantes en el período.";
    }
    return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function buildRegistroVisitasIndividualZip(rows: any[], reportNombre: string): Promise<Buffer> {
    const visitantesBuf = await buildVisitasMultiPuestoVisitantesWorkbook(rows, reportNombre);
    const activosBuf = await buildActivosVisitantesMasterWorkbook(rows, reportNombre);
    const files: { name: string; buf: Buffer }[] = [
        { name: "Registro_visitas.xlsx", buf: visitantesBuf },
        { name: "Activos_visitantes.xlsx", buf: activosBuf },
    ];
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        const archive = archiver("zip", { zlib: { level: 6 } });
        archive.on("error", reject);
        archive.on("data", (c: Buffer) => chunks.push(c));
        archive.on("end", () => resolve(Buffer.concat(chunks)));
        for (const f of files) archive.append(f.buf, { name: f.name });
        void archive.finalize();
    });
}
