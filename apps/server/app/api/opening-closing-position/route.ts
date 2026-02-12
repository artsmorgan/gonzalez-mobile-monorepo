import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../utils/verifyToken";
import { prisma } from "../../../utils/prismaClient";
import { toZonedTime } from "date-fns-tz";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { sendNotificationByRole } from "../../../utils/sendNotification";

export const runtime = "nodejs";

type OpeningClosingImageInput = {
    file_base64: string;
    extension?: string; // jpg | png | etc
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

export async function POST(req: NextRequest) {
    try {
        const { valid, expired, payload, message } = verifyAccessToken(req);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const {
            marca_id,
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
        } = await req.json();

        if (!marca_id) {
            return NextResponse.json({ status: false, message: "Marca no especificada" }, { status: 400 });
        }

        const marcaDia = await prisma.c_marca_dia.findUnique({
            where: { id: parseInt(String(marca_id), 10) },
        });
        if (!marcaDia) {
            return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 404 });
        }

        // Validaciones mínimas (campos NOT NULL en prisma)
        const required: Array<[string, any]> = [
            ["cliente_id", cliente_id],
            ["corpo_id", corpo_id],
            ["puesto_id", puesto_id],
            ["division_id", division_id],
            ["fecha", fecha],
            ["tipo", tipo],
            ["nombre_representante_cliente", nombre_representante_cliente],
            ["nombre_representante_empresa_entrante", nombre_representante_empresa_entrante],
            ["nombre_representante_empresa_saliente", nombre_representante_empresa_saliente],
            ["actividades", actividades],
            ["inventario", inventario],
            ["firma_representante_cliente", firma_representante_cliente],
            ["firma_representante_empresa_entrante", firma_representante_empresa_entrante],
            ["firma_representante_empresa_saliente", firma_representante_empresa_saliente],
            ["firma_responsable", firma_responsable],
        ];
        for (const [k, v] of required) {
            if (v === undefined || v === null || String(v).trim().length === 0) {
                return NextResponse.json({ status: false, message: `El campo ${k} es requerido` }, { status: 400 });
            }
        }

        const createdAt = toZonedTime(new Date(), "America/Costa_Rica");
        const createdByNum = parseInt(String(payload.id), 10);

        const newRecord = await prisma.c_apertura_cierre_puesto.create({
            data: {
                cliente_id: parseInt(String(cliente_id), 10),
                corpo_id: parseInt(String(corpo_id), 10),
                puesto_id: parseInt(String(puesto_id), 10),
                division_id: parseInt(String(division_id), 10),
                fecha: new Date(String(fecha)),
                tipo: String(tipo),
                nombre_representante_cliente: String(nombre_representante_cliente),
                nombre_representante_empresa_entrante: String(nombre_representante_empresa_entrante),
                nombre_representante_empresa_saliente: String(nombre_representante_empresa_saliente),
                actividades: String(actividades ?? "[]"),
                inventario: String(inventario ?? "[]"),
                otras_observaciones: otras_observaciones ? String(otras_observaciones) : null,
                firma_representante_cliente: String(firma_representante_cliente),
                firma_representante_empresa_entrante: String(firma_representante_empresa_entrante),
                firma_representante_empresa_saliente: String(firma_representante_empresa_saliente),
                firma_responsable: String(firma_responsable),
                created_at: createdAt,
                created_by: createdByNum,
            },
            include: { c_imagenes_apertura_cierre_puesto: true },
        });

        // Registrar cambio de creación
        await prisma.c_cambios_apps_modules.create({
            data: {
                nombre_tabla: "c_apertura_cierre_puesto",
                registro_id: newRecord.id,
                cambios: JSON.stringify([{
                    prop: "__created__",
                    before: null,
                    after: {
                        id: newRecord.id,
                        cliente_id: newRecord.cliente_id,
                        corpo_id: newRecord.corpo_id,
                        puesto_id: newRecord.puesto_id,
                        division_id: newRecord.division_id,
                        fecha: newRecord.fecha.toISOString(),
                        tipo: newRecord.tipo,
                        nombre_representante_cliente: newRecord.nombre_representante_cliente,
                        nombre_representante_empresa_entrante: newRecord.nombre_representante_empresa_entrante,
                        nombre_representante_empresa_saliente: newRecord.nombre_representante_empresa_saliente,
                        actividades: newRecord.actividades,
                        inventario: newRecord.inventario,
                        otras_observaciones: newRecord.otras_observaciones,
                    },
                }]),
                created_at: createdAt,
                created_by: createdByNum,
            },
        });

        if (newRecord) {
            let empNombre = "Desconocido";
            let sucursalNombre = "Desconocida";
            let clienteNombre = "Desconocido";
            let fechaRegistro = newRecord.fecha.toISOString().split("T")[0];
            if (newRecord.created_by) {
                const empleado = await prisma.c_empleado.findUnique({ where: { id: parseInt(String(newRecord.created_by), 10) } });
                if (empleado) {
                    empNombre = empleado.nombre + " " + empleado.primer_apellido + " " + empleado.segundo_apellido;
                }

            }
            if (newRecord.corpo_id) {
                const sucursal = await prisma.e_estructura_sucursal.findUnique({ where: { id: newRecord.corpo_id } });
                if (sucursal) {
                    sucursalNombre = sucursal.nombre + " (" + sucursal.nro_sucursal + ")";
                }
            }
            if (newRecord.cliente_id) {
                const cliente = await prisma.e_estructura_cliente.findUnique({ where: { id: newRecord.cliente_id } });
                if (cliente) {
                    clienteNombre = cliente.nombre;
                }
            }
            const descriptionNotificacion = "El empleado " + empNombre + " ha creado un registro de apertura-cierre de puesto de tipo " + newRecord.tipo + " en la sucursal " + sucursalNombre + " para el cliente " + clienteNombre + " el día " + fechaRegistro;
            sendNotificationByRole(newRecord.corpo_id, [parseInt(String(newRecord.created_by), 10)], "Apertura-Cierre de Puesto creado", descriptionNotificacion, ["ADMINISTRATIVO", "SUPERVISOR"]);
        }

        // Guardar imágenes (si vienen)
        let imagesParsed: OpeningClosingImageInput[] = [];
        if (imagenes) imagesParsed = safeParseJson<OpeningClosingImageInput[]>(imagenes, []);

        if (imagesParsed.length > 0) {
            const dir = path.join(process.cwd(), "public", "uploads", "opening-closing-position", `${newRecord.id}`);
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
                    data: { name: fileName, original_name: originalName, apetura_cierre_id: newRecord.id },
                });
            }
        }

        const fullRecord = await prisma.c_apertura_cierre_puesto.findUnique({
            where: { id: newRecord.id },
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

        const recordToSend: any = fullRecord ?? newRecord;

        return NextResponse.json(
            {
                status: true,
                message: "Apertura-Cierre de Puesto creado correctamente",
                data: {
                    ...recordToSend,
                    id_local: "",
                    cliente_nombre: recordToSend?.e_estructura_cliente?.nombre || null,
                    corpo_nombre: recordToSend?.e_estructura_sucursal?.nombre || null,
                    puesto_nombre: recordToSend?.e_estructura_puesto?.nombre || null,
                    division_nombre: recordToSend?.n_division?.nombre || null,
                    images: (recordToSend?.c_imagenes_apertura_cierre_puesto || []).map((f: any) => ({
                        id: f.id,
                        name: f.name,
                        original_name: f.original_name,
                        url: baseUrl ? `${baseUrl}/api/opening-closing-position/${recordToSend.id}/get-image/${f.name}` : "",
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

