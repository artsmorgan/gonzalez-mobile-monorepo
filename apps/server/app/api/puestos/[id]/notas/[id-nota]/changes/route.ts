import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../../../utils/callDynamicPrisma";
import { toZonedTime } from "date-fns-tz";
import { reportError } from "../../../../../../../utils/reportError";

import { prisma } from "../../../../../../../utils/prismaClient";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string, "id-nota": string }> }) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;

        const id = parseInt(resolvedParams.id);
        const id_nota = parseInt(resolvedParams["id-nota"]);

        const puesto = await prisma.e_estructura_puesto.findUnique({ where: { id } });
        if (!puesto) {
            await reportError(req, "api/puestos/[id]/notas/[id-nota]/changes", "GET", 404, "Puesto no encontrado");
            return NextResponse.json({ status: false, message: "Puesto no encontrado" }, { status: 404 });
        }

        const nota = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "c_puesto_notas", operation: "findUnique", where: { id: id_nota } }
        });
        if (!nota) {
            await reportError(req, "api/puestos/[id]/notas/[id-nota]/changes", "GET", 404, "Nota no encontrada");
            return NextResponse.json({ status: false, message: "Nota no encontrada" }, { status: 404 });
        }

        const changes = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "c_puesto_notas_bitacora_cambios", operation: "findMany", where: { nota_id: id_nota } }
        });

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
        await reportError(req, "api/puestos/[id]/notas/[id-nota]/changes", "GET", 500, errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}