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
const { bitacoraNovedades, filterRowsByScope, mapBitacoraNovedadesRow } = require("./bitacoraNovedades") as typeof import("./bitacoraNovedades");

const raw = (o: Record<string, unknown> = {}) => ({
    id: 41, titulo: "Portón dañado", description: "d".repeat(900), categoria_id: 3, categoria_nombre: "Mantenimiento", relevancia: "Alta", is_modified: true,
    created_at: new Date("2026-09-10T14:30:00Z"), updated_at: new Date("2026-09-11T08:00:00Z"),
    firma_manual_responsable: "data:image/png;base64,AAAA", firma_responsable: "BBBB",
    empresa_id: 9, cliente_id: 4, division_id: 2, contrato_id: 31, corpo_id: 55, puesto_id: 140,
    empresa_nombre: "9 - Seguridad SA", cliente_nombre: "Cliente Uno", division_nombre: "Seguridad", contrato_nombre: "C-31 - Contrato", corpo_nombre: "55 - Sede", puesto_nombre: "P140 - Portón",
    ...o,
});

describe("bitacora_novedades: mapeo", () => {
    it("aplana la nota, recorta el texto largo y no expone firmas", () => {
        const o = mapBitacoraNovedadesRow(raw());
        assert.equal(o.id, 41);
        assert.equal(o.creado, "2026-09-10T14:30:00");
        assert.equal(o.modificado, "2026-09-11T08:00:00");
        assert.equal("actualizado" in o, false);
        assert.equal(o.titulo, "Portón dañado");
        assert.equal((o.descripcion as string).length, 500);
        assert.equal(o.categoria, "Mantenimiento");
        assert.equal(o.relevancia, "Alta");
        assert.equal(o.modificada, "Sí");
        assert.equal(o.sucursal, "55 - Sede");
        assert.equal(o.puesto, "P140 - Portón");
        assert.equal(o.ejecutivo_cuenta, null);
        assert.equal(o.creado_por, null);
        assert.equal(o.modificado_por, null);
        assert.equal("usuario_inserta" in o, false);
        const s = JSON.stringify(o);
        for (const secret of ["AAAA", "BBBB"]) assert.equal(s.includes(secret), false);
    });
    it("tolera nulos y nombres sin resolver", () => {
        const o = mapBitacoraNovedadesRow(raw({
            created_at: "2026-09-10 14:30:00.000", updated_at: null, description: null, categoria_id: null, categoria_nombre: "", relevancia: null, is_modified: false,
            cliente_id: 0, cliente_nombre: "0", division_id: 0, division_nombre: "0", contrato_id: 0, contrato_nombre: "0", corpo_id: 0, corpo_nombre: "0",
        }));
        assert.equal(o.creado, "2026-09-10T14:30:00");
        assert.equal(o.modificado, null);
        assert.equal(o.descripcion, null);
        assert.equal(o.categoria, null);
        assert.equal(o.relevancia, null);
        assert.equal(o.modificada, "No");
        assert.equal(o.cliente, null);
        assert.equal(o.sucursal, null);
        assert.equal(o.empresa, "9 - Seguridad SA");
    });
    it("agrega ejecutivo, creador y la división que da el puesto cuando la nota no la trae", () => {
        const o = mapBitacoraNovedadesRow(raw({ division_id: 0, division_nombre: "0" }), { ejecutivo_cuenta: "Laura Vega", division: "Seguridad", creado_por: "Luis Mora", modificado_por: "Ana Soto" });
        assert.deepEqual([o.division, o.ejecutivo_cuenta, o.creado_por, o.modificado_por], ["Seguridad", "Laura Vega", "Luis Mora", "Ana Soto"]);
        assert.equal(mapBitacoraNovedadesRow(raw(), { division: "Otra" }).division, "Seguridad");
    });
    it("lleva siempre las 11 columnas estándar (jerarquía y auditoría)", () => {
        const o = mapBitacoraNovedadesRow(raw(), { creado_por: "Luis Mora", modificado_por: "Ana Soto" });
        assert.deepEqual(
            ["empresa", "cliente", "division", "contrato", "sucursal", "puesto", "id", "creado", "creado_por", "modificado", "modificado_por"].map((k) => o[k]),
            ["9 - Seguridad SA", "Cliente Uno", "Seguridad", "C-31 - Contrato", "55 - Sede", "P140 - Portón", 41, "2026-09-10T14:30:00", "Luis Mora", "2026-09-11T08:00:00", "Ana Soto"],
        );
        const vacia = mapBitacoraNovedadesRow(raw({ empresa_id: 0, cliente_id: 0, division_id: 0, contrato_id: 0, corpo_id: 0, puesto_id: 0, created_at: null, updated_at: null }));
        for (const k of ["empresa", "cliente", "division", "contrato", "sucursal", "puesto", "creado", "creado_por", "modificado", "modificado_por"]) assert.equal(vacia[k], null, k);
    });
    it("su definición declara llaves coherentes con las columnas", () => {
        const o = mapBitacoraNovedadesRow(raw());
        for (const k of [...bitacoraNovedades.searchKeys, ...bitacoraNovedades.filterKeys, ...bitacoraNovedades.sortKeys, bitacoraNovedades.defaultSort]) assert.ok(k in o, k);
        assert.equal(bitacoraNovedades.id, "bitacora_novedades");
        assert.equal(bitacoraNovedades.supportsScope, true);
    });
});

