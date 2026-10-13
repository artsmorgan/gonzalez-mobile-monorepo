import type { ReportDataAccess } from "../../reportDynamicPrisma";
import { fmtDt } from "../mappers";
import type { OutRow } from "../listing";
import { addDays, type ReportParams } from "../params";
import { matchesScope } from "../scope";
import { divisionPorContrato, ejecutivoPorCorpo, findByIds } from "../enrich";
import type { GuardifyReportModule } from "../types";
import { llavesForm } from "./llavesForm";

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
/** Nombres distintos (en orden de aparición) unidos con «; », recortados a 500. */
const distinctJoin = (xs: unknown[]): string | null => short([...new Set(xs.map(txt).filter((x): x is string => !!x))].join("; "));
/** Nombre de estructura; la consulta original rellena con el id cuando no encuentra el registro: eso es «sin dato». */
const place = (v: unknown, id: unknown): string | null => {
    const s = txt(v);
    return !s || s === String(id ?? "") ? null : s;
};
const nombre = (e: any): string | null => (e ? txt([e.nombre, e.primer_apellido, e.segundo_apellido].filter(Boolean).join(" ")) : null);

/**
 * Último cambio de cada registro en el historial (`c_cambios_apps_modules`): cuándo y quién (id de empleado). Una consulta por bloque
 * de 1000 registros; si la base no tiene el historial, ningún registro tiene cambio.
 */
async function ultimosCambios(db: any, tabla: string, ids: unknown[]): Promise<Map<number, { id: number; at: string; by: number }>> {
    const all = [...new Set(ids.map(Number).filter((n) => Number.isFinite(n) && n > 0))];
    const out = new Map<number, { id: number; at: string; by: number }>();
    try {
        for (let i = 0; i < all.length; i += 1000) {
            const rows = await db.c_cambios_apps_modules.findMany({ where: { nombre_tabla: tabla, registro_id: { in: all.slice(i, i + 1000) } }, select: { id: true, registro_id: true, created_by: true, created_at: true } });
            for (const c of rows) {
                const at = fmtDt(c.created_at);
                if (!at) continue;
                const prev = out.get(Number(c.registro_id));
                if (!prev || at > prev.at || (at === prev.at && Number(c.id) > prev.id)) out.set(Number(c.registro_id), { id: Number(c.id), at, by: Number(c.created_by) });
            }
        }
    } catch {
        /* sin historial */
    }
    return out;
}

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
 * Datos que se resuelven en lote fuera de la fila cruda: ejecutivo de cuenta de la sucursal, división del contrato (si la fila no trae una)
 * y el último cambio del historial (`c_cambios_apps_modules`): cuándo (`modificado`) y quién (`modificadoPor`, ya como nombre).
 */
export type LlaveExtra = { ejecutivo?: string | null; division?: string | null; modificado?: string | Date | null; modificadoPor?: string | null };

/**
 * Fila cruda de `queryLlavesRows` → fila plana. Nunca se exponen `firma_responsable`, `firma_entrega`, `firma_recibe`
 * ni el teléfono de los movimientos. `entregadas_por` y `recibidas_por` reúnen las personas de TODOS los movimientos
 * (el filtro de la app busca en cualquier movimiento); `ultima_entrega`/`ultima_recibe` son las del último.
 */
