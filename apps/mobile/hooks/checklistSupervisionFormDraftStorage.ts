import AsyncStorage from '@react-native-async-storage/async-storage';
import { deleteFile, getLocalFileDisplayUri, saveFile } from '@/hooks/fileStorage';

/** Borrador local del formulario (no es cola de sync). */
export const CHECKLIST_SUPERVISION_FORM_DRAFT_KEY = 'checklist_supervision_form_draft';

/** Prefijo opcional para archivos creados exclusivamente por borrador (referencia). */
export const CHECKLIST_SUPERVISION_DRAFT_FILE_PREFIX = 'checklist_supervision_draft_';

const CHECKLIST_SUPERVISION_PHOTO_PREFIX = 'checklist_supervision';

function isDataImageValue(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false;
  const v = value.trim();
  return v.startsWith('data:image/') || (v.length > 100 && !v.startsWith('http') && !v.includes('/'));
}

function toDataUri(value: string): string {
  const v = value.trim();
  if (v.startsWith('data:image/')) return v;
  return `data:image/jpeg;base64,${v}`;
}

/**
 * Asegura que cada foto de la evaluación quede referenciada por `localFileName` en disco
 * (sin base64 en AsyncStorage). Idempotente si ya hay archivo local.
 */
export async function persistEvaluationPhotosForDraft(evaluation: unknown[]): Promise<{
  evaluation: unknown[];
  localFileNames: string[];
  persistedCount: number;
  missingCount: number;
}> {
  const names = new Set<string>();
  let persistedCount = 0;
  let missingCount = 0;

  const persistPhoto = async (photo: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const existingName = String(photo.localFileName ?? '').trim();
    if (existingName) {
      const uri = getLocalFileDisplayUri(existingName);
      if (uri) {
        names.add(existingName);
        return {
          ...photo,
          localFileName: existingName,
          value: undefined,
        };
      }
      missingCount += 1;
    }

    const rawValue = photo.value;
    if (isDataImageValue(rawValue)) {
      try {
        const stored = await saveFile({
          uri: toDataUri(rawValue),
          originalName: 'foto',
          extension: 'jpg',
          type: 'image',
          prefix: CHECKLIST_SUPERVISION_PHOTO_PREFIX,
        });
        names.add(stored);
        persistedCount += 1;
        return {
          ...photo,
          localFileName: stored,
          value: undefined,
        };
      } catch (e) {
        console.warn('[checklistSupervisionFormDraft] No se pudo persistir foto base64:', e);
      }
    }

    if (existingName) {
      names.add(existingName);
      return { ...photo, localFileName: existingName, value: undefined };
    }

    return {
      ...photo,
      value: isDataImageValue(rawValue) ? undefined : photo.value,
    };
  };

  const walkInput = async (input: Record<string, unknown>): Promise<Record<string, unknown>> => {
    if (String(input.type ?? '') !== 'photo') return input;

    const photosIn = Array.isArray(input.photos) ? input.photos : null;
    if (photosIn && photosIn.length > 0) {
      const photos: Record<string, unknown>[] = [];
      for (const p of photosIn) {
        if (p && typeof p === 'object') {
          photos.push(await persistPhoto(p as Record<string, unknown>));
        }
      }
      return {
        ...input,
        photos,
        value: '',
        localFileName: undefined,
      };
    }

    const legacy = await persistPhoto({
      id: `${String(input.id ?? 'photo')}-legacy`,
      value: input.value,
      file_name: input.file_name,
      localFileName: input.localFileName,
      imageOrientation: input.imageOrientation,
    });
    const hasLegacy =
      Boolean(String(legacy.localFileName ?? '').trim()) ||
      Boolean(String(legacy.file_name ?? '').trim()) ||
      isDataImageValue(legacy.value);

    return {
      ...input,
      photos: hasLegacy ? [legacy] : [],
      value: '',
      localFileName: undefined,
      file_name: undefined,
      imageOrientation: undefined,
    };
  };

  const sectionsIn = Array.isArray(evaluation) ? evaluation : [];
  const nextEvaluation: unknown[] = [];

  for (const section of sectionsIn) {
    if (!section || typeof section !== 'object') {
      nextEvaluation.push(section);
      continue;
    }
    const sec = section as Record<string, unknown>;
    const subsectionsIn = Array.isArray(sec.subsections) ? sec.subsections : [];
    const subsections: unknown[] = [];

    for (const subsection of subsectionsIn) {
      if (!subsection || typeof subsection !== 'object') {
        subsections.push(subsection);
        continue;
      }
      const sub = subsection as Record<string, unknown>;
      const inputsIn = Array.isArray(sub.inputs) ? sub.inputs : [];
      const inputs: unknown[] = [];
      for (const inp of inputsIn) {
        if (inp && typeof inp === 'object') {
          inputs.push(await walkInput(inp as Record<string, unknown>));
        } else {
          inputs.push(inp);
        }
      }
      subsections.push({ ...sub, inputs });
    }

    nextEvaluation.push({ ...sec, subsections });
  }

  return {
    evaluation: nextEvaluation,
    localFileNames: [...names],
    persistedCount,
    missingCount,
  };
}

/** Solo quita la meta del borrador; no borra archivos de expo-file-system. */
export async function removeChecklistSupervisionFormDraftMeta(): Promise<void> {
  await AsyncStorage.removeItem(CHECKLIST_SUPERVISION_FORM_DRAFT_KEY);
}

