import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../../../utils/prismaClient";
import { handleDbStatus } from "../../../../../utils/guardifyReports/dbStatus";

export const dynamic = "force-dynamic";

/** Estado de la base frente al esquema (solo lectura, misma llave que los reportes). */
export async function GET(req: NextRequest) {
    return handleDbStatus(req, { prisma, models: Prisma.dmmf.datamodel.models as never });
}
