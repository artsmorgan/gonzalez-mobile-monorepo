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
            numero_puesto,
            fecha_realizado,
            nombre_corpo,
            nombre_puesto,
            tipo,
            actividades,
            inventario,
            fotos,
            otras_observaciones,
            nombre_representante_cliente,
            firma_cliente
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
        const new_record = await prisma.c_apertura_cierre_puesto.create({
            data: {
                empresa_id: marcaDia.empresa_id?.toString() || null,
                cliente_id: marcaDia.cliente_id?.toString() || null,
                contrato_id: marcaDia.contrato_id?.toString() || null,
                corpo_id: marcaDia.corpo_id?.toString() || null,
                puesto_id: marcaDia.puesto_id?.toString() || null,
                plaza_id: marcaDia.plaza_id?.toString() || null,
                cliente: cliente || null,
                numero_corpo: numero_corpo || null,
                numero_puesto: numero_puesto || null,
                fecha_realizado: fecha_realizado || null,
                nombre_corpo: nombre_corpo || null,
                nombre_puesto: nombre_puesto || null,
                tipo: tipo || null,
                actividades: actividades || null,
                inventario: inventario || null,
                fotos: fotos || null,
                otras_observaciones: otras_observaciones || null,
                nombre_representante_cliente: nombre_representante_cliente || null,
                firma_cliente: firma_cliente || null,
                created_at: toZonedTime(new Date(), "America/Costa_Rica"),
                created_by: payload.id?.toString() || null
            }
        });

        return NextResponse.json({ 
            status: true, 
            message: "Apertura-Cierre de Puesto creado correctamente",
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
                numero_puesto: new_record.numero_puesto,
                fecha_realizado: new_record.fecha_realizado,
                nombre_corpo: new_record.nombre_corpo,
                nombre_puesto: new_record.nombre_puesto,
                tipo: new_record.tipo,
                actividades: new_record.actividades,
                inventario: new_record.inventario,
                fotos: new_record.fotos,
                otras_observaciones: new_record.otras_observaciones,
                nombre_representante_cliente: new_record.nombre_representante_cliente,
                firma_cliente: new_record.firma_cliente,
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

