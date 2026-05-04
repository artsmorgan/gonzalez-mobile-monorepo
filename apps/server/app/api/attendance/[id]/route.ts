import { NextRequest, NextResponse } from "next/server";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";
import { sendNotificationByRole } from "../../../../utils/sendNotification";
import { getActivities } from "../../../../utils/createActivities";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { getCoordinadoPorId } from "../../../../utils/getCoordinadoPorId";
import { createAccionPersonal } from "../../../../utils/createAccionPersonal";

const getUsuarioInsercion = async (req: NextRequest, id: number) => {
    const empleado = await callDynamicPrisma({
        req,
        data: { action: "GET", table: "c_empleado", operation: "findUnique", where: { id } }
    });
    return empleado.cedula ? (empleado.cedula) : "MonitoreApp";
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);

        const { type, reason, horaAccion } = await req.json();

        // Obtener siempre la última marca agregada
        const marcaDia = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_marca_dia",
                operation: "findUnique",
                where: { id }
            }
        });
        if (!marcaDia) {
            return NextResponse.json({ status: false, message: "No se encontró la marca" }, { status: 200 });
        }

        switch (type) {
            case "entrada":
                if (marcaDia.hora_entrada_digitada != null) {
                    return NextResponse.json({ status: false, message: "Ya has marcado la entrada" }, { status: 200 });
                }
                const horaAccionDate = new Date(horaAccion);
                const time = horaAccionDate.toISOString().split('T')[1];
                marcaDia.hora_entrada = '1970-01-01T' + time;
                marcaDia.hora_entrada_digitada = horaAccionDate;

                const empresa = await callDynamicPrisma({
                    req,
                    data: {
                        action: "GET",
                        table: "e_estructura_empresa",
                        operation: "findUnique",
                        where: { id: marcaDia.empresa_id }
                    }
                });
                if (!empresa) {
                    return NextResponse.json({ status: false, message: "Empresa no encontrada" }, { status: 200 });
                }

                const cliente = await callDynamicPrisma({
                    req,
                    data: {
                        action: "GET",
                        table: "e_estructura_cliente",
                        operation: "findUnique",
                        where: { id: marcaDia.cliente_id }
                    }
                });
                if (!cliente) {
                    return NextResponse.json({ status: false, message: "Cliente no encontrado" }, { status: 200 });
                }

                const contrato = await callDynamicPrisma({
                    req,
                    data: {
                        action: "GET",
                        table: "e_estructura_contrato",
                        operation: "findUnique",
                        where: { id: marcaDia.contrato_id }
                    }
                });
                if (!contrato) {
                    return NextResponse.json({ status: false, message: "Contrato no encontrado" }, { status: 200 });
                }

                const corpo = await callDynamicPrisma({
                    req,
                    data: {
                        action: "GET",
                        table: "e_estructura_sucursal",
                        operation: "findUnique",
                        where: { id: marcaDia.corpo_id }
                    }
                });
                if (!corpo) {
                    return NextResponse.json({ status: false, message: "Corpo no encontrado" }, { status: 200 });
                }

                const puesto = await callDynamicPrisma({
                    req,
                    data: {
                        action: "GET",
                        table: "e_estructura_puesto",
                        operation: "findUnique",
                        where: { id: marcaDia.puesto_id }
                    }
                });
                if (!puesto) {
                    return NextResponse.json({ status: false, message: "Puesto no encontrado" }, { status: 200 });
                }

                const plaza = await callDynamicPrisma({
                    req,
                    data: {
                        action: "GET",
                        table: "e_estructura_plazas",
                        operation: "findUnique",
                        where: { id: marcaDia.plaza_id }
                    }
                });
                if (!plaza) {
                    return NextResponse.json({ status: false, message: "Plaza no encontrada" }, { status: 200 });
                }

                const horario = await callDynamicPrisma({
                    req,
                    data: {
                        action: "GET",
                        table: "c_horario",
                        operation: "findUnique",
                        where: { id: marcaDia.horario_id }
                    }
                });
                if (!horario) {
                    return NextResponse.json({ status: false, message: "Horario no encontrado" }, { status: 200 });
                }

                const previousUserMarca = await callDynamicPrisma({
                    req,
                    data: {
                        action: "GET",
                        table: "c_marca_dia",
                        operation: "findFirst",
                        where: { empleadoFijo_id: marcaDia.empleadoFijo_id, id: { lt: marcaDia.id } },
                        orderBy: { id: "desc" }
                    }
                });

                if (previousUserMarca && previousUserMarca.hora_entrada_digitada != null && previousUserMarca.hora_salida_digitada == null) {
                    const response = await marcar_salida(req, previousUserMarca.id, horaAccion, reason);
                }

                marcaDia.usuario_marca_entrada = await getUsuarioInsercion(req, marcaDia.empleadoFijo_id ?? 0);
                const updated = await callDynamicPrisma({
                    req,
                    data: {
                        action: "UPDATE",
                        table: "c_marca_dia",
                        where: { id: marcaDia.id },
                        data: marcaDia
                    }
                });

                if (!updated) {
                    return NextResponse.json({ status: false, message: "No se pudo actualizar la marca del dia" }, { status: 200 });
                }

                const empleado = await callDynamicPrisma({
                    req,
                    data: {
                        action: "GET",
                        table: "c_empleado",
                        operation: "findUnique",
                        where: { id: marcaDia.empleadoFijo_id ?? 0 }
                    }
                });
                const current_corpo = await callDynamicPrisma({
                    req,
                    data: {
                        action: "GET",
                        table: "e_estructura_sucursal",
                        operation: "findUnique",
                        where: { id: marcaDia.corpo_id }
                    }
                });
                const current_puesto = await callDynamicPrisma({
                    req,
                    data: {
                        action: "GET",
                        table: "e_estructura_puesto",
                        operation: "findUnique",
                        where: { id: marcaDia.puesto_id }
                    }
                });
                if (empleado && current_corpo && current_puesto) {
                    if (marcaDia.hora_inicio && marcaDia.fecha && marcaDia.hora_entrada_digitada) {
                        const momentoEntrada = new Date(marcaDia.fecha).getTime() + new Date(marcaDia.hora_inicio).getTime();
                        let desc_tardia = "";
                        if (momentoEntrada < new Date(marcaDia.hora_entrada_digitada).getTime()) {
                            const lateTime = await getLateTime(req, marcaDia.id, new Date(marcaDia.hora_entrada_digitada).getTime());
                            if (lateTime) {
                                desc_tardia = " con una tardía de " + lateTime;
                            }
                        }
                        const title = "Ingreso de trabajo confirmado";
                        const description = `El empleado ${empleado.nombre} ${empleado.primer_apellido} ha ingresado a su puesto de ${current_puesto.nombre}${desc_tardia}`;
                        await sendNotificationByRole(req, marcaDia.corpo_id, [marcaDia.plaza_id], title, description, ["ADMINISTRATIVO", "SUPERVISOR"]);
                    }
                }
                break;
            case "salida":
                if (marcaDia.hora_salida_digitada != null) {
                    return NextResponse.json({ status: false, message: "Ya has marcado la salida", marca_id: marcaDia.id }, { status: 200 });
                }

                const response = await marcar_salida(req, marcaDia.id, horaAccion, reason);
                if (!response.status) {
                    return NextResponse.json({ status: false, message: response.message }, { status: 200 });
                }
                break;
        }

        return NextResponse.json({ status: true, message: type == "entrada" ? "Ingreso de trabajo confirmado" : "Salida de trabajo confirmada" }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}

