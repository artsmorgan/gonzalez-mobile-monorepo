import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { mapComplaintMasterPublicRow } from "../../mapPublicRow";
import { reportError } from "../../../../../utils/reportError";

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
                    corpo_id: parseInt(corpo_id),
                    isActive: true,
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
        const recordsWithIdLocal = recordsArray.map((record: any) =>
            mapComplaintMasterPublicRow(record, baseUrl, Number(record.id))
        );

        return NextResponse.json({
            status: true,
            message: "Quejas obtenidas correctamente",
            data: recordsWithIdLocal
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        await reportError(req, "api/complaints-master/corpo/[corpo_id]", "GET", 500, errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}

