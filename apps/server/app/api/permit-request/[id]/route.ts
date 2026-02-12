import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../utils/verifyToken";
import { prisma } from "../../../../utils/prismaClient";
import { toZonedTime } from "date-fns-tz";

const parseDateInputToDate = (input: unknown): Date | undefined => {
    if (input === undefined) return undefined;
    if (input === null) return undefined;
    if (input instanceof Date) return isNaN(input.getTime()) ? undefined : input;

    const s = String(input).trim();
    if (!s) return undefined;

    const parts = s.split("/");
    if (parts.length === 3) {
        const [dd, mm, yyyy] = parts;
        const day = parseInt(dd, 10);
        const month = parseInt(mm, 10);
        const year = parseInt(yyyy, 10);
        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
            const d = new Date(year, month - 1, day, 0, 0, 0, 0);
            return isNaN(d.getTime()) ? undefined : d;
        }
    }

    const d = new Date(s);
    return isNaN(d.getTime()) ? undefined : d;
};

export async function PUT(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { valid, expired, payload, message } = verifyAccessToken(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const { id } = resolvedParams;
        const idNum = parseInt(id, 10);
        if (!idNum) {
            return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
        }

        const {
            division,
            persona_solicita,
            codigo,
            contrato,
            horario,
            fecha_solicitud,
            motivo_permiso,
            permiso_sustituido_por,
            codigo_sustituto,
            firma_gerente,
            firma_encargado_monitoreo,
            permiso_coordinado_por,
            firma_responsables
        } = await req.json();

        const existing = await prisma.c_solicitud_permiso.findUnique({
            where: { id: idNum }
        });
        if (!existing) {
            return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
        }

        const fechaSolicitudDate = parseDateInputToDate(fecha_solicitud);

        const updateData: any = {
            division: division !== undefined ? division : undefined,
            persona_solicita: persona_solicita !== undefined ? persona_solicita : undefined,
            codigo: codigo !== undefined ? codigo : undefined,
            contrato: contrato !== undefined ? contrato : undefined,
            horario: horario !== undefined ? horario : undefined,
            fecha_solicitud: fechaSolicitudDate,
            motivo_permiso: motivo_permiso !== undefined ? motivo_permiso : undefined,
            permiso_sustituido_por: permiso_sustituido_por !== undefined ? permiso_sustituido_por : undefined,
            codigo_sustituto: codigo_sustituto !== undefined ? codigo_sustituto : undefined,
            firma_gerente: firma_gerente !== undefined ? firma_gerente : undefined,
            firma_encargado_monitoreo: firma_encargado_monitoreo !== undefined ? firma_encargado_monitoreo : undefined,
            permiso_coordinado_por: permiso_coordinado_por !== undefined ? permiso_coordinado_por : undefined,
            firma_responsables: firma_responsables !== undefined ? firma_responsables : undefined,
        };

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

        const updated_record = await prisma.c_solicitud_permiso.update({
            where: { id: idNum },
            data: updateData
        });

        if (cambiosArr.length > 0) {
            const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
            await prisma.c_cambios_apps_modules.create({
                data: {
                    nombre_tabla: "c_solicitud_permiso",
                    registro_id: idNum,
                    cambios: JSON.stringify(cambiosArr),
                    created_at: toZonedTime(new Date(), "America/Costa_Rica"),
                    created_by: createdBy,
                },
            });
        }

        return NextResponse.json({
            status: true,
            message: "Solicitud de permiso actualizada correctamente",
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
        const idNum = parseInt(id, 10);
        if (!idNum) {
            return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
        }

        const existing = await prisma.c_solicitud_permiso.findUnique({
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
                nombre_tabla: "c_solicitud_permiso",
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
                        division: (existing as any).division,
                        persona_solicita: existing.persona_solicita,
                        codigo: existing.codigo,
                        contrato: existing.contrato,
                        horario: existing.horario,
                        fecha_solicitud: existing.fecha_solicitud ? existing.fecha_solicitud.toISOString() : null,
                        motivo_permiso: existing.motivo_permiso,
                        permiso_sustituido_por: existing.permiso_sustituido_por,
                        codigo_sustituto: existing.codigo_sustituto,
                        permiso_coordinado_por: existing.permiso_coordinado_por,
                    },
                    after: null,
                }]),
                created_at: createdAt,
                created_by: createdBy,
            },
        });

        await prisma.c_solicitud_permiso.delete({
            where: { id: idNum }
        });

        return NextResponse.json({
            status: true,
            message: "Solicitud de permiso eliminada correctamente"
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