describe("bitacora_novedades: alcance", () => {
    const tables: Record<string, any[]> = {
        e_estructura_puesto: [{ id: 140, sucursal_id: 55 }, { id: 141, sucursal_id: 56 }],
        e_estructura_sucursal: [{ id: 55, contrato_id: 31 }, { id: 56, contrato_id: 32 }],
        e_estructura_contrato: [{ id: 31, cliente_id: 4, empresa_id: 9, division_id: 2 }, { id: 32, cliente_id: 5, empresa_id: 9, division_id: 2 }],
    };
    const db = new Proxy({}, { get: (_t, name: string) => ({ findMany: async () => tables[name] ?? [] }) }) as any;
    const rows = [
        raw({ id: 1 }),
        raw({ id: 2, puesto_id: 141, corpo_id: 56, contrato_id: 32, cliente_id: 5 }),
        // nota antigua: solo trae puesto y empresa; el resto se ubica por el puesto
        raw({ id: 3, cliente_id: 0, division_id: 0, contrato_id: 0, corpo_id: 0 }),
        raw({ id: 4, puesto_id: 999, cliente_id: 0, division_id: 0, contrato_id: 0, corpo_id: 0 }),
    ];
    it("filtra por nivel y completa la ubicación de las notas antiguas desde el puesto", async () => {
        const ids = async (scope: any[]) => (await filterRowsByScope(db, rows, scope)).map((r) => r.id);
        assert.deepEqual(await ids([{ nivel: "contrato", id: 31 }]), [1, 3]);
        assert.deepEqual(await ids([{ nivel: "corpo", id: 55 }]), [1, 3]);
        assert.deepEqual(await ids([{ nivel: "corpo", id: 56 }]), [2]);
        assert.deepEqual(await ids([{ nivel: "puesto", id: 999 }]), [4]);
        assert.deepEqual(await ids([{ nivel: "empresa", id: 9 }]), [1, 2, 3, 4]);
        assert.deepEqual(await ids([]), []);
    });
});

