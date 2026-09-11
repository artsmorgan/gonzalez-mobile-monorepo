import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { resolveAppConnectivity } from '@/hooks/resolveAppConnectivity';

export const PUSH_DEVICE_ACTIONS_KEY = 'push_device_actions';
export const PUSH_LOCAL_TOKEN_KEY = 'push_fcm_token';
export const CURRENT_MARCA_UPDATED_EVENT = 'currentMarcaUpdated';

export type PushDeviceAction = {
  id: string;
  type: 'register' | 'unregister';
  payload: Record<string, unknown>;
  created_at: number;
};

/** Handler en primer plano: mostrar banner/lista/sonido (Android release a menudo no pinta el del SO solo). */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function resolveAppVariant(): 'lite' | 'full' {
  const pkg = String(Constants.expoConfig?.android?.package || '');
  if (pkg.endsWith('.lite')) return 'lite';
  const name = String(Constants.expoConfig?.name || '');
  if (name.toLowerCase().includes('lite')) return 'lite';
  return 'full';
}

export async function ensureAndroidNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const base = {
    vibrationPattern: [0, 250, 250, 250] as number[],
    lightColor: '#007AFF',
    sound: 'default' as const,
    enableVibrate: true,
    showBadge: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    importance: Notifications.AndroidImportance.MAX,
  };
  await Notifications.setNotificationChannelAsync('general', {
    ...base,
    name: 'Notificaciones generales',
  });
  await Notifications.setNotificationChannelAsync('procesos', {
    ...base,
    name: 'Procesos del sistema',
    lightColor: '#34C759',
  });
}

export async function requestPushPermissions(): Promise<boolean> {
  if (!Device.isDevice) {
    console.warn('[push] Las notificaciones push requieren un dispositivo físico');
    return false;
  }

  await ensureAndroidNotificationChannels();

  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== 'granted') {
    const asked = await Notifications.requestPermissionsAsync();
    status = asked.status;
  }
  return status === 'granted';
}

/** Token nativo FCM (Android) / APNs (iOS) para Firebase Admin. */
export async function getNativePushToken(): Promise<string | null> {
  try {
    const granted = await requestPushPermissions();
    if (!granted) return null;

    const deviceToken = await Notifications.getDevicePushTokenAsync();
    const token = String(deviceToken?.data || '').trim();
    console.log('[push] Token FCM:', token);
    if (!token) return null;
    await AsyncStorage.setItem(PUSH_LOCAL_TOKEN_KEY, token);
    return token;
  } catch (error) {
    console.error('[push] Error obteniendo token FCM:', error);
    return null;
  }
}

export async function readCurrentMarcaContext(): Promise<{
  empleadoFijo_id: number | null;
  plaza_id: number | null;
  marca_id: number | null;
}> {
  try {
    const raw = await AsyncStorage.getItem('current_marca');
    if (!raw) return { empleadoFijo_id: null, plaza_id: null, marca_id: null };
    const marca = JSON.parse(raw);
    const empleadoFijo_id = Number(marca?.empleadoFijo_id);
    const plaza_id = Number(marca?.plaza?.id ?? marca?.plaza_id);
    const marca_id = Number(marca?.id);
    return {
      empleadoFijo_id: Number.isFinite(empleadoFijo_id) && empleadoFijo_id > 0 ? empleadoFijo_id : null,
      plaza_id: Number.isFinite(plaza_id) && plaza_id > 0 ? plaza_id : null,
      marca_id: Number.isFinite(marca_id) && marca_id > 0 ? marca_id : null,
    };
  } catch {
    return { empleadoFijo_id: null, plaza_id: null, marca_id: null };
  }
}

