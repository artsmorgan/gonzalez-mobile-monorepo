import type { ReportDataAccess } from "../../reportDynamicPrisma";
import { fmtDt } from "../mappers";
import type { OutRow } from "../listing";
import { addDays, type ReportParams } from "../params";
import { loadPuestoHierarchy, matchesScope } from "../scope";
import { divisionPorContrato, ejecutivoPorCorpo, findByIds } from "../enrich";
import type { GuardifyReportModule } from "../types";

const txt = (v: unknown): string | null => {
    const s = String(v ?? "").trim();
    return s ? s : null;
};
/** Textos libres: máximo 500 caracteres. */
const short = (v: unknown): string | null => txt(v)?.slice(0, 500) ?? null;
/** Nombre de división real: un número suelto («0», el id) es el marcador de «sin división», no un nombre. */
const realName = (v: unknown): string | null => {
    const s = txt(v);
    return s && !/^\d+$/.test(s) ? s : null;
};
const puestoLabel = (p: any): string | null => (p ? txt(`${p.codigo ? `${p.codigo} - ` : ""}${p.nombre ?? ""}`) : null);
const count = (v: unknown, pred: (x: any) => boolean = () => true): number => (Array.isArray(v) ? v.filter(pred).length : 0);

/** Datos que se resuelven en lote: ejecutivo de cuenta de la sucursal, división del contrato (si la fila no trae una) y nombre de los puestos vinculados que la consulta no hidrató. */
export type ManualExtra = { ejecutivo?: string | null; division?: string | null; puestos?: Map<number, string> };

/**
 * Fila cruda de `queryManualesPuestoRows` → fila plana (un manual por fila, con conteos de vínculos y visualizaciones).
 * Nunca se exponen `firma`, las firmas ni las respuestas de los empleados, ni el cuestionario, ni los archivos del manual.
 * `puestos`: el puesto principal y los vinculados («código - nombre», separados por «; », máx. 500 caracteres).
 */
export function mapManualPuestoRow(r: any, extra: ManualExtra = {}): OutRow {
    const links: any[] = Array.isArray(r.e_puestos_manual_puesto) ? r.e_puestos_manual_puesto : [];
    const puestos = [txt(r.puesto_principal_txt), ...links.map((l) => puestoLabel(l?.e_estructura_puesto) ?? extra.puestos?.get(Number(l?.puesto_id)) ?? null)]
        .filter((x): x is string => !!x && !/^\d+$/.test(x));
    return {
        id: Number(r.id),
        creado: fmtDt(r.created_at),
        titulo: short(r.title),
        descripcion: short(r.description),
        clasificacion: txt(r.classification),
        empresa: txt(r.empresa_txt),
        cliente: txt(r.cliente_txt),
        division: realName(r.division_txt) ?? txt(extra.division),
        contrato: txt(r.contrato_txt),
        sucursal: txt(r.corpo_txt),
        puesto: txt(r.puesto_principal_txt),
        puestos_vinculados: count(r.e_puestos_manual_puesto),
        empleados_vinculados: count(r.e_empleados_manual_puesto),
        visualizaciones: count(r.e_empleado_visualizacion_manual_puesto),
        firmados: count(r.e_empleado_visualizacion_manual_puesto, (v) => !!v?.firma_empleado_manual),
        aprobados: count(r.e_empleado_visualizacion_manual_puesto, (v) => v?.approved === true),
        creado_por: txt(r.created_by_nombre),
        puestos: short([...new Set(puestos)].join("; ")),
        ejecutivo_cuenta: txt(extra.ejecutivo),
    };
}

type QueryRows = (db: ReportDataAccess, filters: { creadoDesde: string; creadoHasta: string }, orderKey: "created_at") => Promise<any[]>;

/** Trae los manuales del periodo `[from, to)` y los restringe al alcance (puesto principal o puestos vinculados). */
export async function loadManualesPuesto(db: ReportDataAccess, p: ReportParams, query: QueryRows): Promise<OutRow[]> {
    const rows = await query(db, { creadoDesde: `${p.from}T00:00:00`, creadoHasta: `${addDays(p.to, -1)}T23:59:59` }, "created_at");
    const scope = p.scope;
    const finish = async (kept: any[]): Promise<OutRow[]> => {
        const ejecutivos = await ejecutivoPorCorpo(db as any, kept.map((r: any) => r.corpo_id));
        const divisiones = await divisionPorContrato(db as any, kept.filter((r: any) => !realName(r.division_txt)).map((r: any) => r.contrato_id));
        // Puestos vinculados que la consulta no pudo hidratar (en lote; normalmente ninguno).
        const faltan = kept.flatMap((r: any) => (Array.isArray(r.e_puestos_manual_puesto) ? r.e_puestos_manual_puesto : [])).filter((l: any) => !l?.e_estructura_puesto).map((l: any) => l?.puesto_id);
        const found = faltan.length ? await findByIds<any>(db as any, "e_estructura_puesto", faltan, { nombre: true, codigo: true }) : new Map<number, any>();
        const puestos = new Map([...found].map(([id, x]) => [id, puestoLabel(x)] as const).filter((e): e is [number, string] => !!e[1]));
        return kept.map((r: any) => mapManualPuestoRow(r, { ejecutivo: ejecutivos.get(Number(r.corpo_id)), division: divisiones.get(Number(r.contrato_id)), puestos }));
    };
    if (!scope) return finish(rows);
    const linked = (r: any): number[] => (Array.isArray(r.e_puestos_manual_puesto) ? r.e_puestos_manual_puesto.map((l: any) => Number(l.puesto_id)) : []);
    const hier = await loadPuestoHierarchy(db as any, rows.flatMap((r: any) => linked(r)));
    return finish(
        rows.filter(
            (r: any) =>
                matchesScope({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }, scope) ||
                linked(r).some((id) => {
                    const h = hier.get(id);
                    return !!h && matchesScope(h, scope);
                }),
        ),
    );
}

/**
 * Manuales de trabajo (`e_manual_puesto`). Una fila por manual; vive en su puesto principal y puede vincularse a más
 * puestos (`e_puestos_manual_puesto`): con alcance se muestra si el puesto principal o alguno de los vinculados cae en él,
 * igual que el filtro por estructura de la app. Periodo: fecha de creación (`created_at`, columna `creado`), la «Fecha» del Excel.
 */
export const manualesPuesto: GuardifyReportModule = {
    id: "manuales_puesto",
    supportsScope: true,
    searchKeys: ["titulo", "descripcion", "clasificacion", "sucursal", "puesto", "puestos", "creado_por", "ejecutivo_cuenta"],
    filterKeys: ["empresa", "cliente", "division", "contrato", "sucursal", "puesto", "puestos", "clasificacion", "ejecutivo_cuenta", "creado_por"],
    sortKeys: ["creado", "titulo", "clasificacion", "empresa", "cliente", "division", "contrato", "sucursal", "puesto", "ejecutivo_cuenta", "creado_por", "puestos_vinculados", "empleados_vinculados", "visualizaciones", "firmados", "aprobados"],
    defaultSort: "creado",
    async load(db, p) {
        // Import diferido: el módulo de consulta arrastra exceljs, que no hace falta para mapear ni para probar.
        const { queryManualesPuestoRows } = await import("../../reports-functions/manualesPuestoReport");
        return loadManualesPuesto(db, p, queryManualesPuestoRows as unknown as QueryRows);
    },
};
