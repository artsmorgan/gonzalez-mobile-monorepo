import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../../utils/verifyToken";
import { prisma } from "../../../../../utils/prismaClient";
import { toZonedTime } from "date-fns-tz";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { sendNotificationByRole } from "../../../../../utils/sendNotification";

export const runtime = "nodejs";

function normalizeBase64(b64: string): string {
    if (!b64) return "";
    const idx = b64.indexOf("base64,");
    if (idx !== -1) return b64.slice(idx + "base64,".length);
    return b64;
}

function processMaintenanceImage(base64Data: string, vehiculoId: number, prefix: string): string {
    if (!base64Data || base64Data.trim().length === 0) return "";

    try {
        const normalized = normalizeBase64(base64Data);
        if (!normalized) return "";

        const buffer = Buffer.from(normalized, "base64");
        const dir = path.join(process.cwd(), "public", "uploads", "corporate-vehicles", `${vehiculoId}`, "maintenances");

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const fileName = `${prefix}_${uuidv4()}.jpg`;
        const filePath = path.join(dir, fileName);
        fs.writeFileSync(filePath, buffer);

        return fileName;
    } catch (error) {
        console.error(`Error processing ${prefix} image:`, error);
        return "";
    }
}

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { valid, expired, payload, message } = verifyAccessToken(req);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const { id } = await context.params;
        const vehiculoId = parseInt(String(id), 10);
        if (!vehiculoId) {
            return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 400 });
        }

        const mantenimientos = await prisma.c_mantenimiento_vehiculos_corporativos.findMany({
            where: { vehiculo_id: vehiculoId },
            orderBy: { id: "desc" },
        });

        return NextResponse.json({ status: true, data: mantenimientos }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error("Error in GET /api/corporate-vehicles/[id]/maintenances:", errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { valid, expired, payload, message } = verifyAccessToken(req);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const { id } = await context.params;
        const vehiculoId = parseInt(String(id), 10);
        if (!vehiculoId) {
            return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 400 });
        }

        const body = await req.json();
        const {
            fecha,
            imagen_antes,
            tipo,
            mantenimiento,
            diagnostico,
            kilometraje_siguiente_revision,
            imagen_despues,
            nombre_mecanico,
            firma_mecanico,
            firma_responsable,
        } = body || {};

        const created_by = parseInt(String((payload as any)?.id ?? 0)) || 0;

        // Procesar imágenes
        const imagenAntesFileName = imagen_antes ? processMaintenanceImage(imagen_antes, vehiculoId, "antes") : "";
        const imagenDespuesFileName = imagen_despues ? processMaintenanceImage(imagen_despues, vehiculoId, "despues") : "";

        const createdAt = toZonedTime(new Date(), "America/Costa_Rica");
        const created = await prisma.c_mantenimiento_vehiculos_corporativos.create({
            data: {
                vehiculo_id: vehiculoId,
                fecha: fecha ? new Date(fecha) : createdAt,
                imagen_antes: imagenAntesFileName || String(imagen_antes ?? ""),
                tipo: String(tipo ?? ""),
                mantenimiento: String(mantenimiento ?? ""),
                diagnostico: String(diagnostico ?? ""),
                kilometraje_siguiente_revision: Number(kilometraje_siguiente_revision ?? 0),
                imagen_despues: imagenDespuesFileName || String(imagen_despues ?? ""),
                nombre_mecanico: String(nombre_mecanico ?? ""),
                firma_mecanico: String(firma_mecanico ?? ""),
                firma_responsable: String(firma_responsable ?? ""),
                created_by,
                created_at: createdAt,
            },
        });

        // Registrar cambio de creación
        await prisma.c_cambios_apps_modules.create({
            data: {
                nombre_tabla: "c_mantenimiento_vehiculos_corporativos",
                registro_id: created.id,
                cambios: JSON.stringify([{
                    prop: "__created__",
                    before: null,
                    after: {
                        id: created.id,
                        vehiculo_id: created.vehiculo_id,
                        fecha: created.fecha.toISOString(),
                        tipo: created.tipo,
                        mantenimiento: created.mantenimiento,
                        diagnostico: created.diagnostico,
                        kilometraje_siguiente_revision: created.kilometraje_siguiente_revision,
                        nombre_mecanico: created.nombre_mecanico,
                    },
                }]),
                created_at: createdAt,
                created_by,
            },
        });

        if (created) {
            const vehiculo = await prisma.c_vehiculos_corporativos.findUnique({ where: { id: created.vehiculo_id } });
            if (vehiculo) {
                let vehiculoPlaca = vehiculo.placa;
                let sucursalNombre = "Desconocida";
                if (vehiculo.sucursal_id) {
                    const sucursal = await prisma.e_estructura_sucursal.findUnique({ where: { id: vehiculo.sucursal_id } });
                    if (sucursal) {
                        sucursalNombre = sucursal.nombre;
                    }
                }

                let empNombre = "Desconocido";
                if (Number(payload?.id ?? "0")) {
                    const empleado = await prisma.c_empleado.findUnique({ where: { id: Number(payload?.id ?? "0") } });
                    if (empleado) {
                        empNombre = empleado.nombre + " " + empleado.primer_apellido + " " + empleado.segundo_apellido;
                    }
                }
                let fechaRegistro = created.fecha.toISOString().split("T")[0];
                const descriptionNotificacion = "El empleado " + empNombre + " ha registrado un mantenimiento del vehículo con la placa " + vehiculoPlaca + " en la sucursal " + sucursalNombre + " el día " + fechaRegistro;
                sendNotificationByRole(vehiculo.sucursal_id, [Number(payload?.id ?? "0")], "Mantenimiento de vehículo corporativo registrado", descriptionNotificacion, ["ADMINISTRATIVO", "SUPERVISOR"]);
            }
        }
        return NextResponse.json({ status: true, data: created }, { status: 201 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error("Error in POST /api/corporate-vehicles/[id]/maintenances:", errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

