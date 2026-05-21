import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";
import { toZonedTime } from "date-fns-tz";
import { createAccionPersonal } from "../../../../utils/createAccionPersonal";
import { sendNotificationByEmployee } from "../../../../utils/sendNotification";

const parseDateInputToDate = (input: unknown): Date | null => {
    if (!input) return null;
    if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
    const s = String(input).trim();
    if (!s) return null;
    const parsed = new Date(s);
    return isNaN(parsed.getTime()) ? null : parsed;
};

export async function PUT(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const idNum = parseInt(String(resolvedParams.id), 10);
        if (!idNum) {
            return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
        }

        const existing = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_solicitud_permiso",
                operation: "findUnique",
                where: { id: idNum },
            },
        });
        if (!existing) {
            return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
        }

        const currentEmployeeId = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
        if (!currentEmployeeId) {
            return NextResponse.json({ status: false, message: "Empleado inválido" }, { status: 400 });
        }

        const empleado = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "c_empleado", operation: "findUnique", where: { id: currentEmployeeId } },
        });
        const myEjecutivoCuentaId = empleado?.supervisor_id ? Number(empleado.supervisor_id) : null;
        const isExecutive =
            Number(existing.ejecutivo_cuenta) === currentEmployeeId ||
            (myEjecutivoCuentaId != null && Number(existing.ejecutivo_cuenta) === myEjecutivoCuentaId);
        if (!isExecutive) {
            return NextResponse.json({ status: false, message: "No autorizado para aprobar esta solicitud" }, { status: 403 });
        }

        const estadoActual = String((existing as any)?.estado || "").trim().toLowerCase();
        if (estadoActual !== "pendiente") {
            return NextResponse.json({ status: false, message: "Solo se pueden aprobar solicitudes pendientes" }, { status: 400 });
        }

        if (existing.firma_ejecutivo_cuenta_digital || existing.firma_ejecutivo_cuenta_manual) {
            return NextResponse.json({ status: false, message: "La solicitud ya fue completada por el ejecutivo" }, { status: 400 });
        }

        const body = await req.json();
        const reemplazoObligatorio = body?.reemplazo_obligatorio !== undefined && body?.reemplazo_obligatorio !== null
            ? Number(body.reemplazo_obligatorio)
            : null;
        const horaAccion = parseDateInputToDate(body?.hora_accion);
        const observaciones = String(body?.observaciones || "").trim();
        const firmaDigital = String(body?.firma_ejecutivo_cuenta_digital || "").trim();
        const firmaManual = String(body?.firma_ejecutivo_cuenta_manual || "").trim();

        if (!firmaDigital || firmaDigital.length < 10 || !firmaManual || firmaManual.length < 10) {
            return NextResponse.json({ status: false, message: "Debes generar firma digital y firma manual del ejecutivo" }, { status: 400 });
        }

        let turnos: any[] = [];
        try {
            turnos = JSON.parse(String(existing.turnos || "[]"));
            if (!Array.isArray(turnos)) turnos = [];
        } catch {
            turnos = [];
        }

        const turnosPayload = Array.isArray(body?.turnos) ? body.turnos : [];
        const byTurnoId = new Map<number, number | null>();
        for (const row of turnosPayload) {
            const turnoId = parseInt(String(row?.id), 10);
            if (!turnoId) continue;
            const replacement = row?.reemplazo_id !== undefined && row?.reemplazo_id !== null
                ? Number(row.reemplazo_id)
                : null;
            byTurnoId.set(turnoId, replacement);
        }

        const turnosUpdated = turnos.map((row: any) => {
            const turnoId = parseInt(String(row?.id), 10);
            const repl = byTurnoId.has(turnoId) ? byTurnoId.get(turnoId) : (row?.reemplazo_id ?? null);
            return {
                ...row,
                reemplazo_id: repl ?? null,
            };
        });
        
        const nowIso = horaAccion ? horaAccion.toISOString() : toZonedTime(new Date(), "America/Costa_Rica").toISOString();

        for (const turno of turnosUpdated) {
            if (!turno.id) continue;

            if (turno.reemplazo_id) {
                const reemplazo = await callDynamicPrisma({
                    req,
                    data: { action: "GET", table: "c_empleado", operation: "findUnique", where: { id: turno.reemplazo_id } },
                });
                if (!reemplazo) continue;
                await callDynamicPrisma({
                    req,
                    data: { action: "UPDATE", table: "c_marca_dia", operation: "update", where: { id: turno.id }, data: { empleadoReemplaza_id: turno.reemplazo_id } },
                });
            }

            // Crear un permiso con goce o sin goce dependiendo del tipo de permiso

            let tipoAccionId = 6;
            let permisoId = null;
            switch (existing.tipo) {
                case "Con goce":
                    tipoAccionId = 6;
                    // Crear un registro con la tabla c_permiso_con_goce
                    const permisoConGoce = await callDynamicPrisma({
                        req,
                        data: { action: "POST", table: "c_permiso_con_goce", operation: "create", data: {} },
                    });
                    if (permisoConGoce) {
                        permisoId = permisoConGoce.id;
                    }
                    break;
                case "Sin goce":
                    tipoAccionId = 7;
                    // Crear un registro con la tabla c_permiso_sin_goce
                    const permisoSinGoce = await callDynamicPrisma({
                        req,
                        data: { action: "POST", table: "c_permiso_sin_goce", operation: "create", data: {} },
                    });
                    if (permisoSinGoce) {
                        permisoId = permisoSinGoce.id;
                    }
                    break;
            }

            let usuario_insercion = empleado.cedula ? (empleado.cedula + " - MonitoreApp") : "MonitoreApp";
            let empleado_ausente = "Desconocido";
            if (existing.empleado_id) {
                const ausente = await callDynamicPrisma({
                    req,
                    data: { action: "GET", table: "c_empleado", operation: "findUnique", where: { id: existing.empleado_id } },
                });
                if (ausente) {
                    empleado_ausente = (ausente.nombre ?? "") + " " + (ausente.primer_apellido ?? "") + " " + (ausente.segundo_apellido ?? "");
                }
            }
            let ejecutivo_nombre = "Desconocido";
            if (currentEmployeeId) {
                const ejecutivo = await callDynamicPrisma({
                    req,
                    data: { action: "GET", table: "c_empleado", operation: "findUnique", where: { id: currentEmployeeId } },
                });
                if (ejecutivo) {
                    ejecutivo_nombre = (ejecutivo.nombre ?? "") + " " + (ejecutivo.primer_apellido ?? "") + " " + (ejecutivo.segundo_apellido ?? "");
                }
            }

            let dateTime_comments = (nowIso.split("T")[0]) + " a las " + (nowIso.split("T")[1].split(".")[0]);
            
            let comentarios = `Permiso solicitado por ${empleado_ausente} y aprobado por ${ejecutivo_nombre} el día ${dateTime_comments} en el sistema MonitoreApp`;
            await createAccionPersonal(req, turno.id, tipoAccionId, permisoId, 0, 0, comentarios, 3, usuario_insercion);
        }

        const updatedRecord = await callDynamicPrisma({
            req,
            data: {
                action: "UPDATE",
                table: "c_solicitud_permiso",
                operation: "update",
                where: { id: idNum },
                data: {
                    reemplazo_obligatorio: reemplazoObligatorio,
                    turnos: JSON.stringify(turnosUpdated),
                    observaciones: observaciones || null,
                    firma_ejecutivo_cuenta_digital: firmaDigital,
                    firma_ejecutivo_cuenta_manual: firmaManual,
                    estado: "aprobado",
                },
            },
        });

        await callDynamicPrisma({
            req,
            data: {
                action: "POST",
                table: "c_cambios_apps_modules",
                operation: "create",
                data: {
                    nombre_tabla: "c_solicitud_permiso",
                    registro_id: idNum,
                    cambios: JSON.stringify([
                        { prop: "reemplazo_obligatorio", before: existing.reemplazo_obligatorio, after: reemplazoObligatorio },
                        { prop: "turnos", before: existing.turnos, after: JSON.stringify(turnosUpdated) },
                        { prop: "firma_ejecutivo_cuenta_digital", before: existing.firma_ejecutivo_cuenta_digital || null, after: firmaDigital },
                        { prop: "firma_ejecutivo_cuenta_manual", before: existing.firma_ejecutivo_cuenta_manual || null, after: firmaManual },
                        { prop: "observaciones", before: (existing as any)?.observaciones || null, after: observaciones || null },
                        { prop: "estado", before: (existing as any)?.estado || null, after: "aprobado" },
                    ]),
                    created_at: nowIso,
                    created_by: currentEmployeeId,
                },
            },
        });

        const empleadoIdSolicitud = Number((existing as any)?.empleado_id || 0);
        if (empleadoIdSolicitud) {
            const empleadoSolicitante = await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "c_empleado",
                    operation: "findUnique",
                    where: { id: empleadoIdSolicitud },
                },
            });
            const ejecutivo = await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "c_empleado",
                    operation: "findUnique",
                    where: { id: currentEmployeeId },
                },
            });

            const ejecutivoNombre = ejecutivo
                ? `${ejecutivo.nombre ?? ""} ${ejecutivo.primer_apellido ?? ""} ${ejecutivo.segundo_apellido ?? ""}`.trim()
                : `ID ${currentEmployeeId}`;
            const tipoLowercase = String((existing as any)?.tipo || "permiso").toLowerCase();
            const fecha = nowIso.split("T")[0];
            const hora = nowIso.split("T")[1]?.replace("Z", "") || "";
            const solicitanteDisplay = empleadoSolicitante
                ? `${empleadoSolicitante.nombre ?? ""} ${empleadoSolicitante.primer_apellido ?? ""} ${empleadoSolicitante.segundo_apellido ?? ""}`.trim()
                : `ID ${empleadoIdSolicitud}`;
                
            const fecha_desde = new Date(existing.fecha_inicio).toISOString().split("T")[0];
            const fecha_hasta = new Date(existing.fecha_fin).toISOString().split("T")[0];

            const plaza = await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "e_estructura_plazas",
                    operation: "findUnique",
                    where: { id: existing.plaza_id },
                },
            });

            let puestoNombre = "Desconocido";
            let sucursalNombre = "Desconocida";
            let clienteNombre = "Desconocido";

            if (plaza) {
                const puesto = await callDynamicPrisma({
                    req,
                    data: {
                        action: "GET",
                        table: "e_estructura_puesto",
                        operation: "findUnique",
                        where: { id: plaza.puesto_id },
                    },
                });
                if (puesto) {
                    puestoNombre = puesto.nombre;
                    const sucursal = await callDynamicPrisma({
                        req,
                        data: { action: "GET", table: "e_estructura_sucursal", operation: "findUnique", where: { id: puesto.sucursal_id } },
                    });
                    if (sucursal) {
                        sucursalNombre = sucursal.nombre;
                        const contrato = await callDynamicPrisma({
                            req,
                            data: { action: "GET", table: "e_estructura_contrato", operation: "findUnique", where: { id: sucursal.contrato_id } },
                        });
                        if (contrato) {
                            const cliente = await callDynamicPrisma({
                                req,
                                data: { action: "GET", table: "e_estructura_cliente", operation: "findUnique", where: { id: contrato.cliente_id } },
                            });
                            if (cliente) {
                                clienteNombre = cliente.nombre;
                            }
                        }
                    }
                }
            }

            await sendNotificationByEmployee(
                req,
                0,
                [currentEmployeeId],
                `Solicitud de permiso aprobada`,
                `Tu solicitud de permiso ${tipoLowercase} para el puesto ${puestoNombre} (Sucursal ${sucursalNombre} del cliente ${clienteNombre}) en las fechas desde ${fecha_desde} hasta ${fecha_hasta} fue aprobada por ${ejecutivoNombre} el día ${fecha} a las ${hora}. Solicitante: ${solicitanteDisplay}.`,
                [empleadoIdSolicitud]
            ).catch((error) => {
                const msg = error instanceof Error ? error.message : "Error desconocido";
                console.error("Error sending permit-request approval notification:", msg);
            });
        }

        return NextResponse.json({
            status: true,
            message: "Solicitud de permiso completada correctamente",
            data: updatedRecord
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
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const { id } = resolvedParams;
        const idNum = parseInt(id, 10);
        if (!idNum) {
            return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
        }

        const existing = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_solicitud_permiso",
                operation: "findUnique",
                where: { id: idNum },
            },
        });
        if (!existing) {
            return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
        }

        const currentEmployeeId = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
        if (!currentEmployeeId || Number(existing.empleado_id) !== Number(currentEmployeeId)) {
            return NextResponse.json({ status: false, message: "Solo el creador puede eliminar la solicitud" }, { status: 403 });
        }

        if (existing.firma_ejecutivo_cuenta_digital || existing.firma_ejecutivo_cuenta_manual) {
            return NextResponse.json({ status: false, message: "No se puede eliminar una solicitud ya completada" }, { status: 400 });
        }

        // Registrar cambio de eliminación antes de eliminar
        const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
        const createdAt = toZonedTime(new Date(), "America/Costa_Rica");
        await callDynamicPrisma({
            req,
            data: {
                action: "POST",
                table: "c_cambios_apps_modules",
                operation: "create",
                data: {
                    nombre_tabla: "c_solicitud_permiso",
                    registro_id: idNum,
                    cambios: JSON.stringify([{
                        prop: "__deleted__",
                        before: existing,
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
                table: "c_solicitud_permiso",
                operation: "delete",
                where: { id: idNum },
            },
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

