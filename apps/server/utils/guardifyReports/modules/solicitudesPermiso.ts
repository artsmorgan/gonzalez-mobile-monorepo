import { divisionPorContrato } from "../enrich";
import { fmtDt } from "../mappers";
import type { OutRow } from "../listing";
import { addDays } from "../params";
import { matchesScope, type ScopeItem } from "../scope";
import type { GuardifyReportModule } from "../types";
import { cargarArchivos, solicitudesPermisoForm, tipoTurnoLabel } from "./solicitudesPermisoForm";

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

/** Estado con la primera letra en mayúscula («Pendiente», «Aprobado», «Rechazado»); la base lo guarda en minúsculas. */
const estadoLabel = (v: unknown): string | null => {
    const s = txt(v, 30);
    return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : null;
};

/**
 * Solicitudes de permiso (`c_solicitud_permiso`). Se omiten todas las firmas (`firma_*`, base64); de los archivos adjuntos solo salen
 * los nombres (`adjuntos`, separados por «; », los carga `enrichSolicitudes`); los turnos salen como conteo. `empleado_cedula` y `division_contrato` los agrega `load` (la consulta original no los trae).
 *
 * Para los filtros: `empleado` sale como «código - nombre», `estado` con mayúscula inicial, `division` es la del contrato (con la de la
 * cabecera como respaldo), `ejecutivo_cuenta` el propio de la solicitud, `tipo_turno` los tipos de turno distintos de la solicitud
 * («Diurno; Nocturno») quien la registró es `creado_por` (`created_by` guarda al usuario de la sesión que la creó) y `modificado`/`modificado_por` salen siempre vacíos (la tabla no los guarda).
 */
export function mapSolicitudPermisoRow(r: any): OutRow {
    const turnos = Array.isArray(r.turnos_list) ? r.turnos_list.length : 0;
    return {
        id: Number(r.id),
        creado: fmtDt(r.created_at),
        empleado: ((emp, cod) => (cod && emp && emp !== cod ? `${cod} - ${emp}` : emp ?? cod))(nombre(r.empleado_nombre, r.empleado_id), txt(r.empleado_codigo)),
        cedula: txt(r.empleado_cedula ?? r.c_empleado?.cedula),
        codigo: txt(r.empleado_codigo),
        empresa: nombre(r.empresa_nombre, r.empresa_id),
        cliente: nombre(r.cliente_nombre, r.cliente_id),
        division: txt(r.division_contrato) ?? nombre(r.division_nombre, r.division_id),
        contrato: nombre(r.contrato_nombre, r.contrato_id),
        sucursal: nombre(r.corpo_nombre, r.corpo_id),
        puesto: nombre(r.puesto_nombre, r.puesto_id),
        ejecutivo_cuenta: nombre(r.ejecutivo_cuenta_nombre, r.ejecutivo_cuenta),
        tipo_salario: txt(r.tipo),
        estado: estadoLabel(r.estado),
        fecha_inicio: fmtDt(r.fecha_inicio),
        fecha_fin: fmtDt(r.fecha_fin),
        dias: r.dias_permiso == null ? null : Number(r.dias_permiso),
        turnos,
        motivo: txt(r.motivo_txt ?? r.motivo),
        observaciones: txt(r.observaciones_txt ?? r.observaciones),
        adjuntos: txt((Array.isArray(r.adjuntos_list) ? r.adjuntos_list : []).join("; "), 2000),
        creado_por: nombre(r.creado_por_nombre, r.created_by),
        // La tabla no guarda modificación (sin `updated_at` ni `updated_by`): se entrega vacío (brecha de auditoría).
        modificado: (r as any).updated_at ? fmtDt((r as any).updated_at) : (null),
        modificado_por: (r as any).audit_modificado_por ?? (null),
        tipo_turno: txt([...new Set((Array.isArray(r.turnos_list) ? r.turnos_list : []).map((t: any) => tipoTurnoLabel(t?.tipo_turno)).filter(Boolean))].sort().join("; ")),
    };
}

/** Filas cuya ubicación (la de la cabecera del registro) cae dentro del alcance; sin alcance, todas. */
export function filterSolicitudesByScope(rows: any[], scope: ScopeItem[] | null): any[] {
    if (!scope) return rows;
    return rows.filter((r) => matchesScope({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }, scope));
}

/**
 * Agrega, en lote (una consulta por dato, no por fila), la cédula del empleado (la consulta original no la trae), la división del contrato
 * y los nombres de los archivos adjuntos (`c_archivos_solicitud_permiso`, el nombre original o, si viene vacío, el guardado).
 */
export async function enrichSolicitudes(db: any, rows: any[]): Promise<any[]> {
    const empIds = [...new Set(rows.map((r) => Number(r.empleado_id)).filter((n) => n > 0))];
    const [emps, divisiones, archivos] = await Promise.all([
        empIds.length ? db.c_empleado.findMany({ where: { id: { in: empIds } }, select: { id: true, cedula: true } }) : [],
        divisionPorContrato(db, rows.map((r) => r.contrato_id)),
        cargarArchivos(db, rows.map((r) => r.id)),
    ]);
    const cedulaById = new Map<number, unknown>(emps.map((e: any) => [Number(e.id), e.cedula]));
    const nombreArchivo = (a: any): string | null => txt(a?.original_name, 300) ?? txt(a?.name, 300);
    return rows.map((r) => ({
        ...r,
        empleado_cedula: cedulaById.get(Number(r.empleado_id)),
        division_contrato: divisiones.get(Number(r.contrato_id)),
        adjuntos_list: (archivos.get(Number(r.id)) ?? []).map(nombreArchivo).filter(Boolean),
    }));
}

/**
 * Solicitudes de permiso. Cada fila trae empresa, cliente, división, contrato, sucursal y puesto.
 * El periodo `from/to` se aplica a la fecha de creación de la solicitud (`creado`, la «Fecha» del módulo).
 */
export const solicitudesPermiso: GuardifyReportModule = {
    id: "solicitudes_permiso",
    supportsScope: true,
    searchKeys: ["empleado", "cedula", "codigo", "motivo", "puesto"],
    filterKeys: ["estado", "tipo_salario", "tipo_turno", "division", "ejecutivo_cuenta", "creado_por", "creado", "modificado", "modificado_por", "empresa", "cliente", "contrato", "sucursal", "puesto"],
    sortKeys: ["creado", "empleado", "cedula", "estado", "tipo_salario", "tipo_turno", "fecha_inicio", "fecha_fin", "dias", "division", "ejecutivo_cuenta", "empresa", "cliente", "contrato", "sucursal", "puesto", "creado_por", "modificado", "modificado_por"],
    defaultSort: "creado",
    form: solicitudesPermisoForm,
    async load(db, p) {
        // Import diferido: las consultas arrastran exceljs/archiver; así el mapeo y el filtro por alcance se pueden probar sin ellos.
        const { querySolicitudesPermisoRows } = await import("../../reports-functions/solicitudesPermisoReport");
        const rows = await querySolicitudesPermisoRows(db, { creadoDesde: `${p.from}T00:00:00`, creadoHasta: `${addDays(p.to, -1)}T23:59:59` }, "created_at");
        const kept = filterSolicitudesByScope(rows, p.scope);
        return (await enrichSolicitudes(db, kept)).map(mapSolicitudPermisoRow);
    },
};
