import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { divisionPorContrato, ejecutivoPorCorpo, findByIds, nombresEmpleado, usuarioInserta } from "./enrich";

const table = (rows: any[]) => ({ findMany: async (a: any) => rows.filter((r) => !a?.where?.id?.in || a.where.id.in.includes(r.id)) });
const db: any = {
    e_estructura_sucursal: table([{ id: 1, ejecutivoCuenta_id: 10 }, { id: 2, ejecutivoCuenta_id: null }, { id: 3, ejecutivoCuenta_id: 11 }]),
    n_ejecutivo_cuenta: table([{ id: 10, nombre: " Ana Rojas " }, { id: 11, nombre: "" }]),
    e_estructura_contrato: table([{ id: 5, division_id: 20 }, { id: 6, division_id: null }]),
    n_division: table([{ id: 20, nombre: "Seguridad" }]),
    c_empleado: table([{ id: 7, nombre: "Luis", primer_apellido: "Mora", segundo_apellido: null }, { id: 8, nombre: null, primer_apellido: null }]),
};

describe("enriquecimiento común de reportes", () => {
    it("ejecutivo de cuenta por sucursal (vacíos y sin ejecutivo quedan fuera)", async () => {
        assert.deepEqual([...(await ejecutivoPorCorpo(db, [1, 2, 3, 3, "x", 0]))], [[1, "Ana Rojas"]]);
        assert.deepEqual([...(await ejecutivoPorCorpo(db, []))], []);
    });
    it("división por contrato", async () => {
        assert.deepEqual([...(await divisionPorContrato(db, [5, 6]))], [[5, "Seguridad"]]);
    });
    it("nombre de empleado", async () => {
        assert.deepEqual([...(await nombresEmpleado(db, [7, 8]))], [[7, "Luis Mora"]]);
    });
    it("usuario inserta: número → nombre del empleado; texto → tal cual; vacío → null", () => {
        const n = new Map([[7, "Luis Mora"]]);
        assert.equal(usuarioInserta(7, n), "Luis Mora");
        assert.equal(usuarioInserta("7", n), "Luis Mora");
        assert.equal(usuarioInserta(99, n), null);
        assert.equal(usuarioInserta(" jperez@x.test ", n), "jperez@x.test");
        assert.equal(usuarioInserta(null, n), null);
        assert.equal(usuarioInserta("  ", n), null);
    });
    it("busca por bloques de 1000 sin repetir ids", async () => {
        const calls: number[] = [];
        const big: any = { t: { findMany: async (a: any) => { calls.push(a.where.id.in.length); return a.where.id.in.map((id: number) => ({ id })); } } };
        const out = await findByIds(big, "t", Array.from({ length: 2500 }, (_, i) => (i % 2000) + 1), {});
        assert.deepEqual(calls, [1000, 1000]);
        assert.equal(out.size, 2000);
    });
});
