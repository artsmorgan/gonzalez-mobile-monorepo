import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    clearDeviceBlock,
    DEVICE_NOT_APPROVED_EVENT,
    describeDeviceStatus,
    getCurrentDeviceBlock,
    handleDeviceNotApprovedResponse,
    parseDeviceNotApprovedMessage,
} from "../../mobile/hooks/deviceNotApproved";
import { eventBus } from "../../mobile/hooks/eventBus";
import { buildDeviceNotApprovedMessage } from "./guardifyDevices";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("equipo no aprobado en la app (issue #146)", () => {
    it("el mensaje que arma el servidor es el que interpreta la app", () => {
        const msg = buildDeviceNotApprovedMessage("blocked", "perdido");
        assert.deepEqual(parseDeviceNotApprovedMessage(msg), { status: "BLOCKED", reason: "perdido" });
        assert.equal(parseDeviceNotApprovedMessage("Token inválido"), null);
        assert.equal(parseDeviceNotApprovedMessage(undefined), null);
    });
    it("un 403 device_not_approved muestra el estado y NO es un 403 normal (no debe cerrar la sesión)", async () => {
        const events: unknown[] = [];
        const on = (b: unknown) => events.push(b);
        eventBus.on(DEVICE_NOT_APPROVED_EVENT, on);
        const handled = await handleDeviceNotApprovedResponse(json(403, { status: false, expired: false, message: "device_not_approved|BLOCKED|robado" }));
        assert.equal(handled, true);
        assert.deepEqual(getCurrentDeviceBlock(), { status: "BLOCKED", reason: "robado" });
        assert.deepEqual(events, [{ status: "BLOCKED", reason: "robado" }]);
        clearDeviceBlock();
        assert.equal(getCurrentDeviceBlock(), null);
        eventBus.off(DEVICE_NOT_APPROVED_EVENT, on);
    });
    it("un 401/403 por token vencido o inválido sigue siendo un 401/403 normal", async () => {
        assert.equal(await handleDeviceNotApprovedResponse(json(403, { status: false, message: "Token inválido" })), false);
        assert.equal(await handleDeviceNotApprovedResponse(json(401, { status: false, expired: true, message: "Token expirado" })), false);
        assert.equal(await handleDeviceNotApprovedResponse(new Response("no es json", { status: 403 })), false);
        assert.equal(await handleDeviceNotApprovedResponse(json(200, { message: "device_not_approved|BLOCKED|" })), false);
        assert.equal(getCurrentDeviceBlock(), null);
    });
    it("cada estado tiene su pantalla; solo pendiente / sin registrar permiten reintentar", () => {
        const estados = ["PENDING", "UNREGISTERED", "REJECTED", "BLOCKED", "LOCKED", "RETIRED"];
        for (const s of estados) assert.ok(describeDeviceStatus(s, null).title.length > 0, s);
        assert.deepEqual(estados.map((s) => describeDeviceStatus(s, null).canRetry), [true, true, false, false, false, false]);
        assert.match(describeDeviceStatus("REJECTED", "No es de la empresa").body, /No es de la empresa/);
        assert.equal(describeDeviceStatus("raro", null).title, "Equipo bloqueado"); // estado desconocido: se trata como bloqueado
    });
});
