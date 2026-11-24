import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { createOwnerStore, ownerStoreFor } from "../../mobile/hooks/hierarchyEmptyOwner";

const mobile = path.resolve(__dirname, "..", "..", "mobile");
const leer = (rel: string) => fs.readFileSync(path.join(mobile, rel), "utf8").replace(/\r\n/g, "\n");

describe("botón «Descargar jerarquía»: uno por lugar", () => {
    it("sin selectores sin jerarquía no hay dueño; con uno, es el dueño", () => {
        const s = createOwnerStore();
        assert.equal(s.getOwner(), null);
        s.register("a");
        assert.equal(s.getOwner(), "a");
    });

    it("dentro de un mismo lugar el botón lo muestra solo el último selector que se montó", () => {
        const s = createOwnerStore();
        s.register("formulario-1");
        s.register("formulario-2");
        assert.equal(s.getOwner(), "formulario-2");
        assert.equal(["formulario-1", "formulario-2"].filter((id) => id === s.getOwner()).length, 1);
    });

    it("al cerrarse el último, el botón pasa al anterior; al quedar ninguno, desaparece", () => {
        const s = createOwnerStore();
        const quitarA = s.register("a");
        const quitarB = s.register("b");
        quitarB();
        assert.equal(s.getOwner(), "a");
        quitarA();
        assert.equal(s.getOwner(), null);
        assert.equal(s.size(), 0);
    });

    it("quitar un selector que no es el último no cambia al dueño, y quitar dos veces no hace daño", () => {
        const s = createOwnerStore();
        const quitarA = s.register("a");
        s.register("b");
        quitarA();
        quitarA();
        assert.equal(s.getOwner(), "b");
        assert.equal(s.size(), 1);
    });

    it("avisa a quien escucha cuando cambia el dueño", () => {
        const s = createOwnerStore();
        let avisos = 0;
        const baja = s.subscribe(() => avisos++);
        const quitar = s.register("a");
        quitar();
        assert.equal(avisos, 2);
        baja();
        s.register("b");
        assert.equal(avisos, 2, "dado de baja, ya no avisa");
    });

    it("el filtro y el formulario tienen cada uno su botón: ni se repiten ni se estorban", () => {
        const filtro = ownerStoreFor("filtro");
        const formulario = ownerStoreFor("formulario");
        assert.notEqual(filtro, formulario);
        const quitarFiltro = filtro.register("filtro-1");
        const quitarForm = formulario.register("form-1");
        // uno en cada lugar
        assert.equal(filtro.getOwner(), "filtro-1");
        assert.equal(formulario.getOwner(), "form-1");
        // un segundo selector en el formulario (p. ej. su ventana de edición) no agrega otro botón, y el del filtro sigue
        const quitarEdicion = formulario.register("form-edicion");
        assert.equal(formulario.getOwner(), "form-edicion");
        assert.equal(filtro.getOwner(), "filtro-1");
        quitarEdicion();
        quitarForm();
        assert.equal(formulario.getOwner(), null);
        assert.equal(filtro.getOwner(), "filtro-1", "cerrar el formulario no quita el botón del filtro");
        quitarFiltro();
        assert.equal(filtro.getOwner(), null);
    });

    it("un lugar desconocido o sin indicar cuenta como formulario", () => {
        assert.equal(ownerStoreFor(undefined), ownerStoreFor("formulario"));
    });
});

describe("botón «Descargar jerarquía»: en los componentes y las pantallas", () => {
    it("el componente solo dibuja el botón si es el dueño de su lugar y se registra únicamente al confirmar que no hay jerarquía", () => {
        const c = leer("components/HierarchyEmptyState.tsx");
        assert.match(c, /const store = ownerStoreFor\(group\);/);
        assert.match(c, /const showButton = ownerId === idRef\.current;/);
        assert.match(c, /\{showButton \? \(\s*<TouchableOpacity style=\{styles\.button\} onPress=\{goToHierarchy\}/);
        assert.match(c, /useEffect\(\(\) => \{\s*if \(missing !== true\) return;\s*return store\.register\(idRef\.current\);\s*\}, \[missing, store\]\);/);
        assert.equal((c.match(/<TouchableOpacity/g) ?? []).length, 1, "un solo lugar dibuja el botón");
    });

    it("el selector pasa su lugar: formulario si usa el respaldo con la marca, filtro si no", () => {
        const p = leer("components/HierarchyPickerFields.tsx");
        assert.match(p, /group=\{emptyGroup \?\? \(marcaFallback \? 'formulario' : 'filtro'\)\}/);
    });

    it("en las pantallas, el estado vacío de un filtro se marca como filtro y los de formulario no", () => {
        const dir = path.join(mobile, "screens");
        let filtros = 0;
        for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".tsx"))) {
            const s = leer(`screens/${f}`);
            // ningún estado vacío con respaldo de la marca (formulario) está marcado como filtro
            assert.equal(/<HierarchyEmptyState onUseMarca=[^>]*group="filtro"/.test(s), false, `${f}: un formulario marcado como filtro`);
            filtros += (s.match(/<HierarchyEmptyState group="filtro" \/>/g) ?? []).length;
        }
        assert.ok(filtros >= 12, `estados vacíos de filtro marcados: ${filtros}`);
    });

    it("un selector de filtro y uno de formulario en la misma pantalla quedan en lugares distintos (ejemplo: Notas)", () => {
        const s = leer("screens/NotesScreen.tsx");
        assert.match(s, /<HierarchyEmptyState group="filtro" \/>/);
        assert.match(s, /<HierarchyEmptyState onUseMarca=\{handleFormHierarchyChange\}/);
    });
});
