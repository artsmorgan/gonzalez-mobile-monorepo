import { batchFindManyByIds } from "../../reportDynamicPrisma";
import { normalizeControlAsistenciaFilters, queryControlAsistenciaRows } from "../../reports-functions/controlAsistenciaReport";
import type { OutRow } from "../listing";
import { fmtDt } from "../mappers";
import { addDays } from "../params";
import { ejecutivoPorCorpo } from "../enrich";
import { buildNombre } from "../names";
import { matchesScope } from "../scope";
import type { GuardifyReportModule } from "../types";
import { controlAsistenciaForm } from "./controlAsistenciaForm";

const txt = (v: unknown): string | null => {
    const s = String(v ?? "").trim();
    return s ? s : null;
};
const short = (v: unknown, max = 500): string | null => {
    const s = txt(v);
    return s ? s.slice(0, max) : null;
};
const nameOrNull = (v: unknown, id: unknown): string | null => {
    const s = txt(v);
    return !s || s === "0" || s === String(id) ? null : s;
};
const num = (v: unknown): number | null => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

function parseColaboradores(raw: unknown): any[] {
    if (!raw || String(raw).trim() === "") return [];
    try {
        const p = JSON.parse(String(raw));
        return Array.isArray(p) ? p : [];
    } catch {
        return [];
    }
}

/**
 * Control de asistencia (`c_control_asistencia`). Se exponen solo conteos de colaboradores (no sus nombres, firmas ni
 * horas) y nunca las firmas ni las imágenes. `creador` es el empleado que lo registró (`c_empleado`), si se pudo cargar;
 * `ejecutivo` es el ejecutivo de cuenta de la sucursal. Para filtrar: `turno` = tipo de turno (Diurno/Mixto/Nocturno) y `creado_por` =
 * usuario que lo registró.
 */
export function mapControlAsistenciaRow(r: any, creador?: any, ejecutivo?: string | null): OutRow {
    const cols = parseColaboradores(r.colaboradores);
    const firmas = Array.isArray(r.c_control_asistencia_empleado_firmas) ? r.c_control_asistencia_empleado_firmas.length : 0;
    return {
        id: Number(r.id),
        fecha: fmtDt(r.fecha),
        creado: fmtDt(r.created_at),
        empresa: nameOrNull(r.empresa_nombre, r.empresa_id),
        cliente: nameOrNull(r.cliente_nombre, r.cliente_id),
        division: nameOrNull(r.division_nombre, r.division_id),
        contrato: nameOrNull(r.contrato_nombre, r.contrato_id),
        sucursal: nameOrNull(r.corpo_nombre, r.corpo_id),
        puesto: nameOrNull(r.puesto_nombre, r.puesto_id),
        turno: txt(r.turno_label) ?? txt(r.turno),
        presentes: num(r.total_presentes),
        total_turno: num(r.total_empleados_turno),
        ausentes: cols.filter((c) => !!c?.ausente).length,
        reemplazos: cols.filter((c) => txt(c?.nombre_reemplazo) || txt(c?.cedula_reemplazo)).length,
        firmas,
        supervisor: txt(r.nombre_supervisor),
        creado_por: creador ? txt(buildNombre(creador)) : null,
        comentarios: short(r.comentarios),
        ejecutivo_cuenta: txt(ejecutivo),
    };
}

/**
 * Control de asistencia por turno. El periodo se aplica a `fecha` (la «Fecha» del Excel: fecha y hora del turno), no a la fecha de
 * registro (`creado`). La consulta original solo filtra por `created_at`, que nunca es anterior al turno (salvo la zona horaria,
 * de ahí un día antes) pero puede ser posterior si el control se registró tarde: se pide `created_at` desde un día antes del periodo
 * hasta 45 días después, y el recorte exacto por `fecha` ([from, to)) es aquí.
 */
export const controlAsistencia: GuardifyReportModule = {
    id: "control_asistencia",
    supportsScope: true,
    searchKeys: ["puesto", "sucursal", "contrato", "cliente", "supervisor", "creado_por", "comentarios"],
    filterKeys: ["empresa", "cliente", "division", "contrato", "sucursal", "puesto", "turno", "ejecutivo_cuenta", "creado_por"],
    sortKeys: ["fecha", "creado", "empresa", "cliente", "contrato", "sucursal", "puesto", "turno", "presentes", "total_turno", "ausentes", "reemplazos", "supervisor", "creado_por", "ejecutivo_cuenta"],
    defaultSort: "creado",
    form: controlAsistenciaForm,
    async load(db, p) {
        const filters = normalizeControlAsistenciaFilters({ creadoDesde: `${addDays(p.from, -1)}T00:00:00`, creadoHasta: `${addDays(p.to, 45)}T23:59:59` });
        const rows = await queryControlAsistenciaRows(db, filters, "fecha");
        const scope = p.scope;
        const kept = rows
            .filter((r: any) => {
                const d = fmtDt(r.fecha)?.slice(0, 10);
                return !!d && d >= p.from && d < p.to;
            })
            .filter((r: any) => !scope || matchesScope({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }, scope));
        const creadores = await batchFindManyByIds<any>(db, "c_empleado", kept.map((r: any) => Number(r.created_by)), { id: true, nombre: true, primer_apellido: true, segundo_apellido: true });
        const ejecutivos = await ejecutivoPorCorpo(db, kept.map((r: any) => r.corpo_id));
        return kept.map((r: any) => mapControlAsistenciaRow(r, creadores.get(Number(r.created_by)), ejecutivos.get(Number(r.corpo_id))));
    },
};
