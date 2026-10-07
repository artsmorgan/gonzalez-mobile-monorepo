import type { ReportDataAccess } from "../../reportDynamicPrisma";
import { fmtDt } from "../mappers";
import type { OutRow } from "../listing";
import { addDays, type ReportParams } from "../params";
import { matchesScope } from "../scope";
import { divisionPorContrato, ejecutivoPorCorpo } from "../enrich";
import type { GuardifyReportModule } from "../types";

const txt = (v: unknown): string | null => {
    const s = String(v ?? "").trim();
    return s ? s : null;
};
/** Textos libres: máximo 500 caracteres. */
const short = (v: unknown): string | null => txt(v)?.slice(0, 500) ?? null;
/** Nombre de división real: un número suelto («0», el id) es el marcador de «sin división», no un nombre. */
const realName = (v: unknown): string | null => {
    const s = txt(v);
    return s && !/^\d+$/.test(s) ? s : null;
};
/** Las fechas de la queja se guardan como texto `YYYY-MM-DD`: se devuelven como fecha sin hora. */
const dayDt = (v: unknown): string | null => {
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(v ?? "").trim());
    return m ? `${m[1]}T00:00:00` : null;
};

/** Datos que se resuelven en lote: ejecutivo de cuenta de la sucursal y división del contrato (si la fila no trae una). */
export type QuejaExtra = { ejecutivo?: string | null; division?: string | null };

/**
 * Fila cruda de `queryMaestroQuejasRows` → fila plana. Nunca se expone `firma_responsable` (imagen de la firma) ni los
 * anexos de la queja. `creado_por` ya viene como «código - nombre» (quien registró la queja, el «Usuario inserta»).
 */
export function mapMaestroQuejaRow(r: any, extra: QuejaExtra = {}): OutRow {
    return {
        id: Number(r.id),
        creado: fmtDt(r.created_at),
        fecha_queja: dayDt(r.fecha_queja),
        fecha_atencion: dayDt(r.fecha_inicio),
        fecha_realizacion: dayDt(r.fecha_revision),
        empresa: txt(r.empresa_nombre),
        cliente: txt(r.cliente_nombre),
        division: realName(r.division_nombre) ?? txt(extra.division),
        contrato: txt(r.contrato_nombre),
        sucursal: txt(r.corpo_nombre),
        puesto: txt(r.puesto_nombre),
        plaza: txt(r.plaza_nombre),
        sociedad: txt(r.sociedad),
        recibida_por: txt(r.nombre_realiza_queja),
        cliente_formulario: txt(r.cliente),
        empresa_queja: txt(r.empresa_presenta_queja),
        persona_queja: txt(r.persona_presenta_queja),
        medio_recepcion: txt(r.medio_recepcion_queja),
        tipo_cliente: txt(r.tipo_cliente),
        tipo_queja: short(r.tipo_queja),
        ubicacion: short(r.ubicacion),
        nivel_queja: txt(r.nivel_queja),
        motivo: short(r.motivo_queja),
        descripcion: short(r.descripcion_queja),
        estimacion_dannio: short(r.estimacion_dannio),
        resolucion: short(r.resolucion_queja),
        accion_correctiva: short(r.accion_correctiva_preventiva),
        estado: txt(r.estado),
        creado_por: txt(r.creado_por_nombre),
        ejecutivo_cuenta: txt(extra.ejecutivo),
    };
}

type QueryRows = (db: ReportDataAccess, filters: { creadoDesde: string; creadoHasta: string }, orderKey: "fecha_queja") => Promise<any[]>;

/** Trae las filas del periodo `[from, to)`, las restringe al alcance y completa en lote el ejecutivo de cuenta y la división. */
export async function loadMaestroQuejas(db: ReportDataAccess, p: ReportParams, query: QueryRows): Promise<OutRow[]> {
    const rows = await query(db, { creadoDesde: `${p.from}T00:00:00`, creadoHasta: `${addDays(p.to, -1)}T23:59:59` }, "fecha_queja");
    const scope = p.scope;
    const kept = !scope
        ? rows
        : rows.filter((r: any) => matchesScope({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }, scope));
    const ejecutivos = await ejecutivoPorCorpo(db as any, kept.map((r: any) => r.corpo_id));
    const divisiones = await divisionPorContrato(db as any, kept.filter((r: any) => !realName(r.division_nombre)).map((r: any) => r.contrato_id));
    return kept.map((r: any) => mapMaestroQuejaRow(r, { ejecutivo: ejecutivos.get(Number(r.corpo_id)), division: divisiones.get(Number(r.contrato_id)) }));
}

/** Maestro de quejas y reclamos (`c_maestro_quejas`). Cada fila trae sus ids de empresa, cliente, división, contrato, sucursal y puesto. Periodo: fecha de registro (`created_at`, columna `creado`), la «Fecha» del Excel (la fecha de la queja va aparte en `fecha_queja`). */
export const maestroQuejas: GuardifyReportModule = {
    id: "maestro_quejas",
    supportsScope: true,
    searchKeys: ["empresa_queja", "persona_queja", "recibida_por", "motivo", "descripcion", "sucursal", "puesto", "estado", "creado_por", "ejecutivo_cuenta"],
    filterKeys: ["empresa", "cliente", "division", "contrato", "sucursal", "puesto", "medio_recepcion", "tipo_cliente", "tipo_queja", "nivel_queja", "estado", "recibida_por", "ejecutivo_cuenta", "creado_por"],
    sortKeys: ["creado", "fecha_queja", "fecha_atencion", "fecha_realizacion", "empresa", "cliente", "division", "contrato", "sucursal", "puesto", "medio_recepcion", "tipo_queja", "nivel_queja", "estado", "ejecutivo_cuenta", "creado_por"],
    defaultSort: "fecha_queja",
    async load(db, p) {
        // Import diferido: el módulo de consulta arrastra exceljs, que no hace falta para mapear ni para probar.
        const { queryMaestroQuejasRows } = await import("../../reports-functions/maestroQuejasReport");
        return loadMaestroQuejas(db, p, queryMaestroQuejasRows as unknown as QueryRows);
    },
};
