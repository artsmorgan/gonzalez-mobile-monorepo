import { NextRequest } from "next/server";
import { handleVistaPreviaDocumento } from "../../../../../utils/documentos/guardifyApi";
import { crearDocDeps } from "../../../../../utils/documentos/guardifyDeps";

export const dynamic = "force-dynamic";

/** Cuántos empleados recibirían un documento enviado a esa audiencia y alcance. */
export async function POST(req: NextRequest) {
    return handleVistaPreviaDocumento(req, crearDocDeps());
}
