import { NextRequest } from "next/server";
import { createWorkerReportDb } from "../../../../../../utils/reportDynamicPrisma";
import { handleGuardifyReport } from "../../../../../../utils/guardifyReports/handler";
import { GUARDIFY_REPORT_MODULES } from "../../../../../../utils/guardifyReports/registry";

export const dynamic = "force-dynamic";

/** Agregados (conteos, sumas, agrupaciones) de un reporte para los widgets del tablero de Guardify (ver `utils/guardifyReports/aggregate.ts`). */
export async function GET(req: NextRequest, ctx: { params: Promise<{ modulo: string }> }) {
    const { modulo } = await ctx.params;
    return handleGuardifyReport(req, modulo, "aggregate", { registry: GUARDIFY_REPORT_MODULES, getDb: createWorkerReportDb });
}
