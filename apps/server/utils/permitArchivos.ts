/**
 * Quién puede ver los archivos adjuntos de una solicitud de permiso. Módulo puro (sin base de datos) para probarlo.
 *
 * Antes solo el ejecutivo de cuenta asignado podía abrirlos: la persona que pidió el permiso adjuntaba su imagen o documento y después no podía verlo.
 * Ahora pueden verlos las dos partes: la persona dueña de la solicitud y el ejecutivo asignado (directamente o por el supervisor de quien consulta,
 * como en el listado de solicitudes).
 */
export type PermisoParaArchivos = { empleado_id?: unknown; ejecutivo_cuenta?: unknown };

const toInt = (v: unknown): number | null => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
};

/** ¿Es la persona dueña de la solicitud? */
export function esDuenoDelPermiso(record: PermisoParaArchivos, currentEmployeeId: number): boolean {
    const owner = toInt(record.empleado_id);
    return owner != null && owner === toInt(currentEmployeeId);
}

/** ¿Es el ejecutivo asignado (él mismo, o el ejecutivo es su supervisor)? */
export function esEjecutivoDelPermiso(record: PermisoParaArchivos, currentEmployeeId: number, myEjecutivoCuentaId: number | null): boolean {
    const ejecutivo = toInt(record.ejecutivo_cuenta);
    if (ejecutivo == null) return false;
    return ejecutivo === toInt(currentEmployeeId) || (myEjecutivoCuentaId != null && ejecutivo === toInt(myEjecutivoCuentaId));
}

export function puedeVerArchivosDelPermiso(p: { record: PermisoParaArchivos; currentEmployeeId: number; myEjecutivoCuentaId: number | null }): boolean {
    return esDuenoDelPermiso(p.record, p.currentEmployeeId) || esEjecutivoDelPermiso(p.record, p.currentEmployeeId, p.myEjecutivoCuentaId);
}

export const ARCHIVO_PERMISO_DENEGADO = "Solo la persona del permiso o su ejecutivo asignado pueden ver este archivo";
