/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import type { ReportDataAccess } from "../reportDynamicPrisma";
import ExcelJS from "exceljs";
import {
    normalizeActaEntregaFilters,
    type ActaEntregaModuleFilters,
} from "./actaEntregaProductos";

export type RevisionVehiculosModuleFilters = ActaEntregaModuleFilters & {
    vehiculoIds?: number[] | null;
};

export type RevisionVehiculosOrderKey =
    | "empresa_id"
    | "cliente_id"
    | "division_id"
    | "contrato_id"
    | "corpo_id"
    | "puesto_id"
    | "created_at";

const GRP_HDR = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAF7" } } as const;
const INFO_GEN_HDR = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2EFDA" } } as const;
const INFO_REV_HDR = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFCE4D6" } } as const;
const MOV_HDR = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE4DFEC" } } as const;
const borderThin: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FF000000" } },
    left: { style: "thin", color: { argb: "FF000000" } },
    bottom: { style: "thin", color: { argb: "FF000000" } },
    right: { style: "thin", color: { argb: "FF000000" } },
};

export function parseInformacionRevision(raw: unknown): any[] {
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "string" && raw.trim()) {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }

function toValidIds(raw: unknown): number[] {
    if (!Array.isArray(raw)) return [];
    const out = raw.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0);
    return [...new Set(out)];
}

export function normalizeRevisionVehiculosFilters(raw: unknown): RevisionVehiculosModuleFilters {
    const base = normalizeActaEntregaFilters(raw);
    const o = raw != null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const vehiculoIds = toValidIds(o.vehiculoIds);
    const next: RevisionVehiculosModuleFilters = { ...base };
    if (vehiculoIds.length) next.vehiculoIds = vehiculoIds;
    return next;
}

export function hasRevisionVehiculosListModuleFiltersContent(f: RevisionVehiculosModuleFilters): boolean {
    if (f.creadoDesde) return true;
    if (f.creadoHasta) return true;
    if (f.empresaIds?.length) return true;
    if (f.clienteIds?.length) return true;
    if (f.divisionIds?.length) return true;
    if (f.contratoIds?.length) return true;
    if (f.corpoIds?.length) return true;
    if (f.puestoIds?.length) return true;
    if (f.vehiculoIds?.length) return true;
    return false;
}

function overlaps(left?: number[] | null, right?: number[] | null): boolean {
    if (!left || left.length === 0) return true;
    if (!right || right.length === 0) return false;
    return left.some((x) => right.includes(x));
}

export function filtersMatchRevisionVehiculosListQuery(
    parsedRowFilters: any,
    listModuleFilters?: RevisionVehiculosModuleFilters,
): boolean {
    if (!listModuleFilters) return true;
    const saved = normalizeRevisionVehiculosFilters(parsedRowFilters?.moduleFilters || {});
    if (listModuleFilters.creadoDesde && String(saved.creadoDesde || "") !== String(listModuleFilters.creadoDesde)) {
        return false;
    }
    if (listModuleFilters.creadoHasta && String(saved.creadoHasta || "") !== String(listModuleFilters.creadoHasta)) {
        return false;
    }
    if (!overlaps(listModuleFilters.empresaIds ?? undefined, saved.empresaIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.clienteIds ?? undefined, saved.clienteIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.divisionIds ?? undefined, saved.divisionIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.contratoIds ?? undefined, saved.contratoIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.corpoIds ?? undefined, saved.corpoIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.puestoIds ?? undefined, saved.puestoIds ?? undefined)) return false;
    if (!overlaps(listModuleFilters.vehiculoIds ?? undefined, saved.vehiculoIds ?? undefined)) return false;
    return true;
}

function parseBoundaryDateTime(s: string | undefined | null): Date | null {
    if (!s || String(s).trim() === "") return null;
    const t = String(s).trim();
    const d = new Date(t.includes("T") ? t : t.replace(" ", "T"));
    return Number.isNaN(d.getTime()) ? null : d;
}

function excelCellString(v: unknown): string {
    const s = String(v ?? "");
    return s.length > 32767 ? s.slice(0, 32767) : s;
}

