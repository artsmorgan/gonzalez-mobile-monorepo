import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
    try {
        const empleados = await prisma.c_empleado.findMany();
        return NextResponse.json(empleados);
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const data = await req.json();
        const newEmpleado = await prisma.c_empleado.create({ data });
        return NextResponse.json(newEmpleado, { status: 201 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}
