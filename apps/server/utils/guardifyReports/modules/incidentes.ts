import { divisionPorContrato, nombresEmpleado, usuarioInserta } from "../enrich";
import type { OutRow } from "../listing";
import { fmtDt } from "../mappers";
import { addDays } from "../params";
import { matchesScope, type ScopeItem } from "../scope";
import type { GuardifyReportModule } from "../types";
import { incidentesForm } from "./incidentesForm";

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

/** Datos que no vienen en la fila y se cargan por lote: quien registró el incidente y, si no se guardó la división, la del contrato. */
export type IncidenteExtra = { usuario?: string | null; divisionContrato?: string | null };

/**
 * Incidente (`c_incidente`) a fila plana. Se omiten a propósito `link_informe` (URL), las firmas de terceros y los archivos
 * adjuntos de los aportes; de los aportes solo se cuenta cuántos hay.
 */
export function mapIncidenteRow(r: any, x: IncidenteExtra = {}): OutRow {
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
        division: place(r.division_id, r.division_nombre) ?? txt(x.divisionContrato),
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
        usuario_inserta: txt(x.usuario),
    };
}

/** Nombre de quien registró (`created_by` = id de empleado) y división del contrato cuando falta, ambos por lote. */
export async function mapIncidentesConExtras(db: any, rows: any[]): Promise<OutRow[]> {
    const nombres = await nombresEmpleado(db, rows.map((r) => r.created_by));
    const sinDivision = rows.filter((r) => !place(r.division_id, r.division_nombre));
    const divisiones = await divisionPorContrato(db, sinDivision.map((r) => r.contrato_id));
    return rows.map((r) => mapIncidenteRow(r, { usuario: usuarioInserta(r.created_by, nombres), divisionContrato: divisiones.get(Number(r.contrato_id)) ?? null }));
}

/** Cada incidente guarda los ids de empresa/cliente/división/contrato/corpo/puesto: se filtra directo por el alcance. */
export function filterIncidentesByScope(rows: any[], scope: ScopeItem[] | null): any[] {
    if (!scope) return rows;
    return rows.filter((r) => matchesScope({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }, scope));
}

/**
 * Incidentes. El periodo es sobre la **fecha de reporte** (`fecha_reporte`, columna `fecha_reporte`): es la «Fecha» del Excel y lo que la
 * app llama «Fecha reporte desde/hasta» (antes se usaba la fecha de creación). `to` es exclusivo.
 */
export const incidentes: GuardifyReportModule = {
    id: "incidentes",
    supportsScope: true,
    searchKeys: ["responsable", "responsable_atencion", "involucrados", "descripcion", "clasificacion", "puesto", "sucursal", "contrato"],
    filterKeys: ["empresa", "cliente", "division", "contrato", "sucursal", "puesto", "clasificacion", "estado", "ejecutivo_cuenta", "fecha_solucion", "fecha_solucion_real", "usuario_inserta"],
    sortKeys: ["creado", "fecha_incidente", "fecha_reporte", "fecha_solucion", "fecha_solucion_real", "empresa", "cliente", "contrato", "sucursal", "puesto", "clasificacion", "estado", "responsable", "aportes", "usuario_inserta"],
    defaultSort: "creado",
    form: incidentesForm,
    async load(db, p) {
        // Import perezoso: el módulo de consulta arrastra exceljs y Prisma, que no hacen falta para mapear ni para probar.
        const { queryIncidenteRows } = await import("../../reports-functions/incidentesReport");
        const rows = await queryIncidenteRows(db, { fechaReporteDesde: `${p.from}T00:00:00`, fechaReporteHasta: `${addDays(p.to, -1)}T23:59:59` }, "created_at");
        return mapIncidentesConExtras(db, filterIncidentesByScope(rows, p.scope));
    },
};
