/**
 * Búsqueda de un registro por id (SOLO LECTURA): muestra todos los datos de la fila en una cuadrícula «Nombre | Tipo | Contenido».
 *
 *   npx tsx scripts/buscarRegistro.ts <tabla> <id> [--pk=<columna>] [--db=<VARIABLE>] [--ancho=<n>] [--full]
 *   npx tsx scripts/buscarRegistro.ts            → pregunta la tabla y el id
 *
 * Solo ejecuta consultas SELECT: la tabla y la columna se validan contra el catálogo de la base (`information_schema`) y el id viaja como parámetro,
 * nunca dentro del texto de la consulta. Se conecta con la variable `DATABASE_URL` (o la indicada con --db). Al conectarse muestra el servidor y
 * la base, nunca las credenciales: confirma que es el ambiente correcto antes de leer datos.
 */
import dotenv from "dotenv";
import readline from "node:readline/promises";
import { PrismaClient } from "@prisma/client";
import {
    AYUDA,
    armarFilas,
    elegirClave,
    esIdentificadorSeguro,
    parseBuscarArgs,
    renderCuadricula,
    validarId,
    validarTabla,
    type ColumnaInfo,
} from "../utils/buscarRegistro";

dotenv.config({ quiet: true });

/** Cuántas filas se muestran como máximo si la columna elegida no es única (p. ej. `--pk` con repetidos). */
const MAX_FILAS = 5;

async function preguntar(texto: string): Promise<string> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
        return (await rl.question(texto)).trim();
    } finally {
        rl.close();
    }
}

/** Servidor y base, sin usuario ni contraseña. */
function destino(url: string): string {
    try {
        const u = new URL(url);
        return `${u.host}${u.pathname}`;
    } catch {
        return "(url no reconocida)";
    }
}

async function main() {
    const args = parseBuscarArgs(process.argv.slice(2));
    if (args.ayuda) {
        console.log(AYUDA);
        return;
    }

    const tabla = validarTabla(args.tabla ?? (await preguntar("Tabla: ")));
    const id = validarId(args.id ?? (await preguntar("Id: ")));

    const url = process.env[args.dbEnv];
    if (!url) throw new Error(`La variable de entorno ${args.dbEnv} no está definida.`);
    const prisma = new PrismaClient({ datasources: { db: { url } }, log: ["error"] });

    try {
        console.log(`Base: ${destino(url)}  (solo lectura)`);

        const existentes = await prisma.$queryRawUnsafe<{ nombre: string }[]>(
            "SELECT TABLE_NAME AS nombre FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
            tabla,
        );
        // MySQL puede ser sensible a mayúsculas según el sistema: se usa el nombre exacto que reporta el catálogo.
        const nombreTabla = existentes[0]?.nombre ?? null;
        if (!nombreTabla) {
            const parecidas = await prisma.$queryRawUnsafe<{ nombre: string }[]>(
                "SELECT TABLE_NAME AS nombre FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME LIKE ? ORDER BY TABLE_NAME LIMIT 10",
                `%${tabla.replace(/[%_\\]/g, "\\$&")}%`,
            );
            const sugerencia = parecidas.length ? ` ¿Quisiste decir: ${parecidas.map((t) => t.nombre).join(", ")}?` : "";
            throw new Error(`La tabla «${tabla}» no existe en esa base.${sugerencia}`);
        }
        if (!esIdentificadorSeguro(nombreTabla)) throw new Error(`El nombre de tabla «${nombreTabla}» tiene caracteres no admitidos por este script.`);

        const columnasCrudas = await prisma.$queryRawUnsafe<{ nombre: string; tipo: string; nulable: string; clave: string }[]>(
            "SELECT COLUMN_NAME AS nombre, COLUMN_TYPE AS tipo, IS_NULLABLE AS nulable, COLUMN_KEY AS clave FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION",
            nombreTabla,
        );
        const columnas: ColumnaInfo[] = columnasCrudas.map((c) => ({ nombre: String(c.nombre), tipo: String(c.tipo), nulable: String(c.nulable).toUpperCase() === "YES", clave: String(c.clave ?? "") }));
        if (columnas.length === 0) throw new Error(`No se pudieron leer las columnas de «${nombreTabla}».`);

        const clave = elegirClave(columnas, args.pk);
        if (!esIdentificadorSeguro(clave)) throw new Error(`El nombre de columna «${clave}» tiene caracteres no admitidos por este script.`);

        // Solo SELECT: la tabla y la columna ya salieron del catálogo y pasaron la validación; el id va como parámetro.
        const filas = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(`SELECT * FROM \`${nombreTabla}\` WHERE \`${clave}\` = ? LIMIT ${MAX_FILAS + 1}`, id);

        if (filas.length === 0) {
            console.log(`\nNo hay ningún registro en «${nombreTabla}» con ${clave} = ${id}.`);
            process.exitCode = 1;
            return;
        }

        const mostrar = filas.slice(0, MAX_FILAS);
        mostrar.forEach((registro, i) => {
            const titulo = mostrar.length > 1 ? ` (${i + 1} de ${mostrar.length}${filas.length > MAX_FILAS ? "+" : ""})` : "";
            console.log(`\n${nombreTabla} · ${clave} = ${id}${titulo} · ${columnas.length} columnas\n`);
            console.log(renderCuadricula(armarFilas(columnas, registro), { ancho: args.ancho, full: args.full }));
        });
        if (filas.length > MAX_FILAS) console.log(`\nHay más de ${MAX_FILAS} registros con ese valor; se muestran los primeros ${MAX_FILAS}.`);
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((e) => {
    console.error(`\nError: ${e instanceof Error ? e.message : e}`);
    console.error("Usa --help para ver cómo se usa.");
    process.exitCode = 1;
});
