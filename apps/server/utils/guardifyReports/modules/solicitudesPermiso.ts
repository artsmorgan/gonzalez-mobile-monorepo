import { fmtDt } from "../mappers";
import type { OutRow } from "../listing";
import { addDays } from "../params";
import { matchesScope, type ScopeItem } from "../scope";
import type { GuardifyReportModule } from "../types";

const txt = (v: unknown, max = 500): string | null => {
    const s = String(v ?? "").trim();
    return s ? s.slice(0, max) : null;
};

/** Nombre de estructura/persona; la consulta original rellena con el id cuando no encuentra el registro: eso es «sin dato». */
const nombre = (v: unknown, id: unknown): string | null => {
    const s = txt(v);
    if (!s || s === "—" || s === String(id ?? "")) return null;
    return s;
};

/**
 * Solicitudes de permiso (`c_solicitud_permiso`). Se omiten todas las firmas (`firma_*`, base64) y los archivos
 * adjuntos; los turnos salen como conteo. `empleado_cedula` lo agrega `load` (la consulta original no la trae).
 */
export function mapSolicitudPermisoRow(r: any): OutRow {
    const turnos = Array.isArray(r.turnos_list) ? r.turnos_list.length : 0;
    return {
        id: Number(r.id),
        creado: fmtDt(r.created_at),
        empleado: nombre(r.empleado_nombre, r.empleado_id),
        cedula: txt(r.empleado_cedula ?? r.c_empleado?.cedula),
        codigo: txt(r.empleado_codigo),
        empresa: nombre(r.empresa_nombre, r.empresa_id),
        cliente: nombre(r.cliente_nombre, r.cliente_id),
        division: nombre(r.division_nombre, r.division_id),
        contrato: nombre(r.contrato_nombre, r.contrato_id),
        sucursal: nombre(r.corpo_nombre, r.corpo_id),
        puesto: nombre(r.puesto_nombre, r.puesto_id),
        ejecutivo_cuenta: nombre(r.ejecutivo_cuenta_nombre, r.ejecutivo_cuenta),
        tipo_salario: txt(r.tipo),
        estado: txt(r.estado),
        fecha_inicio: fmtDt(r.fecha_inicio),
        fecha_fin: fmtDt(r.fecha_fin),
        dias: r.dias_permiso == null ? null : Number(r.dias_permiso),
        turnos,
        motivo: txt(r.motivo_txt ?? r.motivo),
        observaciones: txt(r.observaciones_txt ?? r.observaciones),
        creado_por: nombre(r.creado_por_nombre, r.created_by),
    };
}

/** Filas cuya ubicación (la de la cabecera del registro) cae dentro del alcance; sin alcance, todas. */
export function filterSolicitudesByScope(rows: any[], scope: ScopeItem[] | null): any[] {
    if (!scope) return rows;
    return rows.filter((r) => matchesScope({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }, scope));
}

/** Solicitudes de permiso. Cada fila trae empresa, cliente, división, contrato, sucursal y puesto. */
export const solicitudesPermiso: GuardifyReportModule = {
    id: "solicitudes_permiso",
    supportsScope: true,
    searchKeys: ["empleado", "cedula", "codigo", "motivo", "puesto"],
    filterKeys: ["estado", "tipo_salario", "empresa", "cliente", "contrato", "sucursal", "puesto"],
    sortKeys: ["creado", "empleado", "cedula", "estado", "tipo_salario", "fecha_inicio", "fecha_fin", "dias", "empresa", "cliente", "contrato", "sucursal", "puesto", "creado_por"],
    defaultSort: "creado",
    async load(db, p) {
        // Import diferido: las consultas arrastran exceljs/archiver; así el mapeo y el filtro por alcance se pueden probar sin ellos.
        const { querySolicitudesPermisoRows } = await import("../../reports-functions/solicitudesPermisoReport");
        const rows = await querySolicitudesPermisoRows(db, { creadoDesde: `${p.from}T00:00:00`, creadoHasta: `${addDays(p.to, -1)}T23:59:59` }, "created_at");
        const kept = filterSolicitudesByScope(rows, p.scope);
        // La cédula no viene en la consulta original: se trae en lote (una sola consulta) solo para las filas que quedan.
        const empIds = [...new Set(kept.map((r: any) => Number(r.empleado_id)).filter((n: number) => n > 0))];
        const emps = empIds.length ? await db.c_empleado!.findMany({ where: { id: { in: empIds } }, select: { id: true, cedula: true } }) : [];
        const cedulaById = new Map<number, unknown>(emps.map((e: any) => [Number(e.id), e.cedula]));
        return kept.map((r: any) => mapSolicitudPermisoRow({ ...r, empleado_cedula: cedulaById.get(Number(r.empleado_id)) }));
    },
};
