import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { asignadosDelManual, asignadosPorPuesto } from "./manualesAsignados";

const fakeDb = (plazas: { empleado_id: number | null; puesto_id: number }[], estados: Record<number, string | null>) => {
    const calls: any[] = [];
    return {
        calls,
        db: {
            c_empleado_plaza: { findMany: async (a: any) => { calls.push(a); return plazas.filter((p) => a.where.puesto_id.in.includes(p.puesto_id) && p.empleado_id !== null); } },
            c_empleado: { findMany: async (a: any) => a.where.id.in.filter((id: number) => id in estados).map((id: number) => ({ id, estado: estados[id] })) },
        } as any,
    };
};

describe("empleados asignados por puesto", () => {
    it("agrupa por puesto, sin repetir, y descarta a los dados de baja", async () => {
        const { db } = fakeDb(
            [{ empleado_id: 1, puesto_id: 10 }, { empleado_id: 1, puesto_id: 10 }, { empleado_id: 2, puesto_id: 10 }, { empleado_id: 3, puesto_id: 11 }, { empleado_id: 4, puesto_id: 11 }, { empleado_id: null, puesto_id: 11 }],
            { 1: "Activo", 2: "Inactivo", 3: "ACTIVO", 4: null },
        );
        const m = await asignadosPorPuesto(db, [10, 11, "10", 0, null]);
        assert.deepEqual(m.get(10), [1]);
        assert.deepEqual(m.get(11)?.sort(), [3, 4]);
    });
    it("pide los puestos de a 500 y no consulta si no hay puestos", async () => {
        const { db, calls } = fakeDb([], {});
        await asignadosPorPuesto(db, Array.from({ length: 1200 }, (_, i) => i + 1));
        assert.equal(calls.length, 3);
        const none = fakeDb([], {});
        await asignadosPorPuesto(none.db, []);
        assert.equal(none.calls.length, 0);
    });
    it("los empleados de un manual son los de su puesto y los vinculados, sin repetir", () => {
        const m = new Map([[10, [1, 2]], [11, [2, 3]], [12, [9]]]);
        assert.deepEqual(asignadosDelManual(m, 10, [11, 99]).sort(), [1, 2, 3]);
    });
});
