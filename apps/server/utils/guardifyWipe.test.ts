import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    WIPE_MAX_WAIT_MS,
    countPendingActions,
    decideWipe,
    formatRemaining,
    isBlockingQueueKey,
    parseWipeOrder,
    shouldKeepFileOnWipe,
    shouldKeepKeyOnWipe,
} from "../../mobile/hooks/guardifyWipe";
import { gateScreenFor, heartbeatLocation } from "../../mobile/hooks/guardifyLogic";

const H = 3_600_000;
const orden = (orderedAt = 1_000 * H) => ({ orderedAt, reason: "wipe" as const });

describe("borrado remoto: se espera a sincronizar y hay un plazo", () => {
    it("el plazo es de 72 horas", () => {
        assert.equal(WIPE_MAX_WAIT_MS, 72 * H);
    });
    it("con trabajo pendiente se espera; sin nada pendiente se borra de una vez", () => {
        const o = orden();
        const espera = decideWipe({ order: o, pending: 3, now: o.orderedAt + 2 * H });
        assert.deepEqual([espera.action, espera.cause], ["wait", null]);
        assert.equal(espera.remainingMs, 70 * H);
        const listo = decideWipe({ order: o, pending: 0, now: o.orderedAt + 1_000 });
        assert.deepEqual([listo.action, listo.cause], ["wipe", "synced"]);
    });
    it("al vencer las 72 horas se borra aunque quede trabajo sin enviar", () => {
        const o = orden();
        const justo = decideWipe({ order: o, pending: 5, now: o.orderedAt + 72 * H });
        assert.deepEqual([justo.action, justo.cause, justo.remainingMs], ["wipe", "deadline", 0]);
        const antes = decideWipe({ order: o, pending: 5, now: o.orderedAt + 72 * H - 1 });
        assert.equal(antes.action, "wait");
        assert.equal(decideWipe({ order: o, pending: 5, now: o.orderedAt + 200 * H }).cause, "deadline");
    });
    it("un reloj que retrocede no alarga la espera más allá del plazo completo", () => {
        const o = orden();
        const d = decideWipe({ order: o, pending: 2, now: o.orderedAt - 500 * H });
        assert.equal(d.action, "wait");
        assert.ok(d.remainingMs <= 72 * H);
    });
    it("el plazo se puede cambiar (pruebas) y la fecha límite se informa", () => {
        const o = orden(10_000);
        const d = decideWipe({ order: o, pending: 1, now: 10_500, maxWaitMs: 1_000 });
        assert.deepEqual([d.action, d.deadlineAt, d.remainingMs], ["wait", 11_000, 500]);
    });
});

describe("orden de borrado guardada", () => {
    it("se lee lo guardado y lo dañado se ignora", () => {
        assert.deepEqual(parseWipeOrder(JSON.stringify({ orderedAt: 5_000, reason: "retired" })), { orderedAt: 5_000, reason: "retired" });
        assert.deepEqual(parseWipeOrder({ orderedAt: "7", reason: "x" }), { orderedAt: 7, reason: "wipe" });
        for (const bad of [null, undefined, "", "no json", "{}", JSON.stringify({ orderedAt: 0 }), JSON.stringify({ orderedAt: "abc" }), 5]) assert.equal(parseWipeOrder(bad), null);
    });
});

describe("qué cuenta como trabajo pendiente", () => {
    it("suma las acciones de todas las colas *_actions, salvo el desregistro de notificaciones push", () => {
        const entries: [string, string | null][] = [
            ["evaluations_actions", JSON.stringify([{ id: 1 }, { id: 2 }])],
            ["lunchtime_actions", JSON.stringify([{ id: "a" }])],
            ["push_device_actions", JSON.stringify([{ id: "p" }, { id: "q" }])],
            ["attendance_actions", "[]"],
            ["access_token", "no es una cola"],
            ["otra_actions", null],
            ["rota_actions", "{no json"],
            ["objeto_actions", JSON.stringify({ a: 1 })],
        ];
        assert.equal(countPendingActions(entries), 3);
        assert.equal(isBlockingQueueKey("push_device_actions"), false);
        assert.equal(isBlockingQueueKey("evaluations_actions"), true);
        assert.equal(isBlockingQueueKey("evaluations_cache"), false);
    });
});

