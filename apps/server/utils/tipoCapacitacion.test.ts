import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeTipoCapacitacion, TIPOS_CAPACITACION } from "../app/api/induction-tour-record/participantesHelpers";
import { normalizeTipoCapacitacion as normalizeMobile } from "../../mobile/hooks/tipoCapacitacion";

describe("tipo de capacitación de inducción y recorrido", () => {
    it("el servidor solo guarda una de las opciones; lo demás queda sin valor", () => {
        assert.equal(normalizeTipoCapacitacion("Presencial"), "Presencial");
        assert.equal(normalizeTipoCapacitacion("  virtual "), "Virtual");
        for (const v of ["", "  ", null, undefined, "Híbrida", 5]) assert.equal(normalizeTipoCapacitacion(v), null);
    });
    it("la app y el servidor aceptan las mismas opciones", () => {
        for (const t of TIPOS_CAPACITACION) {
            assert.equal(normalizeMobile(t), t);
            assert.equal(normalizeMobile(t.toUpperCase()), t);
        }
        assert.equal(normalizeMobile("Otra"), "");
        assert.equal(normalizeMobile(null), "");
    });
});
