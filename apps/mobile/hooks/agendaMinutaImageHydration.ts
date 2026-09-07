import { getFile } from '@/hooks/fileStorage';

export type AgendaMinutaImageRef = {
  localFileName?: string;
  extension?: string;
  original_name?: string;
  /** Compatibilidad con acciones ya en cola de antes de este cambio (base64 ya embebido). */
  file_base64?: string;
};

/**
 * Nunca se guarda base64 en AsyncStorage (ni en `evaluations_actions` ni en `evaluations_cache`):
 * `requestData.imagenes` solo lleva referencias a expo-file-system (`localFileName`). La
 * hidratación a base64 ocurre aquí, justo antes de enviar la petición (igual que
 * `checklistSupervisionEvaluationFiles.ts`/`hydrateChecklistEvaluationImagesForApi`), tanto para
 * el envío inmediato en línea como para la cola de sincronización en App.tsx, que llama a los
 * mismos `createAgendaMinuta`/`updateAgendaMinuta`.
 *
 * No muta `requestData` ni su array `imagenes`: el llamador (App.tsx) sigue necesitando los
 * `localFileName` originales después de la petición para borrar los archivos locales ya subidos.
 */
export async function hydrateAgendaMinutaRequestData<T extends { imagenes?: unknown }>(
  requestData: T
): Promise<T> {
  const rawImagenes = (requestData as any)?.imagenes;
  const refs = Array.isArray(rawImagenes) ? (rawImagenes as AgendaMinutaImageRef[]) : [];
  console.log(
    `[agendaMinutaImageHydration] requestData.imagenes: isArray=${Array.isArray(rawImagenes)} length=${refs.length}`
  );
  if (refs.length === 0) return requestData;

  const hydrated: { extension: string; file_base64: string; original_name?: string }[] = [];
  for (const ref of refs) {
    // Compatibilidad: una acción encolada por una versión anterior de este flujo pudo haber
    // quedado con base64 ya embebido (sin `localFileName`). No descartarla en silencio.
    const existingBase64 = String(ref?.file_base64 ?? '').trim();
    if (existingBase64) {
      console.log('[agendaMinutaImageHydration] ref ya traía file_base64 (acción antigua en cola), se usa tal cual');
      hydrated.push({
        extension: ref.extension || 'jpg',
        file_base64: existingBase64,
        original_name: ref.original_name,
      });
      continue;
    }

    const localFileName = String(ref?.localFileName ?? '').trim();
    if (!localFileName) {
      console.warn('[agendaMinutaImageHydration] ref sin localFileName ni file_base64, se omite:', ref);
      continue;
    }
    try {
      const { base64 } = await getFile(localFileName);
      console.log(
        `[agendaMinutaImageHydration] hidratada ${localFileName}: base64.length=${base64?.length ?? 0}`
      );
      hydrated.push({
        extension: ref.extension || 'jpg',
        file_base64: base64,
        original_name: ref.original_name,
      });
    } catch (e) {
      console.error(`[agendaMinutaImageHydration] fallo leyendo ${localFileName}:`, e);
      throw new Error(`Archivo local de imagen no encontrado: ${localFileName}`);
    }
  }

  console.log(`[agendaMinutaImageHydration] total imágenes hidratadas: ${hydrated.length}/${refs.length}`);
  return { ...requestData, imagenes: hydrated };
}

/** Extrae los `localFileName` de las referencias de imagen pendientes, para borrarlos tras subir. */
export function collectAgendaMinutaImageLocalFileNames(requestData: { imagenes?: unknown } | null | undefined): string[] {
  const refs = Array.isArray(requestData?.imagenes) ? (requestData!.imagenes as AgendaMinutaImageRef[]) : [];
  return refs
    .map((r) => String(r?.localFileName ?? '').trim())
    .filter((n) => n.length > 0);
}
