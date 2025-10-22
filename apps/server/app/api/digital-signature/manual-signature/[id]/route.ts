/* eslint-disable @typescript-eslint/no-require-imports */
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { verifyAccessToken } from "../../../../../utils/verifyToken";
const dotenv = require('dotenv');
dotenv.config();

const prisma = new PrismaClient();

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, payload, message } = verifyAccessToken(req);

        if (!valid) {
            return NextResponse.json(
                { status: false, message: message },
                { status: 401 }
            );
        }


        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);

        const empleado = await prisma.c_empleado.findUnique({ where: { id } });

        if (!empleado) {
            return NextResponse.json(
                { status: false, message: "Empleado no encontrado" },
                { status: 404 }
            );
        }

        return NextResponse.json({ status: true, manualSignature: empleado.firma_manual }, { status: 200 });
    } catch (error) {
        console.error(error);
        return NextResponse.json(
            { status: false, message: "Error interno en la firma" },
            { status: 500 }
        );
    }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, payload, message } = verifyAccessToken(req);

        if (!valid) {
            return NextResponse.json(
                { status: false, message: message },
                { status: 401 }
            );
        }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);

        const body = await req.json();

        const { manualSignature } = body;

        const empleado = await prisma.c_empleado.findUnique({ where: { id } });

        if (!empleado) {
            return NextResponse.json(
                { status: false, message: "Empleado no encontrado" },
                { status: 404 }
            );
        }

        const updatedEmpleado = await prisma.c_empleado.update({ where: { id }, data: { firma_manual: manualSignature } });

        return NextResponse.json({ status: true, updatedEmpleado }, { status: 200 });
    } catch (error) {
        console.error(error);
        return NextResponse.json(
            { status: false, message: "Error interno en la firma" },
            { status: 500 }
        );
    }
}