import type { ReportDataAccess } from "../../reportDynamicPrisma";
import { findByIds } from "../enrich";

/**
 * Empleados asignados a cada puesto (`c_empleado_plaza`, de la base de Planillas: solo lectura). Un manual enviado a un puesto le llega a TODOS los
 * empleados que ocupan ese puesto, hayan abierto el manual o no: así el reporte puede decir quién no lo ha visto.
 *
 * Se descartan los empleados dados de baja (`c_empleado.estado`). Devuelve, por puesto, los ids de empleado distintos.
 */
const INACTIVO = /inactiv|baja|retir|despid|liquid|cesad|renunci/i;

export async function asignadosPorPuesto(db: ReportDataAccess, puestoIds: unknown[]): Promise<Map<number, number[]>> {
    const ids = [...new Set(puestoIds.map(Number).filter((n) => Number.isFinite(n) && n > 0))];
    const out = new Map<number, number[]>();
    if (!ids.length) return out;
    const plazas: { empleado_id: number | null; puesto_id: number | null }[] = [];
    for (let i = 0; i < ids.length; i += 500) {
        const rows = await db.c_empleado_plaza!.findMany({ where: { puesto_id: { in: ids.slice(i, i + 500) }, empleado_id: { not: null } }, select: { empleado_id: true, puesto_id: true }, take: 200_000 });
        plazas.push(...rows);
    }
    const empleados = await findByIds<{ estado: string | null }>(db as any, "c_empleado", plazas.map((p) => p.empleado_id), { estado: true });
    for (const p of plazas) {
        const emp = Number(p.empleado_id), puesto = Number(p.puesto_id);
        if (!Number.isFinite(emp) || !Number.isFinite(puesto)) continue;
        if (INACTIVO.test(String(empleados.get(emp)?.estado ?? ""))) continue;
        const cur = out.get(puesto) ?? [];
        if (!cur.includes(emp)) cur.push(emp);
        out.set(puesto, cur);
    }
    return out;
}

/** Los empleados de todos los puestos de un manual (el principal y los vinculados), sin repetir. */
export function asignadosDelManual(porPuesto: Map<number, number[]>, puestoPrincipal: unknown, vinculados: unknown[]): number[] {
    const set = new Set<number>();
    for (const p of [puestoPrincipal, ...vinculados]) for (const e of porPuesto.get(Number(p)) ?? []) set.add(e);
    return [...set];
}
