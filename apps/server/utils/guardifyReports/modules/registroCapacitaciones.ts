import { fmtDt } from "../mappers";
import type { OutRow } from "../listing";
import { addDays } from "../params";
import { loadPuestoHierarchy, matchesScope, type ScopeItem } from "../scope";
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
 * Registro de capacitaciones (`e_registro_capacitaciones`). Se omiten `firma_responsable` (firma en base64), `file` y los
 * archivos adjuntos. Los participantes salen como texto («código - nombre; …», recortado) y los puestos como conteo.
 */
export function mapRegistroCapacitacionRow(r: any): OutRow {
    const empleados: any[] = Array.isArray(r.empleados_cap) ? r.empleados_cap : Array.isArray(r.e_capacitacion_empleado) ? r.e_capacitacion_empleado : [];
    const puestos: any[] = Array.isArray(r.puestos_cap) ? r.puestos_cap : Array.isArray(r.e_capacitacion_puesto) ? r.e_capacitacion_puesto : [];
    return {
        id: Number(r.id),
        fecha: fmtDt(r.fecha),
        titulo: txt(r.titulo),
        tipo: txt(r.tipo),
        resultado: txt(r.resultado),
        responsable: txt(r.responsable_nombre),
        cedula_responsable: txt(r.cedula_responsable),
        empresa: nombre(r.empresa_nombre, r.empresa_id),
        cliente: nombre(r.cliente_nombre, r.cliente_id),
        division: nombre(r.division_nombre, r.division_id),
        contrato: nombre(r.contrato_nombre, r.contrato_id),
        sucursal: nombre(r.corpo_nombre, r.corpo_id),
        puesto: nombre(r.puesto_nombre, r.puesto_id),
        empleados: empleados.length,
        puestos: puestos.length,
        participantes: txt(empleados.map((e) => String(e?.label ?? "").trim()).filter(Boolean).join("; ")),
        descripcion: txt(r.descripcion),
        observaciones: txt(r.observaciones),
    };
}

/**
 * Capacitaciones dentro del alcance: la cabecera trae la ubicación en la estructura; además, una capacitación también
 * cuenta como del alcance si alguno de los puestos a los que se dirige (`e_capacitacion_puesto`) cae dentro de él.
 */
export async function filterCapacitacionesByScope(db: any, rows: any[], scope: ScopeItem[] | null): Promise<any[]> {
    if (!scope) return rows;
    const linked = (r: any): number[] => (Array.isArray(r.puestos_cap) ? r.puestos_cap : []).map((x: any) => Number(x?.id)).filter((n: number) => n > 0);
    const hier = await loadPuestoHierarchy(db, rows.flatMap(linked));
    return rows.filter(
        (r) =>
            matchesScope({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }, scope) ||
            linked(r).some((id) => {
                const h = hier.get(id);
                return !!h && matchesScope(h, scope);
            }),
    );
}

/** Registro de capacitaciones (`e_registro_capacitaciones`). */
export const registroCapacitaciones: GuardifyReportModule = {
    id: "registro_capacitaciones",
    supportsScope: true,
    searchKeys: ["titulo", "responsable", "cedula_responsable", "participantes", "puesto"],
    filterKeys: ["tipo", "resultado", "empresa", "cliente", "contrato", "sucursal", "puesto"],
    sortKeys: ["fecha", "titulo", "tipo", "resultado", "responsable", "empresa", "cliente", "contrato", "sucursal", "puesto", "empleados", "puestos"],
    defaultSort: "fecha",
    async load(db, p) {
        // Import diferido: las consultas arrastran exceljs/archiver; así el mapeo y el filtro por alcance se pueden probar sin ellos.
        const { queryRegistroCapacitacionesRows } = await import("../../reports-functions/registroCapacitacionesReport");
        const rows = await queryRegistroCapacitacionesRows(db, { creadoDesde: `${p.from}T00:00:00`, creadoHasta: `${addDays(p.to, -1)}T23:59:59` }, "created_at");
        return (await filterCapacitacionesByScope(db, rows, p.scope)).map(mapRegistroCapacitacionRow);
    },
};
