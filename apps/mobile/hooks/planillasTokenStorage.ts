import AsyncStorage from '@react-native-async-storage/async-storage';
import getHoraAccion from './getHoraAccion';

export const PLANILLAS_TOKEN_KEY = 'planillas_token';
export const PLANILLAS_TOKEN_EXPIRES_AT_KEY = 'planillas_token_expires_at';

export type StoredPlanillasToken = {
  token: string;
  expiresAtMs: number;
};

export function parsePlanillasTokenExpiresAt(raw: string | null | undefined): number | null {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed);
    const asNumber = Number(parsed);
    if (Number.isFinite(asNumber) && asNumber > 0) {
      return asNumber;
    }
  } catch {
    /* plain numeric string */
  }

  const direct = parseInt(trimmed, 10);
  return Number.isFinite(direct) && direct > 0 ? direct : null;
}

export async function readStoredPlanillasToken(): Promise<StoredPlanillasToken | null> {
  const [tokenRaw, expiresAtRaw] = await Promise.all([
    AsyncStorage.getItem(PLANILLAS_TOKEN_KEY),
    AsyncStorage.getItem(PLANILLAS_TOKEN_EXPIRES_AT_KEY),
  ]);

  const token = String(tokenRaw ?? '').trim();
  const expiresAtMs = parsePlanillasTokenExpiresAt(expiresAtRaw);

  if (!token || expiresAtMs == null) {
    return null;
  }

  return { token, expiresAtMs };
}

export async function isStoredPlanillasTokenValid(
  referenceMs?: number
): Promise<{ valid: boolean; token: string | null }> {
  const stored = await readStoredPlanillasToken();
  if (!stored) {
    return { valid: false, token: null };
  }

  let nowMs = referenceMs;
  if (nowMs == null || !Number.isFinite(nowMs)) {
    try {
      nowMs = await getHoraAccion();
    } catch {
      nowMs = Date.now();
    }
  }

  if (stored.expiresAtMs < nowMs) {
    return { valid: false, token: null };
  }

  return { valid: true, token: stored.token };
}

/** Extrae el payload del token desde la respuesta del endpoint (soporta un nivel de anidación extra). */
export function extractPlanillasTokenFromResponse(data: unknown): {
  planillasToken: string;
  planillasTokenExpiresAt: number;
} | null {
  let current: unknown = data;

  for (let depth = 0; depth < 4; depth += 1) {
    if (!current || typeof current !== 'object') {
      break;
    }

    const obj = current as Record<string, unknown>;
    const token = String(obj.planillasToken ?? '').trim();
    const expiresAt = Number(obj.planillasTokenExpiresAt);

    if (token && Number.isFinite(expiresAt) && expiresAt > 0) {
      return { planillasToken: token, planillasTokenExpiresAt: expiresAt };
    }

    current = obj.data;
  }

  return null;
}

export async function persistStoredPlanillasToken({
  planillasToken,
  planillasTokenExpiresAt,
}: {
  planillasToken: string;
  planillasTokenExpiresAt: number;
}): Promise<void> {
  const token = String(planillasToken ?? '').trim();
  const expiresAtMs = Number(planillasTokenExpiresAt);

  if (!token || !Number.isFinite(expiresAtMs) || expiresAtMs <= 0) {
    throw new Error('Token de Planillas inválido');
  }

  await Promise.all([
    AsyncStorage.setItem(PLANILLAS_TOKEN_KEY, token),
    AsyncStorage.setItem(PLANILLAS_TOKEN_EXPIRES_AT_KEY, String(expiresAtMs)),
  ]);
}
