import assert from "node:assert/strict";
import crypto from "node:crypto";
import { after, before, describe, it } from "node:test";
import { GuardifyDevice, GuardifyError, MemoryStorage } from "../../../vendor/guardify-sdk/src/index";
import { createMockGuardify } from "../scripts/mockGuardify";
import { RevocationCache, createRevocationFetcher, guardifyDeviceGate, parseDeviceNotApprovedMessage } from "./guardifyDevices";

/**
 * El Guardify simulado (`scripts/mockGuardify.ts`) contra el SDK REAL de dispositivo y contra el cliente de revocaciones del servidor:
 * si estas pruebas pasan, el simulacro habla el mismo contrato que usa la app y el servidor.
 */
describe("Guardify simulado frente al SDK y al servidor", () => {
    const mock = createMockGuardify({ quiet: true, leaseSeconds: 60 });
    let base = "";
    before(async () => {
        base = `http://127.0.0.1:${await mock.listen(0)}`;
    });
    after(() => mock.close());

    const nuevoSdk = (uid = crypto.randomUUID()) =>
        new GuardifyDevice({ baseUrl: base, appKey: "monitoreapp", deviceUid: uid, storage: new MemoryStorage(), platform: "ANDROID", model: "Pixel de prueba", appVersion: "1.0.2" });
    const aprobar = (deviceId: string) => mock.setStatus(mock.state.devices.get(deviceId)!, "ACTIVE");

    it("rechaza un código de empresa inválido y una appKey desconocida", async () => {
        const sdk = nuevoSdk();
        await assert.rejects(() => sdk.register("otra-empresa"), (e: unknown) => e instanceof GuardifyError && e.code === "invalid_code");
        const mala = new GuardifyDevice({ baseUrl: base, appKey: "otra-app", deviceUid: "x", storage: new MemoryStorage() });
        await assert.rejects(() => mala.register("corporacion-gonzalez"), (e: unknown) => e instanceof GuardifyError && e.code === "unknown_app");
    });

    it("registro → pendiente → aprobación → sesión de acceso → operativo", async () => {
        const sdk = nuevoSdk();
        assert.equal((await sdk.init()).kind, "unregistered");
        assert.equal((await sdk.register("  Corporacion-Gonzalez ")).kind, "pending");
        // pendiente: el estado se puede consultar, pero la verificación de acceso responde 403 device_pending
        assert.equal((await sdk.refreshStatus()).kind, "pending");
        await assert.rejects(() => sdk.login("1-1111-1111"), (e: unknown) => e instanceof GuardifyError && e.status === 403 && e.code === "device_pending");
        aprobar(sdk.deviceId!);
        assert.equal((await sdk.refreshStatus()).kind, "signed_out");
        const r = await sdk.login("1-1111-1111");
        assert.ok(r.sessionId);
        assert.equal(sdk.state().kind, "operational");
        assert.equal(sdk.session?.externalUserId, "1-1111-1111");
        await sdk.renew();
        assert.equal(sdk.state().kind, "operational");
        await sdk.logout();
        assert.equal(sdk.state().kind, "signed_out");
    });

    it("un registro repetido del mismo equipo conserva su id (misma instalación)", async () => {
        const uid = crypto.randomUUID();
        const a = nuevoSdk(uid);
        await a.register("corporacion-gonzalez");
        const b = nuevoSdk(uid);
        await b.register("corporacion-gonzalez");
        assert.equal(a.deviceId, b.deviceId);
    });

    it("latido con batería, consentimiento y ubicación", async () => {
        const sdk = nuevoSdk();
        await sdk.register("corporacion-gonzalez");
        aprobar(sdk.deviceId!);
        await sdk.refreshStatus();
        await sdk.heartbeat({ battery: 83, consent: { location: true }, location: { lat: 9.93, lng: -84.08 } });
        const hb = mock.state.devices.get(sdk.deviceId!)!.heartbeat!;
        assert.deepEqual([hb.battery, hb.consent, hb.location, hb.appVersion], [83, { location: true }, { lat: 9.93, lng: -84.08 }, "1.0.2"]);
        await sdk.heartbeat({ battery: 80, consent: { location: false } });
        assert.equal(mock.state.devices.get(sdk.deviceId!)!.heartbeat!.location, null);
    });

    it("bloquear el equipo: el SDK pasa a «blocked» y todo lo demás responde 403", async () => {
        const sdk = nuevoSdk();
        await sdk.register("corporacion-gonzalez");
        aprobar(sdk.deviceId!);
        await sdk.refreshStatus();
        await sdk.login("2-2222-2222");
        mock.setStatus(mock.state.devices.get(sdk.deviceId!)!, "BLOCKED", "Equipo perdido");
        await assert.rejects(() => sdk.heartbeat({ battery: 50 }), (e: unknown) => e instanceof GuardifyError && e.code === "device_blocked");
        const st = sdk.state();
        assert.deepEqual([st.kind, st.kind === "blocked" ? st.reason : null], ["blocked", "Equipo perdido"]);
        // reactivarlo lo deja volver a trabajar
        aprobar(sdk.deviceId!);
        assert.equal((await sdk.refreshStatus()).kind, "signed_out");
    });

    it("órdenes: WIPE y FORCE_UPDATE llegan, disparan los eventos del SDK y se confirman (ack)", async () => {
        const sdk = nuevoSdk();
        await sdk.register("corporacion-gonzalez");
        aprobar(sdk.deviceId!);
        await sdk.refreshStatus();
        const eventos: string[] = [];
        sdk.on((e) => eventos.push(e.type === "command" ? `command:${e.command}` : e.type));
        const d = mock.state.devices.get(sdk.deviceId!)!;
        mock.enqueue(d, "WIPE");
        mock.enqueue(d, "FORCE_UPDATE");
        mock.enqueue(d, "PING");
        assert.equal(await sdk.pollCommands(), 3);
        assert.ok(eventos.includes("wipe") && eventos.includes("force_update") && eventos.includes("command:WIPE") && eventos.includes("command:PING"));
        assert.equal(await sdk.pollCommands(), 0); // ya confirmadas
        assert.ok(mock.state.commands.filter((c) => c.deviceId === d.id).every((c) => c.ackedAt));
    });

    it("LOGOUT_ALL revoca las sesiones: el SDK las cierra y la renovación falla", async () => {
        const sdk = nuevoSdk();
        await sdk.register("corporacion-gonzalez");
        aprobar(sdk.deviceId!);
        await sdk.refreshStatus();
        await sdk.login("3-3333-3333");
        mock.enqueue(mock.state.devices.get(sdk.deviceId!)!, "LOGOUT_ALL");
        await sdk.pollCommands();
        assert.equal(sdk.state().kind, "signed_out");
        const sid = [...mock.state.sessions.values()].find((s) => s.deviceId === sdk.deviceId)!;
        assert.ok(sid.revokedAt);
    });

    it("catálogo de APK: versión más reciente de la variante, mínima, descarga con la credencial del equipo y huella", async () => {
        const sdk = nuevoSdk();
        await sdk.register("corporacion-gonzalez");
        aprobar(sdk.deviceId!);
        await sdk.refreshStatus();
        assert.deepEqual(await sdk.latestApk("lite"), { minAppVersion: null, latest: null });
        mock.publishApk({ version: "1.0.3", variant: "lite", notes: "Prueba" });
        mock.publishApk({ version: "1.0.10", variant: "lite" });
        mock.publishApk({ version: "9.0.0", variant: "prod" });
        mock.setMinAppVersion("1.0.3");
        const r = await sdk.latestApk("lite");
        assert.equal(r.minAppVersion, "1.0.3");
        assert.equal(r.latest?.version, "1.0.10"); // compara numéricamente: 1.0.10 > 1.0.3
        assert.ok(r.latest!.downloadUrl.startsWith(base));
        const res = await fetch(r.latest!.downloadUrl, { headers: { Authorization: (await sdk.authorizationHeader())! } });
        assert.equal(res.status, 200);
        const bytes = Buffer.from(await res.arrayBuffer());
        assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), r.latest!.sha256);
        assert.equal((await fetch(r.latest!.downloadUrl)).status, 401); // sin credencial no se descarga
        mock.setMinAppVersion(null);
    });

    describe("el servidor de la app contra el simulacro (revocaciones)", () => {
        const env = () => ({ GUARDIFY_URL: base, GUARDIFY_APP_CLIENT_ID: "mock-id", GUARDIFY_APP_CLIENT_SECRET: "mock-secret", GUARDIFY_DEVICE_ENFORCE: "on" });

        it("con credenciales incorrectas no se puede leer la lista (y el servidor no se cae)", async () => {
            const mala = createRevocationFetcher({ ...env(), GUARDIFY_APP_CLIENT_SECRET: "otro" });
            await assert.rejects(() => mala(null), /401/);
        });

        it("equipo activo pasa; bloqueado y retirado se cortan con device_not_approved; al reactivarlo vuelve a pasar", async () => {
            const sdk = nuevoSdk();
            await sdk.register("corporacion-gonzalez");
            const d = mock.state.devices.get(sdk.deviceId!)!;
            aprobar(d.id);
            const cache = new RevocationCache(createRevocationFetcher(env()), 0);
            const gate = async () => {
                await cache.ensureFresh();
                await cache.whenIdle();
                return guardifyDeviceGate({ payload: { id: 7, gdev: d.id } as any, stage: "request" }, env(), cache);
            };
            assert.equal(await gate(), null);
            mock.setStatus(d, "BLOCKED", "Perdido");
            const bloqueado = await gate();
            // la lista de revocaciones del contrato trae el estado, no el motivo (el motivo lo ve el equipo con `devices/self`)
            assert.deepEqual(parseDeviceNotApprovedMessage(bloqueado), { status: "BLOCKED", reason: null });
            mock.setStatus(d, "RETIRED");
            assert.equal(parseDeviceNotApprovedMessage(await gate())?.status, "RETIRED");
            aprobar(d.id);
            assert.equal(await gate(), null);
        });

        it("una sesión revocada (gsid) se corta aunque el equipo siga activo", async () => {
            const sdk = nuevoSdk();
            await sdk.register("corporacion-gonzalez");
            const d = mock.state.devices.get(sdk.deviceId!)!;
            aprobar(d.id);
            await sdk.refreshStatus();
            const r = await sdk.login("4-4444-4444");
            const cache = new RevocationCache(createRevocationFetcher(env()), 0);
            const gate = async () => {
                await cache.ensureFresh();
                await cache.whenIdle();
                return guardifyDeviceGate({ payload: { id: 7, gdev: d.id, gsid: r.sessionId } as any, stage: "request" }, env(), cache);
            };
            assert.equal(await gate(), null);
            mock.state.sessions.get(r.sessionId)!.revokedAt = Date.now();
            assert.ok(parseDeviceNotApprovedMessage(await gate()));
        });

        it("sin equipo en el token (app sin Guardify) se rechaza como UNREGISTERED con `on`, y solo se registra con `observe`", async () => {
            const cache = new RevocationCache(createRevocationFetcher(env()), 0);
            await cache.ensureFresh();
            await cache.whenIdle();
            const on = await guardifyDeviceGate({ payload: { id: 7 } as any }, env(), cache);
            assert.equal(parseDeviceNotApprovedMessage(on)?.status, "UNREGISTERED");
            const observe = await guardifyDeviceGate({ payload: { id: 7 } as any }, { ...env(), GUARDIFY_DEVICE_ENFORCE: "observe" }, cache);
            assert.equal(observe, null);
        });

        it("versión mínima: con `on` una app anterior recibe UPDATE_REQUIRED aunque el equipo esté activo", async () => {
            const sdk = nuevoSdk();
            await sdk.register("corporacion-gonzalez");
            const d = mock.state.devices.get(sdk.deviceId!)!;
            aprobar(d.id);
            const cache = new RevocationCache(createRevocationFetcher(env()), 0);
            await cache.ensureFresh();
            await cache.whenIdle();
            const e = { ...env(), GUARDIFY_MIN_APP_VERSION: "1.0.5" };
            assert.equal(parseDeviceNotApprovedMessage(await guardifyDeviceGate({ payload: { id: 7, gdev: d.id } as any, appVersion: "1.0.2" }, e, cache))?.status, "UPDATE_REQUIRED");
            assert.equal(await guardifyDeviceGate({ payload: { id: 7, gdev: d.id } as any, appVersion: "1.0.5" }, e, cache), null);
        });
    });
});
