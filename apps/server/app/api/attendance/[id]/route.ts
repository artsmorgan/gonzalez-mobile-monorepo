import { NextRequest, NextResponse } from "next/server";
import { toZonedTime } from "date-fns-tz";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";
import { prisma } from "../../../../utils/prismaClient";
import { sendNotificationByRole } from "../../../../utils/sendNotification";
import { getActivities } from "../../../../utils/createActivities";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { createLoginMarca } from "../../../../utils/createLoginMarca";
import { getMonitoringPostMinutes } from "../../../../utils/getMonitoringPostMinutes";
import axios from "axios";
import { getTiempoGraciaMarcarSalida } from "../../../../utils/getTiempoGraciaMarcarSalida";

const getUsuarioInsercion = async (req: NextRequest, id: number) => {
    const empleado = await prisma.c_empleado.findUnique({ where: { id } });
    if (!empleado) {
        return "MonitoreApp";
    }
    return empleado.cedula ? (empleado.cedula) : "MonitoreApp";
}

/** Combina fecha + hora_inicio de c_marca_dia en un Date comparable. */
function buildMarcaDateTime(marca: { fecha: Date; hora_inicio: Date | null }): Date | null {
    if (!marca.fecha) return null;
    const horaInicio = marca.hora_inicio ?? new Date("1970-01-01 00:00:00");
    const fechaIso = new Date(marca.fecha).toISOString().split("T")[0];
    const horaIso = new Date(horaInicio).toISOString().split("T")[1];
    const dt = new Date(`${fechaIso}T${horaIso}`);
    return Number.isNaN(dt.getTime()) ? null : dt;
}

/**
 * Busca la marca abierta anterior (entrada sin salida) vía Planillas,
 * partiendo del día actual y retrocediendo hasta 14 días, ordenada por horario.
 */
