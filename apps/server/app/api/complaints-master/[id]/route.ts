import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";
import { toZonedTime } from "date-fns-tz";
import fs from "fs";
import path from "path";
import { uploadDynamicFiles } from "../../../../utils/callDynamicFilesApi";
import { mapComplaintMasterPublicRow } from "../mapPublicRow";

export const runtime = "nodejs";

type ComplaintFileInput = {
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

export async function PUT(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const { id } = resolvedParams;
        const complaintId = parseInt(id, 10);
        if (!complaintId) {
            return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });
        }
        const {
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
            division_id: bodyDivisionId,
        } = await req.json();

        const pickNumericId = (value: unknown, fallback: number): number => {
            const n = parseInt(String(value ?? ""), 10);
            if (Number.isFinite(n) && n > 0) return n;
            return fallback;
        };

        const existingRecord = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_maestro_quejas",
                operation: "findUnique",
                where: { id: complaintId },
            },
        });

        if (!existingRecord) {
            return NextResponse.json(
                { status: false, message: "Registro no encontrado" },
                { status: 404 }
            );
        }

        const existingRecordObj = existingRecord as any;

        const updateData: any = {
            sociedad: sociedad !== undefined ? String(sociedad ?? "") : existingRecordObj.sociedad,
            nombre_realiza_queja: nombre_realiza_queja !== undefined ? String(nombre_realiza_queja ?? "") : existingRecordObj.nombre_realiza_queja,
            cliente: cliente !== undefined ? String(cliente ?? "") : existingRecordObj.cliente,
            empresa_presenta_queja: empresa_presenta_queja !== undefined ? String(empresa_presenta_queja ?? "") : existingRecordObj.empresa_presenta_queja,
            persona_presenta_queja: persona_presenta_queja !== undefined ? String(persona_presenta_queja ?? "") : existingRecordObj.persona_presenta_queja,
            medio_recepcion_queja: medio_recepcion_queja !== undefined ? String(medio_recepcion_queja ?? "") : existingRecordObj.medio_recepcion_queja,
            tipo_queja: tipo_queja !== undefined ? String(tipo_queja ?? "") : existingRecordObj.tipo_queja,
            ubicacion: ubicacion !== undefined ? String(ubicacion ?? "") : existingRecordObj.ubicacion,
            nivel_queja: nivel_queja !== undefined ? String(nivel_queja ?? "") : existingRecordObj.nivel_queja,
            fecha_queja: fecha_queja !== undefined ? String(fecha_queja ?? "") : existingRecordObj.fecha_queja,
            motivo_queja: motivo_queja !== undefined ? String(motivo_queja ?? "") : existingRecordObj.motivo_queja,
            descripcion_queja: descripcion_queja !== undefined ? String(descripcion_queja ?? "") : existingRecordObj.descripcion_queja,
            fecha_inicio: fecha_inicio !== undefined ? String(fecha_inicio ?? "") : existingRecordObj.fecha_inicio,
            fecha_revision: fecha_revision !== undefined ? String(fecha_revision ?? "") : existingRecordObj.fecha_revision,
            resolucion_queja: resolucion_queja !== undefined ? String(resolucion_queja ?? "") : existingRecordObj.resolucion_queja,
            estado: estado !== undefined ? String(estado ?? "") : existingRecordObj.estado,
            accion_correctiva_preventiva: accion_correctiva_preventiva !== undefined ? String(accion_correctiva_preventiva ?? "") : existingRecordObj.accion_correctiva_preventiva,
            firma_responsable: firma_responsable !== undefined ? String(firma_responsable ?? existingRecordObj.firma_responsable) : existingRecordObj.firma_responsable,
            empresa_id: bodyEmpresaId !== undefined ? pickNumericId(bodyEmpresaId, existingRecordObj.empresa_id) : existingRecordObj.empresa_id,
            cliente_id: bodyClienteId !== undefined ? pickNumericId(bodyClienteId, existingRecordObj.cliente_id) : existingRecordObj.cliente_id,
            contrato_id: bodyContratoId !== undefined ? pickNumericId(bodyContratoId, existingRecordObj.contrato_id) : existingRecordObj.contrato_id,
            corpo_id: bodyCorpoId !== undefined ? pickNumericId(bodyCorpoId, existingRecordObj.corpo_id) : existingRecordObj.corpo_id,
            puesto_id: bodyPuestoId !== undefined ? pickNumericId(bodyPuestoId, existingRecordObj.puesto_id) : existingRecordObj.puesto_id,
            plaza_id: bodyPlazaId !== undefined ? pickNumericId(bodyPlazaId, existingRecordObj.plaza_id) : existingRecordObj.plaza_id,
            division_id:
                bodyDivisionId !== undefined
                    ? pickNumericId(bodyDivisionId, existingRecordObj.division_id)
                    : existingRecordObj.division_id,
        };

        // Registrar cambios (solo campos actualizados, excluyendo firmas)
        const eq = (a: any, b: any) => {
            if (a === b) return true;
            if (a == null && b == null) return true;
            return false;
        };

        const cambiosArr: Array<{ prop: string; before: any; after: any }> = [];
        for (const [k, v] of Object.entries(updateData)) {
            // Excluir firmas
            if (k === "firma_responsable") continue;

            const before = existingRecordObj[k];
            const after = v;
            if (!eq(before, after)) {
                cambiosArr.push({
                    prop: k,
                    before: before,
                    after: after,
                });
            }
        }

        const updatedRecord = await callDynamicPrisma({
            req,
            data: {
                action: "UPDATE",
                table: "c_maestro_quejas",
                operation: "update",
                where: { id: complaintId },
                data: updateData,
            },
        });
        const updatedRecordObj = updatedRecord as any;

        // Registrar cambios si hay alguno
        if (cambiosArr.length > 0) {
            const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
            await callDynamicPrisma({
                req,
                data: {
                    action: "POST",
                    table: "c_cambios_apps_modules",
                    operation: "create",
                    data: {
                        nombre_tabla: "c_maestro_quejas",
                        registro_id: complaintId,
                        cambios: JSON.stringify(cambiosArr),
                        created_at: toZonedTime(new Date(), "America/Costa_Rica").toISOString(),
                        created_by: createdBy,
                    },
                },
            });
        }

        let filesParsed: ComplaintFileInput[] = [];
        if (archivos) {
            filesParsed = safeParseJson<ComplaintFileInput[]>(archivos, []);
        }

        // REEMPLAZO de adjuntos: borrar todos los existentes y luego crear los nuevos
        // (el cliente debe enviar en `archivos` tanto los existentes como los nuevos, como si se hubiesen adjuntado).
        const dir = path.join(process.cwd(), "public", "uploads", "complaints-master", `${updatedRecordObj.id}`);

        // DB
        await callDynamicPrisma({
            req,
            data: {
                action: "DELETE",
                table: "c_anexos_quejas",
                operation: "deleteMany",
                where: { queja_id: updatedRecordObj.id },
            },
        });
        // FS
        if (fs.existsSync(dir)) {
            try {
                fs.rmSync(dir, { recursive: true, force: true });
            } catch {
                // ignore
            }
        }

        if (filesParsed.length > 0) {
            const uploadResp = await uploadDynamicFiles({
                req,
                folderPath: `complaints-master/${updatedRecordObj.id}`,
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
                            queja_id: updatedRecordObj.id,
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
                where: { id: updatedRecordObj.id },
                include: { c_anexos_quejas: true },
            },
        });

        const fullRecordObj = fullRecord as any;
        const baseUrl = req.nextUrl.origin;
        const mapped = mapComplaintMasterPublicRow(fullRecordObj ?? updatedRecordObj, baseUrl, updatedRecordObj.id);
        return NextResponse.json({
            status: true,
            message: "Queja actualizada correctamente",
            data: mapped,
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

export async function DELETE(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const { id } = resolvedParams;
        const complaintId = parseInt(id, 10);
        if (!complaintId) {
            return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });
        }

        const existingRecord = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_maestro_quejas",
                operation: "findUnique",
                where: { id: complaintId },
            },
        });

        if (!existingRecord) {
            return NextResponse.json(
                { status: false, message: "Registro no encontrado" },
                { status: 404 }
            );
        }

        const existingRecordObj = existingRecord as any;
        // Registrar cambio de eliminación antes de eliminar
        const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
        const createdAt = toZonedTime(new Date(), "America/Costa_Rica");
        await callDynamicPrisma({
            req,
            data: {
                action: "POST",
                table: "c_cambios_apps_modules",
                operation: "create",
                data: {
                    nombre_tabla: "c_maestro_quejas",
                    registro_id: complaintId,
                    cambios: JSON.stringify([{
                        prop: "__deleted__",
                        before: {
                            id: existingRecordObj.id,
                            empresa_id: existingRecordObj.empresa_id,
                            cliente_id: existingRecordObj.cliente_id,
                            corpo_id: existingRecordObj.corpo_id,
                            puesto_id: existingRecordObj.puesto_id,
                            sociedad: existingRecordObj.sociedad,
                            nombre_realiza_queja: existingRecordObj.nombre_realiza_queja,
                            cliente: existingRecordObj.cliente,
                            empresa_presenta_queja: existingRecordObj.empresa_presenta_queja,
                            persona_presenta_queja: existingRecordObj.persona_presenta_queja,
                            medio_recepcion_queja: existingRecordObj.medio_recepcion_queja,
                            tipo_queja: existingRecordObj.tipo_queja,
                            ubicacion: existingRecordObj.ubicacion,
                            nivel_queja: existingRecordObj.nivel_queja,
                            fecha_queja: existingRecordObj.fecha_queja,
                            motivo_queja: existingRecordObj.motivo_queja,
                            descripcion_queja: existingRecordObj.descripcion_queja,
                            fecha_inicio: existingRecordObj.fecha_inicio,
                            fecha_revision: existingRecordObj.fecha_revision,
                            resolucion_queja: existingRecordObj.resolucion_queja,
                            estado: existingRecordObj.estado,
                            accion_correctiva_preventiva: existingRecordObj.accion_correctiva_preventiva,
                        },
                        after: null,
                    }]),
                    created_at: createdAt.toISOString(),
                    created_by: createdBy,
                },
            },
        });

        await callDynamicPrisma({
            req,
            data: {
                action: "DELETE",
                table: "c_maestro_quejas",
                operation: "delete",
                where: { id: complaintId },
            },
        });

        const dir = path.join(process.cwd(), "public", "uploads", "complaints-master", `${complaintId}`);
        if (fs.existsSync(dir)) {
            try {
                fs.rmSync(dir, { recursive: true, force: true });
            } catch {
                // ignore
            }
        }

        return NextResponse.json({
            status: true,
            message: "Queja eliminada correctamente"
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

