import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../utils/verifyToken";
import { toZonedTime } from "date-fns-tz";
import { prisma } from "../../../../utils/prismaClient";

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, payload, message } = verifyAccessToken(req);

        if (!valid) {
            return NextResponse.json(
                { status: false, message: message },
                { status: 401 }
            );
        }

        const resolvedParams = await context.params;
        const id = resolvedParams.id;

        if (!id) {
            return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 400 });
        }

        const { 
            chofer_id, 
            chofer_nombre, 
            total_km, 
            ruta, 
            prox_mant_km, 
            km_para_mantenimiento, 
            km_actual, 
            estado, 
            vehiculo_id, 
            registros_viaje 
        } = await req.json();

        const control = await prisma.c_control_kilometraje.findUnique({ where: { id } });
        if (!control) {
            return NextResponse.json({ status: false, message: "Control de kilometraje no encontrado" }, { status: 404 });
        }

        // Actualizar el control
        const updated_control = await prisma.c_control_kilometraje.update({
            where: { id },
            data: {
                chofer_id: chofer_id !== undefined ? chofer_id : control.chofer_id,
                chofer_nombre: chofer_nombre !== undefined ? chofer_nombre : control.chofer_nombre,
                total_km: total_km !== undefined ? total_km : control.total_km,
                ruta: ruta !== undefined ? ruta : control.ruta,
                prox_mant_km: prox_mant_km !== undefined ? prox_mant_km : control.prox_mant_km,
                km_para_mantenimiento: km_para_mantenimiento !== undefined ? km_para_mantenimiento : control.km_para_mantenimiento,
                km_actual: km_actual !== undefined ? km_actual : control.km_actual,
                estado: estado !== undefined ? estado : control.estado,
                vehiculo_id: vehiculo_id !== undefined ? vehiculo_id : control.vehiculo_id,
                registros_viaje: registros_viaje !== undefined ? JSON.stringify(registros_viaje) : control.registros_viaje,
            }
        });

        return NextResponse.json({ 
            status: true, 
            message: "Control de kilometraje actualizado correctamente",
            data: {
                id: updated_control.id,
                empresa_id: updated_control.empresa_id,
                cliente_id: updated_control.cliente_id,
                contrato_id: updated_control.contrato_id,
                corpo_id: updated_control.corpo_id,
                puesto_id: updated_control.puesto_id,
                plaza_id: updated_control.plaza_id,
                chofer_id: updated_control.chofer_id,
                chofer_nombre: updated_control.chofer_nombre,
                total_km: updated_control.total_km,
                ruta: updated_control.ruta,
                prox_mant_km: updated_control.prox_mant_km,
                km_para_mantenimiento: updated_control.km_para_mantenimiento,
                km_actual: updated_control.km_actual,
                estado: updated_control.estado,
                vehiculo_id: updated_control.vehiculo_id,
                registros_viaje: updated_control.registros_viaje ? JSON.parse(updated_control.registros_viaje) : [],
                created_at: updated_control.created_at,
                created_by: updated_control.created_by,
            }
        }, { status: 200 });
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, payload, message } = verifyAccessToken(req);

        if (!valid) {
            return NextResponse.json(
                { status: false, message: message },
                { status: 401 }
            );
        }

        const resolvedParams = await context.params;
        const id = resolvedParams.id;

        if (!id) {
            return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 400 });
        }

        const control = await prisma.c_control_kilometraje.findUnique({ where: { id } });
        if (!control) {
            return NextResponse.json({ status: false, message: "Control de kilometraje no encontrado" }, { status: 404 });
        }

        await prisma.c_control_kilometraje.delete({ where: { id } });

        return NextResponse.json({ status: true, message: "Control de kilometraje eliminado correctamente" }, { status: 200 });
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}