async function findPreviousOpenMarcaViaPlanillas(params: {
    planillasToken: string;
    empleadoCodigo: string;
    empleadoId: number;
    currentMarca: { id: number; fecha: Date; hora_inicio: Date | null };
    referenceDate: Date;
}): Promise<{ id: number } | null> {
    const planillasUrl = String(process.env.PLANILLAS_URL || "").trim().replace(/\/+$/, "");
    if (!planillasUrl || !params.empleadoCodigo) return null;

    const currentStart = buildMarcaDateTime(params.currentMarca);
    if (!currentStart) return null;

    const refCr = toZonedTime(params.referenceDate, "America/Costa_Rica");
    let dateCursor = new Date(`${refCr.toISOString().split("T")[0]}T12:00:00.000Z`);

    for (let day = 0; day < 5; day++) {
        const fechaStr = dateCursor.toISOString().split("T")[0];
        let marcaIds: number[] = [];

        try {
            const planillasResponse = await axios.get(`${planillasUrl}/marcas`, {
                headers: {
                    Authorization: `Bearer ${params.planillasToken}`,
                },
                params: {
                    empleado_codigo: params.empleadoCodigo,
                    fecha: fechaStr,
                },
            });

            const marcasPlanillas = Array.isArray(planillasResponse?.data?.data?.marcas)
                ? planillasResponse.data.data.marcas
                : [];
            marcaIds = marcasPlanillas
                .map((m: { id?: number }) => Number(m?.id))
                .filter((id: number) => Number.isFinite(id) && id > 0);
        } catch (error) {
            console.warn(
                "[attendance/entrada] Error consultando marcas Planillas para fecha",
                fechaStr,
                error instanceof Error ? error.message : error,
            );
        }

        if (marcaIds.length > 0) {
            let rows = await prisma.c_marca_dia.findMany({
                where: { id: { in: marcaIds } },
                orderBy: [{ fecha: "desc" }, { hora_inicio: "desc" }],
            });

            // Misma regla que attendance/user/[id]: excluir marcas del fijo cubiertas por un reemplazo.
            rows = rows.filter(
                (marca) =>
                    !(
                        Number(marca.empleadoFijo_id) === params.empleadoId &&
                        marca.empleadoReemplaza_id != null
                    ),
            );

            for (const marca of rows) {
                if (Number(marca.id) === Number(params.currentMarca.id)) continue;

                const marcaStart = buildMarcaDateTime(marca);
                if (!marcaStart || marcaStart >= currentStart) continue;

                if (marca.hora_entrada_digitada != null && marca.hora_salida_digitada == null) {
                    return { id: marca.id };
                }
            }
        }

        dateCursor = new Date(dateCursor.getTime() - 24 * 60 * 60 * 1000);
    }

    return null;
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);

        const { type, reason, horaAccion } = await req.json();

        // Planillas token deben ser obtenido del header de la request
        const planillasToken = decodeURIComponent(req.headers.get('Planillas-Token') ?? '') || null;
        if (!planillasToken) {
            return NextResponse.json({ status: false, message: "Token de Planillas no encontrado" }, { status: 200 });
        }

        // Obtener siempre la última marca agregada
        const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id } });
        if (!marcaDia) {
            return NextResponse.json({ status: false, message: "No se encontró la marca" }, { status: 200 });
        }

        let empresa 
        let puesto: any;
        let empleado: any;

        switch (type) {
            case "entrada":
                if (marcaDia.hora_entrada_digitada != null) {
                    return NextResponse.json({ status: false, message: "Ya has marcado la entrada" }, { status: 200 });
                }

                empleado = await prisma.c_empleado.findUnique({ where: { id: payload.id } });
                if (!empleado) {
                    return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 200 });
                }

                // Cerrar turno anterior abierto (Planillas, hasta 14 días atrás por horario).
                // Si falla el cierre, no abortar la entrada: continuar el flujo.
                try {
                    const referenceDate = horaAccion ? new Date(horaAccion) : new Date();
                    const previousOpen = await findPreviousOpenMarcaViaPlanillas({
                        planillasToken,
                        empleadoCodigo: String(empleado.codigo || "").trim(),
                        empleadoId: Number(empleado.id),
                        currentMarca: {
                            id: marcaDia.id,
                            fecha: marcaDia.fecha,
                            hora_inicio: marcaDia.hora_inicio,
                        },
                        referenceDate: Number.isNaN(referenceDate.getTime()) ? new Date() : referenceDate,
                    });

                    if (previousOpen) {
                        console.log(
                            "[attendance/entrada] Intentando cerrar turno anterior abierto marca_id=",
                            previousOpen.id,
                        );
                        const closePrevious = await marcar_salida(
                            req,
                            previousOpen.id,
                            horaAccion,
                            reason,
                            payload,
                            planillasToken,
                        );
                        if (!closePrevious.status) {
                            console.warn(
                                "[attendance/entrada] No se pudo cerrar turno anterior; se continúa con la entrada:",
                                closePrevious.message,
                            );
                        }
                    }
                } catch (prevErr) {
                    console.warn(
                        "[attendance/entrada] Error buscando/cerrando turno anterior; se continúa con la entrada:",
                        prevErr instanceof Error ? prevErr.message : prevErr,
                    );
                }
                
                const horaAccionDate = new Date(horaAccion);
                const time = horaAccionDate.toISOString().split('T')[1].split('.')[0];
                const time_split = time.split(':');

                const monitoringPostMinutes = await getMonitoringPostMinutes(req);
                let is_late = false;
                if (marcaDia.hora_inicio) {
                    const fechaIso = new Date(marcaDia.fecha).toISOString().split("T")[0];
                    const horaIso = new Date(marcaDia.hora_inicio).toISOString().split("T")[1];
                    const momentoEntrada = new Date(`${fechaIso}T${horaIso}`).getTime();
                    const lateThreshold = momentoEntrada + monitoringPostMinutes * 60 * 1000;
                    if (new Date(horaAccion).getTime() > lateThreshold) {
                        is_late = true;
                    }
                }

                console.log("is_late", is_late);

                console.log("Procedemos a marcar entrada");
                const planillasResponse = await axios.post(`${process.env.PLANILLAS_URL}/marcas/entrada`, {
                    marca_id: marcaDia.id,
                    hora_entrada: `${time_split[0]}:${time_split[1]}`,
                    empleado_codigo: empleado.cedula,
                    generar_tard: is_late
                }, {
                    headers: {
                        "Authorization": `Bearer ${planillasToken}`,
                        "Content-Type": "application/json"
                    }
                });

                if (!planillasResponse.data.success) {
                    return NextResponse.json({ status: false, message: "Error al marcar la entrada en Planillas" }, { status: 200 });
                }
                
                console.log("Marcamos entrada en Planillas");
                
                const updated = await prisma.c_marca_dia.findUnique({ where: { id: marcaDia.id } });

                if (!updated) {
                    return NextResponse.json({ status: false, message: "No se pudo actualizar la marca del dia" }, { status: 200 });
                }

                const marca_hora_entrada = updated.hora_inicio ? new Date(updated.hora_inicio).toISOString().split('T')[1] : "00:00:00";
                const marca_fecha = updated.fecha ? new Date(updated.fecha).toISOString().split('T')[0] : "1970-01-01";

                const marca_hora_entrada_date = new Date(`${marca_fecha}T${marca_hora_entrada}`);
                const hora_entrada_digitada = updated.hora_entrada_digitada ? new Date(updated.hora_entrada_digitada) : null;

                await updateOrCreateLoginMarca(req, marcaDia.id, marcaDia.puesto_id ?? 0, payload.sessionId, payload.id, marca_hora_entrada_date, hora_entrada_digitada, null, null, true);
                
                if (!marcaDia.corpo_id) {
                    return NextResponse.json({ status: false, message: "No se encontró la sucursal" }, { status: 200 });
                }
                
                const current_corpo = await prisma.e_estructura_sucursal.findUnique({ where: { id: marcaDia.corpo_id } });
                const current_puesto = await prisma.e_estructura_puesto.findUnique({ where: { id: marcaDia.puesto_id ?? 0 } });
                let puesto_name = "Indefinido";
                if (current_puesto) {
                    puesto_name = current_puesto.nombre;
                }
                if (empleado && current_corpo) {
                    if (marcaDia.fecha && marcaDia.hora_entrada_digitada) {
                        let desc_tardia = "";
                        if (is_late) {
                            const lateTime = await getLateTime(req, marcaDia.id, new Date(horaAccion).getTime());
                            if (lateTime) {
                                desc_tardia = " con una tardía de " + lateTime;
                            }
                        }
                        const title = "Ingreso de trabajo confirmado";
                        const description = `El empleado ${empleado.nombre} ${empleado.primer_apellido} ha ingresado a su puesto de ${puesto_name}${desc_tardia}`;
                        await sendNotificationByRole(req, marcaDia.corpo_id, [marcaDia.plaza_id ?? 0], title, description, ["ADMINISTRATIVO", "SUPERVISOR"]);
                    }
                }
                break;
            case "salida":
                if (marcaDia.hora_salida_digitada != null) {
                    return NextResponse.json({ status: false, message: "Ya has marcado la salida", marca_id: marcaDia.id, already_synced: true }, { status: 200 });
                }

                const response = await marcar_salida(req, marcaDia.id, horaAccion, reason, payload, planillasToken);
                if (!response.status) {
                    return NextResponse.json({ status: false, message: response.message }, { status: 200 });
                }
                break;
        }
        
    return NextResponse.json({ status: true, message: type == "entrada" ? "Ingreso de trabajo confirmado" : "Salida de trabajo confirmada", marca: null }, { status: 200 });
} catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.log(errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
}
}

