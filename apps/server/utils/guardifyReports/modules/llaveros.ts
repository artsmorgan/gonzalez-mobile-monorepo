import type { ReportDataAccess } from "../../reportDynamicPrisma";
import { ejecutivoPorCorpo } from "../enrich";
import { fmtDt } from "../mappers";
import type { OutRow } from "../listing";
import { addDays, type ReportParams } from "../params";
import { matchesScope } from "../scope";
import type { GuardifyReportModule } from "../types";
import { llaverosForm } from "./llaverosForm";

const txt = (v: unknown): string | null => {
    const s = String(v ?? "").trim();
    return s ? s : null;
};
/** Textos libres: máximo 500 caracteres. */
const short = (v: unknown): string | null => txt(v)?.slice(0, 500) ?? null;
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
 * Fila cruda de `queryLlaverosRows` → fila plana. Nunca se exponen `firma_responsable`, `firma_entrega`, `firma_recibe`
 * ni el teléfono de los movimientos.
 */
export function mapLlaveroRow(r: any, creador?: any, ejecutivo?: string | null, modificado?: { at?: string | Date | null; por?: string | null }): OutRow {
    const movs: any[] = Array.isArray(r.e_movimiento_llavero) ? r.e_movimiento_llavero : [];
    const links: any[] = Array.isArray(r.e_llave_en_llavero) ? r.e_llave_en_llavero : [];
    const llaves = links.map((x) => x?.e_llave).filter(Boolean);
    const last = latestMovimiento(movs);
    return {
        id: Number(r.id),
        creado: fmtDt(r.created_at),
        numero: txt(r.numero_llavero),
        nombre: txt(r.nombre_llavero),
        empresa: place(r.empresa_nombre, r.empresa_id),
        cliente: place(r.cliente_nombre, r.cliente_id),
        division: place(r.division_nombre, r.division_id),
        contrato: place(r.contrato_nombre, r.contrato_id),
        sucursal: place(r.corpo_nombre, r.corpo_id),
        puesto: place(r.puesto_nombre, r.puesto_id),
        llaves: llaves.length,
        numeros_llaves: short(llaves.map((l: any) => txt(l.numero_llave)).filter(Boolean).join("; ")),
        movimientos: movs.length,
        ultimo_movimiento: last ? movimientoDt(last) : null,
        ultima_entrega: last ? txt(last.nombre_persona_entrega) : null,
        ultima_recibe: last ? txt(last.nombre_persona_recibe) : null,
        observaciones: short(r.observaciones),
        creado_por: nombre(creador),
        modificado: fmtDt(modificado?.at as any),
        modificado_por: txt(modificado?.por),
        ejecutivo_cuenta: txt(ejecutivo),
    };
}

type QueryRows = (db: ReportDataAccess, filters: { creadoDesde: string; creadoHasta: string }, orderKey: "created_at") => Promise<any[]>;

/** Trae las filas del periodo `[from, to)`, las restringe al alcance y resuelve en lote quien las creó y quien las modificó por última vez. */
export async function loadLlaveros(db: ReportDataAccess, p: ReportParams, query: QueryRows): Promise<OutRow[]> {
    const rows = await query(db, { creadoDesde: `${p.from}T00:00:00`, creadoHasta: `${addDays(p.to, -1)}T23:59:59` }, "created_at");
    const scope = p.scope;
    const kept = !scope
        ? rows
        : rows.filter((r: any) => matchesScope({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }, scope));
    const cambios = await ultimosCambios(db, "e_llavero", kept.map((r: any) => r.id));
    const ids = [...new Set([...kept.map((r: any) => Number(r.created_by)), ...[...cambios.values()].map((c) => c.by)].filter((n: number) => Number.isFinite(n) && n > 0))];
    const empleados = ids.length ? await db.c_empleado!.findMany({ where: { id: { in: ids } }, select: { id: true, nombre: true, primer_apellido: true, segundo_apellido: true } }) : [];
    const creadorById = new Map(empleados.map((e: any) => [Number(e.id), e]));
    const ejecutivos = await ejecutivoPorCorpo(db as any, kept.map((r: any) => r.corpo_id));
    return kept.map((r: any) => {
        const c = cambios.get(Number(r.id));
        return mapLlaveroRow(r, creadorById.get(Number(r.created_by)), ejecutivos.get(Number(r.corpo_id)), c ? { at: c.at, por: nombre(creadorById.get(c.by)) } : undefined);
    });
}

/** Llaveros (`e_llavero`). Cada fila trae sus ids de empresa, cliente, división, contrato, sucursal y puesto. */
export const llaveros: GuardifyReportModule = {
    id: "llaveros",
    supportsScope: true,
    searchKeys: ["numero", "nombre", "numeros_llaves", "sucursal", "puesto", "ultima_entrega", "ultima_recibe", "creado_por", "modificado_por", "ejecutivo_cuenta"],
    filterKeys: ["empresa", "cliente", "division", "contrato", "sucursal", "puesto", "ejecutivo_cuenta", "creado", "creado_por", "modificado", "modificado_por"],
    sortKeys: ["creado", "numero", "nombre", "empresa", "cliente", "contrato", "sucursal", "puesto", "llaves", "movimientos", "ultimo_movimiento", "division", "ejecutivo_cuenta", "creado_por", "modificado", "modificado_por"],
    defaultSort: "creado",
    form: llaverosForm,
    async load(db, p) {
        // Import diferido: el módulo de consulta arrastra exceljs, que no hace falta para mapear ni para probar.
        const { queryLlaverosRows } = await import("../../reports-functions/llaverosReport");
        return loadLlaveros(db, p, queryLlaverosRows as unknown as QueryRows);
    },
};
