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
const nombre = (e: any): string | null => (e ? txt([e.nombre, e.primer_apellido, e.segundo_apellido].filter(Boolean).join(" ")) : null);

/** Fecha (`@db.Date`) + hora (`@db.Time`) de un movimiento → `YYYY-MM-DDTHH:mm:ss`. */
export function movimientoDt(m: any): string | null {
    const day = fmtDt(m?.fecha)?.slice(0, 10);
    if (!day) return null;
    const hRaw = m?.hora;
    const hStr = hRaw instanceof Date ? (Number.isNaN(hRaw.getTime()) ? "" : hRaw.toISOString()) : String(hRaw ?? "");
    const time = /(\d{2}:\d{2}:\d{2})/.exec(hStr)?.[1] ?? "00:00:00";
    return `${day}T${time}`;
}

/** Movimiento más reciente (por fecha y hora; a igualdad, el primero de la lista, que ya viene por id descendente). */
export function latestMovimiento(movs: any[]): any | null {
    let best: any = null;
    let bestDt = "";
    for (const m of movs) {
        const dt = movimientoDt(m) ?? "";
        if (best === null || dt > bestDt) {
            best = m;
            bestDt = dt;
        }
    }
    return best;
}

/**
 * Fila cruda de `queryLlavesRows` → fila plana. Nunca se exponen `firma_responsable`, `firma_entrega`, `firma_recibe`
 * ni el teléfono de los movimientos.
 */
export function mapLlaveRow(r: any, creador?: any): OutRow {
    const movs: any[] = Array.isArray(r.e_movimiento_llave) ? r.e_movimiento_llave : [];
    const links: any[] = Array.isArray(r.e_llave_en_llavero) ? r.e_llave_en_llavero : [];
    const last = latestMovimiento(movs);
    const copias = r.cantidad_copias == null || r.cantidad_copias === "" ? null : Number(r.cantidad_copias);
    return {
        id: Number(r.id),
        creado: fmtDt(r.created_at),
        numero: txt(r.numero_llave),
        lugar_abre: txt(r.lugar_abre),
        copias: copias !== null && Number.isFinite(copias) ? copias : null,
        empresa: txt(r.empresa_nombre),
        cliente: txt(r.cliente_nombre),
        division: txt(r.division_nombre),
        contrato: txt(r.contrato_nombre),
        sucursal: txt(r.corpo_nombre),
        puesto: txt(r.puesto_nombre),
        llaveros: short(links.map((x) => txt(x?.e_llavero?.nombre_llavero)).filter(Boolean).join("; ")),
        movimientos: movs.length,
        ultimo_movimiento: last ? movimientoDt(last) : null,
        ultima_entrega: last ? txt(last.nombre_persona_entrega) : null,
        ultima_recibe: last ? txt(last.nombre_persona_recibe) : null,
        observaciones: short(r.observaciones),
        creado_por: nombre(creador),
    };
}

type QueryRows = (db: ReportDataAccess, filters: { creadoDesde: string; creadoHasta: string }, orderKey: "created_at") => Promise<any[]>;

/** Trae las filas del periodo `[from, to)`, las restringe al alcance y resuelve el nombre de quien las creó (en lote). */
export async function loadLlaves(db: ReportDataAccess, p: ReportParams, query: QueryRows): Promise<OutRow[]> {
    const rows = await query(db, { creadoDesde: `${p.from}T00:00:00`, creadoHasta: `${addDays(p.to, -1)}T23:59:59` }, "created_at");
    const scope = p.scope;
    const kept = !scope
        ? rows
        : rows.filter((r: any) => matchesScope({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }, scope));
    const ids = [...new Set(kept.map((r: any) => Number(r.created_by)).filter((n: number) => Number.isFinite(n) && n > 0))];
    const empleados = ids.length ? await db.c_empleado!.findMany({ where: { id: { in: ids } }, select: { id: true, nombre: true, primer_apellido: true, segundo_apellido: true } }) : [];
    const creadorById = new Map(empleados.map((e: any) => [Number(e.id), e]));
    return kept.map((r: any) => mapLlaveRow(r, creadorById.get(Number(r.created_by))));
}

/** Llaves (`e_llave`). Cada fila trae sus ids de empresa, cliente, división, contrato, sucursal y puesto. */
export const llaves: GuardifyReportModule = {
    id: "llaves",
    supportsScope: true,
    searchKeys: ["numero", "lugar_abre", "llaveros", "sucursal", "puesto", "ultima_entrega", "ultima_recibe", "creado_por"],
    filterKeys: ["empresa", "cliente", "contrato", "sucursal", "puesto"],
    sortKeys: ["creado", "numero", "lugar_abre", "copias", "empresa", "cliente", "contrato", "sucursal", "puesto", "movimientos", "ultimo_movimiento"],
    defaultSort: "creado",
    async load(db, p) {
        // Import diferido: el módulo de consulta arrastra exceljs, que no hace falta para mapear ni para probar.
        const { queryLlavesRows } = await import("../../reports-functions/llavesReport");
        return loadLlaves(db, p, queryLlavesRows as unknown as QueryRows);
    },
};
