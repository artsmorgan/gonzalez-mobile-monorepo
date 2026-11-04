/**
 * Lógica pura de `scripts/buscarRegistro.ts` (búsqueda de un registro por id, solo lectura): argumentos, validación de nombres y formato de la cuadrícula
 * «Nombre | Tipo | Contenido». Sin base de datos para poder probarla en Node.
 */

export type BuscarArgs = {
    tabla: string | null;
    id: string | null;
    pk: string | null;
    /** Nombre de la variable de entorno con la URL de conexión (por defecto `DATABASE_URL`). */
    dbEnv: string;
    full: boolean;
    ancho: number;
    ayuda: boolean;
};

export const ANCHO_POR_DEFECTO = 70;
export const ANCHO_MINIMO = 20;
export const ANCHO_MAXIMO = 200;
/** Líneas de un mismo valor que se muestran antes de cortar con «… (N caracteres)» (sin `--full`). */
export const LINEAS_MAXIMAS = 6;

/** Nombre de tabla o columna que se puede interpolar entre acentos graves sin riesgo: solo letras, números y guion bajo. */
export const esIdentificadorSeguro = (nombre: string): boolean => /^[A-Za-z0-9_]{1,64}$/.test(nombre);

const ENV_VALIDA = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function parseBuscarArgs(argv: string[]): BuscarArgs {
    const out: BuscarArgs = { tabla: null, id: null, pk: null, dbEnv: "DATABASE_URL", full: false, ancho: ANCHO_POR_DEFECTO, ayuda: false };
    const posicionales: string[] = [];
    for (const arg of argv) {
        if (arg === "--help" || arg === "-h") out.ayuda = true;
        else if (arg === "--full") out.full = true;
        else if (arg.startsWith("--pk=")) out.pk = arg.slice(5).trim() || null;
        else if (arg.startsWith("--db=")) {
            const nombre = arg.slice(5).trim();
            if (!ENV_VALIDA.test(nombre)) throw new Error(`--db debe ser el nombre de una variable de entorno (por ejemplo DATABASE_URL), no «${nombre}».`);
            out.dbEnv = nombre;
        } else if (arg.startsWith("--ancho=")) {
            const n = Number(arg.slice(8));
            if (!Number.isInteger(n) || n < ANCHO_MINIMO || n > ANCHO_MAXIMO) throw new Error(`--ancho debe ser un entero entre ${ANCHO_MINIMO} y ${ANCHO_MAXIMO}.`);
            out.ancho = n;
        } else if (arg.startsWith("--")) throw new Error(`Opción desconocida: ${arg}`);
        else posicionales.push(arg);
    }
    if (posicionales.length > 2) throw new Error("Demasiados argumentos: se esperan solo la tabla y el id.");
    out.tabla = posicionales[0]?.trim() || null;
    out.id = posicionales[1]?.trim() || null;
    return out;
}

/** El id se pasa como parámetro (nunca se interpola), pero se rechaza lo vacío o absurdo para dar un mensaje claro. */
export function validarId(id: string | null): string {
    const valor = String(id ?? "").trim();
    if (!valor) throw new Error("Falta el id.");
    if (valor.length > 100) throw new Error("El id es demasiado largo.");
    return valor;
}

export function validarTabla(tabla: string | null): string {
    const nombre = String(tabla ?? "").trim();
    if (!nombre) throw new Error("Falta el nombre de la tabla.");
    if (!esIdentificadorSeguro(nombre)) throw new Error(`«${nombre}» no es un nombre de tabla válido (solo letras, números y guion bajo).`);
    return nombre;
}

export type ColumnaInfo = { nombre: string; tipo: string; nulable: boolean; clave: string };

/** Qué columna se usa como clave: la indicada con --pk, `id` si existe o la única clave primaria de la tabla. */
export function elegirClave(columnas: ColumnaInfo[], pk: string | null): string {
    const nombres = columnas.map((c) => c.nombre);
    if (pk) {
        const exacta = nombres.find((n) => n === pk) ?? nombres.find((n) => n.toLowerCase() === pk.toLowerCase());
        if (!exacta) throw new Error(`La tabla no tiene la columna «${pk}». Columnas: ${nombres.join(", ")}.`);
        return exacta;
    }
    const id = nombres.find((n) => n.toLowerCase() === "id");
    if (id) return id;
    const primarias = columnas.filter((c) => c.clave === "PRI");
    if (primarias.length === 1) return primarias[0].nombre;
    throw new Error(`No se pudo decidir la columna del id (${primarias.length > 1 ? "clave compuesta" : "sin columna «id» ni clave primaria"}). Indícala con --pk=<columna>. Columnas: ${nombres.join(", ")}.`);
}

