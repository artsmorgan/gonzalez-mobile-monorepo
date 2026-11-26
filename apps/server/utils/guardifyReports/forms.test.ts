import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { clearGuardifyReportCache } from "./handler";
import { ATTACHMENT_MAX_BYTES, contentDispositionAttachment, FORMS_PER_CALL, handleGuardifyAttachment, handleGuardifyForms, lenientDb, type FormRecord, type GuardifyFormModule } from "./forms";
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

describe("adjunto de un registro (GET …/forms/{id}/attachments/{attachmentId})", () => {
    // Registro 1 (puesto 1) con el adjunto «10»; registro 2 (puesto 2) con el «20» (grande si se pide «21»).
    const adj: Record<number, Record<string, number>> = { 1: { "10": 4 }, 2: { "20": 4, "21": ATTACHMENT_MAX_BYTES + 1 } };
    const formAdj: GuardifyFormModule = {
        loadRecords: async () => [],
        loadAttachment: async (_db, id, aid, fetchFile) => {
            const n = adj[id]?.[aid];
            if (n == null || !fetchFile) return null;
            const f = await fetchFile(`x/${id}/${aid}`);
            return f && { bytes: f.bytes.byteLength === n ? f.bytes : new Uint8Array(n), contentType: "application/pdf", nombre: "Dictamen médico (1).pdf", hier: { puesto: id } };
        },
    };
    const conAdj: GuardifyReportModule = { ...mod, id: "adj", form: formAdj };
    const noScope: GuardifyReportModule = { ...conAdj, id: "noscope", supportsScope: false };
    const adeps = { registry: { adj: conAdj, con: mod, noscope: noScope }, getDb: () => ({}), env, fetchFile: async () => ({ bytes: new Uint8Array([37, 80, 68, 70]) }) };
    const get = (modulo: string, id: string, aid: string, qs = "", headers: Record<string, string> = auth) =>
        handleGuardifyAttachment(new Request(`http://x/api/guardify/reports/${modulo}/forms/${id}/attachments/${aid}${qs}`, { headers }), modulo, id, aid, adeps);
    it("llave inválida → 401", async () => {
        assert.equal((await get("adj", "1", "10", "", {})).status, 401);
        assert.equal((await get("adj", "1", "10", "", { authorization: "Bearer otra-llave-cualquiera-de-32-chars" })).status, 401);
    });
    it("entrega el archivo con su tipo, nombre codificado y sin caché", async () => {
        const r = await get("adj", "1", "10");
        assert.equal(r.status, 200);
        assert.equal(r.headers.get("content-type"), "application/pdf");
        assert.equal(r.headers.get("cache-control"), "no-store");
        assert.equal(r.headers.get("content-disposition"), "attachment; filename*=UTF-8''Dictamen%20m%C3%A9dico%20%281%29.pdf");
        assert.deepEqual([...new Uint8Array(await r.arrayBuffer())], [37, 80, 68, 70]);
    });
    it("adjunto de otra solicitud, registro inexistente o módulo sin adjuntos → 404 attachment_not_found", async () => {
        for (const [m, id, aid] of [["adj", "1", "20"], ["adj", "9", "10"], ["adj", "abc", "10"], ["con", "1", "10"]] as const) {
            const r = await get(m, id, aid);
            assert.equal(r.status, 404, `${m}/${id}/${aid}`);
            assert.equal((await r.json()).error, "attachment_not_found");
        }
        assert.equal((await get("nada", "1", "10")).status, 404);
    });
    it("fuera del alcance → 404 (igual que si no existiera); dentro → 200", async () => {
        const fuera = await get("adj", "1", "10", "?scope=puesto:2");
        assert.equal(fuera.status, 404);
        assert.equal((await fuera.json()).error, "attachment_not_found");
        assert.equal((await get("adj", "1", "10", "?scope=")).status, 404);
        assert.equal((await get("adj", "1", "10", "?scope=puesto:1,contrato:5")).status, 200);
        assert.equal((await get("adj", "1", "10", "?scope=planeta:1")).status, 400);
        assert.equal((await get("noscope", "1", "10", "?scope=puesto:1")).status, 403);
    });
    it("más de 25 MB → 413", async () => {
        const r = await get("adj", "2", "21");
        assert.equal(r.status, 413);
        assert.equal((await r.json()).error, "attachment_too_large");
    });
    it("el nombre del archivo nunca rompe el encabezado", () => {
        assert.equal(contentDispositionAttachment('a"b\r\nc.pdf'), "attachment; filename*=UTF-8''a%20b%20%20c.pdf");
        assert.equal(contentDispositionAttachment(""), "attachment; filename*=UTF-8''archivo");
    });
});

describe("formularios: los adjuntos del registro pasan en la respuesta (sin hier)", () => {
    it("adjuntos sale tal cual", async () => {
        const m: GuardifyReportModule = { ...mod, id: "a", form: { loadRecords: async (_db, ids) => ids.map((i) => ({ ...rec(i, i), adjuntos: [{ id: "5", nombre: "x.pdf", tipo: "application/pdf", bytes: null }] })) } };
        const r = await handleGuardifyForms(new Request("http://x/api/guardify/reports/a/forms?ids=1", { headers: auth }), "a", "records", { registry: { a: m }, getDb: () => ({}), env });
        const b = await r.json();
        assert.deepEqual(b.records[0].adjuntos, [{ id: "5", nombre: "x.pdf", tipo: "application/pdf", bytes: null }]);
        assert.equal("hier" in b.records[0], false);
    });
});

describe("lenientDb: columnas que la base real no tiene", () => {
    it("reintenta sin select una vez y avisa; sin select no oculta el error", async () => {
        const calls: any[] = [];
        const db: any = { t: { findMany: async (a: any) => { calls.push(a); if (a.select) throw new Error("Unknown field `modelo`"); return [{ id: 1, modelo: null }]; }, create: async () => "x" }, u: { findMany: async () => { throw new Error("boom"); } } };
        const logs: string[] = [];
        const l = lenientDb(db, (m) => logs.push(m));
        assert.deepEqual(await l.t.findMany({ where: { id: 1 }, select: { id: true, modelo: true } }), [{ id: 1, modelo: null }]);
        assert.equal(calls.length, 2);
        assert.equal("select" in calls[1], false);
        assert.equal(logs.length, 1);
        await assert.rejects(() => l.u.findMany({ where: {} }), /boom/);
        assert.equal(await l.t.create({}), "x");
    });
});
