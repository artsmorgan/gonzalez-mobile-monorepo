/**
 * Frecuencia «Cuando aplica» (#229): `{"type":"on-demand","title":"Cuando aplica"}`.
 * No se repite ni tiene esperado: `getActivities` la muestra siempre dentro de su vigencia (fecha de inicio y de fin) y del turno, sin arrastrar
 * pendientes de turnos anteriores, y no cuenta en el % de cumplimiento; el reporte la cuenta como «veces realizada» (filas marcadas).
 * Módulo puro (sin base de datos): se prueba en Node. El tipo y el título deben coincidir con `apps/mobile/hooks/frecuenciaCuandoAplica.ts`.
 */
export const ON_DEMAND_TYPE = "on-demand";
export const ON_DEMAND_TITLE = "Cuando aplica";

/** El JSON que se guarda en `e_actividades.frecuencia`. */
export function construirFrecuenciaCuandoAplica(horarios: string[] = []): string {
    const config: Record<string, unknown> = { type: ON_DEMAND_TYPE, interval: 1, endType: "never", title: ON_DEMAND_TITLE };
    if (horarios.length > 0) config.schedule = horarios;
    return JSON.stringify(config);
}

/** ¿Esta frecuencia (JSON guardado) es «Cuando aplica»? Tolera nulos, texto que no es JSON y otros tipos. */
export function esCuandoAplica(frecuencia: unknown): boolean {
    if (frecuencia == null) return false;
    try {
        const cfg = typeof frecuencia === "string" ? JSON.parse(frecuencia) : frecuencia;
        return !!cfg && typeof cfg === "object" && (cfg as { type?: unknown }).type === ON_DEMAND_TYPE;
    } catch {
        return false;
    }
}

/**
 * Dentro de la vigencia de la actividad: desde `fecha_inicio` hasta `fecha_fin` (ambas incluidas, comparadas por día). Sin `fecha_fin` no termina.
 * Las fechas son «de pared» (como el resto de la base), así que se comparan por año, mes y día.
 */
export function vigenteCuandoAplica(inicio: Date, hoy: Date, fin?: Date | null): boolean {
    const dia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    if (Number.isNaN(inicio.getTime()) || Number.isNaN(hoy.getTime())) return false;
    if (dia(hoy) < dia(inicio)) return false;
    if (fin && !Number.isNaN(fin.getTime()) && dia(hoy) > dia(fin)) return false;
    return true;
}
