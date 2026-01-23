import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../utils/verifyToken";
import { prisma } from "../../../../utils/prismaClient";

function parseFechaInput(fecha: any): Date | undefined {
    if (!fecha) return undefined;
    if (fecha instanceof Date) return fecha;
    if (typeof fecha === 'string') {
        if (fecha.includes('/')) {
            const parts = fecha.split('/');
            if (parts.length === 3) {
                const [dd, mm, yyyy] = parts;
                const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
                if (!Number.isNaN(d.getTime())) return d;
            }
        }
        const d = new Date(fecha);
        if (!Number.isNaN(d.getTime())) return d;
    }
    return undefined;
}

export async function PUT(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { valid, expired, payload, message } = verifyAccessToken(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const { id } = resolvedParams;
        const idNum = parseInt(String(id), 10);
        if (Number.isNaN(idNum)) {
            return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
        }

        const {
            fecha,
            division,
            renglon_edificio,
            supervisor_cliente,
            supervisor_corporacion,
            temas_desarrollados,
            aspectos_especificos,
            participantes,
            firma_supervisor,
            firma_responsable
        } = await req.json();

        const fechaParsed = parseFechaInput(fecha);
        if (fecha !== undefined && fecha !== null && !fechaParsed) {
            return NextResponse.json({ status: false, message: "Fecha inválida" }, { status: 400 });
        }

        const updated_record = await prisma.c_registro_induccion_recorrido.update({
            where: { id: idNum },
            data: {
                ...(fecha !== undefined ? (fechaParsed ? { fecha: fechaParsed } : {}) : {}),
                division: division !== undefined ? (division ? String(division).trim() : "Otros") : undefined,
                renglon_edificio: renglon_edificio !== undefined ? (renglon_edificio ? String(renglon_edificio) : "") : undefined,
                supervisor_cliente: supervisor_cliente !== undefined ? (supervisor_cliente !== null && supervisor_cliente !== undefined ? String(supervisor_cliente) : null) : undefined,
                supervisor_corporacion: supervisor_corporacion !== undefined ? (supervisor_corporacion ? String(supervisor_corporacion) : "") : undefined,
                temas_desarrollados: temas_desarrollados !== undefined ? (temas_desarrollados ? String(temas_desarrollados) : "[]") : undefined,
                aspectos_especificos: aspectos_especificos !== undefined ? (aspectos_especificos ? String(aspectos_especificos) : "[]") : undefined,
                participantes: participantes !== undefined ? (participantes ? String(participantes) : "[]") : undefined,
                firma_supervisor: firma_supervisor !== undefined ? (firma_supervisor ? String(firma_supervisor) : "") : undefined,
                firma_responsable: firma_responsable !== undefined ? (firma_responsable ? String(firma_responsable) : "") : undefined,
            }
        });

        return NextResponse.json({
            status: true,
            message: "Registro de inducción y recorrido actualizado correctamente",
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
        const idNum = parseInt(String(id), 10);
        if (Number.isNaN(idNum)) {
            return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
        }

        await prisma.c_registro_induccion_recorrido.delete({
            where: { id: idNum }
        });

        return NextResponse.json({
            status: true,
            message: "Registro de inducción y recorrido eliminado correctamente"
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

