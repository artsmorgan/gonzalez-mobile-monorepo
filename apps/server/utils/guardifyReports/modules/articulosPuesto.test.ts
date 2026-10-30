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
const { articulosPuesto, buildArticulosPuestoRows, mapArticuloPuestoRow, cargarUltimoMantenimiento, aplicarUltimoMantenimiento } = require("./articulosPuesto") as typeof import("./articulosPuesto");

const art = (o: Record<string, any> = {}) => ({
    puesto_id: 40, puesto_txt: "P40 - Recepción", origen: "Asignado", registro_id: 11, articulo_nombre: "Radio", cantidad: 1,
    marca: "Motorola", modelo: null, serie: "SN1", fecha_entrega: "2026-09-12 08:00:00", fecha_entrega_raw: new Date("2026-09-12T08:00:00Z"),
    combo_nombre: "", nomenclador_nombre: "Radio", movimientos_count: 2,
    movimientos: [{ firma_entrega: "data:image/png;base64,AAAA", firma_recibe: "BBBB", firma_responsable: "CCCC" }],
    ...o,
});
const puesto = (o: Record<string, any> = {}) => ({
    puesto_id: 40, empresa_id: 1, cliente_id: 5, division_id: 9, contrato_id: 20, corpo_id: 30,
    empresa_txt: "G - Gonzalez", cliente_txt: "Cliente 5", division_txt: "Norte", contrato_txt: "C-20 - Contrato", corpo_txt: "S1 - Sede", puesto_txt: "P40 - Recepción",
    articulos: [
        art(),
        art({ origen: "Plan", registro_id: 12, articulo_nombre: "Extintor", cantidad: 3, marca: "", serie: "", fecha_entrega: "", fecha_entrega_raw: null, combo_nombre: "Combo A", movimientos: [] }),
        art({ registro_id: 13, fecha_entrega_raw: new Date("2026-10-01T00:00:00Z") }), // fuera del periodo (to exclusivo)
        art({ registro_id: 14, fecha_entrega_raw: null }), // asignado sin fecha: no se puede ubicar en el periodo
    ],
    ...o,
});

describe("articulos_puesto: mapeo", () => {
    it("mapea un artículo con la ubicación del puesto, sin firmas", () => {
        const o = mapArticuloPuestoRow(puesto(), puesto().articulos[0]);
        assert.deepEqual([o.id, o.articulo, o.origen, o.cantidad, o.marca, o.modelo, o.serie, o.movimientos], [11, "Radio", "Asignado", 1, "Motorola", null, "SN1", 2]);
        assert.equal(o.fecha_entrega, "2026-09-12T08:00:00");
        assert.deepEqual([o.empresa, o.cliente, o.division, o.contrato, o.sucursal, o.puesto], ["G - Gonzalez", "Cliente 5", "Norte", "C-20 - Contrato", "S1 - Sede", "P40 - Recepción"]);
        assert.equal(o.ejecutivo_cuenta, null);
        assert.equal(mapArticuloPuestoRow(puesto(), puesto().articulos[0], " Rosa Vega ").ejecutivo_cuenta, "Rosa Vega");
        const s = JSON.stringify(o);
        assert.equal(s.includes("base64"), false);
        assert.equal(s.includes("CCCC"), false);
    });
    it("trae las 11 columnas estándar (auditoría siempre null: las tablas no la guardan)", () => {
        const o = mapArticuloPuestoRow(puesto(), puesto().articulos[0]);
        for (const k of ["empresa", "cliente", "division", "contrato", "sucursal", "puesto", "id", "creado", "creado_por", "modificado", "modificado_por"]) assert.ok(k in o, k);
        assert.deepEqual([o.id, o.creado, o.creado_por, o.modificado, o.modificado_por], [11, null, null, null, null]);
        const plan = mapArticuloPuestoRow(puesto(), puesto().articulos[1]);
        assert.deepEqual([plan.id, plan.creado, plan.creado_por, plan.modificado, plan.modificado_por], [12, null, null, null, null]);
        // un puesto sin algún nivel deja ese nivel en null
        const sinDivision = mapArticuloPuestoRow(puesto({ division_txt: "" }), puesto().articulos[0]);
        assert.equal(sinDivision.division, null);
    });
    it("tolera nulos", () => {
        const o = mapArticuloPuestoRow({}, { registro_id: 1, origen: "Plan", cantidad: "", fecha_entrega_raw: null });
        assert.deepEqual([o.articulo, o.cantidad, o.fecha_entrega, o.puesto, o.movimientos, o.origen], [null, null, null, null, 0, "Plan"]);
    });
});

