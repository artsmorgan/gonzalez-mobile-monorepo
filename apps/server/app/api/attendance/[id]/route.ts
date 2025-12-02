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

        let earlyLeaving = false;
        let fecha_salida_string = "";
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
                break;
            case "salida":
                if (marcaDia.hora_salida_digitada != null) {
                    return NextResponse.json({ status: false, message: "Ya has marcado la salida" }, { status: 200 });
                }

                const now = new Date(horaAccion);

                marcaDia.hora_salida_digitada = now;

                if (!marcaDia.hora_fin || !marcaDia.hora_inicio) {
                    return NextResponse.json({ status: false, message: "Hora de finalización no establecida" }, { status: 200 });
                }

                if (!marcaDia.fecha) {
                    return NextResponse.json({ status: false, message: "Fecha no establecida" }, { status: 200 });
                }

                const endDate = new Date(marcaDia.hora_fin);
                endDate.setFullYear(marcaDia.fecha.getFullYear(), marcaDia.fecha.getMonth(), marcaDia.hora_inicio > marcaDia.hora_fin ? marcaDia.fecha.getDate() + 1 : marcaDia.fecha.getDate());

                if (now.getTime() < (endDate.getTime() - 15 * 60 * 1000)) {
                    const salidaAnticipada = await prisma.c_salida_anticipada.create({
                        data: {
                            tipo_turno: marcaDia.tipo_turno,
                            horario_str: `${marcaDia.hora_inicio.getHours().toString().padStart(2, '0')}:${marcaDia.hora_inicio.getMinutes().toString().padStart(2, '0')}-${marcaDia.hora_fin.getHours().toString().padStart(2, '0')}:${marcaDia.hora_fin.getMinutes().toString().padStart(2, '0')}`,
                            cantidad_horas: marcaDia.horas_duracion || 0,
                            hora_salida_anticipada: now,
                            minutos_descuento: (endDate.getTime() - now.getTime()) / 60000,
                            motivo: reason
                        }
                    });

                    marcaDia.hora_salida_anticipada = now;
                    marcaDia.salida_anticipada_id = salidaAnticipada.id;
                    earlyLeaving = true;
                    fecha_salida_string = now.toISOString().split('T')[0];
                }
                break;
        }

        const updated = await prisma.c_marca_dia.update({ where: { id: marcaDia.id }, data: marcaDia });

        if (!updated) {
            return NextResponse.json({ status: false, message: "No se pudo actualizar la marca del dia" }, { status: 200 });
        }

        if (earlyLeaving) {
            const empleado = await prisma.c_empleado.findUnique({ where: { id: marcaDia.empleadoFijo_id ?? 0 } });
            if (!empleado) {
                return NextResponse.json({ status: false, message: "No se encontró el empleado" }, { status: 200 });
            }

            const title = "Salida anticipada";
            const description = `El empleado ${empleado.nombre} ${empleado.primer_apellido} ha salido anticipadamente a las ${fecha_salida_string}. Motivo: ${reason}`;
            await sendNotificationByRole(marcaDia.id, title, description, ["ADMINISTRATIVO", "SUPERVISOR"]);
        }

        const empleado = await prisma.c_empleado.findUnique({ where: { id: marcaDia.empleadoFijo_id ?? 0 } });
        if (type == "entrada") {
            const current_corpo = await prisma.e_estructura_sucursal.findUnique({ where: { id: marcaDia.corpo_id } });
            const current_puesto = await prisma.e_estructura_puesto.findUnique({ where: { id: marcaDia.puesto_id } });
            if (empleado && current_corpo && current_puesto) {
                const lastTwoMarks = await prisma.c_marca_dia.findMany({ where: { empleadoFijo_id: marcaDia.empleadoFijo_id }, orderBy: { id: "desc" }, take: 2 });
                if (lastTwoMarks.length <= 2) {
                    const secondLastMark = lastTwoMarks[1];
                    if (secondLastMark.hora_salida_digitada == null) {
                        const previous_corpo = await prisma.e_estructura_sucursal.findUnique({ where: { id: secondLastMark.corpo_id } });
                        const previous_puesto = await prisma.e_estructura_puesto.findUnique({ where: { id: secondLastMark.puesto_id } });
                        if (previous_corpo && previous_puesto) {
                            const title = "Cambio de puesto sin confirmación de salida";
                            const description = `El empleado ${empleado.nombre} ${empleado.primer_apellido} ha ingresado a su puesto de ${current_puesto.nombre} en ${current_corpo.nombre} sin confirmar la salida de su puesto ${previous_puesto.nombre} en ${previous_corpo.nombre}`;
                            await sendNotificationByRole(secondLastMark.id, title, description, ["ADMINISTRATIVO", "SUPERVISOR"]);
                        }
                    }
                }

                if (marcaDia.hora_inicio && marcaDia.fecha && marcaDia.hora_entrada_digitada) {
                    const momentoEntrada = marcaDia.fecha.getTime() + marcaDia.hora_inicio.getTime();
                    let title_tardia = "Ingreso de trabajo confirmado";
                    let desc_tardia = "";
                    if (momentoEntrada < marcaDia.hora_entrada_digitada.getTime()) {
                        const hora_entrada_digitada_string = marcaDia.hora_entrada_digitada.toISOString().split('T');
                        title_tardia = " con una tardía";
                        desc_tardia = " con una tardía al marcar ingreso en " + hora_entrada_digitada_string[0] + " a las " + hora_entrada_digitada_string[1].split('.')[0];
                    }
                    const title = "Ingreso de trabajo confirmado";
                    const description = `El empleado ${empleado.nombre} ${empleado.primer_apellido} ha ingresado a su puesto de ${current_puesto.nombre}${desc_tardia}`;
                    await sendNotificationByRole(marcaDia.id, title, description, ["ADMINISTRATIVO", "SUPERVISOR"]);
                }
            }
        }
        else {
            const activities = await getActivities(marcaDia);
            if (activities.status && activities.actividades && activities.actividades.length > 0) {
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
                if (empleado && unmarked) {
                    // Remover la última coma
                    unmarked_activities = unmarked_activities.slice(0, -2);
                    const title = "Actividades sin marcar";
                    const description = `El empleado ${empleado.nombre} ${empleado.primer_apellido} marcó salida sin haber marcado las siguientes actividades: ${unmarked_activities}`;
                    await sendNotificationByRole(marcaDia.id, title, description, ["ADMINISTRATIVO", "SUPERVISOR"]);
                }
            }
        }

        return NextResponse.json({ status: true, message: type == "entrada" ? "Ingreso de trabajo confirmado" : "Salida de trabajo confirmada" }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}