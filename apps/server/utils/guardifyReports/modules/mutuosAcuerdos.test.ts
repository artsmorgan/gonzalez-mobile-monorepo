import assert from "node:assert/strict";
import Module from "node:module";
import { before, describe, it } from "node:test";
import type { ReportParams } from "../params";
import { parseScope } from "../scope";

// `exceljs` solo lo usan los generadores de Excel de los reportes; si no está instalado, se sustituye para poder probar el módulo.
let mapMutuoAcuerdoRow: typeof import("./mutuosAcuerdos").mapMutuoAcuerdoRow;
let mutuosAcuerdos: typeof import("./mutuosAcuerdos").mutuosAcuerdos;
before(async () => {
    try {
        require.resolve("exceljs");
    } catch {
        const load = (Module as any)._load;
        (Module as any)._load = function (request: string, ...rest: unknown[]) {
            return request === "exceljs" ? {} : load.call(this, request, ...rest);
        };
    }
    ({ mapMutuoAcuerdoRow, mutuosAcuerdos } = await import("./mutuosAcuerdos"));
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
    id: 21,
    created_at: new Date("2026-09-12T09:00:00.000Z"),
    empresa_id: 1, cliente_id: 2, division_id: 3, contrato_id: 4, corpo_id: 5, puesto_id: 6,
    empresa_nombre: "E1 — Empresa", cliente_nombre: "Cliente", division_nombre: "D3 — División", contrato_nombre: "C4 — Contrato", corpo_nombre: "S5 — Sucursal", puesto_nombre: "P6 — Puesto",
    plazaAusente_id: 31, plazaReemplaza_id: 32, plaza_ausente_txt: "PL1 — Plaza A (N° plaza 1)", plaza_reemplaza_txt: "PL2 — Plaza B",
    ejecutivo_cuenta: 8, ejecutivo_nombre: "Marta Vega",
    empleado_ausente_txt: "101 — Ana Pérez", empleado_reemplaza_txt: "102 — Luis Mora",
    marca_ausente_txt: "2026-09-13 / D", marca_reemplaza_txt: "2026-09-13 / N",
    ausente_acepta_txt: "Sí", reemplaza_acepta_txt: "No",
    ausente_acepta_at: new Date("2026-09-12T10:00:00.000Z"), reemplaza_acepta_at: null,
    motivo: "Cita médica. ".repeat(80), estado: "Aprobado", cambio_guardia_id: 55,
    firma_digital_ejecutivo_txt: "Sí", firma_ejecutivo_cuenta_manual: "data:image/png;base64,AAAA", firma_ejecutivo_manual_data_uri: "data:image/png;base64,AAAA",
    created_by: 9, created_by_txt: "9 — Carla Ruiz",
    ...o,
});

describe("mutuos acuerdos: mapeo", () => {
    it("aplana la fila, recorta el motivo y no expone firmas", () => {
        const o = mapMutuoAcuerdoRow(crudo());
        assert.equal(o.id, 21);
        assert.equal(o.creado, "2026-09-12T09:00:00");
        assert.equal(o.sucursal, "S5 — Sucursal");
        assert.equal(o.oficial_ausente, "101 — Ana Pérez");
        assert.equal(o.ausente_acepta, "Sí");
        assert.equal(o.reemplaza_acepta, "No");
        assert.equal(o.fecha_acepta_ausente, "2026-09-12T10:00:00");
        assert.equal(o.fecha_acepta_reemplaza, null);
        assert.equal(String(o.motivo).length, 500);
        assert.equal(o.estado, "aprobado");
        assert.equal(o.cambio_guardia, 55);
        assert.equal(o.firma_digital, "Sí");
        assert.ok(!JSON.stringify(o).includes("base64"));
        assert.ok(!Object.keys(o).some((k) => k.includes("firma") && k !== "firma_digital"));
    });
    it("tolera nulos: sin cambio de guardia, sin aceptaciones y estructura antigua en 0", () => {
        const o = mapMutuoAcuerdoRow(crudo({ cambio_guardia_id: null, ausente_acepta_txt: "", reemplaza_acepta_txt: "", ausente_acepta_at: null, estado: "", motivo: "", puesto_id: 0, puesto_nombre: "0", empresa_id: 0, empresa_nombre: "0", ejecutivo_cuenta: 0, ejecutivo_nombre: "0" }));
        assert.equal(o.cambio_guardia, null);
        assert.equal(o.ausente_acepta, null);
        assert.equal(o.reemplaza_acepta, null);
        assert.equal(o.fecha_acepta_ausente, null);
        assert.equal(o.estado, "pendiente");
        assert.equal(o.motivo, null);
        assert.equal(o.puesto, null);
        assert.equal(o.empresa, null);
        assert.equal(o.ejecutivo, null);
        for (const v of Object.values(o)) assert.ok(v === null || typeof v === "string" || typeof v === "number");
    });
});