describe("articulos_puesto: periodo y alcance", () => {
    const puestos = [puesto(), puesto({ puesto_id: 41, contrato_id: 21, corpo_id: 31, division_id: 0, articulos: [art({ registro_id: 21 })] })];
    it("el plan se muestra siempre y lo asignado solo si se entregó en [from, to)", () => {
        const out = buildArticulosPuestoRows(puestos, "2026-09-01", "2026-10-01", null);
        assert.deepEqual(out.map((r) => r.id), [11, 12, 21]);
    });
    it("agrega el ejecutivo de cuenta por sucursal a cada artículo", () => {
        const out = buildArticulosPuestoRows(puestos, "2026-09-01", "2026-10-01", null, new Map([[30, "Rosa Vega"]]));
        assert.deepEqual(out.map((r) => [r.id, r.ejecutivo_cuenta]), [[11, "Rosa Vega"], [12, "Rosa Vega"], [21, null]]);
    });
    it("con alcance filtra por nivel; vacío no ve nada", () => {
        const f = (scope: any) => buildArticulosPuestoRows(puestos, "2026-09-01", "2026-10-01", scope).map((r) => r.id);
        assert.deepEqual(f([{ nivel: "contrato", id: 21 }]), [21]);
        assert.deepEqual(f([{ nivel: "division", id: 9 }]), [11, 12]);
        assert.deepEqual(f([]), []);
    });
    it("declara claves que existen en la fila", () => {
        const keys = Object.keys(mapArticuloPuestoRow(puesto(), puesto().articulos[0]));
        for (const k of [...articulosPuesto.searchKeys, ...articulosPuesto.filterKeys, ...articulosPuesto.sortKeys, articulosPuesto.defaultSort]) assert.ok(keys.includes(k), k);
    });
});

describe("articulos_puesto: estado y acción del último mantenimiento (issue #140)", () => {
    const mantenimientos = [
        { id: 1, articulo_plan_id: null, articulo_asignado_id: 11, estado: "Dañado", accion: "Reparar" },
        { id: 5, articulo_plan_id: null, articulo_asignado_id: 11, estado: "Bueno", accion: null }, // el más reciente del asignado 11
        { id: 3, articulo_plan_id: 12, articulo_asignado_id: null, estado: "En mantenimiento", accion: "Cambiar" },
        { id: 4, articulo_plan_id: 11, articulo_asignado_id: null, estado: "Malo", accion: "Reemplazar" }, // plan 11 ≠ asignado 11
    ];
    const consultas: any[] = [];
    const db = {
        c_articulo_mantenimiento: {
            findMany: async (args: any) => {
                consultas.push(args);
                const plan: number[] | undefined = args.where.articulo_plan_id?.in;
                const asig: number[] | undefined = args.where.articulo_asignado_id?.in;
                return mantenimientos.filter((m) => (plan && m.articulo_plan_id != null && plan.includes(m.articulo_plan_id)) || (asig && m.articulo_asignado_id != null && asig.includes(m.articulo_asignado_id)));
            },
        },
    } as any;
    const rows = buildArticulosPuestoRows([puesto()], "2026-09-01", "2026-10-01", null); // asignado 11, plan 12

    it("la fila trae estado y acción vacíos hasta que se completan", () => {
        const o = mapArticuloPuestoRow(puesto(), puesto().articulos[0]);
        assert.deepEqual([o.estado, o.accion], [null, null]);
    });
    it("toma el mantenimiento de id mayor de cada artículo y distingue plan de asignado con el mismo id", async () => {
        consultas.length = 0;
        const out = aplicarUltimoMantenimiento(rows, await cargarUltimoMantenimiento(db, rows));
        const asignado = out.find((r) => r.id === 11)!, plan = out.find((r) => r.id === 12)!;
        assert.deepEqual([asignado.estado, asignado.accion], ["Bueno", null]);
        assert.deepEqual([plan.estado, plan.accion], ["En mantenimiento", "Cambiar"]);
    });
    it("sin mantenimiento el artículo queda con estado y acción vacíos", async () => {
        const solo = buildArticulosPuestoRows([puesto({ articulos: [art({ registro_id: 99 })] })], "2026-09-01", "2026-10-01", null);
        const out = aplicarUltimoMantenimiento(solo, await cargarUltimoMantenimiento(db, solo));
        assert.deepEqual([out[0]!.estado, out[0]!.accion], [null, null]);
    });
    it("carga en lote: una consulta por tipo de artículo, no una por artículo", async () => {
        consultas.length = 0;
        await cargarUltimoMantenimiento(db, rows);
        assert.equal(consultas.length, 2); // plan + asignado
        const muchos = Array.from({ length: 2500 }, (_, i) => ({ id: i + 1, origen: "Plan" })) as any[];
        consultas.length = 0;
        await cargarUltimoMantenimiento(db, muchos);
        assert.equal(consultas.length, 3); // 2500 artículos del plan en tandas de 1000
    });
    it("estado y acción están declaradas para filtrar y ordenar", () => {
        for (const k of ["estado", "accion"]) {
            assert.ok(articulosPuesto.filterKeys.includes(k), k);
            assert.ok(articulosPuesto.sortKeys.includes(k), k);
        }
    });
});
