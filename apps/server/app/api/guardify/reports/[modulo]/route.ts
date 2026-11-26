import { NextRequest } from "next/server";
import { createWorkerReportDb } from "../../../../../utils/reportDynamicPrisma";
import { handleGuardifyReport } from "../../../../../utils/guardifyReports/handler";
import { GUARDIFY_REPORT_MODULES } from "../../../../../utils/guardifyReports/registry";

export const dynamic = "force-dynamic";

/** Filas de un reporte para Guardify (ver `utils/guardifyReports/handler.ts` y `docs/guardify-reports-api.md`). */
export async function GET(req: NextRequest, ctx: { params: Promise<{ modulo: string }> }) {
    const { modulo } = await ctx.params;
    return handleGuardifyReport(req, modulo, "rows", { registry: GUARDIFY_REPORT_MODULES, getDb: createWorkerReportDb });
}
