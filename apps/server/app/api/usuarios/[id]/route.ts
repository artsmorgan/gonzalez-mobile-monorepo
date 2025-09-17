import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);
        const usuario = await prisma.security_fos_user.findUnique({ where: { id } });
        if (!usuario) return NextResponse.json({ message: "Usuario no encontrado" }, { status: 404 });
        return NextResponse.json(usuario);
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);
        const data = await req.json();
        const updatedUsuario = await prisma.security_fos_user.update({ where: { id }, data });
        return NextResponse.json(updatedUsuario);
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);
        await prisma.security_fos_user.delete({ where: { id } });
        return NextResponse.json({ message: "Usuario eliminado" });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}
