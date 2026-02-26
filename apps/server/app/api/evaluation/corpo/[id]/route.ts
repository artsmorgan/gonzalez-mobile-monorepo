import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        console.log("GET /api/evaluation/corpo/[id]");
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);

        const corpo = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "e_estructura_sucursal", operation: "findFirst", where: { id } }
        });
        if (!corpo) return NextResponse.json({ status: false, message: "Corpo no encontrado" }, { status: 404 });

        const evaluaciones = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "c_evaluacion_empleado", operation: "findMany", where: { corpo_id: corpo.id } }
        });

        const evaluaciones_return: {
            id: number,
            empleado: {
                id: number,
                nombre: string,
                cedula: string,
            },
            evaluador: {
                id: number,
                nombre: string,
                cedula: string,
            },
            fecha_ingreso: string,
            fecha_evaluacion: string,
            evaluacion: string,
            comentarios: string,
            firma_evaluador: string,
            firma_empleado: string,
            firma_empleado_manual: string | null,
            tipo: string,
            id_local: string
        }[] = [];

        for (const evaluacion of evaluaciones) {
            const empleado = await callDynamicPrisma({
                req,
                data: { action: "GET", table: "c_empleado", operation: "findUnique", where: { id: evaluacion.empleado_id } }
            });
            if (!empleado) continue;
            if (empleado.fecha_contratacion == null) continue;
            if (empleado.estado == "BA") continue;
            const evaluador = await callDynamicPrisma({
                req,
                data: { action: "GET", table: "c_empleado", operation: "findUnique", where: { id: evaluacion.evaluador_id } }
            });
            if (!evaluador) continue;
            if (evaluador.fecha_contratacion == null) continue;
            if (evaluador.estado == "BA") continue;
            evaluaciones_return.push({
                id: evaluacion.id,
                empleado: { id: empleado.id, nombre: (empleado.nombre || "") + " " + (empleado.primer_apellido || "") + " " + (empleado.segundo_apellido || ""), cedula: empleado.cedula || "" },
                evaluador: { id: evaluador.id, nombre: (evaluador.nombre || "") + " " + (evaluador.primer_apellido || "") + " " + (evaluador.segundo_apellido || ""), cedula: evaluador.cedula || "" },
                fecha_ingreso: evaluacion.fecha_ingreso instanceof Date ? evaluacion.fecha_ingreso.toISOString() : evaluacion.fecha_ingreso,
                fecha_evaluacion: evaluacion.fecha_evaluacion instanceof Date ? evaluacion.fecha_evaluacion.toISOString() : evaluacion.fecha_evaluacion,
                evaluacion: evaluacion.evaluacion,
                comentarios: evaluacion.comentarios,
                firma_evaluador: evaluacion.firma_evaluador,
                firma_empleado: evaluacion.firma_empleado,
                firma_empleado_manual: evaluacion.firma_empleado_manual ?? null,
                tipo: evaluacion.tipo,
                id_local: ""
            });
        }
        return NextResponse.json({ status: true, evaluaciones: evaluaciones_return }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}