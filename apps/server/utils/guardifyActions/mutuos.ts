import { parseMarcaIdsArray, ymdFromFecha } from "../mutuosAcuerdosMarcas";
import { fail, nombreCompleto, type ActionEnv, type ActionHttp } from "./env";

/** Quien puede rechazar un mutuo acuerdo: el supervisor del actor es el ejecutivo de cuenta del acuerdo (regla de la app). */
export function puedeRechazarMutuo(existing: { ejecutivo_cuenta?: unknown }, supervisorDelActor: number | null): boolean {
    return supervisorDelActor !== null && Number(supervisorDelActor) === Number(existing.ejecutivo_cuenta);
}

/**
 * Acciones de Guardify sobre un mutuo acuerdo, para ESTE actor: `aprobar` (si el ejecutivo no lo firmó ya) y `rechazar`, solo si está pendiente, ambos
 * empleados aceptaron y le toca resolverlo. Que haya un token de Planillas vigente se comprueba al ejecutar `aprobar`, no aquí.
 */
export function accionesDeMutuo(existing: { estado?: unknown; ejecutivo_cuenta?: unknown; ausente_acepta?: unknown; reemplaza_acepta?: unknown; firma_ejecutivo_cuenta_digital?: unknown; firma_ejecutivo_cuenta_manual?: unknown }, supervisorDelActor: number | null): string[] {
    const pendiente = (String(existing.estado || "").trim().toLowerCase() || "pendiente") === "pendiente";
    if (!pendiente || !puedeRechazarMutuo(existing, supervisorDelActor) || !existing.ausente_acepta || !existing.reemplaza_acepta) return [];
    const firmado = !!(existing.firma_ejecutivo_cuenta_digital || existing.firma_ejecutivo_cuenta_manual);
    return firmado ? ["rechazar"] : ["aprobar", "rechazar"];
}

/**
 * Rechaza un mutuo acuerdo (misma lógica que `PUT /api/mutuos-acuerdos/[id]/reject`; esa ruta ahora llama a esta función).
 * Mensajes y estados HTTP idénticos a los de la ruta original.
 */
