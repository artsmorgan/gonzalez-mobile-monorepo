/**
 * Conflicto (HTTP 409) de la API de Planillas al marcar entrada o salida. Planillas lo usa para decir que la marca no se puede marcar, por ejemplo:
 *
 *   {"success":false,"error":{"code":"MARCA_NO_MARCABLE","message":"La marca corresponde a un día libre o no tiene un turno asignado; no es posible marcarla.","details":[]}}
 *
 * `axios` lanza una excepción con cualquier 4xx/5xx; sin tratarlo, el 409 terminaba en el `catch` general como un 500 con «Request failed with status code 409».
 * Aquí se reconoce ese caso y se extrae el `message` de Planillas para devolvérselo a la persona tal cual. Módulo puro (sin axios ni Next).
 */
export type PlanillasConflict = { message: string; code: string | null };

const MENSAJE_POR_DEFECTO = "Planillas no permite marcar esta marca.";

/** Lee el `message` de un cuerpo de error de Planillas (`error.message`, o `message` suelto). */
function mensajeDelCuerpo(data: unknown): { message: string | null; code: string | null } {
    let body: unknown = data;
    if (typeof data === "string") {
        try {
            body = JSON.parse(data);
        } catch {
            return { message: data.trim() || null, code: null };
        }
    }
    if (!body || typeof body !== "object") return { message: null, code: null };
    const b = body as { error?: unknown; message?: unknown };
    const err = b.error && typeof b.error === "object" ? (b.error as { message?: unknown; code?: unknown }) : null;
    const message = [err?.message, typeof b.error === "string" ? b.error : null, b.message].find((m) => typeof m === "string" && m.trim()) as string | undefined;
    const code = typeof err?.code === "string" && err.code.trim() ? err.code.trim() : null;
    return { message: message ? message.trim() : null, code };
}

/**
 * Si `error` es una excepción de axios con respuesta 409 de Planillas, devuelve su mensaje (y código); si no, `null` y el error sigue su camino normal.
 * Un 409 sin mensaje legible devuelve un texto genérico en vez de dejar la respuesta vacía.
 */
export function extractPlanillasConflict(error: unknown): PlanillasConflict | null {
    const response = (error as { response?: { status?: unknown; data?: unknown } } | null | undefined)?.response;
    if (!response || Number(response.status) !== 409) return null;
    const { message, code } = mensajeDelCuerpo(response.data);
    return { message: message ?? MENSAJE_POR_DEFECTO, code };
}

/** Cuerpo de la respuesta de la ruta ante un conflicto: el `message` de Planillas, sin inventar ni cambiar el texto. */
export function conflictBody(conflict: PlanillasConflict): { status: false; message: string; code?: string; planillas_conflict: true } {
    return { status: false, message: conflict.message, ...(conflict.code ? { code: conflict.code } : {}), planillas_conflict: true };
}
