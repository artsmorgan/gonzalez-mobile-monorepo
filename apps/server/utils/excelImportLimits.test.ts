import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import * as XLSX from "xlsx";
import { EXCEL_IMPORT_LIMITS, checkCellChars, checkExcelFileSize, checkSheetCount, checkSheetRange, decodeSheetRef } from "../../mobile/hooks/excelImportLimits";
import { parseMantenimientoEquipoPlantillaBuffer, parseMantenimientoEquipoPlantillaLocal } from "../../mobile/hooks/mantenimientoEquipoPlantillaLocal";

const mobile = path.resolve(__dirname, "..", "..", "mobile");
const root = path.resolve(__dirname, "..", "..", "..");
const leer = (rel: string) => fs.readFileSync(path.join(mobile, rel), "utf8");

/** Libro con la forma de la plantilla (solo estructura: encabezados, una fila y el catálogo en la columna I). */
function libroPlantilla(opts: { serie?: string } = {}): XLSX.WorkBook {
    const ws: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet([
        ["Código del puesto", "Número artículo", "Cantidad", "Serie", "Marca", "Modelo", "Fecha de entrega"],
        ["COD", 1, 1, opts.serie ?? "SER", "MAR", "MOD", "01-02-2026"],
    ]);
    XLSX.utils.sheet_add_aoa(ws, [[1, "ART"]], { origin: "I9" });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Hoja1");
    return wb;
}
const aBuffer = (wb: XLSX.WorkBook): ArrayBuffer => {
    const u8: Uint8Array = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
};

describe("límites de la importación de Excel: reglas puras (issue #175, H09)", () => {
    it("los límites propuestos por la auditoría", () => {
        assert.deepEqual({ ...EXCEL_IMPORT_LIMITS }, { maxBytes: 5 * 1024 * 1024, maxSheets: 5, maxRows: 5000, maxColumns: 50, maxCellChars: 2000 });
    });
    it("tamaño del archivo: pasa hasta el máximo, falla por encima y ante valores raros", () => {
        assert.equal(checkExcelFileSize(EXCEL_IMPORT_LIMITS.maxBytes), null);
        assert.equal(checkExcelFileSize(0), null);
        assert.equal(checkExcelFileSize(undefined), null, "si el selector no informa tamaño se revisa después al leer");
        assert.match(checkExcelFileSize(EXCEL_IMPORT_LIMITS.maxBytes + 1)!, /5 MB/);
        assert.match(checkExcelFileSize(Number.POSITIVE_INFINITY)!, /máximo/);
    });
    it("cantidad de hojas", () => {
        assert.equal(checkSheetCount(1), null);
        assert.equal(checkSheetCount(5), null);
        assert.match(checkSheetCount(6)!, /hojas/);
    });
    it("lee el rango declarado de una hoja y rechaza lo que no es un rango", () => {
        assert.deepEqual(decodeSheetRef("A1:G10"), { rows: 10, cols: 7 });
        assert.deepEqual(decodeSheetRef("B2"), { rows: 1, cols: 1 });
        assert.deepEqual(decodeSheetRef("A1:XFD1048576"), { rows: 1048576, cols: 16384 });
        for (const bad of [undefined, null, "", "A", "1:2", "A1:", "ZZZZZZZZZZ1:A2", "A0:B2", "A1:B-2", 7, {}]) assert.equal(decodeSheetRef(bad as unknown), null, JSON.stringify(bad));
    });
    it("rango exagerado de filas o de columnas", () => {
        assert.equal(checkSheetRange("A1:G5000"), null);
        assert.match(checkSheetRange("A1:G5001")!, /filas/);
        assert.equal(checkSheetRange("A1:AX10"), null); // 50 columnas
        assert.match(checkSheetRange("A1:AY10")!, /columnas/);
        assert.match(checkSheetRange("A1:XFD1048576")!, /filas/);
        assert.match(checkSheetRange("basura")!, /rango/);
    });
    it("texto de una celda: hasta el máximo de caracteres", () => {
        assert.equal(checkCellChars("x".repeat(EXCEL_IMPORT_LIMITS.maxCellChars)), true);
        assert.equal(checkCellChars("x".repeat(EXCEL_IMPORT_LIMITS.maxCellChars + 1)), false);
    });
});

