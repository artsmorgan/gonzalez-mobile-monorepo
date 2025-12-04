import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../utils/verifyToken";
import { prisma } from "../../../../utils/prismaClient";
import { sendNotificationByRole } from "../../../../utils/sendNotification";
import { getActivities } from "../../../../utils/createActivities";

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, payload, message } = verifyAccessToken(req);

        if (!valid) {
            return NextResponse.json(
                { status: false, message: message },
                { status: 401 }
            );
        }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);

        const { type, reason, horaAccion } = await req.json();

        // Obtener siempre la última marca agregada
        const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id } });
        if (!marcaDia) {
            return NextResponse.json({ status: false, message: "No se encontró la marca" }, { status: 200 });
        }

        switch (type) {
            case "entrada":
                if (marcaDia.hora_entrada_digitada != null) {
                    return NextResponse.json({ status: false, message: "Ya has marcado la entrada" }, { status: 200 });
                }
                marcaDia.hora_entrada_digitada = new Date(horaAccion);

                const empresa = await prisma.e_estructura_empresa.findUnique({ where: { id: marcaDia.empresa_id } });
                if (!empresa) {
                    return NextResponse.json({ status: false, message: "Empresa no encontrada" }, { status: 200 });
                }

                const cliente = await prisma.e_estructura_cliente.findUnique({ where: { id: marcaDia.cliente_id } });
                if (!cliente) {
                    return NextResponse.json({ status: false, message: "Cliente no encontrado" }, { status: 200 });
                }

                const contrato = await prisma.e_estructura_contrato.findUnique({ where: { id: marcaDia.contrato_id } });
                if (!contrato) {
                    return NextResponse.json({ status: false, message: "Contrato no encontrado" }, { status: 200 });
                }

                const corpo = await prisma.e_estructura_sucursal.findUnique({ where: { id: marcaDia.corpo_id } });
                if (!corpo) {
                    return NextResponse.json({ status: false, message: "Corpo no encontrado" }, { status: 200 });
                }

                const puesto = await prisma.e_estructura_puesto.findUnique({ where: { id: marcaDia.puesto_id } });
                if (!puesto) {
                    return NextResponse.json({ status: false, message: "Puesto no encontrado" }, { status: 200 });
                }

                const plaza = await prisma.e_estructura_plazas.findUnique({ where: { id: marcaDia.plaza_id } });
                if (!plaza) {
                    return NextResponse.json({ status: false, message: "Plaza no encontrada" }, { status: 200 });
                }

                const horario = await prisma.c_horario.findUnique({ where: { id: marcaDia.horario_id } });
                if (!horario) {
                    return NextResponse.json({ status: false, message: "Horario no encontrado" }, { status: 200 });
                }

                const previousUserMarca = await prisma.c_marca_dia.findFirst({ where: { empleadoFijo_id: marcaDia.empleadoFijo_id, id: { lt: marcaDia.id } }, orderBy: { id: "desc" } });

                if (previousUserMarca && previousUserMarca.hora_entrada_digitada != null && previousUserMarca.hora_salida_digitada == null) {
                    const response = await marcar_salida(previousUserMarca.id, horaAccion, reason);
                }

                const updated = await prisma.c_marca_dia.update({ where: { id: marcaDia.id }, data: marcaDia });

                if (!updated) {
                    return NextResponse.json({ status: false, message: "No se pudo actualizar la marca del dia" }, { status: 200 });
                }

                const empleado = await prisma.c_empleado.findUnique({ where: { id: marcaDia.empleadoFijo_id ?? 0 } });
                const current_corpo = await prisma.e_estructura_sucursal.findUnique({ where: { id: marcaDia.corpo_id } });
                const current_puesto = await prisma.e_estructura_puesto.findUnique({ where: { id: marcaDia.puesto_id } });
                if (empleado && current_corpo && current_puesto) {
                    if (marcaDia.hora_inicio && marcaDia.fecha && marcaDia.hora_entrada_digitada) {
                        const momentoEntrada = marcaDia.fecha.getTime() + marcaDia.hora_inicio.getTime();
                        let desc_tardia = "";
                        if (momentoEntrada < marcaDia.hora_entrada_digitada.getTime()) {
                            const lateTime = await getLateTime(marcaDia.id, marcaDia.hora_entrada_digitada.getTime());
                            if (lateTime) {
                                desc_tardia = " con una tardía de " + lateTime;
                            }
                        }
                        const title = "Ingreso de trabajo confirmado";
                        const description = `El empleado ${empleado.nombre} ${empleado.primer_apellido} ha ingresado a su puesto de ${current_puesto.nombre}${desc_tardia}`;
                        await sendNotificationByRole(marcaDia.id, title, description, ["ADMINISTRATIVO", "SUPERVISOR"]);
                    }
                }
                break;
            case "salida":
                if (marcaDia.hora_salida_digitada != null) {
                    return NextResponse.json({ status: false, message: "Ya has marcado la salida" }, { status: 200 });
                }

                const response = await marcar_salida(marcaDia.id, horaAccion, reason);
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

async function marcar_salida(id: number, horaAccion: string, reason: string) {
    try {
        const now = new Date(horaAccion);

        const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id } });
        if (!marcaDia) {
            return { status: false, message: "Marca no encontrada" };
        }

        marcaDia.hora_salida_digitada = now;

        if (!marcaDia.hora_fin || !marcaDia.hora_inicio) {
            return { status: false, message: "Hora de fin o inicio no establecida" };
        }

        if (!marcaDia.fecha) {
            return { status: false, message: "Fecha no establecida" };
        }

        const endDate = new Date(marcaDia.hora_fin);
        endDate.setFullYear(marcaDia.fecha.getFullYear(), marcaDia.fecha.getMonth(), marcaDia.hora_inicio > marcaDia.hora_fin ? marcaDia.fecha.getDate() + 1 : marcaDia.fecha.getDate());

        let salidaAnticipada = null;
        if (now.getTime() < (endDate.getTime() - 15 * 60 * 1000)) {
            salidaAnticipada = await prisma.c_salida_anticipada.create({
                data: {
                    tipo_turno: marcaDia.tipo_turno,
                    horario_str: `${marcaDia.hora_inicio.getHours().toString().padStart(2, '0')}:${marcaDia.hora_inicio.getMinutes().toString().padStart(2, '0')}-${marcaDia.hora_fin.getHours().toString().padStart(2, '0')}:${marcaDia.hora_fin.getMinutes().toString().padStart(2, '0')}`,
                    cantidad_horas: marcaDia.horas_duracion || 0,
                    hora_salida_anticipada: now,
                    minutos_descuento: (endDate.getTime() - now.getTime()) / 60000,
                    motivo: reason
                }
            });
        }

        if (salidaAnticipada) {
            marcaDia.hora_salida_digitada = now;
            marcaDia.salida_anticipada_id = salidaAnticipada.id;
            const empleado = await prisma.c_empleado.findUnique({ where: { id: marcaDia.empleadoFijo_id ?? 0 } });
            if (empleado) {
                const title = "Salida anticipada";
                const fecha_salida_string = now.toISOString().split('T')[0];
                const hora_salida_string = now.toISOString().split('T')[1].split('.')[0];
                const description = `El empleado ${empleado.nombre} ${empleado.primer_apellido} ha salido anticipadamente el día ${fecha_salida_string} a las ${hora_salida_string}. Motivo: ${reason}`;
                await sendNotificationByRole(marcaDia.id, title, description, ["ADMINISTRATIVO", "SUPERVISOR"]);
            }
        }

        const updated = await prisma.c_marca_dia.update({ where: { id: marcaDia.id }, data: marcaDia });

        if (!updated) {
            return { status: false, message: "No se pudo actualizar la marca del dia" };
        }

        const response = await check_unmarked_activities(marcaDia.id);
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

async function check_unmarked_activities(id: number) {
    const activities = await getActivities(id);
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
            const empleado = await prisma.c_empleado.findUnique({ where: { id: marcaDia.empleadoFijo_id ?? 0 } });
            if (empleado && unmarked) {
                // Remover la última coma
                unmarked_activities = unmarked_activities.slice(0, -2);
                const title = "Actividades sin marcar";
                const description = `El empleado ${empleado.nombre} ${empleado.primer_apellido} marcó salida sin haber marcado las siguientes actividades: ${unmarked_activities}`;
                await sendNotificationByRole(marcaDia.id, title, description, ["ADMINISTRATIVO", "SUPERVISOR"]);
            }
        }
    }
    else {
        return { status: false, message: activities.message };
    }
    return { status: true, message: "Actividades marcadas correctamente" };
}


const getLateTime = async (id: number, horaAccion: number | null) => {
    const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id } });
    if (!marcaDia) {
        return null;
    }
    const fecha = marcaDia.fecha.toISOString().split('T')[0];
    const horaInicio = marcaDia.hora_inicio?.toISOString().split('T')[1].split('.')[0] ?? '00:00:00';
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