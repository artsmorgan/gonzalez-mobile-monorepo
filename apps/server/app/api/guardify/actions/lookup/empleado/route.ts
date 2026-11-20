import { NextRequest } from "next/server";
import { handleLookupEmpleado } from "../../../../../../utils/guardifyActions/handler";
import { buildActionEnv } from "../../../../../../utils/guardifyActions/appEnv";

export const dynamic = "force-dynamic";

/** Empleado por código para elegir un reemplazo (ver `utils/guardifyActions/handler.ts`). */
export async function GET(req: NextRequest) {
    return handleLookupEmpleado(req, { getEnv: () => buildActionEnv(req, "api/guardify/actions/lookup/empleado", "GET", { verifyUser: false }) });
}
