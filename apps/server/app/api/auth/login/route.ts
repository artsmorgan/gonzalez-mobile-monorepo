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

        const passwordMatch = await bcrypt.compare(password, empleado.password);

        if (!passwordMatch) {
            return NextResponse.json(
                { status: false, message: "Usuario o contraseña inválidos" },
                { status: 401 }
            );
        }

        // 👉 Generar Access Token (expira en 15 minutos) para el usuario
        const accessToken = jwt.sign(
            { id: empleado.id, cedula: empleado.cedula },
            process.env.JWT_SECRET,
            { expiresIn: "5m" }
        );

        // 👉 Generar Refresh Token (expira en 7 días) para el usuario
        const refreshToken = jwt.sign(
            { id: empleado.id },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: "15m" }
        );

        // 🔐 Guardar el refresh token en la BD
        await prisma.refresh_token.create({
            data: {
                token: refreshToken,
                empleadoId: empleado.id,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            }
        });

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
                    roles: roles
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
