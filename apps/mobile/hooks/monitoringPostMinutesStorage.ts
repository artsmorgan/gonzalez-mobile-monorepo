import AsyncStorage from '@react-native-async-storage/async-storage';

export const MONITORING_POST_MINUTES_STORAGE_KEY = 'monitoring_post_minutes';
export const DEFAULT_MONITORING_POST_MINUTES = 0;

export function parseMonitoringPostMinutes(raw: unknown): number {
  const n = Number(String(raw ?? '').trim());
  if (!Number.isFinite(n) || n < 0) {
    return DEFAULT_MONITORING_POST_MINUTES;
  }
  return Math.floor(n);
}

export async function getMonitoringPostMinutesFromStorage(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(MONITORING_POST_MINUTES_STORAGE_KEY);
    if (raw == null || raw.trim() === '') {
      return DEFAULT_MONITORING_POST_MINUTES;
    }
    return parseMonitoringPostMinutes(raw);
  } catch {
    return DEFAULT_MONITORING_POST_MINUTES;
  }
}

export async function setMonitoringPostMinutesStorage(value: unknown): Promise<number> {
  const minutes = parseMonitoringPostMinutes(value);
  await AsyncStorage.setItem(MONITORING_POST_MINUTES_STORAGE_KEY, String(minutes));
  return minutes;
}
