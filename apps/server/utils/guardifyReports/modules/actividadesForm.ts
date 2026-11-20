import type { ReportDataAccess } from "../../reportDynamicPrisma";
import { findByIds, ubicacionTextos } from "../enrich";
import type { FormRecord, GuardifyFormModule } from "../forms";
import { fmtDt } from "../mappers";
import { loadPuestoHierarchy, type Hierarchy } from "../scope";

/**
 * Actividades como formulario: la «Guía de funciones del puesto» (el generador individual arma una hoja por plaza).
 *
 * La fila de la lista es una actividad en un puesto (`e_actividades_puesto`), no una plaza. El registro que se entrega es la guía de las
 * plazas de esa fila: lleva TODAS las actividades asignadas a esas plazas (no solo la de la fila), igual que el papel. Si la fila no
 * tiene plazas válidas (o solo plazas con «@», que el generador omite), se entrega únicamente su propia actividad.
 * Nunca se entregan la bitácora, los artículos, los archivos ni la firma del responsable que guardan las tablas de actividades.
 */
const txt = (v: unknown): string | null => { const s = String(v ?? "").trim(); return s ? s : null; };

/** Títulos de la frecuencia (`[{ title, schedule }]` en JSON), como los imprime el generador. */
export function frecuenciaTitulos(raw: unknown): string {
    if (raw == null || String(raw).trim() === "") return "";
    try {
        const p = JSON.parse(String(raw));
        if (Array.isArray(p)) return p.map((x: any) => (x && typeof x === "object" && x.title != null ? String(x.title) : "")).filter(Boolean).join(", ");
        if (p && typeof p === "object" && p.title != null) return String(p.title);
    } catch {
        return String(raw).slice(0, 200);
    }
    return "";
}

/** Horarios `HH:mm` de la frecuencia (propiedad `schedule`), sin repetir y en orden. */
export function frecuenciaHorarios(raw: unknown): string {
    if (raw == null || String(raw).trim() === "") return "";
    try {
        const p = JSON.parse(String(raw));
        const pick = (o: unknown): string[] => (o && typeof o === "object" && Array.isArray((o as any).schedule) ? (o as any).schedule.filter((x: unknown) => typeof x === "string" && /^\d{2}:\d{2}$/.test(String(x).trim())).map((x: string) => x.trim()) : []);
        const parts = Array.isArray(p) ? p.flatMap(pick) : pick(p);
        return [...new Set(parts)].sort().join(", ");
    } catch {
        return "";
    }
}

/** El generador omite las plazas «virtuales» (código con «@»). */
const plazaValida = (pl: any): boolean => !String(pl?.codigo_plaza ?? "").includes("@");

export type ActividadesRaw = {
    /** Id de la fila de la lista (`e_actividades_puesto.id`). */
    id: number;
    puesto: { id: number; codigo: string | null; nombre: string | null };
    /** Plazas de la fila (ya sin las que tienen «@»). */
    plazas: { id: number; nombre: string | null }[];
    /** Actividades de la guía, ya en el orden del papel (la más reciente primero). */
    actividades: { id: number; nombre_actividad: string | null; frecuencia: string | null }[];
    hier: Hierarchy;
};

export function armarRegistro(raw: ActividadesRaw, ubic: FormRecord["estructura"], _firmas: boolean): FormRecord {
    const plaza = raw.plazas.map((p) => txt(p.nombre) ?? `ID ${p.id}`).join(", ");
    const filas = raw.actividades.map((a, i) => ({
        numero: i + 1,
        actividad: txt(a.nombre_actividad)?.slice(0, 8000) ?? null,
        frecuencia: txt(frecuenciaTitulos(a.frecuencia)),
        horario: txt(frecuenciaHorarios(a.frecuencia)),
    }));
    return {
        id: Number(raw.id),
        variante: null,
        // La actividad no guarda cuándo se registró: el papel no lleva fecha.
        creado: null,
        estructura: ubic,
        valores: {
            cliente: ubic.cliente,
            puesto_no: txt(raw.puesto.codigo) ?? String(raw.puesto.id),
            puesto_nombre: txt(raw.puesto.nombre),
            plaza: txt(plaza),
        },
        listas: { actividades: filas },
        // La guía no lleva firmas.
        firmas: {},
        firmasPresentes: [],
        hier: raw.hier,
    };
}

