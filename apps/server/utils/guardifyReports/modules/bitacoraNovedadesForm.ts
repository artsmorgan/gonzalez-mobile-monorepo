import type { ReportDataAccess } from "../../reportDynamicPrisma";
import { findByIds, nombresEmpleado, ubicacionTextos } from "../enrich";
import type { FormRecord, GuardifyFormModule } from "../forms";
import { fmtDt } from "../mappers";
import { loadPuestoHierarchy, type Hierarchy } from "../scope";

/**
 * Bitácora de novedades como formulario (`c_puesto_notas`). No hay generador individual: el formato sale de las columnas del consolidado
 * y de la pantalla móvil de notas (una nota por documento). NO se entregan las fotos de la nota (`c_imagenes_puesto_notas`) ni
 * `firma_responsable` (es una cadena QR/GPS, no un dibujo). La firma manual (`firma_manual_responsable`) sí es un dibujo y va como firma.
 */
const txt = (v: unknown): string | null => { const s = String(v ?? "").trim(); return s ? s : null; };

/** Firma guardada como data URL o base64 suelto (igual que el generador); lo demás no es una imagen. */
export function firmaImagen(v: unknown): string | null {
    const s = String(v ?? "").trim();
    if (!s) return null;
    if (s.startsWith("data:image/")) return s;
    return /^[A-Za-z0-9+/=\s]{100,}$/.test(s) ? `data:image/png;base64,${s.replace(/\s+/g, "")}` : null;
}

/** Ubicación de la fila: sus ids propios y, donde vengan en 0 (esta tabla los deja en 0 a menudo), los que da su puesto. */
export function ubicacionDe(r: any, fromPuesto?: Hierarchy) {
    const pos = (v: unknown) => (Number(v) > 0 ? Number(v) : null);
    return {
        empresa: pos(r.empresa_id) ?? fromPuesto?.empresa ?? null,
        cliente: pos(r.cliente_id) ?? fromPuesto?.cliente ?? null,
        division: pos(r.division_id) ?? fromPuesto?.division ?? null,
        contrato: pos(r.contrato_id) ?? fromPuesto?.contrato ?? null,
        corpo: pos(r.corpo_id) ?? fromPuesto?.corpo ?? null,
        puesto: pos(r.puesto_id),
    };
}

/** `extra`: categoría (n_novedades_categoria) y quién registró / modificó (primer y último cambio guardado de la nota). */
export function armarRegistro(raw: any, ubic: FormRecord["estructura"], firmas: boolean, extra: { categoria?: string | null; registrada_por?: string | null; modificada_por?: string | null } = {}, hier?: Hierarchy): FormRecord {
    const creado = fmtDt(raw.created_at);
    const actualizado = fmtDt(raw.updated_at);
    const valores: FormRecord["valores"] = {
        titulo: txt(raw.titulo),
        categoria: txt(extra.categoria),
        relevancia: txt(raw.relevancia),
        descripcion: txt(raw.description),
        fecha_creacion: creado ? creado.slice(0, 10) : null,
        hora_creacion: creado ? creado.slice(11, 16) : null,
        fecha_actualizacion: actualizado ? actualizado.slice(0, 10) : null,
        hora_actualizacion: actualizado ? actualizado.slice(11, 16) : null,
        registrada_por: txt(extra.registrada_por),
        modificada_por: txt(extra.modificada_por),
    };
    const img = firmaImagen(raw.firma_manual_responsable);
    return {
        id: Number(raw.id), variante: null, creado, estructura: ubic, valores, listas: {},
        firmas: img ? { firma_manual: firmas ? img : null } : {},
        firmasPresentes: img ? ["firma_manual"] : [],
        hier: hier ?? { empresa: raw.empresa_id, cliente: raw.cliente_id, division: raw.division_id, contrato: raw.contrato_id, corpo: raw.corpo_id, puesto: raw.puesto_id },
    };
}

export const bitacoraNovedadesForm: GuardifyFormModule = {
    async loadRecords(db: ReportDataAccess, ids, { firmas }) {
        const rows: any[] = await (db as any).c_puesto_notas.findMany({ where: { id: { in: ids }, isActive: true } });
        if (!rows.length) return [];
        const incompletas = rows.filter((r) => !(Number(r.cliente_id) > 0 && Number(r.division_id) > 0 && Number(r.contrato_id) > 0 && Number(r.corpo_id) > 0));
        const rowIds = rows.map((r) => Number(r.id));
        const [desdePuesto, categorias, cambios] = await Promise.all([
            loadPuestoHierarchy(db as any, incompletas.map((r) => Number(r.puesto_id))),
            findByIds<{ nombre: string | null }>(db as any, "n_novedades_categoria", rows.map((r) => r.categoria_id), { nombre: true }),
            // Primer cambio = quien la registró; último = quien la modificó por última vez (como las columnas «Usuario inserta» y «Usuario modifica»).
            (db as any).c_cambios_apps_modules.findMany({ where: { nombre_tabla: "c_puesto_notas", registro_id: { in: rowIds } }, select: { id: true, registro_id: true, created_by: true }, orderBy: { id: "asc" } }) as Promise<any[]>,
        ]);
        const primero = new Map<number, number>(), ultimo = new Map<number, number>();
        for (const c of cambios) {
            const k = Number(c.registro_id), by = Number(c.created_by);
            if (!(by > 0)) continue;
            if (!primero.has(k)) primero.set(k, by);
            ultimo.set(k, by);
        }
        const nombres = await nombresEmpleado(db as any, [...primero.values(), ...ultimo.values()]);
        const ubicIds = rows.map((r) => ubicacionDe(r, desdePuesto.get(Number(r.puesto_id))));
        const ubic = await ubicacionTextos(db as any, ubicIds);
        return rows.map((r, i) => armarRegistro(r, ubic(ubicIds[i]!), firmas, {
            categoria: txt(categorias.get(Number(r.categoria_id))?.nombre),
            registrada_por: nombres.get(primero.get(Number(r.id)) ?? 0) ?? null,
            modificada_por: nombres.get(ultimo.get(Number(r.id)) ?? 0) ?? null,
        }, ubicIds[i]));
    },
};
