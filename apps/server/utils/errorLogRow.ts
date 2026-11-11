/**
 * Fila de `error_logs` sin secretos (issue #181). Puro, para probarlo en Node.
 *
 * Los mensajes de error vienen de excepciones, de respuestas de otros servicios y a veces de la propia petición; pueden arrastrar un
 * `Authorization: Bearer …`, un JWT, `password=…` o un `?token=…` de una URL. Nada de eso debe llegar a la tabla de errores ni a los logs.
 */

const REDACTED = "[REDACTADO]";

const PATTERNS: Array<[RegExp, string]> = [
    [/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, `Bearer ${REDACTED}`],
    [/\bBasic\s+[A-Za-z0-9+/=]{8,}/gi, `Basic ${REDACTED}`],
    // JWT (tres segmentos base64url, el primero empieza por «eyJ»)
    [/\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g, REDACTED],
    // clave: valor / clave=valor / "clave":"valor" para nombres de credenciales
    [
        /((?:access|refresh|mobile[_-]?access|planillas|id|session)?[_-]?token|password|passwd|contrase(?:ñ|n)a|secret|client[_-]?secret|api[_-]?key|authorization|cookie)(["']?\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,&;}"']+)/gi,
        `$1$2${REDACTED}`,
    ],
];

export function redactSecrets(text: unknown): string {
    let out = typeof text === "string" ? text : text instanceof Error ? text.message : (() => { try { return JSON.stringify(text) ?? String(text); } catch { return String(text); } })();
    for (const [re, replacement] of PATTERNS) out = out.replace(re, replacement);
    return out;
}

export const MAX_ERROR_MESSAGE_CHARS = 4000;

export type ErrorLogRow = {
    endpoint: string;
    method: string;
    status_code: number | null;
    message: string;
    user_id: number | null;
    created_at: Date;
};

export function buildErrorLogRow(p: { endpoint: string; method: string; status: unknown; message: unknown; userId: unknown; now: Date }): ErrorLogRow {
    const status = Number(p.status);
    const user = Number(p.userId);
    return {
        endpoint: String(p.endpoint ?? "").slice(0, 255),
        method: String(p.method ?? "").slice(0, 10),
        status_code: Number.isInteger(status) && status >= 100 && status <= 599 ? status : null,
        message: redactSecrets(p.message).slice(0, MAX_ERROR_MESSAGE_CHARS),
        user_id: Number.isInteger(user) && user > 0 ? user : null,
        created_at: p.now,
    };
}
