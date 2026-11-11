import { ejecutivoPorCorpo, findByIds, nombresEmpleado } from "../enrich";
import { fmtDt } from "../mappers";
import type { OutRow } from "../listing";
import { addDays } from "../params";
import { bitacoraNovedadesForm } from "./bitacoraNovedadesForm";
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

/**
 * Historial de cada registro en `c_cambios_apps_modules` (una sola consulta por bloque de 1000 ids, solo id, registro, fecha y autor):
 * la primera fila es el alta (`__created__`) y la última, si hay más de una, es la última modificación.
 */
type Historial = { creadoAt: unknown; creadoBy: number | null; modAt: unknown; modBy: number | null };
async function historialPorRegistro(db: any, tabla: string, ids: unknown[]): Promise<Map<number, Historial>> {
    const all = [...new Set(ids.map(Number).filter((n) => Number.isFinite(n) && n > 0))];
    const first = new Map<number, any>();
    const last = new Map<number, any>();
    for (let i = 0; i < all.length; i += 1000) {
        const cambios = await db.c_cambios_apps_modules.findMany({
            where: { nombre_tabla: tabla, registro_id: { in: all.slice(i, i + 1000) } },
            select: { id: true, registro_id: true, created_at: true, created_by: true },
            orderBy: { id: "asc" },
        });
        for (const c of cambios) {
            const k = Number(c.registro_id);
            const f = first.get(k);
            if (!f || Number(c.id) < Number(f.id)) first.set(k, c);
            const l = last.get(k);
            if (!l || Number(c.id) > Number(l.id)) last.set(k, c);
        }
    }
    const by = (c: any): number | null => (Number(c?.created_by) > 0 ? Number(c.created_by) : null);
    const out = new Map<number, Historial>();
    for (const [k, f] of first) {
        const l = last.get(k);
        const modificado = !!l && Number(l.id) !== Number(f.id);
        out.set(k, { creadoAt: f.created_at ?? null, creadoBy: by(f), modAt: modificado ? l.created_at ?? null : null, modBy: modificado ? by(l) : null });
    }
    return out;
}

/** Datos que no vienen en la fila de la consulta y se cargan en lote (ver `loadExtras`). */
export type BitacoraExtras = { ejecutivo_cuenta?: string | null; division?: string | null; creado_por?: string | null; modificado_por?: string | null };

/**
 * Fila de `queryBitacoraNovedadesRows` (ya con nombres de estructura y categoría) → fila plana.
 * Nunca se exponen `firma_manual_responsable` ni `firma_responsable` (firmas) ni las fotos de la nota.
 * `extras`: ejecutivo de cuenta de la sucursal, división (en esta tabla puede venir en 0: se completa por el puesto) y quién registró y quién modificó por última vez la nota (historial de cambios).
 */