async function marcar_salida(req: NextRequest, id: number, horaAccion: string, reason: string, payload: any, planillasToken: any) {
try {
    const now = new Date(horaAccion);

    const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id } });
    if (!marcaDia) {
        return { status: false, message: "Marca no encontrada" };
    }

    if (!marcaDia.corpo_id) {
        return { status: false, message: "No se encontró la sucursal" };
    }

    const time = now.toISOString().split('T')[1];
    const time_split = time.split(':');
    let is_early = false;
    if (marcaDia.hora_inicio && marcaDia.hora_fin) {
        const fechaMarca = new Date(marcaDia.fecha);
        const horaFinMarca = new Date(marcaDia.hora_fin);
        let endDate = new Date(fechaMarca.toISOString().split('T')[0]+'T'+horaFinMarca.toISOString().split('T')[1]);
        if (new Date(marcaDia.hora_inicio) > new Date(marcaDia.hora_fin)) {
            endDate = new Date(endDate.getTime() + 24 * 60 * 60 * 1000);
        }

        console.log("endDate", endDate);
        const tiempoGraciaMarcarSalida = await getTiempoGraciaMarcarSalida(req);

        if (now.getTime() < (endDate.getTime() - tiempoGraciaMarcarSalida * 60 * 1000)) {
            is_early = true;
        }
    }

    const empleado = await prisma.c_empleado.findUnique({ where: { id: payload.id } });

    if (empleado && is_early) {
        if (empleado) {
            const title = "Salida anticipada";
            const fecha_salida_string = now.toISOString().split('T')[0];
            const hora_salida_string = now.toISOString().split('T')[1].split('.')[0];
            const description = `El empleado ${empleado.nombre} ${empleado.primer_apellido} ha salido anticipadamente el día ${fecha_salida_string} a las ${hora_salida_string}. Motivo: ${reason}`;
            await sendNotificationByRole(req, marcaDia.corpo_id, [marcaDia.plaza_id ?? 0], title, description, ["ADMINISTRATIVO", "SUPERVISOR"]);
        }
    }

    if (!empleado) {
        return { status: false, message: "Empleado no encontrado" };
    }

    let bodyPlanillas: any = {
        marca_id: marcaDia.id,
        hora_salida: `${time_split[0]}:${time_split[1]}`,
        empleado_codigo: empleado.cedula
    };

    if (is_early) {
        bodyPlanillas.salida_anticipada = true;
        bodyPlanillas.motivo = reason;
        bodyPlanillas.is_puesto_no_cubierto = false;
    }

    console.log("bodyPlanillas", bodyPlanillas);

    const planillasResponse = await axios.post(`${process.env.PLANILLAS_URL}/marcas/salida`, bodyPlanillas, {
        headers: {
            "Authorization": `Bearer ${planillasToken}`,
            "Content-Type": "application/json"
        }
    });

    if (!planillasResponse.data.success) {
        console.log("Error al marcar la salida en Planillas", planillasResponse);
        return { status: false, message: "Error al marcar la salida en Planillas" };
    }

    const updated = await prisma.c_marca_dia.findUnique({ where: { id: marcaDia.id } });

    if (!updated) {
        return { status: false, message: "No se pudo actualizar la marca del dia" };
    }

    // Función para definir el momento de salida (Fecha + hora) teniendo en cuenta de que puede terminar al día día siguiente

    const marca_hora_entrada = updated.hora_inicio ? new Date(updated.hora_inicio).toISOString().split('T')[1] : "00:00:00";
    const marca_fecha = updated.fecha ? new Date(updated.fecha).toISOString().split('T')[0] : "1970-01-01";

    const marca_hora_entrada_date = new Date(`${marca_fecha}T${marca_hora_entrada}`);

    let hora_salida_real = null;

    if (!marcaDia.hora_inicio || !marcaDia.hora_fin) {
        return { status: false, message: "No se encontró la hora de inicio o fin" };
    }
    
    if (new Date(marcaDia.hora_inicio) < new Date(marcaDia.hora_fin)) {
        const marca_hora_salida = marcaDia.hora_fin ? new Date(marcaDia.hora_fin).toISOString().split('T')[1] : "00:00:00";
        const marca_fecha_salida = marcaDia.fecha ? new Date(marcaDia.fecha).toISOString().split('T')[0] : "1970-01-01";

        hora_salida_real = new Date(`${marca_fecha_salida}T${marca_hora_salida}`);
    }
    else {
        let fecha_mas_uno = new Date(marcaDia.fecha);
        fecha_mas_uno.setDate(fecha_mas_uno.getDate() + 1);

        const marca_hora_salida = marcaDia.hora_fin ? new Date(marcaDia.hora_fin).toISOString().split('T')[1] : "00:00:00";
        const marca_fecha_salida = fecha_mas_uno ? new Date(fecha_mas_uno).toISOString().split('T')[0] : "1970-01-01";
        hora_salida_real = new Date(`${marca_fecha_salida}T${marca_hora_salida}`);
    }
    
    await updateOrCreateLoginMarca(req, marcaDia.id, marcaDia.puesto_id ?? 0, payload.sessionId, payload.id, marca_hora_entrada_date, null, hora_salida_real, now, false);

    const activitiesCheck = await check_unmarked_activities(req, marcaDia.id);
    if (!activitiesCheck.status) {
        console.warn("Salida registrada en Planillas; check_unmarked_activities falló:", activitiesCheck.message);
    }

    return { status: true, message: "Salida marcada correctamente" };
}
catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.log(errorMessage);
    return { status: false, message: errorMessage };
}
}

