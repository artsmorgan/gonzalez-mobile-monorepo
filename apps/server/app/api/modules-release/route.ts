import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";

export async function GET(request: NextRequest) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(request);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }
        
        const records = await callDynamicPrisma({
            req: request,
            data: {
              action: "GET",
              table: "n_app_module_visibility",
              operation: "findMany",
              orderBy: { real_name: "asc" },
            },
          });

        const modules = Array.isArray(records) ? records : records ? [records] : [];

        return NextResponse.json({ status: true, modules }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ status: false, message: errorMessage, modules: [] }, { status: 500 });
    }
}