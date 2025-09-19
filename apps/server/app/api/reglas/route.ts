import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { actions } from "../../../public/actions";

const prisma = new PrismaClient();

export async function GET() {
    try {
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