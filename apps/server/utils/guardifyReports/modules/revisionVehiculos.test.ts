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
const { mapRevisionVehiculoRow, revisionVehiculos } = require("./revisionVehiculos") as typeof import("./revisionVehiculos");

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

const P = { from: "2026-09-01", to: "2026-10-01", page: 1, pageSize: 50, sort: null, dir: "desc" as const, q: null, filters: {}, scope: null };

const GENERAL = JSON.stringify([
    { key: "numero_placa", label: "Número placa", kind: "text", value: "XYZ-123" },
    { key: "marca", label: "Marca", kind: "text", value: "Nissan" },
    { key: "color", label: "Color", kind: "text", value: "Rojo" },
    { key: "km", label: "KM", kind: "text", value: "12000" },
    { key: "combustible", label: "Combustible", kind: "select", value: "1/2" },
    { key: "firma_oficial_transito", label: "Firma", kind: "signature", value: "data:image/png;base64,FIRMA" },
    { key: "nombre_oficial_transito", label: "Oficial", kind: "text", value: "Fulano" },
]);
const REVISION = JSON.stringify([
    { kind: "heading", label: "Accesorios externos" },
    { key: "rev_espejos", label: "Espejos", kind: "select", value: "Bueno", images: ["a.jpg", "b.jpg"] },
    { key: "rev_llantas", label: "Llantas", kind: "select", value: "Malo", observation: "gastadas", images: ["c.jpg"] },
    { key: "funciona_motor", label: "¿Funciona el motor?", kind: "radio", value: "Sí" },
]);

const bitacora = (id: number, contrato: number, extra: Record<string, unknown> = {}) => ({
    id, tipo: "Vehículo", empresa_id: 1, cliente_id: 5, division_id: 3, contrato_id: contrato, sucursal_id: 10, puesto_id: 100 + id, vehiculo_id: null,
    observaciones: "Sin novedad", created_at: new Date("2026-09-08T11:00:00Z"), created_by: 7, isActive: true,
    informacion_general: GENERAL, informacion_revision: REVISION, movimientos_vehiculos: JSON.stringify([{ movimiento: "Ingreso" }, { movimiento: "Salida" }]),
    firma_responsable: "data:image/png;base64,RESP", ...extra,
});

describe("revisión de vehículos", () => {
    it("mapea una fila representativa: solo conteo de fotos, sin firmas ni nombres de archivo", () => {
        const o = mapRevisionVehiculoRow({
            ...bitacora(1, 20, { vehiculo_id: 9 }),
            empresa_txt: "Emp", cliente_txt: "Cli", division_txt: "0", contrato_txt: "Con", corpo_txt: "Suc", puesto_txt: "Pu", vehiculo_txt: "ABC-1 · Toyota Hilux (Vehículo)",
        });
        assert.equal(o.creado, "2026-09-08T11:00:00");
        assert.equal(o.tipo, "Vehículo");
        assert.equal(o.vehiculo, "ABC-1 · Toyota Hilux (Vehículo)");
        assert.deepEqual([o.placa, o.marca, o.color, o.kilometraje, o.combustible], ["XYZ-123", "Nissan", "Rojo", "12000", "1/2"]);
        assert.equal(o.division, null);
        assert.equal(o.puntos_revisados, 3);
        assert.equal(o.movimientos, 0); // viene de la consulta original (`movimientos_count`)
        assert.equal(o.fotos, 3);
        const json = JSON.stringify(o);
        for (const secreto of ["base64", "FIRMA", "RESP", ".jpg", "Fulano"]) assert.equal(json.includes(secreto), false, secreto);
    });
    it("una fila casi vacía o con JSON roto no rompe", () => {
        const o = mapRevisionVehiculoRow({ id: 5, vehiculo_id: null, vehiculo_txt: "—", informacion_general: "no es json", informacion_revision: null, movimientos_count: 2, observaciones: "o".repeat(900) });
        assert.equal(o.vehiculo, null);
        assert.equal(o.placa, null);
        assert.equal(o.creado, null);
        assert.equal(o.puntos_revisados, 0);
        assert.equal(o.fotos, 0);
        assert.equal(o.movimientos, 2);
        assert.equal(String(o.observaciones).length, 500);
    });
    it("nunca devuelve una imagen aunque venga en un campo de texto", () => {
        const o = mapRevisionVehiculoRow({ id: 6, informacion_general: JSON.stringify([{ key: "marca", kind: "text", value: "data:image/png;base64,ZZZ" }, { key: "color", kind: "text", value: "foto.png" }]) });
        assert.equal(o.marca, null);
        assert.equal(o.color, null);
    });
    it("las claves de búsqueda, filtro y orden existen en la fila", () => {
        const o = mapRevisionVehiculoRow({ id: 1 });
        for (const k of [...revisionVehiculos.searchKeys, ...revisionVehiculos.filterKeys, ...revisionVehiculos.sortKeys, revisionVehiculos.defaultSort]) assert.ok(k in o, k);
    });
    it("con alcance filtra por la ubicación de cada revisión (sucursal = corpo)", async () => {
        const db = fakeDb({
            c_bitacora_vehiculo_detenido: [bitacora(1, 20, { vehiculo_id: 9 }), bitacora(2, 21)],
            c_vehiculos_corporativos: [{ id: 9, placa: "ABC-9", marca: "Toyota", modelo: "Hilux", tipo: "Vehículo" }],
            e_estructura_empresa: [{ id: 1, nombre: "Emp", codigo: "9" }],
            e_estructura_cliente: [{ id: 5, nombre: "Cli" }],
            n_division: [{ id: 3, nombre: "Div", codigo: "D" }],
            e_estructura_contrato: [{ id: 20, nombre: "A", nro_contrato: "20" }, { id: 21, nombre: "B", nro_contrato: "21" }],
            e_estructura_sucursal: [{ id: 10, nombre: "Suc", nro_sucursal: "1" }],
            e_estructura_puesto: [{ id: 101, nombre: "Pu1", codigo: "A" }, { id: 102, nombre: "Pu2", codigo: "B" }],
        });
        const all = await revisionVehiculos.load(db, P);
        assert.deepEqual(all.map((r) => r.id).sort(), [1, 2]);
        assert.equal(all.find((r) => r.id === 1)?.vehiculo, "ABC-9 · Toyota Hilux (Vehículo)");
        assert.equal((await revisionVehiculos.load(db, { ...P, scope: [{ nivel: "corpo", id: 10 }] })).length, 2);
        const uno = await revisionVehiculos.load(db, { ...P, scope: [{ nivel: "contrato", id: 21 }] });
        assert.deepEqual(uno.map((r) => [r.id, r.contrato, r.sucursal, r.puesto]), [[2, "B", "Suc", "Pu2"]]);
        assert.deepEqual(await revisionVehiculos.load(db, { ...P, scope: [] }), []);
    });
});
