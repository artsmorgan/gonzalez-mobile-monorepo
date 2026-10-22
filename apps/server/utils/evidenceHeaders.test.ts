import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildEvidenceHeaders, EVIDENCE_LOCATION_MAX_AGE_MS, FRESH_LOCATION_RETRY_MS, isMutatingMethod, needsFreshLocation, parseLocationTimeMs } from "../../mobile/hooks/evidenceHeaders";
import { construirEvidencia } from "./evidencia";

const NOW = Date.UTC(2026, 9, 21, 14, 30, 0);

describe("cabeceras de evidencia de la app (issue #152)", () => {
    it("solo las acciones que guardan datos llevan evidencia", () => {
        for (const m of ["POST", "put", "PATCH", "Delete"]) assert.equal(isMutatingMethod(m), true, m);
        for (const m of ["GET", "HEAD", undefined, null]) assert.equal(isMutatingMethod(m), false, String(m));
    });
    it("con permiso y una lectura reciente manda latitud, longitud y la hora de esa lectura", () => {
        const h = buildEvidenceHeaders({ permissionGranted: true, location: { latitude: 9.9341, longitude: -84.0877, atMs: NOW - 30_000 }, nowMs: NOW });
        assert.deepEqual(h, { "X-Evidence-Lat": "9.9341", "X-Evidence-Lng": "-84.0877", "X-Evidence-At": String(NOW - 30_000) });
    });
    it("una lectura demasiado vieja o del futuro no se manda como ubicación de la acción", () => {
        const vieja = buildEvidenceHeaders({ permissionGranted: true, location: { latitude: 1, longitude: 2, atMs: NOW - EVIDENCE_LOCATION_MAX_AGE_MS - 1 }, nowMs: NOW });
        assert.deepEqual(vieja, { "X-Evidence-At": String(NOW) });
        const futura = buildEvidenceHeaders({ permissionGranted: true, location: { latitude: 1, longitude: 2, atMs: NOW + 5000 }, nowMs: NOW });
        assert.deepEqual(futura, { "X-Evidence-At": String(NOW) });
    });
    it("permiso de ubicación negado: la acción se guarda igual y queda marcada", () => {
        const h = buildEvidenceHeaders({ permissionGranted: false, location: { latitude: 1, longitude: 2, atMs: NOW }, nowMs: NOW });
        assert.deepEqual(h, { "X-Evidence-Perm": "denied", "X-Evidence-At": String(NOW) });
    });
    it("sin ninguna lectura solo viaja la hora", () => {
        assert.deepEqual(buildEvidenceHeaders({ permissionGranted: true, location: null, nowMs: NOW }), { "X-Evidence-At": String(NOW) });
    });
    it("lee la hora de last_location en milisegundos o ISO", () => {
        assert.equal(parseLocationTimeMs("1792580400000"), 1792580400000);
        assert.equal(parseLocationTimeMs("2026-10-21T14:30:00.000Z"), NOW);
        assert.equal(parseLocationTimeMs(""), null);
        assert.equal(parseLocationTimeMs("ayer"), null);
    });
    it("de punta a punta: lo que manda la app es lo que el servidor guarda", () => {
        const headers = buildEvidenceHeaders({ permissionGranted: true, location: { latitude: 9.9341, longitude: -84.0877, atMs: NOW - 10_000 }, nowMs: NOW });
        const lower = Object.fromEntries(Object.entries({ ...headers, "X-Device-Uid": "dev-1" }).map(([k, v]) => [k.toLowerCase(), v]));
        const e = construirEvidencia({ tabla: "c_incidente", registroId: 3, accion: "CREATE" }, { headers: lower, actor: { id: 5, cedula: "1-1", sessionId: "s" }, datos: {}, ahoraMs: NOW })!;
        assert.deepEqual([e.latitud, e.longitud, e.dispositivo, e.ubicacionOrigen, e.capturadoEn], ["9.9341", "-84.0877", "dev-1", "cabecera", "2026-10-21T14:29:50"]);
    });
});

describe("lectura nueva del GPS al registrar una acción (issue #152)", () => {
    const base = { permissionGranted: true, nowMs: NOW, lastFailedAtMs: null as number | null };
    it("se pide una lectura nueva cuando no hay ubicación guardada o ya es vieja", () => {
        assert.equal(needsFreshLocation({ ...base, location: null }), true);
        assert.equal(needsFreshLocation({ ...base, location: { atMs: NOW - EVIDENCE_LOCATION_MAX_AGE_MS - 1 } }), true);
        assert.equal(needsFreshLocation({ ...base, location: { atMs: NOW + 5_000 } }), true); // lectura «del futuro»: no es confiable
    });
    it("no se pide si la guardada es reciente (o no trae hora, que se acepta como en las cabeceras)", () => {
        assert.equal(needsFreshLocation({ ...base, location: { atMs: NOW - 30_000 } }), false);
        assert.equal(needsFreshLocation({ ...base, location: { atMs: NOW - EVIDENCE_LOCATION_MAX_AGE_MS } }), false);
        assert.equal(needsFreshLocation({ ...base, location: { atMs: null } }), false);
    });
    it("sin permiso de ubicación nunca se intenta", () => {
        assert.equal(needsFreshLocation({ ...base, permissionGranted: false, location: null }), false);
    });
    it("tras un intento fallido espera un minuto para no demorar cada petición", () => {
        assert.equal(needsFreshLocation({ ...base, location: null, lastFailedAtMs: NOW - 10_000 }), false);
        assert.equal(needsFreshLocation({ ...base, location: null, lastFailedAtMs: NOW - FRESH_LOCATION_RETRY_MS }), true);
        assert.equal(needsFreshLocation({ ...base, location: null, lastFailedAtMs: NOW + 10_000 }), true); // reloj que retrocedió: se reintenta
    });
    it("con la lectura nueva las cabeceras llevan las coordenadas y la hora de la acción", () => {
        const h = buildEvidenceHeaders({ permissionGranted: true, location: { latitude: 9.93, longitude: -84.08, atMs: NOW }, nowMs: NOW });
        assert.deepEqual(h, { "X-Evidence-Lat": "9.93", "X-Evidence-Lng": "-84.08", "X-Evidence-At": String(NOW) });
    });
});
