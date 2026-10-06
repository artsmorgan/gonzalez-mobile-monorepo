import { batchFindManyByIds } from "../../reportDynamicPrisma";
import { plazaCodigoExcluyeArroba, queryActividadesReportRows } from "../../reports-functions/actividadesReport";
import type { OutRow } from "../listing";
import { fmtDt } from "../mappers";
import { addDays } from "../params";
import { loadPuestoHierarchy, matchesScope, type Hierarchy, type ScopeItem } from "../scope";
import type { GuardifyReportModule } from "../types";

const txt = (v: unknown): string | null => {
    const s = String(v ?? "").trim();
    return s ? s : null;
};
const fmtDay = (d: unknown): string | null => {
    const s = fmtDt(d as any);
    return s ? `${s.slice(0, 10)}T00:00:00` : null;
};
const withCode = (code: unknown, name: unknown): string | null => {
    const n = txt(name);
    if (!n) return null;
    const c = txt(code);
    return c ? `${c} - ${n}` : n;
};
const TURNO: Record<string, string> = { D: "Diurno", M: "Mixto", N: "Nocturno" };

/** Textos de la estructura por nivel e id (para mostrar dónde aplica la actividad). */
export type EstructuraNombres = Record<"empresa" | "cliente" | "division" | "contrato" | "corpo", Map<number, string>>;
const emptyNombres = (): EstructuraNombres => ({ empresa: new Map(), cliente: new Map(), division: new Map(), contrato: new Map(), corpo: new Map() });

/** Una fila por actividad y puesto al que aplica. Las plazas se resumen en conteos (no se expone el detalle por usuario). */
export function mapActividadPuestoRow(act: any, ap: any | null, h: Hierarchy | undefined, n: EstructuraNombres): OutRow {
    const name = (nivel: keyof EstructuraNombres) => {
        const id = h?.[nivel];
        return id ? (n[nivel].get(Number(id)) ?? null) : null;
    };
    const plazas: any[] = (ap?.e_actividades_puesto_plaza ?? []).filter((pl: any) => !plazaCodigoExcluyeArroba(pl?.e_estructura_plazas?.codigo_plaza));
    const turno = String(act.tipo_turno ?? "").trim().toUpperCase();
    const desc = txt(act.descripcion_actividad);
    return {
        id: Number(ap?.id ?? act.id),
        nombre_actividad: txt(act.nombre_actividad),
        fecha_inicio: fmtDay(act.fecha_inicio),
        fecha_fin: fmtDay(act.fecha_fin),
        frecuencia: txt(act.frecuencia_titulo),
        horario: txt(act.frecuencia_horario),
        tipo_turno: TURNO[turno] ?? null,
        revision_equipo: act.es_revision_equipo ? "Sí" : "No",
        descripcion: desc ? desc.slice(0, 500) : null,
        empresa: name("empresa"),
        cliente: name("cliente"),
        division: name("division"),
        contrato: name("contrato"),
        sucursal: name("corpo"),
        puesto: ap ? withCode(ap.e_estructura_puesto?.codigo, ap.e_estructura_puesto?.nombre) : null,
        plazas: plazas.length,
        marcadas: plazas.filter((pl) => pl.marcada).length,
        // Nunca se exponen los artículos por plaza ni el usuario que marcó la actividad.
    };
}

/** Filtra por periodo (`fecha_inicio`) y alcance, y arma las filas. Separada de `load` para poder probarla sin la consulta original. */
export async function buildActividadesRows(db: any, acts: any[], from: string, to: string, scope: ScopeItem[] | null): Promise<OutRow[]> {
    const inPeriod = acts.filter((a) => {
        const day = fmtDt(a.fecha_inicio)?.slice(0, 10);
        return !!day && day >= from && day < to;
    });
    const pairs = inPeriod.flatMap((a) => {
        const aps: any[] = a.e_actividades_puesto ?? [];
        return aps.length ? aps.map((ap) => ({ act: a, ap })) : [{ act: a, ap: null }];
    });
    const hier = await loadPuestoHierarchy(db, pairs.map((x) => Number(x.ap?.puesto_id)));
    const kept = pairs.filter((x) => !scope || (x.ap != null && matchesScope(hier.get(Number(x.ap.puesto_id)) ?? {}, scope)));

    const ids = (nivel: keyof EstructuraNombres) => kept.map((x) => Number(hier.get(Number(x.ap?.puesto_id))?.[nivel]));
    const [empresas, clientes, divisiones, contratos, corpos] = await Promise.all([
        batchFindManyByIds<any>(db, "e_estructura_empresa", ids("empresa"), { id: true, nombre: true, codigo: true }),
        batchFindManyByIds<any>(db, "e_estructura_cliente", ids("cliente"), { id: true, nombre: true }),
        batchFindManyByIds<any>(db, "n_division", ids("division"), { id: true, nombre: true, codigo: true }),
        batchFindManyByIds<any>(db, "e_estructura_contrato", ids("contrato"), { id: true, nombre: true, nro_contrato: true }),
        batchFindManyByIds<any>(db, "e_estructura_sucursal", ids("corpo"), { id: true, nombre: true, nro_sucursal: true }),
    ]);
    const nombres = emptyNombres();
    for (const [id, e] of empresas) nombres.empresa.set(id, withCode(e.codigo, e.nombre) ?? "");
    for (const [id, c] of clientes) nombres.cliente.set(id, txt(c.nombre) ?? "");
    for (const [id, d] of divisiones) nombres.division.set(id, withCode(d.codigo, d.nombre) ?? "");
    for (const [id, c] of contratos) nombres.contrato.set(id, withCode(c.nro_contrato, c.nombre) ?? "");
    for (const [id, s] of corpos) nombres.corpo.set(id, withCode(s.nro_sucursal, s.nombre) ?? "");

    return kept.map((x) => mapActividadPuestoRow(x.act, x.ap, hier.get(Number(x.ap?.puesto_id)), nombres));
}

/**
 * Actividades (`e_actividades` → `e_actividades_puesto`). La ubicación no está en la actividad sino en cada puesto al que
 * aplica, así que se deduce del puesto (`loadPuestoHierarchy`). Una actividad sin puestos asignados sale sin ubicación y
 * queda fuera de cualquier consulta con alcance. Periodo: `fecha_inicio`, como el filtro de la app.
 */
export const actividades: GuardifyReportModule = {
    id: "actividades",
    supportsScope: true,
    searchKeys: ["nombre_actividad", "descripcion", "puesto", "sucursal", "contrato"],
    filterKeys: ["tipo_turno", "revision_equipo", "frecuencia", "empresa", "cliente", "division", "contrato", "sucursal", "puesto"],
    sortKeys: ["nombre_actividad", "fecha_inicio", "fecha_fin", "frecuencia", "tipo_turno", "empresa", "cliente", "contrato", "sucursal", "puesto", "plazas", "marcadas"],
    defaultSort: "fecha_inicio",
    async load(db, p) {
        // Límites holgados (un día de margen) para no depender de la zona horaria del servidor; el periodo exacto se aplica después.
        const acts = await queryActividadesReportRows(db, { creadoDesde: `${addDays(p.from, -1)}T00:00:00`, creadoHasta: `${p.to}T23:59:59` }, "fecha");
        return buildActividadesRows(db, acts, p.from, p.to, p.scope);
    },
};
