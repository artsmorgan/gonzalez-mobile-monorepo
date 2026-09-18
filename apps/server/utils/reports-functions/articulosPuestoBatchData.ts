/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ReportDataAccess } from "../reportDynamicPrisma";

export type ArticuloPuestoInput = {
    id: number;
    sucursal_id: number | null;
    comboArticulosCP_id: number | null;
};

export type ArticuloPlanRow = {
    id: number;
    puesto_id: number | null;
    corpo_id: number | null;
    articuloCP_id: number | null;
    combo_id: number | null;
    cantidad: number | null;
};

export type ArticuloEntregaRow = {
    id: number;
    puesto_id: number | null;
    corpo_id: number | null;
    nomencladorArticuloCP_id: number | null;
    marca: string | null;
    modelo: string | null;
    serie: string | null;
    fechaEntrega: Date | string | null;
};

export type ArticuloPuestoBatchSlice = {
    combo: { id: number; nombre: string } | null;
    comboPlans: ArticuloPlanRow[];
    directPlans: ArticuloPlanRow[];
    entregas: ArticuloEntregaRow[];
};

export type ArticuloLink = {
    origen: "Plan" | "Asignado";
    registro_id: number;
    puesto_id: number;
    corpo_id: number | null;
    nomenclador_id: number | null;
};

function uniquePositive(ids: (number | null | undefined)[]): number[] {
    return [...new Set(ids.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0))];
}

function planMatchesScope(
    row: { puesto_id?: number | null; corpo_id?: number | null },
    puestoId: number,
    corpoId: number | null,
): boolean {
    if (Number(row.puesto_id) === puestoId) return true;
    if (corpoId && Number(row.corpo_id) === corpoId) return true;
    return false;
}

/** Una petición findMany por tabla antes de iterar puestos (patrón sendNotification). */
export async function loadArticulosDataByPuesto(
    prisma: ReportDataAccess,
    puestos: ArticuloPuestoInput[],
): Promise<Map<number, ArticuloPuestoBatchSlice>> {
    const result = new Map<number, ArticuloPuestoBatchSlice>();
    if (!puestos.length) return result;

    const puestoIds = uniquePositive(puestos.map((p) => p.id));
    const corpoIds = uniquePositive(puestos.map((p) => p.sucursal_id));
    const comboIds = uniquePositive(puestos.map((p) => p.comboArticulosCP_id));

    const orScope: Array<{ puesto_id?: { in: number[] }; corpo_id?: { in: number[] } }> = [];
    if (puestoIds.length) orScope.push({ puesto_id: { in: puestoIds } });
    if (corpoIds.length) orScope.push({ corpo_id: { in: corpoIds } });

    const [combos, comboPlansAll, directPlansAll, entregasAll] = await Promise.all([
        comboIds.length
            ? prisma.e_estructura_combo_articulo_cp.findMany({
                  where: { id: { in: comboIds } },
                  select: { id: true, nombre: true },
              })
            : Promise.resolve([]),
        comboIds.length
            ? prisma.e_estructura_articulo_corpo_puesto_plan.findMany({
                  where: { combo_id: { in: comboIds } },
                  orderBy: { id: "asc" },
              })
            : Promise.resolve([]),
        orScope.length
            ? prisma.e_estructura_articulo_corpo_puesto_plan.findMany({
                  where: { OR: orScope },
                  orderBy: { id: "asc" },
              })
            : Promise.resolve([]),
        orScope.length
            ? prisma.e_estructura_articulo_corpo_puesto_entrega.findMany({
                  where: { OR: orScope },
                  orderBy: { id: "asc" },
              })
            : Promise.resolve([]),
    ]);

    const comboById = new Map(combos.map((c) => [c.id, c]));
    const comboPlansByComboId = new Map<number, ArticuloPlanRow[]>();
    for (const plan of comboPlansAll as ArticuloPlanRow[]) {
        const cid = Number(plan.combo_id);
        if (!cid) continue;
        const list = comboPlansByComboId.get(cid) ?? [];
        list.push(plan);
        comboPlansByComboId.set(cid, list);
    }

    for (const puesto of puestos) {
        const puestoId = puesto.id;
        const corpoId =
            puesto.sucursal_id != null && Number(puesto.sucursal_id) > 0 ? Number(puesto.sucursal_id) : null;
        const comboId =
            puesto.comboArticulosCP_id != null && Number(puesto.comboArticulosCP_id) > 0
                ? Number(puesto.comboArticulosCP_id)
                : null;

        const usedPlanIds = new Set<number>();
        let combo: { id: number; nombre: string } | null = null;
        const comboPlans: ArticuloPlanRow[] = [];

        if (comboId) {
            combo = comboById.get(comboId) ?? null;
            for (const art of comboPlansByComboId.get(comboId) ?? []) {
                usedPlanIds.add(art.id);
                comboPlans.push(art);
            }
        }

        const directPlans = (directPlansAll as ArticuloPlanRow[]).filter(
            (art) => !usedPlanIds.has(art.id) && planMatchesScope(art, puestoId, corpoId),
        );

        const entregas = (entregasAll as ArticuloEntregaRow[]).filter((art) =>
            planMatchesScope(art, puestoId, corpoId),
        );

        result.set(puestoId, { combo, comboPlans, directPlans, entregas });
    }

    return result;
}

