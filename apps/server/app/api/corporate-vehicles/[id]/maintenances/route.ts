import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { toZonedTime } from "date-fns-tz";
import { sendNotificationByRole } from "../../../../../utils/sendNotification";
import { uploadDynamicFiles } from "../../../../../utils/callDynamicFilesApi";

export const runtime = "nodejs";

async function processMaintenanceImages(
    req: NextRequest,
    vehiculoId: number,
    imagenAntes?: string,
    imagenDespues?: string
): Promise<{ imagenAntesFileName: string; imagenDespuesFileName: string }> {
    const result = { imagenAntesFileName: "", imagenDespuesFileName: "" };
    const filesToUpload: { type: string; extension: string; file_base64: string }[] = [];
    if (imagenAntes && imagenAntes.trim().length > 0) {
        filesToUpload.push({ type: "image", extension: "jpg", file_base64: imagenAntes });
    }
    if (imagenDespues && imagenDespues.trim().length > 0) {
        filesToUpload.push({ type: "image", extension: "jpg", file_base64: imagenDespues });
    }
    if (filesToUpload.length === 0) return result;

    const uploadResp = await uploadDynamicFiles({
        req,
        folderPath: `corporate-vehicles/${vehiculoId}/maintenances`,
        files: filesToUpload,
    });
    const uploaded = Array.isArray(uploadResp?.files) ? uploadResp.files : [];
    let idx = 0;
    if (imagenAntes && imagenAntes.trim().length > 0) {
        result.imagenAntesFileName = uploaded[idx++]?.name || "";
    }
    if (imagenDespues && imagenDespues.trim().length > 0) {
        result.imagenDespuesFileName = uploaded[idx++]?.name || "";
    }
    return result;
}

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const { id } = await context.params;
        const vehiculoId = parseInt(String(id), 10);
        if (!vehiculoId) {
            return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 400 });
        }

        const mantenimientos = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_mantenimiento_vehiculos_corporativos",
                operation: "findMany",
                where: { vehiculo_id: vehiculoId },
                orderBy: { id: "desc" },
            },
        });
        const mantenimientosArray = Array.isArray(mantenimientos) ? mantenimientos : [];

        return NextResponse.json({ status: true, data: mantenimientosArray }, { status: 200 });
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
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
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

        const { imagenAntesFileName, imagenDespuesFileName } = await processMaintenanceImages(req, vehiculoId, imagen_antes, imagen_despues);

        const createdAt = toZonedTime(new Date(), "America/Costa_Rica");
        const fechaValue = fecha ? new Date(fecha) : createdAt;
        const created = await callDynamicPrisma({
            req,
            data: {
                action: "POST",
                table: "c_mantenimiento_vehiculos_corporativos",
                operation: "create",
                data: {
                    vehiculo_id: vehiculoId,
                    fecha: fechaValue.toISOString(),
                    imagen_antes: imagenAntesFileName || String(imagen_antes ?? ""),
                    tipo: String(tipo ?? ""),
                    mantenimiento: String(mantenimiento ?? ""),
                    diagnostico: String(diagnostico ?? ""),
                    kilometraje_siguiente_revision: Number(kilometraje_siguiente_revision ?? 0),
                    imagen_despues: imagenDespuesFileName || String(imagen_despues ?? ""),
                    nombre_mecanico: String(nombre_mecanico ?? ""),
                    firma_mecanico:
                        firma_mecanico != null && String(firma_mecanico).trim().length > 0
                            ? String(firma_mecanico).trim()
                            : null,
                    firma_responsable: String(firma_responsable ?? ""),
                    created_by,
                    created_at: createdAt.toISOString(),
                },
            },
        });
        const createdObj = created as any;

        // Registrar cambio de creación
        await callDynamicPrisma({
            req,
            data: {
                action: "POST",
                table: "c_cambios_apps_modules",
                operation: "create",
                data: {
                    nombre_tabla: "c_mantenimiento_vehiculos_corporativos",
                    registro_id: createdObj.id,
                    cambios: JSON.stringify([{
                        prop: "__created__",
                        before: null,
                        after: {
                            id: createdObj.id,
                            vehiculo_id: createdObj.vehiculo_id,
                            fecha: fechaValue.toISOString(),
                            tipo: createdObj.tipo,
                            mantenimiento: createdObj.mantenimiento,
                            diagnostico: createdObj.diagnostico,
                            kilometraje_siguiente_revision: createdObj.kilometraje_siguiente_revision,
                            nombre_mecanico: createdObj.nombre_mecanico,
                        },
                    }]),
                    created_at: createdAt.toISOString(),
                    created_by,
                },
            },
        });

        if (createdObj) {
            const vehiculo = await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "c_vehiculos_corporativos",
                    operation: "findUnique",
                    where: { id: createdObj.vehiculo_id },
                },
            });
            if (vehiculo) {
                const vehiculoObj = vehiculo as any;
                let vehiculoPlaca = vehiculoObj.placa;
                let sucursalNombre = "Desconocida";
                if (vehiculoObj.sucursal_id) {
                    const sucursal = await callDynamicPrisma({
                        req,
                        data: {
                            action: "GET",
                            table: "e_estructura_sucursal",
                            operation: "findUnique",
                            where: { id: vehiculoObj.sucursal_id },
                        },
                    });
                    if (sucursal) {
                        const sucursalObj = sucursal as any;
                        sucursalNombre = sucursalObj.nombre;
                    }
                }

                let empNombre = "Desconocido";
                if (Number(payload?.id ?? "0")) {
                    const empleado = await callDynamicPrisma({
                        req,
                        data: {
                            action: "GET",
                            table: "c_empleado",
                            operation: "findUnique",
                            where: { id: Number(payload?.id ?? "0") },
                        },
                    });
                    if (empleado) {
                        const empleadoObj = empleado as any;
                        empNombre = empleadoObj.nombre + " " + empleadoObj.primer_apellido + " " + empleadoObj.segundo_apellido;
                    }
                }
                let fechaRegistro = fechaValue.toISOString().split("T")[0];
                const descriptionNotificacion = "El empleado " + empNombre + " ha registrado un mantenimiento del vehículo con la placa " + vehiculoPlaca + " en la sucursal " + sucursalNombre + " el día " + fechaRegistro;
                await sendNotificationByRole(req, vehiculoObj.sucursal_id, [Number(payload?.id ?? "0")], "Mantenimiento de vehículo corporativo registrado", descriptionNotificacion, ["ADMINISTRATIVO", "SUPERVISOR"]);
            }
        }
        return NextResponse.json({ status: true, data: created }, { status: 201 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error("Error in POST /api/corporate-vehicles/[id]/maintenances:", errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}

