import { auditUpdateFields } from "../auditFields";
import { fail, nombreCompleto, type ActionEnv, type ActionHttp } from "./env";

/** Un permiso que el actor puede resolver: es el ejecutivo de cuenta de la solicitud, o su supervisor lo es (regla de la app). */
export function esEjecutivoDelPermiso(existing: { ejecutivo_cuenta?: unknown }, actorId: number, supervisorDelActor: number | null): boolean {
    return Number(existing.ejecutivo_cuenta) === actorId || (supervisorDelActor != null && Number(existing.ejecutivo_cuenta) === supervisorDelActor);
}

/**
 * Qué acciones de Guardify se ofrecen sobre un permiso, para ESTE actor: `aprobar` (si nadie lo firmó ya) y `rechazar`, solo si está pendiente y le toca
 * resolverlo. Que haya un token de Planillas vigente se comprueba al ejecutar `aprobar`, no aquí.
 */
export function accionesDePermiso(existing: { estado?: unknown; ejecutivo_cuenta?: unknown; firma_ejecutivo_cuenta_digital?: unknown; firma_ejecutivo_cuenta_manual?: unknown }, actorId: number, supervisorDelActor: number | null): string[] {
    const pendiente = String(existing.estado || "").trim().toLowerCase() === "pendiente";
    if (!pendiente || !esEjecutivoDelPermiso(existing, actorId, supervisorDelActor)) return [];
    const firmado = !!(existing.firma_ejecutivo_cuenta_digital || existing.firma_ejecutivo_cuenta_manual);
    return firmado ? ["rechazar"] : ["aprobar", "rechazar"];
}

/**
 * Rechaza una solicitud de permiso (misma lógica que `PUT /api/permit-request/[id]/reject`; esa ruta ahora llama a esta función).
 * Mensajes y estados HTTP idénticos a los de la ruta original.
 */
export async function rechazarPermisoSolicitud(env: ActionEnv, input: { id: number; actorId: number; payload: { id?: unknown }; body: any, extraCambios?: { prop: string; before: unknown; after: unknown }[] }): Promise<ActionHttp> {
    const { id: idNum, actorId: currentEmployeeId, payload } = input;
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
        await env.report(400, "No autorizado para rechazar esta solicitud");
        return fail(400, "out_of_scope", "No autorizado para rechazar esta solicitud");
    }

    const estadoActual = String((existing as any)?.estado || "").trim().toLowerCase();
    if (estadoActual !== "pendiente") {
        await env.report(400, "Solo se pueden rechazar solicitudes pendientes");
        return fail(400, estadoActual === "rechazado" || estadoActual === "aprobado" ? "already_resolved" : "invalid_state", "Solo se pueden rechazar solicitudes pendientes");
    }

    const nowIso = env.nowIso(input.body?.hora_accion ? parseHora(input.body.hora_accion) : null);
    const updatedRecord = await env.call({
        action: "UPDATE",
        table: "c_solicitud_permiso",
        operation: "update",
        where: { id: idNum },
        data: { ...auditUpdateFields(payload, ["updated_at", "updated_by"]), estado: "rechazado" },
    });

    await env.call({
        action: "POST",
        table: "c_cambios_apps_modules",
        operation: "create",
        data: {
            nombre_tabla: "c_solicitud_permiso",
            registro_id: idNum,
            cambios: JSON.stringify([{ prop: "estado", before: (existing as any)?.estado || null, after: "rechazado" }, ...(input.extraCambios ?? [])]),
            created_at: nowIso,
            created_by: currentEmployeeId,
        },
    });

    const empleadoIdSolicitud = Number((existing as any)?.empleado_id || 0);
    if (empleadoIdSolicitud) {
        const empleadoSolicitante = await env.prisma.c_empleado.findUnique({ where: { id: empleadoIdSolicitud } });
        const ejecutivo = await env.prisma.c_empleado.findUnique({ where: { id: currentEmployeeId } });

        // Intentar resolver puesto desde la plaza de la solicitud (fallback a existing.puesto_id).
        const plazaId = Number((existing as any)?.plaza_id || 0);
        let puestoId = Number((existing as any)?.puesto_id || 0);
        if (!puestoId && plazaId) {
            const plaza = await env.prisma.e_estructura_plazas.findUnique({ where: { id: plazaId }, select: { puesto_id: true } });
            puestoId = Number(plaza?.puesto_id || 0);
        }

        const puesto = puestoId ? await env.prisma.e_estructura_puesto.findUnique({ where: { id: puestoId } }) : null;

        let sucursalNombre = "Desconocida";
        let clienteNombre = "Desconocido";
        if (puesto && puesto.sucursal_id) {
            const sucursal = await env.prisma.e_estructura_sucursal.findUnique({ where: { id: puesto.sucursal_id } });
            if (sucursal && sucursal.contrato_id) {
                sucursalNombre = sucursal.nombre;
                const contrato = await env.prisma.e_estructura_contrato.findUnique({ where: { id: sucursal.contrato_id } });
                if (contrato && contrato.cliente_id) {
                    const cliente = await env.prisma.e_estructura_cliente.findUnique({ where: { id: contrato.cliente_id } });
                    if (cliente) clienteNombre = cliente.nombre;
                }
            }
        }

        const ejecutivoNombre = nombreCompleto(ejecutivo, `ID ${currentEmployeeId}`);
        const tipoLowercase = String((existing as any)?.tipo || "permiso").toLowerCase();
        const fecha = nowIso.split("T")[0];
        const hora = nowIso.split("T")[1]?.replace("Z", "") || "";
        const solicitanteDisplay = nombreCompleto(empleadoSolicitante, `ID ${empleadoIdSolicitud}`);
        const fechaDesde = (existing as any)?.fecha_inicio ? new Date((existing as any).fecha_inicio).toISOString().split("T")[0] : "-";
        const fechaHasta = (existing as any)?.fecha_fin ? new Date((existing as any).fecha_fin).toISOString().split("T")[0] : "-";
        const puestoNombre = puesto ? (puesto as any).nombre : "Desconocido";

        await env
            .notify(
                `Solicitud de permiso rechazada`,
                `Tu solicitud de permiso ${tipoLowercase} para el puesto ${puestoNombre} (Sucursal ${sucursalNombre} del cliente ${clienteNombre}) en las fechas desde ${fechaDesde} hasta ${fechaHasta} fue rechazada por ${ejecutivoNombre} el día ${fecha} a las ${hora}. Solicitante: ${solicitanteDisplay}.`,
                [empleadoIdSolicitud],
                [currentEmployeeId],
            )
            .catch((error: unknown) => {
                const msg = error instanceof Error ? error.message : "Error desconocido";
                console.error("Error sending permit-request reject notification:", msg);
            });
    }

    return { ok: true, status: 200, body: { status: true, message: "Solicitud de permiso rechazada correctamente", data: updatedRecord } };
}

const parseHora = (v: unknown): Date | null => {
    const s = String(v ?? "").trim();
    if (!s) return null;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
};
