import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { toZonedTime } from "date-fns-tz";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";
import { uploadDynamicFiles } from "../../../../utils/callDynamicFilesApi";
import { createReport, updateReport, resolveMarcaModeloSerieFromArticuloEstructura } from "../../../../utils/createReporteArticuloMantenimiento";
import { sendNotificationByRole } from "../../../../utils/sendNotification";
import { uploadArticuloMantenimientoFiles } from "../../../../utils/uploadArticuloMantenimientoFiles";
import {
    articuloIncomingTimestamp,
    cantidadNecesariaFromArticulo,
} from "../../checklist-supervision/articulosMantenimiento";

function isPlanTipoArticulo(tipo: unknown): boolean {
    const s = String(tipo ?? "").trim().toLowerCase();
    if (!s) return false;
    if (s === "plan" || s.includes("plan de")) return true;
    if (s === "asignado" || s.includes("asignado")) return false;
    return s === "plan";
}

function resolveArticuloTipoMantenimiento(tipo: unknown): "Plan" | "Asignado" | null {
    const raw = String(tipo ?? "").trim();
    if (!raw) return null;
    if (isPlanTipoArticulo(raw)) return "Plan";
    const s = raw.toLowerCase();
    if (s === "asignado" || s.includes("asignado")) return "Asignado";
    if (raw === "Plan" || raw === "Asignado") return raw;
    return null;
}

function mergeArticlesStateIntoStored(stored: any[], articles_state: any[]): any[] {
    const overridesByKey = new Map<string, any>();
    for (const a of articles_state) {
        const id = Number(a?.id || 0);
        if (!Number.isFinite(id) || id <= 0) continue;
        const tipoKey = resolveArticuloTipoMantenimiento(a?.tipo) ?? "";
        overridesByKey.set(`${tipoKey}:${id}`, a);
        overridesByKey.set(`:${id}`, a);
    }

    return stored.map((item: any) => {
        const id = Number(item?.id || 0);
        const tipoResolved = resolveArticuloTipoMantenimiento(item?.tipo) ?? "";
        const override =
            overridesByKey.get(`${tipoResolved}:${id}`) ?? overridesByKey.get(`:${id}`);
        if (!override) return item;
        const tipoFromOverride = resolveArticuloTipoMantenimiento(override.tipo);
        return {
            ...item,
            ...(tipoFromOverride ? { tipo: tipoFromOverride } : {}),
            estado: override.estado ?? item.estado,
            cantidad_real:
                override.cantidad_real !== undefined && override.cantidad_real !== null
                    ? Number(override.cantidad_real)
                    : item.cantidad_real,
            cantidad_requerida:
                override.cantidad_requerida !== undefined && override.cantidad_requerida !== null
                    ? Number(override.cantidad_requerida)
                    : item.cantidad_requerida,
            observaciones:
                override.observaciones !== undefined && override.observaciones !== null
                    ? String(override.observaciones)
                    : item.observaciones,
            created_at: override.created_at ?? item.created_at,
            mantenimiento_files: Array.isArray(override.mantenimiento_files)
                ? override.mantenimiento_files
                : item.mantenimiento_files,
        };
    });
}

