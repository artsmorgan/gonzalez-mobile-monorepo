import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { writeFormSample } from "../formSamples";
import { actividadesForm, armarRegistro, frecuenciaHorarios, frecuenciaTitulos, type ActividadesRaw } from "./actividadesForm";

const ubic = { empresa: "CH - Corporación González", cliente: "CCSS", division: "Seguridad", contrato: "C1 - Contrato", sucursal: "S1 - Sede Central", puesto: "P7 - Oficial de recepción" };
const frec = (title: string, schedule?: string[]) => JSON.stringify([{ title, ...(schedule ? { schedule } : {}) }]);

const raw = (o: Partial<ActividadesRaw> = {}): ActividadesRaw => ({
    id: 31,
    puesto: { id: 7, codigo: "P7", nombre: "Oficial de recepción" },
    plazas: [{ id: 70, nombre: "Plaza diurna 1" }],
    actividades: [
        { id: 2, nombre_actividad: "Revisar el equipo de radio", frecuencia: frec("Diaria", ["06:00", "14:00"]) },
        { id: 1, nombre_actividad: "Registrar visitantes", frecuencia: frec("Cada turno") },
    ],
    hier: { empresa: 1, cliente: 2, division: 3, contrato: 4, corpo: 5, puesto: 7 },
    ...o,
});

