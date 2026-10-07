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
const { agendaMinuta, creadorId, filterRowsByScope, mapAgendaMinutaRow } = require("./agendaMinuta") as typeof import("./agendaMinuta");

const raw = (o: Record<string, unknown> = {}) => ({
    id: 12, numero: 3, titulo: "Reunión mensual", fecha: new Date("2026-09-09T00:00:00Z"), created_at: new Date("2026-09-10T14:30:00Z"),
    hora_inicio_txt: "08:00", hora_fin_txt: "09:30", autor: "Ana Soto", created_by: "77", estado: true,
    empresa_id: 9, cliente_id: 4, division_id: 2, contrato_id: 31, corpo_id: 55, puesto_id: 140,
    empresa_nombre: "9 - Seguridad SA", cliente_nombre: "Cliente Uno", division_nombre: "Seguridad", contrato_nombre: "C-31 - Contrato", corpo_nombre: "55 - Sede", puesto_nombre: "P140 - Portón",
    participantes: JSON.stringify([{ nombre: "Pedro", puesto: "Guarda", firma: "data:image/png;base64,AAAA" }, { nombre: "Juan", puesto: "Jefe", firma: null }]),
    acuerdos: JSON.stringify({ items: [{ texto: "Revisar rondas", responsable: "Pedro", fecha_limite: "2026-09-30" }] }),
    temas_a_tratar: JSON.stringify(["Rondas", "Turnos"]),
    observaciones: "o".repeat(900), firma_responsable: "AAAA",
    ...o,
});

describe("agenda_minuta: mapeo", () => {
    it("aplana la fila, cuenta participantes y acuerdos y no expone firmas", () => {
        const o = mapAgendaMinutaRow(raw(), new Map([[77, "Luis Mora"]]));
        assert.equal(o.id, 12);
        assert.equal(o.fecha, "2026-09-09T00:00:00");
        assert.equal(o.creado, "2026-09-10T14:30:00");
        assert.equal(o.creado_por, "Luis Mora");
        assert.equal(o.estado, "Completado");
        assert.equal(o.completadas, "Sí");
        assert.equal(o.ejecutivo_cuenta, null);
        assert.equal(o.hora_inicio, "08:00");
        assert.equal(o.puesto, "P140 - Portón");
        assert.equal(o.sucursal, "55 - Sede");
        assert.equal(o.participantes, 2);
        assert.equal(o.acuerdos, 1);
        assert.equal(o.temas, "Rondas; Turnos");
        assert.equal((o.observaciones as string).length, 500);
        assert.equal(JSON.stringify(o).includes("AAAA"), false);
        assert.equal("firma_responsable" in o, false);
    });
    it("tolera nulos, JSON inválido y nombres sin resolver", () => {
        const o = mapAgendaMinutaRow(raw({
            fecha: "2026-09-09", created_at: "2026-09-10 14:30:00.000", created_by: "abc", estado: false, autor: " ", numero: null, titulo: null,
            participantes: "no es json", acuerdos: null, temas_a_tratar: null, observaciones: null, hora_inicio_txt: "",
            empresa_id: 0, empresa_nombre: "0", division_id: 0, division_nombre: "0", contrato_id: 0, contrato_nombre: "0",
        }));
        assert.equal(o.fecha, "2026-09-09T00:00:00");
        assert.equal(o.creado, "2026-09-10T14:30:00");
        assert.equal(o.creado_por, "abc"); // texto que no es un id de empleado: se deja tal cual
        assert.equal(o.estado, "Pendiente");
        assert.equal(o.completadas, "No");
        assert.equal(o.autor, null);
        assert.equal(o.numero, null);
        assert.equal(o.titulo, null);
        assert.equal(o.participantes, 0);
        assert.equal(o.acuerdos, 0);
        assert.equal(o.temas, null);
        assert.equal(o.observaciones, null);
        assert.equal(o.hora_inicio, null);
        assert.equal(o.empresa, null);
        assert.equal(o.division, null);
        assert.equal(o.contrato, null);
        assert.equal(o.cliente, "Cliente Uno");
    });
    it("completa división y ejecutivo con los extras cuando la fila no los trae", () => {
        const o = mapAgendaMinutaRow(raw({ division_id: 0, division_nombre: "0" }), new Map(), { ejecutivo_cuenta: "Laura Vega", division: "Seguridad" });
        assert.equal(o.division, "Seguridad");
        assert.equal(o.ejecutivo_cuenta, "Laura Vega");
        assert.equal(mapAgendaMinutaRow(raw(), new Map(), { division: "Otra" }).division, "Seguridad");
    });
    it("lee el id del creador", () => {
        assert.equal(creadorId("77"), 77);
        assert.equal(creadorId(""), null);
        assert.equal(creadorId("x"), null);
    });
    it("su definición declara llaves coherentes con las columnas", () => {
        const o = mapAgendaMinutaRow(raw());
        for (const k of [...agendaMinuta.searchKeys, ...agendaMinuta.filterKeys, ...agendaMinuta.sortKeys, agendaMinuta.defaultSort]) assert.ok(k in o, k);
        assert.equal(agendaMinuta.id, "agenda_minuta");
        assert.equal(agendaMinuta.supportsScope, true);
    });
});

