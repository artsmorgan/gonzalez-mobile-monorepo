import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../utils/verifyToken";
import { prisma } from "../../../../utils/prismaClient";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

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
        const { valid, payload, message } = verifyAccessToken(req);

        if (!valid) {
            return NextResponse.json(
                { status: false, message: message },
                { status: 401 }
            );
        }

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
        } = await req.json();

        const existingRecord = await prisma.c_maestro_quejas.findUnique({
            where: { id: complaintId }
        });

        if (!existingRecord) {
            return NextResponse.json(
                { status: false, message: "Registro no encontrado" },
                { status: 404 }
            );
        }

        const updatedRecord = await prisma.c_maestro_quejas.update({
            where: { id: complaintId },
            data: {
                sociedad: sociedad !== undefined ? String(sociedad ?? "") : existingRecord.sociedad,
                nombre_realiza_queja: nombre_realiza_queja !== undefined ? String(nombre_realiza_queja ?? "") : existingRecord.nombre_realiza_queja,
                cliente: cliente !== undefined ? String(cliente ?? "") : existingRecord.cliente,
                empresa_presenta_queja: empresa_presenta_queja !== undefined ? String(empresa_presenta_queja ?? "") : existingRecord.empresa_presenta_queja,
                persona_presenta_queja: persona_presenta_queja !== undefined ? String(persona_presenta_queja ?? "") : existingRecord.persona_presenta_queja,
                medio_recepcion_queja: medio_recepcion_queja !== undefined ? String(medio_recepcion_queja ?? "") : existingRecord.medio_recepcion_queja,
                tipo_queja: tipo_queja !== undefined ? String(tipo_queja ?? "") : existingRecord.tipo_queja,
                ubicacion: ubicacion !== undefined ? String(ubicacion ?? "") : existingRecord.ubicacion,
                nivel_queja: nivel_queja !== undefined ? String(nivel_queja ?? "") : existingRecord.nivel_queja,
                fecha_queja: fecha_queja !== undefined ? String(fecha_queja ?? "") : existingRecord.fecha_queja,
                motivo_queja: motivo_queja !== undefined ? String(motivo_queja ?? "") : existingRecord.motivo_queja,
                descripcion_queja: descripcion_queja !== undefined ? String(descripcion_queja ?? "") : existingRecord.descripcion_queja,
                fecha_inicio: fecha_inicio !== undefined ? String(fecha_inicio ?? "") : existingRecord.fecha_inicio,
                fecha_revision: fecha_revision !== undefined ? String(fecha_revision ?? "") : existingRecord.fecha_revision,
                resolucion_queja: resolucion_queja !== undefined ? String(resolucion_queja ?? "") : existingRecord.resolucion_queja,
                estado: estado !== undefined ? String(estado ?? "") : existingRecord.estado,
                accion_correctiva_preventiva: accion_correctiva_preventiva !== undefined ? String(accion_correctiva_preventiva ?? "") : existingRecord.accion_correctiva_preventiva,
                firma_responsable: firma_responsable !== undefined ? String(firma_responsable ?? existingRecord.firma_responsable) : existingRecord.firma_responsable,
            }
        });

        let filesParsed: ComplaintFileInput[] = [];
        if (archivos) {
            filesParsed = safeParseJson<ComplaintFileInput[]>(archivos, []);
        }

        // REEMPLAZO de adjuntos: borrar todos los existentes y luego crear los nuevos
        // (el cliente debe enviar en `archivos` tanto los existentes como los nuevos, como si se hubiesen adjuntado).
        const dir = path.join(process.cwd(), "public", "uploads", "complaints-master", `${updatedRecord.id}`);

        // DB
        await prisma.c_anexos_quejas.deleteMany({ where: { queja_id: updatedRecord.id } });
        // FS
        if (fs.existsSync(dir)) {
            try {
                fs.rmSync(dir, { recursive: true, force: true });
            } catch {
                // ignore
            }
        }

        if (filesParsed.length > 0) {
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

            for (const f of filesParsed) {
                if (!f?.file_base64 || !f?.extension || !f?.type) continue;
                let buffer: Buffer;
                try {
                    buffer = Buffer.from(normalizeBase64(String(f.file_base64)), "base64");
                } catch {
                    continue;
                }

                const ext = String(f.extension).replace(".", "").trim() || "dat";
                const fileName = `${uuidv4()}.${ext}`;
                fs.writeFileSync(path.join(dir, fileName), buffer);

                const originalName =
                    (typeof f.original_name === "string" && f.original_name.trim().length > 0)
                        ? f.original_name.trim()
                        : fileName;

                await prisma.c_anexos_quejas.create({
                    data: {
                        name: fileName,
                        original_name: originalName,
                        type: String(f.type),
                        extension: ext,
                        queja_id: updatedRecord.id,
                    }
                });
            }
        }

        const fullRecord = await prisma.c_maestro_quejas.findUnique({
            where: { id: updatedRecord.id },
            include: { c_anexos_quejas: true },
        });

        return NextResponse.json({
            status: true,
            message: "Queja actualizada correctamente",
            data: {
                ...(fullRecord ?? updatedRecord),
                id_local: "",
                files: ((fullRecord as any)?.c_anexos_quejas || []).map((f: any) => ({
                    id: f.id,
                    name: f.name,
                    original_name: f.original_name,
                    type: f.type,
                    extension: f.extension,
                })),
            }
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
        const { valid, payload, message } = verifyAccessToken(req);

        if (!valid) {
            return NextResponse.json(
                { status: false, message: message },
                { status: 401 }
            );
        }

        const resolvedParams = await context.params;
        const { id } = resolvedParams;
        const complaintId = parseInt(id, 10);
        if (!complaintId) {
            return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });
        }

        const existingRecord = await prisma.c_maestro_quejas.findUnique({
            where: { id: complaintId }
        });

        if (!existingRecord) {
            return NextResponse.json(
                { status: false, message: "Registro no encontrado" },
                { status: 404 }
            );
        }

        await prisma.c_maestro_quejas.delete({
            where: { id: complaintId }
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