describe("mutuos acuerdos: carga y alcance", () => {
    const base = { ejecutivo_cuenta: 8, motivo: "m", firma_responsable: "", firma_ejecutivo_cuenta_digital: "", ausente_acepta: true, reemplaza_acepta: false, empleadoAusente_id: 101, empleadoReemplaza_id: 102, plazaAusente_id: 0, plazaReemplaza_id: 0, cambio_guardia_id: null, estado: "pendiente", isActive: true, created_by: 9, cliente_id: 2, division_id: 3 };
    const tables = {
        e_mutuos_acuerdos: [
            { ...base, id: 1, empresa_id: 1, contrato_id: 4, corpo_id: 5, puesto_id: 6, created_at: new Date("2026-09-05T08:00:00Z") },
            { ...base, id: 2, empresa_id: 1, contrato_id: 40, corpo_id: 50, puesto_id: 60, created_at: new Date("2026-09-30T23:00:00Z") },
            { ...base, id: 3, empresa_id: 0, contrato_id: 0, corpo_id: 0, puesto_id: 0, created_at: new Date("2026-09-06T08:00:00Z") },
            { ...base, id: 4, empresa_id: 1, contrato_id: 4, corpo_id: 5, puesto_id: 6, created_at: new Date("2026-10-01T00:00:00Z") },
        ],
        c_empleado: [
            { id: 101, codigo: "101", nombre: "Ana", primer_apellido: "Pérez", segundo_apellido: null },
            { id: 102, codigo: "102", nombre: "Luis", primer_apellido: "Mora", segundo_apellido: null },
            { id: 9, codigo: "9", nombre: "Carla", primer_apellido: "Ruiz", segundo_apellido: null },
        ],
        n_ejecutivo_cuenta: [{ id: 8, nombre: "Marta Vega" }],
    };
    it("sin alcance trae el periodo (to exclusivo), incluso filas antiguas sin estructura", async () => {
        const rows = await mutuosAcuerdos.load(fakeDb(tables), P);
        assert.deepEqual(rows.map((r) => r.id).sort(), [1, 2, 3]);
        const r1 = rows.find((r) => r.id === 1)!;
        assert.equal(r1.oficial_ausente, "101 — Ana Pérez");
        assert.equal(r1.ejecutivo, "Marta Vega");
        assert.equal(r1.creado_por, "9 — Carla Ruiz");
    });
    it("con alcance deja solo los nodos pedidos; las filas sin ubicación no se ven", async () => {
        const ids = async (scope: string) => (await mutuosAcuerdos.load(fakeDb(tables), { ...P, scope: parseScope(scope) })).map((r) => r.id).sort();
        assert.deepEqual(await ids("contrato:4"), [1]);
        assert.deepEqual(await ids("puesto:60"), [2]);
        assert.deepEqual(await ids("empresa:1"), [1, 2]);
        assert.deepEqual(await ids("contrato:4,corpo:50"), [1, 2]);
        assert.deepEqual(await mutuosAcuerdos.load(fakeDb(tables), { ...P, scope: [] }), []);
    });
    it("las claves de búsqueda, filtro y orden existen en la fila", async () => {
        const [row] = await mutuosAcuerdos.load(fakeDb(tables), P);
        for (const k of [...mutuosAcuerdos.searchKeys, ...mutuosAcuerdos.filterKeys, ...mutuosAcuerdos.sortKeys, mutuosAcuerdos.defaultSort]) assert.ok(k in row!, k);
    });
});