async function marcar_salida(req: NextRequest, id: number, horaAccion: string, reason: string) {
    try {
        const now = new Date(horaAccion);

        const marcaDia = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_marca_dia",
                operation: "findUnique",
                where: { id }
            }
        });
        if (!marcaDia) {
            return { status: false, message: "Marca no encontrada" };
        }

        const time = now.toISOString().split('T')[1];
        marcaDia.hora_salida = '1970-01-01T' + time;

        marcaDia.hora_salida_digitada = now;

        if (!marcaDia.hora_fin || !marcaDia.hora_inicio) {
            return { status: false, message: "Hora de fin o inicio no establecida" };
        }

        if (!marcaDia.fecha) {
            return { status: false, message: "Fecha no establecida" };
        }

        const fechaMarca = new Date(marcaDia.fecha);
        const horaFinMarca = new Date(marcaDia.hora_fin);
        const endDate = new Date(fechaMarca.toISOString().split('T')[0]+'T'+horaFinMarca.toISOString().split('T')[1]);

        console.log("endDate", endDate);

        let salidaAnticipada = null;
        if (now.getTime() < (endDate.getTime() - 15 * 60 * 1000)) {
            let horaInicio = new Date(marcaDia.hora_inicio).toISOString().split('T')[1];
            let horaFin = new Date(marcaDia.hora_fin).toISOString().split('T')[1];
            horaInicio = horaInicio.split('.')[0];
            horaFin = horaFin.split('.')[0];
            let horaInicioSplit = horaInicio.split(':');
            let horaFinSplit = horaFin.split(':');

            salidaAnticipada = await callDynamicPrisma({
                req,
                data: {
                    action: "POST",
                    table: "c_salida_anticipada",
                    data: {
                        tipo_turno: marcaDia.tipo_turno,
                        horario_str: `${horaInicioSplit[0]}:${horaInicioSplit[1]}-${horaFinSplit[0]}:${horaFinSplit[1]}`,
                        cantidad_horas: marcaDia.horas_duracion || 0,
                        hora_salida_anticipada: now.toISOString(),
                        minutos_descuento: (endDate.getTime() - now.getTime()) / 60000,
                        motivo: reason
                    }
                }
            });
        }

        let usuario_insercion = await getUsuarioInsercion(req, marcaDia.empleadoFijo_id ?? 0);
        if (salidaAnticipada) {
            const coordinadoPorId = await getCoordinadoPorId(req, marcaDia);
            const accionPersonal_response = await createAccionPersonal(req, marcaDia.id, 13, 0, 0, salidaAnticipada.id, reason, coordinadoPorId, usuario_insercion);
            if (accionPersonal_response.status) {
                const accionPersonal = accionPersonal_response.data;
                marcaDia.accionPersonal_id = accionPersonal.id;
            }
            const time = now.toISOString().split('T')[1];
            marcaDia.hora_salida = '1970-01-01T' + time;
            marcaDia.hora_salida_digitada = now;
            const empleado = await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "c_empleado",
                    operation: "findUnique",
                    where: { id: marcaDia.empleadoFijo_id ?? 0 }
                }
            });
            if (empleado) {
                const title = "Salida anticipada";
                const fecha_salida_string = now.toISOString().split('T')[0];
                const hora_salida_string = now.toISOString().split('T')[1].split('.')[0];
                const description = `El empleado ${empleado.nombre} ${empleado.primer_apellido} ha salido anticipadamente el día ${fecha_salida_string} a las ${hora_salida_string}. Motivo: ${reason}`;
                await sendNotificationByRole(req, marcaDia.corpo_id, [marcaDia.plaza_id], title, description, ["ADMINISTRATIVO", "SUPERVISOR"]);
            }
        }

        marcaDia.usuario_marca_salida = usuario_insercion;

        const updated = await callDynamicPrisma({
            req,
            data: {
                action: "UPDATE",
                table: "c_marca_dia",
                where: { id: marcaDia.id },
                data: marcaDia
            }
        });

        if (!updated) {
            return { status: false, message: "No se pudo actualizar la marca del dia" };
        }

        const response = await check_unmarked_activities(req, marcaDia.id);
        if (!response.status) {
            return { status: false, message: response.message };
        }

        return { status: true, message: "Salida marcada correctamente" };
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        return { status: false, message: errorMessage };
    }
}

