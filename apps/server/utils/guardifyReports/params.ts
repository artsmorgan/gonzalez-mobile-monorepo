import { ParamError } from "./errors";
import { parseScope, type ScopeItem } from "./scope";

export { ParamError };

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
    filters: Record<string, string>;
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

export function parseReportParams(sp: URLSearchParams): ReportParams {
    const from = sp.get("from") ?? "";
    const to = sp.get("to") ?? "";
    if (!DAY.test(from) || !DAY.test(to) || Number.isNaN(dayMs(from)) || Number.isNaN(dayMs(to))) throw new ParamError("from y to son obligatorios, con formato YYYY-MM-DD.");
    if (dayMs(to) <= dayMs(from)) throw new ParamError("to debe ser posterior a from.");
    if ((dayMs(to) - dayMs(from)) / 86_400_000 > MAX_RANGE_DAYS) throw new ParamError(`El periodo no puede pasar de ${MAX_RANGE_DAYS} días.`);
    const page = Math.max(1, Math.floor(Number(sp.get("page") ?? 1)) || 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(Number(sp.get("pageSize") ?? 50)) || 50));
    const filters: Record<string, string> = {};
    for (const [k, v] of sp) if (k.startsWith("f.") && v !== "") filters[k.slice(2)] = v.slice(0, 200);
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
