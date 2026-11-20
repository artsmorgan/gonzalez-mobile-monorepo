/* eslint-disable @typescript-eslint/no-explicit-any */
import fsPromises from "fs/promises";
import path from "path";
import ExcelJS from "exceljs";
import type { RevisionVehiculoReportRow } from "./revisionVehiculosReport";

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

const COL_AI = 35;
const DOC_TITLE = "BITÁCORA DE REVISIÓN DE VEHÍCULO DETENIDO";

export const HDR_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3D63" } } as const;
export const FILL_WHITE = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } } as const;
export const HDR_FONT = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 } as const;
export const SIGNATURE_ROW_HEIGHT = 38;
const MOTOR_FIRST_ROW = 58;
const MOTOR_LAST_ROW = 61;

const borderThin: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FF000000" } },
    left: { style: "thin", color: { argb: "FF000000" } },
    bottom: { style: "thin", color: { argb: "FF000000" } },
    right: { style: "thin", color: { argb: "FF000000" } },
};

const borderHOnly: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FF000000" } },
    bottom: { style: "thin", color: { argb: "FF000000" } },
};

const borderOuter: Partial<ExcelJS.Borders> = {
    top: { style: "medium", color: { argb: "FF000000" } },
    left: { style: "medium", color: { argb: "FF000000" } },
    bottom: { style: "medium", color: { argb: "FF000000" } },
    right: { style: "medium", color: { argb: "FF000000" } },
};

/** Lista alineada con `buildRevisionConfig('Vehículo')` en BitacoraVehiculosDetenidosScreen. */
const VEHICULO_EXTERNAL_LABELS = [
    "Placa delantera",
    "Bumper delantero",
    "Silvin izquierdo delantero",
    "Direccional izquierdo delantero",
    "Direccional derecho delantero",
    "Silvin derecho delantero",
    "Luces para neblina",
    "Parrilla delantera",
    "Tapa de motor",
    "Parabrisas delantero",
    "Escobillas",
    "Guardabarro derecho delanter",
    "Llanta delantera derecha",
    "Aro delantero derecho",
    "Copa delantera derecha",
    "Puerta delantera derecha",
    "Puerta trasera derecha",
    "Espejo lateral derecho",
    "Costado derecho de pintura",
    "Costado derecho de vidrios",
    "Costado derecho de carrocería",
    "Guardabarro trasero derecho",
    "Llanta trasera derecha",
    "Aro trasero derecho",
    "Copa trasera derecha",
    "Bumper trasero",
    "Cajón o batea",
    "Cabina posterior",
    "Placa trasera",
    "Luces de placa trasera",
    "Direccional trasero derecho",
    "Direccional trasero izquierdo",
    "Parabrisas trasero",
    "Guardabarro trasero izquierdo",
    "Llanta trasera izquierda",
    "Aro trasero izquierdo",
    "Copa trasera izquierda",
    "Puerta trasera izquierda",
    "Puerta delantera izquierda",
    "Espejo lateral izquierdo",
    "Costado izquierdo de pintura",
    "Costado izquierdo de vidrios",
    "Costado izquierdo de carrocería",
    "Guardabarro delantero izquierdo",
    "Llanta izquierda delantera",
    "Aro delantero izquierdo",
    "Copa delantera izquierda",
    "Techo de vehículo",
    "Canasta",
] as const;

const VEHICULO_INTERNAL_LABELS = [
    "Velocímetro",
    "Espejo retrovisor interno",
    "Alfombras",
    "Asientos delanteros",
    "Asientos traseros",
    "Cubreasientos",
    "Silla porta menores de edad",
    "Búster para menores",
    "Cinturones de seguridad",
    "Hules de pedales",
    "Perilla de marcha",
    "Encendedor",
    "Ceniceros",
    "Radio musical (Marca)",
    "Planta de radio",
    "Parlantes para radio",
    "Discos o Cd's",
    "Casetes",
    "Antena musical",
    "Herramientas ¿Cuántas?",
    "Llave rana",
    "Gata",
    "Triangulo de seguridad",
    "Extintor de incendios",
    "Botiquín de primeros auxilios",
    "Lagartos",
    "Chaleco",
    "Conos",
    "Llanta de repuesto",
    "Llave de ignición del vehículo",
    "Tapón de radiado",
    "Tapón de aceite",
    "Batería (Acumulador)",
    "Depurador",
    "Carburador",
    "Tapa carburador",
    "Bobina",
    "Distribuidor",
    "Mangueras del distribuidor",
    "Chupones de las bujías",
    "Mangueras",
    "Alternador o generador",
    "Arrancador",
    "Mufla o silenciador",
    "Tapón de combustible",
] as const;

