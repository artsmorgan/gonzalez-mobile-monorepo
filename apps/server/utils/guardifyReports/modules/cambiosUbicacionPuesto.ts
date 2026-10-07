import { queryCambiosUbicacionPuestoRows } from "../../reports-functions/cambiosUbicacionPuestoReport";
import type { OutRow } from "../listing";
import { fmtDt } from "../mappers";
import { addDays } from "../params";
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

/** Distancia en metros entre dos pares de coordenadas (texto). Las coordenadas NO se exponen: solo cuánto se movió el puesto. */
function metrosEntre(lat1: unknown, lng1: unknown, lat2: unknown, lng2: unknown): number | null {
    const [a, b, c, d] = [lat1, lng1, lat2, lng2].map((x) => (txt(x) == null ? NaN : Number(x)));
    if (![a, b, c, d].every((n) => Number.isFinite(n))) return null;
    if (Math.abs(a!) > 90 || Math.abs(c!) > 90 || Math.abs(b!) > 180 || Math.abs(d!) > 180) return null;
    const rad = Math.PI / 180;
    const dLat = (c! - a!) * rad, dLng = (d! - b!) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a! * rad) * Math.cos(c! * rad) * Math.sin(dLng / 2) ** 2;
    return Math.round(2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h))));
}

/** Cambios en la ubicación del puesto (`c_ubicacion_puesto_registro_cambios`). Nunca expone latitud ni longitud. */
export function mapCambioUbicacionPuestoRow(r: any): OutRow {
    return {
        id: Number(r.id),
        fecha: fmtDt(r.created_at),
        empresa: placeholderToNull(r.empresa_nombre),
        cliente: placeholderToNull(r.cliente_nombre),
        division: placeholderToNull(r.division_nombre),
        contrato: placeholderToNull(r.contrato_nombre),
        sucursal: placeholderToNull(r.corpo_nombre),
        puesto: placeholderToNull(r.puesto_nombre, r.puesto_id),
        responsable: placeholderToNull(r.responsable_nombre, r.created_by),
        tenia_ubicacion: txt(r.latitud_anterior) && txt(r.longitud_anterior) ? "Sí" : "No",
        metros: metrosEntre(r.latitud_anterior, r.longitud_anterior, r.latitud_nueva, r.longitud_nueva),
    };
}

/**
 * Cambios en ubicación del puesto. El periodo se aplica a `fecha` (`created_at`, la «Fecha» del Excel). `responsable` (código - nombre)
 * es quien registró el cambio (`created_by`): es el «Usuario inserta». Latitud y longitud no se exponen (decisión de seguridad). La consulta ya trae la ubicación completa del puesto en la estructura
 * (empresa, cliente, división, contrato, sucursal), así que admite alcance por unidad.
 */
// El rango se amplía un día por lado en la consulta (la zona horaria del servidor puede correr los límites) y se recorta exacto aquí.
export const cambiosUbicacionPuesto: GuardifyReportModule = {
    id: "cambios_ubicacion_puesto",
    supportsScope: true,
    searchKeys: ["puesto", "sucursal", "contrato", "cliente", "responsable"],
    filterKeys: ["empresa", "cliente", "division", "contrato", "sucursal", "puesto", "responsable", "tenia_ubicacion"],
    sortKeys: ["fecha", "empresa", "cliente", "contrato", "sucursal", "puesto", "responsable", "metros"],
    defaultSort: "fecha",
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
