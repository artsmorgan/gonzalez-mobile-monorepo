import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseReportParams } from "../params";
import { loadMaestroQuejas, mapMaestroQuejaRow, maestroQuejas } from "./maestroQuejas";

const raw = {
    id: 40, created_at: new Date("2026-09-15T10:00:00Z"), fecha_queja: "2026-09-14", fecha_inicio: "2026-09-15", fecha_revision: "",
    empresa_id: 1, cliente_id: 2, division_id: 3, contrato_id: 4, corpo_id: 5, puesto_id: 6, plaza_id: 7,
    empresa_nombre: "9 - Empresa", cliente_nombre: "Cliente", division_nombre: "División", contrato_nombre: "C1 - Contrato", corpo_nombre: "S1 - Sucursal", puesto_nombre: "P1 - Puesto", plaza_nombre: "1 - PL - Plaza",
    sociedad: "Sociedad", nombre_realiza_queja: "Ana", cliente: "Cliente X", empresa_presenta_queja: "Empresa Y", persona_presenta_queja: "Pedro",
    medio_recepcion_queja: "Correo", tipo_cliente: "Externo", tipo_queja: null, ubicacion: "Lobby", nivel_queja: "Alto", motivo_queja: "Ausencia",
    descripcion_queja: "d".repeat(1500), resolucion_queja: "", accion_correctiva_preventiva: "Capacitar", estado: "Abierta", estimacion_dannio: null,
    created_by: "11", creado_por_nombre: "11 - Carla Soto", firma_responsable: "data:image/png;base64,AAAA",
};

describe("maestro de quejas: mapeo", () => {
    it("aplana la fila, convierte fechas de texto y recorta los textos largos", () => {
        const o = mapMaestroQuejaRow(raw);
        assert.equal(o.id, 40);
        assert.equal(o.creado, "2026-09-15T10:00:00");
        assert.deepEqual([o.fecha_queja, o.fecha_atencion, o.fecha_realizacion], ["2026-09-14T00:00:00", "2026-09-15T00:00:00", null]);
        assert.deepEqual([o.empresa, o.cliente, o.division, o.contrato, o.sucursal, o.puesto, o.plaza], ["9 - Empresa", "Cliente", "División", "C1 - Contrato", "S1 - Sucursal", "P1 - Puesto", "1 - PL - Plaza"]);
        assert.deepEqual([o.medio_recepcion, o.nivel_queja, o.estado, o.recibida_por, o.cliente_formulario], ["Correo", "Alto", "Abierta", "Ana", "Cliente X"]);
        assert.equal((o.descripcion as string).length, 500);
        assert.deepEqual([o.tipo_queja, o.resolucion, o.estimacion_dannio, o.creado_por], [null, null, null, "11 - Carla Soto"]);
    });
    it("nunca expone la firma", () => {
        const s = JSON.stringify(mapMaestroQuejaRow(raw));
        assert.equal(s.includes("base64"), false);
        assert.equal(s.includes("firma"), false);
    });
    it("tolera fechas inválidas y filas casi vacías", () => {
        const o = mapMaestroQuejaRow({ id: 1, fecha_queja: "14/09/2026", created_at: null });
        assert.deepEqual([o.creado, o.fecha_queja, o.empresa, o.estado], [null, null, null, null]);
    });
});

describe("maestro de quejas: carga y alcance", () => {
    const data = [{ ...raw, id: 1, contrato_id: 4 }, { ...raw, id: 2, contrato_id: 9, puesto_id: 99 }];
    let seen: any;
    const query = async (_db: any, filters: any, orderKey: string) => { seen = { filters, orderKey }; return data; };
    const params = (extra: Record<string, string> = {}) => parseReportParams(new URLSearchParams({ from: "2026-09-01", to: "2026-10-01", ...extra }));
    it("pide el periodo [from, to) con límite inclusivo al último día", async () => {
        await loadMaestroQuejas({} as any, params(), query);
        assert.deepEqual(seen.filters, { creadoDesde: "2026-09-01T00:00:00", creadoHasta: "2026-09-30T23:59:59" });
    });
    it("filtra por alcance y un alcance vacío no ve nada", async () => {
        assert.equal((await loadMaestroQuejas({} as any, params(), query)).length, 2);
        assert.deepEqual((await loadMaestroQuejas({} as any, params({ scope: "contrato:9" }), query)).map((r) => r.id), [2]);
        assert.deepEqual((await loadMaestroQuejas({} as any, params({ scope: "puesto:6,puesto:99" }), query)).map((r) => r.id), [1, 2]);
        assert.equal((await loadMaestroQuejas({} as any, params({ scope: "" }), query)).length, 0);
    });
    it("declara alcance y sus claves existen en la fila", () => {
        assert.equal(maestroQuejas.supportsScope, true);
        const o = mapMaestroQuejaRow(raw);
        for (const k of [...maestroQuejas.searchKeys, ...maestroQuejas.filterKeys, ...maestroQuejas.sortKeys, maestroQuejas.defaultSort]) assert.ok(k in o, k);
    });
});
