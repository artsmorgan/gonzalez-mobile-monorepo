import { NextRequest, NextResponse } from "next/server";
import { toZonedTime } from "date-fns-tz";
import { verifyAccessToken } from "../../../../../../utils/verifyToken";
import { prisma } from "../../../../../../utils/prismaClient";

// GET: devuelve las marcas del usuario para hoy y los próximos 30 días
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, expired, payload, message } = verifyAccessToken(req);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const { id } = await context.params;
        const empleadoId = parseInt(id, 10);
        if (Number.isNaN(empleadoId)) {
            return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
        }

        // Fechas en zona CR para evitar desfases
        const nowCR = toZonedTime(new Date(), "America/Costa_Rica");
        const startDate = new Date(Date.UTC(nowCR.getFullYear(), nowCR.getMonth(), nowCR.getDate()));
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 30);

        const marcas = await prisma.c_marca_dia.findMany({
            where: {
                empleadoFijo_id: empleadoId,
                fecha: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            orderBy: [
                { fecha: "asc" },
                { hora_inicio: "asc" },
            ],
        });

        const marcasReturn: { id: number, fecha: Date, hora_inicio: Date | null, hora_fin: Date | null, tipo_turno: string | null, empresa: { id: number, nombre: string }, cliente: { id: number, nombre: string }, contrato: { id: number, nombre: string }, corpo: { id: number, nombre: string }, puesto: { id: number, nombre: string }, plaza: { id: number, nombre: string } }[] = [];

        for (const marca of marcas) {

            const empresa = await prisma.e_estructura_empresa.findUnique({ where: { id: marca.empresa_id } });
            if (!empresa) {
                continue;
            }
            const cliente = await prisma.e_estructura_cliente.findUnique({ where: { id: marca.cliente_id } });
            if (!cliente) {
                continue;
            }
            const contrato = await prisma.e_estructura_contrato.findUnique({ where: { id: marca.contrato_id } });
            if (!contrato) {
                continue;
            }
            const corpo = await prisma.e_estructura_sucursal.findUnique({ where: { id: marca.corpo_id } });
            if (!corpo) {
                continue;
            }
            const puesto = await prisma.e_estructura_puesto.findUnique({ where: { id: marca.puesto_id } });
            if (!puesto) {
                continue;
            }
            const plaza = await prisma.e_estructura_plazas.findUnique({ where: { id: marca.plaza_id } });
            if (!plaza) {
                continue;
            }

            const marca_return = {
                id: marca.id,
                fecha: marca.fecha,
                hora_inicio: marca.hora_inicio,
                hora_fin: marca.hora_fin,
                tipo_turno: marca.tipo_turno,
                empresa: {
                    id: marca.empresa_id,
                    nombre: empresa.nombre,
                },
                cliente: {
                    id: marca.cliente_id,
                    nombre: cliente.nombre,
                },
                contrato: {
                    id: marca.contrato_id,
                    nombre: contrato.nombre,
                },
                corpo: {
                    id: marca.corpo_id,
                    nombre: corpo.nombre,
                },
                puesto: {
                    id: marca.puesto_id,
                    nombre: puesto.nombre,
                },
                plaza: {
                    id: marca.plaza_id,
                    nombre: plaza.nombre,
                }
            };

            marcasReturn.push(marca_return);
        }

        return NextResponse.json(
            {
                status: true,
                data: marcasReturn,
            },
            { status: 200 }
        );
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ status: false, message }, { status: 500 });
    }
}

