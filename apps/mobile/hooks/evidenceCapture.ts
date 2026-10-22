/**
 * Evidencia de cada acción (issue #152): dispositivo, latitud y longitud que la app manda al servidor con cada alta o edición, en cabeceras
 * `X-Evidence-*` (el dispositivo viaja en `X-Device-Uid`, ver `authedFetch`). El servidor las une a la firma y las guarda en la tabla central de
 * evidencia (`apps/server/utils/evidencia.ts`).
 *
 * - La ubicación sale de la última lectura del sondeo de GPS de la app (`last_location`, cada ~30 s), que no cuesta tiempo ni batería extra
 *   en cada petición. Cuando el registro lleva la firma de captura (`firma_responsable`, con su propia lectura de GPS en el momento de la
 *   acción) el servidor usa ESA ubicación y estas cabeceras solo respaldan a los módulos que no la tienen.
 * - Si esa lectura ya tiene más de 10 minutos (p. ej. la app estuvo en segundo plano, donde el sondeo no corre) se toma una lectura nueva al
 *   registrar la acción (última posición conocida o lectura con tope de 3 s); si falla, no se reintenta durante un minuto.
 * - Si el permiso de ubicación está negado la acción se guarda igual: se manda `X-Evidence-Perm: denied` y la evidencia queda marcada.
 * - La hora es la de `getHoraAccion` (hora de reloj de CR); nunca la del dispositivo.
 */
import * as Location from 'expo-location';
import getHoraAccion from './getHoraAccion';
import { buildEvidenceHeaders, EVIDENCE_LOCATION_MAX_AGE_MS, needsFreshLocation, parseLocationTimeMs } from './evidenceHeaders';
import { stampFromHeaders, type EvidenceStamp } from './evidenceQueue';
import { readLastLocationFromStorage, writeLastLocationFromGps } from './updateLastLocation';

export { isMutatingMethod } from './evidenceHeaders';

const FRESH_LOCATION_TIMEOUT_MS = 3_000;
let lastFreshFailureMs: number | null = null;

/**
 * Lectura nueva del GPS al registrar una acción cuando la guardada ya es vieja (p. ej. la app estuvo en segundo plano, donde el sondeo no
 * corre). Primero la última posición conocida del sistema; si no hay, una lectura con tope de 3 s para no demorar el guardado. Si logra una
 * lectura la guarda como `last_location` (la ven también los demás módulos). Nunca lanza.
 */
async function readFreshLocation(nowMs: number): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const known = await Location.getLastKnownPositionAsync({ maxAge: EVIDENCE_LOCATION_MAX_AGE_MS, requiredAccuracy: 100 });
    const pos =
      known ??
      (await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), FRESH_LOCATION_TIMEOUT_MS)),
      ]));
    if (!pos) {
      lastFreshFailureMs = nowMs;
      return null;
    }
    const { latitude, longitude } = pos.coords;
    await writeLastLocationFromGps(latitude, longitude);
    lastFreshFailureMs = null;
    return { latitude, longitude };
  } catch {
    lastFreshFailureMs = nowMs;
    return null;
  }
}

/** Sello de evidencia del momento actual, para guardarlo con una acción encolada sin conexión (ver `evidenceQueue.ts`). */
export async function captureEvidenceStamp(): Promise<EvidenceStamp | null> {
  return stampFromHeaders(await getEvidenceHeaders());
}

/**
 * Cabeceras de evidencia para una petición que guarda datos. Nunca lanza ni bloquea: ante cualquier error devuelve solo la hora (o nada),
 * porque la evidencia no debe impedir que el guarda registre su trabajo.
 */
export async function getEvidenceHeaders(): Promise<Record<string, string>> {
  try {
    const nowMs = Number(await getHoraAccion(false));
    if (!Number.isFinite(nowMs) || nowMs <= 0) return {};
    const perm = await Location.getForegroundPermissionsAsync();
    const stored = perm.granted ? await readLastLocationFromStorage() : null;
    let location = stored ? { latitude: stored.latitude, longitude: stored.longitude, atMs: parseLocationTimeMs(stored.updated_at) } : null;
    if (needsFreshLocation({ permissionGranted: perm.granted, location, nowMs, lastFailedAtMs: lastFreshFailureMs })) {
      const fresh = await readFreshLocation(nowMs);
      if (fresh) location = { ...fresh, atMs: nowMs };
    }
    return buildEvidenceHeaders({ permissionGranted: perm.granted, location, nowMs });
  } catch {
    return {};
  }
}
