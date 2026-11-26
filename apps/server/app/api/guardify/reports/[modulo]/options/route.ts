import { NextRequest } from "next/server";
import { createWorkerReportDb } from "../../../../../../utils/reportDynamicPrisma";
import { handleGuardifyReport } from "../../../../../../utils/guardifyReports/handler";
import { GUARDIFY_REPORT_MODULES } from "../../../../../../utils/guardifyReports/registry";

export const dynamic = "force-dynamic";

/** Valores disponibles de una dimensión de filtro (listas desplegables de Guardify). */
export async function GET(req: NextRequest, ctx: { params: Promise<{ modulo: string }> }) {
    const { modulo } = await ctx.params;
    return handleGuardifyReport(req, modulo, "options", { registry: GUARDIFY_REPORT_MODULES, getDb: createWorkerReportDb });
}
