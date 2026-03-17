import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { toZonedTime } from "date-fns-tz";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";
import { uploadDynamicFiles } from "../../../../utils/callDynamicFilesApi";
import { createReport, updateReport } from "../../../../utils/createReporteArticuloMantenimiento";
import { sendNotificationByRole } from "../../../../utils/sendNotification";

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, expired, message } = await verifyAccessTokenByApi(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);

        const { e, estado, bitacora, file, articles_state, hora_accion } = await req.json();
        const now = toZonedTime(new Date(), "America/Costa_Rica").toISOString();
        /** Instante en que el cliente realizó la acción (marcar); para no pisar mantenimientos ya actualizados después. */
        const accionAtMs = (() => {
            if (hora_accion != null && String(hora_accion).trim()) {
                const d = new Date(hora_accion);
                if (!isNaN(d.getTime())) return d.getTime();
            }
            return Date.now();
        })();

        const empleado = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "c_empleado", operation: "findUnique", where: { id: e } }
        });
        if (!empleado) {
            return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 200 });
        }

        const actividad_marcada = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "e_actividades_puesto_plaza", operation: "findUnique", where: { id } }
        });
        if (!actividad_marcada) {
            return NextResponse.json({ status: false, message: "Marca de la actividad no encontrada" }, { status: 200 });
        }

        const actividadPuesto = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "e_actividades_puesto", operation: "findUnique", where: { id: actividad_marcada.actividad_puesto_id } }
        });
        if (!actividadPuesto) {
            return NextResponse.json({ status: false, message: "Actividad/puesto no encontrada" }, { status: 200 });
        }

        const actividad = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "e_actividades", operation: "findUnique", where: { id: actividadPuesto.actividad_id } }
        });
        if (!actividad) {
            return NextResponse.json({ status: false, message: "Actividad no encontrada" }, { status: 200 });
        }

        if (estado === "marcar") {
            const relatedActividadPuestos = await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "e_actividades_puesto",
                    operation: "findMany",
                    where: { actividad_id: actividad.id },
                    select: { id: true },
                },
            });
            const relatedIds = (Array.isArray(relatedActividadPuestos) ? relatedActividadPuestos : []).map((x: any) => x.id);

            const marcado_exitoso = await callDynamicPrisma({
                req,
                data: {
                    action: "UPDATE",
                    table: "e_actividades_puesto_plaza",
                    operation: "updateMany",
                    many: true,
                    where: {
                        actividad_puesto_id: { in: relatedIds },
                        plaza_id: actividad_marcada.plaza_id,
                        marcada: false,
                    },
                    data: { marcada: true, bitacora: bitacora || "-", updated_at: now },
                    returning: false
                }
            });

            // Guardar imagen si existe
            if (file) {
                const matches = file.match(/^data:(.+);base64,(.+)$/);
                if (!matches) throw new Error("Formato base64 inválido");
                const extension = matches[1].split("/")[1]?.replace("jpeg", "jpg") || "jpg";
                const uploadResp = await uploadDynamicFiles({
                    req,
                    folderPath: `activities/${actividad_marcada.id}`,
                    files: [{ type: "image", extension, file_base64: file }],
                });
                const uploaded = Array.isArray(uploadResp?.files) ? uploadResp.files : [];
                const file_name = uploaded[0]?.name || "";
                if (file_name) {
                    await callDynamicPrisma({
                        req,
                        data: {
                            action: "UPDATE",
                            table: "e_actividades_puesto_plaza",
                            where: { id: actividad_marcada.id },
                            data: { file_name },
                            returning: false
                        }
                    });
                }
            }

            if (actividad.es_revision_equipo && typeof actividad_marcada.articles === "string" && actividad_marcada.articles.trim()) {
                try {
                    const parsedArticles = JSON.parse(actividad_marcada.articles);
                    let articlesForEvaluation: any[] = Array.isArray(parsedArticles) ? parsedArticles : [];

                    // Si el cliente envía el estado actual de los artículos (tal como se ve en la tabla), fusionarlo con los artículos almacenados
                    if (Array.isArray(articles_state) && articles_state.length > 0 && articlesForEvaluation.length > 0) {
                        const overridesById = new Map<number, any>(
                            articles_state
                                .map((a: any) => [Number(a?.id || 0), a] as [number, any])
                                .filter(([id]) => Number.isFinite(id) && id > 0)
                        );

                        articlesForEvaluation = articlesForEvaluation.map((item: any) => {
                            const id = Number(item?.id || 0);
                            const override = overridesById.get(id);
                            if (!override) return item;
                            return {
                                ...item,
                                estado: override.estado ?? item.estado,
                                cantidad_real:
                                    override.cantidad_real !== undefined && override.cantidad_real !== null
                                        ? Number(override.cantidad_real)
                                        : item.cantidad_real,
                                observaciones:
                                    override.observaciones !== undefined && override.observaciones !== null
                                        ? String(override.observaciones)
                                        : item.observaciones,
                            };
                        });
                    }

                    await evaluateAndNotifyArticles(
                        req,
                        articlesForEvaluation,
                        actividad_marcada.plaza_id,
                        actividad.nombre_actividad || "actividad",
                        accionAtMs
                    );
                } catch {
                    // ignore malformed articles payload
                }
            }

            return NextResponse.json({ status: true, message: "Actividad marcada correctamente" }, { status: 200 });
        }
        else {
            await callDynamicPrisma({
                req,
                data: {
                    action: "UPDATE",
                    table: "e_actividades_puesto_plaza",
                    where: { id },
                    data: { marcada: false, file_name: null, updated_at: now },
                    returning: false
                }
            });

            return NextResponse.json({ status: true, message: "Actividad desmarcada correctamente" }, { status: 200 });
        }
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}

