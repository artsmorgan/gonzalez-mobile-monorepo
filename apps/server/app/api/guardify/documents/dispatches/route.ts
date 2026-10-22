import { NextRequest } from "next/server";
import { handleEnviarDocumento } from "../../../../../utils/documentos/guardifyApi";
import { crearDocDeps } from "../../../../../utils/documentos/guardifyDeps";

export const dynamic = "force-dynamic";

/** Guardify envía un documento publicado a puestos / divisiones / toda la empresa (asignación vigente). */
export async function POST(req: NextRequest) {
    return handleEnviarDocumento(req, crearDocDeps());
}
