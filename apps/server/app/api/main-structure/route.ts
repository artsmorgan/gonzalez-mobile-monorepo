import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../utils/verifyToken";
import { toZonedTime } from "date-fns-tz";
import { prisma } from "../../../utils/prismaClient";

type TipoMantenimientoArticuloDTO = { id: number; nombre: string };

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

                                let articulos_return: any[] = [];

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
                                                tipo: "Plan",
                                                marca: "",
                                                serie: "",
                                                cantidad: articulo.cantidad,
                                                articulo_nomenclador_id: articulo.articuloCP_id ?? null,
                                                tipos_mantenimiento: [],
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
                                        tipo: "Plan",
                                        marca: "",
                                        serie: "",
                                        cantidad: articulo.cantidad,
                                        articulo_nomenclador_id: articulo.articuloCP_id ?? null,
                                        tipos_mantenimiento: [],
                                    });
                                }

                                const articulos_puesto_entrega = await prisma.e_estructura_articulo_corpo_puesto_entrega.findMany({ where: { puesto_id: puesto.id } });
                                for (const articulo of articulos_puesto_entrega) {
                                    let art_bd = null;
                                    if (articulo.nomencladorArticuloCP_id) {
                                        art_bd = await prisma.n_articulo_corpo_puesto.findUnique({ where: { id: articulo.nomencladorArticuloCP_id } });
                                    }
                                    articulos_return.push({
                                        id: articulo.id,
                                        nombre: art_bd ? art_bd.nombre : `Artículo inidentificable`,
                                        tipo: "Asignado",
                                        marca: articulo.marca,
                                        serie: articulo.serie,
                                        cantidad: 1,
                                        articulo_nomenclador_id: articulo.nomencladorArticuloCP_id ?? null,
                                        tipos_mantenimiento: [],
                                    });
                                }

                                // Adjuntar tipos de mantenimiento por artículo nomenclador (n_tipo_mantenimiento_articulo)
                                const articuloNomencladorIds = Array.from(
                                    new Set(
                                        articulos_return
                                            .map((a) => a.articulo_nomenclador_id)
                                            .filter((id): id is number => typeof id === "number" && Number.isFinite(id))
                                    )
                                );
                                if (articuloNomencladorIds.length > 0) {
                                    const tiposRows = await prisma.n_tipo_mantenimiento_articulo.findMany({
                                        where: { articulo_id: { in: articuloNomencladorIds } },
                                        select: { id: true, articulo_id: true, nombre: true },
                                        orderBy: { id: "asc" },
                                    });
                                    const tiposByArticuloId = new Map<number, TipoMantenimientoArticuloDTO[]>();
                                    for (const t of tiposRows) {
                                        const list = tiposByArticuloId.get(t.articulo_id) ?? [];
                                        list.push({ id: t.id, nombre: t.nombre });
                                        tiposByArticuloId.set(t.articulo_id, list);
                                    }
                                    articulos_return = articulos_return.map((a) => ({
                                        ...a,
                                        tipos_mantenimiento: a.articulo_nomenclador_id
                                            ? (tiposByArticuloId.get(a.articulo_nomenclador_id) ?? [])
                                            : [],
                                    }));
                                }

                                // Adjuntar último mantenimiento a cada artículo del puesto
                                const planIds = articulos_return.filter((a) => a.tipo === "Plan").map((a) => a.id);
                                const asignadoIds = articulos_return.filter((a) => a.tipo === "Asignado").map((a) => a.id);

                                if (planIds.length > 0 || asignadoIds.length > 0) {
                                    const or: any[] = [];
                                    if (planIds.length) or.push({ articulo_plan_id: { in: planIds } });
                                    if (asignadoIds.length) or.push({ articulo_asignado_id: { in: asignadoIds } });

                                    const mantenimientos = await prisma.c_articulo_mantenimiento.findMany({
                                        where: { OR: or },
                                        orderBy: { id: "desc" },
                                        include: {
                                            c_archivos_adjuntos_articulo_mantenimiento: {
                                                select: {
                                                    id: true,
                                                    name: true,
                                                    original_name: true,
                                                    type: true,
                                                    extension: true,
                                                },
                                            },
                                        },
                                    });

                                    const latestByPlanId = new Map<number, any>();
                                    const latestByAsignadoId = new Map<number, any>();
                                    const mantenimientosByPlanId = new Map<number, any[]>();
                                    const mantenimientosByAsignadoId = new Map<number, any[]>();
                                    for (const m of mantenimientos) {
                                        if (m.articulo_plan_id && !latestByPlanId.has(m.articulo_plan_id)) latestByPlanId.set(m.articulo_plan_id, m);
                                        if (m.articulo_asignado_id && !latestByAsignadoId.has(m.articulo_asignado_id)) latestByAsignadoId.set(m.articulo_asignado_id, m);
                                        if (m.articulo_plan_id) {
                                            const list = mantenimientosByPlanId.get(m.articulo_plan_id) ?? [];
                                            if (list.length < 8) {
                                                list.push(m);
                                                mantenimientosByPlanId.set(m.articulo_plan_id, list);
                                            }
                                        }
                                        if (m.articulo_asignado_id) {
                                            const list = mantenimientosByAsignadoId.get(m.articulo_asignado_id) ?? [];
                                            if (list.length < 8) {
                                                list.push(m);
                                                mantenimientosByAsignadoId.set(m.articulo_asignado_id, list);
                                            }
                                        }
                                    }

                                    // Adjuntar movimientos a cada artículo del puesto
                                    const movimientos = await prisma.c_movimientos_articulo_mantenimiento.findMany({
                                        where: { OR: or },
                                        orderBy: { id: "desc" },
                                        select: {
                                            id: true,
                                            articulo_plan_id: true,
                                            articulo_asignado_id: true,
                                            nombre_persona_recibe: true,
                                            nombre_persona_entrega: true,
                                            departamento: true,
                                            telefono: true,
                                            entrega: true,
                                            recibe: true,
                                            fecha: true,
                                            hora: true,
                                            firma_entrega: true,
                                            firma_recibe: true,
                                            firma_responsable: true,
                                        },
                                    });

                                    const movsByPlanId = new Map<number, any[]>();
                                    const movsByAsignadoId = new Map<number, any[]>();
                                    for (const mov of movimientos) {
                                        if (mov.articulo_plan_id) {
                                            const list = movsByPlanId.get(mov.articulo_plan_id) ?? [];
                                            list.push(mov);
                                            movsByPlanId.set(mov.articulo_plan_id, list);
                                        }
                                        if (mov.articulo_asignado_id) {
                                            const list = movsByAsignadoId.get(mov.articulo_asignado_id) ?? [];
                                            list.push(mov);
                                            movsByAsignadoId.set(mov.articulo_asignado_id, list);
                                        }
                                    }

                                    articulos_return = (articulos_return as any[]).map((a) => ({
                                        ...a,
                                        key: `${a.tipo === "Plan" ? "plan" : "asignado"}-${a.id}`,
                                        source: a.tipo === "Plan" ? "plan" : "asignado",
                                        estructura_id: a.id,
                                        articulo_nombre: a.nombre,
                                        cantidad_plan: a.tipo === "Plan" ? a.cantidad : null,
                                        marca:
                                            a.tipo === "Plan"
                                                ? (latestByPlanId.get(a.id)?.marca ?? a.marca ?? null)
                                                : (a.marca ?? null),
                                        serie:
                                            a.tipo === "Plan"
                                                ? (latestByPlanId.get(a.id)?.serie_placa ?? a.serie ?? null)
                                                : (a.serie ?? null),
                                        mantenimientos:
                                            a.tipo === "Plan"
                                                ? (mantenimientosByPlanId.get(a.id) ?? [])
                                                : a.tipo === "Asignado"
                                                    ? (mantenimientosByAsignadoId.get(a.id) ?? [])
                                                    : [],
                                        ultimo_mantenimiento:
                                            a.tipo === "Plan"
                                                ? latestByPlanId.get(a.id) ?? null
                                                : a.tipo === "Asignado"
                                                    ? latestByAsignadoId.get(a.id) ?? null
                                                    : null,
                                        ultimo_registro_mantenimiento:
                                            a.tipo === "Plan"
                                                ? latestByPlanId.get(a.id) ?? null
                                                : a.tipo === "Asignado"
                                                    ? latestByAsignadoId.get(a.id) ?? null
                                                    : null,
                                        movimientos:
                                            a.tipo === "Plan"
                                                ? movsByPlanId.get(a.id) ?? []
                                                : a.tipo === "Asignado"
                                                    ? movsByAsignadoId.get(a.id) ?? []
                                                    : [],
                                    }));
                                } else {
                                    articulos_return = (articulos_return as any[]).map((a) => ({
                                        ...a,
                                        key: `${a.tipo === "Plan" ? "plan" : "asignado"}-${a.id}`,
                                        source: a.tipo === "Plan" ? "plan" : "asignado",
                                        estructura_id: a.id,
                                        articulo_nombre: a.nombre,
                                        cantidad_plan: a.tipo === "Plan" ? a.cantidad : null,
                                        mantenimientos: [],
                                        ultimo_mantenimiento: null,
                                        ultimo_registro_mantenimiento: null,
                                        movimientos: [],
                                    }));
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