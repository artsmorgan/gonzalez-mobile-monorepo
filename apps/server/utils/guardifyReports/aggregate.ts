import { ParamError, UnsupportedFilterError } from "./errors";
import { hasColumn, type OutRow } from "./listing";

/**
 * Agregados genéricos para los widgets del tablero de cada reporte (protocolo de reportes de Guardify). Guardify define QUÉ se mide
 * (`spec`); la app solo cuenta, suma, promedia y agrupa sobre las mismas filas que ya filtró para la tabla.
 *
 *   GET …/{modulo}/aggregate?<mismos parámetros que la tabla>&spec=<JSON>
 *   spec = [{ id, metrics: [{ agg: "count" | "sum" | "avg" | "min" | "max" | "distinct", col? }], group?: col, bucket?: "day" | "week" | "month", top?: n }]
 *   → { total, widgets: { <id>: { rows: [{ key, <métrica>… }], groups } } }   (la métrica se llama `count`, `sum_<col>`, `avg_<col>`, `distinct_<col>`…)
 */
export const AGGS = ["count", "sum", "avg", "min", "max", "distinct"] as const;
export type Agg = (typeof AGGS)[number];
export type AggMetric = { agg: Agg; col?: string };
export type AggWidget = { id: string; metrics: AggMetric[]; group?: string; bucket?: "day" | "week" | "month"; top?: number };
export const MAX_WIDGETS = 16;
export const MAX_METRICS = 6;
export const MAX_TOP = 50;
const COLUMN = /^[a-z][a-z0-9_]*$/;
const ID = /^[A-Za-z0-9_-]{1,40}$/;
export const NO_DATA = "Sin dato";

export const metricName = (m: AggMetric) => (m.agg === "count" ? "count" : `${m.agg}_${m.col}`);

export function parseSpec(raw: string | null): AggWidget[] {
    if (!raw) throw new ParamError("spec es obligatorio (JSON).");
    let v: unknown;
    try { v = JSON.parse(raw); } catch { throw new ParamError("spec no es JSON válido."); }
    if (!Array.isArray(v) || !v.length || v.length > MAX_WIDGETS) throw new ParamError(`spec debe ser una lista de 1 a ${MAX_WIDGETS} widgets.`);
    return v.map((w: any, i): AggWidget => {
        if (!w || typeof w !== "object" || !ID.test(String(w.id ?? ""))) throw new ParamError(`spec[${i}].id no es válido.`);
        const metrics = Array.isArray(w.metrics) ? w.metrics : [];
        if (!metrics.length || metrics.length > MAX_METRICS) throw new ParamError(`spec[${i}].metrics: de 1 a ${MAX_METRICS} métricas.`);
        const ms = metrics.map((m: any): AggMetric => {
            if (!AGGS.includes(m?.agg)) throw new ParamError(`spec[${i}]: agregado «${m?.agg}» no soportado.`);
            if (m.agg !== "count" && !COLUMN.test(String(m.col ?? ""))) throw new UnsupportedFilterError(`spec[${i}]: «${m.agg}» necesita una columna válida.`);
            return m.agg === "count" ? { agg: "count" } : { agg: m.agg, col: String(m.col) };
        });
        if (w.group !== undefined && !COLUMN.test(String(w.group))) throw new UnsupportedFilterError(`spec[${i}].group no es una columna válida.`);
        if (w.bucket !== undefined && !["day", "week", "month"].includes(w.bucket)) throw new ParamError(`spec[${i}].bucket debe ser day, week o month.`);
        const top = w.top === undefined ? undefined : Math.min(MAX_TOP, Math.max(1, Math.floor(Number(w.top)) || 10));
        return { id: String(w.id), metrics: ms, ...(w.group ? { group: String(w.group) } : {}), ...(w.bucket ? { bucket: w.bucket } : {}), ...(top ? { top } : {}) };
    });
}

const num = (v: unknown): number | null => (typeof v === "number" ? (Number.isFinite(v) ? v : null) : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null);
/** Lunes de la semana de una fecha `YYYY-MM-DD` (las semanas de Guardify empiezan en lunes). */
const weekStart = (d: string) => {
    const t = new Date(`${d}T00:00:00Z`);
    t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7));
    return t.toISOString().slice(0, 10);
};
const bucketKey = (v: unknown, b: "day" | "week" | "month"): string => {
    const s = String(v ?? "");
    if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return NO_DATA;
    return b === "month" ? s.slice(0, 7) : b === "week" ? weekStart(s.slice(0, 10)) : s.slice(0, 10);
};

