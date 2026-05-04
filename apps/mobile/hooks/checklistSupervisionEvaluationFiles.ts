import { getFile } from '@/hooks/fileStorage';

/**
 * Recorre el JSON de `evaluacion` y, por cada input `photo` con `localFileName`,
 * lee el archivo en disco y rellena `value` como data URL para el API (solo al enviar / sincronizar).
 * Elimina `localFileName` en la copia serializada.
 *
 * Recorrido profundo: no depende solo de `subsections`/`inputs` (por si el árbol difiere).
 */
export async function hydrateChecklistEvaluationImagesForApi(evaluacionJson: string): Promise<string> {
  let parsed: any;
  try {
    parsed = JSON.parse(evaluacionJson || '[]');
  } catch {
    return evaluacionJson;
  }
  if (!Array.isArray(parsed)) return evaluacionJson;

  async function walk(obj: any): Promise<void> {
    if (obj == null || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      for (const x of obj) await walk(x);
      return;
    }
    if (obj.type === 'photo' && obj.localFileName != null && String(obj.localFileName).trim() !== '') {
      try {
        const { base64 } = await getFile(String(obj.localFileName).trim());
        obj.value = `data:image/jpeg;base64,${base64}`;
        delete obj.localFileName;
      } catch (e) {
        console.warn('[checklistSupervisionEvaluationFiles] No se pudo leer foto local:', obj.localFileName, e);
      }
    }
    for (const k of Object.keys(obj)) {
      const v = (obj as any)[k];
      if (v != null && typeof v === 'object') await walk(v);
    }
  }

  await walk(parsed);
  return JSON.stringify(parsed);
}
