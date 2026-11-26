import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { conflictBody, extractPlanillasConflict } from "./planillasConflict";

const server = path.resolve(__dirname, "..");
const mobile = path.resolve(__dirname, "..", "..", "mobile");
const leer = (base: string, rel: string) => fs.readFileSync(path.join(base, rel), "utf8").replace(/\r\n/g, "\n");

/** Respuesta real de Planillas (la que reportó el cliente). */
const CUERPO_PLANILLAS = '{"success":false,"error":{"code":"MARCA_NO_MARCABLE","message":"La marca corresponde a un d\\u00eda libre o no tiene un turno asignado; no es posible marcarla.","details":[]}}';
const MENSAJE = "La marca corresponde a un día libre o no tiene un turno asignado; no es posible marcarla.";

const errorAxios = (status: number, data: unknown) => Object.assign(new Error("Request failed with status code " + status), { response: { status, data } });

describe("conflicto 409 de Planillas al marcar entrada o salida", () => {
    it("devuelve el message de Planillas tal cual (cuerpo ya parseado o como texto JSON)", () => {
        const c1 = extractPlanillasConflict(errorAxios(409, JSON.parse(CUERPO_PLANILLAS)));
        assert.deepEqual(c1, { message: MENSAJE, code: "MARCA_NO_MARCABLE" });
        const c2 = extractPlanillasConflict(errorAxios(409, CUERPO_PLANILLAS));
        assert.deepEqual(c2, { message: MENSAJE, code: "MARCA_NO_MARCABLE" });
    });

    it("sin mensaje legible usa un texto genérico, no un cuerpo vacío; con un texto plano lo usa", () => {
        assert.match(extractPlanillasConflict(errorAxios(409, undefined))!.message, /no permite marcar/i);
        assert.match(extractPlanillasConflict(errorAxios(409, { success: false }))!.message, /no permite marcar/i);
        assert.equal(extractPlanillasConflict(errorAxios(409, "Marca no marcable"))!.message, "Marca no marcable");
        assert.equal(extractPlanillasConflict(errorAxios(409, { message: "suelto" }))!.message, "suelto");
    });

    it("solo reconoce el 409: otros errores (500, 404, red, valores raros) siguen su camino", () => {
        for (const e of [errorAxios(500, {}), errorAxios(404, {}), errorAxios(400, {}), new Error("boom"), null, undefined, "x", {}]) {
            assert.equal(extractPlanillasConflict(e), null);
        }
    });

    it("el cuerpo de la respuesta conserva el message y marca el conflicto", () => {
        assert.deepEqual(conflictBody({ message: MENSAJE, code: "MARCA_NO_MARCABLE" }), { status: false, message: MENSAJE, code: "MARCA_NO_MARCABLE", planillas_conflict: true });
        assert.deepEqual(conflictBody({ message: "x", code: null }), { status: false, message: "x", planillas_conflict: true });
    });

    it("la ruta atiende el 409 en la entrada y en la salida y responde HTTP 409 con el message (no un 500)", () => {
        const ruta = leer(server, "app/api/attendance/[id]/route.ts");
        assert.equal((ruta.match(/extractPlanillasConflict\(planillasError\)/g) ?? []).length, 2, "entrada y salida");
        assert.match(ruta, /return NextResponse\.json\(conflictBody\(conflict\), \{ status: 409 \}\);/);
        assert.match(ruta, /"conflict" in response && response\.conflict\) return NextResponse\.json\(conflictBody\(response\.conflict\), \{ status: 409 \}\)/);
        // la excepción que no es 409 se vuelve a lanzar: sigue el comportamiento de siempre
        assert.equal((ruta.match(/if \(!conflict\) throw planillasError;/g) ?? []).length, 2);
    });

    it("la app muestra ese message cuando la ruta responde 409", () => {
        const guardar = leer(mobile, "hooks/saveMarca.ts");
        assert.match(guardar, /response\.status === 409/);
        assert.match(guardar, /return \{ status: false, message, planillas_conflict: true \}/);
        // la pantalla ya muestra data.message en una alerta cuando la marca falla
        assert.match(leer(mobile, "screens/MarcarIngresoSalidaScreen.tsx"), /Alert\.alert\(\s*'Error',\s*data\.message\s*\)/);
    });
});

describe("las marcas sin tipo_turno u hora válida se muestran con normalidad", () => {
    it("ya no existe la validación de «turno sin datos» ni el mensaje que la acompañaba", () => {
        const todo = [leer(server, "app/api/attendance/user/[id]/route.ts"), leer(server, "utils/nextShift.ts"), leer(mobile, "screens/MarcarIngresoSalidaScreen.tsx")].join("\n");
        assert.equal(/turnoSinDatos|turno_sin_datos|TURNO_SIN_DATOS|Imposible marcar entrada/.test(todo), false);
    });

    it("la salida ya no exige hora de inicio y fin de la marca", () => {
        const ruta = leer(server, "app/api/attendance/[id]/route.ts");
        assert.equal(ruta.includes("No se encontró la hora de inicio o fin"), false);
        assert.match(ruta, /if \(!marcaDia\.hora_inicio \|\| !marcaDia\.hora_fin\) \{\s*hora_salida_real = null;/);
    });
});

describe("la app tolera marcas sin hora de inicio o de fin", () => {
    it("usa el inicio a las 00:00 y el fin a las 23:59:59 del día de la marca cuando faltan, como el servidor", () => {
        const pantalla = leer(mobile, "screens/MarcarIngresoSalidaScreen.tsx");
        assert.match(pantalla, /buildMarcaNaiveMs\(marca\.fecha, marca\.hora_inicio\) \?\? buildMarcaNaiveMs\(marca\.fecha, '1970-01-01T00:00:00\.000Z'\)/);
        assert.match(pantalla, /buildMarcaNaiveMs\(marca\.fecha, marca\.hora_fin, crossesMidnight \? 1 : 0\) \?\? buildMarcaNaiveMs\(marca\.fecha, '1970-01-01T23:59:59\.000Z'\)/);
    });
});
