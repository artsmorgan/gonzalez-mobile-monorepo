/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";

export async function GET(req: NextRequest) {
    try {
        const { valid, expired, message } = await verifyAccessTokenByApi(req);
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

        type CambioRow = {
            created_by: number;
            [key: string]: any;
        };
        type EmpleadoRow = {
            id: number;
            nombre: string | null;
            primer_apellido: string | null;
            segundo_apellido: string | null;
            cedula: string | null;
        };

        const rows = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_cambios_apps_modules",
                operation: "findMany",
                where: { nombre_tabla: tabla, registro_id },
                orderBy: { id: "desc" },
                take: 200,
            }
        });

        // Obtener IDs únicos de empleados
        const typedRows: CambioRow[] = Array.isArray(rows) ? rows : [];
        const empleadoIds = Array.from(new Set(typedRows.map((r: CambioRow) => r.created_by).filter((id: number) => id > 0)));
        const empleadosMap = new Map<number, { nombre: string; primer_apellido: string; segundo_apellido: string | null; cedula: string }>();

        if (empleadoIds.length > 0) {
            const empleados = await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "c_empleado",
                    operation: "findMany",
                    where: { id: { in: empleadoIds } },
                    select: {
                        id: true,
                        nombre: true,
                        primer_apellido: true,
                        segundo_apellido: true,
                        cedula: true,
                    },
                }
            });

            const typedEmpleados: EmpleadoRow[] = Array.isArray(empleados) ? empleados : [];
            typedEmpleados.forEach((emp: EmpleadoRow) => {
                empleadosMap.set(emp.id, {
                    nombre: emp.nombre || "",
                    primer_apellido: emp.primer_apellido || "",
                    segundo_apellido: emp.segundo_apellido || "",
                    cedula: emp.cedula || "",
                });
            });
        }

        const dataWithEmpleado = typedRows.map((row: CambioRow) => {
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


