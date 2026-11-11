/**
 * Caché global `voice_notes_cache` (array de notas de voz) + alcance corpo/puesto
 * alineado con GET /api/voice-notes?corpo_id=&puesto_id=
 */

export function filterVoiceNotesByActive<T extends { isActive?: boolean }>(rows: T[]): T[] {
  if (!Array.isArray(rows)) return [];
  return rows.filter((v) => v != null && (v as any).isActive !== false);
}

export function getStableVoiceNoteListKey(vn: { id?: number; id_local?: string } | null | undefined): string {
  if (vn == null) return 'null';
  if (vn.id_local && String(vn.id_local) !== '' && (vn.id == null || Number(vn.id) === 0)) {
    return `l:${String(vn.id_local)}`;
  }
  const id = Number(vn.id);
  if (Number.isFinite(id) && id > 0) return `i:${id}`;
  return `u:${String(vn.id_local ?? '')}`;
}

export function dedupeVoiceNotesList<T extends { id?: number; id_local?: string }>(rows: T[]): T[] {
  if (!Array.isArray(rows) || rows.length === 0) return rows;
  const m = new Map<string, T>();
  for (const r of rows) {
    m.set(getStableVoiceNoteListKey(r), r);
  }
  return Array.from(m.values());
}

/**
 * Misma visibilidad que GET /api/voice-notes?corpo_id=&puesto_id= (con puesto > 0):
 * misma sucursal y la nota es de ese puesto o a nivel sucursal (sin puesto).
 */
export function voiceNoteInPuestoFetchScope(
  vn: { corpo?: { id?: number }; puesto?: { id?: number } | null },
  corpoId: number,
  puestoId: number
): boolean {
  if (Number(vn?.corpo?.id) !== Number(corpoId)) return false;
  if (vn.puesto == null) return true;
  return Number(vn.puesto?.id) === Number(puestoId);
}

export function isPendingOfflineVoiceNoteCreate(vn: { id?: number; id_local?: string }): boolean {
  return Boolean(
    vn?.id_local &&
      String(vn.id_local) !== '' &&
      (!Number.isFinite(Number(vn.id)) || Number(vn.id) === 0)
  );
}

/**
 * Sustituye en caché las notas del alcance (corpo+puesto) por el API;
 * conserva borradores locales de ese alcance; filtra inactivas del API.
 */
export function mergeVoiceNotesCacheForPuestoScope(
  previous: any[],
  corpoId: number,
  puestoId: number,
  fromApi: any[]
): any[] {
  const prev = Array.isArray(previous) ? previous : [];
  const apiClean = filterVoiceNotesByActive(Array.isArray(fromApi) ? fromApi : []).map((r) => ({
    ...r,
    isActive: (r as any).isActive !== false,
  }));
  const rest = prev.filter(
    (v) =>
      !voiceNoteInPuestoFetchScope(v, corpoId, puestoId) || isPendingOfflineVoiceNoteCreate(v)
  );
  return dedupeVoiceNotesList([...rest, ...apiClean]);
}

export function filterVoiceNotesToPuestoFetchScope(
  cache: any[],
  corpoId: number,
  puestoId: number
): any[] {
  const arr = Array.isArray(cache) ? cache : [];
  return dedupeVoiceNotesList(
    arr.filter(
      (v) =>
        voiceNoteInPuestoFetchScope(v, corpoId, puestoId) &&
        (isPendingOfflineVoiceNoteCreate(v) || (v as { isActive?: boolean }).isActive !== false)
    )
  );
}
