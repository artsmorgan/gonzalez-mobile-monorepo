import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../../utils/verifyToken";
import { prisma } from "../../../../../utils/prismaClient";
import { toZonedTime } from "date-fns-tz";
import { sendNotificationByEmployee, sendNotificationByRole } from "../../../../../utils/sendNotification";

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { valid, payload, message } = verifyAccessToken(req);
        if (!valid) {
            return NextResponse.json(
                { status: false, message },
                { status: 401 }
            );
        }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);

        if (!id) {
            return NextResponse.json(
                { status: false, message: "Manual no especificado" },
                { status: 200 }
            );
        }

        const manual = await prisma.e_manual_puesto.findUnique({
            where: { id }
        });
        if (!manual) {
            return NextResponse.json(
                { status: false, message: "Manual no encontrado" },
                { status: 200 }
            );
        }

        const { firma_empleado, marca_id, quiz_answear } = await req.json();
        if (!firma_empleado || !marca_id) {
            return NextResponse.json(
                { status: false, message: "Firma del empleado requerida" },
                { status: 200 }
            );
        }

        const marca = await prisma.c_marca_dia.findUnique({
            where: { id: marca_id }
        });
        if (!marca) {
            return NextResponse.json(
                { status: false, message: "Marca no encontrada" },
                { status: 200 }
            );
        }

        const empleadoId = marca.empleadoFijo_id;
        if (!empleadoId) {
            return NextResponse.json(
                { status: false, message: "Empleado no encontrado" },
                { status: 200 }
            );
        }

        const empleado = await prisma.c_empleado.findUnique({
            where: { id: empleadoId }
        });

        if (!empleado) {
            return NextResponse.json(
                { status: false, message: "Empleado no encontrado" },
                { status: 200 }
            );
        }

        const puesto = await prisma.e_estructura_puesto.findUnique({
            where: { id: manual.puesto_id }
        });
        if (!puesto) {
            return NextResponse.json(
                { status: false, message: "Puesto no encontrado" },
                { status: 200 }
            );
        }

        const corpo = await prisma.e_estructura_sucursal.findUnique({
            where: { id: marca.corpo_id }
        });
        if (!corpo) {
            return NextResponse.json(
                { status: false, message: "Sucursal no encontrada" },
                { status: 200 }
            );
        }

        // Evitar firmas duplicadas del mismo empleado para el mismo manual
        const existing = await prisma.e_empleado_visualizacion_manual_puesto.findFirst(
            {
                where: {
                    empleado_id: empleadoId,
                    manual_puesto_id: id
                }
            }
        );

        const created_at = toZonedTime(
            new Date(),
            "America/Costa_Rica"
        ) as Date;

        // Si ya firmó antes, eliminar el registro para crear uno nuevo (permite reintentos/revisión de quiz)
        if (existing) {
            await prisma.e_empleado_visualizacion_manual_puesto.delete({
                where: { id: existing.id }
            });
        }

        const quizAnswearToStore =
            typeof quiz_answear === "string" && quiz_answear.trim().length > 0
                ? quiz_answear.trim()
                : null;

        await prisma.e_empleado_visualizacion_manual_puesto.create({
            data: {
                empleado_id: empleadoId,
                manual_puesto_id: id,
                nombre_empleado: `${empleado.nombre} ${empleado.primer_apellido} ${empleado.segundo_apellido}`,
                firma_empleado,
                quiz_answear: quizAnswearToStore,
                approved: null,
                created_at,
                updated_at: created_at
            }
        });

        const fecha_string = created_at.toISOString().split("T")[0];
        const hora_string = created_at.toISOString().split("T")[1].split(".")[0];
        const description = `El empleado ${empleado.nombre} ${empleado.primer_apellido} ${empleado.segundo_apellido} ha firmado el manual ${manual.title} desde el puesto ${puesto.nombre} en la sucursal ${corpo.nombre} el día ${fecha_string} a las ${hora_string}`;
        await sendNotificationByRole(marca.id, "Firma de manual", description, ["ADMINISTRATIVO", "SUPERVISOR"]);

        const creator = await prisma.c_empleado.findUnique({
            where: { id: parseInt(manual.created_by) }
        });

        if (creator) {
            const description = `El empleado ${creator.nombre} ${creator.primer_apellido} ${creator.segundo_apellido} ha firmado el manual ${manual.title} desde el puesto ${puesto.nombre} en la sucursal ${corpo.nombre} el día ${fecha_string} a las ${hora_string}`;
            await sendNotificationByEmployee(marca.id, "Firma de manual", description, [creator.id]);
        }

        return NextResponse.json(
            { status: true, message: "Manual firmado correctamente" },
            { status: 200 }
        );
    } catch (error: unknown) {
        const errorMessage =
            error instanceof Error ? error.message : "Error desconocido";
        console.error(
            "Error in POST /api/job-manuals/[id]/sign:",
            errorMessage
        );
        return NextResponse.json(
            { status: false, message: errorMessage },
            { status: 500 }
        );
    }
}


