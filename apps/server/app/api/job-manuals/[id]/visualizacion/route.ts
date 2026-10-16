import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { prisma } from "../../../../../utils/prismaClient";
import { toZonedTime } from "date-fns-tz";
import { reportError } from "../../../../../utils/reportError";

export const runtime = "nodejs";

const ALLOWED_FIELDS = new Set(["firma_empleado_manual"]);

/**
 * Actualiza (o crea, si aún no existe) un único campo suelto de la visualización del empleado
 * actual para este manual, sin tocar el resto de los datos ya guardados (quiz, firma QR, archivos).
 * Pensado para la firma manual dibujada (`firma_empleado_manual`), que puede guardarse antes o
 * después de completar el quiz.
 */
export async function PATCH(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id, 10);
        if (!id) {
            await reportError(req, "api/job-manuals/[id]/visualizacion", "PATCH", 400, "Manual no especificado");
            return NextResponse.json({ status: false, message: "Manual no especificado" }, { status: 400 });
        }

        const { marca_id, field, value, firma_empleado } = await req.json();
        if (typeof field !== "string" || !ALLOWED_FIELDS.has(field)) {
            await reportError(req, "api/job-manuals/[id]/visualizacion", "PATCH", 400, "Campo no permitido");
            return NextResponse.json({ status: false, message: "Campo no permitido" }, { status: 400 });
        }

        const marca = await prisma.c_marca_dia.findUnique({ where: { id: marca_id } });
        if (!marca) {
            await reportError(req, "api/job-manuals/[id]/visualizacion", "PATCH", 404, "Marca no encontrada");
            return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 404 });
        }
        const marcaObj = marca as any;
        const empleadoId = marcaObj.empleadoFijo_id;
        if (!empleadoId) {
            await reportError(req, "api/job-manuals/[id]/visualizacion", "PATCH", 404, "Empleado no encontrado");
            return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 404 });
        }

        const existing = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "e_empleado_visualizacion_manual_puesto",
                operation: "findFirst",
                where: { empleado_id: empleadoId, manual_puesto_id: id },
            },
        });

        const valueToStore = typeof value === "string" && value.trim().length > 0 ? value : null;
        const now = toZonedTime(new Date(), "America/Costa_Rica") as Date;

        if (existing) {
            const existingObj = existing as any;
            // La firma manual es de una sola vez: una vez registrada, no se puede sobrescribir.
            if (field === "firma_empleado_manual" && existingObj.firma_empleado_manual) {
                await reportError(req, "api/job-manuals/[id]/visualizacion", "PATCH", 409, "La firma manual ya fue registrada y no puede modificarse");
                return NextResponse.json(
                    { status: false, message: "La firma manual ya fue registrada y no puede modificarse" },
                    { status: 409 }
                );
            }
            await callDynamicPrisma({
                req,
                data: {
                    action: "UPDATE",
                    table: "e_empleado_visualizacion_manual_puesto",
                    operation: "update",
                    where: { id: existingObj.id },
                    data: { [field]: valueToStore, updated_at: now.toISOString() },
                },
            });
            return NextResponse.json(
                { status: true, message: "Visualización actualizada correctamente", id: existingObj.id, visualizacion_id: existingObj.id },
                { status: 200 }
            );
        }

        // No existía visualización previa (caso excepcional: normalmente ya se creó automáticamente
        // al abrir el manual). Se crea de una vez, requiriendo la firma QR automática del cliente.
        if (!firma_empleado) {
            await reportError(req, "api/job-manuals/[id]/visualizacion", "PATCH", 400, "Firma del empleado requerida para crear la visualización");
            return NextResponse.json(
                { status: false, message: "Firma del empleado requerida para crear la visualización" },
                { status: 400 }
            );
        }

        const empleado = await prisma.c_empleado.findUnique({ where: { id: empleadoId } });
        if (!empleado) {
            await reportError(req, "api/job-manuals/[id]/visualizacion", "PATCH", 404, "Empleado no encontrado");
            return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 404 });
        }
        const empleadoObj = empleado as any;

        const created = await callDynamicPrisma({
            req,
            data: {
                action: "POST",
                table: "e_empleado_visualizacion_manual_puesto",
                operation: "create",
                data: {
                    empleado_id: empleadoId,
                    manual_puesto_id: id,
                    nombre_empleado: `${empleadoObj.nombre} ${empleadoObj.primer_apellido} ${empleadoObj.segundo_apellido}`,
                    firma_empleado,
                    quiz_answear: null,
                    approved: null,
                    [field]: valueToStore,
                    created_at: now.toISOString(),
                    updated_at: now.toISOString(),
                },
            },
        });
        const createdObj = created as any;

        return NextResponse.json(
            { status: true, message: "Visualización creada correctamente", id: createdObj.id, visualizacion_id: createdObj.id },
            { status: 200 }
        );
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error("Error in PATCH /api/job-manuals/[id]/visualizacion:", errorMessage);
        await reportError(req, "api/job-manuals/[id]/visualizacion", "PATCH", 500, errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}
