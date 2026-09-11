import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MutuoAcuerdo } from './mutuosAcuerdosTypes';

export const MUTUOS_ACUERDOS_CACHE_KEY = 'mutuos_acuerdos_cache';
export const MUTUOS_ACUERDOS_ACTIONS_KEY = 'mutuos_acuerdos_actions';

export async function getMutuosAcuerdosCache(): Promise<MutuoAcuerdo[] | null> {
  const str = await AsyncStorage.getItem(MUTUOS_ACUERDOS_CACHE_KEY);
  if (!str) return null;
  try {
    return JSON.parse(str) as MutuoAcuerdo[];
  } catch {
    return null;
  }
}

export async function setMutuosAcuerdosCache(items: MutuoAcuerdo[]): Promise<void> {
  await AsyncStorage.setItem(MUTUOS_ACUERDOS_CACHE_KEY, JSON.stringify(items));
}


