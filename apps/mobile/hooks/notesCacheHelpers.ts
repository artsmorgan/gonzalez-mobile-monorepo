/**
 * `notes_cache`: mezcla por `puesto_id` sin borrar notas de otros puestos.
 */

export type NotesCachePayload = {
  notas: any[];
  puesto?: { id: number; nombre?: string } | null;
};

export function parseNotesCache(raw: string | null): NotesCachePayload {
  if (!raw) return { notas: [], puesto: null };
  try {
    const p = JSON.parse(raw);
    if (Array.isArray(p)) return { notas: p, puesto: null };
    const notas = Array.isArray(p.notas) ? p.notas : [];
    return { notas, puesto: p.puesto ?? null };
  } catch {
    return { notas: [], puesto: null };
  }
}

export function resolveNotePuestoId(note: any, legacyFallbackPuestoId: number | null): number | null {
  const n = Number(note?.puesto_id);
  if (Number.isFinite(n) && n > 0) return n;
  if (
    legacyFallbackPuestoId != null &&
    Number.isFinite(Number(legacyFallbackPuestoId)) &&
    Number(legacyFallbackPuestoId) > 0
  ) {
    return Number(legacyFallbackPuestoId);
  }
  return null;
}

export function filterNotesByPuestoId(
  notas: any[],
  puestoId: number | null,
  legacyFallbackPuestoId: number | null
): any[] {
  if (puestoId == null || !Number.isFinite(Number(puestoId)) || Number(puestoId) <= 0) return [];
  const pid = Number(puestoId);
  return (notas || []).filter((n) => n?.isActive !== false && resolveNotePuestoId(n, legacyFallbackPuestoId) === pid);
}

export function isNoteLocalPending(note: any): boolean {
  if (note?.id === 0) return true;
  if (note?.id_local != null && String(note.id_local).length > 0) return true;
  return false;
}

/** Rehidrata base64 en frescas desde la misma versión en caché (por id de nota). */
export function mergeNotesBase64FromCache(freshNotes: any[], cachedNotes: any[]): any[] {
  const cachedById = new Map<number, any>(
    (Array.isArray(cachedNotes) ? cachedNotes : [])
      .filter((n: any) => Number.isFinite(Number(n?.id)) && Number(n?.id) > 0)
      .map((n: any) => [Number(n.id), n])
  );

  return (Array.isArray(freshNotes) ? freshNotes : []).map((note: any) => {
    const cached = cachedById.get(Number(note?.id));
    if (!cached) return note;

    const cachedImagesByName = new Map<string, any>(
      (Array.isArray(cached.images) ? cached.images : [])
        .filter((img: any) => img?.name)
        .map((img: any) => [String(img.name), img])
    );

    const mergedImages = (Array.isArray(note.images) ? note.images : []).map((img: any) => {
      const fromCache = img?.name ? cachedImagesByName.get(String(img.name)) : null;
      if (fromCache?.base64 && !img?.base64) {
        return { ...img, base64: fromCache.base64 };
      }
      return img;
    });

    return { ...note, images: mergedImages };
  });
}

/**
 * Sustituye en el array global solo las notas del `puestoId` indicado: conserva pendientes locales y
 * añade la respuesta del servidor (con base64 fusionado desde el slice previo del mismo puesto).
 */
export function mergeNotesCacheForPuesto(
  fullCacheNotas: any[],
  freshFromServer: any[],
  puestoId: number,
  legacyFallbackPuestoId: number | null,
  mergeBase64: (fresh: any[], cachedSlice: any[]) => any[] = mergeNotesBase64FromCache
): any[] {
  const pid = Number(puestoId);
  const sliceForPuesto = (fullCacheNotas || []).filter(
    (n) => resolveNotePuestoId(n, legacyFallbackPuestoId) === pid
  );
  const otherPuestos = (fullCacheNotas || []).filter(
    (n) => resolveNotePuestoId(n, legacyFallbackPuestoId) !== pid
  );
  const pending = sliceForPuesto.filter(isNoteLocalPending);
  const mergedFresh = mergeBase64(freshFromServer || [], sliceForPuesto);
  const taggedServer = mergedFresh.map((n) => ({ ...n, synced: true }));
  const taggedPending = pending.map((n) => ({ ...n, synced: false }));
  return [...otherPuestos, ...taggedPending, ...taggedServer];
}
