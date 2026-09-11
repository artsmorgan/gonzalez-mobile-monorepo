import type { MobileTokenPayload } from "./tokenValidationTypes";

/**
 * Identificador de sesión para firmas digitales y auditoría.
 * Legacy: `sessionId` UUID. Planillas: `username` (cédula) como fallback estable.
 */
export function getMobileSessionId(payload: MobileTokenPayload | null | undefined): string {
    if (!payload) return "unknown";
    const sessionId = String(payload.sessionId ?? "").trim();
    if (sessionId) return sessionId;
    const username = String(payload.username ?? "").trim();
    if (username) return username;
    const cedula = String(payload.cedula ?? "").trim();
    if (cedula) return cedula;
    const id = payload.id;
    return id != null ? String(id) : "unknown";
}
