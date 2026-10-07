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
const { apreciacionVulnerabilidad, filterRowsByScope, mapVulnerabilidadRow } = require("./apreciacionVulnerabilidad") as typeof import("./apreciacionVulnerabilidad");

const raw = (o: Record<string, unknown> = {}) => ({
    id: 31, fecha: new Date("2026-09-09T10:15:00Z"), nombre_solicitante: "Rosa Vega", enlace: "https://secreto/boleta", observaciones: "o".repeat(900),
    boleta: JSON.stringify([
        { key: "perimetro", title: "Perímetro", items: [{ label: "¿Cerca?", answer: "Sí" }] },
        { key: "accesos", title: "Accesos", items: JSON.stringify([{ label: "¿Portón?", answer: "No" }]) },
        { key: "porcentaje_vulnerabilidad", title: "Resultado", vulnerabilityLevel: "Alto" },
    ]),
    metricas_vulnerablidad: JSON.stringify(["Riesgo 1", "Riesgo 2"]),
    firma_solicitante: "AAAA", firma_responsable: "BBBB", firma_solicitante_data_uri: "data:image/png;base64,AAAA",
    empresa_id: 9, cliente_id: 4, division_id: 2, contrato_id: 31, corpo_id: 55, puesto_id: 140,
    empresa_nombre: "9 - Seguridad SA", cliente_nombre: "Cliente Uno", division_nombre: "Seguridad", contrato_nombre: "C-31 - Contrato", corpo_nombre: "55 - Sede", puesto_nombre: "P140 - Portón",
    ...o,
});

describe("apreciacion_vulnerabilidad: mapeo", () => {
    it("aplana la boleta a nivel, secciones y métricas, sin firmas ni enlace", () => {
        const o = mapVulnerabilidadRow(raw());
        assert.equal(o.id, 31);
        assert.equal(o.fecha, "2026-09-09T10:15:00");
        assert.equal(o.solicitante, "Rosa Vega");
        assert.equal(o.nivel_vulnerabilidad, "Alto");
        assert.equal(o.secciones, 2);
        assert.equal(o.metricas, "Riesgo 1; Riesgo 2");
        assert.equal((o.observaciones as string).length, 500);
        assert.equal(o.puesto, "P140 - Portón");
        assert.equal(o.ejecutivo_cuenta, null);
        assert.equal(o.usuario_inserta, null);
        const s = JSON.stringify(o);
        for (const secret of ["AAAA", "BBBB", "secreto"]) assert.equal(s.includes(secret), false);
    });
    it("tolera nulos, JSON inválido y nombres sin resolver", () => {
        const o = mapVulnerabilidadRow(raw({
            fecha: "2026-09-09 10:15:00", nombre_solicitante: null, boleta: "{roto", metricas_vulnerablidad: null, observaciones: " ",
            contrato_id: 0, contrato_nombre: "0", division_id: 0, division_nombre: "0",
        }));
        assert.equal(o.fecha, "2026-09-09T10:15:00");
        assert.equal(o.solicitante, null);
        assert.equal(o.nivel_vulnerabilidad, null);
        assert.equal(o.secciones, 0);
        assert.equal(o.metricas, null);
        assert.equal(o.observaciones, null);
        assert.equal(o.contrato, null);
        assert.equal(o.division, null);
    });
    it("agrega ejecutivo, creador y la división que da el puesto cuando la fila no la trae", () => {
        const o = mapVulnerabilidadRow(raw({ division_id: 0, division_nombre: "0" }), { ejecutivo_cuenta: "Laura Vega", division: "Seguridad", usuario_inserta: "Luis Mora" });
        assert.deepEqual([o.division, o.ejecutivo_cuenta, o.usuario_inserta], ["Seguridad", "Laura Vega", "Luis Mora"]);
        assert.equal(mapVulnerabilidadRow(raw(), { division: "Otra" }).division, "Seguridad");
    });
    it("ignora métricas que no son texto", () => {
        assert.equal(mapVulnerabilidadRow(raw({ metricas_vulnerablidad: JSON.stringify(["A", { x: 1 }, 3]) })).metricas, "A; 3");
    });
    it("su definición declara llaves coherentes con las columnas", () => {
        const o = mapVulnerabilidadRow(raw());
        for (const k of [...apreciacionVulnerabilidad.searchKeys, ...apreciacionVulnerabilidad.filterKeys, ...apreciacionVulnerabilidad.sortKeys, apreciacionVulnerabilidad.defaultSort]) assert.ok(k in o, k);
        assert.equal(apreciacionVulnerabilidad.id, "apreciacion_vulnerabilidad");
        assert.equal(apreciacionVulnerabilidad.supportsScope, true);
    });
});

