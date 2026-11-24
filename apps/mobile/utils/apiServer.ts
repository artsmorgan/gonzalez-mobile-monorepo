/**
 * ÚNICO punto de lectura del servidor de la app (issue #214). Antes cada pantalla leía `Constants.expoConfig?.extra?.API_SERVER`; ahora todas llaman
 * a `apiServer()`:
 *  - con Guardify encendido y una URL en la política del equipo: esa URL, solo si es https y su dominio está en `ALLOWED_SERVER_HOSTS` (lista fija
 *    del build; nunca llega por red);
 *  - en cualquier otro caso (Guardify apagado, sin política, URL no permitida): la del build (`API_SERVER`), igual que antes.
 * Se llama en cada uso (no se guarda en una constante al cargar el módulo): la política puede conocerse después de arrancar.
 */
import Constants from 'expo-constants';
import { getPolicyServerUrl, parseAllowedHosts, resolveApiServer } from '../hooks/apiServerCore';

function extra(): Record<string, unknown> {
  return (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
}

/** La URL con la que se compiló la app (sin la política de Guardify). */
export function buildApiServer(): string {
  return String(extra().API_SERVER ?? '');
}

/** Dominios que la app acepta como servidor (de `ALLOWED_SERVER_HOSTS` en el build). */
export function allowedServerHosts(): string[] {
  return parseAllowedHosts(extra().ALLOWED_SERVER_HOSTS);
}

/** El servidor con el que debe hablar la app ahora. */
export function apiServer(): string {
  return resolveApiServer({ fallback: buildApiServer(), policyUrl: getPolicyServerUrl(), allowedHosts: allowedServerHosts() });
}
