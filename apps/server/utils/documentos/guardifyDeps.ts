import { uploadDynamicFiles } from "../callDynamicFilesApi";
import { createReportServiceRequest, createWorkerReportDb } from "../reportDynamicPrisma";
import { dynDesdeRequest } from "./dyn";
import type { DocDeps } from "./guardifyApi";

/**
 * Dependencias reales de la API de documentos para Guardify: servicio dinámico (con la petición de servicio, sin sesión de usuario: la
 * autenticación es la llave de Guardify), lectura de la estructura y subida de archivos.
 */
export function crearDocDeps(): DocDeps {
    const serviceReq = createReportServiceRequest();
    return {
        dyn: dynDesdeRequest(serviceReq, { shouldVerifyAccessToken: false }),
        db: createWorkerReportDb(),
        subir: async (carpeta, archivo) => {
            const resp = await uploadDynamicFiles({ req: serviceReq, folderPath: carpeta, files: [archivo], shouldVerifyAccessToken: false });
            const subido = Array.isArray(resp?.files) ? resp.files[0] : null;
            if (!subido?.name) throw new Error("No se pudo guardar el archivo del documento.");
            return { name: subido.name, original_name: subido.original_name || archivo.original_name, extension: subido.extension || archivo.extension, type: String(subido.type || archivo.type) };
        },
    };
}
