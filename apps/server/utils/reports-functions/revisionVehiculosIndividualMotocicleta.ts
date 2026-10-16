/* eslint-disable @typescript-eslint/no-explicit-any */
import fsPromises from "fs/promises";
import path from "path";
import ExcelJS from "exceljs";
import type { RevisionVehiculoReportRow } from "./revisionVehiculosReport";
import {
    FILL_WHITE,
    HDR_FILL,
    HDR_FONT,
    SIGNATURE_ROW_HEIGHT,
    applyBottomBorderRows,
    applyHorizontalRows,
    applyOuterGrid,
    applyRangeFill,
    buildInfoGeneralMap,
    clearRangeBorders,
    embedSignatureInRange,
    excelCellString,
    findRevisionByLabel,
    getInfoValue,
    mergeSet,
    readPngPixelSize,
    resolveLogoPath,
    logoExtentForCellBox,
    fitImageInBox,
    sanitizeSheetName,
    safeParseArray,
    writeEstadoMerged,
} from "./revisionVehiculosIndividualVehiculo";

const COL_L = 12;
const DOC_TITLE_MOTO = "BITÁCORA DE REVISIÓN DE MOTOS DETENIDAS";
const ACC_FIRST_ROW = 11;
const ACC_LAST_ROW = 41;
const MOTO_IMAGE_ROW_START = 21;
const RIGHT_ACC_LAST_ROW = 20;
const ACC_HEADER_ROW = 10;

/** Lista alineada con `buildRevisionConfig('Motocicleta')` en BitacoraVehiculosDetenidosScreen. */
const MOTO_REVISION_LABELS = [
    "Guardabarro delantero",
    "Llanta delantera",
    "Aro delantero",
    "Compensadores delanteros",
    "Silvin",
    "Direccional delantero izquierdo",
    "Direccional delantero derecho",
    "Espejo delantero derecho",
    "Espejo delantero izquierdo",
    "Manija izquierda",
    "Manija derecha",
    "Velocímetro",
    "Tacómetro",
    "Cable de freno",
    "Cable de embrague",
    "Manivela",
    "Tanque",
    "Tapón de combustible",
    "Guardabarro trasero",
    "Llanta trasera",
    "Aro trasero",
    "Compensadores traseros",
    "Direccional trasero izquierdo",
    "Direccional trasero derecho",
    "Stop trasero",
    "Mufla",
    "Cadena",
    "Cubre cadena",
    "Patilla de cambios",
    "Patilla de frenos",
    "Asiento",
    "Batería",
    "Pito",
    "Carburador",
] as const;

const LEFT_SLOT_COUNT = ACC_LAST_ROW - ACC_FIRST_ROW + 1;
const RIGHT_SLOT_COUNT = RIGHT_ACC_LAST_ROW - ACC_FIRST_ROW + 1;


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

