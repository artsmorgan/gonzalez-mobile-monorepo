import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    EVIDENCE_STAMP_KEY,
    headersFromStamp,
    isQueueKey,
    stampFromHeaders,
    stampQueueJson,
    takeStampFromBody,
    type EvidenceStamp,
} from "../../mobile/hooks/evidenceQueue";
import { buildEvidenceHeaders } from "../../mobile/hooks/evidenceHeaders";

const ahora = (at: number, lat = 9.93, lng = -84.08): EvidenceStamp => ({ at: String(at), lat: String(lat), lng: String(lng) });
const maker = (stamp: EvidenceStamp | null, calls: { n: number } = { n: 0 }) => async () => {
    calls.n++;
    return stamp;
};
const sinPrev = async () => null;

describe("sello de evidencia de las colas sin conexión", () => {
    it("reconoce las colas por el sufijo _actions", () => {
        for (const k of ["evaluations_actions", "lunchtime_actions", "attendance_actions"]) assert.equal(isQueueKey(k), true);
        for (const k of ["access_token", "actions_cache", "last_location", "pending_actions_backup"]) assert.equal(isQueueKey(k), false);
    });

    it("sella una acción nueva dentro de su cuerpo (payload, requestData, data o body)", async () => {
        for (const c of ["payload", "requestData", "data", "body"]) {
            const next = JSON.stringify([{ id: "a1", action: "create", type: "x", [c]: { campo: 1 } }]);
            const out = JSON.parse(await stampQueueJson(next, sinPrev, maker(ahora(1000))));
            assert.deepEqual(out[0][c][EVIDENCE_STAMP_KEY], ahora(1000), c);
            assert.equal(out[0][c].campo, 1);
        }
    });

    it("no toca lo que no tiene cuerpo objeto, ni lo que no es una cola, ni JSON inválido", async () => {
        const calls = { n: 0 };
        const plano = JSON.stringify([{ id: "s1", type: "salida", marcaId: 3, horaAccion: 5 }]);
        assert.equal(await stampQueueJson(plano, sinPrev, maker(ahora(1), calls)), plano);
        assert.equal(await stampQueueJson("{\"a\":1}", sinPrev, maker(ahora(1), calls)), "{\"a\":1}");
        assert.equal(await stampQueueJson("no es json", sinPrev, maker(ahora(1), calls)), "no es json");
        assert.equal(await stampQueueJson("[]", sinPrev, maker(ahora(1), calls)), "[]");
        assert.equal(calls.n, 0);
    });

    it("la hora y la ubicación son las del momento de guardar, una sola captura por guardado", async () => {
        const calls = { n: 0 };
        const next = JSON.stringify([{ id: "a", payload: { x: 1 } }, { id: "b", requestData: { y: 2 } }]);
        const out = JSON.parse(await stampQueueJson(next, sinPrev, maker(ahora(8_000), calls)));
        assert.equal(calls.n, 1);
        assert.equal(out[0].payload[EVIDENCE_STAMP_KEY].at, "8000");
        assert.equal(out[1].requestData[EVIDENCE_STAMP_KEY].at, "8000");
    });

    it("una acción que ya estaba en la cola conserva su sello al volver a guardarse (aunque se quite o agregue otra)", async () => {
        const primera = await stampQueueJson(JSON.stringify([{ id: "a", payload: { x: 1 } }]), sinPrev, maker(ahora(8_000)));
        const lista = JSON.parse(primera);
        lista.push({ id: "b", payload: { y: 2 } });
        const segunda = JSON.parse(await stampQueueJson(JSON.stringify(lista), async () => primera, maker(ahora(15_000))));
        assert.equal(segunda[0].payload[EVIDENCE_STAMP_KEY].at, "8000"); // ya traía su sello
        assert.equal(segunda[1].payload[EVIDENCE_STAMP_KEY].at, "15000"); // la nueva se sella ahora
    });

    it("si el código reconstruye la acción sin el sello pero idéntica, se le devuelve el que tenía", async () => {
        const primera = await stampQueueJson(JSON.stringify([{ id: "a", action: "create", payload: { x: 1 } }]), sinPrev, maker(ahora(8_000)));
        const sinSello = JSON.stringify([{ id: "a", action: "create", payload: { x: 1 } }]);
        const out = JSON.parse(await stampQueueJson(sinSello, async () => primera, maker(ahora(15_000))));
        assert.equal(out[0].payload[EVIDENCE_STAMP_KEY].at, "8000");
    });

    it("las acciones anteriores a esta versión (sin sello) no se sellan con la hora de la sincronización", async () => {
        const calls = { n: 0 };
        const vieja = JSON.stringify([{ id: "v", payload: { x: 1 } }]);
        // quitar otra acción de la cola vuelve a guardar la vieja tal cual: sigue sin sello
        const out = await stampQueueJson(vieja, async () => JSON.stringify([{ id: "v", payload: { x: 1 } }, { id: "w", payload: {} }]), maker(ahora(15_000), calls));
        assert.equal(out, vieja);
        assert.equal(calls.n, 0);
    });

    it("una acción modificada en la cola cuenta como nueva y se sella con la hora del cambio", async () => {
        const primera = await stampQueueJson(JSON.stringify([{ id: "a", payload: { x: 1 } }]), sinPrev, maker(ahora(8_000)));
        const editada = JSON.stringify([{ id: "a", payload: { x: 2 } }]);
        const out = JSON.parse(await stampQueueJson(editada, async () => primera, maker(ahora(9_000))));
        assert.equal(out[0].payload[EVIDENCE_STAMP_KEY].at, "9000");
    });

    it("sin captura posible (null) o sin lectura previa la cola se guarda igual", async () => {
        const next = JSON.stringify([{ id: "a", payload: { x: 1 } }]);
        assert.equal(await stampQueueJson(next, sinPrev, maker(null)), next);
        const roto = async () => {
            throw new Error("sin lectura");
        };
        const out = JSON.parse(await stampQueueJson(next, roto as any, maker(ahora(1))));
        assert.equal(out[0].payload[EVIDENCE_STAMP_KEY].at, "1");
    });
});

