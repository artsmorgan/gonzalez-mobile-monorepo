import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
    buildDeviceNotApprovedMessage,
    compararVersiones,
    versionInsuficiente,
    createRevocationFetcher,
    evaluateDevice,
    guardifyDeviceGate,
    parseDeviceNotApprovedMessage,
    parseEnforceMode,
    parseRevocations,
    RevocationCache,
    type Revocation,
} from "./guardifyDevices";

const rev = (over: Partial<Revocation> = {}): Revocation => ({ deviceId: "dev-1", sessionId: null, status: "BLOCKED", reason: null, ...over });
/** Reloj manual: el caché lee el tiempo de aquí, no del reloj real. */
function clock(start = 1_000_000) {
    let t = start;
    return { now: () => t, advance: (ms: number) => { t += ms; } };
}
/** Guardify simulado: activo (lista vacía), con un equipo bloqueado, o caído. */
function fakeGuardify(initial: Revocation[] = []) {
    const state = { items: initial, down: false, calls: [] as (string | null)[], cursor: null as string | null };
    const fetchRevocations = async (since: string | null) => {
        state.calls.push(since);
        if (state.down) throw new Error("Guardify caído");
        return { items: state.items, cursor: state.cursor };
    };
    return { state, fetchRevocations };
}

describe("interruptor GUARDIFY_DEVICE_ENFORCE", () => {
    it("sin variable o con un valor inválido es off; acepta observe y on", () => {
        assert.equal(parseEnforceMode(undefined), "off");
        assert.equal(parseEnforceMode(""), "off");
        assert.equal(parseEnforceMode("loquesea"), "off");
        assert.equal(parseEnforceMode(" Observe "), "observe");
        assert.equal(parseEnforceMode("ON"), "on");
    });
});

describe("lectura de las revocaciones de Guardify", () => {
    it("lee el contrato del SDK: sesiones (sid) y equipos (id, status) con la hora del servidor", () => {
        const r = parseRevocations({
            sessions: [{ sid: "s1" }, { sid: "s2" }],
            devices: [{ id: "d1", status: "blocked" }, { id: "d2", status: "ACTIVE" }, { id: "d3", status: "Retired" }],
            serverTime: "2026-10-21T14:30:10.000Z",
        });
        assert.deepEqual(r.items.map((i) => [i.deviceId, i.sessionId, i.status]), [[null, "s1", "BLOCKED"], [null, "s2", "BLOCKED"], ["d1", null, "BLOCKED"], ["d2", null, "ACTIVE"], ["d3", null, "RETIRED"]]);
        // el siguiente cursor es la hora del servidor menos 2 s, como hace el SDK
        assert.equal(r.cursor, "2026-10-21T14:30:08.000Z");
    });
    it("una respuesta sin equipos (el SDK la tolera) y respuestas que no son del contrato salen vacías", () => {
        assert.deepEqual(parseRevocations({ sessions: [{ sid: "s1" }], serverTime: "2026-10-21T14:30:10.000Z" }).items.map((i) => i.sessionId), ["s1"]);
        assert.deepEqual(parseRevocations(null).items, []);
        assert.deepEqual(parseRevocations({ nada: 1 }), { items: [], cursor: null });
        assert.deepEqual(parseRevocations({ sessions: [{}, null], devices: [{ status: "BLOCKED" }, 5] }).items, []);
    });
});

