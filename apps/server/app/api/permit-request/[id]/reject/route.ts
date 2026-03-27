import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { toZonedTime } from "date-fns-tz";
import { sendNotificationByEmployee } from "../../../../../utils/sendNotification";

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
        if (!valid) {
            return NextResponse.json({ status: false, expired, message }, { status: expired ? 401 : 403 });
        }

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
            return NextResponse.json({ status: false, message: "No autorizado para rechazar esta solicitud" }, { status: 403 });
        }

        const estadoActual = String((existing as any)?.estado || "").trim().toLowerCase();
        if (estadoActual !== "pendiente") {
            return NextResponse.json({ status: false, message: "Solo se pueden rechazar solicitudes pendientes" }, { status: 400 });
        }

        const body = await req.json().catch(() => ({}));
        const horaAccion = parseDateInputToDate((body as any)?.hora_accion);
        const nowIso = horaAccion ? horaAccion.toISOString() : toZonedTime(new Date(), "America/Costa_Rica").toISOString();
        const updatedRecord = await callDynamicPrisma({
            req,
            data: {
                action: "UPDATE",
                table: "c_solicitud_permiso",
                operation: "update",
                where: { id: idNum },
                data: {
                    estado: "rechazado",
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
                        { prop: "estado", before: (existing as any)?.estado || null, after: "rechazado" },
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

            // Intentar resolver puesto desde la plaza de la solicitud (fallback a existing.puesto_id).
            const plazaId = Number((existing as any)?.plaza_id || 0);
            let puestoId = Number((existing as any)?.puesto_id || 0);
            if (!puestoId && plazaId) {
                const plaza = await callDynamicPrisma({
                    req,
                    data: {
                        action: "GET",
                        table: "e_estructura_plazas",
                        operation: "findUnique",
                        where: { id: plazaId },
                        select: { puesto_id: true },
                    },
                });
                puestoId = Number((plaza as any)?.puesto_id || 0);
            }
            const puesto = puestoId
                ? await callDynamicPrisma({
                    req,
                    data: {
                        action: "GET",
                        table: "e_estructura_puesto",
                        operation: "findUnique",
                        where: { id: puestoId },
                    },
                })
                : null;

                let sucursalNombre = "Desconocida";
                let clienteNombre = "Desconocido";
                if (puesto) {
                    const sucursal = await callDynamicPrisma({
                        req,
                        data: {
                            action: "GET",
                            table: "e_estructura_sucursal",
                            operation: "findUnique",
                            where: { id: puesto.sucursal_id },
                        },
                    });
                    if (sucursal) {
                        sucursalNombre = sucursal.nombre;
                        const contrato = await callDynamicPrisma({
                            req,
                            data: {
                                action: "GET",
                                table: "e_estructura_contrato",
                                operation: "findUnique",
                                where: { id: sucursal.contrato_id },
                            },
                        });
                        if (contrato) {
                            const cliente = await callDynamicPrisma({
                                req,
                                data: {
                                    action: "GET",
                                    table: "e_estructura_cliente",
                                    operation: "findUnique",
                                    where: { id: contrato.cliente_id },
                                },
                            });
                            if (cliente) {
                                clienteNombre = cliente.nombre;
                            }
                        }
                    }
                }

            const ejecutivoNombre = ejecutivo
                ? `${ejecutivo.nombre ?? ""} ${ejecutivo.primer_apellido ?? ""} ${ejecutivo.segundo_apellido ?? ""}`.trim()
                : `ID ${currentEmployeeId}`;
            const tipoLowercase = String((existing as any)?.tipo || "permiso").toLowerCase();
            const fecha = nowIso.split("T")[0];
            const hora = nowIso.split("T")[1]?.replace("Z", "") || "";
            const solicitanteDisplay = empleadoSolicitante
                ? `${empleadoSolicitante.nombre ?? ""} ${empleadoSolicitante.primer_apellido ?? ""} ${empleadoSolicitante.segundo_apellido ?? ""}`.trim()
                : `ID ${empleadoIdSolicitud}`;

            const fechaDesde = (existing as any)?.fecha_inicio
                ? new Date((existing as any).fecha_inicio).toISOString().split("T")[0]
                : "-";
            const fechaHasta = (existing as any)?.fecha_fin
                ? new Date((existing as any).fecha_fin).toISOString().split("T")[0]
                : "-";
            const puestoNombre = puesto ? (puesto as any).nombre : "Desconocido";

            await sendNotificationByEmployee(
                req,
                0,
                [currentEmployeeId],
                `Solicitud de permiso rechazada`,
                `Tu solicitud de permiso ${tipoLowercase} para el puesto ${puestoNombre} (Sucursal ${sucursalNombre} del cliente ${clienteNombre}) en las fechas desde ${fechaDesde} hasta ${fechaHasta} fue rechazada por ${ejecutivoNombre} el día ${fecha} a las ${hora}. Solicitante: ${solicitanteDisplay}.`,
                [empleadoIdSolicitud]
            ).catch((error) => {
                const msg = error instanceof Error ? error.message : "Error desconocido";
                console.error("Error sending permit-request reject notification:", msg);
            });
        }

        return NextResponse.json({
            status: true,
            message: "Solicitud de permiso rechazada correctamente",
            data: updatedRecord,
        }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}
