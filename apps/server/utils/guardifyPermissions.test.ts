import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    GrantsCache,
    PERM_REGISTROS_DE_OTROS,
    SCREEN_WRITE_ROUTES,
    createGrantsFetcher,
    guardifyAdmin,
    guardifyRouteGate,
    parsePermissionsMode,
    permissionForRoute,
    type PermissionDeps,
    type UserAccess,
} from "./guardifyPermissions";

const supervisor: UserAccess = { governed: true, externalId: "111", status: "ACTIVE", role: "Supervisor", grants: ["bitacora.registro-de-personas", "supervision.checklist-de-supervision"], conditions: {} };
const superadmin: UserAccess = { ...supervisor, externalId: "999", role: "Súper administrador", grants: [PERM_REGISTROS_DE_OTROS, "administracion.super-admins", "administracion.nomencladores"] };
const people: Record<string, UserAccess> = { "111": supervisor, "999": superadmin, "555": { governed: false, externalId: "555" } };
const cedulas: Record<number, string> = { 1: "111", 9: "999", 5: "555", 7: "777" };

function deps(mode: string | undefined, opts: { fail?: boolean } = {}) {
    const calls: string[] = [];
    const logs: Record<string, unknown>[] = [];
    let now = 0;
    const cache = new GrantsCache(async (id) => {
        calls.push(id);
        if (opts.fail) throw new Error("caído");
        const p = people[id];
        if (!p) return { governed: false, externalId: id };
        return p;
    }, 60_000, () => now);
    const d: PermissionDeps = { env: { GUARDIFY_PERMISSIONS: mode }, cache, cedulaOf: async (id) => cedulas[id] ?? null, log: (e) => logs.push(e) };
    return { d, calls, logs, advance: (ms: number) => (now += ms) };
}