describe("agenda_minuta: alcance", () => {
    const tables: Record<string, any[]> = {
        e_estructura_puesto: [{ id: 140, sucursal_id: 55 }, { id: 141, sucursal_id: 56 }],
        e_estructura_sucursal: [{ id: 55, contrato_id: 31 }, { id: 56, contrato_id: 32 }],
        e_estructura_contrato: [{ id: 31, cliente_id: 4, empresa_id: 9, division_id: 2 }, { id: 32, cliente_id: 5, empresa_id: 9, division_id: 2 }],
    };
    const db = new Proxy({}, { get: (_t, name: string) => ({ findMany: async () => tables[name] ?? [] }) }) as any;
    const rows = [
        raw({ id: 1 }),
        raw({ id: 2, puesto_id: 141, corpo_id: 56, contrato_id: 32, cliente_id: 5 }),
        // registro antiguo: sin empresa, división ni contrato; se ubica por su puesto (140 → contrato 31)
        raw({ id: 3, empresa_id: 0, division_id: 0, contrato_id: 0 }),
        raw({ id: 4, puesto_id: 999, corpo_id: 999, cliente_id: 99, empresa_id: 0, division_id: 0, contrato_id: 0 }),
    ];
    it("filtra por contrato, sucursal o puesto, y ubica los registros antiguos por su puesto", async () => {
        const ids = async (scope: any[]) => (await filterRowsByScope(db, rows, scope)).map((r) => r.id);
        assert.deepEqual(await ids([{ nivel: "contrato", id: 31 }]), [1, 3]);
        assert.deepEqual(await ids([{ nivel: "corpo", id: 56 }]), [2]);
        assert.deepEqual(await ids([{ nivel: "puesto", id: 140 }, { nivel: "puesto", id: 141 }]), [1, 2, 3]);
        assert.deepEqual(await ids([{ nivel: "empresa", id: 9 }]), [1, 2, 3]);
        assert.deepEqual(await ids([{ nivel: "cliente", id: 99 }]), [4]);
        assert.deepEqual(await ids([]), []);
    });
});