describe("caché de revocaciones", () => {
    it("equipo activo (no figura en la lista) pasa; equipo bloqueado se corta", async () => {
        const g = fakeGuardify([rev({ deviceId: "malo", status: "BLOCKED", reason: "robado" })]);
        const cache = new RevocationCache(g.fetchRevocations, 45_000, clock().now);
        await cache.ensureFresh();
        assert.deepEqual(evaluateDevice({ gdev: "bueno", gsid: "s" }, cache), { allow: true, cause: "ok" });
        const d = evaluateDevice({ gdev: "malo" }, cache);
        assert.deepEqual([d.allow, d.cause, d.status, d.reason], [false, "revoked", "BLOCKED", "robado"]);
    });
    it("una sesión revocada se corta aunque el equipo siga activo", async () => {
        const g = fakeGuardify([rev({ deviceId: null, sessionId: "ses-1", status: "BLOCKED" })]);
        const cache = new RevocationCache(g.fetchRevocations, 45_000, clock().now);
        await cache.ensureFresh();
        assert.equal(evaluateDevice({ gdev: "d", gsid: "ses-1" }, cache).allow, false);
        assert.equal(evaluateDevice({ gdev: "d", gsid: "ses-2" }, cache).allow, true);
    });
    it("un token sin equipo no pasa la evaluación (el modo decide si se corta)", async () => {
        const cache = new RevocationCache(fakeGuardify().fetchRevocations, 45_000, clock().now);
        await cache.ensureFresh();
        const d = evaluateDevice({ id: 5 }, cache);
        assert.deepEqual([d.allow, d.cause], [false, "no_device"]);
    });
    it("no consulta a Guardify en cada petición: respeta el tiempo de vida", async () => {
        const g = fakeGuardify(); const c = clock();
        const cache = new RevocationCache(g.fetchRevocations, 45_000, c.now);
        await cache.ensureFresh(); await cache.ensureFresh(); await cache.ensureFresh();
        assert.equal(g.state.calls.length, 1);
        c.advance(46_000);
        await cache.ensureFresh(); await cache.whenIdle();
        assert.equal(g.state.calls.length, 2);
    });
    it("con Guardify caído usa la última lista: el equipo ya revocado SIGUE bloqueado y el servidor no se cae", async () => {
        const g = fakeGuardify([rev({ deviceId: "malo" })]); const c = clock();
        const cache = new RevocationCache(g.fetchRevocations, 45_000, c.now);
        await cache.ensureFresh();
        g.state.down = true; c.advance(60_000);
        await assert.doesNotReject(cache.ensureFresh());
        await cache.whenIdle();
        assert.match(cache.lastError ?? "", /caído/);
        assert.equal(evaluateDevice({ gdev: "malo" }, cache).allow, false);
        assert.equal(evaluateDevice({ gdev: "bueno" }, cache).allow, true);
    });
    it("al recuperarse Guardify el error se limpia y la lista se actualiza (un equipo desbloqueado vuelve a pasar)", async () => {
        const g = fakeGuardify([rev({ deviceId: "malo" })]); const c = clock();
        const cache = new RevocationCache(g.fetchRevocations, 45_000, c.now);
        await cache.ensureFresh();
        g.state.items = []; // sin cursor la respuesta es la lista completa: ya no figura
        c.advance(46_000);
        await cache.ensureFresh(); await cache.whenIdle();
        assert.equal(cache.lastError, null);
        assert.equal(evaluateDevice({ gdev: "malo" }, cache).allow, true);
    });
    it("con cursor las consultas son incrementales y un estado ACTIVE levanta la revocación", async () => {
        const g = fakeGuardify([rev({ deviceId: "d1" })]); const c = clock();
        g.state.cursor = "c1";
        const cache = new RevocationCache(g.fetchRevocations, 45_000, c.now);
        await cache.ensureFresh();
        g.state.items = [rev({ deviceId: "d1", status: "ACTIVE" }), rev({ deviceId: "d2", status: "RETIRED" })];
        g.state.cursor = "c2";
        c.advance(46_000);
        await cache.ensureFresh(); await cache.whenIdle();
        assert.deepEqual(g.state.calls, [null, "c1"]);
        assert.equal(evaluateDevice({ gdev: "d1" }, cache).allow, true);
        assert.equal(evaluateDevice({ gdev: "d2" }, cache).allow, false);
    });
    it("arranque en frío con Guardify caído: por defecto deja pasar (y lo avisa); con 'deny' no", async () => {
        const g = fakeGuardify(); g.state.down = true;
        const cache = new RevocationCache(g.fetchRevocations, 45_000, clock().now);
        await cache.ensureFresh();
        assert.equal(cache.isLoaded, false);
        assert.deepEqual(evaluateDevice({ gdev: "x" }, cache), { allow: true, cause: "cold_start" });
        assert.equal(evaluateDevice({ gdev: "x" }, cache, "deny").allow, false);
    });
});

