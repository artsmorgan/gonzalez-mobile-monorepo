import { NextRequest } from "next/server";
import { createWorkerReportDb } from "../../../../utils/reportDynamicPrisma";
import { handleGuardifyStructure } from "../../../../utils/guardifyReports/structure";

export const dynamic = "force-dynamic";

/** Estructura (puestos con sus ancestros) para que Guardify vincule sus unidades con los ids de esta app. */
export async function GET(req: NextRequest) {
    return handleGuardifyStructure(req, { getDb: createWorkerReportDb });
}
