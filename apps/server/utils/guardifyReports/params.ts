import { ParamError, UnsupportedFilterError } from "./errors";
import { parseScope, type ScopeItem } from "./scope";

export { ParamError, UnsupportedFilterError };

export const FILTER_OPS = ["eq", "in", "ge", "lt", "le", "tge", "tle", "contains"] as const;
export type FilterOp = (typeof FILTER_OPS)[number];
/** Un filtro del protocolo v2 sobre una columna de las filas. Varios filtros se combinan con Y. */
export type ColumnFilter = { col: string; op: FilterOp; values: string[] };
export const MAX_IN_VALUES = 100;
const MAX_VALUE_LENGTH = 200;
const COLUMN = /^[a-z][a-z0-9_]*$/;

export type ReportParams = {
    /** Fecha local inclusiva, `YYYY-MM-DD`. */
    from: string;
    /** Fecha local EXCLUSIVA, `YYYY-MM-DD` (Guardify manda el día siguiente al último que se quiere ver). */
    to: string;
    page: number;
    pageSize: number;
    sort: string | null;
    dir: "asc" | "desc";
    q: string | null;
    filters: ColumnFilter[];
    /** null = toda la empresa; si no, unión de estos nodos de la estructura. */
    scope: ScopeItem[] | null;
};

export const MAX_PAGE_SIZE = 1000;
export const MAX_RANGE_DAYS = 400;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const dayMs = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));

export function addDays(d: string, n: number): string {
    return new Date(dayMs(d) + n * 86_400_000).toISOString().slice(0, 10);
}

/** Lee `f.<col>` (igual) y `f.<col>.<op>`; solo `in` es repetible. Valores vacíos se ignoran. */
export function parseFilters(sp: URLSearchParams): ColumnFilter[] {
    const out: ColumnFilter[] = [];
    for (const [k, raw] of sp) {
        if (!k.startsWith("f.")) continue;
        const parts = k.slice(2).split(".");
        const col = parts[0] ?? "";
        if (parts.length > 2 || !COLUMN.test(col)) throw new UnsupportedFilterError(`Filtro «${k}» no válido: la columna debe tener formato ${COLUMN.source}.`);
        const op = (parts.length === 1 ? "eq" : parts[1]) as FilterOp;
        if (!FILTER_OPS.includes(op)) throw new UnsupportedFilterError(`Operador «${parts[1]}» no soportado en el filtro «${k}».`);
        if (raw === "") continue;
        const v = raw.slice(0, MAX_VALUE_LENGTH);
        const prev = out.find((f) => f.col === col && f.op === op);
        if (!prev) out.push({ col, op, values: [v] });
        else if (op === "in") {
            if (prev.values.length >= MAX_IN_VALUES) throw new ParamError(`El filtro «${k}» admite como máximo ${MAX_IN_VALUES} valores.`);
            prev.values.push(v);
        } else prev.values = [v]; // los demás operadores toman un valor: gana el último
    }
    return out;
}

export function parseReportParams(sp: URLSearchParams): ReportParams {
    const from = sp.get("from") ?? "";
    const to = sp.get("to") ?? "";
    if (!DAY.test(from) || !DAY.test(to) || Number.isNaN(dayMs(from)) || Number.isNaN(dayMs(to))) throw new ParamError("from y to son obligatorios, con formato YYYY-MM-DD.");
    if (dayMs(to) <= dayMs(from)) throw new ParamError("to debe ser posterior a from.");
    if ((dayMs(to) - dayMs(from)) / 86_400_000 > MAX_RANGE_DAYS) throw new ParamError(`El periodo no puede pasar de ${MAX_RANGE_DAYS} días.`);
    const page = Math.max(1, Math.floor(Number(sp.get("page") ?? 1)) || 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(Number(sp.get("pageSize") ?? 50)) || 50));
    const filters = parseFilters(sp);
    const scopeRaw = sp.get("scope");
    return {
        from,
        to,
        page,
        pageSize,
        sort: sp.get("sort") || null,
        dir: sp.get("dir") === "asc" ? "asc" : "desc",
        q: (sp.get("q") ?? "").trim().slice(0, 80) || null,
        filters,
        // `scope=` (vacío) = hay restricción pero ningún nodo mapeado: no se ve nada. Sin parámetro = toda la empresa.
        scope: scopeRaw === null ? null : parseScope(scopeRaw),
    };
}
