/**
 * Control de equipos con Guardify en el servidor (issues #149 y #150).
 *
 * Guardify decide qué equipos están aprobados (el estado vive SOLO allá; aquí no se guarda nada en la base). El servidor es donde se HACE
 * CUMPLIR el bloqueo: una app modificada podría saltarse la pantalla de bloqueo, pero no los permisos de la API.
 *
 * - `GUARDIFY_DEVICE_ENFORCE` = `off` | `observe` | `on` (sin variable = `off`: todo como hoy).
 *     off      → no hace nada ni consulta a Guardify.
 *     observe  → registra en un log estructurado (`guardify_device`) las peticiones sin equipo o con equipo no activo, SIN cambiar ninguna respuesta.
 *     on       → responde 403 `device_not_approved|<ESTADO>|<motivo>`, o 403 `session_revoked|<motivo>` si lo revocado es solo la sesión
 *                (issue #174: la app cierra esa sesión con su mensaje en vez de mostrar «equipo bloqueado», porque el equipo sigue activo).
 * - Lista de revocaciones: `GET {GUARDIFY_URL}/api/v1/revocations?since=` con credencial de aplicación
 *   (`Authorization: Basic base64(GUARDIFY_APP_CLIENT_ID:GUARDIFY_APP_CLIENT_SECRET)`), en memoria 30–60 s (`GUARDIFY_REVOCATIONS_TTL_SECONDS`).
 * - Tolerante a fallos: si Guardify no responde se usa la última lista (un equipo ya revocado sigue bloqueado) y nunca se lanza un error
 *   hacia la petición del usuario. Sin ninguna lista cargada todavía (arranque en frío con Guardify caído) rige `GUARDIFY_DEVICE_COLD_START`
 *   (`allow` por defecto: no dejar sin servicio a todos los guardas por una caída; `deny` para exigir siempre una lista).
 *
 * Contrato de `/revocations` (SDK de Guardify, `vendor/guardify-sdk/src/server.ts`): `GET /api/v1/revocations?since=<ISO>` →
 * `{ sessions: [{ sid }], devices: [{ id, status }], serverTime }`. Es incremental: la primera vez se pide desde la época y después desde
 * `serverTime` menos 2 s. Un equipo que vuelve a `ACTIVE` sale de la lista. `gdev` del token es el **id de equipo de Guardify**
 * (`guardify.deviceId` del SDK) y `gsid` el id de su sesión (`sid`).
 */

export type EnforceMode = "off" | "observe" | "on";

export function parseEnforceMode(raw: unknown): EnforceMode {
    const v = String(raw ?? "").trim().toLowerCase();
    return v === "observe" || v === "on" ? v : "off";
}

/** Estados de un equipo en Guardify; solo `ACTIVE` está aprobado. */
export type DeviceStatus = "ACTIVE" | "PENDING" | "REJECTED" | "BLOCKED" | "RETIRED" | "LOCKED" | string;

export type Revocation = { deviceId: string | null; sessionId: string | null; status: DeviceStatus; reason: string | null };

const text = (v: unknown): string | null => {
    const s = String(v ?? "").trim();
    return s ? s : null;
};

/** Cursor de la siguiente consulta: la hora del servidor menos 2 s (margen para no perder cambios del mismo instante), como hace el SDK. */
function siguienteCursor(serverTime: unknown): string | null {
    const t = new Date(String(serverTime ?? "")).getTime();
    return Number.isNaN(t) ? null : new Date(t - 2000).toISOString();
}

