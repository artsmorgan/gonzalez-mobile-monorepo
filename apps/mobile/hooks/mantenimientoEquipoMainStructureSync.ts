import { loadMainStructureFragmentsObject, writeMainStructureFragmentPatch } from '@/hooks/mainStructureFragmentsStorage';
import { loadMainStructureTreeMerged } from '@/hooks/bitacoraMainStructureCache';
import { readPuestoArticulosList, writePuestoArticulosList } from '@/hooks/mantenimientoEquipoPuestoArticulosCache';
import { sanitizeArticuloNodeForCache } from '@/utils/articuloMantenimientoFiles';

/** Misma forma que en Checklist/Activities: `puesto.articulos` dentro del árbol mergeado. */
export function extractArticulosForPuestoFromTree(tree: any[], puestoId: number): any[] | null {
  const pid = Number(puestoId);
  if (!Array.isArray(tree) || !Number.isFinite(pid) || pid <= 0) return null;
  for (const empresa of tree) {
    for (const cliente of empresa?.clientes || []) {
      for (const division of cliente?.division || []) {
        for (const contrato of division?.contratos || []) {
          for (const sucursal of contrato?.sucursales || []) {
            for (const puesto of sucursal?.puestos || []) {
              if (Number(puesto?.id) === pid && Array.isArray(puesto.articulos)) {
                return puesto.articulos;
              }
            }
          }
        }
      }
    }
  }
  return null;
}

type ReportListItem = {
  key?: string;
  source: 'plan' | 'asignado';
  estructura_id: number;
  articulo_nomenclador_id: number | null;
  articulo_nombre: string;
  tipo?: string;
  tipos_mantenimiento: any[];
  mantenimientos: any[];
  movimientos: any[];
  ultimo_mantenimiento?: any | null;
  ultimo_registro_mantenimiento?: any | null;
  marca?: string | null;
  modelo?: string | null;
  serie?: string | null;
};

/**
 * Convierte un ítem de la lista del módulo Equipo a un nodo `articulo` alineado con `main-structure` / fragmento.
 */
export function reportItemToArticuloTreeNode(item: ReportListItem): any {
  const expectedTipo = item.source === 'plan' ? 'Plan' : 'Asignado';
  const ultimo =
    item.ultimo_mantenimiento != null
      ? item.ultimo_mantenimiento
      : Array.isArray(item.mantenimientos) && item.mantenimientos.length > 0
        ? item.mantenimientos[0]
        : null;
  return sanitizeArticuloNodeForCache({
    id: item.estructura_id,
    tipo: expectedTipo,
    nombre: item.articulo_nombre,
    articulo_nomenclador_id: item.articulo_nomenclador_id,
    marca: item.marca ?? null,
    modelo: item.modelo ?? null,
    serie: item.serie ?? null,
    tipos_mantenimiento: item.tipos_mantenimiento ?? [],
    mantenimientos: item.mantenimientos ?? [],
    movimientos: item.movimientos ?? [],
    ultimo_mantenimiento: ultimo,
    ultimo_registro_mantenimiento: ultimo,
  });
}

/**
 * Sincroniza el fragmento `puesto_{id}_articulos` (fuente al mergear la jerarquía) con la lista
 * de artículos del puesto (GET o estado actualizado en app).
 * Sin esto, `loadMainStructureTreeMerged` sigue leyendo datos viejos en `puesto.*.articulos`.
 */
export async function syncPuestoArticulosFragmentFromReportesList(
  puestoId: number,
  items: ReportListItem[]
): Promise<void> {
  if (!Number.isFinite(Number(puestoId)) || Number(puestoId) <= 0) return;
  if (!Array.isArray(items) || items.length === 0) return;

  try {
    const fr = await loadMainStructureFragmentsObject();
    if (!fr || Object.keys(fr).length === 0) return;

    const fragKey = `puesto_${Number(puestoId)}_articulos`;
    const patched = items.map((it) => reportItemToArticuloTreeNode(it));
    await writeMainStructureFragmentPatch(fragKey, patched);
  } catch (e) {
    console.error('syncPuestoArticulosFragmentFromReportesList:', e);
  }
}

/** Aplica un patch a un ítem de `mantenimientos` por `id` y reordena por id desc (criterio del API). */
export function applyPatchToMantenimientosArray(
  mants: any[] | undefined,
  mantenimientoId: number,
  patch: Record<string, any>
): { mants: any[]; first: any | null; changed: boolean } {
  const list = Array.isArray(mants) ? [...mants] : [];
  const idx = list.findIndex((m: any) => Number(m?.id) === Number(mantenimientoId));
  if (idx < 0) return { mants: list, first: list[0] ?? null, changed: false };
  list[idx] = { ...list[idx], ...patch, id: mantenimientoId };
  list.sort((a: any, b: any) => Number(b?.id) - Number(a?.id));
  return { mants: list, first: list[0] ?? null, changed: true };
}

