import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { ACTIVITIES_NEEDS_SHIFT_MESSAGE, hasActiveShift } from "../../mobile/hooks/turnoActivo";

const mobile = path.resolve(__dirname, "..", "..", "mobile");
const leer = (rel: string) => fs.readFileSync(path.join(mobile, rel), "utf8").replace(/\r\n/g, "\n");

describe("Actividades: solo con un turno activo se buscan las actividades", () => {
    it("activo = ingreso digitado y salida sin digitar", () => {
        assert.equal(hasActiveShift({ id: 1, hora_entrada_digitada: "2026-11-25T06:02:00.000Z", hora_salida_digitada: null }), true);
        assert.equal(hasActiveShift({ id: 1, hora_entrada_digitada: "2026-11-25T06:02:00.000Z" }), true, "sin la clave de salida = sin salida");
    });

    it("sin marca actual no hay turno activo", () => {
        for (const v of [null, undefined, "", 0, [], "texto"]) assert.equal(hasActiveShift(v), false, String(v));
    });

    it("sin ingreso digitado no está activo, aunque el turno ya esté programado (hora de inicio no es hora digitada)", () => {
        assert.equal(hasActiveShift({ id: 1, hora_inicio: "2026-11-25T06:00:00.000Z", hora_fin: "2026-11-25T14:00:00.000Z", hora_entrada_digitada: null, hora_salida_digitada: null }), false);
        assert.equal(hasActiveShift({ hora_entrada_digitada: "", hora_salida_digitada: null }), false);
        assert.equal(hasActiveShift({ hora_entrada_digitada: "  " }), false);
    });

    it("con la salida DIGITADA ya terminó; con la hora de fin programada solo, sigue activo", () => {
        assert.equal(hasActiveShift({ hora_entrada_digitada: "2026-11-25T06:02:00.000Z", hora_salida_digitada: "2026-11-25T14:01:00.000Z" }), false);
        assert.equal(hasActiveShift({ hora_entrada_digitada: "2026-11-25T06:02:00.000Z", hora_fin: "2026-11-25T14:00:00.000Z", hora_salida_digitada: null }), true, "la hora de fin programada no cuenta como salida digitada");
        assert.equal(hasActiveShift({ hora_entrada_digitada: "2026-11-25T06:02:00.000Z", hora_salida_digitada: "" }), true, "una salida vacía no es digitada");
    });

    it("el mensaje es el pedido", () => {
        assert.equal(ACTIVITIES_NEEDS_SHIFT_MESSAGE, "Debes tener un turno activo para ver tus actividades");
    });

    it("la misma regla del menú para «Entrega de puestos»", () => {
        const menu = leer("components/SlideMenu.tsx");
        assert.match(menu, /currentMarca\.hora_entrada_digitada != null && currentMarca\.hora_salida_digitada == null/);
    });

    it("la pantalla corta ANTES de buscar: ni servidor ni caché, y deja la lista vacía", () => {
        const s = leer("screens/ActivitiesScreen.tsx");
        const i = s.indexOf("const fetchActivities = async () => {");
        const cuerpo = s.slice(i, s.indexOf("/** Día de la semana en inglés", i));
        const corte = cuerpo.indexOf("if (!hasActiveShift(currentMarcaData)) {");
        assert.ok(corte > 0, "comprueba el turno activo");
        assert.ok(corte < cuerpo.indexOf("getConnectionStatus()"), "antes de consultar la conexión");
        assert.ok(corte < cuerpo.indexOf("/api/activities/marca/"), "antes de pedir las actividades al servidor");
        assert.ok(corte < cuerpo.indexOf("activities_cache"), "antes de leer el caché");
        assert.ok(corte < cuerpo.indexOf("loadInventorySourceFromPuesto"), "antes de cargar el inventario del puesto");
        assert.match(cuerpo, /if \(!hasActiveShift\(currentMarcaData\)\) \{\s*setHasCurrentMarca\(true\);\s*setHasActiveShiftNow\(false\);\s*setActivities\(\[\]\);\s*setOfflineMessage\(null\);\s*setIsLoading\(false\);\s*return;\s*\}/);
        // sin marca: tampoco se busca
        assert.match(cuerpo, /if \(!currentMarca\) \{\s*setHasCurrentMarca\(false\);\s*setHasActiveShiftNow\(false\);\s*setActivities\(\[\]\);/);
    });

    it("el mensaje sale tanto sin marca como con una marca sin turno activo", () => {
        const s = leer("screens/ActivitiesScreen.tsx");
        assert.match(s, /<ThemedText style=\{styles\.noMarcaMessage\}>\{ACTIVITIES_NEEDS_SHIFT_MESSAGE\}<\/ThemedText>/);
        assert.match(s, /\) : !hasActiveShiftNow \? \(\s*<ThemedView style=\{styles\.emptyContainer\}>\s*<ThemedText style=\{styles\.emptyText\}>\{ACTIVITIES_NEEDS_SHIFT_MESSAGE\}<\/ThemedText>/);
        assert.equal(s.includes("Debes registrar una marca de ingreso antes de acceder a las actividades."), false);
    });
});
