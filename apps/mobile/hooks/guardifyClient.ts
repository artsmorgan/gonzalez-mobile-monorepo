/**
 * Cliente de Guardify en la app (issues #145, #147 y #148): registro del equipo, sesión de acceso, latidos, órdenes de la consola y
 * catálogo de APK. Envuelve el SDK de `vendor/guardify-sdk` y expone un estado observable para `GuardifyGate`.
 *
 * **Apagado por defecto**: solo funciona si la build trae `GUARDIFY_ENABLED` encendido Y `GUARDIFY_URL`; apagado no hace nada y no puede impedir el uso de la app
 * (el código se conserva para reactivarlo). Las reglas puras están en `guardifyLogic.ts`.
 * El canal en tiempo real (SSE) no existe en React Native (`fetch` no entrega el cuerpo en streaming): las órdenes se consultan con
 * `pollCommands()` cada pocos segundos mientras la app está abierta.
 */
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Battery from 'expo-battery';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import { Paths } from 'expo-file-system';
import { GuardifyDevice, GuardifyError, type SdkEvent, type SdkState } from '@/vendor/guardify-sdk';
import { downloadAndShareLargeFile, type DownloadAndShareResult } from './downloadReportFileToDevice';
import { getEmbeddedAppVersionInfo, resolveRuntimeAppVariant } from './appVariant';
import isDeviceOnline from './isDeviceOnline';
import { eventBus } from './eventBus';
import { getDeviceUid, guardifyStorage } from './installSecureStorage';
import { queueRaw } from './installQueueOwnership';
import getHoraAccion from './getHoraAccion';
import { readLastLocationFromStorage } from './updateLastLocation';
import { parseLocationTimeMs } from './evidenceHeaders';
import { getGuardifyIdentity, setGuardifyIdentity } from './guardifyIdentity';
import {
  apkFileName,
  batteryPercent,
  commandEffect,
  decideUpdate,
  heartbeatLocation,
  normalizeCompanyCode,
  renewDue,
  resolveGuardifyConfig,
  type CommandEffect,
  type GuardifyConfig,
  type LocationConsent,
  type UpdateDecision,
} from './guardifyLogic';
import {
  RETIRED_WIPED_KEY,
  WIPE_ORDER_KEY,
  countPendingActions,
  decideWipe,
  parseWipeOrder,
  shouldKeepFileOnWipe,
  shouldKeepKeyOnWipe,
  type WipeOrder,
  type WipeReason,
} from './guardifyWipe';

const LOCATION_CONSENT_KEY = 'guardify.location_consent';

export type GuardifySnapshot = {
  /** `init()` terminó (o no hace falta). Hasta entonces no se muestra ninguna pantalla de bloqueo. */
  ready: boolean;
  enabled: boolean;
  sdk: SdkState;
  update: UpdateDecision | null;
  /** No hay código de empresa embebido: la persona debe escribirlo para registrar el equipo. */
  needsCode: boolean;
  busy: boolean;
  error: string | null;
  /** Borrado remoto en curso: la app está bloqueada, sincronizando lo pendiente antes de borrar (ver `guardifyWipe.ts`). */
  wipe: { reason: WipeReason; orderedAt: number; deadlineAt: number; pending: number } | null;
  /** Consentimiento de la persona para enviar la ubicación del equipo a Guardify; null = todavía no se le preguntó. */
  locationConsent: LocationConsent | null;
};

export type GuardifyHandlers = {
  /** Cédula del empleado con sesión en la app (para `LOGOUT_USER`). */
  getCedula: () => string | null;
  /** Cierra la sesión local de la app (la usan `LOGOUT_ALL`, `LOGOUT_USER` y el borrado remoto). */
  logout: () => Promise<unknown>;
};

const TICK_MS = 5_000;
const STATUS_PENDING_MS = 15_000;
const STATUS_BLOCKED_MS = 60_000;
const COMMANDS_MS = 10_000;
const WIPE_CHECK_MS = 15_000;
const HEARTBEAT_MS = 5 * 60_000;
const UPDATE_MS = 30 * 60_000;

let config: GuardifyConfig | null = null;
let client: GuardifyDevice | null = null;
let initPromise: Promise<void> | null = null;
let handlers: GuardifyHandlers | null = null;
let snapshot: GuardifySnapshot = {
  ready: false,
  enabled: false,
  sdk: { kind: 'unregistered' },
  update: null,
  needsCode: false,
  busy: false,
  error: null,
  wipe: null,
  locationConsent: null,
};
const listeners = new Set<() => void>();

