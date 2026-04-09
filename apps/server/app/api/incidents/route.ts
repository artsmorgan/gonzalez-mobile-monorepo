/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";
import { toZonedTime } from "date-fns-tz";
import { sendNotificationByEmployee, sendNotificationByRole } from "../../../utils/sendNotification";
import { findContributionIncidents } from "../../../utils/findContributionIncidents";
import { uploadDynamicFiles } from "../../../utils/callDynamicFilesApi";

type IncidentFileInput = {
    type: string; // image | audio | video | document
    extension: string;
    original_name?: string;
    file_base64: string; // base64 puro (sin data:)
};

function safeParseJson<T>(value: any, fallback: T): T {
    try {
        if (typeof value === "string") {
            const trimmed = value.trim();
            if (trimmed.length === 0) return fallback;
            return JSON.parse(trimmed) as T;
        }
        if (value === null || value === undefined) return fallback;
        return value as T;
    } catch {
        return fallback;
    }
}

function buildIncidentFileUrl(baseUrl: string, incidentId: number, file: { name: string; type: string }): string {
    const fileName = file.name;
    const type = String(file.type || "file").toLowerCase();
    let urlPath: string;
    if (type === "image") {
        urlPath = `/api/incidents/${incidentId}/get-image/${fileName}`;
    } else if (type === "audio") {
        urlPath = `/api/incidents/${incidentId}/get-audio/${fileName}`;
    } else if (type === "video") {
        urlPath = `/api/incidents/${incidentId}/get-video/${fileName}`;
    } else {
        urlPath = `/api/incidents/${incidentId}/get-file/${fileName}`;
    }
    return `${baseUrl}${urlPath}`;
}

