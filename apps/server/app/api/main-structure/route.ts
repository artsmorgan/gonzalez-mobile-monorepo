import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../utils/verifyToken";
import { toZonedTime } from "date-fns-tz";
import { prisma } from "../../../utils/prismaClient";

export async function GET(req: NextRequest) {
    try {
        const { valid, expired, payload, message } = verifyAccessToken(req);
        if (!valid) {
            return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });
        }

        const main = await prisma.e_estructura_empresa.findMany({ where: { deleted: null } });

        // Nota: este endpoint se usa como "cache" offline en mobile. Evitamos tipado rígido aquí
        // porque se le agregan propiedades nuevas con el tiempo (ej: vehículos corporativos).
        const structure: any[] = [];

        for (const empresa of main) {
            const empresa_data = { id: empresa.id, nombre: `${empresa.codigo} - ${empresa.nombre}`, clientes: [] };
            const clientes = await prisma.e_estructura_cliente.findMany({
                where: {
                    empresa_id: empresa.id,
                    deleted: null,
                    OR: [{ fecha_inactivacion: null }, { fecha_inactivacion: { gte: toZonedTime(new Date(), "America/Costa_Rica") } }],
                },
            });
            for (const cliente of clientes) {
                const cliente_data = { id: cliente.id, nombre: cliente.nombre, division: [] };
                const divisions = await prisma.n_division.findMany();
                for (const division of divisions) {
                    const division_data = { id: division.id, nombre: division.nombre, contratos: [] };
                    const contratos = await prisma.e_estructura_contrato.findMany({
                        where: {
                            cliente_id: cliente.id,
                            division_id: division.id,
                            deleted: null,
                            OR: [
                                { fecha_inactivacion: null },
                                { fecha_inactivacion: { gte: toZonedTime(new Date(), "America/Costa_Rica") } },
                            ],
                        },
                    });
                    for (const contrato of contratos) {
                        const contrato_data = { id: contrato.id, nombre: contrato.nombre, sucursales: [] };
                        const sucursales = await prisma.e_estructura_sucursal.findMany({
                            where: {
                                contrato_id: contrato.id,
                                deleted: null,
                                OR: [
                                    { fecha_inactivacion: null },
                                    { fecha_inactivacion: { gte: toZonedTime(new Date(), "America/Costa_Rica") } },
                                ],
                            },
                        });
                        for (const sucursal of sucursales) {
                            const sucursal_data = {
                                id: sucursal.id,
                                nombre: `${sucursal.nro_sucursal} - ${sucursal.nombre}`,
                                // Nuevo: vehículos corporativos + usos + bitácora vinculada (si existe)
                                vehiculos_corporativos: [] as any[],
                                puestos: [] as any[],
                            };

                            // Vehículos corporativos de la sucursal, con usos
                            const vehiculos = await prisma.c_vehiculos_corporativos.findMany({
                                where: { sucursal_id: sucursal.id },
                                include: { c_usos_vehiculos_corporativos: true, c_mantenimiento_vehiculos_corporativos: true },
                            });

                            // Adjuntamos el registro de bitácora a cada uso (si `bitacora_id` viene seteado)
                            const bitacoraIds = Array.from(
                                new Set(
                                    vehiculos
                                        .flatMap((v) => v.c_usos_vehiculos_corporativos.map((u) => u.bitacora_id))
                                        .filter((id): id is number => typeof id === "number" && Number.isFinite(id))
                                )
                            );
                            const bitacoras = bitacoraIds.length
                                ? await prisma.c_bitacora_vehiculo_detenido.findMany({ where: { id: { in: bitacoraIds } } })
                                : [];
                            const bitacoraById = new Map(bitacoras.map((b) => [b.id, b]));

                            sucursal_data.vehiculos_corporativos = vehiculos.map((v) => ({
                                ...v,
                                usos: v.c_usos_vehiculos_corporativos.map((u) => ({
                                    ...u,
                                    bitacora: u.bitacora_id ? bitacoraById.get(u.bitacora_id) ?? null : null,
                                })),
                            }));

                            const puestos = await prisma.e_estructura_puesto.findMany({
                                where: {
                                    sucursal_id: sucursal.id,
                                    deleted: null,
                                    OR: [
                                        { fecha_inactivacion: null },
                                        { fecha_inactivacion: { gte: toZonedTime(new Date(), "America/Costa_Rica") } },
                                    ],
                                },
                            });

                            for (const puesto of puestos) {
                                const puesto_data = { id: puesto.id, nombre: `${puesto.codigo} - ${puesto.nombre}`, plazas: [], articulos: [] };

                                let articulos_return: { id: number, nombre: string, cantidad: number }[] = [];

                                if (puesto.comboArticulosCP_id) {
                                    const combo_articulo_cp = await prisma.e_estructura_combo_articulo_cp.findUnique({ where: { id: puesto.comboArticulosCP_id } });
                                    if (combo_articulo_cp) {
                                        const articulos_combo_articulo_cp = await prisma.e_estructura_articulo_corpo_puesto_plan.findMany({ where: { combo_id: combo_articulo_cp.id } });
                                        for (const articulo of articulos_combo_articulo_cp) {
                                            let art_bd = null;
                                            if (articulo.articuloCP_id) {
                                                art_bd = await prisma.n_articulo_corpo_puesto.findUnique({ where: { id: articulo.articuloCP_id } });
                                            }
                                            articulos_return.push({
                                                id: articulo.id,
                                                nombre: art_bd ? art_bd.nombre : "Desconocido",
                                                cantidad: articulo.cantidad,
                                            });
                                        }
                                    }
                                }

                                const articulos_puesto_plan = await prisma.e_estructura_articulo_corpo_puesto_plan.findMany({ where: { puesto_id: puesto.id, id: { notIn: articulos_return.map(articulo => articulo.id) } } });
                                for (const articulo of articulos_puesto_plan) {
                                    let art_bd = null;
                                    if (articulo.articuloCP_id) {
                                        art_bd = await prisma.n_articulo_corpo_puesto.findUnique({ where: { id: articulo.articuloCP_id } });
                                    }
                                    articulos_return.push({
                                        id: articulo.id,
                                        nombre: art_bd ? art_bd.nombre : "Desconocido",
                                        cantidad: articulo.cantidad,
                                    });
                                }

                                puesto_data.articulos = articulos_return as never[];

                                const plazas = await prisma.e_estructura_plazas.findMany({
                                    where: {
                                        puesto_id: puesto.id,
                                        deleted: null,
                                        OR: [
                                            { fecha_inactivacion: null },
                                            { fecha_inactivacion: { gte: toZonedTime(new Date(), "America/Costa_Rica") } },
                                        ],
                                    },
                                });
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