import { queryMutuosAcuerdosRows } from "../../reports-functions/mutuosAcuerdosReport";
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

/** Nombre de un nodo/valor ligado a un id (la consulta devuelve el id como texto si no lo encuentra). */
function nodo(nombre: unknown, id: unknown): string | null {
    if (!(Number(id) > 0)) return null;
    return text(nombre, 200);
}

/** «Sí»/«No» solo si hay un valor; el reporte original deja vacío lo que no se respondió. */
function siNo(v: unknown): string | null {
    const s = String(v ?? "").trim();
    return s === "Sí" || s === "No" ? s : null;
}

/**
 * Fila de `queryMutuosAcuerdosRows` → fila plana. Se omiten a propósito todas las firmas
 * (`firma_ejecutivo_cuenta_manual`, `firma_ejecutivo_cuenta_digital`, `firma_responsable`, `firma_ausente_manual`,
 * `firma_reemplaza_manual`) y `file_name`; solo se indica si el ejecutivo tiene firma digital registrada.
 */
export function mapMutuoAcuerdoRow(r: any): OutRow {
    return {
        id: Number(r.id),
        creado: fmtDt(r.created_at),
        empresa: nodo(r.empresa_nombre, r.empresa_id),
        cliente: nodo(r.cliente_nombre, r.cliente_id),
        division: nodo(r.division_nombre, r.division_id),
        contrato: nodo(r.contrato_nombre, r.contrato_id),
        sucursal: nodo(r.corpo_nombre, r.corpo_id),
        puesto: nodo(r.puesto_nombre, r.puesto_id),
        plaza_ausente: nodo(r.plaza_ausente_txt, r.plazaAusente_id),
        plaza_reemplaza: nodo(r.plaza_reemplaza_txt, r.plazaReemplaza_id),
        ejecutivo: nodo(r.ejecutivo_nombre, r.ejecutivo_cuenta),
        oficial_ausente: text(r.empleado_ausente_txt, 200),
        oficial_reemplaza: text(r.empleado_reemplaza_txt, 200),
        marca_ausente: text(r.marca_ausente_txt, 200),
        marca_reemplaza: text(r.marca_reemplaza_txt, 200),
        ausente_acepta: siNo(r.ausente_acepta_txt),
        fecha_acepta_ausente: fmtDt(r.ausente_acepta_at),
        reemplaza_acepta: siNo(r.reemplaza_acepta_txt),
        fecha_acepta_reemplaza: fmtDt(r.reemplaza_acepta_at),
        motivo: text(r.motivo),
        estado: text(r.estado, 50)?.toLowerCase() ?? "pendiente",
        cambio_guardia: r.cambio_guardia_id == null ? null : Number(r.cambio_guardia_id),
        firma_digital: siNo(r.firma_digital_ejecutivo_txt),
        creado_por: nodo(r.created_by_txt, r.created_by),
    };
}

/**
 * Mutuos acuerdos (`e_mutuos_acuerdos`). Cada fila trae sus ids de empresa/cliente/división/contrato/corpo/puesto
 * (los registros antiguos pueden traerlos en 0: con un alcance pedido esas filas no se muestran).
 */
export const mutuosAcuerdos: GuardifyReportModule = {
    id: "mutuos_acuerdos",
    supportsScope: true,
    searchKeys: ["oficial_ausente", "oficial_reemplaza", "ejecutivo", "motivo", "puesto", "sucursal", "contrato", "creado_por"],
    filterKeys: ["empresa", "cliente", "division", "contrato", "sucursal", "puesto", "estado", "ausente_acepta", "reemplaza_acepta"],
    sortKeys: ["creado", "empresa", "cliente", "division", "contrato", "sucursal", "puesto", "ejecutivo", "oficial_ausente", "oficial_reemplaza", "estado", "creado_por"],
    defaultSort: "creado",
    async load(db, p) {
        const rows = await queryMutuosAcuerdosRows(db, { fechaReporteDesde: `${p.from} 00:00:00`, fechaReporteHasta: `${addDays(p.to, -1)} 23:59:59` }, "created_at");
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
            .map(mapMutuoAcuerdoRow);
    },
};
