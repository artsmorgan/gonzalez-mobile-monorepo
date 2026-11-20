import { queryCambiosUbicacionPuestoRows } from "../../reports-functions/cambiosUbicacionPuestoReport";
import type { OutRow } from "../listing";
import { fmtDt } from "../mappers";
import { addDays } from "../params";
import { cambiosUbicacionPuestoForm } from "./cambiosUbicacionPuestoForm";
import { matchesScope } from "../scope";
import type { GuardifyReportModule } from "../types";

const txt = (v: unknown): string | null => {
    const s = String(v ?? "").trim();
    return s ? s : null;
};

/** La consulta original rellena con «—» o con el id cuando no encuentra el nombre: eso se expone como vacío. */
const placeholderToNull = (v: unknown, id?: unknown): string | null => {
    const s = txt(v);
    if (!s || s === "—" || s === "0") return null;
    if (id != null && s === String(id)) return null;
    return s;
};

/** Coordenada (texto en la tabla) como número; null si está vacía, no es numérica o queda fuera de rango. */
export function coordenada(v: unknown, max: 90 | 180): number | null {
    if (txt(v) == null) return null;
    const n = Number(v);
    return Number.isFinite(n) && Math.abs(n) <= max ? n : null;
}

/** Distancia en metros entre dos pares de coordenadas (texto); null si falta alguna. */
function metrosEntre(lat1: unknown, lng1: unknown, lat2: unknown, lng2: unknown): number | null {
    const [a, b, c, d] = [lat1, lng1, lat2, lng2].map((x) => (txt(x) == null ? NaN : Number(x)));
    if (![a, b, c, d].every((n) => Number.isFinite(n))) return null;
    if (Math.abs(a!) > 90 || Math.abs(c!) > 90 || Math.abs(b!) > 180 || Math.abs(d!) > 180) return null;
    const rad = Math.PI / 180;
    const dLat = (c! - a!) * rad, dLng = (d! - b!) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a! * rad) * Math.cos(c! * rad) * Math.sin(dLng / 2) ** 2;
    return Math.round(2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h))));
}

/**
 * Cambios en la ubicación del puesto (`c_ubicacion_puesto_registro_cambios`). `latitud` / `longitud` son la ubicación NUEVA (numéricas, vacías si
 * no hay o no son válidas) y `latitud_anterior` / `longitud_anterior` la que tenía el puesto. Decisión del cliente (20 oct 2026, issue #137):
 * las coordenadas se exponen a quien ve el reporte (se guardan por cada acción y se muestran en el mapa en vivo de Guardify).
 * Cada fila es un evento que no se edita: la tabla no guarda `updated_at`/`updated_by` ni historial, así que `modificado` y
 * `modificado_por` salen siempre vacíos.
 */
export function mapCambioUbicacionPuestoRow(r: any): OutRow {
    return {
        id: Number(r.id),
        empresa: placeholderToNull(r.empresa_nombre),
        cliente: placeholderToNull(r.cliente_nombre),
        division: placeholderToNull(r.division_nombre),
        contrato: placeholderToNull(r.contrato_nombre),
        sucursal: placeholderToNull(r.corpo_nombre),
        puesto: placeholderToNull(r.puesto_nombre, r.puesto_id),
        creado: fmtDt(r.created_at),
        creado_por: placeholderToNull(r.responsable_nombre, r.created_by),
        modificado: (r as any).updated_at ? fmtDt((r as any).updated_at) : (null),
        modificado_por: (r as any).audit_modificado_por ?? (null),
        tenia_ubicacion: txt(r.latitud_anterior) && txt(r.longitud_anterior) ? "Sí" : "No",
        latitud: coordenada(r.latitud_nueva, 90),
        longitud: coordenada(r.longitud_nueva, 180),
        latitud_anterior: coordenada(r.latitud_anterior, 90),
        longitud_anterior: coordenada(r.longitud_anterior, 180),
        metros: metrosEntre(r.latitud_anterior, r.longitud_anterior, r.latitud_nueva, r.longitud_nueva),
    };
}

/**
 * Cambios en ubicación del puesto. El periodo se aplica a `creado` (`created_at`, la «Fecha» del Excel). `creado_por` (código - nombre)
 * es quien registró el cambio (`created_by`). La consulta ya trae la ubicación completa del puesto en la estructura
 * (empresa, cliente, división, contrato, sucursal), así que admite alcance por unidad.
 */
// El rango se amplía un día por lado en la consulta (la zona horaria del servidor puede correr los límites) y se recorta exacto aquí.
export const cambiosUbicacionPuesto: GuardifyReportModule = {
    id: "cambios_ubicacion_puesto",
    supportsScope: true,
    searchKeys: ["puesto", "sucursal", "contrato", "cliente", "creado_por"],
    filterKeys: ["empresa", "cliente", "division", "contrato", "sucursal", "puesto", "creado", "creado_por", "tenia_ubicacion", "latitud", "longitud", "latitud_anterior", "longitud_anterior"],
    sortKeys: ["creado", "empresa", "cliente", "contrato", "sucursal", "puesto", "creado_por", "metros", "latitud", "longitud"],
    defaultSort: "creado",
    form: cambiosUbicacionPuestoForm,
    async load(db, p) {
        const rows = await queryCambiosUbicacionPuestoRows(db, { creadoDesde: `${addDays(p.from, -1)}T00:00:00`, creadoHasta: `${p.to}T23:59:59` }, "created_at");
        const scope = p.scope;
        return rows
            .filter((r: any) => {
                const f = fmtDt(r.created_at);
                return !!f && f.slice(0, 10) >= p.from && f.slice(0, 10) < p.to;
            })
            .filter((r: any) => !scope || matchesScope({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }, scope))
            .map(mapCambioUbicacionPuestoRow);
    },
};
