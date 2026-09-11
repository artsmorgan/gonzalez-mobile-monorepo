import ExcelJS from "exceljs";

export const PLANTILLA_TABLE1_HEADERS = [
  "Código del puesto",
  "Número artículo",
  "Cantidad",
  "Serie",
  "Marca",
  "Modelo",
  "Fecha de entrega",
] as const;

export const PLANTILLA_TABLE2_HEADERS = ["Número de artículo", "Nombre del artículo"] as const;

export async function buildMantenimientoEquipoPlantillaBuffer(
  articulos: { id: number; nombre: string }[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Plantilla");

  const REF_COL_START = 9; // columna I (H queda como separador)
  const TITLE_ROW = 7;
  const HEADER_ROW = 8;
  const FIRST_DATA_ROW = 9;
  const USER_DATA_ROWS = 30;
  const LAST_COL = REF_COL_START + 1; // H

  ws.mergeCells(1, 1, 5, LAST_COL);
  const instr = ws.getCell(1, 1);
  instr.value =
    "INSTRUCCIONES:\n" +
    "1. Complete la tabla «Datos a cargar» (izquierda) con la información de cada artículo que desea vincular.\n" +
    "2. Formatos obligatorios: «Número artículo» y «Cantidad» (numéricos); «Fecha de entrega» (DD-MM-YYYY, solo fecha).\n" +
    "3. Indique en «Código del puesto» el código de cada puesto destino (debe existir en el sistema).\n" +
    "4. No modifique los encabezados ni la estructura de columnas; de lo contrario la información no se cargará.\n" +
    "5. Consulte la tabla de referencia (derecha) para verificar números y nombres de artículo válidos.";
  instr.alignment = { wrapText: true, vertical: "top" };
  instr.font = { size: 11 };

  ws.getCell(TITLE_ROW, 1).value = "Datos a cargar";
  ws.getCell(TITLE_ROW, 1).font = { bold: true, size: 12 };
  ws.getCell(TITLE_ROW, REF_COL_START).value = "Catálogo de artículos (referencia)";
  ws.getCell(TITLE_ROW, REF_COL_START).font = { bold: true, size: 12 };

  const headerRow = ws.getRow(HEADER_ROW);
  PLANTILLA_TABLE1_HEADERS.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE7E6E6" } };
  });
  PLANTILLA_TABLE2_HEADERS.forEach((h, i) => {
    const cell = headerRow.getCell(REF_COL_START + i);
    cell.value = h;
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } };
  });

  for (let i = 0; i < USER_DATA_ROWS; i++) {
    const r = ws.getRow(FIRST_DATA_ROW + i);
    r.getCell(2).numFmt = "0";
    r.getCell(3).numFmt = "0";
    r.getCell(7).numFmt = "dd-mm-yyyy";
  }

  articulos.forEach((a, i) => {
    const r = ws.getRow(FIRST_DATA_ROW + i);
    r.getCell(REF_COL_START).value = a.id;
    r.getCell(REF_COL_START).numFmt = "0";
    r.getCell(REF_COL_START + 1).value = a.nombre;
  });

  ws.getColumn(1).width = 20;
  ws.getColumn(2).width = 18;
  ws.getColumn(3).width = 14;
  ws.getColumn(4).width = 22;
  ws.getColumn(5).width = 22;
  ws.getColumn(6).width = 22;
  ws.getColumn(7).width = 24;
  ws.getColumn(8).width = 3;
  ws.getColumn(REF_COL_START).width = 18;
  ws.getColumn(REF_COL_START + 1).width = 42;

  return Buffer.from(await wb.xlsx.writeBuffer());
}
