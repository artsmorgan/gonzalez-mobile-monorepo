import type { IdemRecord, IdempotencyStore } from "./idempotency";

/**
 * Almacén de idempotencia sobre la tabla `c_clave_idempotencia` (migración `20261027120001_clave_idempotencia` de gonzalez-mobile-dynamic-api), accedida por la
 * API dinámica igual que la evidencia (`c_evidencia_registro`): las tablas nuevas viven en la base de la API dinámica, que NO es la que lee el Prisma directo de
 * este servidor, así que no hay modelo ni `db pull` aquí. `call` es `callDynamicPrisma` ya atada a la petición (`env.call` en las acciones de Guardify).
 * La clave única `clave_hash` hace de candado: dos peticiones con la misma clave nunca reservan las dos.
 */
export type DynamicCall = (data: Record<string, any>) => Promise<any>;

const TABLE = "c_clave_idempotencia";

/** La API dinámica devuelve el mensaje de Prisma: una violación de la clave única dice «Unique constraint failed». */
const esDuplicado = (e: unknown): boolean => /unique constraint/i.test(e instanceof Error ? e.message : String(e));

const fecha = (v: unknown): Date => (v instanceof Date ? v : new Date(String(v)));

type Row = { clave_hash: string; ambito: string; recurso: string; actor_id: number | null; estado: string; http_status: number | null; respuesta: string | null; creado: string | Date; expira: string | Date };

const toRecord = (r: Row): IdemRecord => ({
    claveHash: r.clave_hash,
    ambito: r.ambito,
    recurso: r.recurso,
    actorId: r.actor_id === null || r.actor_id === undefined ? null : Number(r.actor_id),
    estado: r.estado === "completada" ? "completada" : "en_curso",
    httpStatus: r.http_status === null || r.http_status === undefined ? null : Number(r.http_status),
    respuesta: r.respuesta ?? null,
    creado: fecha(r.creado),
    expira: fecha(r.expira),
});

export function dynamicIdempotencyStore(call: DynamicCall): IdempotencyStore {
    return {
        async reservar(rec) {
            try {
                await call({ action: "POST", table: TABLE, operation: "create", returning: false, data: { clave_hash: rec.claveHash, ambito: rec.ambito, recurso: rec.recurso, actor_id: rec.actorId, estado: rec.estado, creado: rec.creado.toISOString(), expira: rec.expira.toISOString() } });
                return true;
            } catch (e) {
                if (esDuplicado(e)) return false;
                throw e;
            }
        },
        async leer(claveHash) {
            const r = await call({ action: "GET", table: TABLE, operation: "findUnique", where: { clave_hash: claveHash } });
            return r ? toRecord(r as Row) : null;
        },
        async completar(claveHash, httpStatus, respuesta) {
            await call({ action: "UPDATE", table: TABLE, where: { clave_hash: claveHash }, data: { estado: "completada", http_status: httpStatus, respuesta }, returning: false });
        },
        async liberar(claveHash) {
            await call({ action: "DELETE", table: TABLE, operation: "deleteMany", where: { clave_hash: claveHash } });
        },
    };
}
