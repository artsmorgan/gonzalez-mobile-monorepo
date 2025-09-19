import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);
        const role = await prisma.roles_security.findUnique({ where: { id } });
        if (!role) return NextResponse.json({ message: "Rol no encontrado" }, { status: 404 });
        return NextResponse.json(role);
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
        const updatedRole = await prisma.roles_security.update({ where: { id }, data });
        return NextResponse.json(updatedRole);
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);
        await prisma.roles_security.delete({ where: { id } });
        return NextResponse.json({ message: "Rol eliminado" });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}