function labelToRevisionKey(label: string): string {
    return `rev_${label.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
}

function colIndex(letters: string): number {
    let n = 0;
    for (const ch of letters.toUpperCase()) {
        n = n * 26 + (ch.charCodeAt(0) - 64);
    }
    return n;
}

export function excelCellString(v: unknown): string {
    const s = String(v ?? "");
    return s.length > 32767 ? s.slice(0, 32767) : s;
}

export function safeParseArray(raw: unknown): any[] {
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

export function buildInfoGeneralMap(raw: string): Map<string, string> {
    const m = new Map<string, string>();
    for (const item of safeParseArray(raw)) {
        if (!item || typeof item !== "object") continue;
        const key = String(item.key ?? "").trim();
        if (!key) continue;
        if (item.kind === "signature") {
            m.set(key, String(item.value ?? ""));
        } else {
            m.set(key, excelCellString(item.value ?? ""));
        }
    }
    return m;
}

export function getInfoValue(m: Map<string, string>, ...keys: string[]): string {
    for (const k of keys) {
        if (m.has(k)) return m.get(k) ?? "";
    }
    return "";
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

function readPngDimensions(buf: Buffer): { w: number; h: number } | null {
    if (buf.length < 24) return null;
    if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) return null;
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function readJpegDimensions(buf: Buffer): { w: number; h: number } | null {
    let i = 2;
    while (i < buf.length - 1) {
        if (buf[i] !== 0xff) {
            i++;
            continue;
        }
        const marker = buf[i + 1];
        if (marker === 0xd9) break;
        if (i + 3 >= buf.length) break;
        const segLen = buf.readUInt16BE(i + 2);
        if (segLen < 2 || i + 2 + segLen > buf.length) break;
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
            if (i + 9 <= buf.length) {
                const h = buf.readUInt16BE(i + 5);
                const w = buf.readUInt16BE(i + 7);
                if (w > 0 && h > 0) return { w, h };
            }
        }
        i += 2 + segLen;
    }
    return null;
}

function readBitmapDimensions(buf: Buffer): { w: number; h: number } | null {
    return readPngDimensions(buf) ?? readJpegDimensions(buf);
}

export function fitImageInBox(naturalW: number, naturalH: number, maxW: number, maxH: number): { width: number; height: number } {
    const scale = Math.min(maxW / naturalW, maxH / naturalH, 1);
    return {
        width: Math.max(1, Math.round(naturalW * scale)),
        height: Math.max(1, Math.round(naturalH * scale)),
    };
}

export function logoExtentForCellBox(natural: { w: number; h: number } | null, maxW: number, maxH: number) {
    if (!natural || natural.w <= 0 || natural.h <= 0) return { width: 72, height: 40 };
    const s = Math.min(maxW / natural.w, maxH / natural.h, 1);
    return { width: Math.max(1, Math.round(natural.w * s)), height: Math.max(1, Math.round(natural.h * s)) };
}

export async function readPngPixelSize(filePath: string): Promise<{ w: number; h: number } | null> {
    try {
        const buf = await fsPromises.readFile(filePath);
        return readPngDimensions(buf);
    } catch {
        return null;
    }
}

export async function resolveLogoPath(empresaId: number): Promise<string | null> {
    const logoName = empresaId === 9 ? "9.png" : empresaId === 10 ? "10.png" : null;
    if (!logoName) return null;
    const candidates = [
        path.resolve(process.cwd(), "app", "logo-images", logoName),
        path.resolve(process.cwd(), "apps", "server", "app", "logo-images", logoName),
    ];
    for (const p of candidates) {
        try {
            await fsPromises.access(p);
            return p;
        } catch {
            /* ignore */
        }
    }
    return null;
}

export function sanitizeSheetName(raw: string): string {
    const s = String(raw || "Hoja")
        .replace(/[\\/*?:[\]]/g, "_")
        .slice(0, 31);
    return s || "Hoja";
}

export function mergeSet(
    ws: ExcelJS.Worksheet,
    r1: number,
    c1: number,
    r2: number,
    c2: number,
    value?: string,
    opts?: {
        fill?: ExcelJS.Fill;
        font?: Partial<ExcelJS.Font>;
        align?: Partial<ExcelJS.Alignment>;
        applyCellBorders?: boolean;
    },
) {
    ws.mergeCells(r1, c1, r2, c2);
    const cell = ws.getCell(r1, c1);
    if (value !== undefined) cell.value = value;
    if (opts?.fill) cell.fill = opts.fill;
    if (opts?.font) cell.font = { ...(cell.font || {}), ...opts.font };
    if (opts?.align) cell.alignment = { vertical: "middle", wrapText: true, ...opts.align };
    const withBorders = opts?.applyCellBorders !== false;
    for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
            const cl = ws.getCell(r, c);
            if (opts?.fill) cl.fill = opts.fill;
            if (withBorders) cl.border = { ...(cl.border || {}), ...borderThin };
        }
    }
}

export function applyRangeFill(ws: ExcelJS.Worksheet, r1: number, c1: number, r2: number, c2: number, fill: ExcelJS.Fill) {
    for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
            ws.getCell(r, c).fill = fill;
        }
    }
}

export function clearRangeBorders(ws: ExcelJS.Worksheet, r1: number, c1: number, r2: number, c2: number) {
    for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
            ws.getCell(r, c).border = {};
        }
    }
}

function applyRangeBorder(ws: ExcelJS.Worksheet, r1: number, c1: number, r2: number, c2: number, border: Partial<ExcelJS.Borders>) {
    for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
            ws.getCell(r, c).border = border;
        }
    }
}

export function applyHorizontalRows(ws: ExcelJS.Worksheet, r1: number, r2: number, c1: number, c2: number) {
    for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
            ws.getCell(r, c).border = borderHOnly;
        }
    }
}

export function applyBottomBorderRows(ws: ExcelJS.Worksheet, r1: number, r2: number, c1: number, c2: number) {
    for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
            const cell = ws.getCell(r, c);
            cell.border = { ...cell.border, bottom: borderThin.bottom };
        }
    }
}

export function applyOuterGrid(ws: ExcelJS.Worksheet, r1: number, c1: number, r2: number, c2: number) {
    for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
            const cell = ws.getCell(r, c);
            const b: Partial<ExcelJS.Borders> = {};
            if (r === r1) b.top = borderOuter.top;
            if (r === r2) b.bottom = borderOuter.bottom;
            if (c === c1) b.left = borderOuter.left;
            if (c === c2) b.right = borderOuter.right;
            cell.border = { ...cell.border, ...b };
        }
    }
}

export async function embedSignatureInRange(
    wb: ExcelJS.Workbook,
    ws: ExcelJS.Worksheet,
    sigRaw: string,
    r1: number,
    c1: number,
    r2: number,
    c2: number,
) {
    const sig = parseSignatureDataForExcel(sigRaw);
    if (!sig) return;
    try {
        const buf = Buffer.from(sig.base64, "base64");
        if (!buf.length) return;
        const natural = readBitmapDimensions(buf);
        const { width: dw, height: dh } = natural
            ? fitImageInBox(natural.w, natural.h, 128, 30)
            : { width: 108, height: 28 };
        const imgId = wb.addImage({ base64: sig.base64, extension: sig.extension });
        ws.mergeCells(r1, c1, r2, c2);
        const colSpan = c2 - c1 + 1;
        const rowSpan = r2 - r1 + 1;
        const col0 = c1 - 1 + Math.max(0.05, (colSpan - dw / 28) / (2 * colSpan));
        const row0 = r1 - 1 + Math.max(0.12, (rowSpan - dh / 18) / (2 * rowSpan));
        ws.addImage(imgId, {
            tl: { col: col0, row: row0 },
            ext: { width: dw, height: dh },
            editAs: "oneCell",
        });
    } catch {
        /* ignore */
    }
}

export function setLabelValueRow(
    ws: ExcelJS.Worksheet,
    row: number,
    labelCol1: number,
    labelCol2: number,
    label: string,
    valCol1: number,
    valCol2: number,
    value: string,
    horizontalOnly: boolean,
) {
    mergeSet(ws, row, labelCol1, row, labelCol2, label, {
        font: { bold: true, size: 9 },
        align: { horizontal: "left", vertical: "middle" },
    });
    mergeSet(ws, row, valCol1, row, valCol2, value, { align: { horizontal: "left", vertical: "middle", wrapText: true } });
    if (horizontalOnly) {
        applyHorizontalRows(ws, row, row, labelCol1, valCol2);
    }
}

function buildRevisionEntryMap(raw: string): Map<string, any> {
    const m = new Map<string, any>();
    for (const entry of parseInformacionRevision(raw)) {
        if (!entry || typeof entry !== "object") continue;
        if (entry.kind === "heading") continue;
        const key = String(entry.key ?? "");
        if (key) m.set(key, entry);
    }
    return m;
}

export function findRevisionByLabel(revMap: Map<string, any>, label: string): any {
    const k = labelToRevisionKey(label);
    if (revMap.has(k)) return revMap.get(k);
    for (const [, entry] of revMap) {
        if (String(entry?.label ?? "").trim() === label) return entry;
    }
    return undefined;
}

function estadoDisplayText(value: string): string {
    const norm = String(value ?? "").trim().toLowerCase();
    if (norm === "bueno") return "Bueno";
    if (norm === "malo") return "Malo";
    if (norm === "no está" || norm === "no esta" || norm === "no existe") return "No está";
    return "";
}

export function writeEstadoMerged(ws: ExcelJS.Worksheet, row: number, c1: number, c2: number, value: string) {
    mergeSet(ws, row, c1, row, c2, estadoDisplayText(value), {
        font: { size: 8 },
        align: { horizontal: "center", vertical: "middle" },
    });
}

function writeAccessoryRow(
    ws: ExcelJS.Worksheet,
    row: number,
    descC1: number,
    descC2: number,
    estC1: number,
    estC2: number,
    obsC1: number,
    obsC2: number,
    label: string,
    entry: any | undefined,
) {
    mergeSet(ws, row, descC1, row, descC2, label, { font: { size: 8 }, align: { vertical: "middle", wrapText: true } });
    writeEstadoMerged(ws, row, estC1, estC2, entry?.value ?? "");
    mergeSet(ws, row, obsC1, row, obsC2, excelCellString(entry?.observation ?? ""), {
        font: { size: 8 },
        align: { vertical: "middle", wrapText: true },
    });
}

export async function buildVehiculoIndividualSheet(
    wb: ExcelJS.Workbook,
    record: RevisionVehiculoReportRow,
    reportNombre: string,
): Promise<void> {
    const sheetName = sanitizeSheetName(`Rev-${record.id}`);
    const ws = wb.addWorksheet(sheetName);

    for (let c = 1; c <= COL_AI; c++) {
        ws.getColumn(c).width = 2.85;
    }
    ws.getRow(1).height = 24;
    ws.getRow(2).height = 24;
    ws.getRow(4).height = SIGNATURE_ROW_HEIGHT;
    ws.getRow(5).height = SIGNATURE_ROW_HEIGHT;
    ws.getRow(9).height = SIGNATURE_ROW_HEIGHT;

    const info = buildInfoGeneralMap(record.informacion_general);
    const revMap = buildRevisionEntryMap(record.informacion_revision);
    const movs = safeParseArray(record.movimientos_vehiculos);

    const cH = colIndex("H");
    const cAB = colIndex("AB");
    const cAC = colIndex("AC");
    const cAI = colIndex("AI");

    mergeSet(ws, 1, 1, 2, colIndex("G"), undefined, { applyCellBorders: true });
    const logoPath = await resolveLogoPath(record.empresa_id);
    if (logoPath) {
        try {
            const logoNat = await readPngPixelSize(logoPath);
            const logoExt = logoExtentForCellBox(logoNat, 108, 42);
            const imgId = wb.addImage({ filename: logoPath, extension: "png" });
            ws.addImage(imgId, {
                tl: { col: 0.18, row: 0.12 },
                ext: logoExt,
                editAs: "oneCell",
            });
        } catch {
            /* ignore */
        }
    }

    mergeSet(ws, 1, cH, 2, cAB, DOC_TITLE, {
        fill: HDR_FILL,
        font: HDR_FONT,
        align: { horizontal: "center", vertical: "middle" },
    });
    mergeSet(ws, 1, cAC, 2, cAI, reportNombre || "—", {
        fill: FILL_WHITE,
        font: { bold: true, color: { argb: "FF000000" }, size: 9 },
        align: { horizontal: "center", vertical: "middle", wrapText: true },
    });

    mergeSet(ws, 3, 1, 3, COL_AI, "INFORMACIÓN OFICIAL", {
        fill: HDR_FILL,
        font: HDR_FONT,
        align: { horizontal: "center", vertical: "middle" },
    });

    setLabelValueRow(ws, 4, 1, colIndex("F"), "Oficial de tránsito:", colIndex("G"), colIndex("R"), getInfoValue(info, "oficial_transito"), true);
    setLabelValueRow(ws, 4, colIndex("S"), colIndex("U"), "Código:", colIndex("V"), colIndex("Y"), getInfoValue(info, "codigo_oficial_transito"), true);
    mergeSet(ws, 4, colIndex("Z"), 4, colIndex("AA"), "Firma:", { font: { bold: true, size: 9 }, align: { horizontal: "center" } });
    await embedSignatureInRange(wb, ws, getInfoValue(info, "firma_oficial_transito"), 4, colIndex("AB"), 4, COL_AI);
    applyHorizontalRows(ws, 4, 4, colIndex("Z"), COL_AI);

    setLabelValueRow(
        ws,
        5,
        1,
        colIndex("H"),
        "Nombre oficial de seguridad:",
        colIndex("I"),
        colIndex("R"),
        getInfoValue(info, "oficial_seguridad", "nombre_oficial_seguridad"),
        true,
    );
    setLabelValueRow(ws, 5, colIndex("S"), colIndex("U"), "Código:", colIndex("V"), colIndex("Y"), getInfoValue(info, "codigo_oficial_seguridad"), true);
    mergeSet(ws, 5, colIndex("Z"), 5, colIndex("AA"), "Firma:", { font: { bold: true, size: 9 }, align: { horizontal: "center" } });
    await embedSignatureInRange(wb, ws, getInfoValue(info, "firma_oficial_seguridad"), 5, colIndex("AB"), 5, COL_AI);
    applyHorizontalRows(ws, 5, 5, colIndex("Z"), COL_AI);

    setLabelValueRow(ws, 6, 1, colIndex("C"), "Fecha:", colIndex("D"), colIndex("H"), getInfoValue(info, "fecha"), true);
    setLabelValueRow(ws, 6, colIndex("I"), colIndex("J"), "Hora:", colIndex("K"), colIndex("N"), getInfoValue(info, "hora"), true);
    setLabelValueRow(ws, 6, colIndex("O"), colIndex("R"), "KM que marca:", colIndex("S"), colIndex("T"), getInfoValue(info, "km", "km_que_marca"), true);
    setLabelValueRow(
        ws,
        6,
        colIndex("U"),
        colIndex("X"),
        "No. De motor:",
        colIndex("Y"),
        COL_AI,
        getInfoValue(info, "numero_motor"),
        true,
    );

    setLabelValueRow(ws, 7, 1, colIndex("D"), "No. De placa:", colIndex("E"), colIndex("L"), getInfoValue(info, "numero_placa"), true);
    setLabelValueRow(ws, 7, colIndex("M"), colIndex("N"), "Marca:", colIndex("O"), colIndex("R"), getInfoValue(info, "marca"), true);
    setLabelValueRow(ws, 7, colIndex("S"), colIndex("T"), "Tipo:", colIndex("U"), colIndex("AA"), getInfoValue(info, "tipo_vehiculo") || record.tipo, true);
    setLabelValueRow(ws, 7, colIndex("AB"), colIndex("AC"), "Color:", colIndex("AD"), COL_AI, getInfoValue(info, "color"), true);

    setLabelValueRow(ws, 8, 1, colIndex("F"), "No. Vin o chasis:", colIndex("G"), colIndex("R"), getInfoValue(info, "vin", "vin_chasis"), true);
    setLabelValueRow(ws, 8, colIndex("S"), colIndex("W"), "Combustible:", colIndex("X"), COL_AI, getInfoValue(info, "combustible"), true);

    setLabelValueRow(ws, 9, 1, colIndex("H"), "Encargado de depósito:", colIndex("I"), colIndex("R"), getInfoValue(info, "encargado_deposito"), true);
    setLabelValueRow(ws, 9, colIndex("S"), colIndex("U"), "Código:", colIndex("V"), colIndex("Z"), getInfoValue(info, "codigo_encargado"), true);
    mergeSet(ws, 9, colIndex("AA"), 9, colIndex("AC"), "Firma:", { font: { bold: true, size: 9 }, align: { horizontal: "center" } });
    await embedSignatureInRange(wb, ws, getInfoValue(info, "firma_encargado"), 9, colIndex("AD"), 9, COL_AI);
    applyHorizontalRows(ws, 9, 9, colIndex("AA"), COL_AI);

    applyRangeFill(ws, 4, 1, 9, COL_AI, FILL_WHITE);
    applyHorizontalRows(ws, 4, 9, 1, COL_AI);

    mergeSet(ws, 10, 1, 10, COL_AI, "ACCESORIOS Y PARTES DEL VEHÍCULO", {
        fill: HDR_FILL,
        font: HDR_FONT,
        align: { horizontal: "center", vertical: "middle" },
    });

    mergeSet(ws, 11, 1, 11, colIndex("R"), "ACCESORIOS EXTERNOS", {
        fill: HDR_FILL,
        font: { ...HDR_FONT, size: 9 },
        align: { horizontal: "center" },
    });
    mergeSet(ws, 11, colIndex("S"), 11, COL_AI, "ACCESORIOS INTERNOS", {
        fill: HDR_FILL,
        font: { ...HDR_FONT, size: 9 },
        align: { horizontal: "center" },
    });

    mergeSet(ws, 12, 1, 12, colIndex("I"), "Descripción", { font: { bold: true, size: 8 }, align: { horizontal: "center" } });
    mergeSet(ws, 12, colIndex("J"), 12, colIndex("L"), "Estado", { font: { bold: true, size: 8 }, align: { horizontal: "center" } });
    mergeSet(ws, 12, colIndex("M"), 12, colIndex("R"), "Observaciones", { font: { bold: true, size: 8 }, align: { horizontal: "center" } });
    mergeSet(ws, 12, colIndex("S"), 12, colIndex("Z"), "Descripción", { font: { bold: true, size: 8 }, align: { horizontal: "center" } });
    mergeSet(ws, 12, colIndex("AA"), 12, colIndex("AC"), "Estado", { font: { bold: true, size: 8 }, align: { horizontal: "center" } });
    mergeSet(ws, 12, colIndex("AD"), 12, COL_AI, "Observaciones", { font: { bold: true, size: 8 }, align: { horizontal: "center" } });

    const extLabels = [...VEHICULO_EXTERNAL_LABELS];
    const intLabels = [...VEHICULO_INTERNAL_LABELS];
    const maxAccRows = Math.max(extLabels.length, intLabels.length);
    const firstAccRow = 13;
    const lastAccRow = 61;
    for (let i = 0; i <= lastAccRow - firstAccRow; i++) {
        const row = firstAccRow + i;
        const extLabel = i < extLabels.length ? extLabels[i] : "";
        const intLabel = i < intLabels.length ? intLabels[i] : "";
        if (extLabel) {
            writeAccessoryRow(
                ws,
                row,
                1,
                colIndex("I"),
                colIndex("J"),
                colIndex("L"),
                colIndex("M"),
                colIndex("R"),
                extLabel,
                findRevisionByLabel(revMap, extLabel),
            );
        } else {
            applyRangeBorder(ws, row, 1, row, colIndex("R"), borderThin);
        }
        if (intLabel && row < MOTOR_FIRST_ROW) {
            writeAccessoryRow(
                ws,
                row,
                colIndex("S"),
                colIndex("Z"),
                colIndex("AA"),
                colIndex("AC"),
                colIndex("AD"),
                COL_AI,
                intLabel,
                findRevisionByLabel(revMap, intLabel),
            );
        } else if (row < MOTOR_FIRST_ROW) {
            applyRangeBorder(ws, row, colIndex("S"), row, COL_AI, borderThin);
        }
    }

    const motorEntry = revMap.get("funciona_motor");
    const motorVal = excelCellString(motorEntry?.value ?? "");
    mergeSet(ws, MOTOR_FIRST_ROW, colIndex("S"), MOTOR_FIRST_ROW, colIndex("Z"), "¿Funciona el motor?", {
        font: { bold: true, size: 9 },
        align: { horizontal: "left", vertical: "middle" },
        fill: FILL_WHITE,
        applyCellBorders: false,
    });
    mergeSet(ws, MOTOR_FIRST_ROW, colIndex("AA"), MOTOR_LAST_ROW, COL_AI, motorVal, {
        font: { size: 9 },
        align: { horizontal: "left", vertical: "middle", wrapText: true },
        fill: FILL_WHITE,
        applyCellBorders: false,
    });
    applyRangeFill(ws, MOTOR_FIRST_ROW, colIndex("S"), MOTOR_LAST_ROW, COL_AI, FILL_WHITE);
    clearRangeBorders(ws, MOTOR_FIRST_ROW, colIndex("S"), MOTOR_LAST_ROW, COL_AI);

    mergeSet(ws, 62, 1, 62, COL_AI, "MOVIMIENTOS DEL VEHÍCULO", {
        fill: HDR_FILL,
        font: HDR_FONT,
        align: { horizontal: "center", vertical: "middle" },
    });

    const movSectionStart = 63;
    let movRow = movSectionStart;
    const movDataStart = movRow;
    if (movs.length === 0) {
        applyRangeFill(ws, movRow, 1, movRow, COL_AI, FILL_WHITE);
        applyBottomBorderRows(ws, movRow, movRow, 1, COL_AI);
        movRow++;
    } else {
        for (const mov of movs) {
            if (!mov || typeof mov !== "object") continue;
            mergeSet(ws, movRow, 1, movRow, colIndex("D"), "Movimiento", {
                font: { bold: true, size: 8 },
                fill: FILL_WHITE,
                applyCellBorders: false,
            });
            mergeSet(ws, movRow, colIndex("E"), movRow, colIndex("J"), excelCellString(mov.movimiento ?? ""), {
                font: { size: 8 },
                align: { wrapText: true },
                fill: FILL_WHITE,
                applyCellBorders: false,
            });
            mergeSet(ws, movRow, colIndex("K"), movRow, colIndex("L"), "Fecha", {
                font: { bold: true, size: 8 },
                fill: FILL_WHITE,
                applyCellBorders: false,
            });
            mergeSet(ws, movRow, colIndex("M"), movRow, colIndex("P"), excelCellString(mov.fecha ?? ""), {
                font: { size: 8 },
                fill: FILL_WHITE,
                applyCellBorders: false,
            });
            mergeSet(ws, movRow, colIndex("Q"), movRow, colIndex("R"), "Hora", {
                font: { bold: true, size: 8 },
                fill: FILL_WHITE,
                applyCellBorders: false,
            });
            mergeSet(ws, movRow, colIndex("S"), movRow, colIndex("T"), excelCellString(mov.hora ?? ""), {
                font: { size: 8 },
                fill: FILL_WHITE,
                applyCellBorders: false,
            });
            mergeSet(ws, movRow, colIndex("U"), movRow, colIndex("X"), "Realizado por", {
                font: { bold: true, size: 8 },
                fill: FILL_WHITE,
                applyCellBorders: false,
            });
            mergeSet(ws, movRow, colIndex("Y"), movRow, colIndex("AC"), excelCellString(mov.realizado_por ?? ""), {
                font: { size: 8 },
                align: { wrapText: true },
                fill: FILL_WHITE,
                applyCellBorders: false,
            });
            mergeSet(ws, movRow, colIndex("AD"), movRow, colIndex("AF"), "Autorizado por", {
                font: { bold: true, size: 8 },
                fill: FILL_WHITE,
                applyCellBorders: false,
            });
            mergeSet(ws, movRow, colIndex("AG"), movRow, COL_AI, excelCellString(mov.autorizado_por ?? ""), {
                font: { size: 8 },
                align: { wrapText: true },
                fill: FILL_WHITE,
                applyCellBorders: false,
            });
            applyRangeFill(ws, movRow, 1, movRow, COL_AI, FILL_WHITE);
            applyBottomBorderRows(ws, movRow, movRow, 1, COL_AI);
            movRow++;
        }
    }

    const obsHeaderRow = movRow;
    mergeSet(ws, obsHeaderRow, 1, obsHeaderRow, COL_AI, "Observaciones", {
        fill: HDR_FILL,
        font: HDR_FONT,
        align: { horizontal: "center", vertical: "middle" },
    });
    movRow++;
    const obsContentStart = movRow;
    const obsText = excelCellString(record.observaciones ?? "");
    const obsLines = Math.max(3, Math.min(12, Math.ceil(obsText.length / 120) + 2));
    const obsEndRow = movRow + obsLines - 1;
    mergeSet(ws, obsContentStart, 1, obsEndRow, COL_AI, obsText || "—", {
        font: { size: 9 },
        align: { horizontal: "left", vertical: "top", wrapText: true },
        fill: FILL_WHITE,
        applyCellBorders: false,
    });
    if (obsHeaderRow > movDataStart) {
        applyRangeFill(ws, movDataStart, 1, obsHeaderRow - 1, COL_AI, FILL_WHITE);
    }
    applyRangeFill(ws, obsContentStart, 1, obsEndRow, COL_AI, FILL_WHITE);
    applyRangeFill(ws, obsHeaderRow, 1, obsHeaderRow, COL_AI, HDR_FILL);
    for (let r = movDataStart; r < obsHeaderRow; r++) {
        applyBottomBorderRows(ws, r, r, 1, COL_AI);
    }
    applyBottomBorderRows(ws, obsHeaderRow, obsHeaderRow, 1, COL_AI);
    for (let r = obsContentStart; r <= obsEndRow; r++) {
        applyBottomBorderRows(ws, r, r, 1, COL_AI);
    }
    const lastRow = obsEndRow;

    applyOuterGrid(ws, 1, 1, lastRow, COL_AI);
}

export async function buildRevisionVehiculosExcelIndividual(
    rows: RevisionVehiculoReportRow[],
    reportNombre?: string,
): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const nombre = String(reportNombre ?? "").trim();
    for (const r of rows) {
        const tipo = String(r.tipo ?? "").trim();
        if (tipo === "Vehículo" || tipo === "Vehiculo") {
            await buildVehiculoIndividualSheet(wb, r, nombre);
        } else if (tipo === "Motocicleta") {
            const { buildMotocicletaIndividualSheet } = await import("./revisionVehiculosIndividualMotocicleta");
            await buildMotocicletaIndividualSheet(wb, r, nombre);
        } else if (tipo === "Bicicleta") {
            const { buildBicicletaIndividualSheet } = await import("./revisionVehiculosIndividualBicicleta");
            await buildBicicletaIndividualSheet(wb, r, nombre);
        } else {
            const ws = wb.addWorksheet(sanitizeSheetName(`Rev-${r.id}`));
            ws.getCell(1, 1).value = `Formato individual para tipo «${tipo}» aún no implementado.`;
        }
    }
    if (rows.length === 0) {
        const ws = wb.addWorksheet("Vacío");
        ws.getCell(1, 1).value = "Sin registros";
    }
    return Buffer.from(await wb.xlsx.writeBuffer());
}
