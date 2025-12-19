import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../utils/verifyToken";
import { toZonedTime } from "date-fns-tz";
import { prisma } from "../../../utils/prismaClient";

function parseFechaInput(fecha: any): Date | undefined {
    if (!fecha) return undefined;
    if (fecha instanceof Date) return fecha;
    if (typeof fecha === 'string') {
        // dd/mm/yyyy (legacy mobile) OR ISO (yyyy-mm-dd / full ISO)
        if (fecha.includes('/')) {
            const parts = fecha.split('/');
            if (parts.length === 3) {
                const [dd, mm, yyyy] = parts;
                const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
                if (!Number.isNaN(d.getTime())) return d;
            }
        }
        const d = new Date(fecha);
        if (!Number.isNaN(d.getTime())) return d;
    }
    return undefined;
}

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
            fecha,
            division,
            renglon_edificio,
            supervisor_cliente,
            supervisor_corporacion,
            temas_desarrollados,
            aspectos_especificos,
            participantes,
            firma_supervisor,
            firma_responsable
        } = await req.json();

        if (!marca_id) {
            return NextResponse.json({ status: false, message: "Marca no especificada" }, { status: 400 });
        }

        const marcaIdNum = parseInt(String(marca_id), 10);
        if (Number.isNaN(marcaIdNum)) {
            return NextResponse.json({ status: false, message: "Marca inválida" }, { status: 400 });
        }

        const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id: marcaIdNum } });
        if (!marcaDia) {
            return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 404 });
        }

        if (!marcaDia.empleadoFijo_id) {
            return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 404 });
        }

        const empresaId = Number(marcaDia.empresa_id);
        const clienteId = Number(marcaDia.cliente_id);
        const contratoId = Number(marcaDia.contrato_id);
        const corpoId = Number(marcaDia.corpo_id);
        const puestoId = Number(marcaDia.puesto_id);
        const plazaId = Number(marcaDia.plaza_id);

        if (
            [empresaId, clienteId, contratoId, corpoId, puestoId, plazaId].some((n) => Number.isNaN(n) || n === 0)
        ) {
            return NextResponse.json({ status: false, message: "No se pudieron derivar los IDs de la marca" }, { status: 400 });
        }

        const fechaParsed = parseFechaInput(fecha);

        // Autocompletar campos desde la marca
        const new_record = await prisma.c_registro_induccion_recorrido.create({
            data: {
                empresa_id: empresaId,
                cliente_id: clienteId,
                contrato_id: contratoId,
                corpo_id: corpoId,
                puesto_id: puestoId,
                plaza_id: plazaId,
                ...(fechaParsed ? { fecha: fechaParsed } : {}),
                division: (division && String(division).trim()) ? String(division).trim() : "Otros",
                renglon_edificio: renglon_edificio ? String(renglon_edificio) : "",
                supervisor_cliente: supervisor_cliente !== undefined && supervisor_cliente !== null ? String(supervisor_cliente) : null,
                supervisor_corporacion: supervisor_corporacion ? String(supervisor_corporacion) : "",
                temas_desarrollados: temas_desarrollados ? String(temas_desarrollados) : "[]",
                aspectos_especificos: aspectos_especificos ? String(aspectos_especificos) : "[]",
                participantes: participantes ? String(participantes) : "[]",
                firma_supervisor: firma_supervisor ? String(firma_supervisor) : "",
                firma_responsable: firma_responsable ? String(firma_responsable) : "",
                created_at: toZonedTime(new Date(), "America/Costa_Rica"),
                created_by: payload.id?.toString() || ""
            }
        });

        return NextResponse.json({ 
            status: true, 
            message: "Registro de inducción y recorrido creado correctamente",
            data: {
                id: new_record.id,
                empresa_id: new_record.empresa_id,
                cliente_id: new_record.cliente_id,
                contrato_id: new_record.contrato_id,
                corpo_id: new_record.corpo_id,
                puesto_id: new_record.puesto_id,
                plaza_id: new_record.plaza_id,
                fecha: new_record.fecha,
                renglon_edificio: new_record.renglon_edificio,
                supervisor_cliente: new_record.supervisor_cliente,
                supervisor_corporacion: new_record.supervisor_corporacion,
                temas_desarrollados: new_record.temas_desarrollados,
                aspectos_especificos: new_record.aspectos_especificos,
                participantes: new_record.participantes,
                firma_supervisor: new_record.firma_supervisor,
                division: new_record.division,
                firma_responsable: new_record.firma_responsable,
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

