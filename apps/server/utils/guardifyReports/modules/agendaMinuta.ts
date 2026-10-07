import { ejecutivoPorCorpo, findByIds, nombresEmpleado, usuarioInserta } from "../enrich";
import { fmtDt } from "../mappers";
import type { OutRow } from "../listing";
import { addDays } from "../params";
import { loadPuestoHierarchy, matchesScope, type Hierarchy, type ScopeItem } from "../scope";
import type { GuardifyReportModule } from "../types";

const txt = (v: unknown): string | null => {
    const s = String(v ?? "").trim();
    return s ? s : null;
};
/** Texto libre largo: máximo 500 caracteres. */
const cut = (v: unknown, max = 500): string | null => {
    const s = txt(v);
    return s && s.length > max ? s.slice(0, max) : s;
};
/** Las consultas de la app rellenan con el id cuando no encuentran el nombre: eso no es un nombre. */
const nameOrNull = (name: unknown, id: unknown): string | null => {
    const n = Number(id);
    const s = txt(name);
    if (!s || !Number.isFinite(n) || n <= 0 || s === String(id)) return null;
    return s;
};
/** Fecha sin hora (`@db.Date`) como `YYYY-MM-DDT00:00:00`. */
function dateOnly(v: unknown): string | null {
    if (v == null || v === "") return null;
    const iso = v instanceof Date ? (Number.isNaN(v.getTime()) ? "" : v.toISOString()) : String(v).trim();
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(iso);
    return m ? `${m[1]}T00:00:00` : null;
}
function parseJson(raw: unknown): any {
    if (raw == null || String(raw).trim() === "") return null;
    if (typeof raw === "object") return raw;
    try {
        return JSON.parse(String(raw));
    } catch {
        return null;
    }
}
const asArray = (v: any): any[] => (Array.isArray(v) ? v : Array.isArray(v?.items) ? v.items : []);

/** `created_by` guarda el id de `c_empleado` como texto. */
export const creadorId = (raw: unknown): number | null => {
    const n = Number(String(raw ?? "").trim());
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
};

/** Datos que no vienen en la fila de la consulta y se cargan en lote (ver `loadExtras`). */
export type AgendaExtras = { ejecutivo_cuenta?: string | null; division?: string | null };

/**
 * Fila de `queryAgendaMinutaReportRows` (ya con nombres de estructura) → fila plana.
 * Nunca se exponen `firma_responsable` ni las firmas de los participantes; de participantes y acuerdos solo se cuenta.
 * `creadores`: nombre de cada empleado por id (`created_by` guarda el id como texto; si es otro texto —usuario, correo— se deja tal cual).
 * `extras`: ejecutivo de cuenta de la sucursal y, para registros antiguos sin división, la división que da el puesto.
 */
export function mapAgendaMinutaRow(r: any, creadores: Map<number, string> = new Map(), extras: AgendaExtras = {}): OutRow {
    const temas = asArray(parseJson(r.temas_a_tratar)).map((t) => String(t ?? "").trim()).filter(Boolean);
    return {
        id: Number(r.id),
        fecha: dateOnly(r.fecha),
        numero: r.numero == null ? null : Number(r.numero),
        titulo: cut(r.titulo),
        autor: txt(r.autor),
        creado_por: usuarioInserta(r.created_by, creadores),
        creado: fmtDt(r.created_at),
        hora_inicio: txt(r.hora_inicio_txt),
        hora_fin: txt(r.hora_fin_txt),
        estado: r.estado ? "Completado" : "Pendiente",
        empresa: nameOrNull(r.empresa_nombre, r.empresa_id),
        cliente: nameOrNull(r.cliente_nombre, r.cliente_id),
        division: nameOrNull(r.division_nombre, r.division_id) ?? extras.division ?? null,
        contrato: nameOrNull(r.contrato_nombre, r.contrato_id),
        sucursal: nameOrNull(r.corpo_nombre, r.corpo_id),
        puesto: nameOrNull(r.puesto_nombre, r.puesto_id),
        participantes: asArray(parseJson(r.participantes)).length,
        acuerdos: asArray(parseJson(r.acuerdos)).length,
        temas: cut(temas.join("; ")),
        observaciones: cut(r.observaciones),
        completadas: r.estado ? "Sí" : "No",
        ejecutivo_cuenta: extras.ejecutivo_cuenta ?? null,
    };
}

