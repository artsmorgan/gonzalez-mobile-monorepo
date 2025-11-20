import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../utils/verifyToken";
import { prisma } from "../../../../utils/prismaClient";

export async function PUT(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { valid, payload, message } = verifyAccessToken(req);

        if (!valid) {
            return NextResponse.json(
                { status: false, message: message },
                { status: 401 }
            );
        }

        const { id } = params;
        const {
            miscelaneo,
            area_piso,
            turno_inicio,
            turno_fin,
            mes,
            supervisor,
            sucursal,
            area,
            cliente,
            actividades_ejecucion_diaria,
            actividades_ejecucion_semanal,
            actividades_quincenales,
            actividades_mensual,
            actividades_bimensual,
            actividades_trimestral,
            actividades_cuatrimestral,
            actividades_semestral,
            actividades_anual,
            otras_actividades,
            programa_eventos_especiales,
            firma_miscelaneo,
            firma_supervisor
        } = await req.json();

        const updated_record = await prisma.c_registro_tareas_actividades_limpieza.update({
            where: { id },
            data: {
                miscelaneo: miscelaneo !== undefined ? miscelaneo : undefined,
                area_piso: area_piso !== undefined ? area_piso : undefined,
                turno_inicio: turno_inicio !== undefined ? turno_inicio : undefined,
                turno_fin: turno_fin !== undefined ? turno_fin : undefined,
                mes: mes !== undefined ? mes : undefined,
                supervisor: supervisor !== undefined ? supervisor : undefined,
                sucursal: sucursal !== undefined ? sucursal : undefined,
                area: area !== undefined ? area : undefined,
                cliente: cliente !== undefined ? cliente : undefined,
                actividades_ejecucion_diaria: actividades_ejecucion_diaria !== undefined ? actividades_ejecucion_diaria : undefined,
                actividades_ejecucion_semanal: actividades_ejecucion_semanal !== undefined ? actividades_ejecucion_semanal : undefined,
                actividades_quincenales: actividades_quincenales !== undefined ? actividades_quincenales : undefined,
                actividades_mensual: actividades_mensual !== undefined ? actividades_mensual : undefined,
                actividades_bimensual: actividades_bimensual !== undefined ? actividades_bimensual : undefined,
                actividades_trimestral: actividades_trimestral !== undefined ? actividades_trimestral : undefined,
                actividades_cuatrimestral: actividades_cuatrimestral !== undefined ? actividades_cuatrimestral : undefined,
                actividades_semestral: actividades_semestral !== undefined ? actividades_semestral : undefined,
                actividades_anual: actividades_anual !== undefined ? actividades_anual : undefined,
                otras_actividades: otras_actividades !== undefined ? otras_actividades : undefined,
                programa_eventos_especiales: programa_eventos_especiales !== undefined ? programa_eventos_especiales : undefined,
                firma_miscelaneo: firma_miscelaneo !== undefined ? firma_miscelaneo : undefined,
                firma_supervisor: firma_supervisor !== undefined ? firma_supervisor : undefined,
            }
        });

        return NextResponse.json({
            status: true,
            message: "Registro de tareas o actividades de limpieza actualizado correctamente",
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
    { params }: { params: { id: string } }
) {
    try {
        const { valid, payload, message } = verifyAccessToken(req);

        if (!valid) {
            return NextResponse.json(
                { status: false, message: message },
                { status: 401 }
            );
        }

        const { id } = params;

        await prisma.c_registro_tareas_actividades_limpieza.delete({
            where: { id }
        });

        return NextResponse.json({
            status: true,
            message: "Registro de tareas o actividades de limpieza eliminado correctamente"
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