export async function loadNomencladorById(
    prisma: ReportDataAccess,
    nomencladorIds: Iterable<number>,
): Promise<Map<number, string>> {
    const ids = uniquePositive([...nomencladorIds]);
    if (!ids.length) return new Map();
    const rows = await prisma.n_articulo_corpo_puesto.findMany({
        where: { id: { in: ids } },
        select: { id: true, nombre: true },
    });
    return new Map(rows.map((r) => [r.id, r.nombre]));
}

export async function loadComboNamesById(
    prisma: ReportDataAccess,
    comboIds: Iterable<number>,
): Promise<Map<number, string>> {
    const ids = uniquePositive([...comboIds]);
    if (!ids.length) return new Map();
    const rows = await prisma.e_estructura_combo_articulo_cp.findMany({
        where: { id: { in: ids } },
        select: { id: true, nombre: true },
    });
    return new Map(rows.map((r) => [r.id, r.nombre]));
}

/** Enlaces plan/asignado para mantenimiento — sin peticiones dentro del for. */
export function collectArticuloLinksFromBatch(
    puestos: ArticuloPuestoInput[],
    batch: Map<number, ArticuloPuestoBatchSlice>,
): ArticuloLink[] {
    const links: ArticuloLink[] = [];
    const seenPlan = new Set<number>();
    const seenEntrega = new Set<number>();

    for (const puesto of puestos) {
        const puestoId = puesto.id;
        const corpoId =
            puesto.sucursal_id != null && Number(puesto.sucursal_id) > 0 ? Number(puesto.sucursal_id) : null;
        const slice = batch.get(puestoId);
        if (!slice) continue;

        for (const art of slice.comboPlans) {
            if (seenPlan.has(art.id)) continue;
            seenPlan.add(art.id);
            links.push({
                origen: "Plan",
                registro_id: art.id,
                puesto_id: art.puesto_id && art.puesto_id > 0 ? art.puesto_id : puestoId,
                corpo_id: art.corpo_id ?? corpoId,
                nomenclador_id: art.articuloCP_id,
            });
        }

        for (const art of slice.directPlans) {
            if (seenPlan.has(art.id)) continue;
            seenPlan.add(art.id);
            links.push({
                origen: "Plan",
                registro_id: art.id,
                puesto_id: art.puesto_id && art.puesto_id > 0 ? art.puesto_id : puestoId,
                corpo_id: art.corpo_id ?? corpoId,
                nomenclador_id: art.articuloCP_id,
            });
        }

        for (const art of slice.entregas) {
            if (seenEntrega.has(art.id)) continue;
            seenEntrega.add(art.id);
            links.push({
                origen: "Asignado",
                registro_id: art.id,
                puesto_id: art.puesto_id && art.puesto_id > 0 ? art.puesto_id : puestoId,
                corpo_id: art.corpo_id ?? corpoId,
                nomenclador_id: art.nomencladorArticuloCP_id,
            });
        }
    }

    return links;
}
