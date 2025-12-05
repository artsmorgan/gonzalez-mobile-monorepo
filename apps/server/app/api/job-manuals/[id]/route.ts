import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../utils/verifyToken";
import { prisma } from "../../../../utils/prismaClient";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

type ManualFileInput = {
    type: string;
    extension: string;
    file_base64: string;
};

export async function PUT(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { valid, message } = verifyAccessToken(req);
        if (!valid) {
            return NextResponse.json(
                { status: false, message },
                { status: 401 }
            );
        }

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

        const {
            title,
            description,
            firma_responsable,
            filesToDelete,
            newFiles
        } = await req.json();

        await prisma.e_manual_puesto.update({
            where: { id },
            data: {
                title: title ?? manual.title,
                description: description ?? manual.description,
                firma: firma_responsable ?? manual.firma
            }
        });

        if (Array.isArray(filesToDelete) && filesToDelete.length > 0) {
            const files = await prisma.e_archivos_manual_puesto.findMany({
                where: { id: { in: filesToDelete }, manual_puesto_id: id }
            });

            const dir = path.join(
                process.cwd(),
                "public",
                "uploads",
                "job-manuals",
                `${id}`
            );

            for (const file of files) {
                const filePath = path.join(dir, file.name);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }

            await prisma.e_archivos_manual_puesto.deleteMany({
                where: { id: { in: filesToDelete }, manual_puesto_id: id }
            });
        }

        if (newFiles) {
            let filesParsed: ManualFileInput[] = [];
            try {
                filesParsed = JSON.parse(newFiles) as ManualFileInput[];
            } catch (err) {
                console.error("Error parsing newFiles JSON:", err);
                return NextResponse.json(
                    {
                        status: false,
                        message: "Formato de archivos inválido"
                    },
                    { status: 200 }
                );
            }

            if (filesParsed.length > 0) {
                const dir = path.join(
                    process.cwd(),
                    "public",
                    "uploads",
                    "job-manuals",
                    `${id}`
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

                    await prisma.e_archivos_manual_puesto.create({
                        data: {
                            name: fileName,
                            type: file.type,
                            extension: file.extension,
                            manual_puesto_id: id
                        }
                    });
                }
            }
        }

        return NextResponse.json(
            { status: true, message: "Manual actualizado con éxito" },
            { status: 200 }
        );
    } catch (error: unknown) {
        const errorMessage =
            error instanceof Error ? error.message : "Error desconocido";
        console.error("Error in PUT /api/job-manuals/[id]:", errorMessage);
        return NextResponse.json(
            { status: false, message: errorMessage },
            { status: 500 }
        );
    }
}

export async function DELETE(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { valid, message } = verifyAccessToken(req);
        if (!valid) {
            return NextResponse.json(
                { status: false, message },
                { status: 401 }
            );
        }

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

        await prisma.e_manual_puesto.delete({ where: { id } });

        const dir = path.join(
            process.cwd(),
            "public",
            "uploads",
            "job-manuals",
            `${id}`
        );
        if (fs.existsSync(dir)) {
            fs.rmSync(dir, { recursive: true, force: true });
        }

        return NextResponse.json(
            { status: true, message: "Manual eliminado con éxito" },
            { status: 200 }
        );
    } catch (error: unknown) {
        const errorMessage =
            error instanceof Error ? error.message : "Error desconocido";
        console.error("Error in DELETE /api/job-manuals/[id]:", errorMessage);
        return NextResponse.json(
            { status: false, message: errorMessage },
            { status: 500 }
        );
    }
}


