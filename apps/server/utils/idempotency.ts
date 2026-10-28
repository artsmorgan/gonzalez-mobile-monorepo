import crypto from "node:crypto";

/**
 * Idempotencia del servidor (issues #172 y #181; protocolo de acciones de Guardify): la misma `Idempotency-Key` sobre la misma acción devuelve el
 * MISMO resultado sin repetir el efecto, aunque el estado del registro ya haya cambiado por esa acción; la misma clave con otra acción, otro
 * registro u otra persona es un conflicto.
 *
 * La lógica es pura y trabaja contra un almacén (`IdempotencyStore`): en producción la tabla `c_clave_idempotencia` (ver `idempotencyDynamicStore.ts`),
 * en las pruebas uno en memoria. La RESERVA de la clave es el candado entre procesos: `reservar` inserta con clave única y solo una petición gana.
 */

export type IdemState = "en_curso" | "completada";

export type IdemRecord = {
    /** SHA-256 de la clave que mandó el cliente (la clave en claro no se guarda). */
    claveHash: string;
    ambito: string;
    recurso: string;
    actorId: number | null;
    estado: IdemState;
    httpStatus: number | null;
    respuesta: string | null;
    creado: Date;
    expira: Date;
};

export interface IdempotencyStore {
    /** Inserta la reserva si la clave no existe. `false` si ya existía (otra petición la tomó antes). Debe ser atómico. */
    reservar(rec: IdemRecord): Promise<boolean>;
    leer(claveHash: string): Promise<IdemRecord | null>;
    completar(claveHash: string, httpStatus: number, respuesta: string): Promise<void>;
    /** Borra la reserva (la acción falló o no dejó resultado definitivo): la misma clave podrá reintentarse. */
    liberar(claveHash: string): Promise<void>;
}

/** Una reserva «en curso» más vieja que esto se considera abandonada (el proceso murió a mitad de la acción) y se puede retomar. */
export const IDEM_EN_CURSO_MAX_MS = 10 * 60_000;
/** Cuánto se recuerda un resultado: lo que tarda en reintentar una cola sin conexión más un margen. */
export const IDEM_RETENCION_MS = 30 * 24 * 60 * 60_000;
export const IDEM_MIN_LEN = 16;
export const IDEM_MAX_LEN = 128;

export const hashClave = (clave: string): string => crypto.createHash("sha256").update(clave, "utf8").digest("hex");

/** Una clave válida es texto de 16 a 128 caracteres sin espacios ni saltos de línea. */
export const claveValida = (clave: unknown): clave is string => typeof clave === "string" && clave.length >= IDEM_MIN_LEN && clave.length <= IDEM_MAX_LEN && /^[\x21-\x7e]+$/.test(clave);

export type IdemRun = { status: number; body: string; headers?: Record<string, string> };

export type IdemOutcome =
    /** Se ejecutó ahora. */
    | { kind: "ejecutado"; run: IdemRun }
    /** La misma clave y la misma acción ya tenían resultado: se devuelve ese, sin ejecutar. */
    | { kind: "repetido"; status: number; body: string }
    /** Otra petición con esa clave sigue ejecutándose. */
    | { kind: "en_curso" }
    /** La clave ya se usó con otra acción, otro registro u otra persona. */
    | { kind: "conflicto" };

export type IdemInput = {
    store: IdempotencyStore;
    clave: string;
    /** Qué acción es (p. ej. `permisos:aprobar`). */
    ambito: string;
    /** Sobre qué registro (p. ej. el id). */
    recurso: string;
    actorId: number | null;
    now?: () => Date;
    /** Ejecuta la acción. Solo un resultado 2xx queda guardado; cualquier otro libera la clave para que se pueda reintentar (p. ej. tras abrir sesión en Planillas). */
    run: () => Promise<IdemRun>;
};

const esMisma = (r: IdemRecord, i: { ambito: string; recurso: string; actorId: number | null }): boolean => r.ambito === i.ambito && r.recurso === i.recurso && r.actorId === i.actorId;

