/** Configuración de módulos disponibles para reportes por puesto (variante mobile). */

export type ReportePuestoTipo = 'Individual' | 'Consolidado';

export type ReportePuestoModuloConfig = {
  value: string;
  label: string;
  tipos: ReportePuestoTipo[];
};

function padReportMeta2(n: number): string {
  return String(n).padStart(2, '0');
}

/** DDMMAAHHMMSS — día, mes, año (2 dígitos), hora, minutos, segundos. */
export function formatReportMetaTimestamp(at: Date = new Date()): string {
  const dd = padReportMeta2(at.getDate());
  const mm = padReportMeta2(at.getMonth() + 1);
  const aa = padReportMeta2(at.getFullYear() % 100);
  const hh = padReportMeta2(at.getHours());
  const mi = padReportMeta2(at.getMinutes());
  const ss = padReportMeta2(at.getSeconds());
  return `${dd}${mm}${aa}${hh}${mi}${ss}`;
}

export type PuestoReportMetaRange = {
  desde?: string | null;
  hasta?: string | null;
};

/** Metadatos auto-generados del reporte por puesto (misma convención que el formulario normal). */
export function buildPuestoReportMetaFields(
  puestoLabel: string,
  at: Date = new Date(),
  range?: PuestoReportMetaRange,
) {
  const label = String(puestoLabel || '').trim() || 'Sin puesto';
  const ts = formatReportMetaTimestamp(at);
  const desde = String(range?.desde || '').trim();
  const hasta = String(range?.hasta || '').trim();
  const rangePart =
    desde && hasta ? ` ${desde} a ${hasta}` : desde ? ` desde ${desde}` : hasta ? ` hasta ${hasta}` : '';
  return {
    nombre: `Reporte por puesto ${label}${rangePart} ${ts}`,
    numero: ts,
    nomenclatura: `Reporte por puesto ${label}${rangePart} ${ts}`,
    descripcion: `Reporte por puesto del puesto ${label}.${rangePart ? ` Rango:${rangePart}.` : ''}`,
  };
}

const EXCLUDED = new Set(['acciones_personales', 'ingresos_usuario', 'login_marca']);

/** Módulos con tipo forzado Consolidado en el formulario original. */
const FORZADO_CONSOLIDADO = new Set([
  'bitacora_novedades',
  'checklist_supervision',
  'evaluacion_personal',
  'manuales_puesto',
  'articulos_puesto',
  'mantenimiento_articulos',
  'registro_vehiculos_corporativos',
  'notas_voz',
  'cambios_ubicacion_puesto',
  'registro_capacitaciones',
  'tiempo_almuerzo',
]);

/** Módulos con picker Individual / Consolidado. */
const DESDE_PICKER = new Set([
  'acta_entrega_productos',
  'entrega_puesto',
  'agenda_minuta',
  'apertura_cierre_puesto',
  'apreciacion_vulnerabilidad',
  'actividades',
  'control_asistencia',
  'documentos_entregados',
  'encuesta_satisfaccion',
  'registro_visitas',
  'visitas_vehiculos',
  'mutuos_acuerdos',
  'incidentes',
  'llaves',
  'llaveros',
  'maestro_quejas',
  'producto_no_conforme',
  'registro_induccion_recorrido',
  'registro_induccion_general',
  'solicitudes_permiso',
  'revision_vehiculos',
]);

