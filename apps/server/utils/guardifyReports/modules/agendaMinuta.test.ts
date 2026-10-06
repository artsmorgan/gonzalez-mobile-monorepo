import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { agendaMinuta, creadorId, filterRowsByScope, mapAgendaMinutaRow } from "./agendaMinuta";

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
        assert.equal(o.creado_por, null);
        assert.equal(o.estado, "Pendiente");
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
