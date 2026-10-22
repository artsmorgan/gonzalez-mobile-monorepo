import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { construirEvidencia, filaDeEvidencia, huellaSha256, llaveroDesdeEntorno } from "../evidencia";
import { handleEvidenceVerification, verificarFilas } from "./evidenciaVerificacion";

const KEY = "una-llave-de-guardify-de-mas-de-24-caracteres";
const SECRETO = "una-clave-de-prueba-de-mas-de-24-caracteres";
const env = { GUARDIFY_REPORTS_API_KEY: KEY, EVIDENCE_SIGNING_KEY: SECRETO };
const llavero = llaveroDesdeEntorno(env)!;
const AHORA = Date.UTC(2026, 9, 21, 14, 30, 0);

function filaGuardada(id: number, over: Record<string, unknown> = {}) {
    const e = construirEvidencia({ tabla: "c_incidente", registroId: 5, accion: "CREATE" }, {
        headers: { "x-device-uid": "dev-1", "x-evidence-lat": "9.93", "x-evidence-lng": "-84.08", "x-evidence-at": String(AHORA) },
        actor: { id: 7, cedula: "1-1", sessionId: "s" }, datos: {}, ahoraMs: AHORA,
    })!;
    // como la devuelve la base: fechas como Date
    const f = filaDeEvidencia(e, llavero, AHORA);
    return { id, ...f, capturado_en: new Date(f.capturado_en), creado: new Date(f.creado), ...over };
}
const call = (qs: string, headers: Record<string, string> = { authorization: `Bearer ${KEY}` }, rows: any[] = [filaGuardada(1)]) =>
    handleEvidenceVerification(new Request(`http://x/api/guardify/evidence?${qs}`, { headers }), { db: { c_evidencia_registro: { findMany: async () => rows } }, env });

describe("verificación de la firma de la evidencia para Guardify (issue #151)", () => {
    it("una fila intacta verifica; una alterada (ubicación o usuario) no", () => {
        const [ok, alterada, usuario] = verificarFilas([filaGuardada(1), filaGuardada(2, { latitud: "0.0" }), filaGuardada(3, { usuario_id: 99 })], llavero);
        assert.deepEqual([ok!.valida, alterada!.valida, usuario!.valida], [true, false, false]);
        assert.deepEqual([ok!.firma_ok, ok!.sello_ok], [true, true]);
        assert.deepEqual([ok!.latitud, ok!.longitud, ok!.dispositivo, ok!.capturado_en], [9.93, -84.08, "dev-1", "2026-10-21T14:30:00"]);
    });
    it("entrega el contenido firmado: Guardify recalcula la huella con él y coincide con la guardada", () => {
        const fila = verificarFilas([filaGuardada(1)], llavero)[0]!;
        assert.equal(huellaSha256(fila.contenido), fila.firma);
        assert.deepEqual([fila.contenido.latitud, fila.contenido.dispositivo, fila.contenido.tabla], [9.93, "dev-1", "c_incidente"]);
    });
    it("sin clave en el servidor, la huella se verifica igual y el sello queda como «no se puede saber» (null)", () => {
        const [fila] = verificarFilas([filaGuardada(1)], null);
        assert.deepEqual([fila!.firma_ok, fila!.sello_ok, fila!.valida], [true, null, true]);
    });
    it("una fila fabricada con huella consistente pero sin el sello correcto se detecta", () => {
        const fabricada = filaGuardada(4, { sello: "cd".repeat(32) });
        const [fila] = verificarFilas([fabricada], llavero);
        assert.deepEqual([fila!.firma_ok, fila!.sello_ok, fila!.valida], [true, false, false]);
    });
    it("responde con las filas de un registro y exige la llave de Guardify", async () => {
        const res = await call("tabla=c_incidente&registro_id=5");
        assert.equal(res.status, 200);
        const body: any = await res.json();
        assert.equal(body.rows.length, 1);
        assert.equal(body.rows[0].valida, true);
        assert.equal((await call("tabla=c_incidente&registro_id=5", {})).status, 401);
        assert.equal((await call("tabla=c_incidente&registro_id=5", { authorization: "Bearer otra-llave-que-no-es-la-correcta-12345" })).status, 401);
    });
    it("valida los parámetros", async () => {
        assert.equal((await call("registro_id=5")).status, 400);
        assert.equal((await call("tabla=c_incidente")).status, 400);
        assert.equal((await call("tabla=c_incidente;drop&registro_id=5")).status, 400);
        assert.equal((await call("tabla=c_incidente&registro_id=-1")).status, 400);
    });
    it("si la base falla responde 500 sin romper", async () => {
        const res = await handleEvidenceVerification(new Request("http://x/e?tabla=c_incidente&registro_id=5", { headers: { authorization: `Bearer ${KEY}` } }), {
            db: { c_evidencia_registro: { findMany: async () => { throw new Error("sin tabla"); } } }, env,
        });
        assert.equal(res.status, 500);
    });
});