describe("bitacora_novedades: ejecutivo y creador (carga en lote)", () => {
    const base = { titulo: "N", description: "d", categoria_id: 3, relevancia: "Alta", is_modified: false, created_at: new Date("2026-09-10T14:30:00Z"), updated_at: new Date("2026-09-11T08:00:00Z"), firma_manual_responsable: "AAAA", firma_responsable: "BBBB", isActive: true, empresa_id: 9, cliente_id: 4, division_id: 2, contrato_id: 31, corpo_id: 55, puesto_id: 140 };
    const tables: Record<string, any[]> = {
        c_puesto_notas: [
            { ...base, id: 1 },
            // nota antigua: solo trae puesto y empresa; sucursal, contrato y división salen del puesto
            { ...base, id: 2, puesto_id: 141, cliente_id: 0, division_id: 0, contrato_id: 0, corpo_id: 0 },
            { ...base, id: 3 },
        ],
        e_estructura_empresa: [{ id: 9, nombre: "Seguridad SA", codigo: "9" }],
        e_estructura_cliente: [{ id: 4, nombre: "Cliente Uno" }],
        n_division: [{ id: 2, nombre: "Seguridad" }],
        e_estructura_contrato: [{ id: 31, nombre: "Contrato", nro_contrato: "C-31", cliente_id: 4, empresa_id: 9, division_id: 2 }],
        e_estructura_sucursal: [{ id: 55, nombre: "Sede", nro_sucursal: "55", contrato_id: 31, ejecutivoCuenta_id: 5 }, { id: 56, nombre: "Norte", nro_sucursal: null, contrato_id: 31, ejecutivoCuenta_id: null }],
        e_estructura_puesto: [{ id: 140, nombre: "Portón", codigo: "P140", sucursal_id: 55 }, { id: 141, nombre: "Garita", codigo: null, sucursal_id: 56 }],
        n_ejecutivo_cuenta: [{ id: 5, nombre: "Laura Vega" }],
        c_empleado: [{ id: 77, nombre: "Luis", primer_apellido: "Mora", segundo_apellido: null }, { id: 78, nombre: "Ana", primer_apellido: "Soto", segundo_apellido: null }],
        n_novedades_categoria: [{ id: 3, nombre: "Mantenimiento" }],
        c_cambios_apps_modules: [
            { id: 22, nombre_tabla: "c_puesto_notas", registro_id: 1, created_by: 78 },
            { id: 21, nombre_tabla: "c_puesto_notas", registro_id: 1, created_by: 77 },
            { id: 24, nombre_tabla: "c_puesto_notas", registro_id: 3, created_by: 77 }, // solo el alta: sin modificación
            { id: 23, nombre_tabla: "c_boleta_apreciacion_vulnerabilidad", registro_id: 2, created_by: 78 }, // otra tabla: no cuenta
        ],
    };
    const calls: string[] = [];
    const db = new Proxy({}, {
        get: (_t, name: string) => ({
            findMany: async (args: any = {}) => {
                calls.push(name);
                const ids: number[] | undefined = args?.where?.id?.in;
                const regs: number[] | undefined = args?.where?.registro_id?.in;
                const tabla: string | undefined = args?.where?.nombre_tabla;
                return (tables[name] ?? []).filter((r) => (!ids || ids.includes(r.id)) && (!regs || regs.includes(r.registro_id)) && (!tabla || r.nombre_tabla === tabla));
            },
        }),
    }) as any;
    const P = { from: "2026-09-01", to: "2026-10-01", page: 1, pageSize: 50, sort: null, dir: "desc" as const, q: null, filters: [], scope: null };

    it("agrega ejecutivo de cuenta, división y quién lo registró (primer cambio) sin consultas por fila", async () => {
        calls.length = 0;
        const rows = await bitacoraNovedades.load(db, P);
        const by = (id: number) => rows.find((r) => r.id === id)!;
        assert.deepEqual([by(1).ejecutivo_cuenta, by(1).creado_por, by(1).modificado_por, by(1).division, by(1).categoria], ["Laura Vega", "Luis Mora", "Ana Soto", "Seguridad", "Mantenimiento"]);
        assert.deepEqual([by(2).ejecutivo_cuenta, by(2).creado_por, by(2).modificado_por, by(2).division], [null, null, null, "Seguridad"]);
        assert.deepEqual([by(3).creado_por, by(3).modificado_por], ["Luis Mora", null]);
        assert.equal(calls.filter((c) => c === "c_cambios_apps_modules").length, 1);
        assert.equal(calls.filter((c) => c === "n_ejecutivo_cuenta").length, 1);
        const s = JSON.stringify(rows);
        for (const secret of ["AAAA", "BBBB"]) assert.equal(s.includes(secret), false);
    });
    it("alcance y llaves", async () => {
        assert.deepEqual((await bitacoraNovedades.load(db, { ...P, scope: [{ nivel: "corpo", id: 56 }] })).map((r) => r.id), [2]);
        assert.deepEqual(await bitacoraNovedades.load(db, { ...P, scope: [] }), []);
        const [r] = await bitacoraNovedades.load(db, P);
        for (const k of [...bitacoraNovedades.searchKeys, ...bitacoraNovedades.filterKeys, ...bitacoraNovedades.sortKeys, bitacoraNovedades.defaultSort]) assert.ok(k in r!, k);
    });
});
