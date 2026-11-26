import { queryActaEntregaProductos } from "../../reports-functions/actaEntregaProductos";
import { ejecutivoPorCorpo } from "../enrich";
import type { OutRow } from "../listing";
import { fmtDt } from "../mappers";
import { addDays } from "../params";
import { matchesScope } from "../scope";
import type { GuardifyReportModule } from "../types";
import { actaEntregaProductosForm } from "./actaEntregaProductosForm";
import { formatConsecutivoActa } from "../../consecutivoActa";
import { auditoriaPorHistorial, type AuditoriaHistorial } from "./auditoriaCambios";

const txt = (v: unknown): string | null => {
    const s = String(v ?? "").trim();
    return s ? s : null;
};
/** La consulta original usa el id como texto cuando no encuentra el nombre; eso no le sirve a nadie. */
const nameOrNull = (name: unknown, id: unknown): string | null => {
    const s = txt(name);
    return s && s !== String(id ?? "") ? s : null;
};

function parseDetalle(raw: unknown): Array<Record<string, unknown>> {
    if (!raw || String(raw).trim() === "") return [];
    try {
        const p = JSON.parse(String(raw));
        return Array.isArray(p) ? p : [];
    } catch {
        return [];
    }
}

const persona = (cedula: unknown, nombre: unknown): string | null => {
    const n = txt(nombre);
    if (!n) return null;
    const c = txt(cedula);
    return c ? `${c} - ${n}` : n;
};

/**
 * Acta de entrega de productos (`c_acta_entre_producto`). Nunca se exponen `firma_entrega` ni `firma_recibe` (imágenes).
 * `ejecutivo` = ejecutivo de cuenta de la sucursal (se carga en lote en `load`). `auditoria` = creado/creado_por/modificado/modificado_por del
 * historial de cambios (la tabla no guarda `created_at`, `created_by` ni `updated_*`; ver `auditoriaPorHistorial`).
 */
export function mapActaEntregaRow(r: any, ejecutivo: string | null = null, auditoria: AuditoriaHistorial | null = null): OutRow {
    const items = parseDetalle(r.detalle);
    const descripcion = items.map((i) => txt(i?.descripcion)).filter(Boolean).join("; ");
    return {
        id: Number(r.id),
        // Por empresa, desde 0001 (issue #138); null en actas que aún no se han numerado.
        consecutivo: formatConsecutivoActa(r.consecutivo),
        fecha: fmtDt(r.fecha),
        tipo_entrega: txt(r.tipo_entrega),
        mensual: txt(r.mensual),
        nombre_entrega: txt(r.nombre_entrega),
        cedula_entrega: txt(r.cedula_entrega),
        nombre_recibe: txt(r.nombre_recibe),
        cedula_recibe: txt(r.cedula_recibe),
        empresa: nameOrNull(r.empresa_nombre, r.empresa_id),
        cliente: nameOrNull(r.cliente_nombre, r.cliente_id),
        division: nameOrNull(r.division_nombre, r.division_id),
        contrato: nameOrNull(r.contrato_nombre, r.contrato_id),
        sucursal: nameOrNull(r.corpo_nombre, r.corpo_id),
        puesto: nameOrNull(r.puesto_nombre, r.puesto_id),
        articulos: items.length,
        descripcion: descripcion ? descripcion.slice(0, 500) : null,
        ejecutivo_cuenta: txt(ejecutivo),
        // Quienes intervienen, «cédula - nombre» de quien entrega y de quien recibe: el filtro «Empleado» busca por cédula o nombre en cualquiera de los dos.
        empleado: [persona(r.cedula_entrega, r.nombre_entrega), persona(r.cedula_recibe, r.nombre_recibe)].filter(Boolean).join(" · ").slice(0, 500) || null,
        creado: (r as any).created_at ? fmtDt((r as any).created_at) : (auditoria?.creado ?? null),
        creado_por: (r as any).audit_creado_por ?? (txt(auditoria?.creado_por)),
        modificado: (r as any).updated_at ? fmtDt((r as any).updated_at) : (auditoria?.modificado ?? null),
        modificado_por: (r as any).audit_modificado_por ?? (txt(auditoria?.modificado_por)),
    };
}

/**
 * Acta de entrega de productos. Periodo: `fecha` (la fecha del acta). `consecutivo` es el número del acta dentro de su empresa (0001, 0002…). `creado*` y `modificado*` salen de las columnas propias o, en actas anteriores a ellas, del historial de cambios (null si tampoco hay historial).
 * Cada fila trae empresa, cliente, división, contrato, sucursal y puesto: admite alcance. */
export const actaEntregaProductos: GuardifyReportModule = {
    id: "acta_entrega_productos",
    supportsScope: true,
    searchKeys: ["consecutivo", "nombre_entrega", "cedula_entrega", "nombre_recibe", "cedula_recibe", "puesto", "sucursal", "descripcion"],
    filterKeys: ["consecutivo", "tipo_entrega", "mensual", "empresa", "cliente", "division", "contrato", "sucursal", "puesto"],
    sortKeys: ["fecha", "consecutivo", "tipo_entrega", "nombre_entrega", "cedula_entrega", "nombre_recibe", "cedula_recibe", "empresa", "cliente", "contrato", "sucursal", "puesto", "articulos"],
    defaultSort: "fecha",
    form: actaEntregaProductosForm,
    async load(db, p) {
        const rows = await queryActaEntregaProductos(db, { creadoDesde: `${p.from}T00:00:00`, creadoHasta: `${addDays(p.to, -1)}T23:59:59` }, "fecha");
        const scope = p.scope;
        const kept = !scope
            ? rows
            : rows.filter((r: any) => matchesScope({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }, scope));
        const [ejecutivos, auditoria] = await Promise.all([ejecutivoPorCorpo(db, kept.map((r: any) => r.corpo_id)), auditoriaPorHistorial(db, "c_acta_entre_producto", kept.map((r: any) => Number(r.id)))]);
        return kept.map((r: any) => mapActaEntregaRow(r, ejecutivos.get(Number(r.corpo_id)) ?? null, auditoria.get(Number(r.id)) ?? null));
    },
};