/**
 * Actualiza un registro en `mantenimientos` por id (cualquier posición) y re-sincroniza
 * `ultimo_mantenimiento` / `ultimo_registro_mantenimiento` con el más reciente (id desc, igual que el API).
 * Persiste en `puesto_{id}_articulos` (AsyncStorage) y en el fragmento de jerarquía.
 */
export async function applyMantenimientoPatchToPuestoReporteStores(params: {
  puestoId: number;
  source: 'plan' | 'asignado';
  estructuraId: number;
  mantenimientoId: number;
  patch: Record<string, any>;
}): Promise<ReportListItem[] | null> {
  const { puestoId, source, estructuraId, mantenimientoId, patch } = params;
  if (!Number.isFinite(Number(puestoId)) || puestoId <= 0) return null;
  if (!estructuraId || !mantenimientoId) return null;

  const reporteKey = `${source === 'plan' ? 'plan' : 'asignado'}-${estructuraId}`;

  try {
    const fromStorage = await readPuestoArticulosList(puestoId);
    if (Array.isArray(fromStorage) && fromStorage.length > 0) {
      const ridx = fromStorage.findIndex((r) => r.key === reporteKey);
      if (ridx < 0) return null;
      const row = { ...fromStorage[ridx] };
      const { mants, first, changed } = applyPatchToMantenimientosArray(row.mantenimientos, mantenimientoId, patch);
      if (!changed) return null;
      const nextRow: ReportListItem = {
        ...row,
        mantenimientos: mants,
        ultimo_mantenimiento: first,
        ultimo_registro_mantenimiento: first,
      };
      const next = fromStorage.map((r) => (r.key === reporteKey ? nextRow : r));
      await writePuestoArticulosList(puestoId, next);
      await syncPuestoArticulosFragmentFromReportesList(puestoId, next);
      return next;
    }

    await patchPuestoArticulosFragmentMantenimientoById({
      puestoId,
      source,
      estructuraId,
      mantenimientoId,
      patch,
    });
    return null;
  } catch (e) {
    console.error('applyMantenimientoPatchToPuestoReporteStores:', e);
    return null;
  }
}

/**
 * Fragmento `puesto_{id}_articulos` cuando aún no hay lista en AsyncStorage: misma lógica que
 * `applyMantenimientoPatchToPuebloReporteStores` a nivel nodo de artículo.
 */
export async function patchPuestoArticulosFragmentMantenimientoById(params: {
  puestoId: number;
  source: 'plan' | 'asignado';
  estructuraId: number;
  mantenimientoId: number;
  patch: Record<string, any>;
}): Promise<boolean> {
  const { puestoId, source, estructuraId, mantenimientoId, patch } = params;
  if (!Number.isFinite(Number(puestoId)) || puestoId <= 0) return false;
  if (!estructuraId || !mantenimientoId) return false;

  try {
    const fr = await loadMainStructureFragmentsObject();
    if (!fr || Object.keys(fr).length === 0) return false;

    const fragKey = `puesto_${Number(puestoId)}_articulos`;
    const fromFragment = fr[fragKey];
    let list: any[] = Array.isArray(fromFragment) ? [...fromFragment] : [];

    if (list.length === 0) {
      const tree = await loadMainStructureTreeMerged();
      const extracted = extractArticulosForPuestoFromTree(tree, puestoId);
      if (!extracted || extracted.length === 0) return false;
      list = extracted.map((a) => ({ ...a }));
    }

    const expectedTipo = source === 'plan' ? 'Plan' : 'Asignado';
    let found = false;
    const next = list.map((art: any) => {
      if (Number(art?.id) !== Number(estructuraId) || String(art?.tipo) !== expectedTipo) return art;
      const { mants, first, changed } = applyPatchToMantenimientosArray(art.mantenimientos, mantenimientoId, patch);
      if (!changed) return art;
      found = true;
      return {
        ...art,
        mantenimientos: mants,
        ultimo_mantenimiento: first,
        ultimo_registro_mantenimiento: first,
      };
    });

    if (found) {
      await writeMainStructureFragmentPatch(fragKey, next);
      return true;
    }
  } catch (e) {
    console.error('patchPuestoArticulosFragmentMantenimientoById:', e);
  }
  return false;
}

/**
 * @deprecated Usar `applyMantenimientoPatchToPuestoReporteStores` o `patchPuestoArticulosFragmentMantenimientoById`.
 * Conservado por si algún flujo aún importa el nombre; delega al patch por id en fragmento.
 */
export async function patchPuestoArticulosFragmentUltimoMantenimiento(params: {
  puestoId: number;
  source: 'plan' | 'asignado';
  estructuraId: number;
  mantenimientoId: number;
  patch: Record<string, any>;
}): Promise<void> {
  const applied = await applyMantenimientoPatchToPuestoReporteStores(params);
  if (applied) return;
  await patchPuestoArticulosFragmentMantenimientoById(params);
}
