import { NextRequest } from "next/server";
import { createWorkerReportDb } from "../../../../../utils/reportDynamicPrisma";
import { handleGuardifyPeopleRoles } from "../../../../../utils/guardifyReports/peopleRoles";

export const dynamic = "force-dynamic";

/** Rol base (categoría de empleado por división) y súper administrador de cada cédula, para que Guardify sugiera el rol al dar acceso. */
export async function GET(req: NextRequest) {
    return handleGuardifyPeopleRoles(req, { getDb: createWorkerReportDb });
}
