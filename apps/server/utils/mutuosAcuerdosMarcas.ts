/** Helpers compartidos para mutuos acuerdos (marcas en array-string + fechas). */

export const parseIntStrict = (value: unknown): number | null => {
  const n = parseInt(String(value), 10);
  return Number.isNaN(n) ? null : n;
};

/** Parsea `marcas_ausente` / `marcas_reemplaza` (JSON array string, array o CSV). */
export function parseMarcaIdsArray(raw: unknown): number[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return [
      ...new Set(
        raw
          .map((x) => parseIntStrict(x))
          .filter((n): n is number => n != null && n > 0),
      ),
    ];
  }
  const s = String(raw).trim();
  if (!s) return [];
  try {
    const parsed = JSON.parse(s);
    if (Array.isArray(parsed)) return parseMarcaIdsArray(parsed);
  } catch {
    /* fall through */
  }
  return [
    ...new Set(
      s
        .split(/[,\[\]\s]+/)
        .map((x) => parseIntStrict(x))
        .filter((n): n is number => n != null && n > 0),
    ),
  ];
}

export function stringifyMarcaIds(ids: number[]): string {
  return JSON.stringify([...new Set(ids.filter((n) => Number.isFinite(n) && n > 0))]);
}

/** YYYY-MM-DD desde Date/ISO/string. */
export function ymdFromFecha(fecha: Date | string | null | undefined): string | null {
  if (!fecha) return null;
  if (typeof fecha === "string") {
    const m = fecha.trim().match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
  }
  const d = fecha instanceof Date ? fecha : new Date(String(fecha));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().split("T")[0];
}

export function dateAtUtcMidnight(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}
