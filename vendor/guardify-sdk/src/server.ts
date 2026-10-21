/**
 * Verificador para el servidor de una app (ACC-04, ACC-05, ACC-08).
 * Comprueba el token con las claves públicas de Guardify (JWKS, sin llamarle en cada petición)
 * y rechaza sesiones revocadas aunque el token no haya caducado.
 */
import { createRemoteJWKSet, jwtVerify } from "jose";

export type Claims = { sub: string; tid: string; app: string; dev: string; sid: string; role: string | null; grants: string[]; org: string[]; exp: number };

export type VerifierOptions = {
  baseUrl: string;
  appKey: string;
  clientId: string;
  clientSecret: string;
  fetch?: typeof fetch;
  /** `true`: consulta la introspección en cada verificación (más estricto, una llamada extra). */
  strict?: boolean;
};

export function createVerifier(o: VerifierOptions) {
  const f = o.fetch ?? fetch;
  const jwks = createRemoteJWKSet(new URL(`${o.baseUrl}/.well-known/jwks.json`), { cooldownDuration: 0, cacheMaxAge: 30_000 });
  const basic = "Basic " + (globalThis as any).Buffer.from(`${o.clientId}:${o.clientSecret}`).toString("base64");
  const revoked = new Set<string>();
  /** Equipos que dejaron de estar activos (bloqueados, rechazados, retirados); uno que vuelve a `ACTIVE` sale de aquí. */
  const revokedDevices = new Set<string>();
  let since = new Date(0).toISOString();

  /** Trae las revocaciones nuevas. Llamar periódicamente (o antes de cada verificación en modo estricto). */
  async function refreshRevocations() {
    const r = await f(`${o.baseUrl}/api/v1/revocations?since=${encodeURIComponent(since)}`, { headers: { authorization: basic } });
    if (!r.ok) throw new Error(`revocations ${r.status}`);
    const d = (await r.json()) as { sessions: { sid: string }[]; devices?: { id: string; status: string }[]; serverTime: string };
    d.sessions.forEach((s) => revoked.add(s.sid));
    for (const x of d.devices ?? []) { if (x.status === "ACTIVE") revokedDevices.delete(x.id); else revokedDevices.add(x.id); }
    since = new Date(new Date(d.serverTime).getTime() - 2000).toISOString();
    return d.sessions.length;
  }

  async function verify(token: string): Promise<Claims> {
    const { payload } = await jwtVerify(token, jwks, { audience: o.appKey });
    const c = payload as unknown as Claims;
    if (revoked.has(c.sid)) throw new Error("session_revoked");
    if (c.dev && revokedDevices.has(c.dev)) throw new Error("device_not_approved");
    if (o.strict) {
      const r = await f(`${o.baseUrl}/api/v1/access/introspect`, { method: "POST", headers: { authorization: basic, "content-type": "application/json" }, body: JSON.stringify({ token }) });
      const d = (await r.json()) as { active: boolean; reason?: string };
      if (!d.active) throw new Error(d.reason ?? "inactive");
    }
    return c;
  }

  const can = (c: Claims, permission: string) => c.grants.includes(permission);

  return { verify, can, refreshRevocations, isRevoked: (sid: string) => revoked.has(sid), isDeviceRevoked: (id: string) => revokedDevices.has(id) };
}
