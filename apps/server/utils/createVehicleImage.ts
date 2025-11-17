import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "./prismaClient";

export const createVehicleImage = async (id_vehicle: number, file: string) => {
    try {
        const vehicle = await prisma.e_registro_vehiculos.findUnique({ where: { id: id_vehicle } });
        if (!vehicle) {
            throw new Error("Vehículo no encontrado");
        }

        // Eliminar imagen si existe
        if (vehicle.file_name) {
            const path_file = path.join(process.cwd(), "public", "uploads", "vehicles", id_vehicle.toString(), vehicle.file_name);
            if (fs.existsSync(path_file)) {
                fs.unlinkSync(path_file);
            }
        }

        // ejemplo de cadena base64: data:image/jpeg;base64,/9j/4AAQ...
        const matches = file.match(/^data:(.+);base64,(.+)$/);
        if (!matches) {
            throw new Error("Formato base64 inválido");
        }

        const mimeType = matches[1];
        const base64Data = matches[2];
        const extension = mimeType.split("/")[1]; // ej. 'jpeg' o 'png'

        const id_file = uuidv4();
        const file_name = `${id_file}.${extension}`;

        const dir = path.join(
            process.cwd(),
            "public",
            "uploads",
            "vehicles",
            `${vehicle.id}`,
        );

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const filePath = path.join(dir, file_name);

        console.log("filePath", filePath);

        // Escribir el archivo en binario
        fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));

        // Actualizar el file_name en la base de datos
        const updatedVehicle = await prisma.e_registro_vehiculos.update({
            where: { id: id_vehicle },
            data: { file_name: file_name }
        });

        // Verificar que el update se realizó correctamente
        if (!updatedVehicle || updatedVehicle.file_name !== file_name) {
            throw new Error("No se pudo actualizar el file_name en la base de datos");
        }

        console.log("file_name actualizado correctamente:", updatedVehicle.file_name);

        return true;
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        return false;
    }
}