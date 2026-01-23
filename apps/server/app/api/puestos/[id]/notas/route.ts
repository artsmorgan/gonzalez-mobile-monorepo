import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../../utils/verifyToken";
import { toZonedTime, format } from "date-fns-tz";
import { prisma } from "../../../../../utils/prismaClient";
import { sendNotificationByPlaza } from "../../../../../utils/sendNotification";
import { getUserMarca } from "../../../../../utils/getUserMarca";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, expired, payload, message } = verifyAccessToken(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);

        if (!id) {
            return NextResponse.json({ status: false, message: "Marca no especificada" }, { status: 200 });
        }

        const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id } });
        if (!marcaDia) {
            return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 200 });
        }

        if (!marcaDia.empleadoFijo_id) {
            return NextResponse.json(
                { status: false, message: "Empleado no encontrado" },
                { status: 200 }
            );
        }

        const last_marca = await getUserMarca(marcaDia.empleadoFijo_id);
        if (!last_marca) return NextResponse.json({ message: "No se encontró la última marca" }, { status: 404 });
        if (marcaDia.id !== last_marca.id) return NextResponse.json({ message: "Hay una nueva marca más reciente" }, { status: 400 });

        const puesto = await prisma.e_estructura_puesto.findUnique({ where: { id: marcaDia.puesto_id } });
        if (!puesto) {
            return NextResponse.json({ status: false, message: "Puesto no encontrado" }, { status: 200 });
        }

        const notas = await prisma.c_puesto_notas.findMany({ where: { puesto_id: puesto.id } });

        const notas_return: { id: number, titulo: string, description: string, categoria_id: number | null, relevancia: string | null, puesto_id: number, empleado: string, created_at: Date, updated_at: Date, id_local: string }[] = [];

        for (const nota of notas) {

            let empleado_name = "-";
            const lastChange = await prisma.c_puesto_notas_bitacora_cambios.findFirst({ where: { nota_id: nota.id }, orderBy: { created_at: "desc" } });
            if (lastChange) {
                const empleado = await prisma.c_empleado.findUnique({ where: { id: lastChange.empleado_id } });
                if (empleado) {
                    empleado_name = empleado.nombre + " " + empleado.primer_apellido + " " + empleado.segundo_apellido;
                }
            }

            notas_return.push({
                id: nota.id,
                titulo: nota.titulo,
                description: nota.description,
                categoria_id: nota.categoria_id ?? null,
                relevancia: nota.relevancia ?? null,
                empleado: empleado_name,
                puesto_id: nota.puesto_id,
                created_at: nota.created_at,
                updated_at: nota.updated_at,
                id_local: "",
            });
        }
        return NextResponse.json({ status: true, notas: notas_return }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, expired, payload, message } = verifyAccessToken(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);

        const { marca_id, empleado_id, titulo, description, categoria_id, relevancia, puestos } = await req.json();

        const created_at = toZonedTime(new Date(), "America/Costa_Rica");
        const updated_at = toZonedTime(new Date(), "America/Costa_Rica");

        const categoriaData = await prisma.n_novedades_categoria.findUnique({ where: { id: categoria_id } });
        if (!categoriaData) return NextResponse.json({ status: false, message: "Categoría no encontrada" }, { status: 200 });

        const puestos_parse: number[] = JSON.parse(puestos);

        // Si relevancia no viene o es null, usar "Baja" por defecto
        const relevanciaValue = relevancia || 'Baja';

        for (const puesto_id of puestos_parse) {
            const puesto = await prisma.e_estructura_puesto.findUnique({ where: { id: puesto_id } });
            if (!puesto) return NextResponse.json({ status: false, message: "Puesto no encontrado" }, { status: 200 });

            const empleado = await prisma.c_empleado.findUnique({ where: { id: empleado_id } });
            if (!empleado) return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 200 });

            const newNote = await prisma.c_puesto_notas.create({ data: { titulo, description, categoria_id: categoria_id, relevancia: relevanciaValue, puesto_id, created_at, updated_at } });

            const bitacora = await prisma.c_puesto_notas_bitacora_cambios.create({ data: { nota_id: newNote.id, titulo, description, relevancia: relevanciaValue, created_at, empleado_id, categoria: categoriaData.nombre } });

            if (bitacora) {
                const plazaIds = await prisma.e_estructura_plazas.findMany({ where: { puesto_id: puesto.id } });
                await sendNotificationByPlaza(marca_id, "Bitácora creada", `${empleado.nombre} ${empleado.primer_apellido} ha creado una nota llamada ${newNote.titulo} de tipo ${categoriaData.nombre}`, plazaIds.map(plaza => plaza.id));
            }
        }
        return NextResponse.json({ status: true, message: "Nota creada con éxito" }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
} 