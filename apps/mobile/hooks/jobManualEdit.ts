/**
 * Edición de un documento ya subido (pantalla «Documentos»): reglas del formulario, mensajes y armado de lo que se manda al servidor. Módulo puro, sin React
 * Native ni Expo. Todo este flujo requiere conexión: no hay acciones en cola ni sincronización (`apps/server/utils/documentos/edicion.ts` tiene las reglas
 * del lado del servidor, que son las que mandan).
 */
import { parseQuiz, quizChanged, serializeQuiz, type QuizConfig } from './jobManualQuiz';

export type EditableManual = {
  id: number;
  title: string;
  description: string;
  classification?: string | null;
  quiz?: string | null;
  version?: number;
  id_local?: string;
  synced?: boolean;
  isActive?: boolean;
};

/** Mismo criterio que los botones «Act. puestos» y «Act. empleados»: cualquier rol distinto de OPERATIVO. Además, el documento debe existir ya en el servidor. */
export function canEditManual(roleName: string | null | undefined, manual: Pick<EditableManual, 'id' | 'id_local' | 'synced' | 'isActive'>): boolean {
  if (roleName === 'OPERATIVO') return false;
  if (!(Number(manual.id) > 0)) return false;
  if (manual.id_local || manual.synced === false) return false; // creado sin conexión y aún no sincronizado: no existe en el servidor
  return manual.isActive !== false;
}

export const NEW_VERSION_QUESTION = '¿Los cambios suponen una nueva versión del documento?';
export const NEW_VERSION_WARNING_TITLE = 'Nueva versión del documento';

/** Advertencia que ve quien edita al elegir «Sí»: qué va a pasar con todos los usuarios vinculados. */
export function newVersionWarning(nextVersion: number): string {
  return (
    `Se publicará la versión ${nextVersion} del documento.\n\n` +
    'Todos los usuarios vinculados tendrán que volver a visualizarlo y a firmarlo, y recibirán una notificación. ' +
    'Las firmas y notas de la versión anterior se conservan con su versión.'
  );
}

export const QUIZ_FORCES_VERSION_NOTE =
  'Modificar el quiz requiere publicar una nueva versión del documento: así las respuestas ya dadas quedan ligadas al quiz original. Los usuarios vinculados tendrán que volver a visualizarlo, firmarlo y responder el quiz, y recibirán una notificación.';

export const OFFLINE_EDIT_MESSAGE = 'Editar un documento requiere conexión a internet. Conéctate e inténtalo de nuevo.';
export const DELETE_FILE_CONFIRM = 'Se borrará de inmediato y no se puede deshacer. ¿Eliminar este archivo?';

export type NewFilePayload = { type: 'image' | 'audio' | 'video' | 'document'; extension: string; original_name: string; file_base64: string };

export type EditForm = {
  title: string;
  description: string;
  /** '' = sin clasificar. */
  classification: string;
  quiz: QuizConfig;
  /** Lo que eligió el usuario en «¿Nueva versión?» (por defecto NO). */
  newVersion: boolean;
  newFilesCount: number;
};

export function formFromManual(manual: EditableManual): EditForm {
  return {
    title: manual.title ?? '',
    description: manual.description ?? '',
    classification: manual.classification ?? '',
    quiz: parseQuiz(manual.quiz),
    newVersion: false,
    newFilesCount: 0,
  };
}

export const isQuizModified = (manual: EditableManual, form: EditForm): boolean => quizChanged(manual.quiz, form.quiz);

/** Con el quiz modificado la nueva versión no es opcional. */
export const effectiveNewVersion = (manual: EditableManual, form: EditForm): boolean => form.newVersion || isQuizModified(manual, form);

export function validateEditForm(form: EditForm): string | null {
  if (!form.title.trim()) return 'El título es obligatorio';
  if (!form.description.trim()) return 'La descripción es obligatoria';
  return null;
}

/** Solo viaja lo que cambió; el servidor trata lo que no llega como «sin cambios». */
export function buildEditBody(params: { manual: EditableManual; form: EditForm; marcaId: number; files: NewFilePayload[] }): { body: Record<string, unknown>; hasChanges: boolean } {
  const { manual, form, marcaId, files } = params;
  const body: Record<string, unknown> = { marca_id: marcaId };
  let hasChanges = false;
  if (form.title.trim() !== String(manual.title ?? '').trim()) {
    body.title = form.title.trim();
    hasChanges = true;
  }
  if (form.description.trim() !== String(manual.description ?? '').trim()) {
    body.description = form.description.trim();
    hasChanges = true;
  }
  if (form.classification.trim() !== String(manual.classification ?? '').trim()) {
    body.classification = form.classification.trim() === '' ? null : form.classification.trim();
    hasChanges = true;
  }
  if (isQuizModified(manual, form)) {
    body.quiz = serializeQuiz(form.quiz);
    hasChanges = true;
  }
  if (files.length > 0) {
    body.newFiles = JSON.stringify(files);
    hasChanges = true;
  }
  if (effectiveNewVersion(manual, form)) {
    body.nueva_version = true;
    hasChanges = true; // publicar una versión nueva sin otros cambios también es válido: todos vuelven a firmar
  }
  return { body, hasChanges };
}

export type EditResponse = {
  status?: boolean;
  message?: string;
  code?: string;
  version?: number;
  version_cambio?: boolean;
  sin_cambios?: boolean;
  notificados?: { plazas: number; empleados: number; ok: boolean };
};

/** Mensaje para quien editó, según lo que respondió el servidor. */
export function describeEditResult(res: EditResponse): { title: string; message: string } {
  if (res.sin_cambios) return { title: 'Sin cambios', message: 'No hubo nada que actualizar.' };
  if (res.version_cambio) {
    const aviso = res.notificados && res.notificados.ok === false ? '\n\nNo se pudo enviar la notificación a los usuarios; avísales que deben volver a firmarlo.' : '\n\nLos usuarios vinculados recibieron una notificación.';
    return { title: 'Nueva versión publicada', message: `El documento está ahora en la versión ${res.version}.${aviso}` };
  }
  return { title: 'Documento actualizado', message: res.message || 'Los cambios se guardaron.' };
}
