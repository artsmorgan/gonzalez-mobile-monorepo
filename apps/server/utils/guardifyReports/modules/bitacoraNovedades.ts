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

/**
 * Fila de `queryBitacoraNovedadesRows` (ya con nombres de estructura y categoría) → fila plana.
 * Nunca se exponen `firma_manual_responsable` ni `firma_responsable` (firmas) ni las fotos de la nota.
 */
export function mapBitacoraNovedadesRow(r: any): OutRow {
    return {
        id: Number(r.id),
        creado: fmtDt(r.created_at),
        actualizado: fmtDt(r.updated_at),
        titulo: cut(r.titulo),
        descripcion: cut(r.description),
        categoria: txt(r.categoria_nombre),
        relevancia: txt(r.relevancia),
        modificada: r.is_modified ? "Sí" : "No",
        empresa: nameOrNull(r.empresa_nombre, r.empresa_id),
        cliente: nameOrNull(r.cliente_nombre, r.cliente_id),
        division: nameOrNull(r.division_nombre, r.division_id),
        contrato: nameOrNull(r.contrato_nombre, r.contrato_id),
        sucursal: nameOrNull(r.corpo_nombre, r.corpo_id),
        puesto: nameOrNull(r.puesto_nombre, r.puesto_id),
    };
}

/** Ubicación de una fila: sus ids propios y, donde vengan en 0 (registros antiguos), los que da su puesto. */
function rowHierarchy(r: any, fromPuesto: Hierarchy | undefined): Hierarchy {
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
    const incomplete = rows.filter((r) => !(Number(r.cliente_id) > 0 && Number(r.division_id) > 0 && Number(r.contrato_id) > 0 && Number(r.corpo_id) > 0));
    const hier = await loadPuestoHierarchy(db, incomplete.map((r) => Number(r.puesto_id)));
    return rows.filter((r) => matchesScope(rowHierarchy(r, hier.get(Number(r.puesto_id))), scope));
}

/** Bitácora de novedades (`c_puesto_notas`). En esta tabla cliente, división, contrato y sucursal pueden venir en 0: se completan desde el puesto. */
export const bitacoraNovedades: GuardifyReportModule = {
    id: "bitacora_novedades",
    supportsScope: true,
    searchKeys: ["titulo", "descripcion", "categoria", "puesto", "sucursal", "contrato"],
    filterKeys: ["categoria", "relevancia", "modificada", "empresa", "cliente", "division", "contrato", "sucursal", "puesto"],
    sortKeys: ["creado", "actualizado", "titulo", "categoria", "relevancia", "empresa", "cliente", "contrato", "sucursal", "puesto"],
    defaultSort: "creado",
    async load(db, p) {
        // Importación diferida: estos módulos arrastran exceljs/axios, que las pruebas del mapeo y del alcance no necesitan cargar.
        const { queryBitacoraNovedadesRows } = await import("../../reports-functions/bitacoraNovedadesReport");
        const rows = await queryBitacoraNovedadesRows(db, { creadoDesde: `${p.from}T00:00:00`, creadoHasta: `${addDays(p.to, -1)}T23:59:59` }, "updated_at");
        const kept = p.scope ? await filterRowsByScope(db, rows, p.scope) : rows;
        return kept.map(mapBitacoraNovedadesRow);
    },
};