async function updateOrCreateLoginMarca(req: NextRequest, marca_id: number, puesto_id: number, sessionId: string, empleado_id: number, hora_entrada_teorica: Date | null, hora_entrada_real: Date | null, hora_salida_teorica: Date | null, hora_salida_real: Date | null, isEntrada: boolean) {
try {
    const session = await callDynamicPrisma({
        req,
        data: { action: "GET", table: "refresh_token", operation: "findFirst", where: { sessionId: sessionId } }
    });
    if (!session) {
        return { status: false, message: "Session no encontrada" };
    }
    const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id: marca_id } });
    if (!marcaDia) {
        return { status: false, message: "Marca no encontrada" };
    }
    let loginMarca = await callDynamicPrisma({
        req,
        data: { action: "GET", table: "c_login_marca_almuerzo", operation: "findFirst", where: { session_id: sessionId } }
    });
    if (!loginMarca) {
        const loginMarcaResponse = await createLoginMarca(req, empleado_id, session.createdAt, session.device, sessionId);
        if (loginMarcaResponse) {
            loginMarca = loginMarcaResponse;
        }
        else {
            return { status: false, message: "No se pudo crear la login marca" };
        }
    }
    
    const body = isEntrada ? {
        marca_id: marca_id,
        puesto_id: puesto_id,
        fecha_hora: session.createdAt,
        marca_entrada_teorica: hora_entrada_teorica,
        marca_entrada_real: hora_entrada_real
    } : {
        marca_id: marca_id,
        puesto_id: puesto_id,
        fecha_hora: session.createdAt,
        marca_entrada_teorica: hora_entrada_teorica,
        marca_entrada_real: marcaDia.hora_entrada_digitada,
        marca_salida_teorica: hora_salida_teorica ?? null,
        marca_salida_real: hora_salida_real ?? null
    };

    const updated = await callDynamicPrisma({
        req,
        data: { action: "UPDATE", table: "c_login_marca_almuerzo", where: { id: loginMarca.id }, data: body }
    });
    if (!updated) {
        return { status: false, message: "No se pudo actualizar la login marca" };
    }
    return { status: true, message: "Login marca actualizado correctamente" };
}
catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.log(error);
    return { status: false, message: errorMessage };
}
}