export function mapLlaveRow(r: any, creador?: any, extra: LlaveExtra = {}): OutRow {
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
        empresa: place(r.empresa_nombre, r.empresa_id),
        cliente: place(r.cliente_nombre, r.cliente_id),
        division: realName(r.division_nombre) ?? txt(extra.division),
        contrato: place(r.contrato_nombre, r.contrato_id),
        sucursal: place(r.corpo_nombre, r.corpo_id),
        puesto: place(r.puesto_nombre, r.puesto_id),
        llaveros: short(links.map((x) => txt(x?.e_llavero?.nombre_llavero)).filter(Boolean).join("; ")),
        movimientos: movs.length,
        ultimo_movimiento: last ? movimientoDt(last) : null,
        ultima_entrega: last ? txt(last.nombre_persona_entrega) : null,
        ultima_recibe: last ? txt(last.nombre_persona_recibe) : null,
        observaciones: short(r.observaciones),
        creado_por: nombre(creador),
        modificado: fmtDt(extra.modificado as any),
        modificado_por: txt(extra.modificadoPor),
        ejecutivo_cuenta: txt(extra.ejecutivo),
        entregadas_por: distinctJoin(movs.map((m) => m?.nombre_persona_entrega)),
        recibidas_por: distinctJoin(movs.map((m) => m?.nombre_persona_recibe)),
    };
}

type QueryRows = (db: ReportDataAccess, filters: { creadoDesde: string; creadoHasta: string }, orderKey: "created_at") => Promise<any[]>;

/** Trae las filas del periodo `[from, to)`, las restringe al alcance y resuelve en lote quien las creó y quien las modificó por última vez, el ejecutivo de cuenta y la división. */
export async function loadLlaves(db: ReportDataAccess, p: ReportParams, query: QueryRows): Promise<OutRow[]> {
    const rows = await query(db, { creadoDesde: `${p.from}T00:00:00`, creadoHasta: `${addDays(p.to, -1)}T23:59:59` }, "created_at");
    const scope = p.scope;
    const kept = !scope
        ? rows
        : rows.filter((r: any) => matchesScope({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }, scope));
    const cambios = await ultimosCambios(db, "e_llave", kept.map((r: any) => r.id));
    const creadores = await findByIds<any>(db as any, "c_empleado", [...kept.map((r: any) => r.created_by), ...[...cambios.values()].map((c) => c.by)], { nombre: true, primer_apellido: true, segundo_apellido: true });
    const ejecutivos = await ejecutivoPorCorpo(db as any, kept.map((r: any) => r.corpo_id));
    const divisiones = await divisionPorContrato(db as any, kept.filter((r: any) => !realName(r.division_nombre)).map((r: any) => r.contrato_id));
    return kept.map((r: any) => {
        const c = cambios.get(Number(r.id));
        return mapLlaveRow(r, creadores.get(Number(r.created_by)), {
            ejecutivo: ejecutivos.get(Number(r.corpo_id)), division: divisiones.get(Number(r.contrato_id)),
            modificado: c?.at, modificadoPor: c ? nombre(creadores.get(c.by)) : null,
        });
    });
}

/** Llaves (`e_llave`). Cada fila trae sus ids de empresa, cliente, división, contrato, sucursal y puesto. Periodo: fecha de creación (`created_at`, columna `creado`), la «Fecha» del Excel. */
export const llaves: GuardifyReportModule = {
    id: "llaves",
    supportsScope: true,
    searchKeys: ["numero", "lugar_abre", "llaveros", "sucursal", "puesto", "ultima_entrega", "ultima_recibe", "creado_por", "modificado_por", "ejecutivo_cuenta"],
    filterKeys: ["empresa", "cliente", "division", "contrato", "sucursal", "puesto", "llaveros", "entregadas_por", "recibidas_por", "ejecutivo_cuenta", "creado", "creado_por", "modificado", "modificado_por"],
    sortKeys: ["creado", "numero", "lugar_abre", "copias", "empresa", "cliente", "division", "contrato", "sucursal", "puesto", "movimientos", "ultimo_movimiento", "ejecutivo_cuenta", "creado_por", "modificado", "modificado_por"],
    defaultSort: "creado",
    form: llavesForm,
    async load(db, p) {
        // Import diferido: el módulo de consulta arrastra exceljs, que no hace falta para mapear ni para probar.
        const { queryLlavesRows } = await import("../../reports-functions/llavesReport");
        return loadLlaves(db, p, queryLlavesRows as unknown as QueryRows);
    },
};