export async function ejecutarIdempotente(input: IdemInput): Promise<IdemOutcome> {
    const now = input.now ?? (() => new Date());
    const claveHash = hashClave(input.clave);
    const t0 = now();
    const reserva: IdemRecord = { claveHash, ambito: input.ambito, recurso: input.recurso, actorId: input.actorId, estado: "en_curso", httpStatus: null, respuesta: null, creado: t0, expira: new Date(t0.getTime() + IDEM_RETENCION_MS) };

    // Hasta dos vueltas: la segunda solo ocurre si la reserva que bloqueaba estaba vencida, abandonada o desapareció, y se pudo retomar.
    let reservada = false;
    for (let intento = 0; intento < 2 && !reservada; intento++) {
        if (await input.store.reservar(reserva)) { reservada = true; break; }
        const previa = await input.store.leer(claveHash);
        if (!previa) continue;
        const ahora = now();
        const vencida = previa.expira.getTime() <= ahora.getTime() || (previa.estado === "en_curso" && ahora.getTime() - previa.creado.getTime() > IDEM_EN_CURSO_MAX_MS);
        if (vencida) { await input.store.liberar(claveHash); continue; }
        if (!esMisma(previa, input)) return { kind: "conflicto" };
        if (previa.estado === "en_curso") return { kind: "en_curso" };
        return { kind: "repetido", status: previa.httpStatus ?? 200, body: previa.respuesta ?? "" };
    }
    // Dos vueltas sin poder reservar ni decidir: otra petición la tomó justo ahora.
    if (!reservada) return { kind: "en_curso" };

    let run: IdemRun;
    try {
        run = await input.run();
    } catch (e) {
        // El error original de la acción es el que importa; que la liberación también falle no debe taparlo.
        await input.store.liberar(claveHash).catch(() => undefined);
        throw e;
    }
    // Que el almacén falle al guardar el resultado no debe convertir en error una acción que ya se hizo: se informa el éxito y se deja constancia.
    try {
        if (run.status >= 200 && run.status < 300) await input.store.completar(claveHash, run.status, run.body);
        else await input.store.liberar(claveHash);
    } catch (e) {
        console.error("[idempotencia] no se pudo registrar el resultado de la acción:", e instanceof Error ? e.message : e);
    }
    return { kind: "ejecutado", run };
}

/** El almacén falló (base de datos caída, tabla ausente…) ANTES de ejecutar la acción: quien llama decide si sigue sin idempotencia o se niega. */
export class IdemStoreError extends Error {
    constructor(public cause: unknown) {
        super(cause instanceof Error ? cause.message : String(cause));
    }
}

/** Envuelve un almacén para que cualquier fallo suyo salga como `IdemStoreError` y se distinga de un error de la acción. */
export function guardStore(store: IdempotencyStore): IdempotencyStore {
    const g = <A extends unknown[], R>(f: (...a: A) => Promise<R>) => async (...a: A): Promise<R> => {
        try { return await f(...a); } catch (e) { throw new IdemStoreError(e); }
    };
    return { reservar: g(store.reservar.bind(store)), leer: g(store.leer.bind(store)), completar: store.completar.bind(store), liberar: store.liberar.bind(store) };
}

/** Almacén en memoria: para las pruebas y para un entorno sin base de datos. No sirve entre procesos. */
export function memoryIdempotencyStore(): IdempotencyStore & { rows: Map<string, IdemRecord> } {
    const rows = new Map<string, IdemRecord>();
    return {
        rows,
        async reservar(rec) {
            if (rows.has(rec.claveHash)) return false;
            rows.set(rec.claveHash, { ...rec });
            return true;
        },
        async leer(h) {
            const r = rows.get(h);
            return r ? { ...r } : null;
        },
        async completar(h, httpStatus, respuesta) {
            const r = rows.get(h);
            if (r) rows.set(h, { ...r, estado: "completada", httpStatus, respuesta });
        },
        async liberar(h) {
            rows.delete(h);
        },
    };
}
