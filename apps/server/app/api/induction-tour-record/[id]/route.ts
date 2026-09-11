import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";
import { toZonedTime } from "date-fns-tz";
import { reportError } from "../../../../utils/reportError";

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
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const { id } = resolvedParams;
        const idNum = parseInt(String(id), 10);
        if (Number.isNaN(idNum)) {
            await reportError(req, "api/induction-tour-record/[id]", "PUT", 400, "ID inválido");
            return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
        }

        const {
            empresa_id,
            cliente_id,
            division_id,
            contrato_id,
            corpo_id,
            puesto_id,
            plaza_id,
            empleado_id,
            fecha,
            division,
            renglon_edificio,
            supervisor_cliente,
            supervisor_corporacion,
            temas_desarrollados,
            aspectos_especificos,
            participantes,
            firma_supervisor,
            firma_empleado,
            firma_responsable
        } = await req.json();

        const existing = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_registro_induccion_recorrido",
                operation: "findUnique",
                where: { id: idNum },
            },
        });
        if (!existing) {
            await reportError(req, "api/induction-tour-record/[id]", "PUT", 404, "Registro no encontrado");
            return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
        }
        const existingObj = existing as any;

        const fechaParsed = parseFechaInput(fecha);
        if (fecha !== undefined && fecha !== null && !fechaParsed) {
            await reportError(req, "api/induction-tour-record/[id]", "PUT", 400, "Fecha inválida");
            return NextResponse.json({ status: false, message: "Fecha inválida" }, { status: 400 });
        }

        const updateData: any = {};
        if (empresa_id !== undefined) updateData.empresa_id = Number(empresa_id);
        if (cliente_id !== undefined) updateData.cliente_id = Number(cliente_id);
        if (division_id !== undefined) updateData.division_id = Number(division_id);
        if (contrato_id !== undefined) updateData.contrato_id = Number(contrato_id);
        if (corpo_id !== undefined) updateData.corpo_id = Number(corpo_id);
        if (puesto_id !== undefined) updateData.puesto_id = puesto_id !== null ? Number(puesto_id) : null;
        if (plaza_id !== undefined) updateData.plaza_id = Number(plaza_id);
        if (empleado_id !== undefined) {
            const empleadoIdNum = Number(empleado_id);
            if (Number.isNaN(empleadoIdNum) || empleadoIdNum === 0) {
                await reportError(req, "api/induction-tour-record/[id]", "PUT", 400, "empleado_id inválido");
                return NextResponse.json({ status: false, message: "empleado_id inválido" }, { status: 400 });
            }
            updateData.empleado_id = empleadoIdNum;
        }
        if (fecha !== undefined) {
            if (fechaParsed) {
                updateData.fecha = fechaParsed.toISOString();
            }
        }
        if (division !== undefined) updateData.division = division ? String(division).trim() : "Otros";
        if (renglon_edificio !== undefined) updateData.renglon_edificio = renglon_edificio ? String(renglon_edificio) : "";
        if (supervisor_cliente !== undefined) updateData.supervisor_cliente = supervisor_cliente !== null && supervisor_cliente !== undefined ? String(supervisor_cliente) : null;
        if (supervisor_corporacion !== undefined) updateData.supervisor_corporacion = supervisor_corporacion ? String(supervisor_corporacion) : "";
        if (temas_desarrollados !== undefined) updateData.temas_desarrollados = temas_desarrollados ? String(temas_desarrollados) : "[]";
        if (aspectos_especificos !== undefined) updateData.aspectos_especificos = aspectos_especificos ? String(aspectos_especificos) : "[]";
        if (participantes !== undefined) updateData.participantes = participantes ? String(participantes) : "[]";
        if (firma_supervisor !== undefined) {
            updateData.firma_supervisor =
                firma_supervisor != null && String(firma_supervisor).trim().length > 0
                    ? String(firma_supervisor).trim()
                    : null;
        }
        if (firma_empleado !== undefined) {
            updateData.firma_empleado =
                firma_empleado != null && String(firma_empleado).trim().length > 0
                    ? String(firma_empleado).trim()
                    : null;
        }
        if (firma_responsable !== undefined) updateData.firma_responsable = firma_responsable ? String(firma_responsable) : "";

        // Registrar cambios (solo campos actualizados, incluyendo firmas)
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
            const before = existingObj[k];
            const after = v;
            if (!eq(before, after)) {
                const beforeValue = before instanceof Date ? before.toISOString() : (typeof before === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(before) ? before : before);
                const afterValue = after instanceof Date ? after.toISOString() : (typeof after === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(after) ? after : after);
                cambiosArr.push({
                    prop: k,
                    before: beforeValue,
                    after: afterValue,
                });
            }
        }

        const updated_record = await callDynamicPrisma({
            req,
            data: {
                action: "UPDATE",
                table: "c_registro_induccion_recorrido",
                operation: "update",
                where: { id: idNum },
                data: updateData,
            },
        });

        if (cambiosArr.length > 0) {
            const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
            await callDynamicPrisma({
                req,
                data: {
                    action: "POST",
                    table: "c_cambios_apps_modules",
                    operation: "create",
                    data: {
                        nombre_tabla: "c_registro_induccion_recorrido",
                        registro_id: idNum,
                        cambios: JSON.stringify(cambiosArr),
                        created_at: toZonedTime(new Date(), "America/Costa_Rica").toISOString(),
                        created_by: createdBy,
                    },
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
        await reportError(req, "api/induction-tour-record/[id]", "PUT", 500, errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const { id } = resolvedParams;
        const idNum = parseInt(String(id), 10);
        if (Number.isNaN(idNum)) {
            await reportError(req, "api/induction-tour-record/[id]", "DELETE", 400, "ID inválido");
            return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
        }

        const existing = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_registro_induccion_recorrido",
                operation: "findUnique",
                where: { id: idNum },
            },
        });
        if (!existing) {
            await reportError(req, "api/induction-tour-record/[id]", "DELETE", 404, "Registro no encontrado");
            return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
        }

        const existingObj = existing as any;
        // Registrar cambio de eliminación antes de eliminar
        const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
        const createdAt = toZonedTime(new Date(), "America/Costa_Rica");
        const fechaValue = existingObj.fecha instanceof Date ? existingObj.fecha.toISOString() : (typeof existingObj.fecha === 'string' ? existingObj.fecha : null);
        await callDynamicPrisma({
            req,
            data: {
                action: "POST",
                table: "c_cambios_apps_modules",
                operation: "create",
                data: {
                    nombre_tabla: "c_registro_induccion_recorrido",
                    registro_id: idNum,
                    cambios: JSON.stringify([{
                        prop: "__deleted__",
                        before: {
                            id: existingObj.id,
                            empresa_id: existingObj.empresa_id,
                            cliente_id: existingObj.cliente_id,
                            division_id: existingObj.division_id,
                            contrato_id: existingObj.contrato_id,
                            corpo_id: existingObj.corpo_id,
                            puesto_id: existingObj.puesto_id,
                            plaza_id: existingObj.plaza_id,
                            empleado_id: existingObj.empleado_id,
                            fecha: fechaValue,
                            division: existingObj.division,
                            renglon_edificio: existingObj.renglon_edificio,
                            supervisor_cliente: existingObj.supervisor_cliente,
                            supervisor_corporacion: existingObj.supervisor_corporacion,
                            temas_desarrollados: existingObj.temas_desarrollados,
                            aspectos_especificos: existingObj.aspectos_especificos,
                            participantes: existingObj.participantes,
                        },
                        after: null,
                    }]),
                    created_at: createdAt.toISOString(),
                    created_by: createdBy,
                },
            },
        });

        await callDynamicPrisma({
            req,
            data: {
                action: "DELETE",
                table: "c_registro_induccion_recorrido",
                operation: "delete",
                where: { id: idNum },
            },
        });

        return NextResponse.json({
            status: true,
            message: "Registro de inducción y recorrido eliminado correctamente"
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        await reportError(req, "api/induction-tour-record/[id]", "DELETE", 500, errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}

