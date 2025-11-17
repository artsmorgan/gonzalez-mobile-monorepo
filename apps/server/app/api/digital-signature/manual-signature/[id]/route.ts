<<<<<<< Updated upstream
/* eslint-disable @typescript-eslint/no-require-imports */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../../utils/verifyToken";
import { prisma } from "../../../../../utils/prismaClient";
const dotenv = require('dotenv');
dotenv.config();

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, payload, message } = verifyAccessToken(req);

        if (!valid) {
            return NextResponse.json(
                { status: false, message: message },
=======
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET: Obtener firma manual del empleado
export async function GET(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        // Verify authentication token
        const authHeader = req.headers.get("authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return NextResponse.json(
                { status: false, message: "No autorizado" },
>>>>>>> Stashed changes
                { status: 401 }
            );
        }

<<<<<<< Updated upstream

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
=======
        const empleadoId = params.id;

        if (!empleadoId) {
            return NextResponse.json(
                { status: false, message: "ID de empleado no proporcionado" },
                { status: 400 }
            );
        }

        // Try to find the manual signature in the database
        // Since we don't have a specific table yet, we'll use a simple approach
        // Check if there's a signature stored in c_empleado_basedatos_digital table
        const signature = await prisma.c_empleado_basedatos_digital.findFirst({
            where: {
                empleado_id: parseInt(empleadoId),
                nombre: 'manual_signature'
            }
        });

        if (signature && signature.path) {
            return NextResponse.json(
                {
                    status: true,
                    manualSignature: signature.path, // This should be base64 image
                },
                { status: 200 }
            );
        }

        // Return null if no signature found
        return NextResponse.json(
            {
                status: true,
                manualSignature: null,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("Error obteniendo firma manual:", error);
        return NextResponse.json(
            {
                status: false,
                message: "Error al obtener la firma manual",
                error: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    } finally {
        await prisma.$disconnect();
    }
}

// PUT: Actualizar/crear firma manual del empleado
export async function PUT(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        // Verify authentication token
        const authHeader = req.headers.get("authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return NextResponse.json(
                { status: false, message: "No autorizado" },
>>>>>>> Stashed changes
                { status: 401 }
            );
        }

<<<<<<< Updated upstream
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
=======
        const empleadoId = params.id;

        if (!empleadoId) {
            return NextResponse.json(
                { status: false, message: "ID de empleado no proporcionado" },
                { status: 400 }
            );
        }

        // Parse request body
        const body = await req.json();
        const { manualSignature } = body;

        if (!manualSignature) {
            return NextResponse.json(
                { status: false, message: "Firma manual no proporcionada" },
                { status: 400 }
            );
        }

        // Check if signature already exists
        const existingSignature = await prisma.c_empleado_basedatos_digital.findFirst({
            where: {
                empleado_id: parseInt(empleadoId),
                nombre: 'manual_signature'
            }
        });

        if (existingSignature) {
            // Update existing signature
            await prisma.c_empleado_basedatos_digital.update({
                where: {
                    id: existingSignature.id
                },
                data: {
                    path: manualSignature,
                    descripcion: 'Firma manual del empleado actualizada'
                }
            });
        } else {
            // Create new signature record
            await prisma.c_empleado_basedatos_digital.create({
                data: {
                    empleado_id: parseInt(empleadoId),
                    nombre: 'manual_signature',
                    descripcion: 'Firma manual del empleado',
                    path: manualSignature
                }
            });
        }

        return NextResponse.json(
            {
                status: true,
                message: "Firma manual guardada correctamente",
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("Error guardando firma manual:", error);
        return NextResponse.json(
            {
                status: false,
                message: "Error al guardar la firma manual",
                error: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    } finally {
        await prisma.$disconnect();
    }
}

>>>>>>> Stashed changes
