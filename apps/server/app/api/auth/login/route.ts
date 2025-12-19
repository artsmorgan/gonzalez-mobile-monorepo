/* eslint-disable @typescript-eslint/no-require-imports */
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { toZonedTime } from 'date-fns-tz';
import { prisma } from '../../../../utils/prismaClient';
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
import crypto from "crypto";
dotenv.config();

function hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { cedula, password } = body;

        if (!cedula || !password) {
            return NextResponse.json(
                { status: false, message: "Cédula y contraseña son requeridos" },
                { status: 400 }
            );
        }

        const empleado = await prisma.c_empleado.findFirst({
            where: { cedula: cedula }
        });

        if (!empleado || !empleado.password) {
            return NextResponse.json(
                { status: false, message: "Empleado o contraseña inválidos" },
                { status: 401 }
            );
        }

        if (empleado.fecha_contratacion == null) {
            return NextResponse.json(
                { status: false, message: "Empleado no ha sido contratado" },
                { status: 401 }
            );
        }

        if (empleado.estado == "BA") {
            return NextResponse.json(
                { status: false, message: "Empleado fue dado de baja" },
                { status: 401 }
            );
        }

        if (empleado.password_expires_at && empleado.password_expires_at < toZonedTime(new Date(), "America/Costa_Rica")) {
            return NextResponse.json(
                { status: false, passwordExpired: true, message: "Contraseña expirada, debe cambiarla" },
                { status: 401 }
            );
        }

        const passwordMatch = await bcrypt.compare(password, empleado.password);

        if (!passwordMatch) {
            return NextResponse.json(
                { status: false, message: "Usuario o contraseña inválidos" },
                { status: 401 }
            );
        }

        const sessionId = uuidv4();

        // 👉 Generar Access Token (expira en 15 minutos) para el usuario
        const accessToken = jwt.sign(
            { id: empleado.id, cedula: empleado.cedula, sessionId: sessionId },
            process.env.JWT_SECRET,
            { expiresIn: "15m" }
        );

        // 👉 Generar Refresh Token (expira en 7 días) para el usuario
        const refreshToken = jwt.sign(
            { id: empleado.id, sessionId: sessionId },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: "7d" }
        );

        const now = toZonedTime(new Date(), "America/Costa_Rica");

        // revoked = true a todos los tokens del usuario
        await prisma.refresh_token.updateMany({
            where: {
                empleadoId: empleado.id,
                revoked: false
            },
            data: {
                revoked: true
            }
        });

        // 🔐 Guardar el refresh token en la BD
        // Si el token ya existe (por condición de carrera), eliminarlo primero
        try {
            await prisma.refresh_token.deleteMany({
                where: { empleadoId: empleado.id, revoked: false },
            });
            await prisma.refresh_token.create({
                data: {
                    token: hashToken(refreshToken),
                    empleadoId: empleado.id,
                    sessionId: sessionId,
                    createdAt: now,
                    expiresAt: toZonedTime(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), "America/Costa_Rica") // 7 días
                }
            });
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Error desconocido";
            return NextResponse.json(
                { status: false, message: errorMessage },
                { status: 500 }
            );
        }

        const empleado_plaza = await prisma.c_empleado_plaza.findMany({
            where: {
                empleado_id: empleado.id
            }
        });

        const roles: { role: { name: string, id: number }, division: { id: number, name: string } }[] = [];
        for (const item of empleado_plaza) {

            if (!item.plaza_id || !item.division_id) {
                continue;
            }

            const division = await prisma.n_division.findFirst({
                where: {
                    id: item.division_id
                }
            });

            if (!division) {
                continue;
            }

            const plaza = await prisma.e_estructura_plazas.findFirst({
                where: {
                    id: item.plaza_id
                }
            });

            if (!plaza || !plaza.categoriaSalarial_id) {
                continue;
            }

            const categoria_salarial = await prisma.pg_categoria_salarial.findFirst({
                where: {
                    id: plaza.categoriaSalarial_id
                }
            });

            if (!categoria_salarial || !categoria_salarial.categoriaEmpleado_id) {
                continue;
            }

            const categoria_empleado = await prisma.pg_categoria_empleado.findFirst({
                where: {
                    id: categoria_salarial.categoriaEmpleado_id
                }
            });

            if (!categoria_empleado) {
                continue;
            }

            let role = "OPERATIVO";
            switch (categoria_empleado.codigo) {
                case "OFI":
                    role = "OPERATIVO";
                    break;
                case "MIS":
                    role = "OPERATIVO";
                    break;
                case "ADM":
                    role = "ADMINISTRATIVO";
                    break;
                case "COO":
                    role = "SUPERVISOR";
                    break;
                case "SUP":
                    role = "SUPERVISOR";
                    break;
                case "OFC":
                    role = "OPERATIVO";
                    break;
            }

            const exist_role = roles.find(role => role.role.id === categoria_empleado.id && role.division.id === item.division_id);
            if (exist_role) {
                continue;
            }

            roles.push({
                role: { name: role, id: categoria_empleado.id },
                division: { id: item.division_id, name: division.nombre }
            });
        }

        // Retornar éxito con el token de acceso y refresh
        return NextResponse.json(
            {
                status: true,
                message: "Logeado con éxito",
                accessToken,
                refreshToken,
                empleado: {
                    id: empleado.id,
                    cedula: empleado.cedula,
                    nombre: empleado.nombre,
                    apellido: empleado.primer_apellido,
                    segundo_apellido: empleado.segundo_apellido,
                    email: empleado.Email,
                    telefono: empleado.telefono,
                    tipoCedula: empleado.tipoCedula,
                    fechaContratacion: empleado.fecha_contratacion,
                    firmaManual: empleado.firma_manual,
                    roles: roles,
                    supervisor_id: empleado.supervisor_id
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
    }
}
