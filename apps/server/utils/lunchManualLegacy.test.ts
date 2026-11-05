import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { corregirHorasManualLegado, esManualLegado, FORMATO_HORA_CR_RELOJ } from "./lunchManualLegacy";

describe("almuerzo manual de la versión anterior de la app (issue #158)", () => {
    it("solo es «legado» un registro manual sin la marca de formato", () => {
        assert.equal(esManualLegado(true, undefined), true);
        assert.equal(esManualLegado(true, ""), true);
        assert.equal(esManualLegado(true, FORMATO_HORA_CR_RELOJ), false);
        assert.equal(esManualLegado(false, undefined), false); // el temporizador siempre usó la hora de reloj
        assert.equal(esManualLegado(undefined, undefined), false);
    });
    it("resta las 6 horas al inicio, al fin y a las pausas", () => {
        // lo digitado fue 12:00 → 13:00 con una pausa 12:20 → 12:30; la versión anterior mandó +6 h
        const fixed = corregirHorasManualLegado({
            inicio: "2026-10-15T18:00:00.000Z",
            fin: "2026-10-15T19:00:00.000Z",
            pausas: JSON.stringify([{ startTime: "2026-10-15T18:20:00.000Z", endTime: "2026-10-15T18:30:00.000Z", reason: "Llamada" }]),
        });
        assert.equal(fixed.inicio, "2026-10-15T12:00:00.000Z");
        assert.equal(fixed.fin, "2026-10-15T13:00:00.000Z");
        assert.deepEqual(JSON.parse(fixed.pausas), [{ startTime: "2026-10-15T12:20:00.000Z", endTime: "2026-10-15T12:30:00.000Z", reason: "Llamada" }]);
    });
    it("cruza el cambio de día correctamente", () => {
        const fixed = corregirHorasManualLegado({ inicio: "2026-10-16T02:30:00.000Z", fin: new Date("2026-10-16T03:00:00.000Z"), pausas: "[]" });
        assert.equal(fixed.inicio, "2026-10-15T20:30:00.000Z");
        assert.equal(fixed.fin, "2026-10-15T21:00:00.000Z");
    });
    it("tolera pausas vacías, nulas o ilegibles", () => {
        assert.equal(corregirHorasManualLegado({ inicio: "2026-10-15T18:00:00Z", fin: "2026-10-15T19:00:00Z", pausas: null }).pausas, "[]");
        assert.equal(corregirHorasManualLegado({ inicio: "2026-10-15T18:00:00Z", fin: "2026-10-15T19:00:00Z", pausas: "no-json" }).pausas, "no-json");
    });
});
