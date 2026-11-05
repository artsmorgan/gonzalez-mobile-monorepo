/**
 * Un mismo almuerzo no se registra dos veces (issue #158). La app puede enviar la misma acción de la cola más de una vez (dos caminos de
 * sincronización, un reintento tras perder la respuesta). Es el mismo almuerzo si coinciden el empleado, la marca, el inicio y el fin.
 */
export function whereAlmuerzoDuplicado(p: { empleadoId: number; marcaId: number; inicio: Date; fin: Date }) {
    return { empleadoId: p.empleadoId, marca_id: p.marcaId, inicio: p.inicio.toISOString(), fin: p.fin.toISOString(), isActive: true };
}
