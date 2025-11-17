import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../utils/verifyToken";
import { toZonedTime } from "date-fns-tz";
import { prisma } from "../../../../utils/prismaClient";

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, payload, message } = verifyAccessToken(req);

        if (!valid) {
            return NextResponse.json({ status: false, message: message }, { status: 401 });
        }

        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);

        const incident = await prisma.c_incidente.findUnique({ where: { id } });
        if (!incident) {
            return NextResponse.json({ status: false, message: "Incidente no encontrado" }, { status: 200 });
        }

        const { solucion, fecha_solucion, fecha_real_solucion, costo_asociado, consecutivo_informe, link_informe } = await req.json();

        if (!solucion || !fecha_solucion || !fecha_real_solucion || !costo_asociado || !consecutivo_informe || !link_informe) {
            return NextResponse.json({ status: false, message: "Datos incompletos" }, { status: 200 });
        }

        incident.solucion = solucion;
        incident.fecha_solucion = new Date(fecha_solucion);
        incident.fecha_real_solucion = new Date(fecha_real_solucion);
        incident.costo_asociado = costo_asociado;
        incident.consecutivo_informe = consecutivo_informe;
        incident.link_informe = link_informe;
        incident.estado = true;
        await prisma.c_incidente.update({ where: { id }, data: incident });

        return NextResponse.json({ status: true, message: "Incidente actualizado correctamente" }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}