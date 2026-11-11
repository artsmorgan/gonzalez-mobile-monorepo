import AsyncStorage from '@react-native-async-storage/async-storage';

export const MONITORING_PREVIOUS_MINUTES_STORAGE_KEY = 'monitoring_previous_minutes';
export const DEFAULT_MONITORING_PREVIOUS_MINUTES = 15;

export function parseMonitoringPreviousMinutes(raw: unknown): number {
  const n = Number(String(raw ?? '').trim());
  if (!Number.isFinite(n) || n < 0) {
    return DEFAULT_MONITORING_PREVIOUS_MINUTES;
  }
  return Math.floor(n);
}

export async function getMonitoringPreviousMinutesFromStorage(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(MONITORING_PREVIOUS_MINUTES_STORAGE_KEY);
    if (raw == null || raw.trim() === '') {
      return DEFAULT_MONITORING_PREVIOUS_MINUTES;
    }
    return parseMonitoringPreviousMinutes(raw);
  } catch {
    return DEFAULT_MONITORING_PREVIOUS_MINUTES;
  }
}

export async function setMonitoringPreviousMinutesStorage(value: unknown): Promise<number> {
  const minutes = parseMonitoringPreviousMinutes(value);
  await AsyncStorage.setItem(MONITORING_PREVIOUS_MINUTES_STORAGE_KEY, String(minutes));
  return minutes;
}
