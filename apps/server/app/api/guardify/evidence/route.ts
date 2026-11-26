import { NextRequest } from "next/server";
import { createWorkerReportDb } from "../../../../utils/reportDynamicPrisma";
import { handleEvidenceVerification } from "../../../../utils/guardifyReports/evidenciaVerificacion";

export const dynamic = "force-dynamic";

/** Evidencia de un registro con la verificación de su firma, para la pantalla de verificación de Guardify (ver `docs/firma-digital-evidencia.md`). */
export async function GET(req: NextRequest) {
    return handleEvidenceVerification(req, { db: createWorkerReportDb() as any });
}
