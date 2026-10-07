import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapTiempoAlmuerzoRow } from "../mappers";
import { parseReportParams } from "../params";
import { loadTiempoAlmuerzo, tiempoAlmuerzo } from "./tiempoAlmuerzo";

const raw = (id: number, over: Record<string, unknown> = {}) => ({
    id, empleadoId: 7, inicio: new Date("2026-09-10T12:00:00Z"), fin: new Date("2026-09-10T12:45:00Z"), empleado_nombre: "Ana Rojas", cedula_empleado: "1-111", minutos_almuerzo: 45,
    empresa_id: 1, cliente_id: 2, division_id: 3, contrato_id: 4, corpo_id: 5, puesto_id: 6,
    empresa_nombre: "9 - Empresa", cliente_nombre: "Cliente", division_nombre: "D1 - Seguridad", contrato_nombre: "C1 - Contrato", corpo_nombre: "S1 - Sucursal", puesto_nombre: "P1 - Puesto",
    pausas_list: [{}], es_manual: false, firma_empleado: "data:image/png;base64,AAAA", ...over,
});

const table = (rows: any[]) => ({ findMany: async (a: any) => rows.filter((r) => !a?.where?.id?.in || a.where.id.in.includes(r.id)) });
let calls: Record<string, number> = {};
const counted = (name: string, rows: any[]) => ({ findMany: async (a: any) => { calls[name] = (calls[name] ?? 0) + 1; return table(rows).findMany(a); } });
const db: any = {
    c_empleado: counted("c_empleado", [{ id: 7, codigo: "1934", nombre: "Ana", primer_apellido: "Rojas", segundo_apellido: null }, { id: 8, codigo: "", nombre: "Beto", primer_apellido: "Mora", segundo_apellido: null }]),
    e_estructura_sucursal: counted("e_estructura_sucursal", [{ id: 5, ejecutivoCuenta_id: 10 }, { id: 15, ejecutivoCuenta_id: null }]),
    n_ejecutivo_cuenta: counted("n_ejecutivo_cuenta", [{ id: 10, nombre: "Carla Soto" }]),
};
const params = (extra: Record<string, string> = {}) => parseReportParams(new URLSearchParams({ from: "2026-09-01", to: "2026-10-01", ...extra }));

describe("tiempo_almuerzo: columnas comunes", () => {
    const data = [
        raw(1),
        raw(2, { empleadoId: 8, empleado_nombre: "Beto Mora", corpo_id: 15, contrato_id: 9, division_nombre: "3", firma_empleado: "x" }),
        raw(3, { inicio: new Date("2026-10-01T00:00:00Z"), fin: new Date("2026-10-01T00:45:00Z") }), // inicia fuera del periodo (to es exclusivo)
        raw(4, { inicio: new Date("2026-08-31T23:30:00Z"), fin: new Date("2026-09-01T00:15:00Z") }), // inicia antes del periodo
    ];
    let seen: any;
    const query = async (_db: any, filters: any, orderKey: string) => { seen = { filters, orderKey }; return data; };

    it("pide el periodo ampliado un día por lado y lo recorta por la fecha de inicio [from, to)", async () => {
        calls = {};
        const rows = await loadTiempoAlmuerzo(db, params(), query);
        assert.deepEqual(seen, { filters: { inicioDesde: "2026-08-31T00:00:00", finHasta: "2026-10-02T23:59:59" }, orderKey: "inicio" });
        assert.deepEqual(rows.map((r) => r.id), [1, 2]);
    });
    it("agrega empleado «código - nombre», ejecutivo de cuenta y usuario que lo registró al final de la fila, sin quitar columnas", async () => {
        const [a, b] = await loadTiempoAlmuerzo(db, params(), query);
        const base = Object.keys(mapTiempoAlmuerzoRow(raw(1)));
        assert.deepEqual(Object.keys(a!), [...base, "ejecutivo_cuenta", "usuario_inserta"]);
        assert.equal(a!.empleado, "1934 - Ana Rojas");
        assert.equal(a!.cedula, "1-111");
        assert.equal(a!.division, "D1 - Seguridad");
        assert.equal(a!.ejecutivo_cuenta, "Carla Soto");
        assert.equal(a!.usuario_inserta, "Ana Rojas");
        // Sin código: solo el nombre; sin ejecutivo: null; un nombre que es solo el id se expone vacío.
        assert.equal(b!.empleado, "Beto Mora");
        assert.equal(b!.ejecutivo_cuenta, null);
        assert.equal(b!.division, null);
        assert.equal(b!.usuario_inserta, "Beto Mora");
    });
    it("carga por lote: una consulta por tabla sin importar cuántas filas", async () => {
        calls = {};
        await loadTiempoAlmuerzo(db, params(), query);
        assert.deepEqual(calls, { c_empleado: 1, e_estructura_sucursal: 1, n_ejecutivo_cuenta: 1 });
    });
    it("nunca expone la firma", async () => {
        const s = JSON.stringify(await loadTiempoAlmuerzo(db, params(), query));
        for (const bad of ["base64", "firma"]) assert.equal(s.includes(bad), false, bad);
    });
    it("con alcance solo deja los nodos pedidos; vacío no ve nada", async () => {
        assert.deepEqual((await loadTiempoAlmuerzo(db, params({ scope: "contrato:9" }), query)).map((r) => r.id), [2]);
        assert.equal((await loadTiempoAlmuerzo(db, params({ scope: "empresa:77" }), query)).length, 0);
        assert.equal((await loadTiempoAlmuerzo(db, params({ scope: "" }), query)).length, 0);
    });
    it("declara alcance y sus claves de búsqueda, filtro y orden existen en la fila", async () => {
        assert.equal(tiempoAlmuerzo.supportsScope, true);
        const [o] = await loadTiempoAlmuerzo(db, params(), query);
        for (const k of [...tiempoAlmuerzo.searchKeys, ...tiempoAlmuerzo.filterKeys, ...tiempoAlmuerzo.sortKeys, tiempoAlmuerzo.defaultSort]) assert.ok(k in o!, k);
    });
});
