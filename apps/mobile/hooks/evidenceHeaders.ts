/**
 * Parte PURA de la evidencia de cada acción (issue #152): arma las cabeceras `X-Evidence-*`. Sin dependencias de React Native para poder
 * probarla en Node; la lectura del GPS y de la hora está en `evidenceCapture.ts`.
 */

/** Las acciones que guardan datos; las lecturas (GET) no dejan evidencia. */
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Lecturas de GPS más viejas que esto no se envían como ubicación de la acción (se mandaría un lugar donde ya no está). */
export const EVIDENCE_LOCATION_MAX_AGE_MS = 10 * 60 * 1000;

export function isMutatingMethod(method: unknown): boolean {
  return MUTATING_METHODS.has(String(method ?? 'GET').toUpperCase());
}

export type EvidenceInputs = {
  permissionGranted: boolean;
  location: { latitude: number; longitude: number; atMs: number | null } | null;
  nowMs: number;
};

/** Tras un intento fallido de lectura fresca (GPS apagado, sin señal) no se vuelve a esperar en cada petición durante este tiempo. */
export const FRESH_LOCATION_RETRY_MS = 60_000;

/**
 * ¿Hay que tomar una lectura nueva del GPS al registrar la acción? Sí si hay permiso y la última lectura guardada no existe o ya es vieja
 * (la misma regla con la que `buildEvidenceHeaders` la descartaría), salvo que se acabe de fallar en intentarlo.
 */
export function needsFreshLocation(p: {
  permissionGranted: boolean;
  location: { atMs: number | null } | null;
  nowMs: number;
  lastFailedAtMs: number | null;
}): boolean {
  if (!p.permissionGranted) return false;
  if (p.lastFailedAtMs != null && p.nowMs >= p.lastFailedAtMs && p.nowMs - p.lastFailedAtMs < FRESH_LOCATION_RETRY_MS) return false;
  if (!p.location) return true;
  if (p.location.atMs == null) return false; // sin hora se acepta, igual que en `buildEvidenceHeaders`
  const age = p.nowMs - p.location.atMs;
  return age < 0 || age > EVIDENCE_LOCATION_MAX_AGE_MS;
}

/** Cabeceras de evidencia: `Perm: denied` si no hay permiso; sin lectura reciente solo viaja la hora. */
export function buildEvidenceHeaders(input: EvidenceInputs): Record<string, string> {
  if (!input.permissionGranted) {
    return { 'X-Evidence-Perm': 'denied', 'X-Evidence-At': String(Math.round(input.nowMs)) };
  }
  const loc = input.location;
  const fresh =
    loc != null &&
    Number.isFinite(loc.latitude) &&
    Number.isFinite(loc.longitude) &&
    (loc.atMs == null || (input.nowMs - loc.atMs >= 0 && input.nowMs - loc.atMs <= EVIDENCE_LOCATION_MAX_AGE_MS));
  if (!fresh || !loc) return { 'X-Evidence-At': String(Math.round(input.nowMs)) };
  return {
    'X-Evidence-Lat': String(loc.latitude),
    'X-Evidence-Lng': String(loc.longitude),
    'X-Evidence-At': String(Math.round(loc.atMs ?? input.nowMs)),
  };
}

/** `updated_at` de `last_location`: milisegundos o fecha ISO; null si no se puede leer. */
export function parseLocationTimeMs(raw: unknown): number | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const n = Number(s);
  if (Number.isFinite(n) && n > 0) return n;
  const t = new Date(s).getTime();
  return Number.isNaN(t) ? null : t;
}
