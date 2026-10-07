import assert from "node:assert/strict";
import Module from "node:module";
import { before, describe, it } from "node:test";
import type { ReportParams } from "../params";
import { parseScope } from "../scope";

// `exceljs` solo lo usan los generadores de Excel de los reportes; si no está instalado, se sustituye para poder probar el módulo.
let mapProductoNoConformeRow: typeof import("./productoNoConforme").mapProductoNoConformeRow;
let productoNoConforme: typeof import("./productoNoConforme").productoNoConforme;
before(async () => {
    try {
        require.resolve("exceljs");
    } catch {
        const load = (Module as any)._load;
        (Module as any)._load = function (request: string, ...rest: unknown[]) {
            return request === "exceljs" ? {} : load.call(this, request, ...rest);
        };
    }
    ({ mapProductoNoConformeRow, productoNoConforme } = await import("./productoNoConforme"));
});

const P: ReportParams = { from: "2026-09-01", to: "2026-10-01", page: 1, pageSize: 50, sort: null, dir: "desc", q: null, filters: [], scope: null };

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

const crudo = (o: Record<string, unknown> = {}) => ({
    id: 11,
    created_at: new Date("2026-09-20T14:05:09.000Z"),
    fecha_identificacion: new Date("2026-09-19T00:00:00.000Z"),
    fecha_solucion: new Date("2026-09-25T00:00:00.000Z"),
    empresa_id: 1, cliente_id: 2, division_id: 3, contrato_id: 4, corpo_id: 5, puesto_id: 6,
    empresa_nombre: "E1 - Empresa", cliente_nombre: "Cliente", division_nombre: "D3 - División", contrato_nombre: "C4 - Contrato", corpo_nombre: "S5 - Sucursal", puesto_nombre: "P6 - Puesto",
    responsable_cuenta: "Luis Mora", tipo_servicio_no_conforme: "Servicio incompleto",
    persona_identifico_pnc: "Ana Pérez", persona_origino_pnc: "Juan Soto",
    descripcion: "No se cubrió el turno. ".repeat(60), accion_implementada: "Se reemplazó al oficial",
    responsable_aprobar: "Carla Ruiz",
    firma_responsable: "data:image/png;base64,AAAA", firma_persona_identifico_pnc: "iVBORw0KGgo=", firma_persona_origino_pnc: "xyz",
    firma_persona_identifico_pnc_data_uri: "data:image/png;base64,AAAA",
    created_by: "9", created_by_nombre: "9 - Ana Pérez",
    ...o,
});

describe("producto no conforme: mapeo", () => {
    it("aplana la fila, usa fechas sin hora y recorta textos largos", () => {
        const o = mapProductoNoConformeRow(crudo());
        assert.equal(o.id, 11);
        assert.equal(o.creado, "2026-09-20T14:05:09");
        assert.equal(o.fecha_identificacion, "2026-09-19T00:00:00");
        assert.equal(o.fecha_solucion, "2026-09-25T00:00:00");
        assert.equal(o.sucursal, "S5 - Sucursal");
        assert.equal(o.tipo_servicio, "Servicio incompleto");
        assert.equal(String(o.descripcion).length, 500);
        assert.ok(String(o.descripcion).endsWith("…"));
        assert.equal(o.creado_por, "9 - Ana Pérez");
        assert.equal(o.ejecutivo_cuenta, null);
        assert.equal(mapProductoNoConformeRow(crudo(), "Marta Vega").ejecutivo_cuenta, "Marta Vega");
        assert.equal(Object.keys(o).at(-1), "ejecutivo_cuenta");
    });
    it("no expone firmas aunque vengan en la fila ni si se guardan en un campo de texto", () => {
        const o = mapProductoNoConformeRow(crudo({ responsable_aprobar: "data:image/png;base64,AAAA" }));
        assert.equal(o.responsable_aprobar, null);
        const json = JSON.stringify(o);
        assert.ok(!json.includes("base64") && !json.includes("iVBOR"));
        assert.ok(!Object.keys(o).some((k) => k.startsWith("firma")));
    });
    it("tolera nulos y estructura sin resolver", () => {
        const o = mapProductoNoConformeRow(crudo({ puesto_id: 0, puesto_nombre: "0", division_id: 0, fecha_solucion: null, descripcion: null, accion_implementada: "  ", created_by_nombre: undefined }));
        assert.equal(o.puesto, null);
        assert.equal(o.division, null);
        assert.equal(o.fecha_solucion, null);
        assert.equal(o.descripcion, null);
        assert.equal(o.accion_implementada, null);
        assert.equal(o.creado_por, null);
        for (const v of Object.values(o)) assert.ok(v === null || typeof v === "string" || typeof v === "number");
    });
});

