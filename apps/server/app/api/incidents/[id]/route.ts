import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../utils/verifyToken";
import { toZonedTime } from "date-fns-tz";
import { prisma } from "../../../../utils/prismaClient";
import { sendNotificationByEmployee, sendNotificationByPlaza } from "../../../../utils/sendNotification";

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, payload, message } = verifyAccessToken(req);

        if (!valid) {
            return NextResponse.json({ status: false, message: message }, { status: 401 });
        }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);

        const incident = await prisma.c_incidente.findUnique({ where: { id } });
        if (!incident) {
            return NextResponse.json({ status: false, message: "Incidente no encontrado" }, { status: 200 });
        }

        const { solucion, fecha_solucion, fecha_real_solucion, costo_asociado, consecutivo_informe, link_informe, marca_id } = await req.json();

        if (!solucion || !fecha_solucion || !fecha_real_solucion || !costo_asociado || !consecutivo_informe || !link_informe || !marca_id) {
            return NextResponse.json({ status: false, message: "Datos incompletos" }, { status: 200 });
        }

        incident.solucion = solucion;
        incident.fecha_solucion = new Date(fecha_solucion);
        incident.fecha_real_solucion = new Date(fecha_real_solucion);
        incident.costo_asociado = costo_asociado;
        incident.consecutivo_informe = consecutivo_informe;
        incident.link_informe = link_informe;
        incident.estado = true;
        const updatedIncident = await prisma.c_incidente.update({ where: { id }, data: incident });

        if (updatedIncident) {
            const ejecutivo = await prisma.n_ejecutivo_cuenta.findUnique({ where: { id: incident.ejecutivo_cuenta } });
            if (ejecutivo) {
                const fecha_solucion_string = incident.fecha_solucion.toISOString().split('T')[0];
                const hora_solucion_string = incident.fecha_solucion.toISOString().split('T')[1].split('.')[0];
                const fecha_incidente_string = incident.fecha_incidente.toISOString().split('T')[0];
                const hora_incidente_string = incident.fecha_incidente.toISOString().split('T')[1].split('.')[0];

                let nombre_clasificacion = "Desconocido";
                if (incident.clasificacion) {
                    const clasificacion = await prisma.n_clasificacion_incidente.findUnique({ where: { id: incident.clasificacion } });
                    if (clasificacion) {
                        nombre_clasificacion = clasificacion.nombre;
                    }
                }
                const desc_notification = `La solución al incidente de tipo "${nombre_clasificacion}" ocurrido el ${fecha_incidente_string} a las ${hora_incidente_string} ha sido añadida por ${ejecutivo.nombre} el ${fecha_solucion_string} a las ${hora_solucion_string}.`;

                const plazas_ids: number[] = [];
                const puestos_sucursal = await prisma.e_estructura_puesto.findMany({ where: { sucursal_id: incident.corpo_id } });
                for (const puesto of puestos_sucursal) {
                    const plazas_puesto = await prisma.e_estructura_plazas.findMany({ where: { puesto_id: puesto.id } });
                    for (const plaza of plazas_puesto) {
                        if (!plazas_ids.includes(plaza.id)) plazas_ids.push(plaza.id);
                    }
                }

                await sendNotificationByPlaza(marca_id, "Solución a incidente añadida", desc_notification, plazas_ids);
            }
        }

        return NextResponse.json({ status: true, message: "Incidente actualizado correctamente" }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}