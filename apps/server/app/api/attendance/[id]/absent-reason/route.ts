import { NextRequest, NextResponse } from "next/server";
import { toZonedTime } from "date-fns-tz";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { prisma } from "../../../../../utils/prismaClient";
import { sendNotificationByRole } from "../../../../../utils/sendNotification";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { reportError } from "../../../../../utils/reportError";

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);

        const body = await req.json();
        const { reason, horaAccion } = body as { reason?: string; horaAccion?: number };
        if (reason == null || String(reason).trim() === "") {
            await reportError(req, "api/attendance/[id]/absent-reason", "PUT", 400, "Motivo no especificado");
            return NextResponse.json({ status: false, message: "Motivo no especificado" }, { status: 400 });
        }
        const horaAccionNum = horaAccion != null ? Number(horaAccion) : NaN;
        if (!Number.isFinite(horaAccionNum)) {
            await reportError(req, "api/attendance/[id]/absent-reason", "PUT", 400, "horaAccion inválida");
            return NextResponse.json({ status: false, message: "horaAccion inválida" }, { status: 400 });
        }

        const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id } });
        if (!marcaDia) {
            await reportError(req, "api/attendance/[id]/absent-reason", "PUT", 404, "No se encontró la marca del dia");
            return NextResponse.json({ status: false, message: "No se encontró la marca del dia" }, { status: 404 });
        }

        const authEmpleadoId = Number(payload.id);
        const reemplazaId = marcaDia.empleadoReemplaza_id != null ? Number(marcaDia.empleadoReemplaza_id) : 0;
        const fijoId = marcaDia.empleadoFijo_id != null ? Number(marcaDia.empleadoFijo_id) : 0;
        const empleadoId =
            reemplazaId > 0 && reemplazaId === authEmpleadoId
                ? authEmpleadoId
                : fijoId > 0
                  ? fijoId
                  : authEmpleadoId;
        const empleado = await prisma.c_empleado.findUnique({ where: { id: empleadoId } });
        if (!empleado) {
            await reportError(req, "api/attendance/[id]/absent-reason", "PUT", 404, "No se encontró el empleado");
            return NextResponse.json({ status: false, message: "No se encontró el empleado" }, { status: 404 });
        }

        const reasonTrimmed = String(reason).trim();
        const createdAt = toZonedTime(new Date(horaAccionNum), "America/Costa_Rica");

        const existing = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_empleado_razon_ausencia",
                operation: "findFirst",
                where: { marca_id: marcaDia.id },
            },
        });

        const recordData = {
            marca_id: marcaDia.id,
            empleado_id: empleado.id,
            razon: reasonTrimmed,
            created_at: createdAt.toISOString(),
        };

        if (existing?.id) {
            await callDynamicPrisma({
                req,
                data: {
                    action: "UPDATE",
                    table: "c_empleado_razon_ausencia",
                    where: { id: existing.id },
                    data: {
                        razon: recordData.razon,
                        created_at: recordData.created_at,
                    },
                },
            });
        } else {
            await callDynamicPrisma({
                req,
                data: {
                    action: "POST",
                    table: "c_empleado_razon_ausencia",
                    data: recordData,
                },
            });
        }

        const title = "Motivo de ausencia confirmado";
        const description = `El empleado ${empleado.nombre} ${empleado.primer_apellido} ha confirmado el motivo de ausencia: ${reasonTrimmed} (horaAccion: ${createdAt.toISOString()})`;
        await sendNotificationByRole(req, marcaDia.corpo_id ?? 0, [marcaDia.plaza_id ?? 0], title, description, ["ADMINISTRATIVO", "SUPERVISOR"]);

        return NextResponse.json({ status: true, message: "Motivo de ausencia confirmado" }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        await reportError(req, "api/attendance/[id]/absent-reason", "PUT", 500, errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}
