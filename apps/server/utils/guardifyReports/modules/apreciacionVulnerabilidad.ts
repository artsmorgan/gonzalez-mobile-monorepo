import { ejecutivoPorCorpo, findByIds, nombresEmpleado } from "../enrich";
import { fmtDt } from "../mappers";
import type { OutRow } from "../listing";
import { addDays } from "../params";
import { apreciacionVulnerabilidadForm } from "./apreciacionVulnerabilidadForm";
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
function parseArray(raw: unknown): any[] {
    if (raw == null || String(raw).trim() === "") return [];
    try {
        const p = typeof raw === "object" ? raw : JSON.parse(String(raw));
        return Array.isArray(p) ? p : [];
    } catch {
        return [];
    }
}

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
export type VulnerabilidadExtras = { ejecutivo_cuenta?: string | null; division?: string | null; creado?: string | null; creado_por?: string | null; modificado?: string | null; modificado_por?: string | null };

/**
 * Fila de `queryVulnerabilidadRows` (ya con nombres de estructura) → fila plana.
 * Nunca se exponen las firmas, el `enlace` ni las fotos; de la boleta solo se informa el nivel de vulnerabilidad,
 * cuántas secciones tiene y sus métricas.
 * `extras`: ejecutivo de cuenta de la sucursal, división (si el registro antiguo no la trae) y la auditoría (alta y última modificación: fecha y quién), que la tabla no guarda y sale de su historial de cambios.
 */
export function mapVulnerabilidadRow(r: any, extras: VulnerabilidadExtras = {}): OutRow {
    const secciones = parseArray(r.boleta);
    const pct = secciones.find((s) => s?.key === "porcentaje_vulnerabilidad");
    const metricas = parseArray(r.metricas_vulnerablidad)
        .filter((m) => typeof m === "string" || typeof m === "number")
        .map((m) => String(m).trim())
        .filter(Boolean);
    return {
        id: Number(r.id),
        fecha: fmtDt(r.fecha),
        creado: (r as any).created_at ? fmtDt((r as any).created_at) : (extras.creado ?? null),
        creado_por: (r as any).audit_creado_por ?? (extras.creado_por ?? null),
        modificado: (r as any).updated_at ? fmtDt((r as any).updated_at) : (extras.modificado ?? null),
        modificado_por: (r as any).audit_modificado_por ?? (extras.modificado_por ?? null),
        solicitante: txt(r.nombre_solicitante),
        nivel_vulnerabilidad: txt(pct?.vulnerabilityLevel),
        secciones: secciones.filter((s) => s?.key !== "porcentaje_vulnerabilidad").length,
        metricas: cut(metricas.join("; ")),
        observaciones: cut(r.observaciones),
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
    const incomplete = rows.filter((r) => !(Number(r.empresa_id) > 0 && Number(r.division_id) > 0 && Number(r.contrato_id) > 0));
    const hier = await loadPuestoHierarchy(db, incomplete.map((r) => Number(r.puesto_id)));
    return rows.filter((r) => matchesScope(rowHierarchy(r, hier.get(Number(r.puesto_id))), scope));
}

/** Ejecutivo de cuenta (por la sucursal), división de los registros antiguos sin división (por el puesto) y la auditoría (alta y última modificación) de cada boleta, en lote. */
async function loadExtras(db: any, items: Array<{ r: any; h: Hierarchy }>): Promise<VulnerabilidadExtras[]> {
    const [ejecutivos, divisiones, historial] = await Promise.all([
        ejecutivoPorCorpo(db, items.map((x) => x.h.corpo)),
        findByIds<{ nombre: string | null }>(db, "n_division", items.filter((x) => !nameOrNull(x.r.division_nombre, x.r.division_id)).map((x) => x.h.division), { nombre: true }),
        historialPorRegistro(db, "c_boleta_apreciacion_vulnerabilidad", items.map((x) => x.r.id)),
    ]);
    const nombres = await nombresEmpleado(db, [...historial.values()].flatMap((x) => [x.creadoBy, x.modBy]));
    return items.map(({ r, h }) => {
        const hist = historial.get(Number(r.id));
        return {
            ejecutivo_cuenta: ejecutivos.get(Number(h.corpo)) ?? null,
            division: txt(divisiones.get(Number(h.division))?.nombre),
            creado: fmtDt(hist?.creadoAt as any),
            creado_por: nombres.get(hist?.creadoBy ?? 0) ?? null,
            modificado: fmtDt(hist?.modAt as any),
            modificado_por: nombres.get(hist?.modBy ?? 0) ?? null,
        };
    });
}

/**
 * Apreciación de vulnerabilidad (`c_boleta_apreciacion_vulnerabilidad`). Periodo por `fecha` de la boleta (la «Fecha» del Excel), como el filtro de la app.
 * La tabla no guarda `created_at`/`created_by` ni `updated_at`/`updated_by`: `creado`/`creado_por` salen del primer cambio guardado (`c_cambios_apps_modules`, `__created__`) y `modificado`/`modificado_por` del último, como lo muestra la app. `fecha` es la de la boleta.
 */
export const apreciacionVulnerabilidad: GuardifyReportModule = {
    id: "apreciacion_vulnerabilidad",
    supportsScope: true,
    searchKeys: ["solicitante", "puesto", "sucursal", "contrato", "cliente", "creado_por", "modificado_por"],
    filterKeys: ["nivel_vulnerabilidad", "empresa", "cliente", "division", "contrato", "sucursal", "puesto", "ejecutivo_cuenta", "creado", "creado_por", "modificado", "modificado_por"],
    sortKeys: ["fecha", "creado", "creado_por", "modificado", "modificado_por", "solicitante", "nivel_vulnerabilidad", "secciones", "empresa", "cliente", "division", "contrato", "sucursal", "puesto", "ejecutivo_cuenta"],
    defaultSort: "fecha",
    form: apreciacionVulnerabilidadForm,
    async load(db, p) {
        // Importación diferida: estos módulos arrastran exceljs/axios, que las pruebas del mapeo y del alcance no necesitan cargar.
        const { queryVulnerabilidadRows } = await import("../../reports-functions/vulnerabilidadReport");
        const rows = await queryVulnerabilidadRows(db, { creadoDesde: `${p.from}T00:00:00`, creadoHasta: `${addDays(p.to, -1)}T23:59:59` }, "fecha");
        const incomplete = rows.filter((r) => !(Number(r.empresa_id) > 0 && Number(r.division_id) > 0 && Number(r.contrato_id) > 0));
        const hier = await loadPuestoHierarchy(db, incomplete.map((r) => Number(r.puesto_id)));
        const located = rows.map((r) => ({ r, h: rowHierarchy(r, hier.get(Number(r.puesto_id))) }));
        const kept = p.scope ? located.filter((x) => matchesScope(x.h, p.scope!)) : located;
        const extras = await loadExtras(db, kept);
        return kept.map((x, i) => mapVulnerabilidadRow(x.r, extras[i]));
    },
};
