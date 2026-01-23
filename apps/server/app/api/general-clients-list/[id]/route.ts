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

        const updated_record = await prisma.c_listado_general_clientes.update({
            where: { id },
            data: {
                numero_cliente: numero_cliente !== undefined ? numero_cliente : undefined,
                fecha_inicio: fecha_inicio !== undefined ? fecha_inicio : undefined,
                fecha_finalizacion: fecha_finalizacion !== undefined ? fecha_finalizacion : undefined,
                extension_prorroga: extension_prorroga !== undefined ? extension_prorroga : undefined,
                nombre_cliente: nombre_cliente !== undefined ? nombre_cliente : undefined,
                area_sede: area_sede !== undefined ? area_sede : undefined,
                numero_corpo: numero_corpo !== undefined ? numero_corpo : undefined,
                numero_licitacion: numero_licitacion !== undefined ? numero_licitacion : undefined,
                cantidad_miscelaneos: cantidad_miscelaneos !== undefined ? cantidad_miscelaneos : undefined,
                tipo_requerimiento_insumos: tipo_requerimiento_insumos !== undefined ? tipo_requerimiento_insumos : undefined,
                tipo_requerimiento_utencilios: tipo_requerimiento_utencilios !== undefined ? tipo_requerimiento_utencilios : undefined,
                tipo_requerimiento_equipos: tipo_requerimiento_equipos !== undefined ? tipo_requerimiento_equipos : undefined,
                ubicacion: ubicacion !== undefined ? ubicacion : undefined,
                fecha_reunion_apertura: fecha_reunion_apertura !== undefined ? fecha_reunion_apertura : undefined,
                necesidades: necesidades !== undefined ? necesidades : undefined,
                gustos_preferencias: gustos_preferencias !== undefined ? gustos_preferencias : undefined,
                supervisor_asignado: supervisor_asignado !== undefined ? supervisor_asignado : undefined,
                condiciones_licitaciones: condiciones_licitaciones !== undefined ? condiciones_licitaciones : undefined,
                plan_trabajo: plan_trabajo !== undefined ? plan_trabajo : undefined,
                encuestas: encuestas !== undefined ? encuestas : undefined,
            }
        });

        return NextResponse.json({
            status: true,
            message: "Listado general de clientes actualizado correctamente",
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

        await prisma.c_listado_general_clientes.delete({
            where: { id }
        });

        return NextResponse.json({
            status: true,
            message: "Listado general de clientes eliminado correctamente"
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

