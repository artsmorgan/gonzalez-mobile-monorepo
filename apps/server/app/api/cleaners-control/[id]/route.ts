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
            nombre_aseador,
            oficina_despacho,
            provincia,
            canton,
            distrito,
            direccion,
            metraje,
            horario,
            horas_dia,
            horas_semana,
            dias,
            cantidad_personal,
            detalle_supervision,
            fecha_inicio,
            lista_equipos_insumos,
            costo_mensual,
            costo_anual,
            codigo,
            plaza,
            observaciones
        } = await req.json();

        const existingRecord = await prisma.c_control_aseadores.findUnique({
            where: { id }
        });

        if (!existingRecord) {
            return NextResponse.json(
                { status: false, message: "Registro no encontrado" },
                { status: 404 }
            );
        }

        const updatedRecord = await prisma.c_control_aseadores.update({
            where: { id },
            data: {
                nombre_aseador: nombre_aseador !== undefined ? nombre_aseador : existingRecord.nombre_aseador,
                oficina_despacho: oficina_despacho !== undefined ? oficina_despacho : existingRecord.oficina_despacho,
                provincia: provincia !== undefined ? provincia : existingRecord.provincia,
                canton: canton !== undefined ? canton : existingRecord.canton,
                distrito: distrito !== undefined ? distrito : existingRecord.distrito,
                direccion: direccion !== undefined ? direccion : existingRecord.direccion,
                metraje: metraje !== undefined ? metraje : existingRecord.metraje,
                horario: horario !== undefined ? horario : existingRecord.horario,
                horas_dia: horas_dia !== undefined ? horas_dia : existingRecord.horas_dia,
                horas_semana: horas_semana !== undefined ? horas_semana : existingRecord.horas_semana,
                dias: dias !== undefined ? dias : existingRecord.dias,
                cantidad_personal: cantidad_personal !== undefined ? cantidad_personal : existingRecord.cantidad_personal,
                detalle_supervision: detalle_supervision !== undefined ? detalle_supervision : existingRecord.detalle_supervision,
                fecha_inicio: fecha_inicio !== undefined ? fecha_inicio : existingRecord.fecha_inicio,
                lista_equipos_insumos: lista_equipos_insumos !== undefined ? lista_equipos_insumos : existingRecord.lista_equipos_insumos,
                costo_mensual: costo_mensual !== undefined ? costo_mensual : existingRecord.costo_mensual,
                costo_anual: costo_anual !== undefined ? costo_anual : existingRecord.costo_anual,
                codigo: codigo !== undefined ? codigo : existingRecord.codigo,
                plaza: plaza !== undefined ? plaza : existingRecord.plaza,
                observaciones: observaciones !== undefined ? observaciones : existingRecord.observaciones,
            }
        });

        return NextResponse.json({
            status: true,
            message: "Control de aseadores actualizado correctamente",
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

        const existingRecord = await prisma.c_control_aseadores.findUnique({
            where: { id }
        });

        if (!existingRecord) {
            return NextResponse.json(
                { status: false, message: "Registro no encontrado" },
                { status: 404 }
            );
        }

        await prisma.c_control_aseadores.delete({
            where: { id }
        });

        return NextResponse.json({
            status: true,
            message: "Control de aseadores eliminado correctamente"
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