describe("producto no conforme: carga y alcance", () => {
    const base = { fecha_identificacion: new Date("2026-09-01"), fecha_solucion: new Date("2026-09-02"), responsable_cuenta: "", tipo_servicio_no_conforme: "T", persona_identifico_pnc: "", persona_origino_pnc: "", descripcion: "d", accion_implementada: "a", responsable_aprobar: "", firma_responsable: "", created_by: "9", cliente_id: 2, division_id: 3 };
    const tables = {
        c_producto_no_conforme: [
            { ...base, id: 1, empresa_id: 1, contrato_id: 4, corpo_id: 5, puesto_id: 6, created_at: new Date("2026-09-05T08:00:00Z") },
            { ...base, id: 2, empresa_id: 1, contrato_id: 40, corpo_id: 50, puesto_id: 60, created_at: new Date("2026-09-30T23:59:59Z") },
            { ...base, id: 3, empresa_id: 1, contrato_id: 4, corpo_id: 5, puesto_id: 6, created_at: new Date("2026-10-01T00:00:00Z") },
        ],
        e_estructura_puesto: [{ id: 6, nombre: "Puesto", codigo: "P6" }],
        c_empleado: [{ id: 9, codigo: "9", nombre: "Ana", primer_apellido: "Pérez", segundo_apellido: null }],
        e_estructura_sucursal: [{ id: 5, ejecutivoCuenta_id: 8 }, { id: 50, ejecutivoCuenta_id: null }],
        n_ejecutivo_cuenta: [{ id: 8, nombre: "Marta Vega" }],
    };
    it("sin alcance trae el periodo y deja fuera el día `to`", async () => {
        const rows = await productoNoConforme.load(fakeDb(tables), P);
        assert.deepEqual(rows.map((r) => r.id).sort(), [1, 2]);
        assert.equal(rows.find((r) => r.id === 1)!.puesto, "P6 - Puesto");
        assert.equal(rows.find((r) => r.id === 1)!.ejecutivo_cuenta, "Marta Vega");
        assert.equal(rows.find((r) => r.id === 2)!.ejecutivo_cuenta, null);
    });
    it("con alcance deja solo los nodos pedidos (unión) y vacío no ve nada", async () => {
        const ids = async (scope: string) => (await productoNoConforme.load(fakeDb(tables), { ...P, scope: parseScope(scope) })).map((r) => r.id).sort();
        assert.deepEqual(await ids("contrato:4"), [1]);
        assert.deepEqual(await ids("puesto:60"), [2]);
        assert.deepEqual(await ids("empresa:1"), [1, 2]);
        assert.deepEqual(await ids("contrato:4,corpo:50"), [1, 2]);
        assert.deepEqual(await ids("contrato:999"), []);
        assert.deepEqual(await productoNoConforme.load(fakeDb(tables), { ...P, scope: [] }), []);
    });
    it("las claves de búsqueda, filtro y orden existen en la fila", async () => {
        const [row] = await productoNoConforme.load(fakeDb(tables), P);
        for (const k of [...productoNoConforme.searchKeys, ...productoNoConforme.filterKeys, ...productoNoConforme.sortKeys, productoNoConforme.defaultSort]) assert.ok(k in row!, k);
    });
});
