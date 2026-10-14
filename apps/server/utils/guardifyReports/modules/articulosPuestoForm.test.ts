import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SAMPLE_PNG, writeFormSample } from "../formSamples";
import { armarRegistro, articulosPuestoForm, type ArticuloRaw } from "./articulosPuestoForm";

const ubic = { empresa: "CH - Corporación González", cliente: "CCSS", division: "Seguridad", contrato: "C1 - Contrato", sucursal: "S1 - Sede Central", puesto: "P7 - Oficial de recepción" };
const hier = { empresa: 1, cliente: 2, division: 3, contrato: 4, corpo: 5, puesto: 7 };
const FIRMA = SAMPLE_PNG;
const mov = (o: Record<string, any> = {}) => ({
    id: 1, nombre_persona_entrega: "Ana Soto", nombre_persona_recibe: "Luis Mora", departamento: "Operaciones", telefono: "8888-1234", entrega: "Radio portátil", recibe: "Radio portátil en buen estado",
    fecha: new Date("2026-09-12T00:00:00Z"), hora: new Date("1970-01-01T08:30:00Z"), firma_entrega: FIRMA, firma_recibe: FIRMA, firma_responsable: "SESION-SECRETA|42|9.9|-84.1|1789000000", ...o,
});
const raw = (o: Partial<ArticuloRaw> = {}): ArticuloRaw => ({
    origen: "Asignado", id: 11, articulo: "Radio portátil", cantidad: 1, combo: null, marca: "Motorola", modelo: "DEP450", serie: "SN-1234", fecha_entrega: new Date("2026-09-12T08:00:00Z"),
    ejecutivo: "Rosa Vega", movimientos: [mov({ id: 1 }), mov({ id: 2, nombre_persona_recibe: "Marta Quirós", firma_entrega: "" })], hier, ...o,
});

