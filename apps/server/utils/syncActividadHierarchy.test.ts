import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { jerarquiaComun } from "./syncActividadHierarchy";

const cadena = (empresa: number, cliente: number, division: number | null, contrato: number, corpo: number) => ({
    empresa_id: empresa,
    cliente_id: cliente,
    division_id: division,
    contrato_id: contrato,
    corpo_id: corpo,
});

describe("jerarquía de una actividad (a partir de sus puestos)", () => {
    it("sin puestos, todos los niveles quedan vacíos", () => {
        assert.deepEqual(Object.values(jerarquiaComun([], new Map())), [null, null, null, null, null, null]);
    });

    it("con un solo puesto guarda toda la cadena y el puesto", () => {
        const j = jerarquiaComun([10], new Map([[10, cadena(1, 2, 3, 4, 5)]]));
        assert.deepEqual([j.empresa_id, j.cliente_id, j.division_id, j.contrato_id, j.corpo_id, j.puesto_id], [1, 2, 3, 4, 5, 10]);
    });

    it("con varios puestos solo guarda los niveles en que todos coinciden (y no el puesto)", () => {
        const j = jerarquiaComun([10, 11], new Map([[10, cadena(1, 2, 3, 4, 5)], [11, cadena(1, 2, 3, 4, 6)]]));
        assert.deepEqual([j.empresa_id, j.cliente_id, j.division_id, j.contrato_id, j.corpo_id, j.puesto_id], [1, 2, 3, 4, null, null]);
    });

    it("un nivel desconocido en algún puesto queda vacío", () => {
        const j = jerarquiaComun([10, 11], new Map([[10, cadena(1, 2, 3, 4, 5)], [11, cadena(1, 2, null, 4, 5)]]));
        assert.deepEqual([j.empresa_id, j.division_id, j.corpo_id], [1, null, 5]);
    });

    it("un puesto sin cadena resoluble vacía todos los niveles", () => {
        const j = jerarquiaComun([10, 99], new Map([[10, cadena(1, 2, 3, 4, 5)]]));
        assert.deepEqual([j.empresa_id, j.cliente_id, j.division_id, j.contrato_id, j.corpo_id], [null, null, null, null, null]);
    });
});
