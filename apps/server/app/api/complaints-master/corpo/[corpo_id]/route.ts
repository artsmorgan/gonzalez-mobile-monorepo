import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";

function buildFileUrl(baseUrl: string, recordId: number, file: { name: string; type: string }): string {
    const fileName = file.name;
    const type = String(file.type || "file").toLowerCase();
    let urlPath: string;
    if (type === "image") {
        urlPath = `/api/complaints-master/${recordId}/get-image/${fileName}`;
    } else if (type === "audio") {
        urlPath = `/api/complaints-master/${recordId}/get-audio/${fileName}`;
    } else if (type === "video") {
        urlPath = `/api/complaints-master/${recordId}/get-video/${fileName}`;
    } else {
        urlPath = `/api/complaints-master/${recordId}/get-file/${fileName}`;
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

        const records = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_maestro_quejas",
                operation: "findMany",
                where: {
                    corpo_id: parseInt(corpo_id)
                },
                orderBy: {
                    created_at: 'desc'
                },
                include: {
                    c_anexos_quejas: true,
                },
            },
        });

        const recordsArray = Array.isArray(records) ? records : [];
        const baseUrl = req.nextUrl.origin;
        const recordsWithIdLocal = recordsArray.map((record: any) => ({
            ...record,
            id_local: "",
            files: (Array.isArray(record.c_anexos_quejas) ? record.c_anexos_quejas : []).map((f: any) => ({
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
            message: "Quejas obtenidas correctamente",
            data: recordsWithIdLocal
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

