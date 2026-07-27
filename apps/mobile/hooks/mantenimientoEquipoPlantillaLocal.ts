import * as XLSX from 'xlsx';
import type { BulkPlantillaArticulo } from './mantenimientoEquipoBulkArticulos';

export const PLANTILLA_TABLE1_HEADERS = [
  'Código del puesto',
  'Número artículo',
  'Cantidad',
  'Serie',
  'Marca',
  'Modelo',
  'Fecha de entrega',
] as const;

const REF_COL_START = 9;
const FECHA_ENTREGA_TEMPLATE_FMT = 'dd-mm-yyyy hh:mm:ss';

function normalizeWhitespace(value: string): string {
  return value.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Acepta DD-MM-YYYY o DD/MM/YYYY con hora HH:MM:SS (componentes con 1 o 2 dígitos). */
function parseFechaEntregaParts(value: string): {
  dd: string;
  mm: string;
  yyyy: string;
  hh: string;
  mi: string;
  ss: string;
} | null {
  const s = normalizeWhitespace(value);
  const m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const [, dd, mm, yyyy, hh, mi, ss = '0'] = m;
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  const hour = Number(hh);
  const minute = Number(mi);
  const second = Number(ss || 0);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) return null;
  if (Number.isNaN(year)) return null;
  return {
    dd: String(day).padStart(2, '0'),
    mm: String(month).padStart(2, '0'),
    yyyy: String(year),
    hh: String(hour).padStart(2, '0'),
    mi: String(minute).padStart(2, '0'),
    ss: String(second).padStart(2, '0'),
  };
}

function isValidFechaEntrega(value: string): boolean {
  return parseFechaEntregaParts(value) != null;
}

