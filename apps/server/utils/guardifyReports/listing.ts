/** Fila ya mapeada a las columnas que declara Guardify: solo texto, números o null. */
export type OutRow = Record<string, string | number | null>;

export type ListingOptions = {
    q: string | null;
    /** Columnas donde busca `q` (sin distinguir mayúsculas ni tildes). */
    searchKeys: string[];
    filters: Record<string, string>;
    /** Columnas por las que se puede filtrar (igualdad exacta) y ordenar. */
    filterKeys: string[];
    sortKeys: string[];
    sort: string | null;
    dir: "asc" | "desc";
    defaultSort: string;
    page: number;
    pageSize: number;
};

const norm = (v: unknown) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export class ListingError extends Error {
    status = 400 as const;
}

/** Aplica búsqueda, filtros, orden y paginación en memoria (los módulos ya traen hasta 50 000 filas). */
export function applyListing(all: OutRow[], o: ListingOptions): { rows: OutRow[]; total: number } {
    for (const k of Object.keys(o.filters)) if (!o.filterKeys.includes(k)) throw new ListingError(`El reporte no se puede filtrar por «${k}».`);
    const sort = o.sort ?? o.defaultSort;
    if (!o.sortKeys.includes(sort)) throw new ListingError(`No se puede ordenar por «${sort}».`);

    let rows = all;
    for (const [k, v] of Object.entries(o.filters)) rows = rows.filter((r) => String(r[k] ?? "") === v);
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

export function distinctValues(rows: OutRow[], key: string, limit = 200): string[] {
    const set = new Set<string>();
    for (const r of rows) {
        const v = r[key];
        if (v !== null && v !== undefined && String(v) !== "") set.add(String(v));
    }
    return [...set].sort((a, b) => a.localeCompare(b, "es", { numeric: true })).slice(0, limit);
}
