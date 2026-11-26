import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { stampAtOf } from "../../mobile/hooks/evidenceQueue";
import { isPermissionDeniedPayload } from "../../mobile/hooks/permissionDenied";
import { PERMISSION_DENIED_MESSAGE, friendlyPermissionResponse, permissionFromBody } from "../../mobile/hooks/permissionDeniedNotice";
import {
    DENIED_STAMP_MAX_AGE_MS,
    MAX_DENIED_STAMPS,
    addDeniedStamp,
    markNotified,
    parseDeniedStamps,
    queueRejectedMessage,
    splitRejected,
    toNotify,
} from "../../mobile/hooks/permissionRejectedQueue";

const mobile = path.resolve(__dirname, "..", "..", "mobile");
const leer = (rel: string) => fs.readFileSync(path.join(mobile, rel), "utf8").replace(/\r\n/g, "\n");

const accion = (id: number, at: string | null) => ({ type: "create", id, requestData: { nombre: `n${id}`, ...(at ? { __evidencia: { at, lat: "9.9", lng: "-84.0" } } : {}) } });
const T0 = 1_800_000_000_000;

describe("#211: lo guardado sin conexión que el servidor rechaza por falta de permiso sale de la cola", () => {
    it("lee la hora del sello de una acción; sin sello no hay hora", () => {
        assert.equal(stampAtOf(accion(1, "1700000000123")), "1700000000123");
        assert.equal(stampAtOf(accion(1, null)), null);
        assert.equal(stampAtOf({ type: "x" }), null);
        assert.equal(stampAtOf(null), null);
    });

    it("anota la hora denegada, sin duplicar y descartando lo viejo", () => {
        const a = addDeniedStamp(null, "111", "incidentes.incidentes", T0);
        assert.deepEqual(parseDeniedStamps(a)["111"], { permission: "incidentes.incidentes", at: T0 });
        const b = addDeniedStamp(a, "111", null, T0 + 5);
        assert.equal(parseDeniedStamps(b)["111"]!.permission, "incidentes.incidentes", "no pierde el permiso conocido");
        assert.equal(parseDeniedStamps(b)["111"]!.at, T0, "conserva el momento de la primera denegación");
        const c = addDeniedStamp(b, "222", "x.y", T0 + DENIED_STAMP_MAX_AGE_MS + 1);
        assert.deepEqual(Object.keys(parseDeniedStamps(c)), ["222"], "lo de hace más de 14 días se descarta");
        assert.deepEqual(parseDeniedStamps(addDeniedStamp(null, "no-numero", "p", T0)), {});
    });

    it("limita cuántas denegaciones recuerda", () => {
        let raw: string | null = null;
        for (let i = 1; i <= MAX_DENIED_STAMPS + 20; i++) raw = addDeniedStamp(raw, String(i), "p", T0 + i);
        assert.equal(Object.keys(parseDeniedStamps(raw)).length, MAX_DENIED_STAMPS);
    });

    it("lee sin romperse un almacenamiento dañado", () => {
        assert.deepEqual(parseDeniedStamps("{no es json"), {});
        assert.deepEqual(parseDeniedStamps("[1,2]"), {});
        assert.deepEqual(parseDeniedStamps('{"abc":{"at":1},"5":{"at":"x"},"7":{"at":9}}'), { "7": { permission: null, at: 9 } });
    });

    it("quita solo las acciones denegadas; las demás, las sin sello y el orden quedan igual", () => {
        const denied = parseDeniedStamps(addDeniedStamp(null, "200", "bitacora.registro-de-personas", T0));
        const cola = [accion(1, "100"), accion(2, "200"), accion(3, null), accion(4, "300")];
        const r = splitRejected(JSON.stringify(cola), denied);
        assert.deepEqual(r.rejected, [{ stampAt: "200", permission: "bitacora.registro-de-personas" }]);
        assert.deepEqual(JSON.parse(r.json!).map((a: { id: number }) => a.id), [1, 3, 4]);
    });

    it("si no hay nada que quitar devuelve la misma cola; si queda vacía, null", () => {
        const denied = parseDeniedStamps(addDeniedStamp(null, "200", null, T0));
        const sinCambio = JSON.stringify([accion(1, "100")]);
        assert.equal(splitRejected(sinCambio, denied).json, sinCambio);
        assert.equal(splitRejected(null, denied).json, null);
        assert.equal(splitRejected("{roto", denied).json, "{roto");
        assert.equal(splitRejected(JSON.stringify([accion(2, "200")]), denied).json, null);
        assert.deepEqual(splitRejected(sinCambio, {}).rejected, []);
    });

    it("avisa una sola vez por denegación, aunque la acción reaparezca", () => {
        const denied = parseDeniedStamps(addDeniedStamp(addDeniedStamp(null, "200", "a.b", T0), "201", "c.d", T0));
        const rejected = [
            { stampAt: "200", permission: "a.b" },
            { stampAt: "201", permission: "c.d" },
        ];
        const first = toNotify(rejected, denied)!;
        assert.equal(first.payload.count, 2);
        assert.deepEqual(first.payload.permissions.sort(), ["a.b", "c.d"]);
        const after = parseDeniedStamps(markNotified(denied, first.stamps));
        assert.equal(toNotify(rejected, after), null, "ya se avisó");
        assert.equal(toNotify([{ stampAt: "999", permission: null }], after), null, "una hora desconocida no avisa");
    });

    it("el mensaje para la persona es claro y no técnico", () => {
        assert.match(queueRejectedMessage(1), /^Una acción que guardaste sin conexión no se pudo enviar porque no tienes permiso/);
        assert.match(queueRejectedMessage(3), /^3 acciones que guardaste sin conexión/);
        assert.equal(/permission_denied|403|cola/i.test(queueRejectedMessage(2)), false);
    });
});

