import { nombresEmpleado, usuarioInserta } from "../enrich";
import { fmtDt } from "../mappers";

/**
 * Auditoría de un registro tomada del historial de cambios (`c_cambios_apps_modules`) cuando la tabla propia no guarda
 * `created_at`/`created_by`/`updated_at`/`updated_by`. La app escribe una entrada `__created__` al crear y una entrada por cada
 * edición (nunca con `__created__`).
 *   - creado / creado_por: la entrada `__created__` (la más antigua).
 *   - modificado / modificado_por: la última entrada que NO es `__created__`.
 * Se consulta por bloques de 1000 ids (dos consultas por bloque: las altas con `cambios contains "__created__"` y todas las demás por id,
 * ambas sin traer el contenido de `cambios`, que puede incluir firmas) y un lote de empleados.
 */
export type AuditoriaHistorial = { creado: string | null; creado_por: string | null; modificado: string | null; modificado_por: string | null };

type Entrada = { id: number; registro: number; by: unknown; at: string | null };

export async function auditoriaPorHistorial(db: any, tabla: string, ids: unknown[]): Promise<Map<number, AuditoriaHistorial>> {
    const out = new Map<number, AuditoriaHistorial>();
    const unicos = [...new Set(ids.map(Number).filter((n) => Number.isFinite(n) && n > 0))];
    if (!unicos.length) return out;
    const altas = new Map<number, Entrada>();
    const ediciones = new Map<number, Entrada>();
    const mejorAt = (a: Entrada, b: Entrada) => ((a.at ?? "") === (b.at ?? "") ? a.id - b.id : (a.at ?? "") < (b.at ?? "") ? -1 : 1);
    try {
        for (let i = 0; i < unicos.length; i += 1000) {
            const bloque = unicos.slice(i, i + 1000);
            const select = { id: true, registro_id: true, created_by: true, created_at: true };
            const [soloAltas, todas] = await Promise.all([
                db.c_cambios_apps_modules.findMany({ where: { nombre_tabla: tabla, registro_id: { in: bloque }, cambios: { contains: "__created__" } }, select }),
                db.c_cambios_apps_modules.findMany({ where: { nombre_tabla: tabla, registro_id: { in: bloque } }, select }),
            ]);
            const idsAlta = new Set<number>();
            for (const f of soloAltas as any[]) {
                idsAlta.add(Number(f.id));
                const e: Entrada = { id: Number(f.id), registro: Number(f.registro_id), by: f.created_by, at: fmtDt(f.created_at) };
                const prev = altas.get(e.registro);
                if (!prev || mejorAt(e, prev) < 0) altas.set(e.registro, e);
            }
            for (const f of todas as any[]) {
                if (idsAlta.has(Number(f.id))) continue;
                const e: Entrada = { id: Number(f.id), registro: Number(f.registro_id), by: f.created_by, at: fmtDt(f.created_at) };
                const prev = ediciones.get(e.registro);
                if (!prev || mejorAt(e, prev) > 0) ediciones.set(e.registro, e);
            }
        }
        const nombres = await nombresEmpleado(db, [...altas.values(), ...ediciones.values()].map((e) => e.by));
        for (const id of new Set([...altas.keys(), ...ediciones.keys()])) {
            const a = altas.get(id), m = ediciones.get(id);
            out.set(id, {
                creado: a?.at ?? null,
                creado_por: a ? usuarioInserta(a.by, nombres) : null,
                modificado: m?.at ?? null,
                modificado_por: m ? usuarioInserta(m.by, nombres) : null,
            });
        }
    } catch (e) {
        // El historial es un dato complementario: si no se puede leer, el reporte sigue con esas columnas en null.
        console.warn("[guardifyReports] no se pudo leer el historial de cambios de", tabla, (e as Error)?.message);
        return new Map();
    }
    return out;
}
