import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../../utils/verifyToken";
import { prisma } from "../../../../../utils/prismaClient";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        console.log("GET /api/evaluation/corpo/[id]");
        const { valid, payload, message } = verifyAccessToken(req);
        if (!valid) {
            return NextResponse.json(
                { status: false, message: message },
                { status: 401 }
            );
        }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);

        const corpo = await prisma.e_estructura_sucursal.findFirst({ where: { id } });
        if (!corpo) return NextResponse.json({ status: false, message: "Corpo no encontrado" }, { status: 404 });

        const evaluaciones = await prisma.c_evaluacion.findMany({ where: { corpo_id: corpo.id } });

        const evaluaciones_return: {
            id: number,
            corpo: {
                id: number,
                nombre: string,
            },
            puesto: {
                id: number,
                nombre: string,
            },
            plaza: {
                id: number,
                nombre: string,
            },
            tipo: string,
            evaluation: string,
            firma_evaluador: string,
            created_at: string,
            id_local: string
        }[] = [];

        for (const evaluacion of evaluaciones) {
            const puesto = await prisma.e_estructura_puesto.findUnique({ where: { id: evaluacion.puesto_id } });
            if (!puesto) continue;
            const plaza = await prisma.e_estructura_plazas.findUnique({ where: { id: evaluacion.plaza_id } });
            if (!plaza) continue;
            evaluaciones_return.push({
                id: evaluacion.id,
                corpo: { id: corpo.id, nombre: corpo.nombre },
                puesto: { id: puesto.id, nombre: puesto.nombre },
                plaza: { id: plaza.id, nombre: plaza.nombre },
                tipo: evaluacion.tipo,
                evaluation: evaluacion.evaluation,
                firma_evaluador: evaluacion.firma_evaluador,
                created_at: evaluacion.created_at.toISOString(),
                id_local: ""
            });
        }
        return NextResponse.json({ status: true, evaluaciones: evaluaciones_return }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}