describe("qué conserva el borrado", () => {
    it("conserva el registro del equipo y su identificador; todo lo demás se borra", () => {
        for (const k of ["guardify.state", "guardify.wipe_order", "device_uid"]) assert.equal(shouldKeepKeyOnWipe(k), true, k);
        for (const k of ["evaluations_actions", "evaluations_cache", "employee_data", "last_location", "server_time"]) assert.equal(shouldKeepKeyOnWipe(k), false, k);
    });
    it("no toca el almacenamiento propio de React Native / Expo, sí los archivos de la app", () => {
        for (const n of ["RCTAsyncLocalStorage_V1", "ExponentExperienceData", "SecureStore", ".hidden"]) assert.equal(shouldKeepFileOnWipe(n), true, n);
        for (const n of ["a1b2c3d4-5e6f.png", "firma_123.png", "audio_1.m4a", "main_structure_cache.json", "MonitoreApp-prod-1.0.5.apk"]) assert.equal(shouldKeepFileOnWipe(n), false, n);
    });
    it("el tiempo restante se muestra en horas o minutos", () => {
        assert.equal(formatRemaining(72 * H), "72 h");
        assert.equal(formatRemaining(30 * 60_000), "30 min");
        assert.equal(formatRemaining(61 * 60_000), "2 h");
        assert.equal(formatRemaining(-5), "0 min");
    });
});

describe("pantalla de bloqueo por borrado", () => {
    const ok = { kind: "operational", online: true } as const;
    it("manda sobre cualquier estado y sobre la actualización obligatoria", () => {
        for (const state of [ok, { kind: "signed_out" }, { kind: "blocked" }, { kind: "retired" }, { kind: "pending" }] as const) {
            const s = gateScreenFor(state, { needsCode: false, updateRequired: true, wipePending: true })!;
            assert.deepEqual([s.mode, s.status, s.canRetry], ["wipe", "WIPE", false]);
        }
    });
    it("sin borrado en curso todo sigue igual", () => {
        assert.equal(gateScreenFor(ok, { needsCode: false, updateRequired: false, wipePending: false }), null);
        assert.equal(gateScreenFor(ok, { needsCode: false, updateRequired: false }), null);
        assert.equal(gateScreenFor({ kind: "blocked" }, { needsCode: false, updateRequired: false })!.mode, "status");
    });
});

describe("ubicación en el latido, solo con consentimiento", () => {
    const stored = { latitude: 9.9281, longitude: -84.0907, atMs: 1_000_000 };
    const now = 1_000_000 + 60_000;
    it("con consentimiento y una lectura reciente se envía la ubicación", () => {
        assert.deepEqual(heartbeatLocation({ consent: "granted", stored, nowMs: now }), { consent: { location: true }, location: { lat: 9.9281, lng: -84.0907 } });
    });
    it("sin consentimiento (rechazado o sin preguntar) nunca se envía y se informa que no hay consentimiento", () => {
        for (const consent of ["declined", null, undefined] as const) assert.deepEqual(heartbeatLocation({ consent, stored, nowMs: now }), { consent: { location: false } });
    });
    it("una lectura vieja, futura, inválida o ausente no se envía", () => {
        const base = { consent: "granted" as const, nowMs: now };
        assert.deepEqual(heartbeatLocation({ ...base, stored: { ...stored, atMs: now - 11 * 60_000 } }), { consent: { location: true } });
        assert.deepEqual(heartbeatLocation({ ...base, stored: { ...stored, atMs: now + 5_000 } }), { consent: { location: true } });
        assert.deepEqual(heartbeatLocation({ ...base, stored: { latitude: 120, longitude: 0, atMs: now } }), { consent: { location: true } });
        assert.deepEqual(heartbeatLocation({ ...base, stored: { latitude: NaN, longitude: 0, atMs: now } }), { consent: { location: true } });
        assert.deepEqual(heartbeatLocation({ ...base, stored: null }), { consent: { location: true } });
    });
    it("una lectura sin hora se acepta (el GPS reciente de la app)", () => {
        assert.deepEqual(heartbeatLocation({ consent: "granted", stored: { ...stored, atMs: null }, nowMs: now }), { consent: { location: true }, location: { lat: 9.9281, lng: -84.0907 } });
    });
});
