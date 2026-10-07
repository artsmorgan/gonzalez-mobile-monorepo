import { queryActaEntregaProductos } from "../../reports-functions/actaEntregaProductos";
import { ejecutivoPorCorpo } from "../enrich";
import type { OutRow } from "../listing";
import { fmtDt } from "../mappers";
import { addDays } from "../params";
import { matchesScope } from "../scope";
import type { GuardifyReportModule } from "../types";

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
 * `ejecutivo` = ejecutivo de cuenta de la sucursal (se carga en lote en `load`).
 */
export function mapActaEntregaRow(r: any, ejecutivo: string | null = null): OutRow {
    const items = parseDetalle(r.detalle);
    const descripcion = items.map((i) => txt(i?.descripcion)).filter(Boolean).join("; ");
    return {
        id: Number(r.id),
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
    };
}

/**
 * Acta de entrega de productos. Periodo: `fecha` (la fecha del acta). La tabla no guarda consecutivo ni quién registró el acta.
 * Cada fila trae empresa, cliente, división, contrato, sucursal y puesto: admite alcance. */
export const actaEntregaProductos: GuardifyReportModule = {
    id: "acta_entrega_productos",
    supportsScope: true,
    searchKeys: ["nombre_entrega", "cedula_entrega", "nombre_recibe", "cedula_recibe", "puesto", "sucursal", "descripcion"],
    filterKeys: ["tipo_entrega", "mensual", "empresa", "cliente", "division", "contrato", "sucursal", "puesto"],
    sortKeys: ["fecha", "tipo_entrega", "nombre_entrega", "cedula_entrega", "nombre_recibe", "cedula_recibe", "empresa", "cliente", "contrato", "sucursal", "puesto", "articulos"],
    defaultSort: "fecha",
    async load(db, p) {
        const rows = await queryActaEntregaProductos(db, { creadoDesde: `${p.from}T00:00:00`, creadoHasta: `${addDays(p.to, -1)}T23:59:59` }, "fecha");
        const scope = p.scope;
        const kept = !scope
            ? rows
            : rows.filter((r: any) => matchesScope({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }, scope));
        const ejecutivos = await ejecutivoPorCorpo(db, kept.map((r: any) => r.corpo_id));
        return kept.map((r: any) => mapActaEntregaRow(r, ejecutivos.get(Number(r.corpo_id)) ?? null));
    },
};
