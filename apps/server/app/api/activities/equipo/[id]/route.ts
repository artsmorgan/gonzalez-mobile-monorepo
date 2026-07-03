import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { toZonedTime } from "date-fns-tz";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { uploadDynamicFiles } from "../../../../../utils/callDynamicFilesApi";
import { createReport, updateReport, resolveMarcaModeloSerieFromArticuloEstructura } from "../../../../../utils/createReporteArticuloMantenimiento";
import { sendNotificationByRole } from "../../../../../utils/sendNotification";

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, expired, message } = await verifyAccessTokenByApi(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);

        const { e, es_correcto, motivo_incorrecto, file, articulo_id, estado: estadoBody, cantidad_real: cantidadRealBody, hora_accion } = await req.json();

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
            return NextResponse.json({ status: false, message: "Actividad de revisión no encontrada" }, { status: 200 });
        }

        const actividadPuesto = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "e_actividades_puesto", operation: "findUnique", where: { id: actividad_marcada.actividad_puesto_id } },
        });
        if (!actividadPuesto) return NextResponse.json({ status: false, message: "Actividad/puesto no encontrada" }, { status: 200 });

        const actividad = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "e_actividades", operation: "findUnique", where: { id: actividadPuesto.actividad_id } },
        });
        if (!actividad) return NextResponse.json({ status: false, message: "Actividad no encontrada" }, { status: 200 });

        let articles: any[] = [];
        try {
            articles = actividad_marcada.articles ? JSON.parse(actividad_marcada.articles) : [];
        } catch {
            articles = [];
        }
        if (!Array.isArray(articles) || articles.length === 0) {
            return NextResponse.json({ status: false, message: "No hay artículos configurados para esta revisión" }, { status: 200 });
        }

        const articuloId = Number(articulo_id || 0);
        const articleIndex = articles.findIndex((a: any) => Number(a?.id) === articuloId);
        if (articleIndex === -1) {
            return NextResponse.json({ status: false, message: "Artículo no encontrado en la revisión" }, { status: 200 });
        }

        const selected = { ...articles[articleIndex] };
        selected.marcada = true;
        const estadoFinal = estadoBody === "Bueno" || estadoBody === "Malo" || estadoBody === "No está"
            ? estadoBody
            : (es_correcto ? "Bueno" : (selected.estado === "No está" ? "No está" : "Malo"));
        selected.estado = estadoFinal;
        selected.observaciones = estadoFinal === "Bueno" ? "-" : String(motivo_incorrecto || "").trim();
        if (typeof cantidadRealBody === "number" && cantidadRealBody >= 0) {
            selected.cantidad_real = cantidadRealBody;
        } else if (selected.estado === "No está") {
            selected.cantidad_real = 0;
        }
        if (typeof selected.cantidad_real !== "number") selected.cantidad_real = Number(selected.cantidad_real || 0);

        if (file) {
            const matches = file.match(/^data:(.+);base64,(.+)$/);
            if (!matches) throw new Error("Formato base64 inválido");
            const extension = matches[1].split("/")[1]?.replace("jpeg", "jpg") || "jpg";
            const uploadResp = await uploadDynamicFiles({
                req,
                folderPath: `activities/equipo/${actividad_marcada.id}/${articuloId}`,
                files: [{ type: "image", extension, file_base64: file }],
            });
            const uploaded = Array.isArray(uploadResp?.files) ? uploadResp.files : [];
            const file_name = uploaded[0]?.name || "";
            if (file_name) selected.file_name = file_name;
        }

        articles[articleIndex] = selected;
        const nowIso = new Date(hora_accion || toZonedTime(new Date(), "America/Costa_Rica")).toISOString();
        await callDynamicPrisma({
            req,
            data: {
                action: "UPDATE",
                table: "e_actividades_puesto_plaza",
                where: { id: actividad_marcada.id },
                data: {
                    articles: JSON.stringify(articles),
                    updated_at: nowIso,
                },
                returning: false
            }
        });

        const allReviewed = articles.every((a: any) => Boolean(a?.marcada));
        if (allReviewed) {
            await callDynamicPrisma({
                req,
                data: {
                    action: "UPDATE",
                    table: "e_actividades_puesto_plaza",
                    where: { id: actividad_marcada.id },
                    data: { marcada: true, updated_at: nowIso },
                    returning: false,
                },
            });
        }

        console.log("Llegamos a la evaluación y notificación");
        await evaluateAndNotify(
            req,
            selected,
            actividad_marcada.plaza_id,
            actividad?.nombre_actividad || "actividad",
            nowIso,
            { puestoId: actividadPuesto.puesto_id },
        );
        console.log("Evaluación y notificación completada");
        if (allReviewed) {
            const relatedActividadPuestos = await callDynamicPrisma({
                req,
                data: { action: "GET", table: "e_actividades_puesto", operation: "findMany", where: { actividad_id: actividad.id }, select: { id: true } },
            });
            const relatedIds = (Array.isArray(relatedActividadPuestos) ? relatedActividadPuestos : []).map((x: any) => x.id);
            await callDynamicPrisma({
                req,
                data: {
                    action: "UPDATE",
                    table: "e_actividades_puesto_plaza",
                    operation: "updateMany",
                    many: true,
                    where: { actividad_puesto_id: { in: relatedIds }, plaza_id: actividad_marcada.plaza_id, marcada: false },
                    data: { marcada: true, updated_at: nowIso },
                    returning: false,
                },
            });
        }

        return NextResponse.json({ status: true, message: "Revision de equipo actualizada correctamente" }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}