function buildArticlesFromClientState(articles_state: any[]): any[] {
    return articles_state
        .map((a: any) => {
            const id = Number(a?.id || 0);
            if (!Number.isFinite(id) || id <= 0) return null;
            const tipo = resolveArticuloTipoMantenimiento(a?.tipo);
            if (!tipo) return null;
            return {
                id,
                nombre: String(a?.nombre || "Artículo"),
                tipo,
                marca: a?.marca ?? "",
                modelo: a?.modelo ?? "",
                serie: a?.serie ?? "",
                cantidad_requerida: cantidadNecesariaFromArticulo(a),
                cantidad_real: Number(a?.cantidad_real ?? 0),
                estado: String(a?.estado || "Bueno"),
                observaciones: String(a?.observaciones ?? ""),
                created_at: a?.created_at,
                mantenimiento_files: Array.isArray(a?.mantenimiento_files) ? a.mantenimiento_files : [],
            };
        })
        .filter(Boolean) as any[];
}

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

            if (
                actividad.es_revision_equipo &&
                ((Array.isArray(articles_state) && articles_state.length > 0) ||
                    (typeof actividad_marcada.articles === "string" && actividad_marcada.articles.trim()))
            ) {
                try {
                    let articlesForEvaluation: any[] = [];
                    if (typeof actividad_marcada.articles === "string" && actividad_marcada.articles.trim()) {
                        const parsedArticles = JSON.parse(actividad_marcada.articles);
                        articlesForEvaluation = Array.isArray(parsedArticles) ? parsedArticles : [];
                    }

                    if (Array.isArray(articles_state) && articles_state.length > 0) {
                        if (articlesForEvaluation.length > 0) {
                            articlesForEvaluation = mergeArticlesStateIntoStored(
                                articlesForEvaluation,
                                articles_state,
                            );
                        } else {
                            articlesForEvaluation = buildArticlesFromClientState(articles_state);
                        }
                    }

                    if (articlesForEvaluation.length === 0) {
                        console.warn(
                            "[activities PUT] es_revision_equipo sin artículos evaluables tras merge",
                        );
                    } else {
                        await callDynamicPrisma({
                            req,
                            data: {
                                action: "UPDATE",
                                table: "e_actividades_puesto_plaza",
                                where: { id: actividad_marcada.id },
                                data: { articles: JSON.stringify(articlesForEvaluation), updated_at: now },
                                returning: false,
                            },
                        });

                        await evaluateAndNotifyArticles(
                            req,
                            articlesForEvaluation,
                            actividad_marcada.plaza_id,
                            actividad.nombre_actividad || "actividad",
                            accionAtMs,
                            {
                                puestoId: actividadPuesto.puesto_id,
                            },
                        );
                    }
                } catch (err) {
                    console.error("[activities PUT] Error procesando artículos de revisión:", err);
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
    accionAtMs: number,
    estructuraContext?: { puestoId?: number | null; sucursalId?: number | null },
) {
    if (!Array.isArray(articles) || articles.length === 0) return;

    const articulosReporte: any[] = [];
    const articulosReporteUpdate: any[] = [];
    let sendNotification = false;

    for (const art of articles) {
        const id = Number(art?.id || 0);
        const tipo = resolveArticuloTipoMantenimiento(art?.tipo);
        if (!id || !tipo) continue;

        const accionAt = new Date(accionAtMs);
        const incomingTs = articuloIncomingTimestamp(art, accionAt);
        const cantidad_requerida = cantidadNecesariaFromArticulo(art);
        const cantidad_real = Number(art?.cantidad_real || 0);

        const last_mantenimiento = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_articulo_mantenimiento",
                operation: "findFirst",
                where: isPlanTipoArticulo(tipo) ? { articulo_plan_id: id } : { articulo_asignado_id: id },
                orderBy: { updated_at: "desc" },
            },
        });

        if (last_mantenimiento?.updated_at) {
            const lastUpMs = new Date(last_mantenimiento.updated_at).getTime();
            if (!isNaN(lastUpMs) && incomingTs.getTime() < lastUpMs) {
                continue;
            }
        }

        const estado_actual = String(art?.estado || "Bueno");
        const serverNow = toZonedTime(new Date(), "America/Costa_Rica");
        const observaciones = String(art?.observaciones || "");
        const marca = art?.marca || "";
        const modelo = art?.modelo || "";
        const serie = art?.serie || "";
        const mantenimientoFiles = Array.isArray(art?.mantenimiento_files) ? art.mantenimiento_files : [];

        const pushCreate = async () => {
            const { marca, modelo, serie } = await resolveMarcaModeloSerieFromArticuloEstructura(
                req,
                art,
                estructuraContext,
            );
            articulosReporte.push({
                id,
                nombre: art?.nombre || "Artículo",
                tipo,
                marca,
                modelo,
                serie,
                cantidad_requerida,
                cantidad_real,
                estado: estado_actual,
                observaciones,
                created_at: incomingTs,
                updated_at: incomingTs,
                mantenimiento_files: mantenimientoFiles,
            });
        };

        if (!last_mantenimiento?.id) {
            await pushCreate();
            if (estado_actual !== "Bueno") sendNotification = true;
            continue;
        }

        const last_estado = String(last_mantenimiento.estado || "").trim();

        if (last_estado !== "Bueno" && estado_actual === "Bueno") {
            articulosReporteUpdate.push({
                id: last_mantenimiento.id,
                estado: estado_actual,
                cantidad_real: cantidad_requerida,
                cantidad_necesaria: cantidad_requerida,
                fecha_solucion: serverNow,
                observaciones,
                marca,
                modelo,
                serie_placa: serie,
                updated_at: serverNow,
                mantenimiento_files: mantenimientoFiles,
            });
        } else if (last_estado !== "Bueno" && estado_actual !== "Bueno") {
            const upd: Record<string, unknown> = {
                id: last_mantenimiento.id,
                estado: estado_actual,
                cantidad_real,
                cantidad_necesaria: cantidad_requerida,
                observaciones,
                marca,
                modelo,
                serie_placa: serie,
                updated_at: serverNow,
                mantenimiento_files: mantenimientoFiles,
            };
            if (last_estado !== estado_actual) {
                upd.fecha_solucion = null;
            }
            articulosReporteUpdate.push(upd);
        } else if (last_estado === "Bueno" && estado_actual !== "Bueno") {
            sendNotification = true;
            await pushCreate();
        } else {
            articulosReporteUpdate.push({
                id: last_mantenimiento.id,
                estado: estado_actual,
                cantidad_real,
                cantidad_necesaria: cantidad_requerida,
                observaciones,
                marca,
                modelo,
                serie_placa: serie,
                updated_at: serverNow,
                mantenimiento_files: mantenimientoFiles,
            });
        }
    }

    if (articulosReporteUpdate.length > 0) {
        await updateReport(req, articulosReporteUpdate);
        for (const upd of articulosReporteUpdate) {
            const files = Array.isArray(upd.mantenimiento_files) ? upd.mantenimiento_files : [];
            if (files.length > 0 && upd.id) {
                try {
                    await uploadArticuloMantenimientoFiles(req, Number(upd.id), files);
                } catch (e) {
                    console.error("Error subiendo archivos de mantenimiento (update actividad):", e);
                }
            }
        }
    }
    if (articulosReporte.length > 0) {
        const created = await createReport(req, articulosReporte);
        const reporteByArticuloId = new Map(
            articulosReporte.map((item) => [Number(item.id), item] as const),
        );
        for (const item of created) {
            const art = reporteByArticuloId.get(item.articuloId);
            const files = Array.isArray(art?.mantenimiento_files) ? art.mantenimiento_files : [];
            if (files.length > 0 && item.mantenimientoId) {
                try {
                    await uploadArticuloMantenimientoFiles(req, item.mantenimientoId, files);
                } catch (e) {
                    console.error("Error subiendo archivos de mantenimiento (create actividad):", e);
                }
            }
        }
    }

    if (sendNotification) {
        const description = `La actividad "${actividadNombre}" reportó artículos que pasaron de "Bueno" a otro estado.`;
        await sendNotificationByRole(req, corpoId, [], "Revisión de equipo en actividades", description, ["ADMINISTRATIVO", "SUPERVISOR"]);
    }
}