function patch(next: Partial<GuardifySnapshot>): void {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((l) => l());
}

export function subscribeGuardify(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getGuardifySnapshot(): GuardifySnapshot {
  return snapshot;
}

export function setGuardifyHandlers(next: GuardifyHandlers | null): void {
  handlers = next;
}

function getConfig(): GuardifyConfig {
  if (!config) config = resolveGuardifyConfig(Constants.expoConfig?.extra as Record<string, unknown> | undefined, guardifyVariant());
  return config;
}

/** Variante del catálogo de APK: `full` usa el mismo APK que `prod`. */
function guardifyVariant(): string {
  const v = resolveRuntimeAppVariant();
  return v === 'full' ? 'prod' : v;
}

function currentAppVersion(): string {
  return String(getEmbeddedAppVersionInfo().version ?? '').trim();
}

function publishIdentity(): void {
  setGuardifyIdentity({ deviceId: client?.deviceId, sessionId: client?.session?.id });
}

function friendlyError(e: unknown): string {
  if (e instanceof GuardifyError) {
    if (e.code === 'network') return 'Sin conexión con Guardify. Revisa tu internet e inténtalo de nuevo.';
    return e.message && e.message !== 'Error' ? e.message : `Guardify rechazó la solicitud (${e.code}).`;
  }
  return e instanceof Error ? e.message : 'Error inesperado con Guardify.';
}

function onSdkEvent(e: SdkEvent): void {
  if (e.type === 'state') {
    publishIdentity();
    patch({ sdk: e.state });
    return;
  }
  if (e.type !== 'command') return; // `wipe` y `force_update` llegan también como `command`
  const effect = commandEffect(e.command, e.payload, handlers?.getCedula() ?? null);
  if (effect === 'check_update') void checkGuardifyUpdate();
  else if (effect === 'wipe') void beginGuardifyWipe('wipe');
  else if (effect === 'logout') void handlers?.logout().catch((error) => console.warn('[guardify] no se pudo cerrar la sesión:', error));
}

/** Crea el SDK, lee el registro guardado y, en producción (código embebido), registra el equipo si todavía no lo está. */
export function initGuardify(): Promise<void> {
  if (!initPromise) initPromise = doInit();
  return initPromise;
}

async function doInit(): Promise<void> {
  const cfg = getConfig();
  if (!cfg.enabled) {
    patch({ ready: true, enabled: false });
    return;
  }
  try {
    const dev = new GuardifyDevice({
      baseUrl: cfg.baseUrl,
      appKey: cfg.appKey,
      deviceUid: await getDeviceUid(),
      storage: guardifyStorage,
      fetch: (input, init) => fetch(input, init),
      platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
      model: Device.modelName ?? undefined,
      osVersion: Device.osVersion ?? undefined,
      appVersion: currentAppVersion() || undefined,
    });
    dev.on(onSdkEvent);
    await dev.init();
    client = dev;
    publishIdentity();
    const order = parseWipeOrder(await guardifyStorage.get(WIPE_ORDER_KEY).catch(() => null));
    const consent = await guardifyStorage.get(LOCATION_CONSENT_KEY).catch(() => null);
    patch({
      ready: true,
      enabled: true,
      sdk: dev.state(),
      needsCode: !cfg.companyCode,
      wipe: order ? wipeInfo(order, 0) : null,
      locationConsent: consent === 'granted' || consent === 'declined' ? consent : null,
    });
    void autoRegister();
    void checkGuardifyUpdate();
  } catch (error) {
    // Un fallo local (almacenamiento) no debe dejar a nadie fuera de la app: se continúa sin Guardify en esta sesión.
    console.warn('[guardify] no se pudo iniciar:', error);
    patch({ ready: true, enabled: false });
  }
}

/** Id del equipo en Guardify (el que figura en su consola) tras esperar a que el SDK cargue; `undefined` si no está registrado. */
export async function getGuardifyIdentityReady(): Promise<{ deviceId?: string; sessionId?: string }> {
  await initGuardify().catch(() => undefined);
  return getGuardifyIdentity();
}

async function autoRegister(): Promise<void> {
  const cfg = getConfig();
  if (!client || client.state().kind !== 'unregistered' || !cfg.companyCode) return;
  if (!(await isDeviceOnline().catch(() => false))) return;
  await registerGuardifyDevice(cfg.companyCode);
}

/** Registra el equipo con el código de empresa (el embebido si no se escribe uno). Queda pendiente de aprobación. */
export async function registerGuardifyDevice(code?: string): Promise<{ ok: boolean; error?: string }> {
  const dev = client;
  if (!dev) return { ok: false, error: 'Guardify no está configurado en esta versión de la app.' };
  const value = normalizeCompanyCode(code) || getConfig().companyCode;
  if (!value) return { ok: false, error: 'Escribe el código de empresa.' };
  patch({ busy: true, error: null });
  try {
    await dev.register(value);
    await guardifyStorage.remove(RETIRED_WIPED_KEY).catch(() => undefined); // un equipo registrado de nuevo puede volver a retirarse
    publishIdentity();
    patch({ sdk: dev.state() });
    void checkGuardifyUpdate();
    return { ok: true };
  } catch (e) {
    const error = friendlyError(e);
    patch({ error });
    return { ok: false, error };
  } finally {
    patch({ busy: false });
  }
}

/** «Reintentar» de la pantalla de estado: consulta el estado del equipo en Guardify. */
export async function refreshGuardifyStatus(): Promise<void> {
  const dev = client;
  if (!dev) return;
  patch({ busy: true, error: null });
  try {
    if (!dev.deviceId) await autoRegister();
    else await dev.refreshStatus();
    patch({ sdk: dev.state() });
  } catch (e) {
    patch({ error: friendlyError(e) });
  } finally {
    patch({ busy: false });
  }
}

export type GuardifySessionResult = 'ok' | 'offline' | 'denied' | 'blocked' | 'disabled';

/**
 * Abre la sesión de acceso del empleado en Guardify (`access/verify` con su cédula) tras autenticarlo en la app. Sin conexión se deja
 * pasar: el trabajo sin red sigue y la sesión se abre en cuanto vuelva la conexión. `denied` = Guardify no le da acceso.
 */
export async function ensureGuardifySession(cedula: string): Promise<GuardifySessionResult> {
  await initGuardify();
  const dev = client;
  if (!dev) return 'disabled';
  const state = dev.state().kind;
  if (state === 'operational') return 'ok';
  if (state !== 'signed_out') return state === 'locked' ? 'offline' : 'blocked';
  try {
    await dev.login(cedula);
    publishIdentity();
    return 'ok';
  } catch (e) {
    if (e instanceof GuardifyError) {
      if (e.code === 'network') return 'offline';
      if (e.code.startsWith('device_')) return 'blocked';
      if (e.status >= 500) return 'offline';
    }
    console.warn('[guardify] acceso denegado:', e);
    patch({ error: friendlyError(e) });
    return 'denied';
  }
}

/** Cierra la sesión de acceso en Guardify (al cerrar sesión en la app). Nunca falla. */
export async function endGuardifySession(): Promise<void> {
  try {
    await client?.logout();
    publishIdentity();
  } catch {
    /* sin conexión: la sesión vence sola */
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Actualización de la app (catálogo de APK)

export async function checkGuardifyUpdate(): Promise<UpdateDecision | null> {
  const dev = client;
  if (!dev?.deviceId) return snapshot.update;
  try {
    const decision = decideUpdate(currentAppVersion(), await dev.latestApk(guardifyVariant()));
    patch({ update: decision });
    return decision;
  } catch {
    return snapshot.update; // sin conexión o equipo todavía no aprobado: se conserva lo último conocido
  }
}

/** Descarga el APK del catálogo con la credencial del equipo y abre el instalador. */
export async function installGuardifyUpdate(): Promise<DownloadAndShareResult> {
  const apk = snapshot.update?.apk;
  const authorization = (await client?.authorizationHeader()) ?? null;
  if (!apk || !authorization) return { ok: false, cancelled: false, message: 'No hay una actualización disponible para descargar.' };
  return downloadAndShareLargeFile({
    url: apk.downloadUrl,
    headers: { Authorization: authorization },
    fileName: apkFileName(guardifyVariant(), apk.version),
    mimeType: 'application/vnd.android.package-archive',
    dialogTitle: 'Instalar actualización',
  });
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Borrado remoto (WIPE) y equipo retirado

function wipeInfo(order: WipeOrder, pending: number) {
  return { reason: order.reason, orderedAt: order.orderedAt, deadlineAt: decideWipe({ order, pending: 1, now: order.orderedAt }).deadlineAt, pending };
}

/**
 * Recibe la orden de borrar los datos de la app. NO borra de inmediato: bloquea la app y deja que `runWipeStep` sincronice lo pendiente y borre
 * cuando la cola quede vacía o venza el plazo (72 h). La orden se guarda para sobrevivir a un reinicio; una orden repetida no reinicia el plazo.
 */
export async function beginGuardifyWipe(reason: WipeReason): Promise<void> {
  if (snapshot.wipe) return;
  if (reason === 'retired' && (await guardifyStorage.get(RETIRED_WIPED_KEY).catch(() => null))) return;
  const orderedAt = Number(await getHoraAccion(false));
  if (!Number.isFinite(orderedAt) || orderedAt <= 0) return;
  const order: WipeOrder = { orderedAt, reason };
  await guardifyStorage.set(WIPE_ORDER_KEY, JSON.stringify(order)).catch(() => undefined);
  patch({ wipe: wipeInfo(order, 0) });
  void runWipeStep();
}

async function countPendingInQueues(): Promise<number> {
  // Acceso sin filtrar (issue #176): el borrado espera el trabajo pendiente de TODOS los usuarios del equipo, no solo del que tiene la sesión.
  const keys = await queueRaw.getAllKeys();
  const queues = keys.filter((k) => /_actions$/.test(k));
  const entries = await queueRaw.multiGet(queues);
  return countPendingActions(entries);
}

/**
 * Borra TODO lo local salvo el registro del equipo en Guardify y su identificador: las llaves de `AsyncStorage` (incluidas las colas), los
 * archivos guardados en `Paths.document` (firmas, fotos, adjuntos) y el caché. Las sesiones del almacén seguro las borra el cierre de sesión.
 */
export async function wipeAllLocalData(): Promise<{ keys: number; files: number }> {
  const allKeys = await AsyncStorage.getAllKeys();
  const toRemove = allKeys.filter((k) => !shouldKeepKeyOnWipe(k));
  if (toRemove.length) await queueRaw.multiRemove(toRemove); // sin filtrar: el borrado se lleva también las colas de otros usuarios
  let files = 0;
  for (const dir of [Paths.document, Paths.cache]) {
    try {
      for (const entry of dir.list()) {
        if (shouldKeepFileOnWipe(String(entry.name ?? ''))) continue;
        try {
          entry.delete();
          files++;
        } catch (e) {
          console.warn('[guardify] no se pudo borrar un archivo:', e);
        }
      }
    } catch (e) {
      console.warn('[guardify] no se pudo listar el directorio:', e);
    }
  }
  return { keys: toRemove.length, files };
}

let wipeRunning = false;

/** Revisa una orden de borrado pendiente: espera mientras haya trabajo sin sincronizar y borra al terminar o al vencer el plazo. */
export async function runWipeStep(): Promise<'none' | 'waiting' | 'done'> {
  const order = snapshot.wipe;
  if (!order || wipeRunning) return order ? 'waiting' : 'none';
  wipeRunning = true;
  try {
    const pending = await countPendingInQueues();
    const decision = decideWipe({ order: { orderedAt: order.orderedAt, reason: order.reason }, pending, now: Number(await getHoraAccion(false)) });
    if (decision.action === 'wait') {
      if (pending !== order.pending) patch({ wipe: { ...order, pending } });
      eventBus.emit('syncCachesRequested'); // empuja la sincronización global de App.tsx (también corre sola cada 60 s)
      return 'waiting';
    }
    console.warn(`[guardify] borrando datos locales (${decision.cause === 'synced' ? 'todo sincronizado' : 'venció el plazo de 72 h'})`);
    await handlers?.logout().catch(() => undefined);
    await wipeAllLocalData();
    if (order.reason === 'retired') await guardifyStorage.set(RETIRED_WIPED_KEY, '1').catch(() => undefined);
    await guardifyStorage.remove(WIPE_ORDER_KEY).catch(() => undefined);
    patch({ wipe: null });
    return 'done';
  } catch (e) {
    console.warn('[guardify] no se pudo completar el borrado, se reintenta:', e);
    return 'waiting';
  } finally {
    wipeRunning = false;
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Consentimiento de ubicación

/** Guarda la respuesta de la persona al aviso de ubicación. Aceptar pide además el permiso del sistema (si lo niega, no se envía ubicación). */
export async function setLocationConsent(value: LocationConsent): Promise<void> {
  if (value === 'granted') {
    try {
      await Location.requestForegroundPermissionsAsync();
    } catch {
      /* sin permiso el latido va sin ubicación */
    }
  }
  await guardifyStorage.set(LOCATION_CONSENT_KEY, value).catch(() => undefined);
  patch({ locationConsent: value });
}

async function heartbeatExtras() {
  try {
    const consent = snapshot.locationConsent;
    const perm = consent === 'granted' ? await Location.getForegroundPermissionsAsync() : null;
    const stored = perm?.granted ? await readLastLocationFromStorage() : null;
    return heartbeatLocation({
      consent,
      stored: stored ? { latitude: stored.latitude, longitude: stored.longitude, atMs: parseLocationTimeMs(stored.updated_at) } : null,
      nowMs: Number(await getHoraAccion(false)),
    });
  } catch {
    return { consent: { location: false } };
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Segundo plano: estado, órdenes, latidos y renovación

/** Arranca el ciclo mientras la app está abierta. Devuelve la función que lo detiene. */
export function startGuardifyBackground(): () => void {
  const last = { status: 0, commands: 0, heartbeat: 0, update: 0, wipe: 0 };
  let running = false;
  let stopped = false;
  let tracked: { id: string; exp: number; issuedAt: number } | null = null;

  const due = (key: keyof typeof last, every: number, now: number) => {
    if (now - last[key] < every) return false;
    last[key] = now;
    return true;
  };

  const tick = async () => {
    const dev = client;
    if (!dev || running || stopped) return;
    running = true;
    try {
      // El borrado pendiente se revisa aunque no haya conexión: el plazo de 72 h corre igual.
      if (snapshot.wipe && due('wipe', WIPE_CHECK_MS, Date.now())) await runWipeStep();
      const online = await isDeviceOnline().catch(() => true);
      dev.setConnectivity(online);
      if (!online) return;
      const now = Date.now();

      if (!dev.deviceId) {
        await autoRegister();
        return;
      }
      const kind = dev.state().kind;
      if (kind === 'pending' && due('status', STATUS_PENDING_MS, now)) await dev.refreshStatus().catch(() => undefined);
      else if ((kind === 'blocked' || kind === 'rejected') && due('status', STATUS_BLOCKED_MS, now)) await dev.refreshStatus().catch(() => undefined);
      if (kind === 'pending' || kind === 'rejected' || kind === 'retired' || kind === 'unregistered') return;

      // Equipo activo (con o sin sesión, o con el permiso vencido por falta de contacto): latidos y órdenes.
      if (kind !== 'blocked') {
        if (kind === 'locked') last.heartbeat = 0; // un contacto exitoso reancla la hora y puede levantar el bloqueo
        if (due('heartbeat', HEARTBEAT_MS, now)) {
          const battery = batteryPercent(await Battery.getBatteryLevelAsync().catch(() => -1));
          await dev.heartbeat({ battery, ...(await heartbeatExtras()) }).catch(() => undefined);
        }
        if (due('commands', COMMANDS_MS, now)) await dev.pollCommands().catch(() => undefined);
        if (due('update', UPDATE_MS, now)) await checkGuardifyUpdate();
      }

      // Renovación del permiso de uso cuando queda la mitad o menos de lo que duró.
      const session = dev.session;
      if (session) {
        if (!tracked || tracked.id !== session.id || tracked.exp !== session.expMs) tracked = { id: session.id, exp: session.expMs, issuedAt: now };
        if (renewDue({ expMs: session.expMs, leaseMs: session.expMs - tracked.issuedAt, now })) await dev.renew().catch(() => undefined);
        publishIdentity();
      } else {
        tracked = null;
      }
      patch({ sdk: dev.state() });
    } finally {
      running = false;
    }
  };

  void initGuardify().then(() => tick());
  const timer = setInterval(() => void tick(), TICK_MS);
  const appState = AppState.addEventListener('change', (s) => {
    if (s === 'active') {
      last.commands = 0;
      last.status = 0;
      last.wipe = 0;
      void tick();
    }
  });
  return () => {
    stopped = true;
    clearInterval(timer);
    appState.remove();
  };
}
