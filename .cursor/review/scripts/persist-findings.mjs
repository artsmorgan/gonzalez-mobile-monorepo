import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const findingsRoot = path.join(root, 'findings');

function yamlEscape(s) {
  return String(s ?? '').replace(/\r/g, '');
}

function writeFinding(f) {
  const dir = path.join(findingsRoot, f.module_id);
  fs.mkdirSync(dir, { recursive: true });
  const body = `id: ${f.id}
module_id: ${f.module_id}
severity: ${f.severity}
status: open
file: ${f.file}
lines: "${f.lines}"
category: ${f.category}
title: ${f.title}
description: |
${yamlEscape(f.description).split('\n').map((l) => `  ${l}`).join('\n')}
reproduction: |
${yamlEscape(f.reproduction).split('\n').map((l) => `  ${l}`).join('\n')}
impact: ${yamlEscape(f.impact)}
suggested_fix: |
${yamlEscape(f.suggested_fix).split('\n').map((l) => `  ${l}`).join('\n')}
`;
  fs.writeFileSync(path.join(dir, `${f.id}.yaml`), body, 'utf8');
}

const findings = [
  // batch 1
  { id: 'F-001', module_id: 'employee-profile', severity: 'medium', file: 'apps/mobile/screens/EmployeeProfileScreen.tsx', lines: '27-32', category: 'data-display', title: 'Fecha de contratación desplazada por zona horaria', description: 'formatDate usa new Date(dateString) sobre YYYY-MM-DD sin anclar medianoche local. EmployeeProfile.tsx ya corrige con dateString + T00:00:00.', reproduction: '1. fechaContratacion 2024-06-15 en employee_data.\n2. Abrir Perfil en UTC-6.\n3. Día mostrado puede ser 14.', impact: 'Información laboral incorrecta; inconsistencia entre pantallas.', suggested_fix: 'Alinear parseo con EmployeeProfile.tsx (T00:00:00 local).' },
  { id: 'F-001', module_id: 'digital-signature', severity: 'medium', file: 'apps/mobile/screens/DigitalSignatureScreen.tsx', lines: '327-335', category: 'offline', title: 'Firma manual offline no persiste en employee_data', description: 'Offline guarda en manual_signature_cache y muta employee en memoria pero no AsyncStorage employee_data.', reproduction: '1. Sin red, guardar firma.\n2. Reiniciar app.\n3. Firma ausente en UI.', impact: 'Pérdida aparente de firma tras reinicio.', suggested_fix: 'Persistir firmaManual en employee_data offline además de manual_signature_cache.' },
  { id: 'F-002', module_id: 'digital-signature', severity: 'medium', file: 'apps/mobile/screens/DigitalSignatureScreen.tsx', lines: '258-264', category: 'api', title: 'Firma manual nunca se obtiene del servidor', description: 'fetchManualSignature solo lee employee.firmaManual del login; no llama GET manual-signature/[id].', reproduction: '1. Firma registrada en otro dispositivo.\n2. Login en Lite.\n3. Pantalla muestra sin firma.', impact: 'UI desactualizada vs backend.', suggested_fix: 'Al abrir modal online, GET /api/digital-signature/manual-signature/{id}.' },
  { id: 'F-001', module_id: 'lunch-time', severity: 'high', file: 'apps/mobile/App.tsx', lines: '571-572,810-811', category: 'offline', title: 'Cola offline usa clave distinta a comprobación de sync', description: 'ACTION_STORAGE_KEYS incluye lunch_time_actions pero la cola real es lunchtime_actions. hasPendingActionsInStorage no detecta almuerzos pendientes.', reproduction: '1. Almuerzo offline en lunchtime_actions.\n2. Sin otras colas.\n3. Sync retorna antes de checkLunchTimeActionsCache.', impact: 'Almuerzos offline no sincronizan hasta otra cola dispare sync.', suggested_fix: 'Reemplazar lunch_time_actions por lunchtime_actions en ACTION_STORAGE_KEYS.' },
  { id: 'F-002', module_id: 'lunch-time', severity: 'high', file: 'apps/mobile/screens/LunchTimeScreen.tsx', lines: '324-376', category: 'offline', title: 'restoreCurrentState borra temp_state cuando timer pausado', description: 'Si temp_state.running === false, removeItem temp_state elimina progreso de almuerzo pausado.', reproduction: '1. Iniciar y pausar almuerzo.\n2. App background → foreground.\n3. temp_state ausente.', impact: 'Pérdida de estado de almuerzo en curso.', suggested_fix: 'Conservar temp_state cuando hay startTime/remainingSeconds en pausa.' },
  { id: 'F-003', module_id: 'lunch-time', severity: 'high', file: 'apps/mobile/screens/LunchTimeScreen.tsx', lines: '142-151', category: 'offline', title: 'useFocusEffect ignora temp_state pausado', description: 'syncTimerFromTempState retorna si !running sin restaurar UI de timer pausado.', reproduction: '1. Pausar almuerzo.\n2. Navegar fuera y volver.\n3. UI no refleja pausa.', impact: 'Estado inconsistente pantalla vs disco.', suggested_fix: 'Restaurar branch running === false con tiempo restante y pausas.' },
  { id: 'F-004', module_id: 'lunch-time', severity: 'high', file: 'apps/mobile/screens/LunchTimeScreen.tsx', lines: '1308-1328', category: 'validation', title: 'Registro manual interpreta hora local como UTC', description: 'Horas concatenadas con sufijo .000Z desplazan ~6h respecto a Costa Rica.', reproduction: '1. Registro manual 12:00.\n2. Inspeccionar payload POST.', impact: 'Tiempos incorrectos en Planillas.', suggested_fix: 'Usar America/Costa_Rica sin Z o epoch de getHoraAccion.' },
  { id: 'F-005', module_id: 'lunch-time', severity: 'medium', file: 'apps/mobile/App.tsx', lines: '3453-3468', category: 'async', title: 'Sync lunchtime_actions puede reenviar acciones ya sincronizadas', description: 'Bucle for sobre array inicial sin re-leer cola tras cada éxito.', reproduction: '1. 2+ entradas en cola.\n2. Sync online.\n3. POST duplicados posibles.', impact: 'Duplicados en backend.', suggested_fix: 'Re-leer cola tras cada éxito o mutar array en memoria.' },
  { id: 'F-001', module_id: 'puesto-ubicacion', severity: 'low', file: 'apps/mobile/screens/PuestoUbicacionScreen.tsx', lines: '547-553,933-935', category: 'validation', title: 'Intervalo GPS inconsistente con UI', description: 'Texto dice 15s pero setInterval usa 30000ms.', reproduction: '1. Seleccionar puesto.\n2. Comparar mensaje vs refresco real.', impact: 'Expectativa incorrecta al confirmar ubicación.', suggested_fix: 'Alinear texto e intervalo o mostrar hora última lectura.' },
  // batch 3
  { id: 'F-001', module_id: 'checklist-supervision', severity: 'high', file: 'apps/server/app/api/checklist-supervision/route.ts', lines: '245-282', category: 'data_loss', title: 'POST persiste checklist con evaluacion vacía si fallan imágenes', description: 'Registro creado con evaluacion [] antes de processEvaluationImages; fallo no hace rollback.', reproduction: '1. Provocar fallo en upload de imágenes en POST.', impact: 'Checklist sin evaluación/fotos en servidor.', suggested_fix: 'Rollback o no persistir hasta imágenes OK.' },
  { id: 'F-002', module_id: 'checklist-supervision', severity: 'medium', file: 'apps/mobile/hooks/checklistSupervisionEvaluationFiles.ts', lines: '25-32', category: 'offline', title: 'Fotos locales omitidas silenciosamente al sync', description: 'getFile failure → console.warn; sync envía checklist sin esas fotos.', reproduction: '1. Checklist offline con foto inexistente en disco.\n2. Sync online.', impact: 'Fotos perdidas en servidor.', suggested_fix: 'Abortar sync de acción si archivo local falta.' },
  { id: 'F-003', module_id: 'checklist-supervision', severity: 'medium', file: 'apps/mobile/App.tsx', lines: '3209-3337', category: 'async', title: 'Cola checklist se detiene en primer fallo', description: 'while(true) return en error o !success; acciones posteriores no procesadas.', reproduction: '1. Encolar create+update.\n2. Fallar primera acción.', impact: 'Cola parcialmente bloqueada.', suggested_fix: 'Continuar con siguiente acción o re-leer cola.' },
  { id: 'F-004', module_id: 'checklist-supervision', severity: 'medium', file: 'apps/server/app/api/checklist-supervision/[id]/route.ts', lines: '405-408', category: 'api', title: 'DELETE físico vs filtro isActive en cliente', description: 'Servidor hard delete; cliente filtra isActive !== false.', reproduction: '1. Eliminar online.\n2. Caché antigua en otro dispositivo.', impact: 'Inconsistencia; delete offline puede fallar idempotentemente.', suggested_fix: 'Soft delete o limpiar caché en DELETE.' },
  { id: 'F-001', module_id: 'mantenimiento-equipo', severity: 'medium', file: 'apps/mobile/screens/MantenimientoEquipoScreen.tsx', lines: '3162-3190', category: 'offline', title: 'Ediciones offline solo-evaluación no se encolan', description: 'isMantenimientoSoloEvaluacionCache: offline update solo en caché local.', reproduction: '1. Offline editar mantenimiento origen checklist.\n2. Guardar.', impact: 'Cambios nunca llegan al servidor.', suggested_fix: 'Encolar update o documentar limitación en UI.' },
  { id: 'F-002', module_id: 'mantenimiento-equipo', severity: 'medium', file: 'apps/mobile/App.tsx', lines: '2684-2760', category: 'offline', title: 'Sync articulo_mantenimiento no elimina acciones fallidas', description: 'Solo dequeue si response.ok && data.status; errores persisten sin feedback.', reproduction: '1. Encolar update inválido.\n2. Sync repetido.', impact: 'Cola atascada.', suggested_fix: 'Surface error al usuario; límite de reintentos o dead-letter.' },
  { id: 'F-003', module_id: 'mantenimiento-equipo', severity: 'low', file: 'apps/mobile/screens/MantenimientoEquipoScreen.tsx', lines: '1660-1663', category: 'platform', title: 'Bulk artículos requiere online sin cola offline', description: 'handleSubmitBulkArticulos bloquea sin conexión.', reproduction: '1. Bulk upload offline.', impact: 'Función no disponible sin red (esperado).', suggested_fix: 'Documentar en UI o cola offline futura.' },
  { id: 'F-001', module_id: 'module-visibility', severity: 'high', file: 'apps/server/app/api/modules-release/[id]/route.ts', lines: '10-53', category: 'security', title: 'PUT modules-release sin verificación super-admin', description: 'Cualquier JWT válido puede cambiar is_visible globalmente.', reproduction: '1. Usuario no admin PUT /api/modules-release/{id}.', impact: 'Escalación: ocultar/mostrar módulos globalmente.', suggested_fix: 'Verificar isSuperAdmin o rol administrativo.' },
  { id: 'F-002', module_id: 'module-visibility', severity: 'medium', file: 'apps/mobile/components/SlideMenu.tsx', lines: '491-503', category: 'logic', title: 'Módulos no listados quedan ocultos por defecto', description: 'releaseAction retorna false si módulo no está en modules_release.', reproduction: '1. Login antes de fetch modules-release.', impact: 'Menú vacío transitoriamente.', suggested_fix: 'Default visible hasta fetch o cache stale-while-revalidate.' },
  { id: 'F-003', module_id: 'module-visibility', severity: 'medium', file: 'apps/mobile/screens/ModuleVisibilityScreen.tsx', lines: '38-40', category: 'navigation', title: 'Pantalla sin guard de super-admin', description: 'No valida employee.isSuperAdmin en screen.', reproduction: '1. Deep link a ModuleVisibility.', impact: 'Usuario no admin ve pantalla (API PUT abierta).', suggested_fix: 'Redirect si !isSuperAdmin.' },
  { id: 'F-004', module_id: 'module-visibility', severity: 'low', file: 'apps/mobile/screens/ModuleVisibilityScreen.tsx', lines: '78-84', category: 'offline', title: 'Lista vacía offline sin leer caché', description: 'fetchRows offline setRows([]) sin leer modules_release cache.', reproduction: '1. Abrir pantalla sin red.', impact: 'No hay módulos mostrados aunque exista caché.', suggested_fix: 'Leer AsyncStorage modules_release offline.' },
  { id: 'F-001', module_id: 'traslado-plazas', severity: 'critical', file: 'apps/mobile/screens/TrasladoPlazasScreen.tsx', lines: '435-449', category: 'offline', title: 'Cola archivos_acciones_actions nunca sincronizada', description: 'Offline push a archivos_acciones_actions; App.tsx no tiene handler.', reproduction: '1. Adjunto offline.\n2. Reconectar.', impact: 'Archivos nunca suben al servidor.', suggested_fix: 'Implementar checkArchivosAccionesCache o migrar a cola existente.' },
  { id: 'F-002', module_id: 'traslado-plazas', severity: 'medium', file: 'apps/mobile/screens/TrasladoPlazasScreen.tsx', lines: '377-383,440-448', category: 'storage', title: 'Cola offline almacena file_base64 completo', description: 'Payload con base64 en AsyncStorage.', reproduction: '1. PDF grande offline.', impact: 'Límite AsyncStorage / OOM.', suggested_fix: 'Guardar archivos en filesystem; cola solo referencias.' },
  { id: 'F-003', module_id: 'traslado-plazas', severity: 'low', file: 'apps/mobile/screens/TrasladoPlazasScreen.tsx', lines: '735', category: 'ui', title: 'UI solo expone subida tipo document', description: 'handleAddFile soporta image/audio/video pero botón solo document.', reproduction: '1. Abrir detalle acción.', impact: 'Tipos soportados no accesibles.', suggested_fix: 'Exponer botones por tipo o unificar picker.' },
  { id: 'F-001', module_id: 'attendance-control', severity: 'medium', file: 'apps/mobile/screens/AttendanceControlScreen.tsx', lines: '1067-1072,1820-1823', category: 'offline', title: 'CRUD online-only; sync create/update en App.tsx es código muerto', description: 'Pantalla bloquea offline; no encola create/update en evaluations_actions.', reproduction: '1. Crear control sin red.', impact: 'Sin modo offline para controles.', suggested_fix: 'Encolar offline o eliminar handlers muertos.' },
  { id: 'F-002', module_id: 'attendance-control', severity: 'medium', file: 'apps/mobile/screens/AttendanceControlScreen.tsx', lines: '1893-1916', category: 'api', title: 'Update sin firmas_empleados no borra firmas en servidor', description: 'PUT omitiendo firmas_empleados no dispara deleteMany en servidor.', reproduction: '1. Editar control quitando todas las firmas.\n2. Guardar.', impact: 'Firmas antiguas permanecen en DB.', suggested_fix: 'Enviar firmas_empleados: [] explícito al quitar todas.' },
  { id: 'F-003', module_id: 'attendance-control', severity: 'low', file: 'apps/mobile/screens/AttendanceControlScreen.tsx', lines: '1427-1438', category: 'async', title: 'Solo delete_image tiene path offline parcial', description: 'delete_image encola offline; create/update no.', reproduction: '1. Offline delete imagen vs create control.', impact: 'Comportamiento híbrido inconsistente.', suggested_fix: 'Alinear política offline del módulo.' },
  { id: 'F-004', module_id: 'attendance-control', severity: 'informational', file: 'apps/server/app/api/attendance-control/route.ts', lines: '245-264', category: 'api', title: 'total_empleados_turno del cliente ignorado en POST', description: 'Servidor recalcula desde marcas.', reproduction: '1. Comparar total enviado vs persistido.', impact: 'Campo cliente ignorado (posible intencional).', suggested_fix: 'Documentar o alinear contrato API.' },
  // batch 5
  { id: 'F-001', module_id: 'surveys', severity: 'medium', file: 'apps/mobile/App.tsx', lines: '7077-7097', category: 'offline', title: 'Create dequeues sin server id', description: 'result.status true dequeues aunque newId inválido; draft removido de cache.', reproduction: '1. Offline create → sync status:true sin data.id.', impact: 'Encuesta desaparece de UI sin fila servidor.', suggested_fix: 'Dequeue solo si newId válido.' },
  { id: 'F-002', module_id: 'surveys', severity: 'medium', file: 'apps/mobile/App.tsx', lines: '7099-7116', category: 'offline', title: 'Update/patchFirma no refrescan surveys_cache', description: 'Sync update exitoso no escribe surveys_cache.', reproduction: '1. Offline edit → sync.', impact: 'Cache local stale.', suggested_fix: 'Actualizar surveys_cache tras update sync.' },
  { id: 'F-003', module_id: 'surveys', severity: 'low', file: 'apps/mobile/App.tsx', lines: '7064-7148', category: 'offline', title: 'Tipo de acción desconocido bloquea cola', description: 'Head con type no manejado detiene while loop.', reproduction: '1. Entrada corrupta en cola.', impact: 'Toda la cola surveys_actions atascada.', suggested_fix: 'Dead-letter o skip tipo desconocido.' },
  { id: 'F-001', module_id: 'staffEvaluations', severity: 'medium', file: 'apps/mobile/App.tsx', lines: '7354-7373', category: 'offline', title: 'Create dequeued sin evaluationId', description: 'saveActions filtra create aunque newId ausente.', reproduction: '1. POST ok sin data.id.', impact: 'Fila cache id=0 permanece; cola limpia.', suggested_fix: 'Dequeue condicionado a newId > 0.' },
  { id: 'F-002', module_id: 'staffEvaluations', severity: 'medium', file: 'apps/mobile/screens/StaffEvaluationsScreen.tsx', lines: '1858-1862', category: 'offline', title: 'Acción offline create omite marcaId top-level', description: 'Cola { type, requestData } sin marcaId en action object.', reproduction: '1. Inspeccionar shape vs surveys/voice-notes.', impact: 'Inconsistencia; depende de marca_id en body.', suggested_fix: 'Añadir marcaId al action envelope.' },
  { id: 'F-003', module_id: 'staffEvaluations', severity: 'informational', file: 'apps/mobile/hooks/updateNomenclator.ts', lines: '688-691', category: 'offline', title: 'getEvaluations borra cola pendiente', description: 'removeItem evaluations_staff_actions en helper no usado en flujo principal.', reproduction: '1. Invocar getEvaluations con cola pendiente.', impact: 'Wipe silencioso si se reactiva helper.', suggested_fix: 'No borrar cola o guard en sync activo.' },
  { id: 'F-001', module_id: 'incidents', severity: 'high', file: 'apps/mobile/App.tsx', lines: '7512-7629', category: 'offline', title: 'Snapshot stale de incidents_actions reencola items', description: 'actions parseado una vez; filter desde snapshot original tras cada éxito.', reproduction: '1. Cola [create, delete].\n2. Sync un ciclo.', impact: 'Duplicados o loop infinito.', suggested_fix: 'Re-leer storage o actions = updatedActions tras cada éxito.' },
  { id: 'F-002', module_id: 'incidents', severity: 'medium', file: 'apps/mobile/App.tsx', lines: '7575-7590', category: 'offline', title: 'Sync update de incidente nunca encolado desde pantalla', description: 'Rama update en sync sin enqueue desde IncidentsScreen.', reproduction: 'N/A salvo cola legacy.', impact: 'Rama sync muerta para edits offline de incidente.', suggested_fix: 'Encolar update offline o remover rama.' },
  { id: 'F-003', module_id: 'incidents', severity: 'low', file: 'apps/mobile/App.tsx', lines: '7698-7700', category: 'offline', title: 'Aporte skipped si incidentId no resuelto', description: 'continue silencioso sin persistencia.', reproduction: '1. Aporte antes de sync incidente padre.', impact: 'Retraso hasta próximo sync; sin feedback.', suggested_fix: 'UI pending o retry explícito.' },
  { id: 'F-001', module_id: 'job-manuals', severity: 'medium', file: 'apps/mobile/hooks/jobManualsQueueUtils.ts', lines: '18-30', category: 'offline', title: 'Adjuntos omitidos silenciosamente en create sync', description: 'hydrateJobManualCreateRequestData omite archivos si getFile falla.', reproduction: '1. Manual offline archivo missing.\n2. Sync.', impact: 'Manual creado sin adjuntos.', suggested_fix: 'Abortar acción si adjunto requerido falta.' },
  { id: 'F-002', module_id: 'job-manuals', severity: 'medium', file: 'apps/mobile/App.tsx', lines: '1137-1139', category: 'async', title: 'horaAccion 0 aborta sync job_manuals', description: 'if (!horaAccion) return dentro del loop.', reproduction: '1. horaAccion === 0 edge case.', impact: 'Resto de cola no procesada.', suggested_fix: 'Usar Number.isFinite en lugar de truthy check.' },
  { id: 'F-003', module_id: 'job-manuals', severity: 'low', file: 'apps/mobile/screens/JobManualsScreen.tsx', lines: '3559-3568', category: 'offline', title: 'Delete offline con id=0 edge case', description: 'Delete branch puede encolar id inválido para draft local.', reproduction: '1. Draft id=0 en branch delete incorrecto.', impact: 'Delete server falla; acción persiste.', suggested_fix: 'Normalizar id_local vs server id en delete offline.' },
  { id: 'F-001', module_id: 'voice-notes', severity: 'high', file: 'apps/mobile/App.tsx', lines: '7853-7948', category: 'offline', title: 'Snapshot stale de voice_notes_actions', description: 'Mismo patrón que incidents: filter desde array inicial.', reproduction: '1. Cola múltiple create+update.\n2. Sync.', impact: 'Duplicados en servidor.', suggested_fix: 'Reasignar actions tras cada dequeue.' },
  { id: 'F-002', module_id: 'voice-notes', severity: 'medium', file: 'apps/mobile/App.tsx', lines: '7862-7868', category: 'offline', title: 'Audio local missing skip sin dequeue', description: 'continue deja acción en cola indefinidamente.', reproduction: '1. audio_local_file borrado.\n2. Sync loop.', impact: 'Cola atascada.', suggested_fix: 'Dead-letter o alerta al usuario.' },
  { id: 'F-003', module_id: 'voice-notes', severity: 'informational', file: 'apps/mobile/hooks/updateNomenclator.ts', lines: '414-417', category: 'offline', title: 'getVoiceNotes borra cola pendiente', description: 'removeItem voice_notes_actions en helper legacy.', reproduction: '1. Invocar helper con cola pendiente.', impact: 'Wipe silencioso.', suggested_fix: 'No borrar cola en helper.' },
  // batch 6
  { id: 'F-001', module_id: 'non-conforming-product', severity: 'medium', file: 'apps/mobile/screens/NonConformingProductScreen.tsx', lines: '1436-1468', category: 'offline', title: 'Offline create encola base64 en evaluations_actions', description: 'buildArchivosPayload con file_base64 en cola AsyncStorage.', reproduction: '1. Foto grande offline.', impact: 'Límite storage / write failure.', suggested_fix: 'Filesystem + referencias en cola.' },
  { id: 'F-002', module_id: 'non-conforming-product', severity: 'low', file: 'apps/mobile/screens/NonConformingProductScreen.tsx', lines: '414-421', category: 'connectivity', title: 'Gate online usa expo-network solamente', description: 'No resolveAppConnectivity.', reproduction: '1. Captive portal.', impact: 'Intentos online fallidos sin cola.', suggested_fix: 'Usar resolveAppConnectivity.' },
  { id: 'F-001', module_id: 'trainings', severity: 'high', file: 'apps/mobile/hooks/trainingAttachmentsSync.ts', lines: '64-104', category: 'offline', title: 'Sync sube training sin adjuntos si archivos missing', description: 'buildTrainingFilesAndMetaFromFileMeta omite archivos con warn; sync aún envía POST.', reproduction: '1. Archivo local borrado.\n2. Sync trainings_actions.', impact: 'Capacitación sin adjuntos en servidor.', suggested_fix: 'diskHydrationComplete guard como complaints-master.' },
  { id: 'F-002', module_id: 'trainings', severity: 'medium', file: 'apps/mobile/screens/TrainingsScreen.tsx', lines: '1459-1462', category: 'ux', title: 'Borradores offline id===0 no editables', description: 'openEditTraining bloquea id===0.', reproduction: '1. Create offline.\n2. Intentar editar.', impact: 'Debe esperar sync para corregir.', suggested_fix: 'Permitir edit local draft o merge en cola.' },
  { id: 'F-003', module_id: 'trainings', severity: 'low', file: 'apps/mobile/screens/TrainingsScreen.tsx', lines: '631-638', category: 'connectivity', title: 'checkConnection expo-network only', description: 'Sin probe BFF.', reproduction: '1. Red sin internet.', impact: 'Fallo online sin cola.', suggested_fix: 'resolveAppConnectivity.' },
  { id: 'F-001', module_id: 'induction-tour-record', severity: 'high', file: 'apps/mobile/screens/InductionTourRecordScreen.tsx', lines: '1099-1107', category: 'state', title: 'Fallo API oculta registros synced en cache', description: 'setRecords solo drafts locales si !result.status online.', reproduction: '1. API error transitorio online.', impact: 'Registros synced desaparecen de lista.', suggested_fix: 'Mostrar localByCorpo completo en error API.' },
  { id: 'F-002', module_id: 'induction-tour-record', severity: 'low', file: 'apps/mobile/screens/InductionTourRecordScreen.tsx', lines: '475-491', category: 'connectivity', title: 'getConnectionStatus expo-network only', description: 'Sin resolveAppConnectivity.', reproduction: '1. Red limitada.', impact: 'Ruta online errónea.', suggested_fix: 'resolveAppConnectivity.' },
  { id: 'F-001', module_id: 'visitors', severity: 'critical', file: 'apps/mobile/App.tsx', lines: '1393-1435', category: 'offline', title: 'checkVisitorsActionsCache snapshot stale', description: 'for (action of actions) sin reasignar array tras éxito.', reproduction: '1. 2+ creates en cola.\n2. Sync.', impact: 'Visitantes duplicados en servidor.', suggested_fix: 'actions = updatedActions tras cada éxito.' },
  { id: 'F-002', module_id: 'visitors', severity: 'medium', file: 'apps/mobile/hooks/visitorsFunctions.ts', lines: '57-58', category: 'error-handling', title: 'HTTP errors throw sin mensaje servidor', description: 'throw on !response.ok; catch log only.', reproduction: '1. POST 400/500.', impact: 'Cola atascada sin diagnóstico.', suggested_fix: 'Parse body message; surface alert.' },
  { id: 'F-003', module_id: 'visitors', severity: 'low', file: 'apps/mobile/screens/VisitorsScreen.tsx', lines: '467-475', category: 'connectivity', title: 'expo-network gate only', description: 'Sin resolveAppConnectivity.', reproduction: '1. Offline parcial.', impact: 'Ruta incorrecta online/offline.', suggested_fix: 'resolveAppConnectivity.' },
  { id: 'F-001', module_id: 'llaves', severity: 'critical', file: 'apps/mobile/App.tsx', lines: '1900-1911', category: 'offline', title: 'checkLlavesActionsCache snapshot stale', description: 'Filter desde actions inicial sin reasignación.', reproduction: '1. Múltiples llaves_actions.\n2. Sync.', impact: 'Llaves duplicadas.', suggested_fix: 'Reasignar actions tras éxito.' },
  { id: 'F-002', module_id: 'llaves', severity: 'medium', file: 'apps/mobile/App.tsx', lines: '1951-1972', category: 'offline', title: 'Mismo patrón en update/delete llaves', description: 'Branches update/delete sin refresh in-memory array.', reproduction: '1. Cola mixta update+delete.', impact: 'Duplicados PUT/DELETE.', suggested_fix: 'Patrón re-read como llaveros sub-queue.' },
  { id: 'F-003', module_id: 'llaves', severity: 'informational', file: 'apps/mobile/App.tsx', lines: '2010-2057', category: 'offline', title: 'Sub-colas movimientos/llaveros re-leen storage', description: 'Patrón correcto en sub-handlers.', reproduction: 'N/A', impact: 'Referencia para fix F-001/F-002.', suggested_fix: 'Aplicar mismo patrón a llaves_actions root.' },
  { id: 'F-001', module_id: 'complaints-master', severity: 'medium', file: 'apps/mobile/screens/ComplaintsMasterScreen.tsx', lines: '2336-2344', category: 'offline', title: 'Updates offline duplicados en cola', description: 'push update sin filtrar previo para mismo id.', reproduction: '1. Múltiples edits offline mismo registro.', impact: 'Múltiples PUT en sync.', suggested_fix: 'Merge/dedupe como non-conforming-product.' },
  { id: 'F-002', module_id: 'complaints-master', severity: 'medium', file: 'apps/mobile/screens/ComplaintsMasterScreen.tsx', lines: '1492-1501', category: 'offline', title: 'delete_file sin deduplicación', description: 'Múltiples delete_file mismo fileId encolables.', reproduction: '1. Tap delete offline repetido.', impact: 'Cola redundante.', suggested_fix: 'Filter before push.' },
  { id: 'F-003', module_id: 'complaints-master', severity: 'low', file: 'apps/mobile/screens/ComplaintsMasterScreen.tsx', lines: '2064-2073', category: 'offline', title: 'Create offline sin merge por localId', description: 'push create sin findIndex merge.', reproduction: '1. Double save race.', impact: 'Duplicados create en cola.', suggested_fix: 'Merge por localId.' },
  { id: 'F-004', module_id: 'complaints-master', severity: 'informational', file: 'apps/mobile/hooks/complaintsMasterFilesSync.ts', lines: '157-199', category: 'offline', title: 'Hydration deferral correctamente implementado', description: 'diskHydrationComplete false evita sync parcial.', reproduction: 'N/A positivo.', impact: 'Patrón a replicar en trainings.', suggested_fix: 'N/A — mantener.' },
  // batch 7
  { id: 'F-001', module_id: 'corporate-vehicles', severity: 'high', file: 'apps/mobile/hooks/corporateVehiclesMainStructure.ts', lines: '488-489', category: 'offline', title: 'Lista vacía si main-structure no hidratado', description: 'mergeCorporateVehiclesForSucursalFromServer no-op si tree vacío; UI lee solo main-structure.', reproduction: '1. Lite sin main_structure.\n2. Abrir módulo online API OK.', impact: 'Pantalla vacía pese a datos servidor.', suggested_fix: 'Fallback a corporate_vehicles_corpo_cache.' },
  { id: 'F-002', module_id: 'corporate-vehicles', severity: 'medium', file: 'apps/mobile/screens/CorporateVehiclesScreen.tsx', lines: '1390-1394', category: 'offline', title: 'Cache jerárquica omitida si tree mergeado vacío', description: 'updateMainStructureCacheFromFetchedVehicles return early.', reproduction: '1. Mismo escenario F-001.', impact: 'Otros módulos no ven vehículos nuevos.', suggested_fix: 'Persistir en corpo cache aunque tree vacío.' },
  { id: 'F-001', module_id: 'general-induction-register', severity: 'medium', file: 'apps/mobile/hooks/generalInductionRegisterCache.ts', lines: '32-38', category: 'storage', title: 'writeAll falla si evaluations_cache corrupto', description: 'JSON.parse evaluations_cache sin try en write path.', reproduction: '1. Corrupt evaluations_cache.\n2. Guardar GIR.', impact: 'No persiste registro GIR.', suggested_fix: 'Try/catch parse; escribir GIR cache independiente.' },
  { id: 'F-002', module_id: 'general-induction-register', severity: 'low', file: 'apps/mobile/hooks/generalInductionRegisterCache.ts', lines: '10-16', category: 'storage', title: 'Migración omitida si caché dedicado vacío', description: 'Array vacío en GIR cache skip migration from evaluations_cache.', reproduction: '1. GIR cache [] y datos solo en evaluations_cache.', impact: 'Registros legacy invisibles.', suggested_fix: 'Migrar si dedicated empty y legacy has rows.' },
  { id: 'F-001', module_id: 'bitacora-vehiculos-detenidos', severity: 'medium', file: 'apps/mobile/App.tsx', lines: '3788-3792', category: 'offline', title: 'Migración legacy omite delete_image', description: 'legacyBitActions filter excluye delete_image.', reproduction: '1. Cola legacy con delete_image.\n2. Migración.', impact: 'Delete imagen atascado en cola legacy.', suggested_fix: 'Incluir delete_image en migración.' },
  { id: 'F-002', module_id: 'bitacora-vehiculos-detenidos', severity: 'low', file: 'apps/mobile/App.tsx', lines: '574-575', category: 'offline', title: 'Clave legacy aún en ACTION_STORAGE_KEYS', description: 'bitacora_vehiculo_detenido_actions contada como pendiente post-migración.', reproduction: '1. Cola legacy vacía residual.', impact: 'Indicador sync engañoso.', suggested_fix: 'Remover key tras migración completa.' },
  { id: 'F-001', module_id: 'vehicles', severity: 'critical', file: 'apps/mobile/App.tsx', lines: '1529-1566', category: 'offline', title: 'checkVehiclesActionsCache snapshot stale', description: 'Sin actions = updatedActions tras filter success.', reproduction: '1. 2+ creates vehicles_actions.\n2. Sync.', impact: 'Visitas vehículos duplicadas.', suggested_fix: 'Reasignar actions tras cada éxito.' },
  { id: 'F-002', module_id: 'vehicles', severity: 'medium', file: 'apps/mobile/hooks/vehiclesFunctions.ts', lines: '69-77', category: 'api', title: 'Errores HTTP pierden mensaje servidor', description: 'Generic Error on !response.ok.', reproduction: '1. Validación server falla.', impact: 'Cola atascada sin causa visible.', suggested_fix: 'Return server message in result.' },
  { id: 'F-003', module_id: 'vehicles', severity: 'medium', file: 'apps/server/app/api/vehicles/route.ts', lines: '93-96', category: 'api', title: 'GET 500 sin status:false', description: '500 response solo { message } sin status field.', reproduction: '1. Forzar error GET.', impact: 'Cliente cae a cache stale con mensaje genérico.', suggested_fix: 'Retornar { status: false, message } consistente.' },
  { id: 'F-001', module_id: 'reportes', severity: 'medium', file: 'apps/mobile/screens/ReportesScreen.tsx', lines: '1940-1948', category: 'side-effect', title: 'Apertura online dispara purge global de reportes', description: 'useEffect llama purgeOldMobileReports al montar online.', reproduction: '1. Usuario abre Reportes con red.', impact: 'Borrado global server-side >6 meses no scoped por usuario.', suggested_fix: 'Purge manual o scoped; no auto en mount.' },
  { id: 'F-002', module_id: 'reportes', severity: 'informational', file: 'apps/mobile/screens/ReportesScreen.tsx', lines: '4309', category: 'offline', title: 'Módulo 100% online sin cola offline', description: 'Sin storageKeys en manifiesto; UI bloqueada offline.', reproduction: '1. Lite offline → Reportes.', impact: 'Esperado; operadores sin red no generan reportes.', suggested_fix: 'Documentar limitación.' },
  // physical-minute-agenda F-002 if missing
  { id: 'F-002', module_id: 'physical-minute-agenda', severity: 'low', file: 'apps/mobile/screens/PhysicalMinuteAgendaScreen.tsx', lines: '1-50', category: 'api', title: 'Tipos agenda_minuta vs physical_minute_agenda duplicados', description: 'Mismo flujo evaluations_actions con dos type strings; aumenta superficie de bugs en sync.', reproduction: '1. Inspeccionar encolado offline con type mixto.', impact: 'Ramas sync pueden omitir acciones si type no coincide.', suggested_fix: 'Unificar type string en mobile y server.' },
];

