import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../utils/verifyToken";
import { toZonedTime } from "date-fns-tz";
import { prisma } from "../../../utils/prismaClient";

export async function POST(req: NextRequest) {
    try {
        const { valid, payload, message } = verifyAccessToken(req);

        if (!valid) {
            return NextResponse.json(
                { status: false, message: message },
                { status: 401 }
            );
        }

        const { 
            marca_id, 
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

        if (!marca_id) {
            return NextResponse.json({ status: false, message: "Marca no especificada" }, { status: 400 });
        }

        const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id: parseInt(marca_id) } });
        if (!marcaDia) {
            return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 404 });
        }

        if (!marcaDia.empleadoFijo_id) {
            return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 404 });
        }

        // Autocompletar campos desde la marca
        const new_control = await prisma.c_control_kilometraje.create({
            data: {
                empresa_id: marcaDia.empresa_id?.toString() || null,
                cliente_id: marcaDia.cliente_id?.toString() || null,
                contrato_id: marcaDia.contrato_id?.toString() || null,
                corpo_id: marcaDia.corpo_id?.toString() || null,
                puesto_id: marcaDia.puesto_id?.toString() || null,
                plaza_id: marcaDia.plaza_id?.toString() || null,
                chofer_id: chofer_id || null,
                chofer_nombre: chofer_nombre || null,
                total_km: total_km || null,
                ruta: ruta || null,
                prox_mant_km: prox_mant_km || null,
                km_para_mantenimiento: km_para_mantenimiento || null,
                km_actual: km_actual || null,
                estado: estado || null,
                vehiculo_id: vehiculo_id || null,
                registros_viaje: registros_viaje ? JSON.stringify(registros_viaje) : null,
                created_at: toZonedTime(new Date(), "America/Costa_Rica"),
                created_by: payload.id?.toString() || null
            }
        });

        return NextResponse.json({ 
            status: true, 
            message: "Control de kilometraje creado correctamente",
            data: {
                id: new_control.id,
                empresa_id: new_control.empresa_id,
                cliente_id: new_control.cliente_id,
                contrato_id: new_control.contrato_id,
                corpo_id: new_control.corpo_id,
                puesto_id: new_control.puesto_id,
                plaza_id: new_control.plaza_id,
                chofer_id: new_control.chofer_id,
                chofer_nombre: new_control.chofer_nombre,
                total_km: new_control.total_km,
                ruta: new_control.ruta,
                prox_mant_km: new_control.prox_mant_km,
                km_para_mantenimiento: new_control.km_para_mantenimiento,
                km_actual: new_control.km_actual,
                estado: new_control.estado,
                vehiculo_id: new_control.vehiculo_id,
                registros_viaje: new_control.registros_viaje ? JSON.parse(new_control.registros_viaje) : [],
                created_at: new_control.created_at,
                created_by: new_control.created_by,
            }
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

