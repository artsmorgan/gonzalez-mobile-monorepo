import type { ReportDataAccess } from "../../reportDynamicPrisma";
import { fmtDt } from "../mappers";
import type { OutRow } from "../listing";
import { addDays, type ReportParams } from "../params";
import { loadPuestoHierarchy, matchesScope } from "../scope";
import { divisionPorContrato, ejecutivoPorCorpo, findByIds } from "../enrich";
import type { GuardifyReportModule } from "../types";
import { manualesPuestoForm } from "./manualesPuestoForm";
import { asignadosDelManual, asignadosPorPuesto } from "./manualesAsignados";

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
/** Empleados distintos de una lista de vínculos o visualizaciones (un empleado puede tener más de una fila); sin `empleado_id`, las filas. */
const personas = (v: unknown, pred: (x: any) => boolean = () => true): number => {
    const rows = Array.isArray(v) ? v.filter(pred) : [];
    const ids = rows.map((x) => Number(x?.empleado_id)).filter((n) => Number.isFinite(n) && n > 0);
    return ids.length ? new Set(ids).size : rows.length;
};

/** Datos que se resuelven en lote: ejecutivo de cuenta de la sucursal, división del contrato (si la fila no trae una) y nombre de los puestos vinculados que la consulta no hidrató. */
export type ManualExtra = { ejecutivo?: string | null; division?: string | null; puestos?: Map<number, string>; /** Ids de los empleados asignados a los puestos del manual (`c_empleado_plaza`): a todos les llega, lo hayan abierto o no. */ asignados?: number[] };

/**
 * Fila cruda de `queryManualesPuestoRows` → fila plana (un manual por fila, con conteos de vínculos y visualizaciones).
 * Nunca se exponen `firma`, las firmas ni las respuestas de los empleados, ni el cuestionario, ni los archivos del manual.
 * `puestos`: el puesto principal y los vinculados («código - nombre», separados por «; », máx. 500 caracteres).
 */
export function mapManualPuestoRow(r: any, extra: ManualExtra = {}): OutRow {
    const links: any[] = Array.isArray(r.e_puestos_manual_puesto) ? r.e_puestos_manual_puesto : [];
    const puestos = [txt(r.puesto_principal_txt), ...links.map((l) => puestoLabel(l?.e_estructura_puesto) ?? extra.puestos?.get(Number(l?.puesto_id)) ?? null)]
        .filter((x): x is string => !!x && !/^\d+$/.test(x));
    const vis = r.e_empleado_visualizacion_manual_puesto;
    // A quién le llegó: los empleados vinculados al manual y también los que lo abrieron aunque no estén vinculados (les llega por su puesto).
    // Y los que ocupan los puestos del manual (`asignados`), aunque nunca lo hayan abierto: son los «no vistos» del reporte.
    const filas = [...(Array.isArray(r.e_empleados_manual_puesto) ? r.e_empleados_manual_puesto : []), ...(Array.isArray(vis) ? vis : [])];
    const ids = new Set<number>(extra.asignados ?? []);
    let sinId = 0;
    for (const x of filas) { const n = Number(x?.empleado_id); if (Number.isFinite(n) && n > 0) ids.add(n); else sinId++; }
    const enviados = ids.size + sinId;
    const vistos = personas(vis);
    return {
        id: Number(r.id),
        titulo: short(r.title),
        descripcion: short(r.description),
        clasificacion: txt(r.classification),
        // Nivel 1 (la lista de manuales): a cuántos empleados les llegó y qué hicieron. El detalle por empleado está en el formulario del manual.
        empleados_enviados: enviados,
        vistos,
        firmados: personas(vis, (v) => !!v?.firma_empleado_manual),
        aprobados: personas(vis, (v) => v?.approved === true),
        pendientes: Math.max(0, enviados - vistos),
        puestos_vinculados: count(r.e_puestos_manual_puesto),
        puestos: short([...new Set(puestos)].join("; ")),
        ejecutivo_cuenta: txt(extra.ejecutivo),
        // Jerarquía (del puesto principal del manual).
        empresa: txt(r.empresa_txt),
        cliente: txt(r.cliente_txt),
        division: realName(r.division_txt) ?? txt(extra.division),
        contrato: txt(r.contrato_txt),
        sucursal: txt(r.corpo_txt),
        puesto: txt(r.puesto_principal_txt),
        // Auditoría y trazabilidad. «Enviado» = creado. La modificación sale de `updated_at` / `updated_by` (null en manuales anteriores a esas columnas).
        creado: fmtDt(r.created_at),
        creado_por: txt(r.created_by_nombre),
        modificado: fmtDt(r.updated_at),
        modificado_por: txt(r.updated_by_nombre),
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
        // Empleados asignados a los puestos de cada manual (una consulta en lote para todos los manuales de la página).
        const vinculados = (r: any): number[] => (Array.isArray(r.e_puestos_manual_puesto) ? r.e_puestos_manual_puesto.map((l: any) => Number(l?.puesto_id)) : []);
        const porPuesto = await asignadosPorPuesto(db, kept.flatMap((r: any) => [r.puesto_id, ...vinculados(r)]));
        return kept.map((r: any) => mapManualPuestoRow(r, { ejecutivo: ejecutivos.get(Number(r.corpo_id)), division: divisiones.get(Number(r.contrato_id)), puestos, asignados: asignadosDelManual(porPuesto, r.puesto_id, vinculados(r)) }));
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
    sortKeys: ["creado", "titulo", "clasificacion", "empresa", "cliente", "division", "contrato", "sucursal", "puesto", "ejecutivo_cuenta", "creado_por", "puestos_vinculados", "empleados_enviados", "vistos", "pendientes", "id", "firmados", "aprobados"],
    defaultSort: "creado",
    form: manualesPuestoForm,
    async load(db, p) {
        // Import diferido: el módulo de consulta arrastra exceljs, que no hace falta para mapear ni para probar.
        const { queryManualesPuestoRows } = await import("../../reports-functions/manualesPuestoReport");
        return loadManualesPuesto(db, p, queryManualesPuestoRows as unknown as QueryRows);
    },
};
