import { NextRequest, NextResponse } from "next/server";
import { toZonedTime } from "date-fns-tz";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { sendNotificationByRole } from "../../../../../utils/sendNotification";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { createAccionPersonal } from "../../../../../utils/createAccionPersonal";
import { getCoordinadoPorId } from "../../../../../utils/getCoordinadoPorId";

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);

        const body = await req.json();
        const { reason, horaAccion } = body as { reason?: string; horaAccion?: number };
        if (reason == null || String(reason).trim() === "") {
            return NextResponse.json({ status: false, message: "Motivo no especificado" }, { status: 200 });
        }
        const horaAccionNum = horaAccion != null ? Number(horaAccion) : NaN;
        if (!Number.isFinite(horaAccionNum)) {
            return NextResponse.json({ status: false, message: "horaAccion inválida" }, { status: 200 });
        }

        // Obtener siempre la última marca agregada
        const marcaDia = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_marca_dia",
                operation: "findUnique",
                where: { id },
            }
        });
        if (!marcaDia) {
            return NextResponse.json({ status: false, message: "No se encontró la marca del dia" }, { status: 200 });
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
        if (!empleado) {
            return NextResponse.json({ status: false, message: "No se encontró el empleado" }, { status: 200 });
        }

        let wasUpdatedAccionPersonal = false;
        let accionPersonal: any = null;
        if (marcaDia.accionPersonal_id) {
            // Obtener la acción personal
            accionPersonal = await callDynamicPrisma({  
                req,
                data: {
                    action: "GET",
                    table: "c_accion_personal",
                    operation: "findUnique",
                    where: { id: marcaDia.accionPersonal_id }
                }
            });
        }

        console.log(1);
        if (!accionPersonal) {
            // Crear una un registro en la tabla c_ausencia
            const ausencia = await callDynamicPrisma({
                req,
                data: {
                    action: "POST",
                    table: "c_ausencia",
                    data: { tipo: "JUS" }
                }
            });
            console.log(2);
            if (ausencia) {
                // Crear la acción personal
                const coordinadoPorId = await getCoordinadoPorId(req, marcaDia);
                console.log(3);
                const response = await createAccionPersonal(req, marcaDia.id, 5, 0, ausencia.id, 0, reason, coordinadoPorId);
                console.log(4);
                if (response.status) {
                    accionPersonal = response.data;

                    // Update marca dia con la acción personal
                    const updatedMarcaDia = await callDynamicPrisma({
                        req,
                        data: {
                            action: "UPDATE",
                            operation: "update",
                            table: "c_marca_dia",
                            where: { id: marcaDia.id },
                            data: { accionPersonal_id: accionPersonal.id }
                        }
                    });
                    console.log(5);
                }
            }
        }
        
        if (accionPersonal && accionPersonal.tipoAccion_id) {
            console.log("Accion personal", accionPersonal);
            console.log("Tipo de acción", accionPersonal.tipoAccion_id);
            const tipoAccion_id = await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "c_tipo_accion",
                    operation: "findUnique",
                    where: { id: accionPersonal.tipoAccion_id }
                }
            });
            console.log(6);
            if (tipoAccion_id && tipoAccion_id.nombre == "AUSENCIA") {
                // Update el registro de la acción personal y modificar el motivo de ausencia
                const updatedAccionPersonal = await callDynamicPrisma({
                    req,
                    data: {
                        action: "UPDATE",
                        operation: "update",
                        table: "c_accion_personal",
                        where: { id: accionPersonal.id },
                        data: { comentarios: reason }
                        }
                    });
                console.log(7);
                if (updatedAccionPersonal) {
                    wasUpdatedAccionPersonal = true;
                }
            }
        }


        if (!wasUpdatedAccionPersonal) {
            return NextResponse.json({ status: false, message: "No se pudo actualizar el motivo de ausencia" }, { status: 200 });
        }
        else {
            const title = "Motivo de ausencia confirmado";
            const description = `El empleado ${empleado.nombre} ${empleado.primer_apellido} ha confirmado el motivo de ausencia: ${reason} (horaAccion: ${new Date(horaAccionNum).toISOString()})`;
            await sendNotificationByRole(req, marcaDia.corpo_id, [marcaDia.plaza_id], title, description, ["ADMINISTRATIVO", "SUPERVISOR"]);
        }

        return NextResponse.json({ status: true, message: "Motivo de ausencia confirmado" }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}