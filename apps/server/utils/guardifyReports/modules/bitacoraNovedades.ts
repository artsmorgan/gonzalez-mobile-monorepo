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

/** Quién registró cada fila: el empleado del PRIMER cambio guardado de esa tabla y registro (`__created__`), como lo muestra la app. Un solo bloque de consultas por 1000 filas. */
async function creadoresPorCambio(db: any, tabla: string, ids: unknown[]): Promise<Map<number, number>> {
    const all = [...new Set(ids.map(Number).filter((n) => Number.isFinite(n) && n > 0))];
    const first = new Map<number, { id: number; by: number }>();
    for (let i = 0; i < all.length; i += 1000) {
        const cambios = await db.c_cambios_apps_modules.findMany({
            where: { nombre_tabla: tabla, registro_id: { in: all.slice(i, i + 1000) } },
            select: { id: true, registro_id: true, created_by: true },
            orderBy: { id: "asc" },
        });
        for (const c of cambios) {
            const prev = first.get(Number(c.registro_id));
            if (!prev || Number(c.id) < prev.id) first.set(Number(c.registro_id), { id: Number(c.id), by: Number(c.created_by) });
        }
    }
    return new Map([...first].filter(([, v]) => v.by > 0).map(([k, v]) => [k, v.by]));
}

/** Datos que no vienen en la fila de la consulta y se cargan en lote (ver `loadExtras`). */
export type BitacoraExtras = { ejecutivo_cuenta?: string | null; division?: string | null; usuario_inserta?: string | null };

/**
 * Fila de `queryBitacoraNovedadesRows` (ya con nombres de estructura y categoría) → fila plana.
 * Nunca se exponen `firma_manual_responsable` ni `firma_responsable` (firmas) ni las fotos de la nota.
 * `extras`: ejecutivo de cuenta de la sucursal, división (en esta tabla puede venir en 0: se completa por el puesto) y quién registró la nota.
 */
export function mapBitacoraNovedadesRow(r: any, extras: BitacoraExtras = {}): OutRow {
    return {
        id: Number(r.id),
        creado: fmtDt(r.created_at),
        actualizado: fmtDt(r.updated_at),
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
        usuario_inserta: extras.usuario_inserta ?? null,
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

/** Ejecutivo de cuenta (por la sucursal), división de las notas sin división (por el puesto) y quién registró cada nota, en lote. */
async function loadExtras(db: any, items: Array<{ r: any; h: Hierarchy }>): Promise<BitacoraExtras[]> {
    const [ejecutivos, divisiones, creadores] = await Promise.all([
        ejecutivoPorCorpo(db, items.map((x) => x.h.corpo)),
        findByIds<{ nombre: string | null }>(db, "n_division", items.filter((x) => !nameOrNull(x.r.division_nombre, x.r.division_id)).map((x) => x.h.division), { nombre: true }),
        creadoresPorCambio(db, "c_puesto_notas", items.map((x) => x.r.id)),
    ]);
    const nombres = await nombresEmpleado(db, [...creadores.values()]);
    return items.map(({ r, h }) => ({
        ejecutivo_cuenta: ejecutivos.get(Number(h.corpo)) ?? null,
        division: txt(divisiones.get(Number(h.division))?.nombre),
        usuario_inserta: nombres.get(creadores.get(Number(r.id)) ?? 0) ?? null,
    }));
}

/**
 * Bitácora de novedades (`c_puesto_notas`). En esta tabla cliente, división, contrato y sucursal pueden venir en 0: se completan desde el puesto.
 * El periodo se aplica a `created_at` (el Excel solo tiene «Creado» y «Actualizado»; no hay otra «Fecha»).
 * La tabla no guarda quién la registró: «Usuario que lo registró» sale del primer cambio guardado (`c_cambios_apps_modules`, `__created__`), como lo muestra la app.
 */
export const bitacoraNovedades: GuardifyReportModule = {
    id: "bitacora_novedades",
    supportsScope: true,
    searchKeys: ["titulo", "descripcion", "categoria", "puesto", "sucursal", "contrato"],
    filterKeys: ["categoria", "relevancia", "modificada", "empresa", "cliente", "division", "contrato", "sucursal", "puesto", "ejecutivo_cuenta", "usuario_inserta"],
    sortKeys: ["creado", "actualizado", "titulo", "categoria", "relevancia", "empresa", "cliente", "division", "contrato", "sucursal", "puesto", "ejecutivo_cuenta", "usuario_inserta"],
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
