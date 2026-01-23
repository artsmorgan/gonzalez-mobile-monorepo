import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../../utils/verifyToken";
import { prisma } from "../../../../../utils/prismaClient";
import { toZonedTime } from "date-fns-tz";
import { sendNotificationByEmployee, sendNotificationByRole } from "../../../../../utils/sendNotification";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

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

function normalizeBase64(b64: string): string {
    // acepta "data:...;base64,AAAA" o "AAAA"
    if (!b64) return "";
    const idx = b64.indexOf("base64,");
    if (idx !== -1) return b64.slice(idx + "base64,".length);
    return b64;
}

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { valid, expired, payload, message } = verifyAccessToken(req);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);

        if (!id) {
            return NextResponse.json(
                { status: false, message: "Manual no especificado" },
                { status: 200 }
            );
        }

        const manual = await prisma.e_manual_puesto.findUnique({
            where: { id }
        });
        if (!manual) {
            return NextResponse.json(
                { status: false, message: "Manual no encontrado" },
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
            where: { id: marca_id }
        });
        if (!marca) {
            return NextResponse.json(
                { status: false, message: "Marca no encontrada" },
                { status: 200 }
            );
        }

        const empleadoId = marca.empleadoFijo_id;
        if (!empleadoId) {
            return NextResponse.json(
                { status: false, message: "Empleado no encontrado" },
                { status: 200 }
            );
        }

        const empleado = await prisma.c_empleado.findUnique({
            where: { id: empleadoId }
        });

        if (!empleado) {
            return NextResponse.json(
                { status: false, message: "Empleado no encontrado" },
                { status: 200 }
            );
        }

        const puesto = await prisma.e_estructura_puesto.findUnique({
            where: { id: manual.puesto_id }
        });
        if (!puesto) {
            return NextResponse.json(
                { status: false, message: "Puesto no encontrado" },
                { status: 200 }
            );
        }

        const corpo = await prisma.e_estructura_sucursal.findUnique({
            where: { id: marca.corpo_id }
        });
        if (!corpo) {
            return NextResponse.json(
                { status: false, message: "Sucursal no encontrada" },
                { status: 200 }
            );
        }

        // Evitar firmas duplicadas del mismo empleado para el mismo manual
        const existing = await prisma.e_empleado_visualizacion_manual_puesto.findFirst(
            {
                where: {
                    empleado_id: empleadoId,
                    manual_puesto_id: id
                }
            }
        );

        const created_at = toZonedTime(
            new Date(),
            "America/Costa_Rica"
        ) as Date;

        // Si ya firmó antes, eliminar el registro para crear uno nuevo (permite reintentos/revisión de quiz)
        if (existing) {
            // borrar archivos físicos asociados a la visualización anterior (si existieran)
            const oldDir = path.join(
                process.cwd(),
                "public",
                "uploads",
                "job-manuals",
                `${id}`,
                "visualizaciones",
                `${existing.id}`
            );
            if (fs.existsSync(oldDir)) {
                try {
                    fs.rmSync(oldDir, { recursive: true, force: true });
                } catch {
                    // ignore
                }
            }
            await prisma.e_empleado_visualizacion_manual_puesto.delete({
                where: { id: existing.id }
            });
        }

        const quizAnswearToStore =
            typeof quiz_answear === "string" && quiz_answear.trim().length > 0
                ? quiz_answear.trim()
                : null;

        const createdVis = await prisma.e_empleado_visualizacion_manual_puesto.create({
            data: {
                empleado_id: empleadoId,
                manual_puesto_id: id,
                nombre_empleado: `${empleado.nombre} ${empleado.primer_apellido} ${empleado.segundo_apellido}`,
                firma_empleado,
                quiz_answear: quizAnswearToStore,
                approved: null,
                created_at,
                updated_at: created_at
            }
        });

        // Guardar archivos adjuntos (opcional)
        if (filesParsed.length > 0) {
            const dir = path.join(
                process.cwd(),
                "public",
                "uploads",
                "job-manuals",
                `${id}`,
                "visualizaciones",
                `${createdVis.id}`
            );
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            for (const f of filesParsed) {
                if (!f?.file_base64 || !f?.extension || !f?.type) continue;

                let buffer: Buffer;
                try {
                    buffer = Buffer.from(normalizeBase64(String(f.file_base64)), "base64");
                } catch {
                    console.warn("Formato de archivo inválido, se omite uno de los archivos");
                    continue;
                }

                const ext = String(f.extension).replace(".", "").trim() || "dat";
                const fileName = `${uuidv4()}.${ext}`;
                const filePath = path.join(dir, fileName);
                fs.writeFileSync(filePath, buffer);

                const originalName =
                    (typeof f.original_name === "string" && f.original_name.trim().length > 0)
                        ? f.original_name.trim()
                        : fileName;

                await prisma.e_empleado_visualizacion_archivos.create({
                    data: {
                        name: fileName,
                        original_name: originalName,
                        type: String(f.type),
                        extension: ext,
                        visualizacion_id: createdVis.id,
                    },
                });
            }
        }

        const fecha_string = created_at.toISOString().split("T")[0];
        const hora_string = created_at.toISOString().split("T")[1].split(".")[0];
        const description = `El empleado ${empleado.nombre} ${empleado.primer_apellido} ${empleado.segundo_apellido} ha firmado el manual ${manual.title} desde el puesto ${puesto.nombre} en la sucursal ${corpo.nombre} el día ${fecha_string} a las ${hora_string}`;
        // Notificaciones NO deben bloquear la firma (si fallan, solo registrar warning)
        try {
            await sendNotificationByRole(marca.corpo_id, [marca.plaza_id], "Firma de manual", description, ["ADMINISTRATIVO", "SUPERVISOR"]);
        } catch (err) {
            console.warn("Fallo enviando notificación por rol (no bloquea la firma):", err);
        }

        const creator = await prisma.c_empleado.findUnique({
            where: { id: parseInt(manual.created_by) }
        });

        if (creator) {
            const description = `El empleado ${creator.nombre} ${creator.primer_apellido} ${creator.segundo_apellido} ha firmado el manual ${manual.title} desde el puesto ${puesto.nombre} en la sucursal ${corpo.nombre} el día ${fecha_string} a las ${hora_string}`;
            try {
                await sendNotificationByEmployee(marca.corpo_id, [creator.id], "Firma de manual", description, [creator.id]);
            } catch (err) {
                console.warn("Fallo enviando notificación al creador (no bloquea la firma):", err);
            }
        }

        return NextResponse.json(
            { status: true, message: "Manual firmado correctamente", visualizacion_id: createdVis.id },
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


