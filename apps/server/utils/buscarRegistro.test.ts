import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
    armarFilas,
    elegirClave,
    envolver,
    esIdentificadorSeguro,
    formatearValor,
    LINEAS_MAXIMAS,
    lineasDeContenido,
    mensajeResultados,
    parseBuscarArgs,
    renderCuadricula,
    tituloRegistro,
    validarId,
    validarTabla,
    type ColumnaInfo,
} from "./buscarRegistro";

const cols = (...c: Array<[string, string, boolean?, string?]>): ColumnaInfo[] => c.map(([nombre, tipo, nulable = true, clave = ""]) => ({ nombre, tipo, nulable, clave }));

describe("buscarRegistro: argumentos y validación", () => {
    it("lee la tabla, el id y las opciones", () => {
        const a = parseBuscarArgs(["c_marca_dia", "123", "--pk=codigo", "--db=DATABASE_URL_SECONDARY", "--ancho=50", "--full"]);
        assert.deepEqual(a, { tabla: "c_marca_dia", id: "123", pk: "codigo", dbEnv: "DATABASE_URL_SECONDARY", full: true, ancho: 50, max: 20, ayuda: false });
    });

    it("sin argumentos deja tabla e id vacíos (el script los pregunta)", () => {
        const a = parseBuscarArgs([]);
        assert.equal(a.tabla, null);
        assert.equal(a.id, null);
        assert.equal(a.dbEnv, "DATABASE_URL");
    });

    it("rechaza opciones desconocidas, demasiados argumentos y valores inválidos", () => {
        assert.throws(() => parseBuscarArgs(["t", "1", "--borrar"]), /Opción desconocida/);
        assert.throws(() => parseBuscarArgs(["t", "1", "2"]), /Demasiados/);
        assert.throws(() => parseBuscarArgs(["t", "1", "--ancho=5"]), /--ancho/);
        assert.throws(() => parseBuscarArgs(["t", "1", "--ancho=abc"]), /--ancho/);
        assert.throws(() => parseBuscarArgs(["t", "1", "--db=a b;c"]), /--db/);
    });

    it("solo acepta nombres de tabla y columna seguros (no se interpola nada peligroso)", () => {
        for (const ok of ["c_marca_dia", "T1", "tabla_2"]) assert.equal(esIdentificadorSeguro(ok), true, ok);
        for (const mal of ["", "a b", "t`; DROP TABLE x; --", "a.b", "tabla-1", "x".repeat(65), "tabla;"]) assert.equal(esIdentificadorSeguro(mal), false, mal);
        assert.throws(() => validarTabla("t; DROP TABLE x"), /no es un nombre de tabla válido/);
        assert.throws(() => validarTabla(""), /Falta/);
        assert.equal(validarTabla("  c_marca_dia "), "c_marca_dia");
    });

    it("el id es obligatorio y se recorta", () => {
        assert.throws(() => validarId(null), /Falta el id/);
        assert.throws(() => validarId("   "), /Falta el id/);
        assert.equal(validarId(" 42 "), "42");
        assert.throws(() => validarId("9".repeat(101)), /demasiado largo/);
    });
});

describe("buscarRegistro: columna de búsqueda", () => {
    it("usa --pk, luego «id», luego la única clave primaria", () => {
        const c = cols(["id", "int", false, "PRI"], ["codigo", "varchar(10)"]);
        assert.equal(elegirClave(c, "codigo"), "codigo");
        assert.equal(elegirClave(c, "CODIGO"), "codigo", "sin distinguir mayúsculas");
        assert.equal(elegirClave(c, null), "id");
        assert.equal(elegirClave(cols(["marca_id", "int", false, "PRI"], ["x", "int"]), null), "marca_id");
    });

    it("pide --pk si no hay forma de decidir o la columna no existe", () => {
        assert.throws(() => elegirClave(cols(["a", "int", false, "PRI"], ["b", "int", false, "PRI"]), null), /--pk/);
        assert.throws(() => elegirClave(cols(["a", "int"], ["b", "int"]), null), /--pk/);
        assert.throws(() => elegirClave(cols(["id", "int"]), "nada"), /no tiene la columna «nada»/);
    });
});

