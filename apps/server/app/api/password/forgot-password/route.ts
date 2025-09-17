import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { transporter } from '../../../../transporter';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { username } = body;

        // Validar que se proporcione la cédula
        if (!username) {
            return NextResponse.json(
                { status: false, message: "Nombre de usuario es requerido" }
            );
        }

        // Buscar el usuario por nombre de usuario
        const usuario = await prisma.security_fos_user.findFirst({
            where: {
                username: username
            }
        });

        // Si no se encuentra el usuario
        if (!usuario) {
            return NextResponse.json(
                { status: false, message: "Usuario no encontrado" }
            );
        }

        // Si el usuario no tiene email configurado
        if (!usuario.email) {
            return NextResponse.json(
                { status: false, message: "Usuario no tiene email configurado" }
            );
        }

        const caracteres = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        let token = "";
        let exists = true;

        while (exists) {
            for (let i = 0; i < 50; i++) {
                const indice = Math.floor(Math.random() * caracteres.length);
                token += caracteres[indice];
            }
            const exists_token = await prisma.a_recovery_password_token.findFirst({ where: { token: token } });
            if (!exists_token) {
                exists = false;
            }
            else {
                token = "";
            }
        }

        // Agregar un registro en la tabla a_recovery_password_token para el usuario
        await prisma.a_recovery_password_token.create({
            data: {
                token: token,
                usuarioId: usuario.id,
                expira_en: 900000,
                creacion: new Date()
            }
        });

        await transporter.sendMail({
            from: `Recuperación de contraseña - González <${process.env.EMAIL_USER}>`,
            to: usuario.email,
            subject: "Recuperación de contraseña",
            html: `
              <h1>Recuperación de contraseña</h1>
              <p>Hola ${usuario.nombres} ${usuario.apellidos},</p>
              <p>Para recuperar tu contraseña, haz clic en el siguiente enlace:</p>
              ${process.env.FRONTEND_URL}/recover-password/${btoa(token)}
              <p>Si no solicitaste esta recuperación, por favor ignora este mensaje.</p>
              <p>Gracias,</p>
              <p>Equipo de Gonzalez</p>
            `
        });

        // Retornar éxito con el email del usuario
        return NextResponse.json(
            {
                status: true,
                message: `Email de recuperación enviado a ${usuario.email}`
            }
        );

    } catch (error) {
        console.error('Error en forgot-password:', error);
        return NextResponse.json(
            { status: false, message: "Error interno del servidor" }
        );
    } finally {
        await prisma.$disconnect();
    }
}
