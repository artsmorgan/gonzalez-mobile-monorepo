import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../../utils/callDynamicPrisma";
import { deleteDynamicFile } from "../../../../../../utils/callDynamicFilesApi";
import { reportError } from "../../../../../../utils/reportError";

export const runtime = "nodejs";

function getPncFileAccessTokenFromRequest(req: NextRequest): string {
  const auth = req.headers.get("authorization") || "";
  if (auth.startsWith("Bearer ")) {
    const t = auth.slice(7).trim();
    if (t) return t;
  }
  return String(req.nextUrl.searchParams.get("token") || "").trim();
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; archivoId: string }> }
) {
  try {
    const { valid, expired, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json({ status: false, expired, message }, { status: expired ? 401 : 403 });
    }

    const accessToken = getPncFileAccessTokenFromRequest(req);
    const tokenOpt = accessToken ? accessToken : undefined;

    const resolvedParams = await context.params;
    const pncId = parseInt(String(resolvedParams.id), 10);
    const archivoId = parseInt(String(resolvedParams.archivoId), 10);
    if (!pncId || !archivoId) {
      await reportError(req, "api/non-conforming-product/[id]/archivo/[archivoId]", "DELETE", 400, "ID o adjunto no válido");
      return NextResponse.json({ status: false, message: "ID o adjunto no válido" }, { status: 400 });
    }

    const row = await callDynamicPrisma({
      req,
      token: tokenOpt,
      data: {
        action: "GET",
        table: "e_archivos_producto_no_conforme",
        operation: "findFirst",
        where: { id: archivoId, pnc_id: pncId },
      },
    });
    if (!row) {
      await reportError(req, "api/non-conforming-product/[id]/archivo/[archivoId]", "DELETE", 404, "Adjunto no encontrado");
      return NextResponse.json({ status: false, message: "Adjunto no encontrado" }, { status: 404 });
    }
    const fileRow = row as { name: string; pnc_id: number };
    const relative = `non-conforming-product/${pncId}/${fileRow.name}`;

    await callDynamicPrisma({
      req,
      token: tokenOpt,
      data: {
        action: "DELETE",
        table: "e_archivos_producto_no_conforme",
        operation: "delete",
        where: { id: archivoId, pnc_id: pncId },
      },
    });

    try {
      await deleteDynamicFile({ req, url: relative });
    } catch (e) {
      console.error("deleteDynamicFile PNC adjunto (continuando):", e);
    }

    return NextResponse.json(
      { status: true, message: "Adjunto eliminado", data: { id: archivoId } },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("DELETE PNC archivo:", errorMessage);
    await reportError(req, "api/non-conforming-product/[id]/archivo/[archivoId]", "DELETE", 500, errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}
