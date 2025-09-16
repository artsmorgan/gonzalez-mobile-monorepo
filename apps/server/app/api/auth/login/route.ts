/* eslint-disable @typescript-eslint/no-require-imports */
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
dotenv.config();

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { ced, password } = body;

        if (!ced || !password) {
            return NextResponse.json(
                { status: false, message: "Cédula y contraseña son requeridos" },
                { status: 400 }
            );
        }

        const empleado = await prisma.c_empleado.findFirst({
            where: { cedula: ced }
        });

        if (!empleado || !empleado.password) {
            return NextResponse.json(
                { status: false, message: "Cédula o contraseña inválidos" },
                { status: 401 }
            );
        }

        const passwordMatch = await bcrypt.compare(password, empleado.password);

        if (!passwordMatch) {
            return NextResponse.json(
                { status: false, message: "Cédula o contraseña inválidos" },
                { status: 401 }
            );
        }

        // 👉 Generar Access Token (expira en 15 minutos)
        const accessToken = jwt.sign(
            { id: empleado.id, cedula: empleado.cedula },
            process.env.JWT_SECRET,
            { expiresIn: "15m" }
        );

        // 👉 Generar Refresh Token (expira en 7 días)
        const refreshToken = jwt.sign(
            { id: empleado.id },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: "7d" }
        );

        // 🔐 (Opcional) Guardar el refresh token en la BD
        await prisma.refresh_token.create({
            data: {
                token: refreshToken,
                empleadoId: empleado.id,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            }
        });

        return NextResponse.json(
            {
                status: true,
                message: "Logeado con éxito",
                accessToken,
                refreshToken,
                employee: {
                    id: empleado.id,
                    cedula: empleado.cedula,
                    nombre: empleado.nombre,
                    primer_apellido: empleado.primer_apellido,
                    segundo_apellido: empleado.segundo_apellido
                }
            },
            { status: 200 }
        );

    } catch (error) {
        console.error('Error en login:', error);
        return NextResponse.json(
            { status: false, message: "Error interno del servidor" },
            { status: 500 }
        );
    } finally {
        await prisma.$disconnect();
    }
}
