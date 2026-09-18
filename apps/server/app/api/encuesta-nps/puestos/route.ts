import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { prisma } from "../../../../utils/prismaClient";
import { reportError } from "../../../../utils/reportError";

export async function GET(req: NextRequest) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const marcaId = req.nextUrl.searchParams.get("m");
        if (!marcaId) {
            await reportError(req, "api/encuesta-nps/puestos", "GET", 400, "Marca no especificada");
            return NextResponse.json({ status: false, message: "Marca no especificada" }, { status: 400 });
        }

        const marca = await prisma.c_marca_dia.findUnique({ where: { id: parseInt(marcaId) } });
        if (!marca) {
            await reportError(req, "api/encuesta-nps/puestos", "GET", 404, "Marca no encontrada");
            return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 404 });
        }

        const puestos = await prisma.e_estructura_puesto.findMany({ where: { sucursal_id: marca.corpo_id } });

        const puestos_return: { id: number, nombre: string }[] = [];
        for (const puesto of puestos) {
            puestos_return.push({ id: puesto.id, nombre: puesto.nombre });
        }
        return NextResponse.json({ status: true, puestos: puestos_return }, { status: 200 });
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        await reportError(req, "api/encuesta-nps/puestos", "GET", 500, errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}