const MODULO_OPTIONS: { value: string; label: string }[] = [
  { value: 'acta_entrega_productos', label: 'Acta de entrega de productos' },
  { value: 'actividades', label: 'Actividades' },
  { value: 'articulos_puesto', label: 'Artículos del puesto' },
  { value: 'agenda_minuta', label: 'Agenda minuta' },
  { value: 'apertura_cierre_puesto', label: 'Apertura/Cierre de puesto' },
  { value: 'apreciacion_vulnerabilidad', label: 'Apreciación de vulnerabilidad' },
  { value: 'bitacora_novedades', label: 'Bitácora de novedades' },
  { value: 'cambios_ubicacion_puesto', label: 'Cambios en ubicación del puesto' },
  { value: 'checklist_supervision', label: 'Checklist de supervisión' },
  { value: 'control_asistencia', label: 'Control de asistencia' },
  { value: 'documentos_entregados', label: 'Documentos entregados' },
  { value: 'encuesta_satisfaccion', label: 'Encuestas de satisfacción' },
  { value: 'entrega_puesto', label: 'Entrega de puesto' },
  { value: 'evaluacion_personal', label: 'Evaluación de personal' },
  { value: 'incidentes', label: 'Incidentes' },
  { value: 'llaveros', label: 'Llaveros' },
  { value: 'llaves', label: 'Llaves' },
  { value: 'maestro_quejas', label: 'Maestro de quejas y reclamos' },
  { value: 'manuales_puesto', label: 'Manuales de puesto' },
  { value: 'mantenimiento_articulos', label: 'Mantenimiento de artículos' },
  { value: 'notas_voz', label: 'Notas de voz' },
  { value: 'mutuos_acuerdos', label: 'Mutuos acuerdos' },
  { value: 'producto_no_conforme', label: 'Producto no conforme' },
  { value: 'registro_induccion_recorrido', label: 'Registro de inducción y recorrido' },
  { value: 'registro_induccion_general', label: 'Registro de inducción general' },
  { value: 'registro_vehiculos_corporativos', label: 'Registro de vehículos' },
  { value: 'revision_vehiculos', label: 'Revisión de vehículos' },
  { value: 'registro_visitas', label: 'Personas' },
  { value: 'visitas_vehiculos', label: 'Visitas de vehículos' },
  { value: 'registro_capacitaciones', label: 'Registro de capacitaciones' },
  { value: 'solicitudes_permiso', label: 'Solicitudes de permiso' },
  { value: 'tiempo_almuerzo', label: 'Tiempo de almuerzo' },
].sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }));

function tiposForModulo(modulo: string): ReportePuestoTipo[] {
  if (FORZADO_CONSOLIDADO.has(modulo)) return ['Consolidado'];
  if (DESDE_PICKER.has(modulo)) return ['Individual', 'Consolidado'];
  return ['Consolidado'];
}

export const REPORTES_PUESTO_MODULOS: ReportePuestoModuloConfig[] = MODULO_OPTIONS.filter(
  (o) => !EXCLUDED.has(o.value),
).map((o) => ({
  ...o,
  tipos: tiposForModulo(o.value),
}));

export const REPORTES_PUESTO_MODULO_LABEL = new Map(REPORTES_PUESTO_MODULOS.map((m) => [m.value, m.label]));

export type ReportePuestoCheckboxState = Record<string, { Individual?: boolean; Consolidado?: boolean }>;

export function buildSelectionsFromCheckboxes(state: ReportePuestoCheckboxState): { modulo: string; tipo_reporte: ReportePuestoTipo }[] {
  const out: { modulo: string; tipo_reporte: ReportePuestoTipo }[] = [];
  for (const mod of REPORTES_PUESTO_MODULOS) {
    const sel = state[mod.value];
    if (!sel) continue;
    for (const tipo of mod.tipos) {
      if (sel[tipo]) out.push({ modulo: mod.value, tipo_reporte: tipo });
    }
  }
  return out;
}

export function createEmptyCheckboxState(): ReportePuestoCheckboxState {
  const state: ReportePuestoCheckboxState = {};
  for (const mod of REPORTES_PUESTO_MODULOS) {
    state[mod.value] = {};
    for (const tipo of mod.tipos) state[mod.value][tipo] = false;
  }
  return state;
}

export function setAllCheckboxes(checked: boolean): ReportePuestoCheckboxState {
  const state: ReportePuestoCheckboxState = {};
  for (const mod of REPORTES_PUESTO_MODULOS) {
    state[mod.value] = {};
    for (const tipo of mod.tipos) state[mod.value][tipo] = checked;
  }
  return state;
}
