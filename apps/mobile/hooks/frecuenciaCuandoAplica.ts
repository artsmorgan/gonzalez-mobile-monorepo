/**
 * Frecuencia «Cuando aplica» (#229): la actividad no se repite ni tiene un esperado; se hace cada vez que hace falta (un incidente, una entrega
 * de documentos...). El servidor la muestra siempre en el turno y el reporte cuenta cuántas veces se realizó. El tipo y el título deben coincidir con
 * `apps/server/utils/frecuenciaCuandoAplica.ts` (lo comprueba una prueba). Módulo puro: se prueba en Node.
 */
export const ON_DEMAND_TYPE = 'on-demand';
export const ON_DEMAND_TITLE = 'Cuando aplica';
