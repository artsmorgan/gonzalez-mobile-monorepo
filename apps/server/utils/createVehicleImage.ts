import path from "path";
import fs from "fs";
import { NextRequest } from "next/server";
import { callDynamicPrisma } from "./callDynamicPrisma";
import { uploadDynamicFiles } from "./callDynamicFilesApi";

export const createVehicleImage = async (req: NextRequest, id_vehicle: number, file: string) => {
    try {
        const vehicle = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "e_registro_vehiculos", operation: "findUnique", where: { id: id_vehicle } }
        });
        if (!vehicle) {
            throw new Error("Vehículo no encontrado");
        }

        // Eliminar imagen anterior si existe (la API de archivos no reemplaza; se sube con nombre nuevo)
        if (vehicle.file_name) {
            const path_file = path.join(process.cwd(), "public", "uploads", "vehicles", id_vehicle.toString(), vehicle.file_name);
            if (fs.existsSync(path_file)) {
                fs.unlinkSync(path_file);
            }
        }

        // Aceptar base64 con prefijo data:...;base64, o solo base64 crudo (referencia: callDynamicFilesApi / dynamic-prisma/files)
        let mimeType = "image/jpeg";
        let base64Data: string;
        const matches = file.match(/^data:(.+);base64,(.+)$/);
        if (matches) {
            mimeType = matches[1];
            base64Data = matches[2];
        } else if (typeof file === "string" && file.trim().length > 0) {
            base64Data = file.trim();
        } else {
            throw new Error("Formato base64 inválido");
        }
        const extension = mimeType.split("/")[1] || "jpeg";

        const folderPath = `vehicles/${vehicle.id}`;
        const uploadResult = await uploadDynamicFiles({
            req,
            folderPath,
            files: [
                {
                    type: "image",
                    extension: extension === "jpeg" ? "jpg" : extension,
                    file_base64: base64Data,
                    mime_type: mimeType,
                },
            ],
        });

        const savedFiles = Array.isArray(uploadResult?.files) ? uploadResult.files : [];
        const firstFile = savedFiles[0];
        if (!firstFile?.name) {
            throw new Error("No se devolvió el nombre del archivo subido");
        }
        const file_name = firstFile.name;

        const updatedVehicle = await callDynamicPrisma({
            req,
            data: {
                action: "UPDATE",
                table: "e_registro_vehiculos",
                where: { id: id_vehicle },
                data: { file_name },
            },
        });

        if (!updatedVehicle || updatedVehicle.file_name !== file_name) {
            throw new Error("No se pudo actualizar el file_name en la base de datos");
        }

        return true;
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error("createVehicleImage:", errorMessage);
        return false;
    }
};
