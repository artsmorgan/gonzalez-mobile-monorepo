import { callDynamicPrisma } from "./callDynamicPrisma";
import { isInternalRequest } from "./internalRequests";
import { NextRequest } from "next/server";
import { toZonedTime } from "date-fns-tz";
import { verifyAccessTokenByApi } from '../utils/verifyAccessTokenByApi';
import { buildErrorLogRow, redactSecrets } from "./errorLogRow";

/**
 * Registra un error en `error_logs`. Nunca lanza: un fallo al registrar no debe tapar el error original ni romper la respuesta.
 * (Issue #181) Guarda el mensaje REAL del error —antes guardaba el de la verificación del token— con los secretos redactados, el código
 * HTTP, y no revienta si el token es inválido (entonces `user_id` queda vacío).
 */
export async function reportError(
    req: NextRequest,
    endpoint: string,
    method: string,
    status_code: number,
    message_error: string
) {
    try {
        let userId: number | null = null;
        // Una petición interna (la API de acciones de Guardify) no trae JWT de usuario: no se le reenvía su llave a otro servicio para validarla.
        if (!isInternalRequest(req)) {
            try {
                const { valid, payload } = await verifyAccessTokenByApi(req);
                if (valid) userId = Number(payload?.id) || null;
            } catch {
                /* sin identidad: el error se registra igual */
            }
        }

        let now = toZonedTime(new Date(), "America/Costa_Rica");
        if (process.env.NODE_ENV === "development") {
            now = toZonedTime(new Date(now.getTime() - 6 * 60 * 60 * 1000), "America/Costa_Rica");
        }

        await callDynamicPrisma({
            req,
            data: {
                action: "POST",
                table: "error_logs",
                operation: "create",
                data: buildErrorLogRow({ endpoint, method, status: status_code, message: message_error, userId, now }),
            }
        });
    } catch (e) {
        console.error("[reportError] no se pudo registrar el error:", redactSecrets(e));
    }
}
