import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";

export async function GET(req: NextRequest) {
    try {
        const { valid, expired, message } = await verifyAccessTokenByApi(req);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const documentTypes = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "e_tipo_documento",
                operation: "findMany",
                orderBy: { nombre: "asc" },
            },
        });
        const documentTypesArray = Array.isArray(documentTypes) ? documentTypes : [];
        return NextResponse.json({ status: true, documentTypes: documentTypesArray }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error("Error in GET /api/document-types:", errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}


