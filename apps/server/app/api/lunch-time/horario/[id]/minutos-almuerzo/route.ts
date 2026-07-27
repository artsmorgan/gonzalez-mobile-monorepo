import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../utils/prismaClient";
import { verifyAccessTokenByApi } from "../../../../../../utils/verifyAccessTokenByApi";
import axios from "axios";

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, expired, message } = await verifyAccessTokenByApi(req);

        if (!valid) {
            return NextResponse.json(
                { status: false, expired, message },
                { status: expired ? 401 : 403 }
            );
        }

        const planillasToken = await req.headers.get("planillas-token");
        if (!planillasToken) {
            return NextResponse.json(
                { status: false, message: "Token de Planillas requerido" },
                { status: 401 }
            );
        }

        const resolvedParams = await context.params;
        const horarioId = parseInt(resolvedParams.id, 10);
        if (!Number.isFinite(horarioId) || horarioId <= 0) {
            return NextResponse.json({ status: false, message: "Identificador de horario inválido" }, { status: 400 });
        }

        const body = await req.json();
        const minutosRaw = Number(body?.minutos_almuerzo);
        if (!Number.isFinite(minutosRaw) || minutosRaw <= 0) {
            return NextResponse.json(
                { status: false, message: "minutos_almuerzo debe ser un número mayor a 0" },
                { status: 400 }
            );
        }

        const horario = await prisma.c_horario.findUnique({ where: { id: horarioId } });
        if (!horario) {
            return NextResponse.json({ status: false, message: "Horario no encontrado" }, { status: 404 });
        }

        const minutosAlmuerzo = Math.round(minutosRaw);

        const bodyUpdateHorario = { minutos_almuerzo: minutosAlmuerzo };

        const planillasResponse = await axios.put(`${process.env.PLANILLAS_URL}/horarios/${horarioId}/minutos-almuerzo`, bodyUpdateHorario, { 
            headers: {
                "Authorization": `Bearer ${planillasToken}`,
                "Content-Type": "application/json"
            }
        });
  
        if (!planillasResponse.data.success) {
          return NextResponse.json(
            { status: false, message: "Error al actualizar los minutos de alimentación" },
            { status: 500 }
          );
        }

        return NextResponse.json(
            { status: true, message: "Minutos de alimentación actualizados", minutos_almuerzo: minutosAlmuerzo },
            { status: 200 }
        );
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}
