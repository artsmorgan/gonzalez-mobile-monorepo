import { ejecutivoPorCorpo, findByIds } from "../enrich";
import { fmtDt } from "../mappers";
import type { OutRow } from "../listing";
import { addDays } from "../params";
import { aperturaCierrePuestoForm } from "./aperturaCierrePuestoForm";
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
function countJsonArray(raw: unknown): number {
    if (raw == null || String(raw).trim() === "") return 0;
    try {
        const p = typeof raw === "object" ? raw : JSON.parse(String(raw));
        return Array.isArray(p) ? p.length : 0;
    } catch {
        return 0;
    }
}
function tipoLabel(v: unknown): string | null {
    const s = txt(v);
    return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : null;
}

/** Datos que no vienen en la fila de la consulta y se cargan en lote (ver `loadExtras`). */
export type AperturaExtras = { ejecutivo_cuenta?: string | null; division?: string | null; modificado?: string | null; modificado_por?: string | null };

/**
 * Fila de `queryAperturaCierrePuestoRows` (ya con nombres de estructura) → fila plana.
 * Nunca se exponen las cuatro firmas ni los nombres de archivo de las fotos: de actividades, inventario y fotos solo se cuenta.
 * `extras`: ejecutivo de cuenta de la sucursal, para registros antiguos sin división la que da el puesto, y la última modificación (fecha y quién; la tabla no guarda `updated_at`: sale de su historial de cambios).
 */
