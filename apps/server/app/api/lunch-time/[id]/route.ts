import { NextRequest, NextResponse } from "next/server";
import { toZonedTime } from "date-fns-tz";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;

        const id = parseInt(resolvedParams.id);

        const marcaDia = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_marca_dia",
                operation: "findUnique",
                where: { id }
            }
        });

        if (!marcaDia) return NextResponse.json({ message: "Marca no encontrada" }, { status: 404 });

        if (!marcaDia.empleadoFijo_id) {
            return NextResponse.json(
                { status: false, message: "Empleado no encontrado" },
                { status: 200 }
            );
        }

        const now = toZonedTime(new Date(), "America/Costa_Rica");
        const nowPlus15 = new Date(now.getTime() + 15 * 60 * 1000);
        const currentDate = new Date(now.toISOString().split("T")[0]);
        const currentTime = new Date("1970-01-01 " + now.toTimeString().slice(0, 8));

        const proximo = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_marca_dia",
                operation: "findFirst",
                where: {
                    empleadoFijo_id: marcaDia.empleadoFijo_id,
                    OR: [
                        {
                            fecha: {
                                gt: now,
                            },
                        },
                        {
                            fecha: {
                                equals: currentDate,
                            },
                            hora_inicio: {
                                gte: currentTime,
                            },
                        },
                    ],
                },
                orderBy: [
                    { fecha: "asc" },
                    { hora_inicio: "asc" },
                ],
            }
        });

        let last_marca = null;
        if (proximo) {
            const proximoDateTime = new Date(`${proximo.fecha}T${proximo.hora_inicio}`);
            if (proximoDateTime <= nowPlus15) {
                last_marca = proximo;
            }
        }

        if (!last_marca) {
            last_marca = await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "c_marca_dia",
                    operation: "findFirst",
                    where: {
                        empleadoFijo_id: marcaDia.empleadoFijo_id,
                        OR: [
                            {
                                fecha: {
                                    lt: now,
                                },
                            },
                            {
                                fecha: {
                                    equals: currentDate,
                                },
                                hora_inicio: {
                                    lt: currentTime,
                                },
                            },
                        ],
                    },
                    orderBy: [
                        { fecha: "desc" },
                        { hora_inicio: "desc" },
                    ],
                }
            });
        }

        if (!last_marca) return NextResponse.json({ message: "No se encontró la última marca" }, { status: 404 });

        const horario = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_horario",
                operation: "findUnique",
                where: {
                    id: marcaDia.horario_id
                }
            }
        });

        if (!horario) return NextResponse.json({ message: "Horario no encontrado" }, { status: 404 });

        return NextResponse.json({ status: true, minutos: horario.minutos_almuerzo ? horario.minutos_almuerzo : 0, tiene_almuerzo: horario.tiene_almuerzo != null ? horario.tiene_almuerzo : false }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}