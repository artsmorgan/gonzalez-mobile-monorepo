/**
 * Ejecuta todas las pruebas del servidor (`*.test.ts` bajo `utils/`) con el ejecutor de Node y tsx.
 *
 *   npm test                      → todas
 *   npm test -- utils/buscarRegistro.test.ts   → solo esas (los argumentos reemplazan la búsqueda)
 *
 * Se arma la lista de archivos aquí en lugar de pasar un patrón a `node --test`: los patrones con `**` solo los entiende Node 21 o superior
 * y la shell de Linux no expande `**` sin opciones; así funciona igual en Windows, en Linux y en el CI.
 */
import { readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

function collect(dir) {
    const found = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules") continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) found.push(...collect(full));
        else if (entry.name.endsWith(".test.ts")) found.push(relative(root, full));
    }
    return found.sort();
}

const requested = process.argv.slice(2);
const files = requested.length > 0 ? requested : collect(join(root, "utils"));
if (files.length === 0) {
    console.error("No se encontraron pruebas (*.test.ts) en utils/.");
    process.exit(1);
}

const result = spawnSync(process.execPath, ["--import", "tsx", "--test", ...files], { cwd: root, stdio: "inherit" });
process.exit(result.status ?? 1);
