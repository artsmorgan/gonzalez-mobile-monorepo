import { batchFindManyByIds } from "../../reportDynamicPrisma";
import { normalizeChecklistSupervisionFilters, queryChecklistSupervisionRows } from "../../reports-functions/checklistSupervisionReport";
import type { OutRow } from "../listing";
import { fmtDt } from "../mappers";
import { buildNombre } from "../names";
import { addDays } from "../params";
import { checklistSupervisionForm } from "./checklistSupervisionForm";
import { matchesScope } from "../scope";
import type { GuardifyReportModule } from "../types";

const txt = (v: unknown): string | null => {
    const s = String(v ?? "").trim();
    return s ? s : null;
};
const nameOrNull = (v: unknown, id: unknown): string | null => {
    const s = txt(v);
    return !s || s === "0" || s === String(id) ? null : s;
};

function parseJsonArray(raw: unknown): any[] {
    if (!raw || String(raw).trim() === "") return [];
    try {
        const p = JSON.parse(String(raw));
        return Array.isArray(p) ? p : [];
    } catch {
        return [];
    }
}

/** `HH:mm` desde un texto de hora o un Date de hora «de pared» (1970-01-01THH:mm). */
function hhmm(v: unknown): string | null {
    if (v == null || String(v).trim() === "") return null;
    if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(11, 16);
    const m = /(\d{2}):(\d{2})/.exec(String(v));
    return m ? `${m[1]}:${m[2]}` : null;
}

/** Cuántas fotos trae un input de la evaluación (solo el conteo; nunca el contenido ni los nombres de archivo). */
function countPhotos(inp: any): number {
    if (String(inp?.type ?? "").trim().toLowerCase() !== "photo") return 0;
    if (Array.isArray(inp?.photos) && inp.photos.length) return inp.photos.length;
    return txt(inp?.file_name) || (typeof inp?.value === "string" && inp.value.length > 100) ? 1 : 0;
}

/**
 * Historial de cada registro en `c_cambios_apps_modules` (una sola consulta por bloque de 1000 ids, solo id, registro, fecha y autor):
 * la primera fila es el alta (`__created__`) y la última, si hay más de una, es la última modificación.
 */
type Historial = { creadoAt: unknown; creadoBy: number | null; modAt: unknown; modBy: number | null };
async function historialPorRegistro(db: any, tabla: string, ids: unknown[]): Promise<Map<number, Historial>> {
    const all = [...new Set(ids.map(Number).filter((n) => Number.isFinite(n) && n > 0))];
    const first = new Map<number, any>();
    const last = new Map<number, any>();
    for (let i = 0; i < all.length; i += 1000) {
        const cambios = await db.c_cambios_apps_modules.findMany({
            where: { nombre_tabla: tabla, registro_id: { in: all.slice(i, i + 1000) } },
            select: { id: true, registro_id: true, created_at: true, created_by: true },
            orderBy: { id: "asc" },
        });
        for (const c of cambios) {
            const k = Number(c.registro_id);
            const f = first.get(k);
            if (!f || Number(c.id) < Number(f.id)) first.set(k, c);
            const l = last.get(k);
            if (!l || Number(c.id) > Number(l.id)) last.set(k, c);
        }
    }
    const by = (c: any): number | null => (Number(c?.created_by) > 0 ? Number(c.created_by) : null);
    const out = new Map<number, Historial>();
    for (const [k, f] of first) {
        const l = last.get(k);
        const modificado = !!l && Number(l.id) !== Number(f.id);
        out.set(k, { creadoAt: f.created_at ?? null, creadoBy: by(f), modAt: modificado ? l.created_at ?? null : null, modBy: modificado ? by(l) : null });
    }
    return out;
}

/** Última modificación de un checklist (la tabla no guarda `updated_at`: sale de su historial de cambios). */
export type ChecklistModificacion = { modificado?: string | null; modificado_por?: string | null };

/**
 * Checklist de supervisión (`c_checklist_supervision`): una fila por checklist, con conteos de su evaluación y de los
 * artículos del puesto. Nunca expone firmas, fotos, nombres de archivo ni el contenido de las respuestas.
 * `creador` es el empleado que lo registró (`c_empleado`), si se pudo cargar; `mod` su última modificación.
 */
