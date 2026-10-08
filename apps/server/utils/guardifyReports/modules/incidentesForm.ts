import type { ReportDataAccess } from "../../reportDynamicPrisma";
import { findByIds, nombresEmpleado, ubicacionTextos } from "../enrich";
import type { FormRecord, GuardifyFormModule } from "../forms";
import { fmtDt } from "../mappers";

/**
 * Incidente (`c_incidente`) como formulario «Control de incidentes» (SEG-F-004). El generador individual lo imprime en una sola fila ancha;
 * aquí se entrega estructurado: datos generales, detalle, solución y las listas repetibles (involucrados, libro de novedades, aportes).
 *
 * No se entregan: el enlace del informe (`link_informe`, igual que en la lista), los archivos adjuntos del incidente ni de los aportes,
 * ni las firmas de terceros de los aportes (son una por aporte; el formato no tiene dónde dibujarlas, solo se dice si el aporte la trae).
 */
const txt = (v: unknown): string | null => { const s = String(v ?? "").trim(); return s ? s : null; };
const dia = (v: unknown): string | null => fmtDt(v as any)?.slice(0, 10) ?? null;
/** Involucrados y libro de novedades se guardan como JSON de lista (texto). */
const parseList = (raw: unknown): any[] => {
    if (Array.isArray(raw)) return raw;
    if (typeof raw !== "string" || !raw.trim()) return [];
    try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch { return []; }
};

/** Datos que no vienen en la fila y se cargan por lote. */
export type IncidenteFormExtra = { ejecutivo?: string | null; empleados?: Map<number, string> };

export function armarRegistro(raw: any, ubic: FormRecord["estructura"], firmas: boolean, x: IncidenteFormExtra = {}): FormRecord {
    void firmas; // el incidente no tiene firmas que dibujar; se acepta el parámetro para mantener la misma forma que los demás cargadores
    const creado = fmtDt(raw.created_at);
    const involucrados = parseList(raw.involucrados).filter((i) => i && typeof i === "object").map((i) => ({ nombre: txt(i.nombre), codigo: txt(i.codigo) })).filter((i) => i.nombre || i.codigo);
    const novedades = parseList(raw.fecha_libro_novedades).filter((n) => n && typeof n === "object").map((n) => ({ numero: txt(n.numero), fecha: txt(n.fecha) })).filter((n) => n.numero || n.fecha);
    const aportes = (Array.isArray(raw.c_contribucion_incidente) ? raw.c_contribucion_incidente : [])
        .slice()
        .sort((a: any, b: any) => String(fmtDt(a.created_at) ?? "").localeCompare(String(fmtDt(b.created_at) ?? "")))
        .map((a: any) => ({
            rol: txt(a.rol_aporte),
            empleado: x.empleados?.get(Number(a.empleado_id)) ?? null,
            nombre_tercero: txt(a.nombre_aporte),
            aporte: txt(a.aporte),
            fecha: dia(a.created_at),
            firma: String(a.firma_aporte_tercero ?? "").trim() ? "Sí" : "No",
        }));
    const valores: FormRecord["valores"] = {
        numero: Number(raw.id),
        ejecutivo_cuenta: txt(x.ejecutivo ?? raw.ejecutivo_cuenta_nombre),
        fecha_incidente: dia(raw.fecha_incidente),
        fecha_reporte: dia(raw.fecha_reporte),
        quien_reporta: txt(raw.nombre_responsable),
        clasificacion: txt(raw.n_clasificacion_incidente?.nombre),
        descripcion: txt(raw.descripcion),
        estado: raw.estado ? "Solucionado" : "No solucionado",
        responsable_atencion: txt(raw.nombre_responsable_atencion),
        solucion: txt(raw.solucion),
        fecha_solucion: dia(raw.fecha_solucion),
        fecha_real_solucion: dia(raw.fecha_real_solucion),
        costo_asociado: txt(raw.costo_asociado),
        consecutivo_informe: txt(raw.consecutivo_informe),
    };
    return {
        id: Number(raw.id), variante: null, creado, estructura: ubic, valores,
        listas: { involucrados, novedades, aportes },
        firmas: {}, firmasPresentes: [],
        hier: { empresa: raw.empresa_id, cliente: raw.cliente_id, division: raw.division_id, contrato: raw.contrato_id, corpo: raw.corpo_id, puesto: raw.puesto_id },
    };
}

export const incidentesForm: GuardifyFormModule = {
    async loadRecords(db: ReportDataAccess, ids, { firmas }) {
        // Misma consulta que la lista (`queryIncidenteRows`): la clasificación y los aportes vienen por relación; el ejecutivo (tabla preexistente) por lote.
        const rows: any[] = await (db as any).c_incidente.findMany({
            where: { id: { in: ids }, isActive: true },
            include: { n_clasificacion_incidente: { select: { id: true, nombre: true } }, c_contribucion_incidente: { orderBy: { created_at: "asc" } } },
        });
        if (!rows.length) return [];
        const ubic = await ubicacionTextos(db as any, rows.map((r) => ({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id })));
        const ejecutivos = await findByIds<{ nombre?: string | null }>(db as any, "n_ejecutivo_cuenta", rows.map((r) => r.ejecutivo_cuenta), { nombre: true });
        const empleados = await nombresEmpleado(db as any, rows.flatMap((r) => (Array.isArray(r.c_contribucion_incidente) ? r.c_contribucion_incidente : []).map((a: any) => a.empleado_id)));
        return rows.map((r) => armarRegistro(r, ubic({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }), firmas, { ejecutivo: txt(ejecutivos.get(Number(r.ejecutivo_cuenta))?.nombre), empleados }));
    },
};
