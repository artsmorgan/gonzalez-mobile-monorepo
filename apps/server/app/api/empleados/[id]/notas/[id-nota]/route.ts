import { NextRequest, NextResponse } from "next/server";
import { toZonedTime } from "date-fns-tz";
import { verifyAccessTokenByApi } from "../../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../../utils/callDynamicPrisma";

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string, "id-nota": string }> }) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
        if (!valid) {
            return NextResponse.json({ status: false, expired, message }, { status: expired ? 401 : 403 });
        }

        const resolvedParams = await context.params;
        const empleadoId = parseInt(resolvedParams.id, 10);
        const notaId = parseInt(resolvedParams["id-nota"], 10);

        if (!empleadoId || Number.isNaN(empleadoId)) {
            return NextResponse.json({ status: false, message: "Empleado no válido" }, { status: 200 });
        }
        if (!notaId || Number.isNaN(notaId)) {
            return NextResponse.json({ status: false, message: "Nota no válida" }, { status: 200 });
        }

        const nota = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_puesto_notas",
                operation: "findUnique",
                where: { id: notaId }
            }
        });
        if (!nota) {
            return NextResponse.json({ status: false, message: "Nota no encontrada" }, { status: 200 });
        }

        await callDynamicPrisma({
            req,
            data: {
                action: "DELETE",
                table: "c_puesto_notas",
                where: { id: notaId },
                returning: false
            }
        });

        const beforeLimited = {
            id: nota.id,
            titulo: nota.titulo,
            description: nota.description,
            categoria_id: nota.categoria_id ?? null,
            relevancia: nota.relevancia ?? null,
            puesto_id: nota.puesto_id,
        };
        const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : empleadoId;

        await callDynamicPrisma({
            req,
            data: {
                action: "POST",
                table: "c_cambios_apps_modules",
                data: {
                    nombre_tabla: "c_puesto_notas",
                    registro_id: notaId,
                    cambios: JSON.stringify([{ prop: "__deleted__", before: beforeLimited, after: null }]),
                    created_at: toZonedTime(new Date(), "America/Costa_Rica").toISOString(),
                    created_by: createdBy,
                },
                returning: false
            }
        });

        return NextResponse.json({ status: true, message: "Nota eliminada con éxito" }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}
