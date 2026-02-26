import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";
import { toZonedTime } from "date-fns-tz";

export async function PUT(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

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
            return NextResponse.json({ status: false, message: "No autorizado para completar esta solicitud" }, { status: 403 });
        }

        if (existing.firma_ejecutivo_cuenta_digital || existing.firma_ejecutivo_cuenta_manual) {
            return NextResponse.json({ status: false, message: "La solicitud ya fue completada por el ejecutivo" }, { status: 400 });
        }

        const body = await req.json();
        const reemplazoObligatorio = body?.reemplazo_obligatorio !== undefined && body?.reemplazo_obligatorio !== null
            ? Number(body.reemplazo_obligatorio)
            : null;
        const firmaDigital = String(body?.firma_ejecutivo_cuenta_digital || "").trim();
        const firmaManual = String(body?.firma_ejecutivo_cuenta_manual || "").trim();

        if (!firmaDigital || firmaDigital.length < 10 || !firmaManual || firmaManual.length < 10) {
            return NextResponse.json({ status: false, message: "Debes generar firma digital y firma manual del ejecutivo" }, { status: 400 });
        }

        let turnos: any[] = [];
        try {
            turnos = JSON.parse(String(existing.turnos || "[]"));
            if (!Array.isArray(turnos)) turnos = [];
        } catch {
            turnos = [];
        }

        const turnosPayload = Array.isArray(body?.turnos) ? body.turnos : [];
        const byTurnoId = new Map<number, number | null>();
        for (const row of turnosPayload) {
            const turnoId = parseInt(String(row?.id), 10);
            if (!turnoId) continue;
            const replacement = row?.reemplazo_id !== undefined && row?.reemplazo_id !== null
                ? Number(row.reemplazo_id)
                : null;
            byTurnoId.set(turnoId, replacement);
        }

        const turnosUpdated = turnos.map((row: any) => {
            const turnoId = parseInt(String(row?.id), 10);
            const repl = byTurnoId.has(turnoId) ? byTurnoId.get(turnoId) : (row?.reemplazo_id ?? null);
            return {
                ...row,
                reemplazo_id: repl ?? null,
            };
        });

        const nowIso = toZonedTime(new Date(), "America/Costa_Rica").toISOString();
        const updatedRecord = await callDynamicPrisma({
            req,
            data: {
                action: "UPDATE",
                table: "c_solicitud_permiso",
                operation: "update",
                where: { id: idNum },
                data: {
                    reemplazo_obligatorio: reemplazoObligatorio,
                    turnos: JSON.stringify(turnosUpdated),
                    firma_ejecutivo_cuenta_digital: firmaDigital,
                    firma_ejecutivo_cuenta_manual: firmaManual,
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
                        { prop: "reemplazo_obligatorio", before: existing.reemplazo_obligatorio, after: reemplazoObligatorio },
                        { prop: "turnos", before: existing.turnos, after: JSON.stringify(turnosUpdated) },
                        { prop: "firma_ejecutivo_cuenta_digital", before: existing.firma_ejecutivo_cuenta_digital || null, after: firmaDigital },
                        { prop: "firma_ejecutivo_cuenta_manual", before: existing.firma_ejecutivo_cuenta_manual || null, after: firmaManual },
                    ]),
                    created_at: nowIso,
                    created_by: currentEmployeeId,
                },
            },
        });

        return NextResponse.json({
            status: true,
            message: "Solicitud de permiso completada correctamente",
            data: updatedRecord
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
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
        if (!currentEmployeeId || Number(existing.empleado_id) !== Number(currentEmployeeId)) {
            return NextResponse.json({ status: false, message: "Solo el creador puede eliminar la solicitud" }, { status: 403 });
        }

        if (existing.firma_ejecutivo_cuenta_digital || existing.firma_ejecutivo_cuenta_manual) {
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
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

