import type { OutRow } from "../listing";
import { fmtDt } from "../mappers";
import { addDays } from "../params";
import { matchesScope, type ScopeItem } from "../scope";
import type { GuardifyReportModule } from "../types";

const MAX_TEXT = 500;

const txt = (v: unknown): string | null => {
    const s = String(v ?? "").trim();
    return s ? s : null;
};
const clip = (v: unknown): string | null => {
    const s = txt(v);
    return s && s.length > MAX_TEXT ? s.slice(0, MAX_TEXT) : s;
};
/** El reporte rellena el nombre con el id cuando no encuentra el registro (o con "0"): eso no es un nombre. */
const place = (id: unknown, name: unknown): string | null => {
    const s = txt(name);
    return !s || s === String(id ?? "") ? null : s;
};
const parseList = (raw: unknown): any[] => {
    if (Array.isArray(raw)) return raw;
    try {
        const a = JSON.parse(String(raw ?? ""));
        return Array.isArray(a) ? a : [];
    } catch {
        return [];
    }
};

/**
 * Incidente (`c_incidente`) a fila plana. Se omiten a propósito `link_informe` (URL), las firmas de terceros y los archivos
 * adjuntos de los aportes; de los aportes solo se cuenta cuántos hay.
 */
export function mapIncidenteRow(r: any): OutRow {
    const involucrados = (Array.isArray(r.involucrados_list) ? r.involucrados_list : parseList(r.involucrados))
        .map((i: any) => txt(i?.nombre ?? i?.codigo))
        .filter(Boolean)
        .join("; ");
    const novedades = Array.isArray(r.libro_novedades_list) ? r.libro_novedades_list : parseList(r.fecha_libro_novedades);
    return {
        id: Number(r.id),
        creado: fmtDt(r.created_at),
        fecha_incidente: fmtDt(r.fecha_incidente),
        fecha_reporte: fmtDt(r.fecha_reporte),
        empresa: place(r.empresa_id, r.empresa_nombre),
        cliente: place(r.cliente_id, r.cliente_nombre),
        division: place(r.division_id, r.division_nombre),
        contrato: place(r.contrato_id, r.contrato_nombre),
        sucursal: place(r.corpo_id, r.corpo_nombre),
        puesto: place(r.puesto_id, r.puesto_nombre),
        clasificacion: place(r.clasificacion, r.clasificacion_nombre),
        estado: r.estado ? "Solucionado" : "No solucionado",
        responsable: txt(r.nombre_responsable),
        responsable_atencion: txt(r.nombre_responsable_atencion),
        ejecutivo_cuenta: txt(r.ejecutivo_cuenta_nombre),
        descripcion: clip(r.descripcion),
        solucion: clip(r.solucion),
        fecha_solucion: fmtDt(r.fecha_solucion),
        fecha_solucion_real: fmtDt(r.fecha_real_solucion),
        costo: clip(r.costo_asociado),
        consecutivo_informe: clip(r.consecutivo_informe),
        involucrados: clip(involucrados),
        novedades_libro: novedades.length,
        aportes: Array.isArray(r.c_contribucion_incidente) ? r.c_contribucion_incidente.length : 0,
    };
}

/** Cada incidente guarda los ids de empresa/cliente/división/contrato/corpo/puesto: se filtra directo por el alcance. */
export function filterIncidentesByScope(rows: any[], scope: ScopeItem[] | null): any[] {
    if (!scope) return rows;
    return rows.filter((r) => matchesScope({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }, scope));
}

/** Incidentes. El periodo es sobre la fecha de creación del registro (`created_at`), como el filtro «creado» de la app. */
export const incidentes: GuardifyReportModule = {
    id: "incidentes",
    supportsScope: true,
    searchKeys: ["responsable", "responsable_atencion", "involucrados", "descripcion", "clasificacion", "puesto", "sucursal", "contrato"],
    filterKeys: ["empresa", "cliente", "division", "contrato", "sucursal", "puesto", "clasificacion", "estado", "ejecutivo_cuenta"],
    sortKeys: ["creado", "fecha_incidente", "fecha_reporte", "fecha_solucion", "fecha_solucion_real", "empresa", "cliente", "contrato", "sucursal", "puesto", "clasificacion", "estado", "responsable", "aportes"],
    defaultSort: "creado",
    async load(db, p) {
        // Import perezoso: el módulo de consulta arrastra exceljs y Prisma, que no hacen falta para mapear ni para probar.
        const { queryIncidenteRows } = await import("../../reports-functions/incidentesReport");
        const rows = await queryIncidenteRows(db, { creadoDesde: `${p.from}T00:00:00`, creadoHasta: `${addDays(p.to, -1)}T23:59:59` }, "created_at");
        return filterIncidentesByScope(rows, p.scope).map(mapIncidenteRow);
    },
};
