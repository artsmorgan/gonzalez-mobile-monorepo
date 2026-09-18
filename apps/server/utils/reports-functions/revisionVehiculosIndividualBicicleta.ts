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

const COL_G = 7;
const DOC_TITLE_BIKE = "BITÁCORA DE BICICLETA DETENIDA";
const ACC_HEADER_ROW = 10;
const ACC_FIRST_ROW = 11;
const ACC_LAST_ROW = 34;
const BIKE_IMAGE_ROW_START = 19;
const COBERTOR_DERECHO_INDEX = 8;
const MOV_HEADER_ROW = 35;

const PX_PER_COL_WIDTH = 7;
const PX_PER_ROW_POINT = 96 / 72;
/** Ancho de la columna del diagrama (G). */
const COL_G_WIDTH = 40;
/** Escala máxima de la imagen dentro del rango combinado G19:G34. */
const BIKE_IMG_BOX_FILL = 0.9;

/** Lista alineada con `buildRevisionConfig('Bicicleta')` en BitacoraVehiculosDetenidosScreen. */
const BICICLETA_REVISION_LABELS = [
    "Guardabarro delantero",
    "Llantas",
    "Eje delantero",
    "Orquilla delantera",
    "Manivela",
    "Manija izquierda",
    "Cobertor izquierdo",
    "Manija derecha",
    "Cobertor derecho",
    "Foco",
    "Cable de freno delantero",
    "Espejo retrovisor izquierdo",
    "Espejo retrovisor derecho",
    "Asiento",
    "Cadena",
    "Cubrecadena",
    "Llanta trasera",
    "Aro trasero",
    "Eje trasero",
    "Sistema de cambios",
    "Pedales",
    "Inflador",
    "Doble plato",
    "Pasador",
] as const;


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

function setBikeColumnWidths(ws: ExcelJS.Worksheet) {
    ws.getColumn(1).width = 28;
    ws.getColumn(2).width = 9;
    ws.getColumn(3).width = 9;
    ws.getColumn(4).width = 14;
    ws.getColumn(5).width = 9;
    ws.getColumn(6).width = 9;
    ws.getColumn(COL_G).width = COL_G_WIDTH;
}

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

function mergeLabelValue(
    ws: ExcelJS.Worksheet,
    row: number,
    c1: number,
    c2: number,
    label: string,
    value: string,
    applyCellBorders = true,
) {
    const v = excelCellString(value);
    mergeSet(ws, row, c1, row, c2, v ? `${label}: ${v}` : `${label}:`, {
        font: { size: 9 },
        align: { horizontal: "left", vertical: "middle", wrapText: true },
        applyCellBorders,
    });
}

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

function pxOffsetToFractionalCol(
    c1: number,
    colLeftPx: number[],
    boxWidthPx: number,
    offsetPx: number,
): number {
    let col = c1 - 1;
    for (let i = 0; i < colLeftPx.length; i++) {
        const colStart = colLeftPx[i]!;
        const colEnd = i < colLeftPx.length - 1 ? colLeftPx[i + 1]! : boxWidthPx;
        const colW = colEnd - colStart;
        if (offsetPx < colEnd || i === colLeftPx.length - 1) {
            col = c1 - 1 + i + (offsetPx - colStart) / colW;
            break;
        }
    }
    return col;
}

function pxOffsetToFractionalRow(
    r1: number,
    rowTopPx: number[],
    boxHeightPx: number,
    offsetPx: number,
): number {
    let row = r1 - 1;
    for (let i = 0; i < rowTopPx.length; i++) {
        const rowStart = rowTopPx[i]!;
        const rowEnd = i < rowTopPx.length - 1 ? rowTopPx[i + 1]! : boxHeightPx;
        const rowH = rowEnd - rowStart;
        if (offsetPx < rowEnd || i === rowTopPx.length - 1) {
            row = r1 - 1 + i + (offsetPx - rowStart) / rowH;
            break;
        }
    }
    return row;
}