function fmtDateTime(v: unknown): string {
    if (!v) return "";
    const d = v instanceof Date ? v : new Date(String(v));
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function safeParseArray(raw: unknown): any[] {
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "string" && raw.trim()) {
        try {
            const p = JSON.parse(raw);
            return Array.isArray(p) ? p : [];
        } catch {
            return [];
        }
    }
    return [];
}

function isTipoBicicleta(tipo: string): boolean {
    return String(tipo || "").trim() === "Bicicleta";
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

function applyHeaderRow(row: ExcelJS.Row, cols: number, fill: ExcelJS.Fill) {
    row.font = { bold: true };
    for (let c = 1; c <= cols; c++) {
        const cell = row.getCell(c);
        cell.fill = fill;
        cell.border = borderThin as ExcelJS.Borders;
        cell.alignment = { vertical: "middle", wrapText: true };
    }
}

function applyDataRow(row: ExcelJS.Row, cols: number) {
    row.eachCell((cell, col) => {
        if (col <= cols) {
            cell.border = borderThin;
            cell.alignment = { wrapText: true, vertical: "top" };
        }
    });
}

async function readBitacoraRevisionImageFile(bitacoraId: number, fileName: unknown): Promise<Buffer | null> {
    const base = path.basename(String(fileName ?? "").trim());
    if (!base || base === "." || base === "..") return null;
    const relParts = ["public", "uploads", "bitacora-vehiculos-detenidos", String(bitacoraId), "revision", base];
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
    if (lower.endsWith(".webp")) return "png";
    if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8) return "jpeg";
    if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50) return "png";
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

function orientationFromDimensions(naturalW: number, naturalH: number): "horizontal" | "vertical" {
    return naturalH > naturalW ? "vertical" : "horizontal";
}

/** Escala proporcional (contain) según orientación real de la imagen. */
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

function displaySizeForImageBuffer(buf: Buffer): { width: number; height: number } {
    const natural = readBitmapDimensions(buf);
    if (!natural) return { width: 340, height: 126 };
    const orient = orientationFromDimensions(natural.w, natural.h);
    return fitImageDisplaySize(natural.w, natural.h, orient);
}

function applyKvRowStyle(row: ExcelJS.Row, border: Partial<ExcelJS.Borders>) {
    row.getCell(1).border = border;
    row.getCell(2).border = border;
    row.getCell(1).alignment = { vertical: "top", wrapText: true };
    row.getCell(2).alignment = { vertical: "top", wrapText: true };
}

function formatItemValueDisplay(item: any): string {
    const value = excelCellString(item.value ?? "");
    const obs = item.observation ? excelCellString(item.observation) : "";
    if (value && obs) return `${value} (Obs: ${obs})`;
    if (value) return value;
    if (obs) return obs;
    return "—";
}

/** Solo la fila con la imagen (sin repetir etiqueta). */
function embedImageOnlyRow(
    wb: ExcelJS.Workbook,
    ws: ExcelJS.Worksheet,
    buf: Buffer,
    extension: "png" | "jpeg" | "gif",
    border: Partial<ExcelJS.Borders>,
    valueCol = 1.02,
): boolean {
    try {
        const { width: dw, height: dh } = displaySizeForImageBuffer(buf);
        const imgId = wb.addImage({ buffer: buf as any, extension });
        const imgRow = ws.addRow(["", ""]);
        const heightPt = Math.min(409, Math.max(48, Math.round((dh * 72) / 96 + 12)));
        imgRow.height = heightPt;
        const imgRow0 = imgRow.number - 1;
        ws.addImage(imgId, {
            tl: { col: valueCol, row: imgRow0 + 0.02 },
            ext: { width: dw, height: dh },
            editAs: "oneCell",
        });
        applyKvRowStyle(imgRow, border);
        return true;
    } catch {
        return false;
    }
}

function tryEmbedImageBuffer(
    wb: ExcelJS.Workbook,
    ws: ExcelJS.Worksheet,
    label: string,
    buf: Buffer,
    extension: "png" | "jpeg" | "gif",
    border: Partial<ExcelJS.Borders>,
    valueCol = 1.02,
): boolean {
    try {
        const lr = ws.addRow([label, ""]);
        applyKvRowStyle(lr, border);
        return embedImageOnlyRow(wb, ws, buf, extension, border, valueCol);
    } catch {
        return false;
    }
}

