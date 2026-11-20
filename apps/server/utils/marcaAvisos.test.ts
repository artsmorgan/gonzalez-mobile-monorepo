import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { esTardiaAhora, type TardiaInput } from "../../mobile/hooks/marcaAvisos";

const pantalla = fs.readFileSync(path.resolve(__dirname, "..", "..", "mobile", "screens", "MarcarIngresoSalidaScreen.tsx"), "utf8").replace(/\r\n/g, "\n");

const MIN = 60 * 1000;
const inicio = Date.UTC(2026, 10, 20, 10, 0, 0);
const base: TardiaInput = { ingresada: false, tieneHorario: true, diaLibre: false, inicioMs: inicio, horaAccionMs: inicio, postMinutes: 5 };

describe("el aviso «Tardía» solo sale cuando de verdad está tarde", () => {
    it("antes del inicio y dentro de la gracia no sale", () => {
        assert.equal(esTardiaAhora({ ...base, horaAccionMs: inicio - 2 * 60 * MIN }), false);
        assert.equal(esTardiaAhora({ ...base, horaAccionMs: inicio - 1 }), false);
        assert.equal(esTardiaAhora({ ...base, horaAccionMs: inicio }), false);
        assert.equal(esTardiaAhora({ ...base, horaAccionMs: inicio + 5 * MIN }), false, "justo en el límite de la gracia");
    });

    it("pasada la gracia sí sale", () => {
        assert.equal(esTardiaAhora({ ...base, horaAccionMs: inicio + 5 * MIN + 1 }), true);
        assert.equal(esTardiaAhora({ ...base, horaAccionMs: inicio + 90 * MIN }), true);
        assert.equal(esTardiaAhora({ ...base, postMinutes: 0, horaAccionMs: inicio + 1 }), true);
    });

    it("no sale si ya marcó, si no hay horario completo, si es día libre o si falta algún dato", () => {
        const tarde = { ...base, horaAccionMs: inicio + 60 * MIN };
        assert.equal(esTardiaAhora({ ...tarde, ingresada: true }), false);
        assert.equal(esTardiaAhora({ ...tarde, tieneHorario: false }), false);
        assert.equal(esTardiaAhora({ ...tarde, diaLibre: true }), false);
        assert.equal(esTardiaAhora({ ...tarde, inicioMs: null }), false);
        assert.equal(esTardiaAhora({ ...tarde, horaAccionMs: null }), false);
        assert.equal(esTardiaAhora({ ...tarde, horaAccionMs: NaN }), false);
        assert.equal(esTardiaAhora({ ...tarde, postMinutes: NaN }), true, "sin gracia válida se toma como cero");
    });

    it("la pantalla ya no se fía de la bandera guardada (is_late)", () => {
        assert.match(pantalla, /\{tardiaVisible && \(/);
        assert.equal(/resolveMarcaIsLate\(marcaView as Record<string, unknown>\) \|\| attendanceData\.is_late/.test(pantalla), false);
    });
});