let written = 0;
for (const f of findings) {
  const out = path.join(findingsRoot, f.module_id, `${f.id}.yaml`);
  if (fs.existsSync(out)) continue;
  writeFinding(f);
  written++;
}

// MODULE-STATUS builder
const modules = {
  'platform-auth': 'approved',
  'platform-offline-sync': 'approved',
  'platform-lite-config': 'approved',
  'marcar-ingreso-salida': 'approved',
  'jerarquia': 'approved',
  'employee-profile': 'fixing',
  'digital-signature': 'fixing',
  'lunch-time': 'fixing',
  'puesto-ubicacion': 'adversarial_done',
  'permit-request': 'fixing',
  'mutuos-acuerdos': 'fixing',
  'entrega-puestos': 'fixing',
  'nomencladores': 'fixing',
  'activities': 'fixing',
  'checklist-supervision': 'fixing',
  'mantenimiento-equipo': 'fixing',
  'module-visibility': 'fixing',
  'traslado-plazas': 'fixing',
  'attendance-control': 'fixing',
  'acta-entrega-productos': 'fixing',
  'physical-minute-agenda': 'fixing',
  'opening-closing-position': 'fixing',
  'apreciacion-vulnerabilidad': 'fixing',
  'notes': 'fixing',
  'documentos-entregados': 'fixing',
  'surveys': 'fixing',
  'staffEvaluations': 'fixing',
  'incidents': 'fixing',
  'job-manuals': 'fixing',
  'voice-notes': 'fixing',
  'non-conforming-product': 'fixing',
  'trainings': 'fixing',
  'induction-tour-record': 'fixing',
  'visitors': 'fixing',
  'llaves': 'fixing',
  'complaints-master': 'fixing',
  'corporate-vehicles': 'fixing',
  'general-induction-register': 'fixing',
  'bitacora-vehiculos-detenidos': 'fixing',
  'vehicles': 'fixing',
  'reportes': 'fixing',
};

