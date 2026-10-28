import { callDynamicPrisma } from "./callDynamicPrisma";
import { isInternalRequest } from "./internalRequests";
import { NextRequest } from "next/server";
import { toZonedTime, format } from "date-fns-tz";
import { verifyAccessTokenByApi } from '../utils/verifyAccessTokenByApi';

export async function reportError(
    req: NextRequest,
    endpoint: string,
    method: string,
    status_code: number,
    message_error: string
) {
    /*
    model error_logs {
        id          Int      @id @default(autoincrement())
        endpoint    String   @db.VarChar(255)
        method      String   @db.VarChar(10)
        status_code Int?
        message     String   @db.LongText
        stack       String?  @db.LongText
        user_id     Int?
        created_at  DateTime @default(now()) @db.DateTime(0)
    }
    */
    // Una petición interna (la API de acciones de Guardify) no trae JWT de usuario: no se le reenvía su llave a otro servicio para validarla.
    const { payload } = isInternalRequest(req) ? { payload: null as { id?: unknown } | null } : await verifyAccessTokenByApi(req);

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
            data: {
                endpoint,
                method,
                status_code,
                message: message_error,
                user_id: payload?.id ?? null,
                created_at: now
            }
        }
    });
}