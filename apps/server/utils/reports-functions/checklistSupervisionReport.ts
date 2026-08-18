/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import type { ReportDataAccess } from "../reportDynamicPrisma";
import ExcelJS from "exceljs";
import { normalizeActaEntregaFilters, type ActaEntregaModuleFilters } from "./actaEntregaProductos";

export type ChecklistSupervisionModuleFilters = ActaEntregaModuleFilters & {
    ejecutivoCuentaIds?: number[] | null;
    /** Rango aplicado a columna `fecha` (equiv. operativo «fecha_reporte» del negocio). */
    fechaReporteDesde?: string | null;
    fechaReporteHasta?: string | null;
};

export type ChecklistSupervisionOrderKey =
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

function excelCellString(v: unknown, max = 32767): string {
    const s = String(v ?? "");
    return s.length > max ? s.slice(0, max) : s;
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

function toValidIds(raw: unknown): number[] {
    if (!Array.isArray(raw)) return [];
    return [...new Set(raw.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0))];
}

export function normalizeChecklistSupervisionFilters(raw: unknown): ChecklistSupervisionModuleFilters {
    const base = normalizeActaEntregaFilters(raw);
    const o = raw != null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const ejIds = toValidIds(o.ejecutivoCuentaIds);
    const frd = String(o.fechaReporteDesde ?? "").trim();
    const frh = String(o.fechaReporteHasta ?? "").trim();
    return {
        ...base,
        ejecutivoCuentaIds: ejIds.length ? ejIds : null,
        fechaReporteDesde: frd || null,
        fechaReporteHasta: frh || null,
    };
}

export function hasChecklistSupervisionListModuleFiltersContent(f: ChecklistSupervisionModuleFilters): boolean {
    if (f.fechaReporteDesde || f.fechaReporteHasta) return true;
    if (f.empresaIds?.length || f.clienteIds?.length || f.divisionIds?.length) return true;
    if (f.contratoIds?.length || f.corpoIds?.length || f.puestoIds?.length) return true;
    if (f.ejecutivoCuentaIds?.length) return true;
    return false;
}

export function filtersMatchChecklistSupervisionListQuery(parsedRowFilters: any, listModuleFilters?: ChecklistSupervisionModuleFilters): boolean {
    if (!listModuleFilters) return true;
    const saved = normalizeChecklistSupervisionFilters((parsedRowFilters?.moduleFilters || {}) as any);
    const overlaps = (left?: number[] | null, right?: number[] | null) => {
        if (!left || left.length === 0) return true;
        if (!right || right.length === 0) return false;
        return left.some((x) => right.includes(x));
    };
    if (listModuleFilters.fechaReporteDesde && String(saved.fechaReporteDesde || "") !== String(listModuleFilters.fechaReporteDesde))
        return false;
    if (listModuleFilters.fechaReporteHasta && String(saved.fechaReporteHasta || "") !== String(listModuleFilters.fechaReporteHasta))
        return false;
    if (!overlaps(listModuleFilters.empresaIds ?? undefined, saved.empresaIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.clienteIds ?? undefined, saved.clienteIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.divisionIds ?? undefined, saved.divisionIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.contratoIds ?? undefined, saved.contratoIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.corpoIds ?? undefined, saved.corpoIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.puestoIds ?? undefined, saved.puestoIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.ejecutivoCuentaIds ?? undefined, saved.ejecutivoCuentaIds ?? undefined)) return false;
    return true;
}

