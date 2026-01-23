import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../utils/verifyToken";
import { prisma } from "../../../utils/prismaClient";
import { toZonedTime } from "date-fns-tz";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import { getUserMarca } from "../../../utils/getUserMarca";
import { sendNotificationByPlaza } from "../../../utils/sendNotification";

type ManualFileInput = {
    type: string; // 'image' | 'audio' | 'video' | 'document' | etc
    extension: string; // e.g. 'png', 'mp4', 'pdf'
    original_name?: string; // nombre original del archivo (para mostrar en app)
    file_base64: string;
};

export async function GET(req: NextRequest) {
    try {
        const { valid, expired, payload, message } = verifyAccessToken(req);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const marcaId = req.nextUrl.searchParams.get("m");
        if (!marcaId) {
            return NextResponse.json(
                { status: false, message: "Marca no especificada" },
                { status: 200 }
            );
        }

        const marca = await prisma.c_marca_dia.findUnique({
            where: { id: parseInt(marcaId) }
        });
        if (!marca) {
            return NextResponse.json(
                { status: false, message: "Marca no encontrada" },
                { status: 200 }
            );
        }

        if (!marca.empleadoFijo_id) {
            return NextResponse.json(
                { status: false, message: "Empleado no encontrado" },
                { status: 200 }
            );
        }

        const lastMarca = await getUserMarca(marca.empleadoFijo_id);

        if (!lastMarca) {
            return NextResponse.json(
                { status: false, message: "No se encontró la última marca" },
                { status: 200 }
            );
        }

        if (marca.id !== lastMarca.id) {
            return NextResponse.json(
                { status: false, message: "Hay una nueva marca más reciente" },
                { status: 200 }
            );
        }

        const puesto = await prisma.e_estructura_puesto.findUnique({
            where: { id: marca.puesto_id }
        });

        if (!puesto) {
            return NextResponse.json(
                { status: false, message: "Puesto no encontrado" },
                { status: 200 }
            );
        }

        const employeeId = payload.id as number;

        // Obtener manuales asociados al puesto mediante la tabla de relación
        const manualLinks = await (prisma as any).e_puestos_manual_puesto.findMany({
            where: { puesto_id: puesto.id }
        });

        const manualIdsSet = new Set<number>();
        (manualLinks as any[]).forEach((link) => {
            if (link.manual_puesto_id) {
                manualIdsSet.add(link.manual_puesto_id);
            }
        });

        // Compatibilidad hacia atrás: también incluir manuales que tengan puesto_id directamente
        const directManuals = await (prisma as any).e_manual_puesto.findMany({
            where: { puesto_id: puesto.id }
        });
        (directManuals as any[]).forEach((manual) => {
            if (manual.id) {
                manualIdsSet.add(manual.id);
            }
        });

        const manualIds = Array.from(manualIdsSet);

        if (manualIds.length === 0) {
            return NextResponse.json(
                { status: true, manuals: [] },
                { status: 200 }
            );
        }

        const manuals = await (prisma as any).e_manual_puesto.findMany({
            where: { id: { in: manualIds } },
            orderBy: { created_at: "desc" }
        });

        // Usar el origin de la petición para construir URLs absolutas accesibles desde el móvil
        const baseUrl = req.nextUrl.origin;

        const manualsWithFiles = await Promise.all(
            (manuals as any[]).map(async (manual) => {
                const files = await (prisma as any).e_archivos_manual_puesto.findMany({
                    where: { manual_puesto_id: manual.id }
                });

                const visualizaciones = await (prisma as any)
                    .e_empleado_visualizacion_manual_puesto.findMany({
                        where: { manual_puesto_id: manual.id },
                        include: { e_empleado_visualizacion_archivos: true },
                    });

                const currentEmployeeSigned = (visualizaciones as any[]).some(
                    (v: any) => v.empleado_id === employeeId
                );

                const filesMapped = (files as any[]).map((file) => {
                    const fileName = file.name;

                    // Construir URLs hacia las APIs específicas, similar a incidents
                    let urlPath = `/uploads/job-manuals/${manual.id}/${fileName}`;
                    if (file.type === 'image') {
                        urlPath = `/api/job-manuals/${manual.id}/get-image/${fileName}`;
                    } else if (file.type === 'audio') {
                        urlPath = `/api/job-manuals/${manual.id}/get-audio/${fileName}`;
                    } else if (file.type === 'video') {
                        urlPath = `/api/job-manuals/${manual.id}/get-video/${fileName}`;
                    } else {
                        urlPath = `/api/job-manuals/${manual.id}/get-file/${fileName}`;
                    }

                    const url = `${baseUrl}${urlPath}`;

                    return {
                        id: file.id,
                        name: file.name,
                        original_name: file.original_name,
                        type: file.type,
                        extension: file.extension,
                        url
                    };
                });

                const visFilesMappedByVisId = new Map<number, any[]>();
                (visualizaciones as any[]).forEach((v: any) => {
                    const arr = (v?.e_empleado_visualizacion_archivos || []) as any[];
                    const mapped = arr.map((file) => {
                        const fileName = file.name;
                        let urlPath = `/uploads/job-manuals/${manual.id}/visualizaciones/${v.id}/${fileName}`;
                        if (file.type === 'image') {
                            urlPath = `/api/job-manuals/${manual.id}/visualizations/${v.id}/get-image/${fileName}`;
                        } else if (file.type === 'audio') {
                            urlPath = `/api/job-manuals/${manual.id}/visualizations/${v.id}/get-audio/${fileName}`;
                        } else if (file.type === 'video') {
                            urlPath = `/api/job-manuals/${manual.id}/visualizations/${v.id}/get-video/${fileName}`;
                        } else {
                            urlPath = `/api/job-manuals/${manual.id}/visualizations/${v.id}/get-file/${fileName}`;
                        }

                        const url = `${baseUrl}${urlPath}`;

                        return {
                            id: file.id,
                            name: file.name,
                            original_name: file.original_name,
                            type: file.type,
                            extension: file.extension,
                            url
                        };
                    });
                    visFilesMappedByVisId.set(v.id, mapped);
                });

                return {
                    id: manual.id,
                    title: manual.title,
                    description: manual.description,
                    quiz: manual.quiz ?? null,
                    firma: manual.firma,
                    // Para el cliente móvil, mostramos el puesto actual del colaborador
                    puesto: {
                        id: puesto.id,
                        nombre: puesto.nombre
                    },
                    created_by: manual.created_by,
                    created_at: manual.created_at,
                    files: filesMapped,
                    visualizaciones: (visualizaciones as any[]).map((v: any) => ({
                        id: v.id,
                        empleado_id: v.empleado_id,
                        manual_puesto_id: v.manual_puesto_id,
                        nombre_empleado: v.nombre_empleado,
                        firma_empleado: v.firma_empleado,
                        quiz_answear: v.quiz_answear ?? null,
                        approved: v.approved ?? null,
                        created_at: v.created_at,
                        updated_at: v.updated_at,
                        files: visFilesMappedByVisId.get(v.id) ?? [],
                    })),
                    currentEmployeeSigned
                };
            })
        );

        return NextResponse.json(
            { status: true, manuals: manualsWithFiles },
            { status: 200 }
        );
    } catch (error: unknown) {
        const errorMessage =
            error instanceof Error ? error.message : "Error desconocido";
        console.error("Error in GET /api/job-manuals:", errorMessage);
        return NextResponse.json(
            { status: false, message: errorMessage },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const { valid, expired, payload, message } = verifyAccessToken(req);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const {
            marca_id,
            title,
            description,
            firma_responsable,
            puestos,
            files,
            quiz
        } = await req.json();

        if (!marca_id || !title || !description || !firma_responsable) {
            return NextResponse.json(
                { status: false, message: "Datos incompletos" },
                { status: 200 }
            );
        }

        // Quiz: almacenar como string (array de objetos). Si viene vacío o inválido, guardar null.
        let quizToStore: string | null = null;
        if (typeof quiz === "string") {
            const trimmed = quiz.trim();
            if (trimmed.length > 0) {
                try {
                    const parsed = JSON.parse(trimmed);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        quizToStore = trimmed;
                    } else {
                        quizToStore = null;
                    }
                } catch {
                    // Si no es JSON válido, no rompemos creación: guardamos null
                    quizToStore = null;
                }
            }
        }

        const marca = await prisma.c_marca_dia.findUnique({
            where: { id: parseInt(marca_id) }
        });
        if (!marca) {
            return NextResponse.json(
                { status: false, message: "Marca no encontrada" },
                { status: 200 }
            );
        }

        const created_at = toZonedTime(
            new Date(),
            "America/Costa_Rica"
        ) as Date;

        const puestosParsed: number[] = puestos
            ? JSON.parse(puestos)
            : [marca.puesto_id];

        let filesParsed: ManualFileInput[] = [];
        if (files) {
            try {
                filesParsed = JSON.parse(files) as ManualFileInput[];
            } catch (err) {
                console.error("Error parsing files JSON:", err);
                return NextResponse.json(
                    {
                        status: false,
                        message: "Formato de archivos inválido"
                    },
                    { status: 200 }
                );
            }
        }

        const plazasIds: number[] = [];
        // Validar que todos los puestos existen
        for (const puestoId of puestosParsed) {
            const puesto = await prisma.e_estructura_puesto.findUnique({
                where: { id: puestoId }
            });
            if (!puesto) {
                return NextResponse.json(
                    { status: false, message: "Puesto no encontrado" },
                    { status: 200 }
                );
            }
            const plazas = await prisma.e_estructura_plazas.findMany({
                where: { puesto_id: puestoId }
            });
            for (const plaza of plazas) {
                if (!plazasIds.includes(plaza.id)) plazasIds.push(plaza.id);
            }
        }

        // Crear un único manual y luego asociarlo a múltiples puestos mediante e_puestos_manual_puesto
        const primaryPuestoId = puestosParsed[0];

        const manual = await (prisma as any).e_manual_puesto.create({
            data: {
                title,
                description,
                quiz: quizToStore,
                firma: firma_responsable,
                // Se mantiene el campo puesto_id por compatibilidad, usando el primer puesto
                puesto_id: primaryPuestoId,
                created_by: String(payload.id),
                created_at
            }
        });

        // Crear relaciones en e_puestos_manual_puesto para cada puesto seleccionado
        for (const puestoId of puestosParsed) {
            await (prisma as any).e_puestos_manual_puesto.create({
                data: {
                    manual_puesto_id: manual.id,
                    puesto_id: puestoId
                }
            });
        }

        // Guardar archivos una sola vez para el manual
        if (filesParsed.length > 0) {
            const dir = path.join(
                process.cwd(),
                "public",
                "uploads",
                "job-manuals",
                `${manual.id}`
            );
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            for (const file of filesParsed) {
                if (!file.file_base64 || !file.extension || !file.type) {
                    continue;
                }

                // Decodificar base64 directamente y capturar errores (evita regex/call stack con strings grandes)
                let buffer: Buffer;
                try {
                    buffer = Buffer.from(file.file_base64, "base64");
                } catch {
                    console.warn("Formato de archivo inválido, se omite uno de los archivos");
                    continue;
                }

                const fileName = `${uuidv4()}.${file.extension}`;
                const filePath = path.join(dir, fileName);
                fs.writeFileSync(filePath, buffer);

                const originalName =
                    (typeof file.original_name === "string" && file.original_name.trim().length > 0)
                        ? file.original_name.trim()
                        : fileName;
                console.log(4);
                await (prisma as any).e_archivos_manual_puesto.create({
                    data: {
                        name: fileName,
                        original_name: originalName,
                        type: file.type,
                        extension: file.extension,
                        manual_puesto_id: manual.id
                    }
                });
                console.log(5);
            }
        }

        const fecha_string = created_at.toISOString().split("T")[0];
        const hora_string = created_at.toISOString().split("T")[1].split(".")[0];

        sendNotificationByPlaza(marca.id, "Manual creado", `Se ha creado el manual ${title} para tu puesto el día ${fecha_string} a las ${hora_string}`, plazasIds);

        return NextResponse.json(
            {
                status: true,
                message: "Manual creado con éxito",
                manualIds: [manual.id]
            },
            { status: 200 }
        );
    } catch (error: unknown) {
        const errorMessage =
            error instanceof Error ? error.message : "Error desconocido";
        console.error("Error in POST /api/job-manuals:", errorMessage);
        return NextResponse.json(
            { status: false, message: errorMessage },
            { status: 500 }
        );
    }
}


