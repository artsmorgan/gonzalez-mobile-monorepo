/**
 * Reglas puras de la integración con Guardify (issues #145, #147 y #148): sin imports de React Native para poder probarlas desde
 * `apps/server/utils/guardifyMobile.test.ts`. El cliente que las usa está en `guardifyClient.ts`.
 */

/** Compara versiones `1.2.3` numéricamente (lo que no es número cuenta 0). Negativo si `a < b`. */
export function compareVersions(a: string, b: string): number {
  const pa = String(a ?? '').split(/[.\-+]/).map((x) => parseInt(x, 10) || 0);
  const pb = String(b ?? '').split(/[.\-+]/).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export type GuardifyApkInfo = { version: string; notes?: string | null; sizeBytes?: number | null; sha256?: string; downloadUrl: string };

export type UpdateDecision = {
  /** La versión instalada es menor que la mínima: no se puede usar la app hasta actualizar. */
  required: boolean;
  /** Hay un APK más nuevo en el catálogo (obligatorio o no). */
  available: boolean;
  /** Versión a instalar (la del catálogo). */
  version: string | null;
  apk: GuardifyApkInfo | null;
  minAppVersion: string | null;
};

/** Decide, con lo que informa el catálogo de APK de Guardify, si la app debe o puede actualizarse. */
export function decideUpdate(currentVersion: string, catalog: { minAppVersion?: string | null; latest?: GuardifyApkInfo | null } | null | undefined): UpdateDecision {
  const min = String(catalog?.minAppVersion ?? '').trim() || null;
  const latest = catalog?.latest ?? null;
  const required = !!min && compareVersions(currentVersion, min) < 0;
  const available = !!latest && compareVersions(currentVersion, latest.version) < 0;
  return { required, available, version: latest?.version ?? null, apk: latest, minAppVersion: min };
}

/** Código de empresa tal como lo espera Guardify (`corporacion-gonzalez`): sin espacios alrededor y en minúsculas. */
export function normalizeCompanyCode(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

/** Interruptor de texto de la build: `true`, `1`, `on`, `yes` o `si` (sin distinguir mayúsculas). Cualquier otra cosa, o vacío, es apagado. */
export function isTruthyFlag(value: unknown): boolean {
  if (value === true) return true;
  return /^(true|1|on|yes|si|sí)$/i.test(String(value ?? '').trim());
}

/** Cada cuánto manda el equipo su latido (batería y ubicación, si la persona la autorizó) cuando la build no dice otra cosa. */
export const DEFAULT_HEARTBEAT_MS = 5 * 60_000;
/** El latido nunca baja de 30 s (Guardify admite 60 por minuto y por IP) ni pasa de 1 h. */
const MIN_HEARTBEAT_MS = 30_000;
const MAX_HEARTBEAT_MS = 60 * 60_000;

/** `GUARDIFY_HEARTBEAT_SECONDS` de la build (segundos); vacío o inválido = el valor por defecto. */
export function parseHeartbeatMs(value: unknown): number {
  const seconds = Number(String(value ?? '').trim());
  if (!Number.isFinite(seconds) || seconds <= 0) return DEFAULT_HEARTBEAT_MS;
  return Math.min(MAX_HEARTBEAT_MS, Math.max(MIN_HEARTBEAT_MS, Math.round(seconds * 1000)));
}

export type GuardifyConfig = { enabled: boolean; /** El interruptor general está encendido (aunque falte la URL). */ switchedOn: boolean; baseUrl: string; appKey: string; companyCode: string; variant: string; heartbeatMs: number };

/**
 * Configuración desde `extra` de la app. **Interruptor general `GUARDIFY_ENABLED`: apagado por defecto.** Con él apagado Guardify no hace nada en la app
 * (no registra el equipo, no bloquea con pantallas, no consulta órdenes ni catálogo) aunque haya URL; el código se conserva para reactivarlo.
 * Para activarlo hacen falta el interruptor Y `GUARDIFY_URL`.
 * `GUARDIFY_COMPANY_CODE` viene embebido en producción; en lite/full queda vacío y se escribe al registrar el equipo.
 */
export function resolveGuardifyConfig(extra: Record<string, unknown> | null | undefined, variant: string): GuardifyConfig {
  const baseUrl = String(extra?.GUARDIFY_URL ?? '').trim().replace(/\/+$/, '');
  const switchedOn = isTruthyFlag(extra?.GUARDIFY_ENABLED);
  return {
    enabled: switchedOn && !!baseUrl,
    switchedOn,
    baseUrl,
    appKey: String(extra?.GUARDIFY_APP_KEY ?? '').trim() || 'monitoreapp',
    companyCode: normalizeCompanyCode(extra?.GUARDIFY_COMPANY_CODE),
    variant,
    heartbeatMs: parseHeartbeatMs(extra?.GUARDIFY_HEARTBEAT_SECONDS),
  };
}

/** Estados del SDK que dejan usar la app (con o sin sesión de Guardify); los demás se muestran en la pantalla de estado. */
export type GateState =
  | { kind: 'unregistered' }
  | { kind: 'pending' }
  | { kind: 'rejected'; reason?: string | null }
  | { kind: 'blocked'; reason?: string | null }
  | { kind: 'retired' }
  | { kind: 'signed_out' }
  | { kind: 'locked'; reason: 'offline' | 'lease_expired' | 'tolerance_expired' | 'clock_reset' }
  | { kind: 'operational'; online: boolean };

export function isGateOpen(state: GateState): boolean {
  return state.kind === 'signed_out' || state.kind === 'operational';
}

export type GateScreen = {
  /** `status` = texto informativo; `register` = pide el código de empresa; `update` = versión obligatoria; `wipe` = borrado remoto en curso. */
  mode: 'status' | 'register' | 'update' | 'wipe';
  /** Equivale a los estados de `describeDeviceStatus` (UNREGISTERED, PENDING, REJECTED, BLOCKED, RETIRED, LOCKED). */
  status: string;
  reason: string | null;
  /** Mensaje propio cuando el estado es `locked` (no hay equivalente en `describeDeviceStatus`). */
  message?: string;
  canRetry: boolean;
};

const LOCKED_MESSAGES: Record<string, string> = {
  offline: 'Esta empresa exige conexión a internet para usar la aplicación. Conéctate para continuar.',
  lease_expired: 'El permiso de uso venció y no se pudo renovar. Conéctate a internet para continuar.',
  tolerance_expired: 'Pasó el tiempo permitido sin conexión. Conéctate a internet para continuar.',
  clock_reset: 'No se pudo comprobar la hora del equipo. Conéctate a internet para continuar.',
};

/** Qué pantalla corresponde a un estado del SDK (`null` si la app se puede usar). `needsCode`: no hay código de empresa embebido. */
export function gateScreenFor(state: GateState, opts: { needsCode: boolean; updateRequired: boolean; wipePending?: boolean }): GateScreen | null {
  // Un borrado ordenado desde la consola manda sobre todo lo demás: la app queda bloqueada hasta que termine.
  if (opts.wipePending) return { mode: 'wipe', status: 'WIPE', reason: null, canRetry: false };
  if (opts.updateRequired) return { mode: 'update', status: 'UPDATE_REQUIRED', reason: null, canRetry: false };
  switch (state.kind) {
    case 'unregistered':
      return { mode: opts.needsCode ? 'register' : 'status', status: 'UNREGISTERED', reason: null, canRetry: true };
    case 'pending':
      return { mode: 'status', status: 'PENDING', reason: null, canRetry: true };
    case 'rejected':
      return { mode: 'status', status: 'REJECTED', reason: state.reason ?? null, canRetry: false };
    case 'blocked':
      return { mode: 'status', status: 'BLOCKED', reason: state.reason ?? null, canRetry: false };
    case 'retired':
      return { mode: 'status', status: 'RETIRED', reason: null, canRetry: false };
    case 'locked':
      return { mode: 'status', status: 'LOCKED', reason: null, message: LOCKED_MESSAGES[state.reason], canRetry: true };
    default:
      return null;
  }
}

export type CommandEffect = 'logout' | 'wipe' | 'check_update' | 'none';

/**
 * Efecto en la app de una orden de la consola. El SDK ya limpia su propia sesión; la app debe cerrar la suya (`logout`), borrar lo local
 * (`wipe`) o revisar el catálogo de APK (`check_update`). `PING` solo se confirma.
 */
export function commandEffect(command: string, payload: { externalUserId?: string } | null | undefined, currentCedula: string | null | undefined): CommandEffect {
  switch (String(command).toUpperCase()) {
    case 'LOGOUT_ALL':
      return 'logout';
    case 'LOGOUT_USER':
      return !!currentCedula && String(payload?.externalUserId ?? '').trim() === String(currentCedula).trim() ? 'logout' : 'none';
    case 'WIPE':
      return 'wipe';
    case 'FORCE_UPDATE':
      return 'check_update';
    default:
      return 'none';
  }
}

/**
 * ¿Toca renovar el permiso de uso? Cuando queda la mitad (o menos) de lo que duró el permiso, o menos de `minRemainingMs`.
 * `leaseMs` es lo que duró el último permiso recibido (`expMs - recibido en`).
 */
export function renewDue(p: { expMs: number; leaseMs: number; now: number; minRemainingMs?: number }): boolean {
  const remaining = p.expMs - p.now;
  const floor = p.minRemainingMs ?? 60_000;
  return remaining <= Math.max(floor, p.leaseMs / 2);
}

/** Nivel de batería del 0 al 100 (entero) a partir del 0–1 de `expo-battery`; `undefined` si no se pudo leer. */
export function batteryPercent(level: number | null | undefined): number | undefined {
  if (typeof level !== 'number' || !Number.isFinite(level) || level < 0) return undefined;
  return Math.max(0, Math.min(100, Math.round(level * 100)));
}

export type LocationConsent = 'granted' | 'declined';

/**
 * Qué ubicación acompaña al latido (el SDK la entrega a la consola de Guardify para el mapa en vivo). Solo con el consentimiento de la persona
 * y con una lectura reciente del GPS (una más vieja marcaría un lugar donde el equipo ya no está). `consent.location` siempre se informa.
 */
export function heartbeatLocation(p: {
  consent: LocationConsent | null | undefined;
  stored: { latitude: number; longitude: number; atMs: number | null } | null | undefined;
  nowMs: number;
  maxAgeMs?: number;
}): { consent: { location: boolean }; location?: { lat: number; lng: number } } {
  const granted = p.consent === 'granted';
  const out: { consent: { location: boolean }; location?: { lat: number; lng: number } } = { consent: { location: granted } };
  const loc = p.stored;
  if (!granted || !loc || !Number.isFinite(loc.latitude) || !Number.isFinite(loc.longitude)) return out;
  if (Math.abs(loc.latitude) > 90 || Math.abs(loc.longitude) > 180) return out;
  const age = loc.atMs == null ? 0 : p.nowMs - loc.atMs;
  if (age < 0 || age > (p.maxAgeMs ?? 10 * 60_000)) return out;
  out.location = { lat: loc.latitude, lng: loc.longitude };
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Rastreo en vivo (mapa de Guardify): ubicación cada pocos segundos mientras la app está abierta

export const LIVE_MIN_SECONDS = 2;
export const LIVE_MAX_SECONDS = 60;
/** Máximo de puntos guardados sin enviar (sin red); los más viejos se descartan. */
export const LIVE_BUFFER_MAX = 60;
/** Máximo de puntos por envío (el servidor acepta 30). */
export const LIVE_BATCH_MAX = 30;

export type LivePoint = { lat: number; lng: number; accuracy?: number; speed?: number; heading?: number; at: number };

/** Cada cuántos segundos manda la ubicación según lo que respondió Guardify (`0` = apagado; fuera de 2–60 se acota). */
export function normalizeLiveSeconds(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.max(LIVE_MIN_SECONDS, Math.min(LIVE_MAX_SECONDS, Math.round(n)));
}

/** Lectura del GPS -> punto para Guardify (`null` si las coordenadas no son válidas). Velocidad y rumbo negativos (sin dato) se omiten. */
export function toLivePoint(
  c: { latitude: number; longitude: number; accuracy?: number | null; speed?: number | null; heading?: number | null },
  atMs: number,
): LivePoint | null {
  if (!Number.isFinite(c.latitude) || !Number.isFinite(c.longitude) || Math.abs(c.latitude) > 90 || Math.abs(c.longitude) > 180) return null;
  if (!Number.isFinite(atMs) || atMs <= 0) return null;
  const ok = (v: number | null | undefined, max: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? v : undefined);
  const accuracy = ok(c.accuracy, 100_000);
  const speed = ok(c.speed, 300);
  const heading = ok(c.heading, 360);
  return {
    lat: c.latitude,
    lng: c.longitude,
    ...(accuracy !== undefined ? { accuracy } : {}),
    ...(speed !== undefined ? { speed } : {}),
    ...(heading !== undefined ? { heading } : {}),
    at: Math.round(atMs),
  };
}

/** Agrega puntos nuevos al final y conserva solo los últimos `max`. */
export function appendLivePoints(buffer: LivePoint[], add: LivePoint[], max = LIVE_BUFFER_MAX): LivePoint[] {
  const all = buffer.concat(add);
  return all.length > max ? all.slice(all.length - max) : all;
}

/**
 * ¿Debe estar corriendo el rastreo? Solo con la empresa activándolo, la persona consintiendo, el permiso del sistema y la sesión del empleado abierta.
 * Con el permiso «todo el tiempo» sigue en segundo plano; sin él, solo con la app abierta.
 */
export function wantLiveTracking(p: {
  seconds: number;
  consent: LocationConsent | null | undefined;
  permissionGranted: boolean;
  backgroundGranted: boolean;
  appActive: boolean;
  sessionOpen: boolean;
}): boolean {
  return p.seconds > 0 && p.consent === 'granted' && p.permissionGranted && p.sessionOpen && (p.appActive || p.backgroundGranted);
}

/** Qué hacer si falla un envío: `retry` = conservar los puntos y reintentar (sin red, error del servidor o límite de frecuencia); `stop` = dejar de rastrear (lo desactivaron, falta consentimiento o el equipo ya no está activo). */
export function liveFailureAction(status: number | undefined | null, code?: string | null): 'stop' | 'retry' {
  const st = Number(status ?? 0);
  if (code === 'network' || st === 0 || st === 429 || st >= 500) return 'retry';
  return 'stop';
}

/** Nombre del archivo con el que se guarda el APK descargado. */
export function apkFileName(variant: string, version: string): string {
  const v = String(variant || 'app').replace(/[^a-z0-9_-]+/gi, '');
  return `MonitoreApp-${v}-${String(version).replace(/[^0-9a-z.\-+]+/gi, '')}.apk`;
}