describe("puerta guardifyDeviceGate según el modo", () => {
    const warns: string[] = [];
    const origWarn = console.warn;
    afterEach(() => { console.warn = origWarn; warns.length = 0; });
    const capture = () => { console.warn = (m?: unknown) => { warns.push(String(m)); }; };
    const loaded = async (items: Revocation[]) => {
        const cache = new RevocationCache(fakeGuardify(items).fetchRevocations, 45_000, clock().now);
        await cache.ensureFresh();
        return cache;
    };

    it("off: no cambia nada ni consulta a Guardify", async () => {
        let called = false;
        const cache = new RevocationCache(async () => { called = true; return { items: [], cursor: null }; }, 1000);
        assert.equal(await guardifyDeviceGate({ payload: { gdev: "malo" } }, {}, cache), null);
        assert.equal(await guardifyDeviceGate({ payload: {} }, { GUARDIFY_DEVICE_ENFORCE: "off" }, cache), null);
        assert.equal(called, false);
    });
    it("observe: registra el equipo revocado o sin equipo pero NO cambia ninguna respuesta", async () => {
        capture();
        const cache = await loaded([rev({ deviceId: "malo", reason: "robado" })]);
        const env = { GUARDIFY_DEVICE_ENFORCE: "observe" };
        assert.equal(await guardifyDeviceGate({ payload: { id: 7, gdev: "malo" }, route: "/api/x", method: "GET" }, env, cache), null);
        assert.equal(await guardifyDeviceGate({ payload: { id: 8 }, route: "/api/y" }, env, cache), null);
        assert.equal(await guardifyDeviceGate({ payload: { id: 9, gdev: "bueno" } }, env, cache), null);
        assert.equal(warns.length, 2);
        const first = JSON.parse(warns[0]!).guardify_device;
        assert.deepEqual([first.mode, first.cause, first.status, first.reason, first.route, first.empleado], ["observe", "revoked", "BLOCKED", "robado", "/api/x", 7]);
        assert.equal(JSON.parse(warns[1]!).guardify_device.cause, "no_device");
    });
    it("on: corta al equipo bloqueado con 403 device_not_approved (estado y motivo) y al token sin equipo; deja pasar al activo", async () => {
        capture();
        const cache = await loaded([rev({ deviceId: "malo", status: "BLOCKED", reason: "perdido" })]);
        const env = { GUARDIFY_DEVICE_ENFORCE: "on" };
        const blocked = await guardifyDeviceGate({ payload: { gdev: "malo" } }, env, cache);
        assert.equal(blocked, "device_not_approved|BLOCKED|perdido");
        assert.deepEqual(parseDeviceNotApprovedMessage(blocked), { status: "BLOCKED", reason: "perdido" });
        const sin = await guardifyDeviceGate({ payload: { id: 1 } }, env, cache);
        assert.deepEqual(parseDeviceNotApprovedMessage(sin), { status: "UNREGISTERED", reason: null });
        assert.equal(await guardifyDeviceGate({ payload: { gdev: "bueno" } }, env, cache), null);
    });
    it("on con Guardify caído y la última lista cargada: el revocado sigue cortado y el activo sigue pasando", async () => {
        capture();
        const g = fakeGuardify([rev({ deviceId: "malo" })]); const c = clock();
        const cache = new RevocationCache(g.fetchRevocations, 45_000, c.now);
        await cache.ensureFresh();
        g.state.down = true; c.advance(120_000);
        const env = { GUARDIFY_DEVICE_ENFORCE: "on" };
        assert.notEqual(await guardifyDeviceGate({ payload: { gdev: "malo" } }, env, cache), null);
        assert.equal(await guardifyDeviceGate({ payload: { gdev: "bueno" } }, env, cache), null);
    });
    it("on, arranque en frío con Guardify caído: allow por defecto, deny si se configura", async () => {
        capture();
        const g = fakeGuardify(); g.state.down = true;
        const cache = new RevocationCache(g.fetchRevocations, 45_000, clock().now);
        assert.equal(await guardifyDeviceGate({ payload: { gdev: "x" } }, { GUARDIFY_DEVICE_ENFORCE: "on" }, cache), null);
        assert.notEqual(await guardifyDeviceGate({ payload: { gdev: "x" } }, { GUARDIFY_DEVICE_ENFORCE: "on", GUARDIFY_DEVICE_COLD_START: "deny" }, cache), null);
    });
    it("el motivo no puede romper el formato del mensaje", () => {
        const m = buildDeviceNotApprovedMessage("BLOCKED", "a|b");
        assert.deepEqual(parseDeviceNotApprovedMessage(m), { status: "BLOCKED", reason: "a/b" });
        assert.equal(parseDeviceNotApprovedMessage("Token inválido"), null);
    });
});

