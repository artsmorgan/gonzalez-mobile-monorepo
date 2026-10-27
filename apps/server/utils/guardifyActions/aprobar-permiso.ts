import { auditUpdateFields } from "../auditFields";
import { fail, nombreCompleto, parseDateInput, type ActionEnv, type ActionHttp } from "./env";
import { esEjecutivoDelPermiso } from "./permisos";

/**
 * Aprueba una solicitud de permiso (misma lógica que `PUT /api/permit-request/[id]`; esa ruta ahora llama a esta función): crea el permiso en
 * Planillas por cada turno (o uno solo si el reemplazo es igual en todos) con el token de Planillas del ejecutivo, y luego marca la solicitud
 * como aprobada con sus firmas, deja la bitácora y notifica al solicitante. Mensajes y estados HTTP idénticos a los de la ruta original.
 */
export async function aprobarPermisoSolicitud(
    env: ActionEnv,
    input: { id: number; actorId: number; payload: { id?: unknown }; body: any; planillasToken: string | null; extraCambios?: { prop: string; before: unknown; after: unknown }[] },
): Promise<ActionHttp> {
    const { id: idNum, actorId: currentEmployeeId, payload, body, planillasToken } = input;
    if (!planillasToken) {
        await env.report(400, "Token de Planillas no encontrado");
        return fail(400, "planillas_session_required", "Token de Planillas no encontrado");
    }

    const existing = await env.call({ action: "GET", table: "c_solicitud_permiso", operation: "findUnique", where: { id: idNum } });
    if (!existing) {
        await env.report(404, "Registro no encontrado");
        return fail(404, "not_found", "Registro no encontrado");
    }
    if (!currentEmployeeId) {
        await env.report(400, "Empleado inválido");
        return fail(400, "invalid_request", "Empleado inválido");
    }

    const empleado = await env.prisma.c_empleado.findUnique({ where: { id: currentEmployeeId } });
    const myEjecutivoCuentaId = empleado?.supervisor_id ? Number(empleado.supervisor_id) : null;
    if (!esEjecutivoDelPermiso(existing, currentEmployeeId, myEjecutivoCuentaId)) {
        await env.report(400, "No autorizado para aprobar esta solicitud");
        return fail(400, "out_of_scope", "No autorizado para aprobar esta solicitud");
    }

    const estadoActual = String((existing as any)?.estado || "").trim().toLowerCase();
    if (estadoActual !== "pendiente") {
        await env.report(400, "Solo se pueden aprobar solicitudes pendientes");
        return fail(400, estadoActual === "rechazado" || estadoActual === "aprobado" ? "already_resolved" : "invalid_state", "Solo se pueden aprobar solicitudes pendientes");
    }

    if (existing.firma_ejecutivo_cuenta_digital || existing.firma_ejecutivo_cuenta_manual) {
        await env.report(400, "La solicitud ya fue completada por el ejecutivo");
        return fail(400, "already_resolved", "La solicitud ya fue completada por el ejecutivo");
    }

    const reemplazoObligatorio = body?.reemplazo_obligatorio !== undefined && body?.reemplazo_obligatorio !== null ? Number(body.reemplazo_obligatorio) : null;
    const horaAccion = parseDateInput(body?.hora_accion);
    const observaciones = String(body?.observaciones || "").trim();
    const firmaDigital = String(body?.firma_ejecutivo_cuenta_digital || "").trim();
    const firmaManual = String(body?.firma_ejecutivo_cuenta_manual || "").trim();

    if (!firmaDigital || firmaDigital.length < 10 || !firmaManual || firmaManual.length < 10) {
        await env.report(400, "Debes generar firma digital y firma manual del ejecutivo");
        return fail(400, "signature_required", "Debes generar firma digital y firma manual del ejecutivo");
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
        const replacement = row?.reemplazo_id !== undefined && row?.reemplazo_id !== null ? Number(row.reemplazo_id) : null;
        byTurnoId.set(turnoId, replacement);
    }

    const turnosUpdated = turnos.map((row: any) => {
        const turnoId = parseInt(String(row?.id), 10);
        const repl = byTurnoId.has(turnoId) ? byTurnoId.get(turnoId) : (row?.reemplazo_id ?? null);
        return { ...row, reemplazo_id: repl ?? null };
    });

    const nowIso = env.nowIso(horaAccion);

    // Función para definir si las propiedades "reemplazo_id" son todas iguales o hay diferencias entre sí
    const allReplacementsEqual = turnosUpdated.every((turno) => turno.reemplazo_id === turnosUpdated[0].reemplazo_id);

    if (allReplacementsEqual) {
        const result = await crearPermisoEnPlanillas(env, planillasToken, turnosUpdated[0], existing, allReplacementsEqual);
        if (!result) {
            await env.report(500, "Error al crear el permiso en Planillas");
            return fail(500, "invalid_request", "Error al crear el permiso en Planillas");
        }
    } else {
        for (const turno of turnosUpdated) {
            const result = await crearPermisoEnPlanillas(env, planillasToken, turno, existing, allReplacementsEqual);
            if (!result) {
                await env.report(500, "Error al crear el permiso en Planillas");
                return fail(500, "invalid_request", "Error al crear el permiso en Planillas");
            }
        }
    }

    const updatedRecord = await env.call({
        action: "UPDATE",
        table: "c_solicitud_permiso",
        operation: "update",
        where: { id: idNum },
        data: {
            ...auditUpdateFields(payload, ["updated_at", "updated_by"]),
            reemplazo_obligatorio: reemplazoObligatorio,
            turnos: JSON.stringify(turnosUpdated),
            observaciones: observaciones || null,
            firma_ejecutivo_cuenta_digital: firmaDigital,
            firma_ejecutivo_cuenta_manual: firmaManual,
            estado: "aprobado",
        },
    });

    await env.call({
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
                ...(input.extraCambios ?? []),
            ]),
            created_at: nowIso,
            created_by: currentEmployeeId,
        },
    });

    const empleadoIdSolicitud = Number((existing as any)?.empleado_id || 0);
    if (empleadoIdSolicitud) {
        const empleadoSolicitante = await env.prisma.c_empleado.findUnique({ where: { id: empleadoIdSolicitud } });
        const ejecutivo = await env.prisma.c_empleado.findUnique({ where: { id: currentEmployeeId } });

        const ejecutivoNombre = nombreCompleto(ejecutivo, `ID ${currentEmployeeId}`);
        const tipoLowercase = String((existing as any)?.tipo || "permiso").toLowerCase();
        const fecha = nowIso.split("T")[0];
        const hora = nowIso.split("T")[1]?.replace("Z", "") || "";
        const solicitanteDisplay = nombreCompleto(empleadoSolicitante, `ID ${empleadoIdSolicitud}`);

        const fecha_desde = new Date(existing.fecha_inicio).toISOString().split("T")[0];
        const fecha_hasta = new Date(existing.fecha_fin).toISOString().split("T")[0];

        const plaza = await env.prisma.e_estructura_plazas.findUnique({ where: { id: existing.plaza_id } });

        let puestoNombre = "Desconocido";
        let sucursalNombre = "Desconocida";
        let clienteNombre = "Desconocido";

        if (plaza) {
            const puesto = await env.prisma.e_estructura_puesto.findUnique({ where: { id: Number(plaza.puesto_id) } });
            if (puesto) {
                puestoNombre = puesto.nombre;
                const sucursal = await env.prisma.e_estructura_sucursal.findUnique({ where: { id: Number(puesto.sucursal_id) } });
                if (sucursal) {
                    sucursalNombre = sucursal.nombre;
                    const contrato = await env.prisma.e_estructura_contrato.findUnique({ where: { id: Number(sucursal.contrato_id) } });
                    if (contrato) {
                        const cliente = await env.prisma.e_estructura_cliente.findUnique({ where: { id: Number(contrato.cliente_id) } });
                        if (cliente) clienteNombre = cliente.nombre;
                    }
                }
            }
        }

        await env
            .notify(
                `Solicitud de permiso aprobada`,
                `Tu solicitud de permiso ${tipoLowercase} para el puesto ${puestoNombre} (Sucursal ${sucursalNombre} del cliente ${clienteNombre}) en las fechas desde ${fecha_desde} hasta ${fecha_hasta} fue aprobada por ${ejecutivoNombre} el día ${fecha} a las ${hora}. Solicitante: ${solicitanteDisplay}.`,
                [empleadoIdSolicitud],
                [currentEmployeeId],
            )
            .catch((error: unknown) => {
                const msg = error instanceof Error ? error.message : "Error desconocido";
                console.error("Error sending permit-request approval notification:", msg);
            });
    }

    return { ok: true, status: 200, body: { status: true, message: "Solicitud de permiso completada correctamente", data: updatedRecord } };
}