export function mapAperturaCierrePuestoRow(r: any, extras: AperturaExtras = {}): OutRow {
    return {
        id: Number(r.id),
        fecha: fmtDt(r.fecha),
        tipo: tipoLabel(r.tipo_txt ?? r.tipo),
        creado: fmtDt(r.created_at),
        creado_por: nameOrNull(r.creador_nombre, r.created_by),
        modificado: (r as any).updated_at ? fmtDt((r as any).updated_at) : (extras.modificado ?? null),
        modificado_por: (r as any).audit_modificado_por ?? (extras.modificado_por ?? null),
        empresa: nameOrNull(r.empresa_nombre, r.empresa_id),
        cliente: nameOrNull(r.cliente_nombre, r.cliente_id),
        division: nameOrNull(r.division_nombre, r.division_id) ?? extras.division ?? null,
        contrato: nameOrNull(r.contrato_nombre, r.contrato_id),
        sucursal: nameOrNull(r.corpo_nombre, r.corpo_id),
        puesto: nameOrNull(r.puesto_nombre, r.puesto_id),
        representante_cliente: txt(r.nombre_representante_cliente),
        representante_saliente: txt(r.nombre_representante_empresa_saliente),
        representante_entrante: txt(r.nombre_representante_empresa_entrante),
        actividades: countJsonArray(r.actividades),
        inventario: countJsonArray(r.inventario),
        fotos: Array.isArray(r.imagenes_names) ? r.imagenes_names.length : 0,
        observaciones: cut(r.otras_observaciones),
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
    const incomplete = rows.filter((r) => !(Number(r.empresa_id) > 0 && Number(r.division_id) > 0 && Number(r.contrato_id) > 0));
    const hier = await loadPuestoHierarchy(db, incomplete.map((r) => Number(r.puesto_id)));
    return rows.filter((r) => matchesScope(rowHierarchy(r, hier.get(Number(r.puesto_id))), scope));
}

/** Días que se amplía el rango de creación al consultar: el periodo se aplica a `fecha` (cuándo se hizo la apertura/cierre), que puede diferir de cuándo se registró. */
const MARGEN_DIAS = 45;

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

/** Ejecutivo de cuenta (por la sucursal), división de los registros antiguos sin división (por el puesto) y última modificación (historial de cambios), en lote. */
async function loadExtras(db: any, items: Array<{ r: any; h: Hierarchy }>): Promise<AperturaExtras[]> {
    const [ejecutivos, divisiones, historial] = await Promise.all([
        ejecutivoPorCorpo(db, items.map((x) => x.h.corpo)),
        findByIds<{ nombre: string | null }>(db, "n_division", items.filter((x) => !nameOrNull(x.r.division_nombre, x.r.division_id)).map((x) => x.h.division), { nombre: true }),
        historialPorRegistro(db, "c_apertura_cierre_puesto", items.map((x) => x.r.id)),
    ]);
    // Mismo formato que `creado_por`: «código - nombre».
    const empleados = await findByIds<{ codigo?: string | null; nombre?: string | null; primer_apellido?: string | null; segundo_apellido?: string | null }>(
        db, "c_empleado", [...historial.values()].map((x) => x.modBy), { codigo: true, nombre: true, primer_apellido: true, segundo_apellido: true },
    );
    const etiqueta = (id: number | null | undefined): string | null => {
        const e = id ? empleados.get(id) : undefined;
        if (!e) return null;
        const full = [e.nombre, e.primer_apellido, e.segundo_apellido].filter(Boolean).join(" ").trim();
        const codigo = txt(e.codigo);
        return codigo && full ? `${codigo} - ${full}` : full || codigo;
    };
    return items.map(({ r, h }) => {
        const hist = historial.get(Number(r.id));
        return {
            ejecutivo_cuenta: ejecutivos.get(Number(h.corpo)) ?? null,
            division: txt(divisiones.get(Number(h.division))?.nombre),
            modificado: fmtDt(hist?.modAt as any),
            modificado_por: etiqueta(hist?.modBy),
        };
    });
}

/**
 * Apertura/Cierre de puesto (`c_apertura_cierre_puesto`). Cada fila trae su estructura; los registros antiguos sin empresa, división o contrato se ubican por su puesto.
 * El periodo se aplica a `fecha`, la «Fecha» del Excel (cuándo se hizo); se consulta por fecha de creación con un margen de 45 días y se recorta por `fecha`.
 * «Usuario que lo registró» es `creado_por` (`created_by`). La tabla no guarda `updated_at` ni `updated_by`: `modificado` y `modificado_por` salen de la última fila de su historial (`c_cambios_apps_modules`).
 */
export const aperturaCierrePuesto: GuardifyReportModule = {
    id: "apertura_cierre_puesto",
    supportsScope: true,
    searchKeys: ["creado_por", "modificado_por", "puesto", "sucursal", "contrato", "representante_cliente", "representante_saliente", "representante_entrante"],
    filterKeys: ["tipo", "empresa", "cliente", "division", "contrato", "sucursal", "puesto", "ejecutivo_cuenta", "creado", "creado_por", "modificado", "modificado_por"],
    sortKeys: ["fecha", "tipo", "creado", "creado_por", "modificado", "modificado_por", "empresa", "cliente", "division", "contrato", "sucursal", "puesto", "actividades", "inventario", "fotos", "ejecutivo_cuenta"],
    defaultSort: "fecha",
    form: aperturaCierrePuestoForm,
    async load(db, p) {
        // Importación diferida: estos módulos arrastran exceljs/axios, que las pruebas del mapeo y del alcance no necesitan cargar.
        const { queryAperturaCierrePuestoRows } = await import("../../reports-functions/aperturaCierrePuestoReport");
        const all = await queryAperturaCierrePuestoRows(db, { creadoDesde: `${addDays(p.from, -MARGEN_DIAS)}T00:00:00`, creadoHasta: `${addDays(p.to, MARGEN_DIAS - 1)}T23:59:59` }, "fecha");
        const desde = `${p.from}T00:00:00`;
        const hasta = `${p.to}T00:00:00`;
        const rows = all.filter((r: any) => {
            const f = fmtDt(r.fecha);
            return f != null && f >= desde && f < hasta;
        });
        const incomplete = rows.filter((r) => !(Number(r.empresa_id) > 0 && Number(r.division_id) > 0 && Number(r.contrato_id) > 0));
        const hier = await loadPuestoHierarchy(db, incomplete.map((r) => Number(r.puesto_id)));
        const located = rows.map((r) => ({ r, h: rowHierarchy(r, hier.get(Number(r.puesto_id))) }));
        const kept = p.scope ? located.filter((x) => matchesScope(x.h, p.scope!)) : located;
        const extras = await loadExtras(db, kept);
        return kept.map((x, i) => mapAperturaCierrePuestoRow(x.r, extras[i]));
    },
};
