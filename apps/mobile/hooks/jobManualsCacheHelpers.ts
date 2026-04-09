/**
 * Utilidades compartidas para `job_manuals_cache` (fusión por puesto).
 */

export function getManualPuestoId(m: any): number | null {
  const raw = m?.puesto?.id ?? m?.puesto_id;
  if (raw === undefined || raw === null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Conserva manuales de otros puestos y borradores locales del puesto;
 * sustituye el resto del slice por la respuesta del servidor para ese `puestoId`.
 */
export function mergeJobManualsCacheForPuesto<T extends Record<string, any>>(
  existing: T[],
  freshFromServer: T[],
  puestoId: number
): T[] {
  const pid = Number(puestoId);
  const pendingLocal = existing.filter((m: any) => {
    if (getManualPuestoId(m) !== pid) return false;
    return !!(m.id_local && (m.synced === false || m.id === 0));
  });
  const keepOtherPuestos = existing.filter((m: any) => getManualPuestoId(m) !== pid);
  const freshTagged = (freshFromServer || []).map((m: any) => ({
    ...m,
    synced: true as const,
    puesto:
      m.puesto?.id != null ? m.puesto : { id: pid, nombre: m.puesto?.nombre || '' },
  }));
  return [...keepOtherPuestos, ...pendingLocal, ...freshTagged] as T[];
}