/** Crea en Planillas el permiso de un turno (con goce o sin goce). Devuelve `false`/`undefined` si no se pudo, igual que la función original de la ruta. */
export async function crearPermisoEnPlanillas(env: ActionEnv, planillasToken: string, turno: any, existing: any, allReplacementsEqual: boolean): Promise<boolean | undefined> {
    if (!turno.id) return;

    if (turno.reemplazo_id) {
        const reemplazo = await env.prisma.c_empleado.findUnique({ where: { id: turno.reemplazo_id } });
        if (!reemplazo) return;
    }

    // Crear un permiso con goce o sin goce dependiendo del tipo de permiso
    const tipoPermiso = existing.tipo == "Con goce" ? "PCG" : "PSG";

    let ejecutivoCuentaCoordinadorId = 0;

    const corpo = await env.prisma.e_estructura_sucursal.findUnique({ where: { id: existing.corpo_id } });
    if (corpo) {
        if (corpo.ejecutivoCuenta_id) {
            const ejecutivoCuentaCoordinador = await env.call({ action: "GET", table: "n_ejecutivo_cuenta_coordinador", operation: "findFirst", where: { ejecutivo_cuenta_id: corpo.ejecutivoCuenta_id } });
            if (ejecutivoCuentaCoordinador) ejecutivoCuentaCoordinadorId = ejecutivoCuentaCoordinador.coordinador_id;
        }
    }

    let fechaInicio = existing.fecha_inicio.split("T")[0];
    let fechaFin = existing.fecha_fin.split("T")[0];

    if (!allReplacementsEqual) {
        const marca = await env.prisma.c_marca_dia.findFirst({ where: { id: turno.id } });
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

    const planillasResponse = await env.planillas("/acciones/permisos", body, planillasToken);
    return planillasResponse.success ? true : false;
}

