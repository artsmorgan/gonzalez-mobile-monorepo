import { NextRequest, NextResponse } from "next/server";
import { toZonedTime } from "date-fns-tz";
import fs from "fs/promises";
import path from "path";
import { prisma } from "../../../../utils/prismaClient";
import { verifyAccessToken } from "../../../../utils/verifyToken";
import { verifyTokenFromBody } from "../../../../utils/verifyTokenFromBody";
import { mergeMainStructureFragments } from "./mergeMainStructureFragments";

type TipoMantenimientoArticuloDTO = { id: number; nombre: string };

/** Alineado con GET /api/llaves para cache offline en sucursal. */
function mapMovimientoLlaveForStructure(m: any) {
    return {
        id: m.id,
        llave_id: m.llave_id,
        nombre_persona_recibe: m.nombre_persona_recibe,
        nombre_persona_entrega: m.nombre_persona_entrega,
        departamento: m.departamento,
        telefono: m.telefono,
        entrega: m.entrega,
        recibe: m.recibe,
        fecha: m.fecha,
        hora: m.hora,
        firma_entrega: m.firma_entrega,
        firma_recibe: m.firma_recibe,
        firma_responsable: m.firma_responsable,
    };
}

/** Alineado con GET /api/llaveros para cache offline en sucursal. */
function mapMovimientoLlaveroForStructure(m: any) {
    return {
        id: m.id,
        llavero_id: m.llavero_id,
        nombre_persona_recibe: m.nombre_persona_recibe,
        nombre_persona_entrega: m.nombre_persona_entrega,
        departamento: m.departamento,
        telefono: m.telefono,
        fecha: m.fecha,
        hora: m.hora,
        firma_entrega: m.firma_entrega,
        firma_recibe: m.firma_recibe,
        firma_responsable: m.firma_responsable,
    };
}

function mapLlaveForStructure(row: any) {
    return {
        id: row.id,
        cliente_id: row.cliente_id,
        corpo_id: row.corpo_id,
        sucursal_id: row.corpo_id,
        puesto_id: row.puesto_id,
        empresa_id: row.empresa_id,
        division_id: row.division_id,
        contrato_id: row.contrato_id,
        isActive: row.isActive !== false,
        numero_llave: row.numero_llave,
        lugar_abre: row.lugar_abre,
        cantidad_copias: row.cantidad_copias,
        observaciones: row.observaciones,
        firma_responsable: row.firma_responsable,
        created_by: row.created_by,
        created_at: row.created_at,
        movimientos: (row.e_movimiento_llave ?? []).map(mapMovimientoLlaveForStructure),
    };
}

/** Datos de vehículo para anidar en bitácora (sin usos ni mantenimientos). */
function mapVehiculoCorporativoSummaryForBitacora(v: any) {
    if (!v) return null;
    return {
        id: v.id,
        empresa_id: v.empresa_id,
        cliente_id: v.cliente_id,
        division_id: v.division_id,
        contrato_id: v.contrato_id,
        sucursal_id: v.sucursal_id,
        puesto_id: v.puesto_id,
        placa: v.placa,
        tipo: v.tipo,
        tipo_autoria: v.tipo_autoria,
        estado: v.estado,
        kilometraje: v.kilometraje,
        prox_cambio_aceite: v.prox_cambio_aceite,
        modelo: v.modelo,
        anno: v.anno,
        marca: v.marca,
        descripcion: v.descripcion,
        titulo_propiedad: v.titulo_propiedad,
        rtv: v.rtv,
        marchamo: v.marchamo,
        firma_responsable: v.firma_responsable,
        created_by: v.created_by,
        created_at: v.created_at,
    };
}

function mapLlaveroForStructure(row: any) {
    const llavesEn = row.e_llave_en_llavero ?? [];
    return {
        id: row.id,
        cliente_id: row.cliente_id,
        corpo_id: row.corpo_id,
        sucursal_id: row.corpo_id,
        puesto_id: row.puesto_id,
        empresa_id: row.empresa_id,
        division_id: row.division_id,
        contrato_id: row.contrato_id,
        isActive: row.isActive !== false,
        nombre_llavero: row.nombre_llavero,
        numero_llavero: row.numero_llavero,
        observaciones: row.observaciones,
        firma_responsable: row.firma_responsable,
        created_by: row.created_by,
        created_at: row.created_at,
        movimientos: (row.e_movimiento_llavero ?? []).map(mapMovimientoLlaveroForStructure),
        llaves: llavesEn.map((l: any) => ({
            id: l.id,
            llave_id: l.llave_id,
            llavero_id: l.llavero_id,
        })),
    };
}

