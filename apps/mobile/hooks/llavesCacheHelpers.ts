/**
 * Fusión de `llaves_cache` por sucursal (`corpo_id`).
 */
import { persistSignatureRef } from './fileStorage';

export async function localizeMovimientosFirmas(
  movimientos: any,
  previousMovimientos: any,
  prefixEntrega = 'mov_llave_firma_entrega',
  prefixRecibe = 'mov_llave_firma_recibe'
): Promise<any> {
  if (!Array.isArray(movimientos)) return movimientos;
  const prevById = new Map(
    (Array.isArray(previousMovimientos) ? previousMovimientos : []).map((m: any) => [String(m?.id ?? ''), m])
  );
  return Promise.all(
    movimientos.map(async (m: any) => {
      const prev = prevById.get(String(m?.id ?? ''));
      const firmaEntrega = await persistSignatureRef({
        value: m.firma_entrega ?? null,
        previousRef: prev?.firma_entrega ?? null,
        prefix: prefixEntrega,
      });
      const firmaRecibe = await persistSignatureRef({
        value: m.firma_recibe ?? null,
        previousRef: prev?.firma_recibe ?? null,
        prefix: prefixRecibe,
      });
      return { ...m, id_local: m.id_local ?? '', firma_entrega: firmaEntrega, firma_recibe: firmaRecibe };
    })
  );
}

export function getLlaveCorpoId(m: any): number | null {
  const raw = m?.corpo_id;
  if (raw === undefined || raw === null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Conserva llaves de otras sucursales y borradores locales (`id_local` + `id === 0`) de esta sucursal;
 * sustituye el resto del slice por la respuesta del servidor.
 */
export async function mergeLlavesCacheForCorpo<T extends Record<string, any>>(
  existing: T[],
  freshFromServer: T[],
  corpoId: number
): Promise<T[]> {
  const cid = Number(corpoId);
  const pendingLocal = existing.filter((m: any) => {
    if (getLlaveCorpoId(m) !== cid) return false;
    return !!(m.id_local && (m.id === 0 || m.id == null));
  });
  const keepOtherCorpos = existing.filter((m: any) => getLlaveCorpoId(m) !== cid);
  const previousById = new Map(existing.map((m: any) => [String(m?.id ?? ''), m]));
  // El servidor devuelve `firma_entrega`/`firma_recibe` de cada movimiento en base64: se guardan en
  // expo-files antes de cachear (nunca base64 crudo en AsyncStorage).
  const tagged = await Promise.all(
    (freshFromServer || []).map(async (m: any) => ({
      ...m,
      movimientos: await localizeMovimientosFirmas(m.movimientos, previousById.get(String(m?.id ?? ''))?.movimientos),
      id_local: m.id_local ?? '',
    }))
  );
  return [...keepOtherCorpos, ...pendingLocal, ...tagged] as T[];
}

export function filterLlavesByCorpo<T extends Record<string, any>>(items: T[], corpoId: number | null): T[] {
  if (corpoId == null || !Number.isFinite(Number(corpoId)) || Number(corpoId) <= 0) return [];
  const cid = Number(corpoId);
  return items.filter((m) => getLlaveCorpoId(m) === cid);
}

/**
 * Sustituye en caché todas las llaves de una sucursal por `sliceForCorpo` (p. ej. estado en pantalla),
 * sin tocar filas de otras sucursales.
 */
export function replaceLlavesCorpoSliceInCache<T extends Record<string, any>>(
  existing: T[],
  sliceForCorpo: T[],
  corpoId: number | null
): T[] {
  if (corpoId == null || !Number.isFinite(Number(corpoId)) || Number(corpoId) <= 0) {
    return Array.isArray(sliceForCorpo) ? [...sliceForCorpo] : [...(existing || [])];
  }
  const cid = Number(corpoId);
  const keepOther = (existing || []).filter((m: any) => getLlaveCorpoId(m) !== cid);
  return [...keepOther, ...(sliceForCorpo || [])] as T[];
}
