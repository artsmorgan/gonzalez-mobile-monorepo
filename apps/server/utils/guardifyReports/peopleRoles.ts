import { verifyGuardifyApiKey } from "./auth";

/**
 * Rol base de cada persona en MonitoreApp, para que Guardify lo sugiera al darle acceso (decisión del 20 nov 2026: MonitoreApp es la base y
 * Guardify hace override). Es el MISMO cálculo que `/api/check-permissions` y el menú de la app: la categoría de empleado de cada plaza
 * (pg_categoria_empleado.codigo) da OPERATIVO / SUPERVISOR / ADMINISTRATIVO por división; además dice si es súper administrador
 * (`n_employees_superadmin`; solo si la persona está activa). Solo lectura, misma llave que los reportes. No devuelve nombres ni otros datos personales.
 */
export type BaseRole = "OPERATIVO" | "SUPERVISOR" | "ADMINISTRATIVO";
export type PersonRoles = { cedula: string; found: boolean; superAdmin: boolean; base: BaseRole | null; byDivision: { divisionId: number; division: string; role: BaseRole }[] };
export type PeopleRolesDeps = { getDb: () => any; env?: Record<string, string | undefined> };

export const MAX_CEDULAS = 200;
const RANK: Record<BaseRole, number> = { OPERATIVO: 1, SUPERVISOR: 2, ADMINISTRATIVO: 3 };

/** Igual que `check-permissions`: códigos conocidos; cualquier otro (o ninguno) es OPERATIVO. */
export function roleFromCategoria(codigo: string | null | undefined): BaseRole {
    switch (String(codigo ?? "").trim().toUpperCase()) {
        case "ADM": return "ADMINISTRATIVO";
        case "COO":
        case "SUP": return "SUPERVISOR";
        default: return "OPERATIVO";
    }
}

/** El rol base que se sugiere en Guardify (un solo rol por app): el de mayor alcance entre sus divisiones. */
export function pickBaseRole(roles: BaseRole[]): BaseRole | null {
    return roles.reduce<BaseRole | null>((best, r) => (best === null || RANK[r] > RANK[best] ? r : best), null);
}

/**
 * `n_employees_superadmin` no está en el esquema Prisma: se lee por la vía dinámica (como `isSuperAdminEmpleado`). Si esa vía no acepta
 * `in`, se consulta cédula por cédula, en lotes de `FALLBACK_BATCH` a la vez: hasta 200 consultas simultáneas a la vía dinámica en plena falla
 * la cargarían más.
 */
export const FALLBACK_BATCH = 10;

async function superAdmins(db: any, cedulas: string[]): Promise<any[]> {
    try {
        return await db.n_employees_superadmin.findMany({ where: { employee_cedula: { in: cedulas } }, select: { employee_cedula: true } });
    } catch {
        const found: any[] = [];
        for (let i = 0; i < cedulas.length; i += FALLBACK_BATCH) {
            const rows = await Promise.all(cedulas.slice(i, i + FALLBACK_BATCH).map((c) => db.n_employees_superadmin.findFirst({ where: { employee_cedula: c } })));
            found.push(...rows.filter(Boolean));
        }
        return found;
    }
}

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

export function parseCedulas(raw: string | null): string[] | null {
    const list = [...new Set(String(raw ?? "").split(",").map((s) => s.trim()).filter(Boolean))];
    if (list.length === 0 || list.length > MAX_CEDULAS) return null;
    if (list.some((c) => c.length > 30 || !/^[0-9A-Za-z-]+$/.test(c))) return null;
    return list;
}

