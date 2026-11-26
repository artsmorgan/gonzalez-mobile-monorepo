import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_HORAS_ELIMINAR_MARCA_TRAS_SALIDA, finProgramadoMs, marcaCaducada, parseHorasEliminarMarca, salidaReferenciaMs } from "./marcaCaducada";

const ms = (iso: string) => new Date(iso).getTime();
/** Turno de día 07:00–16:00 del 15 oct 2026 (datos como los guarda c_marca_dia). */
const dia = (extra: Record<string, unknown> = {}) => ({
    fecha: new Date("2026-10-15T00:00:00.000Z"),
    hora_inicio: new Date("1970-01-01T07:00:00.000Z"),
    hora_fin: new Date("1970-01-01T16:00:00.000Z"),
    hora_entrada_digitada: new Date("2026-10-15T07:02:00.000Z"),
    hora_salida_digitada: null,
    ...extra,
});
/** Turno nocturno 22:00–06:00 que empieza el 15 y termina el 16. */
const noche = (extra: Record<string, unknown> = {}) => ({
    fecha: new Date("2026-10-15T00:00:00.000Z"),
    hora_inicio: new Date("1970-01-01T22:00:00.000Z"),
    hora_fin: new Date("1970-01-01T06:00:00.000Z"),
    hora_entrada_digitada: new Date("2026-10-15T22:00:00.000Z"),
    hora_salida_digitada: null,
    ...extra,
});

describe("turno caducado (issue #159)", () => {
    it("lee las horas del nomenclador; vacío o inválido usa 4", () => {
        assert.equal(parseHorasEliminarMarca("6"), 6);
        assert.equal(parseHorasEliminarMarca("1,5"), 1.5);
        assert.equal(parseHorasEliminarMarca("0"), 0);
        for (const v of ["", null, undefined, "abc", "-2"]) assert.equal(parseHorasEliminarMarca(v), DEFAULT_HORAS_ELIMINAR_MARCA_TRAS_SALIDA, String(v));
    });
    it("el fin programado suma un día si el turno cruza la medianoche", () => {
        assert.equal(finProgramadoMs(dia()), ms("2026-10-15T16:00:00Z"));
        assert.equal(finProgramadoMs(noche()), ms("2026-10-16T06:00:00Z"));
    });
    it("turno sin cerrar: caduca 4 horas después de su fin programado", () => {
        assert.equal(marcaCaducada(dia(), ms("2026-10-15T19:59:59Z"), 4), false);
        assert.equal(marcaCaducada(dia(), ms("2026-10-15T20:00:00Z"), 4), true);
        // la mañana siguiente ya no es «el turno actual»
        assert.equal(marcaCaducada(dia(), ms("2026-10-16T07:00:00Z"), 4), true);
    });
    it("turno nocturno sin cerrar: cuenta desde las 06:00 del día siguiente", () => {
        assert.equal(marcaCaducada(noche(), ms("2026-10-16T09:59:00Z"), 4), false);
        assert.equal(marcaCaducada(noche(), ms("2026-10-16T10:00:00Z"), 4), true);
    });
    it("con salida marcada cuenta desde la salida real, no desde el fin programado", () => {
        const salio = dia({ hora_salida_digitada: new Date("2026-10-15T14:00:00.000Z") });
        assert.equal(salidaReferenciaMs(salio), ms("2026-10-15T14:00:00Z"));
        assert.equal(marcaCaducada(salio, ms("2026-10-15T17:59:00Z"), 4), false);
        assert.equal(marcaCaducada(salio, ms("2026-10-15T18:00:00Z"), 4), true);
    });
    it("el nomenclador es modificable: 0 horas caduca al terminar; más horas la alargan", () => {
        assert.equal(marcaCaducada(dia(), ms("2026-10-15T16:00:00Z"), 0), true);
        assert.equal(marcaCaducada(dia(), ms("2026-10-15T21:00:00Z"), 6), false);
        assert.equal(marcaCaducada(dia(), ms("2026-10-15T22:00:00Z"), 6), true);
    });
    it("un turno que nunca se inició (ausencia) o que aún no termina no caduca", () => {
        assert.equal(marcaCaducada(dia({ hora_entrada_digitada: null }), ms("2026-10-20T00:00:00Z"), 4), false);
        assert.equal(marcaCaducada(dia(), ms("2026-10-15T12:00:00Z"), 4), false);
    });
    it("acepta cadenas ISO (como las guarda la app) y sin hora_fin usa la duración", () => {
        const s = {
            fecha: "2026-10-15T00:00:00.000Z", hora_inicio: "1970-01-01T07:00:00.000Z", hora_fin: null, horas_duracion: "9",
            hora_entrada_digitada: "2026-10-15T07:00:00.000Z",
        };
        assert.equal(finProgramadoMs(s), ms("2026-10-15T16:00:00Z"));
        assert.equal(marcaCaducada(s, ms("2026-10-15T20:00:00Z"), 4), true);
    });
    it("sin datos suficientes no caduca", () => {
        assert.equal(marcaCaducada({ hora_entrada_digitada: "x" }, Date.now(), 4), false);
        assert.equal(marcaCaducada(dia(), NaN, 4), false);
    });
});