async function tryEmbedSignatureRow(
    wb: ExcelJS.Workbook,
    ws: ExcelJS.Worksheet,
    label: string,
    sigRaw: unknown,
    border: Partial<ExcelJS.Borders>,
): Promise<boolean> {
    const sig = parseSignatureDataForExcel(sigRaw);
    if (!sig) return false;
    try {
        const buf = Buffer.from(sig.base64, "base64");
        if (!buf.length) return false;
        return tryEmbedImageBuffer(wb, ws, label, buf, sig.extension, border);
    } catch {
        return false;
    }
}

async function appendKvRows(
    wb: ExcelJS.Workbook,
    ws: ExcelJS.Worksheet,
    items: any[],
    tipo: string,
    bitacoraId: number,
    border: Partial<ExcelJS.Borders>,
) {
    const bicicleta = isTipoBicicleta(tipo);
    for (const item of items) {
        if (!item || typeof item !== "object") continue;
        if (item.kind === "heading") {
            const hr = ws.addRow([excelCellString(item.label ?? item.title ?? ""), ""]);
            hr.getCell(1).font = { bold: true };
            hr.getCell(1).border = border;
            hr.getCell(2).border = border;
            continue;
        }
        const label = excelCellString(item.label ?? item.key ?? "");
        const key = String(item.key ?? "").toLowerCase();
        if (bicicleta && (key === "kilometraje" || key === "prox_cambio_aceite" || key === "rtv" || key === "marchamo")) {
            continue;
        }
        if (item.kind === "signature") {
            const embedded = await tryEmbedSignatureRow(wb, ws, label, item.value, border);
            if (!embedded) {
                const sr = ws.addRow([label, "— Sin firma —"]);
                sr.getCell(1).border = border;
                sr.getCell(2).border = border;
            }
            continue;
        }
        const images = Array.isArray(item.images) ? item.images : [];
        if (images.length > 0) {
            const dr = ws.addRow([label, formatItemValueDisplay(item)]);
            applyKvRowStyle(dr, border);
            for (const imgName of images) {
                const buf = await readBitacoraRevisionImageFile(bitacoraId, imgName);
                if (!buf || buf.length === 0) continue;
                const ext = inferExcelImageExtension(String(imgName), buf);
                embedImageOnlyRow(wb, ws, buf, ext, border);
            }
            continue;
        }
        const dr = ws.addRow([label, formatItemValueDisplay(item)]);
        applyKvRowStyle(dr, border);
    }
}

async function appendMovimientosRows(ws: ExcelJS.Worksheet, raw: unknown, border: Partial<ExcelJS.Borders>) {
    const movs = safeParseArray(raw);
    if (movs.length === 0) {
        const er = ws.addRow(["—", "Sin movimientos"]);
        er.getCell(1).border = border;
        er.getCell(2).border = border;
        return;
    }
    const hdr = ws.addRow(["Movimiento", "Detalle"]);
    hdr.font = { bold: true };
    hdr.getCell(1).border = border;
    hdr.getCell(2).border = border;
    for (const mov of movs) {
        if (!mov || typeof mov !== "object") continue;
        const parts: string[] = [];
        if (mov.fecha) parts.push(`Fecha: ${mov.fecha}`);
        if (mov.hora) parts.push(`Hora: ${mov.hora}`);
        if (mov.realizado_por) parts.push(`Por: ${mov.realizado_por}`);
        if (mov.autorizado_por) parts.push(`Autorizado: ${mov.autorizado_por}`);
        const dr = ws.addRow([excelCellString(mov.movimiento ?? ""), parts.join(" · ") || "—"]);
        dr.getCell(1).border = border;
        dr.getCell(2).border = border;
        dr.getCell(1).alignment = { vertical: "top", wrapText: true };
        dr.getCell(2).alignment = { vertical: "top", wrapText: true };
    }
}

