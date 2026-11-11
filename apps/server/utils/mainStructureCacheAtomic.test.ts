import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
    MAIN_STRUCTURE_ASYNC_SAFE_MAX_BYTES,
    MainStructureCacheError,
    persistMainStructureFragmentsSafely,
    readMainStructureCache,
    utf8ByteLength,
    validateMainStructureFragments,
    validateMainStructureJson,
    writeMainStructureCache,
    type StructureFileStore,
    type StructureKeyValueStore,
} from "../../mobile/hooks/mainStructureCacheAtomic";

const mobile = path.resolve(__dirname, "..", "..", "mobile");
const leer = (rel: string) => fs.readFileSync(path.join(mobile, rel), "utf8");

const MONO = "main_structure_cache";
const FLAG = "main_structure_cache_stored_in_file_v1";

/** AsyncStorage en memoria con fallos inyectables por operación y clave. */
function makeKv(initial: Record<string, string> = {}, failOn: (op: string, key: string) => boolean = () => false): StructureKeyValueStore & { data: Map<string, string> } {
    const data = new Map(Object.entries(initial));
    return {
        data,
        async getItem(k) { if (failOn("get", k)) throw new Error("falla get"); return data.has(k) ? data.get(k)! : null; },
        async setItem(k, v) { if (failOn("set", k)) throw new Error("falla set"); data.set(k, v); },
        async removeItem(k) { if (failOn("remove", k)) throw new Error("falla remove"); data.delete(k); },
        async multiSet(pairs) { if (failOn("multiSet", pairs.map((p) => p[0]).join(","))) throw new Error("falla multiSet"); for (const [k, v] of pairs) data.set(k, v); },
        async multiRemove(keys) { if (failOn("multiRemove", keys.join(","))) throw new Error("falla multiRemove"); for (const k of keys) data.delete(k); },
    };
}

/** Sistema de archivos en memoria con un archivo definitivo y uno temporal. */
function makeFiles(initial: { final?: string | null; tmp?: string | null } = {},failOn: (op: string) => boolean = () => false): StructureFileStore & { state: { final: string | null; tmp: string | null } } {
    const state = { final: initial.final ?? null, tmp: initial.tmp ?? null };
    return {
        state,
        async writeTemp(c) { if (failOn("writeTemp")) { state.tmp = c.slice(0, Math.floor(c.length / 2)); throw new Error("disco lleno"); } state.tmp = c; },
        async readTemp() { return state.tmp; },
        async readFinal() { return state.final; },
        async promoteTemp() { if (failOn("promoteTemp")) throw new Error("falla mover"); if (state.tmp == null) throw new Error("sin temporal"); state.final = state.tmp; state.tmp = null; },
        async deleteTemp() { state.tmp = null; },
        async deleteFinal() { state.final = null; },
    };
}

const arbolPequeno = (marca: string) => JSON.stringify([{ id: 1, marca, hijos: [] }]);
/** JSON que por caracteres está debajo del límite pero por bytes (UTF-8) lo supera: «€» ocupa 3 bytes. */
const arbolMultibyte = () => JSON.stringify([{ id: 1, texto: "€".repeat(Math.ceil(MAIN_STRUCTURE_ASYNC_SAFE_MAX_BYTES / 3)) }]);
const arbolAscii = () => JSON.stringify([{ id: 1, texto: "a".repeat(MAIN_STRUCTURE_ASYNC_SAFE_MAX_BYTES) }]);

