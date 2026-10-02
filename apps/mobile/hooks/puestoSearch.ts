import { loadMainStructureTreeMerged } from '@/hooks/bitacoraMainStructureCache';
import { searchHierarchyInTree } from '@/hooks/hierarchySearch';

export type PuestoSearchHit = {
  puestoId: number;
  nombre: string;
  codigo: string;
  title: string;
  subtitle: string;
};

function parsePuestoTitle(title: string): { codigo: string; nombre: string } {
  const idx = title.indexOf(' — ');
  if (idx >= 0) {
    return { codigo: title.slice(0, idx).trim(), nombre: title.slice(idx + 3).trim() };
  }
  return { codigo: '', nombre: title.trim() };
}

export function mapHierarchyHitToPuestoSearchHit(hit: {
  id: number;
  title: string;
  subtitle: string;
}): PuestoSearchHit {
  const { codigo, nombre } = parsePuestoTitle(hit.title);
  return {
    puestoId: Number(hit.id),
    nombre,
    codigo,
    title: hit.title,
    subtitle: hit.subtitle,
  };
}

/** Busca puestos por nombre o código en la jerarquía local (AsyncStorage / main-structure). */
export async function searchPuestosForTraining(
  query: string,
  treeHint?: any[],
): Promise<PuestoSearchHit[]> {
  const q = String(query ?? '').trim();
  if (!q) return [];

  const tree =
    Array.isArray(treeHint) && treeHint.length > 0
      ? treeHint
      : ((await loadMainStructureTreeMerged()) as any[]);

  await new Promise((resolve) => setTimeout(resolve, 120));

  const hits = searchHierarchyInTree(Array.isArray(tree) ? tree : [], 'puesto', q);
  return hits.map(mapHierarchyHitToPuestoSearchHit);
}