/** Respuesta de `/api/v1/revocations`: sesiones revocadas (`sid`) y equipos con su estado (`id`, `status`); un equipo `ACTIVE` levanta su revocación. */
export function parseRevocations(body: unknown): { items: Revocation[]; cursor: string | null } {
    const root = (body && typeof body === "object" ? body : {}) as Record<string, any>;
    const items: Revocation[] = [];
    for (const s of Array.isArray(root.sessions) ? root.sessions : []) {
        const sessionId = text(s?.sid ?? s?.id);
        if (sessionId) items.push({ deviceId: null, sessionId, status: "BLOCKED", reason: text(s?.reason) });
    }
    for (const d of Array.isArray(root.devices) ? root.devices : []) {
        const deviceId = text(d?.id);
        if (deviceId) items.push({ deviceId, sessionId: null, status: (text(d?.status) ?? "BLOCKED").toUpperCase(), reason: text(d?.reason) });
    }
    return { items, cursor: siguienteCursor(root.serverTime) };
}

export type DeviceDecision = {
    allow: boolean;
    /** `ok`, `off`, `no_device` (el token no trae equipo), `revoked` (equipo/sesión no activo) o `cold_start` (sin lista cargada). */
    cause: "ok" | "off" | "no_device" | "revoked" | "cold_start";
    status?: DeviceStatus;
    reason?: string | null;
    /** Con `cause: "revoked"`: si lo revocado es el equipo o solo la sesión (issue #174). El equipo, más grave, tiene prioridad. */
    scope?: "device" | "session";
};

type TokenPayload = { id?: unknown; gdev?: unknown; gsid?: unknown } | null | undefined;

export class RevocationCache {
    private devices = new Map<string, Revocation>();
    private sessions = new Map<string, Revocation>();
    private cursor: string | null = null;
    private loaded = false;
    private lastAttempt = 0;
    private inFlight: Promise<void> | null = null;
    lastError: string | null = null;

    constructor(
        private readonly fetchRevocations: (since: string | null) => Promise<{ items: Revocation[]; cursor: string | null }>,
        private readonly ttlMs: number,
        private readonly now: () => number = Date.now,
    ) {}

    get isLoaded(): boolean {
        return this.loaded;
    }

    /** Aplica los cambios de la lista: un estado `ACTIVE` levanta la revocación; cualquier otro la fija. */
    private apply(items: Revocation[]) {
        for (const r of items) {
            if (r.deviceId) (r.status === "ACTIVE" ? this.devices.delete(r.deviceId) : this.devices.set(r.deviceId, r));
            if (r.sessionId) (r.status === "ACTIVE" ? this.sessions.delete(r.sessionId) : this.sessions.set(r.sessionId, r));
        }
    }

    /** Espera a que termine el refresco en curso (para pruebas). */
    whenIdle(): Promise<void> {
        return this.inFlight ?? Promise.resolve();
    }

    /**
     * Refresca si pasó el tiempo de vida; nunca lanza: ante un fallo conserva la última lista. Con una lista ya cargada el refresco se hace
     * en segundo plano (la petición no espera a Guardify); solo la primera carga se espera.
     */
    async ensureFresh(): Promise<void> {
        if (this.inFlight) return this.loaded ? undefined : this.inFlight;
        if (this.loaded && this.now() - this.lastAttempt < this.ttlMs) return;
        if (!this.loaded && this.lastAttempt && this.now() - this.lastAttempt < Math.min(this.ttlMs, 10_000)) return; // no insistir en cada petición
        this.inFlight = (async () => {
            this.lastAttempt = this.now();
            try {
                const { items, cursor } = await this.fetchRevocations(this.cursor);
                if (!this.cursor) {
                    // sin cursor la respuesta es la lista COMPLETA: reemplaza a la anterior
                    this.devices.clear();
                    this.sessions.clear();
                }
                this.apply(items);
                this.cursor = cursor ?? null;
                this.loaded = true;
                this.lastError = null;
            } catch (e) {
                this.lastError = e instanceof Error ? e.message : String(e);
            } finally {
                this.inFlight = null;
            }
        })();
        return this.loaded ? undefined : this.inFlight;
    }

