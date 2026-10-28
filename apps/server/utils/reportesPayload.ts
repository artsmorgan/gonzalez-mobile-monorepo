/**
 * Arma el payload de `executeReportesOperation` (issue #169).
 *
 * Antes el cuerpo del cliente iba DESPUÉS de los campos de seguridad (`{ mobileAccessToken, shouldVerifyAccessToken, token, ...body }`), de modo
 * que el cliente podía sobrescribir `shouldVerifyAccessToken` (para saltarse la verificación del JWT), `token` y `mobileAccessToken`. Ahora el
 * cuerpo va primero y los campos de seguridad siempre después: lo que mande el cliente en esos nombres se descarta.
 */
export const REPORTES_SECURITY_FIELDS = ["mobileAccessToken", "shouldVerifyAccessToken", "token"] as const;

export function buildReportesPayload<T extends Record<string, unknown>>(p: {
    body: T;
    mobileAccessToken: string;
    accessToken?: string | null;
}): Omit<T, (typeof REPORTES_SECURITY_FIELDS)[number]> & { mobileAccessToken: string; shouldVerifyAccessToken: true; token: string | undefined } {
    return {
        ...p.body,
        mobileAccessToken: p.mobileAccessToken,
        shouldVerifyAccessToken: true,
        token: p.accessToken || undefined,
    };
}
