import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Utilidades compartidas para `job_manuals_cache` (fusión por puesto).
 */

const JOB_MANUALS_CACHE_KEY = 'job_manuals_cache';

/**
 * Actualiza en AsyncStorage el/los puestos vinculados del manual para listados y filtros offline.
 * - `replaceAll: true`: reemplaza `puestos_vinculados_ids` (borrador cuyo `requestData.puestos` ya se fusionó).
 * - `replaceAll: false`: une ids nuevos a los ya almacenados (append de puestos hacia el servidor o cola).
 */
export async function patchJobManualPuestosVinculadosInCache(
  options: {
    manualServerId?: number;
    idLocal?: string;
    replaceAll: boolean;
    getPuestoNombre?: (puestoId: number) => string | undefined;
  },
  puestoIds: number[]
): Promise<void> {
  const add = puestoIds.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0);
  if (add.length === 0) return;

  const s = await AsyncStorage.getItem(JOB_MANUALS_CACHE_KEY);
  if (!s) return;
  let list: any[];
  try {
    list = JSON.parse(s);
  } catch {
    return;
  }
  if (!Array.isArray(list)) return;

  const { manualServerId, idLocal, replaceAll, getPuestoNombre } = options;

  const next = list.map((m) => {
    const byServer = manualServerId != null && m.id === manualServerId;
    const byLocal = idLocal != null && String(m.id_local) === String(idLocal);
    if (!byServer && !byLocal) return m;

    let prev: number[] = Array.isArray(m.puestos_vinculados_ids)
      ? m.puestos_vinculados_ids.map((x: unknown) => Number(x)).filter((n: number) => n > 0)
      : [];
    const prim = getManualPuestoId(m);
    if (prev.length === 0 && prim) prev = [prim];

    const merged = replaceAll ? Array.from(new Set(add)) : Array.from(new Set([...prev, ...add]));
    if (merged.length === 0) return m;

    const first = merged[0]!;
    const label =
      getPuestoNombre?.(first) || (m.puesto?.id === first ? m.puesto.nombre : undefined) || m.puesto?.nombre || 'Puesto';

    return {
      ...m,
      puestos_vinculados_ids: merged,
      puesto_id: first,
      puesto: { id: first, nombre: String(label) },
    };
  });

  await AsyncStorage.setItem(JOB_MANUALS_CACHE_KEY, JSON.stringify(next));
}

/**
 * Actualiza en AsyncStorage los empleados vinculados del manual para listados y filtros offline.
 * Mismo patrón que `patchJobManualPuestosVinculadosInCache`, sin noción de "principal" (los empleados
 * vinculados no reemplazan ningún campo raíz del manual, solo `empleados_vinculados_ids`).
 */
export async function patchJobManualEmpleadosVinculadosInCache(
  options: {
    manualServerId?: number;
    idLocal?: string;
    replaceAll: boolean;
  },
  empleadoIds: number[]
): Promise<void> {
  const add = empleadoIds.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0);
  if (add.length === 0) return;

  const s = await AsyncStorage.getItem(JOB_MANUALS_CACHE_KEY);
  if (!s) return;
  let list: any[];
  try {
    list = JSON.parse(s);
  } catch {
    return;
  }
  if (!Array.isArray(list)) return;

  const { manualServerId, idLocal, replaceAll } = options;

  const next = list.map((m) => {
    const byServer = manualServerId != null && m.id === manualServerId;
    const byLocal = idLocal != null && String(m.id_local) === String(idLocal);
    if (!byServer && !byLocal) return m;

    const prev: number[] = Array.isArray(m.empleados_vinculados_ids)
      ? m.empleados_vinculados_ids.map((x: unknown) => Number(x)).filter((n: number) => n > 0)
      : [];

    const merged = replaceAll ? Array.from(new Set(add)) : Array.from(new Set([...prev, ...add]));

    return {
      ...m,
      empleados_vinculados_ids: merged,
    };
  });

  await AsyncStorage.setItem(JOB_MANUALS_CACHE_KEY, JSON.stringify(next));
}

