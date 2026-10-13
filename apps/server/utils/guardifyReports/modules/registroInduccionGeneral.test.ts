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
const { mapInduccionGeneralRow, registroInduccionGeneral } = require("./registroInduccionGeneral") as typeof import("./registroInduccionGeneral");

function fakeDb(tables: Record<string, any[]>) {
    return new Proxy({}, {
        get: (_t, name: string) => ({
            findMany: async (args: any = {}) => {
                const rows = tables[name] ?? [];
                const w = args.where ?? {};
                const ids = w.id?.in as number[] | undefined;
                return rows
                    .filter((r) => !ids || ids.includes(r.id))
                    .filter((r) => !w.nombre_tabla || r.nombre_tabla === w.nombre_tabla)
                    .filter((r) => !w.registro_id?.in || w.registro_id.in.includes(r.registro_id))
                    .filter((r) => !w.cambios?.contains || String(r.cambios).includes(w.cambios.contains));
            },
        }),
    }) as any;
}

const P = { from: "2026-09-01", to: "2026-10-01", page: 1, pageSize: 50, sort: null, dir: "desc" as const, q: null, filters: [], scope: null };

const TEMAS = JSON.stringify({ sections: [{ id: "1", text: "Presentación", items: [{ id: "1", text: "Presentación", checked: true }] }, { id: "2", text: "Políticas", items: [{ id: "2.1", text: "Vacaciones", checked: false }, { id: "2.2", text: "Feriados", checked: true }] }] });

const registro = (id: number, contrato: number) => ({
    id, empresa_id: 1, cliente_id: 5, division_id: 3, contrato_id: contrato, corpo_id: 10, puesto_id: 100 + id,
    division: "Aseo", fecha: new Date("2026-09-12T14:00:00Z"), created_at: new Date("2026-09-12T15:00:00Z"), created_by: "7", isActive: true,
    temas_a_tratar: TEMAS, firma_responsable: "data:image/png;base64,RESP",
});

