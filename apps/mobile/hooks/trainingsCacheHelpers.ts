/** Filas guardadas en AsyncStorage (`trainings_cache`). */

export type TrainingCacheRow = {
  id: number;
  corpo_id?: number;
  sucursal_id?: number;
  sucursal?: { id?: number };
  id_local?: string;
};

export function getTrainingRecordCorpoId(t: TrainingCacheRow): number | null {
  if (t.corpo_id != null && !Number.isNaN(Number(t.corpo_id))) {
    return Number(t.corpo_id);
  }
  if (t.sucursal_id != null && !Number.isNaN(Number(t.sucursal_id))) {
    return Number(t.sucursal_id);
  }
  return t.sucursal?.id != null ? Number(t.sucursal.id) : null;
}

export function isTrainingLocalPendingRecord(t: TrainingCacheRow): boolean {
  return t.id === 0 && Boolean(t.id_local);
}

/**
 * Sustituye en caché solo las filas del `corpoId` indicado que vienen del servidor;
 * conserva borradores locales (`id === 0` + `id_local`) de esa sucursal y no altera otras sucursales.
 */
export function mergeTrainingsCacheForCorpo<T extends TrainingCacheRow>(
  existing: T[],
  freshForCorpo: T[],
  corpoId: number
): T[] {
  const normalizedFresh = freshForCorpo.map((t) => ({
    ...t,
    corpo_id: t.corpo_id ?? t.sucursal?.id ?? corpoId,
  })) as T[];
  const others = existing.filter((t) => getTrainingRecordCorpoId(t) !== corpoId);
  const sameCorpoPending = existing.filter(
    (t) => getTrainingRecordCorpoId(t) === corpoId && isTrainingLocalPendingRecord(t)
  );
  return [...others, ...normalizedFresh, ...sameCorpoPending];
}
