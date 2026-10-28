import { NextRequest } from "next/server";
import { handleImport } from "../../../../../../utils/guardifyActions/handler";
import { buildActionEnv } from "../../../../../../utils/guardifyActions/appEnv";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Carga masiva pedida por Guardify (ver `utils/guardifyActions/handler.ts`). */
export async function POST(req: NextRequest, ctx: { params: Promise<{ tipo: string }> }) {
    const { tipo } = await ctx.params;
    return handleImport(req, tipo, { getEnv: () => buildActionEnv(req, `api/guardify/actions/imports/${tipo}`, "POST", { verifyUser: false }) });
}