describe("tamaño en bytes, no en caracteres (issue #178, H08)", () => {
    it("cuenta bytes UTF-8 (ñ=2, €=3, emoji=4, par suelto sustituto=3)", () => {
        assert.equal(utf8ByteLength("abc"), 3);
        assert.equal(utf8ByteLength("ñ"), 2);
        assert.equal(utf8ByteLength("€"), 3);
        assert.equal(utf8ByteLength("😀"), 4);
        assert.equal(utf8ByteLength("\ud800"), 3);
        assert.equal(utf8ByteLength(""), 0);
    });
    it("coincide con Buffer.byteLength para entradas variadas", () => {
        for (const s of ["", "a", "ñandú", "€€€", "😀😀", "mezcla ñ € 😀 \u0000 fin", "\udc00x", "x\ud83d"]) assert.equal(utf8ByteLength(s), Buffer.byteLength(s, "utf8"), JSON.stringify(s));
    });
    it("un árbol multibyte que por caracteres cabe pero por bytes no, se guarda en archivo", async () => {
        const json = arbolMultibyte();
        assert.ok(json.length < MAIN_STRUCTURE_ASYNC_SAFE_MAX_BYTES, "por caracteres está debajo del límite");
        assert.ok(utf8ByteLength(json) >= MAIN_STRUCTURE_ASYNC_SAFE_MAX_BYTES, "por bytes lo supera");
        const kv = makeKv();
        const files = makeFiles();
        await writeMainStructureCache(kv, files, json);
        assert.equal(files.state.final, json);
        assert.equal(kv.data.get(FLAG), "1");
        assert.equal(kv.data.has(MONO), false, "no debe quedar el monolito en AsyncStorage");
    });
    it("un árbol pequeño va a AsyncStorage y no deja archivo", async () => {
        const kv = makeKv({ [FLAG]: "1" });
        const files = makeFiles({ final: arbolPequeno("viejo") });
        await writeMainStructureCache(kv, files, arbolPequeno("nuevo"));
        assert.equal(kv.data.get(MONO), arbolPequeno("nuevo"));
        assert.equal(kv.data.get(FLAG), "0");
        assert.equal(files.state.final, null);
    });
});

describe("validar antes de reemplazar (issue #178, H08)", () => {
    it("rechaza lo que no es un árbol: JSON roto, no-arreglo, elementos que no son objetos, vacío o no-texto", () => {
        for (const raw of ["", "   ", "{", "null", "{}", "\"texto\"", "123", "[1,2]", "[null]", "[[]]", "[{},\"x\"]", "<html>502 Bad Gateway</html>", undefined, null, 7, {}, []]) {
            const r = validateMainStructureJson(raw as unknown);
            assert.equal(r.ok, false, JSON.stringify(raw));
        }
    });
    it("acepta un arreglo de objetos, incluido el vacío que el servidor entrega como respuesta válida", () => {
        assert.deepEqual(validateMainStructureJson("[]"), { ok: true, tree: [] });
        const r = validateMainStructureJson(arbolPequeno("x"));
        assert.equal(r.ok, true);
    });
    it("una carga inválida NO toca la caché anterior (ni en AsyncStorage ni en archivo)", async () => {
        const kv = makeKv({ [MONO]: arbolPequeno("bueno"), [FLAG]: "0" });
        const files = makeFiles();
        for (const mala of ["{", "null", "<html>error</html>", "[1]"]) {
            await assert.rejects(() => writeMainStructureCache(kv, files, mala), MainStructureCacheError);
        }
        assert.equal(kv.data.get(MONO), arbolPequeno("bueno"));
        assert.equal(kv.data.get(FLAG), "0");
        assert.equal(await readMainStructureCache(kv, files), arbolPequeno("bueno"));
    });
    it("los fragmentos del servidor deben traer `empresas` como arreglo; si no, se rechazan", () => {
        for (const f of [null, undefined, [], "x", {}, { empresas: {} }, { empresas: "x" }]) assert.equal(validateMainStructureFragments(f as unknown).ok, false, JSON.stringify(f));
        assert.equal(validateMainStructureFragments({ empresas: [] }).ok, true);
        assert.equal(validateMainStructureFragments({ empresas: [{ id: 1 }], otro: [] }).ok, true);
    });
});

