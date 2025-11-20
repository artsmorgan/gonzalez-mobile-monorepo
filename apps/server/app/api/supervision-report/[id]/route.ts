import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../utils/verifyToken";
import { prisma } from "../../../../utils/prismaClient";

export async function PUT(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { valid, payload, message } = verifyAccessToken(req);

        if (!valid) {
            return NextResponse.json(
                { status: false, message: message },
                { status: 401 }
            );
        }

        const resolvedParams = await context.params;
        const { id } = resolvedParams;
        const {
            fecha,
            piso,
            area,
            aseador,
            supervisor,
            limpieza_general,
            cuarto_aseo,
            servicios_sanitarios,
            uniforme_presentacion,
            estado_equipos,
            calificacion_general,
            firma_aseador,
            firma_supervisor
        } = await req.json();

        const updated_record = await prisma.c_informe_supervision.update({
            where: { id },
            data: {
                fecha: fecha !== undefined ? fecha : undefined,
                piso: piso !== undefined ? piso : undefined,
                area: area !== undefined ? area : undefined,
                aseador: aseador !== undefined ? aseador : undefined,
                supervisor: supervisor !== undefined ? supervisor : undefined,
                limpieza_general: limpieza_general !== undefined ? limpieza_general : undefined,
                cuarto_aseo: cuarto_aseo !== undefined ? cuarto_aseo : undefined,
                servicios_sanitarios: servicios_sanitarios !== undefined ? servicios_sanitarios : undefined,
                uniforme_presentacion: uniforme_presentacion !== undefined ? uniforme_presentacion : undefined,
                estado_equipos: estado_equipos !== undefined ? estado_equipos : undefined,
                calificacion_general: calificacion_general !== undefined ? calificacion_general : undefined,
                firma_aseador: firma_aseador !== undefined ? firma_aseador : undefined,
                firma_supervisor: firma_supervisor !== undefined ? firma_supervisor : undefined,
            }
        });

        return NextResponse.json({
            status: true,
            message: "Informe de Supervisión actualizado correctamente",
            data: updated_record
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
        const { valid, payload, message } = verifyAccessToken(req);

        if (!valid) {
            return NextResponse.json(
                { status: false, message: message },
                { status: 401 }
            );
        }

        const resolvedParams = await context.params;
        const { id } = resolvedParams;

        await prisma.c_informe_supervision.delete({
            where: { id }
        });

        return NextResponse.json({
            status: true,
            message: "Informe de Supervisión eliminado correctamente"
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