type MainStructurePayload = {
    token?: string;
    mobileAccessToken?: string;
    shouldVerifyAccessToken?: boolean;
};

function pushFragment(fragments: Record<string, any>, key: string, item: any) {
    if (!fragments[key]) fragments[key] = [];
    (fragments[key] as any[]).push(item);
}

function groupByNumberKey<T>(items: T[], keyFn: (item: T) => number | null | undefined): Map<number, T[]> {
    const map = new Map<number, T[]>();
    for (const item of items) {
        const raw = keyFn(item);
        if (raw == null || !Number.isFinite(Number(raw))) continue;
        const key = Number(raw);
        const list = map.get(key) ?? [];
        list.push(item);
        map.set(key, list);
    }
    return map;
}

function activeStructureWhere(nowCostaRica: Date) {
    return {
        deleted: null as null,
        OR: [{ fecha_inactivacion: null }, { fecha_inactivacion: { gte: nowCostaRica } }],
    };
}

/** Filas del mismo puesto o del mismo corpo (sucursal) que el contexto actual. */
function belongsToPuestoOrCorpo(
    row: { puesto_id?: number | null; corpo_id?: number | null },
    puestoId: number,
    sucursalId: number,
): boolean {
    return row.puesto_id === puestoId || row.corpo_id === sucursalId;
}

/** Prefiere coincidencia a nivel puesto; si no hay, usa la del corpo. */
function preferPuestoMatch<T extends { puesto_id?: number | null }>(candidates: T[], puestoId: number): T | null {
    if (candidates.length === 0) return null;
    return candidates.find((r) => r.puesto_id === puestoId) ?? candidates[0];
}

function findEntregaDatosForPlan(
    articuloCP_id: number | null | undefined,
    puestoId: number,
    sucursalId: number,
    allEntregaRows: any[],
): { marca: string; serie: string; modelo: string } | null {
    if (articuloCP_id == null) return null;
    const candidates = allEntregaRows.filter(
        (e) =>
            e.nomencladorArticuloCP_id === articuloCP_id &&
            belongsToPuestoOrCorpo(e, puestoId, sucursalId),
    );
    const match = preferPuestoMatch(candidates, puestoId);
    if (!match) return null;
    return {
        marca: match.marca ?? "",
        serie: match.serie ?? "",
        modelo: match.modelo ?? "",
    };
}

/** Asignado → plan: articuloCP_id (plan) === nomencladorArticuloCP_id (entrega). */
function findPlanCantidadForAsignado(
    nomencladorArticuloCP_id: number | null | undefined,
    puestoId: number,
    sucursalId: number,
    allPlanRows: any[],
): number | null {
    if (nomencladorArticuloCP_id == null) return null;
    const candidates = allPlanRows.filter(
        (p) =>
            p.articuloCP_id === nomencladorArticuloCP_id &&
            belongsToPuestoOrCorpo(p, puestoId, sucursalId),
    );
    const match = preferPuestoMatch(candidates, puestoId);
    if (!match || match.cantidad == null) return null;
    return match.cantidad;
}

function attachTiposMantenimientoToArticulos(
    articulos_return: any[],
    tiposByArticuloId: Map<number, TipoMantenimientoArticuloDTO[]>,
): any[] {
    return articulos_return.map((a) => ({
        ...a,
        tipos_mantenimiento: a.articulo_nomenclador_id
            ? (tiposByArticuloId.get(a.articulo_nomenclador_id) ?? [])
            : [],
    }));
}