describe("escritura atómica de la caché en archivo (issue #178, H08)", () => {
    it("si falla escribir el temporal (disco lleno), la caché anterior en archivo queda intacta y no queda un temporal a medias", async () => {
        const kv = makeKv({ [FLAG]: "1" });
        const files = makeFiles({ final: arbolAscii() }, (op) => op === "writeTemp");
        await assert.rejects(() => writeMainStructureCache(kv, files, arbolMultibyte()), /disco lleno/);
        assert.equal(files.state.final, arbolAscii());
        assert.equal(files.state.tmp, null);
        assert.equal(await readMainStructureCache(kv, files), arbolAscii());
    });
    it("si el temporal quedó distinto de lo que se quiso escribir, no se promueve", async () => {
        const kv = makeKv({ [FLAG]: "1" });
        const files = makeFiles({ final: arbolAscii() });
        const original = files.writeTemp.bind(files);
        files.writeTemp = async (c: string) => { await original(c); files.state.tmp = c.slice(0, c.length - 5); };
        await assert.rejects(() => writeMainStructureCache(kv, files, arbolMultibyte()), MainStructureCacheError);
        assert.equal(files.state.final, arbolAscii());
        assert.equal(files.state.tmp, null);
    });
    it("si falla mover el temporal, la caché anterior (archivo o monolito) sigue siendo la vigente", async () => {
        // Antes en archivo
        const kv1 = makeKv({ [FLAG]: "1" });
        const f1 = makeFiles({ final: arbolAscii() }, (op) => op === "promoteTemp");
        await assert.rejects(() => writeMainStructureCache(kv1, f1, arbolMultibyte()), /falla mover/);
        assert.equal(await readMainStructureCache(kv1, f1), arbolAscii());
        // Antes en AsyncStorage
        const kv2 = makeKv({ [MONO]: arbolPequeno("viejo"), [FLAG]: "0" });
        const f2 = makeFiles({}, (op) => op === "promoteTemp");
        await assert.rejects(() => writeMainStructureCache(kv2, f2, arbolMultibyte()), /falla mover/);
        assert.equal(await readMainStructureCache(kv2, f2), arbolPequeno("viejo"));
    });
    it("si la app muere después de mover el archivo pero antes de marcar la bandera, se lee la caché anterior completa", async () => {
        const kv = makeKv({ [MONO]: arbolPequeno("viejo"), [FLAG]: "0" }, (op, key) => op === "set" && key === FLAG);
        const files = makeFiles();
        await assert.rejects(() => writeMainStructureCache(kv, files, arbolMultibyte()));
        assert.equal(await readMainStructureCache(kv, files), arbolPequeno("viejo"));
    });
    it("si falla guardar en AsyncStorage, la caché anterior (incluido el archivo) sigue vigente", async () => {
        const kv = makeKv({ [FLAG]: "1" }, (op, key) => op === "set" && key === MONO);
        const files = makeFiles({ final: arbolAscii() });
        await assert.rejects(() => writeMainStructureCache(kv, files, arbolPequeno("nuevo")), /falla set/);
        assert.equal(await readMainStructureCache(kv, files), arbolAscii());
    });
    it("si el archivo definitivo se perdió justo al mover, el lector recupera el temporal completo", async () => {
        const kv = makeKv({ [FLAG]: "1" });
        const files = makeFiles({ final: null, tmp: arbolMultibyte() });
        assert.equal(await readMainStructureCache(kv, files), arbolMultibyte());
    });
    it("un archivo definitivo corrupto (de una escritura cortada por una versión anterior) se trata como sin caché, o se usa el temporal válido", async () => {
        const kv = makeKv({ [FLAG]: "1" });
        assert.equal(await readMainStructureCache(kv, makeFiles({ final: "[{\"id\":1,\"hij" })), null);
        assert.equal(await readMainStructureCache(kv, makeFiles({ final: "[{\"id\":1,\"hij", tmp: arbolPequeno("ok") })), arbolPequeno("ok"));
    });
    it("el CursorWindow demasiado grande de AsyncStorage se trata como sin caché y limpia la clave", async () => {
        const kv = makeKv({ [MONO]: "x" });
        let removed = false;
        const wrapped: StructureKeyValueStore = {
            ...kv,
            async getItem(k: string) { if (k === MONO) throw new Error("Row too big to fit into CursorWindow"); return null; },
            async removeItem(k: string) { if (k === MONO) removed = true; },
        };
        assert.equal(await readMainStructureCache(wrapped, makeFiles()), null);
        assert.equal(removed, true);
    });
});