export async function GET(req: NextRequest) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
        if (!valid) {
            return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });
        }

        const corpoIdStr = req.nextUrl.searchParams.get("corpo_id");
        if (!corpoIdStr) {
            return NextResponse.json({ status: false, message: "Corporación no especificada" }, { status: 200 });
        }

        const corpoId = parseInt(corpoIdStr, 10);
        if (Number.isNaN(corpoId)) {
            return NextResponse.json({ status: false, message: "corpo_id inválido" }, { status: 200 });
        }

        const tokenEmpleadoId =
            payload?.id != null && payload?.id !== ""
                ? parseInt(String(payload.id), 10)
                : NaN;
        const empleadoSesion = Number.isFinite(tokenEmpleadoId)
            ? await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "c_empleado",
                    operation: "findUnique",
                    where: { id: tokenEmpleadoId },
                },
            })
            : null;
        const supervisorId = empleadoSesion?.supervisor_id ?? null;

        const incidents = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_incidente",
                operation: "findMany",
                where: { corpo_id: corpoId },
                orderBy: { id: "desc" },
                include: {
                    n_ejecutivo_cuenta: true,
                    n_clasificacion_incidente: true,
                    c_archivos_incidente: true,
                    _count: {
                        select: {
                            c_contribucion_incidente: true,
                        },
                    },
                }
            }
        });

        const incidentsMapped = [];

        for (const i of incidents) {
            const involucrados = safeParseJson<any[]>(i.involucrados, []);
            const fechaLibro = safeParseJson<any>(i.fecha_libro_novedades, { numero: "", fecha: "" });
            const aportes = await findContributionIncidents(req, i.id);
            incidentsMapped.push({
                id: i.id,
                corpo_id: i.corpo_id,
                estado: Boolean(i.estado),
                ejecutivo: {
                    id: i.n_ejecutivo_cuenta?.id ?? i.ejecutivo_cuenta,
                    name: i.n_ejecutivo_cuenta?.nombre ?? "",
                },
                fecha_incidente: i.fecha_incidente instanceof Date ? i.fecha_incidente.toISOString() : (i.fecha_incidente || ""),
                fecha_reporte: i.fecha_reporte instanceof Date ? i.fecha_reporte.toISOString() : (i.fecha_reporte || ""),
                nombre_responsable: i.nombre_responsable ?? "",
                clasificacion: {
                    id: i.n_clasificacion_incidente?.id ?? i.clasificacion,
                    name: i.n_clasificacion_incidente?.nombre ?? "",
                },
                descripcion: i.descripcion ?? "",
                involucrados,
                fecha_libro_novedades: fechaLibro,
                nombre_responsable_atencion: i.nombre_responsable_atencion ?? "",
                solucion: i.solucion ?? "",
                fecha_solucion: i.fecha_solucion instanceof Date ? i.fecha_solucion.toISOString() : (i.fecha_solucion || ""),
                fecha_solucion_real: i.fecha_real_solucion instanceof Date ? i.fecha_real_solucion.toISOString() : (i.fecha_real_solucion || ""),
                costo_asociado: i.costo_asociado ?? "",
                consecutivo_informe: i.consecutivo_informe ?? "",
                link_informe: i.link_informe ?? "",
                files: (i.c_archivos_incidente || []).map((f: any) => ({
                    id: f.id,
                    name: f.name,
                    original_name: f.original_name,
                    type: f.type,
                    extension: f.extension,
                    url: buildIncidentFileUrl(req.nextUrl.origin, i.id, f),
                })),
                aportes: aportes ?? [],
                owned: supervisorId != null && supervisorId === i.ejecutivo_cuenta,
                id_local: "",
            });
        }

        return NextResponse.json({ status: true, incidents: incidentsMapped }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error("Error in GET /api/incidents:", errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
        if (!valid) {
            return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });
        }

        const body = await req.json();
        const {
            marca_id,
            empleado_id,
            fecha_incidente,
            fecha_reporte,
            nombre_responsable,
            clasificacion_id,
            descripcion,
            involucrados,
            fecha_libro_novedades,
            nombre_responsable_atencion,
            archivos,
            // opcionales (permitimos que vengan aunque el formulario de creación los oculte)
            solucion,
            fecha_solucion,
            fecha_real_solucion,
            costo_asociado,
            consecutivo_informe,
            link_informe,
        } = body ?? {};

        if (
            !marca_id ||
            !fecha_incidente ||
            !fecha_reporte ||
            !nombre_responsable ||
            !clasificacion_id ||
            !descripcion ||
            !nombre_responsable_atencion
        ) {
            return NextResponse.json({ status: false, message: "Datos incompletos" }, { status: 200 });
        }

        const marca = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "c_marca_dia", operation: "findUnique", where: { id: parseInt(String(marca_id)) } }
        });
        if (!marca) {
            return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 200 });
        }

        const invParsed = safeParseJson<any[]>(involucrados, []);
        const fechaLibroParsed = safeParseJson<any>(fecha_libro_novedades, { numero: "", fecha: "" });

        let filesParsed: IncidentFileInput[] = [];
        if (archivos) {
            filesParsed = safeParseJson<IncidentFileInput[]>(archivos, []);
        }

        const createdAt = toZonedTime(new Date(), "America/Costa_Rica") as Date;

        const sucursal = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "e_estructura_sucursal", operation: "findUnique", where: { id: marca.corpo_id } }
        });

        if (!sucursal) {
            return NextResponse.json({ status: false, message: "Sucursal no encontrada" }, { status: 200 });
        }

        const incident = await callDynamicPrisma({
            req,
            data: {
                action: "POST",
                table: "c_incidente",
                data: {
                    corpo_id: marca.corpo_id,
                    ejecutivo_cuenta: sucursal.ejecutivoCuenta_id ?? 0,
                    fecha_incidente: new Date(fecha_incidente).toISOString(),
                    fecha_reporte: new Date(fecha_reporte).toISOString(),
                    nombre_responsable: String(nombre_responsable),
                    clasificacion: parseInt(String(clasificacion_id)),
                    descripcion: String(descripcion),
                    involucrados: JSON.stringify(invParsed ?? []),
                    fecha_libro_novedades: JSON.stringify(fechaLibroParsed ?? { numero: "", fecha: "" }),
                    nombre_responsable_atencion: String(nombre_responsable_atencion),
                    solucion: (typeof solucion === "string" && solucion.trim().length > 0) ? solucion : null,
                    fecha_solucion: (typeof fecha_solucion === "string" && fecha_solucion.trim().length > 0) ? new Date(fecha_solucion).toISOString() : null,
                    fecha_real_solucion: (typeof fecha_real_solucion === "string" && fecha_real_solucion.trim().length > 0) ? new Date(fecha_real_solucion).toISOString() : null,
                    costo_asociado: (typeof costo_asociado === "string" && costo_asociado.trim().length > 0) ? costo_asociado : null,
                    consecutivo_informe: (typeof consecutivo_informe === "string" && consecutivo_informe.trim().length > 0) ? consecutivo_informe : null,
                    link_informe: (typeof link_informe === "string" && link_informe.trim().length > 0) ? link_informe : null,
                    cliente_id: marca.cliente_id,
                    empresa_id: marca.empresa_id,
                    estado: true,
                    created_at: createdAt.toISOString(),
                    created_by: parseInt(String(payload?.id ?? "0")),
                }
            }
        });

        if (filesParsed.length > 0) {
            const uploadResp = await uploadDynamicFiles({
                req,
                folderPath: `incidents/${incident.id}`,
                files: filesParsed
                    .filter((f) => f?.file_base64 && f?.extension && f?.type)
                    .map((f) => ({
                        type: f.type,
                        extension: f.extension,
                        original_name: f.original_name,
                        file_base64: f.file_base64,
                    })),
            });

            const uploadedFiles = Array.isArray(uploadResp?.files) ? uploadResp.files : [];
            for (const uploaded of uploadedFiles) {
                await callDynamicPrisma({
                    req,
                    data: {
                        action: "POST",
                        table: "c_archivos_incidente",
                        data: {
                            name: uploaded.name,
                            original_name: uploaded.original_name || uploaded.name,
                            type: uploaded.type,
                            extension: uploaded.extension,
                            incidente_id: incident.id,
                        },
                    },
                });
            }
        }

        const clasificacion = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "n_clasificacion_incidente", operation: "findUnique", where: { id: parseInt(String(clasificacion_id)) } }
        });
        const cliente = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "e_estructura_cliente", operation: "findUnique", where: { id: marca.cliente_id } }
        });
        if (clasificacion && sucursal && cliente) {
            const fecha_string = fecha_incidente.split("T")[0];
            const hora_string = fecha_incidente.split("T")[1].split(".")[0];
            const description = `Se ha reportado un incidente de tipo ${clasificacion.nombre} en la sucursal ${sucursal.nombre} de la empresa ${cliente.nombre} el día ${fecha_string} a las ${hora_string}`;
            const supervisors = await callDynamicPrisma({
                req,
                data: { action: "GET", table: "c_empleado", operation: "findMany", where: { supervisor_id: sucursal.ejecutivoCuenta_id ?? 0 } }
            });
            console.log("supervisors", supervisors.length);
            const supervisorIds = supervisors.map((s: any) => s.id);
            await sendNotificationByRole(req, marca.corpo_id, [marca.plaza_id], "Incidente reportado", description, ["ADMINISTRATIVO", "SUPERVISOR"]);
            await sendNotificationByEmployee(req, marca.corpo_id, [parseInt(String(payload?.id ?? "0"))], "Incidente reportado", description, supervisorIds);
        }

        return NextResponse.json(
            { status: true, message: "Incidente creado con éxito", incidentId: incident.id },
            { status: 200 }
        );
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log("Error in POST /api/incidents:", errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}


