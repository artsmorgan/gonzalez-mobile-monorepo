import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildMarcaCandidata, puedeCerrarseAutomaticamente, resolverConflictoDeMarcas, type MarcaCandidata } from "./resolveMarcaConflicto";

const m = (id: number, fecha: string, ini: string, fin: string, reemplaza: number | null = null): MarcaCandidata =>
    buildMarcaCandidata({ id, fecha, horaInicio: ini, horaFin: fin, empleadoReemplazaId: reemplaza });

const EMPLEADO = 3730;

describe("prioridad entre marcas en conflicto de horario", () => {
    it("caso real: la propia (07:00-16:00) choca con la que reemplaza al fijo (05:30-17:30) → gana la de reemplazo", () => {
        const propia = m(11319911, "2026-10-15", "07:00", "16:00", null);
        const reemplazo = m(11322388, "2026-10-15", "05:30", "17:30", EMPLEADO);
        assert.equal(resolverConflictoDeMarcas(propia.id, [propia, reemplazo], EMPLEADO), reemplazo.id);
        assert.equal(resolverConflictoDeMarcas(reemplazo.id, [propia, reemplazo], EMPLEADO), reemplazo.id);
    });

    it("gana la de reemplazo aunque empiece más tarde que la propia", () => {
        const propia = m(1, "2026-10-15", "07:00", "16:00");
        const reemplazo = m(2, "2026-10-15", "10:00", "18:00", EMPLEADO);
        assert.equal(resolverConflictoDeMarcas(1, [propia, reemplazo], EMPLEADO), 2);
    });

    it("sin reemplazo del empleado consultado: gana la que empieza primero", () => {
        const a = m(5, "2026-10-15", "08:00", "16:00");
        const b = m(9, "2026-10-15", "06:00", "14:00");
        assert.equal(resolverConflictoDeMarcas(5, [a, b], EMPLEADO), 9);
    });

    it("un reemplazo de OTRO empleado no cuenta como prioridad", () => {
        const a = m(5, "2026-10-15", "08:00", "16:00");
        const b = m(9, "2026-10-15", "10:00", "18:00", 999);
        assert.equal(resolverConflictoDeMarcas(9, [a, b], EMPLEADO), 5);
    });

    it("mismo inicio: gana el id menor", () => {
        const a = m(20, "2026-10-15", "07:00", "15:00");
        const b = m(12, "2026-10-15", "07:00", "17:00");
        assert.equal(resolverConflictoDeMarcas(20, [a, b], EMPLEADO), 12);
    });

    it("varios reemplazos del empleado: gana el de «fecha + inicio» primero y, a igual inicio, el id menor", () => {
        const a = m(30, "2026-10-15", "09:00", "17:00", EMPLEADO);
        const b = m(31, "2026-10-15", "06:00", "14:00", EMPLEADO);
        const c = m(29, "2026-10-15", "06:00", "13:00", EMPLEADO);
        const propia = m(1, "2026-10-15", "05:00", "18:00");
        assert.equal(resolverConflictoDeMarcas(1, [a, b, c, propia], EMPLEADO), 29);
    });

    it("sin conflicto (turnos seguidos o en otro día) se conserva la marca elegida", () => {
        const manana = m(1, "2026-10-15", "06:00", "14:00");
        const tarde = m(2, "2026-10-15", "14:00", "22:00", EMPLEADO); // toca el borde: no es traslape
        const otroDia = m(3, "2026-10-16", "06:00", "14:00", EMPLEADO);
        assert.equal(resolverConflictoDeMarcas(1, [manana, tarde, otroDia], EMPLEADO), 1);
        assert.equal(resolverConflictoDeMarcas(2, [manana, tarde, otroDia], EMPLEADO), 2);
    });

    it("turno nocturno que cruza la medianoche choca con uno del día siguiente", () => {
        const noche = m(1, "2026-10-15", "22:00", "06:00");
        const madrugada = m(2, "2026-10-16", "04:00", "12:00", EMPLEADO);
        assert.equal(resolverConflictoDeMarcas(1, [noche, madrugada], EMPLEADO), 2);
    });

    it("el conflicto se propaga en cadena", () => {
        const a = m(1, "2026-10-15", "06:00", "12:00");
        const b = m(2, "2026-10-15", "11:00", "18:00");
        const c = m(3, "2026-10-15", "17:00", "23:00", EMPLEADO); // no toca a «a», pero sí a «b»
        assert.equal(resolverConflictoDeMarcas(1, [a, b, c], EMPLEADO), 3);
    });

    it("acepta fecha/hora como Date de la base de datos", () => {
        const c = buildMarcaCandidata({
            id: 7,
            fecha: new Date("2026-10-15T00:00:00.000Z"),
            horaInicio: new Date("1970-01-01T07:30:00.000Z"),
            horaFin: new Date("1970-01-01T16:00:00.000Z"),
            empleadoReemplazaId: "3730",
        });
        assert.equal(c.inicio.toISOString(), "2026-10-15T07:30:00.000Z");
        assert.equal(c.empleadoReemplazaId, 3730);
    });
});

describe("cierre automático del turno anterior (issue #160)", () => {
    it("un turno anterior terminado se puede cerrar", () => {
        const noche = m(1, "2026-10-14", "22:00", "06:00");
        const dia = m(2, "2026-10-15", "07:00", "16:00");
        assert.equal(puedeCerrarseAutomaticamente(noche, dia), true);
    });
    it("el caso real: la marca propia y la del reemplazo se traslapan → no se cierran entre sí", () => {
        const propia = m(11319911, "2026-10-15", "07:00", "16:00");
        const reemplazo = m(11322388, "2026-10-15", "05:30", "17:30", EMPLEADO);
        // el reemplazo empezó antes (es la «anterior»), pero es el mismo turno físico
        assert.equal(puedeCerrarseAutomaticamente(reemplazo, propia), false);
    });
    it("turnos seguidos (uno termina cuando empieza el otro) no se consideran traslape", () => {
        assert.equal(puedeCerrarseAutomaticamente(m(1, "2026-10-15", "06:00", "14:00"), m(2, "2026-10-15", "14:00", "22:00")), true);
    });
    it("un turno nocturno que cruza la medianoche choca con el del día siguiente que empieza antes de que termine", () => {
        assert.equal(puedeCerrarseAutomaticamente(m(1, "2026-10-15", "22:00", "06:00"), m(2, "2026-10-16", "05:30", "17:30")), false);
    });
});
