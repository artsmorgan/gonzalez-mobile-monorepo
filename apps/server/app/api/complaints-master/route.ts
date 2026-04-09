import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";
import { toZonedTime } from "date-fns-tz";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";
import { sendNotificationByRole } from "../../../utils/sendNotification";
import { uploadDynamicFiles } from "../../../utils/callDynamicFilesApi";

export const runtime = "nodejs";

type ComplaintFileInput = {
    type: string; // image | audio | video | document
    extension: string;
    original_name?: string;
    file_base64: string;
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

function buildFileUrl(baseUrl: string, recordId: number, file: { name: string; type: string }): string {
    const fileName = file.name;
    const type = String(file.type || "file").toLowerCase();
    let urlPath: string;
    if (type === "image") {
        urlPath = `/api/complaints-master/${recordId}/get-image/${fileName}`;
    } else if (type === "audio") {
        urlPath = `/api/complaints-master/${recordId}/get-audio/${fileName}`;
    } else if (type === "video") {
        urlPath = `/api/complaints-master/${recordId}/get-video/${fileName}`;
    } else {
        urlPath = `/api/complaints-master/${recordId}/get-file/${fileName}`;
    }
    return `${baseUrl}${urlPath}`;
}

export async function POST(req: NextRequest) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const body = await req.json();
        const {
            marca_id,
            sociedad,
            nombre_realiza_queja,
            cliente,
            empresa_presenta_queja,
            persona_presenta_queja,
            medio_recepcion_queja,
            tipo_queja,
            ubicacion,
            nivel_queja,
            fecha_queja,
            motivo_queja,
            descripcion_queja,
            fecha_inicio,
            fecha_revision,
            resolucion_queja,
            estado,
            accion_correctiva_preventiva,
            firma_responsable,
            archivos,
            empresa_id: bodyEmpresaId,
            cliente_id: bodyClienteId,
            contrato_id: bodyContratoId,
            corpo_id: bodyCorpoId,
            puesto_id: bodyPuestoId,
            plaza_id: bodyPlazaId,
        } = body;

        const pickNumericId = (value: unknown, fallback: number): number => {
            const n = parseInt(String(value ?? ""), 10);
            if (Number.isFinite(n) && n > 0) return n;
            return fallback;
        };

        if (!marca_id) {
            return NextResponse.json({ status: false, message: "Marca no especificada" }, { status: 400 });
        }

        const marcaDia = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_marca_dia",
                operation: "findUnique",
                where: { id: parseInt(marca_id) },
            },
        });
        if (!marcaDia) {
            return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 404 });
        }

        const marcaDiaObj = marcaDia as any;
        if (!marcaDiaObj.empleadoFijo_id) {
            return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 404 });
        }

        if (!firma_responsable || String(firma_responsable).trim().length === 0) {
            return NextResponse.json({ status: false, message: "La firma del responsable es requerida" }, { status: 400 });
        }

        const created_at = toZonedTime(new Date(), "America/Costa_Rica");
        const empresa_id = pickNumericId(bodyEmpresaId, marcaDiaObj.empresa_id);
        const cliente_id = pickNumericId(bodyClienteId, marcaDiaObj.cliente_id);
        const contrato_id = pickNumericId(bodyContratoId, marcaDiaObj.contrato_id);
        const corpo_id = pickNumericId(bodyCorpoId, marcaDiaObj.corpo_id);
        const puesto_id = pickNumericId(bodyPuestoId, marcaDiaObj.puesto_id);
        const plaza_id = pickNumericId(bodyPlazaId, marcaDiaObj.plaza_id);

        // Autocompletar campos desde la marca; el cliente puede sobreescribir empresa…corpo y puesto/plaza vía body
        const new_record = await callDynamicPrisma({
            req,
            data: {
                action: "POST",
                table: "c_maestro_quejas",
                operation: "create",
                data: {
                    empresa_id,
                    cliente_id,
                    contrato_id,
                    corpo_id,
                    puesto_id,
                    plaza_id,
                    sociedad: String(sociedad ?? ""),
                    nombre_realiza_queja: String(nombre_realiza_queja ?? ""),
                    cliente: String(cliente ?? ""),
                    empresa_presenta_queja: String(empresa_presenta_queja ?? ""),
                    persona_presenta_queja: String(persona_presenta_queja ?? ""),
                    medio_recepcion_queja: String(medio_recepcion_queja ?? ""),
                    tipo_queja: String(tipo_queja ?? ""),
                    ubicacion: String(ubicacion ?? ""),
                    nivel_queja: String(nivel_queja ?? ""),
                    fecha_queja: String(fecha_queja ?? ""),
                    motivo_queja: String(motivo_queja ?? ""),
                    descripcion_queja: String(descripcion_queja ?? ""),
                    fecha_inicio: String(fecha_inicio ?? ""),
                    fecha_revision: String(fecha_revision ?? ""),
                    resolucion_queja: String(resolucion_queja ?? ""),
                    estado: String(estado ?? ""),
                    accion_correctiva_preventiva: String(accion_correctiva_preventiva ?? ""),
                    firma_responsable: String(firma_responsable),
                    created_at: created_at.toISOString(),
                    created_by: payload?.id?.toString() || ""
                },
                include: {
                    c_anexos_quejas: true,
                },
            },
        });
        const newRecordObj = new_record as any;

        // Archivos anexos
        let filesParsed: ComplaintFileInput[] = [];
        if (archivos) {
            filesParsed = safeParseJson<ComplaintFileInput[]>(archivos, []);
        }

        if (filesParsed.length > 0) {
            const uploadResp = await uploadDynamicFiles({
                req,
                folderPath: `complaints-master/${newRecordObj.id}`,
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
                        table: "c_anexos_quejas",
                        operation: "create",
                        data: {
                            name: uploaded.name,
                            original_name: uploaded.original_name || uploaded.name,
                            type: uploaded.type,
                            extension: uploaded.extension,
                            queja_id: newRecordObj.id,
                        },
                    },
                });
            }
        }

        const fullRecord = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_maestro_quejas",
                operation: "findUnique",
                where: { id: newRecordObj.id },
                include: { c_anexos_quejas: true },
            },
        });

        const sucursal = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "e_estructura_sucursal",
                operation: "findUnique",
                where: { id: corpo_id },
            },
        });

        if (sucursal) {
            const sucursalObj = sucursal as any;
            const fecha_string = created_at.toISOString().split("T")[0];
            const hora_string = created_at.toISOString().split("T")[1].split(".")[0];
            const description = `Se ha registrado una queja de tipo ${tipo_queja} en la sucursal ${sucursalObj.nombre} de la empresa ${cliente} el día ${fecha_string} a las ${hora_string}`;
            await sendNotificationByRole(req, corpo_id, [plaza_id], "Queja registrada", description, ["ADMINISTRATIVO", "SUPERVISOR"]);
        }

        // Registrar cambio de creación
        const createdBy = parseInt(String(payload?.id ?? 0), 10) || 0;
        await callDynamicPrisma({
            req,
            data: {
                action: "POST",
                table: "c_cambios_apps_modules",
                operation: "create",
                data: {
                    nombre_tabla: "c_maestro_quejas",
                    registro_id: newRecordObj.id,
                    cambios: JSON.stringify([{
                        prop: "__created__",
                        before: null,
                        after: {
                            id: newRecordObj.id,
                            empresa_id: newRecordObj.empresa_id,
                            cliente_id: newRecordObj.cliente_id,
                            corpo_id: newRecordObj.corpo_id,
                            puesto_id: newRecordObj.puesto_id,
                            sociedad: newRecordObj.sociedad,
                            nombre_realiza_queja: newRecordObj.nombre_realiza_queja,
                            cliente: newRecordObj.cliente,
                            empresa_presenta_queja: newRecordObj.empresa_presenta_queja,
                            persona_presenta_queja: newRecordObj.persona_presenta_queja,
                            medio_recepcion_queja: newRecordObj.medio_recepcion_queja,
                            tipo_queja: newRecordObj.tipo_queja,
                            ubicacion: newRecordObj.ubicacion,
                            nivel_queja: newRecordObj.nivel_queja,
                            fecha_queja: newRecordObj.fecha_queja,
                            motivo_queja: newRecordObj.motivo_queja,
                            descripcion_queja: newRecordObj.descripcion_queja,
                            fecha_inicio: newRecordObj.fecha_inicio,
                            fecha_revision: newRecordObj.fecha_revision,
                            resolucion_queja: newRecordObj.resolucion_queja,
                            estado: newRecordObj.estado,
                            accion_correctiva_preventiva: newRecordObj.accion_correctiva_preventiva,
                        },
                    }]),
                    created_at: created_at.toISOString(),
                    created_by: createdBy,
                },
            },
        });

        const fullRecordObj = fullRecord as any;
        const anexosArray = Array.isArray(fullRecordObj?.c_anexos_quejas) ? fullRecordObj.c_anexos_quejas : [];
        const baseUrl = req.nextUrl.origin;
        return NextResponse.json({
            status: true,
            message: "Queja creada correctamente",
            data: {
                ...(fullRecordObj ?? newRecordObj),
                id_local: "",
                files: anexosArray.map((f: any) => ({
                    id: f.id,
                    name: f.name,
                    original_name: f.original_name,
                    type: f.type,
                    extension: f.extension,
                    url: buildFileUrl(baseUrl, newRecordObj.id, f),
                })),
            }
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

