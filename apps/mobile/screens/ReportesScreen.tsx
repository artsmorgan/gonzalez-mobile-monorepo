import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getDocumentTypes, getTiposProductoNoConforme, getIncidentsClassifications, getCategories, getTipoQuejas } from '../hooks/updateNomenclator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import * as Network from 'expo-network';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { jwtDecode } from 'jwt-decode';
import * as Location from 'expo-location';

import { useNavigation } from '@react-navigation/native';
import AppHeader from '../components/AppHeader';
import AppFooter from '../components/AppFooter';
import SlideMenu from '../components/SlideMenu';
import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import { useAuth } from '../contexts/AuthContext';
import getHoraAccion from '../hooks/getHoraAccion';
import { convertDateTimestampToLocalString } from '../hooks/convertDateTimestampToLocalString';
import { useQRScanner } from '../hooks/useQRScanner';
import getValidAccessTokenOrLogout from '../hooks/getValidAccessTokenOrLogout';
import {
  createReportJob,
  fetchReportesList,
  formatEmpleadoNombre,
  previewUserLoginRefreshTokens,
  previewActaEntregaProductos,
  previewAgendaMinuta,
  previewAperturaCierrePuesto,
  previewVulnerabilidad,
  previewActividades,
  previewControlAsistencia,
  previewDocumentosEntregados,
  previewEncuestaSatisfaccion,
  previewRegistroVisitas,
  previewMutuosAcuerdos,
  previewAccionesPersonales,
  previewEntregaPuesto,
  previewIncidentes,
  previewLlaves,
  previewLlaveros,
  previewBitacoraNovedades,
  previewMaestroQuejas,
  previewChecklistSupervision,
  previewEvaluacionPersonal,
  previewProductoNoConforme,
  previewInduccionRecorrido,
  previewManualesPuesto,
  searchActaStructure,
  searchEmployeesReportes,
  type EmpleadoLite,
  type StructureLite,
} from '../hooks/reportesFunctions';

/** Ms desde `getHoraAccion` o reloj local si falta servidor (mismo criterio que ActaEntregaProductosScreen). */
async function getHoraAccionSafeMs(): Promise<number> {
  try {
    const t = await getHoraAccion();
    return typeof t === 'number' && Number.isFinite(t) ? t : Date.now();
  } catch {
    return Date.now();
  }
}

function epochMsToIsoSafe(ms: number): string {
  if (!Number.isFinite(ms)) return new Date().toISOString();
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  try {
    return d.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

const MODULO_INGRESOS = 'ingresos_usuario';
const MODULO_ACTA_ENTREGA = 'acta_entrega_productos';
/** Registros `e_registro_entrega_puesto` (SEG-F-023, Excel consolidado/individual). */
const MODULO_ENTREGA_PUESTO = 'entrega_puesto';
const MODULO_AGENDA_MINUTA = 'agenda_minuta';
const MODULO_APERTURA_CIERRE = 'apertura_cierre_puesto';
const MODULO_VULNERABILIDAD = 'apreciacion_vulnerabilidad';
const MODULO_ACTIVIDADES = 'actividades';
const MODULO_CONTROL_ASISTENCIA = 'control_asistencia';
const MODULO_DOCUMENTOS_ENTREGADOS = 'documentos_entregados';
/** Tabla `c_encuesta_cliente`. */
const MODULO_ENCUESTA_SATISFACCION = 'encuesta_satisfaccion';
/** Listado: «Acciones personales»; formulario de creación: «Archivos de acciones» (mismo módulo). */
const MODULO_ACCIONES_PERSONALES = 'acciones_personales';
const MODULO_INCIDENTES = 'incidentes';
const MODULO_LLAVES = 'llaves';
const MODULO_LLAVEROS = 'llaveros';
const MODULO_BITACORA_NOVEDADES = 'bitacora_novedades';
const MODULO_MAESTRO_QUEJAS = 'maestro_quejas';
const MODULO_CHECKLIST_SUPERVISION = 'checklist_supervision';
/** Tabla `e_mutuos_acuerdos`. */
const MODULO_MUTUOS_ACUERDOS = 'mutuos_acuerdos';
/** Tabla `c_evaluacion_empleado` (solo Excel consolidado). */
const MODULO_EVALUACION_PERSONAL = 'evaluacion_personal';
/** Tabla `c_producto_no_conforme`. */
const MODULO_PRODUCTO_NO_CONFORME = 'producto_no_conforme';
/** Tabla `c_registro_induccion_recorrido`. */
const MODULO_REGISTRO_INDUCCION_RECORRIDO = 'registro_induccion_recorrido';
/** Manuales de puesto (`e_manual_puesto`), solo Excel consolidado. */
const MODULO_MANUALES_PUESTO = 'manuales_puesto';
/** `e_registro_personas` / `e_activo_visitante`. */
const MODULO_REGISTRO_VISITAS = 'registro_visitas';

/** Opciones del selector «Módulo» (listado y formulario), ordenadas alfabéticamente por etiqueta. */
const MODULO_PICKER_OPTIONS: { value: string; label: string }[] = [
  { value: MODULO_ACCIONES_PERSONALES, label: 'Acciones de personal' },
  { value: MODULO_ACTA_ENTREGA, label: 'Acta de entrega de productos' },
  { value: MODULO_ACTIVIDADES, label: 'Actividades' },
  { value: MODULO_AGENDA_MINUTA, label: 'Agenda minuta' },
  { value: MODULO_APERTURA_CIERRE, label: 'Apertura/Cierre de puesto' },
  { value: MODULO_VULNERABILIDAD, label: 'Apreciación de vulnerabilidad' },
  { value: MODULO_BITACORA_NOVEDADES, label: 'Bitácora de novedades' },
  { value: MODULO_CHECKLIST_SUPERVISION, label: 'Checklist de supervisión' },
  { value: MODULO_CONTROL_ASISTENCIA, label: 'Control de asistencia' },
  { value: MODULO_DOCUMENTOS_ENTREGADOS, label: 'Documentos entregados' },
  { value: MODULO_ENCUESTA_SATISFACCION, label: 'Encuestas de satisfacción' },
  { value: MODULO_ENTREGA_PUESTO, label: 'Entrega de puesto' },
  { value: MODULO_EVALUACION_PERSONAL, label: 'Evaluación de personal' },
  { value: MODULO_INCIDENTES, label: 'Incidentes' },
  { value: MODULO_INGRESOS, label: 'Ingresos de usuario' },
  { value: MODULO_LLAVEROS, label: 'Llaveros' },
  { value: MODULO_LLAVES, label: 'Llaves' },
  { value: MODULO_MAESTRO_QUEJAS, label: 'Maestro de quejas y reclamos' },
  { value: MODULO_MANUALES_PUESTO, label: 'Manuales de puesto' },
  { value: MODULO_MUTUOS_ACUERDOS, label: 'Mutuos acuerdos' },
  { value: MODULO_PRODUCTO_NO_CONFORME, label: 'Producto no conforme' },
  { value: MODULO_REGISTRO_INDUCCION_RECORRIDO, label: 'Registro de inducción y recorrido' },
  { value: MODULO_REGISTRO_VISITAS, label: 'Registro de visitas' },
].sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }));

const ORDER_OPTIONS: { value: string; label: string }[] = [
  { value: 'nombre_usuario', label: 'Nombre de usuario' },
  { value: 'token', label: 'Token' },
  { value: 'createdAt', label: 'Creado en' },
  { value: 'expiresAt', label: 'Expirado en' },
  { value: 'sessionId', label: 'Id de sesión' },
];

const ORDER_OPTIONS_ACTA: { value: string; label: string }[] = [
  { value: 'empresa_id', label: 'Empresa' },
  { value: 'cliente_id', label: 'Cliente' },
  { value: 'division_id', label: 'División' },
  { value: 'contrato_id', label: 'Contrato' },
  { value: 'corpo_id', label: 'Sucursal' },
  { value: 'puesto_id', label: 'Puesto' },
  { value: 'fecha', label: 'Fecha' },
  { value: 'nombre_entrega', label: 'Nombre de quien entrega' },
  { value: 'cedula_entrega', label: 'Cédula de quien entrega' },
  { value: 'nombre_recibe', label: 'Nombre de quien recibe' },
  { value: 'cedula_recibe', label: 'Cédula de quien recibe' },
];

const ORDER_OPTIONS_AGENDA: { value: string; label: string }[] = [
  { value: 'empresa_id', label: 'Empresa' },
  { value: 'cliente_id', label: 'Cliente' },
  { value: 'division_id', label: 'División' },
  { value: 'contrato_id', label: 'Contrato' },
  { value: 'corpo_id', label: 'Sucursal' },
  { value: 'puesto_id', label: 'Puesto' },
  { value: 'fecha', label: 'Fecha' },
];

const ORDER_OPTIONS_APERTURA_CIERRE: { value: string; label: string }[] = [
  { value: 'created_by', label: 'Creador' },
  { value: 'empresa_id', label: 'Empresa' },
  { value: 'cliente_id', label: 'Cliente' },
  { value: 'division_id', label: 'División' },
  { value: 'contrato_id', label: 'Contrato' },
  { value: 'corpo_id', label: 'Sucursal' },
  { value: 'puesto_id', label: 'Puesto' },
  { value: 'fecha', label: 'Fecha' },
];

const ORDER_OPTIONS_VULNERABILIDAD: { value: string; label: string }[] = [
  { value: 'empresa_id', label: 'Empresa' },
  { value: 'cliente_id', label: 'Cliente' },
  { value: 'division_id', label: 'División' },
  { value: 'contrato_id', label: 'Contrato' },
  { value: 'corpo_id', label: 'Sucursal' },
  { value: 'puesto_id', label: 'Puesto' },
  { value: 'fecha', label: 'Fecha' },
];

const ORDER_OPTIONS_ACTIVIDADES: { value: string; label: string }[] = [
  { value: 'fecha', label: 'Fecha' },
  { value: 'nombre_actividad', label: 'Título' },
];
const ORDER_OPTIONS_CONTROL_ASISTENCIA: { value: string; label: string }[] = [
  { value: 'empresa_id', label: 'Empresa' },
  { value: 'cliente_id', label: 'Cliente' },
  { value: 'division_id', label: 'División' },
  { value: 'contrato_id', label: 'Contrato' },
  { value: 'corpo_id', label: 'Sucursal' },
  { value: 'puesto_id', label: 'Puesto' },
  { value: 'fecha', label: 'Fecha' },
];
const ORDER_OPTIONS_DOCUMENTOS: { value: string; label: string }[] = [
  { value: 'empresa_id', label: 'Empresa' },
  { value: 'cliente_id', label: 'Cliente' },
  { value: 'division_id', label: 'División' },
  { value: 'contrato_id', label: 'Contrato' },
  { value: 'corpo_id', label: 'Sucursal' },
  { value: 'puesto_id', label: 'Puesto' },
  { value: 'fecha', label: 'Fecha' },
  { value: 'tipo_documento', label: 'Tipo de documento' },
  { value: 'nombre_oficial_entrega', label: 'Nombre oficial entrega' },
  { value: 'nombre_oficial_recibe', label: 'Nombre oficial recibe' },
];

const ORDER_OPTIONS_ENCUESTA_SATISFACCION: { value: string; label: string }[] = [
  { value: 'empresa_id', label: 'Empresa' },
  { value: 'cliente_id', label: 'Cliente' },
  { value: 'division_id', label: 'División' },
  { value: 'contrato_id', label: 'Contrato' },
  { value: 'corpo_id', label: 'Sucursal' },
  { value: 'puesto_id', label: 'Puesto' },
  { value: 'fecha', label: 'Fecha' },
];

const ORDER_OPTIONS_REGISTRO_VISITAS: { value: string; label: string }[] = [
  { value: 'empresa_id', label: 'Empresa' },
  { value: 'cliente_id', label: 'Cliente' },
  { value: 'division_id', label: 'División' },
  { value: 'contrato_id', label: 'Contrato' },
  { value: 'corpo_id', label: 'Sucursal' },
  { value: 'puesto_id', label: 'Puesto' },
  { value: 'created_at', label: 'Fecha' },
  { value: 'nombre', label: 'Visitante' },
];

const ORDER_OPTIONS_ACCIONES_PERSONALES: { value: string; label: string }[] = [
  { value: 'empleado_id', label: 'Creado por…' },
  { value: 'empresa_id', label: 'Empresa' },
  { value: 'cliente_id', label: 'Cliente' },
  { value: 'division_id', label: 'División' },
  { value: 'contrato_id', label: 'Contrato' },
  { value: 'corpo_id', label: 'Sucursal' },
  { value: 'puesto_id', label: 'Puesto' },
  { value: 'plaza_id', label: 'Plaza' },
];
const ORDER_OPTIONS_INCIDENTES: { value: string; label: string }[] = [
  { value: 'created_at', label: 'Creado en' },
  { value: 'empresa_id', label: 'Empresa' },
  { value: 'cliente_id', label: 'Cliente' },
  { value: 'division_id', label: 'División' },
  { value: 'contrato_id', label: 'Contrato' },
  { value: 'corpo_id', label: 'Sucursal' },
  { value: 'puesto_id', label: 'Puesto' },
];
const ORDER_OPTIONS_LLAVES: { value: string; label: string }[] = [
  { value: 'empresa_id', label: 'Empresa' },
  { value: 'cliente_id', label: 'Cliente' },
  { value: 'division_id', label: 'División' },
  { value: 'contrato_id', label: 'Contrato' },
  { value: 'corpo_id', label: 'Sucursal' },
  { value: 'puesto_id', label: 'Puesto' },
  { value: 'created_at', label: 'Fecha' },
];

const ORDER_OPTIONS_BITACORA_NOVEDADES: { value: string; label: string }[] = [
  { value: 'titulo', label: 'Título' },
  { value: 'empresa_id', label: 'Empresa' },
  { value: 'cliente_id', label: 'Cliente' },
  { value: 'division_id', label: 'División' },
  { value: 'contrato_id', label: 'Contrato' },
  { value: 'corpo_id', label: 'Sucursal' },
  { value: 'puesto_id', label: 'Puesto' },
  { value: 'updated_at', label: 'Fecha' },
];

const ORDER_OPTIONS_MAESTRO_QUEJAS: { value: string; label: string }[] = [
  { value: 'empresa_id', label: 'Empresa' },
  { value: 'cliente_id', label: 'Cliente' },
  { value: 'division_id', label: 'División' },
  { value: 'contrato_id', label: 'Contrato' },
  { value: 'corpo_id', label: 'Sucursal' },
  { value: 'puesto_id', label: 'Puesto' },
  { value: 'fecha_queja', label: 'Fecha' },
];

const ORDER_OPTIONS_CHECKLIST_SUPERVISION: { value: string; label: string }[] = [
  { value: 'empresa_id', label: 'Empresa' },
  { value: 'cliente_id', label: 'Cliente' },
  { value: 'division_id', label: 'División' },
  { value: 'contrato_id', label: 'Contrato' },
  { value: 'corpo_id', label: 'Sucursal' },
  { value: 'puesto_id', label: 'Puesto' },
  { value: 'fecha', label: 'Fecha' },
];

const ORDER_OPTIONS_MUTUOS_ACUERDOS: { value: string; label: string }[] = [
  { value: 'empresa_id', label: 'Empresa' },
  { value: 'cliente_id', label: 'Cliente' },
  { value: 'division_id', label: 'División' },
  { value: 'contrato_id', label: 'Contrato' },
  { value: 'corpo_id', label: 'Sucursal' },
  { value: 'puesto_id', label: 'Puesto' },
  { value: 'created_at', label: 'Fecha' },
];

const ORDER_OPTIONS_EVALUACION_PERSONAL: { value: string; label: string }[] = [
  { value: 'empresa_id', label: 'Empresa' },
  { value: 'cliente_id', label: 'Cliente' },
  { value: 'division_id', label: 'División' },
  { value: 'contrato_id', label: 'Contrato' },
  { value: 'corpo_id', label: 'Sucursal' },
  { value: 'puesto_id', label: 'Puesto' },
  { value: 'created_at', label: 'Fecha' },
];

const ORDER_OPTIONS_PRODUCTO_NO_CONFORME: { value: string; label: string }[] = [
  { value: 'empresa_id', label: 'Empresa' },
  { value: 'cliente_id', label: 'Cliente' },
  { value: 'division_id', label: 'División' },
  { value: 'contrato_id', label: 'Contrato' },
  { value: 'corpo_id', label: 'Sucursal' },
  { value: 'puesto_id', label: 'Puesto' },
  { value: 'fecha_identificacion', label: 'Fecha' },
  { value: 'tipo_servicio_no_conforme', label: 'Tipo de documento' },
];

const ORDER_OPTIONS_INDUCCION_RECORRIDO: { value: string; label: string }[] = [
  { value: 'empresa_id', label: 'Empresa' },
  { value: 'cliente_id', label: 'Cliente' },
  { value: 'division_id', label: 'División' },
  { value: 'contrato_id', label: 'Contrato' },
  { value: 'corpo_id', label: 'Sucursal' },
  { value: 'puesto_id', label: 'Puesto' },
  { value: 'created_at', label: 'Fecha' },
];

const ORDER_OPTIONS_MANUALES_PUESTO: { value: string; label: string }[] = [
  { value: 'title', label: 'Título' },
  { value: 'created_at', label: 'Fecha' },
];

function parseTipoQuejasCatalogoFromCache(raw: string | null): { id: number; nombre: string }[] {
  if (raw == null || String(raw).trim() === '') return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: { id: number; nombre: string }[] = [];
    for (const x of parsed) {
      if (x == null || typeof x !== 'object') continue;
      const o = x as Record<string, unknown>;
      const id = Number(o.id);
      const nombre = o.nombre != null ? String(o.nombre).trim() : '';
      if (!Number.isFinite(id) || nombre === '') continue;
      out.push({ id, nombre });
    }
    return out;
  } catch {
    return [];
  }
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function hm(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function ymdOkStr(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '').trim());
}

function hmOkStr(s: string): boolean {
  return /^\d{2}:\d{2}$/.test(String(s || '').trim());
}

function parseYmdToLocalDate(ymdStr: string): Date {
  if (!ymdOkStr(ymdStr)) return new Date(2000, 0, 1, 12, 0, 0, 0);
  const [y, m, d] = ymdStr.split('-').map((x) => parseInt(x, 10));
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

/** ISO desde solo-fecha (mediodía local), alineado con ActaEntregaProductosScreen. */
function dateOnlyToIsoString(d: Date): string {
  if (!d || Number.isNaN(d.getTime())) return epochMsToIsoSafe(Date.now());
  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate();
  return new Date(y, m, day, 12, 0, 0, 0).toISOString();
}

function formatDateOnlyLabel(d: Date, fallbackLabel = '—'): string {
  if (!d || Number.isNaN(d.getTime())) return fallbackLabel;
  try {
    return convertDateTimestampToLocalString(dateOnlyToIsoString(d), false);
  } catch {
    return fallbackLabel;
  }
}

/** Muestra `YYYY-MM-DD` guardado como DD-MM-AAAA (sin usar ese formato en la UI de botones). */
function formatStoredYmdString(ymdStr: string, fallback = 'Elegir fecha'): string {
  const s = String(ymdStr || '').trim();
  if (!ymdOkStr(s)) return fallback;
  try {
    return convertDateTimestampToLocalString(dateOnlyToIsoString(parseYmdToLocalDate(s)), false);
  } catch {
    return fallback;
  }
}

function parseHmToLocalDate(hmStr: string): Date {
  const t = String(hmStr || '').trim();
  const [h, m] = t.split(':').map((x) => parseInt(x, 10));
  const base = new Date(2000, 0, 1, 0, 0, 0, 0);
  base.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
  return base;
}

type ModalEpPickerSlot =
  | 'fee_ymd'
  | 'fse_ymd'
  | 'fer_ymd'
  | 'fsr_ymd'
  | 'hee_hm'
  | 'hse_hm'
  | 'her_hm'
  | 'hsr_hm';
type IncidentPickerSlot =
  | 'list_sol_desde_ymd'
  | 'list_sol_desde_hm'
  | 'list_sol_hasta_ymd'
  | 'list_sol_hasta_hm'
  | 'list_real_desde_ymd'
  | 'list_real_desde_hm'
  | 'list_real_hasta_ymd'
  | 'list_real_hasta_hm'
  | 'modal_sol_desde_ymd'
  | 'modal_sol_desde_hm'
  | 'modal_sol_hasta_ymd'
  | 'modal_sol_hasta_hm'
  | 'modal_real_desde_ymd'
  | 'modal_real_desde_hm'
  | 'modal_real_hasta_ymd'
  | 'modal_real_hasta_hm';

/** Combina fecha y hora en un solo string sin conversiones de zona. */
function combineDateAndTime(dateStr: string, timeStr: string): string {
  const t = timeStr.trim();
  const ts = t.includes(':') && t.split(':').length === 2 ? `${t}:00` : t;
  return `${dateStr.trim()}T${ts}`;
}

function decodeFirmaHash(hash?: string | null) {
  try {
    if (!hash || String(hash).trim().length === 0) return null;
    const decoded = atob(String(hash));
    const parts = decoded.split(':');
    if (parts.length !== 5) return null;
    const [sessionId, empleadoId, latitud, longitud, timestamp] = parts;
    return { sessionId, empleadoId, latitud, longitud, timestamp };
  } catch {
    return null;
  }
}

function formatFirmaTimestamp(ts: string) {
  const n = Number(ts);
  if (!Number.isFinite(n)) return String(ts);
  let ms = n;
  if (n > 0 && n < 1e12) ms = n * 1000;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return String(ts);
  try {
    return convertDateTimestampToLocalString(d.toISOString()) || String(ts);
  } catch {
    return String(ts);
  }
}

/** Etiqueta legible para `created_at` del listado (ISO o epoch). */
function formatReportCreatedAt(raw: string | null | undefined): string {
  const s = String(raw ?? '').trim();
  if (!s) return '—';
  const n = Number(s);
  if (Number.isFinite(n) && n > 0) {
    const ms = n < 1e12 ? n * 1000 : n;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) {
      try {
        return convertDateTimestampToLocalString(d.toISOString()) || s;
      } catch {
        return s;
      }
    }
  }
  try {
    return convertDateTimestampToLocalString(s) || s;
  } catch {
    return s;
  }
}

function formatStructureLite(item: StructureLite): string {
  const left = item.codigo || item.numero;
  return left ? `${left} — ${item.nombre}` : item.nombre;
}

function signatureUri(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (s.startsWith('data:image/')) return s;
  return `data:image/png;base64,${s}`;
}

type ReportRow = {
  id: number;
  nombre: string;
  numero: string;
  nomenclatura: string;
  descripcion: string | null;
  modulo: string;
  tipo_reporte: string;
  created_by: number;
  estado: string;
  filters: string;
  order_by: string;
  firma_responsable: string;
  created_at: string;
};

type DocumentTypeLite = { id: number; nombre: string };
type IncidentClassificationLite = { id: number; nombre: string };

export default function ReportesScreen() {
  const navigation = useNavigation();
  const { employee, refreshAccessToken, logout, accessToken } = useAuth();
  const [queryAccessToken, setQueryAccessToken] = useState('');
  const refreshQueryAccessToken = useCallback(async () => {
    try {
      const t = await getValidAccessTokenOrLogout({ refreshAccessToken, logout });
      setQueryAccessToken(t != null && String(t).trim() !== '' ? String(t).trim() : '');
    } catch {
      setQueryAccessToken('');
    }
  }, [refreshAccessToken, logout]);

  useEffect(() => {
    void refreshQueryAccessToken();
  }, [accessToken, refreshQueryAccessToken]);

  useEffect(() => {
    const loadDocumentTypesCache = async () => {
      try {
        console.log('loadDocumentTypesCache');
        await getDocumentTypes(refreshAccessToken, logout);
        const documentTypes = await AsyncStorage.getItem('document_types_cache');
        if (documentTypes) {
          setDocumentTypesCache(JSON.parse(documentTypes));
        }
      } catch {
        setDocumentTypesCache([]);  
      }
    };
    void loadDocumentTypesCache();
  }, []);

  useEffect(() => {
    const loadPncTiposCache = async () => {
      try {
        await getTiposProductoNoConforme(refreshAccessToken, logout);
        const cached = await AsyncStorage.getItem('tipos_producto_no_conforme_cache');
        if (!cached) return;
        const parsed = JSON.parse(cached);
        if (!Array.isArray(parsed)) return;
        const rows = parsed
          .map((x: any) => ({ id: Number(x?.id), nombre: String(x?.nombre ?? '').trim() }))
          .filter((x: { id: number; nombre: string }) => Number.isFinite(x.id) && x.id > 0 && x.nombre !== '');
        setPncTiposCache(rows);
      } catch {
        setPncTiposCache([]);
      }
    };
    void loadPncTiposCache();
  }, []);

  useEffect(() => {
    const loadIncidentsClassificationsCache = async () => {
      try {
        await getIncidentsClassifications(refreshAccessToken, logout);
        const cached = await AsyncStorage.getItem('incidents_classifications_cache');
        if (!cached) return;
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          const rows = parsed
            .map((x: any) => ({ id: Number(x?.id), nombre: String(x?.nombre ?? x?.name ?? '').trim() }))
            .filter((x: IncidentClassificationLite) => Number.isFinite(x.id) && x.id > 0 && x.nombre !== '');
          setIncClasificacionesCache(rows);
        }
      } catch {
        setIncClasificacionesCache([]);
      }
    };
    void loadIncidentsClassificationsCache();
  }, []);

  /** Igual que ChecklistSupervisionScreen: token en query para abrir archivos bajo `/uploads`. */
  const appendTokenToUrl = useCallback(
    (url: string) => {
      if (!url) return '';
      const fromContext = accessToken != null ? String(accessToken).trim() : '';
      const fromRefresh = queryAccessToken.trim();
      const token = fromContext || fromRefresh;
      if (!token) return url;
      if (/[?&]token=/.test(url)) return url;
      const sep = url.includes('?') ? '&' : '?';
      return `${url}${sep}token=${encodeURIComponent(token)}`;
    },
    [accessToken, queryAccessToken],
  );

  /** Fecha ancla para selectores (hora servidor vía `getHoraAccion`, como ActaEntregaProductosScreen). */
  const [horaAccionPickerBase, setHoraAccionPickerBase] = useState(() => new Date());
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ms = await getHoraAccionSafeMs();
      if (!cancelled) setHoraAccionPickerBase(new Date(ms));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const [isMenuVisible, setIsMenuVisible] = useState(false);

  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [listBnvCategoriaId, setListBnvCategoriaId] = useState<string>('todos');
  const [listBnvRelevancia, setListBnvRelevancia] = useState<'todos' | 'Alta' | 'Media' | 'Baja'>('todos');
  const [listMqMedioRecepcion, setListMqMedioRecepcion] = useState<string>('todos');
  const [listMqTipoQueja, setListMqTipoQueja] = useState<string>('todos');
  const [listMqNivelQueja, setListMqNivelQueja] = useState<string>('todos');

  const resetListFilters = useCallback(() => {
    setModulo(MODULO_INGRESOS);
    setNombreBusqueda('');
    setNumeroBusqueda('');
    setNomenclaturaBusqueda('');
    setDescripcionBusqueda('');
    setTipoReporteBusqueda('');
    setEstadoBusqueda('');
    setFechaInicio(null);
    setFechaFin(null);
    setCreatorSearch('');
    setCreatorResults([]);
    setCreatorSelected([]);
    setListCreadoDesdeD(null);
    setListCreadoDesdeT(null);
    setListCreadoHastaD(null);
    setListCreadoHastaT(null);
    setListUsuarioIngresoSelected([]);
    setListUsuarioSearch('');
    setListUsuarioResults([]);
    setListSoloMultiDispositivo(false);
    setListActaDesdeD(null);
    setListActaDesdeT(null);
    setListActaHastaD(null);
    setListActaHastaT(null);
    setListEmpresaSelected([]);
    setListClienteSelected([]);
    setListDivisionSelected([]);
    setListContratoSelected([]);
    setListCorpoSelected([]);
    setListPuestoSelected([]);
    setListLlaveroSelected([]);
    setListEmpresaSearch('');
    setListClienteSearch('');
    setListDivisionSearch('');
    setListContratoSearch('');
    setListCorpoSearch('');
    setListPuestoSearch('');
    setListLlaveroSearch('');
    setListEmpresaResults([]);
    setListClienteResults([]);
    setListDivisionResults([]);
    setListContratoResults([]);
    setListCorpoResults([]);
    setListPuestoResults([]);
    setListLlaveroResults([]);
    setListAgendaEstado('todos');
    setListAcpTipo('todos');
    setListAsisTurno('todos');
    setListDocTipo('todos');
    setListEncResponsableSearch('');
    setListEncResponsableResults([]);
    setListEncResponsableSelected([]);
    setListRvCedulaVisitante('');
    setListRvTipoVisitante('todos');
    setListRvResponsableSearch('');
    setListRvResponsableResults([]);
    setListRvResponsableSelected([]);
    setListIncSolDesdeD(null);
    setListIncSolDesdeT(null);
    setListIncSolHastaD(null);
    setListIncSolHastaT(null);
    setListIncRealDesdeD(null);
    setListIncRealDesdeT(null);
    setListIncRealHastaD(null);
    setListIncRealHastaT(null);
    setListIncClasificacion('todos');
    setListIncEstado('todos');
    setListLlvEntregadoPor('');
    setListLlvRecibidoPor('');
    setListLlrEntregadoPor('');
    setListLlrRecibidoPor('');
    setIncidentListPicker(null);
    setListAccEmpleadoSearch('');
    setListAccEmpleadoResults([]);
    setListAccEmpleadoSelected([]);
    setListAccPlazaSearch('');
    setListAccPlazaResults([]);
    setListAccPlazaSelected([]);
    setListBnvCategoriaId('todos');
    setListBnvRelevancia('todos');
    setListMqMedioRecepcion('todos');
    setListMqTipoQueja('todos');
    setListMqNivelQueja('todos');
    setListPncTipoServicio('todos');
    setListIrResponsableSearch('');
    setListIrResponsableResults([]);
    setListIrResponsableSelected([]);
    setListIrEmpleadoSearch('');
    setListIrEmpleadoResults([]);
    setListIrEmpleadoSelected([]);
    setListIrParticipanteSearch('');
    setListIrParticipanteCedulas([]);
    setListFechaRepDesdeD(null);
    setListFechaRepDesdeT(null);
    setListFechaRepHastaD(null);
    setListFechaRepHastaT(null);
    setListEjecutivoSearch('');
    setListEjecutivoResults([]);
    setListEjecutivoSelected([]);
    setListMutEstado('todos');
    setShowListFrDd(false);
    setShowListFrDt(false);
    setShowListFrHd(false);
    setShowListFrHt(false);
  }, []);

  const [modulo, setModulo] = useState(MODULO_INGRESOS);
  const [nombreBusqueda, setNombreBusqueda] = useState('');
  const [numeroBusqueda, setNumeroBusqueda] = useState('');
  const [nomenclaturaBusqueda, setNomenclaturaBusqueda] = useState('');
  const [descripcionBusqueda, setDescripcionBusqueda] = useState('');
  const [tipoReporteBusqueda, setTipoReporteBusqueda] = useState('');
  const [estadoBusqueda, setEstadoBusqueda] = useState('');
  const [fechaInicio, setFechaInicio] = useState<Date | null>(null);
  const [fechaFin, setFechaFin] = useState<Date | null>(null);
  const [showFi, setShowFi] = useState(false);
  const [showFf, setShowFf] = useState(false);

  const [creatorSearch, setCreatorSearch] = useState('');
  const [creatorResults, setCreatorResults] = useState<EmpleadoLite[]>([]);
  const [creatorSelected, setCreatorSelected] = useState<EmpleadoLite[]>([]);

  const [listCreadoDesdeD, setListCreadoDesdeD] = useState<Date | null>(null);
  const [listCreadoDesdeT, setListCreadoDesdeT] = useState<Date | null>(null);
  const [listCreadoHastaD, setListCreadoHastaD] = useState<Date | null>(null);
  const [listCreadoHastaT, setListCreadoHastaT] = useState<Date | null>(null);
  const [listUsuarioIngresoSelected, setListUsuarioIngresoSelected] = useState<EmpleadoLite[]>([]);
  const [listUsuarioSearch, setListUsuarioSearch] = useState('');
  const [listUsuarioResults, setListUsuarioResults] = useState<EmpleadoLite[]>([]);
  const [listSoloMultiDispositivo, setListSoloMultiDispositivo] = useState(false);
  const [listActaDesdeD, setListActaDesdeD] = useState<Date | null>(null);
  const [listActaDesdeT, setListActaDesdeT] = useState<Date | null>(null);
  const [listActaHastaD, setListActaHastaD] = useState<Date | null>(null);
  const [listActaHastaT, setListActaHastaT] = useState<Date | null>(null);
  const [listEmpresaSearch, setListEmpresaSearch] = useState('');
  const [listClienteSearch, setListClienteSearch] = useState('');
  const [listDivisionSearch, setListDivisionSearch] = useState('');
  const [listContratoSearch, setListContratoSearch] = useState('');
  const [listCorpoSearch, setListCorpoSearch] = useState('');
  const [listPuestoSearch, setListPuestoSearch] = useState('');
  const [listLlaveroSearch, setListLlaveroSearch] = useState('');
  const [listEmpresaResults, setListEmpresaResults] = useState<StructureLite[]>([]);
  const [listClienteResults, setListClienteResults] = useState<StructureLite[]>([]);
  const [listDivisionResults, setListDivisionResults] = useState<StructureLite[]>([]);
  const [listContratoResults, setListContratoResults] = useState<StructureLite[]>([]);
  const [listCorpoResults, setListCorpoResults] = useState<StructureLite[]>([]);
  const [listPuestoResults, setListPuestoResults] = useState<StructureLite[]>([]);
  const [listLlaveroResults, setListLlaveroResults] = useState<StructureLite[]>([]);
  const [listEmpresaSelected, setListEmpresaSelected] = useState<StructureLite[]>([]);
  const [listClienteSelected, setListClienteSelected] = useState<StructureLite[]>([]);
  const [listDivisionSelected, setListDivisionSelected] = useState<StructureLite[]>([]);
  const [listContratoSelected, setListContratoSelected] = useState<StructureLite[]>([]);
  const [listCorpoSelected, setListCorpoSelected] = useState<StructureLite[]>([]);
  const [listPuestoSelected, setListPuestoSelected] = useState<StructureLite[]>([]);
  const [listLlaveroSelected, setListLlaveroSelected] = useState<StructureLite[]>([]);
  const [listAgendaEstado, setListAgendaEstado] = useState<'todos' | 'completado' | 'pendiente'>('todos');
  const [listAcpTipo, setListAcpTipo] = useState<'todos' | 'apertura' | 'cierre'>('todos');
  const [listAsisTurno, setListAsisTurno] = useState<'todos' | 'D' | 'M' | 'N'>('todos');
  const [listDocTipo, setListDocTipo] = useState<string>('todos');
  const [listEncResponsableSearch, setListEncResponsableSearch] = useState('');
  const [listEncResponsableResults, setListEncResponsableResults] = useState<EmpleadoLite[]>([]);
  const [listEncResponsableSelected, setListEncResponsableSelected] = useState<EmpleadoLite[]>([]);
  const [listRvCedulaVisitante, setListRvCedulaVisitante] = useState('');
  const [listRvTipoVisitante, setListRvTipoVisitante] = useState<'todos' | 'normal' | 'funcionario'>('todos');
  const [listRvResponsableSearch, setListRvResponsableSearch] = useState('');
  const [listRvResponsableResults, setListRvResponsableResults] = useState<EmpleadoLite[]>([]);
  const [listRvResponsableSelected, setListRvResponsableSelected] = useState<EmpleadoLite[]>([]);
  const [listMutAusenteSearch, setListMutAusenteSearch] = useState('');
  const [listMutAusenteResults, setListMutAusenteResults] = useState<EmpleadoLite[]>([]);
  const [listMutAusenteSelected, setListMutAusenteSelected] = useState<EmpleadoLite[]>([]);
  const [listMutReemplazaSearch, setListMutReemplazaSearch] = useState('');
  const [listMutReemplazaResults, setListMutReemplazaResults] = useState<EmpleadoLite[]>([]);
  const [listMutReemplazaSelected, setListMutReemplazaSelected] = useState<EmpleadoLite[]>([]);
  const [listMutEjecutivoSearch, setListMutEjecutivoSearch] = useState('');
  const [listMutEjecutivoResults, setListMutEjecutivoResults] = useState<StructureLite[]>([]);
  const [listMutEjecutivoSelected, setListMutEjecutivoSelected] = useState<StructureLite[]>([]);
  const [listMutEstado, setListMutEstado] = useState<'todos' | 'aprobado' | 'rechazado' | 'pendiente'>('todos');
  const [listEvpEmpEvalSearch, setListEvpEmpEvalSearch] = useState('');
  const [listEvpEmpEvalResults, setListEvpEmpEvalResults] = useState<EmpleadoLite[]>([]);
  const [listEvpEmpEvalSelected, setListEvpEmpEvalSelected] = useState<EmpleadoLite[]>([]);
  const [listEvpEvaluadorSearch, setListEvpEvaluadorSearch] = useState('');
  const [listEvpEvaluadorResults, setListEvpEvaluadorResults] = useState<EmpleadoLite[]>([]);
  const [listEvpEvaluadorSelected, setListEvpEvaluadorSelected] = useState<EmpleadoLite[]>([]);
  const [listEvpTipoEvaluacion, setListEvpTipoEvaluacion] = useState<'todos' | 'Seguridad' | 'Aseo & limpieza' | 'Otros'>('todos');
  const [listPncTipoServicio, setListPncTipoServicio] = useState<string>('todos');
  const [listIrResponsableSearch, setListIrResponsableSearch] = useState('');
  const [listIrResponsableResults, setListIrResponsableResults] = useState<EmpleadoLite[]>([]);
  const [listIrResponsableSelected, setListIrResponsableSelected] = useState<EmpleadoLite[]>([]);
  const [listIrEmpleadoSearch, setListIrEmpleadoSearch] = useState('');
  const [listIrEmpleadoResults, setListIrEmpleadoResults] = useState<EmpleadoLite[]>([]);
  const [listIrEmpleadoSelected, setListIrEmpleadoSelected] = useState<EmpleadoLite[]>([]);
  const [listIrParticipanteSearch, setListIrParticipanteSearch] = useState('');
  const [listIrParticipanteCedulas, setListIrParticipanteCedulas] = useState<string[]>([]);
  const [pncTiposCache, setPncTiposCache] = useState<{ id: number; nombre: string }[]>([]);
  const [listIncSolDesdeD, setListIncSolDesdeD] = useState<Date | null>(null);
  const [listIncSolDesdeT, setListIncSolDesdeT] = useState<Date | null>(null);
  const [listIncSolHastaD, setListIncSolHastaD] = useState<Date | null>(null);
  const [listIncSolHastaT, setListIncSolHastaT] = useState<Date | null>(null);
  const [listIncRealDesdeD, setListIncRealDesdeD] = useState<Date | null>(null);
  const [listIncRealDesdeT, setListIncRealDesdeT] = useState<Date | null>(null);
  const [listIncRealHastaD, setListIncRealHastaD] = useState<Date | null>(null);
  const [listIncRealHastaT, setListIncRealHastaT] = useState<Date | null>(null);
  const [listIncClasificacion, setListIncClasificacion] = useState<string>('todos');
  const [listIncEstado, setListIncEstado] = useState<'todos' | 'solucionado' | 'no_solucionado'>('todos');
  const [listLlvEntregadoPor, setListLlvEntregadoPor] = useState('');
  const [listLlvRecibidoPor, setListLlvRecibidoPor] = useState('');
  const [listLlrEntregadoPor, setListLlrEntregadoPor] = useState('');
  const [listLlrRecibidoPor, setListLlrRecibidoPor] = useState('');
  const [listAccEmpleadoSearch, setListAccEmpleadoSearch] = useState('');
  const [listAccEmpleadoResults, setListAccEmpleadoResults] = useState<EmpleadoLite[]>([]);
  const [listAccEmpleadoSelected, setListAccEmpleadoSelected] = useState<EmpleadoLite[]>([]);
  const [listAccPlazaSearch, setListAccPlazaSearch] = useState('');
  const [listAccPlazaResults, setListAccPlazaResults] = useState<StructureLite[]>([]);
  const [listAccPlazaSelected, setListAccPlazaSelected] = useState<StructureLite[]>([]);
  const [modalAccEmpleadoSearch, setModalAccEmpleadoSearch] = useState('');
  const [modalAccEmpleadoResults, setModalAccEmpleadoResults] = useState<EmpleadoLite[]>([]);
  const [modalAccEmpleadoSelected, setModalAccEmpleadoSelected] = useState<EmpleadoLite[]>([]);
  const [modalAccPlazaSearch, setModalAccPlazaSearch] = useState('');
  const [modalAccPlazaResults, setModalAccPlazaResults] = useState<StructureLite[]>([]);
  const [modalAccPlazaSelected, setModalAccPlazaSelected] = useState<StructureLite[]>([]);
  const [isCreatorUsersExpanded, setIsCreatorUsersExpanded] = useState(true);
  const [isListIngresoExpanded, setIsListIngresoExpanded] = useState(true);

  const [loadingList, setLoadingList] = useState(false);
  const [reportes, setReportes] = useState<ReportRow[]>([]);
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});

  const [modalVisible, setModalVisible] = useState(false);
  const [formNombre, setFormNombre] = useState('');
  const [formNumero, setFormNumero] = useState('');
  const [formNomenclatura, setFormNomenclatura] = useState('');
  const [formDescripcion, setFormDescripcion] = useState('');
  const [formModulo, setFormModulo] = useState(MODULO_INGRESOS);
  const [formOrder, setFormOrder] = useState('nombre_usuario');
  const [formTipoReporte, setFormTipoReporte] = useState<'Consolidado' | 'Individual'>('Consolidado');
  const [modalDesdeD, setModalDesdeD] = useState<Date | null>(null);
  const [modalDesdeT, setModalDesdeT] = useState<Date | null>(null);
  const [modalHastaD, setModalHastaD] = useState<Date | null>(null);
  const [modalHastaT, setModalHastaT] = useState<Date | null>(null);
  const [modalUsuariosSelected, setModalUsuariosSelected] = useState<EmpleadoLite[]>([]);
  const [modalUsuarioSearch, setModalUsuarioSearch] = useState('');
  const [modalUsuarioResults, setModalUsuarioResults] = useState<EmpleadoLite[]>([]);
  const [isModalIngresoExpanded, setIsModalIngresoExpanded] = useState(true);
  const [modalMultiDevice, setModalMultiDevice] = useState(false);
  const [modalActaDesdeD, setModalActaDesdeD] = useState<Date | null>(null);
  const [modalActaDesdeT, setModalActaDesdeT] = useState<Date | null>(null);
  const [modalActaHastaD, setModalActaHastaD] = useState<Date | null>(null);
  const [modalActaHastaT, setModalActaHastaT] = useState<Date | null>(null);
  const [modalEmpresaSearch, setModalEmpresaSearch] = useState('');
  const [modalClienteSearch, setModalClienteSearch] = useState('');
  const [modalDivisionSearch, setModalDivisionSearch] = useState('');
  const [modalContratoSearch, setModalContratoSearch] = useState('');
  const [modalCorpoSearch, setModalCorpoSearch] = useState('');
  const [modalPuestoSearch, setModalPuestoSearch] = useState('');
  const [modalLlaveroSearch, setModalLlaveroSearch] = useState('');
  const [modalEmpresaResults, setModalEmpresaResults] = useState<StructureLite[]>([]);
  const [modalClienteResults, setModalClienteResults] = useState<StructureLite[]>([]);
  const [modalDivisionResults, setModalDivisionResults] = useState<StructureLite[]>([]);
  const [modalContratoResults, setModalContratoResults] = useState<StructureLite[]>([]);
  const [modalCorpoResults, setModalCorpoResults] = useState<StructureLite[]>([]);
  const [modalPuestoResults, setModalPuestoResults] = useState<StructureLite[]>([]);
  const [modalLlaveroResults, setModalLlaveroResults] = useState<StructureLite[]>([]);
  const [modalEmpresaSelected, setModalEmpresaSelected] = useState<StructureLite[]>([]);
  const [modalClienteSelected, setModalClienteSelected] = useState<StructureLite[]>([]);
  const [modalDivisionSelected, setModalDivisionSelected] = useState<StructureLite[]>([]);
  const [modalContratoSelected, setModalContratoSelected] = useState<StructureLite[]>([]);
  const [modalCorpoSelected, setModalCorpoSelected] = useState<StructureLite[]>([]);
  const [modalPuestoSelected, setModalPuestoSelected] = useState<StructureLite[]>([]);
  const [modalLlaveroSelected, setModalLlaveroSelected] = useState<StructureLite[]>([]);
  const [modalAgendaEstado, setModalAgendaEstado] = useState<'todos' | 'completado' | 'pendiente'>('todos');
  const [modalAcpTipo, setModalAcpTipo] = useState<'todos' | 'apertura' | 'cierre'>('todos');
  const [modalAsisTurno, setModalAsisTurno] = useState<'todos' | 'D' | 'M' | 'N'>('todos');
  const [modalDocTipo, setModalDocTipo] = useState<string>('todos');
  const [modalEncResponsableSearch, setModalEncResponsableSearch] = useState('');
  const [modalEncResponsableResults, setModalEncResponsableResults] = useState<EmpleadoLite[]>([]);
  const [modalEncResponsableSelected, setModalEncResponsableSelected] = useState<EmpleadoLite[]>([]);
  const [modalRvCedulaVisitante, setModalRvCedulaVisitante] = useState('');
  const [modalRvTipoVisitante, setModalRvTipoVisitante] = useState<'todos' | 'normal' | 'funcionario'>('todos');
  const [modalRvResponsableSearch, setModalRvResponsableSearch] = useState('');
  const [modalRvResponsableResults, setModalRvResponsableResults] = useState<EmpleadoLite[]>([]);
  const [modalRvResponsableSelected, setModalRvResponsableSelected] = useState<EmpleadoLite[]>([]);
  const [modalEvpEmpEvalSearch, setModalEvpEmpEvalSearch] = useState('');
  const [modalEvpEmpEvalResults, setModalEvpEmpEvalResults] = useState<EmpleadoLite[]>([]);
  const [modalEvpEmpEvalSelected, setModalEvpEmpEvalSelected] = useState<EmpleadoLite[]>([]);
  const [modalEvpEvaluadorSearch, setModalEvpEvaluadorSearch] = useState('');
  const [modalEvpEvaluadorResults, setModalEvpEvaluadorResults] = useState<EmpleadoLite[]>([]);
  const [modalEvpEvaluadorSelected, setModalEvpEvaluadorSelected] = useState<EmpleadoLite[]>([]);
  const [modalEvpTipoEvaluacion, setModalEvpTipoEvaluacion] = useState<'todos' | 'Seguridad' | 'Aseo & limpieza' | 'Otros'>('todos');
  const [modalPncTipoServicio, setModalPncTipoServicio] = useState<string>('todos');
  const [modalIrResponsableSearch, setModalIrResponsableSearch] = useState('');
  const [modalIrResponsableResults, setModalIrResponsableResults] = useState<EmpleadoLite[]>([]);
  const [modalIrResponsableSelected, setModalIrResponsableSelected] = useState<EmpleadoLite[]>([]);
  const [modalIrEmpleadoSearch, setModalIrEmpleadoSearch] = useState('');
  const [modalIrEmpleadoResults, setModalIrEmpleadoResults] = useState<EmpleadoLite[]>([]);
  const [modalIrEmpleadoSelected, setModalIrEmpleadoSelected] = useState<EmpleadoLite[]>([]);
  const [modalIrParticipanteSearch, setModalIrParticipanteSearch] = useState('');
  const [modalIrParticipanteCedulas, setModalIrParticipanteCedulas] = useState<string[]>([]);
  const [modalMutAusenteSearch, setModalMutAusenteSearch] = useState('');
  const [modalMutAusenteResults, setModalMutAusenteResults] = useState<EmpleadoLite[]>([]);
  const [modalMutAusenteSelected, setModalMutAusenteSelected] = useState<EmpleadoLite[]>([]);
  const [modalMutReemplazaSearch, setModalMutReemplazaSearch] = useState('');
  const [modalMutReemplazaResults, setModalMutReemplazaResults] = useState<EmpleadoLite[]>([]);
  const [modalMutReemplazaSelected, setModalMutReemplazaSelected] = useState<EmpleadoLite[]>([]);
  const [modalMutEjecutivoSearch, setModalMutEjecutivoSearch] = useState('');
  const [modalMutEjecutivoResults, setModalMutEjecutivoResults] = useState<StructureLite[]>([]);
  const [modalMutEjecutivoSelected, setModalMutEjecutivoSelected] = useState<StructureLite[]>([]);
  const [modalMutEstado, setModalMutEstado] = useState<'todos' | 'aprobado' | 'rechazado' | 'pendiente'>('todos');
  const [modalEpOficialEntrega, setModalEpOficialEntrega] = useState('');
  const [modalEpOficialRecibe, setModalEpOficialRecibe] = useState('');
  const [modalEpTurnoEntrega, setModalEpTurnoEntrega] = useState('');
  const [modalEpTurnoRecibe, setModalEpTurnoRecibe] = useState('');
  const [modalEpYmdEntDesde, setModalEpYmdEntDesde] = useState('');
  const [modalEpYmdEntHasta, setModalEpYmdEntHasta] = useState('');
  const [modalEpYmdRecDesde, setModalEpYmdRecDesde] = useState('');
  const [modalEpYmdRecHasta, setModalEpYmdRecHasta] = useState('');
  const [modalEpHmEntradaEntrega, setModalEpHmEntradaEntrega] = useState('');
  const [modalEpHmSalidaEntrega, setModalEpHmSalidaEntrega] = useState('');
  const [modalEpHmEntradaRecibe, setModalEpHmEntradaRecibe] = useState('');
  const [modalEpHmSalidaRecibe, setModalEpHmSalidaRecibe] = useState('');
  const [modalIncSolDesdeD, setModalIncSolDesdeD] = useState<Date | null>(null);
  const [modalIncSolDesdeT, setModalIncSolDesdeT] = useState<Date | null>(null);
  const [modalIncSolHastaD, setModalIncSolHastaD] = useState<Date | null>(null);
  const [modalIncSolHastaT, setModalIncSolHastaT] = useState<Date | null>(null);
  const [modalIncRealDesdeD, setModalIncRealDesdeD] = useState<Date | null>(null);
  const [modalIncRealDesdeT, setModalIncRealDesdeT] = useState<Date | null>(null);
  const [modalIncRealHastaD, setModalIncRealHastaD] = useState<Date | null>(null);
  const [modalIncRealHastaT, setModalIncRealHastaT] = useState<Date | null>(null);
  const [modalIncClasificacion, setModalIncClasificacion] = useState<string>('todos');
  const [modalIncEstado, setModalIncEstado] = useState<'todos' | 'solucionado' | 'no_solucionado'>('todos');
  const [modalLlvEntregadoPor, setModalLlvEntregadoPor] = useState('');
  const [modalLlvRecibidoPor, setModalLlvRecibidoPor] = useState('');
  const [modalLlrEntregadoPor, setModalLlrEntregadoPor] = useState('');
  const [modalLlrRecibidoPor, setModalLlrRecibidoPor] = useState('');
  const [modalBnvCategoriaId, setModalBnvCategoriaId] = useState<string>('todos');
  const [modalBnvRelevancia, setModalBnvRelevancia] = useState<'todos' | 'Alta' | 'Media' | 'Baja'>('todos');
  const [modalMqMedioRecepcion, setModalMqMedioRecepcion] = useState<string>('todos');
  const [modalMqTipoQueja, setModalMqTipoQueja] = useState<string>('todos');
  const [modalMqNivelQueja, setModalMqNivelQueja] = useState<string>('todos');
  const [modalEjecutivoSearch, setModalEjecutivoSearch] = useState('');
  const [modalEjecutivoResults, setModalEjecutivoResults] = useState<StructureLite[]>([]);
  const [modalEjecutivoSelected, setModalEjecutivoSelected] = useState<StructureLite[]>([]);
  const [noteCategories, setNoteCategories] = useState<{ id: number; nombre: string }[]>([]);
  const [tipoQuejasCatalogo, setTipoQuejasCatalogo] = useState<{ id: number; nombre: string }[]>([]);
  const [incidentListPicker, setIncidentListPicker] = useState<IncidentPickerSlot | null>(null);
  const [incidentModalPicker, setIncidentModalPicker] = useState<IncidentPickerSlot | null>(null);
  const [modalEpPicker, setModalEpPicker] = useState<ModalEpPickerSlot | null>(null);
  const [documentTypesCache, setDocumentTypesCache] = useState<DocumentTypeLite[]>([]);
  const [incClasificacionesCache, setIncClasificacionesCache] = useState<IncidentClassificationLite[]>([]);
  const [previewRows, setPreviewRows] = useState<any[] | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [firmaModal, setFirmaModal] = useState('');
  const [genFirmaLoading, setGenFirmaLoading] = useState(false);
  const [employeeSearchMode, setEmployeeSearchMode] = useState<
    | null
    | 'creator'
    | 'listUsuario'
    | 'modalUsuario'
    | 'listEmpresa'
    | 'listCliente'
    | 'listDivision'
    | 'listContrato'
    | 'listCorpo'
    | 'listPuesto'
    | 'modalEmpresa'
    | 'modalCliente'
    | 'modalDivision'
    | 'modalContrato'
    | 'modalCorpo'
    | 'modalPuesto'
    | 'listAccEmpleado'
    | 'modalAccEmpleado'
    | 'listEncResponsable'
    | 'modalEncResponsable'
    | 'listRvResponsable'
    | 'modalRvResponsable'
    | 'listEvpEmpEval'
    | 'listEvpEvaluador'
    | 'modalEvpEmpEval'
    | 'modalEvpEvaluador'
    | 'listIrResponsable'
    | 'listIrEmpleado'
    | 'modalIrResponsable'
    | 'modalIrEmpleado'
    | 'listMutAusente'
    | 'listMutReemplaza'
    | 'modalMutAusente'
    | 'modalMutReemplaza'
    | 'listMutEjecutivo'
    | 'modalMutEjecutivo'
    | 'listAccPlaza'
    | 'modalAccPlaza'
    | 'listLlavero'
    | 'modalLlavero'
    | 'listEjecutivo'
    | 'modalEjecutivo'
  >(null);
  const [submitReportLoading, setSubmitReportLoading] = useState(false);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);

  const [showListDd, setShowListDd] = useState(false);
  const [showListDt, setShowListDt] = useState(false);
  const [showListHd, setShowListHd] = useState(false);
  const [showListHt, setShowListHt] = useState(false);
  const [showListActaDd, setShowListActaDd] = useState(false);
  const [showListActaDt, setShowListActaDt] = useState(false);
  const [showListActaHd, setShowListActaHd] = useState(false);
  const [showListActaHt, setShowListActaHt] = useState(false);
  const [listFechaRepDesdeD, setListFechaRepDesdeD] = useState<Date | null>(null);
  const [listFechaRepDesdeT, setListFechaRepDesdeT] = useState<Date | null>(null);
  const [listFechaRepHastaD, setListFechaRepHastaD] = useState<Date | null>(null);
  const [listFechaRepHastaT, setListFechaRepHastaT] = useState<Date | null>(null);
  const [showListFrDd, setShowListFrDd] = useState(false);
  const [showListFrDt, setShowListFrDt] = useState(false);
  const [showListFrHd, setShowListFrHd] = useState(false);
  const [showListFrHt, setShowListFrHt] = useState(false);
  const [listEjecutivoSearch, setListEjecutivoSearch] = useState('');
  const [listEjecutivoResults, setListEjecutivoResults] = useState<StructureLite[]>([]);
  const [listEjecutivoSelected, setListEjecutivoSelected] = useState<StructureLite[]>([]);

  const [showModalDd, setShowModalDd] = useState(false);
  const [showModalDt, setShowModalDt] = useState(false);
  const [showModalHd, setShowModalHd] = useState(false);
  const [showModalHt, setShowModalHt] = useState(false);
  const [showModalActaDd, setShowModalActaDd] = useState(false);
  const [showModalActaDt, setShowModalActaDt] = useState(false);
  const [showModalActaHd, setShowModalActaHd] = useState(false);
  const [showModalActaHt, setShowModalActaHt] = useState(false);

  const { scanQR, QRScannerComponent } = useQRScanner();

  const resetNewReportForm = useCallback(() => {
    setFormNombre('');
    setFormNumero('');
    setFormNomenclatura('');
    setFormDescripcion('');
    setFormModulo(MODULO_INGRESOS);
    setFormOrder('nombre_usuario');
    setFormTipoReporte('Consolidado');
    setModalDesdeD(null);
    setModalDesdeT(null);
    setModalHastaD(null);
    setModalHastaT(null);
    setModalUsuariosSelected([]);
    setModalUsuarioSearch('');
    setModalUsuarioResults([]);
    setIsModalIngresoExpanded(true);
    setModalMultiDevice(false);
    setModalActaDesdeD(null);
    setModalActaDesdeT(null);
    setModalActaHastaD(null);
    setModalActaHastaT(null);
    setModalEmpresaSearch('');
    setModalClienteSearch('');
    setModalDivisionSearch('');
    setModalContratoSearch('');
    setModalCorpoSearch('');
    setModalPuestoSearch('');
    setModalLlaveroSearch('');
    setModalEmpresaResults([]);
    setModalClienteResults([]);
    setModalDivisionResults([]);
    setModalContratoResults([]);
    setModalCorpoResults([]);
    setModalPuestoResults([]);
    setModalLlaveroResults([]);
    setModalEmpresaSelected([]);
    setModalClienteSelected([]);
    setModalDivisionSelected([]);
    setModalContratoSelected([]);
    setModalCorpoSelected([]);
    setModalPuestoSelected([]);
    setModalLlaveroSelected([]);
    setModalAgendaEstado('todos');
    setModalAcpTipo('todos');
    setModalAsisTurno('todos');
    setModalDocTipo('todos');
    setModalEncResponsableSearch('');
    setModalEncResponsableResults([]);
    setModalEncResponsableSelected([]);
    setModalRvCedulaVisitante('');
    setModalRvTipoVisitante('todos');
    setModalRvResponsableSearch('');
    setModalRvResponsableResults([]);
    setModalRvResponsableSelected([]);
    setModalEvpEmpEvalSearch('');
    setModalEvpEmpEvalResults([]);
    setModalEvpEmpEvalSelected([]);
    setModalEvpEvaluadorSearch('');
    setModalEvpEvaluadorResults([]);
    setModalEvpEvaluadorSelected([]);
    setModalEvpTipoEvaluacion('todos');
    setModalPncTipoServicio('todos');
    setModalIrResponsableSearch('');
    setModalIrResponsableResults([]);
    setModalIrResponsableSelected([]);
    setModalIrEmpleadoSearch('');
    setModalIrEmpleadoResults([]);
    setModalIrEmpleadoSelected([]);
    setModalIrParticipanteSearch('');
    setModalIrParticipanteCedulas([]);
    setModalMutAusenteSearch('');
    setModalMutAusenteResults([]);
    setModalMutAusenteSelected([]);
    setModalMutReemplazaSearch('');
    setModalMutReemplazaResults([]);
    setModalMutReemplazaSelected([]);
    setModalMutEjecutivoSearch('');
    setModalMutEjecutivoResults([]);
    setModalMutEjecutivoSelected([]);
    setModalMutEstado('todos');
    setModalEpOficialEntrega('');
    setModalEpOficialRecibe('');
    setModalEpTurnoEntrega('');
    setModalEpTurnoRecibe('');
    setModalEpYmdEntDesde('');
    setModalEpYmdEntHasta('');
    setModalEpYmdRecDesde('');
    setModalEpYmdRecHasta('');
    setModalEpHmEntradaEntrega('');
    setModalEpHmSalidaEntrega('');
    setModalEpHmEntradaRecibe('');
    setModalEpHmSalidaRecibe('');
    setModalIncSolDesdeD(null);
    setModalIncSolDesdeT(null);
    setModalIncSolHastaD(null);
    setModalIncSolHastaT(null);
    setModalIncRealDesdeD(null);
    setModalIncRealDesdeT(null);
    setModalIncRealHastaD(null);
    setModalIncRealHastaT(null);
    setModalIncClasificacion('todos');
    setModalIncEstado('todos');
    setModalLlvEntregadoPor('');
    setModalLlvRecibidoPor('');
    setModalLlrEntregadoPor('');
    setModalLlrRecibidoPor('');
    setModalBnvCategoriaId('todos');
    setModalBnvRelevancia('todos');
    setModalMqMedioRecepcion('todos');
    setModalMqTipoQueja('todos');
    setModalMqNivelQueja('todos');
    setModalEjecutivoSearch('');
    setModalEjecutivoResults([]);
    setModalEjecutivoSelected([]);
    setIncidentModalPicker(null);
    setModalEpPicker(null);
    setModalAccEmpleadoSearch('');
    setModalAccEmpleadoResults([]);
    setModalAccEmpleadoSelected([]);
    setModalAccPlazaSearch('');
    setModalAccPlazaResults([]);
    setModalAccPlazaSelected([]);
    setPreviewRows(null);
    setPreviewOpen(false);
    setFirmaModal('');
    setShowModalDd(false);
    setShowModalDt(false);
    setShowModalHd(false);
    setShowModalHt(false);
    setShowModalActaDd(false);
    setShowModalActaDt(false);
    setShowModalActaHd(false);
    setShowModalActaHt(false);
  }, []);

  const openNewReportModal = useCallback(() => {
    resetNewReportForm();
    setModalVisible(true);
  }, [resetNewReportForm]);

  useEffect(() => {
    if (!modalVisible) {
      setModalEpPicker(null);
      setIncidentModalPicker(null);
    }
  }, [modalVisible]);

  useEffect(() => {
    if (formModulo === MODULO_BITACORA_NOVEDADES) {
      setFormOrder('titulo');
    } else if (
      formModulo === MODULO_ACTA_ENTREGA ||
      formModulo === MODULO_ENTREGA_PUESTO ||
      formModulo === MODULO_AGENDA_MINUTA ||
      formModulo === MODULO_VULNERABILIDAD ||
      formModulo === MODULO_DOCUMENTOS_ENTREGADOS ||
      formModulo === MODULO_ENCUESTA_SATISFACCION ||
      formModulo === MODULO_REGISTRO_VISITAS ||
      formModulo === MODULO_MUTUOS_ACUERDOS ||
      formModulo === MODULO_CONTROL_ASISTENCIA ||
      formModulo === MODULO_ACCIONES_PERSONALES ||
      formModulo === MODULO_INCIDENTES ||
      formModulo === MODULO_LLAVES ||
      formModulo === MODULO_LLAVEROS ||
      formModulo === MODULO_MAESTRO_QUEJAS ||
      formModulo === MODULO_CHECKLIST_SUPERVISION ||
      formModulo === MODULO_EVALUACION_PERSONAL ||
      formModulo === MODULO_PRODUCTO_NO_CONFORME ||
      formModulo === MODULO_REGISTRO_INDUCCION_RECORRIDO
    ) {
      setFormOrder('empresa_id');
    } else if (formModulo === MODULO_MANUALES_PUESTO) {
      setFormOrder('title');
    } else if (formModulo === MODULO_APERTURA_CIERRE) {
      setFormOrder('created_by');
    } else if (formModulo === MODULO_ACTIVIDADES) {
      setFormOrder('fecha');
    } else {
      setFormOrder('nombre_usuario');
    }
    if (
      formModulo !== MODULO_ACTA_ENTREGA &&
      formModulo !== MODULO_ENTREGA_PUESTO &&
      formModulo !== MODULO_AGENDA_MINUTA &&
      formModulo !== MODULO_APERTURA_CIERRE &&
      formModulo !== MODULO_VULNERABILIDAD &&
      formModulo !== MODULO_DOCUMENTOS_ENTREGADOS &&
      formModulo !== MODULO_ENCUESTA_SATISFACCION &&
      formModulo !== MODULO_REGISTRO_VISITAS &&
      formModulo !== MODULO_MUTUOS_ACUERDOS &&
      formModulo !== MODULO_INCIDENTES &&
      formModulo !== MODULO_LLAVES &&
      formModulo !== MODULO_LLAVEROS &&
      formModulo !== MODULO_MAESTRO_QUEJAS &&
      formModulo !== MODULO_PRODUCTO_NO_CONFORME &&
      formModulo !== MODULO_REGISTRO_INDUCCION_RECORRIDO &&
      formModulo !== MODULO_MANUALES_PUESTO
    ) {
      setFormTipoReporte('Consolidado');
    }
  }, [formModulo]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await getCategories(refreshAccessToken, logout);
        const raw = await AsyncStorage.getItem('categories_cache');
        if (!raw || cancelled) return;
        const parsed = JSON.parse(raw) as unknown;
        if (!cancelled && Array.isArray(parsed)) {
          setNoteCategories(
            parsed.filter((x: any) => x && typeof x.id === 'number' && typeof x.nombre === 'string') as { id: number; nombre: string }[],
          );
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await getTipoQuejas(refreshAccessToken, logout);
        const raw = await AsyncStorage.getItem('tipo_quejas_cache');
        if (cancelled) return;
        setTipoQuejasCatalogo(parseTipoQuejasCatalogoFromCache(raw));
      } catch {
        if (!cancelled) setTipoQuejasCatalogo([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    void (async () => {
      const s = await Network.getNetworkStateAsync();
      const ok = !!s.isConnected && s.isInternetReachable !== false;
      setIsOnline(ok);
    })();
  }, []);

  const getOnline = useCallback(async () => {
    const s = await Network.getNetworkStateAsync();
    if (!s.isConnected) return false;
    if (s.isInternetReachable === false) return false;
    return true;
  }, []);

  const requestLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocation(loc);
      return loc;
    } catch {
      return null;
    }
  };

  const runSearchEmployees = async (
    q: string,
    mode:
      | 'creator'
      | 'listUsuario'
      | 'modalUsuario'
      | 'listAccEmpleado'
      | 'modalAccEmpleado'
      | 'listEncResponsable'
      | 'modalEncResponsable'
      | 'listEvpEmpEval'
      | 'listEvpEvaluador'
      | 'modalEvpEmpEval'
      | 'modalEvpEvaluador'
      | 'listMutAusente'
      | 'listMutReemplaza'
      | 'modalMutAusente'
      | 'modalMutReemplaza'
      | 'listIrResponsable'
      | 'listIrEmpleado'
      | 'modalIrResponsable'
      | 'modalIrEmpleado'
      | 'listRvResponsable'
      | 'modalRvResponsable',
  ) => {
    const ok = await getOnline();
    if (!ok) {
      Alert.alert('Sin conexión', 'Esta pantalla requiere internet.');
      return;
    }
    if (!q.trim()) {
      Alert.alert('Buscar', 'Escriba código o nombre.');
      return;
    }
    setEmployeeSearchMode(mode);
    try {
      const res = await searchEmployeesReportes({ q: q.trim(), refreshAccessToken, logout });
      if (!res.status) {
        Alert.alert('Error', res.message || 'No se pudo buscar');
        return;
      }
      const rows = res.data || [];
      if (mode === 'creator') setCreatorResults(rows);
      if (mode === 'listUsuario') setListUsuarioResults(rows);
      if (mode === 'modalUsuario') setModalUsuarioResults(rows);
      if (mode === 'listAccEmpleado') setListAccEmpleadoResults(rows);
      if (mode === 'modalAccEmpleado') setModalAccEmpleadoResults(rows);
      if (mode === 'listEncResponsable') setListEncResponsableResults(rows);
      if (mode === 'modalEncResponsable') setModalEncResponsableResults(rows);
      if (mode === 'listRvResponsable') setListRvResponsableResults(rows);
      if (mode === 'modalRvResponsable') setModalRvResponsableResults(rows);
      if (mode === 'listEvpEmpEval') setListEvpEmpEvalResults(rows);
      if (mode === 'listEvpEvaluador') setListEvpEvaluadorResults(rows);
      if (mode === 'modalEvpEmpEval') setModalEvpEmpEvalResults(rows);
      if (mode === 'modalEvpEvaluador') setModalEvpEvaluadorResults(rows);
      if (mode === 'listMutAusente') setListMutAusenteResults(rows);
      if (mode === 'listMutReemplaza') setListMutReemplazaResults(rows);
      if (mode === 'modalMutAusente') setModalMutAusenteResults(rows);
      if (mode === 'modalMutReemplaza') setModalMutReemplazaResults(rows);
      if (mode === 'listIrResponsable') setListIrResponsableResults(rows);
      if (mode === 'listIrEmpleado') setListIrEmpleadoResults(rows);
      if (mode === 'modalIrResponsable') setModalIrResponsableResults(rows);
      if (mode === 'modalIrEmpleado') setModalIrEmpleadoResults(rows);
    } finally {
      setEmployeeSearchMode(null);
    }
  };

  const runSearchActaStructure = async (
    q: string,
    entity: 'empresa' | 'cliente' | 'division' | 'contrato' | 'corpo' | 'puesto' | 'plaza' | 'llavero' | 'ejecutivo',
    mode:
      | 'listEmpresa'
      | 'listCliente'
      | 'listDivision'
      | 'listContrato'
      | 'listCorpo'
      | 'listPuesto'
      | 'listLlavero'
      | 'listAccPlaza'
      | 'listEjecutivo'
      | 'listMutEjecutivo'
      | 'modalEmpresa'
      | 'modalCliente'
      | 'modalDivision'
      | 'modalContrato'
      | 'modalCorpo'
      | 'modalPuesto'
      | 'modalLlavero'
      | 'modalAccPlaza'
      | 'modalEjecutivo'
      | 'modalMutEjecutivo',
  ) => {
    const ok = await getOnline();
    if (!ok) {
      Alert.alert('Sin conexión', 'Esta pantalla requiere internet.');
      return;
    }
    if (!q.trim()) {
      Alert.alert('Buscar', 'Escriba un criterio de búsqueda.');
      return;
    }
    setEmployeeSearchMode(mode);
    try {
      const res = await searchActaStructure({ entity, q: q.trim(), refreshAccessToken, logout });
      if (!res.status) {
        Alert.alert('Error', res.message || 'No se pudo buscar');
        return;
      }
      const rows = res.data || [];
      if (mode === 'listEmpresa') setListEmpresaResults(rows);
      if (mode === 'listCliente') setListClienteResults(rows);
      if (mode === 'listDivision') setListDivisionResults(rows);
      if (mode === 'listContrato') setListContratoResults(rows);
      if (mode === 'listCorpo') setListCorpoResults(rows);
      if (mode === 'listPuesto') setListPuestoResults(rows);
      if (mode === 'listLlavero') setListLlaveroResults(rows);
      if (mode === 'listAccPlaza') setListAccPlazaResults(rows);
      if (mode === 'modalEmpresa') setModalEmpresaResults(rows);
      if (mode === 'modalCliente') setModalClienteResults(rows);
      if (mode === 'modalDivision') setModalDivisionResults(rows);
      if (mode === 'modalContrato') setModalContratoResults(rows);
      if (mode === 'modalCorpo') setModalCorpoResults(rows);
      if (mode === 'modalPuesto') setModalPuestoResults(rows);
      if (mode === 'modalLlavero') setModalLlaveroResults(rows);
      if (mode === 'modalAccPlaza') setModalAccPlazaResults(rows);
      if (mode === 'listEjecutivo') setListEjecutivoResults(rows);
      if (mode === 'listMutEjecutivo') setListMutEjecutivoResults(rows);
      if (mode === 'modalEjecutivo') setModalEjecutivoResults(rows);
      if (mode === 'modalMutEjecutivo') setModalMutEjecutivoResults(rows);
    } finally {
      setEmployeeSearchMode(null);
    }
  };

  const pickStructureLite = (
    item: StructureLite,
    setSelected: React.Dispatch<React.SetStateAction<StructureLite[]>>,
    setResults: React.Dispatch<React.SetStateAction<StructureLite[]>>,
    setSearch: React.Dispatch<React.SetStateAction<string>>,
  ) => {
    setSelected((prev) => (prev.some((x) => x.id === item.id) ? prev : [...prev, item]));
    setResults([]);
    setSearch('');
  };

  const removeStructureLite = (id: number, setSelected: React.Dispatch<React.SetStateAction<StructureLite[]>>) => {
    setSelected((prev) => prev.filter((x) => x.id !== id));
  };

  const pickCreator = (e: EmpleadoLite) => {
    setCreatorSelected((prev) => (prev.some((x) => x.id === e.id) ? prev : [...prev, e]));
    setCreatorResults([]);
    setCreatorSearch('');
  };

  const removeCreator = (id: number) => {
    setCreatorSelected((prev) => prev.filter((x) => x.id !== id));
  };

  const pickListUsuarioIngreso = (e: EmpleadoLite) => {
    setListUsuarioIngresoSelected((prev) => (prev.some((x) => x.id === e.id) ? prev : [...prev, e]));
    setListUsuarioResults([]);
    setListUsuarioSearch('');
  };

  const removeListUsuarioIngreso = (id: number) => {
    setListUsuarioIngresoSelected((prev) => prev.filter((x) => x.id !== id));
  };

  const pickModalUsuario = (e: EmpleadoLite) => {
    setModalUsuariosSelected((prev) => (prev.some((x) => x.id === e.id) ? prev : [...prev, e]));
    setModalUsuarioResults([]);
    setModalUsuarioSearch('');
  };

  const removeModalUsuario = (id: number) => {
    setModalUsuariosSelected((prev) => prev.filter((x) => x.id !== id));
  };

  const pickListAccEmpleado = (e: EmpleadoLite) => {
    setListAccEmpleadoSelected((prev) => (prev.some((x) => x.id === e.id) ? prev : [...prev, e]));
    setListAccEmpleadoResults([]);
    setListAccEmpleadoSearch('');
  };
  const removeListAccEmpleado = (id: number) => {
    setListAccEmpleadoSelected((prev) => prev.filter((x) => x.id !== id));
  };
  const pickModalAccEmpleado = (e: EmpleadoLite) => {
    setModalAccEmpleadoSelected((prev) => (prev.some((x) => x.id === e.id) ? prev : [...prev, e]));
    setModalAccEmpleadoResults([]);
    setModalAccEmpleadoSearch('');
  };
  const removeModalAccEmpleado = (id: number) => {
    setModalAccEmpleadoSelected((prev) => prev.filter((x) => x.id !== id));
  };

  const pickListEncResponsable = (e: EmpleadoLite) => {
    setListEncResponsableSelected((prev) => (prev.some((x) => x.id === e.id) ? prev : [...prev, e]));
    setListEncResponsableResults([]);
    setListEncResponsableSearch('');
  };
  const removeListEncResponsable = (id: number) => {
    setListEncResponsableSelected((prev) => prev.filter((x) => x.id !== id));
  };
  const pickModalEncResponsable = (e: EmpleadoLite) => {
    setModalEncResponsableSelected((prev) => (prev.some((x) => x.id === e.id) ? prev : [...prev, e]));
    setModalEncResponsableResults([]);
    setModalEncResponsableSearch('');
  };
  const removeModalEncResponsable = (id: number) => {
    setModalEncResponsableSelected((prev) => prev.filter((x) => x.id !== id));
  };

  const pickListRvResponsable = (e: EmpleadoLite) => {
    setListRvResponsableSelected((prev) => (prev.some((x) => x.id === e.id) ? prev : [...prev, e]));
    setListRvResponsableResults([]);
    setListRvResponsableSearch('');
  };
  const removeListRvResponsable = (id: number) => {
    setListRvResponsableSelected((prev) => prev.filter((x) => x.id !== id));
  };
  const pickModalRvResponsable = (e: EmpleadoLite) => {
    setModalRvResponsableSelected((prev) => (prev.some((x) => x.id === e.id) ? prev : [...prev, e]));
    setModalRvResponsableResults([]);
    setModalRvResponsableSearch('');
  };
  const removeModalRvResponsable = (id: number) => {
    setModalRvResponsableSelected((prev) => prev.filter((x) => x.id !== id));
  };

  const pickListMutAusente = (e: EmpleadoLite) => {
    setListMutAusenteSelected((prev) => (prev.some((x) => x.id === e.id) ? prev : [...prev, e]));
    setListMutAusenteResults([]);
    setListMutAusenteSearch('');
  };
  const removeListMutAusente = (id: number) => setListMutAusenteSelected((prev) => prev.filter((x) => x.id !== id));
  const pickListMutReemplaza = (e: EmpleadoLite) => {
    setListMutReemplazaSelected((prev) => (prev.some((x) => x.id === e.id) ? prev : [...prev, e]));
    setListMutReemplazaResults([]);
    setListMutReemplazaSearch('');
  };
  const removeListMutReemplaza = (id: number) => setListMutReemplazaSelected((prev) => prev.filter((x) => x.id !== id));
  const pickListMutEjecutivo = (item: StructureLite) => {
    setListMutEjecutivoSelected((prev) => (prev.some((x) => x.id === item.id) ? prev : [...prev, item]));
    setListMutEjecutivoResults([]);
    setListMutEjecutivoSearch('');
  };
  const removeListMutEjecutivo = (id: number) => setListMutEjecutivoSelected((prev) => prev.filter((x) => x.id !== id));
  const pickModalMutAusente = (e: EmpleadoLite) => {
    setModalMutAusenteSelected((prev) => (prev.some((x) => x.id === e.id) ? prev : [...prev, e]));
    setModalMutAusenteResults([]);
    setModalMutAusenteSearch('');
  };
  const removeModalMutAusente = (id: number) => setModalMutAusenteSelected((prev) => prev.filter((x) => x.id !== id));
  const pickModalMutReemplaza = (e: EmpleadoLite) => {
    setModalMutReemplazaSelected((prev) => (prev.some((x) => x.id === e.id) ? prev : [...prev, e]));
    setModalMutReemplazaResults([]);
    setModalMutReemplazaSearch('');
  };
  const removeModalMutReemplaza = (id: number) => setModalMutReemplazaSelected((prev) => prev.filter((x) => x.id !== id));
  const pickModalMutEjecutivo = (item: StructureLite) => {
    setModalMutEjecutivoSelected((prev) => (prev.some((x) => x.id === item.id) ? prev : [...prev, item]));
    setModalMutEjecutivoResults([]);
    setModalMutEjecutivoSearch('');
  };
  const removeModalMutEjecutivo = (id: number) => setModalMutEjecutivoSelected((prev) => prev.filter((x) => x.id !== id));

  const pickListEvpEmpEval = (e: EmpleadoLite) => {
    setListEvpEmpEvalSelected((prev) => (prev.some((x) => x.id === e.id) ? prev : [...prev, e]));
    setListEvpEmpEvalResults([]);
    setListEvpEmpEvalSearch('');
  };
  const removeListEvpEmpEval = (id: number) => setListEvpEmpEvalSelected((prev) => prev.filter((x) => x.id !== id));
  const pickListEvpEvaluador = (e: EmpleadoLite) => {
    setListEvpEvaluadorSelected((prev) => (prev.some((x) => x.id === e.id) ? prev : [...prev, e]));
    setListEvpEvaluadorResults([]);
    setListEvpEvaluadorSearch('');
  };
  const removeListEvpEvaluador = (id: number) => setListEvpEvaluadorSelected((prev) => prev.filter((x) => x.id !== id));
  const pickModalEvpEmpEval = (e: EmpleadoLite) => {
    setModalEvpEmpEvalSelected((prev) => (prev.some((x) => x.id === e.id) ? prev : [...prev, e]));
    setModalEvpEmpEvalResults([]);
    setModalEvpEmpEvalSearch('');
  };
  const removeModalEvpEmpEval = (id: number) => setModalEvpEmpEvalSelected((prev) => prev.filter((x) => x.id !== id));
  const pickModalEvpEvaluador = (e: EmpleadoLite) => {
    setModalEvpEvaluadorSelected((prev) => (prev.some((x) => x.id === e.id) ? prev : [...prev, e]));
    setModalEvpEvaluadorResults([]);
    setModalEvpEvaluadorSearch('');
  };
  const removeModalEvpEvaluador = (id: number) => setModalEvpEvaluadorSelected((prev) => prev.filter((x) => x.id !== id));

  const pickListIrResponsable = (e: EmpleadoLite) => {
    setListIrResponsableSelected((prev) => (prev.some((x) => x.id === e.id) ? prev : [...prev, e]));
    setListIrResponsableResults([]);
    setListIrResponsableSearch('');
  };
  const removeListIrResponsable = (id: number) => setListIrResponsableSelected((prev) => prev.filter((x) => x.id !== id));
  const pickListIrEmpleado = (e: EmpleadoLite) => {
    setListIrEmpleadoSelected((prev) => (prev.some((x) => x.id === e.id) ? prev : [...prev, e]));
    setListIrEmpleadoResults([]);
    setListIrEmpleadoSearch('');
  };
  const removeListIrEmpleado = (id: number) => setListIrEmpleadoSelected((prev) => prev.filter((x) => x.id !== id));
  const addListIrParticipanteCedula = () => {
    const t = listIrParticipanteSearch.trim().replace(/\s+/g, '');
    if (!t) {
      Alert.alert('Participantes', 'Escriba una cédula.');
      return;
    }
    setListIrParticipanteCedulas((prev) => (prev.some((x) => x.toLowerCase() === t.toLowerCase()) ? prev : [...prev, t]));
    setListIrParticipanteSearch('');
  };
  const removeListIrParticipanteCedula = (ced: string) =>
    setListIrParticipanteCedulas((prev) => prev.filter((x) => x !== ced));

  const pickModalIrResponsable = (e: EmpleadoLite) => {
    setModalIrResponsableSelected((prev) => (prev.some((x) => x.id === e.id) ? prev : [...prev, e]));
    setModalIrResponsableResults([]);
    setModalIrResponsableSearch('');
  };
  const removeModalIrResponsable = (id: number) => setModalIrResponsableSelected((prev) => prev.filter((x) => x.id !== id));
  const pickModalIrEmpleado = (e: EmpleadoLite) => {
    setModalIrEmpleadoSelected((prev) => (prev.some((x) => x.id === e.id) ? prev : [...prev, e]));
    setModalIrEmpleadoResults([]);
    setModalIrEmpleadoSearch('');
  };
  const removeModalIrEmpleado = (id: number) => setModalIrEmpleadoSelected((prev) => prev.filter((x) => x.id !== id));
  const addModalIrParticipanteCedula = () => {
    const t = modalIrParticipanteSearch.trim().replace(/\s+/g, '');
    if (!t) {
      Alert.alert('Participantes', 'Escriba una cédula.');
      return;
    }
    setModalIrParticipanteCedulas((prev) => (prev.some((x) => x.toLowerCase() === t.toLowerCase()) ? prev : [...prev, t]));
    setModalIrParticipanteSearch('');
  };
  const removeModalIrParticipanteCedula = (ced: string) =>
    setModalIrParticipanteCedulas((prev) => prev.filter((x) => x !== ced));

  const loadLista = async () => {
    if (loadingList) return;
    const ok = await getOnline();
    if (!ok) {
      Alert.alert('Sin conexión', 'Esta pantalla requiere internet.');
      return;
    }
    setLoadingList(true);
    try {
      const q: Record<string, string | undefined> = {
        modulo,
        nombreContains: nombreBusqueda.trim() || undefined,
        numeroContains: numeroBusqueda.trim() || undefined,
        nomenclaturaContains: nomenclaturaBusqueda.trim() || undefined,
        descripcionContains: descripcionBusqueda.trim() || undefined,
        tipoReporte: tipoReporteBusqueda.trim() || undefined,
        estado: estadoBusqueda.trim() || undefined,
        fechaInicio: fechaInicio ? ymd(fechaInicio) : undefined,
        fechaFin: fechaFin ? ymd(fechaFin) : undefined,
      };
      if (creatorSelected.length) {
        q.createdByIds = creatorSelected.map((c) => String(c.id)).join(',');
      }
      if (modulo === MODULO_INGRESOS) {
        if (listCreadoDesdeD && listCreadoDesdeT) {
          q.listCreadoDesde = combineDateAndTime(ymd(listCreadoDesdeD), hm(listCreadoDesdeT));
        }
        if (listCreadoHastaD && listCreadoHastaT) {
          q.listCreadoHasta = combineDateAndTime(ymd(listCreadoHastaD), hm(listCreadoHastaT));
        }
        if (listUsuarioIngresoSelected.length === 1) {
          q.listEmpleadoIngresoId = String(listUsuarioIngresoSelected[0].id);
        } else if (listUsuarioIngresoSelected.length > 1) {
          q.listEmpleadoIngresoId = listUsuarioIngresoSelected.map((u) => String(u.id)).join(',');
        }
        if (listSoloMultiDispositivo) {
          q.listSoloMultiDispositivo = '1';
        }
      } else if (modulo === MODULO_ACTIVIDADES) {
        if (listActaDesdeD && listActaDesdeT) {
          q.listActivCreadoDesde = combineDateAndTime(ymd(listActaDesdeD), hm(listActaDesdeT));
        }
        if (listActaHastaD && listActaHastaT) {
          q.listActivCreadoHasta = combineDateAndTime(ymd(listActaHastaD), hm(listActaHastaT));
        }
        if (listEmpresaSelected.length) q.listActivEmpresaIds = listEmpresaSelected.map((x) => String(x.id)).join(',');
        if (listClienteSelected.length) q.listActivClienteIds = listClienteSelected.map((x) => String(x.id)).join(',');
        if (listDivisionSelected.length) q.listActivDivisionIds = listDivisionSelected.map((x) => String(x.id)).join(',');
        if (listContratoSelected.length) q.listActivContratoIds = listContratoSelected.map((x) => String(x.id)).join(',');
        if (listCorpoSelected.length) q.listActivCorpoIds = listCorpoSelected.map((x) => String(x.id)).join(',');
        if (listPuestoSelected.length) q.listActivPuestoIds = listPuestoSelected.map((x) => String(x.id)).join(',');
      } else if (modulo === MODULO_CONTROL_ASISTENCIA) {
        if (listActaDesdeD && listActaDesdeT) q.listAsisCreadoDesde = combineDateAndTime(ymd(listActaDesdeD), hm(listActaDesdeT));
        if (listActaHastaD && listActaHastaT) q.listAsisCreadoHasta = combineDateAndTime(ymd(listActaHastaD), hm(listActaHastaT));
        if (listEmpresaSelected.length) q.listAsisEmpresaIds = listEmpresaSelected.map((x) => String(x.id)).join(',');
        if (listClienteSelected.length) q.listAsisClienteIds = listClienteSelected.map((x) => String(x.id)).join(',');
        if (listDivisionSelected.length) q.listAsisDivisionIds = listDivisionSelected.map((x) => String(x.id)).join(',');
        if (listContratoSelected.length) q.listAsisContratoIds = listContratoSelected.map((x) => String(x.id)).join(',');
        if (listCorpoSelected.length) q.listAsisCorpoIds = listCorpoSelected.map((x) => String(x.id)).join(',');
        if (listPuestoSelected.length) q.listAsisPuestoIds = listPuestoSelected.map((x) => String(x.id)).join(',');
        if (listAsisTurno !== 'todos') q.listAsisTurno = listAsisTurno;
      } else if (modulo === MODULO_DOCUMENTOS_ENTREGADOS) {
        if (listActaDesdeD && listActaDesdeT) q.listDocCreadoDesde = combineDateAndTime(ymd(listActaDesdeD), hm(listActaDesdeT));
        if (listActaHastaD && listActaHastaT) q.listDocCreadoHasta = combineDateAndTime(ymd(listActaHastaD), hm(listActaHastaT));
        if (listEmpresaSelected.length) q.listDocEmpresaIds = listEmpresaSelected.map((x) => String(x.id)).join(',');
        if (listClienteSelected.length) q.listDocClienteIds = listClienteSelected.map((x) => String(x.id)).join(',');
        if (listDivisionSelected.length) q.listDocDivisionIds = listDivisionSelected.map((x) => String(x.id)).join(',');
        if (listContratoSelected.length) q.listDocContratoIds = listContratoSelected.map((x) => String(x.id)).join(',');
        if (listCorpoSelected.length) q.listDocCorpoIds = listCorpoSelected.map((x) => String(x.id)).join(',');
        if (listPuestoSelected.length) q.listDocPuestoIds = listPuestoSelected.map((x) => String(x.id)).join(',');
        if (listDocTipo !== 'todos') q.listDocTipoDocumento = listDocTipo;
      } else if (modulo === MODULO_ENCUESTA_SATISFACCION) {
        if (listActaDesdeD && listActaDesdeT) q.listEncCreadoDesde = combineDateAndTime(ymd(listActaDesdeD), hm(listActaDesdeT));
        if (listActaHastaD && listActaHastaT) q.listEncCreadoHasta = combineDateAndTime(ymd(listActaHastaD), hm(listActaHastaT));
        if (listEmpresaSelected.length) q.listEncEmpresaIds = listEmpresaSelected.map((x) => String(x.id)).join(',');
        if (listClienteSelected.length) q.listEncClienteIds = listClienteSelected.map((x) => String(x.id)).join(',');
        if (listDivisionSelected.length) q.listEncDivisionIds = listDivisionSelected.map((x) => String(x.id)).join(',');
        if (listContratoSelected.length) q.listEncContratoIds = listContratoSelected.map((x) => String(x.id)).join(',');
        if (listCorpoSelected.length) q.listEncCorpoIds = listCorpoSelected.map((x) => String(x.id)).join(',');
        if (listPuestoSelected.length) q.listEncPuestoIds = listPuestoSelected.map((x) => String(x.id)).join(',');
        if (listEncResponsableSelected.length)
          q.listEncResponsableIds = listEncResponsableSelected.map((x) => String(x.id)).join(',');
      } else if (modulo === MODULO_REGISTRO_VISITAS) {
        if (listActaDesdeD && listActaDesdeT) q.listRvCreadoDesde = combineDateAndTime(ymd(listActaDesdeD), hm(listActaDesdeT));
        if (listActaHastaD && listActaHastaT) q.listRvCreadoHasta = combineDateAndTime(ymd(listActaHastaD), hm(listActaHastaT));
        if (listEmpresaSelected.length) q.listRvEmpresaIds = listEmpresaSelected.map((x) => String(x.id)).join(',');
        if (listClienteSelected.length) q.listRvClienteIds = listClienteSelected.map((x) => String(x.id)).join(',');
        if (listDivisionSelected.length) q.listRvDivisionIds = listDivisionSelected.map((x) => String(x.id)).join(',');
        if (listContratoSelected.length) q.listRvContratoIds = listContratoSelected.map((x) => String(x.id)).join(',');
        if (listCorpoSelected.length) q.listRvCorpoIds = listCorpoSelected.map((x) => String(x.id)).join(',');
        if (listPuestoSelected.length) q.listRvPuestoIds = listPuestoSelected.map((x) => String(x.id)).join(',');
        if (listRvResponsableSelected.length)
          q.listRvResponsableIds = listRvResponsableSelected.map((x) => String(x.id)).join(',');
        if (listRvCedulaVisitante.trim()) q.listRvCedulaVisitante = listRvCedulaVisitante.trim();
        if (listRvTipoVisitante !== 'todos') q.listRvTipoVisitante = listRvTipoVisitante;
      } else if (modulo === MODULO_MUTUOS_ACUERDOS) {
        if (listActaDesdeD && listActaDesdeT) q.listMutFechaReporteDesde = combineDateAndTime(ymd(listActaDesdeD), hm(listActaDesdeT));
        if (listActaHastaD && listActaHastaT) q.listMutFechaReporteHasta = combineDateAndTime(ymd(listActaHastaD), hm(listActaHastaT));
        if (listEmpresaSelected.length) q.listMutEmpresaIds = listEmpresaSelected.map((x) => String(x.id)).join(',');
        if (listClienteSelected.length) q.listMutClienteIds = listClienteSelected.map((x) => String(x.id)).join(',');
        if (listDivisionSelected.length) q.listMutDivisionIds = listDivisionSelected.map((x) => String(x.id)).join(',');
        if (listContratoSelected.length) q.listMutContratoIds = listContratoSelected.map((x) => String(x.id)).join(',');
        if (listCorpoSelected.length) q.listMutCorpoIds = listCorpoSelected.map((x) => String(x.id)).join(',');
        if (listPuestoSelected.length) q.listMutPuestoIds = listPuestoSelected.map((x) => String(x.id)).join(',');
        if (listMutAusenteSelected.length)
          q.listMutEmpleadoAusenteIds = listMutAusenteSelected.map((x) => String(x.id)).join(',');
        if (listMutReemplazaSelected.length)
          q.listMutEmpleadoReemplazaIds = listMutReemplazaSelected.map((x) => String(x.id)).join(',');
        if (listMutEjecutivoSelected.length)
          q.listMutEjecutivoCuentaIds = listMutEjecutivoSelected.map((x) => String(x.id)).join(',');
        if (listMutEstado !== 'todos') q.listMutEstado = listMutEstado;
      } else if (modulo === MODULO_EVALUACION_PERSONAL) {
        if (listActaDesdeD && listActaDesdeT) q.listEvpCreadoDesde = combineDateAndTime(ymd(listActaDesdeD), hm(listActaDesdeT));
        if (listActaHastaD && listActaHastaT) q.listEvpCreadoHasta = combineDateAndTime(ymd(listActaHastaD), hm(listActaHastaT));
        if (listEmpresaSelected.length) q.listEvpEmpresaIds = listEmpresaSelected.map((x) => String(x.id)).join(',');
        if (listClienteSelected.length) q.listEvpClienteIds = listClienteSelected.map((x) => String(x.id)).join(',');
        if (listDivisionSelected.length) q.listEvpDivisionIds = listDivisionSelected.map((x) => String(x.id)).join(',');
        if (listContratoSelected.length) q.listEvpContratoIds = listContratoSelected.map((x) => String(x.id)).join(',');
        if (listCorpoSelected.length) q.listEvpCorpoIds = listCorpoSelected.map((x) => String(x.id)).join(',');
        if (listPuestoSelected.length) q.listEvpPuestoIds = listPuestoSelected.map((x) => String(x.id)).join(',');
        if (listEvpEmpEvalSelected.length)
          q.listEvpEmpleadoEvaluadoIds = listEvpEmpEvalSelected.map((x) => String(x.id)).join(',');
        if (listEvpEvaluadorSelected.length) q.listEvpEvaluadorIds = listEvpEvaluadorSelected.map((x) => String(x.id)).join(',');
        if (listEvpTipoEvaluacion !== 'todos') q.listEvpTipoEvaluacion = listEvpTipoEvaluacion;
      } else if (modulo === MODULO_PRODUCTO_NO_CONFORME) {
        if (listActaDesdeD && listActaDesdeT) q.listPncCreadoDesde = combineDateAndTime(ymd(listActaDesdeD), hm(listActaDesdeT));
        if (listActaHastaD && listActaHastaT) q.listPncCreadoHasta = combineDateAndTime(ymd(listActaHastaD), hm(listActaHastaT));
        if (listEmpresaSelected.length) q.listPncEmpresaIds = listEmpresaSelected.map((x) => String(x.id)).join(',');
        if (listClienteSelected.length) q.listPncClienteIds = listClienteSelected.map((x) => String(x.id)).join(',');
        if (listDivisionSelected.length) q.listPncDivisionIds = listDivisionSelected.map((x) => String(x.id)).join(',');
        if (listContratoSelected.length) q.listPncContratoIds = listContratoSelected.map((x) => String(x.id)).join(',');
        if (listCorpoSelected.length) q.listPncCorpoIds = listCorpoSelected.map((x) => String(x.id)).join(',');
        if (listPuestoSelected.length) q.listPncPuestoIds = listPuestoSelected.map((x) => String(x.id)).join(',');
        if (listPncTipoServicio !== 'todos') q.listPncTipoServicio = listPncTipoServicio;
      } else if (modulo === MODULO_REGISTRO_INDUCCION_RECORRIDO) {
        if (listActaDesdeD && listActaDesdeT) q.listIrCreadoDesde = combineDateAndTime(ymd(listActaDesdeD), hm(listActaDesdeT));
        if (listActaHastaD && listActaHastaT) q.listIrCreadoHasta = combineDateAndTime(ymd(listActaHastaD), hm(listActaHastaT));
        if (listEmpresaSelected.length) q.listIrEmpresaIds = listEmpresaSelected.map((x) => String(x.id)).join(',');
        if (listClienteSelected.length) q.listIrClienteIds = listClienteSelected.map((x) => String(x.id)).join(',');
        if (listDivisionSelected.length) q.listIrDivisionIds = listDivisionSelected.map((x) => String(x.id)).join(',');
        if (listContratoSelected.length) q.listIrContratoIds = listContratoSelected.map((x) => String(x.id)).join(',');
        if (listCorpoSelected.length) q.listIrCorpoIds = listCorpoSelected.map((x) => String(x.id)).join(',');
        if (listPuestoSelected.length) q.listIrPuestoIds = listPuestoSelected.map((x) => String(x.id)).join(',');
        if (listIrResponsableSelected.length)
          q.listIrResponsableEmpleadoIds = listIrResponsableSelected.map((x) => String(x.id)).join(',');
        if (listIrEmpleadoSelected.length) q.listIrEmpleadoIds = listIrEmpleadoSelected.map((x) => String(x.id)).join(',');
        if (listIrParticipanteCedulas.length) q.listIrParticipanteCedulas = listIrParticipanteCedulas.join(',');
      } else if (modulo === MODULO_MANUALES_PUESTO) {
        if (listActaDesdeD && listActaDesdeT) q.listMpCreadoDesde = combineDateAndTime(ymd(listActaDesdeD), hm(listActaDesdeT));
        if (listActaHastaD && listActaHastaT) q.listMpCreadoHasta = combineDateAndTime(ymd(listActaHastaD), hm(listActaHastaT));
        if (listEmpresaSelected.length) q.listMpEmpresaIds = listEmpresaSelected.map((x) => String(x.id)).join(',');
        if (listClienteSelected.length) q.listMpClienteIds = listClienteSelected.map((x) => String(x.id)).join(',');
        if (listDivisionSelected.length) q.listMpDivisionIds = listDivisionSelected.map((x) => String(x.id)).join(',');
        if (listContratoSelected.length) q.listMpContratoIds = listContratoSelected.map((x) => String(x.id)).join(',');
        if (listCorpoSelected.length) q.listMpCorpoIds = listCorpoSelected.map((x) => String(x.id)).join(',');
        if (listPuestoSelected.length) q.listMpPuestoIds = listPuestoSelected.map((x) => String(x.id)).join(',');
      } else if (modulo === MODULO_INCIDENTES) {
        if (listFechaRepDesdeD && listFechaRepDesdeT)
          q.listIncFechaReporteDesde = combineDateAndTime(ymd(listFechaRepDesdeD), hm(listFechaRepDesdeT));
        if (listFechaRepHastaD && listFechaRepHastaT)
          q.listIncFechaReporteHasta = combineDateAndTime(ymd(listFechaRepHastaD), hm(listFechaRepHastaT));
        if (listIncSolDesdeD && listIncSolDesdeT) q.listIncSolucionadoDesde = combineDateAndTime(ymd(listIncSolDesdeD), hm(listIncSolDesdeT));
        if (listIncSolHastaD && listIncSolHastaT) q.listIncSolucionadoHasta = combineDateAndTime(ymd(listIncSolHastaD), hm(listIncSolHastaT));
        if (listIncRealDesdeD && listIncRealDesdeT) q.listIncSolucionadoRealDesde = combineDateAndTime(ymd(listIncRealDesdeD), hm(listIncRealDesdeT));
        if (listIncRealHastaD && listIncRealHastaT) q.listIncSolucionadoRealHasta = combineDateAndTime(ymd(listIncRealHastaD), hm(listIncRealHastaT));
        if (listEmpresaSelected.length) q.listIncEmpresaIds = listEmpresaSelected.map((x) => String(x.id)).join(',');
        if (listClienteSelected.length) q.listIncClienteIds = listClienteSelected.map((x) => String(x.id)).join(',');
        if (listDivisionSelected.length) q.listIncDivisionIds = listDivisionSelected.map((x) => String(x.id)).join(',');
        if (listContratoSelected.length) q.listIncContratoIds = listContratoSelected.map((x) => String(x.id)).join(',');
        if (listCorpoSelected.length) q.listIncCorpoIds = listCorpoSelected.map((x) => String(x.id)).join(',');
        if (listPuestoSelected.length) q.listIncPuestoIds = listPuestoSelected.map((x) => String(x.id)).join(',');
        if (listEjecutivoSelected.length) q.listIncEjecutivoIds = listEjecutivoSelected.map((x) => String(x.id)).join(',');
        if (listIncClasificacion !== 'todos') q.listIncClasificacionId = listIncClasificacion;
        if (listIncEstado !== 'todos') q.listIncEstado = listIncEstado;
      } else if (modulo === MODULO_LLAVES) {
        if (listActaDesdeD && listActaDesdeT) q.listLlvCreadoDesde = combineDateAndTime(ymd(listActaDesdeD), hm(listActaDesdeT));
        if (listActaHastaD && listActaHastaT) q.listLlvCreadoHasta = combineDateAndTime(ymd(listActaHastaD), hm(listActaHastaT));
        if (listEmpresaSelected.length) q.listLlvEmpresaIds = listEmpresaSelected.map((x) => String(x.id)).join(',');
        if (listClienteSelected.length) q.listLlvClienteIds = listClienteSelected.map((x) => String(x.id)).join(',');
        if (listDivisionSelected.length) q.listLlvDivisionIds = listDivisionSelected.map((x) => String(x.id)).join(',');
        if (listContratoSelected.length) q.listLlvContratoIds = listContratoSelected.map((x) => String(x.id)).join(',');
        if (listCorpoSelected.length) q.listLlvCorpoIds = listCorpoSelected.map((x) => String(x.id)).join(',');
        if (listPuestoSelected.length) q.listLlvPuestoIds = listPuestoSelected.map((x) => String(x.id)).join(',');
        if (listLlaveroSelected.length) q.listLlvLlaveroIds = listLlaveroSelected.map((x) => String(x.id)).join(',');
        if (listLlvEntregadoPor.trim() !== '') q.listLlvEntregadoPor = listLlvEntregadoPor.trim();
        if (listLlvRecibidoPor.trim() !== '') q.listLlvRecibidoPor = listLlvRecibidoPor.trim();
      } else if (modulo === MODULO_LLAVEROS) {
        if (listActaDesdeD && listActaDesdeT) q.listLlrCreadoDesde = combineDateAndTime(ymd(listActaDesdeD), hm(listActaDesdeT));
        if (listActaHastaD && listActaHastaT) q.listLlrCreadoHasta = combineDateAndTime(ymd(listActaHastaD), hm(listActaHastaT));
        if (listEmpresaSelected.length) q.listLlrEmpresaIds = listEmpresaSelected.map((x) => String(x.id)).join(',');
        if (listClienteSelected.length) q.listLlrClienteIds = listClienteSelected.map((x) => String(x.id)).join(',');
        if (listDivisionSelected.length) q.listLlrDivisionIds = listDivisionSelected.map((x) => String(x.id)).join(',');
        if (listContratoSelected.length) q.listLlrContratoIds = listContratoSelected.map((x) => String(x.id)).join(',');
        if (listCorpoSelected.length) q.listLlrCorpoIds = listCorpoSelected.map((x) => String(x.id)).join(',');
        if (listPuestoSelected.length) q.listLlrPuestoIds = listPuestoSelected.map((x) => String(x.id)).join(',');
        if (listLlrEntregadoPor.trim() !== '') q.listLlrEntregadoPor = listLlrEntregadoPor.trim();
        if (listLlrRecibidoPor.trim() !== '') q.listLlrRecibidoPor = listLlrRecibidoPor.trim();
      } else if (modulo === MODULO_BITACORA_NOVEDADES) {
        if (listActaDesdeD && listActaDesdeT) q.listBnvCreadoDesde = combineDateAndTime(ymd(listActaDesdeD), hm(listActaDesdeT));
        if (listActaHastaD && listActaHastaT) q.listBnvCreadoHasta = combineDateAndTime(ymd(listActaHastaD), hm(listActaHastaT));
        if (listEmpresaSelected.length) q.listBnvEmpresaIds = listEmpresaSelected.map((x) => String(x.id)).join(',');
        if (listClienteSelected.length) q.listBnvClienteIds = listClienteSelected.map((x) => String(x.id)).join(',');
        if (listDivisionSelected.length) q.listBnvDivisionIds = listDivisionSelected.map((x) => String(x.id)).join(',');
        if (listContratoSelected.length) q.listBnvContratoIds = listContratoSelected.map((x) => String(x.id)).join(',');
        if (listCorpoSelected.length) q.listBnvCorpoIds = listCorpoSelected.map((x) => String(x.id)).join(',');
        if (listPuestoSelected.length) q.listBnvPuestoIds = listPuestoSelected.map((x) => String(x.id)).join(',');
        if (listBnvCategoriaId !== 'todos') q.listBnvCategoriaId = listBnvCategoriaId;
        if (listBnvRelevancia !== 'todos') q.listBnvRelevancia = listBnvRelevancia;
      } else if (modulo === MODULO_MAESTRO_QUEJAS) {
        if (listActaDesdeD && listActaDesdeT) q.listMqjCreadoDesde = combineDateAndTime(ymd(listActaDesdeD), hm(listActaDesdeT));
        if (listActaHastaD && listActaHastaT) q.listMqjCreadoHasta = combineDateAndTime(ymd(listActaHastaD), hm(listActaHastaT));
        if (listEmpresaSelected.length) q.listMqjEmpresaIds = listEmpresaSelected.map((x) => String(x.id)).join(',');
        if (listClienteSelected.length) q.listMqjClienteIds = listClienteSelected.map((x) => String(x.id)).join(',');
        if (listDivisionSelected.length) q.listMqjDivisionIds = listDivisionSelected.map((x) => String(x.id)).join(',');
        if (listContratoSelected.length) q.listMqjContratoIds = listContratoSelected.map((x) => String(x.id)).join(',');
        if (listCorpoSelected.length) q.listMqjCorpoIds = listCorpoSelected.map((x) => String(x.id)).join(',');
        if (listPuestoSelected.length) q.listMqjPuestoIds = listPuestoSelected.map((x) => String(x.id)).join(',');
        if (listMqMedioRecepcion !== 'todos') q.listMqjMedioRecepcion = listMqMedioRecepcion;
        if (listMqTipoQueja !== 'todos') q.listMqjTipoQueja = listMqTipoQueja;
        if (listMqNivelQueja !== 'todos') q.listMqjNivelQueja = listMqNivelQueja;
      } else if (modulo === MODULO_CHECKLIST_SUPERVISION) {
        if (listFechaRepDesdeD && listFechaRepDesdeT)
          q.listCksFechaReporteDesde = combineDateAndTime(ymd(listFechaRepDesdeD), hm(listFechaRepDesdeT));
        if (listFechaRepHastaD && listFechaRepHastaT)
          q.listCksFechaReporteHasta = combineDateAndTime(ymd(listFechaRepHastaD), hm(listFechaRepHastaT));
        if (listEmpresaSelected.length) q.listCksEmpresaIds = listEmpresaSelected.map((x) => String(x.id)).join(',');
        if (listClienteSelected.length) q.listCksClienteIds = listClienteSelected.map((x) => String(x.id)).join(',');
        if (listDivisionSelected.length) q.listCksDivisionIds = listDivisionSelected.map((x) => String(x.id)).join(',');
        if (listContratoSelected.length) q.listCksContratoIds = listContratoSelected.map((x) => String(x.id)).join(',');
        if (listCorpoSelected.length) q.listCksCorpoIds = listCorpoSelected.map((x) => String(x.id)).join(',');
        if (listPuestoSelected.length) q.listCksPuestoIds = listPuestoSelected.map((x) => String(x.id)).join(',');
        if (listEjecutivoSelected.length) q.listCksEjecutivoIds = listEjecutivoSelected.map((x) => String(x.id)).join(',');
      } else if (modulo === MODULO_ACCIONES_PERSONALES) {
        if (listAccEmpleadoSelected.length) q.listAccEmpleadoIds = listAccEmpleadoSelected.map((x) => String(x.id)).join(',');
        if (listEmpresaSelected.length) q.listAccEmpresaIds = listEmpresaSelected.map((x) => String(x.id)).join(',');
        if (listClienteSelected.length) q.listAccClienteIds = listClienteSelected.map((x) => String(x.id)).join(',');
        if (listDivisionSelected.length) q.listAccDivisionIds = listDivisionSelected.map((x) => String(x.id)).join(',');
        if (listContratoSelected.length) q.listAccContratoIds = listContratoSelected.map((x) => String(x.id)).join(',');
        if (listCorpoSelected.length) q.listAccCorpoIds = listCorpoSelected.map((x) => String(x.id)).join(',');
        if (listPuestoSelected.length) q.listAccPuestoIds = listPuestoSelected.map((x) => String(x.id)).join(',');
        if (listAccPlazaSelected.length) q.listAccPlazaIds = listAccPlazaSelected.map((x) => String(x.id)).join(',');
      } else if (
        modulo === MODULO_ACTA_ENTREGA ||
        modulo === MODULO_ENTREGA_PUESTO ||
        modulo === MODULO_AGENDA_MINUTA ||
        modulo === MODULO_APERTURA_CIERRE ||
        modulo === MODULO_VULNERABILIDAD
      ) {
        if (listActaDesdeD && listActaDesdeT) {
          q.listActaCreadoDesde = combineDateAndTime(ymd(listActaDesdeD), hm(listActaDesdeT));
        }
        if (listActaHastaD && listActaHastaT) {
          q.listActaCreadoHasta = combineDateAndTime(ymd(listActaHastaD), hm(listActaHastaT));
        }
        if (listEmpresaSelected.length) q.listEmpresaIds = listEmpresaSelected.map((x) => String(x.id)).join(',');
        if (listClienteSelected.length) q.listClienteIds = listClienteSelected.map((x) => String(x.id)).join(',');
        if (listDivisionSelected.length) q.listDivisionIds = listDivisionSelected.map((x) => String(x.id)).join(',');
        if (listContratoSelected.length) q.listContratoIds = listContratoSelected.map((x) => String(x.id)).join(',');
        if (listCorpoSelected.length) q.listCorpoIds = listCorpoSelected.map((x) => String(x.id)).join(',');
        if (listPuestoSelected.length) q.listPuestoIds = listPuestoSelected.map((x) => String(x.id)).join(',');
        if (modulo === MODULO_AGENDA_MINUTA) {
          q.listAgendaEstado = listAgendaEstado;
        }
        if (modulo === MODULO_APERTURA_CIERRE) {
          q.listAcpTipo = listAcpTipo;
          if (creatorSelected.length > 0) {
            q.listAcpCreatedByIds = creatorSelected.map((c) => String(c.id)).join(',');
          }
        }
        if (modulo === MODULO_VULNERABILIDAD) {
          if (listActaDesdeD && listActaDesdeT) q.listVulnCreadoDesde = combineDateAndTime(ymd(listActaDesdeD), hm(listActaDesdeT));
          if (listActaHastaD && listActaHastaT) q.listVulnCreadoHasta = combineDateAndTime(ymd(listActaHastaD), hm(listActaHastaT));
          if (listEmpresaSelected.length) q.listVulnEmpresaIds = listEmpresaSelected.map((x) => String(x.id)).join(',');
          if (listClienteSelected.length) q.listVulnClienteIds = listClienteSelected.map((x) => String(x.id)).join(',');
          if (listDivisionSelected.length) q.listVulnDivisionIds = listDivisionSelected.map((x) => String(x.id)).join(',');
          if (listContratoSelected.length) q.listVulnContratoIds = listContratoSelected.map((x) => String(x.id)).join(',');
          if (listCorpoSelected.length) q.listVulnCorpoIds = listCorpoSelected.map((x) => String(x.id)).join(',');
          if (listPuestoSelected.length) q.listVulnPuestoIds = listPuestoSelected.map((x) => String(x.id)).join(',');
        }
      }
      const res = await fetchReportesList({ query: q, refreshAccessToken, logout });
      if (!res.status) {
        Alert.alert('Error', res.message || 'No se pudo cargar');
        return;
      }
      setReportes((res.data || []) as ReportRow[]);
    } finally {
      setLoadingList(false);
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedRows((p) => ({ ...p, [id]: !p[id] }));
  };

  const openDownload = async (row: ReportRow) => {
    if (row.estado !== 'completado') {
      Alert.alert('Archivo', 'El archivo se genera en el servidor; espere a que el estado sea «completado».');
      return;
    }
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      Alert.alert('Error', 'Server URL not configured');
      return;
    }
    const base = apiUrl.replace(/\/+$/, '');
    const resourceUrl = `${base}/api/reportes/mobile/${row.id}/get-file`;
    const uri = appendTokenToUrl(`${resourceUrl}?t=${Date.now()}`);
    const can = await Linking.canOpenURL(uri);
    if (can) await Linking.openURL(uri);
    else Alert.alert('Descarga', uri);
  };

  const getModalEpPickerValue = (): Date => {
    if (!modalEpPicker) return horaAccionPickerBase;
    if (modalEpPicker.endsWith('_hm')) {
      if (modalEpPicker === 'hee_hm') return parseHmToLocalDate(modalEpHmEntradaEntrega);
      if (modalEpPicker === 'hse_hm') return parseHmToLocalDate(modalEpHmSalidaEntrega);
      if (modalEpPicker === 'her_hm') return parseHmToLocalDate(modalEpHmEntradaRecibe);
      return parseHmToLocalDate(modalEpHmSalidaRecibe);
    }
    if (modalEpPicker === 'fee_ymd') return parseYmdToLocalDate(modalEpYmdEntDesde);
    if (modalEpPicker === 'fse_ymd') return parseYmdToLocalDate(modalEpYmdEntHasta);
    if (modalEpPicker === 'fer_ymd') return parseYmdToLocalDate(modalEpYmdRecDesde);
    return parseYmdToLocalDate(modalEpYmdRecHasta);
  };

  const applyModalEpPickerResult = (slot: ModalEpPickerSlot, selected: Date) => {
    const nextY = ymd(selected);
    const nextT = hm(selected);
    if (slot.endsWith('_hm')) {
      if (slot === 'hee_hm') setModalEpHmEntradaEntrega(nextT);
      else if (slot === 'hse_hm') setModalEpHmSalidaEntrega(nextT);
      else if (slot === 'her_hm') setModalEpHmEntradaRecibe(nextT);
      else setModalEpHmSalidaRecibe(nextT);
    } else {
      if (slot === 'fee_ymd') setModalEpYmdEntDesde(nextY);
      else if (slot === 'fse_ymd') setModalEpYmdEntHasta(nextY);
      else if (slot === 'fer_ymd') setModalEpYmdRecDesde(nextY);
      else setModalEpYmdRecHasta(nextY);
    }
  };

  const getIncidentPickerValue = (slot: IncidentPickerSlot): Date => {
    if (slot === 'list_sol_desde_ymd') return listIncSolDesdeD || horaAccionPickerBase;
    if (slot === 'list_sol_desde_hm') return listIncSolDesdeT || new Date(2000, 0, 1, 0, 0);
    if (slot === 'list_sol_hasta_ymd') return listIncSolHastaD || horaAccionPickerBase;
    if (slot === 'list_sol_hasta_hm') return listIncSolHastaT || new Date(2000, 0, 1, 23, 59);
    if (slot === 'list_real_desde_ymd') return listIncRealDesdeD || horaAccionPickerBase;
    if (slot === 'list_real_desde_hm') return listIncRealDesdeT || new Date(2000, 0, 1, 0, 0);
    if (slot === 'list_real_hasta_ymd') return listIncRealHastaD || horaAccionPickerBase;
    if (slot === 'list_real_hasta_hm') return listIncRealHastaT || new Date(2000, 0, 1, 23, 59);
    if (slot === 'modal_sol_desde_ymd') return modalIncSolDesdeD || horaAccionPickerBase;
    if (slot === 'modal_sol_desde_hm') return modalIncSolDesdeT || new Date(2000, 0, 1, 0, 0);
    if (slot === 'modal_sol_hasta_ymd') return modalIncSolHastaD || horaAccionPickerBase;
    if (slot === 'modal_sol_hasta_hm') return modalIncSolHastaT || new Date(2000, 0, 1, 23, 59);
    if (slot === 'modal_real_desde_ymd') return modalIncRealDesdeD || horaAccionPickerBase;
    if (slot === 'modal_real_desde_hm') return modalIncRealDesdeT || new Date(2000, 0, 1, 0, 0);
    if (slot === 'modal_real_hasta_ymd') return modalIncRealHastaD || horaAccionPickerBase;
    return modalIncRealHastaT || new Date(2000, 0, 1, 23, 59);
  };

  const applyIncidentPickerResult = (slot: IncidentPickerSlot, selected: Date) => {
    if (slot === 'list_sol_desde_ymd') setListIncSolDesdeD(selected);
    else if (slot === 'list_sol_desde_hm') setListIncSolDesdeT(selected);
    else if (slot === 'list_sol_hasta_ymd') setListIncSolHastaD(selected);
    else if (slot === 'list_sol_hasta_hm') setListIncSolHastaT(selected);
    else if (slot === 'list_real_desde_ymd') setListIncRealDesdeD(selected);
    else if (slot === 'list_real_desde_hm') setListIncRealDesdeT(selected);
    else if (slot === 'list_real_hasta_ymd') setListIncRealHastaD(selected);
    else if (slot === 'list_real_hasta_hm') setListIncRealHastaT(selected);
    else if (slot === 'modal_sol_desde_ymd') setModalIncSolDesdeD(selected);
    else if (slot === 'modal_sol_desde_hm') setModalIncSolDesdeT(selected);
    else if (slot === 'modal_sol_hasta_ymd') setModalIncSolHastaD(selected);
    else if (slot === 'modal_sol_hasta_hm') setModalIncSolHastaT(selected);
    else if (slot === 'modal_real_desde_ymd') setModalIncRealDesdeD(selected);
    else if (slot === 'modal_real_desde_hm') setModalIncRealDesdeT(selected);
    else if (slot === 'modal_real_hasta_ymd') setModalIncRealHastaD(selected);
    else setModalIncRealHastaT(selected);
  };

  const runPreview = async () => {
    if (previewLoading) return;
    const ok = await getOnline();
    if (!ok) {
      Alert.alert('Sin conexión', 'Se requiere internet.');
      return;
    }
    setPreviewLoading(true);
    try {
      let res: { status: boolean; message?: string; data?: any[] } = { status: false };
      if (formModulo === MODULO_INGRESOS) {
        if (!modalDesdeD || !modalDesdeT || !modalHastaD || !modalHastaT) {
          Alert.alert('Filtros', 'Complete fechas y horas desde/hasta.');
          return;
        }
        const mf: Record<string, unknown> = {
          creadoDesde: combineDateAndTime(ymd(modalDesdeD), hm(modalDesdeT)),
          creadoHasta: combineDateAndTime(ymd(modalHastaD), hm(modalHastaT)),
          soloMultiDispositivo: modalMultiDevice,
        };
        if (modalUsuariosSelected.length > 0) {
          mf.empleadoIngresoIds = modalUsuariosSelected.map((u) => Number(u.id));
        }
        res = await previewUserLoginRefreshTokens({
          moduleFilters: mf,
          order_by: formOrder,
          refreshAccessToken,
          logout,
        });
      } else if (formModulo === MODULO_ACCIONES_PERSONALES) {
        const mf: Record<string, unknown> = {
          empleadoIds: modalAccEmpleadoSelected.map((x) => x.id),
          empresaIds: modalEmpresaSelected.map((x) => x.id),
          clienteIds: modalClienteSelected.map((x) => x.id),
          divisionIds: modalDivisionSelected.map((x) => x.id),
          contratoIds: modalContratoSelected.map((x) => x.id),
          corpoIds: modalCorpoSelected.map((x) => x.id),
          puestoIds: modalPuestoSelected.map((x) => x.id),
          plazaIds: modalAccPlazaSelected.map((x) => x.id),
        };
        res = await previewAccionesPersonales({
          moduleFilters: mf,
          order_by: formOrder,
          refreshAccessToken,
          logout,
        });
      } else if (
        formModulo === MODULO_ACTA_ENTREGA ||
        formModulo === MODULO_ENTREGA_PUESTO ||
        formModulo === MODULO_AGENDA_MINUTA ||
        formModulo === MODULO_APERTURA_CIERRE ||
        formModulo === MODULO_VULNERABILIDAD ||
        formModulo === MODULO_ACTIVIDADES ||
        formModulo === MODULO_CONTROL_ASISTENCIA ||
        formModulo === MODULO_DOCUMENTOS_ENTREGADOS ||
        formModulo === MODULO_ENCUESTA_SATISFACCION ||
        formModulo === MODULO_REGISTRO_VISITAS ||
        formModulo === MODULO_MUTUOS_ACUERDOS ||
        formModulo === MODULO_EVALUACION_PERSONAL ||
        formModulo === MODULO_PRODUCTO_NO_CONFORME ||
        formModulo === MODULO_REGISTRO_INDUCCION_RECORRIDO ||
        formModulo === MODULO_MANUALES_PUESTO ||
        formModulo === MODULO_INCIDENTES ||
        formModulo === MODULO_LLAVES ||
        formModulo === MODULO_LLAVEROS ||
        formModulo === MODULO_BITACORA_NOVEDADES ||
        formModulo === MODULO_MAESTRO_QUEJAS ||
        formModulo === MODULO_CHECKLIST_SUPERVISION
      ) {
        if (!modalActaDesdeD || !modalActaDesdeT || !modalActaHastaD || !modalActaHastaT) {
          Alert.alert('Filtros', 'Complete fechas y horas desde/hasta.');
          return;
        }
        const mf: Record<string, unknown> =
          formModulo === MODULO_MUTUOS_ACUERDOS
            ? {
                fechaReporteDesde: combineDateAndTime(ymd(modalActaDesdeD), hm(modalActaDesdeT)),
                fechaReporteHasta: combineDateAndTime(ymd(modalActaHastaD), hm(modalActaHastaT)),
                empresaIds: modalEmpresaSelected.map((x) => x.id),
                clienteIds: modalClienteSelected.map((x) => x.id),
                divisionIds: modalDivisionSelected.map((x) => x.id),
                contratoIds: modalContratoSelected.map((x) => x.id),
                corpoIds: modalCorpoSelected.map((x) => x.id),
                puestoIds: modalPuestoSelected.map((x) => x.id),
                empleadoAusenteIds: modalMutAusenteSelected.map((x) => x.id),
                empleadoReemplazaIds: modalMutReemplazaSelected.map((x) => x.id),
                ejecutivoCuentaIds: modalMutEjecutivoSelected.map((x) => x.id),
                ...(modalMutEstado !== 'todos' ? { estado: modalMutEstado } : {}),
              }
            : {
                creadoDesde: combineDateAndTime(ymd(modalActaDesdeD), hm(modalActaDesdeT)),
                creadoHasta: combineDateAndTime(ymd(modalActaHastaD), hm(modalActaHastaT)),
                empresaIds: modalEmpresaSelected.map((x) => x.id),
                clienteIds: modalClienteSelected.map((x) => x.id),
                divisionIds: modalDivisionSelected.map((x) => x.id),
                contratoIds: modalContratoSelected.map((x) => x.id),
                corpoIds: modalCorpoSelected.map((x) => x.id),
                puestoIds: modalPuestoSelected.map((x) => x.id),
              };
        if (formModulo === MODULO_AGENDA_MINUTA) {
          mf.estadoMinuta = modalAgendaEstado;
        }
        if (formModulo === MODULO_APERTURA_CIERRE) {
          mf.tipo = modalAcpTipo;
          if (modalUsuariosSelected.length > 0) {
            mf.createdByIds = modalUsuariosSelected.map((u) => Number(u.id));
          }
        }
        if (formModulo === MODULO_CONTROL_ASISTENCIA && modalAsisTurno !== 'todos') {
          mf.tipoTurno = modalAsisTurno;
        }
        if (formModulo === MODULO_DOCUMENTOS_ENTREGADOS && modalDocTipo !== 'todos') {
          mf.tipoDocumento = modalDocTipo;
        }
        if (formModulo === MODULO_ENCUESTA_SATISFACCION && modalEncResponsableSelected.length > 0) {
          mf.responsableIds = modalEncResponsableSelected.map((e) => Number(e.id));
        }
        if (formModulo === MODULO_REGISTRO_VISITAS) {
          if (modalRvCedulaVisitante.trim() !== '') mf.cedulaVisitante = modalRvCedulaVisitante.trim();
          if (modalRvTipoVisitante !== 'todos') mf.tipoVisitante = modalRvTipoVisitante;
          if (modalRvResponsableSelected.length > 0) mf.responsableIds = modalRvResponsableSelected.map((e) => Number(e.id));
        }
        if (formModulo === MODULO_EVALUACION_PERSONAL) {
          if (modalEvpEmpEvalSelected.length > 0) mf.empleadoEvaluadoIds = modalEvpEmpEvalSelected.map((e) => Number(e.id));
          if (modalEvpEvaluadorSelected.length > 0) mf.evaluadorIds = modalEvpEvaluadorSelected.map((e) => Number(e.id));
          if (modalEvpTipoEvaluacion !== 'todos') mf.tipoEvaluacion = modalEvpTipoEvaluacion;
        }
        if (formModulo === MODULO_PRODUCTO_NO_CONFORME && modalPncTipoServicio !== 'todos') {
          mf.tipoServicioNoConforme = modalPncTipoServicio;
        }
        if (formModulo === MODULO_REGISTRO_INDUCCION_RECORRIDO) {
          if (modalIrResponsableSelected.length > 0) mf.responsableEmpleadoIds = modalIrResponsableSelected.map((e) => Number(e.id));
          if (modalIrEmpleadoSelected.length > 0) mf.empleadoIds = modalIrEmpleadoSelected.map((e) => Number(e.id));
          if (modalIrParticipanteCedulas.length > 0) mf.participanteCedulas = [...modalIrParticipanteCedulas];
        }
        if (formModulo === MODULO_INCIDENTES) {
          if (modalIncSolDesdeD && modalIncSolDesdeT) mf.solucionadoDesde = combineDateAndTime(ymd(modalIncSolDesdeD), hm(modalIncSolDesdeT));
          if (modalIncSolHastaD && modalIncSolHastaT) mf.solucionadoHasta = combineDateAndTime(ymd(modalIncSolHastaD), hm(modalIncSolHastaT));
          if (modalIncRealDesdeD && modalIncRealDesdeT)
            mf.solucionadoRealDesde = combineDateAndTime(ymd(modalIncRealDesdeD), hm(modalIncRealDesdeT));
          if (modalIncRealHastaD && modalIncRealHastaT)
            mf.solucionadoRealHasta = combineDateAndTime(ymd(modalIncRealHastaD), hm(modalIncRealHastaT));
          if (modalIncClasificacion !== 'todos') mf.clasificacionId = Number(modalIncClasificacion);
          if (modalIncEstado === 'solucionado') mf.estado = true;
          if (modalIncEstado === 'no_solucionado') mf.estado = false;
        }
        if (formModulo === MODULO_LLAVES) {
          mf.llaveroIds = modalLlaveroSelected.map((x) => x.id);
          if (modalLlvEntregadoPor.trim() !== '') mf.entregadoPorContains = modalLlvEntregadoPor.trim();
          if (modalLlvRecibidoPor.trim() !== '') mf.recibidoPorContains = modalLlvRecibidoPor.trim();
        }
        if (formModulo === MODULO_LLAVEROS) {
          if (modalLlrEntregadoPor.trim() !== '') mf.entregadoPorContains = modalLlrEntregadoPor.trim();
          if (modalLlrRecibidoPor.trim() !== '') mf.recibidoPorContains = modalLlrRecibidoPor.trim();
        }
        if (formModulo === MODULO_BITACORA_NOVEDADES) {
          if (modalBnvCategoriaId !== 'todos') mf.categoriaId = Number(modalBnvCategoriaId);
          if (modalBnvRelevancia !== 'todos') mf.relevancia = modalBnvRelevancia;
        }
        if (formModulo === MODULO_MAESTRO_QUEJAS) {
          if (modalMqMedioRecepcion !== 'todos') mf.medioRecepcionQueja = modalMqMedioRecepcion;
          if (modalMqTipoQueja !== 'todos') mf.tipoQueja = modalMqTipoQueja;
          if (modalMqNivelQueja !== 'todos') mf.nivelQueja = modalMqNivelQueja;
        }
        if (formModulo === MODULO_INCIDENTES || formModulo === MODULO_CHECKLIST_SUPERVISION) {
          mf.fechaReporteDesde = mf.creadoDesde;
          mf.fechaReporteHasta = mf.creadoHasta;
          delete mf.creadoDesde;
          delete mf.creadoHasta;
          mf.ejecutivoCuentaIds = modalEjecutivoSelected.map((x) => x.id);
        }
        const epTrim = (s: string) => s.trim();
        if (formModulo === MODULO_ENTREGA_PUESTO) {
          if (epTrim(modalEpOficialEntrega)) mf.oficialEntregaContains = epTrim(modalEpOficialEntrega);
          if (epTrim(modalEpOficialRecibe)) mf.oficialRecibeContains = epTrim(modalEpOficialRecibe);
          if (epTrim(modalEpTurnoEntrega)) mf.turnoEntregaContains = epTrim(modalEpTurnoEntrega);
          if (epTrim(modalEpTurnoRecibe)) mf.turnoRecibeContains = epTrim(modalEpTurnoRecibe);
          if (epTrim(modalEpYmdEntDesde) && ymdOkStr(modalEpYmdEntDesde)) mf.fechaEntradaEntregaYmd = epTrim(modalEpYmdEntDesde);
          if (epTrim(modalEpYmdEntHasta) && ymdOkStr(modalEpYmdEntHasta)) mf.fechaSalidaEntregaYmd = epTrim(modalEpYmdEntHasta);
          if (epTrim(modalEpYmdRecDesde) && ymdOkStr(modalEpYmdRecDesde)) mf.fechaEntradaRecibeYmd = epTrim(modalEpYmdRecDesde);
          if (epTrim(modalEpYmdRecHasta) && ymdOkStr(modalEpYmdRecHasta)) mf.fechaSalidaRecibeYmd = epTrim(modalEpYmdRecHasta);
          if (epTrim(modalEpHmEntradaEntrega) && hmOkStr(modalEpHmEntradaEntrega)) mf.horaEntradaEntregaHm = epTrim(modalEpHmEntradaEntrega);
          if (epTrim(modalEpHmSalidaEntrega) && hmOkStr(modalEpHmSalidaEntrega)) mf.horaSalidaEntregaHm = epTrim(modalEpHmSalidaEntrega);
          if (epTrim(modalEpHmEntradaRecibe) && hmOkStr(modalEpHmEntradaRecibe)) mf.horaEntradaRecibeHm = epTrim(modalEpHmEntradaRecibe);
          if (epTrim(modalEpHmSalidaRecibe) && hmOkStr(modalEpHmSalidaRecibe)) mf.horaSalidaRecibeHm = epTrim(modalEpHmSalidaRecibe);
        }
        if (formModulo === MODULO_AGENDA_MINUTA) {
          res = await previewAgendaMinuta({
            moduleFilters: mf,
            order_by: formOrder,
            refreshAccessToken,
            logout,
          });
        } else if (formModulo === MODULO_APERTURA_CIERRE) {
          res = await previewAperturaCierrePuesto({
            moduleFilters: mf,
            order_by: formOrder,
            refreshAccessToken,
            logout,
          });
        } else if (formModulo === MODULO_VULNERABILIDAD) {
          res = await previewVulnerabilidad({
            moduleFilters: mf,
            order_by: formOrder,
            refreshAccessToken,
            logout,
          });
        } else if (formModulo === MODULO_ACTIVIDADES) {
          res = await previewActividades({
            moduleFilters: mf,
            order_by: formOrder,
            refreshAccessToken,
            logout,
          });
        } else if (formModulo === MODULO_CONTROL_ASISTENCIA) {
          res = await previewControlAsistencia({
            moduleFilters: mf,
            order_by: formOrder,
            refreshAccessToken,
            logout,
          });
        } else if (formModulo === MODULO_DOCUMENTOS_ENTREGADOS) {
          res = await previewDocumentosEntregados({
            moduleFilters: mf,
            order_by: formOrder,
            refreshAccessToken,
            logout,
          });
        } else if (formModulo === MODULO_ENCUESTA_SATISFACCION) {
          res = await previewEncuestaSatisfaccion({
            moduleFilters: mf,
            order_by: formOrder,
            refreshAccessToken,
            logout,
          });
        } else if (formModulo === MODULO_REGISTRO_VISITAS) {
          res = await previewRegistroVisitas({
            moduleFilters: mf,
            order_by: formOrder,
            refreshAccessToken,
            logout,
          });
        } else if (formModulo === MODULO_EVALUACION_PERSONAL) {
          res = await previewEvaluacionPersonal({
            moduleFilters: mf,
            order_by: formOrder,
            refreshAccessToken,
            logout,
          });
        } else if (formModulo === MODULO_PRODUCTO_NO_CONFORME) {
          res = await previewProductoNoConforme({
            moduleFilters: mf,
            order_by: formOrder,
            refreshAccessToken,
            logout,
          });
        } else if (formModulo === MODULO_REGISTRO_INDUCCION_RECORRIDO) {
          res = await previewInduccionRecorrido({
            moduleFilters: mf,
            order_by: formOrder,
            refreshAccessToken,
            logout,
          });
        } else if (formModulo === MODULO_MANUALES_PUESTO) {
          res = await previewManualesPuesto({
            moduleFilters: mf,
            order_by: formOrder,
            refreshAccessToken,
            logout,
          });
        } else if (formModulo === MODULO_MUTUOS_ACUERDOS) {
          res = await previewMutuosAcuerdos({
            moduleFilters: mf,
            order_by: formOrder,
            refreshAccessToken,
            logout,
          });
        } else if (formModulo === MODULO_INCIDENTES) {
          res = await previewIncidentes({
            moduleFilters: mf,
            order_by: formOrder,
            refreshAccessToken,
            logout,
          });
        } else if (formModulo === MODULO_CHECKLIST_SUPERVISION) {
          res = await previewChecklistSupervision({
            moduleFilters: mf,
            order_by: formOrder,
            refreshAccessToken,
            logout,
          });
        } else if (formModulo === MODULO_LLAVES) {
          res = await previewLlaves({
            moduleFilters: mf,
            order_by: formOrder,
            refreshAccessToken,
            logout,
          });
        } else if (formModulo === MODULO_LLAVEROS) {
          res = await previewLlaveros({
            moduleFilters: mf,
            order_by: formOrder,
            refreshAccessToken,
            logout,
          });
        } else if (formModulo === MODULO_BITACORA_NOVEDADES) {
          res = await previewBitacoraNovedades({
            moduleFilters: mf,
            order_by: formOrder,
            refreshAccessToken,
            logout,
          });
        } else if (formModulo === MODULO_MAESTRO_QUEJAS) {
          res = await previewMaestroQuejas({
            moduleFilters: mf,
            order_by: formOrder,
            refreshAccessToken,
            logout,
          });
        } else if (formModulo === MODULO_ENTREGA_PUESTO) {
          res = await previewEntregaPuesto({
            moduleFilters: mf,
            order_by: formOrder,
            refreshAccessToken,
            logout,
          });
        } else {
          res = await previewActaEntregaProductos({
            moduleFilters: mf,
            order_by: formOrder,
            refreshAccessToken,
            logout,
          });
        }
      }
      if (!res.status) {
        Alert.alert('Error', res.message || 'Preview falló');
        return;
      }
      setPreviewRows(res.data || []);
      setPreviewOpen(true);
    } finally {
      setPreviewLoading(false);
    }
  };

  const executeConfirmCreate = async () => {
    if (submitReportLoading) return;
    setSubmitReportLoading(true);
    try {
      const ok = await getOnline();
      if (!ok) {
        Alert.alert('Sin conexión', 'Se requiere internet.');
        return;
      }
      const moduleFilters: Record<string, unknown> = {};
      if (formModulo === MODULO_INGRESOS) {
        if (!modalDesdeD || !modalDesdeT || !modalHastaD || !modalHastaT) {
          Alert.alert('Filtros', 'Complete fechas y horas desde/hasta.');
          return;
        }
        moduleFilters.creadoDesde = combineDateAndTime(ymd(modalDesdeD), hm(modalDesdeT));
        moduleFilters.creadoHasta = combineDateAndTime(ymd(modalHastaD), hm(modalHastaT));
        moduleFilters.soloMultiDispositivo = modalMultiDevice;
        if (modalUsuariosSelected.length > 0) {
          moduleFilters.empleadoIngresoIds = modalUsuariosSelected.map((u) => Number(u.id));
        }
      } else if (formModulo === MODULO_ACCIONES_PERSONALES) {
        moduleFilters.empleadoIds = modalAccEmpleadoSelected.map((x) => x.id);
        moduleFilters.empresaIds = modalEmpresaSelected.map((x) => x.id);
        moduleFilters.clienteIds = modalClienteSelected.map((x) => x.id);
        moduleFilters.divisionIds = modalDivisionSelected.map((x) => x.id);
        moduleFilters.contratoIds = modalContratoSelected.map((x) => x.id);
        moduleFilters.corpoIds = modalCorpoSelected.map((x) => x.id);
        moduleFilters.puestoIds = modalPuestoSelected.map((x) => x.id);
        moduleFilters.plazaIds = modalAccPlazaSelected.map((x) => x.id);
      } else if (
        formModulo === MODULO_ACTA_ENTREGA ||
        formModulo === MODULO_ENTREGA_PUESTO ||
        formModulo === MODULO_AGENDA_MINUTA ||
        formModulo === MODULO_APERTURA_CIERRE ||
        formModulo === MODULO_VULNERABILIDAD ||
        formModulo === MODULO_ACTIVIDADES ||
        formModulo === MODULO_CONTROL_ASISTENCIA ||
        formModulo === MODULO_DOCUMENTOS_ENTREGADOS ||
        formModulo === MODULO_ENCUESTA_SATISFACCION ||
        formModulo === MODULO_REGISTRO_VISITAS ||
        formModulo === MODULO_MUTUOS_ACUERDOS ||
        formModulo === MODULO_EVALUACION_PERSONAL ||
        formModulo === MODULO_PRODUCTO_NO_CONFORME ||
        formModulo === MODULO_REGISTRO_INDUCCION_RECORRIDO ||
        formModulo === MODULO_MANUALES_PUESTO ||
        formModulo === MODULO_INCIDENTES ||
        formModulo === MODULO_LLAVES ||
        formModulo === MODULO_LLAVEROS ||
        formModulo === MODULO_BITACORA_NOVEDADES ||
        formModulo === MODULO_MAESTRO_QUEJAS ||
        formModulo === MODULO_CHECKLIST_SUPERVISION
      ) {
        if (!modalActaDesdeD || !modalActaDesdeT || !modalActaHastaD || !modalActaHastaT) {
          Alert.alert('Filtros', 'Complete fechas y horas desde/hasta.');
          return;
        }
        moduleFilters.creadoDesde = combineDateAndTime(ymd(modalActaDesdeD), hm(modalActaDesdeT));
        moduleFilters.creadoHasta = combineDateAndTime(ymd(modalActaHastaD), hm(modalActaHastaT));
        moduleFilters.empresaIds = modalEmpresaSelected.map((x) => x.id);
        moduleFilters.clienteIds = modalClienteSelected.map((x) => x.id);
        moduleFilters.divisionIds = modalDivisionSelected.map((x) => x.id);
        moduleFilters.contratoIds = modalContratoSelected.map((x) => x.id);
        moduleFilters.corpoIds = modalCorpoSelected.map((x) => x.id);
        moduleFilters.puestoIds = modalPuestoSelected.map((x) => x.id);
        if (formModulo === MODULO_MUTUOS_ACUERDOS) {
          moduleFilters.fechaReporteDesde = moduleFilters.creadoDesde;
          moduleFilters.fechaReporteHasta = moduleFilters.creadoHasta;
          delete moduleFilters.creadoDesde;
          delete moduleFilters.creadoHasta;
          moduleFilters.empleadoAusenteIds = modalMutAusenteSelected.map((x) => x.id);
          moduleFilters.empleadoReemplazaIds = modalMutReemplazaSelected.map((x) => x.id);
          moduleFilters.ejecutivoCuentaIds = modalMutEjecutivoSelected.map((x) => x.id);
          if (modalMutEstado !== 'todos') moduleFilters.estado = modalMutEstado;
        }
        if (formModulo === MODULO_AGENDA_MINUTA) {
          moduleFilters.estadoMinuta = modalAgendaEstado;
        }
        if (formModulo === MODULO_APERTURA_CIERRE) {
          moduleFilters.tipo = modalAcpTipo;
          if (modalUsuariosSelected.length > 0) {
            moduleFilters.createdByIds = modalUsuariosSelected.map((u) => Number(u.id));
          }
        }
        if (formModulo === MODULO_CONTROL_ASISTENCIA && modalAsisTurno !== 'todos') {
          moduleFilters.tipoTurno = modalAsisTurno;
        }
        if (formModulo === MODULO_DOCUMENTOS_ENTREGADOS && modalDocTipo !== 'todos') {
          moduleFilters.tipoDocumento = modalDocTipo;
        }
        if (formModulo === MODULO_ENCUESTA_SATISFACCION && modalEncResponsableSelected.length > 0) {
          moduleFilters.responsableIds = modalEncResponsableSelected.map((e) => Number(e.id));
        }
        if (formModulo === MODULO_REGISTRO_VISITAS) {
          if (modalRvCedulaVisitante.trim() !== '') moduleFilters.cedulaVisitante = modalRvCedulaVisitante.trim();
          if (modalRvTipoVisitante !== 'todos') moduleFilters.tipoVisitante = modalRvTipoVisitante;
          if (modalRvResponsableSelected.length > 0) moduleFilters.responsableIds = modalRvResponsableSelected.map((e) => Number(e.id));
        }
        if (formModulo === MODULO_EVALUACION_PERSONAL) {
          if (modalEvpEmpEvalSelected.length > 0) moduleFilters.empleadoEvaluadoIds = modalEvpEmpEvalSelected.map((e) => Number(e.id));
          if (modalEvpEvaluadorSelected.length > 0) moduleFilters.evaluadorIds = modalEvpEvaluadorSelected.map((e) => Number(e.id));
          if (modalEvpTipoEvaluacion !== 'todos') moduleFilters.tipoEvaluacion = modalEvpTipoEvaluacion;
        }
        if (formModulo === MODULO_PRODUCTO_NO_CONFORME && modalPncTipoServicio !== 'todos') {
          moduleFilters.tipoServicioNoConforme = modalPncTipoServicio;
        }
        if (formModulo === MODULO_REGISTRO_INDUCCION_RECORRIDO) {
          if (modalIrResponsableSelected.length > 0)
            moduleFilters.responsableEmpleadoIds = modalIrResponsableSelected.map((e) => Number(e.id));
          if (modalIrEmpleadoSelected.length > 0) moduleFilters.empleadoIds = modalIrEmpleadoSelected.map((e) => Number(e.id));
          if (modalIrParticipanteCedulas.length > 0) moduleFilters.participanteCedulas = [...modalIrParticipanteCedulas];
        }
        if (formModulo === MODULO_INCIDENTES) {
          if (modalIncSolDesdeD && modalIncSolDesdeT)
            moduleFilters.solucionadoDesde = combineDateAndTime(ymd(modalIncSolDesdeD), hm(modalIncSolDesdeT));
          if (modalIncSolHastaD && modalIncSolHastaT)
            moduleFilters.solucionadoHasta = combineDateAndTime(ymd(modalIncSolHastaD), hm(modalIncSolHastaT));
          if (modalIncRealDesdeD && modalIncRealDesdeT)
            moduleFilters.solucionadoRealDesde = combineDateAndTime(ymd(modalIncRealDesdeD), hm(modalIncRealDesdeT));
          if (modalIncRealHastaD && modalIncRealHastaT)
            moduleFilters.solucionadoRealHasta = combineDateAndTime(ymd(modalIncRealHastaD), hm(modalIncRealHastaT));
          if (modalIncClasificacion !== 'todos') moduleFilters.clasificacionId = Number(modalIncClasificacion);
          if (modalIncEstado === 'solucionado') moduleFilters.estado = true;
          if (modalIncEstado === 'no_solucionado') moduleFilters.estado = false;
        }
        if (formModulo === MODULO_LLAVES) {
          moduleFilters.llaveroIds = modalLlaveroSelected.map((x) => x.id);
          if (modalLlvEntregadoPor.trim() !== '') moduleFilters.entregadoPorContains = modalLlvEntregadoPor.trim();
          if (modalLlvRecibidoPor.trim() !== '') moduleFilters.recibidoPorContains = modalLlvRecibidoPor.trim();
        }
        if (formModulo === MODULO_LLAVEROS) {
          if (modalLlrEntregadoPor.trim() !== '') moduleFilters.entregadoPorContains = modalLlrEntregadoPor.trim();
          if (modalLlrRecibidoPor.trim() !== '') moduleFilters.recibidoPorContains = modalLlrRecibidoPor.trim();
        }
        if (formModulo === MODULO_BITACORA_NOVEDADES) {
          if (modalBnvCategoriaId !== 'todos') moduleFilters.categoriaId = Number(modalBnvCategoriaId);
          if (modalBnvRelevancia !== 'todos') moduleFilters.relevancia = modalBnvRelevancia;
        }
        if (formModulo === MODULO_MAESTRO_QUEJAS) {
          if (modalMqMedioRecepcion !== 'todos') moduleFilters.medioRecepcionQueja = modalMqMedioRecepcion;
          if (modalMqTipoQueja !== 'todos') moduleFilters.tipoQueja = modalMqTipoQueja;
          if (modalMqNivelQueja !== 'todos') moduleFilters.nivelQueja = modalMqNivelQueja;
        }
        if (formModulo === MODULO_INCIDENTES || formModulo === MODULO_CHECKLIST_SUPERVISION) {
          moduleFilters.fechaReporteDesde = moduleFilters.creadoDesde as string;
          moduleFilters.fechaReporteHasta = moduleFilters.creadoHasta as string;
          delete moduleFilters.creadoDesde;
          delete moduleFilters.creadoHasta;
          moduleFilters.ejecutivoCuentaIds = modalEjecutivoSelected.map((x) => x.id);
        }
        if (formModulo === MODULO_ENTREGA_PUESTO) {
          const epTrim = (s: string) => s.trim();
          if (epTrim(modalEpOficialEntrega)) moduleFilters.oficialEntregaContains = epTrim(modalEpOficialEntrega);
          if (epTrim(modalEpOficialRecibe)) moduleFilters.oficialRecibeContains = epTrim(modalEpOficialRecibe);
          if (epTrim(modalEpTurnoEntrega)) moduleFilters.turnoEntregaContains = epTrim(modalEpTurnoEntrega);
          if (epTrim(modalEpTurnoRecibe)) moduleFilters.turnoRecibeContains = epTrim(modalEpTurnoRecibe);
          if (epTrim(modalEpYmdEntDesde) && ymdOkStr(modalEpYmdEntDesde)) moduleFilters.fechaEntradaEntregaYmd = epTrim(modalEpYmdEntDesde);
          if (epTrim(modalEpYmdEntHasta) && ymdOkStr(modalEpYmdEntHasta)) moduleFilters.fechaSalidaEntregaYmd = epTrim(modalEpYmdEntHasta);
          if (epTrim(modalEpYmdRecDesde) && ymdOkStr(modalEpYmdRecDesde)) moduleFilters.fechaEntradaRecibeYmd = epTrim(modalEpYmdRecDesde);
          if (epTrim(modalEpYmdRecHasta) && ymdOkStr(modalEpYmdRecHasta)) moduleFilters.fechaSalidaRecibeYmd = epTrim(modalEpYmdRecHasta);
          if (epTrim(modalEpHmEntradaEntrega) && hmOkStr(modalEpHmEntradaEntrega))
            moduleFilters.horaEntradaEntregaHm = epTrim(modalEpHmEntradaEntrega);
          if (epTrim(modalEpHmSalidaEntrega) && hmOkStr(modalEpHmSalidaEntrega))
            moduleFilters.horaSalidaEntregaHm = epTrim(modalEpHmSalidaEntrega);
          if (epTrim(modalEpHmEntradaRecibe) && hmOkStr(modalEpHmEntradaRecibe))
            moduleFilters.horaEntradaRecibeHm = epTrim(modalEpHmEntradaRecibe);
          if (epTrim(modalEpHmSalidaRecibe) && hmOkStr(modalEpHmSalidaRecibe))
            moduleFilters.horaSalidaRecibeHm = epTrim(modalEpHmSalidaRecibe);
        }
      }

      const res = await createReportJob({
        body: {
          nombre: formNombre.trim(),
          numero: formNumero.trim(),
          nomenclatura: formNomenclatura.trim(),
          descripcion: formDescripcion.trim(),
          modulo: formModulo,
          tipo_reporte:
            formModulo === MODULO_INGRESOS ||
            formModulo === MODULO_ACCIONES_PERSONALES ||
            formModulo === MODULO_BITACORA_NOVEDADES ||
            formModulo === MODULO_CHECKLIST_SUPERVISION ||
            formModulo === MODULO_EVALUACION_PERSONAL ||
            formModulo === MODULO_MANUALES_PUESTO
              ? 'Consolidado' // Consolidado
              : formModulo === MODULO_ACTA_ENTREGA ||
                  formModulo === MODULO_ENTREGA_PUESTO ||
                  formModulo === MODULO_AGENDA_MINUTA ||
                  formModulo === MODULO_APERTURA_CIERRE ||
                  formModulo === MODULO_VULNERABILIDAD ||
                  formModulo === MODULO_ACTIVIDADES ||
                  formModulo === MODULO_CONTROL_ASISTENCIA ||
                  formModulo === MODULO_DOCUMENTOS_ENTREGADOS ||
                  formModulo === MODULO_ENCUESTA_SATISFACCION ||
                  formModulo === MODULO_REGISTRO_VISITAS ||
                  formModulo === MODULO_MUTUOS_ACUERDOS ||
                  formModulo === MODULO_INCIDENTES ||
                  formModulo === MODULO_LLAVES ||
                  formModulo === MODULO_LLAVEROS ||
                  formModulo === MODULO_MAESTRO_QUEJAS ||
                  formModulo === MODULO_PRODUCTO_NO_CONFORME ||
                  formModulo === MODULO_REGISTRO_INDUCCION_RECORRIDO
                ? formTipoReporte
                : 'Consolidado', // Consolidado
          order_by: formOrder,
          firma_responsable: firmaModal.trim(),
          moduleFilters,
        },
        refreshAccessToken,
        logout,
      });
      if (!res.status) {
        Alert.alert('Error', res.message || 'No se pudo crear');
        return;
      }
      Alert.alert('Reporte', res.message || 'Se encoló el reporte.');
      setModalVisible(false);
      resetNewReportForm();
      void loadLista();
    } finally {
      setSubmitReportLoading(false);
    }
  };

  const confirmCreate = async () => {
    if (!formNombre.trim() || !formNumero.trim() || !formNomenclatura.trim()) {
      Alert.alert('Formulario', 'Nombre, número y nomenclatura son obligatorios.');
      return;
    }
    if (!firmaModal.trim()) {
      Alert.alert('Firma', 'Agregue la firma del responsable.');
      return;
    }
    if (formModulo === MODULO_INGRESOS && (!modalDesdeD || !modalDesdeT || !modalHastaD || !modalHastaT)) {
      Alert.alert('Filtros', 'Complete fechas y horas desde/hasta.');
      return;
    }
    if (
      (formModulo === MODULO_ACTA_ENTREGA ||
        formModulo === MODULO_ENTREGA_PUESTO ||
        formModulo === MODULO_AGENDA_MINUTA ||
        formModulo === MODULO_APERTURA_CIERRE ||
        formModulo === MODULO_VULNERABILIDAD ||
        formModulo === MODULO_ACTIVIDADES ||
        formModulo === MODULO_CONTROL_ASISTENCIA ||
        formModulo === MODULO_DOCUMENTOS_ENTREGADOS ||
        formModulo === MODULO_ENCUESTA_SATISFACCION ||
        formModulo === MODULO_REGISTRO_VISITAS ||
        formModulo === MODULO_MUTUOS_ACUERDOS ||
        formModulo === MODULO_EVALUACION_PERSONAL ||
        formModulo === MODULO_PRODUCTO_NO_CONFORME ||
        formModulo === MODULO_REGISTRO_INDUCCION_RECORRIDO ||
        formModulo === MODULO_MANUALES_PUESTO ||
        formModulo === MODULO_INCIDENTES ||
        formModulo === MODULO_LLAVES ||
        formModulo === MODULO_LLAVEROS ||
        formModulo === MODULO_BITACORA_NOVEDADES ||
        formModulo === MODULO_MAESTRO_QUEJAS ||
        formModulo === MODULO_CHECKLIST_SUPERVISION) &&
      (!modalActaDesdeD || !modalActaDesdeT || !modalActaHastaD || !modalActaHastaT)
    ) {
      Alert.alert('Filtros', 'Complete fechas y horas desde/hasta.');
      return;
    }
    const okNet = await getOnline();
    if (!okNet) {
      Alert.alert('Sin conexión', 'Se requiere internet.');
      return;
    }

    Alert.alert('Confirmar reporte', '¿Desea crear el reporte con los datos ingresados?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Crear',
        style: 'default',
        onPress: () => {
          void executeConfirmCreate();
        },
      },
    ]);
  };

  const scanFirmaModal = async () => {
    try {
      const d = await scanQR();
      if (d) setFirmaModal(String(d));
    } catch {
      Alert.alert('Error', 'No se pudo leer el código QR');
    }
  };

  const generateFirma = async (target: 'modal') => {
    if (target !== 'modal') return;
    setGenFirmaLoading(true);
    try {
      const loc = location ?? (await requestLocation());
      if (!loc || !employee) {
        Alert.alert('Error', 'Ubicación o usuario no disponible');
        return;
      }
      const token = await getValidAccessTokenOrLogout({ refreshAccessToken, logout });
      if (!token) return;
      const decoded: any = jwtDecode(token);
      const sessionId = decoded.sessionId;
      const horaAccion = await getHoraAccionSafeMs();
      const hash = btoa(`${sessionId}:${employee.id}:${loc.coords.latitude}:${loc.coords.longitude}:${horaAccion}`);
      setFirmaModal(hash);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo generar firma');
    } finally {
      setGenFirmaLoading(false);
    }
  };

  const renderReportItem = ({ item }: { item: ReportRow }) => {
    const open = !!expandedRows[item.id];
    let filtersPretty: Record<string, unknown> = {};
    try {
      filtersPretty = JSON.parse(item.filters || '{}');
    } catch {
      filtersPretty = { raw: item.filters };
    }
    return (
      <ThemedView style={styles.card}>
        <TouchableOpacity onPress={() => toggleExpand(item.id)} activeOpacity={0.85}>
          <ThemedText style={styles.cardTitle}>
            {item.nombre} · {item.estado}
          </ThemedText>
          <ThemedText style={styles.mutedSmall}>
            #{item.numero} · {item.nomenclatura}
          </ThemedText>
        </TouchableOpacity>
        <ThemedText style={styles.cardLine}>
          <ThemedText style={styles.cardLabel}>Módulo: </ThemedText>
          <ThemedText style={styles.cardValue}>{item.modulo}</ThemedText>
        </ThemedText>
        <ThemedText style={styles.cardLine}>
          <ThemedText style={styles.cardLabel}>Tipo: </ThemedText>
          <ThemedText style={styles.cardValue}>{item.tipo_reporte}</ThemedText>
        </ThemedText>
        <ThemedText style={styles.cardLine}>
          <ThemedText style={styles.cardLabel}>Orden: </ThemedText>
          <ThemedText style={styles.cardValue}>{item.order_by}</ThemedText>
        </ThemedText>
        <ThemedText style={styles.cardLine}>
          <ThemedText style={styles.cardLabel}>Creado: </ThemedText>
          <ThemedText style={styles.cardValue}>{formatReportCreatedAt(item.created_at)}</ThemedText>
        </ThemedText>
        {item.descripcion ? (
          <ThemedText style={styles.cardLine}>
            <ThemedText style={styles.cardLabel}>Descripción: </ThemedText>
            <ThemedText style={styles.cardValue}>{item.descripcion}</ThemedText>
          </ThemedText>
        ) : null}
        <TouchableOpacity style={styles.collapseButton} onPress={() => toggleExpand(item.id)} activeOpacity={0.85}>
          <ThemedText style={styles.collapseButtonText}>Filtros (JSON)</ThemedText>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color="#007AFF" />
        </TouchableOpacity>
        {open ? (
          <ThemedView style={styles.collapseContent}>
            {Object.entries(filtersPretty).map(([k, v]) => (
              <ThemedText key={k} style={styles.detailText}>
                {k}: {typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v)}
              </ThemedText>
            ))}
          </ThemedView>
        ) : null}
        {item.estado === 'completado' ? (
          <TouchableOpacity style={[styles.actionBtn, styles.downloadBtn]} onPress={() => void openDownload(item)} activeOpacity={0.85}>
            <Ionicons name="download-outline" size={20} color="#fff" />
            <ThemedText style={styles.actionBtnText}>Descargar archivo</ThemedText>
          </TouchableOpacity>
        ) : null}
      </ThemedView>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <AppHeader title="Reportes" onMenuPress={() => setIsMenuVisible(true)} />

      {isOnline === false ? (
        <ThemedView style={styles.banner}>
          <ThemedText style={styles.bannerTxt}>Sin conexión a internet. Esta pantalla no está disponible.</ThemedText>
        </ThemedView>
      ) : null}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <ThemedView style={styles.content}>
          <ThemedView style={styles.titleContainer}>
            <ThemedText type="title" style={styles.title}>
              <Ionicons name="bar-chart" size={22} color="#000000" /> Reportes
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              Consulta y generación de reportes (Excel u otros tipos de archivo) desde el servidor
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.filtersContainer}>
            <ThemedView style={styles.filtersHeader}>
              <TouchableOpacity style={styles.filterToggleButton} onPress={() => setFiltersOpen(!filtersOpen)} activeOpacity={0.85}>
                <ThemedText style={styles.filtersTitle}>Filtros de búsqueda</ThemedText>
                <Ionicons name={filtersOpen ? 'chevron-up' : 'chevron-down'} size={20} color="#007AFF" />
              </TouchableOpacity>
              {filtersOpen ? (
                <TouchableOpacity style={styles.resetFiltersButton} onPress={resetListFilters} activeOpacity={0.85}>
                  <Ionicons name="refresh" size={16} color="#FF3B30" />
                  <ThemedText style={styles.resetFiltersText}>Reiniciar</ThemedText>
                </TouchableOpacity>
              ) : null}
            </ThemedView>

            {filtersOpen ? (
              <ThemedView style={styles.filtersContent}>
                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>Módulo</ThemedText>
                  <View style={styles.pickerWrapper}>
                    <Picker selectedValue={modulo} onValueChange={(v) => setModulo(String(v))} style={styles.picker}>
                      {MODULO_PICKER_OPTIONS.map((opt) => (
                        <Picker.Item key={opt.value} label={opt.label} value={opt.value} color="#000000" />
                      ))}
                    </Picker>
                  </View>
                </ThemedView>

                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>Nombre del reporte (aprox.)</ThemedText>
                  <TextInput
                    style={styles.input}
                    value={nombreBusqueda}
                    onChangeText={setNombreBusqueda}
                    placeholder="Buscar por nombre de reporte"
                    placeholderTextColor="#999"
                  />
                </ThemedView>

                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>Número del reporte (aprox.)</ThemedText>
                  <TextInput
                    style={styles.input}
                    value={numeroBusqueda}
                    onChangeText={setNumeroBusqueda}
                    placeholder="Buscar por número"
                    placeholderTextColor="#999"
                  />
                </ThemedView>

                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>Nomenclatura (aprox.)</ThemedText>
                  <TextInput
                    style={styles.input}
                    value={nomenclaturaBusqueda}
                    onChangeText={setNomenclaturaBusqueda}
                    placeholder="Buscar por nomenclatura"
                    placeholderTextColor="#999"
                  />
                </ThemedView>

                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>Descripción (aprox.)</ThemedText>
                  <TextInput
                    style={styles.input}
                    value={descripcionBusqueda}
                    onChangeText={setDescripcionBusqueda}
                    placeholder="Buscar por descripción"
                    placeholderTextColor="#999"
                  />
                </ThemedView>

                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>Tipo de reporte</ThemedText>
                  <View style={styles.pickerWrapper}>
                    <Picker selectedValue={tipoReporteBusqueda} onValueChange={(v) => setTipoReporteBusqueda(String(v))} style={styles.picker}>
                      <Picker.Item label="Todos" value="" color="#000000" />
                      <Picker.Item label="Individual" value="Individual" color="#000000" />
                      <Picker.Item label="Consolidado" value="Consolidado" color="#000000" />
                    </Picker>
                  </View>
                </ThemedView>

                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>Estado</ThemedText>
                  <View style={styles.pickerWrapper}>
                    <Picker selectedValue={estadoBusqueda} onValueChange={(v) => setEstadoBusqueda(String(v))} style={styles.picker}>
                      <Picker.Item label="Todos" value="" color="#000000" />
                      <Picker.Item label="Completado" value="completado" color="#000000" />
                      <Picker.Item label="Pendiente" value="pendiente" color="#000000" />
                    </Picker>
                  </View>
                </ThemedView>

                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>Empleado creador (código o nombre)</ThemedText>
                  <View style={styles.row}>
                    <TextInput
                      style={[styles.input, styles.inputFlex]}
                      value={creatorSearch}
                      onChangeText={setCreatorSearch}
                      placeholder="Buscar empleado"
                      placeholderTextColor="#999"
                    />
                    <TouchableOpacity
                      style={styles.searchIconBtn}
                      onPress={() => runSearchEmployees(creatorSearch, 'creator')}
                      activeOpacity={0.85}
                      disabled={employeeSearchMode === 'creator'}
                    >
                      {employeeSearchMode === 'creator' ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Ionicons name="search" size={22} color="#fff" />
                      )}
                    </TouchableOpacity>
                  </View>
                  {creatorResults.length ? (
                    <ThemedView style={styles.resultList}>
                      {creatorResults.map((e) => (
                        <TouchableOpacity key={e.id} style={styles.resultItem} onPress={() => pickCreator(e)}>
                          <ThemedText>
                            {e.codigo} — {formatEmpleadoNombre(e)}
                          </ThemedText>
                        </TouchableOpacity>
                      ))}
                    </ThemedView>
                  ) : null}
                  <ThemedView style={styles.assignedList}>
                    {creatorSelected.length === 0 ? (
                      <ThemedText style={styles.helperText}>Aún no agregaste empleados creadores al filtro.</ThemedText>
                    ) : (
                      <>
                        <TouchableOpacity
                          style={styles.selectedUsersHeader}
                          onPress={() => setIsCreatorUsersExpanded((p) => !p)}
                          activeOpacity={0.85}
                        >
                          <ThemedText style={styles.selectedUsersHeaderText}>
                            Empleados creadores ({creatorSelected.length})
                          </ThemedText>
                          <Ionicons
                            name={isCreatorUsersExpanded ? 'chevron-up' : 'chevron-down'}
                            size={18}
                            color="#007AFF"
                          />
                        </TouchableOpacity>
                        {isCreatorUsersExpanded
                          ? creatorSelected.map((e) => (
                              <ThemedView key={e.id} style={styles.assignedUserItem}>
                                <ThemedText style={styles.assignedUserTitle}>
                                  {e.codigo} — {formatEmpleadoNombre(e)}
                                </ThemedText>
                                <TouchableOpacity
                                  style={styles.removeUserButton}
                                  onPress={() => removeCreator(e.id)}
                                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                >
                                  <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                                </TouchableOpacity>
                              </ThemedView>
                            ))
                          : null}
                      </>
                    )}
                  </ThemedView>
                </ThemedView>

                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>Fecha inicio</ThemedText>
                  <TouchableOpacity style={styles.dateButton} onPress={() => setShowFi(true)} activeOpacity={0.85}>
                    <ThemedText style={styles.dateButtonText}>{fechaInicio ? formatDateOnlyLabel(fechaInicio) : 'Seleccionar fecha'}</ThemedText>
                    <Ionicons name="calendar-outline" size={18} color="#007AFF" />
                  </TouchableOpacity>
                  {showFi ? (
                    <DateTimePicker
                      value={fechaInicio || horaAccionPickerBase}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={(_, d) => {
                        setShowFi(Platform.OS === 'ios');
                        if (d) setFechaInicio(d);
                      }}
                    />
                  ) : null}
                </ThemedView>

                <ThemedView style={styles.filterGroup}>
                  <ThemedText style={styles.filterLabel}>Fecha fin</ThemedText>
                  <TouchableOpacity style={styles.dateButton} onPress={() => setShowFf(true)} activeOpacity={0.85}>
                    <ThemedText style={styles.dateButtonText}>{fechaFin ? formatDateOnlyLabel(fechaFin) : 'Seleccionar fecha'}</ThemedText>
                    <Ionicons name="calendar-outline" size={18} color="#007AFF" />
                  </TouchableOpacity>
                  {showFf ? (
                    <DateTimePicker
                      value={fechaFin || horaAccionPickerBase}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={(_, d) => {
                        setShowFf(Platform.OS === 'ios');
                        if (d) setFechaFin(d);
                      }}
                    />
                  ) : null}
                </ThemedView>

                {modulo === MODULO_INGRESOS ? (
                  <ThemedView style={styles.formCard}>
                    <ThemedText style={styles.sectionTitle}>Filtros — Ingresos de usuario</ThemedText>

                    <ThemedText style={styles.label}>Creado desde (fecha y hora)</ThemedText>
                    <View style={styles.dateRow}>
                      <TouchableOpacity style={styles.dateButtonHalf} onPress={() => setShowListDd(true)} activeOpacity={0.85}>
                        <ThemedText style={styles.dateButtonText}>{listCreadoDesdeD ? formatDateOnlyLabel(listCreadoDesdeD) : 'Fecha'}</ThemedText>
                        <Ionicons name="calendar-outline" size={18} color="#007AFF" />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.dateButtonHalf} onPress={() => setShowListDt(true)} activeOpacity={0.85}>
                        <ThemedText style={styles.dateButtonText}>{listCreadoDesdeT ? hm(listCreadoDesdeT) : 'Hora'}</ThemedText>
                        <Ionicons name="time-outline" size={18} color="#007AFF" />
                      </TouchableOpacity>
                    </View>

                    <ThemedText style={styles.label}>Creado hasta (fecha y hora)</ThemedText>
                    <View style={styles.dateRow}>
                      <TouchableOpacity style={styles.dateButtonHalf} onPress={() => setShowListHd(true)} activeOpacity={0.85}>
                        <ThemedText style={styles.dateButtonText}>{listCreadoHastaD ? formatDateOnlyLabel(listCreadoHastaD) : 'Fecha'}</ThemedText>
                        <Ionicons name="calendar-outline" size={18} color="#007AFF" />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.dateButtonHalf} onPress={() => setShowListHt(true)} activeOpacity={0.85}>
                        <ThemedText style={styles.dateButtonText}>{listCreadoHastaT ? hm(listCreadoHastaT) : 'Hora'}</ThemedText>
                        <Ionicons name="time-outline" size={18} color="#007AFF" />
                      </TouchableOpacity>
                    </View>

                    <ThemedText style={styles.label}>Usuarios que ingresaron</ThemedText>
                    <View style={styles.row}>
                      <TextInput
                        style={[styles.input, styles.inputFlex]}
                        value={listUsuarioSearch}
                        onChangeText={setListUsuarioSearch}
                        placeholder="Buscar y añadir"
                        placeholderTextColor="#999"
                      />
                      <TouchableOpacity
                        style={styles.searchIconBtn}
                        onPress={() => runSearchEmployees(listUsuarioSearch, 'listUsuario')}
                        activeOpacity={0.85}
                        disabled={employeeSearchMode === 'listUsuario'}
                      >
                        {employeeSearchMode === 'listUsuario' ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Ionicons name="search" size={22} color="#fff" />
                        )}
                      </TouchableOpacity>
                    </View>
                    {listUsuarioResults.length ? (
                      <ThemedView style={styles.resultList}>
                        {listUsuarioResults.map((e) => (
                          <TouchableOpacity key={e.id} style={styles.resultItem} onPress={() => pickListUsuarioIngreso(e)}>
                            <ThemedText>
                              {e.codigo} — {formatEmpleadoNombre(e)}
                            </ThemedText>
                          </TouchableOpacity>
                        ))}
                      </ThemedView>
                    ) : null}
                    <ThemedView style={styles.assignedList}>
                      {listUsuarioIngresoSelected.length === 0 ? (
                        <ThemedText style={styles.helperText}>Opcional: agrega uno o más usuarios para acotar la lista de reportes.</ThemedText>
                      ) : (
                        <>
                          <TouchableOpacity
                            style={styles.selectedUsersHeader}
                            onPress={() => setIsListIngresoExpanded((p) => !p)}
                            activeOpacity={0.85}
                          >
                            <ThemedText style={styles.selectedUsersHeaderText}>
                              Usuarios seleccionados ({listUsuarioIngresoSelected.length})
                            </ThemedText>
                            <Ionicons
                              name={isListIngresoExpanded ? 'chevron-up' : 'chevron-down'}
                              size={18}
                              color="#007AFF"
                            />
                          </TouchableOpacity>
                          {isListIngresoExpanded
                            ? listUsuarioIngresoSelected.map((e) => (
                                <ThemedView key={e.id} style={styles.assignedUserItem}>
                                  <ThemedText style={styles.assignedUserTitle}>
                                    {e.codigo} — {formatEmpleadoNombre(e)}
                                  </ThemedText>
                                  <TouchableOpacity
                                    style={styles.removeUserButton}
                                    onPress={() => removeListUsuarioIngreso(e.id)}
                                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                  >
                                    <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                                  </TouchableOpacity>
                                </ThemedView>
                              ))
                            : null}
                        </>
                      )}
                    </ThemedView>
                    <TouchableOpacity
                      style={styles.checkRow}
                      onPress={() => setListSoloMultiDispositivo((p) => !p)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name={listSoloMultiDispositivo ? 'checkmark-sharp' : 'square-outline'} size={22} color="#007AFF" />
                      <ThemedText style={styles.checkRowText}>Usuario cambió de dispositivo</ThemedText>
                    </TouchableOpacity>
                  </ThemedView>
                ) : null}

                {modulo === MODULO_ACCIONES_PERSONALES ? (
                  <ThemedView style={styles.formCard}>
                    <ThemedText style={styles.sectionTitle}>Filtros — Acciones personales</ThemedText>
                    <ThemedText style={styles.label}>Creado por (empleado)</ThemedText>
                    <View style={styles.row}>
                      <TextInput
                        style={[styles.input, styles.inputFlex]}
                        value={listAccEmpleadoSearch}
                        onChangeText={setListAccEmpleadoSearch}
                        placeholder="Código o nombre"
                        placeholderTextColor="#999"
                      />
                      <TouchableOpacity
                        style={styles.searchIconBtn}
                        onPress={() => void runSearchEmployees(listAccEmpleadoSearch, 'listAccEmpleado')}
                        activeOpacity={0.85}
                        disabled={employeeSearchMode === 'listAccEmpleado'}
                      >
                        {employeeSearchMode === 'listAccEmpleado' ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Ionicons name="search" size={22} color="#fff" />
                        )}
                      </TouchableOpacity>
                    </View>
                    {listAccEmpleadoResults.length ? (
                      <ThemedView style={styles.resultList}>
                        {listAccEmpleadoResults.map((e) => (
                          <TouchableOpacity key={e.id} style={styles.resultItem} onPress={() => pickListAccEmpleado(e)}>
                            <ThemedText>
                              {e.codigo} — {formatEmpleadoNombre(e)}
                            </ThemedText>
                          </TouchableOpacity>
                        ))}
                      </ThemedView>
                    ) : null}
                    <ThemedView style={styles.assignedList}>
                      {listAccEmpleadoSelected.length === 0 ? (
                        <ThemedText style={styles.helperText}>Opcional: uno o más empleados asociados al registro.</ThemedText>
                      ) : (
                        listAccEmpleadoSelected.map((e) => (
                          <ThemedView key={`list-acc-emp-${e.id}`} style={styles.assignedUserItem}>
                            <ThemedText style={styles.assignedUserTitle}>
                              {e.codigo} — {formatEmpleadoNombre(e)}
                            </ThemedText>
                            <TouchableOpacity style={styles.removeUserButton} onPress={() => removeListAccEmpleado(e.id)}>
                              <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                            </TouchableOpacity>
                          </ThemedView>
                        ))
                      )}
                    </ThemedView>

                    {[
                      ['Empresa', listEmpresaSearch, setListEmpresaSearch, 'empresa', 'listEmpresa', listEmpresaResults, listEmpresaSelected, setListEmpresaSelected, setListEmpresaResults],
                      ['Cliente', listClienteSearch, setListClienteSearch, 'cliente', 'listCliente', listClienteResults, listClienteSelected, setListClienteSelected, setListClienteResults],
                      ['División', listDivisionSearch, setListDivisionSearch, 'division', 'listDivision', listDivisionResults, listDivisionSelected, setListDivisionSelected, setListDivisionResults],
                      ['Contrato', listContratoSearch, setListContratoSearch, 'contrato', 'listContrato', listContratoResults, listContratoSelected, setListContratoSelected, setListContratoResults],
                      ['Corpo', listCorpoSearch, setListCorpoSearch, 'corpo', 'listCorpo', listCorpoResults, listCorpoSelected, setListCorpoSelected, setListCorpoResults],
                      ['Puesto', listPuestoSearch, setListPuestoSearch, 'puesto', 'listPuesto', listPuestoResults, listPuestoSelected, setListPuestoSelected, setListPuestoResults],
                      ['Plaza', listAccPlazaSearch, setListAccPlazaSearch, 'plaza', 'listAccPlaza', listAccPlazaResults, listAccPlazaSelected, setListAccPlazaSelected, setListAccPlazaResults],
                    ].map(
                      ([label, value, setValue, entity, mode, results, selected, setSelected, setResults]) => (
                        <ThemedView key={String(mode)} style={{ marginBottom: 8 }}>
                          <ThemedText style={styles.label}>{String(label)}</ThemedText>
                          <View style={styles.row}>
                            <TextInput
                              style={[styles.input, styles.inputFlex]}
                              value={String(value)}
                              onChangeText={setValue as any}
                              placeholder={`Buscar ${String(label).toLowerCase()}`}
                              placeholderTextColor="#999"
                            />
                            <TouchableOpacity
                              style={styles.searchIconBtn}
                              onPress={() => void runSearchActaStructure(String(value), entity as any, mode as any)}
                              activeOpacity={0.85}
                              disabled={employeeSearchMode === mode}
                            >
                              {employeeSearchMode === mode ? (
                                <ActivityIndicator size="small" color="#fff" />
                              ) : (
                                <Ionicons name="search" size={22} color="#fff" />
                              )}
                            </TouchableOpacity>
                          </View>
                          {(results as StructureLite[]).length ? (
                            <ThemedView style={styles.resultList}>
                              {(results as StructureLite[]).map((it) => (
                                <TouchableOpacity
                                  key={`${mode}-${it.id}`}
                                  style={styles.resultItem}
                                  onPress={() =>
                                    pickStructureLite(
                                      it,
                                      setSelected as React.Dispatch<React.SetStateAction<StructureLite[]>>,
                                      setResults as React.Dispatch<React.SetStateAction<StructureLite[]>>,
                                      setValue as React.Dispatch<React.SetStateAction<string>>,
                                    )
                                  }
                                >
                                  <ThemedText>{formatStructureLite(it)}</ThemedText>
                                </TouchableOpacity>
                              ))}
                            </ThemedView>
                          ) : null}
                          <ThemedView style={styles.assignedList}>
                            {(selected as StructureLite[]).length === 0 ? (
                              <ThemedText style={styles.helperText}>Ningún {String(label).toLowerCase()} seleccionado.</ThemedText>
                            ) : (
                              (selected as StructureLite[]).map((it) => (
                                <ThemedView key={`sel-${String(mode)}-${it.id}`} style={styles.assignedUserItem}>
                                  <ThemedText style={styles.assignedUserTitle}>{formatStructureLite(it)}</ThemedText>
                                  <TouchableOpacity
                                    style={styles.removeUserButton}
                                    onPress={() =>
                                      removeStructureLite(
                                        it.id,
                                        setSelected as React.Dispatch<React.SetStateAction<StructureLite[]>>,
                                      )
                                    }
                                  >
                                    <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                                  </TouchableOpacity>
                                </ThemedView>
                              ))
                            )}
                          </ThemedView>
                        </ThemedView>
                      ),
                    )}
                  </ThemedView>
                ) : null}

                {modulo === MODULO_ACTA_ENTREGA ||
                modulo === MODULO_ENTREGA_PUESTO ||
                modulo === MODULO_AGENDA_MINUTA ||
                modulo === MODULO_APERTURA_CIERRE ||
                modulo === MODULO_VULNERABILIDAD ||
                modulo === MODULO_ACTIVIDADES ||
                modulo === MODULO_CONTROL_ASISTENCIA ||
                modulo === MODULO_DOCUMENTOS_ENTREGADOS ||
                modulo === MODULO_ENCUESTA_SATISFACCION ||
                modulo === MODULO_REGISTRO_VISITAS ||
                modulo === MODULO_MUTUOS_ACUERDOS ||
                modulo === MODULO_EVALUACION_PERSONAL ||
                modulo === MODULO_INCIDENTES ||
                modulo === MODULO_LLAVES ||
                modulo === MODULO_LLAVEROS ||
                modulo === MODULO_BITACORA_NOVEDADES ||
                modulo === MODULO_MAESTRO_QUEJAS ||
                modulo === MODULO_CHECKLIST_SUPERVISION ||
                modulo === MODULO_PRODUCTO_NO_CONFORME ||
                modulo === MODULO_REGISTRO_INDUCCION_RECORRIDO ||
                modulo === MODULO_MANUALES_PUESTO ? (
                  <ThemedView style={styles.formCard}>
                    <ThemedText style={styles.sectionTitle}>
                      {modulo === MODULO_AGENDA_MINUTA
                        ? 'Filtros — Agenda minuta'
                        : modulo === MODULO_APERTURA_CIERRE
                          ? 'Filtros — Apertura/Cierre de puesto'
                          : modulo === MODULO_VULNERABILIDAD
                            ? 'Filtros — Apreciación de vulnerabilidad'
                            : modulo === MODULO_ACTIVIDADES
                              ? 'Filtros — Actividades'
                              : modulo === MODULO_CONTROL_ASISTENCIA
                                ? 'Filtros — Control de asistencia'
                                : modulo === MODULO_DOCUMENTOS_ENTREGADOS
                                  ? 'Filtros — Documentos entregados'
                                  : modulo === MODULO_ENCUESTA_SATISFACCION
                                    ? 'Filtros — Encuestas de satisfacción'
                                    : modulo === MODULO_REGISTRO_VISITAS
                                      ? 'Filtros — Registro de visitas'
                                    : modulo === MODULO_MUTUOS_ACUERDOS
                                      ? 'Filtros — Mutuos acuerdos'
                                    : modulo === MODULO_EVALUACION_PERSONAL
                                      ? 'Filtros — Evaluación de personal'
                                    : modulo === MODULO_REGISTRO_INDUCCION_RECORRIDO
                                      ? 'Filtros — Registro de inducción y recorrido'
                                    : modulo === MODULO_MANUALES_PUESTO
                                      ? 'Filtros — Manuales de puesto'
                                    : modulo === MODULO_PRODUCTO_NO_CONFORME
                                      ? 'Filtros — Producto no conforme'
                                  : modulo === MODULO_INCIDENTES
                                    ? 'Filtros — Incidentes'
                                    : modulo === MODULO_CHECKLIST_SUPERVISION
                                      ? 'Filtros — Checklist de supervisión'
                                    : modulo === MODULO_BITACORA_NOVEDADES
                                      ? 'Filtros — Bitácora de novedades'
                                    : modulo === MODULO_MAESTRO_QUEJAS
                                      ? 'Filtros — Maestro de quejas y reclamos'
                                    : modulo === MODULO_LLAVES
                                      ? 'Filtros — Llaves'
                                    : modulo === MODULO_LLAVEROS
                                      ? 'Filtros — Llaveros'
                          : modulo === MODULO_ENTREGA_PUESTO
                            ? 'Filtros — Entrega de puesto'
                        : 'Filtros — Acta de entrega de productos'}
                    </ThemedText>
                    {modulo === MODULO_INCIDENTES || modulo === MODULO_CHECKLIST_SUPERVISION ? (
                      <>
                        <ThemedText style={styles.label}>Creado desde (fecha y hora)</ThemedText>
                        <View style={styles.dateRow}>
                          {Platform.OS === 'web' ? (
                            <>
                              <TextInput
                                style={[styles.input, styles.inputFlex, styles.epWebDtInput]}
                                value={listFechaRepDesdeD ? ymd(listFechaRepDesdeD) : ''}
                                onChangeText={(v) => setListFechaRepDesdeD(ymdOkStr(v) ? parseYmdToLocalDate(v) : null)}
                                placeholder="AAAA-MM-DD"
                                placeholderTextColor="#999"
                                {...({ type: 'date' } as object)}
                              />
                              <TextInput
                                style={[styles.input, styles.inputFlex, styles.epWebDtInput]}
                                value={listFechaRepDesdeT ? hm(listFechaRepDesdeT) : ''}
                                onChangeText={(v) => setListFechaRepDesdeT(hmOkStr(v) ? parseHmToLocalDate(v) : null)}
                                placeholder="HH:mm"
                                placeholderTextColor="#999"
                                {...({ type: 'time' } as object)}
                              />
                            </>
                          ) : (
                            <>
                              <TouchableOpacity style={styles.dateButtonHalf} onPress={() => setShowListFrDd(true)} activeOpacity={0.85}>
                                <ThemedText style={styles.dateButtonText}>{listFechaRepDesdeD ? formatDateOnlyLabel(listFechaRepDesdeD) : 'Fecha'}</ThemedText>
                                <Ionicons name="calendar-outline" size={18} color="#007AFF" />
                              </TouchableOpacity>
                              <TouchableOpacity style={styles.dateButtonHalf} onPress={() => setShowListFrDt(true)} activeOpacity={0.85}>
                                <ThemedText style={styles.dateButtonText}>{listFechaRepDesdeT ? hm(listFechaRepDesdeT) : 'Hora'}</ThemedText>
                                <Ionicons name="time-outline" size={18} color="#007AFF" />
                              </TouchableOpacity>
                            </>
                          )}
                        </View>
                        <ThemedText style={styles.label}>Creado hasta (fecha y hora)</ThemedText>
                        <View style={styles.dateRow}>
                          {Platform.OS === 'web' ? (
                            <>
                              <TextInput
                                style={[styles.input, styles.inputFlex, styles.epWebDtInput]}
                                value={listFechaRepHastaD ? ymd(listFechaRepHastaD) : ''}
                                onChangeText={(v) => setListFechaRepHastaD(ymdOkStr(v) ? parseYmdToLocalDate(v) : null)}
                                placeholder="AAAA-MM-DD"
                                placeholderTextColor="#999"
                                {...({ type: 'date' } as object)}
                              />
                              <TextInput
                                style={[styles.input, styles.inputFlex, styles.epWebDtInput]}
                                value={listFechaRepHastaT ? hm(listFechaRepHastaT) : ''}
                                onChangeText={(v) => setListFechaRepHastaT(hmOkStr(v) ? parseHmToLocalDate(v) : null)}
                                placeholder="HH:mm"
                                placeholderTextColor="#999"
                                {...({ type: 'time' } as object)}
                              />
                            </>
                          ) : (
                            <>
                              <TouchableOpacity style={styles.dateButtonHalf} onPress={() => setShowListFrHd(true)} activeOpacity={0.85}>
                                <ThemedText style={styles.dateButtonText}>{listFechaRepHastaD ? formatDateOnlyLabel(listFechaRepHastaD) : 'Fecha'}</ThemedText>
                                <Ionicons name="calendar-outline" size={18} color="#007AFF" />
                              </TouchableOpacity>
                              <TouchableOpacity style={styles.dateButtonHalf} onPress={() => setShowListFrHt(true)} activeOpacity={0.85}>
                                <ThemedText style={styles.dateButtonText}>{listFechaRepHastaT ? hm(listFechaRepHastaT) : 'Hora'}</ThemedText>
                                <Ionicons name="time-outline" size={18} color="#007AFF" />
                              </TouchableOpacity>
                            </>
                          )}
                        </View>
                      </>
                    ) : (
                      <>
                        <ThemedText style={styles.label}>Creado desde (fecha y hora)</ThemedText>
                        <View style={styles.dateRow}>
                          <TouchableOpacity style={styles.dateButtonHalf} onPress={() => setShowListActaDd(true)} activeOpacity={0.85}>
                            <ThemedText style={styles.dateButtonText}>{listActaDesdeD ? formatDateOnlyLabel(listActaDesdeD) : 'Fecha'}</ThemedText>
                            <Ionicons name="calendar-outline" size={18} color="#007AFF" />
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.dateButtonHalf} onPress={() => setShowListActaDt(true)} activeOpacity={0.85}>
                            <ThemedText style={styles.dateButtonText}>{listActaDesdeT ? hm(listActaDesdeT) : 'Hora'}</ThemedText>
                            <Ionicons name="time-outline" size={18} color="#007AFF" />
                          </TouchableOpacity>
                        </View>
                        <ThemedText style={styles.label}>Creado hasta (fecha y hora)</ThemedText>
                        <View style={styles.dateRow}>
                          <TouchableOpacity style={styles.dateButtonHalf} onPress={() => setShowListActaHd(true)} activeOpacity={0.85}>
                            <ThemedText style={styles.dateButtonText}>{listActaHastaD ? formatDateOnlyLabel(listActaHastaD) : 'Fecha'}</ThemedText>
                            <Ionicons name="calendar-outline" size={18} color="#007AFF" />
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.dateButtonHalf} onPress={() => setShowListActaHt(true)} activeOpacity={0.85}>
                            <ThemedText style={styles.dateButtonText}>{listActaHastaT ? hm(listActaHastaT) : 'Hora'}</ThemedText>
                            <Ionicons name="time-outline" size={18} color="#007AFF" />
                          </TouchableOpacity>
                        </View>
                      </>
                    )}

                    {[
                      ['Empresa', listEmpresaSearch, setListEmpresaSearch, 'empresa', 'listEmpresa', listEmpresaResults, listEmpresaSelected, setListEmpresaSelected, setListEmpresaResults],
                      ['Cliente', listClienteSearch, setListClienteSearch, 'cliente', 'listCliente', listClienteResults, listClienteSelected, setListClienteSelected, setListClienteResults],
                      ['División', listDivisionSearch, setListDivisionSearch, 'division', 'listDivision', listDivisionResults, listDivisionSelected, setListDivisionSelected, setListDivisionResults],
                      ['Contrato', listContratoSearch, setListContratoSearch, 'contrato', 'listContrato', listContratoResults, listContratoSelected, setListContratoSelected, setListContratoResults],
                      ['Corpo', listCorpoSearch, setListCorpoSearch, 'corpo', 'listCorpo', listCorpoResults, listCorpoSelected, setListCorpoSelected, setListCorpoResults],
                      ['Puesto', listPuestoSearch, setListPuestoSearch, 'puesto', 'listPuesto', listPuestoResults, listPuestoSelected, setListPuestoSelected, setListPuestoResults],
                    ].map(
                      ([label, value, setValue, entity, mode, results, selected, setSelected, setResults]) => (
                        <ThemedView key={String(mode)} style={{ marginBottom: 8 }}>
                          <ThemedText style={styles.label}>{String(label)}</ThemedText>
                          <View style={styles.row}>
                            <TextInput
                              style={[styles.input, styles.inputFlex]}
                              value={String(value)}
                              onChangeText={setValue as any}
                              placeholder={`Buscar ${String(label).toLowerCase()}`}
                              placeholderTextColor="#999"
                            />
                            <TouchableOpacity
                              style={styles.searchIconBtn}
                              onPress={() => void runSearchActaStructure(String(value), entity as any, mode as any)}
                              activeOpacity={0.85}
                              disabled={employeeSearchMode === mode}
                            >
                              {employeeSearchMode === mode ? (
                                <ActivityIndicator size="small" color="#fff" />
                              ) : (
                                <Ionicons name="search" size={22} color="#fff" />
                              )}
                            </TouchableOpacity>
                          </View>
                          {(results as StructureLite[]).length ? (
                            <ThemedView style={styles.resultList}>
                              {(results as StructureLite[]).map((it) => (
                                <TouchableOpacity
                                  key={`${mode}-${it.id}`}
                                  style={styles.resultItem}
                                  onPress={() =>
                                    pickStructureLite(
                                      it,
                                      setSelected as React.Dispatch<React.SetStateAction<StructureLite[]>>,
                                      setResults as React.Dispatch<React.SetStateAction<StructureLite[]>>,
                                      setValue as React.Dispatch<React.SetStateAction<string>>,
                                    )
                                  }
                                >
                                  <ThemedText>{formatStructureLite(it)}</ThemedText>
                                </TouchableOpacity>
                              ))}
                            </ThemedView>
                          ) : null}
                          <ThemedView style={styles.assignedList}>
                            {(selected as StructureLite[]).length === 0 ? (
                              <ThemedText style={styles.helperText}>Ningún {String(label).toLowerCase()} seleccionado.</ThemedText>
                            ) : (
                              (selected as StructureLite[]).map((it) => (
                                <ThemedView key={`sel-${String(mode)}-${it.id}`} style={styles.assignedUserItem}>
                                  <ThemedText style={styles.assignedUserTitle}>{formatStructureLite(it)}</ThemedText>
                                  <TouchableOpacity
                                    style={styles.removeUserButton}
                                    onPress={() =>
                                      removeStructureLite(
                                        it.id,
                                        setSelected as React.Dispatch<React.SetStateAction<StructureLite[]>>,
                                      )
                                    }
                                  >
                                    <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                                  </TouchableOpacity>
                                </ThemedView>
                              ))
                            )}
                          </ThemedView>
                        </ThemedView>
                      ),
                    )}
                    {modulo === MODULO_INCIDENTES || modulo === MODULO_CHECKLIST_SUPERVISION ? (
                      <ThemedView style={{ marginBottom: 8 }}>
                        <ThemedText style={styles.label}>Ejecutivo de cuenta</ThemedText>
                        <View style={styles.row}>
                          <TextInput
                            style={[styles.input, styles.inputFlex]}
                            value={listEjecutivoSearch}
                            onChangeText={setListEjecutivoSearch}
                            placeholder="Buscar ejecutivo"
                            placeholderTextColor="#999"
                          />
                          <TouchableOpacity
                            style={styles.searchIconBtn}
                            onPress={() => void runSearchActaStructure(listEjecutivoSearch, 'ejecutivo', 'listEjecutivo')}
                            activeOpacity={0.85}
                            disabled={employeeSearchMode === 'listEjecutivo'}
                          >
                            {employeeSearchMode === 'listEjecutivo' ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <Ionicons name="search" size={22} color="#fff" />
                            )}
                          </TouchableOpacity>
                        </View>
                        {listEjecutivoResults.length ? (
                          <ThemedView style={styles.resultList}>
                            {listEjecutivoResults.map((it) => (
                              <TouchableOpacity
                                key={`list-ej-${it.id}`}
                                style={styles.resultItem}
                                onPress={() =>
                                  pickStructureLite(it, setListEjecutivoSelected, setListEjecutivoResults, setListEjecutivoSearch)
                                }
                              >
                                <ThemedText>{formatStructureLite(it)}</ThemedText>
                              </TouchableOpacity>
                            ))}
                          </ThemedView>
                        ) : null}
                        <ThemedView style={styles.assignedList}>
                          {listEjecutivoSelected.length === 0 ? (
                            <ThemedText style={styles.helperText}>Ningún ejecutivo seleccionado.</ThemedText>
                          ) : (
                            listEjecutivoSelected.map((it) => (
                              <ThemedView key={`sel-list-ej-${it.id}`} style={styles.assignedUserItem}>
                                <ThemedText style={styles.assignedUserTitle}>{formatStructureLite(it)}</ThemedText>
                                <TouchableOpacity style={styles.removeUserButton} onPress={() => removeStructureLite(it.id, setListEjecutivoSelected)}>
                                  <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                                </TouchableOpacity>
                              </ThemedView>
                            ))
                          )}
                        </ThemedView>
                      </ThemedView>
                    ) : null}
                    {modulo === MODULO_AGENDA_MINUTA ? (
                      <>
                        <ThemedText style={styles.label}>Estado</ThemedText>
                        <View style={styles.pickerWrapper}>
                          <Picker
                            selectedValue={listAgendaEstado}
                            onValueChange={(v) =>
                              setListAgendaEstado(String(v) as 'todos' | 'completado' | 'pendiente')
                            }
                            style={styles.picker}
                          >
                            <Picker.Item label="Todos" value="todos" color="#000000" />
                            <Picker.Item label="Completado" value="completado" color="#000000" />
                            <Picker.Item label="Pendiente" value="pendiente" color="#000000" />
                          </Picker>
                        </View>
                      </>
                    ) : null}
                    {modulo === MODULO_APERTURA_CIERRE ? (
                      <>
                        <ThemedText style={styles.label}>Tipo</ThemedText>
                        <View style={styles.pickerWrapper}>
                          <Picker
                            selectedValue={listAcpTipo}
                            onValueChange={(v) => setListAcpTipo(String(v) as 'todos' | 'apertura' | 'cierre')}
                            style={styles.picker}
                          >
                            <Picker.Item label="Todos" value="todos" color="#000000" />
                            <Picker.Item label="Apertura" value="apertura" color="#000000" />
                            <Picker.Item label="Cierre" value="cierre" color="#000000" />
                          </Picker>
                        </View>
                        <ThemedText style={styles.helperText}>
                          El filtro "Creado por" usa la selección global de Empleado creador.
                        </ThemedText>
                      </>
                    ) : null}
                    {modulo === MODULO_CONTROL_ASISTENCIA ? (
                      <>
                        <ThemedText style={styles.label}>Tipo de turno</ThemedText>
                        <View style={styles.pickerWrapper}>
                          <Picker selectedValue={listAsisTurno} onValueChange={(v) => setListAsisTurno(String(v) as any)} style={styles.picker}>
                            <Picker.Item label="Todos" value="todos" color="#000000" />
                            <Picker.Item label="Diurno" value="D" color="#000000" />
                            <Picker.Item label="Mixto" value="M" color="#000000" />
                            <Picker.Item label="Nocturno" value="N" color="#000000" />
                          </Picker>
                        </View>
                      </>
                    ) : null}
                    {modulo === MODULO_DOCUMENTOS_ENTREGADOS ? (
                      <>
                        <ThemedText style={styles.label}>Tipo de documento</ThemedText>
                        <View style={styles.pickerWrapper}>
                          <Picker selectedValue={listDocTipo} onValueChange={(v) => setListDocTipo(String(v))} style={styles.picker}>
                            <Picker.Item label="Todos" value="todos" color="#000000" />
                            {documentTypesCache.map((d) => (
                              <Picker.Item key={`list-doc-type-${d.id}`} label={d.nombre} value={d.nombre} color="#000000" />
                            ))}
                          </Picker>
                        </View>
                      </>
                    ) : null}
                    {modulo === MODULO_ENCUESTA_SATISFACCION ? (
                      <>
                        <ThemedText style={styles.label}>Responsable de evaluación</ThemedText>
                        <View style={styles.row}>
                          <TextInput
                            style={[styles.input, styles.inputFlex]}
                            value={listEncResponsableSearch}
                            onChangeText={setListEncResponsableSearch}
                            placeholder="Código o nombre"
                            placeholderTextColor="#999"
                          />
                          <TouchableOpacity
                            style={styles.searchIconBtn}
                            onPress={() => void runSearchEmployees(listEncResponsableSearch, 'listEncResponsable')}
                            activeOpacity={0.85}
                            disabled={employeeSearchMode === 'listEncResponsable'}
                          >
                            {employeeSearchMode === 'listEncResponsable' ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <Ionicons name="search" size={22} color="#fff" />
                            )}
                          </TouchableOpacity>
                        </View>
                        {listEncResponsableResults.length ? (
                          <ThemedView style={styles.resultList}>
                            {listEncResponsableResults.map((e) => (
                              <TouchableOpacity key={`list-enc-r-${e.id}`} style={styles.resultItem} onPress={() => pickListEncResponsable(e)}>
                                <ThemedText>
                                  {e.codigo} — {formatEmpleadoNombre(e)}
                                </ThemedText>
                              </TouchableOpacity>
                            ))}
                          </ThemedView>
                        ) : null}
                        <ThemedView style={styles.assignedList}>
                          {listEncResponsableSelected.length === 0 ? (
                            <ThemedText style={styles.helperText}>Opcional: uno o más responsables.</ThemedText>
                          ) : (
                            listEncResponsableSelected.map((e) => (
                              <ThemedView key={`list-enc-sel-${e.id}`} style={styles.assignedUserItem}>
                                <ThemedText style={styles.assignedUserTitle}>
                                  {e.codigo} — {formatEmpleadoNombre(e)}
                                </ThemedText>
                                <TouchableOpacity style={styles.removeUserButton} onPress={() => removeListEncResponsable(e.id)}>
                                  <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                                </TouchableOpacity>
                              </ThemedView>
                            ))
                          )}
                        </ThemedView>
                      </>
                    ) : null}
                    {modulo === MODULO_REGISTRO_VISITAS ? (
                      <>
                        <ThemedText style={styles.label}>Cédula del visitante</ThemedText>
                        <TextInput
                          style={styles.input}
                          value={listRvCedulaVisitante}
                          onChangeText={setListRvCedulaVisitante}
                          placeholder="Opcional"
                          placeholderTextColor="#999"
                        />
                        <ThemedText style={styles.label}>Tipo de visitante</ThemedText>
                        <View style={styles.pickerWrapper}>
                          <Picker
                            selectedValue={listRvTipoVisitante}
                            onValueChange={(v) => setListRvTipoVisitante(String(v) as 'todos' | 'normal' | 'funcionario')}
                            style={styles.picker}
                          >
                            <Picker.Item label="Todos" value="todos" color="#000000" />
                            <Picker.Item label="Normal" value="normal" color="#000000" />
                            <Picker.Item label="Funcionario" value="funcionario" color="#000000" />
                          </Picker>
                        </View>
                        <ThemedText style={styles.label}>Responsable</ThemedText>
                        <View style={styles.row}>
                          <TextInput
                            style={[styles.input, styles.inputFlex]}
                            value={listRvResponsableSearch}
                            onChangeText={setListRvResponsableSearch}
                            placeholder="Código o nombre"
                            placeholderTextColor="#999"
                          />
                          <TouchableOpacity
                            style={styles.searchIconBtn}
                            onPress={() => void runSearchEmployees(listRvResponsableSearch, 'listRvResponsable')}
                            activeOpacity={0.85}
                            disabled={employeeSearchMode === 'listRvResponsable'}
                          >
                            {employeeSearchMode === 'listRvResponsable' ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <Ionicons name="search" size={22} color="#fff" />
                            )}
                          </TouchableOpacity>
                        </View>
                        {listRvResponsableResults.length ? (
                          <ThemedView style={styles.resultList}>
                            {listRvResponsableResults.map((e) => (
                              <TouchableOpacity key={`list-rv-r-${e.id}`} style={styles.resultItem} onPress={() => pickListRvResponsable(e)}>
                                <ThemedText>
                                  {e.codigo} — {formatEmpleadoNombre(e)}
                                </ThemedText>
                              </TouchableOpacity>
                            ))}
                          </ThemedView>
                        ) : null}
                        <ThemedView style={styles.assignedList}>
                          {listRvResponsableSelected.length === 0 ? (
                            <ThemedText style={styles.helperText}>Opcional: uno o más responsables.</ThemedText>
                          ) : (
                            listRvResponsableSelected.map((e) => (
                              <ThemedView key={`list-rv-sel-${e.id}`} style={styles.assignedUserItem}>
                                <ThemedText style={styles.assignedUserTitle}>
                                  {e.codigo} — {formatEmpleadoNombre(e)}
                                </ThemedText>
                                <TouchableOpacity style={styles.removeUserButton} onPress={() => removeListRvResponsable(e.id)}>
                                  <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                                </TouchableOpacity>
                              </ThemedView>
                            ))
                          )}
                        </ThemedView>
                      </>
                    ) : null}
                    {modulo === MODULO_EVALUACION_PERSONAL ? (
                      <>
                        <ThemedText style={styles.label}>Empleado evaluado</ThemedText>
                        <View style={styles.row}>
                          <TextInput
                            style={[styles.input, styles.inputFlex]}
                            value={listEvpEmpEvalSearch}
                            onChangeText={setListEvpEmpEvalSearch}
                            placeholder="Código o nombre"
                            placeholderTextColor="#999"
                          />
                          <TouchableOpacity
                            style={styles.searchIconBtn}
                            onPress={() => void runSearchEmployees(listEvpEmpEvalSearch, 'listEvpEmpEval')}
                            activeOpacity={0.85}
                            disabled={employeeSearchMode === 'listEvpEmpEval'}
                          >
                            {employeeSearchMode === 'listEvpEmpEval' ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <Ionicons name="search" size={22} color="#fff" />
                            )}
                          </TouchableOpacity>
                        </View>
                        {listEvpEmpEvalResults.length ? (
                          <ThemedView style={styles.resultList}>
                            {listEvpEmpEvalResults.map((e) => (
                              <TouchableOpacity key={`list-evp-ee-${e.id}`} style={styles.resultItem} onPress={() => pickListEvpEmpEval(e)}>
                                <ThemedText>
                                  {e.codigo} — {formatEmpleadoNombre(e)}
                                </ThemedText>
                              </TouchableOpacity>
                            ))}
                          </ThemedView>
                        ) : null}
                        <ThemedView style={styles.assignedList}>
                          {listEvpEmpEvalSelected.length === 0 ? (
                            <ThemedText style={styles.helperText}>Opcional: uno o más empleados evaluados.</ThemedText>
                          ) : (
                            listEvpEmpEvalSelected.map((e) => (
                              <ThemedView key={`list-evp-ee-sel-${e.id}`} style={styles.assignedUserItem}>
                                <ThemedText style={styles.assignedUserTitle}>
                                  {e.codigo} — {formatEmpleadoNombre(e)}
                                </ThemedText>
                                <TouchableOpacity style={styles.removeUserButton} onPress={() => removeListEvpEmpEval(e.id)}>
                                  <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                                </TouchableOpacity>
                              </ThemedView>
                            ))
                          )}
                        </ThemedView>
                        <ThemedText style={styles.label}>Evaluador</ThemedText>
                        <View style={styles.row}>
                          <TextInput
                            style={[styles.input, styles.inputFlex]}
                            value={listEvpEvaluadorSearch}
                            onChangeText={setListEvpEvaluadorSearch}
                            placeholder="Código o nombre"
                            placeholderTextColor="#999"
                          />
                          <TouchableOpacity
                            style={styles.searchIconBtn}
                            onPress={() => void runSearchEmployees(listEvpEvaluadorSearch, 'listEvpEvaluador')}
                            activeOpacity={0.85}
                            disabled={employeeSearchMode === 'listEvpEvaluador'}
                          >
                            {employeeSearchMode === 'listEvpEvaluador' ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <Ionicons name="search" size={22} color="#fff" />
                            )}
                          </TouchableOpacity>
                        </View>
                        {listEvpEvaluadorResults.length ? (
                          <ThemedView style={styles.resultList}>
                            {listEvpEvaluadorResults.map((e) => (
                              <TouchableOpacity key={`list-evp-ev-${e.id}`} style={styles.resultItem} onPress={() => pickListEvpEvaluador(e)}>
                                <ThemedText>
                                  {e.codigo} — {formatEmpleadoNombre(e)}
                                </ThemedText>
                              </TouchableOpacity>
                            ))}
                          </ThemedView>
                        ) : null}
                        <ThemedView style={styles.assignedList}>
                          {listEvpEvaluadorSelected.length === 0 ? (
                            <ThemedText style={styles.helperText}>Opcional: uno o más evaluadores.</ThemedText>
                          ) : (
                            listEvpEvaluadorSelected.map((e) => (
                              <ThemedView key={`list-evp-ev-sel-${e.id}`} style={styles.assignedUserItem}>
                                <ThemedText style={styles.assignedUserTitle}>
                                  {e.codigo} — {formatEmpleadoNombre(e)}
                                </ThemedText>
                                <TouchableOpacity style={styles.removeUserButton} onPress={() => removeListEvpEvaluador(e.id)}>
                                  <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                                </TouchableOpacity>
                              </ThemedView>
                            ))
                          )}
                        </ThemedView>
                        <ThemedText style={styles.label}>Tipo de evaluación</ThemedText>
                        <View style={styles.pickerWrapper}>
                          <Picker
                            selectedValue={listEvpTipoEvaluacion}
                            onValueChange={(v) =>
                              setListEvpTipoEvaluacion(String(v) as 'todos' | 'Seguridad' | 'Aseo & limpieza' | 'Otros')
                            }
                            style={styles.picker}
                          >
                            <Picker.Item label="Todos" value="todos" color="#000000" />
                            <Picker.Item label="Seguridad" value="Seguridad" color="#000000" />
                            <Picker.Item label="Aseo & limpieza" value="Aseo & limpieza" color="#000000" />
                            <Picker.Item label="Otros" value="Otros" color="#000000" />
                          </Picker>
                        </View>
                      </>
                    ) : null}
                    {modulo === MODULO_PRODUCTO_NO_CONFORME ? (
                      <>
                        <ThemedText style={styles.label}>Tipo de producto no conforme</ThemedText>
                        <View style={styles.pickerWrapper}>
                          <Picker
                            selectedValue={listPncTipoServicio}
                            onValueChange={(v) => setListPncTipoServicio(String(v))}
                            style={styles.picker}
                          >
                            <Picker.Item label="Todos" value="todos" color="#000000" />
                            {pncTiposCache.map((t) => (
                              <Picker.Item key={`list-pnc-tipo-${t.id}`} label={t.nombre} value={t.nombre} color="#000000" />
                            ))}
                          </Picker>
                        </View>
                      </>
                    ) : null}
                    {modulo === MODULO_REGISTRO_INDUCCION_RECORRIDO ? (
                      <>
                        <ThemedText style={styles.label}>Responsable (creador del registro)</ThemedText>
                        <View style={styles.row}>
                          <TextInput
                            style={[styles.input, styles.inputFlex]}
                            value={listIrResponsableSearch}
                            onChangeText={setListIrResponsableSearch}
                            placeholder="Código o nombre"
                            placeholderTextColor="#999"
                          />
                          <TouchableOpacity
                            style={styles.searchIconBtn}
                            onPress={() => void runSearchEmployees(listIrResponsableSearch, 'listIrResponsable')}
                            activeOpacity={0.85}
                            disabled={employeeSearchMode === 'listIrResponsable'}
                          >
                            {employeeSearchMode === 'listIrResponsable' ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <Ionicons name="search" size={22} color="#fff" />
                            )}
                          </TouchableOpacity>
                        </View>
                        {listIrResponsableResults.length ? (
                          <ThemedView style={styles.resultList}>
                            {listIrResponsableResults.map((e) => (
                              <TouchableOpacity key={`list-ir-r-${e.id}`} style={styles.resultItem} onPress={() => pickListIrResponsable(e)}>
                                <ThemedText>
                                  {e.codigo} — {formatEmpleadoNombre(e)}
                                </ThemedText>
                              </TouchableOpacity>
                            ))}
                          </ThemedView>
                        ) : null}
                        <ThemedView style={styles.assignedList}>
                          {listIrResponsableSelected.length === 0 ? (
                            <ThemedText style={styles.helperText}>Opcional: uno o más responsables.</ThemedText>
                          ) : (
                            listIrResponsableSelected.map((e) => (
                              <ThemedView key={`list-ir-r-sel-${e.id}`} style={styles.assignedUserItem}>
                                <ThemedText style={styles.assignedUserTitle}>
                                  {e.codigo} — {formatEmpleadoNombre(e)}
                                </ThemedText>
                                <TouchableOpacity style={styles.removeUserButton} onPress={() => removeListIrResponsable(e.id)}>
                                  <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                                </TouchableOpacity>
                              </ThemedView>
                            ))
                          )}
                        </ThemedView>
                        <ThemedText style={styles.label}>Empleado del registro</ThemedText>
                        <View style={styles.row}>
                          <TextInput
                            style={[styles.input, styles.inputFlex]}
                            value={listIrEmpleadoSearch}
                            onChangeText={setListIrEmpleadoSearch}
                            placeholder="Código o nombre"
                            placeholderTextColor="#999"
                          />
                          <TouchableOpacity
                            style={styles.searchIconBtn}
                            onPress={() => void runSearchEmployees(listIrEmpleadoSearch, 'listIrEmpleado')}
                            activeOpacity={0.85}
                            disabled={employeeSearchMode === 'listIrEmpleado'}
                          >
                            {employeeSearchMode === 'listIrEmpleado' ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <Ionicons name="search" size={22} color="#fff" />
                            )}
                          </TouchableOpacity>
                        </View>
                        {listIrEmpleadoResults.length ? (
                          <ThemedView style={styles.resultList}>
                            {listIrEmpleadoResults.map((e) => (
                              <TouchableOpacity key={`list-ir-e-${e.id}`} style={styles.resultItem} onPress={() => pickListIrEmpleado(e)}>
                                <ThemedText>
                                  {e.codigo} — {formatEmpleadoNombre(e)}
                                </ThemedText>
                              </TouchableOpacity>
                            ))}
                          </ThemedView>
                        ) : null}
                        <ThemedView style={styles.assignedList}>
                          {listIrEmpleadoSelected.length === 0 ? (
                            <ThemedText style={styles.helperText}>Opcional: uno o más empleados.</ThemedText>
                          ) : (
                            listIrEmpleadoSelected.map((e) => (
                              <ThemedView key={`list-ir-e-sel-${e.id}`} style={styles.assignedUserItem}>
                                <ThemedText style={styles.assignedUserTitle}>
                                  {e.codigo} — {formatEmpleadoNombre(e)}
                                </ThemedText>
                                <TouchableOpacity style={styles.removeUserButton} onPress={() => removeListIrEmpleado(e.id)}>
                                  <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                                </TouchableOpacity>
                              </ThemedView>
                            ))
                          )}
                        </ThemedView>
                        <ThemedText style={styles.label}>Participantes (cédula)</ThemedText>
                        <View style={styles.row}>
                          <TextInput
                            style={[styles.input, styles.inputFlex]}
                            value={listIrParticipanteSearch}
                            onChangeText={setListIrParticipanteSearch}
                            placeholder="Cédula"
                            placeholderTextColor="#999"
                          />
                          <TouchableOpacity style={styles.searchIconBtn} onPress={addListIrParticipanteCedula} activeOpacity={0.85}>
                            <Ionicons name="add" size={22} color="#fff" />
                          </TouchableOpacity>
                        </View>
                        <ThemedView style={styles.assignedList}>
                          {listIrParticipanteCedulas.length === 0 ? (
                            <ThemedText style={styles.helperText}>Opcional: una o más cédulas.</ThemedText>
                          ) : (
                            listIrParticipanteCedulas.map((ced) => (
                              <ThemedView key={`list-ir-p-${ced}`} style={styles.assignedUserItem}>
                                <ThemedText style={styles.assignedUserTitle}>{ced}</ThemedText>
                                <TouchableOpacity style={styles.removeUserButton} onPress={() => removeListIrParticipanteCedula(ced)}>
                                  <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                                </TouchableOpacity>
                              </ThemedView>
                            ))
                          )}
                        </ThemedView>
                      </>
                    ) : null}
                    {modulo === MODULO_MUTUOS_ACUERDOS ? (
                      <>
                        <ThemedText style={styles.label}>Estado</ThemedText>
                        <View style={styles.pickerWrapper}>
                          <Picker
                            selectedValue={listMutEstado}
                            onValueChange={(v) =>
                              setListMutEstado(String(v) as 'todos' | 'aprobado' | 'rechazado' | 'pendiente')
                            }
                            style={styles.picker}
                          >
                            <Picker.Item label="Todos" value="todos" color="#000000" />
                            <Picker.Item label="Aprobado" value="aprobado" color="#000000" />
                            <Picker.Item label="Rechazado" value="rechazado" color="#000000" />
                            <Picker.Item label="Pendiente" value="pendiente" color="#000000" />
                          </Picker>
                        </View>
                        <ThemedText style={styles.label}>Persona ausente</ThemedText>
                        <View style={styles.row}>
                          <TextInput
                            style={[styles.input, styles.inputFlex]}
                            value={listMutAusenteSearch}
                            onChangeText={setListMutAusenteSearch}
                            placeholder="Código o nombre"
                            placeholderTextColor="#999"
                          />
                          <TouchableOpacity
                            style={styles.searchIconBtn}
                            onPress={() => void runSearchEmployees(listMutAusenteSearch, 'listMutAusente')}
                            disabled={employeeSearchMode === 'listMutAusente'}
                          >
                            {employeeSearchMode === 'listMutAusente' ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <Ionicons name="search" size={22} color="#fff" />
                            )}
                          </TouchableOpacity>
                        </View>
                        {listMutAusenteResults.length ? (
                          <ThemedView style={styles.resultList}>
                            {listMutAusenteResults.map((e) => (
                              <TouchableOpacity key={`lma-${e.id}`} style={styles.resultItem} onPress={() => pickListMutAusente(e)}>
                                <ThemedText>
                                  {e.codigo} — {formatEmpleadoNombre(e)}
                                </ThemedText>
                              </TouchableOpacity>
                            ))}
                          </ThemedView>
                        ) : null}
                        <ThemedView style={styles.assignedList}>
                          {listMutAusenteSelected.map((e) => (
                            <ThemedView key={`lmas-${e.id}`} style={styles.assignedUserItem}>
                              <ThemedText style={styles.assignedUserTitle}>
                                {e.codigo} — {formatEmpleadoNombre(e)}
                              </ThemedText>
                              <TouchableOpacity style={styles.removeUserButton} onPress={() => removeListMutAusente(e.id)}>
                                <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                              </TouchableOpacity>
                            </ThemedView>
                          ))}
                        </ThemedView>
                        <ThemedText style={styles.label}>Persona reemplaza</ThemedText>
                        <View style={styles.row}>
                          <TextInput
                            style={[styles.input, styles.inputFlex]}
                            value={listMutReemplazaSearch}
                            onChangeText={setListMutReemplazaSearch}
                            placeholder="Código o nombre"
                            placeholderTextColor="#999"
                          />
                          <TouchableOpacity
                            style={styles.searchIconBtn}
                            onPress={() => void runSearchEmployees(listMutReemplazaSearch, 'listMutReemplaza')}
                            disabled={employeeSearchMode === 'listMutReemplaza'}
                          >
                            {employeeSearchMode === 'listMutReemplaza' ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <Ionicons name="search" size={22} color="#fff" />
                            )}
                          </TouchableOpacity>
                        </View>
                        {listMutReemplazaResults.length ? (
                          <ThemedView style={styles.resultList}>
                            {listMutReemplazaResults.map((e) => (
                              <TouchableOpacity key={`lmr-${e.id}`} style={styles.resultItem} onPress={() => pickListMutReemplaza(e)}>
                                <ThemedText>
                                  {e.codigo} — {formatEmpleadoNombre(e)}
                                </ThemedText>
                              </TouchableOpacity>
                            ))}
                          </ThemedView>
                        ) : null}
                        <ThemedView style={styles.assignedList}>
                          {listMutReemplazaSelected.map((e) => (
                            <ThemedView key={`lmrs-${e.id}`} style={styles.assignedUserItem}>
                              <ThemedText style={styles.assignedUserTitle}>
                                {e.codigo} — {formatEmpleadoNombre(e)}
                              </ThemedText>
                              <TouchableOpacity style={styles.removeUserButton} onPress={() => removeListMutReemplaza(e.id)}>
                                <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                              </TouchableOpacity>
                            </ThemedView>
                          ))}
                        </ThemedView>
                        <ThemedText style={styles.label}>Ejecutivo de cuenta</ThemedText>
                        <View style={styles.row}>
                          <TextInput
                            style={[styles.input, styles.inputFlex]}
                            value={listMutEjecutivoSearch}
                            onChangeText={setListMutEjecutivoSearch}
                            placeholder="Nombre"
                            placeholderTextColor="#999"
                          />
                          <TouchableOpacity
                            style={styles.searchIconBtn}
                            onPress={() => void runSearchActaStructure(listMutEjecutivoSearch, 'ejecutivo', 'listMutEjecutivo')}
                            disabled={employeeSearchMode === 'listMutEjecutivo'}
                          >
                            {employeeSearchMode === 'listMutEjecutivo' ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <Ionicons name="search" size={22} color="#fff" />
                            )}
                          </TouchableOpacity>
                        </View>
                        {listMutEjecutivoResults.length ? (
                          <ThemedView style={styles.resultList}>
                            {listMutEjecutivoResults.map((it) => (
                              <TouchableOpacity key={`lme-${it.id}`} style={styles.resultItem} onPress={() => pickListMutEjecutivo(it)}>
                                <ThemedText>{formatStructureLite(it)}</ThemedText>
                              </TouchableOpacity>
                            ))}
                          </ThemedView>
                        ) : null}
                        <ThemedView style={styles.assignedList}>
                          {listMutEjecutivoSelected.map((it) => (
                            <ThemedView key={`lmes-${it.id}`} style={styles.assignedUserItem}>
                              <ThemedText style={styles.assignedUserTitle}>{formatStructureLite(it)}</ThemedText>
                              <TouchableOpacity style={styles.removeUserButton} onPress={() => removeListMutEjecutivo(it.id)}>
                                <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                              </TouchableOpacity>
                            </ThemedView>
                          ))}
                        </ThemedView>
                      </>
                    ) : null}
                    {modulo === MODULO_INCIDENTES ? (
                      <>
                        <ThemedText style={styles.label}>Solucionado desde (fecha y hora)</ThemedText>
                        <View style={styles.dateRow}>
                          {Platform.OS === 'web' ? (
                            <>
                              <TextInput
                                style={[styles.input, styles.inputFlex, styles.epWebDtInput]}
                                value={listIncSolDesdeD ? ymd(listIncSolDesdeD) : ''}
                                onChangeText={(v) => setListIncSolDesdeD(ymdOkStr(v) ? parseYmdToLocalDate(v) : null)}
                                placeholder="AAAA-MM-DD"
                                placeholderTextColor="#999"
                                {...({ type: 'date' } as object)}
                              />
                              <TextInput
                                style={[styles.input, styles.inputFlex, styles.epWebDtInput]}
                                value={listIncSolDesdeT ? hm(listIncSolDesdeT) : ''}
                                onChangeText={(v) => setListIncSolDesdeT(hmOkStr(v) ? parseHmToLocalDate(v) : null)}
                                placeholder="HH:mm"
                                placeholderTextColor="#999"
                                {...({ type: 'time' } as object)}
                              />
                            </>
                          ) : (
                            <>
                              <TouchableOpacity style={styles.dateButtonHalf} onPress={() => setIncidentListPicker('list_sol_desde_ymd')}>
                                <ThemedText style={styles.dateButtonText}>{listIncSolDesdeD ? formatDateOnlyLabel(listIncSolDesdeD) : 'Fecha'}</ThemedText>
                                <Ionicons name="calendar-outline" size={18} color="#007AFF" />
                              </TouchableOpacity>
                              <TouchableOpacity style={styles.dateButtonHalf} onPress={() => setIncidentListPicker('list_sol_desde_hm')}>
                                <ThemedText style={styles.dateButtonText}>{listIncSolDesdeT ? hm(listIncSolDesdeT) : 'Hora'}</ThemedText>
                                <Ionicons name="time-outline" size={18} color="#007AFF" />
                              </TouchableOpacity>
                            </>
                          )}
                        </View>
                        <ThemedText style={styles.label}>Solucionado hasta (fecha y hora)</ThemedText>
                        <View style={styles.dateRow}>
                          {Platform.OS === 'web' ? (
                            <>
                              <TextInput
                                style={[styles.input, styles.inputFlex, styles.epWebDtInput]}
                                value={listIncSolHastaD ? ymd(listIncSolHastaD) : ''}
                                onChangeText={(v) => setListIncSolHastaD(ymdOkStr(v) ? parseYmdToLocalDate(v) : null)}
                                placeholder="AAAA-MM-DD"
                                placeholderTextColor="#999"
                                {...({ type: 'date' } as object)}
                              />
                              <TextInput
                                style={[styles.input, styles.inputFlex, styles.epWebDtInput]}
                                value={listIncSolHastaT ? hm(listIncSolHastaT) : ''}
                                onChangeText={(v) => setListIncSolHastaT(hmOkStr(v) ? parseHmToLocalDate(v) : null)}
                                placeholder="HH:mm"
                                placeholderTextColor="#999"
                                {...({ type: 'time' } as object)}
                              />
                            </>
                          ) : (
                            <>
                              <TouchableOpacity style={styles.dateButtonHalf} onPress={() => setIncidentListPicker('list_sol_hasta_ymd')}>
                                <ThemedText style={styles.dateButtonText}>{listIncSolHastaD ? formatDateOnlyLabel(listIncSolHastaD) : 'Fecha'}</ThemedText>
                                <Ionicons name="calendar-outline" size={18} color="#007AFF" />
                              </TouchableOpacity>
                              <TouchableOpacity style={styles.dateButtonHalf} onPress={() => setIncidentListPicker('list_sol_hasta_hm')}>
                                <ThemedText style={styles.dateButtonText}>{listIncSolHastaT ? hm(listIncSolHastaT) : 'Hora'}</ThemedText>
                                <Ionicons name="time-outline" size={18} color="#007AFF" />
                              </TouchableOpacity>
                            </>
                          )}
                        </View>
                        <ThemedText style={styles.label}>Solucionado (Real) desde (fecha y hora)</ThemedText>
                        <View style={styles.dateRow}>
                          {Platform.OS === 'web' ? (
                            <>
                              <TextInput
                                style={[styles.input, styles.inputFlex, styles.epWebDtInput]}
                                value={listIncRealDesdeD ? ymd(listIncRealDesdeD) : ''}
                                onChangeText={(v) => setListIncRealDesdeD(ymdOkStr(v) ? parseYmdToLocalDate(v) : null)}
                                placeholder="AAAA-MM-DD"
                                placeholderTextColor="#999"
                                {...({ type: 'date' } as object)}
                              />
                              <TextInput
                                style={[styles.input, styles.inputFlex, styles.epWebDtInput]}
                                value={listIncRealDesdeT ? hm(listIncRealDesdeT) : ''}
                                onChangeText={(v) => setListIncRealDesdeT(hmOkStr(v) ? parseHmToLocalDate(v) : null)}
                                placeholder="HH:mm"
                                placeholderTextColor="#999"
                                {...({ type: 'time' } as object)}
                              />
                            </>
                          ) : (
                            <>
                              <TouchableOpacity style={styles.dateButtonHalf} onPress={() => setIncidentListPicker('list_real_desde_ymd')}>
                                <ThemedText style={styles.dateButtonText}>{listIncRealDesdeD ? formatDateOnlyLabel(listIncRealDesdeD) : 'Fecha'}</ThemedText>
                                <Ionicons name="calendar-outline" size={18} color="#007AFF" />
                              </TouchableOpacity>
                              <TouchableOpacity style={styles.dateButtonHalf} onPress={() => setIncidentListPicker('list_real_desde_hm')}>
                                <ThemedText style={styles.dateButtonText}>{listIncRealDesdeT ? hm(listIncRealDesdeT) : 'Hora'}</ThemedText>
                                <Ionicons name="time-outline" size={18} color="#007AFF" />
                              </TouchableOpacity>
                            </>
                          )}
                        </View>
                        <ThemedText style={styles.label}>Solucionado (Real) hasta (fecha y hora)</ThemedText>
                        <View style={styles.dateRow}>
                          {Platform.OS === 'web' ? (
                            <>
                              <TextInput
                                style={[styles.input, styles.inputFlex, styles.epWebDtInput]}
                                value={listIncRealHastaD ? ymd(listIncRealHastaD) : ''}
                                onChangeText={(v) => setListIncRealHastaD(ymdOkStr(v) ? parseYmdToLocalDate(v) : null)}
                                placeholder="AAAA-MM-DD"
                                placeholderTextColor="#999"
                                {...({ type: 'date' } as object)}
                              />
                              <TextInput
                                style={[styles.input, styles.inputFlex, styles.epWebDtInput]}
                                value={listIncRealHastaT ? hm(listIncRealHastaT) : ''}
                                onChangeText={(v) => setListIncRealHastaT(hmOkStr(v) ? parseHmToLocalDate(v) : null)}
                                placeholder="HH:mm"
                                placeholderTextColor="#999"
                                {...({ type: 'time' } as object)}
                              />
                            </>
                          ) : (
                            <>
                              <TouchableOpacity style={styles.dateButtonHalf} onPress={() => setIncidentListPicker('list_real_hasta_ymd')}>
                                <ThemedText style={styles.dateButtonText}>{listIncRealHastaD ? formatDateOnlyLabel(listIncRealHastaD) : 'Fecha'}</ThemedText>
                                <Ionicons name="calendar-outline" size={18} color="#007AFF" />
                              </TouchableOpacity>
                              <TouchableOpacity style={styles.dateButtonHalf} onPress={() => setIncidentListPicker('list_real_hasta_hm')}>
                                <ThemedText style={styles.dateButtonText}>{listIncRealHastaT ? hm(listIncRealHastaT) : 'Hora'}</ThemedText>
                                <Ionicons name="time-outline" size={18} color="#007AFF" />
                              </TouchableOpacity>
                            </>
                          )}
                        </View>
                        <ThemedText style={styles.label}>Clasificación</ThemedText>
                        <View style={styles.pickerWrapper}>
                          <Picker selectedValue={listIncClasificacion} onValueChange={(v) => setListIncClasificacion(String(v))} style={styles.picker}>
                            <Picker.Item label="Todas" value="todos" color="#000000" />
                            {incClasificacionesCache.map((c) => (
                              <Picker.Item key={`list-inc-cls-${c.id}`} label={c.nombre} value={String(c.id)} color="#000000" />
                            ))}
                          </Picker>
                        </View>
                        <ThemedText style={styles.label}>Estado</ThemedText>
                        <View style={styles.pickerWrapper}>
                          <Picker selectedValue={listIncEstado} onValueChange={(v) => setListIncEstado(String(v) as any)} style={styles.picker}>
                            <Picker.Item label="Todos" value="todos" color="#000000" />
                            <Picker.Item label="Solucionado" value="solucionado" color="#000000" />
                            <Picker.Item label="No solucionado" value="no_solucionado" color="#000000" />
                          </Picker>
                        </View>
                      </>
                    ) : null}
                    {modulo === MODULO_LLAVES ? (
                      <>
                        <ThemedText style={styles.label}>Pertenece a llavero...</ThemedText>
                        <View style={styles.row}>
                          <TextInput
                            style={[styles.input, styles.inputFlex]}
                            value={listLlaveroSearch}
                            onChangeText={setListLlaveroSearch}
                            placeholder="Buscar llavero"
                            placeholderTextColor="#999"
                          />
                          <TouchableOpacity
                            style={styles.searchIconBtn}
                            onPress={() => void runSearchActaStructure(listLlaveroSearch, 'llavero', 'listLlavero')}
                            activeOpacity={0.85}
                            disabled={employeeSearchMode === 'listLlavero'}
                          >
                            {employeeSearchMode === 'listLlavero' ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <Ionicons name="search" size={22} color="#fff" />
                            )}
                          </TouchableOpacity>
                        </View>
                        {listLlaveroResults.length ? (
                          <ThemedView style={styles.resultList}>
                            {listLlaveroResults.map((it) => (
                              <TouchableOpacity
                                key={`list-llv-${it.id}`}
                                style={styles.resultItem}
                                onPress={() =>
                                  pickStructureLite(it, setListLlaveroSelected, setListLlaveroResults, setListLlaveroSearch)
                                }
                              >
                                <ThemedText>{formatStructureLite(it)}</ThemedText>
                              </TouchableOpacity>
                            ))}
                          </ThemedView>
                        ) : null}
                        <ThemedView style={styles.assignedList}>
                          {listLlaveroSelected.length === 0 ? (
                            <ThemedText style={styles.helperText}>Ningún llavero seleccionado.</ThemedText>
                          ) : (
                            listLlaveroSelected.map((it) => (
                              <ThemedView key={`sel-list-llv-${it.id}`} style={styles.assignedUserItem}>
                                <ThemedText style={styles.assignedUserTitle}>{formatStructureLite(it)}</ThemedText>
                                <TouchableOpacity style={styles.removeUserButton} onPress={() => removeStructureLite(it.id, setListLlaveroSelected)}>
                                  <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                                </TouchableOpacity>
                              </ThemedView>
                            ))
                          )}
                        </ThemedView>
                        <ThemedText style={styles.label}>Entregado por...</ThemedText>
                        <TextInput
                          style={styles.input}
                          value={listLlvEntregadoPor}
                          onChangeText={setListLlvEntregadoPor}
                          placeholder="Nombre de quien entrega"
                          placeholderTextColor="#999"
                        />
                        <ThemedText style={styles.label}>Recibido por...</ThemedText>
                        <TextInput
                          style={styles.input}
                          value={listLlvRecibidoPor}
                          onChangeText={setListLlvRecibidoPor}
                          placeholder="Nombre de quien recibe"
                          placeholderTextColor="#999"
                        />
                      </>
                    ) : null}
                    {modulo === MODULO_LLAVEROS ? (
                      <>
                        <ThemedText style={styles.label}>Entregado por...</ThemedText>
                        <TextInput
                          style={styles.input}
                          value={listLlrEntregadoPor}
                          onChangeText={setListLlrEntregadoPor}
                          placeholder="Nombre de quien entrega (movimiento llavero)"
                          placeholderTextColor="#999"
                        />
                        <ThemedText style={styles.label}>Recibido por...</ThemedText>
                        <TextInput
                          style={styles.input}
                          value={listLlrRecibidoPor}
                          onChangeText={setListLlrRecibidoPor}
                          placeholder="Nombre de quien recibe (movimiento llavero)"
                          placeholderTextColor="#999"
                        />
                      </>
                    ) : null}
                    {modulo === MODULO_BITACORA_NOVEDADES ? (
                      <>
                        <ThemedText style={styles.label}>Categoría</ThemedText>
                        <View style={styles.pickerWrapper}>
                          <Picker
                            selectedValue={listBnvCategoriaId}
                            onValueChange={(v) => setListBnvCategoriaId(String(v))}
                            style={styles.picker}
                          >
                            <Picker.Item label="Todas" value="todos" color="#000000" />
                            {noteCategories.map((c) => (
                              <Picker.Item key={`list-bnv-cat-${c.id}`} label={c.nombre} value={String(c.id)} color="#000000" />
                            ))}
                          </Picker>
                        </View>
                        <ThemedText style={styles.label}>Relevancia</ThemedText>
                        <View style={styles.pickerWrapper}>
                          <Picker
                            selectedValue={listBnvRelevancia}
                            onValueChange={(v) => setListBnvRelevancia(String(v) as any)}
                            style={styles.picker}
                          >
                            <Picker.Item label="Todas" value="todos" color="#000000" />
                            <Picker.Item label="Alta" value="Alta" color="#000000" />
                            <Picker.Item label="Media" value="Media" color="#000000" />
                            <Picker.Item label="Baja" value="Baja" color="#000000" />
                          </Picker>
                        </View>
                      </>
                    ) : null}
                    {modulo === MODULO_MAESTRO_QUEJAS ? (
                      <>
                        <ThemedText style={styles.label}>Medio de recepción</ThemedText>
                        <View style={styles.pickerWrapper}>
                          <Picker
                            selectedValue={listMqMedioRecepcion}
                            onValueChange={(v) => setListMqMedioRecepcion(String(v))}
                            style={styles.picker}
                          >
                            <Picker.Item label="Todos" value="todos" color="#000000" />
                            <Picker.Item label="Correo" value="Correo" color="#000000" />
                            <Picker.Item label="Teléfono" value="Telefono" color="#000000" />
                            <Picker.Item label="Presencial" value="Presencial" color="#000000" />
                            <Picker.Item label="Otro" value="Otro" color="#000000" />
                          </Picker>
                        </View>
                        <ThemedText style={styles.label}>Tipo de queja</ThemedText>
                        <View style={styles.pickerWrapper}>
                          <Picker
                            selectedValue={listMqTipoQueja}
                            onValueChange={(v) => setListMqTipoQueja(String(v))}
                            style={styles.picker}
                          >
                            <Picker.Item label="Todos" value="todos" color="#000000" />
                            {tipoQuejasCatalogo.map((opt) => (
                              <Picker.Item key={`list-mq-tq-${opt.id}`} label={opt.nombre} value={opt.nombre} color="#000000" />
                            ))}
                          </Picker>
                        </View>
                        <ThemedText style={styles.label}>Nivel de queja</ThemedText>
                        <View style={styles.pickerWrapper}>
                          <Picker
                            selectedValue={listMqNivelQueja}
                            onValueChange={(v) => setListMqNivelQueja(String(v))}
                            style={styles.picker}
                          >
                            <Picker.Item label="Todos" value="todos" color="#000000" />
                            <Picker.Item label="Leve" value="Leve" color="#000000" />
                            <Picker.Item label="Moderada" value="Moderada" color="#000000" />
                            <Picker.Item label="Grave" value="Grave" color="#000000" />
                          </Picker>
                        </View>
                      </>
                    ) : null}
                  </ThemedView>
                ) : null}

                <TouchableOpacity style={styles.createButton} onPress={() => void loadLista()} activeOpacity={0.85}>
                  {loadingList ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <ThemedText style={styles.createButtonText}>
                      <Ionicons name="search" size={20} color="#FFFFFF" /> Buscar reportes
                    </ThemedText>
                  )}
                </TouchableOpacity>
              </ThemedView>
            ) : null}
          </ThemedView>

          <TouchableOpacity style={styles.attachButton} onPress={openNewReportModal} activeOpacity={0.85}>
            <Ionicons name="add-circle-outline" size={22} color="#007AFF" />
            <ThemedText style={styles.attachButtonText}>Nuevo reporte (formulario)</ThemedText>
          </TouchableOpacity>

          <ThemedText style={styles.sectionTitle}>Resultados</ThemedText>
          <FlatList
            data={reportes}
            keyExtractor={(x) => String(x.id)}
            renderItem={renderReportItem}
            scrollEnabled={false}
            ListEmptyComponent={
              <ThemedText style={styles.emptyText}>
                {loadingList ? 'Cargando lista…' : 'Sin datos. Abra filtros y pulse Buscar reportes.'}
              </ThemedText>
            }
          />
        </ThemedView>
      </ScrollView>

      <AppFooter />

      <SlideMenu
        isVisible={isMenuVisible}
        onClose={() => setIsMenuVisible(false)}
        onHomePress={() => navigation.navigate('Home' as never)}
        currentRoute="Reportes"
      />

      {showListDd && (
        <DateTimePicker
          value={listCreadoDesdeD || horaAccionPickerBase}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, d) => {
            setShowListDd(Platform.OS === 'ios');
            if (d) setListCreadoDesdeD(d);
          }}
        />
      )}
      {showListDt && (
        <DateTimePicker
          value={listCreadoDesdeT || new Date(2000, 0, 1, 0, 0)}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, d) => {
            setShowListDt(Platform.OS === 'ios');
            if (d) setListCreadoDesdeT(d);
          }}
        />
      )}
      {showListHd && (
        <DateTimePicker
          value={listCreadoHastaD || horaAccionPickerBase}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, d) => {
            setShowListHd(Platform.OS === 'ios');
            if (d) setListCreadoHastaD(d);
          }}
        />
      )}
      {showListHt && (
        <DateTimePicker
          value={listCreadoHastaT || new Date(2000, 0, 1, 23, 59)}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, d) => {
            setShowListHt(Platform.OS === 'ios');
            if (d) setListCreadoHastaT(d);
          }}
        />
      )}
      {showListActaDd && (
        <DateTimePicker
          value={listActaDesdeD || horaAccionPickerBase}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, d) => {
            setShowListActaDd(Platform.OS === 'ios');
            if (d) setListActaDesdeD(d);
          }}
        />
      )}
      {showListActaDt && (
        <DateTimePicker
          value={listActaDesdeT || new Date(2000, 0, 1, 0, 0)}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, d) => {
            setShowListActaDt(Platform.OS === 'ios');
            if (d) setListActaDesdeT(d);
          }}
        />
      )}
      {showListActaHd && (
        <DateTimePicker
          value={listActaHastaD || horaAccionPickerBase}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, d) => {
            setShowListActaHd(Platform.OS === 'ios');
            if (d) setListActaHastaD(d);
          }}
        />
      )}
      {showListActaHt && (
        <DateTimePicker
          value={listActaHastaT || new Date(2000, 0, 1, 23, 59)}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, d) => {
            setShowListActaHt(Platform.OS === 'ios');
            if (d) setListActaHastaT(d);
          }}
        />
      )}
      {showListFrDd && (
        <DateTimePicker
          value={listFechaRepDesdeD || horaAccionPickerBase}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, d) => {
            setShowListFrDd(Platform.OS === 'ios');
            if (d) setListFechaRepDesdeD(d);
          }}
        />
      )}
      {showListFrDt && (
        <DateTimePicker
          value={listFechaRepDesdeT || new Date(2000, 0, 1, 0, 0)}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, d) => {
            setShowListFrDt(Platform.OS === 'ios');
            if (d) setListFechaRepDesdeT(d);
          }}
        />
      )}
      {showListFrHd && (
        <DateTimePicker
          value={listFechaRepHastaD || horaAccionPickerBase}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, d) => {
            setShowListFrHd(Platform.OS === 'ios');
            if (d) setListFechaRepHastaD(d);
          }}
        />
      )}
      {showListFrHt && (
        <DateTimePicker
          value={listFechaRepHastaT || new Date(2000, 0, 1, 23, 59)}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, d) => {
            setShowListFrHt(Platform.OS === 'ios');
            if (d) setListFechaRepHastaT(d);
          }}
        />
      )}

      {modalVisible && showModalDd && (
        <DateTimePicker
          value={modalDesdeD || horaAccionPickerBase}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, d) => {
            setShowModalDd(Platform.OS === 'ios');
            if (d) setModalDesdeD(d);
          }}
        />
      )}
      {modalVisible && showModalDt && (
        <DateTimePicker
          value={modalDesdeT || new Date(2000, 0, 1, 0, 0)}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, d) => {
            setShowModalDt(Platform.OS === 'ios');
            if (d) setModalDesdeT(d);
          }}
        />
      )}
      {modalVisible && showModalHd && (
        <DateTimePicker
          value={modalHastaD || horaAccionPickerBase}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, d) => {
            setShowModalHd(Platform.OS === 'ios');
            if (d) setModalHastaD(d);
          }}
        />
      )}
      {modalVisible && showModalHt && (
        <DateTimePicker
          value={modalHastaT || new Date(2000, 0, 1, 23, 59)}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, d) => {
            setShowModalHt(Platform.OS === 'ios');
            if (d) setModalHastaT(d);
          }}
        />
      )}
      {modalVisible && showModalActaDd && (
        <DateTimePicker
          value={modalActaDesdeD || horaAccionPickerBase}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, d) => {
            setShowModalActaDd(Platform.OS === 'ios');
            if (d) setModalActaDesdeD(d);
          }}
        />
      )}
      {modalVisible && showModalActaDt && (
        <DateTimePicker
          value={modalActaDesdeT || new Date(2000, 0, 1, 0, 0)}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, d) => {
            setShowModalActaDt(Platform.OS === 'ios');
            if (d) setModalActaDesdeT(d);
          }}
        />
      )}
      {modalVisible && showModalActaHd && (
        <DateTimePicker
          value={modalActaHastaD || horaAccionPickerBase}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, d) => {
            setShowModalActaHd(Platform.OS === 'ios');
            if (d) setModalActaHastaD(d);
          }}
        />
      )}
      {modalVisible && showModalActaHt && (
        <DateTimePicker
          value={modalActaHastaT || new Date(2000, 0, 1, 23, 59)}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, d) => {
            setShowModalActaHt(Platform.OS === 'ios');
            if (d) setModalActaHastaT(d);
          }}
        />
      )}
      {modalVisible && modalEpPicker ? (
        <DateTimePicker
          value={getModalEpPickerValue()}
          mode={modalEpPicker.endsWith('_hm') ? 'time' : 'date'}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(ev: { type?: string }, selected?: Date) => {
            const slot = modalEpPicker;
            if (Platform.OS === 'android') {
              setModalEpPicker(null);
              if (ev?.type !== 'set' || !selected || !slot) return;
              applyModalEpPickerResult(slot, selected);
              return;
            }
            setModalEpPicker(null);
            if (!selected || !slot) return;
            applyModalEpPickerResult(slot, selected);
          }}
        />
      ) : null}
      {incidentListPicker ? (
        <DateTimePicker
          value={getIncidentPickerValue(incidentListPicker)}
          mode={incidentListPicker.endsWith('_hm') ? 'time' : 'date'}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(ev: { type?: string }, selected?: Date) => {
            const slot = incidentListPicker;
            if (Platform.OS === 'android') {
              setIncidentListPicker(null);
              if (ev?.type !== 'set' || !selected || !slot) return;
              applyIncidentPickerResult(slot, selected);
              return;
            }
            if (!selected || !slot) return;
            applyIncidentPickerResult(slot, selected);
          }}
        />
      ) : null}
      {modalVisible && incidentModalPicker ? (
        <DateTimePicker
          value={getIncidentPickerValue(incidentModalPicker)}
          mode={incidentModalPicker.endsWith('_hm') ? 'time' : 'date'}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(ev: { type?: string }, selected?: Date) => {
            const slot = incidentModalPicker;
            if (Platform.OS === 'android') {
              setIncidentModalPicker(null);
              if (ev?.type !== 'set' || !selected || !slot) return;
              applyIncidentPickerResult(slot, selected);
              return;
            }
            if (!selected || !slot) return;
            applyIncidentPickerResult(slot, selected);
          }}
        />
      ) : null}

      <Modal visible={modalVisible} animationType="fade" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <ThemedView style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Nuevo reporte</ThemedText>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent} keyboardShouldPersistTaps="handled">
              <ThemedText style={styles.label}>Nombre del reporte</ThemedText>
              <TextInput style={styles.input} value={formNombre} onChangeText={setFormNombre} placeholderTextColor="#999" />
              <ThemedText style={styles.label}>Número del reporte</ThemedText>
              <TextInput style={styles.input} value={formNumero} onChangeText={setFormNumero} placeholderTextColor="#999" />
              <ThemedText style={styles.label}>Nomenclatura del reporte</ThemedText>
              <TextInput style={styles.input} value={formNomenclatura} onChangeText={setFormNomenclatura} placeholderTextColor="#999" />
              <ThemedText style={styles.label}>Descripción del reporte</ThemedText>
              <TextInput
                style={[styles.input, styles.textArea]}
                multiline
                value={formDescripcion}
                onChangeText={setFormDescripcion}
                placeholderTextColor="#999"
              />

              <ThemedText style={styles.label}>Módulo</ThemedText>
              <View style={styles.pickerWrapper}>
                <Picker selectedValue={formModulo} onValueChange={(v) => setFormModulo(String(v))} style={styles.picker}>
                  {MODULO_PICKER_OPTIONS.map((opt) => (
                    <Picker.Item key={opt.value} label={opt.label} value={opt.value} color="#000000" />
                  ))}
                </Picker>
              </View>

              {formModulo === MODULO_INGRESOS ? (
                <ThemedView style={styles.modalFormCard}>
                  <ThemedText style={styles.modalSectionTitle}>Filtros del módulo</ThemedText>
                  <ThemedText style={styles.label}>Creado desde</ThemedText>
                  <View style={styles.dateRow}>
                    <TouchableOpacity style={styles.dateButtonHalf} onPress={() => setShowModalDd(true)} activeOpacity={0.85}>
                      <ThemedText style={styles.dateButtonText}>{modalDesdeD ? formatDateOnlyLabel(modalDesdeD) : 'Fecha'}</ThemedText>
                      <Ionicons name="calendar-outline" size={18} color="#007AFF" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.dateButtonHalf} onPress={() => setShowModalDt(true)} activeOpacity={0.85}>
                      <ThemedText style={styles.dateButtonText}>{modalDesdeT ? hm(modalDesdeT) : 'Hora'}</ThemedText>
                      <Ionicons name="time-outline" size={18} color="#007AFF" />
                    </TouchableOpacity>
                  </View>
                  <ThemedText style={styles.label}>Creado hasta</ThemedText>
                  <View style={styles.dateRow}>
                    <TouchableOpacity style={styles.dateButtonHalf} onPress={() => setShowModalHd(true)} activeOpacity={0.85}>
                      <ThemedText style={styles.dateButtonText}>{modalHastaD ? formatDateOnlyLabel(modalHastaD) : 'Fecha'}</ThemedText>
                      <Ionicons name="calendar-outline" size={18} color="#007AFF" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.dateButtonHalf} onPress={() => setShowModalHt(true)} activeOpacity={0.85}>
                      <ThemedText style={styles.dateButtonText}>{modalHastaT ? hm(modalHastaT) : 'Hora'}</ThemedText>
                      <Ionicons name="time-outline" size={18} color="#007AFF" />
                    </TouchableOpacity>
                  </View>

                  <ThemedText style={styles.label}>Usuarios que ingresaron</ThemedText>
                  <View style={styles.row}>
                    <TextInput
                      style={[styles.input, styles.inputFlex]}
                      value={modalUsuarioSearch}
                      onChangeText={setModalUsuarioSearch}
                      placeholder="Buscar y añadir"
                      placeholderTextColor="#999"
                    />
                    <TouchableOpacity
                      style={styles.searchIconBtn}
                      onPress={() => runSearchEmployees(modalUsuarioSearch, 'modalUsuario')}
                      activeOpacity={0.85}
                      disabled={employeeSearchMode === 'modalUsuario'}
                    >
                      {employeeSearchMode === 'modalUsuario' ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Ionicons name="search" size={22} color="#fff" />
                      )}
                    </TouchableOpacity>
                  </View>
                  {modalUsuarioResults.length ? (
                    <ThemedView style={styles.resultList}>
                      {modalUsuarioResults.map((e) => (
                        <TouchableOpacity key={e.id} style={styles.resultItem} onPress={() => pickModalUsuario(e)}>
                          <ThemedText>
                            {e.codigo} — {formatEmpleadoNombre(e)}
                          </ThemedText>
                        </TouchableOpacity>
                      ))}
                    </ThemedView>
                  ) : null}
                  <ThemedView style={styles.assignedList}>
                    {modalUsuariosSelected.length === 0 ? (
                      <ThemedText style={styles.helperText}>Opcional: agrega uno o más usuarios para filtrar tokens en el reporte.</ThemedText>
                    ) : (
                      <>
                        <TouchableOpacity
                          style={styles.selectedUsersHeader}
                          onPress={() => setIsModalIngresoExpanded((p) => !p)}
                          activeOpacity={0.85}
                        >
                          <ThemedText style={styles.selectedUsersHeaderText}>
                            Usuarios seleccionados ({modalUsuariosSelected.length})
                          </ThemedText>
                          <Ionicons
                            name={isModalIngresoExpanded ? 'chevron-up' : 'chevron-down'}
                            size={18}
                            color="#007AFF"
                          />
                        </TouchableOpacity>
                        {isModalIngresoExpanded
                          ? modalUsuariosSelected.map((e) => (
                              <ThemedView key={e.id} style={styles.assignedUserItem}>
                                <ThemedText style={styles.assignedUserTitle}>
                                  {e.codigo} — {formatEmpleadoNombre(e)}
                                </ThemedText>
                                <TouchableOpacity
                                  style={styles.removeUserButton}
                                  onPress={() => removeModalUsuario(e.id)}
                                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                >
                                  <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                                </TouchableOpacity>
                              </ThemedView>
                            ))
                          : null}
                      </>
                    )}
                  </ThemedView>

                  <TouchableOpacity style={styles.checkRow} onPress={() => setModalMultiDevice(!modalMultiDevice)} activeOpacity={0.85}>
                    <Ionicons name={modalMultiDevice ? 'checkmark-sharp' : 'square-outline'} size={22} color="#007AFF" />
                    <ThemedText style={styles.checkRowText}>Usuario cambió de dispositivo</ThemedText>
                  </TouchableOpacity>

                  <ThemedText style={styles.label}>Ordenar por</ThemedText>
                  <View style={styles.pickerWrapper}>
                    <Picker selectedValue={formOrder} onValueChange={(v) => setFormOrder(String(v))} style={styles.picker}>
                      {ORDER_OPTIONS.map((o) => (
                        <Picker.Item key={o.value} label={o.label} value={o.value} color="#000000" />
                      ))}
                    </Picker>
                  </View>

                  <ThemedText style={styles.label}>Tipo de reporte</ThemedText>
                  <View style={styles.pickerWrapper}>
                    <Picker selectedValue="Consolidado" enabled={false} style={styles.picker}> 
                      <Picker.Item label="Consolidado" value="Consolidado" color="#000000" />
                      <Picker.Item label="Individual" value="Individual" color="#000000" />
                    </Picker>
                  </View>

                  <TouchableOpacity style={[styles.attachButton, {marginTop: 16}]} onPress={() => void runPreview()} activeOpacity={0.85}>
                    {previewLoading ? (
                      <ActivityIndicator color="#007AFF" />
                    ) : (
                      <> 
                        <Ionicons name="eye-outline" size={22} color="#007AFF" />
                        <ThemedText style={styles.attachButtonText}>Buscar registros (preview)</ThemedText>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.collapseButton} onPress={() => setPreviewOpen(!previewOpen)} activeOpacity={0.85}>
                    <ThemedText style={styles.collapseButtonText}>
                      Resultados {previewRows != null ? `(${previewRows.length})` : ''}
                    </ThemedText>
                    <Ionicons name={previewOpen ? 'chevron-up' : 'chevron-down'} size={20} color="#007AFF" />
                  </TouchableOpacity>
                  {previewOpen && previewRows != null ? (
                    <ThemedView style={styles.collapseContent}>
                      <ThemedText selectable style={styles.previewJson}>
                        {JSON.stringify(previewRows, null, 2)}
                      </ThemedText>
                    </ThemedView>
                  ) : null}
                </ThemedView>
              ) : null}

              {formModulo === MODULO_ACCIONES_PERSONALES ? (
                <ThemedView style={styles.modalFormCard}>
                  <ThemedText style={styles.modalSectionTitle}>Filtros — Acciones de personal</ThemedText>
                  <ThemedText style={styles.label}>Creado por (empleado)</ThemedText>
                  <View style={styles.row}>
                    <TextInput
                      style={[styles.input, styles.inputFlex]}
                      value={modalAccEmpleadoSearch}
                      onChangeText={setModalAccEmpleadoSearch}
                      placeholder="Código o nombre"
                      placeholderTextColor="#999"
                    />
                    <TouchableOpacity
                      style={styles.searchIconBtn}
                      onPress={() => void runSearchEmployees(modalAccEmpleadoSearch, 'modalAccEmpleado')}
                      activeOpacity={0.85}
                      disabled={employeeSearchMode === 'modalAccEmpleado'}
                    >
                      {employeeSearchMode === 'modalAccEmpleado' ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Ionicons name="search" size={22} color="#fff" />
                      )}
                    </TouchableOpacity>
                  </View>
                  {modalAccEmpleadoResults.length ? (
                    <ThemedView style={styles.resultList}>
                      {modalAccEmpleadoResults.map((e) => (
                        <TouchableOpacity key={e.id} style={styles.resultItem} onPress={() => pickModalAccEmpleado(e)}>
                          <ThemedText>
                            {e.codigo} — {formatEmpleadoNombre(e)}
                          </ThemedText>
                        </TouchableOpacity>
                      ))}
                    </ThemedView>
                  ) : null}
                  <ThemedView style={styles.assignedList}>
                    {modalAccEmpleadoSelected.length === 0 ? (
                      <ThemedText style={styles.helperText}>Opcional: uno o más empleados asociados al registro.</ThemedText>
                    ) : (
                      modalAccEmpleadoSelected.map((e) => (
                        <ThemedView key={`modal-acc-emp-${e.id}`} style={styles.assignedUserItem}>
                          <ThemedText style={styles.assignedUserTitle}>
                            {e.codigo} — {formatEmpleadoNombre(e)}
                          </ThemedText>
                          <TouchableOpacity style={styles.removeUserButton} onPress={() => removeModalAccEmpleado(e.id)}>
                            <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                          </TouchableOpacity>
                        </ThemedView>
                      ))
                    )}
                  </ThemedView>

                  {[
                    ['Empresa', modalEmpresaSearch, setModalEmpresaSearch, 'empresa', 'modalEmpresa', modalEmpresaResults, modalEmpresaSelected, setModalEmpresaSelected, setModalEmpresaResults],
                    ['Cliente', modalClienteSearch, setModalClienteSearch, 'cliente', 'modalCliente', modalClienteResults, modalClienteSelected, setModalClienteSelected, setModalClienteResults],
                    ['División', modalDivisionSearch, setModalDivisionSearch, 'division', 'modalDivision', modalDivisionResults, modalDivisionSelected, setModalDivisionSelected, setModalDivisionResults],
                    ['Contrato', modalContratoSearch, setModalContratoSearch, 'contrato', 'modalContrato', modalContratoResults, modalContratoSelected, setModalContratoSelected, setModalContratoResults],
                    ['Corpo', modalCorpoSearch, setModalCorpoSearch, 'corpo', 'modalCorpo', modalCorpoResults, modalCorpoSelected, setModalCorpoSelected, setModalCorpoResults],
                    ['Puesto', modalPuestoSearch, setModalPuestoSearch, 'puesto', 'modalPuesto', modalPuestoResults, modalPuestoSelected, setModalPuestoSelected, setModalPuestoResults],
                    ['Plaza', modalAccPlazaSearch, setModalAccPlazaSearch, 'plaza', 'modalAccPlaza', modalAccPlazaResults, modalAccPlazaSelected, setModalAccPlazaSelected, setModalAccPlazaResults],
                  ].map(
                    ([label, value, setValue, entity, mode, results, selected, setSelected, setResults]) => (
                      <ThemedView key={`modal-acc-${String(mode)}`} style={{ marginBottom: 8 }}>
                        <ThemedText style={styles.label}>{String(label)}</ThemedText>
                        <View style={styles.row}>
                          <TextInput
                            style={[styles.input, styles.inputFlex]}
                            value={String(value)}
                            onChangeText={setValue as any}
                            placeholder={`Buscar ${String(label).toLowerCase()}`}
                            placeholderTextColor="#999"
                          />
                          <TouchableOpacity
                            style={styles.searchIconBtn}
                            onPress={() => void runSearchActaStructure(String(value), entity as any, mode as any)}
                            activeOpacity={0.85}
                            disabled={employeeSearchMode === mode}
                          >
                            {employeeSearchMode === mode ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <Ionicons name="search" size={22} color="#fff" />
                            )}
                          </TouchableOpacity>
                        </View>
                        {(results as StructureLite[]).length ? (
                          <ThemedView style={styles.resultList}>
                            {(results as StructureLite[]).map((it) => (
                              <TouchableOpacity
                                key={`modal-acc-${String(mode)}-${it.id}`}
                                style={styles.resultItem}
                                onPress={() =>
                                  pickStructureLite(
                                    it,
                                    setSelected as React.Dispatch<React.SetStateAction<StructureLite[]>>,
                                    setResults as React.Dispatch<React.SetStateAction<StructureLite[]>>,
                                    setValue as React.Dispatch<React.SetStateAction<string>>,
                                  )
                                }
                              >
                                <ThemedText>{formatStructureLite(it)}</ThemedText>
                              </TouchableOpacity>
                            ))}
                          </ThemedView>
                        ) : null}
                        <ThemedView style={styles.assignedList}>
                          {(selected as StructureLite[]).length === 0 ? (
                            <ThemedText style={styles.helperText}>Ningún {String(label).toLowerCase()} seleccionado.</ThemedText>
                          ) : (
                            (selected as StructureLite[]).map((it) => (
                              <ThemedView key={`modal-acc-sel-${String(mode)}-${it.id}`} style={styles.assignedUserItem}>
                                <ThemedText style={styles.assignedUserTitle}>{formatStructureLite(it)}</ThemedText>
                                <TouchableOpacity
                                  style={styles.removeUserButton}
                                  onPress={() =>
                                    removeStructureLite(
                                      it.id,
                                      setSelected as React.Dispatch<React.SetStateAction<StructureLite[]>>,
                                    )
                                  }
                                >
                                  <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                                </TouchableOpacity>
                              </ThemedView>
                            ))
                          )}
                        </ThemedView>
                      </ThemedView>
                    ),
                  )}

                  <ThemedText style={styles.label}>Ordenar por</ThemedText>
                  <View style={styles.pickerWrapper}>
                    <Picker selectedValue={formOrder} onValueChange={(v) => setFormOrder(String(v))} style={styles.picker}>
                      {ORDER_OPTIONS_ACCIONES_PERSONALES.map((o) => (
                        <Picker.Item key={o.value} label={o.label} value={o.value} color="#000000" />
                      ))}
                    </Picker>
                  </View>

                  <ThemedText style={styles.label}>Tipo de reporte</ThemedText>
                  <View style={styles.pickerWrapper}>
                    <Picker selectedValue="Consolidado" enabled={false} style={styles.picker}>
                      <Picker.Item label="Consolidado" value="Consolidado" color="#000000" />
                    </Picker>
                  </View>

                  <TouchableOpacity style={[styles.attachButton, { marginTop: 16 }]} onPress={() => void runPreview()} activeOpacity={0.85}>
                    {previewLoading ? (
                      <ActivityIndicator color="#007AFF" />
                    ) : (
                      <>
                        <Ionicons name="eye-outline" size={22} color="#007AFF" />
                        <ThemedText style={styles.attachButtonText}>Buscar registros (preview)</ThemedText>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.collapseButton} onPress={() => setPreviewOpen(!previewOpen)} activeOpacity={0.85}>
                    <ThemedText style={styles.collapseButtonText}>
                      Resultados {previewRows != null ? `(${previewRows.length})` : ''}
                    </ThemedText>
                    <Ionicons name={previewOpen ? 'chevron-up' : 'chevron-down'} size={20} color="#007AFF" />
                  </TouchableOpacity>
                  {previewOpen && previewRows != null ? (
                    <ThemedView style={styles.collapseContent}>
                      {previewRows.map((row, idx) => (
                        <ThemedView key={`prev-acc-${idx}`} style={{ marginBottom: 12 }}>
                          <ThemedText style={styles.detailText}>
                            {row.empleado_txt ?? '—'} | {row.tipo_accion_txt ?? '—'}
                          </ThemedText>
                          <ThemedText style={styles.helperText}>
                            {row.empresa_txt ?? '—'} · {row.cliente_txt ?? '—'} · {row.division_txt ?? '—'}
                          </ThemedText>
                          <ThemedText style={styles.helperText}>
                            {row.contrato_txt ?? '—'} · {row.corpo_txt ?? '—'} · {row.puesto_txt ?? '—'} · {row.plaza_txt ?? '—'}
                          </ThemedText>
                          <ThemedText style={styles.helperText}>
                            Inicio {row.fecha_inicio_txt ?? '—'} · Fin {row.fecha_fin_txt ?? '—'}
                          </ThemedText>
                        </ThemedView>
                      ))}
                    </ThemedView>
                  ) : null}
                </ThemedView>
              ) : null}

              {formModulo === MODULO_ACTA_ENTREGA ||
              formModulo === MODULO_ENTREGA_PUESTO ||
              formModulo === MODULO_AGENDA_MINUTA ||
              formModulo === MODULO_APERTURA_CIERRE ||
              formModulo === MODULO_VULNERABILIDAD ||
              formModulo === MODULO_ACTIVIDADES ||
              formModulo === MODULO_CONTROL_ASISTENCIA ||
              formModulo === MODULO_DOCUMENTOS_ENTREGADOS ||
              formModulo === MODULO_ENCUESTA_SATISFACCION ||
              formModulo === MODULO_REGISTRO_VISITAS ||
              formModulo === MODULO_MUTUOS_ACUERDOS ||
              formModulo === MODULO_EVALUACION_PERSONAL ||
              formModulo === MODULO_PRODUCTO_NO_CONFORME ||
              formModulo === MODULO_REGISTRO_INDUCCION_RECORRIDO ||
              formModulo === MODULO_MANUALES_PUESTO ||
              formModulo === MODULO_INCIDENTES ||
              formModulo === MODULO_LLAVES ||
              formModulo === MODULO_LLAVEROS ||
              formModulo === MODULO_BITACORA_NOVEDADES ||
              formModulo === MODULO_MAESTRO_QUEJAS ||
              formModulo === MODULO_CHECKLIST_SUPERVISION ? (
                <ThemedView style={styles.modalFormCard}>
                  <ThemedText style={styles.modalSectionTitle}>
                    {formModulo === MODULO_AGENDA_MINUTA
                      ? 'Filtros — Agenda minuta'
                      : formModulo === MODULO_APERTURA_CIERRE
                        ? 'Filtros — Apertura/Cierre de puesto'
                        : formModulo === MODULO_VULNERABILIDAD
                          ? 'Filtros — Apreciación de vulnerabilidad'
                          : formModulo === MODULO_ACTIVIDADES
                            ? 'Filtros — Actividades'
                            : formModulo === MODULO_CONTROL_ASISTENCIA
                              ? 'Filtros — Control de asistencia'
                              : formModulo === MODULO_DOCUMENTOS_ENTREGADOS
                                ? 'Filtros — Documentos entregados'
                                : formModulo === MODULO_ENCUESTA_SATISFACCION
                                  ? 'Filtros — Encuestas de satisfacción'
                                  : formModulo === MODULO_REGISTRO_VISITAS
                                    ? 'Filtros — Registro de visitas'
                                  : formModulo === MODULO_MUTUOS_ACUERDOS
                                    ? 'Filtros — Mutuos acuerdos'
                                : formModulo === MODULO_EVALUACION_PERSONAL
                                  ? 'Filtros — Evaluación de personal'
                                : formModulo === MODULO_REGISTRO_INDUCCION_RECORRIDO
                                  ? 'Filtros — Registro de inducción y recorrido'
                                : formModulo === MODULO_MANUALES_PUESTO
                                  ? 'Filtros — Manuales de puesto'
                                : formModulo === MODULO_PRODUCTO_NO_CONFORME
                                  ? 'Filtros — Producto no conforme'
                                : formModulo === MODULO_INCIDENTES
                                  ? 'Filtros — Incidentes'
                                  : formModulo === MODULO_CHECKLIST_SUPERVISION
                                    ? 'Filtros — Checklist de supervisión'
                                  : formModulo === MODULO_BITACORA_NOVEDADES
                                    ? 'Filtros — Bitácora de novedades'
                                  : formModulo === MODULO_MAESTRO_QUEJAS
                                    ? 'Filtros — Maestro de quejas y reclamos'
                                  : formModulo === MODULO_LLAVES
                                    ? 'Filtros — Llaves'
                                  : formModulo === MODULO_LLAVEROS
                                    ? 'Filtros — Llaveros'
                                : formModulo === MODULO_ENTREGA_PUESTO
                                  ? 'Filtros — Entrega de puesto'
                      : 'Filtros del módulo'}
                  </ThemedText>
                  <ThemedText style={styles.label}>Creado desde</ThemedText>
                  <View style={styles.dateRow}>
                    <TouchableOpacity style={styles.dateButtonHalf} onPress={() => setShowModalActaDd(true)} activeOpacity={0.85}>
                      <ThemedText style={styles.dateButtonText}>{modalActaDesdeD ? formatDateOnlyLabel(modalActaDesdeD) : 'Fecha'}</ThemedText>
                      <Ionicons name="calendar-outline" size={18} color="#007AFF" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.dateButtonHalf} onPress={() => setShowModalActaDt(true)} activeOpacity={0.85}>
                      <ThemedText style={styles.dateButtonText}>{modalActaDesdeT ? hm(modalActaDesdeT) : 'Hora'}</ThemedText>
                      <Ionicons name="time-outline" size={18} color="#007AFF" />
                    </TouchableOpacity>
                  </View>
                  <ThemedText style={styles.label}>Creado hasta</ThemedText>
                  <View style={styles.dateRow}>
                    <TouchableOpacity style={styles.dateButtonHalf} onPress={() => setShowModalActaHd(true)} activeOpacity={0.85}>
                      <ThemedText style={styles.dateButtonText}>{modalActaHastaD ? formatDateOnlyLabel(modalActaHastaD) : 'Fecha'}</ThemedText>
                      <Ionicons name="calendar-outline" size={18} color="#007AFF" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.dateButtonHalf} onPress={() => setShowModalActaHt(true)} activeOpacity={0.85}>
                      <ThemedText style={styles.dateButtonText}>{modalActaHastaT ? hm(modalActaHastaT) : 'Hora'}</ThemedText>
                      <Ionicons name="time-outline" size={18} color="#007AFF" />
                    </TouchableOpacity>
                  </View>

                  {[
                    ['Empresa', modalEmpresaSearch, setModalEmpresaSearch, 'empresa', 'modalEmpresa', modalEmpresaResults, modalEmpresaSelected, setModalEmpresaSelected, setModalEmpresaResults],
                    ['Cliente', modalClienteSearch, setModalClienteSearch, 'cliente', 'modalCliente', modalClienteResults, modalClienteSelected, setModalClienteSelected, setModalClienteResults],
                    ['División', modalDivisionSearch, setModalDivisionSearch, 'division', 'modalDivision', modalDivisionResults, modalDivisionSelected, setModalDivisionSelected, setModalDivisionResults],
                    ['Contrato', modalContratoSearch, setModalContratoSearch, 'contrato', 'modalContrato', modalContratoResults, modalContratoSelected, setModalContratoSelected, setModalContratoResults],
                    ['Corpo', modalCorpoSearch, setModalCorpoSearch, 'corpo', 'modalCorpo', modalCorpoResults, modalCorpoSelected, setModalCorpoSelected, setModalCorpoResults],
                    ['Puesto', modalPuestoSearch, setModalPuestoSearch, 'puesto', 'modalPuesto', modalPuestoResults, modalPuestoSelected, setModalPuestoSelected, setModalPuestoResults],
                  ].map(
                    ([label, value, setValue, entity, mode, results, selected, setSelected, setResults]) => (
                      <ThemedView key={`modal-${String(mode)}`} style={{ marginBottom: 8 }}>
                        <ThemedText style={styles.label}>{String(label)}</ThemedText>
                        <View style={styles.row}>
                          <TextInput
                            style={[styles.input, styles.inputFlex]}
                            value={String(value)}
                            onChangeText={setValue as any}
                            placeholder={`Buscar ${String(label).toLowerCase()}`}
                            placeholderTextColor="#999"
                          />
                          <TouchableOpacity
                            style={styles.searchIconBtn}
                            onPress={() => void runSearchActaStructure(String(value), entity as any, mode as any)}
                            activeOpacity={0.85}
                            disabled={employeeSearchMode === mode}
                          >
                            {employeeSearchMode === mode ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <Ionicons name="search" size={22} color="#fff" />
                            )}
                          </TouchableOpacity>
                        </View>
                        {(results as StructureLite[]).length ? (
                          <ThemedView style={styles.resultList}>
                            {(results as StructureLite[]).map((it) => (
                              <TouchableOpacity
                                key={`modal-${String(mode)}-${it.id}`}
                                style={styles.resultItem}
                                onPress={() =>
                                  pickStructureLite(
                                    it,
                                    setSelected as React.Dispatch<React.SetStateAction<StructureLite[]>>,
                                    setResults as React.Dispatch<React.SetStateAction<StructureLite[]>>,
                                    setValue as React.Dispatch<React.SetStateAction<string>>,
                                  )
                                }
                              >
                                <ThemedText>{formatStructureLite(it)}</ThemedText>
                              </TouchableOpacity>
                            ))}
                          </ThemedView>
                        ) : null}
                        <ThemedView style={styles.assignedList}>
                          {(selected as StructureLite[]).length === 0 ? (
                            <ThemedText style={styles.helperText}>Ningún {String(label).toLowerCase()} seleccionado.</ThemedText>
                          ) : (
                            (selected as StructureLite[]).map((it) => (
                              <ThemedView key={`modal-sel-${String(mode)}-${it.id}`} style={styles.assignedUserItem}>
                                <ThemedText style={styles.assignedUserTitle}>{formatStructureLite(it)}</ThemedText>
                                <TouchableOpacity
                                  style={styles.removeUserButton}
                                  onPress={() =>
                                    removeStructureLite(
                                      it.id,
                                      setSelected as React.Dispatch<React.SetStateAction<StructureLite[]>>,
                                    )
                                  }
                                >
                                  <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                                </TouchableOpacity>
                              </ThemedView>
                            ))
                          )}
                        </ThemedView>
                      </ThemedView>
                    ),
                  )}

                  {formModulo === MODULO_INCIDENTES || formModulo === MODULO_CHECKLIST_SUPERVISION ? (
                    <ThemedView style={{ marginBottom: 8 }}>
                      <ThemedText style={styles.label}>Ejecutivo de cuenta</ThemedText>
                      <View style={styles.row}>
                        <TextInput
                          style={[styles.input, styles.inputFlex]}
                          value={modalEjecutivoSearch}
                          onChangeText={setModalEjecutivoSearch}
                          placeholder="Buscar ejecutivo"
                          placeholderTextColor="#999"
                        />
                        <TouchableOpacity
                          style={styles.searchIconBtn}
                          onPress={() => void runSearchActaStructure(modalEjecutivoSearch, 'ejecutivo', 'modalEjecutivo')}
                          activeOpacity={0.85}
                          disabled={employeeSearchMode === 'modalEjecutivo'}
                        >
                          {employeeSearchMode === 'modalEjecutivo' ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Ionicons name="search" size={22} color="#fff" />
                          )}
                        </TouchableOpacity>
                      </View>
                      {modalEjecutivoResults.length ? (
                        <ThemedView style={styles.resultList}>
                          {modalEjecutivoResults.map((it) => (
                            <TouchableOpacity
                              key={`modal-ej-${it.id}`}
                              style={styles.resultItem}
                              onPress={() =>
                                pickStructureLite(it, setModalEjecutivoSelected, setModalEjecutivoResults, setModalEjecutivoSearch)
                              }
                            >
                              <ThemedText>{formatStructureLite(it)}</ThemedText>
                            </TouchableOpacity>
                          ))}
                        </ThemedView>
                      ) : null}
                      <ThemedView style={styles.assignedList}>
                        {modalEjecutivoSelected.length === 0 ? (
                          <ThemedText style={styles.helperText}>Ningún ejecutivo seleccionado.</ThemedText>
                        ) : (
                          modalEjecutivoSelected.map((it) => (
                            <ThemedView key={`sel-modal-ej-${it.id}`} style={styles.assignedUserItem}>
                              <ThemedText style={styles.assignedUserTitle}>{formatStructureLite(it)}</ThemedText>
                              <TouchableOpacity style={styles.removeUserButton} onPress={() => removeStructureLite(it.id, setModalEjecutivoSelected)}>
                                <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                              </TouchableOpacity>
                            </ThemedView>
                          ))
                        )}
                      </ThemedView>
                    </ThemedView>
                  ) : null}

                  {formModulo === MODULO_AGENDA_MINUTA ? (
                    <>
                      <ThemedText style={styles.label}>Estado</ThemedText>
                      <View style={styles.pickerWrapper}>
                        <Picker
                          selectedValue={modalAgendaEstado}
                          onValueChange={(v) =>
                            setModalAgendaEstado(String(v) as 'todos' | 'completado' | 'pendiente')
                          }
                          style={styles.picker}
                        >
                          <Picker.Item label="Todos" value="todos" color="#000000" />
                          <Picker.Item label="Completado" value="completado" color="#000000" />
                          <Picker.Item label="Pendiente" value="pendiente" color="#000000" />
                        </Picker>
                      </View>
                    </>
                  ) : null}
                  {formModulo === MODULO_APERTURA_CIERRE ? (
                    <>
                      <ThemedText style={styles.label}>Tipo</ThemedText>
                      <View style={styles.pickerWrapper}>
                        <Picker
                          selectedValue={modalAcpTipo}
                          onValueChange={(v) => setModalAcpTipo(String(v) as 'todos' | 'apertura' | 'cierre')}
                          style={styles.picker}
                        >
                          <Picker.Item label="Todos" value="todos" color="#000000" />
                          <Picker.Item label="Apertura" value="apertura" color="#000000" />
                          <Picker.Item label="Cierre" value="cierre" color="#000000" />
                        </Picker>
                      </View>

                      <ThemedText style={styles.label}>Creado por</ThemedText>
                      <View style={styles.row}>
                        <TextInput
                          style={[styles.input, styles.inputFlex]}
                          value={modalUsuarioSearch}
                          onChangeText={setModalUsuarioSearch}
                          placeholder="Buscar empleado creador"
                          placeholderTextColor="#999"
                        />
                        <TouchableOpacity
                          style={styles.searchIconBtn}
                          onPress={() => runSearchEmployees(modalUsuarioSearch, 'modalUsuario')}
                          activeOpacity={0.85}
                          disabled={employeeSearchMode === 'modalUsuario'}
                        >
                          {employeeSearchMode === 'modalUsuario' ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Ionicons name="search" size={22} color="#fff" />
                          )}
                        </TouchableOpacity>
                      </View>
                      {modalUsuarioResults.length ? (
                        <ThemedView style={styles.resultList}>
                          {modalUsuarioResults.map((e) => (
                            <TouchableOpacity key={e.id} style={styles.resultItem} onPress={() => pickModalUsuario(e)}>
                              <ThemedText>
                                {e.codigo} — {formatEmpleadoNombre(e)}
                              </ThemedText>
                            </TouchableOpacity>
                          ))}
                        </ThemedView>
                      ) : null}
                      <ThemedView style={styles.assignedList}>
                        {modalUsuariosSelected.map((e) => (
                          <ThemedView key={`acp-modal-${e.id}`} style={styles.assignedUserItem}>
                            <ThemedText style={styles.assignedUserTitle}>
                              {e.codigo} — {formatEmpleadoNombre(e)}
                            </ThemedText>
                            <TouchableOpacity style={styles.removeUserButton} onPress={() => removeModalUsuario(e.id)}>
                              <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                            </TouchableOpacity>
                          </ThemedView>
                        ))}
                      </ThemedView>
                    </>
                  ) : null}
                  {formModulo === MODULO_CONTROL_ASISTENCIA ? (
                    <>
                      <ThemedText style={styles.label}>Tipo de turno</ThemedText>
                      <View style={styles.pickerWrapper}>
                        <Picker selectedValue={modalAsisTurno} onValueChange={(v) => setModalAsisTurno(String(v) as any)} style={styles.picker}>
                          <Picker.Item label="Todos" value="todos" color="#000000" />
                          <Picker.Item label="Diurno" value="D" color="#000000" />
                          <Picker.Item label="Mixto" value="M" color="#000000" />
                          <Picker.Item label="Nocturno" value="N" color="#000000" />
                        </Picker>
                      </View>
                    </>
                  ) : null}
                  {formModulo === MODULO_DOCUMENTOS_ENTREGADOS ? (
                    <>
                      <ThemedText style={styles.label}>Tipo de documento</ThemedText>
                      <View style={styles.pickerWrapper}>
                        <Picker selectedValue={modalDocTipo} onValueChange={(v) => setModalDocTipo(String(v))} style={styles.picker}>
                          <Picker.Item label="Todos" value="todos" color="#000000" />
                          {documentTypesCache.map((d) => (
                            <Picker.Item key={`modal-doc-type-${d.id}`} label={d.nombre} value={d.nombre} color="#000000" />
                          ))}
                        </Picker>
                      </View>
                    </>
                  ) : null}
                  {formModulo === MODULO_ENCUESTA_SATISFACCION ? (
                    <>
                      <ThemedText style={styles.label}>Responsable de evaluación</ThemedText>
                      <View style={styles.row}>
                        <TextInput
                          style={[styles.input, styles.inputFlex]}
                          value={modalEncResponsableSearch}
                          onChangeText={setModalEncResponsableSearch}
                          placeholder="Código o nombre"
                          placeholderTextColor="#999"
                        />
                        <TouchableOpacity
                          style={styles.searchIconBtn}
                          onPress={() => void runSearchEmployees(modalEncResponsableSearch, 'modalEncResponsable')}
                          activeOpacity={0.85}
                          disabled={employeeSearchMode === 'modalEncResponsable'}
                        >
                          {employeeSearchMode === 'modalEncResponsable' ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Ionicons name="search" size={22} color="#fff" />
                          )}
                        </TouchableOpacity>
                      </View>
                      {modalEncResponsableResults.length ? (
                        <ThemedView style={styles.resultList}>
                          {modalEncResponsableResults.map((e) => (
                            <TouchableOpacity key={`modal-enc-r-${e.id}`} style={styles.resultItem} onPress={() => pickModalEncResponsable(e)}>
                              <ThemedText>
                                {e.codigo} — {formatEmpleadoNombre(e)}
                              </ThemedText>
                            </TouchableOpacity>
                          ))}
                        </ThemedView>
                      ) : null}
                      <ThemedView style={styles.assignedList}>
                        {modalEncResponsableSelected.length === 0 ? (
                          <ThemedText style={styles.helperText}>Opcional: uno o más responsables.</ThemedText>
                        ) : (
                          modalEncResponsableSelected.map((e) => (
                            <ThemedView key={`modal-enc-sel-${e.id}`} style={styles.assignedUserItem}>
                              <ThemedText style={styles.assignedUserTitle}>
                                {e.codigo} — {formatEmpleadoNombre(e)}
                              </ThemedText>
                              <TouchableOpacity style={styles.removeUserButton} onPress={() => removeModalEncResponsable(e.id)}>
                                <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                              </TouchableOpacity>
                            </ThemedView>
                          ))
                        )}
                      </ThemedView>
                    </>
                  ) : null}
                  {formModulo === MODULO_REGISTRO_VISITAS ? (
                    <>
                      <ThemedText style={styles.label}>Cédula del visitante</ThemedText>
                      <TextInput
                        style={styles.input}
                        value={modalRvCedulaVisitante}
                        onChangeText={setModalRvCedulaVisitante}
                        placeholder="Opcional"
                        placeholderTextColor="#999"
                      />
                      <ThemedText style={styles.label}>Tipo de visitante</ThemedText>
                      <View style={styles.pickerWrapper}>
                        <Picker
                          selectedValue={modalRvTipoVisitante}
                          onValueChange={(v) => setModalRvTipoVisitante(String(v) as 'todos' | 'normal' | 'funcionario')}
                          style={styles.picker}
                        >
                          <Picker.Item label="Todos" value="todos" color="#000000" />
                          <Picker.Item label="Normal" value="normal" color="#000000" />
                          <Picker.Item label="Funcionario" value="funcionario" color="#000000" />
                        </Picker>
                      </View>
                      <ThemedText style={styles.label}>Responsable</ThemedText>
                      <View style={styles.row}>
                        <TextInput
                          style={[styles.input, styles.inputFlex]}
                          value={modalRvResponsableSearch}
                          onChangeText={setModalRvResponsableSearch}
                          placeholder="Código o nombre"
                          placeholderTextColor="#999"
                        />
                        <TouchableOpacity
                          style={styles.searchIconBtn}
                          onPress={() => void runSearchEmployees(modalRvResponsableSearch, 'modalRvResponsable')}
                          activeOpacity={0.85}
                          disabled={employeeSearchMode === 'modalRvResponsable'}
                        >
                          {employeeSearchMode === 'modalRvResponsable' ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Ionicons name="search" size={22} color="#fff" />
                          )}
                        </TouchableOpacity>
                      </View>
                      {modalRvResponsableResults.length ? (
                        <ThemedView style={styles.resultList}>
                          {modalRvResponsableResults.map((e) => (
                            <TouchableOpacity key={`modal-rv-r-${e.id}`} style={styles.resultItem} onPress={() => pickModalRvResponsable(e)}>
                              <ThemedText>
                                {e.codigo} — {formatEmpleadoNombre(e)}
                              </ThemedText>
                            </TouchableOpacity>
                          ))}
                        </ThemedView>
                      ) : null}
                      <ThemedView style={styles.assignedList}>
                        {modalRvResponsableSelected.length === 0 ? (
                          <ThemedText style={styles.helperText}>Opcional: uno o más responsables.</ThemedText>
                        ) : (
                          modalRvResponsableSelected.map((e) => (
                            <ThemedView key={`modal-rv-sel-${e.id}`} style={styles.assignedUserItem}>
                              <ThemedText style={styles.assignedUserTitle}>
                                {e.codigo} — {formatEmpleadoNombre(e)}
                              </ThemedText>
                              <TouchableOpacity style={styles.removeUserButton} onPress={() => removeModalRvResponsable(e.id)}>
                                <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                              </TouchableOpacity>
                            </ThemedView>
                          ))
                        )}
                      </ThemedView>
                    </>
                  ) : null}
                  {formModulo === MODULO_EVALUACION_PERSONAL ? (
                    <>
                      <ThemedText style={styles.label}>Empleado evaluado</ThemedText>
                      <View style={styles.row}>
                        <TextInput
                          style={[styles.input, styles.inputFlex]}
                          value={modalEvpEmpEvalSearch}
                          onChangeText={setModalEvpEmpEvalSearch}
                          placeholder="Código o nombre"
                          placeholderTextColor="#999"
                        />
                        <TouchableOpacity
                          style={styles.searchIconBtn}
                          onPress={() => void runSearchEmployees(modalEvpEmpEvalSearch, 'modalEvpEmpEval')}
                          activeOpacity={0.85}
                          disabled={employeeSearchMode === 'modalEvpEmpEval'}
                        >
                          {employeeSearchMode === 'modalEvpEmpEval' ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Ionicons name="search" size={22} color="#fff" />
                          )}
                        </TouchableOpacity>
                      </View>
                      {modalEvpEmpEvalResults.length ? (
                        <ThemedView style={styles.resultList}>
                          {modalEvpEmpEvalResults.map((e) => (
                            <TouchableOpacity key={`modal-evp-ee-${e.id}`} style={styles.resultItem} onPress={() => pickModalEvpEmpEval(e)}>
                              <ThemedText>
                                {e.codigo} — {formatEmpleadoNombre(e)}
                              </ThemedText>
                            </TouchableOpacity>
                          ))}
                        </ThemedView>
                      ) : null}
                      <ThemedView style={styles.assignedList}>
                        {modalEvpEmpEvalSelected.length === 0 ? (
                          <ThemedText style={styles.helperText}>Opcional: uno o más empleados evaluados.</ThemedText>
                        ) : (
                          modalEvpEmpEvalSelected.map((e) => (
                            <ThemedView key={`modal-evp-ee-sel-${e.id}`} style={styles.assignedUserItem}>
                              <ThemedText style={styles.assignedUserTitle}>
                                {e.codigo} — {formatEmpleadoNombre(e)}
                              </ThemedText>
                              <TouchableOpacity style={styles.removeUserButton} onPress={() => removeModalEvpEmpEval(e.id)}>
                                <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                              </TouchableOpacity>
                            </ThemedView>
                          ))
                        )}
                      </ThemedView>
                      <ThemedText style={styles.label}>Evaluador</ThemedText>
                      <View style={styles.row}>
                        <TextInput
                          style={[styles.input, styles.inputFlex]}
                          value={modalEvpEvaluadorSearch}
                          onChangeText={setModalEvpEvaluadorSearch}
                          placeholder="Código o nombre"
                          placeholderTextColor="#999"
                        />
                        <TouchableOpacity
                          style={styles.searchIconBtn}
                          onPress={() => void runSearchEmployees(modalEvpEvaluadorSearch, 'modalEvpEvaluador')}
                          activeOpacity={0.85}
                          disabled={employeeSearchMode === 'modalEvpEvaluador'}
                        >
                          {employeeSearchMode === 'modalEvpEvaluador' ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Ionicons name="search" size={22} color="#fff" />
                          )}
                        </TouchableOpacity>
                      </View>
                      {modalEvpEvaluadorResults.length ? (
                        <ThemedView style={styles.resultList}>
                          {modalEvpEvaluadorResults.map((e) => (
                            <TouchableOpacity key={`modal-evp-ev-${e.id}`} style={styles.resultItem} onPress={() => pickModalEvpEvaluador(e)}>
                              <ThemedText>
                                {e.codigo} — {formatEmpleadoNombre(e)}
                              </ThemedText>
                            </TouchableOpacity>
                          ))}
                        </ThemedView>
                      ) : null}
                      <ThemedView style={styles.assignedList}>
                        {modalEvpEvaluadorSelected.length === 0 ? (
                          <ThemedText style={styles.helperText}>Opcional: uno o más evaluadores.</ThemedText>
                        ) : (
                          modalEvpEvaluadorSelected.map((e) => (
                            <ThemedView key={`modal-evp-ev-sel-${e.id}`} style={styles.assignedUserItem}>
                              <ThemedText style={styles.assignedUserTitle}>
                                {e.codigo} — {formatEmpleadoNombre(e)}
                              </ThemedText>
                              <TouchableOpacity style={styles.removeUserButton} onPress={() => removeModalEvpEvaluador(e.id)}>
                                <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                              </TouchableOpacity>
                            </ThemedView>
                          ))
                        )}
                      </ThemedView>
                      <ThemedText style={styles.label}>Tipo de evaluación</ThemedText>
                      <View style={styles.pickerWrapper}>
                        <Picker
                          selectedValue={modalEvpTipoEvaluacion}
                          onValueChange={(v) =>
                            setModalEvpTipoEvaluacion(String(v) as 'todos' | 'Seguridad' | 'Aseo & limpieza' | 'Otros')
                          }
                          style={styles.picker}
                        >
                          <Picker.Item label="Todos" value="todos" color="#000000" />
                          <Picker.Item label="Seguridad" value="Seguridad" color="#000000" />
                          <Picker.Item label="Aseo & limpieza" value="Aseo & limpieza" color="#000000" />
                          <Picker.Item label="Otros" value="Otros" color="#000000" />
                        </Picker>
                      </View>
                    </>
                  ) : null}
                  {formModulo === MODULO_PRODUCTO_NO_CONFORME ? (
                    <>
                      <ThemedText style={styles.label}>Tipo de producto no conforme</ThemedText>
                      <View style={styles.pickerWrapper}>
                        <Picker
                          selectedValue={modalPncTipoServicio}
                          onValueChange={(v) => setModalPncTipoServicio(String(v))}
                          style={styles.picker}
                        >
                          <Picker.Item label="Todos" value="todos" color="#000000" />
                          {pncTiposCache.map((t) => (
                            <Picker.Item key={`modal-pnc-tipo-${t.id}`} label={t.nombre} value={t.nombre} color="#000000" />
                          ))}
                        </Picker>
                      </View>
                    </>
                  ) : null}
                  {formModulo === MODULO_REGISTRO_INDUCCION_RECORRIDO ? (
                    <>
                      <ThemedText style={styles.label}>Responsable (creador del registro)</ThemedText>
                      <View style={styles.row}>
                        <TextInput
                          style={[styles.input, styles.inputFlex]}
                          value={modalIrResponsableSearch}
                          onChangeText={setModalIrResponsableSearch}
                          placeholder="Código o nombre"
                          placeholderTextColor="#999"
                        />
                        <TouchableOpacity
                          style={styles.searchIconBtn}
                          onPress={() => void runSearchEmployees(modalIrResponsableSearch, 'modalIrResponsable')}
                          activeOpacity={0.85}
                          disabled={employeeSearchMode === 'modalIrResponsable'}
                        >
                          {employeeSearchMode === 'modalIrResponsable' ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Ionicons name="search" size={22} color="#fff" />
                          )}
                        </TouchableOpacity>
                      </View>
                      {modalIrResponsableResults.length ? (
                        <ThemedView style={styles.resultList}>
                          {modalIrResponsableResults.map((e) => (
                            <TouchableOpacity key={`modal-ir-r-${e.id}`} style={styles.resultItem} onPress={() => pickModalIrResponsable(e)}>
                              <ThemedText>
                                {e.codigo} — {formatEmpleadoNombre(e)}
                              </ThemedText>
                            </TouchableOpacity>
                          ))}
                        </ThemedView>
                      ) : null}
                      <ThemedView style={styles.assignedList}>
                        {modalIrResponsableSelected.length === 0 ? (
                          <ThemedText style={styles.helperText}>Opcional: uno o más responsables.</ThemedText>
                        ) : (
                          modalIrResponsableSelected.map((e) => (
                            <ThemedView key={`modal-ir-r-sel-${e.id}`} style={styles.assignedUserItem}>
                              <ThemedText style={styles.assignedUserTitle}>
                                {e.codigo} — {formatEmpleadoNombre(e)}
                              </ThemedText>
                              <TouchableOpacity style={styles.removeUserButton} onPress={() => removeModalIrResponsable(e.id)}>
                                <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                              </TouchableOpacity>
                            </ThemedView>
                          ))
                        )}
                      </ThemedView>
                      <ThemedText style={styles.label}>Empleado del registro</ThemedText>
                      <View style={styles.row}>
                        <TextInput
                          style={[styles.input, styles.inputFlex]}
                          value={modalIrEmpleadoSearch}
                          onChangeText={setModalIrEmpleadoSearch}
                          placeholder="Código o nombre"
                          placeholderTextColor="#999"
                        />
                        <TouchableOpacity
                          style={styles.searchIconBtn}
                          onPress={() => void runSearchEmployees(modalIrEmpleadoSearch, 'modalIrEmpleado')}
                          activeOpacity={0.85}
                          disabled={employeeSearchMode === 'modalIrEmpleado'}
                        >
                          {employeeSearchMode === 'modalIrEmpleado' ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Ionicons name="search" size={22} color="#fff" />
                          )}
                        </TouchableOpacity>
                      </View>
                      {modalIrEmpleadoResults.length ? (
                        <ThemedView style={styles.resultList}>
                          {modalIrEmpleadoResults.map((e) => (
                            <TouchableOpacity key={`modal-ir-e-${e.id}`} style={styles.resultItem} onPress={() => pickModalIrEmpleado(e)}>
                              <ThemedText>
                                {e.codigo} — {formatEmpleadoNombre(e)}
                              </ThemedText>
                            </TouchableOpacity>
                          ))}
                        </ThemedView>
                      ) : null}
                      <ThemedView style={styles.assignedList}>
                        {modalIrEmpleadoSelected.length === 0 ? (
                          <ThemedText style={styles.helperText}>Opcional: uno o más empleados.</ThemedText>
                        ) : (
                          modalIrEmpleadoSelected.map((e) => (
                            <ThemedView key={`modal-ir-e-sel-${e.id}`} style={styles.assignedUserItem}>
                              <ThemedText style={styles.assignedUserTitle}>
                                {e.codigo} — {formatEmpleadoNombre(e)}
                              </ThemedText>
                              <TouchableOpacity style={styles.removeUserButton} onPress={() => removeModalIrEmpleado(e.id)}>
                                <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                              </TouchableOpacity>
                            </ThemedView>
                          ))
                        )}
                      </ThemedView>
                      <ThemedText style={styles.label}>Participantes (cédula)</ThemedText>
                      <View style={styles.row}>
                        <TextInput
                          style={[styles.input, styles.inputFlex]}
                          value={modalIrParticipanteSearch}
                          onChangeText={setModalIrParticipanteSearch}
                          placeholder="Cédula"
                          placeholderTextColor="#999"
                        />
                        <TouchableOpacity style={styles.searchIconBtn} onPress={addModalIrParticipanteCedula} activeOpacity={0.85}>
                          <Ionicons name="add" size={22} color="#fff" />
                        </TouchableOpacity>
                      </View>
                      <ThemedView style={styles.assignedList}>
                        {modalIrParticipanteCedulas.length === 0 ? (
                          <ThemedText style={styles.helperText}>Opcional: una o más cédulas.</ThemedText>
                        ) : (
                          modalIrParticipanteCedulas.map((ced) => (
                            <ThemedView key={`modal-ir-p-${ced}`} style={styles.assignedUserItem}>
                              <ThemedText style={styles.assignedUserTitle}>{ced}</ThemedText>
                              <TouchableOpacity style={styles.removeUserButton} onPress={() => removeModalIrParticipanteCedula(ced)}>
                                <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                              </TouchableOpacity>
                            </ThemedView>
                          ))
                        )}
                      </ThemedView>
                    </>
                  ) : null}
                  {formModulo === MODULO_MUTUOS_ACUERDOS ? (
                    <>
                      <ThemedText style={styles.label}>Estado</ThemedText>
                      <View style={styles.pickerWrapper}>
                        <Picker
                          selectedValue={modalMutEstado}
                          onValueChange={(v) =>
                            setModalMutEstado(String(v) as 'todos' | 'aprobado' | 'rechazado' | 'pendiente')
                          }
                          style={styles.picker}
                        >
                          <Picker.Item label="Todos" value="todos" color="#000000" />
                          <Picker.Item label="Aprobado" value="aprobado" color="#000000" />
                          <Picker.Item label="Rechazado" value="rechazado" color="#000000" />
                          <Picker.Item label="Pendiente" value="pendiente" color="#000000" />
                        </Picker>
                      </View>
                      <ThemedText style={styles.label}>Persona ausente</ThemedText>
                      <View style={styles.row}>
                        <TextInput
                          style={[styles.input, styles.inputFlex]}
                          value={modalMutAusenteSearch}
                          onChangeText={setModalMutAusenteSearch}
                          placeholder="Código o nombre"
                          placeholderTextColor="#999"
                        />
                        <TouchableOpacity
                          style={styles.searchIconBtn}
                          onPress={() => void runSearchEmployees(modalMutAusenteSearch, 'modalMutAusente')}
                          activeOpacity={0.85}
                          disabled={employeeSearchMode === 'modalMutAusente'}
                        >
                          {employeeSearchMode === 'modalMutAusente' ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Ionicons name="search" size={22} color="#fff" />
                          )}
                        </TouchableOpacity>
                      </View>
                      {modalMutAusenteResults.length ? (
                        <ThemedView style={styles.resultList}>
                          {modalMutAusenteResults.map((e) => (
                            <TouchableOpacity key={`mma-${e.id}`} style={styles.resultItem} onPress={() => pickModalMutAusente(e)}>
                              <ThemedText>
                                {e.codigo} — {formatEmpleadoNombre(e)}
                              </ThemedText>
                            </TouchableOpacity>
                          ))}
                        </ThemedView>
                      ) : null}
                      <ThemedView style={styles.assignedList}>
                        {modalMutAusenteSelected.map((e) => (
                          <ThemedView key={`mmas-${e.id}`} style={styles.assignedUserItem}>
                            <ThemedText style={styles.assignedUserTitle}>
                              {e.codigo} — {formatEmpleadoNombre(e)}
                            </ThemedText>
                            <TouchableOpacity style={styles.removeUserButton} onPress={() => removeModalMutAusente(e.id)}>
                              <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                            </TouchableOpacity>
                          </ThemedView>
                        ))}
                      </ThemedView>
                      <ThemedText style={styles.label}>Persona reemplaza</ThemedText>
                      <View style={styles.row}>
                        <TextInput
                          style={[styles.input, styles.inputFlex]}
                          value={modalMutReemplazaSearch}
                          onChangeText={setModalMutReemplazaSearch}
                          placeholder="Código o nombre"
                          placeholderTextColor="#999"
                        />
                        <TouchableOpacity
                          style={styles.searchIconBtn}
                          onPress={() => void runSearchEmployees(modalMutReemplazaSearch, 'modalMutReemplaza')}
                          activeOpacity={0.85}
                          disabled={employeeSearchMode === 'modalMutReemplaza'}
                        >
                          {employeeSearchMode === 'modalMutReemplaza' ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Ionicons name="search" size={22} color="#fff" />
                          )}
                        </TouchableOpacity>
                      </View>
                      {modalMutReemplazaResults.length ? (
                        <ThemedView style={styles.resultList}>
                          {modalMutReemplazaResults.map((e) => (
                            <TouchableOpacity key={`mmr-${e.id}`} style={styles.resultItem} onPress={() => pickModalMutReemplaza(e)}>
                              <ThemedText>
                                {e.codigo} — {formatEmpleadoNombre(e)}
                              </ThemedText>
                            </TouchableOpacity>
                          ))}
                        </ThemedView>
                      ) : null}
                      <ThemedView style={styles.assignedList}>
                        {modalMutReemplazaSelected.map((e) => (
                          <ThemedView key={`mmrs-${e.id}`} style={styles.assignedUserItem}>
                            <ThemedText style={styles.assignedUserTitle}>
                              {e.codigo} — {formatEmpleadoNombre(e)}
                            </ThemedText>
                            <TouchableOpacity style={styles.removeUserButton} onPress={() => removeModalMutReemplaza(e.id)}>
                              <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                            </TouchableOpacity>
                          </ThemedView>
                        ))}
                      </ThemedView>
                      <ThemedText style={styles.label}>Ejecutivo de cuenta</ThemedText>
                      <View style={styles.row}>
                        <TextInput
                          style={[styles.input, styles.inputFlex]}
                          value={modalMutEjecutivoSearch}
                          onChangeText={setModalMutEjecutivoSearch}
                          placeholder="Nombre"
                          placeholderTextColor="#999"
                        />
                        <TouchableOpacity
                          style={styles.searchIconBtn}
                          onPress={() => void runSearchActaStructure(modalMutEjecutivoSearch, 'ejecutivo', 'modalMutEjecutivo')}
                          activeOpacity={0.85}
                          disabled={employeeSearchMode === 'modalMutEjecutivo'}
                        >
                          {employeeSearchMode === 'modalMutEjecutivo' ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Ionicons name="search" size={22} color="#fff" />
                          )}
                        </TouchableOpacity>
                      </View>
                      {modalMutEjecutivoResults.length ? (
                        <ThemedView style={styles.resultList}>
                          {modalMutEjecutivoResults.map((it) => (
                            <TouchableOpacity key={`mme-${it.id}`} style={styles.resultItem} onPress={() => pickModalMutEjecutivo(it)}>
                              <ThemedText>{formatStructureLite(it)}</ThemedText>
                            </TouchableOpacity>
                          ))}
                        </ThemedView>
                      ) : null}
                      <ThemedView style={styles.assignedList}>
                        {modalMutEjecutivoSelected.map((it) => (
                          <ThemedView key={`mmes-${it.id}`} style={styles.assignedUserItem}>
                            <ThemedText style={styles.assignedUserTitle}>{formatStructureLite(it)}</ThemedText>
                            <TouchableOpacity style={styles.removeUserButton} onPress={() => removeModalMutEjecutivo(it.id)}>
                              <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                            </TouchableOpacity>
                          </ThemedView>
                        ))}
                      </ThemedView>
                    </>
                  ) : null}
                  {formModulo === MODULO_INCIDENTES ? (
                    <>
                      <ThemedText style={styles.label}>Solucionado desde (fecha y hora)</ThemedText>
                      <View style={styles.dateRow}>
                        {Platform.OS === 'web' ? (
                          <>
                            <TextInput
                              style={[styles.input, styles.inputFlex, styles.epWebDtInput]}
                              value={modalIncSolDesdeD ? ymd(modalIncSolDesdeD) : ''}
                              onChangeText={(v) => setModalIncSolDesdeD(ymdOkStr(v) ? parseYmdToLocalDate(v) : null)}
                              placeholder="AAAA-MM-DD"
                              placeholderTextColor="#999"
                              {...({ type: 'date' } as object)}
                            />
                            <TextInput
                              style={[styles.input, styles.inputFlex, styles.epWebDtInput]}
                              value={modalIncSolDesdeT ? hm(modalIncSolDesdeT) : ''}
                              onChangeText={(v) => setModalIncSolDesdeT(hmOkStr(v) ? parseHmToLocalDate(v) : null)}
                              placeholder="HH:mm"
                              placeholderTextColor="#999"
                              {...({ type: 'time' } as object)}
                            />
                          </>
                        ) : (
                          <>
                            <TouchableOpacity style={styles.dateButtonHalf} onPress={() => setIncidentModalPicker('modal_sol_desde_ymd')}>
                              <ThemedText style={styles.dateButtonText}>{modalIncSolDesdeD ? formatDateOnlyLabel(modalIncSolDesdeD) : 'Fecha'}</ThemedText>
                              <Ionicons name="calendar-outline" size={18} color="#007AFF" />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.dateButtonHalf} onPress={() => setIncidentModalPicker('modal_sol_desde_hm')}>
                              <ThemedText style={styles.dateButtonText}>{modalIncSolDesdeT ? hm(modalIncSolDesdeT) : 'Hora'}</ThemedText>
                              <Ionicons name="time-outline" size={18} color="#007AFF" />
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                      <ThemedText style={styles.label}>Solucionado hasta (fecha y hora)</ThemedText>
                      <View style={styles.dateRow}>
                        {Platform.OS === 'web' ? (
                          <>
                            <TextInput
                              style={[styles.input, styles.inputFlex, styles.epWebDtInput]}
                              value={modalIncSolHastaD ? ymd(modalIncSolHastaD) : ''}
                              onChangeText={(v) => setModalIncSolHastaD(ymdOkStr(v) ? parseYmdToLocalDate(v) : null)}
                              placeholder="AAAA-MM-DD"
                              placeholderTextColor="#999"
                              {...({ type: 'date' } as object)}
                            />
                            <TextInput
                              style={[styles.input, styles.inputFlex, styles.epWebDtInput]}
                              value={modalIncSolHastaT ? hm(modalIncSolHastaT) : ''}
                              onChangeText={(v) => setModalIncSolHastaT(hmOkStr(v) ? parseHmToLocalDate(v) : null)}
                              placeholder="HH:mm"
                              placeholderTextColor="#999"
                              {...({ type: 'time' } as object)}
                            />
                          </>
                        ) : (
                          <>
                            <TouchableOpacity style={styles.dateButtonHalf} onPress={() => setIncidentModalPicker('modal_sol_hasta_ymd')}>
                              <ThemedText style={styles.dateButtonText}>{modalIncSolHastaD ? formatDateOnlyLabel(modalIncSolHastaD) : 'Fecha'}</ThemedText>
                              <Ionicons name="calendar-outline" size={18} color="#007AFF" />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.dateButtonHalf} onPress={() => setIncidentModalPicker('modal_sol_hasta_hm')}>
                              <ThemedText style={styles.dateButtonText}>{modalIncSolHastaT ? hm(modalIncSolHastaT) : 'Hora'}</ThemedText>
                              <Ionicons name="time-outline" size={18} color="#007AFF" />
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                      <ThemedText style={styles.label}>Solucionado (Real) desde (fecha y hora)</ThemedText>
                      <View style={styles.dateRow}>
                        {Platform.OS === 'web' ? (
                          <>
                            <TextInput
                              style={[styles.input, styles.inputFlex, styles.epWebDtInput]}
                              value={modalIncRealDesdeD ? ymd(modalIncRealDesdeD) : ''}
                              onChangeText={(v) => setModalIncRealDesdeD(ymdOkStr(v) ? parseYmdToLocalDate(v) : null)}
                              placeholder="AAAA-MM-DD"
                              placeholderTextColor="#999"
                              {...({ type: 'date' } as object)}
                            />
                            <TextInput
                              style={[styles.input, styles.inputFlex, styles.epWebDtInput]}
                              value={modalIncRealDesdeT ? hm(modalIncRealDesdeT) : ''}
                              onChangeText={(v) => setModalIncRealDesdeT(hmOkStr(v) ? parseHmToLocalDate(v) : null)}
                              placeholder="HH:mm"
                              placeholderTextColor="#999"
                              {...({ type: 'time' } as object)}
                            />
                          </>
                        ) : (
                          <>
                            <TouchableOpacity style={styles.dateButtonHalf} onPress={() => setIncidentModalPicker('modal_real_desde_ymd')}>
                              <ThemedText style={styles.dateButtonText}>{modalIncRealDesdeD ? formatDateOnlyLabel(modalIncRealDesdeD) : 'Fecha'}</ThemedText>
                              <Ionicons name="calendar-outline" size={18} color="#007AFF" />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.dateButtonHalf} onPress={() => setIncidentModalPicker('modal_real_desde_hm')}>
                              <ThemedText style={styles.dateButtonText}>{modalIncRealDesdeT ? hm(modalIncRealDesdeT) : 'Hora'}</ThemedText>
                              <Ionicons name="time-outline" size={18} color="#007AFF" />
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                      <ThemedText style={styles.label}>Solucionado (Real) hasta (fecha y hora)</ThemedText>
                      <View style={styles.dateRow}>
                        {Platform.OS === 'web' ? (
                          <>
                            <TextInput
                              style={[styles.input, styles.inputFlex, styles.epWebDtInput]}
                              value={modalIncRealHastaD ? ymd(modalIncRealHastaD) : ''}
                              onChangeText={(v) => setModalIncRealHastaD(ymdOkStr(v) ? parseYmdToLocalDate(v) : null)}
                              placeholder="AAAA-MM-DD"
                              placeholderTextColor="#999"
                              {...({ type: 'date' } as object)}
                            />
                            <TextInput
                              style={[styles.input, styles.inputFlex, styles.epWebDtInput]}
                              value={modalIncRealHastaT ? hm(modalIncRealHastaT) : ''}
                              onChangeText={(v) => setModalIncRealHastaT(hmOkStr(v) ? parseHmToLocalDate(v) : null)}
                              placeholder="HH:mm"
                              placeholderTextColor="#999"
                              {...({ type: 'time' } as object)}
                            />
                          </>
                        ) : (
                          <>
                            <TouchableOpacity style={styles.dateButtonHalf} onPress={() => setIncidentModalPicker('modal_real_hasta_ymd')}>
                              <ThemedText style={styles.dateButtonText}>{modalIncRealHastaD ? formatDateOnlyLabel(modalIncRealHastaD) : 'Fecha'}</ThemedText>
                              <Ionicons name="calendar-outline" size={18} color="#007AFF" />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.dateButtonHalf} onPress={() => setIncidentModalPicker('modal_real_hasta_hm')}>
                              <ThemedText style={styles.dateButtonText}>{modalIncRealHastaT ? hm(modalIncRealHastaT) : 'Hora'}</ThemedText>
                              <Ionicons name="time-outline" size={18} color="#007AFF" />
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                      <ThemedText style={styles.label}>Clasificación</ThemedText>
                      <View style={styles.pickerWrapper}>
                        <Picker selectedValue={modalIncClasificacion} onValueChange={(v) => setModalIncClasificacion(String(v))} style={styles.picker}>
                          <Picker.Item label="Todas" value="todos" color="#000000" />
                          {incClasificacionesCache.map((c) => (
                            <Picker.Item key={`modal-inc-cls-${c.id}`} label={c.nombre} value={String(c.id)} color="#000000" />
                          ))}
                        </Picker>
                      </View>
                      <ThemedText style={styles.label}>Estado</ThemedText>
                      <View style={styles.pickerWrapper}>
                        <Picker selectedValue={modalIncEstado} onValueChange={(v) => setModalIncEstado(String(v) as any)} style={styles.picker}>
                          <Picker.Item label="Todos" value="todos" color="#000000" />
                          <Picker.Item label="Solucionado" value="solucionado" color="#000000" />
                          <Picker.Item label="No solucionado" value="no_solucionado" color="#000000" />
                        </Picker>
                      </View>
                    </>
                  ) : null}
                  {formModulo === MODULO_LLAVES ? (
                    <>
                      <ThemedText style={styles.label}>Pertenece a llavero...</ThemedText>
                      <View style={styles.row}>
                        <TextInput
                          style={[styles.input, styles.inputFlex]}
                          value={modalLlaveroSearch}
                          onChangeText={setModalLlaveroSearch}
                          placeholder="Buscar llavero"
                          placeholderTextColor="#999"
                        />
                        <TouchableOpacity
                          style={styles.searchIconBtn}
                          onPress={() => void runSearchActaStructure(modalLlaveroSearch, 'llavero', 'modalLlavero')}
                          activeOpacity={0.85}
                          disabled={employeeSearchMode === 'modalLlavero'}
                        >
                          {employeeSearchMode === 'modalLlavero' ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Ionicons name="search" size={22} color="#fff" />
                          )}
                        </TouchableOpacity>
                      </View>
                      {modalLlaveroResults.length ? (
                        <ThemedView style={styles.resultList}>
                          {modalLlaveroResults.map((it) => (
                            <TouchableOpacity
                              key={`modal-llv-${it.id}`}
                              style={styles.resultItem}
                              onPress={() =>
                                pickStructureLite(it, setModalLlaveroSelected, setModalLlaveroResults, setModalLlaveroSearch)
                              }
                            >
                              <ThemedText>{formatStructureLite(it)}</ThemedText>
                            </TouchableOpacity>
                          ))}
                        </ThemedView>
                      ) : null}
                      <ThemedView style={styles.assignedList}>
                        {modalLlaveroSelected.length === 0 ? (
                          <ThemedText style={styles.helperText}>Ningún llavero seleccionado.</ThemedText>
                        ) : (
                          modalLlaveroSelected.map((it) => (
                            <ThemedView key={`sel-modal-llv-${it.id}`} style={styles.assignedUserItem}>
                              <ThemedText style={styles.assignedUserTitle}>{formatStructureLite(it)}</ThemedText>
                              <TouchableOpacity style={styles.removeUserButton} onPress={() => removeStructureLite(it.id, setModalLlaveroSelected)}>
                                <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                              </TouchableOpacity>
                            </ThemedView>
                          ))
                        )}
                      </ThemedView>
                      <ThemedText style={styles.label}>Entregado por...</ThemedText>
                      <TextInput
                        style={styles.input}
                        value={modalLlvEntregadoPor}
                        onChangeText={setModalLlvEntregadoPor}
                        placeholder="Nombre de quien entrega"
                        placeholderTextColor="#999"
                      />
                      <ThemedText style={styles.label}>Recibido por...</ThemedText>
                      <TextInput
                        style={styles.input}
                        value={modalLlvRecibidoPor}
                        onChangeText={setModalLlvRecibidoPor}
                        placeholder="Nombre de quien recibe"
                        placeholderTextColor="#999"
                      />
                    </>
                  ) : null}
                  {formModulo === MODULO_LLAVEROS ? (
                    <>
                      <ThemedText style={styles.label}>Entregado por...</ThemedText>
                      <TextInput
                        style={styles.input}
                        value={modalLlrEntregadoPor}
                        onChangeText={setModalLlrEntregadoPor}
                        placeholder="Nombre de quien entrega (movimiento llavero)"
                        placeholderTextColor="#999"
                      />
                      <ThemedText style={styles.label}>Recibido por...</ThemedText>
                      <TextInput
                        style={styles.input}
                        value={modalLlrRecibidoPor}
                        onChangeText={setModalLlrRecibidoPor}
                        placeholder="Nombre de quien recibe (movimiento llavero)"
                        placeholderTextColor="#999"
                      />
                    </>
                  ) : null}
                  {formModulo === MODULO_BITACORA_NOVEDADES ? (
                    <>
                      <ThemedText style={styles.label}>Categoría</ThemedText>
                      <View style={styles.pickerWrapper}>
                        <Picker
                          selectedValue={modalBnvCategoriaId}
                          onValueChange={(v) => setModalBnvCategoriaId(String(v))}
                          style={styles.picker}
                        >
                          <Picker.Item label="Todas" value="todos" color="#000000" />
                          {noteCategories.map((c) => (
                            <Picker.Item key={`modal-bnv-cat-${c.id}`} label={c.nombre} value={String(c.id)} color="#000000" />
                          ))}
                        </Picker>
                      </View>
                      <ThemedText style={styles.label}>Relevancia</ThemedText>
                      <View style={styles.pickerWrapper}>
                        <Picker
                          selectedValue={modalBnvRelevancia}
                          onValueChange={(v) => setModalBnvRelevancia(String(v) as any)}
                          style={styles.picker}
                        >
                          <Picker.Item label="Todas" value="todos" color="#000000" />
                          <Picker.Item label="Alta" value="Alta" color="#000000" />
                          <Picker.Item label="Media" value="Media" color="#000000" />
                          <Picker.Item label="Baja" value="Baja" color="#000000" />
                        </Picker>
                      </View>
                    </>
                  ) : null}
                  {formModulo === MODULO_MAESTRO_QUEJAS ? (
                    <>
                      <ThemedText style={styles.label}>Medio de recepción</ThemedText>
                      <View style={styles.pickerWrapper}>
                        <Picker
                          selectedValue={modalMqMedioRecepcion}
                          onValueChange={(v) => setModalMqMedioRecepcion(String(v))}
                          style={styles.picker}
                        >
                          <Picker.Item label="Todos" value="todos" color="#000000" />
                          <Picker.Item label="Correo" value="Correo" color="#000000" />
                          <Picker.Item label="Teléfono" value="Telefono" color="#000000" />
                          <Picker.Item label="Presencial" value="Presencial" color="#000000" />
                          <Picker.Item label="Otro" value="Otro" color="#000000" />
                        </Picker>
                      </View>
                      <ThemedText style={styles.label}>Tipo de queja</ThemedText>
                      <View style={styles.pickerWrapper}>
                        <Picker
                          selectedValue={modalMqTipoQueja}
                          onValueChange={(v) => setModalMqTipoQueja(String(v))}
                          style={styles.picker}
                        >
                          <Picker.Item label="Todos" value="todos" color="#000000" />
                          {tipoQuejasCatalogo.map((opt) => (
                            <Picker.Item key={`modal-mq-tq-${opt.id}`} label={opt.nombre} value={opt.nombre} color="#000000" />
                          ))}
                        </Picker>
                      </View>
                      <ThemedText style={styles.label}>Nivel de queja</ThemedText>
                      <View style={styles.pickerWrapper}>
                        <Picker
                          selectedValue={modalMqNivelQueja}
                          onValueChange={(v) => setModalMqNivelQueja(String(v))}
                          style={styles.picker}
                        >
                          <Picker.Item label="Todos" value="todos" color="#000000" />
                          <Picker.Item label="Leve" value="Leve" color="#000000" />
                          <Picker.Item label="Moderada" value="Moderada" color="#000000" />
                          <Picker.Item label="Grave" value="Grave" color="#000000" />
                        </Picker>
                      </View>
                    </>
                  ) : null}
                  {formModulo === MODULO_ENTREGA_PUESTO ? (
                    <>
                      <ThemedText style={styles.label}>Oficial entrega (contiene)</ThemedText>
                      <TextInput
                        style={styles.input}
                        value={modalEpOficialEntrega}
                        onChangeText={setModalEpOficialEntrega}
                        placeholder="Opcional"
                        placeholderTextColor="#999"
                      />
                      <ThemedText style={styles.label}>Oficial recibe (contiene)</ThemedText>
                      <TextInput
                        style={styles.input}
                        value={modalEpOficialRecibe}
                        onChangeText={setModalEpOficialRecibe}
                        placeholder="Opcional"
                        placeholderTextColor="#999"
                      />
                      <ThemedText style={styles.label}>Turno entrega (contiene)</ThemedText>
                      <TextInput
                        style={styles.input}
                        value={modalEpTurnoEntrega}
                        onChangeText={setModalEpTurnoEntrega}
                        placeholder="Opcional"
                        placeholderTextColor="#999"
                      />
                      <ThemedText style={styles.label}>Turno recibe (contiene)</ThemedText>
                      <TextInput
                        style={styles.input}
                        value={modalEpTurnoRecibe}
                        onChangeText={setModalEpTurnoRecibe}
                        placeholder="Opcional"
                        placeholderTextColor="#999"
                      />
                      <ThemedText style={styles.sectionTitle}>Filtros por registro (opcional)</ThemedText>
                      <ThemedText style={styles.helperText}>
                        En web puede escribir fecha en AAAA-MM-DD; en la app los botones muestran día-mes-año. Horas en 24 h (HH:mm).
                      </ThemedText>

                      <ThemedText style={styles.label}>Entrega — fecha entrada</ThemedText>
                      <View style={styles.dateRow}>
                        {Platform.OS === 'web' ? (
                          <TextInput
                            style={[styles.input, styles.inputFlex, styles.epWebDtInput]}
                            value={modalEpYmdEntDesde}
                            onChangeText={setModalEpYmdEntDesde}
                            placeholder="AAAA-MM-DD"
                            placeholderTextColor="#999"
                            {...({ type: 'date' } as object)}
                          />
                        ) : (
                          <TouchableOpacity style={styles.dateButtonHalf} onPress={() => setModalEpPicker('fee_ymd')}>
                            <ThemedText style={styles.dateButtonText} numberOfLines={1}>
                              {ymdOkStr(modalEpYmdEntDesde) ? formatStoredYmdString(modalEpYmdEntDesde) : 'Elegir fecha'}
                            </ThemedText>
                            <Ionicons name="calendar-outline" size={20} color="#007AFF" />
                          </TouchableOpacity>
                        )}
                        {Platform.OS === 'web' ? (
                          <TextInput
                            style={[styles.input, styles.inputFlex, styles.epWebDtInput]}
                            value={modalEpHmEntradaEntrega}
                            onChangeText={setModalEpHmEntradaEntrega}
                            placeholder="HH:mm"
                            placeholderTextColor="#999"
                            {...({ type: 'time' } as object)}
                          />
                        ) : (
                          <TouchableOpacity style={styles.dateButtonHalf} onPress={() => setModalEpPicker('hee_hm')}>
                            <ThemedText style={styles.dateButtonText} numberOfLines={1}>
                              {hmOkStr(modalEpHmEntradaEntrega) ? modalEpHmEntradaEntrega : 'Hora entrada'}
                            </ThemedText>
                            <Ionicons name="time-outline" size={20} color="#007AFF" />
                          </TouchableOpacity>
                        )}
                      </View>

                      <ThemedText style={styles.label}>Entrega — fecha salida</ThemedText>
                      <View style={styles.dateRow}>
                        {Platform.OS === 'web' ? (
                          <TextInput
                            style={[styles.input, styles.inputFlex, styles.epWebDtInput]}
                            value={modalEpYmdEntHasta}
                            onChangeText={setModalEpYmdEntHasta}
                            placeholder="AAAA-MM-DD"
                            placeholderTextColor="#999"
                            {...({ type: 'date' } as object)}
                          />
                        ) : (
                          <TouchableOpacity style={styles.dateButtonHalf} onPress={() => setModalEpPicker('fse_ymd')}>
                            <ThemedText style={styles.dateButtonText} numberOfLines={1}>
                              {ymdOkStr(modalEpYmdEntHasta) ? formatStoredYmdString(modalEpYmdEntHasta) : 'Elegir fecha'}
                            </ThemedText>
                            <Ionicons name="calendar-outline" size={20} color="#007AFF" />
                          </TouchableOpacity>
                        )}
                        {Platform.OS === 'web' ? (
                          <TextInput
                            style={[styles.input, styles.inputFlex, styles.epWebDtInput]}
                            value={modalEpHmSalidaEntrega}
                            onChangeText={setModalEpHmSalidaEntrega}
                            placeholder="HH:mm"
                            placeholderTextColor="#999"
                            {...({ type: 'time' } as object)}
                          />
                        ) : (
                          <TouchableOpacity style={styles.dateButtonHalf} onPress={() => setModalEpPicker('hse_hm')}>
                            <ThemedText style={styles.dateButtonText} numberOfLines={1}>
                              {hmOkStr(modalEpHmSalidaEntrega) ? modalEpHmSalidaEntrega : 'Hora salida'}
                            </ThemedText>
                            <Ionicons name="time-outline" size={20} color="#007AFF" />
                          </TouchableOpacity>
                        )}
                      </View>

                      <ThemedText style={styles.label}>Recibe — fecha entrada</ThemedText>
                      <View style={styles.dateRow}>
                        {Platform.OS === 'web' ? (
                          <TextInput
                            style={[styles.input, styles.inputFlex, styles.epWebDtInput]}
                            value={modalEpYmdRecDesde}
                            onChangeText={setModalEpYmdRecDesde}
                            placeholder="AAAA-MM-DD"
                            placeholderTextColor="#999"
                            {...({ type: 'date' } as object)}
                          />
                        ) : (
                          <TouchableOpacity style={styles.dateButtonHalf} onPress={() => setModalEpPicker('fer_ymd')}>
                            <ThemedText style={styles.dateButtonText} numberOfLines={1}>
                              {ymdOkStr(modalEpYmdRecDesde) ? formatStoredYmdString(modalEpYmdRecDesde) : 'Elegir fecha'}
                            </ThemedText>
                            <Ionicons name="calendar-outline" size={20} color="#007AFF" />
                          </TouchableOpacity>
                        )}
                        {Platform.OS === 'web' ? (
                          <TextInput
                            style={[styles.input, styles.inputFlex, styles.epWebDtInput]}
                            value={modalEpHmEntradaRecibe}
                            onChangeText={setModalEpHmEntradaRecibe}
                            placeholder="HH:mm"
                            placeholderTextColor="#999"
                            {...({ type: 'time' } as object)}
                          />
                        ) : (
                          <TouchableOpacity style={styles.dateButtonHalf} onPress={() => setModalEpPicker('her_hm')}>
                            <ThemedText style={styles.dateButtonText} numberOfLines={1}>
                              {hmOkStr(modalEpHmEntradaRecibe) ? modalEpHmEntradaRecibe : 'Hora entrada'}
                            </ThemedText>
                            <Ionicons name="time-outline" size={20} color="#007AFF" />
                          </TouchableOpacity>
                        )}
                      </View>

                      <ThemedText style={styles.label}>Recibe — fecha salida</ThemedText>
                      <View style={styles.dateRow}>
                        {Platform.OS === 'web' ? (
                          <TextInput
                            style={[styles.input, styles.inputFlex, styles.epWebDtInput]}
                            value={modalEpYmdRecHasta}
                            onChangeText={setModalEpYmdRecHasta}
                            placeholder="AAAA-MM-DD"
                            placeholderTextColor="#999"
                            {...({ type: 'date' } as object)}
                          />
                        ) : (
                          <TouchableOpacity style={styles.dateButtonHalf} onPress={() => setModalEpPicker('fsr_ymd')}>
                            <ThemedText style={styles.dateButtonText} numberOfLines={1}>
                              {ymdOkStr(modalEpYmdRecHasta) ? formatStoredYmdString(modalEpYmdRecHasta) : 'Elegir fecha'}
                            </ThemedText>
                            <Ionicons name="calendar-outline" size={20} color="#007AFF" />
                          </TouchableOpacity>
                        )}
                        {Platform.OS === 'web' ? (
                          <TextInput
                            style={[styles.input, styles.inputFlex, styles.epWebDtInput]}
                            value={modalEpHmSalidaRecibe}
                            onChangeText={setModalEpHmSalidaRecibe}
                            placeholder="HH:mm"
                            placeholderTextColor="#999"
                            {...({ type: 'time' } as object)}
                          />
                        ) : (
                          <TouchableOpacity style={styles.dateButtonHalf} onPress={() => setModalEpPicker('hsr_hm')}>
                            <ThemedText style={styles.dateButtonText} numberOfLines={1}>
                              {hmOkStr(modalEpHmSalidaRecibe) ? modalEpHmSalidaRecibe : 'Hora salida'}
                            </ThemedText>
                            <Ionicons name="time-outline" size={20} color="#007AFF" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </>
                  ) : null}

                  <ThemedText style={styles.label}>
                    {formModulo === MODULO_ACTIVIDADES ? 'Título' : 'Ordenar por'}
                  </ThemedText>
                  <View style={styles.pickerWrapper}>
                    <Picker selectedValue={formOrder} onValueChange={(v) => setFormOrder(String(v))} style={styles.picker}>
                      {(formModulo === MODULO_AGENDA_MINUTA || formModulo === MODULO_ENTREGA_PUESTO
                        ? ORDER_OPTIONS_AGENDA
                        : formModulo === MODULO_APERTURA_CIERRE
                          ? ORDER_OPTIONS_APERTURA_CIERRE
                          : formModulo === MODULO_VULNERABILIDAD
                            ? ORDER_OPTIONS_VULNERABILIDAD
                            : formModulo === MODULO_ACTIVIDADES
                              ? ORDER_OPTIONS_ACTIVIDADES
                              : formModulo === MODULO_CONTROL_ASISTENCIA
                                ? ORDER_OPTIONS_CONTROL_ASISTENCIA
                              : formModulo === MODULO_DOCUMENTOS_ENTREGADOS
                                ? ORDER_OPTIONS_DOCUMENTOS
                                : formModulo === MODULO_ENCUESTA_SATISFACCION
                                  ? ORDER_OPTIONS_ENCUESTA_SATISFACCION
                                  : formModulo === MODULO_REGISTRO_VISITAS
                                    ? ORDER_OPTIONS_REGISTRO_VISITAS
                                  : formModulo === MODULO_MUTUOS_ACUERDOS
                                    ? ORDER_OPTIONS_MUTUOS_ACUERDOS
                                : formModulo === MODULO_EVALUACION_PERSONAL
                                  ? ORDER_OPTIONS_EVALUACION_PERSONAL
                                : formModulo === MODULO_PRODUCTO_NO_CONFORME
                                  ? ORDER_OPTIONS_PRODUCTO_NO_CONFORME
                                : formModulo === MODULO_REGISTRO_INDUCCION_RECORRIDO
                                  ? ORDER_OPTIONS_INDUCCION_RECORRIDO
                                : formModulo === MODULO_MANUALES_PUESTO
                                  ? ORDER_OPTIONS_MANUALES_PUESTO
                                : formModulo === MODULO_INCIDENTES
                                  ? ORDER_OPTIONS_INCIDENTES
                                  : formModulo === MODULO_CHECKLIST_SUPERVISION
                                    ? ORDER_OPTIONS_CHECKLIST_SUPERVISION
                                  : formModulo === MODULO_LLAVES
                                    ? ORDER_OPTIONS_LLAVES
                                  : formModulo === MODULO_LLAVEROS
                                    ? ORDER_OPTIONS_LLAVES
                                    : formModulo === MODULO_BITACORA_NOVEDADES
                                      ? ORDER_OPTIONS_BITACORA_NOVEDADES
                                      : formModulo === MODULO_MAESTRO_QUEJAS
                                        ? ORDER_OPTIONS_MAESTRO_QUEJAS
                          : ORDER_OPTIONS_ACTA
                      ).map((o) => (
                        <Picker.Item key={o.value} label={o.label} value={o.value} color="#000000" />
                      ))}
                    </Picker>
                  </View>

                  <ThemedText style={styles.label}>Tipo de reporte</ThemedText>
                  <View style={styles.pickerWrapper}>
                    <Picker
                      selectedValue={
                        formModulo === MODULO_BITACORA_NOVEDADES ||
                        formModulo === MODULO_CHECKLIST_SUPERVISION ||
                        formModulo === MODULO_EVALUACION_PERSONAL ||
                        formModulo === MODULO_MANUALES_PUESTO
                          ? 'Consolidado' // Consolidado
                          : formTipoReporte
                      }
                      enabled={
                        formModulo !== MODULO_BITACORA_NOVEDADES &&
                        formModulo !== MODULO_CHECKLIST_SUPERVISION &&
                        formModulo !== MODULO_EVALUACION_PERSONAL &&
                        formModulo !== MODULO_MANUALES_PUESTO
                      }
                      onValueChange={(v) => setFormTipoReporte(String(v) as 'Consolidado' | 'Individual')}
                      style={styles.picker}
                    >
                      <Picker.Item label="Consolidado" value="Consolidado" color="#000000" />
                      <Picker.Item label="Individual" value="Individual" color="#000000" />
                    </Picker>
                  </View>

                  <TouchableOpacity style={[styles.attachButton, { marginBottom: 16 }]} onPress={() => void runPreview()} activeOpacity={0.85}>
                    {previewLoading ? (
                      <ActivityIndicator color="#007AFF" />
                    ) : (
                      <>
                        <Ionicons name="eye-outline" size={22} color="#007AFF" />
                        <ThemedText style={styles.attachButtonText}>Buscar registros (preview)</ThemedText>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.collapseButton} onPress={() => setPreviewOpen(!previewOpen)} activeOpacity={0.85}>
                    <ThemedText style={styles.collapseButtonText}>
                      Resultados {previewRows != null ? `(${previewRows.length})` : ''}
                    </ThemedText>
                    <Ionicons name={previewOpen ? 'chevron-up' : 'chevron-down'} size={20} color="#007AFF" />
                  </TouchableOpacity>
                  {previewOpen && previewRows != null ? (
                    <ThemedView style={styles.collapseContent}>
                      {formModulo === MODULO_AGENDA_MINUTA
                        ? previewRows.map((row, idx) => (
                            <ThemedView key={`prev-agenda-${idx}`} style={{ marginBottom: 12 }}>
                              <ThemedText style={styles.detailText}>
                                {row.empresa_nombre} | {row.cliente_nombre} | {row.fecha_txt ?? row.fecha}
                              </ThemedText>
                              <ThemedText style={styles.helperText}>Firma responsable</ThemedText>
                              {signatureUri(row.firma_responsable_data_uri || row.firma_responsable) ? (
                                <Image
                                  source={{
                                    uri: signatureUri(row.firma_responsable_data_uri || row.firma_responsable) as string,
                                  }}
                                  style={{ width: 160, height: 72, borderWidth: 1, borderColor: '#DDD' }}
                                  resizeMode="contain"
                                />
                              ) : null}
                              {(row.participantes_preview || []).map((p: any, j: number) => (
                                <ThemedView key={`prev-agenda-p-${idx}-${j}`} style={{ marginTop: 8 }}>
                                  <ThemedText style={styles.detailText}>
                                    {p.nombre ?? ''} — {p.puesto ?? ''}
                                  </ThemedText>
                                  {signatureUri(p.firma_data_uri || p.firma) ? (
                                    <Image
                                      source={{ uri: signatureUri(p.firma_data_uri || p.firma) as string }}
                                      style={{ width: 140, height: 60, borderWidth: 1, borderColor: '#DDD' }}
                                      resizeMode="contain"
                                    />
                                  ) : null}
                                </ThemedView>
                              ))}
                            </ThemedView>
                          ))
                        : formModulo === MODULO_ACTIVIDADES
                          ? previewRows.map((row, idx) => (
                              <ThemedView key={`prev-activ-${idx}`} style={{ marginBottom: 12 }}>
                                <ThemedText style={styles.detailText}>
                                  {row.nombre_actividad ?? ''} | {row.fecha_txt ?? ''}
                                </ThemedText>
                                {row.frecuencia_titulo ? (
                                  <ThemedText style={styles.helperText}>Frecuencia: {String(row.frecuencia_titulo)}</ThemedText>
                                ) : null}
                                {row.frecuencia_horario ? (
                                  <ThemedText style={styles.helperText}>Horario (informativo): {String(row.frecuencia_horario)}</ThemedText>
                                ) : null}
                                <ThemedText style={styles.helperText}>Descripción</ThemedText>
                                <ThemedText selectable style={styles.detailText}>
                                  {row.descripcion_actividad != null && String(row.descripcion_actividad).trim() !== ''
                                    ? String(row.descripcion_actividad)
                                    : '—'}
                                </ThemedText>
                              </ThemedView>
                            ))
                          : formModulo === MODULO_CONTROL_ASISTENCIA
                            ? previewRows.map((row, idx) => (
                                <ThemedView key={`prev-asis-${idx}`} style={{ marginBottom: 12 }}>
                                  <ThemedText style={styles.detailText}>
                                    {row.empresa_nombre} | {row.cliente_nombre} | {row.fecha_txt ?? row.fecha}
                                  </ThemedText>
                                  <ThemedText style={styles.helperText}>Turno: {row.turno_label ?? row.turno ?? '—'}</ThemedText>
                                  <ThemedText style={styles.helperText}>Supervisor: {row.nombre_supervisor ?? '—'}</ThemedText>
                                  {signatureUri(row.firma_manual_supervisor_data_uri || row.firma_manual_supervisor) ? (
                                    <Image
                                      source={{
                                        uri: signatureUri(row.firma_manual_supervisor_data_uri || row.firma_manual_supervisor) as string,
                                      }}
                                      style={{ width: 160, height: 72, borderWidth: 1, borderColor: '#DDD' }}
                                      resizeMode="contain"
                                    />
                                  ) : null}
                                </ThemedView>
                              ))
                            : formModulo === MODULO_DOCUMENTOS_ENTREGADOS
                              ? previewRows.map((row, idx) => (
                                  <ThemedView key={`prev-doc-${idx}`} style={{ marginBottom: 12 }}>
                                    <ThemedText style={styles.detailText}>
                                      {row.empresa_nombre} | {row.cliente_nombre} | {row.fecha_txt ?? row.fecha}
                                    </ThemedText>
                                    <ThemedText style={styles.helperText}>Tipo: {row.tipo_documento ?? '—'}</ThemedText>
                                    <ThemedText style={styles.helperText}>Entrega: {row.nombre_oficial_entrega ?? '—'}</ThemedText>
                                    <ThemedText style={styles.helperText}>Recibe: {row.nombre_oficial_recibe ?? '—'}</ThemedText>
                                    {signatureUri(row.firma_representante_cliente_data_uri || row.firma_representante_cliente) ? (
                                      <Image
                                        source={{ uri: signatureUri(row.firma_representante_cliente_data_uri || row.firma_representante_cliente) as string }}
                                        style={{ width: 160, height: 72, borderWidth: 1, borderColor: '#DDD' }}
                                        resizeMode="contain"
                                      />
                                    ) : null}
                                  </ThemedView>
                                ))
                            : formModulo === MODULO_ENCUESTA_SATISFACCION
                              ? previewRows.map((row, idx) => (
                                  <ThemedView key={`prev-enc-${idx}`} style={{ marginBottom: 12 }}>
                                    <ThemedText style={styles.detailText}>
                                      {row.empresa_nombre ?? '—'} | {row.cliente_nombre ?? '—'} | {row.fecha_txt ?? row.fecha ?? '—'}
                                    </ThemedText>
                                    <ThemedText style={styles.helperText}>
                                      {row.division_nombre ?? '—'} · {row.contrato_nombre ?? '—'} · {row.corpo_nombre ?? '—'} ·{' '}
                                      {row.puesto_nombre ?? '—'}
                                    </ThemedText>
                                    <ThemedText style={styles.helperText}>Responsable: {row.responsable_nombre ?? '—'}</ThemedText>
                                    {row.evaluaciones_resumen != null && String(row.evaluaciones_resumen).trim() !== '' ? (
                                      <ThemedText selectable style={styles.helperText} numberOfLines={6}>
                                        {String(row.evaluaciones_resumen)}
                                      </ThemedText>
                                    ) : null}
                                    <ThemedText style={styles.helperText}>Firma evaluado</ThemedText>
                                    {signatureUri(row.firma_evaluado_data_uri || row.firma_evaluado) ? (
                                      <Image
                                        source={{ uri: signatureUri(row.firma_evaluado_data_uri || row.firma_evaluado) as string }}
                                        style={{ width: 160, height: 72, borderWidth: 1, borderColor: '#DDD' }}
                                        resizeMode="contain"
                                      />
                                    ) : null}
                                  </ThemedView>
                                ))
                            : formModulo === MODULO_REGISTRO_VISITAS
                              ? previewRows.map((row, idx) => (
                                  <ThemedView key={`prev-rv-${idx}`} style={{ marginBottom: 12 }}>
                                    <ThemedText style={styles.detailText}>
                                      {row.nombre ?? '—'} · {row.cedula ?? '—'}
                                    </ThemedText>
                                    <ThemedText style={styles.helperText}>
                                      {row.empresa_nombre ?? '—'} · {row.e_estructura_cliente?.nombre ?? '—'} · {row.division_nombre ?? '—'}
                                    </ThemedText>
                                    <ThemedText style={styles.helperText}>
                                      {row.contrato_nombre ?? '—'} · {row.e_estructura_sucursal?.nombre ?? '—'} · {row.e_estructura_puesto?.nombre ?? '—'}
                                    </ThemedText>
                                    <ThemedText style={styles.helperText}>
                                      Responsable: {row.responsable_label ?? '—'} · Activos:{' '}
                                      {Array.isArray(row.e_activo_visitante) ? row.e_activo_visitante.length : 0}
                                    </ThemedText>
                                  </ThemedView>
                                ))
                            : formModulo === MODULO_EVALUACION_PERSONAL
                              ? previewRows.map((row, idx) => (
                                  <ThemedView key={`prev-evp-${idx}`} style={{ marginBottom: 12 }}>
                                    <ThemedText style={styles.detailText}>
                                      {row.empresa_nombre ?? '—'} | {row.cliente_nombre ?? '—'} | {row.created_at_txt ?? '—'}
                                    </ThemedText>
                                    <ThemedText style={styles.helperText}>
                                      {row.division_nombre ?? '—'} · {row.contrato_nombre ?? '—'} · {row.corpo_nombre ?? '—'} ·{' '}
                                      {row.puesto_nombre ?? '—'}
                                    </ThemedText>
                                    <ThemedText style={styles.helperText}>
                                      Tipo: {row.tipo ?? '—'} · Evaluado: {row.empleado_evaluado_txt ?? '—'} · Evaluador:{' '}
                                      {row.evaluador_txt ?? '—'}
                                    </ThemedText>
                                    <ThemedText style={styles.helperText}>Firma evaluador</ThemedText>
                                    {signatureUri(row.firma_evaluador_data_uri || row.firma_evaluador) ? (
                                      <Image
                                        source={{ uri: signatureUri(row.firma_evaluador_data_uri || row.firma_evaluador) as string }}
                                        style={{ width: 160, height: 72, borderWidth: 1, borderColor: '#DDD' }}
                                        resizeMode="contain"
                                      />
                                    ) : null}
                                    <ThemedText style={styles.helperText}>Firma empleado</ThemedText>
                                    {signatureUri(row.firma_empleado_data_uri || row.firma_empleado) ? (
                                      <Image
                                        source={{ uri: signatureUri(row.firma_empleado_data_uri || row.firma_empleado) as string }}
                                        style={{ width: 160, height: 72, borderWidth: 1, borderColor: '#DDD' }}
                                        resizeMode="contain"
                                      />
                                    ) : null}
                                  </ThemedView>
                                ))
                            : formModulo === MODULO_MANUALES_PUESTO
                              ? previewRows.map((row, idx) => (
                                  <ThemedView key={`prev-mp-${idx}`} style={{ marginBottom: 12 }}>
                                    <ThemedText style={styles.detailText}>
                                      {String(row.title ?? '—')} · {row.created_at_txt ?? '—'}
                                    </ThemedText>
                                    <ThemedText style={styles.helperText}>
                                      {row.empresa_txt ?? '—'} · {row.cliente_txt ?? '—'} · {row.division_txt ?? '—'}
                                    </ThemedText>
                                    <ThemedText style={styles.helperText}>
                                      {row.contrato_txt ?? '—'} · {row.corpo_txt ?? '—'} · Puesto: {row.puesto_principal_txt ?? '—'}
                                    </ThemedText>
                                    <ThemedText selectable style={styles.helperText} numberOfLines={4}>
                                      {String(row.description ?? '').slice(0, 400)}
                                    </ThemedText>
                                  </ThemedView>
                                ))
                            : formModulo === MODULO_PRODUCTO_NO_CONFORME
                              ? previewRows.map((row, idx) => (
                                  <ThemedView key={`prev-pnc-${idx}`} style={{ marginBottom: 12 }}>
                                    <ThemedText style={styles.detailText}>
                                      {row.empresa_nombre ?? '—'} | {row.cliente_nombre ?? '—'} | {row.created_at_txt ?? '—'}
                                    </ThemedText>
                                    <ThemedText style={styles.helperText}>
                                      {row.division_nombre ?? '—'} · {row.contrato_nombre ?? '—'} · {row.corpo_nombre ?? '—'} ·{' '}
                                      {row.puesto_nombre ?? '—'}
                                    </ThemedText>
                                    <ThemedText style={styles.helperText}>
                                      Tipo: {row.tipo_servicio_no_conforme ?? '—'} · Identificación: {row.fecha_identificacion_txt ?? '—'}
                                    </ThemedText>
                                    <ThemedText style={styles.helperText}>
                                      Identificó: {row.persona_identifico_pnc ?? '—'} · Originó: {row.persona_origino_pnc ?? '—'}
                                    </ThemedText>
                                    <ThemedText selectable style={styles.helperText} numberOfLines={4}>
                                      {String(row.descripcion ?? '').slice(0, 400)}
                                    </ThemedText>
                                    <ThemedText style={styles.helperText}>Firma persona que identificó PNC</ThemedText>
                                    {signatureUri(row.firma_persona_identifico_pnc_data_uri || row.firma_persona_identifico_pnc) ? (
                                      <Image
                                        source={{
                                          uri: signatureUri(row.firma_persona_identifico_pnc_data_uri || row.firma_persona_identifico_pnc) as string,
                                        }}
                                        style={{ width: 160, height: 72, borderWidth: 1, borderColor: '#DDD' }}
                                        resizeMode="contain"
                                      />
                                    ) : null}
                                    <ThemedText style={styles.helperText}>Firma persona que originó PNC</ThemedText>
                                    {signatureUri(row.firma_persona_origino_pnc_data_uri || row.firma_persona_origino_pnc) ? (
                                      <Image
                                        source={{
                                          uri: signatureUri(row.firma_persona_origino_pnc_data_uri || row.firma_persona_origino_pnc) as string,
                                        }}
                                        style={{ width: 160, height: 72, borderWidth: 1, borderColor: '#DDD' }}
                                        resizeMode="contain"
                                      />
                                    ) : null}
                                  </ThemedView>
                                ))
                            : formModulo === MODULO_REGISTRO_INDUCCION_RECORRIDO
                              ? previewRows.map((row, idx) => {
                                  let participantes: any[] = [];
                                  try {
                                    const p = JSON.parse(String(row.participantes ?? '[]'));
                                    if (Array.isArray(p)) participantes = p;
                                  } catch {
                                    participantes = [];
                                  }
                                  return (
                                    <ThemedView key={`prev-ir-${idx}`} style={{ marginBottom: 12 }}>
                                      <ThemedText style={styles.detailText}>
                                        {row.empresa_nombre ?? '—'} | {row.cliente_nombre ?? '—'} | {row.created_at_txt ?? '—'}
                                      </ThemedText>
                                      <ThemedText style={styles.helperText}>
                                        {row.division_nombre ?? '—'} · {row.contrato_nombre ?? '—'} · {row.corpo_nombre ?? '—'} ·{' '}
                                        {row.puesto_nombre ?? '—'}
                                      </ThemedText>
                                      <ThemedText style={styles.helperText}>
                                        Responsable: {row.created_by_nombre ?? '—'} · Empleado: {row.empleado_txt ?? '—'}
                                      </ThemedText>
                                      <ThemedText style={styles.helperText}>Firma supervisor</ThemedText>
                                      {signatureUri(row.firma_supervisor_data_uri || row.firma_supervisor) ? (
                                        <Image
                                          source={{
                                            uri: signatureUri(row.firma_supervisor_data_uri || row.firma_supervisor) as string,
                                          }}
                                          style={{ width: 160, height: 72, borderWidth: 1, borderColor: '#DDD' }}
                                          resizeMode="contain"
                                        />
                                      ) : null}
                                      <ThemedText style={styles.helperText}>Firma empleado</ThemedText>
                                      {signatureUri(row.firma_empleado_data_uri || row.firma_empleado) ? (
                                        <Image
                                          source={{ uri: signatureUri(row.firma_empleado_data_uri || row.firma_empleado) as string }}
                                          style={{ width: 160, height: 72, borderWidth: 1, borderColor: '#DDD' }}
                                          resizeMode="contain"
                                        />
                                      ) : null}
                                      {participantes.map((p, j) => (
                                        <ThemedView key={`prev-ir-p-${idx}-${j}`} style={{ marginTop: 8 }}>
                                          <ThemedText style={styles.detailText}>
                                            Participante: {String(p?.nombre_completo ?? '—')} — {String(p?.cedula ?? '')}
                                          </ThemedText>
                                          {signatureUri(p?.firma) ? (
                                            <Image
                                              source={{ uri: signatureUri(p.firma) as string }}
                                              style={{ width: 140, height: 60, borderWidth: 1, borderColor: '#DDD' }}
                                              resizeMode="contain"
                                            />
                                          ) : null}
                                        </ThemedView>
                                      ))}
                                    </ThemedView>
                                  );
                                })
                            : formModulo === MODULO_MUTUOS_ACUERDOS
                              ? previewRows.map((row, idx) => (
                                  <ThemedView key={`prev-mut-${idx}`} style={{ marginBottom: 12 }}>
                                    <ThemedText style={styles.detailText}>
                                      {row.empresa_nombre ?? '—'} | {row.cliente_nombre ?? '—'} | {row.created_at_txt ?? '—'}
                                    </ThemedText>
                                    <ThemedText style={styles.helperText}>
                                      {row.division_nombre ?? '—'} · {row.contrato_nombre ?? '—'} · {row.corpo_nombre ?? '—'} ·{' '}
                                      {row.puesto_nombre ?? '—'}
                                    </ThemedText>
                                    <ThemedText style={styles.helperText}>
                                      Ejecutivo: {row.ejecutivo_nombre ?? '—'} · Ausente: {row.empleado_ausente_txt ?? '—'} · Reemplaza:{' '}
                                      {row.empleado_reemplaza_txt ?? '—'}
                                    </ThemedText>
                                    <ThemedText style={styles.helperText}>
                                      Marca ausente: {row.marca_ausente_txt ?? '—'} · Marca reemplaza: {row.marca_reemplaza_txt ?? '—'}
                                    </ThemedText>
                                    <ThemedText style={styles.helperText}>Firma ejecutivo (manual)</ThemedText>
                                    {signatureUri(row.firma_ejecutivo_manual_data_uri || row.firma_ejecutivo_cuenta_manual) ? (
                                      <Image
                                        source={{
                                          uri: signatureUri(row.firma_ejecutivo_manual_data_uri || row.firma_ejecutivo_cuenta_manual) as string,
                                        }}
                                        style={{ width: 160, height: 72, borderWidth: 1, borderColor: '#DDD' }}
                                        resizeMode="contain"
                                      />
                                    ) : null}
                                  </ThemedView>
                                ))
                            : formModulo === MODULO_ENTREGA_PUESTO
                              ? previewRows.map((row, idx) => (
                                  <ThemedView key={`prev-ep-${idx}`} style={{ marginBottom: 10 }}>
                                    <ThemedText style={styles.detailText}>
                                      {row.empresa_nombre} | {row.cliente_nombre} | {row.corpo_nombre} | {row.puesto_nombre}
                                    </ThemedText>
                                    <ThemedText style={styles.helperText}>
                                      Entrega: {row.oficial_entrega ?? '—'} · Recibe: {row.oficial_recibe ?? '—'}
                                    </ThemedText>
                                    <ThemedText style={styles.helperText}>
                                      Turnos: {row.turno_entrega ?? '—'} / {row.turno_recibe ?? '—'}
                                    </ThemedText>
                                    {row.articulos_puesto_preview ? (
                                      <ThemedText selectable style={styles.helperText} numberOfLines={5}>
                                        Artículos: {String(row.articulos_puesto_preview)}
                                      </ThemedText>
                                    ) : null}
                                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                                      {signatureUri(row.firma_entrega_data_uri || row.firma_entrega) ? (
                                        <Image
                                          source={{ uri: signatureUri(row.firma_entrega_data_uri || row.firma_entrega) as string }}
                                          style={{ width: 120, height: 60, borderWidth: 1, borderColor: '#DDD' }}
                                          resizeMode="contain"
                                        />
                                      ) : null}
                                      {signatureUri(row.firma_recibe_data_uri || row.firma_recibe) ? (
                                        <Image
                                          source={{ uri: signatureUri(row.firma_recibe_data_uri || row.firma_recibe) as string }}
                                          style={{ width: 120, height: 60, borderWidth: 1, borderColor: '#DDD' }}
                                          resizeMode="contain"
                                        />
                                      ) : null}
                                    </View>
                                  </ThemedView>
                                ))
                          : formModulo === MODULO_BITACORA_NOVEDADES
                            ? previewRows.map((row, idx) => (
                                <ThemedView key={`prev-bnv-${idx}`} style={{ marginBottom: 10 }}>
                                  <ThemedText style={styles.detailText}>
                                    {row.empresa_nombre ?? '—'} | {row.cliente_nombre ?? '—'} | {row.puesto_nombre ?? '—'}
                                  </ThemedText>
                                  <ThemedText style={styles.helperText}>
                                    {row.titulo != null && String(row.titulo).trim() !== '' ? String(row.titulo) : '—'} ·{' '}
                                    {row.categoria_nombre ?? '—'} · {row.relevancia ?? '—'}
                                  </ThemedText>
                                </ThemedView>
                              ))
                            : formModulo === MODULO_MAESTRO_QUEJAS
                              ? previewRows.map((row, idx) => (
                                  <ThemedView key={`prev-mqj-${idx}`} style={{ marginBottom: 10 }}>
                                    <ThemedText style={styles.detailText}>
                                      {row.empresa_nombre ?? '—'} | {row.cliente_nombre ?? '—'} | {row.fecha_queja ?? '—'}
                                    </ThemedText>
                                    <ThemedText style={styles.helperText}>
                                      {String(row.motivo_queja ?? '—')} · {row.medio_recepcion_queja ?? '—'} · {row.tipo_queja ?? '—'} ·{' '}
                                      {row.nivel_queja ?? '—'}
                                    </ThemedText>
                                  </ThemedView>
                                ))
                              : formModulo === MODULO_CHECKLIST_SUPERVISION
                                ? previewRows.map((row, idx) => (
                                    <ThemedView key={`prev-cks-${idx}`} style={{ marginBottom: 10 }}>
                                      <ThemedText style={styles.detailText}>
                                        {row.empresa_nombre ?? '—'} | {row.cliente_nombre ?? '—'} |{' '}
                                        {row.fecha != null ? String(row.fecha) : '—'}
                                      </ThemedText>
                                      <ThemedText style={styles.helperText}>
                                        {row.division_nombre ?? '—'} · {row.contrato_nombre ?? '—'} · {row.corpo_nombre ?? '—'} ·{' '}
                                        {row.puesto_nombre ?? '—'}
                                      </ThemedText>
                                      <ThemedText style={styles.helperText}>Ejecutivo: {row.ejecutivo_cuenta_nombre ?? '—'}</ThemedText>
                                    </ThemedView>
                                  ))
                          : formModulo === MODULO_LLAVES
                            ? previewRows.map((row, idx) => (
                                <ThemedView key={`prev-llv-${idx}`} style={{ marginBottom: 10 }}>
                                  <ThemedText style={styles.detailText}>
                                    N° {String(row.numero_llave ?? '—')} · {String(row.lugar_abre ?? '—')}
                                  </ThemedText>
                                  <ThemedText style={styles.helperText}>
                                    {row.empresa_nombre ?? '—'} · {row.corpo_nombre ?? '—'} · {row.puesto_nombre ?? '—'}
                                  </ThemedText>
                                  <ThemedText style={styles.helperText}>Movimientos: {row.movimientos_count ?? 0}</ThemedText>
                                </ThemedView>
                              ))
                          : formModulo === MODULO_LLAVEROS
                            ? previewRows.map((row, idx) => (
                                <ThemedView key={`prev-llr-${idx}`} style={{ marginBottom: 10 }}>
                                  <ThemedText style={styles.detailText}>
                                    N° {String(row.numero_llavero ?? '—')} · {String(row.nombre_llavero ?? '—')}
                                  </ThemedText>
                                  <ThemedText style={styles.helperText}>
                                    {row.empresa_nombre ?? '—'} · {row.corpo_nombre ?? '—'} · {row.puesto_nombre ?? '—'}
                                  </ThemedText>
                                  <ThemedText style={styles.helperText}>
                                    Movimientos: {row.movimientos_count ?? 0} · Llaves vinculadas: {row.llaves_vinculadas_count ?? 0}
                                  </ThemedText>
                                </ThemedView>
                              ))
                          : previewRows.map((row, idx) => (
                            <ThemedView key={`prev-acta-${idx}`} style={{ marginBottom: 10 }}>
                              <ThemedText style={styles.detailText}>
                                {row.empresa_nombre} | {row.cliente_nombre} | {row.fecha}
                              </ThemedText>
                              <View style={{ flexDirection: 'row', gap: 8 }}>
                                {signatureUri(row.firma_entrega_data_uri || row.firma_entrega) ? (
                                  <Image
                                    source={{ uri: signatureUri(row.firma_entrega_data_uri || row.firma_entrega) as string }}
                                    style={{ width: 120, height: 60, borderWidth: 1, borderColor: '#DDD' }}
                                    resizeMode="contain"
                                  />
                                ) : null}
                                {signatureUri(row.firma_recibe_data_uri || row.firma_recibe) ? (
                                  <Image
                                    source={{ uri: signatureUri(row.firma_recibe_data_uri || row.firma_recibe) as string }}
                                    style={{ width: 120, height: 60, borderWidth: 1, borderColor: '#DDD' }}
                                    resizeMode="contain"
                                  />
                                ) : null}
                              </View>
                            </ThemedView>
                          ))}
                    </ThemedView>
                  ) : null}
                </ThemedView>
              ) : null}

              <ThemedText style={styles.sectionTitle}>Firma del responsable</ThemedText>
              {!String(firmaModal).trim() ? (
                <>
                  <ThemedText style={styles.emptyText}>No hay firma registrada</ThemedText>
                  <TouchableOpacity
                    style={styles.signatureButtonPrimary}
                    onPress={() => void generateFirma('modal')}
                    disabled={genFirmaLoading}
                    activeOpacity={0.85}
                  >
                    {genFirmaLoading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="sparkles-outline" size={18} color="#FFFFFF" />
                        <ThemedText style={styles.signatureButtonText}>Generar firma</ThemedText>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.signatureButtonPrimary, { marginTop: 8 }]} onPress={() => void scanFirmaModal()} activeOpacity={0.85}>
                    <Ionicons name="qr-code-outline" size={18} color="#FFFFFF" />
                    <ThemedText style={styles.signatureButtonText}>Escanear QR</ThemedText>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  {(() => {
                    const info = decodeFirmaHash(firmaModal);
                    if (!info) {
                      return (
                        <ThemedView style={styles.signatureInfo}>
                          <ThemedText style={styles.signatureInfoTitle}>Firma registrada</ThemedText>
                          <ThemedText style={styles.signatureInfoText}>Hash almacenado (detalle no disponible).</ThemedText>
                        </ThemedView>
                      );
                    }
                    return (
                      <ThemedView style={styles.signatureInfo}>
                        <ThemedText style={styles.signatureInfoTitle}>Información de la firma del responsable</ThemedText>
                        <ThemedText style={styles.signatureInfoText}>ID de sesión: {info.sessionId}</ThemedText>
                        <ThemedText style={styles.signatureInfoText}>ID del empleado: {info.empleadoId}</ThemedText>
                        <ThemedText style={styles.signatureInfoText}>Latitud: {info.latitud}</ThemedText>
                        <ThemedText style={styles.signatureInfoText}>Longitud: {info.longitud}</ThemedText>
                        <ThemedText style={styles.signatureInfoText}>Fecha y hora: {formatFirmaTimestamp(info.timestamp)}</ThemedText>
                      </ThemedView>
                    );
                  })()}
                  <TouchableOpacity
                    style={[styles.signatureButtonOutline, { marginTop: 10 }]}
                    onPress={() => setFirmaModal('')}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                    <ThemedText style={styles.signatureButtonOutlineText}>Eliminar firma</ThemedText>
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity
                style={styles.modalPrimaryBtn}
                onPress={() => void confirmCreate()}
                activeOpacity={0.85}
              >
                {submitReportLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
                    <ThemedText style={styles.modalPrimaryBtnText}>Confirmar y crear reporte</ThemedText>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </ThemedView>
        </View>
      </Modal>

      {QRScannerComponent}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 120 },
  content: { width: '100%', maxWidth: 800, alignSelf: 'center' },

  titleContainer: {
    alignItems: 'center',
    marginBottom: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, opacity: 0.7, textAlign: 'center' },

  banner: { backgroundColor: '#FFECEC', padding: 12, borderBottomWidth: 1, borderBottomColor: '#FFD6D6' },
  bannerTxt: { color: '#C00', textAlign: 'center', fontWeight: '600' },

  filtersContainer: {
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  filtersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#F0F0F0',
  },
  filterToggleButton: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  filtersTitle: { fontSize: 14, fontWeight: '600', color: '#007AFF' },
  resetFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#FFECEC',
  },
  resetFiltersText: { fontSize: 12, color: '#FF3B30', fontWeight: '600' },
  filtersContent: { padding: 12, backgroundColor: '#F9F9F9', gap: 8 },
  filterGroup: { marginBottom: 8, backgroundColor: '#F9F9F9' },
  filterLabel: { fontSize: 13, fontWeight: '600', color: '#000', marginBottom: 4 },

  label: { fontSize: 13, fontWeight: '700', marginTop: 10, color: '#333' },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#fff',
    color: '#000',
    marginBottom: 6,
  },
  inputFlex: { flex: 1, marginBottom: 0 },
  epWebDtInput: { minHeight: 44 },
  textArea: { minHeight: 90, textAlignVertical: 'top' as const },

  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
  },
  picker: { height: 54, width: '100%', color: '#000' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchIconBtn: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 12,
    backgroundColor: '#fff',
    marginBottom: 6,
  },
  dateButtonText: { color: '#000', fontWeight: '700' },
  dateRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  dateButtonHalf: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },

  formCard: {
    marginTop: 8,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  sectionTitle: { marginTop: 14, marginBottom: 8, fontSize: 15, fontWeight: '800', color: '#007AFF' },

  createButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  createButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  attachButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  attachButtonText: { color: '#007AFF', fontWeight: '700', fontSize: 15 },
  buttonPreview: { marginTop: 16 },

  emptyText: { fontSize: 14, opacity: 0.6, textAlign: 'center', color: '#000', marginVertical: 12 },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10, color: '#000' },
  cardLine: { marginBottom: 6, color: '#000' },
  cardLabel: { fontWeight: '700', color: '#333' },
  cardValue: { color: '#000' },
  mutedSmall: { opacity: 0.6, fontSize: 12 },

  collapseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginTop: 8,
    backgroundColor: '#FAFAFA',
  },
  collapseButtonText: { fontSize: 13, fontWeight: '700', color: '#007AFF' },
  collapseContent: { marginTop: 8, padding: 10, borderRadius: 8, backgroundColor: '#F8F9FA' },
  detailText: { marginBottom: 6, color: '#000', fontSize: 12 },

  actionsRow: { marginTop: 10, flexDirection: 'row', justifyContent: 'flex-start', gap: 12, flexWrap: 'wrap' },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  downloadBtn: { backgroundColor: '#34C759', marginTop: 10, alignSelf: 'stretch' },
  actionBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  resultList: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, overflow: 'hidden', marginTop: 4 },
  resultItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#E8E8E8', backgroundColor: '#FFFFFF' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
    backgroundColor: '#EEF6FF',
    borderRadius: 8,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#D6E8FF',
  },
  chipTxt: { flex: 1, fontSize: 14 },
  selectedHint: { fontSize: 13, color: '#333', marginTop: 6, fontWeight: '600' },

  assignedList: { marginTop: 8 },
  helperText: { fontSize: 13, color: '#666', lineHeight: 18 },
  selectedUsersHeader: {
    marginTop: 4,
    marginBottom: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#F2F4F7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedUsersHeaderText: { fontSize: 14, fontWeight: '700', color: '#333', flex: 1 },
  assignedUserItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginTop: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  assignedUserTitle: { fontSize: 14, color: '#000', flex: 1, paddingRight: 8 },
  removeUserButton: { padding: 4 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 16 },
  modalCard: { width: '100%', maxWidth: 820, alignSelf: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, overflow: 'hidden', maxHeight: '92%' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: { fontSize: 16, fontWeight: '900', color: '#000' },
  modalCloseBtn: { padding: 6, borderRadius: 18, backgroundColor: '#F2F2F2' },
  modalBody: { maxHeight: 520 },
  modalBodyContent: { padding: 14, paddingBottom: 24 },
  modalFormCard: { backgroundColor: '#fff', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#E0E0E0', marginBottom: 14, marginTop: 8 },
  modalSectionTitle: { fontSize: 15, fontWeight: '900', color: '#007AFF', marginBottom: 8 },
  modalPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 8,
    marginBottom: 12,
  },
  modalPrimaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  previewJson: { fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: '#333' },

  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 8 },
  checkRowText: { flex: 1, fontSize: 14, color: '#000' },

  signatureButtonPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    gap: 8,
  },
  signatureButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  signatureButtonOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF3B30',
    backgroundColor: '#FFF8F8',
    gap: 8,
  },
  signatureButtonOutlineText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '600',
  },
  signatureInfo: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  signatureInfoTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#000',
  },
  signatureInfoText: {
    fontSize: 12,
    marginBottom: 2,
    color: '#000',
  },
});
