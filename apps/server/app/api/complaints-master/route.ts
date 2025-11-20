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
            sociedad,
            nombre_realiza_queja,
            cliente,
            empresa_presenta_queja,
            persona_presenta_queja,
            medio_recepcion_queja,
            tipo_queja,
            ubicacion,
            nivel_queja,
            fecha_queja,
            motivo_queja,
            descripcion_queja,
            fecha_inicio,
            fecha_revision,
            resolucion_queja,
            mes_queja,
            ano_queja,
            estado,
            accion_correctiva_preventiva,
            anexo_evidencia
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
        const new_record = await prisma.c_maestro_quejas.create({
            data: {
                empresa_id: marcaDia.empresa_id?.toString() || null,
                cliente_id: marcaDia.cliente_id?.toString() || null,
                contrato_id: marcaDia.contrato_id?.toString() || null,
                corpo_id: marcaDia.corpo_id?.toString() || null,
                puesto_id: marcaDia.puesto_id?.toString() || null,
                plaza_id: marcaDia.plaza_id?.toString() || null,
                sociedad: sociedad || null,
                nombre_realiza_queja: nombre_realiza_queja || null,
                cliente: cliente || null,
                empresa_presenta_queja: empresa_presenta_queja || null,
                persona_presenta_queja: persona_presenta_queja || null,
                medio_recepcion_queja: medio_recepcion_queja || null,
                tipo_queja: tipo_queja || null,
                ubicacion: ubicacion || null,
                nivel_queja: nivel_queja || null,
                fecha_queja: fecha_queja || null,
                motivo_queja: motivo_queja || null,
                descripcion_queja: descripcion_queja || null,
                fecha_inicio: fecha_inicio || null,
                fecha_revision: fecha_revision || null,
                resolucion_queja: resolucion_queja || null,
                mes_queja: mes_queja || null,
                ano_queja: ano_queja || null,
                estado: estado || null,
                accion_correctiva_preventiva: accion_correctiva_preventiva || null,
                anexo_evidencia: anexo_evidencia || null,
                created_at: toZonedTime(new Date(), "America/Costa_Rica"),
                created_by: payload.id?.toString() || null
            }
        });

        return NextResponse.json({ 
            status: true, 
            message: "Queja creada correctamente",
            data: {
                id: new_record.id,
                empresa_id: new_record.empresa_id,
                cliente_id: new_record.cliente_id,
                contrato_id: new_record.contrato_id,
                corpo_id: new_record.corpo_id,
                puesto_id: new_record.puesto_id,
                plaza_id: new_record.plaza_id,
                sociedad: new_record.sociedad,
                nombre_realiza_queja: new_record.nombre_realiza_queja,
                cliente: new_record.cliente,
                empresa_presenta_queja: new_record.empresa_presenta_queja,
                persona_presenta_queja: new_record.persona_presenta_queja,
                medio_recepcion_queja: new_record.medio_recepcion_queja,
                tipo_queja: new_record.tipo_queja,
                ubicacion: new_record.ubicacion,
                nivel_queja: new_record.nivel_queja,
                fecha_queja: new_record.fecha_queja,
                motivo_queja: new_record.motivo_queja,
                descripcion_queja: new_record.descripcion_queja,
                fecha_inicio: new_record.fecha_inicio,
                fecha_revision: new_record.fecha_revision,
                resolucion_queja: new_record.resolucion_queja,
                mes_queja: new_record.mes_queja,
                ano_queja: new_record.ano_queja,
                estado: new_record.estado,
                accion_correctiva_preventiva: new_record.accion_correctiva_preventiva,
                anexo_evidencia: new_record.anexo_evidencia,
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

