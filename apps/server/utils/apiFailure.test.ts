import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
    classifyHttpFailure,
    classifyThrownError,
    failureUserMessage,
    shouldCloseSession,
    parseSessionRevokedMessage as parseSessionRevokedOnApp,
    type ApiFailureKind,
} from "../../mobile/hooks/apiFailure";
import {
    RevocationCache,
    buildDeviceNotApprovedMessage,
    buildSessionRevokedMessage,
    evaluateDevice,
    guardifyDeviceGate,
    parseSessionRevokedMessage,
    type Revocation,
} from "./guardifyDevices";

const mobile = path.resolve(__dirname, "..", "..", "mobile");
const leer = (rel: string) => fs.readFileSync(path.join(mobile, rel), "utf8");

describe("separar las causas de un fallo de la API (issue #174, H07)", () => {
    it("401 es sesión vencida", () => {
        assert.equal(classifyHttpFailure(401, null), "session_expired");
        assert.equal(classifyHttpFailure(401, { message: "cualquier cosa" }), "session_expired");
    });
    it("403 con código de permiso es falta de permiso, y NO cierra la sesión", () => {
        assert.equal(classifyHttpFailure(403, { status: false, code: "permission_denied", message: "x" }), "permission_denied");
        assert.equal(shouldCloseSession("permission_denied"), false);
    });
    it("403 de equipo no aprobado se distingue de un token inválido y NO cierra la sesión", () => {
        assert.equal(classifyHttpFailure(403, { message: buildDeviceNotApprovedMessage("BLOCKED", "motivo") }), "device_not_approved");
        assert.equal(shouldCloseSession("device_not_approved"), false);
    });
    it("403 de sesión revocada (por código o por mensaje) se distingue del equipo bloqueado y SÍ cierra la sesión", () => {
        assert.equal(classifyHttpFailure(403, { code: "session_revoked" }), "session_revoked");
        assert.equal(classifyHttpFailure(403, { message: buildSessionRevokedMessage("motivo") }), "session_revoked");
        assert.equal(shouldCloseSession("session_revoked"), true);
    });
    it("cualquier otro 403 (token inválido) sigue cerrando la sesión", () => {
        for (const payload of [null, undefined, {}, { message: "Token inválido" }, [], "texto", 7, { message: 5 }, { code: 5 }]) {
            assert.equal(classifyHttpFailure(403, payload), "forbidden", JSON.stringify(payload));
        }
        assert.equal(shouldCloseSession("forbidden"), true);
        assert.equal(shouldCloseSession("session_expired"), true);
    });
    it("un 5xx es un fallo del servidor y no cierra la sesión", () => {
        for (const s of [500, 502, 503, 504]) assert.equal(classifyHttpFailure(s, null), "server_error");
        assert.equal(shouldCloseSession("server_error"), false);
    });
    it("las respuestas correctas y los errores que no son de autenticación no son un fallo de sesión", () => {
        for (const s of [200, 201, 204, 304, 400, 404, 409, 422, 429]) assert.equal(classifyHttpFailure(s, { code: "permission_denied" }), null, String(s));
    });
    it("un error al hacer la petición se separa en tiempo agotado y red, y ninguno cierra la sesión", () => {
        assert.equal(classifyThrownError(Object.assign(new Error("aborted"), { name: "AbortError" })), "timeout");
        assert.equal(classifyThrownError(Object.assign(new Error("t"), { name: "TimeoutError" })), "timeout");
        assert.equal(classifyThrownError(new TypeError("Network request failed")), "network");
        for (const e of [new Error("boom"), "texto", null, undefined, 3, {}]) assert.equal(classifyThrownError(e), "network");
        assert.equal(shouldCloseSession("network"), false);
        assert.equal(shouldCloseSession("timeout"), false);
    });
    it("cada causa tiene un mensaje propio para la persona, y el de permiso no habla de sesión vencida", () => {
        const kinds: ApiFailureKind[] = ["session_expired", "permission_denied", "device_not_approved", "session_revoked", "forbidden", "server_error", "network", "timeout"];
        const msgs = kinds.map((k) => failureUserMessage(k));
        for (const m of msgs) assert.ok(m.trim().length > 10);
        assert.ok(new Set(msgs).size >= kinds.length - 1, "solo se permite repetir el texto de sesión vencida / token inválido");
        assert.doesNotMatch(failureUserMessage("permission_denied"), /venci|expir/i);
        assert.match(failureUserMessage("network"), /conexi/i);
    });
});

