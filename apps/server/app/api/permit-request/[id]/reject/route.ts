import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { reportError } from "../../../../../utils/reportError";
import { buildActionEnv } from "../../../../../utils/guardifyActions/appEnv";
import { rechazarPermisoSolicitud } from "../../../../../utils/guardifyActions/permisos";

export async function PUT(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
        if (!valid) {
            return NextResponse.json({ status: false, expired, message }, { status: expired ? 401 : 403 });
        }

        const resolvedParams = await context.params;
        const idNum = parseInt(String(resolvedParams.id), 10);
        if (!idNum) {
            await reportError(req, "api/permit-request/[id]/reject", "PUT", 400, "ID inválido");
            return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
        }

        const currentEmployeeId = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
        const body = await req.json().catch(() => ({}));
        // La lógica (reglas, bitácora y notificación) vive en `utils/guardifyActions/permisos.ts`: la comparte la API de acciones de Guardify.
        const res = await rechazarPermisoSolicitud(buildActionEnv(req, "api/permit-request/[id]/reject", "PUT", { verifyUser: true }), { id: idNum, actorId: currentEmployeeId, payload, body });
        if (!res.ok) return NextResponse.json({ status: false, message: res.message }, { status: res.status });
        return NextResponse.json(res.body, { status: res.status });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        await reportError(req, "api/permit-request/[id]/reject", "PUT", 500, errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}