describe("registro de inducción general", () => {
    it("mapea una fila representativa, con nulos, sin firmas", () => {
        const o = mapInduccionGeneralRow({
            ...registro(1, 20),
            empresa_nombre: "9 - Empresa", cliente_nombre: "Cliente SA", division_nombre: "Aseo", contrato_nombre: "20 - Con", corpo_nombre: "1 - Suc", puesto_nombre: "A - Pu1",
            empleado_creador_nombre: "E7 - Ana Soto",
            colaboradores: JSON.stringify([{ nombre: "Juan", cedula: "1-1", puesto_text: "Peón", firma: "data:image/png;base64,F1" }, { nombre: "Rosa", cedula: "" }]),
            capacitadores: JSON.stringify([{ nombre: "Marta", cedula: "2-2", firma: "F2" }]),
        });
        assert.equal(o.creado, "2026-09-12T15:00:00");
        assert.equal(o.fecha, "2026-09-12T14:00:00");
        assert.equal(o.responsable, "E7 - Ana Soto");
        assert.equal(o.temas_marcados, 2);
        assert.equal(o.colaboradores, 2);
        assert.equal(o.nombres_colaboradores, "Juan (1-1); Rosa");
        assert.equal(o.capacitadores, 1);
        assert.equal(o.nombres_capacitadores, "Marta (2-2)");
        const json = JSON.stringify(o);
        for (const secreto of ["base64", "RESP", "F1", "F2"]) assert.equal(json.includes(secreto), false, secreto);
        assert.equal(o.participantes, "Juan (1-1); Rosa; Marta (2-2)");
        assert.equal(o.codigos_colaboradores, null);
        assert.equal(o.ejecutivo_cuenta, null);
        assert.equal(o.creado_por, null);
    });
    it("columnas estándar: 6 de jerarquía + 5 de auditoría (creado = created_at, creado_por = created_by, modificado del historial)", () => {
        const o = mapInduccionGeneralRow({
            ...registro(1, 20),
            empresa_nombre: "9 - Empresa", cliente_nombre: "Cliente SA", division_nombre: "D - Aseo", contrato_nombre: "20 - Con", corpo_nombre: "1 - Suc", puesto_nombre: "A - Pu1",
            creado_por: "Ana Soto", modificado: "2026-09-13T08:30:00", modificado_por: "Luis Mora",
        });
        assert.equal(o.id, 1);
        assert.equal(o.empresa, "9 - Empresa");
        assert.equal(o.cliente, "Cliente SA");
        assert.equal(o.division, "D - Aseo");
        assert.equal(o.contrato, "20 - Con");
        assert.equal(o.sucursal, "1 - Suc");
        assert.equal(o.puesto, "A - Pu1");
        assert.equal(o.creado, "2026-09-12T15:00:00");
        assert.equal(o.creado_por, "Ana Soto");
        assert.equal(o.modificado, "2026-09-13T08:30:00");
        assert.equal(o.modificado_por, "Luis Mora");
        assert.ok(!("usuario_inserta" in o));
        const sin = mapInduccionGeneralRow({ id: 9, puesto_id: 0, puesto_nombre: "0" });
        assert.equal(sin.puesto, null);
        assert.equal(sin.modificado, null);
        assert.equal(sin.modificado_por, null);
    });
    it("columnas para los filtros: «código - nombre (cédula)», códigos de colaboradores, ejecutivo y usuario que registró", () => {
        const o = mapInduccionGeneralRow(
            {
                ...registro(1, 20), ejecutivo_cuenta: "Marta Ruiz", creado_por: "Ana Soto",
                colaboradores: JSON.stringify([{ nombre: "Juan", cedula: "1-1" }, { nombre: "Rosa", cedula: "2-2" }, { nombre: "Luis", cedula: "3-3" }]),
                capacitadores: JSON.stringify([{ nombre: "Marta", cedula: "9-9" }]),
            },
            new Map([["1-1", "1934"], ["3-3", "1934"], ["9-9", "55"]]),
        );
        assert.equal(o.nombres_colaboradores, "1934 - Juan (1-1); Rosa (2-2); 1934 - Luis (3-3)");
        assert.equal(o.nombres_capacitadores, "55 - Marta (9-9)");
        assert.equal(o.codigos_colaboradores, "1934"); // sin repetir; el código del capacitador no entra
        assert.equal(o.participantes, "1934 - Juan (1-1); Rosa (2-2); 1934 - Luis (3-3); 55 - Marta (9-9)");
        assert.equal(o.ejecutivo_cuenta, "Marta Ruiz");
        assert.equal(o.creado_por, "Ana Soto");
    });
    it("una fila casi vacía no rompe", () => {
        const o = mapInduccionGeneralRow({ id: 3, temas_a_tratar: null, colaboradores: "[]", capacitadores: undefined, empresa_nombre: "0" });
        assert.equal(o.temas_marcados, 0);
        assert.equal(o.colaboradores, 0);
        assert.equal(o.nombres_colaboradores, null);
        assert.equal(o.capacitadores, 0);
        assert.equal(o.empresa, null);
        assert.equal(o.creado, null);
    });
    it("las claves de búsqueda, filtro y orden existen en la fila", () => {
        const o = mapInduccionGeneralRow(registro(1, 20));
        for (const k of [...registroInduccionGeneral.searchKeys, ...registroInduccionGeneral.filterKeys, ...registroInduccionGeneral.sortKeys, registroInduccionGeneral.defaultSort]) assert.ok(k in o, k);
    });
    it("con alcance filtra por la ubicación de cada fila", async () => {
        const db = fakeDb({
            c_registro_induccion_general: [registro(1, 20), registro(2, 21)],
            c_colaboradores_induccion_general: [{ registro_id: 2, nombre: "Juan", cedula: "1", puesto_text: "x", puesto_id: 1, firma: "S" }],
            n_ejecutivo_cuenta: [{ id: 50, nombre: "Marta Ejecutiva" }],
            c_capacitadores_induccion_general: [],
            e_estructura_empresa: [{ id: 1, nombre: "Emp", codigo: "9" }],
            e_estructura_cliente: [{ id: 5, nombre: "Cli" }],
            n_division: [{ id: 3, nombre: "Div", codigo: "D" }],
            e_estructura_contrato: [{ id: 20, nombre: "A", nro_contrato: "20" }, { id: 21, nombre: "B", nro_contrato: "21" }],
            e_estructura_sucursal: [{ id: 10, nombre: "Suc", nro_sucursal: "1", ejecutivoCuenta_id: 50 }],
            e_estructura_puesto: [{ id: 101, nombre: "Pu1", codigo: "A" }, { id: 102, nombre: "Pu2", codigo: "B" }],
            c_empleado: [{ id: 7, codigo: "E7", cedula: "1", nombre: "Ana", primer_apellido: "Soto", segundo_apellido: null }, { id: 8, codigo: "E8", cedula: "8", nombre: "Luis", primer_apellido: "Mora", segundo_apellido: null }],
            c_cambios_apps_modules: [
                { id: 1, nombre_tabla: "c_registro_induccion_general", registro_id: 1, cambios: '[{"prop":"__created__"}]', created_by: 7, created_at: new Date("2026-09-12T15:00:00Z") },
                { id: 2, nombre_tabla: "c_registro_induccion_general", registro_id: 1, cambios: '[{"prop":"fecha"}]', created_by: 8, created_at: new Date("2026-09-13T08:30:00Z") },
                { id: 3, nombre_tabla: "c_registro_induccion_general", registro_id: 1, cambios: '[{"prop":"temas"}]', created_by: 7, created_at: new Date("2026-09-14T09:00:00Z") },
                { id: 4, nombre_tabla: "c_registro_induccion_general", registro_id: 2, cambios: '[{"prop":"__created__"}]', created_by: 7, created_at: new Date("2026-09-12T15:00:00Z") },
                { id: 5, nombre_tabla: "otra_tabla", registro_id: 2, cambios: '[{"prop":"x"}]', created_by: 8, created_at: new Date("2026-09-20T09:00:00Z") },
            ],
        });
        const todos = await registroInduccionGeneral.load(db, P);
        assert.equal(todos.length, 2);
        // enriquecimiento por lote: ejecutivo de la sucursal, quien registró y el código del colaborador (cédula «1» → E7)
        assert.deepEqual(todos.map((x) => [x.id, x.ejecutivo_cuenta, x.creado_por, x.codigos_colaboradores]).sort(), [[1, "Marta Ejecutiva", "Ana Soto", null], [2, "Marta Ejecutiva", "Ana Soto", "E7"]]);
        // modificado: última edición del historial, sin contar el alta (`__created__`) ni otras tablas
        assert.deepEqual(todos.map((x) => [x.id, x.modificado, x.modificado_por]).sort(), [[1, "2026-09-14T09:00:00", "Ana Soto"], [2, null, null]]);
        assert.equal(todos.find((x) => x.id === 2)?.nombres_colaboradores, "E7 - Juan (1)");
        const r = await registroInduccionGeneral.load(db, { ...P, scope: [{ nivel: "corpo", id: 10 }, { nivel: "contrato", id: 99 }] });
        assert.equal(r.length, 2);
        const solo = await registroInduccionGeneral.load(db, { ...P, scope: [{ nivel: "contrato", id: 21 }] });
        assert.deepEqual(solo.map((x) => [x.id, x.colaboradores, x.contrato]), [[2, 1, "21 - B"]]);
        assert.deepEqual(await registroInduccionGeneral.load(db, { ...P, scope: [] }), []);
    });
});
