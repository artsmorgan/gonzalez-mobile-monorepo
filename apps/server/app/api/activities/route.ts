import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";
import { sendNotificationByPlaza } from "../../../utils/sendNotification";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";
import { toZonedTime } from "date-fns-tz";

export async function GET(req: NextRequest) {
    try {
        return NextResponse.json({ status: true, message: "Método GET" }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const { marca_id, nombre_actividad, fecha_inicio, fecha_fin, frecuencia, es_revision_equipo, descripcion_actividad, reglas, puestos_plazas, firma_responsable } = await req.json();

        if (!marca_id || !nombre_actividad || !fecha_inicio || !frecuencia || es_revision_equipo === undefined || !descripcion_actividad || !reglas || !firma_responsable) {
            console.log("marca_id", marca_id);
            console.log("nombre_actividad", nombre_actividad);
            console.log("fecha_inicio", fecha_inicio);
            console.log("fecha_fin", fecha_fin);
            console.log("frecuencia", frecuencia);
            console.log("es_revision_equipo", es_revision_equipo);
            console.log("descripcion_actividad", descripcion_actividad);
            console.log("reglas", reglas);
            console.log("puestos_plazas", puestos_plazas);
            console.log("firma_responsable", firma_responsable);
            console.log("--------------------------------");
            return NextResponse.json({ status: false, message: "Datos incompletos" }, { status: 200 });
        }

        const marca = await callDynamicPrisma({ req, data: { action: "GET", table: "c_marca_dia", operation: "findUnique", where: { id: marca_id } } });
        if (!marca) {
            return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 200 });
        }

        const actividad = await callDynamicPrisma({
            req,
            data: {
                action: "POST",
                table: "e_actividades",
                data: {
                    nombre_actividad: nombre_actividad,
                    fecha_inicio: new Date(fecha_inicio).toISOString(),
                    fecha_fin: fecha_fin ? new Date(fecha_fin).toISOString() : new Date(fecha_inicio).toISOString(),
                    frecuencia: frecuencia,
                    es_revision_equipo: es_revision_equipo,
                    descripcion_actividad: descripcion_actividad,
                    firma_responsable: firma_responsable,
                }
            }
        });

        if (actividad) {
            let plazas_ids: number[] = [];
            const puestos_plazas_parse =
                typeof puestos_plazas === "string"
                    ? (Array.isArray(JSON.parse(puestos_plazas || "[]")) ? JSON.parse(puestos_plazas || "[]") : [])
                    : (Array.isArray(puestos_plazas) ? puestos_plazas : []);
            const uniquePuestoIds = Array.from(
                new Set(
                    puestos_plazas_parse
                        .map((p: any) => Number(p?.puesto_id))
                        .filter((v: number) => Number.isFinite(v) && v > 0)
                )
            );

            // 1) Confirmar puestos existentes en BD (findMany con ids recibidos)
            const existingPuestos = uniquePuestoIds.length > 0
                ? await callDynamicPrisma({
                    req,
                    data: {
                        action: "GET",
                        table: "e_estructura_puesto",
                        operation: "findMany",
                        where: { id: { in: uniquePuestoIds } },
                        select: { id: true },
                    },
                })
                : [];

            const existingPuestosArray = Array.isArray(existingPuestos) ? existingPuestos : [];
            const confirmedPuestoIds = Array.from(
                new Set(
                    existingPuestosArray
                        .map((p: any) => Number(p?.id))
                        .filter((v: number) => Number.isFinite(v) && v > 0)
                )
            );

            // 2) Crear relación actividad-puesto en un solo createMany con ids confirmados
            if (confirmedPuestoIds.length > 0) {
                await callDynamicPrisma({
                    req,
                    data: {
                        action: "POST",
                        table: "e_actividades_puesto",
                        operation: "createMany",
                        many: true,
                        data: confirmedPuestoIds.map((puesto_id: number) => ({
                            actividad_id: actividad.id,
                            puesto_id,
                        })),
                    },
                });
            }

            // 3) Buscar todas las plazas de los puestos confirmados para notificar y añadir distinct para evitar duplicados
            if (confirmedPuestoIds.length > 0) {
                const plzs = await callDynamicPrisma({
                        req,
                        data: {
                            action: "GET",
                            table: "e_estructura_plazas",
                            operation: "findMany",
                            where: { puesto_id: { in: confirmedPuestoIds } },
                            select: { id: true },
                            distinct: ["id"],
                        },
                    });
                    
                // Extraer los ids de las plazas
                plazas_ids = plzs.map((p: any) => p.id);
            }

            const frecuencia_parse = JSON.parse(frecuencia);
            if (plazas_ids.length > 0) {
                await sendNotificationByPlaza(
                    req,
                    marca_id,
                    "Actividad asignada",
                    `Se te ha asignado la actividad ${nombre_actividad}, la cual deberá realizarse "${frecuencia_parse.title}"`,
                    plazas_ids
                );
            }

            const createdBy = payload?.id ? Number(payload.id) : 0;
            await callDynamicPrisma({
                req,
                data: {
                    action: "POST",
                    table: "c_cambios_apps_modules",
                    operation: "create",
                    data: {
                        nombre_tabla: "e_actividades",
                        registro_id: actividad.id,
                        cambios: JSON.stringify([{
                            prop: "__created__",
                            before: null,
                            after: {
                                id: actividad.id,
                                nombre_actividad,
                                descripcion_actividad,
                                fecha_inicio,
                                fecha_fin: fecha_fin || fecha_inicio,
                                frecuencia,
                                es_revision_equipo,
                                firma_responsable,
                                puestos_ids: confirmedPuestoIds,
                            },
                        }]),
                        created_at: toZonedTime(new Date(), "America/Costa_Rica").toISOString(),
                        created_by: createdBy,
                    },
                },
            });
        }

        return NextResponse.json({ status: true, message: "Actividad creada correctamente" }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log("errorMessage", errorMessage);
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}
