import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";

export async function GET(req: NextRequest) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const marcaId = req.nextUrl.searchParams.get("m");
        if (!marcaId) {
            return NextResponse.json({ status: false, message: "Marca no especificada" }, { status: 200 });
        }

        const marca = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "c_marca_dia", operation: "findUnique", where: { id: parseInt(marcaId) } }
        });
        if (!marca) {
            return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 200 });
        }

        const puestos = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "e_estructura_puesto", operation: "findMany", where: { sucursal_id: marca.corpo_id } }
        });

        const puestos_return: { id: number, nombre: string }[] = [];
        for (const puesto of puestos) {
            puestos_return.push({ id: puesto.id, nombre: puesto.nombre });
        }
        return NextResponse.json({ status: true, puestos: puestos_return }, { status: 200 });
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}