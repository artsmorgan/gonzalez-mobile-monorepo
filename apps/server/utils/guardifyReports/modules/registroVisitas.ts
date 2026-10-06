import { fmtDt } from "../mappers";
import type { OutRow } from "../listing";
import { addDays } from "../params";
import { matchesScope, type ScopeItem } from "../scope";
import type { GuardifyReportModule } from "../types";

const txt = (v: unknown, max = 500): string | null => {
    const s = String(v ?? "").trim();
    return s ? s.slice(0, max) : null;
};

/** Nombre de estructura; la consulta original rellena con el id (o «—») cuando no encuentra el registro: eso es «sin dato». */
const nombre = (v: unknown, id: unknown): string | null => {
    const s = txt(v);
    if (!s || s === "—" || s === String(id ?? "")) return null;
    return s;
};

/**
 * Registro de personas (visitantes). Se omiten a propósito `foto_cedula` (imagen de la cédula) y `firma_visitante`
 * (firma en base64); de los activos que ingresa el visitante solo se expone la cantidad.
 */
export function mapRegistroVisitaRow(r: any): OutRow {
    return {
        id: Number(r.id),
        entrada: fmtDt(r.hora_entrada),
        salida: fmtDt(r.hora_salida),
        visitante: txt(r.nombre),
        cedula: txt(r.cedula),
        funcionario: r.es_funcionario ? "Sí" : "No",
        motivo: txt(r.razon_visita),
        depto_visita: txt(r.dep_pers_visita),
        autoriza_salida: txt(r.pers_autoriza_salida),
        responsable: txt(r.responsable_label),
        empresa: nombre(r.empresa_nombre, r.empresa_id),
        cliente: nombre(r.e_estructura_cliente?.nombre, r.cliente_id),
        division: nombre(r.division_nombre, r.division_id),
        contrato: nombre(r.contrato_nombre, r.contrato_id),
        sucursal: nombre(r.e_estructura_sucursal?.nombre, r.corpo_id),
        puesto: nombre(r.e_estructura_puesto?.nombre, r.puesto_id),
        puesto_salida: txt(r.puesto_salida_nombre),
        activos: Array.isArray(r.e_activo_visitante) ? r.e_activo_visitante.length : 0,
        observaciones: txt(r.observaciones),
    };
}

/** Filas cuya ubicación (la de la cabecera del registro) cae dentro del alcance; sin alcance, todas. */
export function filterVisitasByScope(rows: any[], scope: ScopeItem[] | null): any[] {
    if (!scope) return rows;
    return rows.filter((r) => matchesScope({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }, scope));
}

/** Registro de visitas (`e_registro_personas`). Cada fila trae empresa, cliente, división, contrato, sucursal y puesto de ingreso. */
export const registroVisitas: GuardifyReportModule = {
    id: "registro_visitas",
    supportsScope: true,
    searchKeys: ["visitante", "cedula", "responsable", "motivo", "puesto"],
    filterKeys: ["funcionario", "empresa", "cliente", "contrato", "sucursal", "puesto"],
    sortKeys: ["entrada", "salida", "visitante", "cedula", "funcionario", "responsable", "empresa", "cliente", "contrato", "sucursal", "puesto", "activos"],
    defaultSort: "entrada",
    async load(db, p) {
        // Import diferido: las consultas arrastran exceljs/archiver; así el mapeo y el filtro por alcance se pueden probar sin ellos.
        const { queryRegistroVisitasRows } = await import("../../reports-functions/registroVisitasReport");
        const rows = await queryRegistroVisitasRows(db, { creadoDesde: `${p.from}T00:00:00`, creadoHasta: `${addDays(p.to, -1)}T23:59:59` }, "created_at", { take: 50_000 });
        const kept = filterVisitasByScope(rows, p.scope);
        return kept.map(mapRegistroVisitaRow);
    },
};
