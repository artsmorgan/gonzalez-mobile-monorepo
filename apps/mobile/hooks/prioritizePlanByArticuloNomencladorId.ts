/**
 * Si hay 2+ elementos con el mismo `articulo_nomenclador_id`, se conservan los de tipo Plan
 * (el Asignado queda como respaldo solo si no hay Plan para ese nomenclador).
 */

export function isPlanArticuloItem(item: {
  source?: string | null;
  tipo?: string | null;
}): boolean {
  if (item.source === 'plan') return true;
  if (item.source === 'asignado') return false;
  const tipo = String(item.tipo ?? '').toLowerCase();
  if (tipo.includes('asignado')) return false;
  return tipo.includes('plan');
}

export function prioritizePlanByArticuloNomencladorId<
  T extends {
    articulo_nomenclador_id?: number | null;
    source?: string | null;
    tipo?: string | null;
  },
>(items: T[]): T[] {
  if (!Array.isArray(items) || items.length <= 1) return items;

  const counts = new Map<number, number>();
  for (const item of items) {
    const nomId = Number(item?.articulo_nomenclador_id);
    if (!Number.isFinite(nomId) || nomId <= 0) continue;
    counts.set(nomId, (counts.get(nomId) ?? 0) + 1);
  }

  const hasPlanForNom = new Map<number, boolean>();
  for (const item of items) {
    const nomId = Number(item?.articulo_nomenclador_id);
    if (!Number.isFinite(nomId) || nomId <= 0) continue;
    if ((counts.get(nomId) ?? 0) < 2) continue;
    if (isPlanArticuloItem(item)) hasPlanForNom.set(nomId, true);
  }

  return items.filter((item) => {
    const nomId = Number(item?.articulo_nomenclador_id);
    if (!Number.isFinite(nomId) || nomId <= 0) return true;
    if ((counts.get(nomId) ?? 0) < 2) return true;
    if (!hasPlanForNom.get(nomId)) return true;
    return isPlanArticuloItem(item);
  });
}
