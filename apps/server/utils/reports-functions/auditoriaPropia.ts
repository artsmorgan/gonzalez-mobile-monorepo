import type { ReportDataAccess } from "../reportDynamicPrisma";

/** Fila de un reporte con las columnas propias de auditoría (`created_by` / `updated_by`) ya resueltas a nombre. */
export type FilaConAuditoriaPropia = {
    /** Nombre completo de quien creó el registro según `created_by` (null si la tabla no lo guarda o el registro es anterior). */
    audit_creado_por?: string | null;
    /** Nombre completo de quien modificó el registro según `updated_by`. */
    audit_modificado_por?: string | null;
};

const esIdEmpleado = (v: unknown): boolean => /^\d+$/.test(String(v ?? "").trim());

/**
 * Resuelve, en un solo lote, el nombre de los empleados referidos por `created_by` y `updated_by` de las filas y lo deja en
 * `audit_creado_por` / `audit_modificado_por`. Las tablas guardan el id de `c_empleado` (número o texto numérico); si el valor
 * es un texto no numérico (usuario, correo) se deja tal cual. Sin valor → `null`, para que cada reporte use su respaldo
 * (historial de cambios u otra columna) en los registros anteriores a esas columnas.
 */
export async function attachAuditoriaPropia(db: ReportDataAccess, rows: unknown): Promise<void> {
    if (!Array.isArray(rows) || rows.length === 0) return;
    const lista = rows.filter((r): r is Record<string, any> => !!r && typeof r === "object");
    if (lista.length === 0) return;
    const ids = new Set<number>();
    for (const r of lista) {
        for (const k of ["created_by", "updated_by"] as const) {
            if (esIdEmpleado(r[k])) ids.add(Number(String(r[k]).trim()));
        }
    }
    const nombres = new Map<number, string>();
    if (ids.size > 0) {
        try {
            const emps = (await db.c_empleado.findMany({
                where: { id: { in: [...ids] } },
                select: { id: true, nombre: true, primer_apellido: true, segundo_apellido: true },
            })) as Array<{ id: number; nombre: string | null; primer_apellido: string | null; segundo_apellido: string | null }>;
            for (const e of emps) {
                const full = [e.nombre, e.primer_apellido, e.segundo_apellido].filter(Boolean).join(" ").trim();
                if (full) nombres.set(e.id, full);
            }
        } catch (e) {
            // La auditoría propia es complementaria: si no se pueden resolver los nombres, el reporte sigue con su respaldo.
            console.warn("[auditoriaPropia] no se pudieron resolver los nombres de created_by/updated_by:", (e as Error)?.message);
        }
    }
    const nombreDe = (v: unknown): string | null => {
        const s = String(v ?? "").trim();
        if (!s) return null;
        return esIdEmpleado(s) ? nombres.get(Number(s)) ?? null : s.slice(0, 120);
    };
    for (const r of lista) {
        r.audit_creado_por = nombreDe(r.created_by);
        r.audit_modificado_por = nombreDe(r.updated_by);
    }
}
