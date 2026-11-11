import { getEmbeddedAppVersionInfo } from './appVariant';

/**
 * Versión de la app que se declara al servidor. El servidor puede exigir una versión concreta (`APP_LAST_VERSION` + `FORCE_APP_LAST_VERSION`,
 * ver `apps/server/middleware.ts`) y la lee de la cabecera `X-App-Version` o, en las URLs que no pueden mandar cabeceras (imágenes, audios,
 * videos, enlaces a archivos), del parámetro `app_version`.
 *
 *  - `fetch` hacia el servidor: la cabecera la agrega `installEvidenceFetch.ts` a toda petición (incluidas las de `authedFetch`).
 *  - Descargas nativas (`File.downloadFileAsync`): `appVersionHeaders()`.
 *  - URLs de archivos con `?token=`: `appVersionQuery()`.
 */
export function getAppVersionString(): string {
  try {
    return String(getEmbeddedAppVersionInfo().version ?? '').trim();
  } catch {
    return '';
  }
}

/** Cabeceras con la versión (vacío si no se conoce). */
export function appVersionHeaders(): Record<string, string> {
  const version = getAppVersionString();
  return version ? { 'X-App-Version': version } : {};
}

/** Parámetro para agregar al final de una URL que ya tiene `?` (p. ej. detrás de `?token=…`). */
export function appVersionQuery(): string {
  const version = getAppVersionString();
  return version ? `&app_version=${encodeURIComponent(version)}` : '';
}