describe("consulta a Guardify (credencial de aplicación)", () => {
    const env = { GUARDIFY_URL: "https://guardify.test/", GUARDIFY_APP_CLIENT_ID: "monitoreapp", GUARDIFY_APP_CLIENT_SECRET: "s3cret" };
    it("llama a /api/v1/revocations?since= con Authorization Basic clientId:secreto: desde la época la primera vez y después desde el cursor", async () => {
        const vistos: { url: string; auth: string }[] = [];
        const fetcher = createRevocationFetcher(env, async (url, init) => {
            vistos.push({ url, auth: init.headers.Authorization! });
            return { ok: true, status: 200, json: async () => ({ sessions: [{ sid: "s1" }], devices: [{ id: "d1", status: "BLOCKED" }], serverTime: "2026-10-21T14:30:10.000Z" }) };
        });
        const primera = await fetcher(null);
        assert.equal(vistos[0]!.url, "https://guardify.test/api/v1/revocations?since=1970-01-01T00%3A00%3A00.000Z");
        assert.equal(vistos[0]!.auth, `Basic ${Buffer.from("monitoreapp:s3cret").toString("base64")}`);
        assert.deepEqual([primera.items.length, primera.cursor], [2, "2026-10-21T14:30:08.000Z"]);
        await fetcher(primera.cursor);
        assert.equal(vistos[1]!.url, "https://guardify.test/api/v1/revocations?since=2026-10-21T14%3A30%3A08.000Z");
    });
    it("sin configuración o con una respuesta de error lanza (el caché lo absorbe)", async () => {
        await assert.rejects(createRevocationFetcher({})(null), /no configurado/);
        await assert.rejects(createRevocationFetcher(env, async () => ({ ok: false, status: 503, json: async () => ({}) }))(null), /503/);
    });
});

describe("versión mínima de la app (issue #148)", () => {
    it("compara versiones numéricamente", () => {
        assert.ok(compararVersiones("1.0.2", "1.0.10") < 0);
        assert.ok(compararVersiones("1.1", "1.0.9") > 0);
        assert.equal(compararVersiones("2.0", "2.0.0"), 0);
    });
    it("sin mínima configurada nada se exige; con ella, una app más vieja o que no manda versión no cumple", () => {
        assert.equal(versionInsuficiente("1.0.0", ""), false);
        assert.equal(versionInsuficiente("1.0.0", undefined), false);
        assert.equal(versionInsuficiente("1.0.1", "1.0.1"), false);
        assert.equal(versionInsuficiente("1.0.0", "1.0.1"), true);
        assert.equal(versionInsuficiente(null, "1.0.1"), true);
    });
    const cargado = async () => {
        const cache = new RevocationCache(async () => ({ items: [], cursor: null }), 45_000, () => 1_000_000);
        await cache.ensureFresh();
        return cache;
    };
    it("on: una app por debajo de la mínima recibe 403 device_not_approved con UPDATE_REQUIRED; observe solo registra; off no hace nada", async () => {
        const warn = console.warn; console.warn = () => undefined;
        try {
            const cache = await cargado();
            const payload = { id: 1, gdev: "dev-ok" };
            const base = { GUARDIFY_MIN_APP_VERSION: "1.0.1" };
            const cortado = await guardifyDeviceGate({ payload, appVersion: "1.0.0" }, { ...base, GUARDIFY_DEVICE_ENFORCE: "on" }, cache);
            assert.equal(parseDeviceNotApprovedMessage(cortado)?.status, "UPDATE_REQUIRED");
            assert.equal(await guardifyDeviceGate({ payload, appVersion: "1.0.1" }, { ...base, GUARDIFY_DEVICE_ENFORCE: "on" }, cache), null);
            assert.equal(await guardifyDeviceGate({ payload, appVersion: "1.0.0" }, { ...base, GUARDIFY_DEVICE_ENFORCE: "observe" }, cache), null);
            assert.equal(await guardifyDeviceGate({ payload, appVersion: "1.0.0" }, { ...base, GUARDIFY_DEVICE_ENFORCE: "off" }, cache), null);
        } finally { console.warn = warn; }
    });
});
