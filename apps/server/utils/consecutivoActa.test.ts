import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { crearConConsecutivo, esErrorDeDuplicado, formatConsecutivoActa } from "./consecutivoActa";

describe("consecutivo del acta de entrega", () => {
    it("se muestra con ceros a la izquierda y empieza en 0001", () => {
        assert.equal(formatConsecutivoActa(1), "0001");
        assert.equal(formatConsecutivoActa("42"), "0042");
        assert.equal(formatConsecutivoActa(9999), "9999");
        assert.equal(formatConsecutivoActa(10000), "10000"); // no se recorta
    });
    it("vacío o inválido no tiene consecutivo", () => {
        for (const v of [null, undefined, "", "  ", 0, -3, 1.5, "abc"]) assert.equal(formatConsecutivoActa(v), null, String(v));
    });
    it("reconoce el error de índice único (Prisma o MySQL)", () => {
        assert.equal(esErrorDeDuplicado(new Error("Unique constraint failed on the constraint: `uq_acta`")), true);
        assert.equal(esErrorDeDuplicado(new Error("Invalid `prisma.create()` P2002")), true);
        assert.equal(esErrorDeDuplicado(new Error("Duplicate entry '1-3' for key 'uq_acta'")), true);
        assert.equal(esErrorDeDuplicado(new Error("No se recibió respuesta del servidor")), false);
    });
    it("asigna el siguiente número y lo pasa al alta", async () => {
        const out = await crearConConsecutivo({ siguiente: async () => 7, crear: async (n) => ({ consecutivo: n }) });
        assert.deepEqual(out, { consecutivo: 7 });
    });
    it("si el número ya lo tomó otra acta (duplicado), pide el siguiente y reintenta", async () => {
        let ultimoUsado = 7; // otra acta ya guardó el 8 mientras esta calculaba
        const intentos: number[] = [];
        const out = await crearConConsecutivo({
            siguiente: async () => (intentos.length === 0 ? 8 : ultimoUsado + 1),
            crear: async (n) => {
                intentos.push(n);
                if (n === 8) { ultimoUsado = 8; throw new Error("Unique constraint failed"); }
                return n;
            },
        });
        assert.equal(out, 9);
        assert.deepEqual(intentos, [8, 9]);
    });
    it("otros errores no se reintentan", async () => {
        let llamadas = 0;
        await assert.rejects(
            crearConConsecutivo({ siguiente: async () => 1, crear: async () => { llamadas++; throw new Error("columna requerida"); } }),
            /columna requerida/,
        );
        assert.equal(llamadas, 1);
    });
    it("tras agotar los intentos propaga el error de duplicado", async () => {
        let llamadas = 0;
        await assert.rejects(
            crearConConsecutivo({ siguiente: async () => 1, crear: async () => { llamadas++; throw new Error("Duplicate entry"); }, maxIntentos: 3 }),
            /Duplicate entry/,
        );
        assert.equal(llamadas, 3);
    });
});