export type RevisionVehiculoReportRow = {
    id: number;
    tipo: string;
    empresa_id: number;
    cliente_id: number;
    division_id: number;
    contrato_id: number;
    sucursal_id: number;
    puesto_id: number;
    vehiculo_id: number | null;
    empresa_txt: string;
    cliente_txt: string;
    division_txt: string;
    contrato_txt: string;
    corpo_txt: string;
    puesto_txt: string;
    vehiculo_txt: string;
    observaciones: string;
    created_at_txt: string;
    informacion_general: string;
    informacion_revision: string;
    movimientos_vehiculos: string;
    firma_responsable: string;
    info_general_count: number;
    info_revision_count: number;
    movimientos_count: number;
};

async function loadHierarchyMaps(
    prisma: ReportDataAccess,
    empresaIds: number[],
    clienteIds: number[],
    divisionIds: number[],
    contratoIds: number[],
    sucursalIds: number[],
    puestoIds: number[],
) {
    const [empresas, clientes, divisiones, contratos, sucursales, puestos] = await Promise.all([
        empresaIds.length
            ? prisma.e_estructura_empresa.findMany({
                  where: { id: { in: empresaIds } },
                  select: { id: true, nombre: true, codigo: true },
              })
            : [],
        clienteIds.length
            ? prisma.e_estructura_cliente.findMany({
                  where: { id: { in: clienteIds } },
                  select: { id: true, nombre: true },
              })
            : [],
        divisionIds.length
            ? prisma.n_division.findMany({
                  where: { id: { in: divisionIds } },
                  select: { id: true, nombre: true, codigo: true },
              })
            : [],
        contratoIds.length
            ? prisma.e_estructura_contrato.findMany({
                  where: { id: { in: contratoIds } },
                  select: { id: true, nombre: true, nro_contrato: true },
              })
            : [],
        sucursalIds.length
            ? prisma.e_estructura_sucursal.findMany({
                  where: { id: { in: sucursalIds } },
                  select: { id: true, nombre: true, nro_sucursal: true },
              })
            : [],
        puestoIds.length
            ? prisma.e_estructura_puesto.findMany({
                  where: { id: { in: puestoIds } },
                  select: { id: true, nombre: true, codigo: true },
              })
            : [],
    ]);
    return {
        empresaMap: new Map(empresas.map((e) => [e.id, e.nombre || e.codigo || String(e.id)])),
        clienteMap: new Map(clientes.map((c) => [c.id, c.nombre || String(c.id)])),
        divisionMap: new Map(divisiones.map((d) => [d.id, d.nombre || d.codigo || String(d.id)])),
        contratoMap: new Map(contratos.map((c) => [c.id, c.nombre || c.nro_contrato || String(c.id)])),
        sucursalMap: new Map(sucursales.map((s) => [s.id, s.nombre || s.nro_sucursal || String(s.id)])),
        puestoMap: new Map(puestos.map((p) => [p.id, p.nombre || p.codigo || String(p.id)])),
    };
}

function sortRevisionRows(rows: RevisionVehiculoReportRow[], orderKey: RevisionVehiculosOrderKey): RevisionVehiculoReportRow[] {
    const key = orderKey || "puesto_id";
    const cmpStr = (a: string, b: string) => a.localeCompare(b, "es");
    return [...rows].sort((a, b) => {
        if (key === "created_at") return cmpStr(a.created_at_txt, b.created_at_txt);
        if (key === "empresa_id") return cmpStr(a.empresa_txt, b.empresa_txt) || a.id - b.id;
        if (key === "cliente_id") return cmpStr(a.cliente_txt, b.cliente_txt) || a.id - b.id;
        if (key === "division_id") return cmpStr(a.division_txt, b.division_txt) || a.id - b.id;
        if (key === "contrato_id") return cmpStr(a.contrato_txt, b.contrato_txt) || a.id - b.id;
        if (key === "corpo_id") return cmpStr(a.corpo_txt, b.corpo_txt) || a.id - b.id;
        return cmpStr(a.puesto_txt, b.puesto_txt) || a.id - b.id;
    });
}

