import { NextRequest, NextResponse } from "next/server";
import { toZonedTime } from "date-fns-tz";
import { verifyAccessToken } from "../../../../../../utils/verifyToken";
import { verifyAccessTokenByApi } from "../../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../../utils/callDynamicPrisma";
import { prisma } from "../../../../../../utils/prismaClient";

// GET: devuelve las marcas del usuario para hoy y los próximos 30 días
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
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

        const marcas = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_marca_dia",
                operation: "findMany",
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
            },
        });

        const marcasReturn: { id: number, fecha: Date, hora_inicio: Date | null, hora_fin: Date | null, tipo_turno: string | null, empresa: { id: number, nombre: string }, cliente: { id: number, nombre: string }, contrato: { id: number, nombre: string }, corpo: { id: number, nombre: string, ubicacion: { lat: number | null, lng: number | null } }, puesto: { id: number, nombre: string, ubicacion: { lat: number | null, lng: number | null } }, plaza: { id: number, nombre: string } }[] = [];

        for (const marca of marcas) {

            const empresa = await callDynamicPrisma({
                req,
                data: { action: "GET", table: "e_estructura_empresa", operation: "findUnique", where: { id: marca.empresa_id ?? 0 } }
            });
            if (!empresa) {
                continue;
            }
            const cliente = await callDynamicPrisma({
                req,
                data: { action: "GET", table: "e_estructura_cliente", operation: "findUnique", where: { id: marca.cliente_id ?? 0 } }
            });
            if (!cliente) {
                continue;
            }
            const contrato = await callDynamicPrisma({
                req,
                data: { action: "GET", table: "e_estructura_contrato", operation: "findUnique", where: { id: marca.contrato_id ?? 0 } }
            });
            if (!contrato) {
                continue;
            }
            const corpo = await callDynamicPrisma({
                req,
                data: { action: "GET", table: "e_estructura_sucursal", operation: "findUnique", where: { id: marca.corpo_id ?? 0 } }
            });
            if (!corpo) {
                continue;
            }
            const puesto = await callDynamicPrisma({
                req,
                data: { action: "GET", table: "e_estructura_puesto", operation: "findUnique", where: { id: marca.puesto_id ?? 0 } }
            });
            if (!puesto) {
                continue;
            }
            const plaza = await callDynamicPrisma({
                req,
                data: { action: "GET", table: "e_estructura_plazas", operation: "findUnique", where: { id: marca.plaza_id ?? 0 } }
            });
            if (!plaza) {
                continue;
            }

            const marca_return : { id: number, fecha: Date, hora_inicio: Date | null, hora_fin: Date | null, tipo_turno: string | null, empresa: { id: number, nombre: string }, cliente: { id: number, nombre: string }, contrato: { id: number, nombre: string }, corpo: { id: number, nombre: string, ubicacion: { lat: number | null, lng: number | null } }, puesto: { id: number, nombre: string, ubicacion: { lat: number | null, lng: number | null } }, plaza: { id: number, nombre: string } } = {
                id: marca.id,
                fecha: marca.fecha,
                hora_inicio: marca.hora_inicio,
                hora_fin: marca.hora_fin,
                tipo_turno: marca.tipo_turno,
                empresa: {
                    id: marca.empresa_id ?? 0,
                    nombre: empresa.nombre,
                },
                cliente: {
                    id: marca.cliente_id ?? 0,
                    nombre: cliente.nombre,
                },
                contrato: {
                    id: marca.contrato_id ?? 0,
                    nombre: contrato.nombre,
                },
                corpo: {
                    id: marca.corpo_id ?? 0,
                    nombre: corpo.nombre,
                    ubicacion: {
                        lat: corpo.coordenadas_gpslat ? parseFloat(corpo.coordenadas_gpslat) : null,
                        lng: corpo.coordenadas_gpslng ? parseFloat(corpo.coordenadas_gpslng) : null
                    }
                },
                puesto: {
                    id: marca.puesto_id,
                    nombre: puesto.nombre,
                    ubicacion: {
                        lat: puesto.coordenadas_gpslat ? parseFloat(puesto.coordenadas_gpslat) : null,
                        lng: puesto.coordenadas_gpslng ? parseFloat(puesto.coordenadas_gpslng) : null
                    }
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