async function evaluateAndNotifyArticles(
    req: NextRequest,
    articles: any[],
    corpoId: number,
    actividadNombre: string,
    accionAtMs: number
) {
    if (!Array.isArray(articles) || articles.length === 0) return;

    const articulosReporte: any[] = [];
    const articulosReporteUpdate: any[] = [];
    let sendNotification = false;

    for (const art of articles) {
        const tipo = String(art?.tipo || "");
        const id = Number(art?.id || 0);
        if (!id || (tipo !== "Plan" && tipo !== "Asignado")) continue;

        const last_mantenimiento = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_articulo_mantenimiento",
                operation: "findFirst",
                where: tipo === "Plan" ? { articulo_plan_id: id } : { articulo_asignado_id: id },
                orderBy: { fecha_solucion: "desc" },
            },
        });

        let last_estado: string | null = null;
        if (last_mantenimiento && last_mantenimiento.id) {
            last_estado = String(last_mantenimiento.estado || "");
            // Si el mantenimiento se actualizó después del instante de la acción del cliente, no crear ni reevaluar
            if (last_mantenimiento.updated_at) {
                const lastUpdated = new Date(last_mantenimiento.updated_at);
                if (!isNaN(lastUpdated.getTime()) && lastUpdated.getTime() > accionAtMs) {
                    continue;
                }
            }
        } else {
            // Si no hay registros previos asumimos que el estado base era Bueno
            last_estado = "Bueno";
        }

        const estado_actual = String(art?.estado || "Bueno");
        const cantidad_requerida = Number(art?.cantidad_requerida || 0);
        const cantidad_real = Number(art?.cantidad_real || 0);

        switch (estado_actual) {
            case "Bueno":
                // Si antes no era Bueno y ahora sí, se actualiza el último reporte a Bueno
                if (last_estado !== "Bueno" && last_mantenimiento && last_mantenimiento.id) {
                    articulosReporteUpdate.push({
                        id: last_mantenimiento.id,
                        estado: "Bueno",
                        cantidad_real: cantidad_requerida,
                        fecha_solucion: toZonedTime(new Date(), "America/Costa_Rica"),
                    });
                }
                break;
            default:
                if (last_estado === "Bueno") {
                    // Transición Bueno -> no Bueno: notificar y crear nuevo reporte
                    sendNotification = true;
                    articulosReporte.push({
                        id,
                        nombre: art?.nombre || "Artículo",
                        tipo,
                        marca: art?.marca || "",
                        serie: art?.serie || "",
                        cantidad_requerida,
                        cantidad_real,
                        estado: estado_actual,
                        observaciones: String(art?.observaciones || ""),
                    });
                } else if (last_estado !== estado_actual && last_mantenimiento && last_mantenimiento.id) {
                    // Cambio entre estados no Buenos: actualizar reporte existente
                    articulosReporteUpdate.push({
                        id: last_mantenimiento.id,
                        estado: estado_actual,
                        cantidad_real,
                        fecha_solucion: null,
                    });
                }
                break;
        }
    }

    if (articulosReporte.length > 0) {
        await createReport(req, articulosReporte);
    }
    if (articulosReporteUpdate.length > 0) {
        await updateReport(req, articulosReporteUpdate);
    }

    if (sendNotification) {
        const description = `La actividad "${actividadNombre}" reportó artículos que pasaron de "Bueno" a otro estado.`;
        await sendNotificationByRole(req, corpoId, [], "Revisión de equipo en actividades", description, ["ADMINISTRATIVO", "SUPERVISOR"]);
    }
}