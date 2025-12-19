import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../utils/verifyToken";
import { toZonedTime } from "date-fns-tz";
import { prisma } from "../../../utils/prismaClient";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { sendNotificationByRole } from "../../../utils/sendNotification";

export const runtime = "nodejs";

type ComplaintFileInput = {
    type: string; // image | audio | video | document
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

export async function POST(req: NextRequest) {
    try {
        const { valid, payload, message } = verifyAccessToken(req);

        if (!valid) {
            return NextResponse.json(
                { status: false, message: message },
                { status: 401 }
            );
        }

        const { 
            marca_id, 
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

        if (!marca_id) {
            return NextResponse.json({ status: false, message: "Marca no especificada" }, { status: 400 });
        }

        const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id: parseInt(marca_id) } });
        if (!marcaDia) {
            return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 404 });
        }

        if (!marcaDia.empleadoFijo_id) {
            return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 404 });
        }

        if (!firma_responsable || String(firma_responsable).trim().length === 0) {
            return NextResponse.json({ status: false, message: "La firma del responsable es requerida" }, { status: 400 });
        }

        const created_at = toZonedTime(new Date(), "America/Costa_Rica");
        // Autocompletar campos desde la marca
        const new_record = await prisma.c_maestro_quejas.create({
            data: {
                empresa_id: marcaDia.empresa_id,
                cliente_id: marcaDia.cliente_id,
                contrato_id: marcaDia.contrato_id,
                corpo_id: marcaDia.corpo_id,
                puesto_id: marcaDia.puesto_id,
                plaza_id: marcaDia.plaza_id,
                sociedad: String(sociedad ?? ""),
                nombre_realiza_queja: String(nombre_realiza_queja ?? ""),
                cliente: String(cliente ?? ""),
                empresa_presenta_queja: String(empresa_presenta_queja ?? ""),
                persona_presenta_queja: String(persona_presenta_queja ?? ""),
                medio_recepcion_queja: String(medio_recepcion_queja ?? ""),
                tipo_queja: String(tipo_queja ?? ""),
                ubicacion: String(ubicacion ?? ""),
                nivel_queja: String(nivel_queja ?? ""),
                fecha_queja: String(fecha_queja ?? ""),
                motivo_queja: String(motivo_queja ?? ""),
                descripcion_queja: String(descripcion_queja ?? ""),
                fecha_inicio: String(fecha_inicio ?? ""),
                fecha_revision: String(fecha_revision ?? ""),
                resolucion_queja: String(resolucion_queja ?? ""),
                estado: String(estado ?? ""),
                accion_correctiva_preventiva: String(accion_correctiva_preventiva ?? ""),
                firma_responsable: String(firma_responsable),
                created_at: created_at,
                created_by: payload.id?.toString() || ""
            },
            include: {
                c_anexos_quejas: true,
            },
        });

        // Archivos anexos
        let filesParsed: ComplaintFileInput[] = [];
        if (archivos) {
            filesParsed = safeParseJson<ComplaintFileInput[]>(archivos, []);
        }

        if (filesParsed.length > 0) {
            const dir = path.join(process.cwd(), "public", "uploads", "complaints-master", `${new_record.id}`);
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
                        queja_id: new_record.id,
                    }
                });
            }
        }

        const fullRecord = await prisma.c_maestro_quejas.findUnique({
            where: { id: new_record.id },
            include: { c_anexos_quejas: true },
        });

        const sucursal = await prisma.e_estructura_sucursal.findUnique({ where: { id: marcaDia.corpo_id } });
        
        if (sucursal) {
            const fecha_string = created_at.toISOString().split("T")[0];
            const hora_string = created_at.toISOString().split("T")[1].split(".")[0];
            const description = `Se ha registrado una queja de tipo ${tipo_queja} en la sucursal ${sucursal.nombre} de la empresa ${cliente.nombre} el día ${fecha_string} a las ${hora_string}`;
            sendNotificationByRole(marcaDia.id, "Queja registrada", description, ["ADMINISTRATIVO", "SUPERVISOR"]);
        }
        
        return NextResponse.json({ 
            status: true, 
            message: "Queja creada correctamente",
            data: {
                ...(fullRecord ?? new_record),
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
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