describe("actividades como formulario (guía de funciones del puesto)", () => {
    it("lee la frecuencia como el generador: títulos y horarios sin repetir", () => {
        assert.equal(frecuenciaTitulos(JSON.stringify([{ title: "Lunes" }, { title: "Martes" }])), "Lunes, Martes");
        assert.equal(frecuenciaTitulos(JSON.stringify({ title: "Diaria" })), "Diaria");
        assert.equal(frecuenciaTitulos(""), "");
        assert.equal(frecuenciaHorarios(JSON.stringify([{ title: "A", schedule: ["14:00", "06:00"] }, { title: "B", schedule: ["06:00", "xx"] }])), "06:00, 14:00");
        assert.equal(frecuenciaHorarios("no es json"), "");
    });
    it("arma la guía con los datos del puesto y una fila por actividad", () => {
        const r = armarRegistro(raw(), ubic, false);
        assert.equal(r.variante, null);
        assert.deepEqual([r.valores.cliente, r.valores.puesto_no, r.valores.puesto_nombre, r.valores.plaza], ["CCSS", "P7", "Oficial de recepción", "Plaza diurna 1"]);
        assert.deepEqual(r.listas.actividades, [
            { numero: 1, actividad: "Revisar el equipo de radio", frecuencia: "Diaria", horario: "06:00, 14:00" },
            { numero: 2, actividad: "Registrar visitantes", frecuencia: "Cada turno", horario: null },
        ]);
        assert.deepEqual(r.firmas, {});
        assert.deepEqual(r.firmasPresentes, []);
        assert.deepEqual(r.hier, { empresa: 1, cliente: 2, division: 3, contrato: 4, corpo: 5, puesto: 7 });
    });
    it("tolera datos faltantes", () => {
        const r = armarRegistro(raw({ puesto: { id: 9, codigo: null, nombre: null }, plazas: [{ id: 5, nombre: null }], actividades: [] }), ubic, true);
        assert.deepEqual([r.valores.puesto_no, r.valores.puesto_nombre, r.valores.plaza], ["9", null, "ID 5"]);
        assert.deepEqual(r.listas.actividades, []);
    });

    // Base simulada: aplica `where` (id/in/OR) y `select` como lo hace Prisma, para que una columna que el cargador use sin pedirla se note.
    const fakeDb = (tables: Record<string, any[]>) => {
        const calls: { table: string; args: any }[] = [];
        const match = (row: any, where: any): boolean =>
            Object.entries(where ?? {}).every(([k, v]: [string, any]) => (k === "OR" ? v.some((w: any) => match(row, w)) : v && typeof v === "object" && "in" in v ? v.in.includes(row[k]) : row[k] === v));
        const db: any = new Proxy({}, {
            get: (_t, table: string) => ({
                findMany: async (args: any) => {
                    calls.push({ table, args });
                    const rows = (tables[table] ?? []).filter((r) => match(r, args?.where));
                    return args?.select ? rows.map((r) => Object.fromEntries(Object.keys(args.select).map((k) => [k, r[k]]))) : rows;
                },
            }),
        });
        return { db, calls };
    };
    const tablas = () => ({
        e_actividades_puesto: [
            { id: 31, actividad_id: 1, puesto_id: 7 }, { id: 32, actividad_id: 2, puesto_id: 7 }, { id: 33, actividad_id: 3, puesto_id: 7 },
            { id: 41, actividad_id: 1, puesto_id: 8 },
        ],
        e_actividades_puesto_plaza: [
            { id: 1, actividad_puesto_id: 31, plaza_id: 70, bitacora: "SECRETO-BITACORA", articles: "SECRETO-ART", file_name: "foto.jpg" },
            { id: 2, actividad_puesto_id: 32, plaza_id: 70, bitacora: "x", articles: "x", file_name: "x" },
            { id: 3, actividad_puesto_id: 33, plaza_id: 71, bitacora: "x", articles: "x", file_name: "x" }, // otra plaza
            { id: 4, actividad_puesto_id: 41, plaza_id: 72, bitacora: "x", articles: "x", file_name: "x" }, // plaza con @
            { id: 5, actividad_puesto_id: 41, plaza_id: 70, bitacora: "x", articles: "x", file_name: "x" },
        ],
        e_estructura_plazas: [{ id: 70, nombre: "Plaza diurna 1", codigo_plaza: "P7-D1" }, { id: 71, nombre: "Plaza nocturna", codigo_plaza: "P7-N1" }, { id: 72, nombre: "Hueco", codigo_plaza: "P8@1" }],
        e_actividades: [
            { id: 1, nombre_actividad: "Registrar visitantes", fecha_inicio: new Date("2026-03-01T00:00:00Z"), frecuencia: frec("Cada turno"), firma_responsable: "SECRETO-FIRMA", descripcion_actividad: "x" },
            { id: 2, nombre_actividad: "Revisar el equipo de radio", fecha_inicio: new Date("2026-05-01T00:00:00Z"), frecuencia: frec("Diaria", ["06:00"]), firma_responsable: "x", descripcion_actividad: "x" },
            { id: 3, nombre_actividad: "Ronda nocturna", fecha_inicio: new Date("2026-04-01T00:00:00Z"), frecuencia: frec("Noche"), firma_responsable: "x", descripcion_actividad: "x" },
        ],
        e_estructura_puesto: [{ id: 7, codigo: "P7", nombre: "Oficial de recepción", sucursal_id: 5 }, { id: 8, codigo: "P8", nombre: "Supervisor", sucursal_id: 5 }],
        e_estructura_sucursal: [{ id: 5, nro_sucursal: "S1", nombre: "Sede Central", contrato_id: 4 }],
        e_estructura_contrato: [{ id: 4, nro_contrato: "C1", nombre: "Contrato", cliente_id: 2, empresa_id: 1, division_id: 3 }],
        e_estructura_empresa: [{ id: 1, codigo: "CH", nombre: "Corporación González" }], e_estructura_cliente: [{ id: 2, nombre: "CCSS" }], n_division: [{ id: 3, nombre: "Seguridad" }],
    });

    it("carga en lote: la guía trae todas las actividades de las plazas de la fila, sin bitácora ni firmas", async () => {
        const { db, calls } = fakeDb(tablas());
        const out = await actividadesForm.loadRecords(db, [31, 41, 999], { firmas: true });
        assert.deepEqual(out.map((r) => r.id), [31, 41]); // el 999 no existe
        const g = out[0]!;
        // plaza 70: actividades 1 y 2 (la 3 es de otra plaza); la más reciente primero
        assert.deepEqual(g.listas.actividades!.map((a) => a.actividad), ["Revisar el equipo de radio", "Registrar visitantes"]);
        assert.equal(g.estructura.puesto, "P7 - Oficial de recepción");
        assert.equal(g.valores.plaza, "Plaza diurna 1"); // la 41 también es de la plaza 70, pero la plaza con «@» no cuenta
        assert.deepEqual(g.hier, { puesto: 7, corpo: 5, contrato: 4, cliente: 2, empresa: 1, division: 3 });
        const prop = out[1]!;
        assert.equal(prop.valores.puesto_nombre, "Supervisor");
        assert.equal(prop.valores.plaza, "Plaza diurna 1");
        const s = JSON.stringify(out);
        for (const secreto of ["SECRETO-BITACORA", "SECRETO-ART", "SECRETO-FIRMA", "foto.jpg"]) assert.equal(s.includes(secreto), false, secreto);
        // una consulta por tabla (no una por registro) y ninguna pide columnas internas
        const porTabla = new Map<string, number>();
        for (const c of calls) porTabla.set(c.table, (porTabla.get(c.table) ?? 0) + 1);
        assert.ok([...porTabla.entries()].every(([t, n]) => n <= 3), JSON.stringify([...porTabla]));
        for (const c of calls) for (const k of ["bitacora", "articles", "file_name", "firma_responsable"]) assert.equal(k in (c.args.select ?? {}), false, `${c.table}.${k}`);
    });
    it("una fila sin plazas válidas entrega solo su actividad", async () => {
        const t = tablas();
        t.e_actividades_puesto_plaza = t.e_actividades_puesto_plaza.filter((x) => x.id !== 5 && x.id !== 1);
        const { db } = fakeDb(t);
        const [r] = await actividadesForm.loadRecords(db, [31], { firmas: false });
        assert.deepEqual(r!.listas.actividades!.map((a) => a.actividad), ["Registrar visitantes"]);
        assert.equal(r!.valores.plaza, null);
    });

    it("muestra completa para Guardify", () => {
        const acts = ["Registrar a todos los visitantes en la bitácora", "Revisar el equipo de radio al iniciar el turno", "Hacer la ronda de las instalaciones", "Controlar el ingreso de vehículos", "Reportar cualquier novedad al supervisor", "Verificar el funcionamiento de las cámaras", "Custodiar las llaves del puesto", "Atender las consultas del cliente", "Mantener limpia el área de recepción", "Entregar el puesto al relevo con las novedades"];
        const r = armarRegistro(raw({ actividades: acts.map((nombre, i) => ({ id: i + 1, nombre_actividad: nombre, frecuencia: frec(i % 2 ? "Diaria" : "Cada turno", ["06:00", "18:00"]) })) }), ubic, true);
        assert.equal(r.listas.actividades!.length, 10);
        const { hier: _h, ...sin } = r;
        writeFormSample("actividades", [sin]);
    });
});
