import { NextRequest } from "next/server";
import { handleTerminarAsignacion } from "../../../../../../../utils/documentos/guardifyApi";
import { crearDocDeps } from "../../../../../../../utils/documentos/guardifyDeps";

export const dynamic = "force-dynamic";

/** Termina una asignación vigente: deja de asignarse a quien entre después; lo ya entregado y los resultados se conservan. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    const { id } = await ctx.params;
    return handleTerminarAsignacion(req, id, crearDocDeps());
}
