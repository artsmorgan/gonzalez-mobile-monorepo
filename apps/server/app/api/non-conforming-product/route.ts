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
            cliente,
            numero_corpo,
            responsable_cuenta,
            macroactividad,
            actividad,
            tipo_servicio_no_conforme,
            tipo_registro,
            responsable_registro,
            acciones_seguir,
            responsable_corregir,
            responsable_aprobar
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
        const new_record = await prisma.c_producto_no_conforme_matriz.create({
            data: {
                empresa_id: marcaDia.empresa_id?.toString() || null,
                cliente_id: marcaDia.cliente_id?.toString() || null,
                contrato_id: marcaDia.contrato_id?.toString() || null,
                corpo_id: marcaDia.corpo_id?.toString() || null,
                puesto_id: marcaDia.puesto_id?.toString() || null,
                plaza_id: marcaDia.plaza_id?.toString() || null,
                cliente: cliente || null,
                numero_corpo: numero_corpo || null,
                responsable_cuenta: responsable_cuenta || null,
                macroactividad: macroactividad || null,
                actividad: actividad || null,
                tipo_servicio_no_conforme: tipo_servicio_no_conforme || null,
                tipo_registro: tipo_registro || null,
                responsable_registro: responsable_registro || null,
                acciones_seguir: acciones_seguir || null,
                responsable_corregir: responsable_corregir || null,
                responsable_aprobar: responsable_aprobar || null,
                created_at: toZonedTime(new Date(), "America/Costa_Rica"),
                created_by: payload.id?.toString() || null
            }
        });

        return NextResponse.json({ 
            status: true, 
            message: "Producto no conforme creado correctamente",
            data: {
                id: new_record.id,
                empresa_id: new_record.empresa_id,
                cliente_id: new_record.cliente_id,
                contrato_id: new_record.contrato_id,
                corpo_id: new_record.corpo_id,
                puesto_id: new_record.puesto_id,
                plaza_id: new_record.plaza_id,
                cliente: new_record.cliente,
                numero_corpo: new_record.numero_corpo,
                responsable_cuenta: new_record.responsable_cuenta,
                macroactividad: new_record.macroactividad,
                actividad: new_record.actividad,
                tipo_servicio_no_conforme: new_record.tipo_servicio_no_conforme,
                tipo_registro: new_record.tipo_registro,
                responsable_registro: new_record.responsable_registro,
                acciones_seguir: new_record.acciones_seguir,
                responsable_corregir: new_record.responsable_corregir,
                responsable_aprobar: new_record.responsable_aprobar,
                created_at: new_record.created_at,
                created_by: new_record.created_by,
            }
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

