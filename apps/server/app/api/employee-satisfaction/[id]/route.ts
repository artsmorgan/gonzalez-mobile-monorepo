import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../utils/verifyToken";
import { prisma } from "../../../../utils/prismaClient";

export async function PUT(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { valid, expired, payload, message } = verifyAccessToken(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const { id } = resolvedParams;
        const {
            nombre_empleado,
            cliente_sede,
            tiempo_laborado,
            recibe_uniformes_tiempo,
            llevo_induccion,
            calificacion_induccion,
            recibe_visitas_supervision,
            recibe_atencion_oficina,
            problemas_pago_resueltos,
            equipo_proteccion,
            que_mejorar,
            considera_empresa_debe_mejorar,
            conoce_reportar_accidente,
            le_gustaria_capacitado
        } = await req.json();

        const existingRecord = await prisma.c_satisfaccion_personal.findUnique({
            where: { id }
        });

        if (!existingRecord) {
            return NextResponse.json(
                { status: false, message: "Registro no encontrado" },
                { status: 404 }
            );
        }

        const updatedRecord = await prisma.c_satisfaccion_personal.update({
            where: { id },
            data: {
                nombre_empleado: nombre_empleado !== undefined ? nombre_empleado : existingRecord.nombre_empleado,
                cliente_sede: cliente_sede !== undefined ? cliente_sede : existingRecord.cliente_sede,
                tiempo_laborado: tiempo_laborado !== undefined ? tiempo_laborado : existingRecord.tiempo_laborado,
                recibe_uniformes_tiempo: recibe_uniformes_tiempo !== undefined ? recibe_uniformes_tiempo : existingRecord.recibe_uniformes_tiempo,
                llevo_induccion: llevo_induccion !== undefined ? llevo_induccion : existingRecord.llevo_induccion,
                calificacion_induccion: calificacion_induccion !== undefined ? calificacion_induccion : existingRecord.calificacion_induccion,
                recibe_visitas_supervision: recibe_visitas_supervision !== undefined ? recibe_visitas_supervision : existingRecord.recibe_visitas_supervision,
                recibe_atencion_oficina: recibe_atencion_oficina !== undefined ? recibe_atencion_oficina : existingRecord.recibe_atencion_oficina,
                problemas_pago_resueltos: problemas_pago_resueltos !== undefined ? problemas_pago_resueltos : existingRecord.problemas_pago_resueltos,
                equipo_proteccion: equipo_proteccion !== undefined ? equipo_proteccion : existingRecord.equipo_proteccion,
                que_mejorar: que_mejorar !== undefined ? que_mejorar : existingRecord.que_mejorar,
                considera_empresa_debe_mejorar: considera_empresa_debe_mejorar !== undefined ? considera_empresa_debe_mejorar : existingRecord.considera_empresa_debe_mejorar,
                conoce_reportar_accidente: conoce_reportar_accidente !== undefined ? conoce_reportar_accidente : existingRecord.conoce_reportar_accidente,
                le_gustaria_capacitado: le_gustaria_capacitado !== undefined ? le_gustaria_capacitado : existingRecord.le_gustaria_capacitado,
            }
        });

        return NextResponse.json({
            status: true,
            message: "Encuesta de satisfacción actualizada correctamente",
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
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { valid, expired, payload, message } = verifyAccessToken(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const { id } = resolvedParams;

        const existingRecord = await prisma.c_satisfaccion_personal.findUnique({
            where: { id }
        });

        if (!existingRecord) {
            return NextResponse.json(
                { status: false, message: "Registro no encontrado" },
                { status: 404 }
            );
        }

        await prisma.c_satisfaccion_personal.delete({
            where: { id }
        });

        return NextResponse.json({
            status: true,
            message: "Encuesta de satisfacción eliminada correctamente"
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