export type ChecklistSupervisionFormDraftHierarchy = {
  empresaId: number | null;
  clienteId: number | null;
  divisionId: number | null;
  contratoId: number | null;
  sucursalId: number | null;
  puestoId: number | null;
};

export type ChecklistSupervisionFormDraftEmpleado = {
  id: number;
  nombre: string;
  codigo: string;
};

export type ChecklistSupervisionFormDraftEditingRef = {
  id: number;
  id_local?: string;
};

export type ChecklistSupervisionFormDraft = {
  version: 1;
  savedAt: string;
  ownerEmpleadoId: number;
  mode: 'create' | 'edit';
  editingRef?: ChecklistSupervisionFormDraftEditingRef | null;
  fechaIso: string;
  horaInicioIso: string;
  horaFinIso: string;
  selectedEmpleado: ChecklistSupervisionFormDraftEmpleado | null;
  ejecutivoCuenta: string;
  evaluation: unknown[];
  firmaSupervisor: string;
  firmaResponsable: string;
  hierarchy: ChecklistSupervisionFormDraftHierarchy;
  articulos: unknown[];
  localFileNames: string[];
  isHierarchyHintVisible: boolean;
};

function emptyDraftFile(): ChecklistSupervisionFormDraft | null {
  return null;
}

export function collectLocalFileNamesFromEvaluation(evaluation: unknown[]): string[] {
  const names = new Set<string>();

  const walk = (obj: unknown): void => {
    if (obj == null || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      obj.forEach(walk);
      return;
    }
    const record = obj as Record<string, unknown>;
    if (typeof record.localFileName === 'string' && record.localFileName.trim()) {
      names.add(record.localFileName.trim());
    }
    if (Array.isArray(record.photos)) {
      for (const photo of record.photos) {
        if (photo && typeof photo === 'object') {
          const ln = String((photo as Record<string, unknown>).localFileName ?? '').trim();
          if (ln) names.add(ln);
        }
      }
    }
    for (const value of Object.values(record)) {
      if (value != null && typeof value === 'object') walk(value);
    }
  };

  walk(evaluation);
  return [...names];
}

export function collectLocalFileNamesFromArticulos(articulos: unknown[]): string[] {
  const names = new Set<string>();
  if (!Array.isArray(articulos)) return [];

  for (const art of articulos) {
    if (!art || typeof art !== 'object') continue;
    const files = (art as Record<string, unknown>).mantenimiento_files;
    if (!Array.isArray(files)) continue;
    for (const f of files) {
      if (!f || typeof f !== 'object') continue;
      const ln = String((f as Record<string, unknown>).localFileName ?? '').trim();
      if (ln) names.add(ln);
    }
  }
  return [...names];
}

export function collectChecklistFormDraftLocalFileNames(
  evaluation: unknown[],
  articulos: unknown[],
): string[] {
  const merged = new Set<string>([
    ...collectLocalFileNamesFromEvaluation(evaluation),
    ...collectLocalFileNamesFromArticulos(articulos),
  ]);
  return [...merged];
}

export async function loadChecklistSupervisionFormDraft(
  ownerEmpleadoId: number,
): Promise<ChecklistSupervisionFormDraft | null> {
  const ownerId = Number(ownerEmpleadoId);
  if (!Number.isFinite(ownerId) || ownerId <= 0) return emptyDraftFile();

  const raw = await AsyncStorage.getItem(CHECKLIST_SUPERVISION_FORM_DRAFT_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as ChecklistSupervisionFormDraft;
    if (!parsed || parsed.version !== 1) return null;
    if (Number(parsed.ownerEmpleadoId) !== ownerId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveChecklistSupervisionFormDraft(
  draft: ChecklistSupervisionFormDraft,
): Promise<void> {
  await AsyncStorage.setItem(CHECKLIST_SUPERVISION_FORM_DRAFT_KEY, JSON.stringify(draft));
}

export async function deleteChecklistSupervisionFormDraftFiles(
  fileNames: string[] | undefined | null,
): Promise<void> {
  if (!Array.isArray(fileNames)) return;
  const unique = [...new Set(fileNames.map((n) => String(n ?? '').trim()).filter(Boolean))];
  await Promise.all(
    unique.map(async (name) => {
      try {
        await deleteFile(name);
      } catch (e) {
        console.warn('[checklistSupervisionFormDraft] No se pudo borrar archivo:', name, e);
      }
    }),
  );
}

export async function clearChecklistSupervisionFormDraft(
  fileNames?: string[] | null,
): Promise<void> {
  let namesToDelete = fileNames ?? [];
  if (!namesToDelete.length) {
    try {
      const raw = await AsyncStorage.getItem(CHECKLIST_SUPERVISION_FORM_DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ChecklistSupervisionFormDraft;
        namesToDelete = Array.isArray(parsed?.localFileNames) ? parsed.localFileNames : [];
      }
    } catch {
      /* ignore */
    }
  }
  await deleteChecklistSupervisionFormDraftFiles(namesToDelete);
  await AsyncStorage.removeItem(CHECKLIST_SUPERVISION_FORM_DRAFT_KEY);
}

export async function hasChecklistSupervisionFormDraft(ownerEmpleadoId: number): Promise<boolean> {
  const draft = await loadChecklistSupervisionFormDraft(ownerEmpleadoId);
  return draft != null;
}