function readFechaEntregaCell(ws: XLSX.WorkSheet, row: number, col: number): string {
  const addr = XLSX.utils.encode_cell({ r: row - 1, c: col - 1 });
  const cell = ws[addr];
  if (!cell) return '';

  if (cell.w != null && String(cell.w).trim() !== '') {
    return normalizeWhitespace(String(cell.w));
  }

  if (typeof cell.v === 'string' && cell.v.trim() !== '') {
    return normalizeWhitespace(cell.v);
  }

  if (typeof cell.v === 'number' && Number.isFinite(cell.v)) {
    const fmt =
      typeof cell.z === 'string' && cell.z.trim() !== '' ? cell.z : FECHA_ENTREGA_TEMPLATE_FMT;
    try {
      const formatted = XLSX.SSF.format(fmt, cell.v);
      if (formatted && formatted !== '#') {
        return normalizeWhitespace(formatted);
      }
    } catch {
      /* fallback abajo */
    }

    const parsed = XLSX.SSF.parse_date_code(cell.v);
    if (parsed) {
      const dd = String(parsed.d).padStart(2, '0');
      const mm = String(parsed.m).padStart(2, '0');
      const yyyy = String(parsed.y);
      const hh = String(parsed.H).padStart(2, '0');
      const mi = String(parsed.M).padStart(2, '0');
      const ss = String(parsed.S).padStart(2, '0');
      return `${dd}-${mm}-${yyyy} ${hh}:${mi}:${ss}`;
    }
  }

  if (cell.v == null || cell.v === '') return '';
  return normalizeWhitespace(String(cell.v));
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function headersMatch(rowValues: unknown[], expected: readonly string[]): boolean {
  if (!Array.isArray(rowValues) || rowValues.length < expected.length) return false;
  for (let i = 0; i < expected.length; i++) {
    if (normalizeHeader(rowValues[i]) !== normalizeHeader(expected[i])) return false;
  }
  return true;
}

function cellDisplay(ws: XLSX.WorkSheet, row: number, col: number): string {
  const addr = XLSX.utils.encode_cell({ r: row - 1, c: col - 1 });
  const cell = ws[addr];
  if (!cell) return '';
  if (cell.w != null && String(cell.w).trim() !== '') return String(cell.w).trim();
  if (cell.v == null || cell.v === '') return '';
  return String(cell.v).trim();
}

function cellRaw(ws: XLSX.WorkSheet, row: number, col: number): unknown {
  const addr = XLSX.utils.encode_cell({ r: row - 1, c: col - 1 });
  return ws[addr]?.v ?? null;
}

function parseNumeroArticulo(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

function parseCantidad(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.trunc(n);
}

function parseCodigoPuesto(value: unknown): string {
  if (value == null || value === '') return '';
  return String(value).trim();
}

function findTable1HeaderRow(ws: XLSX.WorkSheet): number | null {
  const ref = ws['!ref'];
  if (!ref) return null;
  const range = XLSX.utils.decode_range(ref);
  const maxRow = Math.min(range.e.r + 1, 200);
  for (let r = 1; r <= maxRow; r++) {
    const values = [
      cellRaw(ws, r, 1),
      cellRaw(ws, r, 2),
      cellRaw(ws, r, 3),
      cellRaw(ws, r, 4),
      cellRaw(ws, r, 5),
      cellRaw(ws, r, 6),
      cellRaw(ws, r, 7),
    ];
    if (headersMatch(values, PLANTILLA_TABLE1_HEADERS)) return r;
  }
  return null;
}

function readReferenceCatalog(ws: XLSX.WorkSheet): Map<number, string> {
  const catalog = new Map<number, string>();
  const ref = ws['!ref'];
  if (!ref) return catalog;
  const range = XLSX.utils.decode_range(ref);
  const maxRow = range.e.r + 1;
  for (let r = 9; r <= maxRow; r++) {
    const id = parseNumeroArticulo(cellRaw(ws, r, REF_COL_START));
    const nombre = cellDisplay(ws, r, REF_COL_START + 1);
    if (id && nombre) catalog.set(id, nombre);
  }
  return catalog;
}

export async function parseMantenimientoEquipoPlantillaLocal(
  fileUri: string,
): Promise<{ status: boolean; message?: string; errors?: string[]; data?: BulkPlantillaArticulo[] }> {
  try {
    const response = await fetch(fileUri);
    if (!response.ok) {
      return { status: false, message: 'No se pudo leer el archivo seleccionado.' };
    }
    const buffer = await response.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array', cellDates: false, cellText: true, cellNF: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) {
      return { status: false, message: 'El archivo Excel no contiene hojas.' };
    }

    const headerRow = findTable1HeaderRow(ws);
    if (!headerRow) {
      return {
        status: false,
        message: 'No se encontró la tabla «Datos a cargar».',
        errors: [
          'Verifique que los encabezados sean: ' + PLANTILLA_TABLE1_HEADERS.join(', '),
        ],
      };
    }

    const catalog = readReferenceCatalog(ws);
    if (catalog.size === 0) {
      return {
        status: false,
        message: 'No se encontró el catálogo de referencia en la plantilla.',
      };
    }

    const rows: BulkPlantillaArticulo[] = [];
    const errors: string[] = [];
    const ref = ws['!ref'];
    const maxRow = ref ? XLSX.utils.decode_range(ref).e.r + 1 : headerRow + 500;

    for (let r = headerRow + 1; r <= maxRow; r++) {
      const codigoPuesto = parseCodigoPuesto(cellRaw(ws, r, 1));
      const numeroRaw = cellRaw(ws, r, 2);
      const cantidadRaw = cellRaw(ws, r, 3);
      const serie = cellDisplay(ws, r, 4);
      const marca = cellDisplay(ws, r, 5);
      const modelo = cellDisplay(ws, r, 6);
      const fechaEntrega = readFechaEntregaCell(ws, r, 7);

      const numeroEmpty =
        numeroRaw == null ||
        numeroRaw === '' ||
        (typeof numeroRaw === 'string' && numeroRaw.trim() === '');
      const allEmpty =
        !codigoPuesto &&
        numeroEmpty &&
        (cantidadRaw == null || cantidadRaw === '') &&
        !serie &&
        !marca &&
        !modelo &&
        !fechaEntrega;
      if (allEmpty) continue;

      if (
        headersMatch(
          [codigoPuesto, numeroRaw, cantidadRaw, serie, marca, modelo, fechaEntrega],
          PLANTILLA_TABLE1_HEADERS,
        )
      ) {
        continue;
      }

      if (!codigoPuesto) {
        errors.push(`Fila ${r}: «Código del puesto» es obligatorio.`);
        continue;
      }

      const numero = parseNumeroArticulo(numeroRaw);
      const cantidad = parseCantidad(cantidadRaw);

      if (!numero) {
        errors.push(`Fila ${r}: «Número artículo» inválido o vacío.`);
        continue;
      }
      if (cantidad === null) {
        errors.push(`Fila ${r}: «Cantidad» inválida.`);
        continue;
      }
      if (!serie) {
        errors.push(`Fila ${r}: «Serie» es obligatoria.`);
        continue;
      }
      if (!marca) {
        errors.push(`Fila ${r}: «Marca» es obligatoria.`);
        continue;
      }
      if (!fechaEntrega || !isValidFechaEntrega(fechaEntrega)) {
        errors.push(`Fila ${r}: «Fecha de entrega» inválida. Use DD-MM-YYYY HH:MM:SS.`);
        continue;
      }

      const articuloNombre = catalog.get(numero);
      if (!articuloNombre) {
        errors.push(`Fila ${r}: el artículo #${numero} no existe en el catálogo de referencia.`);
        continue;
      }

      rows.push({
        codigo_puesto: codigoPuesto,
        numero_articulo: numero,
        cantidad,
        serie,
        marca,
        modelo: modelo || null,
        fecha_entrega: fechaEntrega,
        articulo_nombre: articuloNombre,
      });
    }

    if (rows.length === 0 && errors.length === 0) {
      return {
        status: false,
        message: 'La tabla «Datos a cargar» no contiene registros.',
        errors: ['La tabla «Datos a cargar» no contiene registros.'],
      };
    }
    if (errors.length > 0) {
      return {
        status: false,
        message: 'La plantilla no cumple la estructura requerida.',
        errors,
        data: rows,
      };
    }

    return {
      status: true,
      message: `${rows.length} registro(s) válido(s).`,
      data: rows,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'No se pudo leer la plantilla.';
    return { status: false, message: msg };
  }
}
