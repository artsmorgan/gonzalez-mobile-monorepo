/**
 * Control de versión de la app (middleware): con `FORCE_APP_LAST_VERSION` encendida, el servidor solo atiende a la app si declara la versión
 * `APP_LAST_VERSION` (cabecera `X-App-Version`, o `app_version` en la URL para imágenes, audios, videos y enlaces que no pueden mandar cabeceras).
 * Módulo puro (sin Next) para poder probarlo.
 *
 * Quedan fuera del control:
 *  - `OPTIONS` (consulta previa CORS del navegador, no lleva cabeceras propias).
 *  - `/api/mobile-versions` y `/api/mobile-versions/{version}`: consultar la última versión y descargar el instalador, que es justo lo que
 *    necesita una app desactualizada para ponerse al día (también sin sesión, desde el inicio de sesión).
 *  - `/api/dynamic-prisma/*`: llamadas internas del propio servidor a sí mismo (`callDynamicPrisma`, archivos, reportes); no vienen de la app.
 *  - `/api/guardify/*`: llamadas de servidor a servidor de la consola de Guardify; tienen su propia llave.
 */
export type VersionGateEnv = { APP_LAST_VERSION?: string; FORCE_APP_LAST_VERSION?: string };

export type VersionGateInput = {
    pathname: string;
    method: string;
    headerVersion?: string | null;
    queryVersion?: string | null;
    env?: VersionGateEnv;
};

export type VersionGateResult =
    | { blocked: false }
    | { blocked: true; status: 426; body: { status: false; update_required: true; required_version: string; current_version: string | null; message: string } };

const EXEMPT_PREFIXES = ["/api/mobile-versions", "/api/dynamic-prisma", "/api/guardify"];

export function isForceEnabled(raw: unknown): boolean {
    return /^(true|1|on|yes|si|sí)$/i.test(String(raw ?? "").trim());
}

/** «v1.0.5», «1.0.5 » y «1.0.5» son la misma versión. */
export function normalizeAppVersion(raw: unknown): string {
    return String(raw ?? "").trim().replace(/^v/i, "");
}

export function isVersionGateExempt(pathname: string, method: string): boolean {
    if (String(method).toUpperCase() === "OPTIONS") return true;
    const p = String(pathname).replace(/\/+$/, "") || "/";
    return EXEMPT_PREFIXES.some((prefix) => p === prefix || p.startsWith(prefix + "/"));
}

export function versionRequiredMessage(required: string): string {
    return `Tu versión de la aplicación ya no es compatible. Para continuar, actualiza a la versión ${required} desde la pantalla de inicio de sesión o contacta a tu administrador.`;
}

export function evaluateAppVersion(input: VersionGateInput): VersionGateResult {
    const env = input.env ?? (process.env as VersionGateEnv);
    if (!isForceEnabled(env.FORCE_APP_LAST_VERSION)) return { blocked: false };
    const required = normalizeAppVersion(env.APP_LAST_VERSION);
    if (!required) return { blocked: false }; // sin versión exigida no hay nada que comparar
    if (isVersionGateExempt(input.pathname, input.method)) return { blocked: false };
    const current = normalizeAppVersion(input.headerVersion) || normalizeAppVersion(input.queryVersion);
    if (current === required) return { blocked: false };
    return {
        blocked: true,
        status: 426,
        body: { status: false, update_required: true, required_version: required, current_version: current || null, message: versionRequiredMessage(required) },
    };
}
