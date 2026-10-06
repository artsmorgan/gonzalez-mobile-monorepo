import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filterIncidentesByScope, incidentes, mapIncidenteRow } from "./incidentes";

const raw = (o: Record<string, unknown> = {}) => ({
    id: 7, created_at: new Date("2026-09-10T14:30:00Z"), fecha_incidente: new Date("2026-09-09T00:00:00Z"), fecha_reporte: new Date("2026-09-10T00:00:00Z"),
    empresa_id: 9, cliente_id: 4, division_id: 2, contrato_id: 31, corpo_id: 55, puesto_id: 140,
    empresa_nombre: "9 - Seguridad SA", cliente_nombre: "Cliente Uno", division_nombre: "Seguridad", contrato_nombre: "C-31 - Contrato", corpo_nombre: "55 - Sede", puesto_nombre: "P140 - Portón",
    clasificacion: 3, clasificacion_nombre: "Robo", estado: false, nombre_responsable: "Ana Soto", nombre_responsable_atencion: "Luis Mora", ejecutivo_cuenta_nombre: "Eva",
    descripcion: "x".repeat(900), solucion: null, fecha_solucion: null, fecha_real_solucion: null, costo_asociado: "₡1000", consecutivo_informe: null,
    link_informe: "https://secreto/informe.pdf",
    involucrados_list: [{ nombre: "Pedro", codigo: "E1" }, { nombre: "Juan", codigo: "E2" }],
    libro_novedades_list: [{ numero: "1", fecha: "2026-09-09" }],
    c_contribucion_incidente: [{ id: 1, aporte: "texto", firma_aporte_tercero: "data:image/png;base64,AAAA", c_archivos_aporte_incidente: [{}] }, { id: 2 }],
    ...o,
});

describe("incidentes: mapeo", () => {
    it("aplana la fila, recorta textos largos y cuenta aportes", () => {
        const o = mapIncidenteRow(raw());
        assert.equal(o.id, 7);
        assert.equal(o.creado, "2026-09-10T14:30:00");
        assert.equal(o.fecha_incidente, "2026-09-09T00:00:00");
        assert.equal(o.puesto, "P140 - Portón");
        assert.equal(o.estado, "No solucionado");
        assert.equal((o.descripcion as string).length, 500);
        assert.equal(o.involucrados, "Pedro; Juan");
        assert.equal(o.novedades_libro, 1);
        assert.equal(o.aportes, 2);
    });
    it("nulos y ubicaciones sin resolver quedan en null; nunca expone el enlace ni las firmas", () => {
        const o = mapIncidenteRow(raw({ empresa_id: 0, empresa_nombre: "0", division_id: 0, division_nombre: "0", solucion: "  ", estado: true, involucrados_list: undefined, involucrados: "no es json", libro_novedades_list: undefined, fecha_libro_novedades: null, c_contribucion_incidente: undefined }));
        assert.equal(o.empresa, null);
        assert.equal(o.division, null);
        assert.equal(o.solucion, null);
        assert.equal(o.fecha_solucion, null);
        assert.equal(o.estado, "Solucionado");
        assert.equal(o.involucrados, null);
        assert.equal(o.novedades_libro, 0);
        assert.equal(o.aportes, 0);
        const json = JSON.stringify(mapIncidenteRow(raw()));
        assert.equal(json.includes("secreto"), false);
        assert.equal(json.includes("base64"), false);
    });
    it("el módulo declara columnas de búsqueda, filtro y orden que existen en la fila", () => {
        const cols = Object.keys(mapIncidenteRow(raw()));
        for (const k of [...incidentes.searchKeys, ...incidentes.filterKeys, ...incidentes.sortKeys, incidentes.defaultSort]) assert.ok(cols.includes(k), k);
    });
});

describe("incidentes: alcance", () => {
    const rows = [raw({ id: 1 }), raw({ id: 2, contrato_id: 99, corpo_id: 1, puesto_id: 2 }), raw({ id: 3, empresa_id: 0, cliente_id: 0, division_id: 0, contrato_id: 0, corpo_id: 0, puesto_id: 0 })];
    it("sin alcance deja todo; con alcance, la unión de nodos; vacío no deja nada", () => {
        assert.equal(filterIncidentesByScope(rows, null).length, 3);
        assert.deepEqual(filterIncidentesByScope(rows, [{ nivel: "contrato", id: 31 }]).map((r) => r.id), [1]);
        assert.deepEqual(filterIncidentesByScope(rows, [{ nivel: "contrato", id: 99 }, { nivel: "puesto", id: 140 }]).map((r) => r.id), [1, 2]);
        assert.deepEqual(filterIncidentesByScope(rows, []), []);
    });
});
