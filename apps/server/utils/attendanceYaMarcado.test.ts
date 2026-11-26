import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = path.resolve(__dirname, "..", "..", "..");
const leer = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");
const rutaPut = leer("apps/server/app/api/attendance/[id]/route.ts");

/** Texto de un `case` del `switch (type)` de la ruta PUT, hasta el siguiente `case` o el cierre del switch. */
function bloque(caso: "entrada" | "salida"): string {
    const ini = rutaPut.indexOf(`case "${caso}":`);
    assert.ok(ini >= 0, `no se encontró case "${caso}"`);
    const fin = rutaPut.indexOf("\n            case ", ini + 10);
    return rutaPut.slice(ini, fin > ini ? fin : ini + 2500);
}

describe("marcar otra vez una entrada o salida ya registrada", () => {
    it("la salida repetida responde 400 (como la entrada), no 500", () => {
        const b = bloque("salida");
        const rama = b.slice(b.indexOf("hora_salida_digitada != null"), b.indexOf("marcar_salida("));
        assert.match(rama, /Ya has marcado la salida/);
        assert.doesNotMatch(rama, /status: 500/, "un error del cliente (marca repetida) no es un 500");
        assert.match(rama, /status: 400/);
        assert.match(rama, /reportError\(req, "api\/attendance\/\[id\]", "PUT", 400,/, "el registro de errores guarda el mismo código HTTP que la respuesta");
    });

    it("la salida repetida sigue avisando already_synced y la marca (el cliente decide si desencola)", () => {
        const b = bloque("salida");
        assert.match(b, /already_synced: true/);
        assert.match(b, /marca_id: marcaDia\.id/);
    });

    it("la entrada repetida conserva su 400", () => {
        const b = bloque("entrada");
        assert.match(b, /Ya has marcado la entrada[\s\S]{0,200}status: 400/);
    });
});

describe("la app no imprime tokens en la consola", () => {
    function archivos(dir: string, acc: string[] = []): string[] {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            if (["node_modules", "android", ".expo", "vendor"].includes(e.name)) continue;
            const p = path.join(dir, e.name);
            if (e.isDirectory()) archivos(p, acc);
            else if (/\.(ts|tsx|js)$/.test(e.name)) acc.push(p);
        }
        return acc;
    }

    it("ningún console.* recibe el token de Planillas ni los de sesión", () => {
        const mobile = path.join(root, "apps", "mobile");
        const sensibles = /console\.(log|info|debug|warn|error)\([^;\n]*\b(planillasToken|planillas_token|accessToken|access_token|refreshToken|refresh_token|authToken)\b/;
        const encontrados: string[] = [];
        for (const f of archivos(mobile)) {
            fs.readFileSync(f, "utf8").split(/\r?\n/).forEach((linea, i) => {
                const sinComentario = linea.replace(/\/\/.*$/, "");
                if (sensibles.test(sinComentario)) encontrados.push(`${path.relative(root, f)}:${i + 1}`);
            });
        }
        assert.deepEqual(encontrados, [], `imprimen un token: ${encontrados.join(", ")}`);
    });
});