    lookup(payload: TokenPayload): Revocation | null {
        const dev = text(payload?.gdev);
        const ses = text(payload?.gsid);
        return (dev ? this.devices.get(dev) : undefined) ?? (ses ? this.sessions.get(ses) : undefined) ?? null;
    }
}

/** Decide si la sesión (token) puede usarse: sin equipo, equipo/sesión revocados o lista sin cargar. No aplica el modo: eso lo hace el que llama. */
export function evaluateDevice(payload: TokenPayload, cache: RevocationCache, coldStart: "allow" | "deny" = "allow"): DeviceDecision {
    if (!text(payload?.gdev)) return { allow: false, cause: "no_device", status: "UNREGISTERED", reason: null };
    const revoked = cache.lookup(payload);
    if (revoked) return { allow: false, cause: "revoked", status: revoked.status, reason: revoked.reason, scope: revoked.deviceId ? "device" : "session" };
    if (!cache.isLoaded) return coldStart === "deny" ? { allow: false, cause: "cold_start", status: "UNKNOWN", reason: null } : { allow: true, cause: "cold_start" };
    return { allow: true, cause: "ok" };
}

/** Mensaje de la respuesta 403 de un equipo no aprobado: `device_not_approved|ESTADO|motivo` (la app lo interpreta). */
export function buildDeviceNotApprovedMessage(status?: string | null, reason?: string | null): string {
    return `device_not_approved|${text(status) ?? "BLOCKED"}|${text(reason)?.replace(/\|/g, "/") ?? ""}`;
}

/** Mensaje de la respuesta 403 de una sesión revocada con el equipo activo: `session_revoked|motivo` (la app lo interpreta). */
export function buildSessionRevokedMessage(reason?: string | null): string {
    return `session_revoked|${text(reason)?.replace(/\|/g, "/") ?? ""}`;
}

export function parseSessionRevokedMessage(message: unknown): { reason: string | null } | null {
    const m = /^session_revoked\|([\s\S]*)$/.exec(String(message ?? ""));
    return m ? { reason: text(m[1]) } : null;
}

