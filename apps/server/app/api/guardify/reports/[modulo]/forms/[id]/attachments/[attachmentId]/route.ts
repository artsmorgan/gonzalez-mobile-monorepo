import { NextRequest } from "next/server";
import { fetchDynamicFile } from "../../../../../../../../../utils/callDynamicFilesApi";
import { createWorkerReportDb } from "../../../../../../../../../utils/reportDynamicPrisma";
import { handleGuardifyAttachment, type AttachmentFetcher } from "../../../../../../../../../utils/guardifyReports/forms";
import { GUARDIFY_REPORT_MODULES } from "../../../../../../../../../utils/guardifyReports/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Un archivo adjunto de un registro (ver `handleGuardifyAttachment` en `utils/guardifyReports/forms.ts`). El archivo se baja del
 * almacenamiento de la app igual que en las rutas `get-file` de la app (`fetchDynamicFile`), pero sin sesión de usuario: aquí la
 * autenticación es la llave de Guardify, que el manejador valida antes de leer nada.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ modulo: string; id: string; attachmentId: string }> }) {
    const { modulo, id, attachmentId } = await ctx.params;
    const fetchFile: AttachmentFetcher = async (relPath) => {
        try {
            const f = await fetchDynamicFile({ req, type: "file", url: relPath, download: true, shouldVerifyAccessToken: false });
            return { bytes: new Uint8Array(f.buffer), contentType: f.headers.contentType };
        } catch (e) {
            // El almacenamiento responde 404 «Archivo no encontrado» cuando el archivo ya no está: es un adjunto inexistente, no un error.
            if (/archivo no encontrado/i.test(String((e as Error)?.message ?? e))) return null;
            throw e;
        }
    };
    return handleGuardifyAttachment(req, modulo, id, attachmentId, {
        registry: GUARDIFY_REPORT_MODULES, getDb: createWorkerReportDb, fetchFile,
    });
}
