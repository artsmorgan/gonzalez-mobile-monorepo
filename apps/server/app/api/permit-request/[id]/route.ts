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
            persona_solicita,
            codigo,
            contrato,
            horario,
            fecha_solicitud,
            motivo_permiso,
            permiso_sustituido_por,
            codigo_sustituto,
            firma_gerente,
            firma_encargado_monitoreo,
            permiso_coordinado_por
        } = await req.json();

        const updated_record = await prisma.c_solicitud_permiso.update({
            where: { id },
            data: {
                persona_solicita: persona_solicita !== undefined ? persona_solicita : undefined,
                codigo: codigo !== undefined ? codigo : undefined,
                contrato: contrato !== undefined ? contrato : undefined,
                horario: horario !== undefined ? horario : undefined,
                fecha_solicitud: fecha_solicitud !== undefined ? fecha_solicitud : undefined,
                motivo_permiso: motivo_permiso !== undefined ? motivo_permiso : undefined,
                permiso_sustituido_por: permiso_sustituido_por !== undefined ? permiso_sustituido_por : undefined,
                codigo_sustituto: codigo_sustituto !== undefined ? codigo_sustituto : undefined,
                firma_gerente: firma_gerente !== undefined ? firma_gerente : undefined,
                firma_encargado_monitoreo: firma_encargado_monitoreo !== undefined ? firma_encargado_monitoreo : undefined,
                permiso_coordinado_por: permiso_coordinado_por !== undefined ? permiso_coordinado_por : undefined,
            }
        });

        return NextResponse.json({
            status: true,
            message: "Solicitud de permiso actualizada correctamente",
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

        await prisma.c_solicitud_permiso.delete({
            where: { id }
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

