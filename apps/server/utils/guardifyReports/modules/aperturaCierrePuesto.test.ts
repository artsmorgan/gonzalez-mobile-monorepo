import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Las consultas originales (`reports-functions/`) importan paquetes que solo sirven para armar el Excel (`exceljs`, `axios`…).
 * Si alguno no está instalado en este entorno se sustituye por un objeto inerte: aquí nunca se genera un archivo. Si está
 * instalado se usa el real.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const NodeModule = require("node:module");
const realLoad = NodeModule._load;
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
const { aperturaCierrePuesto, filterRowsByScope, mapAperturaCierrePuestoRow } = require("./aperturaCierrePuesto") as typeof import("./aperturaCierrePuesto");

const raw = (o: Record<string, unknown> = {}) => ({
    id: 21, tipo: "apertura", tipo_txt: "apertura", fecha: new Date("2026-09-09T06:00:00Z"), created_at: new Date("2026-09-09T06:10:00Z"), created_by: 77, creador_nombre: "E77 - Luis Mora",
    empresa_id: 9, cliente_id: 4, division_id: 2, contrato_id: 31, corpo_id: 55, puesto_id: 140,
    empresa_nombre: "9 - Seguridad SA", cliente_nombre: "Cliente Uno", division_nombre: "Seguridad", contrato_nombre: "C-31 - Contrato", corpo_nombre: "55 - Sede", puesto_nombre: "P140 - Portón",
    nombre_representante_cliente: "Rosa Vega", nombre_representante_empresa_saliente: "Pedro Mena", nombre_representante_empresa_entrante: "Juan Sol",
    actividades: JSON.stringify([{ pregunta: "¿Luces?", respuesta: "Sí" }, { pregunta: "¿Puertas?", respuesta: "No", observaciones: "x" }]),
    inventario: JSON.stringify([{ activos_equipos: "Radio", numero_serie: "S1" }]),
    otras_observaciones: "o".repeat(900),
    firma_responsable_data_uri: "data:image/png;base64,AAAA", firma_responsable: "AAAA", firma_representante_cliente: "BBBB",
    imagenes_names: ["a.jpg", "b.jpg", "c.jpg"],
    ...o,
});

describe("apertura_cierre_puesto: mapeo", () => {
    it("aplana la fila, cuenta actividades/inventario/fotos y no expone firmas ni archivos", () => {
        const o = mapAperturaCierrePuestoRow(raw());
        assert.equal(o.id, 21);
        assert.equal(o.tipo, "Apertura");
        assert.equal(o.fecha, "2026-09-09T06:00:00");
        assert.equal(o.creado, "2026-09-09T06:10:00");
        assert.equal(o.creado_por, "E77 - Luis Mora");
        assert.equal(o.contrato, "C-31 - Contrato");
        assert.equal(o.puesto, "P140 - Portón");
        assert.equal(o.representante_saliente, "Pedro Mena");
        assert.equal(o.actividades, 2);
        assert.equal(o.inventario, 1);
        assert.equal(o.fotos, 3);
        assert.equal(o.ejecutivo_cuenta, null);
        assert.equal((o.observaciones as string).length, 500);
        const s = JSON.stringify(o);
        for (const secret of ["AAAA", "BBBB", "a.jpg"]) assert.equal(s.includes(secret), false);
    });
    it("tolera nulos, JSON inválido y nombres sin resolver", () => {
        const o = mapAperturaCierrePuestoRow(raw({
            tipo: " CIERRE ", tipo_txt: "CIERRE", creador_nombre: "77", otras_observaciones: null, actividades: "{roto", inventario: null, imagenes_names: undefined,
            nombre_representante_cliente: " ", empresa_id: 0, empresa_nombre: "0", fecha: "2026-09-09 18:00:00",
        }));
        assert.equal(o.tipo, "Cierre");
        assert.equal(o.fecha, "2026-09-09T18:00:00");
        assert.equal(o.creado_por, null);
        assert.equal(o.observaciones, null);
        assert.equal(o.actividades, 0);
        assert.equal(o.inventario, 0);
        assert.equal(o.fotos, 0);
        assert.equal(o.representante_cliente, null);
        assert.equal(o.empresa, null);
    });
    it("completa división y ejecutivo con los extras cuando la fila no los trae", () => {
        const o = mapAperturaCierrePuestoRow(raw({ division_id: 0, division_nombre: "0" }), { ejecutivo_cuenta: "Laura Vega", division: "Seguridad" });
        assert.equal(o.division, "Seguridad");
        assert.equal(o.ejecutivo_cuenta, "Laura Vega");
        assert.equal(mapAperturaCierrePuestoRow(raw(), { division: "Otra" }).division, "Seguridad");
    });
    it("su definición declara llaves coherentes con las columnas", () => {
        const o = mapAperturaCierrePuestoRow(raw());
        for (const k of [...aperturaCierrePuesto.searchKeys, ...aperturaCierrePuesto.filterKeys, ...aperturaCierrePuesto.sortKeys, aperturaCierrePuesto.defaultSort]) assert.ok(k in o, k);
        assert.equal(aperturaCierrePuesto.id, "apertura_cierre_puesto");
        assert.equal(aperturaCierrePuesto.supportsScope, true);
    });
});

