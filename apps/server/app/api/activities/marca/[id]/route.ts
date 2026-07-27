import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { getActivities } from "../../../../../utils/createActivities";
import { prisma } from "../../../../../utils/prismaClient";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);

        const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id } });
        if (!marcaDia) return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 200 });

        if (!marcaDia.hora_inicio || !marcaDia.hora_fin) {
            return NextResponse.json({ status: false, message: "Hora de inicio o fin no establecida" }, { status: 200 });
        }

        if (!marcaDia.hora_entrada_digitada) {
            return NextResponse.json({ status: false, message: "Hora de entrada del empleado no registrada" }, { status: 200 });
        }

        if (!marcaDia.puesto_id) {
            return NextResponse.json({ status: false, message: "Puesto no encontrado" }, { status: 200 });
        }
        const puesto = await prisma.e_estructura_puesto.findUnique({ where: { id: marcaDia.puesto_id } });
        if (!puesto) {
            return NextResponse.json({ status: false, message: "Puesto no encontrado" }, { status: 200 });
        }

        if (!marcaDia.plaza_id) {
            return NextResponse.json({ status: false, message: "Plaza no encontrada" }, { status: 200 });
        }
        const plaza = await prisma.e_estructura_plazas.findUnique({ where: { id: marcaDia.plaza_id } });
        if (!plaza) {
            return NextResponse.json({ status: false, message: "Plaza no encontrada" }, { status: 200 });
        }

        const actividades = await getActivities(req, marcaDia.id);

        if (!actividades.status) {
            return NextResponse.json({ status: false, message: actividades.message }, { status: 200 });
        }

        return NextResponse.json({ status: true, actividades: actividades.actividades }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        /*
        const { valid, expired, payload, message } = verifyAccessToken(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const resolvedParams = await context.params;
        const user_id = parseInt(resolvedParams["user-id"]);

        const user = await prisma.c_empleado.findUnique({ where: { id: user_id } });
        if (!user) {
            return NextResponse.json({ status: false, message: "Usuario no encontrado" }, { status: 200 });
        }
        const { actividad_id, articulo_id, es_correcto, motivo_incorrecto } = await req.json();

        const actividad = await prisma.e_actividad_corpo.findUnique({ where: { id: actividad_id } });
        if (!actividad) {
            return NextResponse.json({ status: false, message: "Actividad no encontrada" }, { status: 200 });
        }

        const articulo = await prisma.n_articulo_corpo_puesto.findUnique({ where: { id: articulo_id } });
        if (!articulo) {
            return NextResponse.json({ status: false, message: "Articulo no encontrado" }, { status: 200 });
        }

        const equipo = await prisma.e_actividad_corpo_equipo.findFirst({ where: { actividadCorpo_id: actividad.id } });
        if (!equipo) {
            return NextResponse.json({ status: false, message: "Equipo no encontrado" }, { status: 200 });
        }

        const newRevisionEquipo = await prisma.e_actividad_corpo_revision_equipo.create({ data: { actividadCorpoEquipo_id: equipo.id, empleado_id: user_id, articulo_id: articulo_id, es_correcto: es_correcto, motivo_incorrecto: motivo_incorrecto, created_at: toZonedTime(new Date(), "America/Costa_Rica"), updated_at: toZonedTime(new Date(), "America/Costa_Rica"), e_actividad_corpo_equipo: { connect: { id: equipo.id } }, e_articulo_corpo_puesto: { connect: { id: articulo_id } } } });
        */
        return NextResponse.json({ status: true, message: "Revision de equipo creada correctamente" }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}
