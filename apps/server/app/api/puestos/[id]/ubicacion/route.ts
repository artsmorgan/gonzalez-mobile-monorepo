import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { sendNotificationByPlaza } from "../../../../../utils/sendNotification";

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

        const { latitud, longitud } = await req.json();

        if (latitud === undefined || longitud === undefined) {
            return NextResponse.json(
                { status: false, message: "Latitud y longitud son requeridas" },
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
                where: { id: puestoId },
                include: {
                    e_estructura_plazas: {
                        where: {
                            deleted: null,
                        },
                    },
                },
            },
        });

        if (!puesto) {
            return NextResponse.json(
                { status: false, message: "Puesto no encontrado" },
                { status: 404 }
            );
        }

        const puestoObj = puesto as any;

        // Actualizar coordenadas
        const updatedPuesto = await callDynamicPrisma({
            req,
            data: {
                action: "UPDATE",
                table: "e_estructura_puesto",
                operation: "update",
                where: { id: puestoId },
                data: {
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

        // Obtener plazas vinculadas al puesto
        const plazasIds = puestoObj.e_estructura_plazas?.map((plaza: any) => plaza.id) || [];

        // Enviar notificación a las plazas vinculadas
        if (plazasIds.length > 0) {
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

            await sendNotificationByPlaza(
                req,
                marcaDiaId,
                "Ubicación del puesto actualizada",
                `Se ha actualizado la ubicación del puesto ${puestoObj.nombre || puestoObj.codigo || 'N/A'} a la latitud ${latitud} y longitud ${longitud}`,
                plazasIds
            );
        }

        return NextResponse.json(
            {
                status: true,
                message: "Ubicación del puesto actualizada correctamente",
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