/**
 * Misma lógica que el bucle de artículos en checklist-supervision/route.ts (POST):
 * - Concurrencia: si last_mantenimiento.updated_at > momento de la acción, no crear ni actualizar.
 * - Sin registro previo se asume last_estado = "Bueno".
 * - Bueno: si antes no era Bueno, updateReport al último (fecha_solucion = actionTime).
 * - Malo / No está: Bueno→no Bueno → createReport + notificación; otro cambio → updateReport.
 */
async function evaluateAndNotify(
    req: NextRequest,
    articulo: any,
    corpoId: number,
    actividadNombre: string,
    nowIso: string,
    estructuraContext?: { puestoId?: number | null; sucursalId?: number | null },
) {
    const id = Number(articulo?.id || 0);
    const tipo = String(articulo?.tipo || "");
    if (!id || (tipo !== "Plan" && tipo !== "Asignado")) return;

    const createdAt = new Date(nowIso);
    if (isNaN(createdAt.getTime())) return;

    let last_mantenimiento: any = null;
    if (tipo === "Plan") {
        last_mantenimiento = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_articulo_mantenimiento",
                operation: "findFirst",
                where: { articulo_plan_id: id },
                orderBy: { fecha_solucion: "desc" },
            },
        });
    } else {
        last_mantenimiento = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_articulo_mantenimiento",
                operation: "findFirst",
                where: { articulo_asignado_id: id },
                orderBy: { fecha_solucion: "desc" },
            },
        });
    }

    let last_estado: string | null = null;
    if (last_mantenimiento && last_mantenimiento.id) {
        last_estado = String(last_mantenimiento.estado || "");
        if (last_mantenimiento.updated_at) {
            const lastUpdated = new Date(last_mantenimiento.updated_at);
            if (!isNaN(lastUpdated.getTime()) && lastUpdated.getTime() > createdAt.getTime()) {
                return;
            }
        }
    } else {
        last_estado = "Bueno";
    }

    const estado_actual = String(articulo.estado || "");
    const articulos_reporte: any[] = [];
    const articulos_reporte_update: any[] = [];
    let send_notification = false;

    switch (estado_actual) {
        case "Bueno":
            if (last_estado !== "Bueno" && last_mantenimiento && last_mantenimiento.id) {
                articulos_reporte_update.push({
                    id: last_mantenimiento.id,
                    estado: "Bueno",
                    cantidad_real: articulo.cantidad_requerida,
                    fecha_solucion: createdAt,
                });
            }
            break;
        default:
            if (last_estado === "Bueno") {
                send_notification = true;
                const { marca, modelo, serie } = await resolveMarcaModeloSerieFromArticuloEstructura(
                    req,
                    articulo,
                    estructuraContext,
                );
                articulos_reporte.push({
                    id: articulo.id,
                    nombre: articulo.nombre,
                    tipo: articulo.tipo,
                    marca,
                    modelo,
                    serie,
                    cantidad_requerida: articulo.cantidad_requerida,
                    cantidad_real: articulo.cantidad_real,
                    estado: articulo.estado,
                    observaciones: articulo.observaciones,
                    created_at: createdAt,
                    updated_at: createdAt,
                });
            } else if (last_estado !== estado_actual && last_mantenimiento && last_mantenimiento.id) {
                articulos_reporte_update.push({
                    id: last_mantenimiento.id,
                    estado: estado_actual,
                    cantidad_real: articulo.cantidad_real,
                    fecha_solucion: null,
                    updated_at: createdAt,
                });
            }
            break;
    }

    if (articulos_reporte.length > 0) {
        await createReport(req, articulos_reporte);
    }
    if (articulos_reporte_update.length > 0) {
        await updateReport(req, articulos_reporte_update);
    }
    if (send_notification) {
        await sendNotificationByRole(
            req,
            corpoId,
            [],
            "Revisión de equipo en actividades",
            `La actividad "${actividadNombre}" detectó cambios de estado en artículos.`,
            ["ADMINISTRATIVO", "SUPERVISOR"]
        );
    }
}