describe("apertura_cierre_puesto: alcance", () => {
    const tables: Record<string, any[]> = {
        e_estructura_puesto: [{ id: 140, sucursal_id: 55 }, { id: 141, sucursal_id: 56 }],
        e_estructura_sucursal: [{ id: 55, contrato_id: 31 }, { id: 56, contrato_id: 32 }],
        e_estructura_contrato: [{ id: 31, cliente_id: 4, empresa_id: 9, division_id: 2 }, { id: 32, cliente_id: 5, empresa_id: 9, division_id: 2 }],
    };
    const db = new Proxy({}, { get: (_t, name: string) => ({ findMany: async () => tables[name] ?? [] }) }) as any;
    const rows = [
        raw({ id: 1 }),
        raw({ id: 2, puesto_id: 141, corpo_id: 56, contrato_id: 32, cliente_id: 5 }),
        raw({ id: 3, empresa_id: 0, division_id: 0, contrato_id: 0 }),
        raw({ id: 4, puesto_id: 999, corpo_id: 999, cliente_id: 99, empresa_id: 0, division_id: 0, contrato_id: 0 }),
    ];
    it("filtra por nivel y ubica los registros antiguos por su puesto", async () => {
        const ids = async (scope: any[]) => (await filterRowsByScope(db, rows, scope)).map((r) => r.id);
        assert.deepEqual(await ids([{ nivel: "contrato", id: 31 }]), [1, 3]);
        assert.deepEqual(await ids([{ nivel: "corpo", id: 56 }]), [2]);
        assert.deepEqual(await ids([{ nivel: "puesto", id: 140 }, { nivel: "puesto", id: 141 }]), [1, 2, 3]);
        assert.deepEqual(await ids([{ nivel: "cliente", id: 99 }]), [4]);
        assert.deepEqual(await ids([]), []);
    });
});

