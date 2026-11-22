/**
 * Permisos de Guardify en el servidor (fase 3 de roles).
 *
 * Desde la fase 2 el menú de la app usa el rol y las condiciones de Guardify; aquí el SERVIDOR hace cumplir los mismos permisos (una app
 * modificada podría mostrar una pantalla, pero no saltarse la API). Guardify calcula los permisos vigentes de cada persona en el momento
 * (`GET {GUARDIFY_URL}/api/v1/access/grants?externalId=<cédula>`, con la credencial de aplicación, igual que `/revocations`).
 *
 * - `GUARDIFY_PERMISSIONS` = `off` | `observe` | `on` (sin variable = `off`: TODO SIGUE COMO HOY, no se consulta a Guardify).
 *     observe → decide con la regla de siempre y registra en un log estructurado (`guardify_permission`) cada vez que Guardify diría otra cosa.
 *     on      → decide Guardify.
 * - Dos usos:
 *     1. `guardifyAdmin(...)`: reemplaza a «¿es súper admin?» (`n_employees_superadmin`) por un permiso concreto de Guardify.
 *     2. `guardifyRouteGate(...)`: las escrituras (POST/PUT/PATCH/DELETE) de cada pantalla exigen su permiso (`SCREEN_WRITE_ROUTES`).
 *        En `on` responde 403 `permission_denied|<permiso>`; la app lo trata como falta de permiso y NO cierra la sesión.
 * - Si Guardify no tiene a la persona (`governed: false`), no responde o la consulta falla sin respaldo, rige la regla de siempre: nunca se deja
 *   a alguien sin servicio por una caída de Guardify. Las respuestas se guardan en memoria `GUARDIFY_GRANTS_TTL_SECONDS` (60 por defecto) y
 *   ante un fallo se usa la última conocida.
 * - Límite: las condiciones de las pantallas (marca vigente, división) las evalúa la app con sus datos; el servidor solo exige el permiso.
 */
import { isSwitchedOff } from "./guardifyFlags";

export type PermissionsMode = "off" | "observe" | "on";

export function parsePermissionsMode(raw: unknown): PermissionsMode {
    const v = String(raw ?? "").trim().toLowerCase();
    if (isSwitchedOff(v)) return "off";
    return v === "observe" || v === "on" ? v : "off";
}

export type UserAccess =
    | { governed: false; externalId: string; status?: string }
    | { governed: true; externalId: string; status: string; role: string; grants: string[]; conditions: Record<string, Record<string, string[]>> };

/** Permiso de Guardify para actuar sobre registros de otras personas (lo que hoy hace un súper admin). */
export const PERM_REGISTROS_DE_OTROS = "administracion.registros-de-otros";

/**
 * Escrituras de cada pantalla → permiso de Guardify (igual que el manifiesto publicado). Solo rutas que usa UNA pantalla: las que comparte el
 * marcado de ingreso (actividades, tiempo de alimentación, vehículos corporativos) o los documentos que firma el guarda quedan fuera.
 */
export const SCREEN_WRITE_ROUTES: Readonly<Record<string, string>> = {
    visitors: "bitacora.registro-de-personas",
    vehicles: "bitacora.visitas-de-vehiculos",
    "bitacora-vehiculo-detenido": "bitacora.revision-de-vehiculos",
    "agenda-minuta": "bitacora.agenda-minuta",
    "voice-notes": "bitacora.notas-de-voz",
    incidents: "incidentes.incidentes",
    "non-conforming-product": "incidentes.producto-no-conforme",
    "entrega-puestos": "cambio-de-puesto.entrega-de-puestos",
    "opening-closing-position": "cambio-de-puesto.apertura-cierre-de-puesto",
    "mantenimiento-equipo": "cambio-de-puesto.equipo-del-puesto",
    llaves: "cambio-de-puesto.llaves",
    llaveros: "cambio-de-puesto.llaves",
    "checklist-supervision": "supervision.checklist-de-supervision",
    evaluation: "supervision.evaluacion-de-personal",
    "complaints-master": "supervision.maestro-de-quejas",
    "induction-tour-record": "supervision.induccion-y-recorrido",
    "apreciacion-vulnerabilidad": "supervision.apreciacion-de-vulnerabilidad",
    "encuesta-nps": "supervision.encuestas-de-satisfaccion",
    "acta-entrega-productos": "administracion.acta-de-entrega-de-productos",
    "documentos-entregados": "administracion.documentos-entregados",
    training: "administracion.registro-de-capacitaciones",
    "general-induction-register": "administracion.induccion-general",
    "traslado-plaza": "administracion.archivos-de-acciones",
    "attendance-control": "asistencia.control-de-asistencia",
    "mutuos-acuerdos": "asistencia.mutuos-acuerdos",
    "permit-request": "asistencia.solicitud-de-permiso",
    "modules-release": "administracion.visibilidad-de-modulos",
};