describe("buscarRegistro: formato de los valores", () => {
    it("nulos, vacíos, números, booleanos y bigint", () => {
        assert.equal(formatearValor(null), "NULL");
        assert.equal(formatearValor(undefined), "NULL");
        assert.equal(formatearValor(""), "(vacío)");
        assert.equal(formatearValor(0), "0");
        assert.equal(formatearValor(-0), "0");
        assert.equal(formatearValor(12.5), "12.5");
        assert.equal(formatearValor(false), "false");
        assert.equal(formatearValor(BigInt("9007199254740993")), "9007199254740993");
    });

    it("fechas en ISO, binarios con su tamaño y objetos como JSON", () => {
        assert.equal(formatearValor(new Date("2026-11-04T10:30:00.000Z")), "2026-11-04T10:30:00.000Z");
        assert.equal(formatearValor(new Date("x")), "(fecha inválida)");
        assert.equal(formatearValor(Buffer.from([1, 2, 255])), "<binario 3 bytes> 0x0102ff");
        assert.match(formatearValor(Buffer.alloc(40)), /<binario 40 bytes> 0x0{32}…/);
        assert.equal(formatearValor({ a: 1, b: [2] }), '{"a":1,"b":[2]}');
        assert.equal(formatearValor({ toString: () => "123.45" }), "123.45", "un decimal conserva su texto exacto");
    });
});