export function buildRegisterPayload(params: {
  empleadoId: number | string;
  token: string;
  plazaId?: number | null;
}): Record<string, unknown> {
  const empleado_id = Number(params.empleadoId);
  const payload: Record<string, unknown> = {
    empleado_id,
    token: params.token,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    device_id: Device.modelId || Device.modelName || null,
    app_version: String(Constants.expoConfig?.version || Constants.expoConfig?.extra?.APP_VERSION_INFO?.version || ''),
    app_variant: resolveAppVariant(),
  };
  if (params.plazaId != null && Number.isFinite(Number(params.plazaId)) && Number(params.plazaId) > 0) {
    payload.plaza_id = Number(params.plazaId);
  }
  return payload;
}

async function enqueuePushAction(action: PushDeviceAction): Promise<void> {
  const raw = await AsyncStorage.getItem(PUSH_DEVICE_ACTIONS_KEY);
  const list: PushDeviceAction[] = raw ? JSON.parse(raw) : [];
  const next = Array.isArray(list) ? list.filter((a) => !(a.type === action.type && a.payload?.token === action.payload?.token)) : [];
  next.push(action);
  await AsyncStorage.setItem(PUSH_DEVICE_ACTIONS_KEY, JSON.stringify(next));
}

export async function registerPushDeviceOnline(params: {
  apiUrl: string;
  accessToken: string;
  payload: Record<string, unknown>;
}): Promise<boolean> {
  const response = await fetch(`${params.apiUrl}/api/push/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.accessToken}`,
      'ngrok-skip-browser-warning': '69420',
    },
    body: JSON.stringify(params.payload),
  });
  if (!response.ok) return false;
  const data = await response.json().catch(() => null);
  return Boolean(data?.status);
}

