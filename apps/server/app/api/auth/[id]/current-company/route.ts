import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../../utils/verifyToken";
import { toZonedTime } from "date-fns-tz";
import { prisma } from "../../../../../utils/prismaClient";


export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const resolvedParams = await context.params;
        const id = parseInt(resolvedParams.id);

        const { valid, expired, payload, message } = verifyAccessToken(request);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const empleado = await prisma.c_empleado.findUnique({ where: { id } });
        if (!empleado) {
            return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 200 });
        }

        const marcaDia = await prisma.c_marca_dia.findFirst({ where: { empleadoFijo_id: id }, orderBy: { id: "desc" } });
        if (!marcaDia) {
            return NextResponse.json({ status: false, message: "No se encontró la marca del dia" }, { status: 200 });
        }

        if (!marcaDia.hora_inicio || !marcaDia.hora_fin) {
            return NextResponse.json({ status: false, message: "Hora de inicio o fin no establecida" }, { status: 200 });
        }

        if (!marcaDia.hora_entrada_digitada || marcaDia.hora_salida_digitada) {
            return NextResponse.json({ status: false, message: "Fuera de horario" }, { status: 200 });
        }

        if (!marcaDia.empresa_id) {
            return NextResponse.json({ status: false, message: "Empresa no encontrada" }, { status: 200 });
        }

        const empresa = await prisma.e_estructura_empresa.findUnique({ where: { id: marcaDia.empresa_id } });
        if (!empresa) {
            return NextResponse.json({ status: false, message: "Empresa no encontrada" }, { status: 200 });
        }

        let empresa_name = "";
        switch (empresa.id) {
            case 9:
                empresa_name = "gonzalez";
                break;
            case 10:
                empresa_name = "charmander";
                break;
            default:
                empresa_name = "unknow";
                break;
        }

        return NextResponse.json({ status: true, company: empresa_name }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.log(errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}