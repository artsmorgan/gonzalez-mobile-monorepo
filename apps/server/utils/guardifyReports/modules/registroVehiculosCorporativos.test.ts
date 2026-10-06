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
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { mapVehiculoCorporativoRow, registroVehiculosCorporativos } = require("./registroVehiculosCorporativos") as typeof import("./registroVehiculosCorporativos");

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

const vehiculo = (id: number, contrato: number, extra: Record<string, unknown> = {}) => ({
    id, empresa_id: 1, cliente_id: 5, division_id: 3, contrato_id: contrato, sucursal_id: 10, puesto_id: 100 + id,
    placa: `ABC-${id}`, tipo: "Vehículo", marca: "Toyota", modelo: "Hilux", anno: 2020, kilometraje: 45000, prox_cambio_aceite: 50000,
    estado: "Operativo", tipo_autoria: "Propio", descripcion: "Pick up", titulo_propiedad: true, rtv: true, marchamo: false, isActive: true,
    created_at: new Date("2026-09-05T10:00:00Z"), created_by: 7,
    c_usos_vehiculos_corporativos: [{ id: 1, vehiculo_id: id, nombre_conductor: "Ana", codigo_conductor: "7", fecha: new Date("2026-09-06T00:00:00Z"), inicio: new Date("2026-09-06T08:00:00Z"), fin: new Date("2026-09-06T17:00:00Z"), km_inicio: 1, km_fin: 2, motivo: "m", combustible_inicio: "1/2", combustible_fin: "1/4" }],
    c_mantenimiento_vehiculos_corporativos: [],
    ...extra,
});

describe("registro de vehículos corporativos", () => {
    it("mapea una fila representativa, con nulos", () => {
        const o = mapVehiculoCorporativoRow({
            id: 4, created_at: new Date("2026-09-05T10:00:00Z"), placa: "ABC-4", tipo: "Moto", marca: "Honda", modelo: "", anno: null, kilometraje: 1200, prox_cambio_aceite: null,
            estado: "Taller", tipo_autoria: "Alquilado", descripcion: "d".repeat(800), titulo_propiedad_txt: "Sí", rtv_txt: "No", marchamo_txt: "", activo_txt: "Sí",
            empresa_txt: "9 - Emp", cliente_txt: "Cli", division_txt: "", contrato_txt: "C", corpo_txt: "S", puesto_txt: "P", usos_count: 3, mantenimientos_count: 0,
        });
        assert.equal(o.id, 4);
        assert.equal(o.creado, "2026-09-05T10:00:00");
        assert.equal(o.modelo, null);
        assert.equal(o.anno, null);
        assert.equal(o.kilometraje, 1200);
        assert.equal(o.prox_cambio_aceite, null);
        assert.equal(o.marchamo, null);
        assert.equal(o.division, null);
        assert.equal(o.sucursal, "S");
        assert.equal(String(o.descripcion).length, 500);
        assert.deepEqual([o.usos, o.mantenimientos], [3, 0]);
    });
    it("las claves de búsqueda, filtro y orden existen en la fila", () => {
        const o = mapVehiculoCorporativoRow({ id: 1 });
        for (const k of [...registroVehiculosCorporativos.searchKeys, ...registroVehiculosCorporativos.filterKeys, ...registroVehiculosCorporativos.sortKeys, registroVehiculosCorporativos.defaultSort]) assert.ok(k in o, k);
    });
    it("con alcance filtra por la ubicación de cada vehículo", async () => {
        const db = fakeDb({
            c_vehiculos_corporativos: [vehiculo(1, 20), vehiculo(2, 21)],
            e_estructura_empresa: [{ id: 1, nombre: "Emp", codigo: "9" }],
            e_estructura_cliente: [{ id: 5, nombre: "Cli" }],
            n_division: [{ id: 3, nombre: "Div", codigo: "D" }],
            e_estructura_contrato: [{ id: 20, nombre: "A", nro_contrato: "20" }, { id: 21, nombre: "B", nro_contrato: "21" }],
            e_estructura_sucursal: [{ id: 10, nombre: "Suc", nro_sucursal: "1" }],
            e_estructura_puesto: [{ id: 101, nombre: "Pu1", codigo: "A" }, { id: 102, nombre: "Pu2", codigo: "B" }],
        });
        const all = await registroVehiculosCorporativos.load(db, P);
        assert.deepEqual(all.map((r) => r.id).sort(), [1, 2]);
        assert.deepEqual(all.find((r) => r.id === 1)?.usos, 1);
        const sucursal = await registroVehiculosCorporativos.load(db, { ...P, scope: [{ nivel: "corpo", id: 10 }] });
        assert.equal(sucursal.length, 2);
        const uno = await registroVehiculosCorporativos.load(db, { ...P, scope: [{ nivel: "puesto", id: 102 }] });
        assert.deepEqual(uno.map((r) => [r.id, r.placa, r.contrato, r.puesto]), [[2, "ABC-2", "21 - B", "B - Pu2"]]);
        assert.deepEqual(await registroVehiculosCorporativos.load(db, { ...P, scope: [] }), []);
    });
});
