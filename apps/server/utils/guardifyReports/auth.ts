import crypto from "node:crypto";

/**
 * Autenticación servidor a servidor de la API de reportes para Guardify.
 *
 * Guardify llama con una llave compartida (`GUARDIFY_REPORTS_API_KEY`), no con el token de un usuario de la app:
 * `Authorization: Bearer <llave>` o el encabezado `x-guardify-key`. Si la variable no está definida (o es corta),
 * la API queda **deshabilitada** (503) y el resto del servidor no se ve afectado.
 */
export const MIN_API_KEY_LENGTH = 24;

export type GuardifyAuth = { ok: true; user: string | null } | { ok: false; status: 401 | 503; error: "unauthorized" | "not_configured"; message: string };

const sha = (s: string) => crypto.createHash("sha256").update(s).digest();

export function verifyGuardifyApiKey(headers: Pick<Headers, "get">, env: Record<string, string | undefined> = process.env): GuardifyAuth {
    const expected = (env.GUARDIFY_REPORTS_API_KEY ?? "").trim();
    if (expected.length < MIN_API_KEY_LENGTH) {
        return { ok: false, status: 503, error: "not_configured", message: "La API de reportes para Guardify no está configurada." };
    }
    const bearer = (headers.get("authorization") ?? "").trim();
    const provided = (bearer.toLowerCase().startsWith("bearer ") ? bearer.slice(7) : headers.get("x-guardify-key") ?? "").trim();
    // Comparación en tiempo constante sobre los hashes (longitudes iguales).
    if (!provided || !crypto.timingSafeEqual(sha(provided), sha(expected))) {
        return { ok: false, status: 401, error: "unauthorized", message: "Llave inválida." };
    }
    const user = (headers.get("x-guardify-user") ?? "").trim().slice(0, 120);
    return { ok: true, user: user || null };
}
