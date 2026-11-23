import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { handleGuardifyPeopleRoles, parseCedulas, pickBaseRole, roleFromCategoria, FALLBACK_BATCH, MAX_CEDULAS } from "./peopleRoles";

// Estructuras de la propia prueba (ids y cédulas sintéticas), sin registros de negocio.
const KEY = "k".repeat(40);
const env = { GUARDIFY_REPORTS_API_KEY: KEY };
const pick = (rows: any[], where: any) => rows.filter((r) => Object.entries(where).every(([k, v]: [string, any]) => (v && typeof v === "object" && "in" in v ? v.in.includes(r[k]) : r[k] === v)));
const table = (rows: any[]) => ({ findMany: async ({ where }: any) => pick(rows, where), findFirst: async ({ where }: any) => pick(rows, where)[0] ?? null });
const db = (superFail = false) => ({
    c_empleado: table([{ id: 1, cedula: "100000001", estado: "CO" }, { id: 2, cedula: "100000002", estado: "CO" }, { id: 3, cedula: "100000003", estado: "BA" }, { id: 4, cedula: "100000004", estado: "PR" }]),
    c_empleado_plaza: table([
        { empleado_id: 1, plaza_id: 10, division_id: 1 }, // OFI en Seguridad → OPERATIVO
        { empleado_id: 1, plaza_id: 11, division_id: 2 }, // SUP en Administrativos → SUPERVISOR
        { empleado_id: 2, plaza_id: 12, division_id: 2 }, // ADM → ADMINISTRATIVO
        { empleado_id: 4, plaza_id: null, division_id: 1 }, // sin plaza: no cuenta
    ]),
    e_estructura_plazas: table([{ id: 10, categoriaSalarial_id: 20 }, { id: 11, categoriaSalarial_id: 21 }, { id: 12, categoriaSalarial_id: 22 }]),
    pg_categoria_salarial: table([{ id: 20, categoriaEmpleado_id: 30 }, { id: 21, categoriaEmpleado_id: 31 }, { id: 22, categoriaEmpleado_id: 32 }]),
    pg_categoria_empleado: table([{ id: 30, codigo: "OFI" }, { id: 31, codigo: "SUP" }, { id: 32, codigo: "ADM" }]),
    n_division: table([{ id: 1, nombre: "Seguridad" }, { id: 2, nombre: "Administrativos" }]),
    n_employees_superadmin: superFail
        ? { findMany: async () => { throw new Error("in no soportado"); }, findFirst: async ({ where }: any) => (where.employee_cedula === "100000002" ? { employee_cedula: "100000002" } : null) }
        : table([{ employee_cedula: "100000002" }, { employee_cedula: "100000003" }]),
});
const call = (qs: string, headers: Record<string, string> = { authorization: `Bearer ${KEY}` }, d = db()) =>
    handleGuardifyPeopleRoles(new Request(`http://x/api/guardify/people/roles?${qs}`, { headers }), { getDb: () => d, env });

describe("roles base para Guardify", () => {
    it("mismo mapeo de categorías que check-permissions", () => {
        assert.deepEqual(["OFI", "MIS", "OFC", "ADM", "COO", "SUP", "XYZ", null].map(roleFromCategoria), ["OPERATIVO", "OPERATIVO", "OPERATIVO", "ADMINISTRATIVO", "SUPERVISOR", "SUPERVISOR", "OPERATIVO", "OPERATIVO"]);
    });
    it("el rol base es el de mayor alcance entre divisiones", () => {
        assert.equal(pickBaseRole(["OPERATIVO", "SUPERVISOR"]), "SUPERVISOR");
        assert.equal(pickBaseRole(["ADMINISTRATIVO", "OPERATIVO"]), "ADMINISTRATIVO");
        assert.equal(pickBaseRole([]), null);
    });
    it("valida la lista de cédulas", () => {
        assert.deepEqual(parseCedulas(" 1 ,2,1"), ["1", "2"]);
        assert.equal(parseCedulas(""), null);
        assert.equal(parseCedulas("1;DROP"), null);
        assert.equal(parseCedulas(Array.from({ length: MAX_CEDULAS + 1 }, (_, i) => String(i)).join(",")), null);
    });
    it("pide la llave", async () => {
        assert.equal((await call("cedulas=1", {})).status, 401);
        assert.equal((await call("")).status, 400);
    });
    it("devuelve rol base por división, súper admin, bajas y desconocidos", async () => {
        const r = await call("cedulas=100000001,100000002,100000003,100000004,999");
        assert.equal(r.status, 200);
        const { people } = await r.json();
        assert.deepEqual(people, [
            { cedula: "100000001", found: true, superAdmin: false, base: "SUPERVISOR", byDivision: [{ divisionId: 1, division: "Seguridad", role: "OPERATIVO" }, { divisionId: 2, division: "Administrativos", role: "SUPERVISOR" }] },
            { cedula: "100000002", found: true, superAdmin: true, base: "ADMINISTRATIVO", byDivision: [{ divisionId: 2, division: "Administrativos", role: "ADMINISTRATIVO" }] },
            { cedula: "100000003", found: false, superAdmin: false, base: null, byDivision: [] }, // de baja: como si no existiera (aunque figure como súper admin)
            { cedula: "100000004", found: true, superAdmin: false, base: null, byDivision: [] }, // sin plaza válida: sin rol base
            { cedula: "999", found: false, superAdmin: false, base: null, byDivision: [] },
        ]);
    });
    it("si la vía dinámica no acepta `in`, consulta súper admins de a uno", async () => {
        const { people } = await (await call("cedulas=100000001,100000002", undefined, db(true))).json();
        assert.deepEqual(people.map((p: any) => p.superAdmin), [false, true]);
    });
    it("una persona de baja no se reporta como súper administrador aunque siga en la tabla", async () => {
        const { people } = await (await call("cedulas=100000003")).json();
        assert.deepEqual(people, [{ cedula: "100000003", found: false, superAdmin: false, base: null, byDivision: [] }]);
    });
    it("el respaldo consulta por lotes pequeños de cédulas, no todas a la vez", async () => {
        let enCurso = 0;
        let maximo = 0;
        const d: any = db(true);
        d.n_employees_superadmin.findFirst = async () => {
            enCurso++;
            maximo = Math.max(maximo, enCurso);
            await new Promise((r) => setTimeout(r, 2));
            enCurso--;
            return null;
        };
        const cedulas = Array.from({ length: 45 }, (_, i) => String(200000000 + i));
        const r = await call("cedulas=" + cedulas.join(","), undefined, d);
        assert.equal(r.status, 200);
        assert.ok(maximo > 1 && maximo <= FALLBACK_BATCH, "máximo simultáneo: " + maximo);
    });
});
