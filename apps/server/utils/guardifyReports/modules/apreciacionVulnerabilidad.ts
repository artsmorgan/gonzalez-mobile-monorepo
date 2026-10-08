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
export type VulnerabilidadExtras = { ejecutivo_cuenta?: string | null; division?: string | null; usuario_inserta?: string | null };

/**
 * Fila de `queryVulnerabilidadRows` (ya con nombres de estructura) → fila plana.
 * Nunca se exponen las firmas, el `enlace` ni las fotos; de la boleta solo se informa el nivel de vulnerabilidad,
 * cuántas secciones tiene y sus métricas.
 * `extras`: ejecutivo de cuenta de la sucursal, división (si el registro antiguo no la trae) y quién lo registró.
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
    const incomplete = rows.filter((r) => !(Number(r.empresa_id) > 0 && Number(r.division_id) > 0 && Number(r.contrato_id) > 0));
    const hier = await loadPuestoHierarchy(db, incomplete.map((r) => Number(r.puesto_id)));
    return rows.filter((r) => matchesScope(rowHierarchy(r, hier.get(Number(r.puesto_id))), scope));
}

/** Ejecutivo de cuenta (por la sucursal), división de los registros antiguos sin división (por el puesto) y quién registró cada boleta, en lote. */
async function loadExtras(db: any, items: Array<{ r: any; h: Hierarchy }>): Promise<VulnerabilidadExtras[]> {
    const [ejecutivos, divisiones, creadores] = await Promise.all([
        ejecutivoPorCorpo(db, items.map((x) => x.h.corpo)),
        findByIds<{ nombre: string | null }>(db, "n_division", items.filter((x) => !nameOrNull(x.r.division_nombre, x.r.division_id)).map((x) => x.h.division), { nombre: true }),
        creadoresPorCambio(db, "c_boleta_apreciacion_vulnerabilidad", items.map((x) => x.r.id)),
    ]);
    const nombres = await nombresEmpleado(db, [...creadores.values()]);
    return items.map(({ r, h }) => ({
        ejecutivo_cuenta: ejecutivos.get(Number(h.corpo)) ?? null,
        division: txt(divisiones.get(Number(h.division))?.nombre),
        usuario_inserta: nombres.get(creadores.get(Number(r.id)) ?? 0) ?? null,
    }));
}

/**
 * Apreciación de vulnerabilidad (`c_boleta_apreciacion_vulnerabilidad`). Periodo por `fecha` de la boleta (la «Fecha» del Excel), como el filtro de la app.
 * La tabla no guarda quién la registró: «Usuario que lo registró» sale del primer cambio guardado (`c_cambios_apps_modules`, `__created__`), como lo muestra la app.
 */
export const apreciacionVulnerabilidad: GuardifyReportModule = {
    id: "apreciacion_vulnerabilidad",
    supportsScope: true,
    searchKeys: ["solicitante", "puesto", "sucursal", "contrato", "cliente"],
    filterKeys: ["nivel_vulnerabilidad", "empresa", "cliente", "division", "contrato", "sucursal", "puesto", "ejecutivo_cuenta", "usuario_inserta"],
    sortKeys: ["fecha", "solicitante", "nivel_vulnerabilidad", "secciones", "empresa", "cliente", "division", "contrato", "sucursal", "puesto", "ejecutivo_cuenta", "usuario_inserta"],
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
