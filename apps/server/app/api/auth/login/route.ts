/* Login principal: tablas preexistentes (Prisma) + orquestación de tablas creadas y Planillas. */
import { NextRequest, NextResponse } from "next/server";
import axios, { AxiosError, AxiosResponse } from "axios";
import { v4 as uuidv4 } from "uuid";
import { toZonedTime } from "date-fns-tz";
import { prisma } from "../../../../utils/prismaClient";
import { resolveServerBaseUrl } from "../../../../utils/resolveServerBaseUrl";
import { createTokenPlanillas } from "../../../../utils/createTokenPlanillas";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";
import dotenv from "dotenv";
dotenv.config();
// eslint-disable-next-line @typescript-eslint/no-require-imports
const jwt = require("jsonwebtoken");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bcrypt = require("bcrypt");

type RoleEntry = {
    role: { name: string; id: number };
    division: { id: number; name: string };
};

async function buildEmpleadoRoles(empleadoId: number): Promise<RoleEntry[]> {
    const empleadoPlazas = await prisma.c_empleado_plaza.findMany({
        where: { empleado_id: empleadoId },
    });

    const roles: RoleEntry[] = [];

    for (const item of empleadoPlazas) {
        if (!item.plaza_id || !item.division_id) continue;

        const division = await prisma.n_division.findFirst({ where: { id: item.division_id } });
        if (!division) continue;

        const plaza = await prisma.e_estructura_plazas.findFirst({ where: { id: item.plaza_id } });
        if (!plaza || !plaza.categoriaSalarial_id) continue;

        const categoria_salarial = await prisma.pg_categoria_salarial.findFirst({
            where: { id: plaza.categoriaSalarial_id },
        });
        if (!categoria_salarial || !categoria_salarial.categoriaEmpleado_id) continue;

        const categoria_empleado = await prisma.pg_categoria_empleado.findFirst({
            where: { id: categoria_salarial.categoriaEmpleado_id },
        });
        if (!categoria_empleado) continue;

        let roleName = "OPERATIVO";
        switch (categoria_empleado.codigo) {
            case "ADM":
                roleName = "ADMINISTRATIVO";
                break;
            case "COO":
            case "SUP":
                roleName = "SUPERVISOR";
                break;
            default:
                roleName = "OPERATIVO";
        }

        const existing = roles.find(
            (r) => r.role.id === categoria_empleado.id && r.division.id === item.division_id,
        );
        if (existing) continue;

        roles.push({
            role: { name: roleName, id: categoria_empleado.id },
            division: { id: item.division_id, name: division.nombre },
        });
    }

    return roles;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { cedula, password, deviceName } = body;

        if (!cedula || !password) {
            return NextResponse.json(
                { status: false, message: "Cédula y contraseña son requeridos" },
                { status: 400 },
            );
        }

        const empleado = await prisma.c_empleado.findFirst({ where: { cedula } });

        if (!empleado) {
            return NextResponse.json({ status: false, message: "Empleado inválido" }, { status: 401 });
        }

        if (!empleado.password) {
            return NextResponse.json({ status: false, message: "Contraseña inválida" }, { status: 401 });
        }

        if (empleado.fecha_contratacion == null) {
            return NextResponse.json(
                { status: false, message: "Empleado no ha sido contratado" },
                { status: 401 },
            );
        }

        if (empleado.estado === "BA") {
            return NextResponse.json({ status: false, message: "Empleado fue dado de baja" }, { status: 401 });
        }

        const passwordExpiresAt = empleado.password_expires_at
            ? new Date(empleado.password_expires_at)
            : null;
        if (passwordExpiresAt && passwordExpiresAt < toZonedTime(new Date(), "America/Costa_Rica")) {
            return NextResponse.json(
                { status: false, passwordExpired: true, message: "Contraseña expirada, debe cambiarla" },
                { status: 401 },
            );
        }
        
        const planillasUrl = process.env.PLANILLAS_URL;
        if (!planillasUrl) {
            return NextResponse.json({ status: false, message: "URL de Planillas no configurada" }, { status: 500 });
        }

        const url_planillas_login = `${planillasUrl.replace(/\/+$/, "")}/login`;
        let response_planillas_login: AxiosResponse;
        try {
            response_planillas_login = await axios.post(
                url_planillas_login,
                {
                    username: cedula,
                    password,
                },
                {
                    headers: {
                        "Content-Type": "application/json",
                    },
                },
            );
        } catch (error) {
            if (error instanceof AxiosError && error.response?.status === 401 && error.response?.data?.error?.code === "INVALID_CREDENTIALS") {
                return NextResponse.json({ status: false, message: "Credenciales inválidas" }, { status: 401 });
            }
            else {
                console.error("Error en login (auth/login):", error);
                return NextResponse.json({ status: false, message: "Error al iniciar sesión en Planillas" }, { status: 500 });
            }
        }

        if (!response_planillas_login) {
            return NextResponse.json({ status: false, message: "Error al iniciar sesión en Planillas" }, { status: 500 });
        }

        // `toZonedTime` ya desplaza el instante para que sus getters UTC devuelvan la hora de
        // reloj de Costa Rica; restar 6 horas otra vez aquí duplicaba el desplazamiento y dejaba
        // el token de Planillas "vencido" casi de inmediato (mismo bug que en createTokenPlanillas.ts).
        let now = toZonedTime(new Date(), "America/Costa_Rica");
        if (process.env.NODE_ENV === "development") {
            now = toZonedTime(new Date(now.getTime() - 6 * 60 * 60 * 1000), "America/Costa_Rica");
        }
        const expiresInSec = Number(response_planillas_login.data.data.expires_in);
        const expiresInMs = expiresInSec * 1000;
        const planillasTokenExpiresAt_planillas_login = now.getTime() + expiresInMs;
        console.log('Planillas token expires at: ', planillasTokenExpiresAt_planillas_login);
        const expires_at = new Date(planillasTokenExpiresAt_planillas_login);
        const planillasToken_planillas_login = String(response_planillas_login.data.data.token ?? "");

        if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
            throw new Error("JWT secrets not configured");
        }

        const sessionId = uuidv4();

        const accessToken = jwt.sign(
            { id: empleado.id, cedula: empleado.cedula, sessionId },
            process.env.JWT_SECRET!,
            { expiresIn: "1d" },
        );

        const refreshToken = jwt.sign(
            { id: empleado.id, sessionId },
            process.env.JWT_REFRESH_SECRET!,
            { expiresIn: "7d" },
        );

        
        const prismaOpts = {
            token: accessToken,
            shouldVerifyAccessToken: Boolean(accessToken),
        };

        const mobile_token = await callDynamicPrisma({
            req: request,
            data: {
                action: "GET",
                table: "a_mobile_token_for_planillas",
                operation: "findFirst",
                where: { empleado_id: empleado.id },
            },
            ...prismaOpts,
        });

        if (mobile_token?.id) {
            await callDynamicPrisma({
                req: request,
                data: {
                    action: "UPDATE",
                    table: "a_mobile_token_for_planillas",
                    operation: "update",
                    where: { id: mobile_token.id },
                    data: {
                        token: planillasToken_planillas_login,
                        created_at: now,
                        expires_at,
                    },
                },
                ...prismaOpts,
            });
        } else {
            await callDynamicPrisma({
                req: request,
                data: {
                    action: "POST",
                    table: "a_mobile_token_for_planillas",
                    operation: "create",
                    data: {
                        empleado_id: empleado.id,
                        token: planillasToken_planillas_login,
                        created_at: now,
                        expires_at,
                    },
                },
                ...prismaOpts,
            });
        }

        const roles = await buildEmpleadoRoles(empleado.id);
        const baseUrl = resolveServerBaseUrl(request);
        const authHeader = `Bearer ${accessToken}`;

        const dynamicLoginRes = await axios.post(
            `${baseUrl}/api/dynamic-prisma/auth/login`,
            {
                empleadoId: empleado.id,
                empleadoCedula: empleado.cedula,
                sessionId,
                refreshToken,
                deviceName,
                loginMarca: {
                    nombre_empleado: `${empleado.nombre || ""} ${empleado.primer_apellido || ""} ${empleado.segundo_apellido || ""}`.trim(),
                    cedula_empleado: empleado.cedula || "",
                    fecha_hora: now.toISOString(),
                },
                firmaManualFallback: empleado.firma_manual,
            },
            {
                headers: {
                    Authorization: authHeader,
                    "Content-Type": "application/json",
                },
                validateStatus: () => true,
            },
        );

        if (dynamicLoginRes.status !== 200 || !dynamicLoginRes.data?.status) {
            console.error(
                "Error en dynamic-prisma/auth/login:",
                dynamicLoginRes.status,
                dynamicLoginRes.data,
            );
            return NextResponse.json(
                {
                    status: false,
                    message: dynamicLoginRes.data?.message || "Error al registrar sesión",
                },
                { status: dynamicLoginRes.status >= 400 ? dynamicLoginRes.status : 500 },
            );
        }

        let empleadoFoto: string | null = null;
        try {
            const url = `${planillasUrl.replace(/\/+$/, "")}/empleados/${empleado.codigo}/foto`;
            const response = await axios.get(
                url,
                {
                    headers: {
                        "Authorization": `Bearer ${planillasToken_planillas_login}`,
                    },
                },
            );

            if (response.data?.success) {
                empleadoFoto = response.data.data.imagen?.base64 ?? null;
                console.log("Empleado foto:", empleadoFoto?.length ?? 0);
            }

        }
        catch (error) {
            console.error("Error en login (auth/login):", error);
        }

        return NextResponse.json(
            {
                status: true,
                message: "Logeado con éxito",
                accessToken,
                refreshToken,
                createdAt: now.getTime(),
                planillasToken: planillasToken_planillas_login,
                planillasTokenExpiresAt: planillasTokenExpiresAt_planillas_login,
                empleado: {
                    id: empleado.id,
                    cedula: empleado.cedula,
                    nombre: empleado.nombre,
                    apellido: empleado.primer_apellido,
                    codigo: empleado.codigo,
                    segundo_apellido: empleado.segundo_apellido,
                    email: empleado.Email,
                    Email: empleado.Email,
                    telefono: empleado.telefono,
                    tipoCedula: empleado.tipoCedula,
                    fechaContratacion: empleado.fecha_contratacion,
                    firmaManual: dynamicLoginRes.data.firmaManual ?? empleado.firma_manual,
                    isSuperAdmin: dynamicLoginRes.data.isSuperAdmin,
                    roles,
                    supervisor_id: empleado.supervisor_id,
                    foto: empleadoFoto,
                },
            },
            { status: 200 },
        );
    } catch (error) {
        return NextResponse.json({ status: false, message: "Error interno del servidor" }, { status: 500 });
    }
}