async function check_unmarked_activities(req: NextRequest, id: number) {
    const activities = await getActivities(req, id);
    if (activities.status) {
        if (activities.actividades && activities.actividades.length > 0) {
            const marcaDia = await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "c_marca_dia",
                    operation: "findUnique",
                    where: { id }
                }
            });
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
            const empleado = await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "c_empleado",
                    operation: "findUnique",
                    where: { id: marcaDia.empleadoFijo_id ?? 0 }
                }
            });
            if (empleado && unmarked) {
                // Remover la última coma
                unmarked_activities = unmarked_activities.slice(0, -2);
                const title = "Actividades sin marcar";
                const description = `El empleado ${empleado.nombre} ${empleado.primer_apellido} marcó salida sin haber marcado las siguientes actividades: ${unmarked_activities}`;
                await sendNotificationByRole(req, marcaDia.corpo_id, [marcaDia.plaza_id], title, description, ["ADMINISTRATIVO", "SUPERVISOR"]);
            }
        }
    }
    else {
        return { status: false, message: activities.message };
    }
    return { status: true, message: "Actividades marcadas correctamente" };
}


const getLateTime = async (req: NextRequest, id: number, horaAccion: number | null) => {
    const marcaDia = await callDynamicPrisma({
        req,
        data: {
            action: "GET",
            table: "c_marca_dia",
            operation: "findUnique",
            where: { id }
        }
    });
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