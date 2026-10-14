import { findByIds, ubicacionTextos, type UbicacionIds, type UbicacionTextos } from "../enrich";
import type { OutRow } from "../listing";
import { mapIngresoUsuarioRow } from "../mappers";
import { addDays } from "../params";
import type { GuardifyReportModule } from "../types";

/**
 * Ubicación actual de cada empleado (ids), tomada de su plaza (`c_empleado.plazaEmpleado_id` → `c_empleado_plaza`: puesto, sucursal,
 * contrato, cliente, empresa y división). En lote (dos consultas) y solo con las columnas necesarias. Si la base no tiene esa
 * columna o la consulta falla, el empleado queda sin ubicación (no se rompe el reporte). Se usa también en `loginMarca`.
 */
export async function ubicacionPorEmpleado(db: any, empleadoIds: unknown[]): Promise<Map<number, UbicacionIds>> {
    const out = new Map<number, UbicacionIds>();
    try {
        const emps = await findByIds<{ plazaEmpleado_id: number | null }>(db, "c_empleado", empleadoIds, { plazaEmpleado_id: true });
        const plazas = await findByIds<any>(db, "c_empleado_plaza", [...emps.values()].map((e) => e.plazaEmpleado_id), {
            empresa_id: true, cliente_id: true, division_id: true, contrato_id: true, corpo_id: true, puesto_id: true,
        });
        for (const [id, e] of emps) {
            const pl = plazas.get(Number(e.plazaEmpleado_id));
            if (pl) out.set(id, { empresa: pl.empresa_id, cliente: pl.cliente_id, division: pl.division_id, contrato: pl.contrato_id, corpo: pl.corpo_id, puesto: pl.puesto_id });
        }
    } catch (e) {
        console.warn("[guardifyReports] no se pudo leer la plaza de los empleados", (e as Error)?.message);
        return new Map();
    }
    return out;
}

/**
 * Fila de ingreso con las 11 columnas estándar. `creado` = inicio de la sesión; `creado_por` = el propio empleado (la sesión nace de su
 * ingreso); `modificado`/`modificado_por` salen siempre vacíos (la sesión no se edita). La jerarquía es la guardada en el propio ingreso y,
 * si no la tiene, la de la plaza actual del empleado.
 */
export function mapIngresoUsuarioStdRow(r: any, ubic?: UbicacionTextos | null): OutRow {
    const base = mapIngresoUsuarioRow(r);
    return {
        ...base,
        creado_por: base.empleado,
        modificado: null,
        modificado_por: null,
        empresa: ubic?.empresa ?? null,
        cliente: ubic?.cliente ?? null,
        division: ubic?.division ?? null,
        contrato: ubic?.contrato ?? null,
        sucursal: ubic?.sucursal ?? null,
        puesto: ubic?.puesto ?? null,
    };
}

/**
 * Ingresos de usuario (`refresh_token`). Su jerarquía propia es opcional (hoy la tabla no se escribe y sale de la plaza actual del
 * empleado), así que no admite alcance por unidad: con un alcance pedido responde 403 y Guardify exige permiso sobre toda la empresa.
 *
 * Trae a cada empleado solo con las columnas que muestra (nombre y cédula): así el reporte no depende de columnas
 * recientes de `c_empleado` que una base sin migrar todavía no tenga.
 */
export const ingresosUsuario: GuardifyReportModule = {
    id: "ingresos_usuario",
    supportsScope: false,
    searchKeys: ["empleado", "cedula", "id_sesion", "contrato", "sucursal", "puesto"],
    filterKeys: ["revocado", "empresa", "cliente", "division", "contrato", "sucursal", "puesto"],
    sortKeys: ["creado", "expira", "empleado", "cedula", "dispositivos", "empresa", "cliente", "contrato", "sucursal", "puesto"],
    defaultSort: "creado",
    async load(db, p) {
        const desde = new Date(`${p.from}T00:00:00`);
        const hasta = new Date(`${addDays(p.to, -1)}T23:59:59`);
        const rows = await db.refresh_token!.findMany({ where: { createdAt: { gte: desde, lte: hasta } }, orderBy: { id: "desc" }, take: 50_000 });
        const ids = [...new Set(rows.map((r: any) => Number(r.empleadoId)).filter((n) => Number.isFinite(n) && n > 0))];
        const emps = ids.length ? await db.c_empleado!.findMany({ where: { id: { in: ids } }, select: { id: true, nombre: true, primer_apellido: true, segundo_apellido: true, cedula: true } }) : [];
        const byId = new Map(emps.map((e: any) => [Number(e.id), e]));
        // Jerarquía guardada en el propio ingreso (columnas de `refresh_token`); en ingresos sin ella, la plaza actual del empleado.
        const propia = (r: any): UbicacionIds | null =>
            Number(r.corpo_id) > 0 && Number(r.contrato_id) > 0
                ? { empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }
                : null;
        const idsSinPropia = [...new Set(rows.filter((r: any) => !propia(r)).map((r: any) => Number(r.empleadoId)).filter((n) => Number.isFinite(n) && n > 0))];
        const ubicaciones = idsSinPropia.length ? await ubicacionPorEmpleado(db, idsSinPropia) : new Map<number, UbicacionIds>();
        const ubicacionDe = (r: any): UbicacionIds | undefined => propia(r) ?? ubicaciones.get(Number(r.empleadoId));
        const textos = await ubicacionTextos(db as any, rows.map(ubicacionDe).filter((u): u is UbicacionIds => !!u));
        return rows.map((r: any) => {
            const u = ubicacionDe(r);
            return mapIngresoUsuarioStdRow({ ...r, c_empleado: byId.get(Number(r.empleadoId)) ?? null }, u ? textos(u) : null);
        });
    },
};
