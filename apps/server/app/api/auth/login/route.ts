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
        const { username, password } = body;

        if (!username || !password) {
            return NextResponse.json(
                { status: false, message: "Cédula y contraseña son requeridos" },
                { status: 400 }
            );
        }

        const usuario = await prisma.security_fos_user.findFirst({
            where: { username: username }
        });

        if (!usuario || !usuario.password) {
            return NextResponse.json(
                { status: false, message: "Usuario o contraseña inválidos" },
                { status: 401 }
            );
        }

        const passwordMatch = await bcrypt.compare(password, usuario.password);

        //if (!passwordMatch) { // TODO: Descomentar esta línea cuando se tenga el sistema de contraseñas
        if (false) {
            return NextResponse.json(
                { status: false, message: "Usuario o contraseña inválidos" },
                { status: 401 }
            );
        }

        // 👉 Generar Access Token (expira en 15 minutos) para el usuario
        const accessToken = jwt.sign(
            { id: usuario.id, username: usuario.username },
            process.env.JWT_SECRET,
            { expiresIn: "15m" }
        );

        // 👉 Generar Refresh Token (expira en 7 días) para el usuario
        const refreshToken = jwt.sign(
            { id: usuario.id },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: "7d" }
        );

        // 🔐 Guardar el refresh token en la BD
        await prisma.refresh_token.create({
            data: {
                token: refreshToken,
                usuarioId: usuario.id,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            }
        });

        // Retornar éxito con el token de acceso y refresh
        return NextResponse.json(
            {
                status: true,
                message: "Logeado con éxito",
                accessToken,
                refreshToken,
                user: {
                    id: usuario.id,
                    username: usuario.username,
                    nombre: usuario.nombres,
                    apellido: usuario.apellidos
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
