/**
 * Marcas de un mismo día de un empleado que traen datos incompletos. Módulo puro (sin base de datos) para probarlo.
 *
 * Una marca «sin datos» no tiene `tipo_turno` ni `hora_inicio` ni `hora_fin`. Cuando un día llega con VARIAS marcas:
 *   - se descartan las que no tienen datos y se conservan las demás (si queda una sola, es la que se toma);
 *   - si ninguna tiene datos, el día es «Libre»: se deja una sola marca de ese día con `tipo_turno = "L"`. Para el turno actual se trata como día libre, el
 *     siguiente turno la ignora (pasa al siguiente) y la lista de turnos futuros dice «Tienes libre este día».
 * Un día con una sola marca no se toca (se muestra con normalidad aunque le falten datos).
 */
export type MarcaConDatos = { id?: number; tipo_turno?: unknown; hora_inicio?: unknown; hora_fin?: unknown };

const vacio = (v: unknown): boolean => v === null || v === undefined || String(v).trim() === "";

/** No tiene tipo de turno ni hora de inicio ni hora de fin. */
export function marcaSinDatos(m: MarcaConDatos): boolean {
    return vacio(m.tipo_turno) && vacio(m.hora_inicio) && vacio(m.hora_fin);
}

/** Tiene tipo de turno, hora de inicio y hora de fin. */
export function marcaCompleta(m: MarcaConDatos): boolean {
    return !vacio(m.tipo_turno) && !vacio(m.hora_inicio) && !vacio(m.hora_fin);
}

/** Marcas de un solo día: ver la descripción del módulo. Conserva el orden recibido. */
export function depurarMarcasDeUnDia<T extends MarcaConDatos>(marcas: T[]): T[] {
    if (marcas.length <= 1) return marcas;
    const conDatos = marcas.filter((m) => !marcaSinDatos(m));
    if (conDatos.length > 0) return conDatos;
    // Ninguna tiene datos: día libre, representado por una sola marca (la de menor id).
    const base = [...marcas].sort((a, b) => Number(a.id ?? 0) - Number(b.id ?? 0))[0]!;
    return [{ ...base, tipo_turno: "L" }];
}

/** Aplica `depurarMarcasDeUnDia` a cada día (`diaDe` da la clave del día de una marca) conservando el orden general. */
export function depurarMarcasPorDia<T extends MarcaConDatos>(marcas: T[], diaDe: (m: T) => string): T[] {
    const porDia = new Map<string, T[]>();
    for (const m of marcas) {
        const dia = diaDe(m);
        porDia.set(dia, [...(porDia.get(dia) ?? []), m]);
    }
    const aceptadas = new Set<T>();
    for (const grupo of porDia.values()) for (const m of depurarMarcasDeUnDia(grupo)) aceptadas.add(m);
    // Los días libres devuelven una copia nueva (con tipo «L»): se reemplaza en la posición de la primera marca del día.
    const resultado: T[] = [];
    const diasLibresYaPuestos = new Set<string>();
    for (const m of marcas) {
        if (aceptadas.has(m)) {
            resultado.push(m);
            continue;
        }
        const dia = diaDe(m);
        if (diasLibresYaPuestos.has(dia)) continue;
        const copiaLibre = depurarMarcasDeUnDia(porDia.get(dia) ?? []).find((x) => !aceptadas.has(x) && String(x.tipo_turno) === "L");
        if (copiaLibre) {
            diasLibresYaPuestos.add(dia);
            resultado.push(copiaLibre);
        }
    }
    return resultado;
}

/**
 * Turno propio (el empleado es el titular) que hoy cubre otra persona (tiene un empleado de reemplazo distinto del titular): el empleado ya no lo trabaja,
 * así que no se ofrece para intercambiar en un mutuo acuerdo. Un turno que el empleado cubre como reemplazo de otro SÍ se ofrece.
 */
export function esTurnoPropioCubiertoPorOtro(m: { empleadoFijo_id?: unknown; empleadoReemplaza_id?: unknown }, empleadoId: number): boolean {
    const fijo = Number(m.empleadoFijo_id);
    const reemplazo = m.empleadoReemplaza_id == null ? null : Number(m.empleadoReemplaza_id);
    return fijo === empleadoId && reemplazo != null && Number.isFinite(reemplazo) && reemplazo > 0 && reemplazo !== empleadoId;
}
