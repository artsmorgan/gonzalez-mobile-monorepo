import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../utils/verifyToken";
import { prisma } from "../../../../utils/prismaClient";

function parseDDMMYYYYToDate(value: unknown): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    const str = String(value).trim();
    const parts = str.split("/");
    if (parts.length !== 3) return null;
    const dd = parseInt(parts[0], 10);
    const mm = parseInt(parts[1], 10);
    const yyyy = parseInt(parts[2], 10);
    if (!dd || !mm || !yyyy) return null;
    const d = new Date(yyyy, mm - 1, dd);
    if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
    return d;
}

function toIntOrNull(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    const n = typeof value === "number" ? value : parseInt(String(value), 10);
    return Number.isFinite(n) ? n : null;
}

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
            empresa_id,
            cliente_id,
            division_id,
            contrato_id,
            corpo_id,
            cliente,
            fecha,
            turno,
            area_piso,
            total_presentes,
            fijos,
            colaboradores,
            firma_responsable
        } = await req.json();

        const idInt = parseInt(String(id), 10);
        if (!idInt) {
            return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
        }

        const fechaDate = fecha !== undefined ? parseDDMMYYYYToDate(fecha) : undefined;
        if (fecha !== undefined && !fechaDate) {
            return NextResponse.json({ status: false, message: "Fecha inválida (formato esperado dd/mm/yyyy)" }, { status: 400 });
        }

        const totalPresentesInt = total_presentes !== undefined ? toIntOrNull(total_presentes) : undefined;
        if (total_presentes !== undefined && totalPresentesInt === null) {
            return NextResponse.json({ status: false, message: "Total presentes inválido" }, { status: 400 });
        }

        const fijosInt = fijos !== undefined ? toIntOrNull(fijos) : undefined;
        if (fijos !== undefined && fijosInt === null) {
            return NextResponse.json({ status: false, message: "Fijos inválido" }, { status: 400 });
        }

        const updateData: any = {
            // El modelo usa nombre_cliente (no cliente)
            nombre_cliente: cliente !== undefined ? String(cliente) : undefined,
            fecha: fecha !== undefined ? (fechaDate as Date) : undefined,
            turno: turno !== undefined ? turno : undefined,
            area_piso: area_piso !== undefined ? area_piso : undefined,
            total_presentes: total_presentes !== undefined ? (totalPresentesInt as number) : undefined,
            fijos: fijos !== undefined ? (fijosInt as number) : undefined,
            colaboradores: colaboradores !== undefined ? colaboradores : undefined,
            firma_responsable: firma_responsable !== undefined ? String(firma_responsable) : undefined,
        };

        // Añadir campos jerárquicos si están presentes
        if (empresa_id !== undefined) updateData.empresa_id = parseInt(String(empresa_id), 10);
        if (cliente_id !== undefined) updateData.cliente_id = parseInt(String(cliente_id), 10);
        if (division_id !== undefined) updateData.division_id = parseInt(String(division_id), 10);
        if (contrato_id !== undefined) updateData.contrato_id = parseInt(String(contrato_id), 10);
        if (corpo_id !== undefined) updateData.corpo_id = parseInt(String(corpo_id), 10);

        // Eliminar campos undefined
        Object.keys(updateData).forEach(key => {
            if (updateData[key] === undefined) {
                delete updateData[key];
            }
        });

        const updated_record = await prisma.c_control_asistencia.update({
            where: { id: idInt },
            data: updateData
        });

        return NextResponse.json({
            status: true,
            message: "Control de asistencia actualizado correctamente",
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

        const idInt = parseInt(String(id), 10);
        if (!idInt) {
            return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
        }

        await prisma.c_control_asistencia.delete({
            where: { id: idInt }
        });

        return NextResponse.json({
            status: true,
            message: "Control de asistencia eliminado correctamente"
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

