import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { prisma } from "../../../../../utils/prismaClient";
import { toZonedTime } from "date-fns-tz";
import { sendNotificationByEmployee, sendNotificationByRole } from "../../../../../utils/sendNotification";
import fs from "fs";
import path from "path";
import { uploadDynamicFiles } from "../../../../../utils/callDynamicFilesApi";

export const runtime = "nodejs";

type VisualizationFileInput = {
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

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);

        if (!id) {
            return NextResponse.json(
                { status: false, message: "Manual no especificado" },
                { status: 200 }
            );
        }

        const manual = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "e_manual_puesto",
                operation: "findUnique",
                where: { id },
            },
        });
        if (!manual) {
            return NextResponse.json(
                { status: false, message: "Manual no encontrado" },
                { status: 200 }
            );
        }
        const manualObj = manual as any;
        if (manualObj.isActive === false) {
            return NextResponse.json(
                { status: false, message: "El manual no está disponible" },
                { status: 200 }
            );
        }

        const { firma_empleado, marca_id, quiz_answear, files } = await req.json();
        if (!firma_empleado || !marca_id) {
            return NextResponse.json(
                { status: false, message: "Firma del empleado requerida" },
                { status: 200 }
            );
        }

        // Parse de archivos similar a /api/job-manuals (estricto: si viene inválido, devolver error)
        let filesParsed: VisualizationFileInput[] = [];
        if (files) {
            try {
                if (typeof files === "string") {
                    filesParsed = JSON.parse(files) as VisualizationFileInput[];
                } else if (Array.isArray(files)) {
                    filesParsed = files as VisualizationFileInput[];
                } else {
                    filesParsed = [];
                }
            } catch (err) {
                console.error("Error parsing files JSON (sign):", err);
                return NextResponse.json(
                    { status: false, message: "Formato de archivos inválido" },
                    { status: 200 }
                );
            }
        }

        const marca = await prisma.c_marca_dia.findUnique({
            where: { id: marca_id },
        });
        if (!marca) {
            return NextResponse.json(
                { status: false, message: "Marca no encontrada" },
                { status: 200 }
            );
        }

        const marcaObj = marca as any;
        const empleadoId = marcaObj.empleadoFijo_id;
        if (!empleadoId) {
            return NextResponse.json(
                { status: false, message: "Empleado no encontrado" },
                { status: 200 }
            );
        }

        const empleado = await prisma.c_empleado.findUnique({
            where: { id: empleadoId },
        });

        if (!empleado) {
            return NextResponse.json(
                { status: false, message: "Empleado no encontrado" },
                { status: 200 }
            );
        }

        const empleadoObj = empleado as any;
        const puesto = await prisma.e_estructura_puesto.findUnique({
            where: { id: manualObj.puesto_id },
        });
        if (!puesto) {
            return NextResponse.json(
                { status: false, message: "Puesto no encontrado" },
                { status: 200 }
            );
        }

        const puestoObj = puesto as any;
        const corpo = await prisma.e_estructura_sucursal.findUnique({
            where: { id: marcaObj.corpo_id },
        });
        if (!corpo) {
            return NextResponse.json(
                { status: false, message: "Sucursal no encontrada" },
                { status: 200 }
            );
        }

        const corpoObj = corpo as any;
        // Evitar firmas duplicadas del mismo empleado para el mismo manual
        const existing = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "e_empleado_visualizacion_manual_puesto",
                operation: "findFirst",
                where: {
                    empleado_id: empleadoId,
                    manual_puesto_id: id,
                }
            },
        });

        const created_at = toZonedTime(
            new Date(),
            "America/Costa_Rica"
        ) as Date;

        // Si ya firmó antes, eliminar el registro para crear uno nuevo (permite reintentos/revisión de quiz)
        if (existing) {
            const existingObj = existing as any;
            // borrar archivos físicos asociados a la visualización anterior (si existieran)
            const oldDir = path.join(
                process.cwd(),
                "public",
                "uploads",
                "job-manuals",
                `${id}`,
                "visualizaciones",
                `${existingObj.id}`
            );
            if (fs.existsSync(oldDir)) {
                try {
                    fs.rmSync(oldDir, { recursive: true, force: true });
                } catch {
                    // ignore
                }
            }
            await callDynamicPrisma({
                req,
                data: {
                    action: "DELETE",
                    table: "e_empleado_visualizacion_manual_puesto",
                    operation: "delete",
                    where: { id: existingObj.id },
                },
            });
        }

        const quizAnswearToStore =
            typeof quiz_answear === "string" && quiz_answear.trim().length > 0
                ? quiz_answear.trim()
                : null;

        const createdVis = await callDynamicPrisma({
            req,
            data: {
                action: "POST",
                table: "e_empleado_visualizacion_manual_puesto",
                operation: "create",
                data: {
                    empleado_id: empleadoId,
                    manual_puesto_id: id,
                    nombre_empleado: `${empleadoObj.nombre} ${empleadoObj.primer_apellido} ${empleadoObj.segundo_apellido}`,
                    firma_empleado,
                    quiz_answear: quizAnswearToStore,
                    approved: null,
                    created_at: created_at.toISOString(),
                    updated_at: created_at.toISOString()
                }
            }
        });
        const createdVisObj = createdVis as any;

        // Guardar archivos adjuntos (opcional), delegando a /api/dynamic-prisma/files
        if (filesParsed.length > 0) {
            const uploadResp = await uploadDynamicFiles({
                req,
                folderPath: `job-manuals/${id}/visualizaciones/${createdVisObj.id}`,
                files: filesParsed.map((f) => ({
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
                        table: "e_empleado_visualizacion_archivos",
                        operation: "create",
                        data: {
                            name: uploaded.name,
                            original_name: uploaded.original_name || uploaded.name,
                            type: String(uploaded.type),
                            extension: uploaded.extension,
                            visualizacion_id: createdVisObj.id,
                        }
                    }
                });
            }
        }

        const fecha_string = created_at.toISOString().split("T")[0];
        const hora_string = created_at.toISOString().split("T")[1].split(".")[0];
        const description = `El empleado ${empleadoObj.nombre} ${empleadoObj.primer_apellido} ${empleadoObj.segundo_apellido} ha firmado el manual ${manualObj.title} desde el puesto ${puestoObj.nombre} en la sucursal ${corpoObj.nombre} el día ${fecha_string} a las ${hora_string}`;
        // Notificaciones NO deben bloquear la firma (si fallan, solo registrar warning)
        try {
            await sendNotificationByRole(req, marcaObj.corpo_id, [marcaObj.plaza_id], "Firma de manual", description, ["ADMINISTRATIVO", "SUPERVISOR"]);
        } catch (err) {
            console.warn("Fallo enviando notificación por rol (no bloquea la firma):", err);
        }

        const creator = await prisma.c_empleado.findUnique({
            where: { id: parseInt(manualObj.created_by) },
        });

        if (creator) {
            const creatorObj = creator as any;
            const description = `El empleado ${creatorObj.nombre} ${creatorObj.primer_apellido} ${creatorObj.segundo_apellido} ha firmado el manual ${manualObj.title} desde el puesto ${puestoObj.nombre} en la sucursal ${corpoObj.nombre} el día ${fecha_string} a las ${hora_string}`;
            try {
                await sendNotificationByEmployee(req, marcaObj.corpo_id, [creatorObj.id], "Firma de manual", description, [creatorObj.id]);
            } catch (err) {
                console.warn("Fallo enviando notificación al creador (no bloquea la firma):", err);
            }
        }

        return NextResponse.json(
            {
                status: true,
                message: "Manual firmado correctamente",
                id: createdVisObj.id,
                visualizacion_id: createdVisObj.id,
            },
            { status: 200 }
        );
    } catch (error: unknown) {
        const errorMessage =
            error instanceof Error ? error.message : "Error desconocido";
        console.error(
            "Error in POST /api/job-manuals/[id]/sign:",
            errorMessage
        );
        return NextResponse.json(
            { status: false, message: errorMessage },
            { status: 500 }
        );
    }
}


