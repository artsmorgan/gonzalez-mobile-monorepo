import type { ReportDataAccess } from "../../reportDynamicPrisma";
import { findByIds, ubicacionTextos } from "../enrich";
import type { FormRecord, GuardifyFormModule } from "../forms";
import { fmtDt } from "../mappers";
import { loadPuestoHierarchy, type Hierarchy } from "../scope";

/**
 * Cambio de ubicación del puesto como formulario (`c_ubicacion_puesto_registro_cambios`). No hay generador individual ni firma guardada:
 * el formato sale de las columnas del consolidado. IGUAL QUE EL MÓDULO DE LISTA, NUNCA se entregan la latitud ni la longitud (decisión de
 * seguridad ya tomada ahí: son las coordenadas de un puesto de vigilancia); el documento dice si el puesto tenía ubicación anterior y
 * cuántos metros se movió. La tabla no tiene `isActive`.
 */
const txt = (v: unknown): string | null => { const s = String(v ?? "").trim(); return s ? s : null; };

/** Distancia en metros entre la ubicación anterior y la nueva (la misma fórmula del módulo de lista); null si falta alguna coordenada. */
export function metrosEntre(lat1: unknown, lng1: unknown, lat2: unknown, lng2: unknown): number | null {
    const [a, b, c, d] = [lat1, lng1, lat2, lng2].map((x) => (txt(x) == null ? NaN : Number(x)));
    if (![a, b, c, d].every((n) => Number.isFinite(n))) return null;
    if (Math.abs(a!) > 90 || Math.abs(c!) > 90 || Math.abs(b!) > 180 || Math.abs(d!) > 180) return null;
    const rad = Math.PI / 180;
    const dLat = (c! - a!) * rad, dLng = (d! - b!) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a! * rad) * Math.cos(c! * rad) * Math.sin(dLng / 2) ** 2;
    return Math.round(2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h))));
}

/** `responsable`: «código - nombre» de quien registró el cambio (`created_by`), como en el módulo de lista. */
export function armarRegistro(raw: any, ubic: FormRecord["estructura"], _firmas: boolean, responsable: string | null = null, hier: Hierarchy = {}): FormRecord {
    const creado = fmtDt(raw.created_at);
    const teniaAnterior = !!(txt(raw.latitud_anterior) && txt(raw.longitud_anterior));
    const metros = metrosEntre(raw.latitud_anterior, raw.longitud_anterior, raw.latitud_nueva, raw.longitud_nueva);
    const valores: FormRecord["valores"] = {
        fecha: creado ? creado.slice(0, 10) : null,
        hora: creado ? creado.slice(11, 16) : null,
        tenia_ubicacion_anterior: teniaAnterior ? "Sí" : "No",
        distancia: metros !== null ? `${metros} m` : "No aplica (sin ubicación anterior)",
        responsable: txt(responsable),
    };
    // Sin firmas: el módulo no guarda ninguna.
    return { id: Number(raw.id), variante: null, creado, estructura: ubic, valores, listas: {}, firmas: {}, firmasPresentes: [], hier };
}

export const cambiosUbicacionPuestoForm: GuardifyFormModule = {
    async loadRecords(db: ReportDataAccess, ids, { firmas }) {
        const rows: any[] = await (db as any).c_ubicacion_puesto_registro_cambios.findMany({ where: { id: { in: ids } } });
        if (!rows.length) return [];
        const [hiers, empleados] = await Promise.all([
            loadPuestoHierarchy(db as any, rows.map((r) => Number(r.puesto_id))),
            findByIds<{ codigo: string | null; nombre: string | null; primer_apellido: string | null; segundo_apellido: string | null }>(db as any, "c_empleado", rows.map((r) => r.created_by), { codigo: true, nombre: true, primer_apellido: true, segundo_apellido: true }),
        ]);
        const ubicIds = rows.map((r) => { const h = hiers.get(Number(r.puesto_id)); return { empresa: h?.empresa, cliente: h?.cliente, division: h?.division, contrato: h?.contrato, corpo: h?.corpo, puesto: r.puesto_id }; });
        const ubic = await ubicacionTextos(db as any, ubicIds);
        const quien = (id: unknown): string | null => {
            const e = empleados.get(Number(id));
            if (!e) return null;
            const nombre = [e.nombre, e.primer_apellido, e.segundo_apellido].filter(Boolean).join(" ").trim();
            const codigo = txt(e.codigo);
            return nombre ? (codigo ? `${codigo} - ${nombre}` : nombre) : codigo;
        };
        return rows.map((r, i) => armarRegistro(r, ubic(ubicIds[i]!), firmas, quien(r.created_by), hiers.get(Number(r.puesto_id)) ?? {}));
    },
};
