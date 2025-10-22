import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { verifyAccessToken } from "../../../../../../utils/verifyToken";
import { toZonedTime } from "date-fns-tz";

const prisma = new PrismaClient();

export async function GET(req: NextRequest, context: { params: Promise<{ id: string, "id-nota": string }> }) {
    try {
        const { valid, payload, message } = verifyAccessToken(req);

        if (!valid) {
            return NextResponse.json(
                { status: false, message: message },
                { status: 401 }
            );
        }

        const resolvedParams = await context.params;

        const id = parseInt(resolvedParams.id);
        const id_nota = parseInt(resolvedParams["id-nota"]);

        const puesto = await prisma.e_estructura_puesto.findUnique({ where: { id } });
        if (!puesto) return NextResponse.json({ status: false, message: "Puesto no encontrado" }, { status: 200 });

        const nota = await prisma.c_puesto_notas.findUnique({ where: { id: id_nota } });
        if (!nota) return NextResponse.json({ status: false, message: "Nota no encontrada" }, { status: 200 });

        if (nota.puesto_id !== id) return NextResponse.json({ status: false, message: "Nota no pertenece al puesto" }, { status: 200 });

        return NextResponse.json({ status: true, nota }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string, "id-nota": string }> }) {
    try {
        const { valid, payload, message } = verifyAccessToken(req);

        if (!valid) {
            return NextResponse.json(
                { status: false, message: message },
                { status: 401 }
            );
        }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);
        const id_nota = parseInt(resolvedParams["id-nota"]);

        const { titulo, description, categoria, empleado_id } = await req.json();

        const puesto = await prisma.e_estructura_puesto.findUnique({ where: { id } });
        if (!puesto) return NextResponse.json({ status: false, message: "Puesto no encontrado" }, { status: 200 });

        const empleado = await prisma.c_empleado.findUnique({ where: { id: empleado_id } });
        if (!empleado) return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 200 });

        const categoriaData = await prisma.n_novedades_categoria.findUnique({ where: { id: categoria } });
        if (!categoriaData) return NextResponse.json({ status: false, message: "Categoría no encontrada" }, { status: 200 });

        const nota = await prisma.c_puesto_notas.findUnique({ where: { id: id_nota } });
        if (!nota) return NextResponse.json({ status: false, message: "Nota no encontrada" }, { status: 200 });

        if (nota.puesto_id !== puesto.id) return NextResponse.json({ status: false, message: "Nota no pertenece al puesto" }, { status: 200 });

        const updated_at = toZonedTime(new Date(), "America/Costa_Rica");

        const updatedNota = await prisma.c_puesto_notas.update({ where: { id: id_nota }, data: { titulo, description, categoria_id: categoria, puesto_id: puesto.id, updated_at } });

        await prisma.c_puesto_notas_bitacora_cambios.create({ data: { nota_id: id_nota, titulo, description, created_at: updated_at, empleado_id: empleado.id, categoria: categoriaData.nombre } });

        return NextResponse.json({ status: true, message: "Nota actualizada con éxito" }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string, "id-nota": string }> }) {
    try {
        const { valid, payload, message } = verifyAccessToken(req);

        if (!valid) {
            return NextResponse.json(
                { status: false, message: message },
                { status: 401 }
            );
        }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);
        const id_nota = parseInt(resolvedParams["id-nota"]);

        const puesto = await prisma.e_estructura_puesto.findUnique({ where: { id } });
        if (!puesto) return NextResponse.json({ status: false, message: "Puesto no encontrado" }, { status: 200 });

        const nota = await prisma.c_puesto_notas.findUnique({ where: { id: id_nota } });
        if (!nota) return NextResponse.json({ status: false, message: "Nota no encontrada" }, { status: 200 });

        if (nota.puesto_id !== puesto.id) return NextResponse.json({ status: false, message: "Nota no pertenece al puesto" }, { status: 200 });

        await prisma.c_puesto_notas.delete({ where: { id: id_nota } });
        return NextResponse.json({ status: true, message: "Nota eliminada con éxito" }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}   