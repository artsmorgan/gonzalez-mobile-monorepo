import { NextRequest } from "next/server";
import { handlePublicarDocumento } from "../../../../utils/documentos/guardifyApi";
import { crearDocDeps } from "../../../../utils/documentos/guardifyDeps";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Guardify publica un documento (o una versión nueva): multipart con «meta» (JSON) y «file». Ver `docs/guardify/protocolo-documentos.md`. */
export async function POST(req: NextRequest) {
    return handlePublicarDocumento(req, crearDocDeps());
}