export const actividadesForm: GuardifyFormModule = {
    async loadRecords(db: ReportDataAccess, ids) {
        const d = db as any;
        // 1. Las filas pedidas y sus plazas (sin bitácora, artículos ni archivos).
        const pedidas = await d.e_actividades_puesto.findMany({ where: { id: { in: ids } }, select: { id: true, actividad_id: true, puesto_id: true } });
        if (!pedidas.length) return [];
        const pedidasIds = pedidas.map((x: any) => Number(x.id));
        const propias = await d.e_actividades_puesto_plaza.findMany({ where: { actividad_puesto_id: { in: pedidasIds } }, select: { actividad_puesto_id: true, plaza_id: true } });
        const plazas = await findByIds<any>(d, "e_estructura_plazas", propias.map((x: any) => x.plaza_id), { nombre: true, codigo_plaza: true });
        const plazasDeFila = new Map<number, number[]>();
        for (const x of propias) {
            if (!plazaValida(plazas.get(Number(x.plaza_id)))) continue;
            const list = plazasDeFila.get(Number(x.actividad_puesto_id)) ?? [];
            if (!list.includes(Number(x.plaza_id))) list.push(Number(x.plaza_id));
            plazasDeFila.set(Number(x.actividad_puesto_id), list);
        }
        // 2. Todas las actividades de esas plazas (la guía completa), con una consulta para todos los registros.
        const plazaIds = [...new Set([...plazasDeFila.values()].flat())];
        const deLasPlazas: any[] = plazaIds.length ? await d.e_actividades_puesto_plaza.findMany({ where: { plaza_id: { in: plazaIds } }, select: { actividad_puesto_id: true, plaza_id: true } }) : [];
        const apPorPlaza = new Map<number, Set<number>>();
        for (const x of deLasPlazas) {
            const set = apPorPlaza.get(Number(x.plaza_id)) ?? new Set<number>();
            set.add(Number(x.actividad_puesto_id));
            apPorPlaza.set(Number(x.plaza_id), set);
        }
        const aps = await findByIds<any>(d, "e_actividades_puesto", [...pedidasIds, ...deLasPlazas.map((x) => x.actividad_puesto_id)], { actividad_id: true, puesto_id: true });
        const acts = await findByIds<any>(d, "e_actividades", [...aps.values()].map((x) => x.actividad_id), { nombre_actividad: true, fecha_inicio: true, frecuencia: true });
        // 3. El puesto de cada fila y dónde queda en la estructura.
        const puestoIds = pedidas.map((x: any) => x.puesto_id);
        const puestos = await findByIds<any>(d, "e_estructura_puesto", puestoIds, { codigo: true, nombre: true });
        const hier = await loadPuestoHierarchy(d, puestoIds.map(Number));
        const hierDe = (puesto: unknown): Hierarchy => hier.get(Number(puesto)) ?? {};
        const ubic = await ubicacionTextos(d, pedidas.map((x: any) => hierDe(x.puesto_id)));

        const actividadesDe = (apIds: Iterable<number>): ActividadesRaw["actividades"] => {
            const vistas = new Set<number>();
            const out: { id: number; nombre_actividad: string | null; frecuencia: string | null; fecha: string }[] = [];
            for (const apId of apIds) {
                const ap = aps.get(Number(apId));
                const act = ap ? acts.get(Number(ap.actividad_id)) : undefined;
                if (!act || vistas.has(Number(act.id))) continue;
                vistas.add(Number(act.id));
                out.push({ id: Number(act.id), nombre_actividad: act.nombre_actividad ?? null, frecuencia: act.frecuencia ?? null, fecha: fmtDt(act.fecha_inicio) ?? "" });
            }
            // Como la consulta original: la actividad más reciente primero.
            out.sort((x, y) => (x.fecha < y.fecha ? 1 : x.fecha > y.fecha ? -1 : x.id - y.id));
            return out.map(({ id, nombre_actividad, frecuencia }) => ({ id, nombre_actividad, frecuencia }));
        };

        return pedidas.map((p: any) => {
            const pl = plazasDeFila.get(Number(p.id)) ?? [];
            const apIds = pl.length ? new Set(pl.flatMap((z) => [...(apPorPlaza.get(z) ?? [])])) : new Set([Number(p.id)]);
            const pu = puestos.get(Number(p.puesto_id));
            const raw: ActividadesRaw = {
                id: Number(p.id),
                puesto: { id: Number(p.puesto_id), codigo: pu?.codigo ?? null, nombre: pu?.nombre ?? null },
                plazas: pl.map((z) => ({ id: z, nombre: plazas.get(z)?.nombre ?? null })),
                actividades: actividadesDe(apIds),
                hier: hierDe(p.puesto_id),
            };
            return armarRegistro(raw, ubic(hierDe(p.puesto_id)), false);
        });
    },
};
