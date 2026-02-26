import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { toZonedTime } from "date-fns-tz";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";
import { uploadDynamicFiles } from "../../../../utils/callDynamicFilesApi";
import { createReport } from "../../../../utils/createReporteArticuloMantenimiento";
import { sendNotificationByRole } from "../../../../utils/sendNotification";

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, expired, message } = await verifyAccessTokenByApi(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);

        const { e, estado, bitacora, file } = await req.json();
        const now = toZonedTime(new Date(), "America/Costa_Rica").toISOString();

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
                    await evaluateAndNotifyArticles(req, parsedArticles, actividad_marcada.plaza_id, actividad.nombre_actividad || "actividad");
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

async function evaluateAndNotifyArticles(req: NextRequest, articles: any[], corpoId: number, actividadNombre: string) {
    if (!Array.isArray(articles) || articles.length === 0) return;

    const articulosReporte: any[] = [];
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

        const wasGood = Boolean(last_mantenimiento && last_mantenimiento.id && last_mantenimiento.estado === "Bueno");
        const estado = String(art?.estado || "Bueno");
        if (wasGood && estado !== "Bueno") {
            articulosReporte.push({
                id,
                nombre: art?.nombre || "Artículo",
                tipo,
                marca: art?.marca || "",
                serie: art?.serie || "",
                cantidad_requerida: Number(art?.cantidad_requerida || 0),
                cantidad_real: Number(art?.cantidad_real || 0),
                estado,
                observaciones: String(art?.observaciones || ""),
            });
        }
    }

    if (articulosReporte.length > 0) {
        await createReport(req, articulosReporte);
        const description = `La actividad "${actividadNombre}" reportó artículos que pasaron de "Bueno" a otro estado.`;
        await sendNotificationByRole(req, corpoId, [], "Revisión de equipo en actividades", description, ["ADMINISTRATIVO", "SUPERVISOR"]);
    }
}