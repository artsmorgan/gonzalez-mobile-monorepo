import { normalizeDocumentosEntregadosFilters, queryDocumentosEntregadosRows } from "../../reports-functions/documentosEntregadosReport";
import type { OutRow } from "../listing";
import { fmtDt } from "../mappers";
import { addDays } from "../params";
import { matchesScope } from "../scope";
import type { GuardifyReportModule } from "../types";

const txt = (v: unknown): string | null => {
    const s = String(v ?? "").trim();
    return s ? s : null;
};
const short = (v: unknown, max = 500): string | null => {
    const s = txt(v);
    return s ? s.slice(0, max) : null;
};
/** La consulta original rellena con el id cuando no encuentra el nombre (y los registros viejos traen 0): se expone como vacío. */
const nameOrNull = (v: unknown, id: unknown): string | null => {
    const s = txt(v);
    return !s || s === "0" || s === String(id) ? null : s;
};
const day = (d: unknown): string | null => {
    const s = fmtDt(d as any);
    return s ? `${s.slice(0, 10)}T00:00:00` : null;
};

/** Documentos entregados al cliente. Nunca expone las firmas (`firma_representante_cliente`, `firma_responsable`). */
export function mapDocumentoEntregadoRow(r: any): OutRow {
    return {
        id: Number(r.id),
        fecha: day(r.fecha),
        empresa: nameOrNull(r.empresa_nombre, r.empresa_id),
        cliente: nameOrNull(r.cliente_nombre, r.cliente_id),
        division: nameOrNull(r.division_nombre, r.division_id),
        contrato: nameOrNull(r.contrato_nombre, r.contrato_id),
        sucursal: nameOrNull(r.corpo_nombre, r.corpo_id),
        puesto: nameOrNull(r.puesto_nombre, r.puesto_id),
        tipo_documento: txt(r.tipo_documento),
        oficial_entrega: txt(r.nombre_oficial_entrega),
        oficial_recibe: txt(r.nombre_oficial_recibe),
        descripcion: short(r.descripcion),
    };
}

/** Documentos entregados (`e_control_documento_entregado_cliente`). Las filas traen los ids de su ubicación en la estructura. */
export const documentosEntregados: GuardifyReportModule = {
    id: "documentos_entregados",
    supportsScope: true,
    searchKeys: ["cliente", "sucursal", "puesto", "tipo_documento", "oficial_entrega", "oficial_recibe", "descripcion"],
    filterKeys: ["tipo_documento", "empresa", "cliente", "contrato", "sucursal", "puesto"],
    sortKeys: ["fecha", "empresa", "cliente", "contrato", "sucursal", "puesto", "tipo_documento", "oficial_entrega", "oficial_recibe"],
    defaultSort: "fecha",
    async load(db, p) {
        const filters = normalizeDocumentosEntregadosFilters({ creadoDesde: `${addDays(p.from, -1)}T00:00:00`, creadoHasta: `${p.to}T23:59:59` });
        const rows = await queryDocumentosEntregadosRows(db, filters, "fecha");
        const scope = p.scope;
        return rows
            .filter((r: any) => {
                const d = day(r.fecha)?.slice(0, 10);
                return !!d && d >= p.from && d < p.to;
            })
            .filter((r: any) => !scope || matchesScope({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }, scope))
            .map(mapDocumentoEntregadoRow);
    },
};
