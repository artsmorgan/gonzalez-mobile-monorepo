import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { aperturaCierrePuesto, filterRowsByScope, mapAperturaCierrePuestoRow } from "./aperturaCierrePuesto";

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
