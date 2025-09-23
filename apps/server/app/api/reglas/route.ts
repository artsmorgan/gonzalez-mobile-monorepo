import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { actions } from "../../../public/actions";
import { verifyAccessToken } from "../../../utils/verifyToken";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
    try {
        const { valid, payload, message } = verifyAccessToken(request);

        if (!valid) {
            return NextResponse.json(
                { status: false, message: message },
                { status: 401 }
            );
        }

        const reglas = actions.map((action) => ({
            nombre: action.nombre,
            descripcion: action.descripcion,
            actions: action.actions
        }));
        return NextResponse.json(reglas);
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}