describe("contrato `session_revoked` entre servidor y app (issue #174, H07)", () => {
    it("el servidor arma el mensaje y la app lo entiende (mismo formato)", () => {
        const msg = buildSessionRevokedMessage("Cierre por seguridad");
        assert.deepEqual(parseSessionRevokedMessage(msg), { reason: "Cierre por seguridad" });
        assert.deepEqual(parseSessionRevokedOnApp(msg), { reason: "Cierre por seguridad" });
        assert.equal(parseSessionRevokedOnApp(buildDeviceNotApprovedMessage("BLOCKED", "x")), null);
        assert.equal(parseSessionRevokedOnApp(undefined), null);
        assert.deepEqual(parseSessionRevokedOnApp(buildSessionRevokedMessage(null)), { reason: null });
    });
    it("el motivo no puede romper el formato", () => {
        const msg = buildSessionRevokedMessage("a|b|c");
        assert.deepEqual(parseSessionRevokedMessage(msg), { reason: "a/b/c" });
    });
    const rev = (r: Partial<Revocation>): Revocation => ({ deviceId: null, sessionId: null, status: "BLOCKED", reason: null, ...r } as Revocation);
    const cacheCon = async (items: Revocation[]) => {
        const c = new RevocationCache(async () => ({ items, cursor: null }), 45_000, () => 0);
        await c.ensureFresh();
        await c.whenIdle();
        return c;
    };
    const env = { GUARDIFY_DEVICE_ENFORCE: "on" } as Record<string, string>;
    it("una revocación de SESIÓN avisa con session_revoked y la de EQUIPO con device_not_approved", async () => {
        const cache = await cacheCon([rev({ sessionId: "ses-1", reason: "cerrada por un administrador" }), rev({ deviceId: "dev-1", status: "BLOCKED", reason: "robado" })]);
        assert.equal(evaluateDevice({ gdev: "d", gsid: "ses-1" }, cache).scope, "session");
        assert.equal(evaluateDevice({ gdev: "dev-1", gsid: "x" }, cache).scope, "device");
        const sesion = await guardifyDeviceGate({ payload: { id: 1, gdev: "d", gsid: "ses-1" } as never }, env, cache);
        assert.deepEqual(parseSessionRevokedMessage(sesion), { reason: "cerrada por un administrador" });
        const equipo = await guardifyDeviceGate({ payload: { id: 1, gdev: "dev-1", gsid: "x" } as never }, env, cache);
        assert.equal(parseSessionRevokedMessage(equipo), null);
        assert.match(String(equipo), /^device_not_approved\|BLOCKED\|/);
    });
    it("si el equipo y la sesión están revocados manda el equipo (es lo más grave)", async () => {
        const cache = await cacheCon([rev({ sessionId: "ses-1" }), rev({ deviceId: "dev-1", status: "BLOCKED" })]);
        const msg = await guardifyDeviceGate({ payload: { id: 1, gdev: "dev-1", gsid: "ses-1" } as never }, env, cache);
        assert.match(String(msg), /^device_not_approved\|/);
    });
});

describe("cableado en la app (issue #174, H07)", () => {
    const src = leer("hooks/authedFetch.ts");
    it("authedFetch usa el clasificador y solo cierra la sesión cuando la causa lo exige", () => {
        assert.match(src, /classifyHttpFailure\(/);
        assert.match(src, /shouldCloseSession\(/);
        assert.equal(/response\.status === 401 \|\| response\.status === 403\) \{\s*await logout/.test(src), false, "ya no se cierra con cualquier 401/403");
    });
    it("un error de red o de tiempo agotado se clasifica y se registra, sin cerrar la sesión", () => {
        const catchBlock = src.slice(src.lastIndexOf("} catch (error)")); // el catch externo (el interno es el del bucle de reintentos)
        assert.match(catchBlock, /classifyThrownError\(/);
        assert.match(catchBlock, /recordAuthedFailure\(/);
        assert.equal(/logout\(\)/.test(catchBlock), false);
    });
    it("la última causa de fallo queda disponible para quien llama y se limpia con una respuesta correcta", () => {
        assert.match(src, /export function getLastAuthedFailure\(/);
        assert.match(src, /clearAuthedFailure\(/);
    });
    it("una sesión revocada avisa a la persona con su mensaje antes de cerrar", () => {
        assert.match(src, /SESSION_REVOKED_EVENT|sessionRevoked/);
        const app = leer("App.tsx");
        assert.match(app, /sessionEndedByServer|SESSION_REVOKED_EVENT/);
    });
    it("el servidor responde 403 con código `permission_denied` solo para falta de permiso (contrato de #169 intacto)", () => {
        const route = fs.readFileSync(path.resolve(__dirname, "..", "app", "api", "reportes", "route.ts"), "utf8");
        assert.match(route, /permission_denied/);
    });
});
