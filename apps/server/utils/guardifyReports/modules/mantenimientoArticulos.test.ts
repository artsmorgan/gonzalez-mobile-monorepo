import assert from "node:assert/strict";
import Module from "node:module";
import { before, describe, it } from "node:test";
import type { ReportParams } from "../params";
import { parseScope } from "../scope";

// La consulta de la app arrastra dependencias que solo usan los generadores de Excel y el acceso HTTP a la base
// (`exceljs`, `axios`, …); si no están instaladas se sustituyen por un objeto vacío para poder probar el módulo.
let mapMantenimientoArticuloRow: typeof import("./mantenimientoArticulos").mapMantenimientoArticuloRow;
let loadMantenimientoArticulos: typeof import("./mantenimientoArticulos").loadMantenimientoArticulos;
let mantenimientoArticulos: typeof import("./mantenimientoArticulos").mantenimientoArticulos;
before(async () => {
    const load = (Module as any)._load;
    (Module as any)._load = function (request: string, ...rest: unknown[]) {
        try {
            return load.call(this, request, ...rest);
        } catch (e: any) {
            if (e?.code === "MODULE_NOT_FOUND" && !request.startsWith(".") && !request.startsWith("/")) return new Proxy({}, { get: () => () => ({}) });
            throw e;
        }
    };
    ({ mapMantenimientoArticuloRow, loadMantenimientoArticulos, mantenimientoArticulos } = await import("./mantenimientoArticulos"));
});

const P: ReportParams = { from: "2026-09-01", to: "2026-10-01", page: 1, pageSize: 50, sort: null, dir: "desc", q: null, filters: [], scope: null };


const crudo = (o: Record<string, unknown> = {}): any => ({
    id: 31,
    empresa_id: 1, cliente_id: 2, division_id: 3, contrato_id: 4, corpo_id: 5, puesto_id: 6,
    empresa_txt: "E1 - Empresa", cliente_txt: "Cliente", division_txt: "D3 - División", contrato_txt: "C4 - Contrato", corpo_txt: "S5 - Sucursal", puesto_txt: "P6 - Puesto",
    origen: "Plan", articulo_registro_id: 70, articulo_nombre: "Radio", articulo_plan_id: 70, articulo_asignado_id: null,
    estado: "Solucionado", cantidad_necesaria: 2, cantidad_real: 1, observaciones: "Se cambió la batería. ".repeat(50),
    fecha_solucion: new Date("2026-09-20T00:00:00.000Z"), accion: "Reparación", fecha_inicio: new Date("2026-09-18T08:00:00.000Z"),
    numero_boleta_proveeduria: "B-1", tipo: "Radio", marca: "Motorola", modelo: "X1", serie_placa: "SN123",
    marca_nuevo: "", modelo_nuevo: "", serie_placa_nuevo: "", categoria: "Comunicación", tipo_mantenimiento_art: "Correctivo",
    fecha_salida: null, fecha_entrada: null, kilometraje: null, mant_armas_form: '{"cargador":true}', categoria_mantinimiento: "", detalle: "",
    numero_fc: "", proveedor: "Taller S.A.", costo_mo: 1000, costo_i: 500, iva: 195, costo_total: 1695, fecha_fin: new Date("2026-09-21T00:00:00.000Z"),
    reincidencia_treinta_dias_txt: "No", tipo_mant_art_reincid: "",
    created_at: new Date("2026-09-17T07:30:00.000Z"), updated_at: new Date("2026-09-21T09:00:00.000Z"), archivos_adjuntos_count: 3,
    ...o,
});

describe("mantenimiento de artículos: mapeo", () => {
    it("aplana la fila, recorta textos largos y solo cuenta los adjuntos", () => {
        const o = mapMantenimientoArticuloRow(crudo());
        assert.equal(o.id, 31);
        assert.equal(o.creado, "2026-09-17T07:30:00");
        assert.equal(o.fecha_solucion, "2026-09-20T00:00:00");
        assert.equal(o.puesto, "P6 - Puesto");
        assert.equal(o.articulo, "Radio");
        assert.equal(o.cantidad_real, 1);
        assert.equal(String(o.observaciones).length, 500);
        assert.equal(o.costo_total, 1695);
        assert.equal(o.reincidencia_30_dias, "No");
        assert.equal(o.adjuntos, 3);
        assert.ok(!("mant_armas_form" in o) && !("formulario_armas" in o));
        assert.equal(o.ejecutivo_cuenta, null);
        assert.equal(mapMantenimientoArticuloRow(crudo(), " Marta Vega ").ejecutivo_cuenta, "Marta Vega");
        assert.equal(Object.keys(o).at(-1), "ejecutivo_cuenta");
    });
    it("tolera nulos y textos vacíos", () => {
        const o = mapMantenimientoArticuloRow(crudo({ fecha_solucion: null, fecha_inicio: null, fecha_fin: null, observaciones: "", marca: "", costo_mo: null, costo_total: null, kilometraje: null, reincidencia_treinta_dias_txt: "", archivos_adjuntos_count: 0, puesto_txt: "" }));
        assert.equal(o.fecha_solucion, null);
        assert.equal(o.observaciones, null);
        assert.equal(o.marca, null);
        assert.equal(o.costo_mano_obra, null);
        assert.equal(o.costo_total, null);
        assert.equal(o.kilometraje, null);
        assert.equal(o.reincidencia_30_dias, null);
        assert.equal(o.puesto, null);
        assert.equal(o.adjuntos, 0);
        for (const v of Object.values(o)) assert.ok(v === null || typeof v === "string" || typeof v === "number");
    });
});

