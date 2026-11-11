import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";
import { prisma } from "../../../utils/prismaClient";
import { reportError } from "../../../utils/reportError";


export async function GET(req: NextRequest) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const idsParam = req.nextUrl.searchParams.get("ids");
        if (idsParam) {
            const ids = idsParam
                .split(",")
                .map((s) => parseInt(s.trim(), 10))
                .filter((n) => Number.isFinite(n) && n > 0);
            if (ids.length === 0) {
                return NextResponse.json({ status: true, data: [] }, { status: 200 });
            }
            const empleados = await prisma.c_empleado.findMany({
                where: { id: { in: ids } },
                select: { id: true, nombre: true, primer_apellido: true, segundo_apellido: true, codigo: true },
            });
            const data = empleados.map((e) => ({
                id: e.id,
                nombre: [e.nombre, e.primer_apellido, e.segundo_apellido].filter(Boolean).join(" ").trim(),
                codigo: e.codigo ?? null,
            }));
            return NextResponse.json({ status: true, data }, { status: 200 });
        }

        const empleados = await prisma.c_empleado.findMany();
        return NextResponse.json(empleados);
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        await reportError(req, "api/empleados", "GET", 500, errorMessage);
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}

// Issue #181: no hay POST. Antes creaba filas de `c_empleado` (tabla de Planillas) con el cuerpo de la petición sin filtrar (asignación masiva),
// y la app nunca lo usó. El alta de empleados es de Planillas, no de esta API.
