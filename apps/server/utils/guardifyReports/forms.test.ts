import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { clearGuardifyReportCache } from "./handler";
import { FORMS_PER_CALL, handleGuardifyForms, type FormRecord } from "./forms";
import type { OutRow } from "./listing";
import type { GuardifyReportModule } from "./types";

const KEY = "k".repeat(32);
const env = { GUARDIFY_REPORTS_API_KEY: KEY };
const auth = { authorization: `Bearer ${KEY}` };
const rows: OutRow[] = [{ id: 1, tipo: "Bicicleta", puesto: "P1" }, { id: 2, tipo: "Motocicleta", puesto: "P2" }, { id: 3, tipo: "Bicicleta", puesto: "P3" }];
const rec = (id: number, puesto: number): FormRecord => ({ id, variante: "Bicicleta", creado: "2026-09-01T08:00:00", estructura: { empresa: null, cliente: null, division: null, contrato: null, sucursal: null, puesto: null }, valores: {}, listas: {}, firmas: { firma: null }, firmasPresentes: ["firma"], hier: { puesto } });
let pedido: { ids: number[]; firmas: boolean } | null = null;
const mod: GuardifyReportModule = {
    id: "con", supportsScope: true, searchKeys: ["puesto"], filterKeys: [], sortKeys: [], defaultSort: "id",
    load: async (_db, p) => (p.scope ? rows.filter((r) => p.scope!.some((s) => `P${s.id}` === r.puesto)) : rows),
    form: { loadRecords: async (_db, ids, o) => { pedido = { ids, firmas: o.firmas }; return ids.map((i) => rec(i, i)); } },
};
const sinForm: GuardifyReportModule = { ...mod, id: "sin", form: undefined };
const deps = { registry: { con: mod, sin: sinForm }, getDb: () => ({}), env };
const call = (path: string, kind: "ids" | "records", headers: Record<string, string> = auth) => handleGuardifyForms(new Request(`http://x/api/guardify/reports/${path}`, { headers }), path.split("?")[0]!.split("/")[0]!, kind, deps);
const q = "from=2026-09-01&to=2026-10-01";

describe("formularios por registro (protocolo de la app)", () => {
    beforeEach(() => { clearGuardifyReportCache(); pedido = null; });
    it("pide la llave y avisa si el reporte no tiene formulario", async () => {
        assert.equal((await call(`con?${q}`, "ids", {})).status, 401);
        const r = await call(`sin?${q}`, "ids");
        assert.equal(r.status, 501);
        assert.equal((await r.json()).error, "form_unavailable");
        assert.equal((await call(`nada?${q}`, "ids")).status, 404);
    });
    it("lista los ids con los mismos filtros y el mismo orden que la tabla, sin paginar", async () => {
        assert.deepEqual(await (await call(`con/forms/ids?${q}`, "ids")).json(), { ids: [3, 2, 1], total: 3 });
        assert.deepEqual((await (await call(`con/forms/ids?${q}&f.tipo=Bicicleta`, "ids")).json()).ids, [3, 1]);
        assert.deepEqual((await (await call(`con/forms/ids?${q}&scope=puesto:2`, "ids")).json()).ids, [2]);
        assert.equal((await call(`con/forms/ids?${q}&f.inventada=x`, "ids")).status, 400);
    });
    it("entrega los registros pedidos, sin firmas salvo que se pidan, y quita la ubicación interna", async () => {
        const r = await call("con/forms?ids=1,2,2", "records");
        assert.equal(r.status, 200);
        const b = await r.json();
        assert.deepEqual(b.records.map((x: any) => x.id), [1, 2]);
        assert.equal("hier" in b.records[0], false);
        assert.deepEqual(pedido, { ids: [1, 2], firmas: false });
        await call("con/forms?ids=1&firmas=1", "records");
        assert.deepEqual(pedido, { ids: [1], firmas: true });
    });
    it("el alcance se aplica también a los ids sueltos: lo que no puede ver no se entrega", async () => {
        const b = await (await call("con/forms?ids=1,2,3&scope=puesto:2", "records")).json();
        assert.deepEqual(b.records.map((x: any) => x.id), [2]);
        const vacio = await (await call("con/forms?ids=1,2&scope=", "records")).json();
        assert.deepEqual(vacio.records, []);
    });
    it("valida los ids y limita cuántos se piden a la vez", async () => {
        assert.equal((await call("con/forms", "records")).status, 400);
        assert.equal((await call("con/forms?ids=abc", "records")).status, 400);
        const muchos = Array.from({ length: FORMS_PER_CALL + 1 }, (_, i) => i + 1).join(",");
        assert.equal((await call(`con/forms?ids=${muchos}`, "records")).status, 400);
    });
});
