import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import authedFetch from './authedFetch';
import { mergeMainStructureFragments } from './mergeMainStructureFragments';
import { persistMainStructureFragments } from './mainStructureFragmentsStorage';
import { writeMainStructureCacheString } from './mainStructureCacheStorage';

export type MainStructureTreeNode = Record<string, unknown>;

export type MainStructureDownloadResult = {
  structureTree: MainStructureTreeNode[];
  createdAt: number | null;
};

export type MainStructureScope = {
  empresaId?: number | null;
  clienteId?: number | null;
  divisionId?: number | null;
  contratoId?: number | null;
  sucursalId?: number | null;
  puestoId?: number | null;
};

export type MainStructureModules = {
  estructura: boolean;
  vehiculos: boolean;
  llaves: boolean;
  mantenimientos: boolean;
};

export type MainStructureRegenerateOptions = {
  scope?: MainStructureScope;
  modules?: MainStructureModules;
  mergeWithExisting?: boolean;
};

type AuthHandlers = {
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<unknown>;
};

function getApiUrl(): string {
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
  if (!apiUrl) throw new Error('Server URL not configured');
  return String(apiUrl).replace(/\/+$/, '');
}

/** Token compartido con el servidor (`MOBILE_ACCESS_TOKEN` / `EXPO_PUBLIC_MOBILE_ACCESS_TOKEN`). */
export function getMobileAccessToken(): string {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  return String(extra?.MOBILE_ACCESS_TOKEN ?? '').trim();
}

export function buildMainStructureUrl(
  path: 'main-structure' | 'main-structure/last',
  extraParams?: Record<string, string | number | boolean | null | undefined>,
): string {
  const apiUrl = getApiUrl();
  const params = new URLSearchParams();
  const mobileAccessToken = getMobileAccessToken();
  if (mobileAccessToken) {
    params.set('mobileAccessToken', mobileAccessToken);
  }
  params.set('shouldVerifyAccessToken', 'true');
  if (extraParams) {
    for (const [key, value] of Object.entries(extraParams)) {
      if (value == null || value === '') continue;
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return `${apiUrl}/api/${path}${qs ? `?${qs}` : ''}`;
}

/** Persiste la respuesta del API en el dispositivo (misma lógica que JerarquiaModule en original-proyect). */
export async function persistMainStructurePayload(data: Record<string, unknown>): Promise<MainStructureTreeNode[]> {
  if (data.fragments && typeof data.fragments === 'object' && !Array.isArray(data.fragments)) {
    const fragments = data.fragments as Record<string, unknown>;
    await persistMainStructureFragments(fragments);
    return mergeMainStructureFragments(fragments as Record<string, any>) as MainStructureTreeNode[];
  }

  let rawStructure: unknown = data.structure;
  if (typeof rawStructure === 'string' && rawStructure.trim().length > 0) {
    await persistMainStructureFragments({});
    await writeMainStructureCacheString(rawStructure);
    try {
      rawStructure = JSON.parse(rawStructure);
    } catch {
      rawStructure = null;
    }
  } else if (typeof rawStructure === 'string') {
    rawStructure = null;
  }

  if (Array.isArray(rawStructure)) {
    const structureTree = rawStructure as MainStructureTreeNode[];
    if (typeof data.structure !== 'string') {
      await persistMainStructureFragments({});
      await writeMainStructureCacheString(JSON.stringify(structureTree));
    }
    return structureTree;
  }

  throw new Error(String(data.message ?? 'Error al actualizar la jerarquía'));
}

async function parseJsonResponse(response: Response): Promise<Record<string, unknown>> {
  try {
    const data = await response.json();
    return data != null && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Consulta `created_at` del cache en servidor (`/api/main-structure/last`). */
export async function fetchServerMainStructureCreatedAt(auth: AuthHandlers): Promise<number | null> {
  const response = await authedFetch({
    url: buildMainStructureUrl('main-structure/last', { created_at: 0 }),
    init: { method: 'GET' },
    refreshAccessToken: auth.refreshAccessToken,
    logout: auth.logout,
  });
  if (!response) return null;

  const data = await parseJsonResponse(response);
  const incoming = Number(data.created_at);
  return Number.isFinite(incoming) && incoming > 0 ? incoming : null;
}

async function syncCreatedAtFromServer(auth: AuthHandlers, data: Record<string, unknown>): Promise<number | null> {
  const fromPayload = Number(data.created_at);
  if (Number.isFinite(fromPayload) && fromPayload > 0) {
    return fromPayload;
  }
  return fetchServerMainStructureCreatedAt(auth);
}

async function persistDownloadResult(
  auth: AuthHandlers,
  data: Record<string, unknown>,
): Promise<MainStructureDownloadResult> {
  const structureTree = await persistMainStructurePayload(data);
  const createdAt = await syncCreatedAtFromServer(auth, data);

  if (createdAt != null) {
    await AsyncStorage.setItem('main_structure_created_at', String(createdAt));
  }

  return { structureTree, createdAt };
}

/**
 * Genera en servidor (POST) y persiste fragmentos localmente (formato main-structure.json).
 */
export async function regenerateAndDownloadMainStructure(
  auth: AuthHandlers,
  options: MainStructureRegenerateOptions = {},
): Promise<MainStructureDownloadResult> {
  const response = await authedFetch({
    url: buildMainStructureUrl('main-structure'),
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope: options.scope ?? {},
        modules: options.modules,
        mergeWithExisting: options.mergeWithExisting !== false,
      }),
    },
    refreshAccessToken: auth.refreshAccessToken,
    logout: auth.logout,
  });

  if (!response) {
    throw new Error('Sesión expirada');
  }

  const data = await parseJsonResponse(response);
  if (!response.ok || data.status !== true) {
    throw new Error(String(data.message ?? 'Error al generar la jerarquía'));
  }

  return persistDownloadResult(auth, data);
}

export type MainStructureDownloadOptions = {
  /** Si true y GET no tiene cache, dispara POST completo. Por defecto false (como el original). */
  fallbackToRegenerate?: boolean;
};

/**
 * Descarga jerarquía desde `/api/main-structure`.
 * - `regenerate`: POST (genera en servidor y descarga fragmentos).
 * - `cache`: GET del archivo en disco (structure mergeada, como el proxy original).
 */
export async function downloadMainStructureFromServer(
  auth: AuthHandlers,
  mode: 'regenerate' | 'cache' = 'cache',
  regenerateOptions?: MainStructureRegenerateOptions,
  options?: MainStructureDownloadOptions,
): Promise<MainStructureDownloadResult> {
  if (mode === 'regenerate') {
    return regenerateAndDownloadMainStructure(auth, regenerateOptions);
  }

  const response = await authedFetch({
    url: buildMainStructureUrl('main-structure'),
    init: { method: 'GET' },
    refreshAccessToken: auth.refreshAccessToken,
    logout: auth.logout,
  });
  if (!response) {
    throw new Error('Sesión expirada');
  }

  const data = await parseJsonResponse(response);
  if (!response.ok || data.status !== true) {
    if (options?.fallbackToRegenerate === true) {
      return regenerateAndDownloadMainStructure(auth, regenerateOptions);
    }
    throw new Error(String(data.message ?? 'No hay jerarquía en cache del servidor'));
  }

  return persistDownloadResult(auth, data);
}