type Acc = { count: number; sums: Map<string, number>; nums: Map<string, number>; mins: Map<string, number>; maxs: Map<string, number>; sets: Map<string, Set<string>> };
const fresh = (): Acc => ({ count: 0, sums: new Map(), nums: new Map(), mins: new Map(), maxs: new Map(), sets: new Map() });
function add(a: Acc, row: OutRow, metrics: AggMetric[]) {
    a.count++;
    for (const m of metrics) {
        if (m.agg === "count") continue;
        const k = metricName(m);
        const raw = row[m.col!];
        if (m.agg === "distinct") { if (raw !== null && raw !== undefined && raw !== "") (a.sets.get(k) ?? a.sets.set(k, new Set()).get(k)!).add(String(raw)); continue; }
        const n = num(raw);
        if (n === null) continue;
        a.sums.set(k, (a.sums.get(k) ?? 0) + n);
        a.nums.set(k, (a.nums.get(k) ?? 0) + 1);
        a.mins.set(k, Math.min(a.mins.get(k) ?? n, n));
        a.maxs.set(k, Math.max(a.maxs.get(k) ?? n, n));
    }
}
const round = (n: number) => Math.round(n * 100) / 100;
function value(a: Acc, m: AggMetric): number | null {
    const k = metricName(m);
    switch (m.agg) {
        case "count": return a.count;
        case "distinct": return a.sets.get(k)?.size ?? 0;
        case "sum": return a.nums.has(k) ? round(a.sums.get(k)!) : 0;
        case "avg": return a.nums.has(k) ? round(a.sums.get(k)! / a.nums.get(k)!) : null;
        case "min": return a.mins.get(k) ?? null;
        case "max": return a.maxs.get(k) ?? null;
    }
}

export type AggResult = { total: number; widgets: Record<string, { rows: Record<string, string | number | null>[]; groups: number }> };

/** Calcula todos los widgets en una sola pasada por widget sobre las filas ya filtradas. */
export function aggregateRows(rows: OutRow[], spec: AggWidget[]): AggResult {
    const out: AggResult["widgets"] = {};
    for (const w of spec) {
        for (const m of w.metrics) if (m.col && !hasColumn(rows, m.col)) throw new UnsupportedFilterError(`El reporte no tiene la columna «${m.col}».`);
        if (w.group && !hasColumn(rows, w.group)) throw new UnsupportedFilterError(`El reporte no tiene la columna «${w.group}».`);
        if (!w.group) {
            const a = fresh();
            for (const r of rows) add(a, r, w.metrics);
            out[w.id] = { rows: [{ key: "total", ...Object.fromEntries(w.metrics.map((m) => [metricName(m), value(a, m)])) }], groups: 1 };
            continue;
        }
        const groups = new Map<string, Acc>();
        for (const r of rows) {
            const key = w.bucket ? bucketKey(r[w.group], w.bucket) : String(r[w.group] ?? "").trim() || NO_DATA;
            const a = groups.get(key) ?? groups.set(key, fresh()).get(key)!;
            add(a, r, w.metrics);
        }
        const first = w.metrics[0]!;
        let entries = [...groups.entries()];
        // Una línea de tiempo va en orden cronológico; las categorías, de mayor a menor por la primera métrica.
        entries = w.bucket ? entries.sort((x, y) => (x[0] === NO_DATA ? 1 : y[0] === NO_DATA ? -1 : x[0] < y[0] ? -1 : 1)) : entries.sort((x, y) => (value(y[1], first) ?? -Infinity) - (value(x[1], first) ?? -Infinity) || (x[0] < y[0] ? -1 : 1));
        const shown = w.top && !w.bucket ? entries.slice(0, w.top) : entries;
        const rest = w.top && !w.bucket ? entries.slice(w.top) : [];
        const rowsOut = shown.map(([key, a]) => ({ key, ...Object.fromEntries(w.metrics.map((m) => [metricName(m), value(a, m)])) }));
        // Lo que no entra en el top se junta en «Otros» (solo para métricas que se pueden sumar entre grupos).
        if (rest.length) {
            const o: Record<string, string | number | null> = { key: "Otros" };
            for (const m of w.metrics) o[metricName(m)] = m.agg === "count" || m.agg === "sum" ? round(rest.reduce((s, [, a]) => s + (value(a, m) ?? 0), 0)) : null;
            rowsOut.push(o as any);
        }
        out[w.id] = { rows: rowsOut, groups: groups.size };
    }
    return { total: rows.length, widgets: out };
}