export function mapChecklistSupervisionRow(r: any, creador?: any, mod: ChecklistModificacion = {}): OutRow {
    const secciones = parseJsonArray(r.evaluacion);
    let preguntas = 0, fotos = 0;
    for (const sec of secciones) {
        const subs = Array.isArray(sec?.subsections) ? sec.subsections : [];
        preguntas += subs.length;
        for (const sub of subs) for (const inp of Array.isArray(sub?.inputs) ? sub.inputs : []) fotos += countPhotos(inp);
    }
    const arts = parseJsonArray(r.articulos_puesto);
    const conDiferencia = arts.filter((a) => {
        const req = Number(a?.cantidad_requerida), real = Number(a?.cantidad_real);
        return a?.cantidad_requerida != null && a?.cantidad_real != null && String(a.cantidad_requerida).trim() !== "" && String(a.cantidad_real).trim() !== "" && Number.isFinite(req) && Number.isFinite(real) && req !== real;
    }).length;
    return {
        id: Number(r.id),
        fecha: fmtDt(r.fecha),
        empresa: nameOrNull(r.empresa_nombre, r.empresa_id),
        cliente: nameOrNull(r.cliente_nombre, r.cliente_id),
        division: nameOrNull(r.division_nombre, r.division_id),
        contrato: nameOrNull(r.contrato_nombre, r.contrato_id),
        sucursal: nameOrNull(r.corpo_nombre, r.corpo_id),
        puesto: nameOrNull(r.puesto_nombre, r.puesto_id),
        empleado: txt(r.empleado_display),
        ejecutivo_cuenta: txt(r.ejecutivo_cuenta_nombre),
        hora_inicio: hhmm(r.hora_inicio_txt ?? r.hora_inicio),
        hora_fin: hhmm(r.hora_fin_txt ?? r.hora_fin),
        creado: fmtDt(r.created_at),
        creado_por: creador ? txt(buildNombre(creador)) : null,
        modificado: mod.modificado ?? null,
        modificado_por: mod.modificado_por ?? null,
        secciones: secciones.length,
        preguntas,
        fotos,
        articulos: arts.length,
        articulos_con_diferencia: conDiferencia,
    };
}

/**
 * Checklist de supervisión. El periodo se aplica a `fecha` (la «Fecha» del Excel; `creado` es la fecha de registro; `modificado`/`modificado_por` salen de la última fila de su historial en `c_cambios_apps_modules`). Cada fila trae los
 * ids de su ubicación. Para filtrar: `ejecutivo_cuenta` es el ejecutivo propio del checklist y `creado_por` el usuario que lo registró.
 */
export const checklistSupervision: GuardifyReportModule = {
    id: "checklist_supervision",
    supportsScope: true,
    searchKeys: ["empleado", "ejecutivo_cuenta", "puesto", "sucursal", "contrato", "cliente", "creado_por", "modificado_por"],
    filterKeys: ["empresa", "cliente", "division", "contrato", "sucursal", "puesto", "ejecutivo_cuenta", "creado", "creado_por", "modificado", "modificado_por"],
    sortKeys: ["fecha", "creado", "modificado", "modificado_por", "empresa", "cliente", "contrato", "sucursal", "puesto", "empleado", "ejecutivo_cuenta", "creado_por", "secciones", "preguntas", "fotos", "articulos", "articulos_con_diferencia"],
    defaultSort: "fecha",
    form: checklistSupervisionForm,
    async load(db, p) {
        // Rango ampliado un día por lado en la consulta (la zona horaria del servidor puede correr los límites); el recorte exacto es aquí.
        const filters = normalizeChecklistSupervisionFilters({ fechaReporteDesde: `${addDays(p.from, -1)}T00:00:00`, fechaReporteHasta: `${p.to}T23:59:59` });
        const rows = await queryChecklistSupervisionRows(db, filters, "fecha");
        const scope = p.scope;
        const kept = rows
            .filter((r: any) => {
                const d = fmtDt(r.fecha)?.slice(0, 10);
                return !!d && d >= p.from && d < p.to;
            })
            .filter((r: any) => !scope || matchesScope({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }, scope));
        const historial = await historialPorRegistro(db, "c_checklist_supervision", kept.map((r: any) => r.id));
        const personas = await batchFindManyByIds<any>(db, "c_empleado", [...kept.map((r: any) => Number(r.created_by)), ...[...historial.values()].map((x) => x.modBy ?? 0)], { id: true, nombre: true, primer_apellido: true, segundo_apellido: true });
        return kept.map((r: any) => {
            const h = historial.get(Number(r.id));
            const quien = h?.modBy ? personas.get(h.modBy) : undefined;
            return mapChecklistSupervisionRow(r, personas.get(Number(r.created_by)), { modificado: fmtDt(h?.modAt as any), modificado_por: quien ? txt(buildNombre(quien)) : null });
        });
    },
};
