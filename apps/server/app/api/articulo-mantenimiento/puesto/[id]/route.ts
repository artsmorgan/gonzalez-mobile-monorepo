/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";

type TipoMantenimientoArticuloDTO = { id: number; nombre: string };

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { valid, expired, message } = await verifyAccessTokenByApi(req);
        if (!valid) {
            return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });
        }

        const resolvedParams = await context.params;
        const puestoId = parseInt(resolvedParams.id);
        if (!Number.isFinite(puestoId)) {
            return NextResponse.json({ status: false, message: "Puesto inválido / no especificado" }, { status: 200 });
        }

        // Obtener artículos del puesto replicando la lógica usada por mantenimiento-equipo/main-structure:
        // - Incluir comboArticulosCP (si existe)
        // - Incluir plan directo del puesto evitando duplicados
        // - Incluir asignados (entrega) del puesto
        const puesto = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "e_estructura_puesto", operation: "findUnique", where: { id: puestoId } }
        });
        if (!puesto) return NextResponse.json({ status: true, data: [] }, { status: 200 });

        const planRows: any[] = [];

        // 1) Artículos del combo del puesto (si existe)
        if ((puesto as any).comboArticulosCP_id) {
            const combo = await callDynamicPrisma({
                req,
                data: { action: "GET", table: "e_estructura_combo_articulo_cp", operation: "findUnique", where: { id: (puesto as any).comboArticulosCP_id } }
            });
            if (combo) {
                const comboPlan = await callDynamicPrisma({
                    req,
                    data: {
                        action: "GET",
                        table: "e_estructura_articulo_corpo_puesto_plan",
                        operation: "findMany",
                        where: { combo_id: combo.id },
                        include: { n_articulo_corpo_puesto: { select: { id: true, nombre: true } } },
                        orderBy: { id: "asc" }
                    }
                });
                planRows.push(...comboPlan);
            }
        }

        // 2) Plan directo del puesto (evitar duplicados por id)
        const directPlan = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "e_estructura_articulo_corpo_puesto_plan",
                operation: "findMany",
                where: { OR: [{ puesto_id: puestoId }, { corpo_id: puesto.corpo_id }],
                    id: { notIn: planRows.map((p: any) => p.id) }
                },
                include: { n_articulo_corpo_puesto: { select: { id: true, nombre: true } } },
                orderBy: { id: "asc" }
            }
        });
        planRows.push(...directPlan);

        // 3) Asignados del puesto (entrega)
        const asignadosRows = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "e_estructura_articulo_corpo_puesto_entrega",
                operation: "findMany",
                where: { OR: [{ puesto_id: puestoId }, { corpo_id: puesto.corpo_id }] },
                include: { n_articulo_corpo_puesto: { select: { id: true, nombre: true } } },
                orderBy: { id: "asc" }
            }
        });

        // Cargar tipos de mantenimiento por nomenclador (en bulk)
        const articuloIds = Array.from(
            new Set(
                [...planRows.map((p: any) => p.articuloCP_id), ...asignadosRows.map((a: any) => a.nomencladorArticuloCP_id)]
                    .filter((id): id is number => typeof id === "number" && Number.isFinite(id))
            )
        );

        const tiposRows = articuloIds.length
            ? await callDynamicPrisma({
                req,
                data: {
                    action: "GET",
                    table: "n_tipo_mantenimiento_articulo",
                    operation: "findMany",
                    where: { articulo_id: { in: articuloIds } },
                    select: { id: true, articulo_id: true, nombre: true },
                    orderBy: { id: "asc" }
                }
            })
            : [];
        const tiposByArticuloId = new Map<number, TipoMantenimientoArticuloDTO[]>();
        for (const t of tiposRows) {
            const list = tiposByArticuloId.get(t.articulo_id) ?? [];
            list.push({ id: t.id, nombre: t.nombre });
            tiposByArticuloId.set(t.articulo_id, list);
        }

        // Mantenimientos (últimos 8) + movimientos por artículo
        const planItems = await Promise.all(
            planRows.map(async (p) => {
                const articuloNomencladorId = p.articuloCP_id ?? null;
                const articuloNombre = p.n_articulo_corpo_puesto?.nombre ?? "Desconocido";

                const mantenimientos = await callDynamicPrisma({
                    req,
                    data: {
                        action: "GET",
                        table: "c_articulo_mantenimiento",
                        operation: "findMany",
                        where: { articulo_plan_id: p.id },
                        include: {
                            c_archivos_adjuntos_articulo_mantenimiento: {
                                select: { id: true, name: true, original_name: true, type: true, extension: true },
                            },
                        },
                        orderBy: { id: "desc" },
                        take: 8
                    }
                });

                const movimientos = await callDynamicPrisma({
                    req,
                    data: {
                        action: "GET",
                        table: "c_movimientos_articulo_mantenimiento",
                        operation: "findMany",
                        where: { articulo_plan_id: p.id },
                        orderBy: { id: "desc" }
                    }
                });

                const ultimo = mantenimientos[0] ?? null;
                return {
                    key: `plan-${p.id}`,
                    source: "plan" as const,
                    estructura_id: p.id,
                    puesto_id: p.puesto_id ?? null,
                    articulo_nomenclador_id: articuloNomencladorId,
                    articulo_nombre: articuloNombre,
                    tipo: "Plan de puesto",
                    // e_estructura_articulo_corpo_puesto_plan no tiene marca/serie. Se exponen desde el último mantenimiento si existe.
                    marca: ultimo?.marca ?? null,
                    modelo: ultimo?.modelo ?? null,
                    serie: ultimo?.serie_placa ?? null,
                    cantidad_plan: p.cantidad ?? null,
                    tipos_mantenimiento: articuloNomencladorId ? tiposByArticuloId.get(articuloNomencladorId) ?? [] : [],
                    mantenimientos,
                    movimientos,
                    // Igual que dynamic-prisma/main-structure: estos campos apuntan al registro más reciente completo
                    ultimo_mantenimiento: ultimo ?? null,
                    ultimo_registro_mantenimiento: ultimo ?? null,
                };
            })
        );

        const asignadoItems = await Promise.all(
            asignadosRows.map(async (a: any) => {
                const articuloNomencladorId = a.nomencladorArticuloCP_id ?? null;
                const articuloNombre = a.n_articulo_corpo_puesto?.nombre ?? "Desconocido";

                const mantenimientos = await callDynamicPrisma({
                    req,
                    data: {
                        action: "GET",
                        table: "c_articulo_mantenimiento",
                        operation: "findMany",
                        where: { articulo_asignado_id: a.id },
                        include: {
                            c_archivos_adjuntos_articulo_mantenimiento: {
                                select: { id: true, name: true, original_name: true, type: true, extension: true },
                            },
                        },
                        orderBy: { id: "desc" },
                        take: 8
                    }
                });

                const movimientos = await callDynamicPrisma({
                    req,
                    data: {
                        action: "GET",
                        table: "c_movimientos_articulo_mantenimiento",
                        operation: "findMany",
                        where: { articulo_asignado_id: a.id },
                        orderBy: { id: "desc" }
                    }
                });

                const ultimo = mantenimientos[0] ?? null;
                return {
                    key: `asignado-${a.id}`,
                    source: "asignado" as const,
                    estructura_id: a.id,
                    puesto_id: a.puesto_id ?? null,
                    articulo_nomenclador_id: articuloNomencladorId,
                    articulo_nombre: articuloNombre,
                    tipo: "Asignado al puesto",
                    // Mantener la misma lógica que main-structure: para asignados se toman de la tabla base
                    // (marca/serie/modelo provienen de `e_estructura_articulo_corpo_puesto_entrega`).
                    marca: a.marca ?? null,
                    modelo: a.modelo ?? null,
                    serie: a.serie ?? null,
                    cantidad_plan: null,
                    tipos_mantenimiento: articuloNomencladorId ? tiposByArticuloId.get(articuloNomencladorId) ?? [] : [],
                    mantenimientos,
                    movimientos,
                    // Igual que dynamic-prisma/main-structure: estos campos apuntan al registro más reciente completo
                    ultimo_mantenimiento: ultimo ?? null,
                    ultimo_registro_mantenimiento: ultimo ?? null,
                };
            })
        );

        const baseUrl = req.nextUrl.origin;
        const mapFilesWithUrl = (mantenimientos: any[], base: string) =>
            (mantenimientos || []).map((m: any) => ({
                ...m,
                c_archivos_adjuntos_articulo_mantenimiento: (m.c_archivos_adjuntos_articulo_mantenimiento || []).map((f: any) => {
                    const endpoint = f.type === "image" ? "get-image" : f.type === "audio" ? "get-audio" : f.type === "video" ? "get-video" : "get-file";
                    return { ...f, url: base ? `${base}/api/articulo-mantenimiento/${m.id}/${endpoint}/${encodeURIComponent(f.name)}` : "" };
                }),
            }));
        const allItems = [...planItems, ...asignadoItems].map((item) => ({
            ...item,
            mantenimientos: mapFilesWithUrl(item.mantenimientos || [], baseUrl),
        }));
        return NextResponse.json({ status: true, data: allItems }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error("Error in GET /api/articulo-mantenimiento/puesto/[id]:", errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}


