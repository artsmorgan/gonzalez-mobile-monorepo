/**
 * Límites de la importación de Excel (issue #175, H09). Módulo PURO, sin Expo/React Native ni SheetJS, para poder probarlo en Node.
 * Se aplican ANTES de cargar o recorrer el libro: un archivo o un rango exagerado no debe congelar la app ni agotar la memoria.
 * Cada comprobación devuelve el mensaje de error (en español, para el usuario) o `null` si pasa.
 */
export const EXCEL_IMPORT_LIMITS = {
  /** Tamaño máximo del archivo. */
  maxBytes: 5 * 1024 * 1024,
  maxSheets: 5,
  maxRows: 5000,
  maxColumns: 50,
  /** Caracteres máximos por celda. */
  maxCellChars: 2000,
} as const;

/** Miles con punto (5.000). A mano: `Intl` varía entre Hermes y otros motores. */
const fmt = { format: (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.') };
const MB = 1024 * 1024;

/** `bytes` desconocido (el selector de archivos no siempre lo informa) pasa aquí y se vuelve a revisar al leer el contenido. */
export function checkExcelFileSize(bytes: unknown): string | null {
  if (bytes === undefined || bytes === null) return null;
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0 || n > EXCEL_IMPORT_LIMITS.maxBytes) {
    const shown = Number.isFinite(n) ? `pesa ${(n / MB).toFixed(1)} MB y ` : '';
    return `El archivo ${shown}supera el máximo permitido de ${EXCEL_IMPORT_LIMITS.maxBytes / MB} MB.`;
  }
  return null;
}

export function checkSheetCount(count: number): string | null {
  if (count > EXCEL_IMPORT_LIMITS.maxSheets) {
    return `El libro tiene ${count} hojas y el máximo permitido es ${EXCEL_IMPORT_LIMITS.maxSheets}.`;
  }
  return null;
}

function columnNumber(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

/** Filas y columnas que abarca un rango A1 (`"A1:G10"`, `"B2"`); `null` si no es un rango. */
export function decodeSheetRef(ref: unknown): { rows: number; cols: number } | null {
  if (typeof ref !== 'string') return null;
  const m = /^([A-Za-z]{1,3})(\d{1,8})(?::([A-Za-z]{1,3})(\d{1,8}))?$/.exec(ref.trim());
  if (!m) return null;
  const c1 = columnNumber(m[1]!);
  const r1 = Number(m[2]);
  const c2 = m[3] ? columnNumber(m[3]) : c1;
  const r2 = m[4] ? Number(m[4]) : r1;
  if (r1 < 1 || r2 < 1) return null;
  return { rows: Math.abs(r2 - r1) + 1, cols: Math.abs(c2 - c1) + 1 };
}

/** Rango que declara la hoja (antes de recorrerla). */
export function checkSheetRange(ref: unknown): string | null {
  const d = decodeSheetRef(ref);
  if (!d) return 'El rango de la hoja no es válido.';
  if (d.rows > EXCEL_IMPORT_LIMITS.maxRows) {
    return `La hoja declara ${fmt.format(d.rows)} filas y el máximo permitido es ${fmt.format(EXCEL_IMPORT_LIMITS.maxRows)}.`;
  }
  if (d.cols > EXCEL_IMPORT_LIMITS.maxColumns) {
    return `La hoja declara ${fmt.format(d.cols)} columnas y el máximo permitido es ${EXCEL_IMPORT_LIMITS.maxColumns}.`;
  }
  return null;
}

export function checkCellChars(text: string): boolean {
  return text.length <= EXCEL_IMPORT_LIMITS.maxCellChars;
}

export const CELL_TOO_LONG_MESSAGE = `una celda supera los ${fmt.format(EXCEL_IMPORT_LIMITS.maxCellChars)} caracteres permitidos.`;
