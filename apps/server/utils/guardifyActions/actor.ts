import crypto from "node:crypto";

/**
 * Identidad del actor que Guardify dice representar (protocolo de acciones, `docs/protocolo-acciones.md` de Guardify):
 *   x-guardify-actor     = base64url(JSON { actor: { email, name, externalId?, cedula? }, ts, tenant })
 *   x-guardify-actor-sig = hex(HMAC-SHA256(llave, valor de x-guardify-actor))
 * La llave es la misma que autentica a Guardify (`GUARDIFY_REPORTS_API_KEY`). Se valida la firma, la vigencia (5 minutos) y se devuelve quién es.
 */
export const ACTOR_HEADER = "x-guardify-actor";
export const ACTOR_SIG_HEADER = "x-guardify-actor-sig";
export const ACTOR_MAX_SKEW_MS = 5 * 60_000;

export type GuardifyActor = { email: string; name: string; externalId?: string; cedula?: string };
export type ActorClaims = { actor: GuardifyActor; ts: number; tenant: string };

const mac = (key: string, payload: string) => crypto.createHmac("sha256", key).update(payload).digest("hex");

export function verifyActorHeaders(headers: Pick<Headers, "get">, key: string, now = Date.now()): ActorClaims | null {
    const payload = (headers.get(ACTOR_HEADER) ?? "").trim();
    const sig = (headers.get(ACTOR_SIG_HEADER) ?? "").trim();
    if (!key || !payload || !/^[0-9a-f]{64}$/i.test(sig)) return null;
    const expected = Buffer.from(mac(key, payload), "hex");
    const got = Buffer.from(sig, "hex");
    if (expected.length !== got.length || !crypto.timingSafeEqual(expected, got)) return null;
    let claims: ActorClaims;
    try {
        claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    } catch {
        return null;
    }
    if (typeof claims?.ts !== "number" || Math.abs(now - claims.ts) > ACTOR_MAX_SKEW_MS) return null;
    if (!claims.actor || typeof claims.actor.email !== "string" || !claims.actor.email || typeof claims.tenant !== "string") return null;
    return claims;
}

export type ActorEmployee = { id: number; supervisorId: number | null };

/**
 * Quién es el actor en la app. Se prueba, en este orden: `externalId` (id del empleado), `cedula` y correo; cada uno debe dar UNA sola persona
 * (si hay dos, no se adivina). Sin coincidencia clara → `null` y la acción se niega (`out_of_scope`).
 */
export async function resolveActorEmployee(db: any, actor: GuardifyActor): Promise<ActorEmployee | null> {
    const pick = (e: any): ActorEmployee => ({ id: Number(e.id), supervisorId: e.supervisor_id != null ? Number(e.supervisor_id) : null });
    const select = { id: true, supervisor_id: true };
    const ext = Number(actor.externalId);
    if (actor.externalId && Number.isInteger(ext) && ext > 0) {
        const e = await db.c_empleado.findUnique({ where: { id: ext }, select });
        if (e) return pick(e);
    }
    const ced = (actor.cedula ?? "").trim();
    if (ced) {
        const rows = await db.c_empleado.findMany({ where: { cedula: ced }, select, take: 2 });
        if (rows.length === 1) return pick(rows[0]);
        if (rows.length > 1) return null;
    }
    const email = actor.email.trim();
    if (email) {
        const rows = await db.c_empleado.findMany({ where: { Email: email }, select, take: 2 });
        if (rows.length === 1) return pick(rows[0]);
    }
    return null;
}
