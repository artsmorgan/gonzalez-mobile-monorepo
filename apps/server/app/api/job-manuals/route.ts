import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../utils/verifyToken";
import { prisma } from "../../../utils/prismaClient";
import { toZonedTime } from "date-fns-tz";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";

type ManualFileInput = {
    type: string; // 'image' | 'audio' | 'video' | 'document' | etc
    extension: string; // e.g. 'png', 'mp4', 'pdf'
    file_base64: string;
};

export async function GET(req: NextRequest) {
    try {
        const { valid, payload, message } = verifyAccessToken(req);
        if (!valid) {
            return NextResponse.json(
                { status: false, message },
                { status: 401 }
            );
        }

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

        const lastMarca = await prisma.c_marca_dia.findFirst({
            where: { empleadoFijo_id: marca.empleadoFijo_id },
            orderBy: { id: "desc" }
        });

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

        const manuals = await (prisma as any).e_manual_puesto.findMany({
            where: { puesto_id: puesto.id },
            orderBy: { created_at: "desc" }
        });

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";

        const manualsWithFiles = await Promise.all(
            (manuals as any[]).map(async (manual) => {
                const files = await (prisma as any).e_archivos_manual_puesto.findMany({
                    where: { manual_puesto_id: manual.id }
                });

                const visualizaciones = await (prisma as any)
                    .e_empleado_visualizacion_manual_puesto.findMany({
                        where: { manual_puesto_id: manual.id }
                    });

                const currentEmployeeSigned = (visualizaciones as any[]).some(
                    (v: any) => v.empleado_id === employeeId
                );

                const filesMapped = (files as any[]).map((file) => {
                    const fileName = file.name;
                    const urlPath = `/uploads/job-manuals/${manual.id}/${fileName}`;
                    const url = baseUrl ? `${baseUrl}${urlPath}` : urlPath;

                    return {
                        id: file.id,
                        name: file.name,
                        type: file.type,
                        extension: file.extension,
                        url
                    };
                });

                return {
                    id: manual.id,
                    title: manual.title,
                    description: manual.description,
                    firma: manual.firma,
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
                        created_at: v.created_at
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
        const { valid, payload, message } = verifyAccessToken(req);
        if (!valid) {
            return NextResponse.json(
                { status: false, message },
                { status: 401 }
            );
        }

        const {
            marca_id,
            title,
            description,
            firma_responsable,
            puestos,
            files
        } = await req.json();

        if (!marca_id || !title || !description || !firma_responsable) {
            return NextResponse.json(
                { status: false, message: "Datos incompletos" },
                { status: 200 }
            );
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

        const createdManualIds: number[] = [];

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

            const manual = await (prisma as any).e_manual_puesto.create({
                data: {
                    title,
                    description,
                    firma: firma_responsable,
                    puesto_id: puesto.id,
                    created_by: String(payload.id),
                    created_at
                }
            });

            createdManualIds.push(manual.id);

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

                    if (!/^[A-Za-z0-9+/=]+$/.test(file.file_base64)) {
                        console.warn(
                            "Formato de archivo inválido, se omite uno de los archivos"
                        );
                        continue;
                    }

                    const fileName = `${uuidv4()}.${file.extension}`;
                    const buffer = Buffer.from(file.file_base64, "base64");
                    const filePath = path.join(dir, fileName);
                    fs.writeFileSync(filePath, buffer);

                    await (prisma as any).e_archivos_manual_puesto.create({
                        data: {
                            name: fileName,
                            type: file.type,
                            extension: file.extension,
                            manual_puesto_id: manual.id
                        }
                    });
                }
            }
        }

        return NextResponse.json(
            {
                status: true,
                message: "Manual(es) creado(s) con éxito",
                manualIds: createdManualIds
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