export async function queryRevisionVehiculosRows(
    prisma: ReportDataAccess,
    filters: RevisionVehiculosModuleFilters,
    orderKey: RevisionVehiculosOrderKey,
): Promise<RevisionVehiculoReportRow[]> {
    const where: any = { isActive: true };
    const desde = parseBoundaryDateTime(filters.creadoDesde);
    const hasta = parseBoundaryDateTime(filters.creadoHasta);
    if (desde || hasta) {
        where.created_at = {};
        if (desde) where.created_at.gte = desde;
        if (hasta) where.created_at.lte = hasta;
    }
    if (filters.empresaIds?.length) where.empresa_id = { in: filters.empresaIds };
    if (filters.clienteIds?.length) where.cliente_id = { in: filters.clienteIds };
    if (filters.divisionIds?.length) where.division_id = { in: filters.divisionIds };
    if (filters.contratoIds?.length) where.contrato_id = { in: filters.contratoIds };
    if (filters.corpoIds?.length) where.sucursal_id = { in: filters.corpoIds };
    if (filters.puestoIds?.length) where.puesto_id = { in: filters.puestoIds };
    if (filters.vehiculoIds?.length) where.vehiculo_id = { in: filters.vehiculoIds };

    const raw = await prisma.c_bitacora_vehiculo_detenido.findMany({
        where,
        orderBy: { id: "asc" },
    });

    const vehIds = [...new Set(raw.map((r) => r.vehiculo_id).filter((id): id is number => id != null && id > 0))];
    const vehiculos =
        vehIds.length > 0
            ? await prisma.c_vehiculos_corporativos.findMany({
                  where: { id: { in: vehIds } },
                  select: { id: true, placa: true, marca: true, modelo: true, tipo: true },
              })
            : [];
    const vehMap = new Map(
        vehiculos.map((v) => [
            v.id,
            `${v.placa || "Sin placa"} · ${v.marca || ""} ${v.modelo || ""} (${v.tipo || ""})`.trim(),
        ]),
    );

    const empresaIds = [...new Set(raw.map((r) => r.empresa_id).filter((id) => id > 0))];
    const clienteIds = [...new Set(raw.map((r) => r.cliente_id).filter((id) => id > 0))];
    const divisionIds = [...new Set(raw.map((r) => r.division_id).filter((id) => id > 0))];
    const contratoIds = [...new Set(raw.map((r) => r.contrato_id).filter((id) => id > 0))];
    const sucursalIds = [...new Set(raw.map((r) => r.sucursal_id).filter((id) => id > 0))];
    const puestoIds = [...new Set(raw.map((r) => r.puesto_id).filter((id) => id > 0))];
    const maps = await loadHierarchyMaps(prisma, empresaIds, clienteIds, divisionIds, contratoIds, sucursalIds, puestoIds);

    const out: RevisionVehiculoReportRow[] = [];
    for (const r of raw) {
        const infoG = safeParseArray(r.informacion_general);
        const infoR = parseInformacionRevision(r.informacion_revision);
        const movs = safeParseArray(r.movimientos_vehiculos);
        out.push({
            id: r.id,
            tipo: r.tipo ?? "",
            empresa_id: r.empresa_id,
            cliente_id: r.cliente_id,
            division_id: r.division_id,
            contrato_id: r.contrato_id,
            sucursal_id: r.sucursal_id,
            puesto_id: r.puesto_id,
            vehiculo_id: r.vehiculo_id,
            empresa_txt: maps.empresaMap.get(r.empresa_id) ?? String(r.empresa_id),
            cliente_txt: maps.clienteMap.get(r.cliente_id) ?? String(r.cliente_id),
            division_txt: maps.divisionMap.get(r.division_id) ?? String(r.division_id),
            contrato_txt: maps.contratoMap.get(r.contrato_id) ?? String(r.contrato_id),
            corpo_txt: maps.sucursalMap.get(r.sucursal_id) ?? String(r.sucursal_id),
            puesto_txt: maps.puestoMap.get(r.puesto_id) ?? String(r.puesto_id),
            vehiculo_txt: r.vehiculo_id ? vehMap.get(r.vehiculo_id) ?? String(r.vehiculo_id) : "—",
            observaciones: r.observaciones ?? "",
            created_at_txt: fmtDateTime(r.created_at),
            informacion_general: r.informacion_general,
            informacion_revision: r.informacion_revision,
            movimientos_vehiculos: r.movimientos_vehiculos,
            firma_responsable: r.firma_responsable,
            info_general_count: infoG.length,
            info_revision_count: infoR.length,
            movimientos_count: movs.length,
        });
    }

    return sortRevisionRows(out, orderKey);
}

