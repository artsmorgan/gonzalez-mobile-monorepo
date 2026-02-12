import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../utils/verifyToken";
import { prisma } from "../../../../utils/prismaClient";
import { toZonedTime } from "date-fns-tz";

function parseFechaInput(fecha: any): Date | undefined {
    if (!fecha) return undefined;
    if (fecha instanceof Date) return fecha;
    if (typeof fecha === 'string') {
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

export async function PUT(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { valid, expired, payload, message } = verifyAccessToken(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const { id } = resolvedParams;
        const idNum = parseInt(String(id), 10);
        if (Number.isNaN(idNum)) {
            return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
        }

        const {
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

        const existing = await prisma.c_registro_induccion_recorrido.findUnique({
            where: { id: idNum }
        });
        if (!existing) {
            return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
        }

        const fechaParsed = parseFechaInput(fecha);
        if (fecha !== undefined && fecha !== null && !fechaParsed) {
            return NextResponse.json({ status: false, message: "Fecha inválida" }, { status: 400 });
        }

        const updateData: any = {
            ...(fecha !== undefined ? (fechaParsed ? { fecha: fechaParsed } : {}) : {}),
            division: division !== undefined ? (division ? String(division).trim() : "Otros") : undefined,
            renglon_edificio: renglon_edificio !== undefined ? (renglon_edificio ? String(renglon_edificio) : "") : undefined,
            supervisor_cliente: supervisor_cliente !== undefined ? (supervisor_cliente !== null && supervisor_cliente !== undefined ? String(supervisor_cliente) : null) : undefined,
            supervisor_corporacion: supervisor_corporacion !== undefined ? (supervisor_corporacion ? String(supervisor_corporacion) : "") : undefined,
            temas_desarrollados: temas_desarrollados !== undefined ? (temas_desarrollados ? String(temas_desarrollados) : "[]") : undefined,
            aspectos_especificos: aspectos_especificos !== undefined ? (aspectos_especificos ? String(aspectos_especificos) : "[]") : undefined,
            participantes: participantes !== undefined ? (participantes ? String(participantes) : "[]") : undefined,
            firma_supervisor: firma_supervisor !== undefined ? (firma_supervisor ? String(firma_supervisor) : "") : undefined,
            firma_responsable: firma_responsable !== undefined ? (firma_responsable ? String(firma_responsable) : "") : undefined,
        };

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
            if (v === undefined) continue; // Solo procesar campos que se están actualizando
            if (k.startsWith("firma_")) continue; // Excluir firmas

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

        const updated_record = await prisma.c_registro_induccion_recorrido.update({
            where: { id: idNum },
            data: updateData,
        });

        if (cambiosArr.length > 0) {
            const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
            await prisma.c_cambios_apps_modules.create({
                data: {
                    nombre_tabla: "c_registro_induccion_recorrido",
                    registro_id: idNum,
                    cambios: JSON.stringify(cambiosArr),
                    created_at: toZonedTime(new Date(), "America/Costa_Rica"),
                    created_by: createdBy,
                },
            });
        }

        return NextResponse.json({
            status: true,
            message: "Registro de inducción y recorrido actualizado correctamente",
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
        const idNum = parseInt(String(id), 10);
        if (Number.isNaN(idNum)) {
            return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
        }

        const existing = await prisma.c_registro_induccion_recorrido.findUnique({
            where: { id: idNum }
        });
        if (!existing) {
            return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
        }

        // Registrar cambio de eliminación antes de eliminar
        const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
        const createdAt = toZonedTime(new Date(), "America/Costa_Rica");
        await prisma.c_cambios_apps_modules.create({
            data: {
                nombre_tabla: "c_registro_induccion_recorrido",
                registro_id: idNum,
                cambios: JSON.stringify([{
                    prop: "__deleted__",
                    before: {
                        id: existing.id,
                        empresa_id: existing.empresa_id,
                        cliente_id: existing.cliente_id,
                        contrato_id: existing.contrato_id,
                        corpo_id: existing.corpo_id,
                        puesto_id: existing.puesto_id,
                        plaza_id: existing.plaza_id,
                        fecha: existing.fecha ? existing.fecha.toISOString() : null,
                        division: existing.division,
                        renglon_edificio: existing.renglon_edificio,
                        supervisor_cliente: existing.supervisor_cliente,
                        supervisor_corporacion: existing.supervisor_corporacion,
                        temas_desarrollados: existing.temas_desarrollados,
                        aspectos_especificos: existing.aspectos_especificos,
                        participantes: existing.participantes,
                    },
                    after: null,
                }]),
                created_at: createdAt,
                created_by: createdBy,
            },
        });

        await prisma.c_registro_induccion_recorrido.delete({
            where: { id: idNum }
        });

        return NextResponse.json({
            status: true,
            message: "Registro de inducción y recorrido eliminado correctamente"
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

