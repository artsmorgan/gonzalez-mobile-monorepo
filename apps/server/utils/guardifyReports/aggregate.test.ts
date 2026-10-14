import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { aggregateRows, parseSpec, NO_DATA } from "./aggregate";
import { clearGuardifyReportCache, handleGuardifyReport } from "./handler";
import type { OutRow } from "./listing";
import type { GuardifyReportModule } from "./types";

const rows: OutRow[] = [
    { id: 1, creado: "2026-04-06T08:00:00", cliente: "CCSS", enviados: 100, vistos: 50, firmador: "Ana" },
    { id: 2, creado: "2026-04-07T09:00:00", cliente: "CCSS", enviados: 40, vistos: 40, firmador: "Ana" },
    { id: 3, creado: "2026-04-14T09:00:00", cliente: "TSE", enviados: 10, vistos: 0, firmador: "Luis" },
    { id: 4, creado: "2026-05-02T10:00:00", cliente: null, enviados: null, vistos: 5, firmador: "Luis" },
    { id: 5, creado: null, cliente: "TSE", enviados: "20", vistos: 1, firmador: null },
];
const spec = (s: unknown) => parseSpec(JSON.stringify(s));

describe("agregados genéricos", () => {
    it("sin grupo: total, suma, promedio, mínimo, máximo y distintos", () => {
        const r = aggregateRows(rows, spec([{ id: "kpi", metrics: [{ agg: "count" }, { agg: "sum", col: "enviados" }, { agg: "avg", col: "enviados" }, { agg: "min", col: "vistos" }, { agg: "max", col: "vistos" }, { agg: "distinct", col: "firmador" }] }]));
        assert.equal(r.total, 5);
        assert.deepEqual(r.widgets.kpi!.rows[0], { key: "total", count: 5, sum_enviados: 170, avg_enviados: 42.5, min_vistos: 0, max_vistos: 50, distinct_firmador: 2 }); // «20» como texto cuenta; null no
    });
    it("por categoría: de mayor a menor, con «Sin dato» y un top que junta el resto en «Otros»", () => {
        const r = aggregateRows(rows, spec([{ id: "c", metrics: [{ agg: "sum", col: "enviados" }], group: "cliente" }])).widgets.c!;
        assert.deepEqual(r.rows.map((x) => [x.key, x.sum_enviados]), [["CCSS", 140], ["TSE", 30], [NO_DATA, 0]]);
        const t = aggregateRows(rows, spec([{ id: "c", metrics: [{ agg: "count" }], group: "firmador", top: 1 }])).widgets.c!;
        assert.deepEqual(t.rows.map((x) => [x.key, x.count]), [["Ana", 2], ["Otros", 3]]);
        assert.equal(t.groups, 3);
    });
    it("línea de tiempo por día, semana (lunes) y mes, en orden y con «Sin dato» al final", () => {
        const d = aggregateRows(rows, spec([{ id: "t", metrics: [{ agg: "count" }], group: "creado", bucket: "day" }])).widgets.t!;
        assert.deepEqual(d.rows.map((x) => x.key), ["2026-04-06", "2026-04-07", "2026-04-14", "2026-05-02", NO_DATA]);
        const w = aggregateRows(rows, spec([{ id: "t", metrics: [{ agg: "count" }], group: "creado", bucket: "week" }])).widgets.t!;
        assert.deepEqual(w.rows.map((x) => [x.key, x.count]), [["2026-04-06", 2], ["2026-04-13", 1], ["2026-04-27", 1], [NO_DATA, 1]]);
        const m = aggregateRows(rows, spec([{ id: "t", metrics: [{ agg: "count" }], group: "creado", bucket: "month" }])).widgets.t!;
        assert.deepEqual(m.rows.map((x) => x.key), ["2026-04", "2026-05", NO_DATA]);
    });
    it("valida el spec y las columnas", () => {
        assert.throws(() => parseSpec(null), /spec es obligatorio/);
        assert.throws(() => parseSpec("no json"), /JSON/);
        assert.throws(() => spec([{ id: "x", metrics: [{ agg: "median", col: "a" }] }]), /no soportado/);
        assert.throws(() => spec([{ id: "x", metrics: [{ agg: "sum" }] }]), /columna/);
        assert.throws(() => spec([{ id: "bad id", metrics: [{ agg: "count" }] }]), /id/);
        assert.throws(() => aggregateRows(rows, spec([{ id: "x", metrics: [{ agg: "sum", col: "nada" }] }])), /no tiene la columna/);
        assert.deepEqual(aggregateRows([], spec([{ id: "x", metrics: [{ agg: "count" }], group: "cliente" }])).widgets.x, { rows: [], groups: 0 });
    });
});

describe("GET …/aggregate", () => {
    const KEY = "k".repeat(32);
    const mod: GuardifyReportModule = { id: "demo", supportsScope: true, searchKeys: ["cliente"], filterKeys: [], sortKeys: [], defaultSort: "creado", load: async () => rows };
    beforeEach(() => clearGuardifyReportCache());
    const call = (qs: string) => handleGuardifyReport(new Request(`http://x/api/guardify/reports/demo/aggregate?from=2026-01-01&to=2026-12-31&${qs}`, { headers: { authorization: `Bearer ${KEY}` } }), "demo", "aggregate", { registry: { demo: mod }, getDb: () => ({}), env: { GUARDIFY_REPORTS_API_KEY: KEY } });
    it("usa los mismos filtros y búsqueda que la tabla", async () => {
        const s = encodeURIComponent(JSON.stringify([{ id: "k", metrics: [{ agg: "sum", col: "enviados" }] }]));
        const all = await (await call(`spec=${s}`)).json();
        assert.equal(all.total, 5);
        const f = await (await call(`spec=${s}&f.cliente=CCSS`)).json();
        assert.equal(f.total, 2);
        assert.equal(f.widgets.k.rows[0].sum_enviados, 140);
        const q = await (await call(`spec=${s}&q=tse`)).json();
        assert.equal(q.total, 2);
    });
    it("400 con spec inválido o columna inexistente, y exige la llave", async () => {
        assert.equal((await call("")).status, 400);
        const bad = encodeURIComponent(JSON.stringify([{ id: "k", metrics: [{ agg: "sum", col: "nada" }] }]));
        const r = await call(`spec=${bad}`);
        assert.equal(r.status, 400);
        assert.equal((await r.json()).error, "unsupported_filter");
        const noauth = await handleGuardifyReport(new Request("http://x/api/guardify/reports/demo/aggregate?from=2026-01-01&to=2026-12-31"), "demo", "aggregate", { registry: { demo: mod }, getDb: () => ({}), env: { GUARDIFY_REPORTS_API_KEY: KEY } });
        assert.equal(noauth.status, 401);
    });
});