export function parseDeviceNotApprovedMessage(message: unknown): { status: string; reason: string | null } | null {
    const m = /^device_not_approved\|([^|]*)\|([\s\S]*)$/.exec(String(message ?? ""));
    return m ? { status: m[1] || "BLOCKED", reason: text(m[2]) } : null;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Conexión real con Guardify y puerta única para el servidor

type Env = Record<string, string | undefined>;
type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export function createRevocationFetcher(env: Env, fetchImpl: FetchLike = fetch as unknown as FetchLike) {
    return async (since: string | null) => {
        const base = text(env.GUARDIFY_URL)?.replace(/\/+$/, "");
        const id = text(env.GUARDIFY_APP_CLIENT_ID);
        const secret = text(env.GUARDIFY_APP_CLIENT_SECRET);
        if (!base || !id || !secret) throw new Error("Guardify no configurado (GUARDIFY_URL / GUARDIFY_APP_CLIENT_ID / GUARDIFY_APP_CLIENT_SECRET)");
        // La primera consulta pide todo desde la época; las siguientes, lo nuevo desde la última hora del servidor.
        const url = `${base}/api/v1/revocations?since=${encodeURIComponent(since ?? new Date(0).toISOString())}`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4000);
        try {
            const res = await fetchImpl(url, {
                method: "GET",
                headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`, Accept: "application/json" },
                signal: controller.signal,
            });
            if (!res.ok) throw new Error(`Guardify respondió ${res.status}`);
            return parseRevocations(await res.json());
        } finally {
            clearTimeout(timer);
        }
    };
}

let sharedCache: RevocationCache | null = null;
function getSharedCache(env: Env): RevocationCache {
    if (!sharedCache) {
        const ttl = Math.min(60, Math.max(30, Number(env.GUARDIFY_REVOCATIONS_TTL_SECONDS) || 45));
        sharedCache = new RevocationCache(createRevocationFetcher(env), ttl * 1000);
    }
    return sharedCache;
}

/** Solo para pruebas. */
export function resetGuardifyDevicesForTests() {
    sharedCache = null;
}

export type DeviceGateInput = { payload: TokenPayload; route?: string; method?: string; stage?: "request" | "login" | "refresh"; /** Cabecera `X-App-Version` de la app. */ appVersion?: string | null };

/** Compara versiones `1.2.3` numéricamente (lo que no es número cuenta 0). Negativo si `a < b`. */
export function compararVersiones(a: string, b: string): number {
    const pa = String(a).split(/[.\-+]/).map((x) => parseInt(x, 10) || 0);
    const pb = String(b).split(/[.\-+]/).map((x) => parseInt(x, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const d = (pa[i] ?? 0) - (pb[i] ?? 0);
        if (d !== 0) return d;
    }
    return 0;
}

/**
 * Versión mínima de la app (issue #148): el APK viejo se puede instalar aunque la app avise, por eso el servidor también la exige. La fija
 * `GUARDIFY_MIN_APP_VERSION` (la misma que el catálogo de APK de Guardify). Una app que no manda su versión es anterior a esta función.
 */
export function versionInsuficiente(appVersion: string | null | undefined, minima: string | null | undefined): boolean {
    const min = String(minima ?? "").trim();
    if (!min) return false;
    const v = String(appVersion ?? "").trim();
    return !v || compararVersiones(v, min) < 0;
}

/**
 * Puerta única: devuelve el mensaje 403 (`device_not_approved|…`) si la sesión debe cortarse, o null para dejarla pasar.
 * En `off` no hace nada; en `observe` solo registra; en `on` corta. Nunca lanza.
 */
export async function guardifyDeviceGate(input: DeviceGateInput, env: Env = process.env, cache?: RevocationCache): Promise<string | null> {
    const mode = parseEnforceMode(env.GUARDIFY_DEVICE_ENFORCE);
    if (mode === "off") return null;
    try {
        const minima = String(env.GUARDIFY_MIN_APP_VERSION ?? "").trim();
        if (versionInsuficiente(input.appVersion, minima)) {
            console.warn(JSON.stringify({ guardify_device: { mode, cause: "update_required", status: "UPDATE_REQUIRED", stage: input.stage ?? "request", route: input.route, appVersion: input.appVersion ?? null, minima } }));
            if (mode === "on") return buildDeviceNotApprovedMessage("UPDATE_REQUIRED", `Actualiza la app a la versión ${minima} o posterior.`);
        }
        const c = cache ?? getSharedCache(env);
        await c.ensureFresh();
        const coldStart = String(env.GUARDIFY_DEVICE_COLD_START ?? "allow").trim().toLowerCase() === "deny" ? "deny" : "allow";
        const decision = evaluateDevice(input.payload, c, coldStart);
        if (decision.allow && decision.cause === "ok") return null;
        if (decision.cause === "cold_start" && decision.allow) {
            console.warn(JSON.stringify({ guardify_device: { mode, cause: "cold_start", stage: input.stage ?? "request", route: input.route, cacheError: c.lastError } }));
            return null;
        }
        console.warn(
            JSON.stringify({
                guardify_device: {
                    mode, cause: decision.cause, status: decision.status, reason: decision.reason, stage: input.stage ?? "request",
                    route: input.route, method: input.method, empleado: input.payload?.id ?? null, gdev: text(input.payload?.gdev), gsid: text(input.payload?.gsid),
                },
            }),
        );
        if (mode !== "on") return null;
        return decision.cause === "revoked" && decision.scope === "session"
            ? buildSessionRevokedMessage(decision.reason)
            : buildDeviceNotApprovedMessage(decision.status, decision.reason);
    } catch (e) {
        console.error("[guardify_device] error evaluando el equipo (se deja pasar):", e instanceof Error ? e.message : e);
        return null;
    }
}
