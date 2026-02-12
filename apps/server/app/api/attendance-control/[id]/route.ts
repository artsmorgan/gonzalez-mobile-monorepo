import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../utils/verifyToken";
import { prisma } from "../../../../utils/prismaClient";
import { toZonedTime } from "date-fns-tz";

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

        const existing = await prisma.c_control_asistencia.findUnique({
            where: { id: idInt }
        });
        if (!existing) {
            return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
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

        // Registrar cambios (solo campos actualizados, excluyendo firmas)
        const eq = (a: any, b: any) => {
            if (a === b) return true;
            if (a == null && b == null) return true;
            const da = a instanceof Date ? a : (typeof a === "string" && /^\d{4}-\d{2}-\d{2}T/.test(a) ? new Date(a) : null);
            const db = b instanceof Date ? b : (typeof b === "string" && /^\d{4}-\d{2}-\d{2}T/.test(b) ? new Date(b) : null);
            if (da && db) return da.getTime() === db.getTime();
            return false;
        };

        const cambiosArr: Array<{ prop: string; before: any; after: any }> = [];
        for (const [k, v] of Object.entries(updateData)) {
            if (k === "firma_responsable") continue; // Excluir firmas

            const before = (existing as any)[k];
            const after = v;
            if (!eq(before, after)) {
                cambiosArr.push({
                    prop: k,
                    before: before instanceof Date ? before.toISOString() : before,
                    after: after instanceof Date ? after.toISOString() : after,
                });
            }
        }

        const updated_record = await prisma.c_control_asistencia.update({
            where: { id: idInt },
            data: updateData
        });

        if (cambiosArr.length > 0) {
            const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
            await prisma.c_cambios_apps_modules.create({
                data: {
                    nombre_tabla: "c_control_asistencia",
                    registro_id: idInt,
                    cambios: JSON.stringify(cambiosArr),
                    created_at: toZonedTime(new Date(), "America/Costa_Rica"),
                    created_by: createdBy,
                },
            });
        }

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

        const existing = await prisma.c_control_asistencia.findUnique({
            where: { id: idInt }
        });
        if (!existing) {
            return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
        }

        // Registrar cambio de eliminación antes de eliminar
        const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
        const createdAt = toZonedTime(new Date(), "America/Costa_Rica");
        await prisma.c_cambios_apps_modules.create({
            data: {
                nombre_tabla: "c_control_asistencia",
                registro_id: idInt,
                cambios: JSON.stringify([{
                    prop: "__deleted__",
                    before: {
                        id: existing.id,
                        empresa_id: existing.empresa_id,
                        cliente_id: existing.cliente_id,
                        division_id: existing.division_id,
                        contrato_id: existing.contrato_id,
                        corpo_id: existing.corpo_id,
                        nombre_cliente: (existing as any).nombre_cliente,
                        fecha: (existing as any).fecha ? (existing as any).fecha.toISOString() : null,
                        turno: (existing as any).turno,
                        area_piso: (existing as any).area_piso,
                        total_presentes: (existing as any).total_presentes,
                        fijos: (existing as any).fijos,
                        colaboradores: (existing as any).colaboradores,
                    },
                    after: null,
                }]),
                created_at: createdAt,
                created_by: createdBy,
            },
        });

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

