import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bitacoraNovedades, filterRowsByScope, mapBitacoraNovedadesRow } from "./bitacoraNovedades";

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
        assert.equal(o.actualizado, "2026-09-11T08:00:00");
        assert.equal(o.titulo, "Portón dañado");
        assert.equal((o.descripcion as string).length, 500);
        assert.equal(o.categoria, "Mantenimiento");
        assert.equal(o.relevancia, "Alta");
        assert.equal(o.modificada, "Sí");
        assert.equal(o.sucursal, "55 - Sede");
        assert.equal(o.puesto, "P140 - Portón");
        const s = JSON.stringify(o);
        for (const secret of ["AAAA", "BBBB"]) assert.equal(s.includes(secret), false);
    });
    it("tolera nulos y nombres sin resolver", () => {
        const o = mapBitacoraNovedadesRow(raw({
            created_at: "2026-09-10 14:30:00.000", updated_at: null, description: null, categoria_id: null, categoria_nombre: "", relevancia: null, is_modified: false,
            cliente_id: 0, cliente_nombre: "0", division_id: 0, division_nombre: "0", contrato_id: 0, contrato_nombre: "0", corpo_id: 0, corpo_nombre: "0",
        }));
        assert.equal(o.creado, "2026-09-10T14:30:00");
        assert.equal(o.actualizado, null);
        assert.equal(o.descripcion, null);
        assert.equal(o.categoria, null);
        assert.equal(o.relevancia, null);
        assert.equal(o.modificada, "No");
        assert.equal(o.cliente, null);
        assert.equal(o.sucursal, null);
        assert.equal(o.empresa, "9 - Seguridad SA");
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