/** Ubicación de una fila: sus ids propios y, donde vengan en 0 (registros antiguos), los que da su puesto. */
export function rowHierarchy(r: any, fromPuesto: Hierarchy | undefined): Hierarchy {
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

export async function filterRowsByScope(db: any, rows: any[], scope: ScopeItem[]): Promise<any[]> {
    const incomplete = rows.filter((r) => !(Number(r.empresa_id) > 0 && Number(r.division_id) > 0 && Number(r.contrato_id) > 0));
    const hier = await loadPuestoHierarchy(db, incomplete.map((r) => Number(r.puesto_id)));
    return rows.filter((r) => matchesScope(rowHierarchy(r, hier.get(Number(r.puesto_id))), scope));
}

/** Días que se amplía el rango de creación al consultar: el periodo se aplica a `fecha` (la fecha de la reunión), que puede diferir de cuándo se registró. */
const MARGEN_DIAS = 45;

/** Ejecutivo de cuenta (por la sucursal) y división de los registros antiguos sin división (por el puesto), en lote. */
async function loadExtras(db: any, items: Array<{ r: any; h: Hierarchy }>): Promise<AgendaExtras[]> {
    const [ejecutivos, divisiones] = await Promise.all([
        ejecutivoPorCorpo(db, items.map((x) => x.h.corpo)),
        findByIds<{ nombre: string | null }>(db, "n_division", items.filter((x) => !nameOrNull(x.r.division_nombre, x.r.division_id)).map((x) => x.h.division), { nombre: true }),
    ]);
    return items.map(({ h }) => ({ ejecutivo_cuenta: ejecutivos.get(Number(h.corpo)) ?? null, division: txt(divisiones.get(Number(h.division))?.nombre) }));
}

/**
 * Agenda minuta (`c_agenda_minuta`). Trae empresa/cliente/división/contrato/sucursal/puesto; los antiguos sin empresa, división o contrato se ubican por su puesto.
 * El periodo se aplica a `fecha`, la «Fecha» del Excel (día de la reunión); se consulta por fecha de creación con un margen de 45 días y se recorta por `fecha`.
 */
export const agendaMinuta: GuardifyReportModule = {
    id: "agenda_minuta",
    supportsScope: true,
    searchKeys: ["titulo", "autor", "creado_por", "puesto", "sucursal", "contrato"],
    filterKeys: ["estado", "completadas", "empresa", "cliente", "division", "contrato", "sucursal", "puesto", "ejecutivo_cuenta", "creado_por"],
    sortKeys: ["fecha", "numero", "titulo", "autor", "creado_por", "creado", "estado", "completadas", "empresa", "cliente", "division", "contrato", "sucursal", "puesto", "participantes", "acuerdos", "ejecutivo_cuenta"],
    defaultSort: "creado",
    async load(db, p) {
        // Importación diferida: estos módulos arrastran exceljs/docx/axios, que las pruebas del mapeo y del alcance no necesitan cargar.
        const { queryAgendaMinutaReportRows } = await import("../../reports-functions/agendaMinutaReport");
        const all = await queryAgendaMinutaReportRows(db, { creadoDesde: `${addDays(p.from, -MARGEN_DIAS)}T00:00:00`, creadoHasta: `${addDays(p.to, MARGEN_DIAS - 1)}T23:59:59` }, "fecha");
        const desde = `${p.from}T00:00:00`;
        const hasta = `${p.to}T00:00:00`;
        const rows = all.filter((r: any) => {
            const f = dateOnly(r.fecha);
            return f != null && f >= desde && f < hasta;
        });
        const incomplete = rows.filter((r) => !(Number(r.empresa_id) > 0 && Number(r.division_id) > 0 && Number(r.contrato_id) > 0));
        const hier = await loadPuestoHierarchy(db, incomplete.map((r) => Number(r.puesto_id)));
        const located = rows.map((r) => ({ r, h: rowHierarchy(r, hier.get(Number(r.puesto_id))) }));
        const kept = p.scope ? located.filter((x) => matchesScope(x.h, p.scope!)) : located;
        const [extras, creadores] = await Promise.all([loadExtras(db, kept), nombresEmpleado(db, kept.map((x) => creadorId(x.r.created_by)))]);
        return kept.map((x, i) => mapAgendaMinutaRow(x.r, creadores, extras[i]));
    },
};