describe("buscarRegistro: cuadrícula Nombre | Tipo | Contenido", () => {
    it("tiene bordes, encabezado y las tres columnas alineadas", () => {
        const txt = renderCuadricula([
            { nombre: "id", tipo: "int NOT NULL PK", contenido: "7" },
            { nombre: "nombre", tipo: "varchar(255)", contenido: "Puesto Centro" },
        ]);
        const lineas = txt.split("\n");
        assert.match(lineas[0], /^┌─+┬─+┬─+┐$/);
        assert.match(lineas[1], /^│ Nombre\s+│ Tipo\s+│ Contenido\s+│$/);
        assert.ok(lineas.some((l) => /^│ id\s+│ int NOT NULL PK\s+│ 7\s+│$/.test(l)));
        assert.match(lineas[lineas.length - 1], /^└─+┴─+┴─+┘$/);
        const anchos = new Set(lineas.map((l) => Array.from(l).length));
        assert.equal(anchos.size, 1, "todas las líneas miden lo mismo");
    });

    it("un contenido largo se parte en varias líneas dentro de su celda y las demás columnas siguen alineadas", () => {
        const largo = "a".repeat(25);
        const txt = renderCuadricula([{ nombre: "campo", tipo: "text", contenido: largo }], { ancho: 20 });
        const filas = txt.split("\n").filter((l) => l.startsWith("│") && !l.includes("Nombre"));
        assert.equal(filas.length, 2);
        assert.ok(filas[0].includes("campo") && filas[0].includes("a".repeat(20)));
        assert.ok(filas[1].includes("aaaaa") && !filas[1].includes("campo"));
        assert.equal(new Set(txt.split("\n").map((l) => Array.from(l).length)).size, 1);
    });

    it("corta los contenidos enormes salvo con --full", () => {
        const enorme = Array.from({ length: 50 }, (_, i) => `linea ${i}`).join("\n");
        const corto = lineasDeContenido(enorme, 70, false);
        assert.equal(corto.length, LINEAS_MAXIMAS);
        assert.match(corto[corto.length - 1], /… \(\d+ caracteres; usa --full/);
        assert.equal(lineasDeContenido(enorme, 70, true).length, 50);
    });

    it("conserva los saltos de línea y no se rompe con acentos o emojis", () => {
        assert.deepEqual(envolver("uno\ndos\r\ntres", 10), ["uno", "dos", "tres"]);
        assert.deepEqual(envolver("ñandú😀😀😀", 4), ["ñand", "ú😀😀😀"]);
        assert.deepEqual(envolver("", 10), [""]);
    });

    it("arma una fila por columna del catálogo, con tipo, NOT NULL y PK, y muestra las columnas inesperadas", () => {
        const filas = armarFilas(cols(["id", "int", false, "PRI"], ["nota", "text", true]), { id: 3, nota: null, extra: "x" });
        assert.deepEqual(filas, [
            { nombre: "id", tipo: "int NOT NULL PK", contenido: "3" },
            { nombre: "nota", tipo: "text", contenido: "NULL" },
            { nombre: "extra", tipo: "(desconocido)", contenido: "x" },
        ]);
    });
});

describe("scripts/buscarRegistro.ts es solo de lectura", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "..", "scripts", "buscarRegistro.ts"), "utf8");

    it("no ejecuta nada que escriba: solo SELECT", () => {
        assert.equal(/\$executeRaw/.test(src), false, "no usa $executeRaw");
        // Las sentencias SQL van en mayúsculas (no se confunden con métodos de JavaScript como `.replace(`).
        assert.equal(/\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|REPLACE|GRANT)\b/.test(src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")), false, "ninguna sentencia de escritura");
        const consultas = [...src.matchAll(/\$queryRawUnsafe[^(]*\(\s*[`"]([^`"]*)/g)].map((m) => m[1].trim().toUpperCase());
        assert.ok(consultas.length >= 3);
        for (const q of consultas) assert.ok(q.startsWith("SELECT"), `consulta que no es SELECT: ${q.slice(0, 40)}`);
    });

    it("el id viaja como parámetro y no dentro del texto de la consulta; no muestra credenciales", () => {
        assert.match(src, /WHERE \\`\$\{clave\}\\` = \? LIMIT/);
        const llamadas = [...src.matchAll(/\$queryRawUnsafe[\s\S]*?\);/g)].map((m) => m[0]);
        assert.equal(llamadas.length, 6, "lista de tablas, existe, parecidas, columnas, conteo y registros");
        for (const q of llamadas) assert.equal(/\$\{id\}/.test(q), false, "el id no se interpola en ninguna consulta");
        assert.match(src, /u\.host\}\$\{u\.pathname/, "solo se muestra servidor y base");
        assert.equal(/u\.(password|username)/.test(src), false);
    });
});

describe("buscarRegistro: tabla indicada y varios resultados", () => {
    it("la tabla se indica como primer argumento o con --tabla=, y la columna con --pk= o --columna=", () => {
        const a = parseBuscarArgs(["--tabla=c_marca_dia", "123", "--columna=empleadoFijo_id", "--max=50"]);
        assert.equal(a.tabla, "c_marca_dia");
        assert.equal(a.id, "123");
        assert.equal(a.pk, "empleadoFijo_id");
        assert.equal(a.max, 50);
        const b = parseBuscarArgs(["c_marca_dia", "9"]);
        assert.deepEqual([b.tabla, b.id, b.max], ["c_marca_dia", "9", 20]);
        assert.throws(() => parseBuscarArgs(["--tabla=t", "1", "2"]), /Demasiados/);
        assert.throws(() => parseBuscarArgs(["t", "1", "--max=0"]), /--max/);
        assert.throws(() => parseBuscarArgs(["t", "1", "--max=500"]), /--max/);
        assert.throws(() => validarTabla(parseBuscarArgs(["--tabla=x; DROP TABLE y", "1"]).tabla), /no es un nombre de tabla válido/);
    });

    it("con más de un registro avisa «Se obtuvieron X resultados, mostrando...»; con uno o ninguno no avisa", () => {
        assert.equal(mensajeResultados(3, 3), "Se obtuvieron 3 resultados, mostrando...");
        assert.equal(mensajeResultados(2, 2), "Se obtuvieron 2 resultados, mostrando...");
        assert.equal(mensajeResultados(150, 20), "Se obtuvieron 150 resultados, mostrando los primeros 20...");
        assert.equal(mensajeResultados(1, 1), null);
        assert.equal(mensajeResultados(0, 0), null);
    });

    it("cada registro lleva su título con la posición dentro de la lista", () => {
        assert.equal(tituloRegistro("c_marca_dia", "empleadoFijo_id", "87", 1, 3, 25), "c_marca_dia · empleadoFijo_id = 87 (2 de 3) · 25 columnas");
        assert.equal(tituloRegistro("c_marca_dia", "id", "7", 0, 1, 25), "c_marca_dia · id = 7 · 25 columnas");
    });

    it("el script cuenta los registros, muestra el aviso y una cuadrícula por registro (todo con SELECT)", () => {
        const src = fs.readFileSync(path.resolve(__dirname, "..", "scripts", "buscarRegistro.ts"), "utf8");
        assert.match(src, /SELECT COUNT\(\*\) AS total FROM/);
        assert.match(src, /mensajeResultados\(total, filas\.length\)/);
        assert.match(src, /filas\.forEach\(\(registro, i\)/);
        assert.match(src, /LIMIT \$\{args\.max\}/);
        assert.match(src, /preguntar\("Tabla \(\? para ver cuáles hay\): "\)/);
    });
});
