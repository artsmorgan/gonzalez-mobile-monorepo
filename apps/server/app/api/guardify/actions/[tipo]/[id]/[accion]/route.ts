import { NextRequest } from "next/server";
import { handleActionExecute } from "../../../../../../../utils/guardifyActions/handler";
import { buildActionEnv } from "../../../../../../../utils/guardifyActions/appEnv";

export const dynamic = "force-dynamic";

/** Ejecuta una acción pedida por Guardify sobre un registro (ver `utils/guardifyActions/handler.ts`). */
export async function POST(req: NextRequest, ctx: { params: Promise<{ tipo: string; id: string; accion: string }> }) {
    const { tipo, id, accion } = await ctx.params;
    return handleActionExecute(req, tipo, id, accion, { getEnv: () => buildActionEnv(req, `api/guardify/actions/${tipo}/[id]/${accion}`, "POST", { verifyUser: false }) });
}
