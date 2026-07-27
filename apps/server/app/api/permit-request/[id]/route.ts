import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";
import { prisma } from "../../../../utils/prismaClient";
import { toZonedTime } from "date-fns-tz";
import { sendNotificationByEmployee } from "../../../../utils/sendNotification";
import axios from "axios";

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

        const planillasToken = decodeURIComponent(req.headers.get('Planillas-Token') ?? '') || null;
        if (!planillasToken) {
            return NextResponse.json({ status: false, message: "Token de Planillas no encontrado" }, { status: 200 });
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

        const empleado = await prisma.c_empleado.findUnique({ where: { id: currentEmployeeId } });
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

        // Función para definir si las propiedades "reemplazo_id" son todas iguales o hay diferencias entre sí
        const areAllReplacementsEqual = (turnos: any[]) => {
            return turnos.every(turno => turno.reemplazo_id === turnos[0].reemplazo_id);
        };

        const allReplacementsEqual = areAllReplacementsEqual(turnosUpdated);

        if (allReplacementsEqual) {
            const firstTurno = turnosUpdated[0];
            const result = await createPermisoInPlanillas(req, planillasToken, firstTurno, existing, allReplacementsEqual);
            if (!result) {
                return NextResponse.json({ status: false, message: "Error al crear el permiso en Planillas" }, { status: 200 });
            }
        }
        else {
            for (const turno of turnosUpdated) {
                const result = await createPermisoInPlanillas(req, planillasToken, turno, existing, allReplacementsEqual);
                if (!result) {
                    return NextResponse.json({ status: false, message: "Error al crear el permiso en Planillas" }, { status: 200 });
                }
            }
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
            const empleadoSolicitante = await prisma.c_empleado.findUnique({ where: { id: empleadoIdSolicitud } });
            const ejecutivo = await prisma.c_empleado.findUnique({ where: { id: currentEmployeeId } });

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

            const plaza = await prisma.e_estructura_plazas.findUnique({ where: { id: existing.plaza_id } });

            let puestoNombre = "Desconocido";
            let sucursalNombre = "Desconocida";
            let clienteNombre = "Desconocido";

            if (plaza) {
                const puesto = await prisma.e_estructura_puesto.findUnique({ where: { id: Number(plaza.puesto_id) } });
                if (puesto) {
                    puestoNombre = puesto.nombre;
                    const sucursal = await prisma.e_estructura_sucursal.findUnique({ where: { id: Number(puesto.sucursal_id) } });
                    if (sucursal) {
                        sucursalNombre = sucursal.nombre;
                        const contrato = await prisma.e_estructura_contrato.findUnique({ where: { id: Number(sucursal.contrato_id) } });
                        if (contrato) {
                            const cliente = await prisma.e_estructura_cliente.findUnique({ where: { id: Number(contrato.cliente_id) } });
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

const createPermisoInPlanillas = async (req: NextRequest, planillasToken: string, turno: any, existing: any, allReplacementsEqual: boolean) => {
    if (!turno.id) return;

    if (turno.reemplazo_id) {
        const reemplazo = await prisma.c_empleado.findUnique({ where: { id: turno.reemplazo_id } });
        if (!reemplazo) return;
    }

    // Crear un permiso con goce o sin goce dependiendo del tipo de permiso

    let tipoPermiso = existing.tipo == "Con goce" ? "PCG" : "PSG";

    let ejecutivoCuentaCoordinadorId = 0;

    const corpo = await prisma.e_estructura_sucursal.findUnique({ where: { id: existing.corpo_id } });
    if (corpo) {
        if (corpo.ejecutivoCuenta_id) {
            const ejecutivo_cuenta_coordinador = await callDynamicPrisma({
              req,
              data: { action: "GET", table: "n_ejecutivo_cuenta_coordinador", operation: "findFirst", where: { ejecutivo_cuenta_id: corpo.ejecutivoCuenta_id } },
            });
            if (ejecutivo_cuenta_coordinador) {
                ejecutivoCuentaCoordinadorId = ejecutivo_cuenta_coordinador.coordinador_id;
            }
        }
    }

    let fechaInicio = existing.fecha_inicio.split("T")[0];
    let fechaFin = existing.fecha_fin.split("T")[0];

    if (!allReplacementsEqual) {
        const marca = await prisma.c_marca_dia.findFirst({ where: { id: turno.id } });
        if (marca) {
            fechaInicio = marca.fecha.toISOString().split("T")[0];
            fechaFin = marca.fecha.toISOString().split("T")[0];
        }
    }

    const body = {
        tipo: tipoPermiso,
        empleado_id: existing.empleado_id,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        comentarios: existing.observaciones,
        reemplazo_id: turno.reemplazo_id,
        coordinado_por_id: 3,
        coordinador_id: ejecutivoCuentaCoordinadorId,
      };

      console.log(body);
              
      const planillasResponse = await axios.post(`${process.env.PLANILLAS_URL}/acciones/permisos`, body, { 
          headers: {
              "Authorization": `Bearer ${planillasToken}`,
              "Content-Type": "application/json"
          }
      });

      if (!planillasResponse.data.success) {
        return false;
      }

      return true;
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

