/**
 * Peticiones que el servidor ya autenticó por su cuenta (la API de acciones de Guardify: llave + identidad del actor firmada). Sus llamadas a la API
 * dinámica van con el token móvil del servidor y sin JWT de usuario, también las que hacen por debajo las notificaciones, los push y el registro de
 * errores. Solo se marca desde código que verificó la autenticación; el conjunto es interno y no se puede alterar desde fuera.
 */
const peticionesInternas = new WeakSet<object>();

export function markInternalRequest(req: object): void {
    peticionesInternas.add(req);
}

export const isInternalRequest = (req: object): boolean => peticionesInternas.has(req);