describe("apertura_cierre_puesto: periodo y ejecutivo (carga en lote)", () => {
    const base = { tipo: "apertura", actividades: "[]", inventario: "[]", otras_observaciones: null, nombre_representante_cliente: "R", nombre_representante_empresa_saliente: "S", nombre_representante_empresa_entrante: "E", firma_responsable: "AAAA", isActive: true, created_by: 77, empresa_id: 9, cliente_id: 4, division_id: 2, contrato_id: 31, corpo_id: 55, puesto_id: 140, created_at: new Date("2026-09-10T14:30:00Z") };
    const tables: Record<string, any[]> = {
        c_apertura_cierre_puesto: [
            { ...base, id: 1, fecha: new Date("2026-09-09T06:00:00Z") },
            // se hizo el 30/09 y se registró el 02/10 (sin conexión): entra por su fecha
            { ...base, id: 2, fecha: new Date("2026-09-30T23:30:00Z"), created_at: new Date("2026-10-02T10:00:00Z"), division_id: 0, contrato_id: 0, empresa_id: 0, puesto_id: 141, corpo_id: 56, tipo: "cierre" },
            // 01/10 00:00: fuera (to exclusivo)
            { ...base, id: 3, fecha: new Date("2026-10-01T00:00:00Z"), created_at: new Date("2026-09-20T10:00:00Z") },
            { ...base, id: 4, fecha: new Date("2026-08-31T23:59:59Z"), created_at: new Date("2026-09-02T10:00:00Z") },
        ],
        e_estructura_empresa: [{ id: 9, nombre: "Seguridad SA", codigo: "9" }],
        e_estructura_cliente: [{ id: 4, nombre: "Cliente Uno" }],
        n_division: [{ id: 2, nombre: "Seguridad" }],
        e_estructura_contrato: [{ id: 31, nombre: "Contrato", nro_contrato: "C-31", cliente_id: 4, empresa_id: 9, division_id: 2 }],
        e_estructura_sucursal: [{ id: 55, nombre: "Sede", nro_sucursal: "55", contrato_id: 31, ejecutivoCuenta_id: 5 }, { id: 56, nombre: "Norte", nro_sucursal: null, contrato_id: 31, ejecutivoCuenta_id: null }],
        e_estructura_puesto: [{ id: 140, nombre: "Portón", codigo: "P140", sucursal_id: 55 }, { id: 141, nombre: "Garita", codigo: null, sucursal_id: 56 }],
        n_ejecutivo_cuenta: [{ id: 5, nombre: "Laura Vega" }],
        c_empleado: [{ id: 77, codigo: "E77", nombre: "Luis", primer_apellido: "Mora", segundo_apellido: null }],
        c_imagenes_apertura_cierre_puesto: [],
    };
    const calls: string[] = [];
    const db = new Proxy({}, {
        get: (_t, name: string) => ({
            findMany: async (args: any = {}) => {
                calls.push(name);
                const ids: number[] | undefined = args?.where?.id?.in;
                return (tables[name] ?? []).filter((r) => !ids || ids.includes(r.id));
            },
        }),
    }) as any;
    const P = { from: "2026-09-01", to: "2026-10-01", page: 1, pageSize: 50, sort: null, dir: "desc" as const, q: null, filters: [], scope: null };

    it("aplica el periodo [from, to) a `fecha` y agrega ejecutivo y división sin consultas por fila", async () => {
        calls.length = 0;
        const rows = await aperturaCierrePuesto.load(db, P);
        assert.deepEqual(rows.map((r) => r.id).sort(), [1, 2]);
        const r1 = rows.find((r) => r.id === 1)!;
        assert.deepEqual([r1.fecha, r1.creado_por, r1.ejecutivo_cuenta, r1.division, r1.tipo], ["2026-09-09T06:00:00", "E77 - Luis Mora", "Laura Vega", "Seguridad", "Apertura"]);
        const r2 = rows.find((r) => r.id === 2)!;
        assert.deepEqual([r2.ejecutivo_cuenta, r2.division, r2.tipo], [null, "Seguridad", "Cierre"]);
        assert.ok(calls.filter((c) => c === "n_ejecutivo_cuenta").length <= 1);
        assert.equal(JSON.stringify(rows).includes("AAAA"), false);
    });
    it("alcance y llaves", async () => {
        assert.deepEqual((await aperturaCierrePuesto.load(db, { ...P, scope: [{ nivel: "corpo", id: 56 }] })).map((r) => r.id), [2]);
        assert.deepEqual(await aperturaCierrePuesto.load(db, { ...P, scope: [] }), []);
        const [r] = await aperturaCierrePuesto.load(db, P);
        for (const k of [...aperturaCierrePuesto.searchKeys, ...aperturaCierrePuesto.filterKeys, ...aperturaCierrePuesto.sortKeys, aperturaCierrePuesto.defaultSort]) assert.ok(k in r!, k);
    });
});