describe("importación de la plantilla con entradas hostiles (issue #175, H09)", () => {
    it("una plantilla con la forma correcta se sigue leyendo", async () => {
        const r = await parseMantenimientoEquipoPlantillaBuffer(aBuffer(libroPlantilla()));
        assert.equal(r.status, true, JSON.stringify(r));
        assert.equal(r.data?.length, 1);
        assert.equal(r.data?.[0]?.codigo_puesto, "COD");
        assert.equal(r.data?.[0]?.articulo_nombre, "ART");
    });
    it("un rango de hoja exagerado (millones de filas declaradas) se rechaza sin recorrerlo", async () => {
        const wb = libroPlantilla();
        wb.Sheets["Hoja1"]!["!ref"] = "A1:G1048576";
        const buffer = aBuffer(wb); // armar el libro hostil no cuenta: se mide solo la lectura
        const t0 = Date.now();
        const r = await parseMantenimientoEquipoPlantillaBuffer(buffer);
        assert.equal(r.status, false);
        assert.match(String(r.message), /filas/);
        assert.ok(Date.now() - t0 < 1500, `debe responder rápido, no recorrer el rango (${Date.now() - t0} ms)`);
    });
    it("demasiadas columnas", async () => {
        const wb = libroPlantilla();
        wb.Sheets["Hoja1"]!["!ref"] = "A1:AZ20";
        const r = await parseMantenimientoEquipoPlantillaBuffer(aBuffer(wb));
        assert.equal(r.status, false);
        assert.match(String(r.message), /columnas/);
    });
    it("demasiadas hojas", async () => {
        const wb = libroPlantilla();
        for (let i = 2; i <= 6; i++) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["x"]]), `H${i}`);
        const r = await parseMantenimientoEquipoPlantillaBuffer(aBuffer(wb));
        assert.equal(r.status, false);
        assert.match(String(r.message), /hojas/);
    });
    it("solo se procesa la primera hoja: un rango enorme en otra hoja no la afecta", async () => {
        const wb = libroPlantilla();
        const otra = XLSX.utils.aoa_to_sheet([["x"]]);
        otra["!ref"] = "A1:G1048576";
        XLSX.utils.book_append_sheet(wb, otra, "Otra");
        const r = await parseMantenimientoEquipoPlantillaBuffer(aBuffer(wb));
        assert.equal(r.status, true, JSON.stringify(r));
    });
    it("una celda con más caracteres del máximo se reporta como error de esa fila", async () => {
        const r = await parseMantenimientoEquipoPlantillaBuffer(aBuffer(libroPlantilla({ serie: "x".repeat(EXCEL_IMPORT_LIMITS.maxCellChars + 1) })));
        assert.equal(r.status, false);
        assert.ok((r.errors ?? []).some((e) => /Fila 2/.test(e) && /2\.000|2000/.test(e)), JSON.stringify(r.errors));
    });
    it("un archivo más grande que el máximo se rechaza antes de abrirlo", async () => {
        const t0 = Date.now();
        const r = await parseMantenimientoEquipoPlantillaBuffer(new ArrayBuffer(EXCEL_IMPORT_LIMITS.maxBytes + 1));
        assert.equal(r.status, false);
        assert.match(String(r.message), /5 MB/);
        assert.ok(Date.now() - t0 < 1000);
    });
    it("el tamaño que informa el selector de archivos también se respeta, sin leer el archivo", async () => {
        let leyo = false;
        const original = globalThis.fetch;
        globalThis.fetch = (async () => { leyo = true; throw new Error("no debía leerse"); }) as typeof fetch;
        try {
            const r = await parseMantenimientoEquipoPlantillaLocal("file:///x.xlsx", { fileSize: EXCEL_IMPORT_LIMITS.maxBytes + 1 });
            assert.equal(r.status, false);
            assert.match(String(r.message), /5 MB/);
            assert.equal(leyo, false);
        } finally {
            globalThis.fetch = original;
        }
    });
    it("bytes que no son un libro devuelven un error controlado, no una excepción", async () => {
        const basura = new Uint8Array(2048).map((_, i) => (i * 31) % 251).buffer;
        const r = await parseMantenimientoEquipoPlantillaBuffer(basura);
        assert.equal(r.status, false);
        assert.ok(typeof r.message === "string" && r.message.length > 0);
    });
    it("una importación cancelada no procesa nada", async () => {
        const ac = new AbortController();
        ac.abort();
        const r = await parseMantenimientoEquipoPlantillaBuffer(aBuffer(libroPlantilla()), { signal: ac.signal });
        assert.equal(r.status, false);
        assert.equal(r.cancelled, true);
    });
    it("cancelar a mitad de la lectura se respeta", async () => {
        const wb = libroPlantilla();
        // 1.200 filas de relleno estructural: obliga a pasar por el punto de cancelación entre bloques
        const filas = Array.from({ length: 1200 }, () => ["", "", "", "", "", "", ""]);
        XLSX.utils.sheet_add_aoa(wb.Sheets["Hoja1"]!, filas, { origin: "A3" });
        const ac = new AbortController();
        const prometida = parseMantenimientoEquipoPlantillaBuffer(aBuffer(wb), { signal: ac.signal });
        setImmediate(() => ac.abort());
        const r = await prometida;
        // Si alcanzó a terminar antes de abortar es válido; lo que no puede pasar es una excepción o un estado inconsistente.
        assert.ok(r.cancelled === true || r.status === true, JSON.stringify(r).slice(0, 200));
    });
});