const WRITE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Permiso que exige una petición, o null si la ruta no está gobernada (lecturas, rutas compartidas o sin pantalla). */
export function permissionForRoute(pathname: string | null | undefined, method: string | null | undefined): string | null {
    if (!WRITE.has(String(method ?? "").toUpperCase())) return null;
    const m = /^\/api\/([^/?#]+)(?:\/([^/?#]+))?/.exec(String(pathname ?? ""));
    if (!m) return null;
    // Nomencladores: solo los escribe esa pantalla (el resto de la app solo los lee). Los súper admins tienen su propia verificación.
    if (m[1] === "nomenclators") return m[2] && m[2] !== "super-admins" ? "administracion.nomencladores" : null;
    return SCREEN_WRITE_ROUTES[m[1]!] ?? null;
}

export function buildPermissionDeniedMessage(permission: string): string {
    return `permission_denied|${permission}`;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Caché de permisos por persona

type Fetcher = (externalId: string) => Promise<UserAccess>;
type Entry = { value: UserAccess | null; at: number; inFlight: Promise<UserAccess | null> | null };

export class GrantsCache {
    private entries = new Map<string, Entry>();
    lastError: string | null = null;

    constructor(private readonly fetcher: Fetcher, private readonly ttlMs: number, private readonly now: () => number = Date.now) {}

    /** Permisos vigentes, o null si Guardify nunca respondió por esta persona. No lanza: ante un fallo usa la última respuesta. */
    async get(externalId: string): Promise<UserAccess | null> {
        const key = externalId.trim();
        if (!key) return null;
        const e = this.entries.get(key) ?? { value: null, at: 0, inFlight: null };
        this.entries.set(key, e);
        if (e.value && this.now() - e.at < this.ttlMs) return e.value;
        if (e.inFlight) return e.inFlight;
        e.inFlight = (async () => {
            try {
                e.value = await this.fetcher(key);
                this.lastError = null;
            } catch (err) {
                this.lastError = err instanceof Error ? err.message : String(err);
            } finally {
                e.at = this.now(); // también tras un fallo: no insistir en cada petición
                e.inFlight = null;
            }
            return e.value;
        })();
        return e.inFlight;
    }
}

type Env = Record<string, string | undefined>;
type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export function createGrantsFetcher(env: Env, fetchImpl: FetchLike = fetch as unknown as FetchLike): Fetcher {
    return async (externalId) => {
        const base = String(env.GUARDIFY_URL ?? "").trim().replace(/\/+$/, "");
        const id = String(env.GUARDIFY_APP_CLIENT_ID ?? "").trim();
        const secret = String(env.GUARDIFY_APP_CLIENT_SECRET ?? "").trim();
        if (!base || !id || !secret) throw new Error("Guardify no configurado (GUARDIFY_URL / GUARDIFY_APP_CLIENT_ID / GUARDIFY_APP_CLIENT_SECRET)");
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4000);
        try {
            const res = await fetchImpl(`${base}/api/v1/access/grants?externalId=${encodeURIComponent(externalId)}`, {
                method: "GET",
                headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`, Accept: "application/json" },
                signal: controller.signal,
            });
            if (!res.ok) throw new Error(`Guardify respondió ${res.status}`);
            const body = (await res.json()) as Partial<UserAccess> & Record<string, unknown>;
            if (body.governed === true) {
                return {
                    governed: true,
                    externalId,
                    status: String(body.status ?? ""),
                    role: String(body.role ?? ""),
                    grants: Array.isArray(body.grants) ? body.grants.map(String) : [],
                    conditions: (body.conditions && typeof body.conditions === "object" ? body.conditions : {}) as Record<string, Record<string, string[]>>,
                };
            }
            return { governed: false, externalId, status: body.status ? String(body.status) : undefined };
        } finally {
            clearTimeout(timer);
        }
    };
}

let shared: GrantsCache | null = null;
function sharedCache(env: Env): GrantsCache {
    if (!shared) {
        const ttl = Math.min(300, Math.max(15, Number(env.GUARDIFY_GRANTS_TTL_SECONDS) || 60));
        shared = new GrantsCache(createGrantsFetcher(env), ttl * 1000);
    }
    return shared;
}

/** Solo para pruebas. */
export function resetGuardifyPermissionsForTests() {
    shared = null;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Decisiones

export type PermissionDeps = {
    env?: Env;
    cache?: GrantsCache;
    /** Cédula del empleado (el `externalId` de la persona en Guardify). */
    cedulaOf: (empleadoId: number) => Promise<string | null>;
    log?: (entry: Record<string, unknown>) => void;
};

const defaultLog = (entry: Record<string, unknown>) => console.warn(JSON.stringify({ guardify_permission: entry }));

/** Lo que dice Guardify (true/false) o null si no manda para esta persona (no la tiene, no respondió o está apagado). */
async function guardifyVerdict(empleadoId: number, permission: string, deps: PermissionDeps): Promise<{ verdict: boolean | null; access: UserAccess | null }> {
    const cedula = Number.isFinite(empleadoId) && empleadoId > 0 ? await deps.cedulaOf(empleadoId).catch(() => null) : null;
    if (!cedula) return { verdict: null, access: null };
    const access = await (deps.cache ?? sharedCache(deps.env ?? process.env)).get(cedula);
    if (!access || !access.governed) return { verdict: null, access };
    return { verdict: access.grants.includes(permission), access };
}

/**
 * Reemplazo de «¿es súper admin?»: con `GUARDIFY_PERMISSIONS=on` decide el permiso de Guardify (si Guardify tiene a la persona); en `observe`
 * decide `legacy` y registra las diferencias; en `off`, solo `legacy`. Nunca lanza.
 */
export async function guardifyAdmin(
    input: { empleadoId: number; permission: string; legacy: () => Promise<boolean>; route?: string },
    deps: PermissionDeps,
): Promise<boolean> {
    const mode = parsePermissionsMode((deps.env ?? process.env).GUARDIFY_PERMISSIONS);
    if (mode === "off") return input.legacy();
    let verdict: boolean | null = null;
    try {
        verdict = (await guardifyVerdict(input.empleadoId, input.permission, deps)).verdict;
    } catch (e) {
        console.error("[guardify_permission] error consultando permisos (rige la regla de siempre):", e instanceof Error ? e.message : e);
    }
    if (verdict === null) return input.legacy();
    if (mode === "on") return verdict;
    const legacy = await input.legacy();
    if (legacy !== verdict) (deps.log ?? defaultLog)({ mode, kind: "admin", empleado: input.empleadoId, permission: input.permission, route: input.route, legacy, guardify: verdict });
    return legacy;
}

/**
 * Puerta de las escrituras de cada pantalla: devuelve el mensaje 403 (`permission_denied|<permiso>`) o null para dejar pasar. Solo corta en
 * `on` y cuando Guardify tiene a la persona y no le da el permiso. Nunca lanza.
 */
export async function guardifyRouteGate(
    input: { payload: { id?: unknown } | null | undefined; route?: string | null; method?: string | null },
    deps: PermissionDeps,
): Promise<string | null> {
    const mode = parsePermissionsMode((deps.env ?? process.env).GUARDIFY_PERMISSIONS);
    if (mode === "off") return null;
    const permission = permissionForRoute(input.route, input.method);
    if (!permission) return null;
    try {
        const empleadoId = Number(input.payload?.id);
        const { verdict, access } = await guardifyVerdict(empleadoId, permission, deps);
        if (verdict !== false) return null;
        (deps.log ?? defaultLog)({ mode, kind: "route", empleado: empleadoId, permission, route: input.route, method: input.method, role: access?.governed ? access.role : null, status: access?.status ?? null });
        return mode === "on" ? buildPermissionDeniedMessage(permission) : null;
    } catch (e) {
        console.error("[guardify_permission] error en la puerta de permisos (se deja pasar):", e instanceof Error ? e.message : e);
        return null;
    }
}
