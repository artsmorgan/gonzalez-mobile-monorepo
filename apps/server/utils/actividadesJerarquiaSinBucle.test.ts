import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const mobile = path.resolve(__dirname, "..", "..", "mobile");
const leer = (rel: string) => fs.readFileSync(path.join(mobile, rel), "utf8").replace(/\r\n/g, "\n");

describe("Actividades: sin jerarquía descargada no se recarga sin fin", () => {
    const s = leer("screens/ActivitiesScreen.tsx");

    it("cargar una jerarquía vacía no cambia `structure` si ya estaba vacía (antes cada carga guardaba un arreglo nuevo)", () => {
        assert.match(s, /setStructure\(\(prev\) => \(prev\.length === 0 && empresas\.length === 0 \? prev : \(empresas as MainStructureTree\)\)\);/);
        assert.match(s, /setStructure\(\(prev\) => \(prev\.length === 0 \? prev : \[\]\)\);/);
        assert.equal(/setStructure\(\[\]\);/.test(s), false, "ninguna carga vuelve a guardar un arreglo vacío nuevo");
        assert.equal(/setStructure\(empresas as MainStructureTree\);/.test(s.replace(/\/\/.*$/gm, "")), false);
    });

    it("el precargado del formulario de búsqueda no depende de `structure`: lee la referencia, así su efecto corre una vez por cambio de paso", () => {
        const i = s.indexOf("const preloadCreatedHierarchyFiltersFromMarca = useCallback(");
        const fin = s.indexOf("const loadPuestosCatalog", i);
        const bloque = s.slice(i, fin);
        assert.match(bloque, /: structureRef\.current;/);
        assert.match(bloque, /\}, \[loadMainStructureCache\]\);/);
        assert.equal(/\[structure, loadMainStructureCache\]/.test(bloque), false);
        assert.match(s, /useEffect\(\(\) => \{\s*if \(moduleStep !== 'created'\) return;\s*preloadCreatedHierarchyFiltersFromMarca\(\);\s*\}, \[moduleStep, preloadCreatedHierarchyFiltersFromMarca\]\);/);
    });

    it("`loadMainStructureCache` es estable (sin dependencias que cambien) y el formulario de búsqueda muestra el estado vacío con su botón", () => {
        assert.match(s, /const loadMainStructureCache = useCallback\(async \(\): Promise<MainStructureTree> => \{[\s\S]*?\}, \[\]\);/);
        const p = leer("components/HierarchyPickerFields.tsx");
        assert.match(p, /!isLoading && !disabled && empresas\.length === 0/);
    });
});
