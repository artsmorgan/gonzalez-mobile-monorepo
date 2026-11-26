import type { ReportDataAccess } from "../../reportDynamicPrisma";
import { ejecutivoPorCorpo, findByIds, ubicacionTextos } from "../enrich";
import { ReportUnavailableError } from "../errors";
import type { FormRecord, GuardifyFormModule } from "../forms";
import { fmtDt } from "../mappers";
import { buildNombre } from "../names";
import { loadPuestoHierarchy, type Hierarchy } from "../scope";

/**
 * Solicitud de vacaciones como formulario (`v_vacacion_solicitud`, base de planillas). No hay generador individual ni pantalla móvil: el formato sale de
 * las columnas del módulo de lista y entrega los mismos datos que él. Nunca monto, usuarios ni fechas de aprobación, datos de reversión ni motivos de
 * rechazo. La ubicación sale de la plaza (plaza → puesto → sucursal → contrato → cliente / empresa / división). La tabla no guarda firmas
 * (solo quién y cuándo aprobó, que no se entrega): no hay firmas que entregar.
 */
const txt = (v: unknown): string | null => { const s = String(v ?? "").trim(); return s ? s : null; };
const withCode = (code: unknown, name: unknown): string | null => {
    const n = txt(name);
    if (!n) return null;
    const c = txt(code);
    return c ? `${c} - ${n}` : n;
};
const num = (v: unknown): number | null => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const dia = (v: unknown): string | null => fmtDt(v as any)?.slice(0, 10) ?? null;

/** `ESTADO_SOLICITADO` → «Solicitado», `DISFRUTE` → «Disfrute»: la base guarda códigos (igual que el módulo de lista). */
export function legible(v: unknown): string | null {
    const s = String(v ?? "").trim().replace(/^ESTADO_/i, "").replace(/_/g, " ").toLowerCase();
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : null;
}

export type VacacionLookups = { empleados?: Map<number, any>; plazas?: Map<number, any>; ejecutivo?: string | null };

/** `raw` es la fila de `v_vacacion_solicitud` (solo columnas seguras); `hier` su ubicación por la plaza. */
export function armarRegistro(raw: any, ubic: FormRecord["estructura"], _firmas: boolean, l: VacacionLookups = {}, hier: Hierarchy = {}): FormRecord {
    const emp = l.empleados?.get(Number(raw.empleado_id));
    const plaza = l.plazas?.get(Number(raw.plaza_id));
    const nombre = emp ? buildNombre(emp) : "";
    const codigo = txt(emp?.codigo);
    const creado = fmtDt(raw.fecha_insercion);
    return {
        id: Number(raw.id), variante: null, creado, estructura: ubic,
        valores: {
            consecutivo: txt(raw.consecutivo),
            fecha_solicitud: creado ? creado.slice(0, 10) : null,
            estado: legible(raw.estado_aprobacion),
            tipo_vacaciones: legible(raw.tipo_vacaciones),
            periodo: txt(raw.periodo),
            empleado: nombre ? (codigo ? `${codigo} - ${nombre}` : nombre) : codigo,
            cedula: txt(emp?.cedula),
            plaza: withCode(plaza?.codigo_plaza, plaza?.nombre),
            ejecutivo_cuenta: txt(l.ejecutivo),
            fecha_inicio: dia(raw.fecha_inicio),
            fecha_fin: dia(raw.fecha_fin),
            dias: num(raw.dias),
            semanas: num(raw.semanas),
            observaciones: txt(raw.observaciones)?.slice(0, 500) ?? null,
        },
        listas: {},
        firmas: {}, firmasPresentes: [],
        hier,
    };
}

/** Solo columnas seguras: no se piden monto, usuarios/fechas de aprobación ni de reversión. */
const COLS = {
    id: true, empleado_id: true, plaza_id: true, fecha_inicio: true, fecha_fin: true, dias: true, semanas: true, observaciones: true, consecutivo: true,
    estado_aprobacion: true, tipo_vacaciones: true, periodo: true, fecha_insercion: true,
} as const;

const uniq = (xs: unknown[]) => [...new Set(xs.map(Number).filter((n) => Number.isFinite(n) && n > 0))];

export const solicitudVacacionesForm: GuardifyFormModule = {
    async loadRecords(db: ReportDataAccess, ids, _opts) {
        let rows: any[];
        try {
            rows = await db.v_vacacion_solicitud!.findMany({ where: { id: { in: ids } }, select: COLS });
        } catch (e) {
            // La base de planillas de algunos entornos todavía no tiene la vista de solicitudes de vacaciones (igual que en la lista).
            if (/Tabla no soportada|does not exist|no existe|Unknown (model|field)|not found in Prisma/i.test(String((e as Error)?.message ?? e)) || (db.v_vacacion_solicitud as unknown) === undefined) {
                throw new ReportUnavailableError("Este reporte todavía no está disponible: la base de datos no tiene la tabla de solicitudes de vacaciones.");
            }
            throw e;
        }
        if (!rows.length) return [];
        const d = db as any;
        const [empleados, plazas] = await Promise.all([
            findByIds<any>(d, "c_empleado", rows.map((r) => r.empleado_id), { codigo: true, nombre: true, primer_apellido: true, segundo_apellido: true, cedula: true }),
            findByIds<any>(d, "e_estructura_plazas", rows.map((r) => r.plaza_id), { puesto_id: true, codigo_plaza: true, nombre: true }),
        ]);
        const jerarquia = await loadPuestoHierarchy(d, uniq([...plazas.values()].map((x) => x.puesto_id)));
        const hierDe = (r: any): Hierarchy => { const p = plazas.get(Number(r.plaza_id)); return (p?.puesto_id != null ? jerarquia.get(Number(p.puesto_id)) : undefined) ?? {}; };
        const hiers = rows.map(hierDe);
        const [ubic, ejecutivos] = await Promise.all([ubicacionTextos(d, hiers), ejecutivoPorCorpo(d, hiers.map((h) => h.corpo))]);
        return rows.map((r, i) => armarRegistro(r, ubic(hiers[i]!), false, { empleados, plazas, ejecutivo: ejecutivos.get(Number(hiers[i]!.corpo)) ?? null }, hiers[i]));
    },
};
