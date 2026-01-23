import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../../utils/verifyToken";
import { prisma } from "../../../../../utils/prismaClient";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { sendNotificationByEmployee, sendNotificationByPlaza } from "../../../../../utils/sendNotification";

export const runtime = "nodejs";

function normalizeBase64(b64: string): string {
    if (!b64) return "";
    const idx = b64.indexOf("base64,");
    if (idx !== -1) return b64.slice(idx + "base64,".length);
    return b64;
}

export async function PUT(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { valid, expired, payload, message } = verifyAccessToken(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const { id } = resolvedParams;
        const intercambioLineaId = parseInt(String(id), 10);
        if (!intercambioLineaId) {
            return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 400 });
        }

        const { file_base64, extension, original_name, type, mimeType } = await req.json();

        if (!file_base64 || !extension) {
            return NextResponse.json({ status: false, message: "Archivo no válido" }, { status: 400 });
        }

        const existingRecord = await prisma.c_intercambio_linea.findUnique({
            where: { id: intercambioLineaId },
        });

        if (!existingRecord) {
            return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
        }

        // Verificar si ya existe un archivo subido
        if (existingRecord.archivo_adjunto_id) {
            return NextResponse.json(
                { status: false, message: "Ya existe un archivo subido. No se pueden subir más archivos." },
                { status: 400 }
            );
        }

        // Eliminar archivo anterior si existe (por seguridad)
        if (existingRecord.archivo_adjunto_id) {
            const oldDir = path.join(process.cwd(), "public", "uploads", "traslado-plaza", `${intercambioLineaId}`);
            const oldFilePath = path.join(oldDir, existingRecord.archivo_adjunto_id);
            if (fs.existsSync(oldFilePath)) {
                try {
                    fs.unlinkSync(oldFilePath);
                } catch {
                    // Ignore error if file doesn't exist
                }
            }
        }

        // Crear directorio si no existe
        const dir = path.join(process.cwd(), "public", "uploads", "traslado-plaza", `${intercambioLineaId}`);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Guardar archivo
        let buffer: Buffer;
        try {
            buffer = Buffer.from(normalizeBase64(String(file_base64)), "base64");
        } catch (error) {
            return NextResponse.json({ status: false, message: "Error al procesar el archivo base64" }, { status: 400 });
        }

        const ext = String(extension).replace(".", "").trim() || "dat";
        const fileName = `${uuidv4()}.${ext}`;
        const filePath = path.join(dir, fileName);

        fs.writeFileSync(filePath, buffer);

        // Actualizar registro
        const updatedRecord = await prisma.c_intercambio_linea.update({
            where: { id: intercambioLineaId },
            data: {
                archivo_adjunto_id: fileName,
                archivo_adjunto_nombre: original_name || fileName,
            },
        });

        if (updatedRecord && updatedRecord.plazaInicio_id) {
            const corpo = await prisma.e_estructura_sucursal.findUnique({ where: { id: updatedRecord.plazaInicio_id } });
            if (corpo) {
                const plazaInicio = updatedRecord.plazaInicio_id ?? 0;
                const plazaFin = updatedRecord.plazaFin_id ?? 0;
                let empNombre = "Desconocido";
                if (updatedRecord.empleado_id) {
                    const empleado = await prisma.c_empleado.findUnique({ where: { id: updatedRecord.empleado_id } });
                    if (empleado) {
                        empNombre = empleado.nombre + " " + empleado.primer_apellido + " " + empleado.segundo_apellido;
                    }
                }
                sendNotificationByPlaza(corpo.id, "Archivo subido correctamente", "El empleado " + empNombre + " ha subido un archivo al traslado de plazas en la sucursal " + corpo.nombre, [plazaInicio, plazaFin]);
            }
        }

        return NextResponse.json(
            {
                status: true,
                message: "Archivo subido correctamente",
                data: {
                    id: updatedRecord.id,
                    archivo_adjunto_id: updatedRecord.archivo_adjunto_id,
                    archivo_adjunto_nombre: updatedRecord.archivo_adjunto_nombre,
                },
            },
            { status: 200 }
        );
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error("Error in PUT /api/traslado-plaza/[id]/upload-file:", errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}

