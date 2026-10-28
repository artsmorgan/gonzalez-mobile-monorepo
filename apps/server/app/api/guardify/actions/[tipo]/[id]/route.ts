import { NextRequest } from "next/server";
import { handleActionDetail } from "../../../../../../utils/guardifyActions/handler";
import { buildActionEnv } from "../../../../../../utils/guardifyActions/appEnv";

export const dynamic = "force-dynamic";

/** Detalle de un registro para Guardify: estado, acciones que el actor puede ejecutar e historial (ver `utils/guardifyActions/handler.ts`). */
export async function GET(req: NextRequest, ctx: { params: Promise<{ tipo: string; id: string }> }) {
    const { tipo, id } = await ctx.params;
    return handleActionDetail(req, tipo, id, { getEnv: () => buildActionEnv(req, `api/guardify/actions/${tipo}/[id]`, "GET", { verifyUser: false }) });
}
