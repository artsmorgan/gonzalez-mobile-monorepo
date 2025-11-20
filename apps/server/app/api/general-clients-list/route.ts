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
            numero_cliente,
            fecha_inicio,
            fecha_finalizacion,
            extension_prorroga,
            nombre_cliente,
            area_sede,
            numero_corpo,
            numero_licitacion,
            cantidad_miscelaneos,
            tipo_requerimiento_insumos,
            tipo_requerimiento_utencilios,
            tipo_requerimiento_equipos,
            ubicacion,
            fecha_reunion_apertura,
            necesidades,
            gustos_preferencias,
            supervisor_asignado,
            condiciones_licitaciones,
            plan_trabajo,
            encuestas
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
        const new_record = await prisma.c_listado_general_clientes.create({
            data: {
                empresa_id: marcaDia.empresa_id?.toString() || null,
                cliente_id: marcaDia.cliente_id?.toString() || null,
                contrato_id: marcaDia.contrato_id?.toString() || null,
                corpo_id: marcaDia.corpo_id?.toString() || null,
                puesto_id: marcaDia.puesto_id?.toString() || null,
                plaza_id: marcaDia.plaza_id?.toString() || null,
                numero_cliente: numero_cliente || null,
                fecha_inicio: fecha_inicio || null,
                fecha_finalizacion: fecha_finalizacion || null,
                extension_prorroga: extension_prorroga || null,
                nombre_cliente: nombre_cliente || null,
                area_sede: area_sede || null,
                numero_corpo: numero_corpo || null,
                numero_licitacion: numero_licitacion || null,
                cantidad_miscelaneos: cantidad_miscelaneos || null,
                tipo_requerimiento_insumos: tipo_requerimiento_insumos || null,
                tipo_requerimiento_utencilios: tipo_requerimiento_utencilios || null,
                tipo_requerimiento_equipos: tipo_requerimiento_equipos || null,
                ubicacion: ubicacion || null,
                fecha_reunion_apertura: fecha_reunion_apertura || null,
                necesidades: necesidades || null,
                gustos_preferencias: gustos_preferencias || null,
                supervisor_asignado: supervisor_asignado || null,
                condiciones_licitaciones: condiciones_licitaciones || null,
                plan_trabajo: plan_trabajo || null,
                encuestas: encuestas || null,
                created_at: toZonedTime(new Date(), "America/Costa_Rica"),
                created_by: payload.id?.toString() || null
            }
        });

        return NextResponse.json({ 
            status: true, 
            message: "Listado general de clientes creado correctamente",
            data: {
                id: new_record.id,
                empresa_id: new_record.empresa_id,
                cliente_id: new_record.cliente_id,
                contrato_id: new_record.contrato_id,
                corpo_id: new_record.corpo_id,
                puesto_id: new_record.puesto_id,
                plaza_id: new_record.plaza_id,
                numero_cliente: new_record.numero_cliente,
                fecha_inicio: new_record.fecha_inicio,
                fecha_finalizacion: new_record.fecha_finalizacion,
                extension_prorroga: new_record.extension_prorroga,
                nombre_cliente: new_record.nombre_cliente,
                area_sede: new_record.area_sede,
                numero_corpo: new_record.numero_corpo,
                numero_licitacion: new_record.numero_licitacion,
                cantidad_miscelaneos: new_record.cantidad_miscelaneos,
                tipo_requerimiento_insumos: new_record.tipo_requerimiento_insumos,
                tipo_requerimiento_utencilios: new_record.tipo_requerimiento_utencilios,
                tipo_requerimiento_equipos: new_record.tipo_requerimiento_equipos,
                ubicacion: new_record.ubicacion,
                fecha_reunion_apertura: new_record.fecha_reunion_apertura,
                necesidades: new_record.necesidades,
                gustos_preferencias: new_record.gustos_preferencias,
                supervisor_asignado: new_record.supervisor_asignado,
                condiciones_licitaciones: new_record.condiciones_licitaciones,
                plan_trabajo: new_record.plan_trabajo,
                encuestas: new_record.encuestas,
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