describe("#211: las pantallas muestran «No tienes permiso» y no el mensaje técnico", () => {
    it("reescribe el mensaje, conserva el código y pone el permiso aparte", async () => {
        const original = new Response(JSON.stringify({ status: false, expired: false, message: "permission_denied|incidentes.incidentes" }), { status: 403, headers: { "content-type": "application/json" } });
        const r = await friendlyPermissionResponse(original, "incidentes.incidentes");
        assert.equal(r.status, 403);
        const body = await r.json();
        assert.equal(body.message, PERMISSION_DENIED_MESSAGE);
        assert.equal(body.code, "permission_denied");
        assert.equal(body.permission, "incidentes.incidentes");
        assert.equal(body.status, false);
        assert.equal(isPermissionDeniedPayload(body), true, "la app lo sigue reconociendo como falta de permiso (no cierra la sesión)");
        assert.equal(permissionFromBody(body), "incidentes.incidentes");
    });

    it("otro 403 (sesión) y las respuestas que no son JSON no se tocan", async () => {
        const sesion = new Response(JSON.stringify({ message: "Token inválido" }), { status: 403 });
        assert.equal(await friendlyPermissionResponse(sesion, null), sesion);
        const texto = new Response("no json", { status: 403 });
        assert.equal(await friendlyPermissionResponse(texto, null), texto);
    });

    it("el fetch global entrega la respuesta con el texto amable y anota la hora de la acción denegada", () => {
        const f = leer("hooks/installEvidenceFetch.ts");
        assert.match(f, /const denial = await notifyIfPermissionDenied\(response,/);
        assert.match(f, /rememberDeniedQueueAction\(headerValue\(nextInit\?\.headers, 'X-Evidence-At'\), denial\.permission\)/);
        assert.match(f, /return friendlyPermissionResponse\(response, denial\.permission\);/);
    });
});

describe("#211: en la app, la limpieza ocurre al empezar la sincronización y se avisa", () => {
    it("antes de recorrer las colas, no durante (cada ciclo reescribe su cola completa)", () => {
        const app = leer("App.tsx");
        assert.match(app, /await runQueueRetention\(\);[\s\S]{0,300}await purgePermissionRejectedActions\(\);/);
        assert.match(app, /Alert\.alert\('Sin permiso', queueRejectedMessage\(payload\?\.count \?\? 1\)\)/);
        assert.match(app, /eventBus\.on\(QUEUE_PERMISSION_REJECTED_EVENT, onQueueRejected\);/);
        assert.match(app, /eventBus\.off\(QUEUE_PERMISSION_REJECTED_EVENT, onQueueRejected\);/);
    });

    it("la limpieza recorre solo las colas `*_actions` bajo el mismo bloqueo que las demás escrituras", () => {
        const i = leer("hooks/installQueueOwnership.ts");
        assert.match(i, /\.filter\(isQueueKey\)/);
        assert.match(i, /await layer\.mutateQueue\(key, \(current\) => \{\s*const r = splitRejected\(current, denied\);/);
    });
});
