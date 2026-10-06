import assert from "node:assert/strict";
import Module from "node:module";
import { before, describe, it } from "node:test";
import type { ReportParams } from "../params";
import { parseScope } from "../scope";

// `exceljs` solo lo usan los generadores de Excel de los reportes; si no está instalado, se sustituye para poder probar el módulo.
let mapNotaVozRow: typeof import("./notasVoz").mapNotaVozRow;
let notasVoz: typeof import("./notasVoz").notasVoz;
before(async () => {
    try {
        require.resolve("exceljs");
    } catch {
        const load = (Module as any)._load;
        (Module as any)._load = function (request: string, ...rest: unknown[]) {
            return request === "exceljs" ? {} : load.call(this, request, ...rest);
        };
    }
    ({ mapNotaVozRow, notasVoz } = await import("./notasVoz"));
});

const P: ReportParams = { from: "2026-09-01", to: "2026-10-01", page: 1, pageSize: 50, sort: null, dir: "desc", q: null, filters: {}, scope: null };

const crudo = (o: Record<string, unknown> = {}) => ({
    id: 7,
    created_at: new Date("2026-09-15T10:30:00.000Z"),
    empresa_id: 1, cliente_id: 2, division_id: 3, contrato_id: 4, corpo_id: 5, puesto_id: 6,
    empresa_nombre: "E1 - Empresa", cliente_nombre: "Cliente", division_nombre: "D3 - División", contrato_nombre: "C4 - Contrato", corpo_nombre: "S5 - Sucursal", puesto_nombre: "P6 - Puesto",
    titulo: " Ronda nocturna ", descripcion: "x".repeat(900), transcripcion: "Todo en orden",
    path: "/uploads/voice-notes/7/nota.m4a", audio_relpath: "voice-notes/7/nota.m4a", firma_responsable: "data:image/png;base64,AAAA",
    creador_nombre: "123 Ana Pérez",
    ...o,
});

describe("notas de voz: mapeo", () => {
    it("aplana la fila, recorta textos largos y no expone rutas ni firmas", () => {
        const o = mapNotaVozRow(crudo());
        assert.equal(o.id, 7);
        assert.equal(o.creado, "2026-09-15T10:30:00");
        assert.equal(o.puesto, "P6 - Puesto");
        assert.equal(o.titulo, "Ronda nocturna");
        assert.equal(String(o.descripcion).length, 500);
        assert.equal(o.con_audio, "Sí");
        assert.equal(o.creado_por, "123 Ana Pérez");
        assert.equal(mapNotaVozRow(crudo({ descripcion: `iVBORw0KGgo${"Ab3".repeat(500)}` })).descripcion, null);
        const json = JSON.stringify(o);
        assert.ok(!json.includes("voice-notes") && !json.includes("base64") && !json.includes("m4a"));
        assert.ok(!("path" in o) && !("firma_responsable" in o));
    });
    it("tolera nulos: puesto sin asignar, sin audio ni textos", () => {
        const o = mapNotaVozRow(crudo({ puesto_id: null, puesto_nombre: "—", division_id: 0, division_nombre: "0", path: "", titulo: null, descripcion: "", transcripcion: undefined }));
        assert.equal(o.puesto, null);
        assert.equal(o.division, null);
        assert.equal(o.con_audio, "No");
        assert.equal(o.titulo, null);
        assert.equal(o.descripcion, null);
        assert.equal(o.transcripcion, null);
        for (const v of Object.values(o)) assert.ok(v === null || typeof v === "string" || typeof v === "number");
    });
});

/** `db` falso: cada tabla devuelve sus filas (respeta `where.id.in`, ignora el resto). */
function fakeDb(tables: Record<string, any[]>) {
    return new Proxy({}, {
        get: (_t, name: string) => ({
            findMany: async (args: any = {}) => {
                const rows = tables[name] ?? [];
                const ids: number[] | undefined = args.where?.id?.in;
                return ids ? rows.filter((r) => ids.includes(r.id)) : rows;
            },
        }),
    }) as any;
}

describe("notas de voz: carga y alcance", () => {
    const tables = {
        c_notas_voz: [
            { id: 1, empresa_id: 1, cliente_id: 2, division_id: 3, contrato_id: 4, corpo_id: 5, puesto_id: 6, titulo: "A", descripcion: "", transcripcion: "", path: "", firma_responsable: "", created_by: 9, created_at: new Date("2026-09-10T08:00:00Z") },
            { id: 2, empresa_id: 1, cliente_id: 2, division_id: 3, contrato_id: 40, corpo_id: 50, puesto_id: null, titulo: "B", descripcion: "", transcripcion: "", path: "", firma_responsable: "", created_by: 9, created_at: new Date("2026-09-11T08:00:00Z") },
            { id: 3, empresa_id: 1, cliente_id: 2, division_id: 3, contrato_id: 4, corpo_id: 5, puesto_id: 6, titulo: "C (fuera del periodo)", descripcion: "", transcripcion: "", path: "", firma_responsable: "", created_by: 9, created_at: new Date("2026-10-01T00:00:00Z") },
        ],
        e_estructura_empresa: [{ id: 1, nombre: "Empresa", codigo: "E1" }],
        e_estructura_contrato: [{ id: 4, nombre: "Contrato", nro_contrato: "C4" }, { id: 40, nombre: "Otro", nro_contrato: null }],
        c_empleado: [{ id: 9, codigo: "9", nombre: "Ana", primer_apellido: "Pérez", segundo_apellido: null }],
    };
    it("sin alcance trae todo el periodo (to exclusivo)", async () => {
        const rows = await notasVoz.load(fakeDb(tables), P);
        assert.deepEqual(rows.map((r) => r.id).sort(), [1, 2]);
        assert.equal(rows.find((r) => r.id === 1)!.empresa, "E1 - Empresa");
    });
    it("con alcance deja solo las filas de los nodos y un alcance vacío no ve nada", async () => {
        assert.deepEqual((await notasVoz.load(fakeDb(tables), { ...P, scope: parseScope("contrato:4") })).map((r) => r.id), [1]);
        assert.deepEqual((await notasVoz.load(fakeDb(tables), { ...P, scope: parseScope("corpo:50,puesto:6") })).map((r) => r.id).sort(), [1, 2]);
        assert.deepEqual(await notasVoz.load(fakeDb(tables), { ...P, scope: [] }), []);
    });
    it("declara claves de búsqueda, filtro y orden que existen en la fila", async () => {
        const [row] = await notasVoz.load(fakeDb(tables), P);
        for (const k of [...notasVoz.searchKeys, ...notasVoz.filterKeys, ...notasVoz.sortKeys, notasVoz.defaultSort]) assert.ok(k in row!, k);
    });
});
