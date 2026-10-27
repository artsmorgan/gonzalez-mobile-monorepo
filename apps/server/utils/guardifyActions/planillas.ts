/**
 * Token de Planillas de una persona para las acciones que Guardify pide en su nombre.
 *
 * La app guarda, al entrar la persona con su contraseña de Planillas, su token y cuándo vence en `a_mobile_token_for_planillas`
 * (`utils/createTokenPlanillas.ts`). Las acciones de Guardify usan ESE token (el mismo que la app ya reenvía cuando sincroniza lo pendiente de
 * una persona): no hay credencial nueva ni contraseña que Guardify conozca. Si no hay un token vigente, la acción se niega con
 * `planillas_session_required` y la persona debe abrir MonitoreApp y escribir su contraseña de Planillas.
 *
 * `expires_at` se calculó con la hora «de pared» de Costa Rica (`toZonedTime`), así que se compara contra esa misma hora, no contra UTC.
 */
export type TokenPlanillasRow = { token?: unknown; expires_at?: unknown } | null | undefined;

/** El token debe tener al menos este margen de vida: uno que vence en un segundo se vería vigente y Planillas lo rechazaría a mitad de la acción. */
export const MARGEN_TOKEN_MS = 60_000;

export function tokenPlanillasVigente(row: TokenPlanillasRow, ahoraPared: number): string | null {
    const token = String(row?.token ?? "").trim();
    if (!token) return null;
    const vence = row?.expires_at ? new Date(row.expires_at as string | number | Date).getTime() : NaN;
    if (!Number.isFinite(vence) || vence <= ahoraPared + MARGEN_TOKEN_MS) return null;
    return token;
}
