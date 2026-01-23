import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../utils/verifyToken";
import { prisma } from "../../../../utils/prismaClient";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

export const runtime = "nodejs";

type PncFileInput = {
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

function parseDateOnly(input: any): Date | null {
    if (!input) return null;
    const s = String(input).trim();
    if (s.length === 0) return null;
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return null;
    return d;
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
        const pncId = parseInt(String(id), 10);
        if (!pncId) {
            return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 400 });
        }

        const {
            cliente_id,
            corpo_id,
            fecha_identificacion,
            responsable_cuenta,
            tipo_servicio_no_conforme,
            persona_identifico_pnc,
            firma_persona_identifico_pnc,
            descripcion,
            persona_origino_pnc,
            firma_persona_origino_pnc,
            accion_implementada,
            fecha_solucion,
            responsable_aprobar,
            firma_responsable,
            archivos,
        } = await req.json();

        const existingRecord = await prisma.c_producto_no_conforme.findUnique({
            where: { id: pncId },
            include: { e_archivos_producto_no_conforme: true },
        });

        if (!existingRecord) {
            return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
        }

        const updatedRecord = await prisma.c_producto_no_conforme.update({
            where: { id: pncId },
            data: {
                cliente_id: cliente_id !== undefined ? Number(cliente_id) : existingRecord.cliente_id,
                corpo_id: corpo_id !== undefined ? Number(corpo_id) : existingRecord.corpo_id,
                fecha_identificacion:
                    fecha_identificacion !== undefined ? (parseDateOnly(fecha_identificacion) ?? existingRecord.fecha_identificacion) : existingRecord.fecha_identificacion,
                responsable_cuenta: responsable_cuenta !== undefined ? String(responsable_cuenta ?? "") : existingRecord.responsable_cuenta,
                tipo_servicio_no_conforme: tipo_servicio_no_conforme !== undefined ? String(tipo_servicio_no_conforme ?? "") : existingRecord.tipo_servicio_no_conforme,
                persona_identifico_pnc: persona_identifico_pnc !== undefined ? String(persona_identifico_pnc ?? "") : existingRecord.persona_identifico_pnc,
                firma_persona_identifico_pnc:
                    firma_persona_identifico_pnc !== undefined ? String(firma_persona_identifico_pnc ?? "") : existingRecord.firma_persona_identifico_pnc,
                descripcion: descripcion !== undefined ? String(descripcion ?? "") : existingRecord.descripcion,
                persona_origino_pnc: persona_origino_pnc !== undefined ? String(persona_origino_pnc ?? "") : existingRecord.persona_origino_pnc,
                firma_persona_origino_pnc:
                    firma_persona_origino_pnc !== undefined ? String(firma_persona_origino_pnc ?? "") : existingRecord.firma_persona_origino_pnc,
                accion_implementada: accion_implementada !== undefined ? String(accion_implementada ?? "") : existingRecord.accion_implementada,
                fecha_solucion: fecha_solucion !== undefined ? (parseDateOnly(fecha_solucion) ?? existingRecord.fecha_solucion) : existingRecord.fecha_solucion,
                responsable_aprobar: responsable_aprobar !== undefined ? String(responsable_aprobar ?? "") : existingRecord.responsable_aprobar,
                firma_responsable: firma_responsable !== undefined ? String(firma_responsable ?? existingRecord.firma_responsable) : existingRecord.firma_responsable,
            },
            include: { e_archivos_producto_no_conforme: true },
        });

        // Adjuntos: si el cliente manda `archivos`, hacemos reemplazo total (como Quejas).
        if (archivos !== undefined) {
            let filesParsed: PncFileInput[] = [];
            filesParsed = safeParseJson<PncFileInput[]>(archivos, []);

            const dir = path.join(process.cwd(), "public", "uploads", "non-conforming-product", `${updatedRecord.id}`);

            await prisma.e_archivos_producto_no_conforme.deleteMany({ where: { pnc_id: updatedRecord.id } });
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
                        typeof f.original_name === "string" && f.original_name.trim().length > 0
                            ? f.original_name.trim()
                            : fileName;

                    await prisma.e_archivos_producto_no_conforme.create({
                        data: {
                            name: fileName,
                            original_name: originalName,
                            type: String(f.type),
                            extension: ext,
                            pnc_id: updatedRecord.id,
                        },
                    });
                }
            }
        }

        const fullRecord = await prisma.c_producto_no_conforme.findUnique({
            where: { id: updatedRecord.id },
            include: { e_archivos_producto_no_conforme: true },
        });

        return NextResponse.json(
            {
                status: true,
                message: "Producto no conforme actualizado correctamente",
                data: {
                    ...(fullRecord ?? updatedRecord),
                    id_local: "",
                    files: ((fullRecord as any)?.e_archivos_producto_no_conforme || []).map((f: any) => ({
                        id: f.id,
                        name: f.name,
                        original_name: f.original_name,
                        type: f.type,
                        extension: f.extension,
                    })),
                },
            },
            { status: 200 }
        );
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

export async function DELETE(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { valid, expired, payload, message } = verifyAccessToken(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const { id } = resolvedParams;
        const pncId = parseInt(String(id), 10);
        if (!pncId) {
            return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 400 });
        }

        const existingRecord = await prisma.c_producto_no_conforme.findUnique({
            where: { id: pncId },
        });

        if (!existingRecord) {
            return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
        }

        await prisma.c_producto_no_conforme.delete({ where: { id: pncId } });

        const dir = path.join(process.cwd(), "public", "uploads", "non-conforming-product", `${pncId}`);
        if (fs.existsSync(dir)) {
            try {
                fs.rmSync(dir, { recursive: true, force: true });
            } catch {
                // ignore
            }
        }

        return NextResponse.json({ status: true, message: "Producto no conforme eliminado correctamente" }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

