import { NextRequest } from "next/server";
import { createWorkerReportDb } from "../../../../../../../utils/reportDynamicPrisma";
import { handleGuardifyForms } from "../../../../../../../utils/guardifyReports/forms";
import { GUARDIFY_REPORT_MODULES } from "../../../../../../../utils/guardifyReports/registry";

export const dynamic = "force-dynamic";

/** Ids de los registros del periodo con los mismos filtros que la tabla (para exportar muchos formularios). */
export async function GET(req: NextRequest, ctx: { params: Promise<{ modulo: string }> }) {
    const { modulo } = await ctx.params;
    return handleGuardifyForms(req, modulo, "ids", { registry: GUARDIFY_REPORT_MODULES, getDb: createWorkerReportDb });
}
