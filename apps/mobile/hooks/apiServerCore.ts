/**
 * Servidor de la app que entrega Guardify (issue #214, SDK 0.7.0): parte PURA, sin Expo ni React Native, para probarla en Node.
 *
 * Decisión del 23 de noviembre: la URL del servidor la entrega Guardify en la política de cada equipo (`policy.serverUrl`). Así un mismo APK sirve
 * a varios clientes o entornos y cambiar de servidor no exige recompilar. La política viaja por red, así que NUNCA se confía en ella a ciegas:
 * solo se acepta si es https y su dominio está en `ALLOWED_SERVER_HOSTS`, una lista FIJA del build (`app.config.js`). Si no cumple, se usa la URL
 * del build (`API_SERVER`), igual que antes de esta función.
 *
 * Quien decide qué URL usa la app es `apiServer()` (`utils/apiServer.ts`); este módulo guarda la URL de la política en memoria
 * (`setPolicyServerUrl`, la escribe `guardifyClient.ts` cuando conoce la política del equipo) y la valida.
 */
import { pickServerUrl } from '../vendor/guardify-sdk';

/** Dominios permitidos desde el valor del build: texto separado por comas (`EXPO_PUBLIC_ALLOWED_SERVER_HOSTS`) o una lista. */
export function parseAllowedHosts(raw: unknown): string[] {
  const parts = Array.isArray(raw) ? raw : String(raw ?? '').split(',');
  const out: string[] = [];
  for (const p of parts) {
    const h = String(p ?? '').trim().toLowerCase();
    if (h && !out.includes(h)) out.push(h);
  }
  return out;
}

/** Compara dos URL de servidor sin que cuenten las barras finales ni las mayúsculas del dominio. */
export function sameServerUrl(a: string | null | undefined, b: string | null | undefined): boolean {
  return normalizeServerUrl(a) === normalizeServerUrl(b);
}

export function normalizeServerUrl(url: string | null | undefined): string {
  const s = String(url ?? '').trim().replace(/\/+$/, '');
  if (!s) return '';
  try {
    const u = new URL(s);
    return `${u.protocol}//${u.host.toLowerCase()}${u.pathname.replace(/\/+$/, '')}`;
  } catch {
    return s.toLowerCase();
  }
}

/**
 * La URL con la que trabaja la app: la de la política si es válida (https, sin credenciales ni parámetros y de un dominio de la lista), si no la del
 * build. Sin política (`policyUrl` vacío) devuelve la del build TAL COMO viene, sin tocarla.
 */
export function resolveApiServer(input: { fallback: string; policyUrl?: string | null; allowedHosts: readonly string[] }): string {
  if (!input.policyUrl) return input.fallback;
  return pickServerUrl(input.policyUrl, { allowedHosts: input.allowedHosts, fallback: input.fallback });
}

let policyServerUrl: string | null = null;

/** La URL que dio Guardify para este equipo (null = ninguna: se usa la del build). */
export function setPolicyServerUrl(url: string | null | undefined): void {
  policyServerUrl = url ? String(url) : null;
}

export function getPolicyServerUrl(): string | null {
  return policyServerUrl;
}

/** Qué hacer al conocer la URL del servidor de la política frente a la última que usó la app. */
export type ServerChange = 'none' | 'switch';

/**
 * `last` = la última URL con la que trabajó la app (null = nunca se guardó: antes de esta versión la app siempre usaba la del build, así que se
 * toma esa). Si la nueva es distinta, hay que cerrar la sesión y borrar los datos locales: son de otro servidor.
 */
export function decideServerChange(input: { last: string | null; next: string; buildUrl: string }): ServerChange {
  const before = input.last && input.last.trim() ? input.last : input.buildUrl;
  return sameServerUrl(before, input.next) ? 'none' : 'switch';
}
