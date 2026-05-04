/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";
import { uploadDynamicFiles } from "../../../../utils/callDynamicFilesApi";
import fs from "fs";
import path from "path";
import { sendNotificationByRole } from "../../../../utils/sendNotification";

type IncidentFileInput = {
    type: string;
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

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
        if (!valid) {
            return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });
        }

        const resolvedParams = await context.params;
        const incidentId = parseInt(resolvedParams.id);
        if (!incidentId) {
            return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });
        }

        const incident = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "c_incidente", operation: "findUnique", where: { id: incidentId } }
        });
        if (!incident) {
            return NextResponse.json({ status: false, message: "Incidente no encontrado" }, { status: 200 });
        }

        const body = await req.json();
        const {
            marca_id,
            solucion,
            fecha_solucion,
            fecha_real_solucion,
            costo_asociado,
            consecutivo_informe,
            link_informe,
            archivos,
            empresa_id: body_empresa_id,
            division_id: body_division_id,
            contrato_id: body_contrato_id,
            cliente_id: body_cliente_id,
            corpo_id: body_corpo_id,
            puesto_id: body_puesto_id,
        } = body ?? {};

        if (!marca_id) {
            return NextResponse.json({ status: false, message: "Marca no especificada" }, { status: 200 });
        }
        const marca = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "c_marca_dia", operation: "findUnique", where: { id: marca_id } }
        });
        if (!marca) {
            return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 200 });
        }

        const updateData: any = {};
        if (typeof solucion === "string") updateData.solucion = solucion;
        if (typeof fecha_solucion === "string" && fecha_solucion.trim().length > 0) {
            updateData.fecha_solucion = new Date(fecha_solucion).toISOString();
        }
        if (typeof fecha_real_solucion === "string" && fecha_real_solucion.trim().length > 0) {
            updateData.fecha_real_solucion = new Date(fecha_real_solucion).toISOString();
        }
        if (typeof costo_asociado === "string" && costo_asociado.trim().length > 0) {
            updateData.costo_asociado = costo_asociado;
        }
        if (typeof consecutivo_informe === "string" && consecutivo_informe.trim().length > 0) {
            updateData.consecutivo_informe = consecutivo_informe;
        }
        if (typeof link_informe === "string" && link_informe.trim().length > 0) {
            updateData.link_informe = link_informe;
        }
        if (body_empresa_id != null && !Number.isNaN(parseInt(String(body_empresa_id), 10))) {
            updateData.empresa_id = parseInt(String(body_empresa_id), 10);
        }
        if (body_cliente_id != null && !Number.isNaN(parseInt(String(body_cliente_id), 10))) {
            updateData.cliente_id = parseInt(String(body_cliente_id), 10);
        }
        if (body_division_id != null && !Number.isNaN(parseInt(String(body_division_id), 10))) {
            updateData.division_id = parseInt(String(body_division_id), 10);
        }
        if (body_contrato_id != null && !Number.isNaN(parseInt(String(body_contrato_id), 10))) {
            updateData.contrato_id = parseInt(String(body_contrato_id), 10);
        }
        if (body_corpo_id != null && !Number.isNaN(parseInt(String(body_corpo_id), 10))) {
            updateData.corpo_id = parseInt(String(body_corpo_id), 10);
        }
        if (body_puesto_id != null && !Number.isNaN(parseInt(String(body_puesto_id), 10))) {
            updateData.puesto_id = parseInt(String(body_puesto_id), 10);
        }

        const updated = await callDynamicPrisma({
            req,
            data: {
                action: "UPDATE",
                table: "c_incidente",
                where: { id: incidentId },
                data: updateData
            }
        });

        let filesParsed: IncidentFileInput[] = [];
        if (archivos) {
            filesParsed = safeParseJson<IncidentFileInput[]>(archivos, []);
        }
        if (filesParsed.length > 0) {
            const uploadResp = await uploadDynamicFiles({
                req,
                folderPath: `incidents/${incidentId}`,
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
                            incidente_id: incidentId,
                        },
                    },
                });
            }
        }

        if (updated && incident.fecha_solucion) {
            const clasificacion = await callDynamicPrisma({
                req,
                data: { action: "GET", table: "n_clasificacion_incidente", operation: "findUnique", where: { id: incident.clasificacion } }
            });
            const sucursal = await callDynamicPrisma({
                req,
                data: { action: "GET", table: "e_estructura_sucursal", operation: "findUnique", where: { id: incident.corpo_id } }
            });
            const cliente = await callDynamicPrisma({
                req,
                data: { action: "GET", table: "e_estructura_cliente", operation: "findUnique", where: { id: incident.cliente_id } }
            });
            if (clasificacion && sucursal && cliente) {
                const fechaSolucion = incident.fecha_solucion instanceof Date ? incident.fecha_solucion.toISOString() : incident.fecha_solucion;
                const fecha_string = fechaSolucion.split("T")[0];
                const hora_string = fechaSolucion.split("T")[1].split(".")[0];
                const description = `Se ha actualizado el incidente de tipo ${clasificacion.nombre} en la sucursal ${sucursal.nombre} de la empresa ${cliente.nombre} el día ${fecha_string} a las ${hora_string}`;
                await sendNotificationByRole(req, marca.corpo_id, [marca.plaza_id], "Incidente actualizado", description, ["ADMINISTRATIVO", "SUPERVISOR"]);
            }
        }

        return NextResponse.json({ status: true, message: "Incidente actualizado correctamente" }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error("Error in PUT /api/incidents/[id]:", errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
        if (!valid) {
            return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });
        }

        const resolvedParams = await context.params;
        const incidentId = parseInt(resolvedParams.id);
        if (!incidentId) {
            return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });
        }

        const incident = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_incidente",
                operation: "findUnique",
                where: { id: incidentId },
                include: { c_archivos_incidente: true }
            }
        });
        if (!incident) {
            return NextResponse.json({ status: false, message: "Incidente no encontrado" }, { status: 200 });
        }

        // Borra registro (archivos en DB por cascade, y borramos directorio físico)
        await callDynamicPrisma({
            req,
            data: { action: "DELETE", table: "c_incidente", where: { id: incidentId } }
        });

        const dir = path.join(process.cwd(), "public", "uploads", "incidents", `${incidentId}`);
        if (fs.existsSync(dir)) {
            // eliminar contenido
            for (const f of fs.readdirSync(dir)) {
                try {
                    fs.unlinkSync(path.join(dir, f));
                } catch {
                    // ignore
                }
            }
            try {
                fs.rmdirSync(dir);
            } catch {
                // ignore
            }
        }

        return NextResponse.json({ status: true, message: "Incidente eliminado correctamente" }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error("Error in DELETE /api/incidents/[id]:", errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}