describe("apreciacion_vulnerabilidad: alcance", () => {
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

describe("apreciacion_vulnerabilidad: ejecutivo y creador (carga en lote)", () => {
    const base = { fecha: new Date("2026-09-09T10:15:00Z"), enlace: "https://secreto", nombre_solicitante: "Rosa", boleta: "[]", metricas_vulnerablidad: "[]", observaciones: null, firma_solicitante: "AAAA", firma_responsable: "BBBB", isActive: true, empresa_id: 9, cliente_id: 4, division_id: 2, contrato_id: 31, corpo_id: 55, puesto_id: 140 };
    const tables: Record<string, any[]> = {
        c_boleta_apreciacion_vulnerabilidad: [
            { ...base, id: 1 },
            // registro antiguo: sin división ni contrato; se ubica por su puesto
            { ...base, id: 2, puesto_id: 141, corpo_id: 56, division_id: 0, contrato_id: 0, empresa_id: 0 },
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
        c_cambios_apps_modules: [
            // el primer cambio (menor id) es quien lo registró; los posteriores son ediciones
            { id: 12, nombre_tabla: "c_boleta_apreciacion_vulnerabilidad", registro_id: 1, created_by: 78 },
            { id: 11, nombre_tabla: "c_boleta_apreciacion_vulnerabilidad", registro_id: 1, created_by: 77 },
            { id: 13, nombre_tabla: "c_puesto_notas", registro_id: 2, created_by: 78 }, // otra tabla: no cuenta
            { id: 14, nombre_tabla: "c_boleta_apreciacion_vulnerabilidad", registro_id: 3, created_by: 0 },
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
        const rows = await apreciacionVulnerabilidad.load(db, P);
        const by = (id: number) => rows.find((r) => r.id === id)!;
        assert.deepEqual([by(1).ejecutivo_cuenta, by(1).usuario_inserta, by(1).division], ["Laura Vega", "Luis Mora", "Seguridad"]);
        assert.deepEqual([by(2).ejecutivo_cuenta, by(2).usuario_inserta, by(2).division], [null, null, "Seguridad"]);
        assert.equal(by(3).usuario_inserta, null);
        assert.equal(calls.filter((c) => c === "c_cambios_apps_modules").length, 1);
        assert.equal(calls.filter((c) => c === "n_ejecutivo_cuenta").length, 1);
        const s = JSON.stringify(rows);
        for (const secret of ["AAAA", "BBBB", "secreto"]) assert.equal(s.includes(secret), false);
    });
    it("alcance y llaves", async () => {
        assert.deepEqual((await apreciacionVulnerabilidad.load(db, { ...P, scope: [{ nivel: "corpo", id: 56 }] })).map((r) => r.id), [2]);
        assert.deepEqual(await apreciacionVulnerabilidad.load(db, { ...P, scope: [] }), []);
        const [r] = await apreciacionVulnerabilidad.load(db, P);
        for (const k of [...apreciacionVulnerabilidad.searchKeys, ...apreciacionVulnerabilidad.filterKeys, ...apreciacionVulnerabilidad.sortKeys, apreciacionVulnerabilidad.defaultSort]) assert.ok(k in r!, k);
    });
});
