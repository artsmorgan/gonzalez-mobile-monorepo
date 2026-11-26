import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { ON_DEMAND_TITLE, ON_DEMAND_TYPE, construirFrecuenciaCuandoAplica, esCuandoAplica, vigenteCuandoAplica } from "./frecuenciaCuandoAplica";
import * as movil from "../../mobile/hooks/frecuenciaCuandoAplica";
import { construirFrecuencia, parseFilaActividad, parseFrecuencia } from "./guardifyActions/actividades";

const server = path.resolve(__dirname, "..");
const mobile = path.resolve(server, "..", "mobile");
const leer = (base: string, rel: string) => fs.readFileSync(path.join(base, rel), "utf8").replace(/\r\n/g, "\n");
const d = (s: string) => new Date(`${s}T12:00:00`);

describe("Frecuencia «Cuando aplica» (#229)", () => {
    it("el tipo y el título son los mismos en la app y en el servidor", () => {
        assert.equal(movil.ON_DEMAND_TYPE, ON_DEMAND_TYPE);
        assert.equal(movil.ON_DEMAND_TITLE, ON_DEMAND_TITLE);
        assert.equal(ON_DEMAND_TYPE, "on-demand");
        assert.equal(ON_DEMAND_TITLE, "Cuando aplica");
    });

    it("se reconoce por el tipo del JSON guardado y tolera datos raros", () => {
        assert.equal(esCuandoAplica(construirFrecuenciaCuandoAplica()), true);
        assert.equal(esCuandoAplica('{"type":"on-demand","title":"Cuando aplica"}'), true);
        assert.equal(esCuandoAplica('{"type":"daily","interval":1}'), false);
        for (const v of [null, undefined, "", "no es json", "[]", "null", 5, {}]) assert.equal(esCuandoAplica(v), false, String(v));
        assert.equal(esCuandoAplica({ type: "on-demand" }), true);
    });

    it("el JSON trae título, sin fin y, si se pide, horarios", () => {
        assert.deepEqual(JSON.parse(construirFrecuenciaCuandoAplica()), { type: "on-demand", interval: 1, endType: "never", title: "Cuando aplica" });
        assert.deepEqual(JSON.parse(construirFrecuenciaCuandoAplica(["08:00"])).schedule, ["08:00"]);
    });

    it("está disponible desde la fecha de inicio y hasta la de fin (incluidas); sin fin no termina", () => {
        assert.equal(vigenteCuandoAplica(d("2026-11-25"), d("2026-11-24")), false, "antes del inicio");
        assert.equal(vigenteCuandoAplica(d("2026-11-25"), d("2026-11-25")), true, "el día de inicio");
        assert.equal(vigenteCuandoAplica(d("2026-11-25"), d("2030-01-01")), true, "sin fin");
        assert.equal(vigenteCuandoAplica(d("2026-11-25"), d("2026-12-01"), d("2026-12-01")), true, "el día de fin");
        assert.equal(vigenteCuandoAplica(d("2026-11-25"), d("2026-12-02"), d("2026-12-01")), false, "después del fin");
        assert.equal(vigenteCuandoAplica(new Date("x"), d("2026-11-25")), false);
    });

    it("la carga masiva de Guardify acepta «cuando aplica» y arma el mismo JSON", () => {
        for (const v of ["cuando aplica", "Cuando Aplica", "CUANDO  APLICA", "cuando_aplica", "a demanda", "on-demand"]) assert.equal(parseFrecuencia(v), "cuando aplica", v);
        const r = parseFilaActividad({ codigo_puesto: "P1", nombre_actividad: "Incidente", descripcion_actividad: "Cuando ocurra", fecha_inicio: "25-11-2026", frecuencia: "cuando aplica", tipos_turno: "D" });
        assert.equal(r.ok, true);
        if (!r.ok) return;
        const json = JSON.parse(construirFrecuencia(r.fila));
        assert.equal(json.type, "on-demand");
        assert.equal(json.title, "Cuando aplica");
        assert.equal(esCuandoAplica(JSON.stringify(json)), true);
    });

    it("el servidor: vigente → una fila abierta; fuera de vigencia → no se muestra ni queda pendiente; nunca «toca» por fecha", () => {
        const s = leer(server, "utils/createActivities.ts");
        assert.match(s, /const cuandoAplica = esCuandoAplica\(actividad\.frecuencia\);/);
        assert.match(s, /is_today = cuandoAplica\s*\?\s*vigenteCuandoAplica\(fechaInicio, fechaMarca, fechaFin\)\s*:\s*validateDates\(/);
        assert.match(s, /where: cuandoAplica\s*\?\s*\{ actividad_puesto_id: actividadPuesto\.id, plaza_id: marcaDia\.plaza_id, marcada: false \}/);
        assert.match(s, /\} else if \(cuandoAplica\) \{\s*\/\/[^\n]*\n\s*continue;/);
        assert.match(s, /case 'on-demand':[\s\S]*?result = false;/);
    });

    it("la app: opción en el selector, título sin el sufijo de fin y mismo tipo", () => {
        const a = leer(mobile, "screens/ActivitiesScreen.tsx");
        assert.match(a, /'weekdays' \| 'on-demand' \| 'custom'/);
        assert.match(a, /<Picker\.Item label=\{ON_DEMAND_TITLE\} value="on-demand"/);
        assert.match(a, /if \(type === 'on-demand'\) return ON_DEMAND_TITLE;/);
        assert.match(a, /import \{ ON_DEMAND_TITLE \} from '@\/hooks\/frecuenciaCuandoAplica';/);
    });

    it("la documentación de la carga masiva lo menciona", () => {
        const doc = leer(server, "docs/guardify-actions-api.md");
        assert.match(doc, /use diaria, semanal, laborables, mensual, anual, cuando aplica\./);
        assert.match(doc, /`cuando aplica`/);
    });
});