describe("fragmentos: escribir lo nuevo antes de quitar lo viejo (issue #178, H08)", () => {
    const REG = "main_structure_fragment_storage_keys";
    const P = "main_structure_frag__";
    const viejo = () => ({
        [REG]: JSON.stringify([`${P}empresas`, `${P}solo_viejo`]),
        [`${P}empresas`]: JSON.stringify([{ id: 1, v: "viejo" }]),
        [`${P}solo_viejo`]: JSON.stringify([1]),
        [MONO]: arbolPequeno("legado"),
        [FLAG]: "0",
    });
    it("reemplaza los fragmentos, registra las claves nuevas y limpia las que ya no existen", async () => {
        const kv = makeKv(viejo());
        await persistMainStructureFragmentsSafely(kv, { empresas: [{ id: 1, v: "nuevo" }], divisiones: [] }, async () => { kv.data.delete(MONO); kv.data.delete(FLAG); });
        assert.deepEqual(JSON.parse(kv.data.get(REG)!).sort(), [`${P}divisiones`, `${P}empresas`]);
        assert.deepEqual(JSON.parse(kv.data.get(`${P}empresas`)!), [{ id: 1, v: "nuevo" }]);
        assert.equal(kv.data.has(`${P}solo_viejo`), false);
        assert.equal(kv.data.has(MONO), false, "el monolito legado se limpia al final");
    });
    it("si falla al escribir los fragmentos nuevos, los viejos y el monolito legado siguen ahí", async () => {
        const kv = makeKv(viejo(), (op) => op === "multiSet");
        let limpiado = false;
        await assert.rejects(() => persistMainStructureFragmentsSafely(kv, { empresas: [{ id: 1, v: "nuevo" }] }, async () => { limpiado = true; }), /falla multiSet/);
        assert.deepEqual(JSON.parse(kv.data.get(`${P}empresas`)!), [{ id: 1, v: "viejo" }]);
        assert.equal(kv.data.has(`${P}solo_viejo`), true);
        assert.equal(kv.data.get(MONO), arbolPequeno("legado"));
        assert.equal(limpiado, false);
    });
    it("fragmentos inválidos se rechazan sin tocar nada", async () => {
        const kv = makeKv(viejo());
        const antes = JSON.stringify([...kv.data.entries()]);
        await assert.rejects(() => persistMainStructureFragmentsSafely(kv, { divisiones: [] } as Record<string, unknown>, async () => undefined), MainStructureCacheError);
        assert.equal(JSON.stringify([...kv.data.entries()]), antes);
    });
});

describe("cableado en la app (issue #178, H08)", () => {
    it("el almacenamiento de la caché ya no compara caracteres con el límite", () => {
        const src = leer("hooks/mainStructureCacheStorage.ts");
        assert.equal(/json\.length\s*>=/.test(src), false, "no debe medir en caracteres");
        assert.match(src, /writeMainStructureCache\(/);
        assert.match(src, /readMainStructureCache\(/);
    });
    it("el archivo temporal está protegido del borrado masivo igual que el definitivo", () => {
        assert.match(leer("hooks/mainStructureCacheStorage.ts"), /MAIN_STRUCTURE_CACHE_TMP_FILENAME/);
        assert.match(leer("hooks/fileStorage.ts"), /MAIN_STRUCTURE_CACHE_TMP_FILENAME/);
    });
    it("la descarga valida la carga ANTES de borrar fragmentos o escribir la caché", () => {
        const src = leer("hooks/mainStructureApi.ts");
        const payload = src.slice(src.indexOf("export async function persistMainStructurePayload"), src.indexOf("async function parseJsonResponse"));
        // Rama de fragmentos
        const rFrag = payload.slice(0, payload.indexOf("let structureJson"));
        assert.ok(rFrag.search(/validateMainStructureFragments\(/) >= 0, "la rama de fragmentos debe validar");
        assert.ok(rFrag.search(/validateMainStructureFragments\(/) < rFrag.search(/await persistMainStructureFragments\(/), "fragmentos: validar antes de escribir");
        // Rama de `structure`
        const rStruct = payload.slice(payload.indexOf("let structureJson"));
        const iValida = rStruct.search(/validateMainStructureJson\(/);
        assert.ok(iValida >= 0, "la rama de structure debe validar");
        assert.ok(iValida < rStruct.search(/await writeMainStructureCacheString\(/), "structure: validar antes de escribir la caché");
        assert.ok(rStruct.search(/await writeMainStructureCacheString\(/) < rStruct.search(/await persistMainStructureFragments\(\{\}\)/), "structure: primero la caché nueva, luego se quitan los fragmentos");
        assert.equal(/writeMainStructureCacheString\(rawStructure\)/.test(src), false, "ya no se escribe la cadena cruda");
    });
    it("persistMainStructureFragments usa la escritura segura (nuevo antes que viejo)", () => {
        const src = leer("hooks/mainStructureFragmentsStorage.ts");
        assert.match(src, /persistMainStructureFragmentsSafely\(/);
    });
});
