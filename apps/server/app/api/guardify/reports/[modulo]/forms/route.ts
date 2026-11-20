import { NextRequest } from "next/server";
import { createWorkerReportDb } from "../../../../../../utils/reportDynamicPrisma";
import { handleGuardifyForms } from "../../../../../../utils/guardifyReports/forms";
import { GUARDIFY_REPORT_MODULES } from "../../../../../../utils/guardifyReports/registry";

export const dynamic = "force-dynamic";

/** Registros de un reporte como formulario estructurado (ver `utils/guardifyReports/forms.ts`). */
export async function GET(req: NextRequest, ctx: { params: Promise<{ modulo: string }> }) {
    const { modulo } = await ctx.params;
    return handleGuardifyForms(req, modulo, "records", { registry: GUARDIFY_REPORT_MODULES, getDb: createWorkerReportDb });
}
