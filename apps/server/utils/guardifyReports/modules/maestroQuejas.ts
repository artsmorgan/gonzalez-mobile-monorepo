import type { ReportDataAccess } from "../../reportDynamicPrisma";
import { fmtDt } from "../mappers";
import type { OutRow } from "../listing";
import { addDays, type ReportParams } from "../params";
import { matchesScope } from "../scope";
import type { GuardifyReportModule } from "../types";

const txt = (v: unknown): string | null => {
    const s = String(v ?? "").trim();
    return s ? s : null;
};
/** Textos libres: máximo 500 caracteres. */
const short = (v: unknown): string | null => txt(v)?.slice(0, 500) ?? null;
/** Las fechas de la queja se guardan como texto `YYYY-MM-DD`: se devuelven como fecha sin hora. */
const dayDt = (v: unknown): string | null => {
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(v ?? "").trim());
    return m ? `${m[1]}T00:00:00` : null;
};

/**
 * Fila cruda de `queryMaestroQuejasRows` → fila plana. Nunca se expone `firma_responsable` (imagen de la firma) ni los
 * anexos de la queja.
 */
export function mapMaestroQuejaRow(r: any): OutRow {
    return {
        id: Number(r.id),
        creado: fmtDt(r.created_at),
        fecha_queja: dayDt(r.fecha_queja),
        fecha_atencion: dayDt(r.fecha_inicio),
        fecha_realizacion: dayDt(r.fecha_revision),
        empresa: txt(r.empresa_nombre),
        cliente: txt(r.cliente_nombre),
        division: txt(r.division_nombre),
        contrato: txt(r.contrato_nombre),
        sucursal: txt(r.corpo_nombre),
        puesto: txt(r.puesto_nombre),
        plaza: txt(r.plaza_nombre),
        sociedad: txt(r.sociedad),
        recibida_por: txt(r.nombre_realiza_queja),
        cliente_formulario: txt(r.cliente),
        empresa_queja: txt(r.empresa_presenta_queja),
        persona_queja: txt(r.persona_presenta_queja),
        medio_recepcion: txt(r.medio_recepcion_queja),
        tipo_cliente: txt(r.tipo_cliente),
        tipo_queja: short(r.tipo_queja),
        ubicacion: short(r.ubicacion),
        nivel_queja: txt(r.nivel_queja),
        motivo: short(r.motivo_queja),
        descripcion: short(r.descripcion_queja),
        estimacion_dannio: short(r.estimacion_dannio),
        resolucion: short(r.resolucion_queja),
        accion_correctiva: short(r.accion_correctiva_preventiva),
        estado: txt(r.estado),
        creado_por: txt(r.creado_por_nombre),
    };
}

type QueryRows = (db: ReportDataAccess, filters: { creadoDesde: string; creadoHasta: string }, orderKey: "fecha_queja") => Promise<any[]>;

/** Trae las filas del periodo `[from, to)` y las restringe al alcance. */
export async function loadMaestroQuejas(db: ReportDataAccess, p: ReportParams, query: QueryRows): Promise<OutRow[]> {
    const rows = await query(db, { creadoDesde: `${p.from}T00:00:00`, creadoHasta: `${addDays(p.to, -1)}T23:59:59` }, "fecha_queja");
    const scope = p.scope;
    const kept = !scope
        ? rows
        : rows.filter((r: any) => matchesScope({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }, scope));
    return kept.map(mapMaestroQuejaRow);
}

/** Maestro de quejas y reclamos (`c_maestro_quejas`). Cada fila trae sus ids de empresa, cliente, división, contrato, sucursal y puesto. Periodo: fecha de registro (`created_at`). */
export const maestroQuejas: GuardifyReportModule = {
    id: "maestro_quejas",
    supportsScope: true,
    searchKeys: ["empresa_queja", "persona_queja", "recibida_por", "motivo", "descripcion", "sucursal", "puesto", "estado", "creado_por"],
    filterKeys: ["empresa", "cliente", "contrato", "sucursal", "puesto", "medio_recepcion", "tipo_cliente", "tipo_queja", "nivel_queja", "estado"],
    sortKeys: ["creado", "fecha_queja", "fecha_atencion", "fecha_realizacion", "empresa", "cliente", "contrato", "sucursal", "puesto", "medio_recepcion", "tipo_queja", "nivel_queja", "estado"],
    defaultSort: "fecha_queja",
    async load(db, p) {
        // Import diferido: el módulo de consulta arrastra exceljs, que no hace falta para mapear ni para probar.
        const { queryMaestroQuejasRows } = await import("../../reports-functions/maestroQuejasReport");
        return loadMaestroQuejas(db, p, queryMaestroQuejasRows as unknown as QueryRows);
    },
};
