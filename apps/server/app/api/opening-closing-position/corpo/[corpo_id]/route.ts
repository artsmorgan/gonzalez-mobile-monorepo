import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../../utils/verifyToken";
import { prisma } from "../../../../../utils/prismaClient";

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ corpo_id: string }> }
) {
    try {
        const { valid, expired, payload, message } = verifyAccessToken(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const corpoId = parseInt(resolvedParams.corpo_id, 10);

        if (!corpoId) {
            return NextResponse.json({ status: false, message: "Corpo inválido", data: [] }, { status: 400 });
        }

        const proto = req.headers.get("x-forwarded-proto") || "http";
        const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
        const baseUrl = host ? `${proto}://${host}` : "";

        const records = await prisma.c_apertura_cierre_puesto.findMany({
            where: {
                corpo_id: corpoId
            },
            orderBy: {
                created_at: 'desc'
            },
            include: {
                c_imagenes_apertura_cierre_puesto: true,
                e_estructura_cliente: { select: { nombre: true } },
                e_estructura_sucursal: { select: { nombre: true } },
                e_estructura_puesto: { select: { nombre: true } },
                n_division: { select: { nombre: true } },
            },
        });

        const recordsWithIdLocal = records.map((record: any) => ({
            ...record,
            id_local: "",
            cliente_nombre: record.e_estructura_cliente?.nombre || null,
            corpo_nombre: record.e_estructura_sucursal?.nombre || null,
            puesto_nombre: record.e_estructura_puesto?.nombre || null,
            division_nombre: record.n_division?.nombre || null,
            images: (record.c_imagenes_apertura_cierre_puesto || []).map((f: any) => ({
                id: f.id,
                name: f.name,
                original_name: f.original_name,
                url: baseUrl ? `${baseUrl}/api/opening-closing-position/${record.id}/get-image/${f.name}` : "",
            })),
        }));

        return NextResponse.json({
            status: true,
            message: "Aperturas-Cierres de Puesto obtenidos correctamente",
            data: recordsWithIdLocal
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage, data: [] }, { status: 400 });
    }
}