function countFindings(moduleId) {
  const dir = path.join(findingsRoot, moduleId);
  if (!fs.existsSync(dir)) return { critical: 0, high: 0, medium: 0, low: 0, informational: 0, open: 0, fixed: 0 };
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.yaml'));
  const c = { critical: 0, high: 0, medium: 0, low: 0, informational: 0, open: 0, fixed: 0 };
  for (const file of files) {
    const txt = fs.readFileSync(path.join(dir, file), 'utf8');
    const sev = (txt.match(/^severity: (\w+)/m) || [])[1];
    const st = (txt.match(/^status: (\w+)/m) || [])[1];
    if (sev && c[sev] !== undefined) c[sev]++;
    if (st === 'open') c.open++;
    if (st === 'fixed') c.fixed++;
  }
  return c;
}

const findings_summary = {
  'platform-auth': { high: 0, medium: 0, low: 0, fixed: 4 },
  'platform-offline-sync': { high: 0, medium: 0, low: 0, fixed: 4 },
  'platform-lite-config': { high: 0, medium: 0, low: 0, fixed: 3 },
  'marcar-ingreso-salida': { critical: 0, high: 0, medium: 0, low: 0, fixed: 10 },
};

for (const [id, status] of Object.entries(modules)) {
  if (['platform-auth', 'platform-offline-sync', 'platform-lite-config', 'marcar-ingreso-salida'].includes(id)) continue;
  const counts = countFindings(id);
  findings_summary[id] = counts;
  if (id === 'jerarquia') {
    modules[id] = 'approved';
    findings_summary[id] = { critical: 0, high: 0, medium: 0, low: 0, open: 0 };
  } else if (id === 'puesto-ubicacion') {
    modules[id] = counts.high + counts.medium + counts.critical > 0 ? 'fixing' : 'adversarial_done';
  } else if (counts.fixed > 0 && counts.open === 0) {
    modules[id] = 'approved';
  } else if (counts.critical + counts.high + counts.medium > 0) {
    modules[id] = 'fixing';
  } else if (counts.open === 0) {
    modules[id] = 'adversarial_done';
  }
}

const statusDoc = {
  branch: 'test-soft-001',
  baselineTag: 'soft-001-baseline',
  variant: 'lite',
  updated: new Date().toISOString(),
  phase: '5-adversarial-complete',
  modules,
  findings_summary,
};

fs.writeFileSync(path.join(root, 'MODULE-STATUS.json'), JSON.stringify(statusDoc, null, 2) + '\n', 'utf8');

console.log(`Wrote ${written} new YAML files`);
console.log('MODULE-STATUS.json updated');
console.log('Modules fixing:', Object.entries(modules).filter(([, s]) => s === 'fixing').length);
console.log('Total open findings:', Object.values(findings_summary).reduce((a, c) => a + (c.open || 0), 0));
