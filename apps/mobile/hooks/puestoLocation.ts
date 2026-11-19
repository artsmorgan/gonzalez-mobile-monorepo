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

export type MapAppId = 'google' | 'waze' | 'otras' | 'apple';
export type MapAppOption = { id: MapAppId; label: string; detalle: string; url: string; fallbackUrl?: string };

/**
 * Aplicaciones con las que se puede abrir el mapa con el puesto como destino. La persona elige una:
 *  - Google Maps: ruta con el origen (la ubicación actual del dispositivo, si se conoce) y el destino.
 *  - Waze: destino (Waze toma la ubicación actual del teléfono como origen).
 *  - «Otras aplicaciones de mapas»: enlace `geo:` (Android) o Apple Maps (iOS), que le deja al sistema mostrar todas las aplicaciones de mapas instaladas.
 */
export function buildMapAppOptions(destino: LatLng, origen: LatLng | null, nombre: string | null | undefined, plataforma: string): MapAppOption[] {
  const dest = `${destino.lat},${destino.lng}`;
  const googleParams = ['api=1', `destination=${encodeURIComponent(dest)}`, 'travelmode=driving'];
  if (origen) googleParams.splice(1, 0, `origin=${encodeURIComponent(`${origen.lat},${origen.lng}`)}`);
  const waze = buildWazeLinks(destino);
  const etiqueta = String(nombre ?? '').trim();
  const opciones: MapAppOption[] = [
    { id: 'google', label: 'Google Maps', detalle: origen ? 'Ruta desde tu ubicación actual hasta el puesto' : 'Ruta hasta el puesto', url: `https://www.google.com/maps/dir/?${googleParams.join('&')}` },
    { id: 'waze', label: 'Waze', detalle: 'Ruta hasta el puesto desde tu ubicación actual', url: waze.app, fallbackUrl: waze.web },
  ];
  if (plataforma === 'ios') {
    opciones.push({ id: 'apple', label: 'Apple Maps', detalle: 'Ruta hasta el puesto', url: `http://maps.apple.com/?daddr=${encodeURIComponent(dest)}${origen ? `&saddr=${encodeURIComponent(`${origen.lat},${origen.lng}`)}` : ''}&dirflg=d` });
  } else {
    opciones.push({
      id: 'otras',
      label: 'Otras aplicaciones de mapas',
      detalle: 'El teléfono muestra las aplicaciones de mapas que tengas instaladas',
      url: `geo:${dest}?q=${encodeURIComponent(`${dest}${etiqueta ? `(${etiqueta})` : ''}`)}`,
    });
  }
  return opciones;
}
