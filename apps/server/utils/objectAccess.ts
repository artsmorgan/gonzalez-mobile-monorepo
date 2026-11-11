/**
 * Autorización por objeto (BOLA/IDOR, issue #181). Funciones puras: el que llama pasa la identidad del token y, si hace falta, cómo saber si es
 * administrador. Una ruta que recibe un ID de la URL o del cuerpo debe preguntar aquí ANTES de leer o escribir ese objeto.
 *
 * Reglas:
 *  - `authorizeSelfOrAdmin`: el objeto es la propia persona (p. ej. `attendance/user/[id]`, `check-permissions?id=`).
 *  - `authorizeMarcaAccess`: la marca es del usuario (titular `empleadoFijo_id` o quien lo reemplaza `empleadoReemplaza_id`).
 *  - El administrador (`n_employees_superadmin`) siempre puede. Se consulta solo si hace falta, y un fallo al consultarlo NIEGA el acceso.
 *  - Todo lo dudoso (ids ausentes, no numéricos, marca inexistente) se niega.
 */

export const OBJECT_FORBIDDEN_MESSAGE = "No tiene permiso sobre este recurso";

export type AccessDecision =
    | { allowed: true }
    | { allowed: false; status: 403; code: "permission_denied"; message: string };

const DENIED: AccessDecision = { allowed: false, status: 403, code: "permission_denied", message: OBJECT_FORBIDDEN_MESSAGE };

/** Cuerpo de la respuesta 403 (mismo `code` que `/api/reportes`, para que la app no cierre la sesión: ver `apiFailure.ts`). */
export function denialBody(d: Extract<AccessDecision, { allowed: false }>): { status: false; code: "permission_denied"; message: string } {
    return { status: false, code: d.code, message: d.message };
}

function asId(v: unknown): number | null {
    if (typeof v === "boolean" || v === null || v === undefined || (typeof v === "string" && v.trim() === "")) return null;
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : null;
}

async function adminAllows(isAdmin: (() => Promise<boolean>) | undefined): Promise<boolean> {
    if (!isAdmin) return false;
    try {
        return (await isAdmin()) === true;
    } catch {
        return false; // si no se puede comprobar, no se concede
    }
}

export async function authorizeSelfOrAdmin(p: { callerId: unknown; targetId: unknown; isAdmin?: () => Promise<boolean> }): Promise<AccessDecision> {
    const caller = asId(p.callerId);
    const target = asId(p.targetId);
    if (caller === null || target === null) return DENIED;
    if (caller === target) return { allowed: true };
    return (await adminAllows(p.isAdmin)) ? { allowed: true } : DENIED;
}

export async function authorizeMarcaAccess(p: {
    callerId: unknown;
    marca: { empleadoFijo_id?: unknown; empleadoReemplaza_id?: unknown } | null | undefined;
    isAdmin?: () => Promise<boolean>;
}): Promise<AccessDecision> {
    const caller = asId(p.callerId);
    if (caller === null || !p.marca) return DENIED;
    if (asId(p.marca.empleadoFijo_id) === caller || asId(p.marca.empleadoReemplaza_id) === caller) return { allowed: true };
    return (await adminAllows(p.isAdmin)) ? { allowed: true } : DENIED;
}

/**
 * Rutas de desarrollo y de prueba (p. ej. crear una marca de prueba): solo existen fuera de producción (`APP_MODE=production` las apaga).
 * Cualquier otro valor, incluido el no definido, las deja disponibles para no romper los ambientes de prueba.
 */
export function isDevRouteEnabled(env: Record<string, string | undefined> = process.env): boolean {
    return String(env.APP_MODE ?? "").trim().toLowerCase() !== "production";
}