describe("agenda_minuta: periodo, ejecutivo y creador (carga en lote)", () => {
    const base = { numero: 1, titulo: "R", hora_inicio: new Date("1970-01-01T08:00:00Z"), hora_fin: new Date("1970-01-01T09:00:00Z"), autor: "Ana", participantes: "[]", acuerdos: "[]", temas_a_tratar: "[]", observaciones: "", firma_responsable: "AAAA", estado: true, isActive: true, empresa_id: 9, cliente_id: 4, division_id: 2, contrato_id: 31, corpo_id: 55, puesto_id: 140, created_at: new Date("2026-09-10T14:30:00Z") };
    const tables: Record<string, any[]> = {
        c_agenda_minuta: [
            { ...base, id: 1, fecha: new Date("2026-09-09T00:00:00Z"), created_by: "77" },
            // reunión del 30/09 registrada el 02/10: entra por su fecha aunque se creó fuera del periodo
            { ...base, id: 2, fecha: new Date("2026-09-30T00:00:00Z"), created_by: "correo@x.test", created_at: new Date("2026-10-02T10:00:00Z"), division_id: 0, contrato_id: 0, empresa_id: 0, puesto_id: 141, corpo_id: 56, estado: false },
            // reunión del 01/10: fuera (to exclusivo), aunque se creó en el periodo
            { ...base, id: 3, fecha: new Date("2026-10-01T00:00:00Z"), created_by: "77", created_at: new Date("2026-09-20T10:00:00Z") },
            // reunión del 31/08: fuera, aunque se creó dentro
            { ...base, id: 4, fecha: new Date("2026-08-31T00:00:00Z"), created_by: "77", created_at: new Date("2026-09-02T10:00:00Z") },
        ],
        e_estructura_empresa: [{ id: 9, nombre: "Seguridad SA", codigo: "9" }],
        e_estructura_cliente: [{ id: 4, nombre: "Cliente Uno" }],
        n_division: [{ id: 2, nombre: "Seguridad" }],
        e_estructura_contrato: [{ id: 31, nombre: "Contrato", nro_contrato: "C-31", cliente_id: 4, empresa_id: 9, division_id: 2 }],
        e_estructura_sucursal: [{ id: 55, nombre: "Sede", nro_sucursal: "55", contrato_id: 31, ejecutivoCuenta_id: 5 }, { id: 56, nombre: "Norte", nro_sucursal: null, contrato_id: 31, ejecutivoCuenta_id: null }],
        e_estructura_puesto: [{ id: 140, nombre: "Portón", codigo: "P140", sucursal_id: 55 }, { id: 141, nombre: "Garita", codigo: null, sucursal_id: 56 }],
        n_ejecutivo_cuenta: [{ id: 5, nombre: "Laura Vega" }],
        c_empleado: [{ id: 77, nombre: "Luis", primer_apellido: "Mora", segundo_apellido: null }],
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

    it("aplica el periodo [from, to) a la fecha de la reunión y agrega ejecutivo, completadas y creador sin consultas por fila", async () => {
        calls.length = 0;
        const rows = await agendaMinuta.load(db, P);
        assert.deepEqual(rows.map((r) => r.id).sort(), [1, 2]);
        const r1 = rows.find((r) => r.id === 1)!;
        assert.deepEqual([r1.fecha, r1.creado_por, r1.ejecutivo_cuenta, r1.completadas, r1.division], ["2026-09-09T00:00:00", "Luis Mora", "Laura Vega", "Sí", "Seguridad"]);
        // registro antiguo: sin división ni ejecutivo en su sucursal; la división sale de su puesto → sucursal → contrato
        const r2 = rows.find((r) => r.id === 2)!;
        assert.deepEqual([r2.creado_por, r2.ejecutivo_cuenta, r2.completadas, r2.division], ["correo@x.test", null, "No", "Seguridad"]);
        assert.ok(calls.filter((c) => c === "c_empleado").length <= 1);
        assert.ok(calls.filter((c) => c === "n_ejecutivo_cuenta").length <= 1);
        assert.equal(JSON.stringify(rows).includes("AAAA"), false);
    });
    it("alcance y llaves", async () => {
        assert.deepEqual((await agendaMinuta.load(db, { ...P, scope: [{ nivel: "corpo", id: 56 }] })).map((r) => r.id), [2]);
        assert.deepEqual(await agendaMinuta.load(db, { ...P, scope: [] }), []);
        const [r] = await agendaMinuta.load(db, P);
        for (const k of [...agendaMinuta.searchKeys, ...agendaMinuta.filterKeys, ...agendaMinuta.sortKeys, agendaMinuta.defaultSort]) assert.ok(k in r!, k);
    });
});
