import Constants from 'expo-constants';

/**
 * Feature flag de rollout (Fase 6).
 * `EXPO_PUBLIC_USE_PLANILLAS_AUTH=false` → modo legacy (JWT propio + refresh).
 * Por defecto: Planillas (token 1h, sin renovación).
 */
export function isPlanillasAuthEnabled(): boolean {
  const raw = Constants.expoConfig?.extra?.USE_PLANILLAS_AUTH;
  if (raw === false || raw === 'false' || raw === 0 || raw === '0') {
    return false;
  }
  return true;
}

export function getLegacyTokenLifetimeMinutes(): number {
  const minutes = Number(Constants.expoConfig?.extra?.LEGACY_MINUTES_LIFE_TIME_TOKEN ?? 24 * 60);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 24 * 60;
}