/** Esquina superior izquierda para centrar la imagen en el rango combinado (px, sin clamp). */
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
    const imgLeftPx = (box.widthPx - imgWidthPx) / 2;
    const imgTopPx = (box.heightPx - imgHeightPx) / 2;
    return {
        col: pxOffsetToFractionalCol(c1, box.colLeftPx, box.widthPx, imgLeftPx),
        row: pxOffsetToFractionalRow(r1, box.rowTopPx, box.heightPx, imgTopPx),
    };
}

async function resolveBikeDiagramPath(): Promise<string | null> {
    const names = ["Bicicleta.PNG", "Bicicleta.png"];
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

function writeBikeAccessoryRow(
    ws: ExcelJS.Worksheet,
    row: number,
    itemIndex: number,
    label: string,
    entry: any | undefined,
) {
    const obsEndCol = itemIndex >= COBERTOR_DERECHO_INDEX ? 6 : COL_G;
    mergeSet(ws, row, 1, row, 1, label, {
        font: { size: 8 },
        align: { vertical: "middle", wrapText: true },
    });
    writeEstadoMerged(ws, row, 2, 3, entry?.value ?? "");
    mergeSet(ws, row, 4, row, obsEndCol, excelCellString(entry?.observation ?? ""), {
        font: { size: 8 },
        align: { vertical: "middle", wrapText: true },
    });
}

async function embedBikeDiagram(wb: ExcelJS.Workbook, ws: ExcelJS.Worksheet, imagePath: string) {
    mergeSet(ws, BIKE_IMAGE_ROW_START, COL_G, ACC_LAST_ROW, COL_G, undefined, {
        fill: FILL_WHITE,
        applyCellBorders: false,
    });
    applyRangeFill(ws, BIKE_IMAGE_ROW_START, COL_G, ACC_LAST_ROW, COL_G, FILL_WHITE);
    clearRangeBorders(ws, BIKE_IMAGE_ROW_START, COL_G, ACC_LAST_ROW, COL_G);

    try {
        const nat = await readPngPixelSize(imagePath);
        const box = measureMergeBoxPixels(ws, BIKE_IMAGE_ROW_START, COL_G, ACC_LAST_ROW, COL_G);
        const { width: dw, height: dh } = nat
            ? fitImageInBox(
                  nat.w,
                  nat.h,
                  Math.floor(box.widthPx * BIKE_IMG_BOX_FILL),
                  Math.floor(box.heightPx * BIKE_IMG_BOX_FILL),
              )
            : { width: 160, height: 200 };
        const imgId = wb.addImage({ filename: imagePath, extension: "png" });
        const { col, row } = computeImageTlFromCenter(
            ws,
            BIKE_IMAGE_ROW_START,
            COL_G,
            ACC_LAST_ROW,
            COL_G,
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

export async function buildBicicletaIndividualSheet(
    wb: ExcelJS.Workbook,
    record: RevisionVehiculoReportRow,
    reportNombre: string,
): Promise<void> {
    const ws = wb.addWorksheet(sanitizeSheetName(`Rev-${record.id}`));
    setBikeColumnWidths(ws);

    ws.getRow(1).height = 24;
    ws.getRow(2).height = 24;
    ws.getRow(5).height = SIGNATURE_ROW_HEIGHT;
    ws.getRow(8).height = SIGNATURE_ROW_HEIGHT;

    const info = buildInfoGeneralMap(record.informacion_general);
    const revMap = buildRevisionEntryMap(record.informacion_revision);
    const movs = safeParseArray(record.movimientos_vehiculos);

    const clienteVal = getInfoValue(info, "cliente") || excelCellString(record.cliente_txt ?? "");
    const sociedadVal =
        getInfoValue(info, "sociedad", "corpo", "sucursal") || excelCellString(record.corpo_txt ?? "");

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

    mergeSet(ws, 1, 2, 2, 6, DOC_TITLE_BIKE, {
        fill: HDR_FILL,
        font: HDR_FONT,
        align: { horizontal: "center", vertical: "middle" },
    });
    mergeSet(ws, 1, COL_G, 2, COL_G, reportNombre || "—", {
        fill: FILL_WHITE,
        font: { bold: true, color: { argb: "FF000000" }, size: 9 },
        align: { horizontal: "center", vertical: "middle", wrapText: true },
    });

    mergeSet(ws, 3, 1, 3, COL_G, "INFORMACIÓN OFICIAL", {
        fill: HDR_FILL,
        font: HDR_FONT,
        align: { horizontal: "center", vertical: "middle" },
    });

    mergeOfficialLabelValue(ws, 4, 1, 5, "Cliente", clienteVal);
    mergeOfficialLabelValue(ws, 4, 6, COL_G, "Sociedad", sociedadVal);
    mergeOfficialLabelValue(ws, 5, 1, 5, "Nombre oficial de corporación", getInfoValue(info, "nombre_oficial_corporacion"));
    mergeSet(ws, 5, 6, 5, 6, "Firma:", {
        font: { bold: true, size: 9 },
        align: { horizontal: "left", vertical: "middle" },
    });
    await embedSignatureInRange(wb, ws, getInfoValue(info, "firma_oficial_corporacion"), 5, COL_G, 5, COL_G);
    applyHorizontalRows(ws, 5, 5, 6, COL_G);

    mergeOfficialLabelValue(ws, 6, 1, 2, "Fecha", getInfoValue(info, "fecha"));
    mergeOfficialLabelValue(ws, 6, 3, 5, "Hora", getInfoValue(info, "hora"));
    mergeOfficialLabelValue(ws, 6, 6, COL_G, "Código", getInfoValue(info, "codigo"));

    mergeOfficialLabelValue(ws, 7, 1, 2, "No. De placa", getInfoValue(info, "numero_placa"));
    mergeOfficialLabelValue(ws, 7, 3, 5, "Marca", getInfoValue(info, "marca"));
    mergeOfficialLabelValue(ws, 7, 6, COL_G, "Color", getInfoValue(info, "color"));

    mergeOfficialLabelValue(ws, 8, 1, 5, "Nombre de oficial de tránsito", getInfoValue(info, "nombre_oficial_transito"));
    mergeSet(ws, 8, 6, 8, 6, "Firma:", {
        font: { bold: true, size: 9 },
        align: { horizontal: "left", vertical: "middle" },
    });
    await embedSignatureInRange(wb, ws, getInfoValue(info, "firma_oficial_transito"), 8, COL_G, 8, COL_G);
    applyHorizontalRows(ws, 8, 8, 6, COL_G);

    applyRangeFill(ws, 4, 1, 8, COL_G, FILL_WHITE);
    for (const r of [4, 5, 6, 7, 8]) {
        applyHorizontalRows(ws, r, r, 1, COL_G);
    }

    mergeSet(ws, 9, 1, 9, COL_G, "ACCESORIOS DE LA BICICLETA", {
        fill: HDR_FILL,
        font: HDR_FONT,
        align: { horizontal: "center", vertical: "middle" },
    });

    mergeSet(ws, ACC_HEADER_ROW, 1, ACC_HEADER_ROW, 1, "Descripción", {
        font: { bold: true, size: 8 },
        align: { horizontal: "center" },
    });
    mergeSet(ws, ACC_HEADER_ROW, 2, ACC_HEADER_ROW, 3, "Estado", {
        font: { bold: true, size: 8 },
        align: { horizontal: "center" },
    });
    mergeSet(ws, ACC_HEADER_ROW, 4, ACC_HEADER_ROW, COL_G, "Observaciones", {
        font: { bold: true, size: 8 },
        align: { horizontal: "center" },
    });

    BICICLETA_REVISION_LABELS.forEach((label, index) => {
        const row = ACC_FIRST_ROW + index;
        writeBikeAccessoryRow(ws, row, index, label, findRevisionByLabel(revMap, label));
    });

    for (let r = ACC_FIRST_ROW; r <= ACC_LAST_ROW; r++) {
        ws.getRow(r).height = 15;
    }

    applyRangeFill(ws, ACC_HEADER_ROW, 1, ACC_LAST_ROW, COL_G, FILL_WHITE);

    const bikeImg = await resolveBikeDiagramPath();
    if (bikeImg) {
        await embedBikeDiagram(wb, ws, bikeImg);
    }

    mergeSet(ws, MOV_HEADER_ROW, 1, MOV_HEADER_ROW, COL_G, "MOVIMIENTOS DEL VEHÍCULO", {
        fill: HDR_FILL,
        font: HDR_FONT,
        align: { horizontal: "center", vertical: "middle" },
        applyCellBorders: false,
    });

    let movRow = MOV_HEADER_ROW + 1;
    const movDataStart = movRow;

    const writeMovLine = (mov: Record<string, unknown>) => {
        mergeLabelValue(ws, movRow, 1, 1, "Movimiento", excelCellString(mov.movimiento ?? ""), false);
        mergeLabelValue(ws, movRow, 2, 3, "Fecha", excelCellString(mov.fecha ?? ""), false);
        mergeLabelValue(ws, movRow, 4, 4, "Hora", excelCellString(mov.hora ?? ""), false);
        mergeLabelValue(ws, movRow, 5, 6, "Realizado por", excelCellString(mov.realizado_por ?? ""), false);
        mergeLabelValue(ws, movRow, COL_G, COL_G, "Autorizado por", excelCellString(mov.autorizado_por ?? ""), false);
        applyRangeFill(ws, movRow, 1, movRow, COL_G, FILL_WHITE);
        movRow++;
    };

    if (movs.length === 0) {
        applyRangeFill(ws, movRow, 1, movRow, COL_G, FILL_WHITE);
        movRow++;
    } else {
        for (const mov of movs) {
            if (!mov || typeof mov !== "object") continue;
            writeMovLine(mov as Record<string, unknown>);
        }
    }

    const movDataEndRow = movRow - 1;
    clearRangeBorders(ws, MOV_HEADER_ROW, 1, movDataEndRow, COL_G);

    const obsHeaderRow = movRow;
    mergeSet(ws, obsHeaderRow, 1, obsHeaderRow, COL_G, "OBSERVACIONES", {
        fill: HDR_FILL,
        font: HDR_FONT,
        align: { horizontal: "center", vertical: "middle" },
    });
    movRow++;

    const obsText = excelCellString(record.observaciones ?? "");
    const obsLines = Math.max(3, Math.min(8, Math.ceil(obsText.length / 70) + 2));
    const obsEndRow = movRow + obsLines - 1;
    mergeSet(ws, movRow, 1, obsEndRow, COL_G, obsText || "—", {
        font: { size: 9 },
        align: { horizontal: "left", vertical: "top", wrapText: true },
        fill: FILL_WHITE,
        applyCellBorders: false,
    });

    if (obsHeaderRow > movDataStart) {
        applyRangeFill(ws, movDataStart, 1, obsHeaderRow - 1, COL_G, FILL_WHITE);
    }
    applyRangeFill(ws, movRow, 1, obsEndRow, COL_G, FILL_WHITE);
    applyRangeFill(ws, obsHeaderRow, 1, obsHeaderRow, COL_G, HDR_FILL);
    applyBottomBorderRows(ws, obsHeaderRow, obsHeaderRow, 1, COL_G);
    for (let r = movRow; r <= obsEndRow; r++) {
        applyBottomBorderRows(ws, r, r, 1, COL_G);
    }

    applyOuterGrid(ws, 1, 1, obsEndRow, COL_G);
}
