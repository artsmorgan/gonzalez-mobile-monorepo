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
            ubicacion,
            objetivo,
            metodologia,
            rol_horario,
            uniformes,
            equipos,
            accesorios_varios,
            tiempo_respuesta,
            distribucion_labores,
            frecuencia_limpieza,
            supervision,
            estrategia,
            responsable,
            formularios,
            plan_capacitacion
        } = await req.json();

        const existingRecord = await prisma.c_plan_gestion_ambiental.findUnique({
            where: { id }
        });

        if (!existingRecord) {
            return NextResponse.json(
                { status: false, message: "Registro no encontrado" },
                { status: 404 }
            );
        }

        const updatedRecord = await prisma.c_plan_gestion_ambiental.update({
            where: { id },
            data: {
                ubicacion: ubicacion !== undefined ? ubicacion : existingRecord.ubicacion,
                objetivo: objetivo !== undefined ? objetivo : existingRecord.objetivo,
                metodologia: metodologia !== undefined ? metodologia : existingRecord.metodologia,
                rol_horario: rol_horario !== undefined ? rol_horario : existingRecord.rol_horario,
                uniformes: uniformes !== undefined ? uniformes : existingRecord.uniformes,
                equipos: equipos !== undefined ? equipos : existingRecord.equipos,
                accesorios_varios: accesorios_varios !== undefined ? accesorios_varios : existingRecord.accesorios_varios,
                tiempo_respuesta: tiempo_respuesta !== undefined ? tiempo_respuesta : existingRecord.tiempo_respuesta,
                distribucion_labores: distribucion_labores !== undefined ? distribucion_labores : existingRecord.distribucion_labores,
                frecuencia_limpieza: frecuencia_limpieza !== undefined ? frecuencia_limpieza : existingRecord.frecuencia_limpieza,
                supervision: supervision !== undefined ? supervision : existingRecord.supervision,
                estrategia: estrategia !== undefined ? estrategia : existingRecord.estrategia,
                responsable: responsable !== undefined ? responsable : existingRecord.responsable,
                formularios: formularios !== undefined ? formularios : existingRecord.formularios,
                plan_capacitacion: plan_capacitacion !== undefined ? plan_capacitacion : existingRecord.plan_capacitacion,
            }
        });

        return NextResponse.json({
            status: true,
            message: "Plan de gestión ambiental actualizado correctamente",
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

        const existingRecord = await prisma.c_plan_gestion_ambiental.findUnique({
            where: { id }
        });

        if (!existingRecord) {
            return NextResponse.json(
                { status: false, message: "Registro no encontrado" },
                { status: 404 }
            );
        }

        await prisma.c_plan_gestion_ambiental.delete({
            where: { id }
        });

        return NextResponse.json({
            status: true,
            message: "Plan de gestión ambiental eliminado correctamente"
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