async function check_unmarked_activities(req: NextRequest, id: number) {
const activities = await getActivities(req, id);
if (activities.status) {
    if (activities.actividades && activities.actividades.length > 0) {
        const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id } });
        if (!marcaDia) {
            return { status: false, message: "Marca no encontrada" };
        }
        let unmarked = false;
        let unmarked_activities = "";
        for (const activity of activities.actividades) {
            if (!activity.is_marcada) {
                unmarked = true;
                unmarked_activities += activity.nombre_actividad;
                if (activity.is_revision_equipo) {
                    let unmarked_items = " (";
                    for (const item of activity.inventario) {
                        if (item.revision_equipo && !item.revision_equipo.marcada) {
                            unmarked = true;
                            unmarked_items += item.nombre;
                            unmarked_items += ", ";
                        }
                    }
                    // Remover la última coma
                    unmarked_items = unmarked_items.slice(0, -2);
                    unmarked_items += ")";
                    unmarked_activities += unmarked_items;
                }
                unmarked_activities += ", ";
            }
        }
        const empleado = await prisma.c_empleado.findUnique({
            where: { id: marcaDia.empleadoFijo_id ? marcaDia.empleadoFijo_id : marcaDia.empleadoReemplaza_id ?? 0 },
        });
        if (empleado && unmarked && marcaDia.corpo_id) {
            // Remover la última coma
            unmarked_activities = unmarked_activities.slice(0, -2);
            const title = "Actividades sin marcar";
            const description = `El empleado ${empleado.nombre} ${empleado.primer_apellido} marcó salida sin haber marcado las siguientes actividades: ${unmarked_activities}`;
            await sendNotificationByRole(req, marcaDia.corpo_id, [marcaDia.plaza_id ?? 0], title, description, ["ADMINISTRATIVO", "SUPERVISOR"]);
        }
    }
}
else {
    return { status: false, message: activities.message };
}
return { status: true, message: "Actividades marcadas correctamente" };
}