/** GET /api/guardify/people/roles?cedulas=1,2 → { people: PersonRoles[] } */
export async function handleGuardifyPeopleRoles(req: Request, deps: PeopleRolesDeps): Promise<Response> {
    const auth = verifyGuardifyApiKey(req.headers, deps.env);
    if (!auth.ok) return json({ error: auth.error, message: auth.message }, auth.status);
    const cedulas = parseCedulas(new URL(req.url).searchParams.get("cedulas"));
    if (!cedulas) return json({ error: "bad_request", message: `cedulas: entre 1 y ${MAX_CEDULAS} cédulas separadas por coma.` }, 400);
    try {
        const db = deps.getDb();
        const empleados: any[] = await db.c_empleado.findMany({ where: { cedula: { in: cedulas } }, select: { id: true, cedula: true, estado: true } });
        const activos = empleados.filter((e) => String(e.estado ?? "").trim().toUpperCase() !== "BA");
        const ids = activos.map((e) => Number(e.id));
        const plazas: any[] = ids.length ? await db.c_empleado_plaza.findMany({ where: { empleado_id: { in: ids } }, select: { empleado_id: true, plaza_id: true, division_id: true } }) : [];
        const plazaIds = [...new Set(plazas.map((p) => p.plaza_id).filter((x) => x != null).map(Number))];
        const divIds = [...new Set(plazas.map((p) => p.division_id).filter((x) => x != null).map(Number))];
        const [estr, divs, supers]: any[][] = await Promise.all([
            plazaIds.length ? db.e_estructura_plazas.findMany({ where: { id: { in: plazaIds } }, select: { id: true, categoriaSalarial_id: true } }) : [],
            divIds.length ? db.n_division.findMany({ where: { id: { in: divIds } }, select: { id: true, nombre: true } }) : [],
            superAdmins(db, cedulas),
        ]);
        const salIds = [...new Set(estr.map((p) => p.categoriaSalarial_id).filter((x) => x != null).map(Number))];
        const sal: any[] = salIds.length ? await db.pg_categoria_salarial.findMany({ where: { id: { in: salIds } }, select: { id: true, categoriaEmpleado_id: true } }) : [];
        const catIds = [...new Set(sal.map((s) => s.categoriaEmpleado_id).filter((x) => x != null).map(Number))];
        const cats: any[] = catIds.length ? await db.pg_categoria_empleado.findMany({ where: { id: { in: catIds } }, select: { id: true, codigo: true } }) : [];

        const plazaCat = new Map(estr.map((p) => [Number(p.id), p.categoriaSalarial_id == null ? null : Number(p.categoriaSalarial_id)]));
        const salCat = new Map(sal.map((s) => [Number(s.id), s.categoriaEmpleado_id == null ? null : Number(s.categoriaEmpleado_id)]));
        const catCode = new Map(cats.map((c) => [Number(c.id), String(c.codigo ?? "")]));
        const divName = new Map(divs.map((d) => [Number(d.id), String(d.nombre ?? "")]));
        const superSet = new Set(supers.map((s) => String(s.employee_cedula ?? "").trim()));
        const byCedula = new Map(activos.map((e) => [String(e.cedula).trim(), Number(e.id)]));

        const people: PersonRoles[] = cedulas.map((cedula) => {
            const id = byCedula.get(cedula);
            const byDivision: PersonRoles["byDivision"] = [];
            if (id !== undefined) {
                for (const p of plazas.filter((x) => Number(x.empleado_id) === id)) {
                    // Mismas reglas que check-permissions: sin plaza, división o categoría, esa plaza no cuenta.
                    if (p.plaza_id == null || p.division_id == null || !divName.has(Number(p.division_id))) continue;
                    const s = plazaCat.get(Number(p.plaza_id));
                    const c = s == null ? null : salCat.get(s);
                    if (c == null || !catCode.has(c)) continue;
                    const role = roleFromCategoria(catCode.get(c));
                    const divisionId = Number(p.division_id);
                    if (!byDivision.some((b) => b.divisionId === divisionId && b.role === role)) byDivision.push({ divisionId, division: divName.get(divisionId)!, role });
                }
            }
            // Una persona de baja o desconocida sale `found: false` y no se reporta como súper administrador (aunque siga en la tabla).
            return { cedula, found: id !== undefined, superAdmin: id !== undefined && superSet.has(cedula), base: pickBaseRole(byDivision.map((b) => b.role)), byDivision };
        });
        console.log(JSON.stringify({ level: "info", msg: "guardify_people_roles", asked: cedulas.length, found: people.filter((p) => p.found).length, user: auth.user }));
        return json({ people });
    } catch (e) {
        console.error(JSON.stringify({ level: "error", msg: "guardify_people_roles_failed", error: String(e) }));
        return json({ error: "internal", message: "No se pudieron leer los roles." }, 500);
    }
}
