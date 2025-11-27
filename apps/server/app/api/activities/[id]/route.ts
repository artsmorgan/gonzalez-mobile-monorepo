import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../utils/verifyToken";
import { toZonedTime } from "date-fns-tz";
import { prisma } from "../../../../utils/prismaClient";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, payload, message } = verifyAccessToken(req);

        if (!valid) {
            return NextResponse.json(
                { status: false, message: message },
                { status: 401 }
            );
        }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);

        const { e, estado, bitacora, file } = await req.json();

        const empleado = await prisma.c_empleado.findUnique({ where: { id: e } });
        if (!empleado) {
            return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 200 });
        }

        const actividad_marcada = await prisma.e_actividad_corpo_plaza.findUnique({ where: { id } });
        if (!actividad_marcada) {
            return NextResponse.json({ status: false, message: "Marca de la actividad no encontrada" }, { status: 200 });
        }

        const actividad = await prisma.e_actividad_corpo.findUnique({ where: { id: actividad_marcada.actividadCorpo_id } });
        if (!actividad) {
            return NextResponse.json({ status: false, message: "Actividad no encontrada" }, { status: 200 });
        }

        if (estado === "marcar") {
            const marcado_exitoso = await prisma.e_actividad_corpo_plaza.updateMany({ where: { actividadCorpo_id: actividad.id, marcada: false }, data: { marcada: true, bitacora: bitacora, updated_at: toZonedTime(new Date(), "America/Costa_Rica") } });

            // Guardar imagen si existe
            if (file) {
                // Eliminar imagen si existe
                if (actividad_marcada.file_name) {
                    const path_file = path.join(process.cwd(), "public", "uploads", "activities", actividad_marcada.id.toString(), actividad_marcada.file_name);
                    if (fs.existsSync(path_file)) {
                        fs.unlinkSync(path_file);
                    }
                }

                // ejemplo de cadena base64: data:image/jpeg;base64,/9j/4AAQ...
                const matches = file.match(/^data:(.+);base64,(.+)$/);
                if (!matches) {
                    throw new Error("Formato base64 inválido");
                }

                const mimeType = matches[1];
                const base64Data = matches[2];
                const extension = mimeType.split("/")[1]; // ej. 'jpeg' o 'png'

                const id_file = uuidv4();
                const file_name = `${id_file}.${extension}`;

                const dir = path.join(
                    process.cwd(),
                    "public",
                    "uploads",
                    "activities",
                    `${actividad_marcada.id}`,
                );

                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }

                const filePath = path.join(dir, file_name);

                // Escribir el archivo en binario
                fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));

                // Guardar el nombre del archivo en la BD
                await prisma.e_actividad_corpo_plaza.update({
                    where: { id: actividad_marcada.id },
                    data: { file_name: file_name },
                });
            }

            return NextResponse.json({ status: true, message: "Actividad marcada correctamente" }, { status: 200 });
        }
        else {
            await prisma.e_actividad_corpo_plaza.update({ where: { id }, data: { marcada: false, updated_at: toZonedTime(new Date(), "America/Costa_Rica") } });

            return NextResponse.json({ status: true, message: "Actividad desmarcada correctamente" }, { status: 200 });
        }
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}