/** Texto de un valor tal como llega de la base: nulos, fechas, binarios, decimales y JSON se muestran de forma legible y sin perder datos. */
export function formatearValor(valor: unknown): string {
    if (valor === null || valor === undefined) return "NULL";
    if (typeof valor === "string") return valor === "" ? "(vacío)" : valor;
    if (typeof valor === "bigint") return valor.toString();
    if (typeof valor === "boolean") return valor ? "true" : "false";
    if (typeof valor === "number") return Object.is(valor, -0) ? "0" : String(valor);
    if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? "(fecha inválida)" : valor.toISOString();
    if (typeof Buffer !== "undefined" && Buffer.isBuffer(valor)) {
        const hex = valor.subarray(0, 16).toString("hex");
        return `<binario ${valor.length} bytes> 0x${hex}${valor.length > 16 ? "…" : ""}`;
    }
    if (typeof valor === "object") {
        // Decimal de Prisma (y similares) se imprimen con toString(); el resto, como JSON.
        const texto = (valor as { toString: () => string }).toString();
        if (texto && texto !== "[object Object]") return texto;
        try {
            return JSON.stringify(valor, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
        } catch {
            return String(valor);
        }
    }
    return String(valor);
}

/** Parte un texto en líneas de hasta `ancho` caracteres, respetando los saltos de línea del original. */
export function envolver(texto: string, ancho: number): string[] {
    const limpio = texto.replace(/\r\n?/g, "\n").replace(/\t/g, "  ");
    const lineas: string[] = [];
    for (const original of limpio.split("\n")) {
        const chars = Array.from(original);
        if (chars.length === 0) {
            lineas.push("");
            continue;
        }
        for (let i = 0; i < chars.length; i += ancho) lineas.push(chars.slice(i, i + ancho).join(""));
    }
    return lineas.length ? lineas : [""];
}

/** Líneas del contenido; sin `--full` se corta tras LINEAS_MAXIMAS con el total de caracteres. */
export function lineasDeContenido(texto: string, ancho: number, full: boolean): string[] {
    const lineas = envolver(texto, ancho);
    if (full || lineas.length <= LINEAS_MAXIMAS) return lineas;
    const total = Array.from(texto).length;
    return [...lineas.slice(0, LINEAS_MAXIMAS - 1), `… (${total} caracteres; usa --full para verlo completo)`];
}

const largo = (s: string) => Array.from(s).length;
const rellenar = (s: string, n: number) => s + " ".repeat(Math.max(0, n - largo(s)));

export type FilaCuadricula = { nombre: string; tipo: string; contenido: string };

/**
 * Cuadrícula con bordes y tres columnas: Nombre | Tipo | Contenido. Un contenido largo ocupa varias líneas dentro de su celda
 * (la fila crece hacia abajo; las otras columnas quedan alineadas arriba).
 */
export function renderCuadricula(filas: FilaCuadricula[], opciones: { ancho?: number; full?: boolean } = {}): string {
    const ancho = opciones.ancho ?? ANCHO_POR_DEFECTO;
    const full = opciones.full ?? false;
    const encabezado = ["Nombre", "Tipo", "Contenido"];
    const celdas = filas.map((f) => [envolver(f.nombre, 40), envolver(f.tipo, 40), lineasDeContenido(f.contenido, ancho, full)]);

    const anchos = encabezado.map((h, i) => Math.max(largo(h), ...celdas.flatMap((c) => c[i].map(largo))));
    const borde = (izq: string, mid: string, der: string) => izq + anchos.map((a) => "─".repeat(a + 2)).join(mid) + der;
    const linea = (valores: string[]) => "│ " + valores.map((v, i) => rellenar(v, anchos[i])).join(" │ ") + " │";

    const out: string[] = [borde("┌", "┬", "┐"), linea(encabezado), borde("├", "┼", "┤")];
    celdas.forEach((fila, idx) => {
        const alto = Math.max(...fila.map((c) => c.length));
        for (let l = 0; l < alto; l++) out.push(linea(fila.map((c) => c[l] ?? "")));
        if (idx < celdas.length - 1) out.push(borde("├", "┼", "┤"));
    });
    out.push(borde("└", "┴", "┘"));
    return out.join("\n");
}

/** Tabla de columnas del registro + valores, lista para `renderCuadricula`. */
export function armarFilas(columnas: ColumnaInfo[], registro: Record<string, unknown>): FilaCuadricula[] {
    const conocidas = new Set(columnas.map((c) => c.nombre));
    const filas = columnas.map((c) => ({
        nombre: c.nombre,
        tipo: c.tipo + (c.nulable ? "" : " NOT NULL") + (c.clave === "PRI" ? " PK" : ""),
        contenido: formatearValor(registro[c.nombre]),
    }));
    // Columnas que devolvió la consulta y no estaban en el catálogo (no debería pasar): se muestran igual, sin perder datos.
    for (const nombre of Object.keys(registro)) if (!conocidas.has(nombre)) filas.push({ nombre, tipo: "(desconocido)", contenido: formatearValor(registro[nombre]) });
    return filas;
}

export const AYUDA = `Búsqueda de un registro por id (SOLO LECTURA).

Uso:
  npx tsx scripts/buscarRegistro.ts <tabla> <id> [opciones]
  npx tsx scripts/buscarRegistro.ts                 (pregunta la tabla y el id)

Opciones:
  --pk=<columna>   columna por la que se busca (por defecto «id», o la clave primaria si es una sola)
  --db=<VARIABLE>  variable de entorno con la conexión (por defecto DATABASE_URL), p. ej. --db=DATABASE_URL_SECONDARY
  --ancho=<n>      ancho de la columna Contenido (${ANCHO_MINIMO}-${ANCHO_MAXIMO}, por defecto ${ANCHO_POR_DEFECTO})
  --full           muestra los contenidos largos completos (sin cortarlos)
  -h, --help       esta ayuda

Ejemplo:
  npx tsx scripts/buscarRegistro.ts c_marca_dia 12345
`;
