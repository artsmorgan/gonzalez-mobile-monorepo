import { queryProductoNoConformeRows } from "../../reports-functions/productoNoConformeReport";
import type { OutRow } from "../listing";
import { fmtDt } from "../mappers";
import { addDays } from "../params";
import { matchesScope } from "../scope";
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

/** Nombre de un nodo de la estructura (la consulta devuelve el id como texto si no lo encuentra). */
function nodo(nombre: unknown, id: unknown): string | null {
    if (!(Number(id) > 0)) return null;
    return text(nombre, 200);
}

/**
 * Fila de `queryProductoNoConformeRows` → fila plana. Se omiten a propósito las firmas (`firma_responsable`,
 * `firma_persona_identifico_pnc`, `firma_persona_origino_pnc` y sus `*_data_uri`): son imágenes.
 */
export function mapProductoNoConformeRow(r: any): OutRow {
    return {
        id: Number(r.id),
        creado: fmtDt(r.created_at),
        fecha_identificacion: fmtDt(r.fecha_identificacion),
        empresa: nodo(r.empresa_nombre, r.empresa_id),
        cliente: nodo(r.cliente_nombre, r.cliente_id),
        division: nodo(r.division_nombre, r.division_id),
        contrato: nodo(r.contrato_nombre, r.contrato_id),
        sucursal: nodo(r.corpo_nombre, r.corpo_id),
        puesto: nodo(r.puesto_nombre, r.puesto_id),
        tipo_servicio: text(r.tipo_servicio_no_conforme, 200),
        responsable_cuenta: text(r.responsable_cuenta, 200),
        persona_identifico: text(r.persona_identifico_pnc, 200),
        persona_origino: text(r.persona_origino_pnc, 200),
        descripcion: text(r.descripcion),
        accion_implementada: text(r.accion_implementada),
        fecha_solucion: fmtDt(r.fecha_solucion),
        responsable_aprobar: text(r.responsable_aprobar, 200),
        creado_por: text(r.created_by_nombre, 200),
    };
}

/** Producto no conforme (`c_producto_no_conforme`). Cada fila trae sus ids de empresa/cliente/división/contrato/corpo/puesto. */
export const productoNoConforme: GuardifyReportModule = {
    id: "producto_no_conforme",
    supportsScope: true,
    searchKeys: ["descripcion", "accion_implementada", "tipo_servicio", "persona_identifico", "persona_origino", "responsable_cuenta", "creado_por", "puesto", "sucursal"],
    filterKeys: ["empresa", "cliente", "division", "contrato", "sucursal", "puesto", "tipo_servicio"],
    sortKeys: ["creado", "fecha_identificacion", "fecha_solucion", "empresa", "cliente", "division", "contrato", "sucursal", "puesto", "tipo_servicio", "responsable_cuenta", "creado_por"],
    defaultSort: "creado",
    async load(db, p) {
        const rows = await queryProductoNoConformeRows(db, { creadoDesde: `${p.from}T00:00:00`, creadoHasta: `${addDays(p.to, -1)}T23:59:59` }, "fecha_identificacion");
        const scope = p.scope;
        return rows
            .filter((r: any) => {
                const d = fmtDt(r.created_at)?.slice(0, 10);
                return !!d && d >= p.from && d < p.to;
            })
            .filter(
                (r: any) =>
                    !scope ||
                    matchesScope({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }, scope),
            )
            .map(mapProductoNoConformeRow);
    },
};