export async function searchCorporateVehiclesForReport(prisma: ReportDataAccess, q: string) {
    const term = String(q || "").trim();
    if (!term) return [];
    const rows = await prisma.c_vehiculos_corporativos.findMany({
        where: {
            isActive: true,
            OR: [{ placa: { contains: term } }, { modelo: { contains: term } }, { marca: { contains: term } }],
        },
        take: 50,
        select: {
            id: true,
            placa: true,
            marca: true,
            modelo: true,
            tipo: true,
            sucursal_id: true,
        },
        orderBy: { placa: "asc" },
    });
    const sucIds = [...new Set(rows.map((r) => r.sucursal_id).filter((id) => id > 0))];
    const sucursales =
        sucIds.length > 0
            ? await prisma.e_estructura_sucursal.findMany({
                  where: { id: { in: sucIds } },
                  select: { id: true, nombre: true, nro_sucursal: true },
              })
            : [];
    const sucMap = new Map(sucursales.map((s) => [s.id, s.nombre || s.nro_sucursal || String(s.id)]));
    return rows.map((v) => ({
        id: v.id,
        placa: v.placa,
        marca: v.marca,
        modelo: v.modelo,
        tipo: v.tipo,
        sucursal_id: v.sucursal_id,
        corpo_nombre: sucMap.get(v.sucursal_id) ?? "",
    }));
}

