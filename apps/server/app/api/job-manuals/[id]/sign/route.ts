import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../../utils/verifyToken";
import { prisma } from "../../../../../utils/prismaClient";
import { toZonedTime } from "date-fns-tz";

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

        const { firma_empleado } = await req.json();
        if (!firma_empleado) {
            return NextResponse.json(
                { status: false, message: "Firma del empleado requerida" },
                { status: 200 }
            );
        }

        const empleadoId = payload.id as number;
        const empleado = await prisma.c_empleado.findUnique({
            where: { id: empleadoId }
        });

        if (!empleado) {
            return NextResponse.json(
                { status: false, message: "Empleado no encontrado" },
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

        if (!existing) {
            await prisma.e_empleado_visualizacion_manual_puesto.create({
                data: {
                    empleado_id: empleadoId,
                    manual_puesto_id: id,
                    nombre_empleado: `${empleado.nombre} ${empleado.primer_apellido} ${empleado.segundo_apellido}`,
                    firma_empleado,
                    created_at
                }
            });
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


