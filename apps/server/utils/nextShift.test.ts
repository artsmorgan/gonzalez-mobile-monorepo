import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { isWorkShift, MENSAJE_TURNO_SIN_DATOS, pickNextShift, turnoSinDatos } from "./nextShift";

const marca = (id: number, fecha: string, hora: string, tipo: string | null) => ({
    id,
    fecha: new Date(`${fecha}T00:00:00.000Z`),
    hora_inicio: new Date(`1970-01-01T${hora}.000Z`),
    tipo_turno: tipo,
});

const ahora = (iso: string) => new Date(`${iso}.000Z`).getTime();

describe("siguiente turno laboral", () => {
    it("un turno libre (L) o sin tipo no es un turno laboral", () => {
        assert.equal(isWorkShift("L"), false);
        assert.equal(isWorkShift(" l "), false);
        assert.equal(isWorkShift(null), false);
        assert.equal(isWorkShift(""), false);
        for (const t of ["D", "N", "M"]) assert.equal(isWorkShift(t), true);
    });

    it("salta los días libres y toma el primer turno laboral posterior", () => {
        const marcas = [marca(1, "2026-11-03", "06:00:00", "L"), marca(2, "2026-11-04", "06:00:00", "L"), marca(3, "2026-11-05", "14:00:00", "D")];
        assert.equal(pickNextShift(marcas, ahora("2026-11-03T05:00:00"), 15)?.id, 3);
    });

    it("la entrada ya descontados los minutos previos debe ser posterior al momento de la consulta", () => {
        const m = [marca(10, "2026-11-03", "06:00:00", "D")];
        // 05:44 + 15 min = 05:59 < 06:00: la entrada (05:45) aún no llega, es el siguiente turno.
        assert.equal(pickNextShift(m, ahora("2026-11-03T05:44:00"), 15)?.id, 10);
        // 05:45 en punto: la entrada (05:45) NO es posterior, ya es la marca actual.
        assert.equal(pickNextShift(m, ahora("2026-11-03T05:45:00"), 15), null);
        assert.equal(pickNextShift(m, ahora("2026-11-03T05:50:00"), 15), null);
    });

    it("elige el de inicio más temprano y, a igual inicio, el de menor id", () => {
        const marcas = [marca(9, "2026-11-04", "08:00:00", "D"), marca(7, "2026-11-04", "08:00:00", "N"), marca(8, "2026-11-04", "06:00:00", "M")];
        assert.equal(pickNextShift(marcas, ahora("2026-11-03T12:00:00"), 0)?.id, 8);
        assert.equal(pickNextShift(marcas.filter((m) => m.id !== 8), ahora("2026-11-03T12:00:00"), 0)?.id, 7);
    });

    it("sin turnos laborales posteriores devuelve null", () => {
        assert.equal(pickNextShift([], ahora("2026-11-03T12:00:00"), 15), null);
        assert.equal(pickNextShift([marca(1, "2026-11-03", "06:00:00", "D")], ahora("2026-11-03T12:00:00"), 15), null);
        assert.equal(pickNextShift([marca(1, "2026-11-04", "06:00:00", "L")], ahora("2026-11-03T12:00:00"), 15), null);
    });

    it("minutos previos inválidos se toman como cero", () => {
        const m = [marca(1, "2026-11-03", "06:00:00", "D")];
        for (const v of [Number.NaN, -10, undefined as unknown as number]) assert.equal(pickNextShift(m, ahora("2026-11-03T05:59:00"), v)?.id, 1);
    });
});

describe("turno sin datos (hora_inicio y tipo_turno nulos)", () => {
    it("solo se considera sin datos cuando faltan ambos", () => {
        assert.equal(turnoSinDatos(null, null), true);
        assert.equal(turnoSinDatos(undefined, ""), true);
        assert.equal(turnoSinDatos(null, "  "), true);
        assert.equal(turnoSinDatos(null, "D"), false);
        assert.equal(turnoSinDatos(null, "L"), false);
        assert.equal(turnoSinDatos(new Date("1970-01-01T06:00:00.000Z"), null), false);
        assert.equal(turnoSinDatos(new Date("1970-01-01T00:00:00.000Z"), null), false, "medianoche real no es nula");
    });

    it("el mensaje es el indicado", () => {
        assert.equal(MENSAJE_TURNO_SIN_DATOS, "Imposible marcar entrada, contacta a tu administrador o supervisor para que revise el caso correspondiente");
    });

    it("la ruta evalúa la condición antes de normalizar la hora nula y responde con el mensaje", () => {
        const src = fs.readFileSync(path.resolve(__dirname, "..", "app", "api", "attendance", "user", "[id]", "route.ts"), "utf8").replace(/\r\n/g, "\n");
        const a = src.indexOf("turnoSinDatos(marca.hora_inicio");
        const b = src.indexOf('marca.hora_inicio = new Date("1970-01-01 00:00:00")');
        assert.ok(a > 0 && b > a, "bandera antes de normalizar");
        assert.match(src, /__turnoSinDatos === true[\s\S]*?turno_sin_datos: true[\s\S]*?message: MENSAJE_TURNO_SIN_DATOS/);
        const app = fs.readFileSync(path.resolve(__dirname, "..", "..", "mobile", "screens", "MarcarIngresoSalidaScreen.tsx"), "utf8");
        assert.match(app, /no_active_marca \|\| \(data as AttendanceErrorResponse\)\?\.turno_sin_datos/);
    });
});