export async function buildRevisionVehiculosExcelConsolidado(rows: RevisionVehiculoReportRow[]): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const wsMain = wb.addWorksheet("Revisiones");
    const wsDet = wb.addWorksheet("Detalles");
    const border = borderThin;

    const anchorGen = new Map<number, number>();
    const anchorRev = new Map<number, number>();
    const anchorMov = new Map<number, number>();

    for (const r of rows) {
        const label = excelCellString(`${r.puesto_txt} | ${r.vehiculo_txt} | ${r.tipo} | ID ${r.id}`);

        const startGen = wsDet.rowCount + 1;
        anchorGen.set(r.id, startGen);
        wsDet.mergeCells(startGen, 1, startGen, 2);
        const titleGen = wsDet.getCell(startGen, 1);
        titleGen.value = `${label} — Información general`;
        titleGen.font = { bold: true };
        titleGen.fill = INFO_GEN_HDR;
        for (let c = 1; c <= 2; c++) wsDet.getCell(startGen, c).border = border;
        const hGen = wsDet.addRow(["Campo", "Valor"]);
        applyHeaderRow(hGen, 2, INFO_GEN_HDR);
        await appendKvRows(wb, wsDet, safeParseArray(r.informacion_general), r.tipo, r.id, border);
        wsDet.addRow([]);

        const startRev = wsDet.rowCount + 1;
        anchorRev.set(r.id, startRev);
        wsDet.mergeCells(startRev, 1, startRev, 2);
        const titleRev = wsDet.getCell(startRev, 1);
        titleRev.value = `${label} — Información de revisión`;
        titleRev.font = { bold: true };
        titleRev.fill = INFO_REV_HDR;
        for (let c = 1; c <= 2; c++) wsDet.getCell(startRev, c).border = border;
        const hRev = wsDet.addRow(["Campo", "Valor"]);
        applyHeaderRow(hRev, 2, INFO_REV_HDR);
        await appendKvRows(wb, wsDet, parseInformacionRevision(r.informacion_revision), r.tipo, r.id, border);
        wsDet.addRow([]);

        const startMov = wsDet.rowCount + 1;
        anchorMov.set(r.id, startMov);
        wsDet.mergeCells(startMov, 1, startMov, 2);
        const titleMov = wsDet.getCell(startMov, 1);
        titleMov.value = `${label} — Movimientos`;
        titleMov.font = { bold: true };
        titleMov.fill = MOV_HDR;
        for (let c = 1; c <= 2; c++) wsDet.getCell(startMov, c).border = border;
        await appendMovimientosRows(wsDet, r.movimientos_vehiculos, border);
        wsDet.addRow([]);

        const firTitle = wsDet.addRow(["Firma responsable", ""]);
        firTitle.getCell(1).font = { bold: true };
        firTitle.getCell(1).border = border;
        firTitle.getCell(2).border = border;
        const embeddedFirma = await tryEmbedSignatureRow(wb, wsDet, "Firma", r.firma_responsable, border);
        if (!embeddedFirma) {
            const fr = wsDet.addRow(["", excelCellString(r.firma_responsable).slice(0, 200) || "—"]);
            fr.getCell(1).border = border;
            fr.getCell(2).border = border;
        }
        wsDet.addRow([]);
    }

    /** Cuadrícula jerárquica: Registro (nivel 0) → Ítem info. general / Ítem info. revisión / Movimiento, hermanos (nivel 1). */
    wsMain.properties.outlineProperties = { summaryBelow: false, summaryRight: false };

    const mainHeaders = [
        "ID de fila",
        "ID fila padre",
        "Nivel",
        "Tipo de fila",
        "ID Registro",
        "Empresa",
        "Cliente",
        "División",
        "Contrato",
        "Sucursal",
        "Puesto",
        "Tipo",
        "Vehículo",
        "Observaciones",
        "Fecha de creación",
        "Ver información general",
        "Ver información de revisión",
        "Ver movimientos",
        "Campo (ítem)",
        "Valor (ítem)",
        "Observación (ítem)",
        "Movimiento",
        "Fecha (movimiento)",
        "Hora (movimiento)",
        "Realizado por (movimiento)",
        "Autorizado por (movimiento)",
    ];
    const colGen = mainHeaders.indexOf("Ver información general") + 1;
    const colRev = mainHeaders.indexOf("Ver información de revisión") + 1;
    const colMov = mainHeaders.indexOf("Ver movimientos") + 1;
    const COL_TIPO_FILA = mainHeaders.indexOf("Tipo de fila") + 1;
    const linkCols = new Set([colGen, colRev, colMov]);
    wsMain.addRow(mainHeaders);
    applyHeaderRow(wsMain.getRow(1), mainHeaders.length, GRP_HDR);

    const styleDataRow = (row: ExcelJS.Row, nivel: number) => {
        row.eachCell((cell, col) => {
            if (linkCols.has(col)) return;
            cell.border = borderThin;
            cell.alignment = { wrapText: true, vertical: "top" };
        });
        for (const c of linkCols) row.getCell(c).border = borderThin;
        row.getCell(COL_TIPO_FILA).alignment = { vertical: "top", horizontal: "left", wrapText: true, indent: nivel };
        row.outlineLevel = nivel;
        if (nivel === 0) row.getCell(COL_TIPO_FILA).font = { bold: true };
    };

    for (const r of rows) {
        const linkGen = r.info_general_count > 0 ? `Ver información general (${r.info_general_count})` : "";
        const linkRev = r.info_revision_count > 0 ? `Ver revisión (${r.info_revision_count})` : "";
        const linkMov = r.movimientos_count > 0 ? `Ver movimientos (${r.movimientos_count})` : "";
        const general: Record<number, unknown> = {
            [mainHeaders.indexOf("ID Registro") + 1]: r.id,
            [mainHeaders.indexOf("Empresa") + 1]: r.empresa_txt,
            [mainHeaders.indexOf("Cliente") + 1]: r.cliente_txt,
            [mainHeaders.indexOf("División") + 1]: r.division_txt,
            [mainHeaders.indexOf("Contrato") + 1]: r.contrato_txt,
            [mainHeaders.indexOf("Sucursal") + 1]: r.corpo_txt,
            [mainHeaders.indexOf("Puesto") + 1]: r.puesto_txt,
            [mainHeaders.indexOf("Tipo") + 1]: r.tipo,
            [mainHeaders.indexOf("Vehículo") + 1]: r.vehiculo_txt,
            [mainHeaders.indexOf("Observaciones") + 1]: excelCellString(r.observaciones).slice(0, 500),
            [mainHeaders.indexOf("Fecha de creación") + 1]: r.created_at_txt,
        };

        const rootValues = new Array(mainHeaders.length).fill("");
        rootValues[0] = String(r.id);
        rootValues[2] = 0;
        rootValues[3] = "Registro";
        for (const [col, val] of Object.entries(general)) rootValues[Number(col) - 1] = val;
        rootValues[colGen - 1] = linkGen || "—";
        rootValues[colRev - 1] = linkRev || "—";
        rootValues[colMov - 1] = linkMov || "—";
        const rootRow = wsMain.addRow(rootValues);

        const aGen = anchorGen.get(r.id);
        if (aGen && linkGen) {
            const cell = rootRow.getCell(colGen);
            cell.value = { text: linkGen, hyperlink: `#'Detalles'!A${aGen}` };
            cell.font = { color: { argb: "FF0563C1" }, underline: true };
        }
        const aRev = anchorRev.get(r.id);
        if (aRev && linkRev) {
            const cell = rootRow.getCell(colRev);
            cell.value = { text: linkRev, hyperlink: `#'Detalles'!A${aRev}` };
            cell.font = { color: { argb: "FF0563C1" }, underline: true };
        }
        const aMov = anchorMov.get(r.id);
        if (aMov && linkMov) {
            const cell = rootRow.getCell(colMov);
            cell.value = { text: linkMov, hyperlink: `#'Detalles'!A${aMov}` };
            cell.font = { color: { argb: "FF0563C1" }, underline: true };
        }
        styleDataRow(rootRow, 0);

        const itemRow = (tipo: string, idPrefix: string, item: any, idx: number) => {
            const values = new Array(mainHeaders.length).fill("");
            values[0] = `${r.id}.${idPrefix}${idx + 1}`;
            values[1] = String(r.id);
            values[2] = 1;
            values[3] = tipo;
            for (const [col, val] of Object.entries(general)) values[Number(col) - 1] = val;
            if (item?.kind === "heading") {
                values[mainHeaders.indexOf("Campo (ítem)")] = excelCellString(item.label ?? item.title ?? "");
            } else {
                values[mainHeaders.indexOf("Campo (ítem)")] = excelCellString(item?.label ?? item?.key ?? "");
                if (item?.kind === "signature") {
                    values[mainHeaders.indexOf("Valor (ítem)")] = item?.value ? "Tiene firma" : "Sin firma";
                } else {
                    values[mainHeaders.indexOf("Valor (ítem)")] = excelCellString(item?.value ?? "");
                }
                values[mainHeaders.indexOf("Observación (ítem)")] = excelCellString(item?.observation ?? "");
            }
            const row = wsMain.addRow(values);
            styleDataRow(row, 1);
        };

        safeParseArray(r.informacion_general).forEach((item: any, idx: number) => itemRow("Ítem info. general", "ig", item, idx));
        parseInformacionRevision(r.informacion_revision).forEach((item: any, idx: number) => itemRow("Ítem info. revisión", "ir", item, idx));

        safeParseArray(r.movimientos_vehiculos).forEach((mov: any, idx: number) => {
            const values = new Array(mainHeaders.length).fill("");
            values[0] = `${r.id}.mov${idx + 1}`;
            values[1] = String(r.id);
            values[2] = 1;
            values[3] = "Movimiento";
            for (const [col, val] of Object.entries(general)) values[Number(col) - 1] = val;
            values[mainHeaders.indexOf("Movimiento")] = excelCellString(mov?.movimiento ?? "");
            values[mainHeaders.indexOf("Fecha (movimiento)")] = excelCellString(mov?.fecha ?? "");
            values[mainHeaders.indexOf("Hora (movimiento)")] = excelCellString(mov?.hora ?? "");
            values[mainHeaders.indexOf("Realizado por (movimiento)")] = excelCellString(mov?.realizado_por ?? "");
            values[mainHeaders.indexOf("Autorizado por (movimiento)")] = excelCellString(mov?.autorizado_por ?? "");
            const row = wsMain.addRow(values);
            styleDataRow(row, 1);
        });
    }

    wsMain.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: Math.max(1, wsMain.rowCount), column: mainHeaders.length },
    };

    wsMain.columns = [
        12, 14, 8, 20, 10,
        28, 24, 22, 28, 24, 28,
        14, 32, 36, 20,
        20, 24, 18,
        26, 30, 30,
        22, 18, 14, 22, 22,
    ].map((w) => ({ width: w }));
    wsDet.columns = [32, 48].map((w) => ({ width: w }));

    return Buffer.from(await wb.xlsx.writeBuffer());
}
