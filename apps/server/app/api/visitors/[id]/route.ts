import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../utils/verifyToken";
import { toZonedTime } from "date-fns-tz";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from 'uuid';

import { prisma } from "../../../../utils/prismaClient";

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, expired, payload, message } = verifyAccessToken(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);

        if (!id) {
            return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });
        }

        const {
            nombre,
            cedula,
            hora_entrada,
            hora_salida,
            razon_visita,
            es_funcionario,
            observaciones,
            tipo_accion,
            pers_autoriza_salida,
            foto_cedula, // viene en base64
            activos,
        } = await req.json();

        const visitor = await prisma.e_registro_personas.findUnique({ where: { id } });
        if (!visitor) {
            return NextResponse.json({ status: false, message: "Visita no encontrada" }, { status: 200 });
        }

        visitor.nombre = nombre;
        visitor.cedula = cedula;
        visitor.hora_entrada = new Date(hora_entrada);
        visitor.hora_salida = hora_salida ? new Date(hora_salida) : null;
        visitor.razon_visita = razon_visita;
        visitor.es_funcionario = es_funcionario;
        visitor.observaciones = observaciones;
        visitor.tipo_accion = tipo_accion;
        visitor.pers_autoriza_salida = pers_autoriza_salida;
        visitor.updated_at = toZonedTime(new Date(), "America/Costa_Rica");

        await prisma.e_registro_personas.update({ where: { id }, data: visitor });

        // Eliminar activos existentes
        await prisma.e_activo_visitante.deleteMany({ where: { visitante_id: visitor.id } });

        // Crear nuevos activos
        if (activos.length > 0) {
            for (const a of activos) {
                const tipo_activo = await prisma.n_tipo_activo_visitas.findUnique({ where: { id: a.tipo_id } });
                if (tipo_activo) {
                    await prisma.e_activo_visitante.create({
                        data: {
                            visitante_id: visitor.id,
                            tipo_id: tipo_activo.id,
                            detalles: JSON.stringify(a.detalles),
                            numero_serie: a.numero_serie,
                            numero_activo: a.numero_activo ? a.numero_activo : null,
                        },
                    });
                }
            }
        }

        console.log(foto_cedula);

        if (foto_cedula) {
            // Debo eliminar 
            if (visitor.foto_cedula) {
                const path_file = path.join(process.cwd(), "public", "uploads", "visitors", visitor.id.toString(), "cedula", visitor.foto_cedula);
                if (fs.existsSync(path_file)) {
                    fs.unlinkSync(path_file);
                }
            }

            const matches = foto_cedula.match(/^data:(.+);base64,(.+)$/);
            if (!matches) {
                throw new Error("Formato base64 inválido");
            }

            const mimeType = matches[1];
            const base64Data = matches[2];
            const extension = mimeType.split("/")[1]; // ej. 'jpeg' o 'png'

            const id_cedula = uuidv4();
            const file_name = `${id_cedula}.${extension}`;

            const dir = path.join(
                process.cwd(),
                "public",
                "uploads",
                "visitors",
                `${visitor.id}`,
                "cedula"
            );

            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            const filePath = path.join(dir, file_name);

            // Escribir el archivo en binario
            fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));

            // Guardar el nombre del archivo en la BD
            await prisma.e_registro_personas.update({
                where: { id: visitor.id },
                data: { foto_cedula: file_name },
            });
        }

        return NextResponse.json({ status: true, message: "Vehículo actualizado correctamente" }, { status: 200 });
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, expired, payload, message } = verifyAccessToken(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);

        if (!id) {
            return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });
        }

        await prisma.e_registro_personas.delete({ where: { id } });
        return NextResponse.json({ status: true, message: "Visita eliminada correctamente" }, { status: 200 });
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}