export async function queryChecklistSupervisionRows(
    prisma: ReportDataAccess,
    filters: ChecklistSupervisionModuleFilters,
    orderKey: ChecklistSupervisionOrderKey,
) {
    const where: any = { isActive: true };
    const desde = parseBoundaryDate(filters.fechaReporteDesde ?? filters.creadoDesde ?? undefined);
    const hasta = parseBoundaryDate(filters.fechaReporteHasta ?? filters.creadoHasta ?? undefined);
    if (desde || hasta) {
        where.fecha = {};
        if (desde) where.fecha.gte = desde;
        if (hasta) where.fecha.lte = hasta;
    }
    if (filters.empresaIds?.length) where.empresa_id = { in: filters.empresaIds };
    if (filters.clienteIds?.length) where.cliente_id = { in: filters.clienteIds };
    if (filters.divisionIds?.length) where.division_id = { in: filters.divisionIds };
    if (filters.contratoIds?.length) where.contrato_id = { in: filters.contratoIds };
    if (filters.corpoIds?.length) where.corpo_id = { in: filters.corpoIds };
    if (filters.puestoIds?.length) where.puesto_id = { in: filters.puestoIds };
    if (filters.ejecutivoCuentaIds?.length) {
        const strIds = filters.ejecutivoCuentaIds.map((n) => String(n));
        where.ejecutivo_cuenta = { in: strIds };
    }

    const rows = await prisma.c_checklist_supervision.findMany({
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
    const ejecutivoKeys = [...new Set(rows.map((r) => String(r.ejecutivo_cuenta ?? "").trim()).filter(Boolean))];
    const ejecutivoNumIds = ejecutivoKeys.map((k) => Number(k)).filter((n) => Number.isFinite(n) && n > 0);

    const [empresas, clientes, divisiones, contratos, corpos, puestos, ejecutivos] = await Promise.all([
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
        ejecutivoNumIds.length ? prisma.n_ejecutivo_cuenta.findMany({ where: { id: { in: ejecutivoNumIds } }, select: { id: true, nombre: true } }) : [],
    ]);

    const empresaById = new Map(empresas.map((x) => [x.id, x]));
    const clienteById = new Map(clientes.map((x) => [x.id, x]));
    const divisionById = new Map(divisiones.map((x) => [x.id, x]));
    const contratoById = new Map(contratos.map((x) => [x.id, x]));
    const corpoById = new Map(corpos.map((x) => [x.id, x]));
    const puestoById = new Map(puestos.map((x) => [x.id, x]));
    const ejecutivoById = new Map(ejecutivos.map((x) => [x.id, x]));

    const enriched = rows.map((r) => {
        const empresa = empresaById.get(Number(r.empresa_id));
        const cliente = clienteById.get(Number(r.cliente_id));
        const division = divisionById.get(Number(r.division_id));
        const contrato = contratoById.get(Number(r.contrato_id));
        const corpo = corpoById.get(Number(r.corpo_id));
        const puesto = puestoById.get(Number(r.puesto_id));
        const ejNum = Number(String(r.ejecutivo_cuenta ?? "").trim());
        const ejecutivo = Number.isFinite(ejNum) && ejNum > 0 ? ejecutivoById.get(ejNum) : undefined;
        return {
            ...r,
            empresa_nombre: empresa ? `${empresa.codigo ? `${empresa.codigo} - ` : ""}${empresa.nombre}` : String(r.empresa_id),
            cliente_nombre: cliente?.nombre ?? String(r.cliente_id),
            division_nombre: division?.nombre ?? String(r.division_id),
            contrato_nombre: contrato ? `${contrato.nro_contrato ? `${contrato.nro_contrato} - ` : ""}${contrato.nombre}` : String(r.contrato_id),
            corpo_nombre: corpo ? `${corpo.nro_sucursal ? `${corpo.nro_sucursal} - ` : ""}${corpo.nombre}` : String(r.corpo_id),
            puesto_nombre: puesto ? `${puesto.codigo ? `${puesto.codigo} - ` : ""}${puesto.nombre}` : String(r.puesto_id),
            ejecutivo_cuenta_nombre: ejecutivo?.nombre?.trim() || String(r.ejecutivo_cuenta ?? ""),
            empleado_display: formatEmpleadoDisplay(r),
            hora_inicio_txt: timeToHHmm((r as any).hora_inicio),
            hora_fin_txt: timeToHHmm((r as any).hora_fin),
        };
    });

    return sortChecklistRows(enriched, orderKey);
}

function sortChecklistRows(rows: any[], orderKey: ChecklistSupervisionOrderKey): any[] {
    const copy = [...rows];
    copy.sort((a, b) => {
        if (orderKey === "fecha") return new Date(a.fecha).getTime() - new Date(b.fecha).getTime();
        if (orderKey === "empresa_id") return String(a.empresa_nombre ?? "").localeCompare(String(b.empresa_nombre ?? ""), "es");
        if (orderKey === "cliente_id") return String(a.cliente_nombre ?? "").localeCompare(String(b.cliente_nombre ?? ""), "es");
        if (orderKey === "division_id") return String(a.division_nombre ?? "").localeCompare(String(b.division_nombre ?? ""), "es");
        if (orderKey === "contrato_id") return String(a.contrato_nombre ?? "").localeCompare(String(b.contrato_nombre ?? ""), "es");
        if (orderKey === "corpo_id") return String(a.corpo_nombre ?? "").localeCompare(String(b.corpo_nombre ?? ""), "es");
        if (orderKey === "puesto_id") return String(a.puesto_nombre ?? "").localeCompare(String(b.puesto_nombre ?? ""), "es");
        return String(a.id).localeCompare(String(b.id));
    });
    return copy;
}

function parseEvalJson(raw: unknown): any[] {
    if (!raw || String(raw).trim() === "") return [];
    try {
        const p = JSON.parse(String(raw));
        return Array.isArray(p) ? p : [];
    } catch {
        return [];
    }
}

function parseArticulosJson(raw: unknown): any[] {
    if (!raw || String(raw).trim() === "") return [];
    try {
        const p = JSON.parse(String(raw));
        return Array.isArray(p) ? p : [];
    } catch {
        return [];
    }
}

function fmtDt(v: unknown): string {
    const d = v instanceof Date ? v : new Date(String(v ?? ""));
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().replace("T", " ").slice(0, 19);
}

function timeToHHmm(val: unknown): string {
    if (val == null || String(val).trim() === "") return "";
    const s = String(val).trim();
    if (/^\d{2}:\d{2}(:\d{2})?$/.test(s)) return s.slice(0, 5);
    const d = val instanceof Date ? val : new Date(s.includes("T") ? s : `1970-01-01T${s}`);
    if (Number.isNaN(d.getTime())) return s.slice(0, 5);
    return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

function formatEmpleadoDisplay(r: any): string {
    const codigo = String(r?.empleado_codigo ?? "").trim();
    const nombre = String(r?.empleado_nombre ?? "").trim();
    if (codigo && nombre) return `${codigo} - ${nombre}`;
    return nombre || codigo || "";
}

type EvalPhotoItem = { file_name?: string; value?: string; imageOrientation?: unknown };

function collectEvalPhotoItems(inp: any): EvalPhotoItem[] {
    if (Array.isArray(inp?.photos) && inp.photos.length > 0) {
        return inp.photos.filter(
            (p: any) =>
                String(p?.file_name ?? "").trim() ||
                (typeof p?.value === "string" && (p.value.startsWith("data:image/") || p.value.length > 100)),
        );
    }
    const fileName = String(inp?.file_name ?? "").trim();
    const value = inp?.value;
    if (fileName || (typeof value === "string" && (value.startsWith("data:image/") || value.length > 100))) {
        return [{ file_name: fileName || undefined, value, imageOrientation: inp?.imageOrientation }];
    }
    return [];
}

/** Rutas típicas: `apps/server/public/uploads/checklist-supervision/{id}/{file}` (servidor Next en `apps/server`). */
async function readChecklistSupervisionImageFile(checklistId: number, fileName: unknown): Promise<Buffer | null> {
    const base = path.basename(String(fileName ?? "").trim());
    if (!base || base === "." || base === "..") return null;
    const relParts = ["public", "uploads", "checklist-supervision", String(checklistId), base];
    const candidates = [
        path.join(process.cwd(), ...relParts),
        path.join(process.cwd(), "apps", "server", ...relParts),
        path.join(process.cwd(), "..", "..", "apps", "server", ...relParts),
    ];
    for (const p of candidates) {
        try {
            if (fs.existsSync(p)) return await fsPromises.readFile(p);
        } catch {
            /* ignore */
        }
    }
    return null;
}

function inferExcelImageExtension(fileName: string, buf: Buffer): "png" | "jpeg" | "gif" {
    const lower = fileName.toLowerCase();
    if (lower.endsWith(".png")) return "png";
    if (lower.endsWith(".gif")) return "gif";
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "jpeg";
    if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
    if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
    if (buf.length >= 6 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "gif";
    return "jpeg";
}

function readPngDimensions(buf: Buffer): { w: number; h: number } | null {
    if (buf.length < 24) return null;
    if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) return null;
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
    return { w, h };
}

function readJpegDimensions(buf: Buffer): { w: number; h: number } | null {
    let i = 2;
    while (i < buf.length - 1) {
        if (buf[i] !== 0xff) {
            i++;
            continue;
        }
        const marker = buf[i + 1];
        if (marker === 0xd8) {
            i += 2;
            continue;
        }
        if (marker === 0xd9) break;
        if (i + 3 >= buf.length) break;
        const segLen = buf.readUInt16BE(i + 2);
        if (segLen < 2 || i + 2 + segLen > buf.length) break;
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
            if (i + 9 <= buf.length) {
                const h = buf.readUInt16BE(i + 5);
                const w = buf.readUInt16BE(i + 7);
                if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) return { w, h };
            }
        }
        i += 2 + segLen;
    }
    return null;
}

function readGifDimensions(buf: Buffer): { w: number; h: number } | null {
    if (buf.length < 10) return null;
    if (buf[0] !== 0x47 || buf[1] !== 0x49 || buf[2] !== 0x46) return null;
    const w = buf.readUInt16LE(6);
    const h = buf.readUInt16LE(8);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
    return { w, h };
}

function readBitmapDimensions(buf: Buffer): { w: number; h: number } | null {
    return readPngDimensions(buf) ?? readJpegDimensions(buf) ?? readGifDimensions(buf);
}

/** Ajuste tipo "object-fit: contain": proporción original, caja según orientación del diseño (no estirar). */
function fitImageDisplaySize(
    naturalW: number,
    naturalH: number,
    orientation: "horizontal" | "vertical",
): { width: number; height: number } {
    const box =
        orientation === "vertical"
            ? { maxW: 220, maxH: 320 }
            : { maxW: 400, maxH: 155 };
    const scale = Math.min(box.maxW / naturalW, box.maxH / naturalH);
    const width = Math.round(naturalW * scale);
    const height = Math.round(naturalH * scale);
    return { width: Math.max(1, width), height: Math.max(1, height) };
}

function normalizeImageOrientation(raw: unknown): "horizontal" | "vertical" {
    const s = String(raw ?? "")
        .trim()
        .toLowerCase();
    if (s === "vertical" || s === "portrait" || s === "v") return "vertical";
    return "horizontal";
}

/**
 * Alineado con ChecklistSupervisionScreen: la pregunta va en `subsection.title`;
 * inputs sin título, con "Respuesta" o duplicando la subsección no muestran etiqueta.
 */
function shouldShowChecklistEvalInputTitle(inputTitle: unknown, subsectionTitle?: unknown): boolean {
    const t = String(inputTitle ?? "").trim();
    if (!t || t.toLowerCase() === "respuesta") return false;
    const sub = String(subsectionTitle ?? "").trim();
    return !sub || t !== sub;
}

function resolveChecklistEvalInputLabel(inp: any, subsectionTitle: string): string {
    const title = excelCellString(inp?.title ?? "").trim();
    return shouldShowChecklistEvalInputTitle(title || undefined, subsectionTitle) ? title : "";
}

/** Texto en columna valor para inputs de evaluación (text/textarea/select/date/photo/checkbox). */
function formatEvalInputDisplayValue(inp: any): string {
    const inpType = String(inp?.type ?? "").trim().toLowerCase();
    if (inpType === "checkbox") {
        const v = inp?.value;
        if (v === true || v === 1) return "Marcado";
        if (v === false || v === 0) return "No marcado";
        const t = String(v ?? "")
            .trim()
            .toLowerCase();
        if (t === "true" || t === "1" || t === "sí" || t === "si" || t === "yes" || t === "y") return "Marcado";
        return "No marcado";
    }
    if (inpType === "photo") {
        const n = collectEvalPhotoItems(inp).length;
        if (n > 0) return n === 1 ? "Imagen adjunta" : `${n} imágenes adjuntas`;
        const v = String(inp?.value ?? "").trim();
        return v || "—";
    }
    const raw = excelCellString(inp?.value ?? "").trim();
    return raw || "—";
}

function tryEmbedEvalPhotoRow(params: {
    wb: ExcelJS.Workbook;
    wsDet: ExcelJS.Worksheet;
    buf: Buffer;
    extension: "png" | "jpeg" | "gif";
    label: string;
    imageOrientation: "horizontal" | "vertical";
    border: Partial<ExcelJS.Borders>;
}): boolean {
    const { wb, wsDet, buf, extension, label, imageOrientation, border } = params;
    try {
        const natural = readBitmapDimensions(buf);
        const { width: dw, height: dh } = natural
            ? fitImageDisplaySize(natural.w, natural.h, imageOrientation)
            : imageOrientation === "vertical"
              ? { width: 180, height: 260 }
              : { width: 340, height: 126 };

        const imgId = wb.addImage({
            base64: buf.toString("base64"),
            extension,
        });
        const rowImg = wsDet.addRow([label, ""]);
        rowImg.getCell(1).border = border;
        rowImg.getCell(2).border = border;
        rowImg.getCell(1).alignment = { vertical: "top", wrapText: true };
        rowImg.getCell(2).alignment = { vertical: "top", wrapText: true };

        const heightPt = Math.min(409, Math.max(48, Math.round((dh * 72) / 96 + 12)));
        rowImg.height = heightPt;

        const imgRow0 = rowImg.number - 1;
        wsDet.addImage(imgId, {
            tl: { col: 1.02, row: imgRow0 + 0.02 },
            ext: { width: dw, height: dh },
            editAs: "oneCell",
        });
        return true;
    } catch {
        return false;
    }
}

function mergeTwoCols(ws: ExcelJS.Worksheet, rowNum: number, border: Partial<ExcelJS.Borders>) {
    ws.mergeCells(`A${rowNum}:B${rowNum}`);
    const cell = ws.getCell(`A${rowNum}`);
    cell.border = border;
    ws.getCell(`B${rowNum}`).border = border;
    return cell;
}

async function appendEvaluacionDetalleBlock(params: {
    wb: ExcelJS.Workbook;
    wsDet: ExcelJS.Worksheet;
    checklistId: number;
    evaluacionRaw: unknown;
    border: Partial<ExcelJS.Borders>;
    secHdrFill: { type: "pattern"; pattern: "solid"; fgColor: { argb: string } };
}) {
    const { wb, wsDet, checklistId, evaluacionRaw, border, secHdrFill } = params;

    const secEval = wsDet.addRow(["Evaluación", ""]);
    wsDet.mergeCells(`A${secEval.number}:B${secEval.number}`);
    const secMaster = secEval.getCell(1);
    secMaster.value = "Evaluación";
    secMaster.font = { bold: true, color: { argb: "FFFFFFFF" } };
    secMaster.fill = secHdrFill;
    secMaster.border = border;
    secMaster.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    secEval.getCell(2).border = border;

    const sections = parseEvalJson(evaluacionRaw);
    if (sections.length === 0) {
        const empty = wsDet.addRow(["— Sin datos de evaluación —", ""]);
        wsDet.mergeCells(`A${empty.number}:B${empty.number}`);
        const ec = empty.getCell(1);
        ec.value = "— Sin datos de evaluación —";
        ec.border = border;
        ec.alignment = { vertical: "middle", wrapText: true };
        empty.getCell(2).border = border;
        return;
    }

    for (const sec of sections) {
        const st = excelCellString(sec?.title ?? "").trim() || "(Sección)";
        const sr = wsDet.addRow([st, ""]);
        const c0 = mergeTwoCols(wsDet, sr.number, border);
        c0.value = st;
        c0.font = { bold: true };
        c0.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
        c0.alignment = { horizontal: "center", vertical: "middle", wrapText: true };

        const subs = Array.isArray(sec?.subsections) ? sec.subsections : [];
        for (const sub of subs) {
            const subt = excelCellString(sub?.title ?? "").trim() || "(Subsección)";
            const sur = wsDet.addRow([subt, ""]);
            const sc = mergeTwoCols(wsDet, sur.number, border);
            sc.value = subt;
            sc.font = { italic: true };
            sc.alignment = { horizontal: "center", vertical: "middle", wrapText: true };

            const detalle = excelCellString(sub?.detalle ?? "").trim();
            if (detalle) {
                const dr = wsDet.addRow(["Detalle", detalle]);
                dr.getCell(1).border = border;
                dr.getCell(2).border = border;
                dr.getCell(1).font = { bold: true };
                dr.getCell(1).alignment = { vertical: "top", wrapText: true };
                dr.getCell(2).alignment = { vertical: "top", wrapText: true };
            }

            const inputs = Array.isArray(sub?.inputs) ? sub.inputs : [];
            if (inputs.length === 0) {
                const er = wsDet.addRow(["—", "—"]);
                er.getCell(1).border = border;
                er.getCell(2).border = border;
                er.getCell(1).alignment = { vertical: "top", wrapText: true };
                er.getCell(2).alignment = { vertical: "top", wrapText: true };
                continue;
            }

            for (const inp of inputs) {
                const label = resolveChecklistEvalInputLabel(inp, subt);
                const inpType = String(inp?.type ?? "").trim().toLowerCase();
                const isPhoto = inpType === "photo";

                if (isPhoto) {
                    const photoItems = collectEvalPhotoItems(inp);
                    if (photoItems.length === 0) {
                        const ir = wsDet.addRow([label, "—"]);
                        ir.getCell(1).border = border;
                        ir.getCell(2).border = border;
                        ir.getCell(1).alignment = { vertical: "top", wrapText: true };
                        ir.getCell(2).alignment = { vertical: "top", wrapText: true };
                        continue;
                    }

                    for (let pi = 0; pi < photoItems.length; pi++) {
                        const photo = photoItems[pi];
                        const photoLabel =
                            photoItems.length > 1 ? (label ? `${label} (${pi + 1}/${photoItems.length})` : `Foto ${pi + 1}`) : label;
                        const imgOrient = normalizeImageOrientation(photo.imageOrientation ?? inp?.imageOrientation);
                        const fileNameRaw = String(photo.file_name ?? "").trim();
                        let imageAdded = false;

                        if (fileNameRaw) {
                            const buf = await readChecklistSupervisionImageFile(checklistId, fileNameRaw);
                            if (buf && buf.length > 0) {
                                const ext = inferExcelImageExtension(path.basename(fileNameRaw), buf);
                                imageAdded = tryEmbedEvalPhotoRow({
                                    wb,
                                    wsDet,
                                    buf,
                                    extension: ext,
                                    label: photoLabel,
                                    imageOrientation: imgOrient,
                                    border,
                                });
                            }
                        }

                        if (!imageAdded && typeof photo.value === "string" && photo.value.startsWith("data:image/")) {
                            const sig = parseSignatureDataForExcel(photo.value);
                            if (sig) {
                                const rawBuf = Buffer.from(sig.base64, "base64");
                                imageAdded = tryEmbedEvalPhotoRow({
                                    wb,
                                    wsDet,
                                    buf: rawBuf,
                                    extension: sig.extension,
                                    label: photoLabel,
                                    imageOrientation: imgOrient,
                                    border,
                                });
                            }
                        }

                        if (!imageAdded) {
                            const ir = wsDet.addRow([photoLabel, "Imagen no disponible"]);
                            ir.getCell(1).border = border;
                            ir.getCell(2).border = border;
                            ir.getCell(1).alignment = { vertical: "top", wrapText: true };
                            ir.getCell(2).alignment = { vertical: "top", wrapText: true };
                        }
                    }
                    continue;
                }

                const val = formatEvalInputDisplayValue(inp);
                const ir = wsDet.addRow([label, val]);
                ir.getCell(1).border = border;
                ir.getCell(2).border = border;
                ir.getCell(1).alignment = { vertical: "top", wrapText: true };
                ir.getCell(2).alignment = { vertical: "top", wrapText: true };
            }
        }
    }
}

export async function buildChecklistSupervisionExcelConsolidado(rows: any[]): Promise<Buffer> { // Consolidado
    const wb = new ExcelJS.Workbook();
    const wsMain = wb.addWorksheet("Checklist supervisión");
    const wsDet = wb.addWorksheet("Detalles");
    const border: Partial<ExcelJS.Borders> = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
    const hdrFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3D63" } } as const;
    const secHdrFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } } as const;

    const byIdDesc = [...rows].sort((a, b) => Number(b.id) - Number(a.id));
    const anchorById = new Map<number, number>();

    const styleHdrRow = (
        row: ExcelJS.Row,
        fill: { type: "pattern"; pattern: "solid"; fgColor: { argb: string } },
        maxCol: number,
    ) => {
        row.font = { bold: true, color: { argb: "FFFFFFFF" } };
        for (let c = 1; c <= maxCol; c++) {
            const cell = row.getCell(c);
            cell.fill = fill;
            cell.border = border;
            cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        }
    };

    for (const rec of byIdDesc) {
        const title = wsDet.addRow([`Checklist ID: ${rec.id}`]);
        anchorById.set(Number(rec.id), title.number);
        title.getCell(1).font = { bold: true, size: 12 };
        title.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE7E6E6" } };
        title.getCell(1).border = border;

        const metaRows: Array<[string, string]> = [
            ["Empleado", excelCellString(rec.empleado_display ?? formatEmpleadoDisplay(rec)) || "—"],
            ["Hora inicio", excelCellString(rec.hora_inicio_txt ?? timeToHHmm(rec.hora_inicio)) || "—"],
            ["Hora fin", excelCellString(rec.hora_fin_txt ?? timeToHHmm(rec.hora_fin)) || "—"],
        ];
        for (const [label, val] of metaRows) {
            const mr = wsDet.addRow([label, val]);
            mr.getCell(1).border = border;
            mr.getCell(2).border = border;
            mr.getCell(1).font = { bold: true };
            mr.getCell(1).alignment = { vertical: "top", wrapText: true };
            mr.getCell(2).alignment = { vertical: "top", wrapText: true };
        }

        await appendEvaluacionDetalleBlock({
            wb,
            wsDet,
            checklistId: Number(rec.id),
            evaluacionRaw: rec.evaluacion,
            border,
            secHdrFill,
        });

        const artHdr = wsDet.addRow(["Artículos puesto", "", "", "", "", ""]);
        styleHdrRow(artHdr, secHdrFill, 6);

        const artCols = wsDet.addRow(["Nombre", "Tipo", "Cant. req.", "Cant. real", "Estado", "Observaciones"]);
        artCols.font = { bold: true, color: { argb: "FFFFFFFF" } };
        artCols.eachCell((cell) => {
            cell.fill = hdrFill;
            cell.border = border;
            cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        });

        const arts = parseArticulosJson(rec.articulos_puesto);
        if (arts.length === 0) {
            const ar = wsDet.addRow(["—", "—", "—", "—", "—", "—"]);
            ar.eachCell((c) => {
                c.border = border;
            });
        } else {
            for (const a of arts) {
                const ar = wsDet.addRow([
                    excelCellString(a?.nombre ?? ""),
                    excelCellString(a?.tipo ?? ""),
                    excelCellString(a?.cantidad_requerida ?? ""),
                    excelCellString(a?.cantidad_real ?? ""),
                    excelCellString(a?.estado ?? ""),
                    excelCellString(a?.observaciones ?? ""),
                ]);
                ar.eachCell((c) => {
                    c.border = border;
                    c.alignment = { vertical: "top", wrapText: true };
                });
            }
        }

        const firHdr = wsDet.addRow(["Firma supervisor", ""]);
        styleHdrRow(firHdr, secHdrFill, 2);

        const sig = parseSignatureDataForExcel(rec.firma_supervisor);
        if (sig) {
            try {
                const imgId = wb.addImage({ base64: sig.base64, extension: sig.extension });
                const rowImg = wsDet.addRow(["", ""]);
                rowImg.height = 100;
                const imgRow0 = rowImg.number - 1;
                wsDet.addImage(imgId, {
                    tl: { col: 0.1, row: imgRow0 + 0.05 },
                    ext: { width: 280, height: 96 },
                    editAs: "oneCell",
                });
                rowImg.eachCell((c) => {
                    c.border = border;
                });
            } catch {
                const fr = wsDet.addRow([excelCellString(rec.firma_supervisor ?? "").slice(0, 500), ""]);
                fr.eachCell((c) => {
                    c.border = border;
                });
            }
        } else {
            const fr = wsDet.addRow(["— Sin firma —", ""]);
            fr.eachCell((c) => {
                c.border = border;
            });
        }

        wsDet.addRow([]);
    }

    wsDet.columns = [36, 44, 14, 14, 16, 28].map((w) => ({ width: w }));

    const headers = [
        "ID",
        "Empresa",
        "Cliente",
        "División",
        "Contrato",
        "Sucursal",
        "Puesto",
        "Empleado",
        "Ejecutivo cuenta",
        "Fecha",
        "Hora inicio",
        "Hora fin",
        "Creado (servidor)",
        "Evaluación",
        "Artículos puesto",
        "Firma supervisor",
    ];
    const h = wsMain.addRow(headers);
    h.font = { bold: true, color: { argb: "FFFFFFFF" } };
    h.eachCell((cell) => {
        cell.fill = hdrFill;
        cell.border = border;
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    });
    wsMain.views = [{ state: "frozen", ySplit: 1 }];
    const colWidths = [8, 26, 22, 18, 24, 24, 22, 24, 22, 20, 12, 12, 18, 14, 16, 14];
    wsMain.columns = colWidths.map((w) => ({ width: w, outlineLevel: 1 }));

    const linkCols = { eval: 14, art: 15, fir: 16 };

    for (const r of rows) {
        const anchor = anchorById.get(Number(r.id)) ?? 1;
        const row = wsMain.addRow([
            String(r.id),
            excelCellString(r.empresa_nombre),
            excelCellString(r.cliente_nombre),
            excelCellString(r.division_nombre),
            excelCellString(r.contrato_nombre),
            excelCellString(r.corpo_nombre),
            excelCellString(r.puesto_nombre),
            excelCellString(r.empleado_display ?? formatEmpleadoDisplay(r)),
            excelCellString(r.ejecutivo_cuenta_nombre),
            fmtDt(r.fecha),
            excelCellString(r.hora_inicio_txt ?? timeToHHmm(r.hora_inicio)),
            excelCellString(r.hora_fin_txt ?? timeToHHmm(r.hora_fin)),
            fmtDt(r.created_at),
            parseEvalJson(r.evaluacion).length ? "Ver evaluación" : "",
            parseArticulosJson(r.articulos_puesto).length ? "Ver artículos" : "",
            r.firma_supervisor ? "Ver firma" : "",
        ]);
        row.eachCell((cell) => {
            cell.border = border;
            cell.alignment = { vertical: "middle", wrapText: true };
        });
        if (parseEvalJson(r.evaluacion).length) {
            const c = wsMain.getCell(row.number, linkCols.eval);
            c.value = { text: "Ver evaluación", hyperlink: `#'Detalles'!A${anchor}` };
            c.font = { color: { argb: "FF0563C1" }, underline: true };
        }
        if (parseArticulosJson(r.articulos_puesto).length) {
            const c = wsMain.getCell(row.number, linkCols.art);
            c.value = { text: "Ver artículos", hyperlink: `#'Detalles'!A${anchor}` };
            c.font = { color: { argb: "FF0563C1" }, underline: true };
        }
        if (r.firma_supervisor) {
            const c = wsMain.getCell(row.number, linkCols.fir);
            c.value = { text: "Ver firma", hyperlink: `#'Detalles'!A${anchor}` };
            c.font = { color: { argb: "FF0563C1" }, underline: true };
        }
    }

    wsMain.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: Math.max(1, rows.length + 1), column: headers.length },
    };

    return Buffer.from(await wb.xlsx.writeBuffer());
}
