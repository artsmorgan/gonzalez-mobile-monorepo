import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../utils/verifyToken";
import { prisma } from "../../../../utils/prismaClient";

export async function GET(req: NextRequest) {
    try {
        const { valid, message } = verifyAccessToken(req);
        if (!valid) {
            return NextResponse.json({ status: false, message }, { status: 401 });
        }

        const classifications = await prisma.n_clasificacion_incidente.findMany({
            orderBy: { nombre: "asc" },
        });

        return NextResponse.json(
            {
                status: true,
                classifications: classifications.map((c) => ({
                    id: c.id,
                    nombre: c.nombre,
                })),
            },
            { status: 200 }
        );
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error("Error in GET /api/incidents/classification:", errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}


