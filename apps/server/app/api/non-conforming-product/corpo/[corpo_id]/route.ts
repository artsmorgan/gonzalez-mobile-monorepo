import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { reportError } from "../../../../../utils/reportError";

function buildFileUrl(baseUrl: string, recordId: number, file: { name: string; type: string }): string {
  const fileName = file.name;
  const type = String(file.type || "file").toLowerCase();
  let urlPath: string;
  if (type === "image") {
    urlPath = `/api/non-conforming-product/${recordId}/get-image/${fileName}`;
  } else if (type === "audio") {
    urlPath = `/api/non-conforming-product/${recordId}/get-audio/${fileName}`;
  } else if (type === "video") {
    urlPath = `/api/non-conforming-product/${recordId}/get-video/${fileName}`;
  } else {
    urlPath = `/api/non-conforming-product/${recordId}/get-file/${fileName}`;
  }
  return `${baseUrl}${urlPath}`;
}

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ corpo_id: string }> }
) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const { corpo_id } = resolvedParams;

        const corpoId = parseInt(String(corpo_id), 10);
        if (!corpoId) {
            await reportError(req, "api/non-conforming-product/corpo/[corpo_id]", "GET", 400, "Sucursal (corpo) no especificada");
            return NextResponse.json({ status: false, message: "Sucursal (corpo) no especificada" }, { status: 400 });
        }

        const records = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_producto_no_conforme",
                operation: "findMany",
                where: { corpo_id: corpoId, isActive: true },
                include: { e_archivos_producto_no_conforme: true },
                orderBy: { created_at: 'desc' }
            },
        });

        const recordsArray = Array.isArray(records) ? records : [];
        const baseUrl = req.nextUrl.origin;
        const recordsWithExtras = recordsArray.map((record: any) => ({
            ...record,
            id_local: "",
            files: (Array.isArray(record.e_archivos_producto_no_conforme) ? record.e_archivos_producto_no_conforme : []).map((f: any) => ({
                id: f.id,
                name: f.name,
                original_name: f.original_name,
                type: f.type,
                extension: f.extension,
                url: buildFileUrl(baseUrl, record.id, f),
            })),
        }));

        return NextResponse.json({
            status: true,
            message: "Productos no conformes obtenidos correctamente",
            data: recordsWithExtras
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        await reportError(req, "api/non-conforming-product/corpo/[corpo_id]", "GET", 500, errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}

