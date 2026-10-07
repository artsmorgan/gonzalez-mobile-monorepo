import type { ReportDataAccess } from "../../reportDynamicPrisma";
import { ejecutivoPorCorpo, findByIds, usuarioInserta } from "../enrich";
import type { OutRow } from "../listing";
import { fmtDt, mapTiempoAlmuerzoRow } from "../mappers";
import { buildNombre } from "../names";
import { addDays, type ReportParams } from "../params";
import { matchesScope } from "../scope";
import type { GuardifyReportModule } from "../types";

type QueryRows = (db: ReportDataAccess, filters: { inicioDesde: string; finHasta: string }, orderKey: "inicio") => Promise<any[]>;

/** La consulta original rellena el nombre con el id cuando no encuentra el registro: eso se expone como vacío. */
const placeholderToNull = (value: unknown, id: unknown): string | null => {
    const s = String(value ?? "").trim();
    return !s || s === "0" || s === String(id ?? "") ? null : s;
};

/**
 * Filas del periodo `[from, to)` por la fecha de INICIO del almuerzo (la «Fecha» del Excel), restringidas al alcance y con
 * las columnas comunes de filtro agregadas en lote (sin consultas por fila):
 * - `empleado` pasa a «código - nombre» (así `contains` encuentra por código o por nombre);
 * - `ejecutivo_cuenta`: el de la sucursal de la fila;
 * - `usuario_inserta`: quien registró el almuerzo. La tabla no guarda un usuario aparte: el registro lo crea el propio empleado
 *   desde la app (`empleadoId`), así que es su nombre.
 */
export async function loadTiempoAlmuerzo(db: ReportDataAccess, p: ReportParams, query: QueryRows): Promise<OutRow[]> {
    // El rango se amplía un día por lado en la consulta (la zona horaria del servidor puede correr los límites) y se recorta exacto aquí.
    const rows = await query(db, { inicioDesde: `${addDays(p.from, -1)}T00:00:00`, finHasta: `${addDays(p.to, 1)}T23:59:59` }, "inicio");
    const scope = p.scope;
    const kept = rows
        .filter((r: any) => {
            const day = fmtDt(r.inicio)?.slice(0, 10);
            return !!day && day >= p.from && day < p.to;
        })
        .filter((r: any) => !scope || matchesScope({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }, scope));

    const empleados = await findByIds<{ codigo?: string | null; nombre?: string | null; primer_apellido?: string | null; segundo_apellido?: string | null }>(
        db as any,
        "c_empleado",
        kept.map((r: any) => r.empleadoId),
        { codigo: true, nombre: true, primer_apellido: true, segundo_apellido: true },
    );
    const nombres = new Map<number, string>();
    for (const [id, e] of empleados) {
        const n = buildNombre(e);
        if (n) nombres.set(id, n);
    }
    const ejecutivos = await ejecutivoPorCorpo(db as any, kept.map((r: any) => r.corpo_id));

    return kept.map((r: any) => {
        const o = mapTiempoAlmuerzoRow(r);
        const emp = empleados.get(Number(r.empleadoId));
        const nombre = String(o.empleado ?? "").trim() || nombres.get(Number(r.empleadoId)) || "";
        const codigo = String(emp?.codigo ?? "").trim();
        o.empleado = nombre ? (codigo ? `${codigo} - ${nombre}` : nombre) : codigo || null;
        for (const [col, nameKey, idKey] of [["empresa", "empresa_nombre", "empresa_id"], ["cliente", "cliente_nombre", "cliente_id"], ["division", "division_nombre", "division_id"], ["contrato", "contrato_nombre", "contrato_id"], ["sucursal", "corpo_nombre", "corpo_id"], ["puesto", "puesto_nombre", "puesto_id"]] as const) {
            o[col] = placeholderToNull(r[nameKey], r[idKey]);
        }
        o.ejecutivo_cuenta = ejecutivos.get(Number(r.corpo_id)) ?? null;
        o.usuario_inserta = usuarioInserta(r.empleadoId, nombres);
        return o;
    });
}

/** Tiempo de almuerzo (`c_empleado_almuerzo`). Cada fila ya trae su ubicación completa en la estructura. Periodo: fecha de inicio del almuerzo. */
export const tiempoAlmuerzo: GuardifyReportModule = {
    id: "tiempo_almuerzo",
    supportsScope: true,
    searchKeys: ["empleado", "cedula", "puesto", "sucursal"],
    filterKeys: ["empresa", "cliente", "division", "contrato", "sucursal", "puesto", "manual", "ejecutivo_cuenta", "usuario_inserta"],
    sortKeys: ["inicio", "fin", "empleado", "cedula", "minutos", "empresa", "cliente", "contrato", "sucursal", "puesto", "pausas", "division", "ejecutivo_cuenta", "usuario_inserta"],
    defaultSort: "inicio",
    async load(db, p) {
        // Import diferido: el módulo de consulta arrastra exceljs, que no hace falta para mapear ni para probar.
        const { queryTiempoAlmuerzoRows } = await import("../../reports-functions/tiempoAlmuerzoReport");
        return loadTiempoAlmuerzo(db, p, queryTiempoAlmuerzoRows as unknown as QueryRows);
    },
};
