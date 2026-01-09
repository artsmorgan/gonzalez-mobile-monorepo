import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../utils/verifyToken";
import { toZonedTime } from "date-fns-tz";
import { prisma } from "../../../utils/prismaClient";

export async function GET(req: NextRequest) {
    try {
        /*
        const { valid, payload, message } = verifyAccessToken(req);
        if (!valid) {
            return NextResponse.json({ status: false, message: message }, { status: 401 });
        }
        */

        const main = await prisma.e_estructura_empresa.findMany({where: {deleted: null}});

        const structure: { id: number, nombre: string, clientes: { id: number, nombre: string, division: { id: number, nombre: string, contratos: { id: number, nombre: string, sucursales: { id: number, nombre: string, puestos: { id: number, nombre: string, plazas: { id: number, nombre: string }[] }[] }[] }[] }[] }[] }[] = [];

        for (const empresa of main) {
            const empresa_data = { id: empresa.id, nombre: `${empresa.codigo} - ${empresa.nombre}`, clientes: [] };
            const clientes = await prisma.e_estructura_cliente.findMany({where: {empresa_id: empresa.id, deleted: null, OR: [{fecha_inactivacion: null}, {fecha_inactivacion: {gte: toZonedTime(new Date(), "America/Costa_Rica")}}]}});
            for (const cliente of clientes) {
                const cliente_data = { id: cliente.id, nombre: cliente.nombre, division: [] };
                const divisions = await prisma.n_division.findMany();
                for (const division of divisions) {
                    const division_data = { id: division.id, nombre: division.nombre, contratos: [] };
                    const contratos = await prisma.e_estructura_contrato.findMany({where: {cliente_id: cliente.id, division_id: division.id, deleted: null, OR: [{fecha_inactivacion: null}, {fecha_inactivacion: {gte: toZonedTime(new Date(), "America/Costa_Rica")}}]}});
                    for (const contrato of contratos) {
                        const contrato_data = { id: contrato.id, nombre: contrato.nombre, sucursales: [] };
                        const sucursales = await prisma.e_estructura_sucursal.findMany({where: {contrato_id: contrato.id, deleted: null, OR: [{fecha_inactivacion: null}, {fecha_inactivacion: {gte: toZonedTime(new Date(), "America/Costa_Rica")}}]}});
                        for (const sucursal of sucursales) {
                            const sucursal_data = { id: sucursal.id, nombre: `${sucursal.nro_sucursal} - ${sucursal.nombre}`, puestos: [] };
                            const puestos = await prisma.e_estructura_puesto.findMany({where: {sucursal_id: sucursal.id, deleted: null, OR: [{fecha_inactivacion: null}, {fecha_inactivacion: {gte: toZonedTime(new Date(), "America/Costa_Rica")}}]}});
                            for (const puesto of puestos) {
                                const puesto_data = { id: puesto.id, nombre: `${puesto.codigo} - ${puesto.nombre}`, plazas: [] };
                                const plazas = await prisma.e_estructura_plazas.findMany({where: {puesto_id: puesto.id, deleted: null, OR: [{fecha_inactivacion: null}, {fecha_inactivacion: {gte: toZonedTime(new Date(), "America/Costa_Rica")}}]}});
                                for (const plaza of plazas) {
                                    const plaza_data = { id: plaza.id, nombre: `${plaza.codigo_plaza} - ${plaza.nombre}` };
                                    puesto_data.plazas.push(plaza_data as never);
                                }
                                sucursal_data.puestos.push(puesto_data as never);
                            }
                            contrato_data.sucursales.push(sucursal_data as never);
                        }
                        division_data.contratos.push(contrato_data as never);
                    }
                    cliente_data.division.push(division_data as never);
                }
                empresa_data.clientes.push(cliente_data as never);
            }
            structure.push(empresa_data as never);
        }
        return NextResponse.json({ status: true, structure: structure }, { status: 200 });
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}