export async function rechazarMutuoAcuerdo(env: ActionEnv, input: { id: number; actorId: number; horaAccion: Date | null, extraCambios?: { prop: string; before: unknown; after: unknown }[] }): Promise<ActionHttp> {
    const { id: idNum, actorId: currentEmployeeId } = input;
    const existing = await env.call({ action: "GET", table: "e_mutuos_acuerdos", operation: "findUnique", where: { id: idNum } });
    if (!existing) {
        await env.report(404, "Registro no encontrado");
        return fail(404, "not_found", "Registro no encontrado");
    }

    const estadoActual = String((existing as any)?.estado || "").trim().toLowerCase() || "pendiente";
    if (estadoActual !== "pendiente") {
        await env.report(400, "Solo se puede rechazar un mutuo acuerdo pendiente");
        return fail(400, estadoActual === "rechazado" || estadoActual === "aprobado" ? "already_resolved" : "invalid_state", "Solo se puede rechazar un mutuo acuerdo pendiente");
    }

    if (!currentEmployeeId) {
        await env.report(400, "Empleado inválido");
        return fail(400, "invalid_request", "Empleado inválido");
    }

    const empleado = await env.prisma.c_empleado.findUnique({ where: { id: currentEmployeeId } });
    const myEjecutivoCuentaId = empleado?.supervisor_id ?? null;
    if (!puedeRechazarMutuo(existing, myEjecutivoCuentaId)) {
        await env.report(400, "No autorizado para rechazar este mutuo acuerdo");
        return fail(400, "out_of_scope", "No autorizado para rechazar este mutuo acuerdo");
    }

    if (!existing.ausente_acepta || !existing.reemplaza_acepta) {
        await env.report(400, "Ambos empleados deben aceptar antes de rechazar");
        return fail(400, "invalid_state", "Ambos empleados deben aceptar antes de rechazar");
    }

    const updated = await env.call({ action: "UPDATE", table: "e_mutuos_acuerdos", where: { id: idNum }, data: { estado: "rechazado" } });

    const now = env.nowIso(input.horaAccion);
    await env.call({
        action: "POST",
        table: "c_cambios_apps_modules",
        data: {
            nombre_tabla: "e_mutuos_acuerdos",
            registro_id: idNum,
            cambios: JSON.stringify([{ prop: "estado", before: (existing as any)?.estado || null, after: "rechazado" }, ...(input.extraCambios ?? [])]),
            created_at: now,
            created_by: currentEmployeeId,
        },
    });

    const empleadoAusenteId = Number((existing as any)?.empleadoAusente_id || 0);
    const empleadoReemplazaId = Number((existing as any)?.empleadoReemplaza_id || 0);
    const recipients = Array.from(new Set([empleadoAusenteId, empleadoReemplazaId].filter((x) => Number(x) > 0)));
    if (recipients.length > 0) {
        const p = env.prisma;
        const [empleadoAusente, empleadoReemplaza, ejecutivo, marcaAusenteNotif, marcaReemplazaNotif] = await Promise.all([
            empleadoAusenteId ? p.c_empleado.findUnique({ where: { id: empleadoAusenteId } }) : null,
            empleadoReemplazaId ? p.c_empleado.findUnique({ where: { id: empleadoReemplazaId } }) : null,
            p.c_empleado.findUnique({ where: { id: currentEmployeeId } }),
            (() => {
                const id = parseMarcaIdsArray((existing as any)?.marcas_ausente ?? (existing as any)?.marcaDiaAusente_id)[0];
                return id ? p.c_marca_dia.findUnique({ where: { id } }) : Promise.resolve(null);
            })(),
            (() => {
                const id = parseMarcaIdsArray((existing as any)?.marcas_reemplaza ?? (existing as any)?.marcaDiaReemplaza_id)[0];
                return id ? p.c_marca_dia.findUnique({ where: { id } }) : Promise.resolve(null);
            })(),
        ]);
        const [puestoAusente, puestoReemplaza] = await Promise.all([
            (marcaAusenteNotif as any)?.puesto_id ? p.e_estructura_puesto.findUnique({ where: { id: Number((marcaAusenteNotif as any)?.puesto_id) } }) : null,
            (marcaReemplazaNotif as any)?.puesto_id ? p.e_estructura_puesto.findUnique({ where: { id: Number((marcaReemplazaNotif as any)?.puesto_id) } }) : null,
        ]);
        const [sucursalAusente, sucursalReemplaza] = await Promise.all([
            (marcaAusenteNotif as any)?.corpo_id ? p.e_estructura_sucursal.findUnique({ where: { id: Number((marcaAusenteNotif as any)?.corpo_id) } }) : null,
            (marcaReemplazaNotif as any)?.corpo_id ? p.e_estructura_sucursal.findUnique({ where: { id: Number((marcaReemplazaNotif as any)?.corpo_id) } }) : null,
        ]);
        const [clienteAusente, clienteReemplaza] = await Promise.all([
            (marcaAusenteNotif as any)?.cliente_id ? p.e_estructura_cliente.findUnique({ where: { id: Number((marcaAusenteNotif as any)?.cliente_id) } }) : null,
            (marcaReemplazaNotif as any)?.cliente_id ? p.e_estructura_cliente.findUnique({ where: { id: Number((marcaReemplazaNotif as any)?.cliente_id) } }) : null,
        ]);

        const ausenteNombre = nombreCompleto(empleadoAusente, `ID ${empleadoAusenteId}`);
        const reemplazaNombre = nombreCompleto(empleadoReemplaza, `ID ${empleadoReemplazaId}`);
        const ejecutivoNombre = nombreCompleto(ejecutivo, `ID ${currentEmployeeId}`);
        const ausenteCedula = String((empleadoAusente as any)?.cedula ?? "");
        const reemplazaCedula = String((empleadoReemplaza as any)?.cedula ?? "");
        const fecha = now.split("T")[0];
        const hora = now.split("T")[1]?.replace("Z", "") || "";
        const fechaAusente =
            ymdFromFecha((existing as any)?.fecha_ausente) ||
            ((marcaAusenteNotif as any)?.fecha ? new Date((marcaAusenteNotif as any).fecha).toISOString().split("T")[0] : "-Sin fecha-");
        const fechaReemplaza =
            ymdFromFecha((existing as any)?.fecha_reemplaza) ||
            ((marcaReemplazaNotif as any)?.fecha ? new Date((marcaReemplazaNotif as any).fecha).toISOString().split("T")[0] : "-Sin fecha-");
        const horaInicioAusente = (marcaAusenteNotif as any)?.hora_inicio ? new Date((marcaAusenteNotif as any).hora_inicio).toISOString().split("T")[1].split(".")[0] : "-Sin hora-";
        const horaInicioReemplaza = (marcaReemplazaNotif as any)?.hora_inicio ? new Date((marcaReemplazaNotif as any).hora_inicio).toISOString().split("T")[1].split(".")[0] : "-Sin hora-";
        const puestoNombreAusente = (puestoAusente as any)?.nombre || "Desconocido";
        const puestoNombreReemplaza = (puestoReemplaza as any)?.nombre || "Desconocido";
        const sucursalNombreAusente = (sucursalAusente as any)?.nombre || "Desconocida";
        const sucursalNombreReemplaza = (sucursalReemplaza as any)?.nombre || "Desconocida";
        const clienteNombreAusente = (clienteAusente as any)?.nombre || "Desconocido";
        const clienteNombreReemplaza = (clienteReemplaza as any)?.nombre || "Desconocido";

        await env
            .notify(
                `Mutuo acuerdo rechazado`,
                `El mutuo acuerdo fue rechazado por ${ejecutivoNombre} el día ${fecha} a las ${hora}. El empleado ${ausenteNombre} (cédula ${ausenteCedula || "N/A"}) acordó cambiar el turno del día ${fechaAusente} a las ${horaInicioAusente} para el puesto ${puestoNombreAusente} (Sucursal ${sucursalNombreAusente} del cliente ${clienteNombreAusente}) por el turno del día ${fechaReemplaza} a las ${horaInicioReemplaza} para el puesto ${puestoNombreReemplaza} (Sucursal ${sucursalNombreReemplaza} del cliente ${clienteNombreReemplaza}) del empleado ${reemplazaNombre} (cédula ${reemplazaCedula || "N/A"}).`,
                recipients,
                [currentEmployeeId],
            )
            .catch((error: unknown) => {
                const msg = error instanceof Error ? error.message : "Error desconocido";
                console.error("Error sending mutuos-acuerdos reject notification:", msg);
            });
    }

    return { ok: true, status: 200, body: { status: true, message: "Mutuo acuerdo rechazado correctamente", data: { id: updated.id, estado: "rechazado" } } };
}
