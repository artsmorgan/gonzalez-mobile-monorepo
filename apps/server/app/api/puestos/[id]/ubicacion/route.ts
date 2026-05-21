import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { sendNotificationByPlaza } from "../../../../../utils/sendNotification";
import { toZonedTime } from "date-fns-tz";

export async function PUT(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
        if (!valid) {
            return NextResponse.json(
                { status: false, expired: expired, message: message },
                { status: 401 }
            );
        }

        const resolvedParams = await context.params;
        const puestoId = parseInt(resolvedParams.id);

        if (!puestoId || isNaN(puestoId)) {
            return NextResponse.json(
                { status: false, message: "ID de puesto inválido" },
                { status: 400 }
            );
        }

        const body = await req.json();
        const latitud = body?.latitud;
        const longitud = body?.longitud;
        const horaAccionRaw = body?.horaAccion;
        const horaAccionNum =
            horaAccionRaw != null && horaAccionRaw !== "" ? Number(horaAccionRaw) : NaN;
        const createdAt = Number.isFinite(horaAccionNum)
            ? new Date(horaAccionNum)
            : toZonedTime(new Date(), "America/Costa_Rica");

        if (latitud === undefined || longitud === undefined) {
            return NextResponse.json(
                { status: false, message: "Latitud y longitud son requeridas" },
                { status: 400 }
            );
        }

        const clearing = latitud === null && longitud === null;
        if (!clearing && (latitud === null || longitud === null)) {
            return NextResponse.json(
                { status: false, message: "Latitud y longitud deben enviarse ambas o ambas en null para borrar" },
                { status: 400 }
            );
        }

        // Verificar que el puesto existe
        const puesto = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "e_estructura_puesto",
                operation: "findUnique",
                where: { id: puestoId }
            },
        });

        if (!puesto) {
            return NextResponse.json(
                { status: false, message: "Puesto no encontrado" },
                { status: 404 }
            );
        }

        let latitud_anterior = puesto.coordenadas_gpslat;
        let longitud_anterior = puesto.coordenadas_gpslng;

        const puestoObj = puesto as any;

        const updatedPuesto = await callDynamicPrisma({
            req,
            data: {
                action: "UPDATE",
                table: "e_estructura_puesto",
                operation: "update",
                where: { id: puestoId },
                data: clearing
                    ? { coordenadas_gpslat: null, coordenadas_gpslng: null }
                    : {
                        coordenadas_gpslat: String(latitud),
                        coordenadas_gpslng: String(longitud),
                    },
            },
        });

        if (!updatedPuesto) {
            return NextResponse.json(
                { status: false, message: "Error al actualizar la ubicación del puesto" },
                { status: 500 }
            );
        }

        await callDynamicPrisma({
            req,
            data: {
                action: "POST",
                table: "c_ubicacion_puesto_registro_cambios",
                data: {
                    puesto_id: puestoId,
                    latitud_anterior: latitud_anterior ? String(latitud_anterior) : null,
                    longitud_anterior: longitud_anterior ? String(longitud_anterior) : null,
                    latitud_nueva: latitud ? String(latitud) : null,
                    longitud_nueva: longitud ? String(longitud) : null,
                    created_at: createdAt.toISOString(),
                    created_by: payload?.id,
                }
            }
        });

        const plazas = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "e_estructura_plazas",
                operation: "findMany",
                where: { puesto_id: puestoId }
            },
        });

        // Enviar notificación a las plazas vinculadas
        if (plazas.length > 0) {
            // Obtener el marca_dia actual del empleado si existe
            const empleadoId = payload?.id;
            let marcaDiaId = puestoId; // Fallback al puestoId (aunque no sea semánticamente correcto)

            if (empleadoId) {
                const marcaDia = await callDynamicPrisma({
                    req,
                    data: {
                        action: "GET",
                        table: "c_marca_dia",
                        operation: "findFirst",
                        where: {
                            empleadoCDG_id: empleadoId,
                        },
                        orderBy: {
                            id: "desc",
                        },
                    },
                });

                if (marcaDia) {
                    const marcaDiaObj = marcaDia as any;
                    marcaDiaId = marcaDiaObj.id;
                }
            }

            const notifBody = clearing
                ? `Se ha eliminado la ubicación GPS del puesto ${puestoObj.nombre || puestoObj.codigo || 'N/A'}`
                : `Se ha actualizado la ubicación del puesto ${puestoObj.nombre || puestoObj.codigo || 'N/A'} a la latitud ${latitud} y longitud ${longitud}`;
            await sendNotificationByPlaza(
                req,
                marcaDiaId,
                clearing ? "Ubicación del puesto eliminada" : "Ubicación del puesto actualizada",
                notifBody,
                plazas.map((plaza: any) => plaza.id)
            );
        }

        return NextResponse.json(
            {
                status: true,
                message: clearing
                    ? "Ubicación del puesto eliminada correctamente"
                    : "Ubicación del puesto actualizada correctamente",
                data: updatedPuesto,
            },
            { status: 200 }
        );
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error("Error updating puesto ubicacion:", errorMessage);
        return NextResponse.json(
            { status: false, message: errorMessage },
            { status: 500 }
        );
    }
}

