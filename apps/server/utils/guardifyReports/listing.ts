import { UnsupportedFilterError } from "./errors";
import type { ColumnFilter } from "./params";

/** Fila ya mapeada a las columnas que declara Guardify: solo texto, números o null. */
export type OutRow = Record<string, string | number | null>;

export type ListingOptions = {
    q: string | null;
    /** Columnas donde busca `q` (sin distinguir mayúsculas ni tildes). */
    searchKeys: string[];
    /** Filtros del protocolo v2 (sobre cualquier columna de las filas), combinados con Y. */
    filters: ColumnFilter[];
    sort: string | null;
    dir: "asc" | "desc";
    defaultSort: string;
    page: number;
    pageSize: number;
};

export const MAX_OPTIONS_LIMIT = 200;

const norm = (v: unknown) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export class ListingError extends Error {
    status = 400 as const;
}

/** ¿La columna existe en las filas? Se comprueba con las claves de la primera fila; sin filas no hay nada que validar. */
export const hasColumn = (rows: OutRow[], col: string) => rows.length === 0 || Object.prototype.hasOwnProperty.call(rows[0], col);

const isNumeric = (v: unknown) => (typeof v === "number" ? Number.isFinite(v) : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)));
const cmp = (a: number | string, b: number | string) => (a < b ? -1 : a > b ? 1 : 0);
/** Compara fila contra valor del filtro: como número si ambos son numéricos, si no como texto (las fechas ISO se ordenan bien). */
const compare = (rv: string | number, fv: string) => (isNumeric(rv) && isNumeric(fv) ? cmp(Number(rv), Number(fv)) : cmp(String(rv), fv));
const DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const HOUR = /^(\d{1,2}):(\d{2})/;
/** `HH:MM` de las posiciones 11 a 15 de `YYYY-MM-DDTHH:mm:ss`; null si la columna no tiene ese formato. */
const hourOf = (rv: string | number) => (DATETIME.test(String(rv)) ? String(rv).slice(11, 16) : null);
const normHour = (v: string) => {
    const m = HOUR.exec(v);
    return m ? `${m[1]!.padStart(2, "0")}:${m[2]}` : null;
};

function matches(rv: string | number | null | undefined, f: ColumnFilter): boolean {
    if (rv === null || rv === undefined) return false; // un vacío nunca cumple
    const v = f.values[0] ?? "";
    switch (f.op) {
        case "eq": return String(rv) === v;
        case "in": return f.values.includes(String(rv));
        case "ge": return compare(rv, v) >= 0;
        case "lt": return compare(rv, v) < 0;
        case "le": return compare(rv, v) <= 0;
        case "tge":
        case "tle": {
            const h = hourOf(rv), t = normHour(v);
            if (h === null || t === null) return false;
            return f.op === "tge" ? h >= t : h <= t;
        }
        case "contains": return norm(rv).includes(norm(v));
    }
}

/** Aplica los filtros (Y entre todos). Una columna que no existe en las filas responde 400 `unsupported_filter`. */
export function applyFilters(rows: OutRow[], filters: ColumnFilter[]): OutRow[] {
    for (const f of filters) if (!hasColumn(rows, f.col)) throw new UnsupportedFilterError(`El reporte no tiene la columna «${f.col}».`);
    return filters.length === 0 ? rows : rows.filter((r) => filters.every((f) => matches(r[f.col], f)));
}

/** Aplica filtros, búsqueda, orden y paginación en memoria (los módulos ya traen hasta 50 000 filas). */
export function applyListing(all: OutRow[], o: ListingOptions): { rows: OutRow[]; total: number } {
    const sort = o.sort ?? o.defaultSort;
    if (!hasColumn(all, sort)) throw new ListingError(`No se puede ordenar por «${sort}».`);

    let rows = applyFilters(all, o.filters);
    if (o.q) {
        const needle = norm(o.q);
        rows = rows.filter((r) => o.searchKeys.some((k) => norm(r[k]).includes(needle)));
    }
    const sign = o.dir === "asc" ? 1 : -1;
    const sorted = rows
        .map((r, i) => ({ r, i }))
        .sort((a, b) => {
            const x = a.r[sort] ?? null, y = b.r[sort] ?? null;
            if (x === null && y === null) return a.i - b.i;
            if (x === null) return 1; // los vacíos siempre al final
            if (y === null) return -1;
            const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "es", { numeric: true });
            return c !== 0 ? c * sign : a.i - b.i;
        })
        .map((e) => e.r);
    const start = (o.page - 1) * o.pageSize;
    return { rows: sorted.slice(start, start + o.pageSize), total: sorted.length };
}

/** Valores distintos de una columna; `q` = solo los que contienen ese texto (sin tildes ni mayúsculas); `limit` con tope de 200. */
export function distinctValues(rows: OutRow[], key: string, opts: { q?: string | null; limit?: number } = {}): string[] {
    const limit = Math.min(MAX_OPTIONS_LIMIT, Math.max(1, Math.floor(opts.limit ?? MAX_OPTIONS_LIMIT) || MAX_OPTIONS_LIMIT));
    const needle = opts.q ? norm(opts.q) : null;
    const set = new Set<string>();
    for (const r of rows) {
        const v = r[key];
        if (v === null || v === undefined || String(v) === "") continue;
        if (needle !== null && !norm(v).includes(needle)) continue;
        set.add(String(v));
    }
    return [...set].sort((a, b) => a.localeCompare(b, "es", { numeric: true })).slice(0, limit);
}