const getLateTime = async (req: NextRequest, id: number, horaAccion: number | null) => {
const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id } });
if (!marcaDia) {
    return null;
}
const fecha = new Date(marcaDia.fecha).toISOString().split('T')[0];
const horaInicio = marcaDia.hora_inicio ? new Date(marcaDia.hora_inicio).toISOString().split('T')[1].split('.')[0] : '00:00:00';
const inicio = fecha + 'T' + horaInicio;
if (!horaAccion) {
    return null;
}
const ahora = new Date(horaAccion).toISOString();

// Convertir a Date objects para comparar
const inicioDate = new Date(inicio);
const ahoraDate = new Date(ahora);

// Validar si ahora es mayor que inicio
if (ahoraDate > inicioDate) {
    // Calcular la diferencia en milisegundos
    const diferenciaMs = ahoraDate.getTime() - inicioDate.getTime();

    // Convertir a segundos, minutos y horas
    const segundos = Math.floor(diferenciaMs / 1000);
    const minutos = Math.floor(segundos / 60);
    const horas = Math.floor(minutos / 60);

    // Obtener los valores restantes
    const segundosRestantes = segundos % 60;
    const minutosRestantes = minutos % 60;

    // Construir el texto legible
    const partes: string[] = [];

    if (horas > 0) {
        partes.push(`${horas} ${horas === 1 ? 'hora' : 'horas'}`);
    }
    if (minutosRestantes > 0) {
        partes.push(`${minutosRestantes} ${minutosRestantes === 1 ? 'min' : 'mins'}`);
    }
    if (segundosRestantes > 0) {
        partes.push(`${segundosRestantes} ${segundosRestantes === 1 ? 'seg' : 'segs'}`);
    }

    // Si no hay diferencia significativa, mostrar solo segundos
    if (partes.length === 0) {
        return '0 segundos';
    }

    // Unir las partes con comas y "y" antes de la última
    if (partes.length === 1) {
        return partes[0];
    } else if (partes.length === 2) {
        return `${partes[0]} y ${partes[1]}`;
    } else {
        return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
    }
}

return null;
};