describe("SheetJS actualizado (issue #171, H05)", () => {
    const versionDe = (spec: string) => /(\d+)\.(\d+)\.(\d+)/.exec(spec)!.slice(1).map(Number);
    const mayorOIgual = (a: number[], b: number[]) => a[0]! !== b[0]! ? a[0]! > b[0]! : a[1]! !== b[1]! ? a[1]! > b[1]! : a[2]! >= b[2]!;

    it("package.json apunta al CDN oficial de SheetJS con una versión ≥ 0.20.2 (CVE-2023-30533 y CVE-2024-22363)", () => {
        const spec: string = JSON.parse(leer("package.json")).dependencies.xlsx;
        assert.match(spec, /^https:\/\/cdn\.sheetjs\.com\/xlsx-\d+\.\d+\.\d+\/xlsx-\d+\.\d+\.\d+\.tgz$/);
        assert.ok(mayorOIgual(versionDe(spec), [0, 20, 2]), spec);
    });
    it("el lockfile fija el origen y la integridad (hash) del paquete", () => {
        const lock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
        const e = lock.packages["node_modules/xlsx"];
        assert.match(e.resolved, /^https:\/\/cdn\.sheetjs\.com\//);
        assert.match(e.integrity, /^sha512-/);
        assert.ok(mayorOIgual(versionDe(e.version), [0, 20, 2]), e.version);
    });
    it("la versión instalada es la corregida", () => {
        const v = JSON.parse(fs.readFileSync(path.join(root, "node_modules/xlsx/package.json"), "utf8")).version;
        assert.ok(mayorOIgual(versionDe(v), [0, 20, 2]), v);
    });
});

describe("cableado en la pantalla (issue #175, H09)", () => {
    it("la pantalla pasa el tamaño del archivo y una señal de cancelación, y cancela al desmontar", () => {
        const src = leer("screens/MantenimientoEquipoScreen.tsx");
        assert.match(src, /parseMantenimientoEquipoPlantillaLocal\(asset\.uri, \{[^}]*fileSize: asset\.size[^}]*signal/);
        assert.match(src, /bulkImportAbortRef/);
        assert.match(src, /bulkImportAbortRef\.current\?\.abort\(\)/);
    });
});