export function mapBitacoraNovedadesRow(r: any, extras: BitacoraExtras = {}): OutRow {
    return {
        id: Number(r.id),
        creado: fmtDt(r.created_at),
        creado_por: (r as any).audit_creado_por ?? (extras.creado_por ?? null),
        modificado: fmtDt(r.updated_at),
        modificado_por: (r as any).audit_modificado_por ?? (extras.modificado_por ?? null),
        titulo: cut(r.titulo),
        descripcion: cut(r.description),
        categoria: txt(r.categoria_nombre),
        relevancia: txt(r.relevancia),
        modificada: r.is_modified ? "Sí" : "No",
        empresa: nameOrNull(r.empresa_nombre, r.empresa_id),
        cliente: nameOrNull(r.cliente_nombre, r.cliente_id),
        division: nameOrNull(r.division_nombre, r.division_id) ?? extras.division ?? null,
        contrato: nameOrNull(r.contrato_nombre, r.contrato_id),
        sucursal: nameOrNull(r.corpo_nombre, r.corpo_id),
        puesto: nameOrNull(r.puesto_nombre, r.puesto_id),
        ejecutivo_cuenta: extras.ejecutivo_cuenta ?? null,
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
    const incomplete = rows.filter((r) => !(Number(r.cliente_id) > 0 && Number(r.division_id) > 0 && Number(r.contrato_id) > 0 && Number(r.corpo_id) > 0));
    const hier = await loadPuestoHierarchy(db, incomplete.map((r) => Number(r.puesto_id)));
    return rows.filter((r) => matchesScope(rowHierarchy(r, hier.get(Number(r.puesto_id))), scope));
}

/** Ejecutivo de cuenta (por la sucursal), división de las notas sin división (por el puesto) y quién registró y quién modificó por última vez cada nota, en lote. */
async function loadExtras(db: any, items: Array<{ r: any; h: Hierarchy }>): Promise<BitacoraExtras[]> {
    const [ejecutivos, divisiones, historial] = await Promise.all([
        ejecutivoPorCorpo(db, items.map((x) => x.h.corpo)),
        findByIds<{ nombre: string | null }>(db, "n_division", items.filter((x) => !nameOrNull(x.r.division_nombre, x.r.division_id)).map((x) => x.h.division), { nombre: true }),
        historialPorRegistro(db, "c_puesto_notas", items.map((x) => x.r.id)),
    ]);
    const nombres = await nombresEmpleado(db, [...historial.values()].flatMap((x) => [x.creadoBy, x.modBy]));
    return items.map(({ r, h }) => {
        const hist = historial.get(Number(r.id));
        return {
            ejecutivo_cuenta: ejecutivos.get(Number(h.corpo)) ?? null,
            division: txt(divisiones.get(Number(h.division))?.nombre),
            creado_por: nombres.get(hist?.creadoBy ?? 0) ?? null,
            modificado_por: nombres.get(hist?.modBy ?? 0) ?? null,
        };
    });
}

/**
 * Bitácora de novedades (`c_puesto_notas`). En esta tabla cliente, división, contrato y sucursal pueden venir en 0: se completan desde el puesto.
 * El periodo se aplica a `created_at` (el Excel solo tiene «Creado» y «Actualizado» = `modificado`; no hay otra «Fecha»).
 * La tabla no guarda quién la registró ni quién la modificó: `creado_por` sale del primer cambio guardado (`c_cambios_apps_modules`, `__created__`) y `modificado_por` del último, como lo muestra la app. `modificado` es `updated_at`.
 */
export const bitacoraNovedades: GuardifyReportModule = {
    id: "bitacora_novedades",
    supportsScope: true,
    searchKeys: ["titulo", "descripcion", "categoria", "puesto", "sucursal", "contrato", "creado_por", "modificado_por"],
    filterKeys: ["categoria", "relevancia", "modificada", "empresa", "cliente", "division", "contrato", "sucursal", "puesto", "ejecutivo_cuenta", "creado", "creado_por", "modificado", "modificado_por"],
    sortKeys: ["creado", "creado_por", "modificado", "modificado_por", "titulo", "categoria", "relevancia", "empresa", "cliente", "division", "contrato", "sucursal", "puesto", "ejecutivo_cuenta"],
    defaultSort: "creado",
    form: bitacoraNovedadesForm,
    async load(db, p) {
        // Importación diferida: estos módulos arrastran exceljs/axios, que las pruebas del mapeo y del alcance no necesitan cargar.
        const { queryBitacoraNovedadesRows } = await import("../../reports-functions/bitacoraNovedadesReport");
        const rows = await queryBitacoraNovedadesRows(db, { creadoDesde: `${p.from}T00:00:00`, creadoHasta: `${addDays(p.to, -1)}T23:59:59` }, "updated_at");
        const incomplete = rows.filter((r) => !(Number(r.cliente_id) > 0 && Number(r.division_id) > 0 && Number(r.contrato_id) > 0 && Number(r.corpo_id) > 0));
        const hier = await loadPuestoHierarchy(db, incomplete.map((r) => Number(r.puesto_id)));
        const located = rows.map((r) => ({ r, h: rowHierarchy(r, hier.get(Number(r.puesto_id))) }));
        const kept = p.scope ? located.filter((x) => matchesScope(x.h, p.scope!)) : located;
        const extras = await loadExtras(db, kept);
        return kept.map((x, i) => mapBitacoraNovedadesRow(x.r, extras[i]));
    },
};
