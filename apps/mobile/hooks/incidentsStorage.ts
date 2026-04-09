import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ExecutiveOption, Incident, IncidentClassificationOption, IncidentContribution } from './incidentsTypes';

export const INCIDENTS_CACHE_KEY = 'incidents_cache';
export const INCIDENTS_ACTIONS_KEY = 'incidents_actions';
export const INCIDENTS_CLASSIFICATIONS_CACHE_KEY = 'incidents_classifications_cache';
export const EXECUTIVES_CACHE_KEY = 'executives_cache';

export const INCIDENT_CONTRIBUTIONS_CACHE_KEY = 'incident_contributions_cache';
export const INCIDENT_CONTRIBUTIONS_ACTIONS_KEY = 'incident_contributions_actions';

export async function getCurrentMarcaId(): Promise<number | null> {
  const currentMarca = await AsyncStorage.getItem('current_marca');
  if (!currentMarca) return null;
  try {
    const parsed = JSON.parse(currentMarca);
    const id = parsed?.id;
    if (typeof id === 'number') return id;
    const parsedInt = parseInt(String(id), 10);
    return Number.isNaN(parsedInt) ? null : parsedInt;
  } catch {
    return null;
  }
}

export async function getCurrentMarcaCorpoId(): Promise<number | null> {
  const currentMarca = await AsyncStorage.getItem('current_marca');
  if (!currentMarca) return null;
  try {
    const parsed = JSON.parse(currentMarca);
    const id = parsed?.corpo?.id ?? parsed?.corpo_id;
    if (typeof id === 'number') return id;
    const parsedInt = parseInt(String(id), 10);
    return Number.isNaN(parsedInt) ? null : parsedInt;
  } catch {
    return null;
  }
}

export async function getIncidentsCache(): Promise<Incident[] | null> {
  const str = await AsyncStorage.getItem(INCIDENTS_CACHE_KEY);
  if (!str) return null;
  try {
    return JSON.parse(str) as Incident[];
  } catch {
    return null;
  }
}

export async function setIncidentsCache(incidents: Incident[]): Promise<void> {
  await AsyncStorage.setItem(INCIDENTS_CACHE_KEY, JSON.stringify(incidents));
}

/** Incidentes visibles para la sucursal/corporación activa (caché u online). */
export function filterIncidentsByCorpo(incidents: Incident[], corpoId: number | null | undefined): Incident[] {
  if (corpoId == null || Number.isNaN(Number(corpoId))) return [];
  const id = Number(corpoId);
  return incidents.filter((i) => i.corpo_id != null && Number(i.corpo_id) === id);
}

/**
 * Tras un GET exitoso: conserva otras `corpo_id` en caché y los borradores locales (`id === 0` + `id_local`)
 * de esta sucursal; sustituye el resto del slice por la respuesta del servidor.
 */
export function mergeIncidentsCacheForCorpo(existing: Incident[], freshFromServer: Incident[], corpoId: number): Incident[] {
  const cid = Number(corpoId);
  const freshTagged = freshFromServer.map((i) => ({
    ...i,
    corpo_id: i.corpo_id != null ? Number(i.corpo_id) : cid,
  }));

  const pendingLocalOnly = existing.filter(
    (e) =>
      e.corpo_id != null &&
      Number(e.corpo_id) === cid &&
      !!e.id_local &&
      e.id_local !== '' &&
      e.id === 0,
  );

  const keepOtherSlices = existing.filter((e) => e.corpo_id == null || Number(e.corpo_id) !== cid);

  return [...keepOtherSlices, ...pendingLocalOnly, ...freshTagged];
}

export async function getIncidentsClassificationsCache(): Promise<IncidentClassificationOption[] | null> {
  const str = await AsyncStorage.getItem(INCIDENTS_CLASSIFICATIONS_CACHE_KEY);
  if (!str) return null;
  try {
    return JSON.parse(str) as IncidentClassificationOption[];
  } catch {
    return null;
  }
}

export async function setIncidentsClassificationsCache(classifications: IncidentClassificationOption[]): Promise<void> {
  await AsyncStorage.setItem(INCIDENTS_CLASSIFICATIONS_CACHE_KEY, JSON.stringify(classifications));
}

export async function getExecutivesCache(): Promise<ExecutiveOption[] | null> {
  const str = await AsyncStorage.getItem(EXECUTIVES_CACHE_KEY);
  if (!str) return null;
  try {
    return JSON.parse(str) as ExecutiveOption[];
  } catch {
    return null;
  }
}

export async function setExecutivesCache(executives: ExecutiveOption[]): Promise<void> {
  await AsyncStorage.setItem(EXECUTIVES_CACHE_KEY, JSON.stringify(executives));
}

export async function getIncidentContributionsCache(): Promise<IncidentContribution[] | null> {
  const str = await AsyncStorage.getItem(INCIDENT_CONTRIBUTIONS_CACHE_KEY);
  if (!str) return null;
  try {
    return JSON.parse(str) as IncidentContribution[];
  } catch {
    return null;
  }
}

export async function setIncidentContributionsCache(items: IncidentContribution[]): Promise<void> {
  await AsyncStorage.setItem(INCIDENT_CONTRIBUTIONS_CACHE_KEY, JSON.stringify(items));
}

export async function getIncidentContributionsByIncidentId(incidentId: number): Promise<IncidentContribution[]> {
  const cache = (await getIncidentContributionsCache()) || [];
  return cache.filter((c) => c.incidente_id === incidentId);
}


