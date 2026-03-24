import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { toZonedTime } from "date-fns-tz";

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
            return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
        }

        const currentEmployeeId = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
        if (!currentEmployeeId) {
            return NextResponse.json({ status: false, message: "Empleado inválido" }, { status: 400 });
        }

        const empleado = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "c_empleado", operation: "findUnique", where: { id: currentEmployeeId } },
        });
        const myEjecutivoCuentaId = empleado?.supervisor_id ? Number(empleado.supervisor_id) : null;
        const isExecutive =
            Number(existing.ejecutivo_cuenta) === currentEmployeeId ||
            (myEjecutivoCuentaId != null && Number(existing.ejecutivo_cuenta) === myEjecutivoCuentaId);
        if (!isExecutive) {
            return NextResponse.json({ status: false, message: "No autorizado para rechazar esta solicitud" }, { status: 403 });
        }

        const estadoActual = String((existing as any)?.estado || "").trim().toLowerCase();
        if (estadoActual !== "pendiente") {
            return NextResponse.json({ status: false, message: "Solo se pueden rechazar solicitudes pendientes" }, { status: 400 });
        }

        const nowIso = toZonedTime(new Date(), "America/Costa_Rica").toISOString();
        const updatedRecord = await callDynamicPrisma({
            req,
            data: {
                action: "UPDATE",
                table: "c_solicitud_permiso",
                operation: "update",
                where: { id: idNum },
                data: {
                    estado: "rechazado",
                },
            },
        });

        await callDynamicPrisma({
            req,
            data: {
                action: "POST",
                table: "c_cambios_apps_modules",
                operation: "create",
                data: {
                    nombre_tabla: "c_solicitud_permiso",
                    registro_id: idNum,
                    cambios: JSON.stringify([
                        { prop: "estado", before: (existing as any)?.estado || null, after: "rechazado" },
                    ]),
                    created_at: nowIso,
                    created_by: currentEmployeeId,
                },
            },
        });

        return NextResponse.json({
            status: true,
            message: "Solicitud de permiso rechazada correctamente",
            data: updatedRecord,
        }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}
