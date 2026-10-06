import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { apreciacionVulnerabilidad, filterRowsByScope, mapVulnerabilidadRow } from "./apreciacionVulnerabilidad";

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