describe("del sello a las cabeceras al reenviar", () => {
    it("las cabeceras del momento → sello → las mismas cabeceras", () => {
        const h = buildEvidenceHeaders({ permissionGranted: true, location: { latitude: 9.9281, longitude: -84.0907, atMs: 1_000 }, nowMs: 1_500 });
        const s = stampFromHeaders(h)!;
        assert.deepEqual(headersFromStamp(s), { "X-Evidence-At": "1000", "X-Evidence-Lat": "9.9281", "X-Evidence-Lng": "-84.0907" });
    });
    it("permiso negado y sin ubicación reciente", () => {
        const denied = stampFromHeaders(buildEvidenceHeaders({ permissionGranted: false, location: null, nowMs: 2_000 }))!;
        assert.deepEqual(headersFromStamp(denied), { "X-Evidence-At": "2000", "X-Evidence-Perm": "denied" });
        const soloHora = stampFromHeaders(buildEvidenceHeaders({ permissionGranted: true, location: null, nowMs: 3_000 }))!;
        assert.deepEqual(headersFromStamp(soloHora), { "X-Evidence-At": "3000" });
        assert.equal(stampFromHeaders({}), null);
        assert.equal(stampFromHeaders(null), null);
    });
    it("un sello alterado o inválido no genera cabeceras", () => {
        for (const bad of [null, undefined, "x", 5, [], {}, { at: "0" }, { at: "abc" }, { at: -1 }]) assert.equal(headersFromStamp(bad), null);
        assert.deepEqual(headersFromStamp({ at: "10", lat: "999", lng: "0" }), { "X-Evidence-At": "10" }); // coordenada fuera de rango: solo la hora
        assert.deepEqual(headersFromStamp({ at: "10", lat: "x", lng: "y", perm: "denied" }), { "X-Evidence-At": "10", "X-Evidence-Perm": "denied" });
    });
});

describe("el sello sale del cuerpo antes de enviarlo", () => {
    it("lo quita del cuerpo JSON y lo entrega; el resto del cuerpo queda igual", async () => {
        const cuerpo = JSON.stringify({ a: 1, [EVIDENCE_STAMP_KEY]: ahora(5_000), anidado: { b: [1, 2] } });
        const r = takeStampFromBody(cuerpo);
        assert.deepEqual(r.stamp, ahora(5_000));
        assert.deepEqual(JSON.parse(r.body), { a: 1, anidado: { b: [1, 2] } });
        assert.equal(r.body.includes(EVIDENCE_STAMP_KEY), false);
    });
    it("también si el cuerpo envuelve la acción en otro objeto o en una lista", () => {
        const r = takeStampFromBody(JSON.stringify({ requestData: { x: 1, [EVIDENCE_STAMP_KEY]: ahora(7) } }));
        assert.deepEqual(r.stamp, ahora(7));
        assert.deepEqual(JSON.parse(r.body), { requestData: { x: 1 } });
        const l = takeStampFromBody(JSON.stringify([{ [EVIDENCE_STAMP_KEY]: ahora(8), z: 0 }]));
        assert.deepEqual(JSON.parse(l.body), [{ z: 0 }]);
    });
    it("un cuerpo sin sello, que no es JSON o muy grande sin la clave se devuelve idéntico", () => {
        for (const c of ["{\"a\":1}", "texto", "", "x".repeat(200_000)]) {
            const r = takeStampFromBody(c);
            assert.equal(r.body, c);
            assert.equal(r.stamp, undefined);
        }
        const roto = `{"${EVIDENCE_STAMP_KEY}": `;
        assert.equal(takeStampFromBody(roto).body, roto);
    });
    it("de la cola a la petición: lo guardado a las 8:00 viaja con las 8:00 aunque se envíe a las 15:00", async () => {
        const cola = await stampQueueJson(JSON.stringify([{ id: "a", action: "create", payload: { nota: "hola" } }]), sinPrev, maker(ahora(8 * 3_600_000)));
        const accion = JSON.parse(cola)[0];
        const enviado = takeStampFromBody(JSON.stringify(accion.payload)); // lo que haría la sincronización con el cuerpo de la acción
        assert.deepEqual(JSON.parse(enviado.body), { nota: "hola" });
        assert.equal(headersFromStamp(enviado.stamp)!["X-Evidence-At"], String(8 * 3_600_000));
    });
});
