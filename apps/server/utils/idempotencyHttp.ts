import { claveValida, ejecutarIdempotente, guardStore, IdemStoreError, type IdempotencyStore } from "./idempotency";

/**
 * Envoltorio HTTP de la idempotencia para una ruta de escritura: lee `Idempotency-Key`, y si viene, la misma clave sobre la misma acción devuelve el
 * resultado ya guardado en lugar de ejecutar otra vez. Sin la cabecera, la ruta se comporta como siempre (los clientes anteriores siguen funcionando).
 *
 * `onStoreError`: qué hacer si el almacén falla antes de ejecutar. Las rutas de la app siguen SIN idempotencia (`"run"`, disponibilidad primero: así
 * funcionaban antes) y la API de acciones de Guardify se niega (`"fail"`: «nada se da por hecho»).
 */
export type IdemHttpOptions = {
    store: IdempotencyStore;
    /** Qué acción es: `permisos:aprobar`, `attendance:PUT`… */
    ambito: string;
    /** Sobre qué registro. */
    recurso: string;
    actorId: number | null;
    onStoreError: "run" | "fail";
    /** Tiene que haber una clave (la API de acciones de Guardify la exige). */
    required?: boolean;
    /** Cuerpo de las respuestas de error; por defecto el de las rutas de la app. */
    errorBody?: (code: "invalid_request" | "conflict" | "store_unavailable", message: string) => unknown;
    now?: () => Date;
};

export const IDEMPOTENCY_HEADER = "idempotency-key";

const defaultErrorBody = (code: string, message: string) => ({ status: false, code, message });
const jsonResponse = (body: unknown, status: number, extra: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra } });

/** Clave del encabezado (o la de `fallback`, p. ej. el cuerpo): `null` si no hay ninguna. */
export const readIdempotencyKey = (req: Pick<Request, "headers">, fallback?: unknown): string | null => {
    const raw = (req.headers.get(IDEMPOTENCY_HEADER) ?? (typeof fallback === "string" ? fallback : "")).trim();
    return raw || null;
};

export async function conIdempotencia(key: string | null, opts: IdemHttpOptions, run: () => Promise<Response>): Promise<Response> {
    const err = opts.errorBody ?? defaultErrorBody;
    if (key === null) {
        if (opts.required) return jsonResponse(err("invalid_request", "Falta la clave de idempotencia."), 400);
        return run();
    }
    if (!claveValida(key)) return jsonResponse(err("invalid_request", "La clave de idempotencia debe tener entre 16 y 128 caracteres visibles, sin espacios."), 400);

    const holder: { res: Response | null } = { res: null };
    let outcome;
    try {
        outcome = await ejecutarIdempotente({
            store: guardStore(opts.store),
            clave: key,
            ambito: opts.ambito,
            recurso: opts.recurso,
            actorId: opts.actorId,
            now: opts.now,
            run: async () => {
                holder.res = await run();
                return { status: holder.res.status, body: await holder.res.clone().text() };
            },
        });
    } catch (e) {
        if (!(e instanceof IdemStoreError)) throw e;
        console.error("[idempotencia] almacén no disponible:", e.message);
        if (opts.onStoreError === "run") return run();
        return jsonResponse(err("store_unavailable", "No se pudo comprobar la clave de idempotencia; no se hizo nada. Reintenta en un momento."), 503);
    }

    switch (outcome.kind) {
        case "ejecutado":
            return holder.res!;
        case "repetido":
            return new Response(outcome.body, { status: outcome.status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "idempotent-replay": "true" } });
        case "en_curso":
            return jsonResponse(err("conflict", "Hay otra petición en curso con esta clave de idempotencia. Espera un momento y revisa el estado."), 409);
        case "conflicto":
            return jsonResponse(err("conflict", "Esta clave de idempotencia ya se usó con otra acción, otro registro u otra persona."), 409);
    }
}
