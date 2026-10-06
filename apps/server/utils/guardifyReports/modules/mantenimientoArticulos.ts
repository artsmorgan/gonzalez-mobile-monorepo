import {
    queryMantenimientoArticulosRows,
    type MantenimientoArticuloReportRow,
    type MantenimientoArticulosModuleFilters,
} from "../../reports-functions/mantenimientoArticulosReport";
import type { ReportDataAccess } from "../../reportDynamicPrisma";
import type { OutRow } from "../listing";
import { fmtDt } from "../mappers";
import { addDays, type ReportParams } from "../params";
import { matchesScope, type Nivel } from "../scope";
import type { GuardifyReportModule } from "../types";

const MAX_TEXT = 500;

/** ¿Parece una imagen incrustada (data URI o base64 largo)? */
function esImagen(s: string): boolean {
    if (/^data:[a-z]+\/[^;,]+[;,]/i.test(s) || /^(iVBORw0KGgo|\/9j\/|R0lGOD|UklGR|PHN2Zy)/.test(s)) return true;
    const head = s.slice(0, 200);
    return s.length > 1000 && /^[A-Za-z0-9+/=_-]+$/.test(head) && /[A-Z]/.test(head) && /[a-z]/.test(head) && /\d/.test(head);
}

/** Texto libre recortado a 500 caracteres; descarta lo que parezca una imagen/base64. */
function text(v: unknown, max = MAX_TEXT): string | null {
    const s = String(v ?? "").trim();
    if (!s) return null;
    if (esImagen(s)) return null;
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

const num = (v: unknown): number | null => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

/**
 * Fila de `queryMantenimientoArticulosRows` → fila plana. Se omiten ids internos de plan/asignación, el formulario de
 * mantenimiento de armas (texto estructurado largo) y el contenido de los archivos adjuntos (solo se cuenta cuántos hay).
 */
export function mapMantenimientoArticuloRow(r: MantenimientoArticuloReportRow): OutRow {
    return {
        id: Number(r.id),
        creado: fmtDt(r.created_at),
        empresa: text(r.empresa_txt, 200),
        cliente: text(r.cliente_txt, 200),
        division: text(r.division_txt, 200),
        contrato: text(r.contrato_txt, 200),
        sucursal: text(r.corpo_txt, 200),
        puesto: text(r.puesto_txt, 200),
        origen: text(r.origen, 50),
        articulo: text(r.articulo_nombre, 200),
        estado: text(r.estado, 55),
        accion: text(r.accion, 55),
        cantidad_necesaria: num(r.cantidad_necesaria),
        cantidad_real: num(r.cantidad_real),
        observaciones: text(r.observaciones),
        fecha_inicio: fmtDt(r.fecha_inicio),
        fecha_solucion: fmtDt(r.fecha_solucion),
        fecha_fin: fmtDt(r.fecha_fin),
        fecha_salida: fmtDt(r.fecha_salida),
        fecha_entrada: fmtDt(r.fecha_entrada),
        tipo: text(r.tipo, 200),
        marca: text(r.marca, 200),
        modelo: text(r.modelo, 200),
        serie_placa: text(r.serie_placa, 200),
        marca_nuevo: text(r.marca_nuevo, 200),
        modelo_nuevo: text(r.modelo_nuevo, 200),
        serie_placa_nuevo: text(r.serie_placa_nuevo, 200),
        categoria: text(r.categoria, 200),
        tipo_mantenimiento: text(r.tipo_mantenimiento_art, 200),
        categoria_mantenimiento: text(r.categoria_mantinimiento, 200),
        kilometraje: num(r.kilometraje),
        detalle: text(r.detalle),
        proveedor: text(r.proveedor, 200),
        boleta_proveeduria: text(r.numero_boleta_proveeduria, 200),
        numero_fc: text(r.numero_fc, 200),
        costo_mano_obra: num(r.costo_mo),
        costo_insumos: num(r.costo_i),
        iva: num(r.iva),
        costo_total: num(r.costo_total),
        reincidencia_30_dias: r.reincidencia_treinta_dias_txt === "Sí" || r.reincidencia_treinta_dias_txt === "No" ? r.reincidencia_treinta_dias_txt : null,
        tipo_mantenimiento_reincidencia: text(r.tipo_mant_art_reincid, 200),
        adjuntos: num(r.archivos_adjuntos_count) ?? 0,
        actualizado: fmtDt(r.updated_at),
    };
}

const FILTRO_POR_NIVEL: Record<Nivel, "empresaIds" | "clienteIds" | "divisionIds" | "contratoIds" | "corpoIds" | "puestoIds"> = {
    empresa: "empresaIds",
    cliente: "clienteIds",
    division: "divisionIds",
    contrato: "contratoIds",
    corpo: "corpoIds",
    puesto: "puestoIds",
};

type QueryFn = (db: ReportDataAccess, f: MantenimientoArticulosModuleFilters, order: "puesto_id") => Promise<MantenimientoArticuloReportRow[]>;

/**
 * Carga del reporte (la consulta se puede inyectar para probar el alcance sin base de datos).
 * Sin alcance: una consulta del periodo. Con alcance: una consulta por cada nodo (la consulta de la app limita a 5 000
 * puestos, así que acotarla por nodo evita perder filas), se unen sin repetir y se vuelve a filtrar con `matchesScope`.
 */
export async function loadMantenimientoArticulos(db: ReportDataAccess, p: ReportParams, query: QueryFn = queryMantenimientoArticulosRows): Promise<OutRow[]> {
    const base: MantenimientoArticulosModuleFilters = { creadoDesde: `${p.from}T00:00:00`, creadoHasta: `${addDays(p.to, -1)}T23:59:59` };
    const scope = p.scope;
    let rows: MantenimientoArticuloReportRow[];
    if (!scope) {
        rows = await query(db, base, "puesto_id");
    } else {
        const byId = new Map<number, MantenimientoArticuloReportRow>();
        for (const item of scope) {
            for (const r of await query(db, { ...base, [FILTRO_POR_NIVEL[item.nivel]]: [item.id] }, "puesto_id")) byId.set(Number(r.id), r);
        }
        rows = [...byId.values()].filter((r) =>
            matchesScope({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }, scope),
        );
    }
    return rows
        .filter((r) => {
            const d = fmtDt(r.created_at)?.slice(0, 10);
            return !!d && d >= p.from && d < p.to;
        })
        .map(mapMantenimientoArticuloRow);
}

/**
 * Mantenimiento de artículos (`c_articulo_mantenimiento`). La fila se ubica por el puesto del artículo (plan o asignado),
 * del que la consulta ya deduce empresa/cliente/división/contrato/corpo.
 */
export const mantenimientoArticulos: GuardifyReportModule = {
    id: "mantenimiento_articulos",
    supportsScope: true,
    searchKeys: ["articulo", "puesto", "sucursal", "contrato", "proveedor", "marca", "modelo", "serie_placa", "observaciones", "detalle"],
    filterKeys: ["empresa", "cliente", "division", "contrato", "sucursal", "puesto", "origen", "estado", "accion", "categoria", "reincidencia_30_dias"],
    sortKeys: [
        "creado", "empresa", "cliente", "division", "contrato", "sucursal", "puesto", "articulo", "estado", "accion",
        "fecha_inicio", "fecha_solucion", "fecha_fin", "proveedor", "costo_total", "actualizado",
    ],
    defaultSort: "creado",
    load: (db, p) => loadMantenimientoArticulos(db, p),
};
