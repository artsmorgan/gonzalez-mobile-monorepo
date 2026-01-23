import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../utils/verifyToken";
import { prisma } from "../../../../utils/prismaClient";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

export const runtime = "nodejs";

type OpeningClosingImageInput = {
    file_base64: string;
    extension?: string;
    original_name?: string;
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
        const { valid, expired, payload, message } = verifyAccessToken(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id, 10);
        const {
            cliente_id,
            corpo_id,
            puesto_id,
            division_id,
            fecha,
            tipo,
            nombre_representante_cliente,
            nombre_representante_empresa_entrante,
            nombre_representante_empresa_saliente,
            actividades,
            inventario,
            otras_observaciones,
            firma_representante_cliente,
            firma_representante_empresa_entrante,
            firma_representante_empresa_saliente,
            firma_responsable,
            imagenes,
            delete_imagenes,
        } = await req.json();

        if (!id) {
            return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
        }

        // Manejo de imágenes: opcionalmente borrar por IDs, y agregar nuevas
        const deleteIds: number[] = delete_imagenes ? safeParseJson<number[]>(delete_imagenes, []) : [];
        if (deleteIds.length > 0) {
            const imagesToDelete = await prisma.c_imagenes_apertura_cierre_puesto.findMany({
                where: { apetura_cierre_id: id, id: { in: deleteIds } },
            });

            const dir = path.join(process.cwd(), "public", "uploads", "opening-closing-position", `${id}`);
            for (const img of imagesToDelete) {
                const p = path.join(dir, img.name);
                try {
                    if (fs.existsSync(p)) fs.rmSync(p, { force: true });
                } catch {
                    // ignore
                }
            }

            await prisma.c_imagenes_apertura_cierre_puesto.deleteMany({
                where: { apetura_cierre_id: id, id: { in: deleteIds } },
            });
        }

        let imagesParsed: OpeningClosingImageInput[] = [];
        if (imagenes) imagesParsed = safeParseJson<OpeningClosingImageInput[]>(imagenes, []);
        if (imagesParsed.length > 0) {
            const dir = path.join(process.cwd(), "public", "uploads", "opening-closing-position", `${id}`);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

            for (const img of imagesParsed) {
                if (!img?.file_base64) continue;
                let buffer: Buffer;
                try {
                    buffer = Buffer.from(normalizeBase64(String(img.file_base64)), "base64");
                } catch {
                    continue;
                }
                const ext = String(img.extension || "jpg").replace(".", "").trim() || "jpg";
                const fileName = `${uuidv4()}.${ext}`;
                fs.writeFileSync(path.join(dir, fileName), buffer);

                const originalName =
                    typeof img.original_name === "string" && img.original_name.trim().length > 0
                        ? img.original_name.trim()
                        : fileName;

                await prisma.c_imagenes_apertura_cierre_puesto.create({
                    data: { name: fileName, original_name: originalName, apetura_cierre_id: id },
                });
            }
        }

        const updated_record = await prisma.c_apertura_cierre_puesto.update({
            where: { id },
            data: {
                cliente_id: cliente_id !== undefined ? parseInt(String(cliente_id), 10) : undefined,
                corpo_id: corpo_id !== undefined ? parseInt(String(corpo_id), 10) : undefined,
                puesto_id: puesto_id !== undefined ? parseInt(String(puesto_id), 10) : undefined,
                division_id: division_id !== undefined ? parseInt(String(division_id), 10) : undefined,
                fecha: fecha !== undefined ? new Date(String(fecha)) : undefined,
                tipo: tipo !== undefined ? String(tipo) : undefined,
                nombre_representante_cliente: nombre_representante_cliente !== undefined ? String(nombre_representante_cliente) : undefined,
                nombre_representante_empresa_entrante: nombre_representante_empresa_entrante !== undefined ? String(nombre_representante_empresa_entrante) : undefined,
                nombre_representante_empresa_saliente: nombre_representante_empresa_saliente !== undefined ? String(nombre_representante_empresa_saliente) : undefined,
                actividades: actividades !== undefined ? String(actividades) : undefined,
                inventario: inventario !== undefined ? String(inventario) : undefined,
                otras_observaciones: otras_observaciones !== undefined ? (otras_observaciones ? String(otras_observaciones) : null) : undefined,
                firma_representante_cliente: firma_representante_cliente !== undefined ? String(firma_representante_cliente) : undefined,
                firma_representante_empresa_entrante: firma_representante_empresa_entrante !== undefined ? String(firma_representante_empresa_entrante) : undefined,
                firma_representante_empresa_saliente: firma_representante_empresa_saliente !== undefined ? String(firma_representante_empresa_saliente) : undefined,
                firma_responsable: firma_responsable !== undefined ? String(firma_responsable) : undefined,
            }
        });

        const fullRecord = await prisma.c_apertura_cierre_puesto.findUnique({
            where: { id },
            include: {
                c_imagenes_apertura_cierre_puesto: true,
                e_estructura_cliente: { select: { nombre: true } },
                e_estructura_sucursal: { select: { nombre: true } },
                e_estructura_puesto: { select: { nombre: true } },
                n_division: { select: { nombre: true } },
            },
        });

        const proto = req.headers.get("x-forwarded-proto") || "http";
        const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
        const baseUrl = host ? `${proto}://${host}` : "";

        return NextResponse.json({
            status: true,
            message: "Apertura-Cierre de Puesto actualizado correctamente",
            data: {
                ...(fullRecord ?? updated_record),
                id_local: "",
                cliente_nombre: (fullRecord as any)?.e_estructura_cliente?.nombre || null,
                corpo_nombre: (fullRecord as any)?.e_estructura_sucursal?.nombre || null,
                puesto_nombre: (fullRecord as any)?.e_estructura_puesto?.nombre || null,
                division_nombre: (fullRecord as any)?.n_division?.nombre || null,
                images: (((fullRecord as any)?.c_imagenes_apertura_cierre_puesto) || []).map((f: any) => ({
                    id: f.id,
                    name: f.name,
                    original_name: f.original_name,
                    url: baseUrl ? `${baseUrl}/api/opening-closing-position/${id}/get-image/${f.name}` : "",
                })),
            }
        }, { status: 200 });

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
        const id = parseInt(resolvedParams.id, 10);

        if (!id) {
            return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
        }

        // Borrar carpeta física de imágenes (si existe)
        const dir = path.join(process.cwd(), "public", "uploads", "opening-closing-position", `${id}`);
        if (fs.existsSync(dir)) {
            try {
                fs.rmSync(dir, { recursive: true, force: true });
            } catch {
                // ignore
            }
        }

        await prisma.c_apertura_cierre_puesto.delete({
            where: { id }
        });

        return NextResponse.json({
            status: true,
            message: "Apertura-Cierre de Puesto eliminado correctamente"
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

