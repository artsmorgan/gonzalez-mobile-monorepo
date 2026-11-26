import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { hasHierarchy, hierarchyIdsAreEmpty, hierarchyIdsFromMarca, marcaHierarchySummary } from "../../mobile/hooks/hierarchyFallback";

const mobile = path.resolve(__dirname, "..", "..", "mobile");
const leer = (rel: string) => fs.readFileSync(path.join(mobile, rel), "utf8").replace(/\r\n/g, "\n");

const marca = {
    id: 11504545,
    empresa: { id: 10, nombre: "Corp" },
    cliente: { id: 54, nombre: "Cliente" },
    contrato: { id: 10, nombre: "Contrato" },
    corpo: { id: 187, nombre: "Sucursal Centro" },
    puesto: { id: 106, nombre: "Puesto Norte" },
    plaza: { id: 35, nombre: "Plaza 1" },
    roleDivision: { role: { nombre: "OPERATIVO" }, division: { id: 2, nombre: "Seguridad" } },
};

describe("jerarquía sin descargar: datos de la marca actual como respaldo", () => {
    it("saca de la marca los ids que se envían a los endpoints (la sucursal viaja como `corpo`)", () => {
        assert.deepEqual(hierarchyIdsFromMarca(marca), {
            empresaId: 10,
            clienteId: 54,
            divisionId: 2,
            contratoId: 10,
            sucursalId: 187,
            puestoId: 106,
            plazaId: 35,
        });
    });

    it("un dato que el servidor manda como «Indefinido» (id 0) o ausente queda en null, no en 0", () => {
        const ids = hierarchyIdsFromMarca({ ...marca, plaza: { id: 0, nombre: "Indefinido" }, roleDivision: undefined });
        assert.equal(ids?.plazaId, null);
        assert.equal(ids?.divisionId, null);
        assert.equal(ids?.puestoId, 106);
    });

    it("sin marca, o con una marca sin puesto ni sucursal, no hay respaldo", () => {
        assert.equal(hierarchyIdsFromMarca(null), null);
        assert.equal(hierarchyIdsFromMarca("x"), null);
        assert.equal(hierarchyIdsFromMarca({ empresa: { id: 1 }, puesto: { id: 0 }, corpo: { id: 0 } }), null);
    });

    it("solo se usa cuando el formulario no tiene nada elegido: al editar un registro no se pisa", () => {
        assert.equal(hierarchyIdsAreEmpty(null), true);
        assert.equal(hierarchyIdsAreEmpty({ empresaId: null, clienteId: null, divisionId: 0, contratoId: "", sucursalId: undefined, puestoId: null }), true);
        assert.equal(hierarchyIdsAreEmpty({ empresaId: null, clienteId: null, puestoId: 12 }), false);
        assert.equal(hierarchyIdsAreEmpty({ sucursalId: 5 }), false);
    });

    it("el aviso dice qué datos se usan", () => {
        assert.equal(marcaHierarchySummary(marca), "Puesto Puesto Norte · Sucursal Sucursal Centro");
        assert.equal(marcaHierarchySummary({ ...marca, puesto: { id: 0, nombre: "Indefinido" } }), "Sucursal Sucursal Centro");
        assert.equal(marcaHierarchySummary(null), "");
    });

    it("hay jerarquía cuando la estructura trae al menos una empresa", () => {
        assert.equal(hasHierarchy([{ id: 1 }]), true);
        assert.equal(hasHierarchy([]), false);
        assert.equal(hasHierarchy(null), false);
    });
});

describe("jerarquía sin descargar: la interfaz", () => {
    it("el estado vacío ofrece ir al módulo Jerarquía pidiendo confirmación", () => {
        const c = leer("components/HierarchyEmptyState.tsx");
        assert.match(c, /Alert\.alert\(HIERARCHY_GO_TITLE, HIERARCHY_GO_QUESTION, \[\s*\{ text: 'Cancelar', style: 'cancel' \},\s*\{ text: 'Ir a Jerarquía', onPress: \(\) => navigation\.navigate\('Jerarquia'\) \},/);
        assert.match(c, /Descargar jerarquía|HIERARCHY_GO_TITLE/);
    });

    it("antes de decir nada confirma que de verdad no hay jerarquía descargada (la lista también está vacía mientras carga)", () => {
        const c = leer("components/HierarchyEmptyState.tsx");
        assert.match(c, /await loadMainStructureTreeMerged\(\)/);
        assert.match(c, /if \(hasHierarchy\(tree\)\) \{\s*setMissing\(false\);\s*return;/);
    });

    it("el respaldo con la marca solo se activa en formularios que envían datos, una vez, sin pisar lo elegido y avisando", () => {
        const c = leer("components/HierarchyEmptyState.tsx");
        assert.match(c, /!applied\.current && onUseRef\.current && ids && emptyNow/);
        assert.match(c, /HIERARCHY_FALLBACK_NOTICE/);
        const p = leer("components/HierarchyPickerFields.tsx");
        assert.match(p, /!isLoading && !disabled && empresas\.length === 0/);
        assert.match(p, /onUseMarca=\{marcaFallback \? onChange : undefined\}/);
        assert.match(p, /marcaFallback = false,/, "por defecto no se usa (los filtros no lo activan)");
    });

    it("en las pantallas: los formularios lo activan y los filtros nunca", () => {
        const dir = path.join(mobile, "screens");
        let conFallback = 0;
        let sitiosVacios = 0;
        for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".tsx"))) {
            const s = leer(`screens/${f}`);
            // ningún selector de filtro ni su estado vacío llevan el respaldo
            assert.equal(/<HierarchyEmptyState onUseMarca=\{handle\w*Filter\w*\}/.test(s), false, `${f}: el estado vacío de un filtro usa la marca`);
            for (const m of s.matchAll(/<HierarchyPickerFields([\s\S]{0,4000}?)onChange=\{(\w+)\}/g)) {
                if (/Filter/.test(m[2]!) && /^\s*marcaFallback\b/.test(m[1]!)) assert.fail(`${f}: el filtro ${m[2]} usa el respaldo con la marca`);
            }
            conFallback += (s.match(/<HierarchyEmptyState onUseMarca=/g) ?? []).length;
            sitiosVacios += (s.match(/<HierarchyEmptyState/g) ?? []).length;
            assert.equal(/Sin estructura en caché\.?\s*(Sincronice la app\.)?<\/ThemedText>/.test(s), false, `${f}: quedó el texto antiguo sin botón`);
        }
        assert.ok(conFallback >= 5, `formularios con respaldo: ${conFallback}`);
        assert.ok(sitiosVacios >= 20, `sitios con estado vacío: ${sitiosVacios}`);
    });

    it("la visibilidad de los selectores no cambia: el estado vacío ocupa el mismo lugar del texto que reemplazó", () => {
        const s = leer("screens/NotesScreen.tsx");
        assert.match(s, /\{mainStructure\.length === 0 \? \(\s*<HierarchyEmptyState onUseMarca=\{handleFormHierarchyChange\}/);
        assert.match(s, /\) : \(\s*<HierarchyPickerFields/);
    });
});
