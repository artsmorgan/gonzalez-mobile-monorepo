import { NextRequest, NextResponse } from "next/server";
import { toZonedTime, format } from "date-fns-tz";
import { sendNotificationByPlaza } from "../../../../../utils/sendNotification";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);

        if (!id) {
            return NextResponse.json({ status: false, message: "Marca no especificada" }, { status: 200 });
        }

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
            return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 200 });
        }

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
                        { fecha: { gt: now } },
                        { fecha: { equals: currentDate }, hora_inicio: { gte: currentTime } },
                    ],
                },
                orderBy: [{ fecha: "asc" }, { hora_inicio: "asc" }],
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
                            { fecha: { lt: now } },
                            { fecha: { equals: currentDate }, hora_inicio: { lt: currentTime } },
                        ],
                    },
                    orderBy: [{ fecha: "desc" }, { hora_inicio: "desc" }],
                }
            });
        }
        if (!last_marca) return NextResponse.json({ message: "No se encontró la última marca" }, { status: 404 });
        if (marcaDia.id !== last_marca.id) return NextResponse.json({ message: "Hay una nueva marca más reciente" }, { status: 400 });

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

        const notas = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_puesto_notas",
                operation: "findMany",
                where: { puesto_id: puesto.id }
            }
        });

        const notas_return: { id: number, titulo: string, description: string, categoria_id: number | null, relevancia: string | null, puesto_id: number, empleado: string, created_at: Date, updated_at: Date, id_local: string }[] = [];

        for (const nota of notas) {

            let empleado_name = "-";
            const lastChange = await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "c_puesto_notas_bitacora_cambios",
                    operation: "findFirst",
                    where: { nota_id: nota.id },
                    orderBy: { created_at: "desc" }
                }
            });
            if (lastChange) {
                const empleado = await callDynamicPrisma({
                    req,
                    data: {
                        action: "GET",
                        table: "c_empleado",
                        operation: "findUnique",
                        where: { id: lastChange.empleado_id }
                    }
                });
                if (empleado) {
                    empleado_name = empleado.nombre + " " + empleado.primer_apellido + " " + empleado.segundo_apellido;
                }
            }

            notas_return.push({
                id: nota.id,
                titulo: nota.titulo,
                description: nota.description,
                categoria_id: nota.categoria_id ?? null,
                relevancia: nota.relevancia ?? null,
                empleado: empleado_name,
                puesto_id: nota.puesto_id,
                created_at: nota.created_at,
                updated_at: nota.updated_at,
                id_local: "",
            });
        }
        return NextResponse.json({ status: true, notas: notas_return }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);

        const { marca_id, empleado_id, titulo, description, categoria_id, relevancia, puestos } = await req.json();

        const created_at = toZonedTime(new Date(), "America/Costa_Rica");
        const updated_at = toZonedTime(new Date(), "America/Costa_Rica");

        const categoriaData = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "n_novedades_categoria",
                operation: "findUnique",
                where: { id: categoria_id }
            }
        });
        if (!categoriaData) return NextResponse.json({ status: false, message: "Categoría no encontrada" }, { status: 200 });

        const puestos_parse: number[] = JSON.parse(puestos);

        // Si relevancia no viene o es null, usar "Baja" por defecto
        const relevanciaValue = relevancia || 'Baja';

        for (const puesto_id of puestos_parse) {
            const puesto = await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "e_estructura_puesto",
                    operation: "findUnique",
                    where: { id: puesto_id }
                }
            });
            if (!puesto) return NextResponse.json({ status: false, message: "Puesto no encontrado" }, { status: 200 });

            const empleado = await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "c_empleado",
                    operation: "findUnique",
                    where: { id: empleado_id }
                }
            });
            if (!empleado) return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 200 });

            const newNote = await callDynamicPrisma({
                req,
                data: {
                    action: "POST",
                    table: "c_puesto_notas",
                    data: { titulo, description, categoria_id: categoria_id, relevancia: relevanciaValue, puesto_id, created_at: created_at.toISOString(), updated_at: updated_at.toISOString() }
                }
            });

            const bitacora = await callDynamicPrisma({
                req,
                data: {
                    action: "POST",
                    table: "c_puesto_notas_bitacora_cambios",
                    data: { nota_id: newNote.id, titulo, description, relevancia: relevanciaValue, created_at: created_at.toISOString(), empleado_id, categoria: categoriaData.nombre }
                }
            });

            // Registro de cambios (nueva modalidad) - create
            await callDynamicPrisma({
                req,
                data: {
                    action: "POST",
                    table: "c_cambios_apps_modules",
                    data: {
                        nombre_tabla: "c_puesto_notas",
                        registro_id: newNote.id,
                        cambios: JSON.stringify([
                            { prop: "__created__", before: null, after: true },
                            { prop: "titulo", before: null, after: titulo },
                            { prop: "description", before: null, after: description },
                            { prop: "categoria_id", before: null, after: categoria_id ?? null },
                            { prop: "relevancia", before: null, after: relevanciaValue ?? null },
                            { prop: "puesto_id", before: null, after: puesto_id },
                        ]),
                        created_at: created_at.toISOString(),
                        created_by: empleado_id,
                    },
                    returning: false
                },
            });

            if (bitacora) {
                const plazaIds = await callDynamicPrisma({
                    req,
                    data: {
                        action: "GET",
                        table: "e_estructura_plazas",
                        operation: "findMany",
                        where: { puesto_id: puesto.id }
                    }
                });
                await sendNotificationByPlaza(req, marca_id, "Bitácora creada", `${empleado.nombre} ${empleado.primer_apellido} ha creado una nota llamada ${newNote.titulo} de tipo ${categoriaData.nombre}`, plazaIds.map((plaza: { id: number }) => plaza.id));
            }
        }
        return NextResponse.json({ status: true, message: "Nota creada con éxito" }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
} 