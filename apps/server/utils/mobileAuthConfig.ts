/**
 * Transición Fase 6: emisión/validación dual JWT legacy + Planillas.
 * `MOBILE_AUTH_DUAL_MODE=true` (default): login devuelve ambos tipos; refresh legacy activo.
 */
export function isMobileAuthDualModeEnabled(): boolean {
    const raw = process.env.MOBILE_AUTH_DUAL_MODE?.trim().toLowerCase();
    if (raw === "false" || raw === "0" || raw === "no") {
        return false;
    }
    return true;
}

export function isLegacyMobileRefreshEnabled(): boolean {
    return isMobileAuthDualModeEnabled();
}
