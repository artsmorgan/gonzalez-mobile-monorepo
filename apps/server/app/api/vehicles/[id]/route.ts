import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { toZonedTime } from "date-fns-tz";
import path from "path";
import fs from "fs";
import { createVehicleImage } from "../../../../utils/createVehicleImage";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);

        if (!id) {
            return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });
        }

        const {
            marca_id,
            tipo,
            placa,
            nombre,
            cedula,
            departamento_visita,
            persona_visita,
            hora_entrada,
            hora_salida,
            razon_visita,
            file
        } = await req.json();

        const vehicle = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "e_registro_vehiculos", operation: "findUnique", where: { id } }
        });
        if (!vehicle) {
            return NextResponse.json({ status: false, message: "Vehículo no encontrado" }, { status: 200 });
        }

        const marcaDia = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "c_marca_dia", operation: "findUnique", where: { id: parseInt(marca_id) } }
        });
        if (!marcaDia) {
            return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 200 });
        }

        // Guardar imagen si existe primero, para obtener el file_name actualizado
        let updatedFileName = vehicle.file_name;
        if (vehicle && file) {
            const result = await createVehicleImage(req, vehicle.id, file);
            if (!result) {
                return NextResponse.json(
                    { status: false, message: "No se pudo subir la imagen. Verifique el formato o el tamaño." },
                    { status: 200 }
                );
            }
            const updatedVehicle = await callDynamicPrisma({
                req,
                data: { action: "GET", table: "e_registro_vehiculos", operation: "findUnique", where: { id } }
            });
            if (updatedVehicle) {
                updatedFileName = updatedVehicle.file_name;
            }
        }

        // Preparar datos de actualización
        const updateData: any = {
            tipo: tipo,
            placa: placa,
            nombre: nombre,
            cedula: cedula,
            departamento_visita: departamento_visita ? String(departamento_visita) : null,
            persona_visita: persona_visita ? String(persona_visita) : null,
            hora_entrada: new Date(hora_entrada).toISOString(),
            hora_salida: hora_salida ? new Date(hora_salida).toISOString() : null,
            razon_visita: razon_visita,
            updated_at: toZonedTime(new Date(), "America/Costa_Rica").toISOString(),
            file_name: updatedFileName // Preservar el file_name actualizado si existe
        };

        // Registrar cambios (solo campos actualizados)
        const eq = (a: any, b: any) => {
            if (a === b) return true;
            if (a == null && b == null) return true;
            const da = a instanceof Date ? a : (typeof a === "string" && /^\d{4}-\d{2}-\d{2}T/.test(a) ? new Date(a) : null);
            const db = b instanceof Date ? b : (typeof b === "string" && /^\d{4}-\d{2}-\d{2}T/.test(b) ? new Date(b) : null);
            if (da && db) return da.getTime() === db.getTime();
            return false;
        };

        const cambiosArr: Array<{ prop: string; before: any; after: any }> = [];
        for (const [k, v] of Object.entries(updateData)) {
            // No registramos archivos: esos vienen en `file` y se guardan aparte.
            if (k === "file" || k === "file_name") continue;

            const before = (vehicle as any)[k];
            const after = v;
            if (!eq(before, after)) {
                cambiosArr.push({
                    prop: k,
                    before: before instanceof Date ? before.toISOString() : before,
                    after: after instanceof Date ? after.toISOString() : after,
                });
            }
        }

        await callDynamicPrisma({
            req,
            data: {
                action: "UPDATE",
                table: "e_registro_vehiculos",
                where: { id },
                data: updateData,
                returning: false
            }
        });

        if (cambiosArr.length > 0) {
            const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
            await callDynamicPrisma({
                req,
                data: {
                    action: "POST",
                    table: "c_cambios_apps_modules",
                    data: {
                        nombre_tabla: "e_registro_vehiculos",
                        registro_id: id,
                        cambios: JSON.stringify(cambiosArr),
                        created_at: toZonedTime(new Date(), "America/Costa_Rica").toISOString(),
                        created_by: createdBy,
                    },
                },
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
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);

        if (!id) {
            return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });
        }

        const vehicle = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "e_registro_vehiculos", operation: "findUnique", where: { id } }
        });
        if (!vehicle) {
            return NextResponse.json({ status: false, message: "Vehículo no encontrado" }, { status: 200 });
        }

        const id_vehicle = vehicle.id;
        const file_name = vehicle.file_name;

        await callDynamicPrisma({
            req,
            data: { action: "DELETE", table: "e_registro_vehiculos", where: { id }, returning: false }
        });

        // Registrar cambio de eliminación
        const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
        await callDynamicPrisma({
            req,
            data: {
                action: "POST",
                table: "c_cambios_apps_modules",
                data: {
                    nombre_tabla: "e_registro_vehiculos",
                    registro_id: id,
                    cambios: JSON.stringify([{
                        prop: "__deleted__",
                        before: {
                            id: vehicle.id,
                            placa: vehicle.placa,
                            tipo: vehicle.tipo,
                            nombre: vehicle.nombre,
                            cedula: vehicle.cedula,
                        },
                        after: null,
                    }]),
                    created_at: toZonedTime(new Date(), "America/Costa_Rica").toISOString(),
                    created_by: createdBy,
                },
            },
        });

        if (file_name) {
            const path_file = path.join(process.cwd(), "public", "uploads", "vehicles", id_vehicle.toString(), file_name);
            if (fs.existsSync(path_file)) {
                fs.unlinkSync(path_file);
            }
        }

        return NextResponse.json({ status: true, message: "Vehículo eliminado correctamente" }, { status: 200 });
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}
