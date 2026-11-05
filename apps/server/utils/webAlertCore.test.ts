import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { alertText, dismissAction, normalizeAlertButtons } from "../../mobile/utils/webAlertCore";

const mobile = path.resolve(__dirname, "..", "..", "mobile");

describe("Alert.alert en la versión web (lógica pura)", () => {
    it("sin botones muestra un «OK»", () => {
        for (const entrada of [undefined, null, []]) {
            const acciones = normalizeAlertButtons(entrada as never);
            assert.deepEqual(acciones.map((a) => a.label), ["OK"]);
            assert.doesNotThrow(() => acciones[0].run());
        }
    });

    it("conserva texto, estilo y llama al onPress del botón elegido (y solo a ese)", () => {
        const llamadas: string[] = [];
        const acciones = normalizeAlertButtons([
            { text: "Cancelar", style: "cancel", onPress: () => llamadas.push("cancelar") },
            { text: "Cerrar Sesión", style: "destructive", onPress: () => llamadas.push("cerrar") },
        ]);
        assert.deepEqual(acciones.map((a) => [a.label, a.style]), [["Cancelar", "cancel"], ["Cerrar Sesión", "destructive"]]);
        acciones[1].run();
        assert.deepEqual(llamadas, ["cerrar"]);
    });

    it("un botón sin texto o con estilo desconocido toma valores por defecto", () => {
        const [a] = normalizeAlertButtons([{ style: "raro" as never }]);
        assert.equal(a.label, "OK");
        assert.equal(a.style, "default");
    });

    it("un manejador que lanza no rompe la alerta", () => {
        const [a] = normalizeAlertButtons([{ text: "X", onPress: () => { throw new Error("falla"); } }]);
        assert.doesNotThrow(() => a.run());
    });

    it("cerrar sin elegir ejecuta el botón «cancelar» si existe", () => {
        const acciones = normalizeAlertButtons([{ text: "Sí" }, { text: "No", style: "cancel" }]);
        assert.equal(dismissAction(acciones)?.label, "No");
        assert.equal(dismissAction(normalizeAlertButtons([{ text: "OK" }])), null);
    });

    it("el texto une título y mensaje sin vacíos", () => {
        assert.equal(alertText("Título", "Mensaje"), "Título\n\nMensaje");
        assert.equal(alertText("Título", ""), "Título");
        assert.equal(alertText(null, "Mensaje"), "Mensaje");
    });

    it("se instala al arrancar la app, solo en web", () => {
        // La app arranca desde index.js (registerRootComponent(App)); app/_layout.tsx no es el punto de entrada.
        const entrada = fs.readFileSync(path.join(mobile, "index.js"), "utf8");
        assert.match(entrada, /installWebAlert\(\);\s*registerRootComponent\(App\);/);
        const instalador = fs.readFileSync(path.join(mobile, "utils/installWebAlert.ts"), "utf8");
        assert.match(instalador, /Platform\.OS !== 'web'/);
    });
});