/** `db` falso: cada tabla devuelve sus filas (respeta `where.id.in`, ignora el resto) y cuenta las consultas. */
function fakeDb(tables: Record<string, any[]>, calls: string[] = []) {
    return new Proxy({}, {
        get: (_t, name: string) => ({
            findMany: async (args: any = {}) => {
                calls.push(name);
                const rows = tables[name] ?? [];
                const ids: number[] | undefined = args.where?.id?.in;
                return ids ? rows.filter((r) => ids.includes(r.id)) : rows;
            },
        }),
    }) as any;
}

describe("mantenimiento de artículos: carga y alcance", () => {
    const db = fakeDb({ e_estructura_sucursal: [{ id: 5, ejecutivoCuenta_id: 8 }], n_ejecutivo_cuenta: [{ id: 8, nombre: "Marta Vega" }] });
    const rows = [
        crudo({ id: 1, created_at: new Date("2026-09-05T08:00:00Z") }),
        crudo({ id: 2, empresa_id: 1, contrato_id: 40, corpo_id: 50, puesto_id: 60, created_at: new Date("2026-09-30T23:59:00Z") }),
        crudo({ id: 3, created_at: new Date("2026-10-01T00:00:00Z") }),
    ];
    /** Consulta falsa: respeta el filtro de fechas y los ids de estructura, como la consulta real. */
    const calls: any[] = [];
    const query = async (_db: any, f: any) => {
        calls.push(f);
        const key = (["empresaIds", "clienteIds", "divisionIds", "contratoIds", "corpoIds", "puestoIds"] as const).find((k) => f[k]);
        const col = key && { empresaIds: "empresa_id", clienteIds: "cliente_id", divisionIds: "division_id", contratoIds: "contrato_id", corpoIds: "corpo_id", puestoIds: "puesto_id" }[key];
        return rows.filter((r) => (!col || f[key!].includes(r[col])) && r.created_at >= new Date(f.creadoDesde) && r.created_at <= new Date(f.creadoHasta));
    };
    it("sin alcance hace una sola consulta del periodo y descarta lo que cae fuera (to exclusivo)", async () => {
        calls.length = 0;
        const out = await loadMantenimientoArticulos(db, P, query as any);
        assert.equal(calls.length, 1);
        assert.deepEqual(calls[0], { creadoDesde: "2026-09-01T00:00:00", creadoHasta: "2026-09-30T23:59:59" });
        assert.deepEqual(out.map((r) => r.id).sort(), [1, 2]);
    });
    it("agrega el ejecutivo de cuenta de la sucursal por lote (sin consultas por fila)", async () => {
        const consultas: string[] = [];
        const out = await loadMantenimientoArticulos(fakeDb({ e_estructura_sucursal: [{ id: 5, ejecutivoCuenta_id: 8 }], n_ejecutivo_cuenta: [{ id: 8, nombre: "Marta Vega" }] }, consultas), P, query as any);
        assert.equal(out.find((r) => r.id === 1)!.ejecutivo_cuenta, "Marta Vega");
        assert.equal(out.find((r) => r.id === 2)!.ejecutivo_cuenta, null); // sucursal 50 sin ejecutivo
        assert.deepEqual(consultas, ["e_estructura_sucursal", "n_ejecutivo_cuenta"]);
    });
    it("con alcance consulta por nodo, une sin repetir y filtra por ubicación", async () => {
        calls.length = 0;
        const ids = async (scope: string) => (await loadMantenimientoArticulos(db, { ...P, scope: parseScope(scope) }, query as any)).map((r) => r.id).sort();
        assert.deepEqual(await ids("contrato:4"), [1]);
        assert.equal(calls[0].contratoIds[0], 4);
        assert.deepEqual(await ids("puesto:60"), [2]);
        assert.deepEqual(await ids("empresa:1,puesto:6"), [1, 2]);
        assert.deepEqual(await ids("contrato:999"), []);
    });
    it("un alcance vacío no consulta nada", async () => {
        calls.length = 0;
        assert.deepEqual(await loadMantenimientoArticulos(db, { ...P, scope: [] }, query as any), []);
        assert.equal(calls.length, 0);
    });
    it("las claves de búsqueda, filtro y orden existen en la fila", () => {
        const row = mapMantenimientoArticuloRow(crudo());
        for (const k of [...mantenimientoArticulos.searchKeys, ...mantenimientoArticulos.filterKeys, ...mantenimientoArticulos.sortKeys, mantenimientoArticulos.defaultSort]) assert.ok(k in row, k);
    });
});
