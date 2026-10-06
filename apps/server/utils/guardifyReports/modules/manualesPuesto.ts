import type { ReportDataAccess } from "../../reportDynamicPrisma";
import { fmtDt } from "../mappers";
import type { OutRow } from "../listing";
import { addDays, type ReportParams } from "../params";
import { loadPuestoHierarchy, matchesScope } from "../scope";
import type { GuardifyReportModule } from "../types";

const txt = (v: unknown): string | null => {
    const s = String(v ?? "").trim();
    return s ? s : null;
};
/** Textos libres: máximo 500 caracteres. */
const short = (v: unknown): string | null => txt(v)?.slice(0, 500) ?? null;
const count = (v: unknown, pred: (x: any) => boolean = () => true): number => (Array.isArray(v) ? v.filter(pred).length : 0);

/**
 * Fila cruda de `queryManualesPuestoRows` → fila plana (un manual por fila, con conteos de vínculos y visualizaciones).
 * Nunca se exponen `firma`, las firmas ni las respuestas de los empleados, ni el cuestionario, ni los archivos del manual.
 */
export function mapManualPuestoRow(r: any): OutRow {
    return {
        id: Number(r.id),
        creado: fmtDt(r.created_at),
        titulo: short(r.title),
        descripcion: short(r.description),
        clasificacion: txt(r.classification),
        empresa: txt(r.empresa_txt),
        cliente: txt(r.cliente_txt),
        division: txt(r.division_txt),
        contrato: txt(r.contrato_txt),
        sucursal: txt(r.corpo_txt),
        puesto: txt(r.puesto_principal_txt),
        puestos_vinculados: count(r.e_puestos_manual_puesto),
        empleados_vinculados: count(r.e_empleados_manual_puesto),
        visualizaciones: count(r.e_empleado_visualizacion_manual_puesto),
        firmados: count(r.e_empleado_visualizacion_manual_puesto, (v) => !!v?.firma_empleado_manual),
        aprobados: count(r.e_empleado_visualizacion_manual_puesto, (v) => v?.approved === true),
        creado_por: txt(r.created_by_nombre),
    };
}

type QueryRows = (db: ReportDataAccess, filters: { creadoDesde: string; creadoHasta: string }, orderKey: "created_at") => Promise<any[]>;

/** Trae los manuales del periodo `[from, to)` y los restringe al alcance (puesto principal o puestos vinculados). */
export async function loadManualesPuesto(db: ReportDataAccess, p: ReportParams, query: QueryRows): Promise<OutRow[]> {
    const rows = await query(db, { creadoDesde: `${p.from}T00:00:00`, creadoHasta: `${addDays(p.to, -1)}T23:59:59` }, "created_at");
    const scope = p.scope;
    if (!scope) return rows.map(mapManualPuestoRow);
    const linked = (r: any): number[] => (Array.isArray(r.e_puestos_manual_puesto) ? r.e_puestos_manual_puesto.map((l: any) => Number(l.puesto_id)) : []);
    const hier = await loadPuestoHierarchy(db as any, rows.flatMap((r: any) => linked(r)));
    return rows
        .filter(
            (r: any) =>
                matchesScope({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }, scope) ||
                linked(r).some((id) => {
                    const h = hier.get(id);
                    return !!h && matchesScope(h, scope);
                }),
        )
        .map(mapManualPuestoRow);
}

/**
 * Manuales de trabajo (`e_manual_puesto`). Una fila por manual; vive en su puesto principal y puede vincularse a más
 * puestos (`e_puestos_manual_puesto`): con alcance se muestra si el puesto principal o alguno de los vinculados cae en él,
 * igual que el filtro por estructura de la app. Periodo: fecha de creación.
 */
export const manualesPuesto: GuardifyReportModule = {
    id: "manuales_puesto",
    supportsScope: true,
    searchKeys: ["titulo", "descripcion", "clasificacion", "sucursal", "puesto", "creado_por"],
    filterKeys: ["empresa", "cliente", "contrato", "sucursal", "puesto", "clasificacion"],
    sortKeys: ["creado", "titulo", "clasificacion", "empresa", "cliente", "contrato", "sucursal", "puesto", "puestos_vinculados", "empleados_vinculados", "visualizaciones", "firmados", "aprobados"],
    defaultSort: "creado",
    async load(db, p) {
        // Import diferido: el módulo de consulta arrastra exceljs, que no hace falta para mapear ni para probar.
        const { queryManualesPuestoRows } = await import("../../reports-functions/manualesPuestoReport");
        return loadManualesPuesto(db, p, queryManualesPuestoRows as unknown as QueryRows);
    },
};
