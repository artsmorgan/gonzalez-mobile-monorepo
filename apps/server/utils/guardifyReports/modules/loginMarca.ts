import { ubicacionTextos, type UbicacionIds, type UbicacionTextos } from "../enrich";
import type { OutRow } from "../listing";
import { queryLoginMarcaRows } from "../../reports-functions/loginMarcaReport";
import { mapLoginMarcaRow } from "../mappers";
import { addDays } from "../params";
import { loadPuestoHierarchy, matchesScope } from "../scope";
import type { GuardifyReportModule } from "../types";
import { ubicacionPorEmpleado } from "./ingresosUsuario";

/**
 * Fila del login de marca con las 11 columnas estándar. `creado` = `fecha_hora` (momento del ingreso, que es cuando se crea el
 * registro; la tabla no tiene `created_at`); `creado_por` = el propio empleado; `modificado`/`modificado_por` no existen (null: la
 * tabla se actualiza al marcar, pero sin guardar cuándo ni quién).
 */
export function mapLoginMarcaStdRow(r: any, ubic?: UbicacionTextos | null): OutRow {
    const { fecha, puesto: _puesto, ...resto } = mapLoginMarcaRow(r);
    return {
        id: resto.id,
        creado: fecha,
        creado_por: resto.empleado,
        modificado: null,
        modificado_por: null,
        empresa: ubic?.empresa ?? null,
        cliente: ubic?.cliente ?? null,
        division: ubic?.division ?? null,
        contrato: ubic?.contrato ?? null,
        sucursal: ubic?.sucursal ?? null,
        puesto: ubic?.puesto ?? null,
        ...resto,
    };
}

/** Empleado (id) por cédula, en bloques de 1000. */
async function empleadosPorCedula(db: any, cedulas: string[]): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    const unicas = [...new Set(cedulas.map((c) => String(c ?? "").trim()).filter(Boolean))];
    try {
        for (let i = 0; i < unicas.length; i += 1000) {
            const emps = await db.c_empleado.findMany({ where: { cedula: { in: unicas.slice(i, i + 1000) } }, select: { id: true, cedula: true } });
            for (const e of emps) out.set(String(e.cedula ?? "").trim(), Number(e.id));
        }
    } catch (e) {
        console.warn("[guardifyReports] login_marca: no se pudo buscar a los empleados por cédula", (e as Error)?.message);
        return new Map();
    }
    return out;
}

/**
 * Login de marca (`c_login_marca_almuerzo`). Solo guarda `puesto_id` (y solo una vez que el empleado marca): la jerarquía se deduce
 * del puesto de la marca; si el ingreso aún no tiene puesto, de la plaza actual del empleado (por cédula). Sin ninguna de las dos, los
 * niveles salen null. El alcance se evalúa contra esa misma ubicación.
 */
export const loginMarca: GuardifyReportModule = {
    id: "login_marca",
    supportsScope: true,
    searchKeys: ["empleado", "cedula", "puesto", "sucursal", "contrato"],
    filterKeys: ["empresa", "cliente", "division", "contrato", "sucursal", "puesto"],
    sortKeys: ["creado", "cedula", "empleado", "empresa", "cliente", "contrato", "sucursal", "puesto", "entrada_real", "salida_real"],
    defaultSort: "creado",
    async load(db, p) {
        const rows: any[] = await queryLoginMarcaRows(db, { creadoDesde: `${p.from}T00:00:00`, creadoHasta: `${addDays(p.to, -1)}T23:59:59` }, "fecha_hora");
        if (!rows.length) return [];
        const hier = await loadPuestoHierarchy(db as any, rows.map((r) => Number(r.puesto_id)));
        // Ingresos sin puesto resoluble: plaza actual del empleado.
        const sinPuesto = rows.filter((r) => !hier.has(Number(r.puesto_id)));
        const idPorCedula = sinPuesto.length ? await empleadosPorCedula(db, sinPuesto.map((r) => r.cedula_empleado)) : new Map<string, number>();
        const ubicEmpleado = idPorCedula.size ? await ubicacionPorEmpleado(db, [...idPorCedula.values()]) : new Map<number, UbicacionIds>();
        const ubicacionDe = (r: any): UbicacionIds => {
            const h = hier.get(Number(r.puesto_id));
            if (h) return h;
            const emp = idPorCedula.get(String(r.cedula_empleado ?? "").trim());
            return (emp != null ? ubicEmpleado.get(emp) : undefined) ?? {};
        };
        const scope = p.scope;
        const kept = !scope ? rows : rows.filter((r) => matchesScope(ubicacionDe(r) as any, scope));
        const textos = await ubicacionTextos(db as any, kept.map(ubicacionDe));
        return kept.map((r) => mapLoginMarcaStdRow(r, textos(ubicacionDe(r))));
    },
};
