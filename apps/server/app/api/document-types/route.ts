import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../utils/verifyToken";
import { prisma } from "../../../utils/prismaClient";

export async function GET(req: NextRequest) {
    try {
        const { valid, message } = verifyAccessToken(req);
        if (!valid) {
            return NextResponse.json({ status: false, message }, { status: 401 });
        }

        const documentTypes = await prisma.e_tipo_documento.findMany({
            orderBy: { nombre: "asc" },
        });
        return NextResponse.json({ status: true, documentTypes }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error("Error in GET /api/document-types:", errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}