function colIndex(letters: string): number {
    let n = 0;
    for (const ch of letters.toUpperCase()) {
        n = n * 26 + (ch.charCodeAt(0) - 64);
    }
    return n;
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

function setMotoColumnWidths(ws: ExcelJS.Worksheet) {
    ws.getColumn(1).width = 24;
    for (let c = 2; c <= 6; c++) ws.getColumn(c).width = 9;
    ws.getColumn(7).width = 24;
    for (let c = 8; c <= COL_L; c++) ws.getColumn(c).width = 9;
}

/** Información oficial: etiqueta en negrita + valor normal. */
function mergeOfficialLabelValue(
    ws: ExcelJS.Worksheet,
    row: number,
    c1: number,
    c2: number,
    label: string,
    value: string,
) {
    const v = excelCellString(value);
    ws.mergeCells(row, c1, row, c2);
    const cell = ws.getCell(row, c1);
    cell.value = v
        ? {
              richText: [
                  { font: { bold: true, size: 9 }, text: `${label}: ` },
                  { font: { size: 9 }, text: v },
              ],
          }
        : `${label}:`;
    cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
    cell.fill = FILL_WHITE;
}

function mergeLabelValue(ws: ExcelJS.Worksheet, row: number, c1: number, c2: number, label: string, value: string) {
    const v = excelCellString(value);
    mergeSet(ws, row, c1, row, c2, v ? `${label}: ${v}` : `${label}:`, {
        font: { size: 9 },
        align: { horizontal: "left", vertical: "middle", wrapText: true },
    });
}

function formatRadioSiNo(raw: unknown): string {
    const v = String(raw ?? "").trim().toLowerCase();
    if (v === "si" || v === "sí" || v === "true" || v === "1") return "SI";
    if (v === "no" || v === "false" || v === "0") return "NO";
    return excelCellString(raw);
}

const MOTO_EXTRA_ROWS: { row: number; label: string; key: string; format?: (v: unknown) => string }[] = [
    { row: 14, label: "Llaves", key: "llaves", format: formatRadioSiNo },
    { row: 15, label: "Entregado a", key: "entregado_a" },
    { row: 16, label: "Fecha", key: "fecha_entrega" },
    { row: 17, label: "Hora", key: "hora_entrega" },
];

/** Aproximación px por unidad de ancho de columna Excel (Calibri 11). */
const PX_PER_COL_WIDTH = 7;
/** Puntos de fila → px (96 dpi). */
const PX_PER_ROW_POINT = 96 / 72;
/** Corrección visual: la imagen queda baja y a la izquierda respecto al centro geométrico en Excel. */
const MOTO_IMG_OFFSET_RIGHT_RATIO = 1.5;
const MOTO_IMG_OFFSET_UP_RATIO = 0.16;

function measureMergeBoxPixels(ws: ExcelJS.Worksheet, r1: number, c1: number, r2: number, c2: number) {
    const colLeftPx: number[] = [];
    let widthPx = 0;
    for (let c = c1; c <= c2; c++) {
        colLeftPx.push(widthPx);
        widthPx += (Number(ws.getColumn(c).width) || 9) * PX_PER_COL_WIDTH;
    }

    const rowTopPx: number[] = [];
    let heightPx = 0;
    for (let r = r1; r <= r2; r++) {
        rowTopPx.push(heightPx);
        heightPx += (Number(ws.getRow(r).height) || 15) * PX_PER_ROW_POINT;
    }

    return {
        widthPx: Math.max(widthPx, 40),
        heightPx: Math.max(heightPx, 40),
        colLeftPx,
        rowTopPx,
    };
}

/** Posición tl (esquina sup. izq.) para que el centro de la imagen coincida con el centro del rango. */
function computeImageTlFromCenter(
    ws: ExcelJS.Worksheet,
    r1: number,
    c1: number,
    r2: number,
    c2: number,
    imgWidthPx: number,
    imgHeightPx: number,
): { col: number; row: number } {
    const box = measureMergeBoxPixels(ws, r1, c1, r2, c2);
    const centeredLeft = box.widthPx / 2 - imgWidthPx / 2;
    const centeredTop = box.heightPx / 2 - imgHeightPx / 2;
    const imgLeftPx = Math.min(
        Math.max(0, centeredLeft + box.widthPx * MOTO_IMG_OFFSET_RIGHT_RATIO),
        Math.max(0, box.widthPx - imgWidthPx),
    );
    const imgTopPx = Math.min(
        Math.max(0, centeredTop - box.heightPx * MOTO_IMG_OFFSET_UP_RATIO),
        Math.max(0, box.heightPx - imgHeightPx),
    );

    let col = c1 - 1;
    for (let i = 0; i < box.colLeftPx.length; i++) {
        const colStart = box.colLeftPx[i];
        const colEnd = i < box.colLeftPx.length - 1 ? box.colLeftPx[i + 1]! : box.widthPx;
        const colW = colEnd - colStart;
        if (imgLeftPx < colEnd || i === box.colLeftPx.length - 1) {
            col = c1 - 1 + i + (imgLeftPx - colStart) / colW;
            break;
        }
    }

    let row = r1 - 1;
    for (let i = 0; i < box.rowTopPx.length; i++) {
        const rowStart = box.rowTopPx[i];
        const rowEnd = i < box.rowTopPx.length - 1 ? box.rowTopPx[i + 1]! : box.heightPx;
        const rowH = rowEnd - rowStart;
        if (imgTopPx < rowEnd || i === box.rowTopPx.length - 1) {
            row = r1 - 1 + i + (imgTopPx - rowStart) / rowH;
            break;
        }
    }

    return { col, row };
}

async function resolveMotoDiagramPath(): Promise<string | null> {
    const names = ["Motocicleta.PNG", "Motocicleta.png"];
    const bases = [
        path.resolve(process.cwd(), "app", "vehicles-images"),
        path.resolve(process.cwd(), "apps", "server", "app", "vehicles-images"),
    ];
    for (const base of bases) {
        for (const name of names) {
            const p = path.join(base, name);
            try {
                await fsPromises.access(p);
                return p;
            } catch {
                /* ignore */
            }
        }
    }
    return null;
}

function writeMotoAccessoryRow(
    ws: ExcelJS.Worksheet,
    row: number,
    side: "left" | "right",
    label: string,
    entry: any | undefined,
) {
    if (side === "left") {
        mergeSet(ws, row, 1, row, 1, label, { font: { size: 8 }, align: { vertical: "middle", wrapText: true } });
        writeEstadoMerged(ws, row, 2, 6, entry?.value ?? "");
    } else {
        mergeSet(ws, row, 7, row, 7, label, { font: { size: 8 }, align: { vertical: "middle", wrapText: true } });
        writeEstadoMerged(ws, row, 8, COL_L, entry?.value ?? "");
    }
}

async function embedMotoDiagram(wb: ExcelJS.Workbook, ws: ExcelJS.Worksheet, imagePath: string) {
    const cG = colIndex("G");
    const cL = COL_L;
    mergeSet(ws, MOTO_IMAGE_ROW_START, cG, ACC_LAST_ROW, cL, undefined, {
        fill: FILL_WHITE,
        applyCellBorders: false,
    });
    applyRangeFill(ws, MOTO_IMAGE_ROW_START, cG, ACC_LAST_ROW, cL, FILL_WHITE);
    clearRangeBorders(ws, MOTO_IMAGE_ROW_START, cG, ACC_LAST_ROW, cL);

    try {
        const nat = await readPngPixelSize(imagePath);
        const box = measureMergeBoxPixels(ws, MOTO_IMAGE_ROW_START, cG, ACC_LAST_ROW, cL);
        const { width: dw, height: dh } = nat
            ? fitImageInBox(nat.w, nat.h, Math.floor(box.widthPx * 0.9), Math.floor(box.heightPx * 0.9))
            : { width: 180, height: 220 };
        const imgId = wb.addImage({ filename: imagePath, extension: "png" });
        const { col, row } = computeImageTlFromCenter(
            ws,
            MOTO_IMAGE_ROW_START,
            cG,
            ACC_LAST_ROW,
            cL,
            dw,
            dh,
        );
        ws.addImage(imgId, {
            tl: { col, row },
            ext: { width: dw, height: dh },
            editAs: "oneCell",
        });
    } catch {
        /* ignore */
    }
}

export async function buildMotocicletaIndividualSheet(
    wb: ExcelJS.Workbook,
    record: RevisionVehiculoReportRow,
    reportNombre: string,
): Promise<void> {
    const ws = wb.addWorksheet(sanitizeSheetName(`Rev-${record.id}`));
    setMotoColumnWidths(ws);

    ws.getRow(1).height = 24;
    ws.getRow(2).height = 24;
    ws.getRow(5).height = SIGNATURE_ROW_HEIGHT;
    ws.getRow(8).height = SIGNATURE_ROW_HEIGHT;

    const info = buildInfoGeneralMap(record.informacion_general);
    const revMap = buildRevisionEntryMap(record.informacion_revision);
    const movs = safeParseArray(record.movimientos_vehiculos);

    const clienteVal =
        getInfoValue(info, "cliente") || excelCellString(record.cliente_txt ?? "");
    const corpoVal = getInfoValue(info, "corpo", "sucursal") || excelCellString(record.corpo_txt ?? "");

    mergeSet(ws, 1, 1, 2, 1, undefined);
    const logoPath = await resolveLogoPath(record.empresa_id);
    if (logoPath) {
        try {
            const logoNat = await readPngPixelSize(logoPath);
            const logoExt = logoExtentForCellBox(logoNat, 52, 40);
            const imgId = wb.addImage({ filename: logoPath, extension: "png" });
            ws.addImage(imgId, { tl: { col: 0.1, row: 0.12 }, ext: logoExt, editAs: "oneCell" });
        } catch {
            /* ignore */
        }
    }

    mergeSet(ws, 1, 2, 2, colIndex("G"), DOC_TITLE_MOTO, {
        fill: HDR_FILL,
        font: HDR_FONT,
        align: { horizontal: "center", vertical: "middle" },
    });
    mergeSet(ws, 1, colIndex("H"), 2, COL_L, reportNombre || "—", {
        fill: FILL_WHITE,
        font: { bold: true, color: { argb: "FF000000" }, size: 9 },
        align: { horizontal: "center", vertical: "middle", wrapText: true },
    });

    mergeSet(ws, 3, 1, 3, COL_L, "INFORMACIÓN OFICIAL", {
        fill: HDR_FILL,
        font: HDR_FONT,
        align: { horizontal: "center", vertical: "middle" },
    });

    mergeOfficialLabelValue(ws, 4, 1, 6, "Cliente", clienteVal);
    mergeOfficialLabelValue(ws, 4, 7, COL_L, "Corpo", corpoVal);
    mergeOfficialLabelValue(ws, 5, 1, 6, "Nombre oficial de corporación", getInfoValue(info, "nombre_oficial_corporacion"));
    mergeSet(ws, 5, 7, 5, 7, "Firma:", {
        font: { bold: true, size: 9 },
        align: { horizontal: "left", vertical: "middle" },
    });
    await embedSignatureInRange(
        wb,
        ws,
        getInfoValue(info, "firma_oficial_corporacion"),
        5,
        8,
        5,
        COL_L,
    );
    applyHorizontalRows(ws, 5, 5, 7, COL_L);

    mergeOfficialLabelValue(ws, 6, 1, 2, "Fecha", getInfoValue(info, "fecha"));
    mergeOfficialLabelValue(ws, 6, 3, 6, "Hora", getInfoValue(info, "hora"));
    mergeOfficialLabelValue(ws, 6, 7, COL_L, "Código", getInfoValue(info, "codigo"));

    mergeOfficialLabelValue(ws, 7, 1, 2, "No. De placa", getInfoValue(info, "numero_placa"));
    mergeOfficialLabelValue(ws, 7, 3, 6, "Marca", getInfoValue(info, "marca"));
    mergeOfficialLabelValue(ws, 7, 7, COL_L, "Color", getInfoValue(info, "color"));

    mergeOfficialLabelValue(
        ws,
        8,
        1,
        2,
        "Nombre de oficial del cliente",
        getInfoValue(info, "nombre_oficial_cliente", "nombre_oficial_transito"),
    );
    mergeSet(ws, 8, 7, 8, 7, "Firma:", {
        font: { bold: true, size: 9 },
        align: { horizontal: "left", vertical: "middle" },
    });
    await embedSignatureInRange(
        wb,
        ws,
        getInfoValue(info, "firma_oficial_transito", "firma_oficial_cliente"),
        8,
        8,
        8,
        COL_L,
    );
    applyHorizontalRows(ws, 8, 8, 7, COL_L);

    applyRangeFill(ws, 4, 1, 8, COL_L, FILL_WHITE);
    applyHorizontalRows(ws, 4, 4, 1, 6);
    applyHorizontalRows(ws, 4, 4, 7, COL_L);
    applyHorizontalRows(ws, 5, 5, 1, 6);
    applyHorizontalRows(ws, 5, 5, 7, COL_L);
    applyHorizontalRows(ws, 6, 6, 1, 2);
    applyHorizontalRows(ws, 6, 6, 3, 6);
    applyHorizontalRows(ws, 6, 6, 7, COL_L);
    applyHorizontalRows(ws, 7, 7, 1, 2);
    applyHorizontalRows(ws, 7, 7, 3, 6);
    applyHorizontalRows(ws, 7, 7, 7, COL_L);
    applyHorizontalRows(ws, 8, 8, 1, 2);
    applyHorizontalRows(ws, 8, 8, 7, COL_L);

    mergeSet(ws, 9, 1, 9, COL_L, "ACCESORIOS DE LA MOTOCICLETA", {
        fill: HDR_FILL,
        font: HDR_FONT,
        align: { horizontal: "center", vertical: "middle" },
    });

    mergeSet(ws, 10, 1, 10, 1, "Descripción", { font: { bold: true, size: 8 }, align: { horizontal: "center" } });
    mergeSet(ws, 10, 2, 10, 6, "Estado", { font: { bold: true, size: 8 }, align: { horizontal: "center" } });
    mergeSet(ws, 10, 7, 10, 7, "Descripción", { font: { bold: true, size: 8 }, align: { horizontal: "center" } });
    mergeSet(ws, 10, 8, 10, COL_L, "Estado", { font: { bold: true, size: 8 }, align: { horizontal: "center" } });

    const labels = [...MOTO_REVISION_LABELS];
    const leftLabels = labels.slice(0, LEFT_SLOT_COUNT);
    const rightLabels = labels.slice(LEFT_SLOT_COUNT, LEFT_SLOT_COUNT + RIGHT_SLOT_COUNT);

    for (let i = 0; i < LEFT_SLOT_COUNT; i++) {
        const row = ACC_FIRST_ROW + i;
        const label = leftLabels[i] ?? "";
        if (label) {
            writeMotoAccessoryRow(ws, row, "left", label, findRevisionByLabel(revMap, label));
        }
    }
    for (let i = 0; i < RIGHT_SLOT_COUNT; i++) {
        const row = ACC_FIRST_ROW + i;
        const label = rightLabels[i] ?? "";
        if (label) {
            writeMotoAccessoryRow(ws, row, "right", label, findRevisionByLabel(revMap, label));
        }
    }
    for (let r = ACC_FIRST_ROW; r <= ACC_LAST_ROW; r++) {
        ws.getRow(r).height = 15;
    }

    for (const extra of MOTO_EXTRA_ROWS) {
        const entry = revMap.get(extra.key);
        const rawVal = entry?.value;
        const val = extra.format ? extra.format(rawVal) : excelCellString(rawVal ?? "");
        mergeLabelValue(ws, extra.row, 7, COL_L, extra.label, val);
    }

    applyRangeFill(ws, ACC_HEADER_ROW, 1, ACC_LAST_ROW, COL_L, FILL_WHITE);

    const motoImg = await resolveMotoDiagramPath();
    if (motoImg) {
        await embedMotoDiagram(wb, ws, motoImg);
    } else {
        applyRangeFill(ws, MOTO_IMAGE_ROW_START, colIndex("G"), ACC_LAST_ROW, COL_L, FILL_WHITE);
    }

    mergeSet(ws, 42, 1, 42, COL_L, "MOVIMIENTOS DEL VEHÍCULO", {
        fill: HDR_FILL,
        font: HDR_FONT,
        align: { horizontal: "center", vertical: "middle" },
    });

    const movSectionStart = 43;
    let movRow = movSectionStart;
    const movDataStart = movRow;

    const writeMovLine = (mov: Record<string, unknown>) => {
        mergeSet(ws, movRow, 1, movRow, 2, `Movimiento: ${excelCellString(mov.movimiento ?? "")}`, {
            font: { size: 8 },
            fill: FILL_WHITE,
            applyCellBorders: false,
        });
        mergeSet(ws, movRow, 3, movRow, 3, "Fecha:", { font: { bold: true, size: 8 }, fill: FILL_WHITE, applyCellBorders: false });
        mergeSet(ws, movRow, 4, movRow, 4, excelCellString(mov.fecha ?? ""), {
            font: { size: 8 },
            fill: FILL_WHITE,
            applyCellBorders: false,
        });
        mergeSet(ws, movRow, 5, movRow, 5, "Hora:", { font: { bold: true, size: 8 }, fill: FILL_WHITE, applyCellBorders: false });
        mergeSet(ws, movRow, 6, movRow, 6, excelCellString(mov.hora ?? ""), {
            font: { size: 8 },
            fill: FILL_WHITE,
            applyCellBorders: false,
        });
        mergeSet(
            ws,
            movRow,
            7,
            movRow,
            8,
            `Realizado por: ${excelCellString(mov.realizado_por ?? "")}`,
            { font: { size: 8 }, fill: FILL_WHITE, applyCellBorders: false, align: { wrapText: true } },
        );
        mergeSet(
            ws,
            movRow,
            9,
            movRow,
            COL_L,
            `Autorizado por: ${excelCellString(mov.autorizado_por ?? "")}`,
            { font: { size: 8 }, fill: FILL_WHITE, applyCellBorders: false, align: { wrapText: true } },
        );
        applyRangeFill(ws, movRow, 1, movRow, COL_L, FILL_WHITE);
        applyBottomBorderRows(ws, movRow, movRow, 1, COL_L);
        movRow++;
    };

    if (movs.length === 0) {
        applyRangeFill(ws, movRow, 1, movRow, COL_L, FILL_WHITE);
        applyBottomBorderRows(ws, movRow, movRow, 1, COL_L);
        movRow++;
    } else {
        for (const mov of movs) {
            if (!mov || typeof mov !== "object") continue;
            writeMovLine(mov as Record<string, unknown>);
        }
    }

    const obsHeaderRow = movRow;
    mergeSet(ws, obsHeaderRow, 1, obsHeaderRow, COL_L, "OBSERVACIONES", {
        fill: HDR_FILL,
        font: HDR_FONT,
        align: { horizontal: "center", vertical: "middle" },
    });
    movRow++;

    const obsText = excelCellString(record.observaciones ?? "");
    const obsLines = Math.max(3, Math.min(8, Math.ceil(obsText.length / 80) + 2));
    const obsEndRow = movRow + obsLines - 1;
    mergeSet(ws, movRow, 1, obsEndRow, COL_L, obsText || "—", {
        font: { size: 9 },
        align: { horizontal: "left", vertical: "top", wrapText: true },
        fill: FILL_WHITE,
        applyCellBorders: false,
    });

    if (obsHeaderRow > movDataStart) {
        applyRangeFill(ws, movDataStart, 1, obsHeaderRow - 1, COL_L, FILL_WHITE);
    }
    applyRangeFill(ws, movRow, 1, obsEndRow, COL_L, FILL_WHITE);
    applyRangeFill(ws, obsHeaderRow, 1, obsHeaderRow, COL_L, HDR_FILL);
    for (let r = movDataStart; r < obsHeaderRow; r++) {
        applyBottomBorderRows(ws, r, r, 1, COL_L);
    }
    applyBottomBorderRows(ws, obsHeaderRow, obsHeaderRow, 1, COL_L);
    for (let r = movRow; r <= obsEndRow; r++) {
        applyBottomBorderRows(ws, r, r, 1, COL_L);
    }

    applyOuterGrid(ws, 1, 1, obsEndRow, COL_L);
}
