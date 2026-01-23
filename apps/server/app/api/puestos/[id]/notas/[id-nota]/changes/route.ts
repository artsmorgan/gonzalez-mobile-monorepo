import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../../../../utils/verifyToken";
import { toZonedTime } from "date-fns-tz";

import { prisma } from "../../../../../../../utils/prismaClient";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string, "id-nota": string }> }) {
    try {
        const { valid, expired, payload, message } = verifyAccessToken(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;

        const id = parseInt(resolvedParams.id);
        const id_nota = parseInt(resolvedParams["id-nota"]);

        const puesto = await prisma.e_estructura_puesto.findUnique({ where: { id } });
        if (!puesto) return NextResponse.json({ status: false, message: "Puesto no encontrado" }, { status: 200 });

        const nota = await prisma.c_puesto_notas.findUnique({ where: { id: id_nota } });
        if (!nota) return NextResponse.json({ status: false, message: "Nota no encontrada" }, { status: 200 });

        const changes = await prisma.c_puesto_notas_bitacora_cambios.findMany({ where: { nota_id: id_nota } });

        const changes_return: { id: number, nota_id: number, empleado: string, titulo: string, description: string, categoria: string, relevancia: string | null, created_at: Date }[] = [];
        for (const change of changes) {
            const empleado = await prisma.c_empleado.findUnique({ where: { id: change.empleado_id } });
            if (!empleado) continue;
            changes_return.push({
                id: change.id,
                nota_id: change.nota_id,
                empleado: empleado.nombre + " " + empleado.primer_apellido + " " + empleado.segundo_apellido,
                titulo: change.titulo,
                description: change.description,
                categoria: change.categoria,
                relevancia: change.relevancia ?? null,
                created_at: change.created_at,
            });
        }
        return NextResponse.json({ status: true, changes: changes_return }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}