function attachMantenimientosAndMovimientosToArticulos(articulos_return: any[], mantenimientos: any[], movimientos: any[]): any[] {
    const planIds = articulos_return.filter((a) => a.tipo === "Plan").map((a) => a.id);
    const asignadoIds = articulos_return.filter((a) => a.tipo === "Asignado").map((a) => a.id);

    if (planIds.length === 0 && asignadoIds.length === 0) {
        return articulos_return.map((a) => ({
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

    return articulos_return.map((a) => ({
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
        modelo:
            a.tipo === "Plan"
                ? (latestByPlanId.get(a.id)?.modelo ?? a.modelo ?? null)
                : (a.modelo ?? null),
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
}

function buildArticulosBaseForPuesto(
    puesto: { id: number; comboArticulosCP_id: number | null },
    sucursalId: number,
    validComboIds: Set<number>,
    planByComboId: Map<number, any[]>,
    allPlanRows: any[],
    allEntregaRows: any[],
    nomencladorById: Map<number, { id: number; nombre: string }>,
): any[] {
    const articulos_return: any[] = [];

    if (puesto.comboArticulosCP_id && validComboIds.has(puesto.comboArticulosCP_id)) {
        const articulos_combo_articulo_cp = planByComboId.get(puesto.comboArticulosCP_id) ?? [];
        for (const articulo of articulos_combo_articulo_cp) {
            const art_bd = articulo.articuloCP_id ? nomencladorById.get(articulo.articuloCP_id) ?? null : null;
            const entregaMatch = findEntregaDatosForPlan(
                articulo.articuloCP_id,
                puesto.id,
                sucursalId,
                allEntregaRows,
            );
            articulos_return.push({
                id: articulo.id,
                nombre: art_bd ? art_bd.nombre : "Desconocido",
                tipo: "Plan",
                marca: entregaMatch?.marca ?? "",
                serie: entregaMatch?.serie ?? "",
                modelo: entregaMatch?.modelo ?? "",
                cantidad: articulo.cantidad,
                articulo_nomenclador_id: articulo.articuloCP_id ?? null,
                tipos_mantenimiento: [],
            });
        }
    }

    const excludedIds = new Set(articulos_return.map((articulo) => articulo.id));
    const articulos_puesto_plan = allPlanRows.filter(
        (articulo) =>
            !excludedIds.has(articulo.id) &&
            (articulo.puesto_id === puesto.id || articulo.corpo_id === sucursalId),
    );

    for (const articulo of articulos_puesto_plan) {
        const art_bd = articulo.articuloCP_id ? nomencladorById.get(articulo.articuloCP_id) ?? null : null;
        const entregaMatch = findEntregaDatosForPlan(
            articulo.articuloCP_id,
            puesto.id,
            sucursalId,
            allEntregaRows,
        );
        articulos_return.push({
            id: articulo.id,
            nombre: art_bd ? art_bd.nombre : "Desconocido",
            tipo: "Plan",
            marca: entregaMatch?.marca ?? "",
            serie: entregaMatch?.serie ?? "",
            modelo: entregaMatch?.modelo ?? "",
            cantidad: articulo.cantidad,
            articulo_nomenclador_id: articulo.articuloCP_id ?? null,
            tipos_mantenimiento: [],
        });
    }

    const articulos_puesto_entrega = allEntregaRows.filter(
        (articulo) => articulo.puesto_id === puesto.id || articulo.corpo_id === sucursalId,
    );
    for (const articulo of articulos_puesto_entrega) {
        const art_bd = articulo.nomencladorArticuloCP_id
            ? nomencladorById.get(articulo.nomencladorArticuloCP_id) ?? null
            : null;
        const planCantidad = findPlanCantidadForAsignado(
            articulo.nomencladorArticuloCP_id,
            puesto.id,
            sucursalId,
            allPlanRows,
        );
        articulos_return.push({
            id: articulo.id,
            nombre: art_bd ? art_bd.nombre : `Artículo inidentificable`,
            tipo: "Asignado",
            marca: articulo.marca,
            serie: articulo.serie,
            modelo: articulo.modelo ?? "",
            cantidad: planCantidad ?? 1,
            articulo_nomenclador_id: articulo.nomencladorArticuloCP_id ?? null,
            tipos_mantenimiento: [],
        });
    }

    return articulos_return;
}

export async function POST(req: NextRequest) {
    try {
        // Cadena de 8 números aleatorios
        const randomNumber = Math.random().toString(36).substring(2, 15);
        console.log('Main structure route called', randomNumber);
        const auth = req.headers.get("authorization");

        /*if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
          return new Response("Unauthorized", { status: 401 });
        }*/

        const nowCostaRica = toZonedTime(new Date(), "America/Costa_Rica");
        const activeWhere = activeStructureWhere(nowCostaRica);

        // Escalones jerárquicos: findMany por nivel y lookup en memoria (patrón sendNotificationByRole).
        const main = await prisma.e_estructura_empresa.findMany({ where: { deleted: null } });
        const empresaIds = main.map((e) => e.id);

        const divisionRows = await prisma.n_division.findMany();

        const clienteRows =
            empresaIds.length > 0
                ? await prisma.e_estructura_cliente.findMany({
                      where: { empresa_id: { in: empresaIds }, ...activeWhere },
                  })
                : [];
        const clienteIds = clienteRows.map((c) => c.id);
        const clientesByEmpresaId = groupByNumberKey(clienteRows, (c) => c.empresa_id);

        const contratoRows =
            clienteIds.length > 0
                ? await prisma.e_estructura_contrato.findMany({
                      where: { cliente_id: { in: clienteIds }, ...activeWhere },
                  })
                : [];
        const contratoIds = contratoRows.map((c) => c.id);
        const contratosByClienteDivision = new Map<string, typeof contratoRows>();
        for (const c of contratoRows) {
            if (c.cliente_id == null || c.division_id == null) continue;
            const key = `${c.cliente_id}_${c.division_id}`;
            const list = contratosByClienteDivision.get(key) ?? [];
            list.push(c);
            contratosByClienteDivision.set(key, list);
        }

        const sucursalRows =
            contratoIds.length > 0
                ? await prisma.e_estructura_sucursal.findMany({
                      where: { contrato_id: { in: contratoIds }, ...activeWhere },
                  })
                : [];
        const sucursalIds = sucursalRows.map((s) => s.id);
        const sucursalesByContratoId = groupByNumberKey(sucursalRows, (s) => s.contrato_id);

        const puestoRows =
            sucursalIds.length > 0
                ? await prisma.e_estructura_puesto.findMany({
                      where: { sucursal_id: { in: sucursalIds }, ...activeWhere },
                  })
                : [];
        const puestoIds = puestoRows.map((p) => p.id);
        const puestosBySucursalId = groupByNumberKey(puestoRows, (p) => p.sucursal_id);

        const plazaRows =
            puestoIds.length > 0
                ? await prisma.e_estructura_plazas.findMany({
                      where: { puesto_id: { in: puestoIds }, ...activeWhere },
                  })
                : [];
        const plazaIds = plazaRows.map((pl) => pl.id);
        const plazasByPuestoId = groupByNumberKey(plazaRows, (pl) => pl.puesto_id);

        const [vehiculosRows, bitacorasRows, llavesRows, llaverosRows] =
            sucursalIds.length > 0
                ? await Promise.all([
                      prisma.c_vehiculos_corporativos.findMany({
                          where: { sucursal_id: { in: sucursalIds }, isActive: true },
                          include: {
                              c_usos_vehiculos_corporativos: true,
                              c_mantenimiento_vehiculos_corporativos: true,
                          },
                      }),
                      prisma.c_bitacora_vehiculo_detenido.findMany({
                          where: { sucursal_id: { in: sucursalIds }, isActive: true },
                          orderBy: { id: "desc" },
                      }),
                      prisma.e_llave.findMany({
                          where: { corpo_id: { in: sucursalIds }, isActive: true },
                          include: { e_movimiento_llave: { orderBy: { id: "desc" } } },
                          orderBy: { id: "desc" },
                      }),
                      prisma.e_llavero.findMany({
                          where: { corpo_id: { in: sucursalIds }, isActive: true },
                          include: {
                              e_movimiento_llavero: { orderBy: { id: "desc" } },
                              e_llave_en_llavero: { orderBy: { id: "asc" } },
                          },
                          orderBy: { id: "desc" },
                      }),
                  ])
                : [[], [], [], []];

        const vehiculosBySucursalId = groupByNumberKey(vehiculosRows, (v) => v.sucursal_id);
        const bitacorasBySucursalId = groupByNumberKey(bitacorasRows, (b) => b.sucursal_id);
        const llavesBySucursalId = groupByNumberKey(llavesRows, (l) => l.corpo_id);
        const llaverosBySucursalId = groupByNumberKey(llaverosRows, (l) => l.corpo_id);

        const comboIds = Array.from(
            new Set(
                puestoRows
                    .map((p) => p.comboArticulosCP_id)
                    .filter((id): id is number => id != null && Number.isFinite(id)),
            ),
        );
        const comboRows =
            comboIds.length > 0
                ? await prisma.e_estructura_combo_articulo_cp.findMany({ where: { id: { in: comboIds } } })
                : [];
        const validComboIds = new Set(comboRows.map((c) => c.id));

        const planOrConditions: any[] = [];
        if (puestoIds.length) planOrConditions.push({ puesto_id: { in: puestoIds } });
        if (sucursalIds.length) planOrConditions.push({ corpo_id: { in: sucursalIds } });
        if (comboIds.length) planOrConditions.push({ combo_id: { in: comboIds } });

        const allPlanRows =
            planOrConditions.length > 0
                ? await prisma.e_estructura_articulo_corpo_puesto_plan.findMany({ where: { OR: planOrConditions } })
                : [];

        const entregaOrConditions: any[] = [];
        if (puestoIds.length) entregaOrConditions.push({ puesto_id: { in: puestoIds } });
        if (sucursalIds.length) entregaOrConditions.push({ corpo_id: { in: sucursalIds } });

        const allEntregaRows =
            entregaOrConditions.length > 0
                ? await prisma.e_estructura_articulo_corpo_puesto_entrega.findMany({ where: { OR: entregaOrConditions } })
                : [];

        const planByComboId = groupByNumberKey(
            allPlanRows.filter((a) => a.combo_id != null),
            (a) => a.combo_id,
        );

        const nomencladorIds = Array.from(
            new Set(
                [
                    ...allPlanRows.map((a) => a.articuloCP_id),
                    ...allEntregaRows.map((a) => a.nomencladorArticuloCP_id),
                ].filter((id): id is number => id != null && Number.isFinite(id)),
            ),
        );
        const nomencladorRows =
            nomencladorIds.length > 0
                ? await prisma.n_articulo_corpo_puesto.findMany({ where: { id: { in: nomencladorIds } } })
                : [];
        const nomencladorById = new Map(nomencladorRows.map((n) => [n.id, n]));

        const tiposRows =
            nomencladorIds.length > 0
                ? await prisma.n_tipo_mantenimiento_articulo.findMany({
                      where: { articulo_id: { in: nomencladorIds } },
                      select: { id: true, articulo_id: true, nombre: true },
                      orderBy: { id: "asc" },
                  })
                : [];
        const tiposByArticuloId = new Map<number, TipoMantenimientoArticuloDTO[]>();
        for (const t of tiposRows) {
            const list = tiposByArticuloId.get(t.articulo_id) ?? [];
            list.push({ id: t.id, nombre: t.nombre });
            tiposByArticuloId.set(t.articulo_id, list);
        }

        const allPlanArticuloIds = allPlanRows.map((a) => a.id);
        const allAsignadoIds = allEntregaRows.map((a) => a.id);
        const mantOrConditions: any[] = [];
        if (allPlanArticuloIds.length) mantOrConditions.push({ articulo_plan_id: { in: allPlanArticuloIds } });
        if (allAsignadoIds.length) mantOrConditions.push({ articulo_asignado_id: { in: allAsignadoIds } });

        const [allMantenimientos, allMovimientos] =
            mantOrConditions.length > 0
                ? await Promise.all([
                      prisma.c_articulo_mantenimiento.findMany({
                          where: { OR: mantOrConditions },
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
                      }),
                      prisma.c_movimientos_articulo_mantenimiento.findMany({
                          where: { OR: mantOrConditions },
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
                      }),
                  ])
                : [[], []];

        const mantenimientosByPlanId = groupByNumberKey(
            allMantenimientos.filter((m) => m.articulo_plan_id != null),
            (m) => m.articulo_plan_id,
        );
        const mantenimientosByAsignadoId = groupByNumberKey(
            allMantenimientos.filter((m) => m.articulo_asignado_id != null),
            (m) => m.articulo_asignado_id,
        );
        const movimientosByPlanId = groupByNumberKey(
            allMovimientos.filter((m) => m.articulo_plan_id != null),
            (m) => m.articulo_plan_id,
        );
        const movimientosByAsignadoId = groupByNumberKey(
            allMovimientos.filter((m) => m.articulo_asignado_id != null),
            (m) => m.articulo_asignado_id,
        );

        const plazaEmpleadoRows =
            plazaIds.length > 0
                ? await prisma.c_empleado_plaza.findMany({
                      where: { plaza_id: { in: plazaIds }, empleado_id: { not: null } },
                      select: { plaza_id: true, empleado_id: true },
                  })
                : [];
        const empleadoIdsByPlazaId = new Map<number, number[]>();
        const allEmpleadoIds = new Set<number>();
        for (const row of plazaEmpleadoRows) {
            if (row.plaza_id == null || row.empleado_id == null) continue;
            const eid = Number(row.empleado_id);
            if (!Number.isFinite(eid)) continue;
            allEmpleadoIds.add(eid);
            const list = empleadoIdsByPlazaId.get(row.plaza_id) ?? [];
            if (!list.includes(eid)) list.push(eid);
            empleadoIdsByPlazaId.set(row.plaza_id, list);
        }

        const empleadoIdsList = Array.from(allEmpleadoIds);
        const empleadoRows =
            empleadoIdsList.length > 0
                ? await prisma.c_empleado.findMany({
                      where: {
                          id: { in: empleadoIdsList },
                          fecha_contratacion: { not: null },
                          OR: [{ estado: null }, { estado: { not: "BA" } }],
                          NOT: [{ cedula: { contains: "@" } }],
                      },
                      select: {
                          id: true,
                          codigo: true,
                          cedula: true,
                          nombre: true,
                          primer_apellido: true,
                          segundo_apellido: true,
                          Email: true,
                          telefono: true,
                          tipoCedula: true,
                          fecha_contratacion: true,
                          estado: true,
                          supervisor_id: true,
                          firma_manual: true,
                      },
                      orderBy: [
                          { nombre: "asc" },
                          { primer_apellido: "asc" },
                          { segundo_apellido: "asc" },
                          { id: "asc" },
                      ],
                  })
                : [];
        const empleadoById = new Map(empleadoRows.map((e) => [e.id, e]));

        // Ensamblar fragments desde variables en memoria (sin consultas por elemento).
        const fragments: Record<string, any> = {};
        fragments.divisiones = divisionRows.map((d) => ({ id: d.id, nombre: d.nombre }));
        fragments.empresas = main.map((e) => ({ id: e.id, nombre: `${e.codigo} - ${e.nombre}` }));

        console.log("Procedemos a recorrer la jerarquía de la estructura");

        for (const empresa of main) {
            const clientes = clientesByEmpresaId.get(empresa.id) ?? [];
            for (const cliente of clientes) {
                pushFragment(fragments, `empresa_${empresa.id}_clientes`, { id: cliente.id, nombre: cliente.nombre });

                for (const division of divisionRows) {
                    const contratos = contratosByClienteDivision.get(`${cliente.id}_${division.id}`) ?? [];
                    for (const contrato of contratos) {
                        pushFragment(fragments, `cliente_${cliente.id}_division_${division.id}_contratos`, {
                            id: contrato.id,
                            nombre: contrato.nombre,
                            nro_contrato: contrato.nro_contrato,
                        });

                        const sucursales = sucursalesByContratoId.get(contrato.id) ?? [];
                        for (const sucursal of sucursales) {
                            pushFragment(fragments, `contrato_${contrato.id}_sucursales`, {
                                id: sucursal.id,
                                nombre: `${sucursal.nro_sucursal} - ${sucursal.nombre}`,
                                nro_sucursal: sucursal.nro_sucursal,
                            });

                            const vehiculos = vehiculosBySucursalId.get(sucursal.id) ?? [];
                            const vehiculoById = new Map<number, any>(vehiculos.map((v: any) => [v.id, v]));

                            fragments[`sucursal_${sucursal.id}_vehiculos_corporativos`] = vehiculos.map((v: any) => ({
                                ...v,
                                usos: v.c_usos_vehiculos_corporativos.map((u: any) => ({ ...u })),
                            }));

                            const bitacorasSucursal = bitacorasBySucursalId.get(sucursal.id) ?? [];
                            fragments[`sucursal_${sucursal.id}_bitacora_vehiculos_detenidos`] = bitacorasSucursal.map(
                                (b: any) => {
                                    const vehRaw = b.vehiculo_id != null ? vehiculoById.get(Number(b.vehiculo_id)) : null;
                                    let uso: any = null;
                                    if (vehRaw && b.uso_id != null) {
                                        uso =
                                            vehRaw.c_usos_vehiculos_corporativos.find(
                                                (u: any) => Number(u.id) === Number(b.uso_id),
                                            ) ?? null;
                                    }
                                    return {
                                        ...b,
                                        vehiculo: mapVehiculoCorporativoSummaryForBitacora(vehRaw),
                                        uso: uso ? { ...uso } : null,
                                    };
                                },
                            );

                            const llavesCorpo = llavesBySucursalId.get(sucursal.id) ?? [];
                            const llaverosCorpo = llaverosBySucursalId.get(sucursal.id) ?? [];
                            fragments[`sucursal_${sucursal.id}_llaves`] = llavesCorpo.map(mapLlaveForStructure);
                            fragments[`sucursal_${sucursal.id}_llaveros`] = llaverosCorpo.map(mapLlaveroForStructure);

                            const puestos = puestosBySucursalId.get(sucursal.id) ?? [];
                            for (const puesto of puestos) {
                                pushFragment(fragments, `sucursal_${sucursal.id}_puestos`, {
                                    id: puesto.id,
                                    nombre: `${puesto.codigo} - ${puesto.nombre}`,
                                    codigo: puesto.codigo,
                                    ubicacion: {
                                        lat: puesto.coordenadas_gpslat ?? null,
                                        lng: puesto.coordenadas_gpslng ?? null,
                                    },
                                });

                                let articulos_return = buildArticulosBaseForPuesto(
                                    puesto,
                                    sucursal.id,
                                    validComboIds,
                                    planByComboId,
                                    allPlanRows,
                                    allEntregaRows,
                                    nomencladorById,
                                );
                                articulos_return = attachTiposMantenimientoToArticulos(articulos_return, tiposByArticuloId);

                                const planIds = articulos_return.filter((a) => a.tipo === "Plan").map((a) => a.id);
                                const asignadoIds = articulos_return.filter((a) => a.tipo === "Asignado").map((a) => a.id);

                                const mantenimientosForPuesto: any[] = [];
                                for (const id of planIds) {
                                    mantenimientosForPuesto.push(...(mantenimientosByPlanId.get(id) ?? []));
                                }
                                for (const id of asignadoIds) {
                                    mantenimientosForPuesto.push(...(mantenimientosByAsignadoId.get(id) ?? []));
                                }
                                mantenimientosForPuesto.sort((a, b) => b.id - a.id);

                                const movimientosForPuesto: any[] = [];
                                for (const id of planIds) {
                                    movimientosForPuesto.push(...(movimientosByPlanId.get(id) ?? []));
                                }
                                for (const id of asignadoIds) {
                                    movimientosForPuesto.push(...(movimientosByAsignadoId.get(id) ?? []));
                                }
                                movimientosForPuesto.sort((a, b) => b.id - a.id);

                                articulos_return = attachMantenimientosAndMovimientosToArticulos(
                                    articulos_return,
                                    mantenimientosForPuesto,
                                    movimientosForPuesto,
                                );
                                fragments[`puesto_${puesto.id}_articulos`] = articulos_return.map((a) => ({ ...a }));

                                const plazas = plazasByPuestoId.get(puesto.id) ?? [];
                                for (const plaza of plazas) {
                                    pushFragment(fragments, `puesto_${puesto.id}_plazas`, {
                                        id: plaza.id,
                                        nombre: `${plaza.codigo_plaza} - ${plaza.nombre}`,
                                        codigo_plaza: plaza.codigo_plaza,
                                    });

                                    const empleadoIds = empleadoIdsByPlazaId.get(plaza.id) ?? [];
                                    const empleados = empleadoIds
                                        .map((eid) => empleadoById.get(eid))
                                        .filter((e): e is NonNullable<typeof e> => e != null)
                                        .sort((a, b) => {
                                            const byNombre = (a.nombre ?? "").localeCompare(b.nombre ?? "");
                                            if (byNombre !== 0) return byNombre;
                                            const byAp1 = (a.primer_apellido ?? "").localeCompare(b.primer_apellido ?? "");
                                            if (byAp1 !== 0) return byAp1;
                                            const byAp2 = (a.segundo_apellido ?? "").localeCompare(b.segundo_apellido ?? "");
                                            if (byAp2 !== 0) return byAp2;
                                            return a.id - b.id;
                                        });
                                    fragments[`plaza_${plaza.id}_empleados`] = empleados;
                                }
                            }
                        }
                    }
                }
            }
        }

        const structure = mergeMainStructureFragments(fragments);

        // Persistimos fragmentos en disco (sin duplicar el árbol completo).
        try {
            const createdAt = toZonedTime(new Date(), "America/Costa_Rica").getTime();
            const outPath = path.resolve(process.cwd(), "main-structure.json");
            const tmpPath = `${outPath}.tmp`;
            await fs.mkdir(path.dirname(outPath), { recursive: true });
            const payload = JSON.stringify({ created_at: createdAt, fragmentsVersion: 2, fragments }, null, 2);

            await fs.writeFile(tmpPath, payload, "utf8");
            try {
                await fs.rename(tmpPath, outPath);
            } catch {
                await fs.unlink(outPath).catch(() => undefined);
                await fs.rename(tmpPath, outPath);
            }
            console.log("Cache escrito en disco (atómico)", randomNumber);
        } catch (e) {
            console.error("[main-structure] No se pudo escribir main-structure.json:", e);
        }

        return NextResponse.json(
            { status: true, fragmentsVersion: 2, fragments, structure },
            { status: 200 }
        );
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}

// Función GET para obtener el archivo
export async function GET(req: NextRequest) {
    try {
        const sp = req.nextUrl.searchParams;

        const expectedMobileToken = process.env.MOBILE_ACCESS_TOKEN?.trim();
        const incomingMobileToken = String(sp.get("mobileAccessToken") || "").trim();
        const token = String(sp.get("token") || "").trim();
        const shouldVerifyAccessToken =
            sp.get("shouldVerifyAccessToken") == null ? true : sp.get("shouldVerifyAccessToken") !== "false";
        const createdAtRequestedRaw = sp.get("created_at");
        const createdAtRequested = createdAtRequestedRaw ? Number(createdAtRequestedRaw) : 0;

        if (!expectedMobileToken) {
            return NextResponse.json(
                { status: false, message: "MOBILE_ACCESS_TOKEN no configurado en el servidor" },
                { status: 500 }
            );
        }
        if (!incomingMobileToken) {
            return NextResponse.json(
                { status: false, message: "mobileAccessToken es obligatorio" },
                { status: 403 }
            );
        }
        if (incomingMobileToken !== expectedMobileToken) {
            return NextResponse.json(
                { status: false, message: "mobileAccessToken inválido" },
                { status: 403 }
            );
        }

        const tokenValidationHeader = verifyAccessToken(req);
        const tokenValidationBody = verifyTokenFromBody(token);
        const tokenValidation = tokenValidationHeader.valid ? tokenValidationHeader : tokenValidationBody;

        if (shouldVerifyAccessToken && !tokenValidation.valid) {
            return NextResponse.json(
                { status: false, expired: tokenValidation.expired, message: tokenValidation.message },
                { status: tokenValidation.expired ? 401 : 403 }
            );
        }

        console.log(7);
        const outPath = path.resolve(process.cwd(), "main-structure.json");

        console.log(8);
        let data: string;
        try {
            data = await fs.readFile(outPath, "utf8");
        } catch {
            // Cache inexistente: devolvemos vacío para que el cliente pueda regenerar.
            return NextResponse.json(
                { status: false, created_at: null, message: "Cache main-structure.json no existe", structure: JSON.stringify([]) },
                { status: 200 }
            );
        }

        console.log(9);
        let parsed: Record<string, unknown>;
        try {
            parsed = JSON.parse(data) as Record<string, unknown>;
        } catch (e) {
            // Cache corrupto/truncado: lo movemos a un backup y devolvemos vacío.
            try {
                const corruptPath = `${outPath}.corrupt.${Date.now()}`;
                await fs.rename(outPath, corruptPath);
            } catch {
                await fs.unlink(outPath).catch(() => undefined);
            }

            return NextResponse.json(
                {
                    status: false,
                    created_at: null,
                    message: "Cache main-structure.json inválida (corrupta/truncada). Se requiere regeneración.",
                    structure: JSON.stringify([]),
                },
                { status: 200 }
            );
        }

        console.log(10);
        const created_at = parsed.created_at;
        const fragments = parsed.fragments as Record<string, any> | undefined;
        const fragmentsVersion = parsed.fragmentsVersion as number | undefined;
        const legacyStructure = parsed.structure;

        if (fragments && typeof fragments === "object") {
            const structure = mergeMainStructureFragments(fragments);
            console.log(11);
            return NextResponse.json(
                {
                    status: true,
                    created_at,
                    fragmentsVersion: fragmentsVersion ?? 2,
                    fragments,
                    structure,
                },
                { status: 200 }
            );
        }

        console.log(11);
        return NextResponse.json(
            {
                status: true,
                created_at,
                fragmentsVersion: 1,
                fragments: null,
                structure: legacyStructure,
            },
            { status: 200 }
        );
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error("[main-structure] Error al leer main-structure.json:", errorMessage);
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}