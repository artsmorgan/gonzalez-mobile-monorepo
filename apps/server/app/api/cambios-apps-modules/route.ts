/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../utils/verifyToken";
import { prisma } from "../../../utils/prismaClient";

export async function GET(req: NextRequest) {
    try {
        const { valid, expired, message } = verifyAccessToken(req);
        if (!valid) {
            return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });
        }

        const tabla = req.nextUrl.searchParams.get("tabla") ?? req.nextUrl.searchParams.get("nombre_tabla");
        const registroIdStr = req.nextUrl.searchParams.get("registro_id") ?? req.nextUrl.searchParams.get("id");

        if (!tabla || tabla.trim().length === 0) {
            return NextResponse.json({ status: false, message: "Tabla no especificada" }, { status: 200 });
        }
        if (!registroIdStr) {
            return NextResponse.json({ status: false, message: "Registro no especificado" }, { status: 200 });
        }
        const registro_id = parseInt(registroIdStr);
        if (!Number.isFinite(registro_id)) {
            return NextResponse.json({ status: false, message: "Registro inválido" }, { status: 200 });
        }

        const rows = await prisma.c_cambios_apps_modules.findMany({
            where: { nombre_tabla: tabla, registro_id },
            orderBy: { id: "desc" },
            take: 200,
        });

        // Obtener IDs únicos de empleados
        const empleadoIds = Array.from(new Set(rows.map((r) => r.created_by).filter((id) => id > 0)));
        const empleadosMap = new Map<number, { nombre: string; primer_apellido: string; segundo_apellido: string | null; cedula: string }>();

        if (empleadoIds.length > 0) {
            const empleados = await prisma.c_empleado.findMany({
                where: { id: { in: empleadoIds } },
                select: {
                    id: true,
                    nombre: true,
                    primer_apellido: true,
                    segundo_apellido: true,
                    cedula: true,
                },
            });

            empleados.forEach((emp) => {
                empleadosMap.set(emp.id, {
                    nombre: emp.nombre || "",
                    primer_apellido: emp.primer_apellido || "",
                    segundo_apellido: emp.segundo_apellido || "",
                    cedula: emp.cedula || "",
                });
            });
        }

        const dataWithEmpleado = rows.map((row) => {
            const empleado = empleadosMap.get(row.created_by);
            return {
                ...row,
                empleado_nombre: empleado
                    ? `${empleado.nombre} ${empleado.primer_apellido} ${empleado.segundo_apellido || ""}`.trim()
                    : null,
                empleado_cedula: empleado?.cedula || null,
            };
        });

        return NextResponse.json({ status: true, data: dataWithEmpleado }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error("Error in GET /api/cambios-apps-modules:", errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}


