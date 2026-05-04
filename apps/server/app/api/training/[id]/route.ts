import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";
import { uploadDynamicFiles } from "../../../../utils/callDynamicFilesApi";
import {
    buildTrainingUploadPartsFromDataUris,
    collectTrainingUploadDataUrisFromBody,
    resolveTrainingFilesMetaList,
} from "../trainingFileField";

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, expired, message, payload } = await verifyAccessTokenByApi(req);
        if (!valid) {
            return NextResponse.json({ status: false, expired, message }, { status: expired ? 401 : 403 });
        }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id, 10);
        if (!id || Number.isNaN(id)) {
            return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
        }

        const existing = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "e_registro_capacitaciones",
                operation: "findUnique",
                where: { id },
            },
        });
        if (!existing) {
            return NextResponse.json({ status: false, message: "Capacitación no encontrada" }, { status: 404 });
        }

        const body = await req.json();
        const {
            marca_id: _marcaId,
            empresa_id,
            cliente_id,
            corpo_id,
            division_id,
            contrato_id,
            puesto_id,
            titulo,
            descripcion,
            tipo,
            resultado,
            observaciones,
            nombre_responsable,
            cedula_responsable,
            firma_responsable,
            fecha,
            empleados,
            puestos,
            files,
            file: fileLegacy,
        } = body;

        const updateData: Record<string, unknown> = {};
        if (empresa_id != null && empresa_id !== "") updateData.empresa_id = parseInt(String(empresa_id), 10);
        if (cliente_id != null && cliente_id !== "") updateData.cliente_id = parseInt(String(cliente_id), 10);
        if (corpo_id != null && corpo_id !== "") updateData.corpo_id = parseInt(String(corpo_id), 10);
        if (division_id != null && division_id !== "") updateData.division_id = parseInt(String(division_id), 10);
        if (contrato_id != null && contrato_id !== "") updateData.contrato_id = parseInt(String(contrato_id), 10);
        if (puesto_id != null && puesto_id !== "") updateData.puesto_id = parseInt(String(puesto_id), 10);
        if (titulo != null) updateData.titulo = titulo;
        if (descripcion != null) updateData.descripcion = descripcion;
        if (tipo != null) updateData.tipo = tipo;
        if (resultado !== undefined) updateData.resultado = resultado;
        if (observaciones != null) updateData.observaciones = observaciones;
        if (nombre_responsable != null) updateData.nombre_responsable = nombre_responsable;
        if (cedula_responsable != null) updateData.cedula_responsable = cedula_responsable;
        if (firma_responsable != null) updateData.firma_responsable = firma_responsable;
        if (fecha != null) {
            const fechaDate = fecha instanceof Date ? fecha : new Date(fecha);
            updateData.fecha = fechaDate.toISOString();
        }
        if (payload?.id != null) updateData.responsable_id = payload.id;

        if (Object.keys(updateData).length > 0) {
            await callDynamicPrisma({
                req,
                data: {
                    action: "UPDATE",
                    table: "e_registro_capacitaciones",
                    operation: "update",
                    where: { id },
                    data: updateData,
                },
            });
        }

        if (Array.isArray(empleados)) {
            await callDynamicPrisma({
                req,
                data: {
                    action: "DELETE",
                    table: "e_capacitacion_empleado",
                    operation: "deleteMany",
                    where: { capacitacion_id: id },
                },
            });
            for (const emp of empleados) {
                const eid = parseInt(String(emp), 10);
                if (!Number.isFinite(eid)) continue;
                await callDynamicPrisma({
                    req,
                    data: {
                        action: "POST",
                        table: "e_capacitacion_empleado",
                        operation: "create",
                        data: { capacitacion_id: id, empleado_id: eid },
                    },
                });
            }
        }

        if (Array.isArray(puestos)) {
            await callDynamicPrisma({
                req,
                data: {
                    action: "DELETE",
                    table: "e_capacitacion_puesto",
                    operation: "deleteMany",
                    where: { capacitacion_id: id },
                },
            });
            for (const p of puestos) {
                const pid = parseInt(String(p), 10);
                if (!Number.isFinite(pid)) continue;
                await callDynamicPrisma({
                    req,
                    data: {
                        action: "POST",
                        table: "e_capacitacion_puesto",
                        operation: "create",
                        data: { capacitacion_id: id, puesto_id: pid },
                    },
                });
            }
        }

        const dataUriList = collectTrainingUploadDataUrisFromBody({ files, file: fileLegacy });

        if (dataUriList.length > 0) {
            const metaList = resolveTrainingFilesMetaList(body);
            const uploadParts = buildTrainingUploadPartsFromDataUris(dataUriList, metaList);
            const uploadResp = await uploadDynamicFiles({
                req,
                folderPath: `training/${id}`,
                files: uploadParts,
            });
            const uploaded = Array.isArray(uploadResp?.files) ? uploadResp.files : [];
            for (let i = 0; i < uploaded.length; i++) {
                const u = uploaded[i] as { name?: string; original_name?: string };
                const name = u?.name || "";
                if (!name) continue;
                const part = uploadParts[i];
                const extRaw = part?.extension || name.split(".").pop() || "bin";
                const ext = String(extRaw).replace(/^\./, "").slice(0, 25);
                const orig = (u?.original_name && String(u.original_name).trim() !== "")
                    ? String(u.original_name)
                    : name;
                await callDynamicPrisma({
                    req,
                    data: {
                        action: "POST",
                        table: "c_archivos_adjuntos_capacitaciones",
                        operation: "create",
                        data: {
                            name,
                            original_name: orig,
                            type: (part?.type || "file").slice(0, 25),
                            extension: ext,
                            capacitacion_id: id,
                        },
                    },
                });
            }
        }

        return NextResponse.json({ status: true, message: "Capacitación actualizada", id, data: { id } }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error("PUT training:", errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, expired, message } = await verifyAccessTokenByApi(req);
        if (!valid) {
            return NextResponse.json({ status: false, expired, message }, { status: expired ? 401 : 403 });
        }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id, 10);
        if (!id || Number.isNaN(id)) {
            return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
        }

        const existing = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "e_registro_capacitaciones",
                operation: "findUnique",
                where: { id },
            },
        });
        if (!existing) {
            return NextResponse.json({ status: false, message: "Capacitación no encontrada" }, { status: 404 });
        }

        await callDynamicPrisma({
            req,
            data: {
                action: "DELETE",
                table: "e_capacitacion_empleado",
                operation: "deleteMany",
                where: { capacitacion_id: id },
            },
        });
        await callDynamicPrisma({
            req,
            data: {
                action: "DELETE",
                table: "e_capacitacion_puesto",
                operation: "deleteMany",
                where: { capacitacion_id: id },
            },
        });
        await callDynamicPrisma({
            req,
            data: {
                action: "DELETE",
                table: "e_registro_capacitaciones",
                operation: "delete",
                where: { id },
            },
        });

        return NextResponse.json({ status: true, message: "Capacitación eliminada" }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error("DELETE training:", errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}
