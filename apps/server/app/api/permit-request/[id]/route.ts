import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../utils/verifyToken";
import { prisma } from "../../../../utils/prismaClient";

const parseDateInputToDate = (input: unknown): Date | undefined => {
    if (input === undefined) return undefined;
    if (input === null) return undefined;
    if (input instanceof Date) return isNaN(input.getTime()) ? undefined : input;

    const s = String(input).trim();
    if (!s) return undefined;

    const parts = s.split("/");
    if (parts.length === 3) {
        const [dd, mm, yyyy] = parts;
        const day = parseInt(dd, 10);
        const month = parseInt(mm, 10);
        const year = parseInt(yyyy, 10);
        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
            const d = new Date(year, month - 1, day, 0, 0, 0, 0);
            return isNaN(d.getTime()) ? undefined : d;
        }
    }

    const d = new Date(s);
    return isNaN(d.getTime()) ? undefined : d;
};

export async function PUT(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { valid, expired, payload, message } = verifyAccessToken(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const { id } = resolvedParams;
        const idNum = parseInt(id, 10);
        if (!idNum) {
            return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
        }

        const {
            division,
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
            permiso_coordinado_por,
            firma_responsables
        } = await req.json();

        const fechaSolicitudDate = parseDateInputToDate(fecha_solicitud);

        const updated_record = await prisma.c_solicitud_permiso.update({
            where: { id: idNum },
            data: {
                division: division !== undefined ? division : undefined,
                persona_solicita: persona_solicita !== undefined ? persona_solicita : undefined,
                codigo: codigo !== undefined ? codigo : undefined,
                contrato: contrato !== undefined ? contrato : undefined,
                horario: horario !== undefined ? horario : undefined,
                fecha_solicitud: fechaSolicitudDate,
                motivo_permiso: motivo_permiso !== undefined ? motivo_permiso : undefined,
                permiso_sustituido_por: permiso_sustituido_por !== undefined ? permiso_sustituido_por : undefined,
                codigo_sustituto: codigo_sustituto !== undefined ? codigo_sustituto : undefined,
                firma_gerente: firma_gerente !== undefined ? firma_gerente : undefined,
                firma_encargado_monitoreo: firma_encargado_monitoreo !== undefined ? firma_encargado_monitoreo : undefined,
                permiso_coordinado_por: permiso_coordinado_por !== undefined ? permiso_coordinado_por : undefined,
                firma_responsables: firma_responsables !== undefined ? firma_responsables : undefined,
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
        const { valid, expired, payload, message } = verifyAccessToken(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const { id } = resolvedParams;
        const idNum = parseInt(id, 10);
        if (!idNum) {
            return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
        }

        await prisma.c_solicitud_permiso.delete({
            where: { id: idNum }
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

