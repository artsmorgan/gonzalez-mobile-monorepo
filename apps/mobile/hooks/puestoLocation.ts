/**
 * Utilidades puras de la ubicación de un puesto (mapa y «Cómo llegar» con Waze). Sin Expo/React Native para poder probarlas en Node.
 */
export type LatLng = { lat: number; lng: number };

/** Coordenada válida (número o texto numérico) dentro del rango geográfico; `null` si falta o es inválida (incluye 0,0 sin dato). */
export function parseCoordinate(value: unknown, kind: 'lat' | 'lng'): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).trim().replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  const max = kind === 'lat' ? 90 : 180;
  return Math.abs(n) <= max ? n : null;
}

/** Punto del puesto a partir de `{ lat, lng }` (números o textos); `null` si no tiene coordenadas utilizables. */
export function parsePuestoPoint(ubicacion: { lat?: unknown; lng?: unknown } | null | undefined): LatLng | null {
  const lat = parseCoordinate(ubicacion?.lat, 'lat');
  const lng = parseCoordinate(ubicacion?.lng, 'lng');
  if (lat === null || lng === null) return null;
  if (lat === 0 && lng === 0) return null; // 0,0 es «sin dato» en la base
  return { lat, lng };
}

/** Texto «9.934739, -84.087502» (6 decimales). */
export function formatCoordinates(point: LatLng | null | undefined): string {
  return point ? `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}` : '—';
}

/**
 * Enlaces para abrir Waze con el puesto como destino: `app` abre la aplicación y `web` es el enlace universal (abre la aplicación si está
 * instalada y, si no, la tienda o el navegador). Waze toma como origen la ubicación actual del teléfono.
 */
export function buildWazeLinks(destino: LatLng): { app: string; web: string } {
  const ll = `${destino.lat},${destino.lng}`;
  return {
    app: `waze://?ll=${ll}&navigate=yes`,
    web: `https://waze.com/ul?ll=${encodeURIComponent(ll)}&navigate=yes&zoom=17`,
  };
}
