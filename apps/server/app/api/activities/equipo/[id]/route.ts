import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../../utils/verifyToken";
import { toZonedTime } from "date-fns-tz";
import { prisma } from "../../../../../utils/prismaClient";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";

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

        const { e, es_correcto, motivo_incorrecto, file } = await req.json();

        const empleado = await prisma.c_empleado.findUnique({ where: { id: e } });
        if (!empleado) {
            return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 200 });
        }

        const revision_equipo = await prisma.e_actividad_corpo_revision_equipo.findUnique({ where: { id } });
        if (!revision_equipo) {
            return NextResponse.json({ status: false, message: "Revision de equipo no encontrado" }, { status: 200 });
        }

        await prisma.e_actividad_corpo_revision_equipo.update({
            where: { id },
            data: {
                es_correcto: es_correcto,
                marcada: true,
                motivo_incorrecto: motivo_incorrecto,
                updated_at: toZonedTime(new Date(), "America/Costa_Rica")
            }
        });


        if (file) {
            // Eliminar imagen si existe
            if (revision_equipo.file_name) {
                const path_file = path.join(process.cwd(), "public", "uploads", "activities", "equipo", revision_equipo.id.toString(), revision_equipo.file_name);
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
                "equipo",
                `${revision_equipo.id}`,
            );

            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            const filePath = path.join(dir, file_name);

            // Escribir el archivo en binario
            fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));

            // Guardar el nombre del archivo en la BD
            await prisma.e_actividad_corpo_revision_equipo.update({
                where: { id: revision_equipo.id },
                data: { file_name: file_name },
            });
        }

        const actividad_marcada = await prisma.e_actividad_corpo_plaza.findUnique({ where: { id: revision_equipo.actividadCorpoPlaza_id } });
        if (!actividad_marcada) {
            return NextResponse.json({ status: false, message: "Actividad marcada no encontrada" }, { status: 200 });
        }

        const actividad = await prisma.e_actividad_corpo.findUnique({ where: { id: actividad_marcada.actividadCorpo_id } });
        if (!actividad) {
            return NextResponse.json({ status: false, message: "Actividad no encontrada" }, { status: 200 });
        }

        const actividades_pending = await prisma.e_actividad_corpo_plaza.findMany({ where: { actividadCorpo_id: actividad.id, marcada: false } });
        if (actividades_pending && actividades_pending.length > 0) {
            const all_revision_equipo_pending = await prisma.e_actividad_corpo_revision_equipo.findMany({ where: { actividadCorpoPlaza_id: { in: actividades_pending.map((item) => item.id) }, articulo_id: revision_equipo.articulo_id, marcada: false } });
            if (all_revision_equipo_pending && all_revision_equipo_pending.length > 0) {
                await prisma.e_actividad_corpo_revision_equipo.updateMany({
                    where: {
                        id: { in: all_revision_equipo_pending.map((item) => item.id) }
                    },
                    data: {
                        es_correcto: es_correcto,
                        marcada: true,
                        motivo_incorrecto: motivo_incorrecto,
                        updated_at: toZonedTime(new Date(), "America/Costa_Rica")
                    }
                });
            }

            for (const actividad_pending of actividades_pending) {
                const all_revision_equipo_pending = await prisma.e_actividad_corpo_revision_equipo.findMany({ where: { actividadCorpoPlaza_id: actividad_pending.id, marcada: false } });
                if (all_revision_equipo_pending && all_revision_equipo_pending.length === 0) {
                    await prisma.e_actividad_corpo_plaza.update({ where: { id: actividad_pending.id }, data: { marcada: true, updated_at: toZonedTime(new Date(), "America/Costa_Rica") } });
                }
            }
        }

        return NextResponse.json({ status: true, message: "Revision de equipo actualizada correctamente" }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}