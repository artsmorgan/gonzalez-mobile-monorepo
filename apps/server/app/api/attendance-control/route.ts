import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../utils/verifyToken";
import { toZonedTime } from "date-fns-tz";
import { prisma } from "../../../utils/prismaClient";

function parseDDMMYYYYToDate(value: unknown): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    const str = String(value).trim();
    // expected: dd/mm/yyyy
    const parts = str.split("/");
    if (parts.length !== 3) return null;
    const dd = parseInt(parts[0], 10);
    const mm = parseInt(parts[1], 10);
    const yyyy = parseInt(parts[2], 10);
    if (!dd || !mm || !yyyy) return null;
    const d = new Date(yyyy, mm - 1, dd);
    // validate roundtrip
    if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
    return d;
}

function toIntOrNull(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    const n = typeof value === "number" ? value : parseInt(String(value), 10);
    return Number.isFinite(n) ? n : null;
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
            cliente,
            fecha,
            turno,
            area_piso,
            total_presentes,
            fijos,
            colaboradores,
            firma_responsable
        } = await req.json();

        if (!marca_id) {
            return NextResponse.json({ status: false, message: "Marca no especificada" }, { status: 400 });
        }
        if (!firma_responsable) {
            return NextResponse.json({ status: false, message: "Firma del responsable es obligatoria" }, { status: 400 });
        }

        const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id: parseInt(marca_id) } });
        if (!marcaDia) {
            return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 404 });
        }

        if (!marcaDia.empleadoFijo_id) {
            return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 404 });
        }

        const fechaDate = parseDDMMYYYYToDate(fecha);
        const totalPresentesInt = toIntOrNull(total_presentes);
        const fijosInt = toIntOrNull(fijos);

        if (!cliente) {
            return NextResponse.json({ status: false, message: "Nombre de cliente es obligatorio" }, { status: 400 });
        }
        if (!fechaDate) {
            return NextResponse.json({ status: false, message: "Fecha inválida (formato esperado dd/mm/yyyy)" }, { status: 400 });
        }
        if (!turno) {
            return NextResponse.json({ status: false, message: "Turno es obligatorio" }, { status: 400 });
        }
        if (!area_piso) {
            return NextResponse.json({ status: false, message: "Área/Piso es obligatorio" }, { status: 400 });
        }
        if (totalPresentesInt === null) {
            return NextResponse.json({ status: false, message: "Total presentes inválido" }, { status: 400 });
        }
        if (fijosInt === null) {
            return NextResponse.json({ status: false, message: "Fijos inválido" }, { status: 400 });
        }
        if (!colaboradores) {
            return NextResponse.json({ status: false, message: "Colaboradores es obligatorio" }, { status: 400 });
        }

        // Autocompletar campos desde la marca
        const new_record = await prisma.c_control_asistencia.create({
            data: {
                empresa_id: marcaDia.empresa_id,
                cliente_id: marcaDia.cliente_id,
                contrato_id: marcaDia.contrato_id,
                corpo_id: marcaDia.corpo_id,
                puesto_id: marcaDia.puesto_id,
                plaza_id: marcaDia.plaza_id,
                nombre_cliente: String(cliente),
                fecha: fechaDate,
                turno: String(turno),
                area_piso: String(area_piso),
                total_presentes: totalPresentesInt,
                fijos: fijosInt,
                colaboradores: String(colaboradores),
                firma_responsable: String(firma_responsable),
                created_at: toZonedTime(new Date(), "America/Costa_Rica"),
                created_by: payload.id
            }
        });

        return NextResponse.json({ 
            status: true, 
            message: "Control de asistencia creado correctamente",
            data: {
                id: new_record.id,
                nombre_cliente: (new_record as any).nombre_cliente,
                fecha: (new_record as any).fecha,
                turno: (new_record as any).turno,
                area_piso: (new_record as any).area_piso,
                total_presentes: (new_record as any).total_presentes,
                fijos: (new_record as any).fijos,
                colaboradores: (new_record as any).colaboradores,
                firma_responsable: (new_record as any).firma_responsable,
                created_at: (new_record as any).created_at,
                created_by: (new_record as any).created_by,
            }
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

