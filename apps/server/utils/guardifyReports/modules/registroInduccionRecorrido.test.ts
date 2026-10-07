import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Los reportes de `reports-functions/` importan paquetes que solo sirven para armar el Excel/ZIP/Word (`exceljs`,
 * `archiver`, `docx`…). Si alguno no está instalado en este entorno se sustituye por un objeto vacío: aquí nunca se
 * genera un archivo, solo se prueban el mapeo y el alcance. Si está instalado se usa el real.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const NodeModule = require("node:module");
const realLoad = NodeModule._load;
/** Sustituto inerte: cualquier propiedad o llamada devuelve otro sustituto (algunos reportes leen constantes al cargarse). */
const inert: any = new Proxy(function () {}, { get: (_t, k) => (k === "__esModule" ? false : inert), apply: () => inert, construct: () => inert });
NodeModule._load = function (request: string, ...rest: unknown[]) {
    try {
        return realLoad.call(this, request, ...rest);
    } catch (e: any) {
        if (e?.code === "MODULE_NOT_FOUND" && !request.startsWith(".") && !request.startsWith("/")) return inert;
        throw e;
    }
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { mapInduccionRecorridoRow, registroInduccionRecorrido, codigosPorCedula } = require("./registroInduccionRecorrido") as typeof import("./registroInduccionRecorrido");

/** Base falsa: cada tabla devuelve sus filas (respetando `where.id.in` cuando se usa para cargar la estructura). */
function fakeDb(tables: Record<string, any[]>) {
    return new Proxy({}, {
        get: (_t, name: string) => ({
            findMany: async (args: any = {}) => {
                const rows = tables[name] ?? [];
                const ids = args.where?.id?.in as number[] | undefined;
                return ids ? rows.filter((r) => ids.includes(r.id)) : rows;
            },
        }),
    }) as any;
}

const P = { from: "2026-09-01", to: "2026-10-01", page: 1, pageSize: 50, sort: null, dir: "desc" as const, q: null, filters: [], scope: null };

const registro = (id: number, contrato: number) => ({
    id, empresa_id: 1, cliente_id: 5, division_id: 3, contrato_id: contrato, corpo_id: 10, puesto_id: 100 + id, plaza_id: null,
    fecha: new Date("2026-09-10T08:30:00Z"), created_at: new Date("2026-09-10T09:00:00Z"), created_by: "7", isActive: true,
    renglon_edificio: "Torre A", supervisor_cliente: "Pedro", supervisor_corporacion: "Luis",
    temas_desarrollados: JSON.stringify([{ tema: "Limpieza", respuesta: "Sí" }, { tema: "Seguridad", respuesta: "No" }]),
    aspectos_especificos: JSON.stringify([{ aspecto: "Extintores" }]),
    firma_supervisor: "data:image/png;base64,AAAA", firma_responsable: "BBBB",
});

describe("registro de inducción y recorrido", () => {
    it("mapea una fila representativa, con nulos, sin firmas", () => {
        const o = mapInduccionRecorridoRow({
            ...registro(1, 20),
            empresa_nombre: "9 - Empresa", cliente_nombre: "Cliente SA", division_nombre: "0", contrato_nombre: "C-20 - Contrato", corpo_nombre: "S1 - Sucursal",
            puesto_nombre: "P1 - Puesto", plaza_nombre: "", created_by_nombre: "E7 - Ana Soto",
            participantes: JSON.stringify([{ nombre_completo: "Juan Pérez", cedula: "1-111", firma: "data:image/png;base64,CCCC" }, { nombre_completo: "Sin cédula", cedula: "" }]),
        });
        assert.equal(o.id, 1);
        assert.equal(o.creado, "2026-09-10T09:00:00");
        assert.equal(o.fecha_visita, "2026-09-10T08:30:00");
        assert.equal(o.division, null);
        assert.equal(o.plaza, null);
        assert.equal(o.puesto, "P1 - Puesto");
        assert.equal(o.responsable, "E7 - Ana Soto");
        assert.equal(o.temas, "Limpieza; Seguridad");
        assert.equal(o.aspectos, "Extintores");
        assert.equal(o.participantes, 2);
        assert.equal(o.nombres_participantes, "Juan Pérez (1-111); Sin cédula");
        const json = JSON.stringify(o);
        assert.equal(json.includes("base64"), false);
        assert.equal(json.includes("BBBB"), false);
        assert.equal(Object.keys(o).some((k) => k.startsWith("firma")), false);
        assert.equal(o.ejecutivo_cuenta, null);
        assert.equal(o.usuario_inserta, null);
    });
    it("columnas para los filtros: ejecutivo, usuario que registró y participantes «código - nombre (cédula)»", () => {
        const o = mapInduccionRecorridoRow(
            { ...registro(1, 20), ejecutivo_cuenta: " Marta Ruiz ", usuario_inserta: "Ana Soto", participantes: JSON.stringify([{ nombre_completo: "Juan Pérez", cedula: "1-111" }, { nombre_completo: "Rosa", cedula: "2-2" }, { nombre_completo: "", cedula: "3-3" }]) },
            new Map([["1-111", "1934"], ["3-3", "77"]]),
        );
        assert.equal(o.ejecutivo_cuenta, "Marta Ruiz");
        assert.equal(o.usuario_inserta, "Ana Soto");
        assert.equal(o.nombres_participantes, "1934 - Juan Pérez (1-111); Rosa (2-2); 77 - 3-3");
        // las columnas nuevas van al final de la fila
        assert.deepEqual(Object.keys(o).slice(-2), ["ejecutivo_cuenta", "usuario_inserta"]);
    });
    it("código de empleado por cédula: solo si es único; por bloques", async () => {
        const calls: number[] = [];
        const db: any = { c_empleado: { findMany: async (a: any) => {
            calls.push(a.where.cedula.in.length);
            return [{ cedula: "1", codigo: "A" }, { cedula: "2", codigo: "B" }, { cedula: "2", codigo: "C" }, { cedula: "3", codigo: "" }, { cedula: " 4 ", codigo: " D " }];
        } } };
        const m = await codigosPorCedula(db, ["1", "2", "3", "4", "1", "", null]);
        assert.deepEqual([...m], [["1", "A"], ["4", "D"]]); // «2» es ambigua y «3» no tiene código
        assert.deepEqual(calls, [4]);
        const grande = await codigosPorCedula(db, Array.from({ length: 2500 }, (_, i) => String(i + 1)));
        assert.equal(grande.size, 2);
        assert.deepEqual(calls.slice(1), [1000, 1000, 500]);
    });
    it("una fila casi vacía no rompe y recorta los textos largos", () => {
        const o = mapInduccionRecorridoRow({ id: 2, empresa_nombre: "1", empresa_id: 1, temas_desarrollados: null, participantes: "no es json", renglon_edificio: "x".repeat(900) });
        assert.equal(o.empresa, null); // el nombre era el id: no hay nombre
        assert.equal(o.creado, null);
        assert.equal(o.temas, null);
        assert.equal(o.participantes, 0);
        assert.equal(String(o.renglon_edificio).length, 500);
    });
    it("las claves de búsqueda, filtro y orden existen en la fila", () => {
        const o = mapInduccionRecorridoRow(registro(1, 20));
        for (const k of [...registroInduccionRecorrido.searchKeys, ...registroInduccionRecorrido.filterKeys, ...registroInduccionRecorrido.sortKeys, registroInduccionRecorrido.defaultSort]) assert.ok(k in o, k);
    });
    it("sin alcance trae todo y con alcance filtra por contrato o puesto", async () => {
        const db = fakeDb({
            c_registro_induccion_recorrido: [registro(1, 20), registro(2, 21)],
            c_participantes_induccion_recorrido: [{ registro_id: 1, nombre_completo: "Ana", cedula: "1", firma: "zzz" }],
            e_estructura_empresa: [{ id: 1, nombre: "Emp", codigo: "9" }],
            e_estructura_cliente: [{ id: 5, nombre: "Cli" }],
            n_division: [{ id: 3, nombre: "Div", codigo: "D" }],
            e_estructura_contrato: [{ id: 20, nombre: "Con A", nro_contrato: "20" }, { id: 21, nombre: "Con B", nro_contrato: "21" }],
            e_estructura_puesto: [{ id: 101, nombre: "Pu1", codigo: "A" }, { id: 102, nombre: "Pu2", codigo: "B" }],
            c_empleado: [{ id: 7, codigo: "E7", cedula: "1", nombre: "Ana", primer_apellido: "Soto", segundo_apellido: null }],
            e_estructura_sucursal: [{ id: 10, nombre: "Suc", nro_sucursal: "1", ejecutivoCuenta_id: 50 }],
            n_ejecutivo_cuenta: [{ id: 50, nombre: "Marta Ejecutiva" }],
        });
        const all = await registroInduccionRecorrido.load(db, P);
        // enriquecimiento por lote: ejecutivo de la sucursal, quien registró (created_by "7") y el código del participante (cédula «1»)
        assert.deepEqual(all.map((r) => [r.id, r.ejecutivo_cuenta, r.usuario_inserta]).sort(), [[1, "Marta Ejecutiva", "Ana Soto"], [2, "Marta Ejecutiva", "Ana Soto"]]);
        assert.equal(all.find((r) => r.id === 1)?.nombres_participantes, "E7 - Ana (1)");
        assert.deepEqual(all.map((r) => r.id).sort(), [1, 2]);
        const byContrato = await registroInduccionRecorrido.load(db, { ...P, scope: [{ nivel: "contrato", id: 21 }] });
        assert.deepEqual(byContrato.map((r) => r.id), [2]);
        const byPuesto = await registroInduccionRecorrido.load(db, { ...P, scope: [{ nivel: "puesto", id: 101 }] });
        assert.deepEqual(byPuesto.map((r) => [r.id, r.puesto, r.responsable, r.participantes]), [[1, "A - Pu1", "E7 - Ana Soto", 1]]);
        assert.deepEqual(await registroInduccionRecorrido.load(db, { ...P, scope: [] }), []);
    });
});