describe("permisos de Guardify en el servidor (fase 3 de roles)", () => {
    it("sin variable o apagado no consulta a Guardify y rige la regla de siempre", async () => {
        for (const mode of [undefined, "off", "false", "raro"]) {
            const { d, calls } = deps(mode);
            assert.equal(parsePermissionsMode(mode), "off");
            assert.equal(await guardifyAdmin({ empleadoId: 1, permission: PERM_REGISTROS_DE_OTROS, legacy: async () => true }, d), true);
            assert.equal(await guardifyRouteGate({ payload: { id: 1 }, route: "/api/incidents", method: "POST" }, d), null);
            assert.deepEqual(calls, []);
        }
    });

    it("en `on` decide el permiso de Guardify en lugar de «es súper admin»", async () => {
        const { d } = deps("on");
        assert.equal(await guardifyAdmin({ empleadoId: 9, permission: PERM_REGISTROS_DE_OTROS, legacy: async () => false }, d), true);
        assert.equal(await guardifyAdmin({ empleadoId: 1, permission: PERM_REGISTROS_DE_OTROS, legacy: async () => true }, d), false);
        assert.equal(await guardifyAdmin({ empleadoId: 9, permission: "administracion.visibilidad-de-modulos", legacy: async () => true }, d), false);
    });

    it("si Guardify no tiene a la persona, no hay cédula o no responde, rige la regla de siempre", async () => {
        const { d } = deps("on");
        for (const empleadoId of [5, 7, 0, 42]) {
            assert.equal(await guardifyAdmin({ empleadoId, permission: PERM_REGISTROS_DE_OTROS, legacy: async () => true }, d), true, String(empleadoId));
            assert.equal(await guardifyRouteGate({ payload: { id: empleadoId }, route: "/api/incidents", method: "POST" }, d), null);
        }
        const down = deps("on", { fail: true });
        assert.equal(await guardifyAdmin({ empleadoId: 1, permission: PERM_REGISTROS_DE_OTROS, legacy: async () => true }, down.d), true);
        assert.equal(await guardifyRouteGate({ payload: { id: 1 }, route: "/api/incidents", method: "POST" }, down.d), null);
    });

    it("en `observe` responde como siempre y registra lo que Guardify haría distinto", async () => {
        const { d, logs } = deps("observe");
        assert.equal(await guardifyAdmin({ empleadoId: 1, permission: PERM_REGISTROS_DE_OTROS, legacy: async () => true }, d), true);
        assert.equal(await guardifyRouteGate({ payload: { id: 1 }, route: "/api/incidents", method: "POST" }, d), null);
        assert.deepEqual(logs.map((l) => [l.kind, l.permission]), [["admin", PERM_REGISTROS_DE_OTROS], ["route", "incidentes.incidentes"]]);
    });

    it("las escrituras de cada pantalla exigen su permiso; lecturas y rutas compartidas pasan", async () => {
        const { d } = deps("on");
        const gate = (route: string, method = "POST", id = 1) => guardifyRouteGate({ payload: { id }, route, method }, d);
        assert.equal(await gate("/api/visitors"), null);
        assert.equal(await gate("/api/checklist-supervision/12", "PUT"), null);
        assert.equal(await gate("/api/incidents"), "permission_denied|incidentes.incidentes");
        assert.equal(await gate("/api/incidents/3", "DELETE"), "permission_denied|incidentes.incidentes");
        assert.equal(await gate("/api/incidents", "GET"), null);
        assert.equal(await gate("/api/activities/marca/4"), null); // la usa también el marcado de ingreso
        assert.equal(await gate("/api/attendance/4"), null);
        assert.equal(await gate("/api/nomenclators/tipos-de-visita"), "permission_denied|administracion.nomencladores");
        assert.equal(await gate("/api/nomenclators/tipos-de-visita", "POST", 9), null);
        assert.equal(await gate("/api/nomenclators/super-admins"), null); // tiene su propia verificación
    });

    it("mapa de rutas: solo permisos de pantallas que existen en el manifiesto", () => {
        assert.equal(permissionForRoute("/api/llaveros/2", "PATCH"), "cambio-de-puesto.llaves");
        assert.equal(permissionForRoute("/api/guardify/reports/x", "POST"), null);
        for (const p of Object.values(SCREEN_WRITE_ROUTES)) assert.match(p, /^[a-z-]+\.[a-z-]+$/);
    });

    it("guarda los permisos unos segundos y ante una caída usa la última respuesta", async () => {
        let fail = false;
        let n = 0;
        let now = 0;
        const cache = new GrantsCache(async (id) => {
            n++;
            if (fail) throw new Error("caído");
            return people[id]!;
        }, 60_000, () => now);
        assert.equal((await cache.get("111"))?.governed, true);
        await cache.get("111");
        assert.equal(n, 1);
        now += 61_000;
        fail = true;
        assert.deepEqual(await cache.get("111"), supervisor);
        assert.equal(n, 2);
    });

    it("consulta /api/v1/access/grants con la credencial de aplicación", async () => {
        const seen: { url: string; auth: string }[] = [];
        const fetcher = createGrantsFetcher({ GUARDIFY_URL: "https://g.example/", GUARDIFY_APP_CLIENT_ID: "id", GUARDIFY_APP_CLIENT_SECRET: "s" }, async (url, init) => {
            seen.push({ url, auth: init.headers.Authorization! });
            return { ok: true, status: 200, json: async () => ({ governed: true, status: "ACTIVE", role: "Operativo", grants: ["a.b"], conditions: { "a.b": { marca: ["vigente"] } } }) };
        });
        const r = await fetcher("1-234");
        assert.deepEqual(r, { governed: true, externalId: "1-234", status: "ACTIVE", role: "Operativo", grants: ["a.b"], conditions: { "a.b": { marca: ["vigente"] } } });
        assert.equal(seen[0]!.url, "https://g.example/api/v1/access/grants?externalId=1-234");
        assert.equal(seen[0]!.auth, `Basic ${Buffer.from("id:s").toString("base64")}`);
        await assert.rejects(createGrantsFetcher({})("1"), /no configurado/);
    });
});
