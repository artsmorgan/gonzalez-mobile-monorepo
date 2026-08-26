import { NextRequest, NextResponse } from 'next/server';
import { transporter } from '../../../../transporter';
import { toZonedTime } from 'date-fns-tz';
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";
import { prisma } from "../../../../utils/prismaClient";
import axios from 'axios';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { cedula } = body;

        // Validar que se proporcione la cédula
        if (!cedula) {
            return NextResponse.json(
                { status: false, message: "Cédula es requerida" }
            );
        }

        // Buscar el empleado por cédula
        const empleado = await prisma.c_empleado.findFirst({ where: { cedula: cedula } }); 

        // Si no se encuentra el empleado
        if (!empleado) {
            return NextResponse.json(
                { status: false, message: "Empleado no encontrado" }
            );
        }

        // Si el empleado no tiene email configurado
        if (!empleado.Email) {
            return NextResponse.json(
                { status: false, message: "Empleado no tiene email configurado" }
            );
        }
        
        const planillasUrl = String(process.env.PLANILLAS_URL || "").trim().replace(/\/+$/, "");
        if (!planillasUrl || !empleado.id) {
            return NextResponse.json(
                { status: false, message: "Empleado no tiene id configurado" }
            );
        }

        console.log('planillasUrl', empleado.Email);

        const planillasResponse = await axios.post(`${planillasUrl}/forgot-password`, {
            correo_usuario: empleado.Email,
        });

        // Respuesta esperada: {"success":true,"data":{"message":"Se ha enviado un correo con el c\u00f3digo de verificaci\u00f3n.","expires_in":900}}

        if (planillasResponse.status !== 200 || !planillasResponse.data.success) {
            return NextResponse.json(
                { status: false, message: planillasResponse.data.message }
            );
        }
        // Retornar éxito con el email del empleado
        return NextResponse.json(
            {
                status: true,
                message: `Email de recuperación enviado a ${empleado.Email}`,
            }
        );

    } catch (error) {
        console.error('Error en forgot-password:', error);
        return NextResponse.json(
            { status: false, message: "Error interno del servidor" }
        );
    }
}
