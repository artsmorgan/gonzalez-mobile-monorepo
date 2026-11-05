import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";
import { toZonedTime } from "date-fns-tz";
import { reportError } from "../../../../utils/reportError";
import { buildActionEnv } from "../../../../utils/guardifyActions/appEnv";
import { aprobarPermisoSolicitud } from "../../../../utils/guardifyActions/aprobar-permiso";


export async function PUT(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const planillasToken = decodeURIComponent(req.headers.get('Planillas-Token') ?? '') || null;
        if (!planillasToken) {
            await reportError(req, "api/permit-request/[id]", "PUT", 400, "Token de Planillas no encontrado");
            return NextResponse.json({ status: false, message: "Token de Planillas no encontrado" }, { status: 400 });
        }

        const resolvedParams = await context.params;
        const idNum = parseInt(String(resolvedParams.id), 10);
        if (!idNum) {
            await reportError(req, "api/permit-request/[id]", "PUT", 400, "ID inválido");
            return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
        }

        const currentEmployeeId = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
        // La lógica (reglas, Planillas, firmas, bitácora y notificación) vive en `utils/guardifyActions/aprobar-permiso.ts`: la comparte la API de acciones de Guardify.
        const res = await aprobarPermisoSolicitud(buildActionEnv(req, "api/permit-request/[id]", "PUT", { verifyUser: true }), { id: idNum, actorId: currentEmployeeId, payload, readBody: () => req.json(), planillasToken });
        if (!res.ok) return NextResponse.json({ status: false, message: res.message }, { status: res.status });
        return NextResponse.json(res.body, { status: res.status });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        await reportError(req, "api/permit-request/[id]", "PUT", 500, errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const { id } = resolvedParams;
        const idNum = parseInt(id, 10);
        if (!idNum) {
            await reportError(req, "api/permit-request/[id]", "DELETE", 400, "ID inválido");
            return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
        }

        const existing = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_solicitud_permiso",
                operation: "findUnique",
                where: { id: idNum },
            },
        });
        if (!existing) {
            await reportError(req, "api/permit-request/[id]", "DELETE", 404, "Registro no encontrado");
            return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
        }

        const currentEmployeeId = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
        if (!currentEmployeeId || Number(existing.empleado_id) !== Number(currentEmployeeId)) {
            await reportError(req, "api/permit-request/[id]", "DELETE", 400, "Solo el creador puede eliminar la solicitud");
            return NextResponse.json({ status: false, message: "Solo el creador puede eliminar la solicitud" }, { status: 400 });
        }

        if (existing.firma_ejecutivo_cuenta_digital || existing.firma_ejecutivo_cuenta_manual) {
            await reportError(req, "api/permit-request/[id]", "DELETE", 400, "No se puede eliminar una solicitud ya completada");
            return NextResponse.json({ status: false, message: "No se puede eliminar una solicitud ya completada" }, { status: 400 });
        }

        // Registrar cambio de eliminación antes de eliminar
        const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
        const createdAt = toZonedTime(new Date(), "America/Costa_Rica");
        await callDynamicPrisma({
            req,
            data: {
                action: "POST",
                table: "c_cambios_apps_modules",
                operation: "create",
                data: {
                    nombre_tabla: "c_solicitud_permiso",
                    registro_id: idNum,
                    cambios: JSON.stringify([{
                        prop: "__deleted__",
                        before: existing,
                        after: null,
                    }]),
                    created_at: createdAt.toISOString(),
                    created_by: createdBy,
                },
            },
        });

        await callDynamicPrisma({
            req,
            data: {
                action: "DELETE",
                table: "c_solicitud_permiso",
                operation: "delete",
                where: { id: idNum },
            },
        });

        return NextResponse.json({
            status: true,
            message: "Solicitud de permiso eliminada correctamente"
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        await reportError(req, "api/permit-request/[id]", "DELETE", 500, errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}

