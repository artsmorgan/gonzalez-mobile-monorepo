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
function countJsonArray(raw: unknown): number {
    if (raw == null || String(raw).trim() === "") return 0;
    try {
        const p = typeof raw === "object" ? raw : JSON.parse(String(raw));
        return Array.isArray(p) ? p.length : 0;
    } catch {
        return 0;
    }
}
function tipoLabel(v: unknown): string | null {
    const s = txt(v);
    return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : null;
}

/**
 * Fila de `queryAperturaCierrePuestoRows` (ya con nombres de estructura) → fila plana.
 * Nunca se exponen las cuatro firmas ni los nombres de archivo de las fotos: de actividades, inventario y fotos solo se cuenta.
 */
export function mapAperturaCierrePuestoRow(r: any): OutRow {
    return {
        id: Number(r.id),
        fecha: fmtDt(r.fecha),
        tipo: tipoLabel(r.tipo_txt ?? r.tipo),
        creado: fmtDt(r.created_at),
        creado_por: nameOrNull(r.creador_nombre, r.created_by),
        empresa: nameOrNull(r.empresa_nombre, r.empresa_id),
        cliente: nameOrNull(r.cliente_nombre, r.cliente_id),
        division: nameOrNull(r.division_nombre, r.division_id),
        contrato: nameOrNull(r.contrato_nombre, r.contrato_id),
        sucursal: nameOrNull(r.corpo_nombre, r.corpo_id),
        puesto: nameOrNull(r.puesto_nombre, r.puesto_id),
        representante_cliente: txt(r.nombre_representante_cliente),
        representante_saliente: txt(r.nombre_representante_empresa_saliente),
        representante_entrante: txt(r.nombre_representante_empresa_entrante),
        actividades: countJsonArray(r.actividades),
        inventario: countJsonArray(r.inventario),
        fotos: Array.isArray(r.imagenes_names) ? r.imagenes_names.length : 0,
        observaciones: cut(r.otras_observaciones),
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
    const incomplete = rows.filter((r) => !(Number(r.empresa_id) > 0 && Number(r.division_id) > 0 && Number(r.contrato_id) > 0));
    const hier = await loadPuestoHierarchy(db, incomplete.map((r) => Number(r.puesto_id)));
    return rows.filter((r) => matchesScope(rowHierarchy(r, hier.get(Number(r.puesto_id))), scope));
}

/** Apertura/Cierre de puesto (`c_apertura_cierre_puesto`). Cada fila trae su estructura; los registros antiguos sin empresa, división o contrato se ubican por su puesto. */
export const aperturaCierrePuesto: GuardifyReportModule = {
    id: "apertura_cierre_puesto",
    supportsScope: true,
    searchKeys: ["creado_por", "puesto", "sucursal", "contrato", "representante_cliente", "representante_saliente", "representante_entrante"],
    filterKeys: ["tipo", "empresa", "cliente", "division", "contrato", "sucursal", "puesto"],
    sortKeys: ["fecha", "tipo", "creado", "creado_por", "empresa", "cliente", "contrato", "sucursal", "puesto", "actividades", "inventario", "fotos"],
    defaultSort: "fecha",
    async load(db, p) {
        // Importación diferida: estos módulos arrastran exceljs/axios, que las pruebas del mapeo y del alcance no necesitan cargar.
        const { queryAperturaCierrePuestoRows } = await import("../../reports-functions/aperturaCierrePuestoReport");
        const rows = await queryAperturaCierrePuestoRows(db, { creadoDesde: `${p.from}T00:00:00`, creadoHasta: `${addDays(p.to, -1)}T23:59:59` }, "fecha");
        const kept = p.scope ? await filterRowsByScope(db, rows, p.scope) : rows;
        return kept.map(mapAperturaCierrePuestoRow);
    },
};