export function getManualPuestoId(m: any): number | null {
  // `puesto.id` puede ser 0 en borradores; `puesto_id` en raíz (caché offline) tiene prioridad.
  const fromRoot = m?.puesto_id;
  const fromNested = m?.puesto?.id;
  const tryNum = (v: unknown) => {
    if (v === undefined || v === null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  return tryNum(fromRoot) ?? tryNum(fromNested);
}

/**
 * El manual debe listarse para `puestoId` (filtro jerárquico o puesto de `current_marca`) si
 * coincide el puesto principal o si está en `puestos_vinculados_ids` (misma regla que el GET por puesto).
 */
export function manualIsVisibleForPuesto(m: any, puestoId: number): boolean {
  const pid = Number(puestoId);
  if (!Number.isFinite(pid) || pid <= 0) return false;
  if (getManualPuestoId(m) === pid) return true;
  const linked = m?.puestos_vinculados_ids;
  if (Array.isArray(linked) && linked.length > 0) {
    return linked.some((x: unknown) => Number(x) === pid);
  }
  return false;
}

/** El manual debe listarse para `empleadoId` si está en `empleados_vinculados_ids` del registro. */
export function manualIsVisibleForEmpleado(m: any, empleadoId: number): boolean {
  const eid = Number(empleadoId);
  if (!Number.isFinite(eid) || eid <= 0) return false;
  const linked = m?.empleados_vinculados_ids;
  if (Array.isArray(linked) && linked.length > 0) {
    return linked.some((x: unknown) => Number(x) === eid);
  }
  return false;
}

/** Sucursal (corpo) almacenada en el registro; necesaria para listados offline por sucursal. */
export function getManualCorpoId(m: any): number | null {
  const raw = m?.corpo_id;
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
    if (!m.id_local || !(m.synced === false || m.id === 0)) return false;
    return manualIsVisibleForPuesto(m, pid);
  });
  const keepOtherPuestos = existing.filter((m: any) => !manualIsVisibleForPuesto(m, pid));
  const puestoVinculadosForServer = (m: any): number[] => {
    if (Array.isArray(m?.puestos_vinculados_ids) && m.puestos_vinculados_ids.length > 0) {
      return m.puestos_vinculados_ids.map((x: unknown) => Number(x)).filter((n: number) => n > 0);
    }
    const s = new Set<number>();
    s.add(pid);
    const cur = getManualPuestoId(m);
    if (cur) s.add(cur);
    return Array.from(s);
  };

  const existingById = new Map(
    (Array.isArray(existing) ? existing : [])
      .filter((e: any) => e?.id != null && Number(e.id) > 0)
      .map((e: any) => [Number(e.id), e])
  );
  const freshTagged = (freshFromServer || [])
    .filter((m: any) => m?.isActive !== false)
    .map((m: any) => {
      const ex = m?.id != null ? existingById.get(Number(m.id)) : null;
      const baseIds = puestoVinculadosForServer(m);
      const prevV = ex?.puestos_vinculados_ids;
      const puestosVinc =
        Array.isArray(prevV) && prevV.length > 0
          ? Array.from(
              new Set(
                [
                  ...baseIds,
                  ...prevV.map((x: unknown) => Number(x)).filter((n: number) => n > 0),
                ]
              )
            )
          : baseIds;
      return {
        ...m,
        synced: true as const,
        puesto: m.puesto?.id != null ? m.puesto : { id: pid, nombre: m.puesto?.nombre || '' },
        puestos_vinculados_ids: puestosVinc,
      };
    });

  const combined = [...keepOtherPuestos, ...pendingLocal, ...freshTagged] as T[];
  // Última aparición gana (p. ej. dato de servidor reciente; evita duplicar el mismo `id` en keep + fresh)
  const seen = new Set<string>();
  const deduped: T[] = [];
  for (let i = combined.length - 1; i >= 0; i--) {
    const m = combined[i] as any;
    let k: string;
    if (m?.id != null && Number(m.id) > 0) {
      k = `i:${Number(m.id)}`;
    } else if (m?.id_local) {
      k = `l:${String(m.id_local)}`;
    } else {
      k = `o:${i}`;
    }
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push(m);
  }
  return deduped.reverse() as T[];
}

/**
 * Igual que `mergeJobManualsCacheForPuesto`, pero la "sección" a refrescar es la de un empleado
 * (`empleados_vinculados_ids`). El GET por empleado no devuelve `puestos_vinculados_ids` (solo el
 * puesto propio del manual en `puesto`), así que se preserva/extiende el que ya hubiera en caché.
 */
export function mergeJobManualsCacheForEmpleado<T extends Record<string, any>>(
  existing: T[],
  freshFromServer: T[],
  empleadoId: number
): T[] {
  const eid = Number(empleadoId);
  const pendingLocal = existing.filter((m: any) => {
    if (!m.id_local || !(m.synced === false || m.id === 0)) return false;
    return manualIsVisibleForEmpleado(m, eid);
  });
  const keepOtherEmpleados = existing.filter((m: any) => !manualIsVisibleForEmpleado(m, eid));

  const existingById = new Map(
    (Array.isArray(existing) ? existing : [])
      .filter((e: any) => e?.id != null && Number(e.id) > 0)
      .map((e: any) => [Number(e.id), e])
  );
  const freshTagged = (freshFromServer || [])
    .filter((m: any) => m?.isActive !== false)
    .map((m: any) => {
      const ex = m?.id != null ? existingById.get(Number(m.id)) : null;
      const prevP = ex?.puestos_vinculados_ids;
      const ownPuestoId = getManualPuestoId(m);
      const basePuestoIds = ownPuestoId ? [ownPuestoId] : [];
      const puestosVinc =
        Array.isArray(prevP) && prevP.length > 0
          ? Array.from(
              new Set([...basePuestoIds, ...prevP.map((x: unknown) => Number(x)).filter((n: number) => n > 0)])
            )
          : basePuestoIds;
      return {
        ...m,
        synced: true as const,
        puestos_vinculados_ids: puestosVinc,
      };
    });

  const combined = [...keepOtherEmpleados, ...pendingLocal, ...freshTagged] as T[];
  const seen = new Set<string>();
  const deduped: T[] = [];
  for (let i = combined.length - 1; i >= 0; i--) {
    const m = combined[i] as any;
    let k: string;
    if (m?.id != null && Number(m.id) > 0) {
      k = `i:${Number(m.id)}`;
    } else if (m?.id_local) {
      k = `l:${String(m.id_local)}`;
    } else {
      k = `o:${i}`;
    }
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push(m);
  }
  return deduped.reverse() as T[];
}
