import { parseMarcaIdsArray, ymdFromFecha } from "../mutuosAcuerdosMarcas";
import { fail, nombreCompleto, type ActionEnv, type ActionHttp } from "./env";
import { puedeRechazarMutuo } from "./mutuos";

/**
 * Aprueba un mutuo acuerdo con las dos firmas del ejecutivo (misma lógica que `PUT /api/mutuos-acuerdos/[id]/firma-ejecutivo`; esa ruta ahora llama a
 * esta función): marca el acuerdo como aprobado, crea el cambio de guardia en Planillas con el token de Planillas del ejecutivo, guarda su id,
 * deja la bitácora y notifica a los dos empleados. Mensajes y estados HTTP idénticos a los de la ruta original.
 *
 * Ojo (comportamiento heredado de la ruta): el acuerdo queda `aprobado` ANTES de crear el cambio de guardia; si Planillas lo rechaza, el acuerdo ya
 * está aprobado y la persona ve el error. Por eso las acciones de Guardify comprueban el token de Planillas antes de llamar.
 */
export async function aprobarMutuoAcuerdo(
    env: ActionEnv,
    input: { id: number; actorId: number; firmaDigital: string; firmaManual: string; horaAccion: Date | null; planillasToken: string | null; extraCambios?: { prop: string; before: unknown; after: unknown }[] },
): Promise<ActionHttp> {
    const { id: idNum, actorId: currentEmployeeId, horaAccion, planillasToken } = input;
    if (!planillasToken) {
        await env.report(400, "Token de Planillas no encontrado");
        return fail(400, "planillas_session_required", "Token de Planillas no encontrado");
    }

    const firmaDigital = String(input.firmaDigital || "").trim();
    const firmaManual = String(input.firmaManual || "").trim();
    if (!firmaDigital || firmaDigital.length < 10 || !firmaManual || firmaManual.length < 10) {
        await env.report(400, "Se requiere la firma digital y la firma manual del ejecutivo");
        return fail(400, "signature_required", "Se requiere la firma digital y la firma manual del ejecutivo");
    }

    const existing = await env.call({ action: "GET", table: "e_mutuos_acuerdos", operation: "findUnique", where: { id: idNum } });
    if (!existing) {
        await env.report(404, "Registro no encontrado");
        return fail(404, "not_found", "Registro no encontrado");
    }

    const estadoActual = String((existing as any)?.estado || "").trim().toLowerCase() || "pendiente";
    if (estadoActual !== "pendiente") {
        await env.report(400, "Solo se puede aprobar un mutuo acuerdo pendiente");
        return fail(400, estadoActual === "rechazado" || estadoActual === "aprobado" ? "already_resolved" : "invalid_state", "Solo se puede aprobar un mutuo acuerdo pendiente");
    }

    if (existing.firma_ejecutivo_cuenta_digital || existing.firma_ejecutivo_cuenta_manual) {
        await env.report(400, "Este mutuo acuerdo ya fue firmado por el ejecutivo");
        return fail(400, "already_resolved", "Este mutuo acuerdo ya fue firmado por el ejecutivo");
    }

    if (!existing.ausente_acepta || !existing.reemplaza_acepta) {
        await env.report(400, "Ambos empleados deben aceptar antes de firmar");
        return fail(400, "invalid_state", "Ambos empleados deben aceptar antes de firmar");
    }

    if (!currentEmployeeId) {
        await env.report(400, "Empleado inválido");
        return fail(400, "invalid_request", "Empleado inválido");
    }

    const empleado = await env.prisma.c_empleado.findUnique({ where: { id: currentEmployeeId } });
    const myEjecutivoCuentaId = empleado?.supervisor_id ?? null;
    if (!puedeRechazarMutuo(existing, myEjecutivoCuentaId)) {
        await env.report(400, "No autorizado para firmar este mutuo acuerdo");
        return fail(400, "out_of_scope", "No autorizado para firmar este mutuo acuerdo");
    }

    // Todo lo que se puede revisar SIN escribir se revisa antes: un dato que falta no debe dejar el acuerdo aprobado a medias.
    const marcaAusenteId = parseMarcaIdsArray((existing as any)?.marcas_ausente ?? (existing as any)?.marcaDiaAusente_id)[0];
    const marcaReemplazaId = parseMarcaIdsArray((existing as any)?.marcas_reemplaza ?? (existing as any)?.marcaDiaReemplaza_id)[0];
    const fechaAusente = ymdFromFecha((existing as any)?.fecha_ausente) || null;
    const fechaReemplaza = ymdFromFecha((existing as any)?.fecha_reemplaza) || null;

    const marcaAusente = marcaAusenteId ? await env.prisma.c_marca_dia.findUnique({ where: { id: marcaAusenteId } }) : null;
    const marcaReemplaza = marcaReemplazaId ? await env.prisma.c_marca_dia.findUnique({ where: { id: marcaReemplazaId } }) : null;

    if ((!fechaAusente && !marcaAusente) || (!fechaReemplaza && !marcaReemplaza)) {
        await env.report(404, "Marca ausente o reemplaza no encontrada");
        return fail(404, "not_found", "Marca ausente o reemplaza no encontrada");
    }

    const fechaAusenteFinal = fechaAusente || (marcaAusente?.fecha ? new Date(marcaAusente.fecha).toISOString().split("T")[0] : null);
    const fechaReemplazaFinal = fechaReemplaza || (marcaReemplaza?.fecha ? new Date(marcaReemplaza.fecha).toISOString().split("T")[0] : null);
    if (!fechaAusenteFinal || !fechaReemplazaFinal) {
        await env.report(500, "Fechas del mutuo acuerdo no disponibles");
        return fail(500, "invalid_request", "Fechas del mutuo acuerdo no disponibles");
    }

    const coordinador = await env.call({ action: "GET", table: "n_ejecutivo_cuenta_coordinador", operation: "findFirst", where: { ejecutivo_cuenta_id: myEjecutivoCuentaId } });
    if (!coordinador) {
        await env.report(404, "Coordinador no encontrado");
        return fail(404, "not_found", "Coordinador no encontrado");
    }

    // Se «reserva» el acuerdo (aprobado y firmado) ANTES de llamar a Planillas, como siempre: así un segundo intento a la vez ve que ya no está pendiente.
    const updated = await env.call({
        action: "UPDATE",
        table: "e_mutuos_acuerdos",
        where: { id: idNum },
        data: { firma_ejecutivo_cuenta_manual: firmaManual, firma_ejecutivo_cuenta_digital: firmaDigital, estado: "aprobado" },
    });
    // Si Planillas falla, el acuerdo vuelve a como estaba (pendiente y sin firmas): no queda «aprobado» sin cambio de guardia y se puede reintentar.
    const revertir = () => env
        .call({ action: "UPDATE", table: "e_mutuos_acuerdos", where: { id: idNum }, data: { estado: existing.estado || "pendiente", firma_ejecutivo_cuenta_manual: existing.firma_ejecutivo_cuenta_manual ?? null, firma_ejecutivo_cuenta_digital: existing.firma_ejecutivo_cuenta_digital ?? "" } })
        .catch((e: unknown) => console.error("[aprobar-mutuo] NO se pudo devolver el acuerdo a pendiente tras el fallo de Planillas:", idNum, e instanceof Error ? e.message : e));

    const now = env.nowIso(horaAccion);

    let planillasResponse: Awaited<ReturnType<ActionEnv["planillas"]>>;
    try {
        planillasResponse = await env.planillas(
            "/cdg",
            {
                tipo: "MUT",
                empleado_reemplaza_id: existing.empleadoReemplaza_id,
                fecha_reemplaza: fechaReemplazaFinal,
                empleado_ausente_id: existing.empleadoAusente_id,
                fecha_ausente: fechaAusenteFinal,
                coordinado_por_id: 3,
                coordinador_id: coordinador.coordinador_id,
            },
            planillasToken,
        );
    } catch (e) {
        await revertir();
        throw e;
    }

    if (!planillasResponse.success) {
        await revertir();
        await env.report(500, "Error al crear el cambio de guardia en Planillas");
        return fail(500, "invalid_request", "Error al crear el cambio de guardia en Planillas");
    }

    const cambioGuardiaCreated = await env.prisma.c_cambio_guardia.findUnique({ where: { id: planillasResponse.data.id } });
    if (cambioGuardiaCreated) {
        // Actualizar el mutuo acuerdo con el id del cambio de guardia
        await env.call({ action: "UPDATE", table: "e_mutuos_acuerdos", where: { id: idNum }, data: { cambio_guardia_id: cambioGuardiaCreated.id } });
    }

    await env.call({
        action: "POST",
        table: "c_cambios_apps_modules",
        data: {
            nombre_tabla: "e_mutuos_acuerdos",
            registro_id: idNum,
            cambios: JSON.stringify([
                { prop: "firma_ejecutivo_cuenta_manual", before: existing.firma_ejecutivo_cuenta_manual || null, after: firmaManual },
                { prop: "firma_ejecutivo_cuenta_digital", before: existing.firma_ejecutivo_cuenta_digital || null, after: firmaDigital },
                { prop: "estado", before: (existing as any)?.estado || null, after: "aprobado" },
                ...(input.extraCambios ?? []),
            ]),
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

        const ausenteNombre = nombreCompleto(empleadoAusente, `ID ${empleadoAusenteId}`);
        const reemplazaNombre = nombreCompleto(empleadoReemplaza, `ID ${empleadoReemplazaId}`);
        const ejecutivoNombre = nombreCompleto(ejecutivo, `ID ${currentEmployeeId}`);
        const ausenteCedula = String((empleadoAusente as any)?.cedula ?? "");
        const reemplazaCedula = String((empleadoReemplaza as any)?.cedula ?? "");
        const fecha = now.split("T")[0];
        const hora = now.split("T")[1]?.replace("Z", "") || "";

        const fechaAusenteN = ymdFromFecha((existing as any)?.fecha_ausente) || ((marcaAusenteNotif as any)?.fecha ? new Date((marcaAusenteNotif as any).fecha).toISOString().split("T")[0] : fecha);
        const fechaReemplazaN = ymdFromFecha((existing as any)?.fecha_reemplaza) || ((marcaReemplazaNotif as any)?.fecha ? new Date((marcaReemplazaNotif as any).fecha).toISOString().split("T")[0] : fecha);
        const horaInicioAusente = (marcaAusenteNotif as any)?.hora_inicio ? new Date((marcaAusenteNotif as any).hora_inicio).toISOString().split("T")[1] : hora;
        const horaInicioReemplaza = (marcaReemplazaNotif as any)?.hora_inicio ? new Date((marcaReemplazaNotif as any).hora_inicio).toISOString().split("T")[1] : hora;
        const puestoNombreAusente = (puestoAusente as any)?.nombre || "Desconocido";
        const puestoNombreReemplaza = (puestoReemplaza as any)?.nombre || "Desconocido";

        await env
            .notify(
                `Mutuo acuerdo aprobado`,
                `El mutuo acuerdo fue aprobado por ${ejecutivoNombre} el día ${fecha} a las ${hora}. El empleado ${ausenteNombre} (cédula ${ausenteCedula || "N/A"}) acordó cambiar el turno del día ${fechaAusenteN} a las ${horaInicioAusente} para el puesto ${puestoNombreAusente} por el turno del día ${fechaReemplazaN} a las ${horaInicioReemplaza} para el puesto ${puestoNombreReemplaza} del empleado ${reemplazaNombre} (cédula ${reemplazaCedula || "N/A"}).`,
                recipients,
                [currentEmployeeId],
            )
            .catch((error: unknown) => {
                const msg = error instanceof Error ? error.message : "Error desconocido";
                console.error("Error sending mutuos-acuerdos firma-ejecutivo notification:", msg);
            });
    }

    return {
        ok: true,
        status: 200,
        body: { status: true, message: "Firmas del ejecutivo guardadas correctamente", data: { id: updated.id, firma_ejecutivo_cuenta_manual: updated.firma_ejecutivo_cuenta_manual, firma_ejecutivo_cuenta_digital: updated.firma_ejecutivo_cuenta_digital } },
    };
}