describe("artículos del puesto como formulario", () => {
    it("arma un artículo asignado con sus movimientos y la firma de cada renglón", () => {
        const r = armarRegistro(raw(), ubic, true);
        assert.equal(r.variante, "Asignado");
        assert.equal(r.creado, "2026-09-12T08:00:00");
        assert.deepEqual([r.valores.articulo, r.valores.origen, r.valores.marca, r.valores.modelo, r.valores.serie, r.valores.fecha_entrega, r.valores.hora_entrega, r.valores.ejecutivo_cuenta],
            ["Radio portátil", "Asignado", "Motorola", "DEP450", "SN-1234", "2026-09-12", "08:00", "Rosa Vega"]);
        assert.equal(r.valores.cantidad, null);
        assert.deepEqual(r.listas.movimientos![0], { persona_entrega: "Ana Soto", persona_recibe: "Luis Mora", departamento: "Operaciones", telefono: "8888-1234", entrega: "Radio portátil", recibe: "Radio portátil en buen estado", fecha: "2026-09-12", hora: "08:30", firma_entrega: FIRMA, firma_recibe: FIRMA, firma_responsable: "Firmada" });
        assert.equal(r.listas.movimientos!.length, 2);
        // cada renglón trae solo SUS firmas: el segundo no tiene firma de entrega
        assert.deepEqual([r.listas.movimientos![1]!.firma_entrega, r.listas.movimientos![1]!.firma_recibe], [null, FIRMA]);
        assert.deepEqual([r.firmas, r.firmasPresentes], [{}, []]);
        assert.deepEqual(r.hier, hier);
    });
    it("firmas por renglón: imagen con firmas=1, «Firmada» sin pedirla o si no es imagen, vacía si no hay; nunca el código del responsable", () => {
        const movimientos = [mov({ firma_entrega: SAMPLE_PNG.split(",")[1], firma_recibe: "mov_firma_recibe_123.png" }), mov({ firma_entrega: "", firma_recibe: null, firma_responsable: "" }), mov({ firma_entrega: "A".repeat(300) })];
        const con = armarRegistro(raw({ movimientos }), ubic, true).listas.movimientos as any[];
        assert.deepEqual(con.map((m) => [m.firma_entrega, m.firma_recibe, m.firma_responsable]), [[FIRMA, "Firmada", "Firmada"], [null, null, null], ["Firmada", FIRMA, "Firmada"]]);
        const sinR = armarRegistro(raw({ movimientos }), ubic, false);
        assert.deepEqual((sinR.listas.movimientos as any[]).map((m) => [m.firma_entrega, m.firma_recibe, m.firma_responsable]), [["Firmada", "Firmada", "Firmada"], [null, null, null], ["Firmada", "Firmada", "Firmada"]]);
        assert.ok(!JSON.stringify(sinR).includes("data:image") && !JSON.stringify(sinR).includes("iVBOR"));
        assert.equal(JSON.stringify([con, sinR]).includes("SESION-SECRETA"), false);
    });
    it("arma un artículo del plan con cantidad y combo, y tolera nulos", () => {
        const r = armarRegistro(raw({ origen: "Plan", id: 12, articulo: "Extintor", cantidad: 3, combo: "Combo A", marca: null, modelo: null, serie: null, fecha_entrega: null, movimientos: [] }), ubic, false);
        assert.equal(r.variante, "Plan");
        assert.equal(r.creado, null);
        assert.deepEqual([r.valores.cantidad, r.valores.combo, r.valores.marca, r.valores.fecha_entrega], [3, "Combo A", null, null]);
        assert.deepEqual(r.listas.movimientos, []);
        assert.deepEqual(r.firmasPresentes, []);
        assert.equal(armarRegistro(raw({ articulo: null }), ubic, false).valores.articulo, "Artículo inidentificable");
    });

    // Base simulada (where id/in/OR, select y orderBy como Prisma) para ver cuántas consultas se hacen y qué columnas piden.
    const fakeDb = (tables: Record<string, any[]>) => {
        const calls: { table: string; args: any }[] = [];
        const match = (row: any, where: any): boolean =>
            Object.entries(where ?? {}).every(([k, v]: [string, any]) => (k === "OR" ? v.some((w: any) => match(row, w)) : v && typeof v === "object" && "in" in v ? v.in.includes(row[k]) : row[k] === v));
        const db: any = new Proxy({}, {
            get: (_t, table: string) => ({
                findMany: async (args: any) => {
                    calls.push({ table, args });
                    let rows = (tables[table] ?? []).filter((r) => match(r, args?.where));
                    if (args?.orderBy?.id === "asc") rows = [...rows].sort((a, b) => a.id - b.id);
                    return args?.select ? rows.map((r) => Object.fromEntries(Object.keys(args.select).map((k) => [k, r[k]]))) : rows;
                },
            }),
        });
        return { db, calls };
    };
    const tablas = () => ({
        e_estructura_articulo_corpo_puesto_plan: [
            { id: 12, puesto_id: 7, corpo_id: null, cantidad: 3, articuloCP_id: 100, combo_id: 50 },
            { id: 11, puesto_id: null, corpo_id: 5, cantidad: 2, articuloCP_id: 101, combo_id: null }, // plan de la sucursal; el mismo id 11 existe como entrega
            { id: 13, puesto_id: null, corpo_id: null, cantidad: 1, articuloCP_id: 100, combo_id: 50 }, // plan de combo: sin ubicación
        ],
        e_estructura_articulo_corpo_puesto_entrega: [{ id: 11, puesto_id: 7, corpo_id: null, marca: "Motorola", serie: "SN-1234", modelo: "DEP450", fechaEntrega: new Date("2026-09-12T08:00:00Z"), nomencladorArticuloCP_id: 101 }],
        n_articulo_corpo_puesto: [{ id: 100, nombre: "Extintor" }, { id: 101, nombre: "Radio portátil" }],
        e_estructura_combo_articulo_cp: [{ id: 50, nombre: "Combo A" }],
        c_movimientos_articulo_mantenimiento: [
            mov({ id: 9, articulo_plan_id: null, articulo_asignado_id: 11 }), mov({ id: 3, articulo_plan_id: 12, articulo_asignado_id: null, nombre_persona_recibe: "Elena" }),
            mov({ id: 5, articulo_plan_id: null, articulo_asignado_id: 11, nombre_persona_recibe: "Marta Quirós" }),
        ],
        e_estructura_puesto: [{ id: 7, codigo: "P7", nombre: "Oficial de recepción", sucursal_id: 5 }],
        e_estructura_sucursal: [{ id: 5, nro_sucursal: "S1", nombre: "Sede Central", contrato_id: 4, ejecutivoCuenta_id: 8 }], n_ejecutivo_cuenta: [{ id: 8, nombre: "Rosa Vega" }],
        e_estructura_contrato: [{ id: 4, nro_contrato: "C1", nombre: "Contrato", cliente_id: 2, empresa_id: 1, division_id: 3 }],
        e_estructura_empresa: [{ id: 1, codigo: "CH", nombre: "Corporación González" }], e_estructura_cliente: [{ id: 2, nombre: "CCSS" }], n_division: [{ id: 3, nombre: "Seguridad" }],
    });

    it("carga en lote: un id que está en las dos tablas entrega los dos artículos; cada uno con su ubicación", async () => {
        const { db, calls } = fakeDb(tablas());
        const out = await articulosPuestoForm.loadRecords(db, [11, 12, 13, 999], { firmas: false });
        assert.deepEqual(out.map((r) => [r.id, r.variante, r.valores.articulo]), [[12, "Plan", "Extintor"], [11, "Plan", "Radio portátil"], [13, "Plan", "Extintor"], [11, "Asignado", "Radio portátil"]]);
        const plan12 = out[0]!, plan11 = out[1]!, plan13 = out[2]!, asig11 = out[3]!;
        assert.equal(plan12.valores.combo, "Combo A");
        assert.equal(plan12.estructura.puesto, "P7 - Oficial de recepción");
        assert.equal(plan12.valores.ejecutivo_cuenta, "Rosa Vega");
        assert.deepEqual(plan12.listas.movimientos!.map((m) => m.persona_recibe), ["Elena"]);
        // el plan de la sucursal se ubica por la sucursal (sin puesto)
        assert.deepEqual([plan11.estructura.sucursal, plan11.estructura.puesto, plan11.hier.puesto ?? null, plan11.hier.corpo], ["S1 - Sede Central", null, null, 5]);
        // el plan de combo no tiene ubicación
        assert.deepEqual([plan13.estructura.puesto, plan13.estructura.cliente, plan13.hier], [null, null, {}]);
        // movimientos en orden de id, y solo los de su artículo
        assert.deepEqual(asig11.listas.movimientos!.map((m) => m.persona_recibe), ["Marta Quirós", "Luis Mora"]);
        assert.deepEqual(asig11.listas.movimientos!.map((m) => [m.firma_entrega, m.firma_recibe, m.firma_responsable]), [["Firmada", "Firmada", "Firmada"], ["Firmada", "Firmada", "Firmada"]]);
        // una consulta por tabla (no una por registro)
        const porTabla = new Map<string, number>();
        for (const c of calls) porTabla.set(c.table, (porTabla.get(c.table) ?? 0) + 1);
        assert.ok([...porTabla.entries()].every(([t, n]) => n <= 4), JSON.stringify([...porTabla]));
        assert.equal(porTabla.get("c_movimientos_articulo_mantenimiento"), 1);
        assert.equal(JSON.stringify(out).includes("SESION-SECRETA"), false);
    });
    it("con firmas=1 entrega la imagen de cada movimiento", async () => {
        const { db } = fakeDb(tablas());
        const out = await articulosPuestoForm.loadRecords(db, [11], { firmas: true });
        assert.deepEqual(out.find((r) => r.variante === "Asignado")!.listas.movimientos!.map((m) => m.firma_recibe), [FIRMA, FIRMA]);
        assert.equal(JSON.stringify(out).includes("SESION-SECRETA"), false);
    });
    it("sin registros no consulta movimientos", async () => {
        const { db, calls } = fakeDb(tablas());
        assert.deepEqual(await articulosPuestoForm.loadRecords(db, [777], { firmas: false }), []);
        assert.equal(calls.some((c) => c.table === "c_movimientos_articulo_mantenimiento"), false);
    });

    it("muestras completas para Guardify: una por formato", () => {
        const movs = [
            mov({ id: 1, nombre_persona_entrega: "Ana Soto", nombre_persona_recibe: "Luis Mora", fecha: new Date("2026-08-01T00:00:00Z"), hora: new Date("1970-01-01T07:45:00Z") }),
            mov({ id: 2, nombre_persona_entrega: "Luis Mora", nombre_persona_recibe: "Marta Quirós", fecha: new Date("2026-08-20T00:00:00Z"), hora: new Date("1970-01-01T13:10:00Z") }),
            mov({ id: 3, nombre_persona_entrega: "Marta Quirós", nombre_persona_recibe: "Ana Soto", fecha: new Date("2026-09-12T00:00:00Z"), hora: new Date("1970-01-01T16:20:00Z"), firma_entrega: SAMPLE_PNG, firma_recibe: SAMPLE_PNG }),
        ];
        const plan = armarRegistro(raw({ origen: "Plan", id: 12, articulo: "Extintor de 10 libras", cantidad: 3, combo: "Combo recepción", marca: null, modelo: null, serie: null, fecha_entrega: null, movimientos: movs }), ubic, true);
        const asignado = armarRegistro(raw({ origen: "Asignado", id: 11, movimientos: movs }), ubic, true);
        for (const r of [plan, asignado]) { assert.equal(r.listas.movimientos!.length, 3); assert.ok(r.listas.movimientos!.every((m) => m.firma_entrega === SAMPLE_PNG && m.firma_recibe === SAMPLE_PNG && m.firma_responsable === "Firmada")); }
        writeFormSample("articulos-del-puesto", [plan, asignado].map(({ hier: _h, ...r }) => r));
    });
});
