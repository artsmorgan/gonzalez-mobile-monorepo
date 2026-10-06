import { fmtDt } from "../mappers";
import { buildNombre } from "../names";
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

/**
 * Fila de `queryAgendaMinutaReportRows` (ya con nombres de estructura) → fila plana.
 * Nunca se exponen `firma_responsable` ni las firmas de los participantes; de participantes y acuerdos solo se cuenta.
 */
export function mapAgendaMinutaRow(r: any, creadores: Map<number, string> = new Map()): OutRow {
    const cid = creadorId(r.created_by);
    const temas = asArray(parseJson(r.temas_a_tratar)).map((t) => String(t ?? "").trim()).filter(Boolean);
    return {
        id: Number(r.id),
        fecha: dateOnly(r.fecha),
        numero: r.numero == null ? null : Number(r.numero),
        titulo: cut(r.titulo),
        autor: txt(r.autor),
        creado_por: cid != null ? (creadores.get(cid) ?? null) : null,
        creado: fmtDt(r.created_at),
        hora_inicio: txt(r.hora_inicio_txt),
        hora_fin: txt(r.hora_fin_txt),
        estado: r.estado ? "Completado" : "Pendiente",
        empresa: nameOrNull(r.empresa_nombre, r.empresa_id),
        cliente: nameOrNull(r.cliente_nombre, r.cliente_id),
        division: nameOrNull(r.division_nombre, r.division_id),
        contrato: nameOrNull(r.contrato_nombre, r.contrato_id),
        sucursal: nameOrNull(r.corpo_nombre, r.corpo_id),
        puesto: nameOrNull(r.puesto_nombre, r.puesto_id),
        participantes: asArray(parseJson(r.participantes)).length,
        acuerdos: asArray(parseJson(r.acuerdos)).length,
        temas: cut(temas.join("; ")),
        observaciones: cut(r.observaciones),
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

/** Agenda minuta (`c_agenda_minuta`). Trae empresa/cliente/división/contrato/sucursal/puesto; los antiguos sin empresa, división o contrato se ubican por su puesto. */
export const agendaMinuta: GuardifyReportModule = {
    id: "agenda_minuta",
    supportsScope: true,
    searchKeys: ["titulo", "autor", "creado_por", "puesto", "sucursal", "contrato"],
    filterKeys: ["estado", "empresa", "cliente", "division", "contrato", "sucursal", "puesto"],
    sortKeys: ["fecha", "numero", "titulo", "autor", "creado_por", "creado", "estado", "empresa", "cliente", "contrato", "sucursal", "puesto", "participantes", "acuerdos"],
    defaultSort: "creado",
    async load(db, p) {
        // Importación diferida: estos módulos arrastran exceljs/docx/axios, que las pruebas del mapeo y del alcance no necesitan cargar.
        const { queryAgendaMinutaReportRows } = await import("../../reports-functions/agendaMinutaReport");
        const { batchFindManyByIds } = await import("../../reportDynamicPrisma");
        const rows = await queryAgendaMinutaReportRows(db, { creadoDesde: `${p.from}T00:00:00`, creadoHasta: `${addDays(p.to, -1)}T23:59:59` }, "fecha");
        const kept = p.scope ? await filterRowsByScope(db, rows, p.scope) : rows;
        const empleados = await batchFindManyByIds<any>(db, "c_empleado", kept.map((r: any) => creadorId(r.created_by) ?? 0), { id: true, nombre: true, primer_apellido: true, segundo_apellido: true });
        const creadores = new Map([...empleados].map(([id, e]) => [id, buildNombre(e)]));
        return kept.map((r: any) => mapAgendaMinutaRow(r, creadores));
    },
};
