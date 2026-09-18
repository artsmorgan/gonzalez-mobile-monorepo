export type DateLike = Date | string | number | null | undefined;

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Visual format only (no server payload): DD-MM-YYYY.
 * - If input is ISO or starts with YYYY-MM-DD, it avoids timezone shifting by using the date part.
 */
export function formatDateDMY(value: DateLike, fallback: string = 'N/A'): string {
  if (value === null || value === undefined) return fallback;

  if (value instanceof Date) {
    if (isNaN(value.getTime())) return fallback;
    return `${pad2(value.getDate())}-${pad2(value.getMonth() + 1)}-${value.getFullYear()}`;
  }

  if (typeof value === 'number') {
    const d = new Date(value);
    if (isNaN(d.getTime())) return fallback;
    return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`;
  }

  const s = String(value).trim();
  if (!s) return fallback;

  // Prefer parsing as YYYY-MM-DD without timezone shifts.
  const ymd = s.includes('T') ? s.split('T')[0] : s;

  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);

  if (m) {
    const [, y, mo, d] = m;

    const formattedDate = `${d}-${mo}-${y}`;

    return formattedDate;
  }

  // Fallback: try Date parsing
  const d = new Date(s);

  if (!isNaN(d.getTime())) {
    return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`;
  }

  return ymd;
}


