import type { ReportDataAccess } from "../../reportDynamicPrisma";
import { ejecutivoPorCorpo, nombresEmpleado, usuarioInserta } from "../enrich";
import type { OutRow } from "../listing";
import { fmtDt } from "../mappers";
import { addDays } from "../params";
import { entregaPuestoForm } from "./entregaPuestoForm";
import { loadPuestoHierarchy, matchesScope, type ScopeItem } from "../scope";
import type { GuardifyReportModule } from "../types";

const MAX_TEXT = 500;

const txt = (v: unknown): string | null => {
    const s = String(v ?? "").trim();
    return s ? s : null;
};
const clip = (v: unknown): string | null => {
    const s = txt(v);
    return s && s.length > MAX_TEXT ? s.slice(0, MAX_TEXT) : s;
};
/** El reporte rellena el nombre con el id cuando no encuentra el registro: eso no es un nombre. */
const place = (id: unknown, name: unknown): string | null => {
    const s = txt(name);
    return !s || s === String(id ?? "") ? null : s;
};

/** `YYYY-MM-DD` de una columna de fecha (Date o texto ISO). */
function dayOf(v: unknown): string | null {
    const s = fmtDt(v as any);
    return s ? s.slice(0, 10) : null;
}

/** `HH:mm` de una columna `TIME` (Prisma la entrega como Date 1970-01-01 en UTC; por API puede llegar como texto). */
function hmOf(v: unknown): string | null {
    if (v == null || v === "") return null;
    if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : `${String(v.getUTCHours()).padStart(2, "0")}:${String(v.getUTCMinutes()).padStart(2, "0")}`;
    const s = String(v).trim();
    const m = /(?:^|T)(\d{2}):(\d{2})/.exec(s);
    return m ? `${m[1]}:${m[2]}` : null;
}

/** Fecha + hora separadas en la base → `YYYY-MM-DDTHH:mm:00` (sin fecha no hay momento que mostrar). */
function joinDateTime(date: unknown, time: unknown): string | null {
    const d = dayOf(date);
    if (!d) return null;
    return `${d}T${hmOf(time) ?? "00:00"}:00`;
}

function turno(v: unknown): string | null {
    const t = txt(v);
    if (!t) return null;
    const u = t.toUpperCase();
    return u === "D" ? "Diurno" : u === "M" ? "Mixto" : u === "N" ? "Nocturno" : t;
}

function parseArticulos(raw: unknown): Array<Record<string, unknown>> {
    try {
        const a = JSON.parse(String(raw ?? ""));
        return Array.isArray(a) ? a.filter((x) => x && typeof x === "object") : [];
    } catch {
        return [];
    }
}

/** Datos que no vienen en la fila y se cargan por lote: ejecutivo de cuenta de la sucursal y quien registró la entrega. */
export type EntregaExtra = { ejecutivo?: string | null; usuario?: string | null };

/**
 * Entrega de puesto (`e_registro_entrega_puesto`) a fila plana. Se omiten a propósito las firmas, los ids de marca y el
 * detalle de los artículos (solo se cuentan: cuántos y cuántos con novedad, es decir «Malo» o «No está»).
 */
