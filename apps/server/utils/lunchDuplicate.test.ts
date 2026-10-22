import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { whereAlmuerzoDuplicado } from "./lunchDuplicate";

describe("almuerzo duplicado (issue #158)", () => {
    it("es el mismo almuerzo si coinciden empleado, marca, inicio y fin (fechas ISO, solo activos)", () => {
        const w = whereAlmuerzoDuplicado({ empleadoId: 3722, marcaId: 11344511, inicio: new Date("2026-10-22T12:12:00.000Z"), fin: new Date("2026-10-22T12:17:00.000Z") });
        assert.deepEqual(w, { empleadoId: 3722, marca_id: 11344511, inicio: "2026-10-22T12:12:00.000Z", fin: "2026-10-22T12:17:00.000Z", isActive: true });
    });
    it("dos almuerzos con otra hora de inicio o de fin no cuentan como duplicado", () => {
        const base = { empleadoId: 1, marcaId: 2, inicio: new Date("2026-10-22T12:00:00Z"), fin: new Date("2026-10-22T12:30:00Z") };
        const a = whereAlmuerzoDuplicado(base);
        assert.notDeepEqual(a, whereAlmuerzoDuplicado({ ...base, inicio: new Date("2026-10-22T12:01:00Z") }));
        assert.notDeepEqual(a, whereAlmuerzoDuplicado({ ...base, fin: new Date("2026-10-22T12:31:00Z") }));
        assert.notDeepEqual(a, whereAlmuerzoDuplicado({ ...base, marcaId: 3 }));
    });
});