export async function unregisterPushDeviceOnline(params: {
  apiUrl: string;
  accessToken: string;
  token: string;
}): Promise<boolean> {
  const response = await fetch(`${params.apiUrl}/api/push/unregister`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.accessToken}`,
      'ngrok-skip-browser-warning': '69420',
    },
    body: JSON.stringify({ token: params.token }),
  });
  if (!response.ok) return false;
  const data = await response.json().catch(() => null);
  return Boolean(data?.status);
}

/**
 * Obtiene token, arma payload con empleado (+ plaza si hay current_marca)
 * y registra en backend o deja pendiente offline.
 */
export async function syncPushDeviceRegistration(params: {
  empleadoId: number | string;
  accessToken: string | null;
  apiUrl?: string | null;
}): Promise<void> {
  const apiUrl = params.apiUrl || Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl || !params.empleadoId) return;

  const token = await getNativePushToken();
  if (!token) return;

  const marcaCtx = await readCurrentMarcaContext();
  const payload = buildRegisterPayload({
    empleadoId: params.empleadoId,
    token,
    plazaId: marcaCtx.plaza_id,
  });

  const connectivity = await resolveAppConnectivity();
  if (!connectivity.ok || !params.accessToken) {
    await enqueuePushAction({
      id: `push-register-${Date.now()}`,
      type: 'register',
      payload,
      created_at: Date.now(),
    });
    return;
  }

  const ok = await registerPushDeviceOnline({
    apiUrl: String(apiUrl),
    accessToken: params.accessToken,
    payload,
  });

  if (!ok) {
    console.warn('[push] Registro online falló; encolando. tokenPrefix=', token.slice(0, 12));
    await enqueuePushAction({
      id: `push-register-${Date.now()}`,
      type: 'register',
      payload,
      created_at: Date.now(),
    });
  } else {
    console.log(
      '[push] Dispositivo registrado',
      'variant=',
      resolveAppVariant(),
      'tokenPrefix=',
      token.slice(0, 12),
      'plaza=',
      marcaCtx.plaza_id
    );
  }
}

export async function enqueueUnregisterPushDevice(token?: string | null): Promise<void> {
  const t = String(token || (await AsyncStorage.getItem(PUSH_LOCAL_TOKEN_KEY)) || '').trim();
  if (!t) return;
  await enqueuePushAction({
    id: `push-unregister-${Date.now()}`,
    type: 'unregister',
    payload: { token: t },
    created_at: Date.now(),
  });
}

/** Drena la cola offline de registro/desregistro FCM. */
export async function flushPushDeviceActions(params: {
  accessToken: string;
  apiUrl?: string | null;
}): Promise<void> {
  const apiUrl = params.apiUrl || Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl || !params.accessToken) return;

  const connectivity = await resolveAppConnectivity();
  if (!connectivity.ok) return;

  const raw = await AsyncStorage.getItem(PUSH_DEVICE_ACTIONS_KEY);
  if (!raw) return;
  let actions: PushDeviceAction[] = [];
  try {
    actions = JSON.parse(raw);
  } catch {
    return;
  }
  if (!Array.isArray(actions) || actions.length === 0) return;

  const remaining: PushDeviceAction[] = [];
  for (const action of actions) {
    try {
      if (action.type === 'register') {
        const ok = await registerPushDeviceOnline({
          apiUrl: String(apiUrl),
          accessToken: params.accessToken,
          payload: action.payload || {},
        });
        if (!ok) remaining.push(action);
      } else if (action.type === 'unregister') {
        const token = String(action.payload?.token || '').trim();
        if (!token) continue;
        const ok = await unregisterPushDeviceOnline({
          apiUrl: String(apiUrl),
          accessToken: params.accessToken,
          token,
        });
        if (!ok) remaining.push(action);
      }
    } catch (error) {
      console.error('[push] Error sincronizando acción:', error);
      remaining.push(action);
    }
  }

  await AsyncStorage.setItem(PUSH_DEVICE_ACTIONS_KEY, JSON.stringify(remaining));
}

export type PushNotificationData = {
  type?: string;
  id?: string;
  action?: string;
  channelId?: string;
  [key: string]: string | undefined;
};

/** Presenta en bandeja localmente (refuerzo cuando FCM entrega pero el SO no pinta heads-up). */
export async function presentPushAsLocalNotification(params: {
  title?: string | null;
  body?: string | null;
  data?: PushNotificationData;
}): Promise<void> {
  const channelId = params.data?.channelId === 'procesos' ? 'procesos' : 'general';
  await ensureAndroidNotificationChannels();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: String(params.title || 'MonitoreApp').trim() || 'MonitoreApp',
      body: String(params.body || '').trim() || 'Nueva notificación',
      data: { ...(params.data || {}), _presentedLocally: '1' },
      sound: true,
      ...(Platform.OS === 'android' ? { channelId } : {}),
    },
    trigger: null,
  });
}

export function extractPushData(content: Notifications.NotificationContent): PushNotificationData {
  const data = (content?.data || {}) as Record<string, unknown>;
  const out: PushNotificationData = {};
  for (const [k, v] of Object.entries(data)) {
    if (v == null) continue;
    out[k] = String(v);
  }
  return out;
}

/** Mapea payload interno → pantalla del stack. */
export function resolvePushNavigationTarget(data: PushNotificationData): {
  screen: string;
  params?: Record<string, unknown>;
} | null {
  const type = String(data.type || '').toLowerCase();
  const action = String(data.action || 'open').toLowerCase();
  if (action && action !== 'open' && action !== 'navigate') {
    // Otras acciones pueden manejarse sin navegar
  }

  switch (type) {
    case 'report':
    case 'reporte':
      return { screen: 'Reportes', params: data.id ? { reportId: data.id } : undefined };
    case 'activity':
    case 'actividad':
      return { screen: 'Activities', params: data.id ? { activityId: data.id } : undefined };
    case 'incident':
    case 'incidente':
      return { screen: 'Incidents', params: data.id ? { incidentId: data.id } : undefined };
    case 'permit':
    case 'permiso':
      return { screen: 'PermitRequest', params: data.id ? { permitId: data.id } : undefined };
    case 'mutuos':
    case 'mutuo':
      return { screen: 'MutuosAcuerdos', params: data.id ? { mutuoId: data.id } : undefined };
    case 'notification':
    case 'inbox':
    default:
      return { screen: 'Notifications' };
  }
}