export function mapEntregaPuestoRow(r: any, x: EntregaExtra = {}): OutRow {
    const arts = parseArticulos(r.articulos_puesto);
    const conNovedad = arts.filter((a) => /^(malo|no est[aá])$/i.test(String(a.estado ?? "").trim())).length;
    return {
        id: Number(r.id),
        creado: fmtDt(r.created_at),
        empresa: place(r.empresa_id_resolved, r.empresa_nombre),
        cliente: place(r.cliente_id, r.cliente_nombre),
        division: place(r.e_estructura_sucursal?.e_estructura_contrato?.division_id, r.division_nombre),
        contrato: txt(r.contrato_nombre),
        sucursal: place(r.corpo_id, r.corpo_nombre),
        puesto: place(r.puesto_id, r.puesto_nombre),
        oficial_entrega: txt(r.oficial_entrega),
        entrada_entrega: joinDateTime(r.fecha_entrada_entrega, r.hora_entrada_entrega),
        salida_entrega: joinDateTime(r.fecha_salida_entrega, r.hora_salida_entrega),
        turno_entrega: turno(r.turno_entrega),
        oficial_recibe: txt(r.oficial_recibe),
        entrada_recibe: joinDateTime(r.fecha_entrada_recibe, r.hora_entrada_recibe),
        salida_recibe: joinDateTime(r.fecha_salida_recibe, r.hora_salida_recibe),
        turno_recibe: turno(r.turno_recibe),
        articulos: arts.length,
        articulos_con_novedad: conNovedad,
        observaciones: clip(r.observaciones),
        ejecutivo_cuenta: txt(x.ejecutivo),
        usuario_inserta: txt(x.usuario),
    };
}

/** Ejecutivo de cuenta por sucursal y nombre de quien registró (`created_by` = id de empleado), ambos por lote. */
export async function mapEntregasConExtras(db: any, rows: any[]): Promise<OutRow[]> {
    const ejecutivos = await ejecutivoPorCorpo(db, rows.map((r) => r.corpo_id));
    const nombres = await nombresEmpleado(db, rows.map((r) => r.created_by));
    return rows.map((r) => mapEntregaPuestoRow(r, { ejecutivo: ejecutivos.get(Number(r.corpo_id)) ?? null, usuario: usuarioInserta(r.created_by, nombres) }));
}

/**
 * La fila solo trae cliente, corpo y puesto (la empresa y el contrato se deducen), así que el alcance se resuelve con la
 * ubicación completa del puesto, igual que la estructura que Guardify consulta.
 */
export async function filterEntregasByScope(db: ReportDataAccess, rows: any[], scope: ScopeItem[] | null): Promise<any[]> {
    if (!scope) return rows;
    const hier = await loadPuestoHierarchy(db as any, rows.map((r) => Number(r.puesto_id)));
    return rows.filter((r) => {
        const h = hier.get(Number(r.puesto_id));
        return !!h && matchesScope(h, scope);
    });
}

/**
 * Entrega de puesto. El periodo es sobre la fecha de creación del registro (`created_at`): es la «Fecha» del Excel y el filtro
 * «Creado desde/hasta» de la app (la columna `creado`). Los filtros «de quien entrega/recibe» (fecha y hora) usan la columna de entrada
 * de cada uno (`entrada_entrega`, `entrada_recibe`).
 */
export const entregaPuesto: GuardifyReportModule = {
    id: "entrega_puesto",
    supportsScope: true,
    searchKeys: ["oficial_entrega", "oficial_recibe", "puesto", "sucursal", "cliente", "observaciones"],
    filterKeys: ["empresa", "cliente", "division", "contrato", "sucursal", "puesto", "turno_entrega", "turno_recibe", "oficial_entrega", "oficial_recibe", "ejecutivo_cuenta", "usuario_inserta"],
    sortKeys: ["creado", "empresa", "cliente", "contrato", "sucursal", "puesto", "oficial_entrega", "oficial_recibe", "entrada_entrega", "salida_entrega", "entrada_recibe", "salida_recibe", "articulos", "articulos_con_novedad", "ejecutivo_cuenta", "usuario_inserta"],
    defaultSort: "creado",
    form: entregaPuestoForm,
    async load(db, p) {
        // Import perezoso: el módulo de consulta arrastra exceljs y Prisma, que no hacen falta para mapear ni para probar.
        const { queryEntregaPuestoRows } = await import("../../reports-functions/entregaPuestoReport");
        const rows = await queryEntregaPuestoRows(db, { creadoDesde: `${p.from}T00:00:00`, creadoHasta: `${addDays(p.to, -1)}T23:59:59` }, "fecha");
        return mapEntregasConExtras(db, await filterEntregasByScope(db, rows, p.scope));
    },
};
