/**
 * «Mis puestos»: los puestos a los que pertenece un empleado según sus marcas (`c_marca_dia.puesto_id`) donde es el fijo (`empleadoFijo_id`) o el
 * reemplazo (`empleadoReemplaza_id`) y cuya fecha es la de hoy o posterior. Módulo puro (sin base de datos) para probarlo.
 */

/** Costa Rica no tiene horario de verano: siempre UTC-6. */
const CR_OFFSET_MS = 6 * 60 * 60 * 1000;

/** Fecha de hoy en Costa Rica como `AAAA-MM-DD`, sin depender de la zona horaria del servidor. */
export function hoyEnCostaRica(now: Date = new Date()): string {
    return new Date(now.getTime() - CR_OFFSET_MS).toISOString().slice(0, 10);
}

/** La fecha de hoy (CR) como `Date` a medianoche UTC, que es como se guarda y compara `c_marca_dia.fecha` (columna DATE). */
export function hoyEnCostaRicaComoFecha(now: Date = new Date()): Date {
    return new Date(`${hoyEnCostaRica(now)}T00:00:00.000Z`);
}

export type MarcaDePuesto = { puesto_id: number | null; fecha: Date | string };

/** `puesto_id` → fecha (`AAAA-MM-DD`) de su marca más próxima. Ignora marcas sin puesto o con fecha inválida. */
export function proximaFechaPorPuesto(marcas: MarcaDePuesto[]): Map<number, string> {
    const out = new Map<number, string>();
    for (const m of marcas) {
        const puestoId = Number(m.puesto_id);
        if (!Number.isFinite(puestoId) || puestoId <= 0) continue;
        const d = m.fecha instanceof Date ? m.fecha : new Date(m.fecha);
        if (Number.isNaN(d.getTime())) continue;
        const dia = d.toISOString().slice(0, 10);
        const previa = out.get(puestoId);
        if (!previa || dia < previa) out.set(puestoId, dia);
    }
    return out;
}

export type PuestoRow = {
    id: number;
    nombre: string | null;
    codigo: string | null;
    sucursal_id: number | null;
    coordenadas_gpslat: string | null;
    coordenadas_gpslng: string | null;
};

export type MiPuesto = {
    id: number;
    codigo: string | null;
    nombre: string;
    sucursal: { id: number; nombre: string } | null;
    ubicacion: { lat: number | null; lng: number | null };
    proxima_fecha: string | null;
};

const coord = (v: string | null | undefined): number | null => {
    if (v === null || v === undefined || String(v).trim() === "") return null;
    const n = parseFloat(String(v));
    return Number.isFinite(n) ? n : null;
};

/** Arma la respuesta ordenada por nombre del puesto (sin repetidos). */
export function armarMisPuestos(puestos: PuestoRow[], proximas: Map<number, string>, sucursales: Map<number, string>): MiPuesto[] {
    return puestos
        .map((p) => ({
            id: p.id,
            codigo: p.codigo ?? null,
            nombre: String(p.nombre ?? "").trim() || `Puesto #${p.id}`,
            sucursal: p.sucursal_id && sucursales.has(p.sucursal_id) ? { id: p.sucursal_id, nombre: sucursales.get(p.sucursal_id)! } : null,
            ubicacion: { lat: coord(p.coordenadas_gpslat), lng: coord(p.coordenadas_gpslng) },
            proxima_fecha: proximas.get(p.id) ?? null,
        }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}
