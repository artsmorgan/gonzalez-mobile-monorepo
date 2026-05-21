import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  previewVisitasVehiculos,
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
  previewNotasVoz,
  previewCambiosUbicacionPuesto,
  previewRegistroCapacitaciones,
  previewRegistroInduccionGeneral,
  previewTiempoAlmuerzo,
  previewSolicitudesPermiso,
  previewArticulosPuesto,
  previewMantenimientoArticulos,
  previewRegistroVehiculosCorporativos,
  previewRevisionVehiculos,
  previewManualesPuesto,
  purgeOldMobileReports,
  searchActaStructure,
  searchCorporateVehicles,
  searchAlmuerzoCedulas,
  searchEmployeesReportes,
  type CedulaAlmuerzoLite,
  type EmpleadoLite,
  type StructureLite,
  type VehiculoCorporativoLite,
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
const MODULO_ARTICULOS_PUESTO = 'articulos_puesto';
/** Tabla `c_articulo_mantenimiento`, solo Excel consolidado. */
const MODULO_MANTENIMIENTO_ARTICULOS = 'mantenimiento_articulos';
/** `c_vehiculos_corporativos` + usos y mantenimientos, solo Excel consolidado. */
const MODULO_REGISTRO_VEHICULOS_CORPORATIVOS = 'registro_vehiculos_corporativos';
/** `c_bitacora_vehiculo_detenido`, solo Excel consolidado. */
const MODULO_REVISION_VEHICULOS = 'revision_vehiculos';
/** `e_registro_personas` / `e_activo_visitante`. */
const MODULO_REGISTRO_VISITAS = 'registro_visitas';
const MODULO_NOTAS_VOZ = 'notas_voz';
/** Tabla `c_ubicacion_puesto_registro_cambios`, solo Excel consolidado. */
const MODULO_CAMBIOS_UBICACION_PUESTO = 'cambios_ubicacion_puesto';
/** `e_registro_capacitaciones` + vínculos empleado/puesto, solo Excel consolidado. */
const MODULO_REGISTRO_CAPACITACIONES = 'registro_capacitaciones';
/** Tabla `c_registro_induccion_general` (Excel consolidado / ZIP de Word individual). */
const MODULO_REGISTRO_INDUCCION_GENERAL = 'registro_induccion_general';
/** Tabla `c_empleado_almuerzo` (solo Excel consolidado). */
const MODULO_TIEMPO_ALMUERZO = 'tiempo_almuerzo';
/** Tabla `c_solicitud_permiso` (Excel consolidado / individual). */
const MODULO_SOLICITUDES_PERMISO = 'solicitudes_permiso';
/** Tabla `e_registro_vehiculos` (Excel consolidado / ZIP individual). */
const MODULO_VISITAS_VEHICULOS = 'visitas_vehiculos';

type ReporteTipoSalida = 'Consolidado' | 'Individual';

const MODULOS_TIPO_FORZADO_CONSOLIDADO = new Set<string>([
  MODULO_INGRESOS,
  MODULO_ACCIONES_PERSONALES,
  MODULO_BITACORA_NOVEDADES,
  MODULO_CHECKLIST_SUPERVISION,
  MODULO_EVALUACION_PERSONAL,
  MODULO_MANUALES_PUESTO,
  MODULO_ARTICULOS_PUESTO,
  MODULO_MANTENIMIENTO_ARTICULOS,
  MODULO_REGISTRO_VEHICULOS_CORPORATIVOS,
  MODULO_NOTAS_VOZ,
  MODULO_CAMBIOS_UBICACION_PUESTO,
  MODULO_REGISTRO_CAPACITACIONES,
  MODULO_TIEMPO_ALMUERZO,
]);

const MODULOS_TIPO_DESDE_PICKER = new Set<string>([
  MODULO_ACTA_ENTREGA,
  MODULO_ENTREGA_PUESTO,
  MODULO_AGENDA_MINUTA,
  MODULO_APERTURA_CIERRE,
  MODULO_VULNERABILIDAD,
  MODULO_ACTIVIDADES,
  MODULO_CONTROL_ASISTENCIA,
  MODULO_DOCUMENTOS_ENTREGADOS,
  MODULO_ENCUESTA_SATISFACCION,
  MODULO_REGISTRO_VISITAS,
  MODULO_VISITAS_VEHICULOS,
  MODULO_MUTUOS_ACUERDOS,
  MODULO_INCIDENTES,
  MODULO_LLAVES,
  MODULO_LLAVEROS,
  MODULO_MAESTRO_QUEJAS,
  MODULO_PRODUCTO_NO_CONFORME,
  MODULO_REGISTRO_INDUCCION_RECORRIDO,
  MODULO_REGISTRO_INDUCCION_GENERAL,
  MODULO_SOLICITUDES_PERMISO,
  MODULO_REVISION_VEHICULOS,
]);

function resolveTipoReporteForCreate(modulo: string, picked: ReporteTipoSalida): ReporteTipoSalida {
  if (MODULOS_TIPO_FORZADO_CONSOLIDADO.has(modulo)) return 'Consolidado';
  if (MODULOS_TIPO_DESDE_PICKER.has(modulo)) return picked;
  return 'Consolidado';
}

/** Opciones del selector «Módulo» (listado y formulario), ordenadas alfabéticamente por etiqueta. */
const MODULO_PICKER_OPTIONS: { value: string; label: string }[] = [
  { value: MODULO_ACCIONES_PERSONALES, label: 'Acciones de personal' },
  { value: MODULO_ACTA_ENTREGA, label: 'Acta de entrega de productos' },
  { value: MODULO_ACTIVIDADES, label: 'Actividades' },
  { value: MODULO_ARTICULOS_PUESTO, label: 'Artículos del puesto' },
  { value: MODULO_AGENDA_MINUTA, label: 'Agenda minuta' },
  { value: MODULO_APERTURA_CIERRE, label: 'Apertura/Cierre de puesto' },
  { value: MODULO_VULNERABILIDAD, label: 'Apreciación de vulnerabilidad' },
  { value: MODULO_BITACORA_NOVEDADES, label: 'Bitácora de novedades' },
  { value: MODULO_CAMBIOS_UBICACION_PUESTO, label: 'Cambios en ubicación del puesto' },
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
  { value: MODULO_MANTENIMIENTO_ARTICULOS, label: 'Mantenimiento de artículos' },
  { value: MODULO_NOTAS_VOZ, label: 'Notas de voz' },
  { value: MODULO_MUTUOS_ACUERDOS, label: 'Mutuos acuerdos' },
  { value: MODULO_PRODUCTO_NO_CONFORME, label: 'Producto no conforme' },
  { value: MODULO_REGISTRO_INDUCCION_RECORRIDO, label: 'Registro de inducción y recorrido' },
  { value: MODULO_REGISTRO_INDUCCION_GENERAL, label: 'Registro de inducción general' },
  { value: MODULO_REGISTRO_VEHICULOS_CORPORATIVOS, label: 'Registro de vehículos' },
  { value: MODULO_REVISION_VEHICULOS, label: 'Revisión de vehículos' },
  { value: MODULO_REGISTRO_VISITAS, label: 'Registro de visitas' },
  { value: MODULO_VISITAS_VEHICULOS, label: 'Visitas de vehículos' },
  { value: MODULO_REGISTRO_CAPACITACIONES, label: 'Registro de capacitaciones' },
  { value: MODULO_SOLICITUDES_PERMISO, label: 'Solicitudes de permiso' },
  { value: MODULO_TIEMPO_ALMUERZO, label: 'Tiempo de almuerzo' },
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
const ORDER_OPTIONS_NOTAS_VOZ: { value: string; label: string }[] = [
  { value: 'empresa_id', label: 'Empresa' },
  { value: 'cliente_id', label: 'Cliente' },
  { value: 'division_id', label: 'División' },
  { value: 'contrato_id', label: 'Contrato' },
  { value: 'corpo_id', label: 'Sucursal' },
  { value: 'puesto_id', label: 'Puesto' },
  { value: 'created_at', label: 'Fecha' },
];
const ORDER_OPTIONS_CAMBIOS_UBICACION_PUESTO: { value: string; label: string }[] = [
  { value: 'empresa_id', label: 'Empresa' },
  { value: 'cliente_id', label: 'Cliente' },
  { value: 'division_id', label: 'División' },
  { value: 'contrato_id', label: 'Contrato' },
  { value: 'corpo_id', label: 'Sucursal' },
  { value: 'puesto_id', label: 'Puesto' },
  { value: 'created_at', label: 'Fecha' },
];
const ORDER_OPTIONS_REGISTRO_CAPACITACIONES: { value: string; label: string }[] = [
  { value: 'empresa_id', label: 'Empresa' },
  { value: 'cliente_id', label: 'Cliente' },
  { value: 'division_id', label: 'División' },
  { value: 'contrato_id', label: 'Contrato' },
  { value: 'corpo_id', label: 'Sucursal' },
  { value: 'puesto_id', label: 'Puesto' },
  { value: 'created_at', label: 'Fecha' },
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

const ORDER_OPTIONS_VISITAS_VEHICULOS: { value: string; label: string }[] = [
  { value: 'empresa_id', label: 'Empresa' },
  { value: 'cliente_id', label: 'Cliente' },
  { value: 'division_id', label: 'División' },
  { value: 'contrato_id', label: 'Contrato' },
  { value: 'corpo_id', label: 'Sucursal' },
  { value: 'puesto_id', label: 'Puesto' },
  { value: 'created_at', label: 'Fecha' },
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

const ORDER_OPTIONS_TIEMPO_ALMUERZO: { value: string; label: string }[] = [
  { value: 'empresa_id', label: 'Empresa' },
  { value: 'cliente_id', label: 'Cliente' },
  { value: 'division_id', label: 'División' },
  { value: 'contrato_id', label: 'Contrato' },
  { value: 'corpo_id', label: 'Sucursal' },
  { value: 'puesto_id', label: 'Puesto' },
  { value: 'inicio', label: 'Inicio' },
  { value: 'fin', label: 'Fin' },
];

const ORDER_OPTIONS_SOLICITUDES_PERMISO: { value: string; label: string }[] = [
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

const ORDER_OPTIONS_ARTICULOS_PUESTO: { value: string; label: string }[] = [
  { value: 'empresa_id', label: 'Empresa' },
  { value: 'cliente_id', label: 'Cliente' },
  { value: 'division_id', label: 'División' },
  { value: 'contrato_id', label: 'Contrato' },
  { value: 'corpo_id', label: 'Sucursal' },
  { value: 'puesto_id', label: 'Puesto' },
];

const ORDER_OPTIONS_MANTENIMIENTO_ARTICULOS: { value: string; label: string }[] = [
  { value: 'empresa_id', label: 'Empresa' },
  { value: 'cliente_id', label: 'Cliente' },
  { value: 'division_id', label: 'División' },
  { value: 'contrato_id', label: 'Contrato' },
  { value: 'corpo_id', label: 'Sucursal' },
  { value: 'puesto_id', label: 'Puesto' },
];

const ORDER_OPTIONS_REGISTRO_VEHICULOS_CORPORATIVOS: { value: string; label: string }[] = [
  { value: 'empresa_id', label: 'Empresa' },
  { value: 'cliente_id', label: 'Cliente' },
  { value: 'division_id', label: 'División' },
  { value: 'contrato_id', label: 'Contrato' },
  { value: 'corpo_id', label: 'Sucursal' },
  { value: 'puesto_id', label: 'Puesto' },
  { value: 'created_at', label: 'Fecha' },
];

const ORDER_OPTIONS_REVISION_VEHICULOS: { value: string; label: string }[] = [
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
function formatModuloLabel(modulo: string): string {
  const opt = MODULO_PICKER_OPTIONS.find((o) => o.value === modulo);
  return opt?.label ?? modulo;
}

function formatTipoReporteDisplay(raw: string | null | undefined): string {
  const t = String(raw ?? '').trim();
  if (!t) return '—';
  if (t.toLowerCase() === 'grupal') return 'Consolidado';
  return t;
}

function formatEstadoDisplay(raw: string | null | undefined): string {
  const s = String(raw ?? '').trim();
  if (!s) return '—';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

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
  created_by_nombre?: string | null;
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
    setListSpTipoSalario('todos');
    setListSpEstado('todos');
    setListSpTipoTurnoPick('Diurno');
    setListSpTiposTurnoSelected([]);
    setListSpEmpleadoSearch('');
    setListSpEmpleadoResults([]);
    setListSpEmpleadoSelected([]);
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
  const [listVvCedulaVisitante, setListVvCedulaVisitante] = useState('');
  const [listVvTipoPick, setListVvTipoPick] = useState<'Particular' | 'Institucional'>('Particular');
  const [listVvTiposSelected, setListVvTiposSelected] = useState<string[]>([]);
  const [listVvPlacaInput, setListVvPlacaInput] = useState('');
  const [listVvPlacasSelected, setListVvPlacasSelected] = useState<string[]>([]);
  const [listVvResponsableSearch, setListVvResponsableSearch] = useState('');
  const [listVvResponsableResults, setListVvResponsableResults] = useState<EmpleadoLite[]>([]);
  const [listVvResponsableSelected, setListVvResponsableSelected] = useState<EmpleadoLite[]>([]);
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
  const [listCupResponsableSearch, setListCupResponsableSearch] = useState('');
  const [listCupResponsableResults, setListCupResponsableResults] = useState<EmpleadoLite[]>([]);
  const [listCupResponsableSelected, setListCupResponsableSelected] = useState<EmpleadoLite[]>([]);
  const [listRcTipoCapacitacion, setListRcTipoCapacitacion] = useState<'todos' | 'Presencial' | 'Virtual'>('todos');
  const [listRcCapEmpSearch, setListRcCapEmpSearch] = useState('');
  const [listRcCapEmpResults, setListRcCapEmpResults] = useState<EmpleadoLite[]>([]);
  const [listRcCapEmpSelected, setListRcCapEmpSelected] = useState<EmpleadoLite[]>([]);
  const [listRcCapPuestoSearch, setListRcCapPuestoSearch] = useState('');
  const [listRcCapPuestoResults, setListRcCapPuestoResults] = useState<StructureLite[]>([]);
  const [listRcCapPuestoSelected, setListRcCapPuestoSelected] = useState<StructureLite[]>([]);
  const [listRcResponsableSearch, setListRcResponsableSearch] = useState('');
  const [listRcResponsableResults, setListRcResponsableResults] = useState<EmpleadoLite[]>([]);
  const [listRcResponsableSelected, setListRcResponsableSelected] = useState<EmpleadoLite[]>([]);
  const [listIrEmpleadoSearch, setListIrEmpleadoSearch] = useState('');
  const [listIrEmpleadoResults, setListIrEmpleadoResults] = useState<EmpleadoLite[]>([]);
  const [listIrEmpleadoSelected, setListIrEmpleadoSelected] = useState<EmpleadoLite[]>([]);
  const [listIrParticipanteSearch, setListIrParticipanteSearch] = useState('');
  const [listIrParticipanteCedulas, setListIrParticipanteCedulas] = useState<string[]>([]);
  const [listRigColaboradorSearch, setListRigColaboradorSearch] = useState('');
  const [listRigColaboradorCedulas, setListRigColaboradorCedulas] = useState<string[]>([]);
  const [listRigCapacitadorSearch, setListRigCapacitadorSearch] = useState('');
  const [listRigCapacitadorCedulas, setListRigCapacitadorCedulas] = useState<string[]>([]);
  const [listTaEmpleadoSearch, setListTaEmpleadoSearch] = useState('');
  const [listTaEmpleadoResults, setListTaEmpleadoResults] = useState<EmpleadoLite[]>([]);
  const [listTaEmpleadoSelected, setListTaEmpleadoSelected] = useState<EmpleadoLite[]>([]);
  const [listTaCedulaSearch, setListTaCedulaSearch] = useState('');
  const [listTaCedulaResults, setListTaCedulaResults] = useState<CedulaAlmuerzoLite[]>([]);
  const [listTaCedulasSelected, setListTaCedulasSelected] = useState<string[]>([]);
  const [listSpTipoSalario, setListSpTipoSalario] = useState<'todos' | 'Con goce' | 'Sin goce'>('todos');
  const [listSpEstado, setListSpEstado] = useState<'todos' | 'pendiente' | 'aprobado' | 'rechazado'>('todos');
  const [listSpTipoTurnoPick, setListSpTipoTurnoPick] = useState<'Diurno' | 'Mixto' | 'Nocturno'>('Diurno');
  const [listSpTiposTurnoSelected, setListSpTiposTurnoSelected] = useState<string[]>([]);
  const [listSpEmpleadoSearch, setListSpEmpleadoSearch] = useState('');
  const [listSpEmpleadoResults, setListSpEmpleadoResults] = useState<EmpleadoLite[]>([]);
  const [listSpEmpleadoSelected, setListSpEmpleadoSelected] = useState<EmpleadoLite[]>([]);
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
  const [listMaEstadoPick, setListMaEstadoPick] = useState<'todos' | 'Bueno' | 'Malo' | 'No está'>('todos');
  const [listMaEstadosSelected, setListMaEstadosSelected] = useState<string[]>([]);
  const [listMaAccionPick, setListMaAccionPick] = useState<
    'todos' | 'Reemplazar' | 'Rellenar' | 'Reparar en puesto' | 'Reparar en taller'
  >('todos');
  const [listMaAccionesSelected, setListMaAccionesSelected] = useState<string[]>([]);
  const [listMaSolDesdeD, setListMaSolDesdeD] = useState<Date | null>(null);
  const [listMaSolDesdeT, setListMaSolDesdeT] = useState<Date | null>(null);
  const [listMaSolHastaD, setListMaSolHastaD] = useState<Date | null>(null);
  const [listMaSolHastaT, setListMaSolHastaT] = useState<Date | null>(null);
  const [modalMaEstadoPick, setModalMaEstadoPick] = useState<'todos' | 'Bueno' | 'Malo' | 'No está'>('todos');
  const [modalMaEstadosSelected, setModalMaEstadosSelected] = useState<string[]>([]);
  const [modalMaAccionPick, setModalMaAccionPick] = useState<
    'todos' | 'Reemplazar' | 'Rellenar' | 'Reparar en puesto' | 'Reparar en taller'
  >('todos');
  const [modalMaAccionesSelected, setModalMaAccionesSelected] = useState<string[]>([]);
  const [modalMaSolDesdeD, setModalMaSolDesdeD] = useState<Date | null>(null);
  const [modalMaSolDesdeT, setModalMaSolDesdeT] = useState<Date | null>(null);
  const [modalMaSolHastaD, setModalMaSolHastaD] = useState<Date | null>(null);
  const [modalMaSolHastaT, setModalMaSolHastaT] = useState<Date | null>(null);
  const [listRvcTipoVehiculoPick, setListRvcTipoVehiculoPick] = useState<'Vehículo' | 'Motocicleta' | 'Bicicleta'>('Vehículo');
  const [listRvcTiposVehiculoSelected, setListRvcTiposVehiculoSelected] = useState<string[]>([]);
  const [listRvcPlaca, setListRvcPlaca] = useState('');
  const [listRvcAnno, setListRvcAnno] = useState('');
  const [listRvcModelo, setListRvcModelo] = useState('');
  const [listRvcTipoAutoriaPick, setListRvcTipoAutoriaPick] = useState<'Cliente' | 'Corporativo'>('Cliente');
  const [listRvcTiposAutoriaSelected, setListRvcTiposAutoriaSelected] = useState<string[]>([]);
  const [modalRvcTipoVehiculoPick, setModalRvcTipoVehiculoPick] = useState<'Vehículo' | 'Motocicleta' | 'Bicicleta'>('Vehículo');
  const [modalRvcTiposVehiculoSelected, setModalRvcTiposVehiculoSelected] = useState<string[]>([]);
  const [modalRvcPlaca, setModalRvcPlaca] = useState('');
  const [modalRvcAnno, setModalRvcAnno] = useState('');
  const [modalRvcModelo, setModalRvcModelo] = useState('');
  const [modalRvcTipoAutoriaPick, setModalRvcTipoAutoriaPick] = useState<'Cliente' | 'Corporativo'>('Cliente');
  const [modalRvcTiposAutoriaSelected, setModalRvcTiposAutoriaSelected] = useState<string[]>([]);
  const [listRvdVehiculoSearch, setListRvdVehiculoSearch] = useState('');
  const [listRvdVehiculoResults, setListRvdVehiculoResults] = useState<VehiculoCorporativoLite[]>([]);
  const [listRvdVehiculoSelected, setListRvdVehiculoSelected] = useState<VehiculoCorporativoLite[]>([]);
  const [modalRvdVehiculoSearch, setModalRvdVehiculoSearch] = useState('');
  const [modalRvdVehiculoResults, setModalRvdVehiculoResults] = useState<VehiculoCorporativoLite[]>([]);
  const [modalRvdVehiculoSelected, setModalRvdVehiculoSelected] = useState<VehiculoCorporativoLite[]>([]);
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
  const [formTipoReporte, setFormTipoReporte] = useState<ReporteTipoSalida>('Consolidado');
  const formTipoReporteRef = useRef<ReporteTipoSalida>('Consolidado');

  const applyFormTipoReporte = useCallback((t: ReporteTipoSalida) => {
    formTipoReporteRef.current = t;
    setFormTipoReporte(t);
  }, []);
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
  const [modalVvCedulaVisitante, setModalVvCedulaVisitante] = useState('');
  const [modalVvTipoPick, setModalVvTipoPick] = useState<'Particular' | 'Institucional'>('Particular');
  const [modalVvTiposSelected, setModalVvTiposSelected] = useState<string[]>([]);
  const [modalVvPlacaInput, setModalVvPlacaInput] = useState('');
  const [modalVvPlacasSelected, setModalVvPlacasSelected] = useState<string[]>([]);
  const [modalVvResponsableSearch, setModalVvResponsableSearch] = useState('');
  const [modalVvResponsableResults, setModalVvResponsableResults] = useState<EmpleadoLite[]>([]);
  const [modalVvResponsableSelected, setModalVvResponsableSelected] = useState<EmpleadoLite[]>([]);
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
  const [modalCupResponsableSearch, setModalCupResponsableSearch] = useState('');
  const [modalCupResponsableResults, setModalCupResponsableResults] = useState<EmpleadoLite[]>([]);
  const [modalCupResponsableSelected, setModalCupResponsableSelected] = useState<EmpleadoLite[]>([]);
  const [modalRcTipoCapacitacion, setModalRcTipoCapacitacion] = useState<'todos' | 'Presencial' | 'Virtual'>('todos');
  const [modalRcCapEmpSearch, setModalRcCapEmpSearch] = useState('');
  const [modalRcCapEmpResults, setModalRcCapEmpResults] = useState<EmpleadoLite[]>([]);
  const [modalRcCapEmpSelected, setModalRcCapEmpSelected] = useState<EmpleadoLite[]>([]);
  const [modalRcCapPuestoSearch, setModalRcCapPuestoSearch] = useState('');
  const [modalRcCapPuestoResults, setModalRcCapPuestoResults] = useState<StructureLite[]>([]);
  const [modalRcCapPuestoSelected, setModalRcCapPuestoSelected] = useState<StructureLite[]>([]);
  const [modalRcResponsableSearch, setModalRcResponsableSearch] = useState('');
  const [modalRcResponsableResults, setModalRcResponsableResults] = useState<EmpleadoLite[]>([]);
  const [modalRcResponsableSelected, setModalRcResponsableSelected] = useState<EmpleadoLite[]>([]);
  const [modalIrEmpleadoSearch, setModalIrEmpleadoSearch] = useState('');
  const [modalIrEmpleadoResults, setModalIrEmpleadoResults] = useState<EmpleadoLite[]>([]);
  const [modalIrEmpleadoSelected, setModalIrEmpleadoSelected] = useState<EmpleadoLite[]>([]);
  const [modalIrParticipanteSearch, setModalIrParticipanteSearch] = useState('');
  const [modalIrParticipanteCedulas, setModalIrParticipanteCedulas] = useState<string[]>([]);
  const [modalRigColaboradorSearch, setModalRigColaboradorSearch] = useState('');
  const [modalRigColaboradorCedulas, setModalRigColaboradorCedulas] = useState<string[]>([]);
  const [modalRigCapacitadorSearch, setModalRigCapacitadorSearch] = useState('');
  const [modalRigCapacitadorCedulas, setModalRigCapacitadorCedulas] = useState<string[]>([]);
  const [modalTaEmpleadoSearch, setModalTaEmpleadoSearch] = useState('');
  const [modalTaEmpleadoResults, setModalTaEmpleadoResults] = useState<EmpleadoLite[]>([]);
  const [modalTaEmpleadoSelected, setModalTaEmpleadoSelected] = useState<EmpleadoLite[]>([]);
  const [modalTaCedulaSearch, setModalTaCedulaSearch] = useState('');
  const [modalTaCedulaResults, setModalTaCedulaResults] = useState<CedulaAlmuerzoLite[]>([]);
  const [modalTaCedulasSelected, setModalTaCedulasSelected] = useState<string[]>([]);
  const [modalSpTipoSalario, setModalSpTipoSalario] = useState<'todos' | 'Con goce' | 'Sin goce'>('todos');
  const [modalSpEstado, setModalSpEstado] = useState<'todos' | 'pendiente' | 'aprobado' | 'rechazado'>('todos');
  const [modalSpTipoTurnoPick, setModalSpTipoTurnoPick] = useState<'Diurno' | 'Mixto' | 'Nocturno'>('Diurno');
  const [modalSpTiposTurnoSelected, setModalSpTiposTurnoSelected] = useState<string[]>([]);
  const [modalSpEmpleadoSearch, setModalSpEmpleadoSearch] = useState('');
  const [modalSpEmpleadoResults, setModalSpEmpleadoResults] = useState<EmpleadoLite[]>([]);
  const [modalSpEmpleadoSelected, setModalSpEmpleadoSelected] = useState<EmpleadoLite[]>([]);
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
    | 'listVvResponsable'
    | 'modalRvResponsable'
    | 'modalVvResponsable'
    | 'listEvpEmpEval'
    | 'listEvpEvaluador'
    | 'modalEvpEmpEval'
    | 'modalEvpEvaluador'
    | 'listIrResponsable'
    | 'listIrEmpleado'
    | 'modalIrResponsable'
    | 'modalIrEmpleado'
    | 'listCupResponsable'
    | 'modalCupResponsable'
    | 'listRcCapEmpleado'
    | 'modalRcCapEmpleado'
    | 'listRcCapPuesto'
    | 'modalRcCapPuesto'
    | 'listRcResponsable'
    | 'modalRcResponsable'
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
    | 'listTaEmpleado'
    | 'modalTaEmpleado'
    | 'listTaCedula'
    | 'modalTaCedula'
    | 'listSpEmpleado'
    | 'modalSpEmpleado'
    | 'listRvdVehiculo'
    | 'modalRvdVehiculo'
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
  const [showListMaSolDd, setShowListMaSolDd] = useState(false);
  const [showListMaSolDt, setShowListMaSolDt] = useState(false);
  const [showListMaSolHd, setShowListMaSolHd] = useState(false);
  const [showListMaSolHt, setShowListMaSolHt] = useState(false);
  const [showModalMaSolDd, setShowModalMaSolDd] = useState(false);
  const [showModalMaSolDt, setShowModalMaSolDt] = useState(false);
  const [showModalMaSolHd, setShowModalMaSolHd] = useState(false);
  const [showModalMaSolHt, setShowModalMaSolHt] = useState(false);
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
    applyFormTipoReporte('Consolidado');
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
    setModalVvCedulaVisitante('');
    setModalVvTipoPick('Particular');
    setModalVvTiposSelected([]);
    setModalVvPlacaInput('');
    setModalVvPlacasSelected([]);
    setModalVvResponsableSearch('');
    setModalVvResponsableResults([]);
    setModalVvResponsableSelected([]);
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
    setModalTaEmpleadoSearch('');
    setModalTaEmpleadoResults([]);
    setModalTaEmpleadoSelected([]);
    setModalTaCedulaSearch('');
    setModalTaCedulaResults([]);
    setModalTaCedulasSelected([]);
    setModalSpTipoSalario('todos');
    setModalSpEstado('todos');
    setModalSpTipoTurnoPick('Diurno');
    setModalSpTiposTurnoSelected([]);
    setModalSpEmpleadoSearch('');
    setModalSpEmpleadoResults([]);
    setModalSpEmpleadoSelected([]);
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
      formModulo === MODULO_VISITAS_VEHICULOS ||
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
      formModulo === MODULO_REGISTRO_INDUCCION_RECORRIDO ||
      formModulo === MODULO_REGISTRO_INDUCCION_GENERAL ||
      formModulo === MODULO_NOTAS_VOZ ||
      formModulo === MODULO_CAMBIOS_UBICACION_PUESTO ||
      formModulo === MODULO_REGISTRO_CAPACITACIONES ||
      formModulo === MODULO_TIEMPO_ALMUERZO ||
      formModulo === MODULO_SOLICITUDES_PERMISO ||
      formModulo === MODULO_ARTICULOS_PUESTO ||
      formModulo === MODULO_MANTENIMIENTO_ARTICULOS ||
      formModulo === MODULO_REGISTRO_VEHICULOS_CORPORATIVOS ||
      formModulo === MODULO_REVISION_VEHICULOS
    ) {
      setFormOrder(
        formModulo === MODULO_MANTENIMIENTO_ARTICULOS ||
        formModulo === MODULO_REGISTRO_VEHICULOS_CORPORATIVOS ||
        formModulo === MODULO_REVISION_VEHICULOS
          ? 'puesto_id'
          : 'empresa_id',
      );
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
      formModulo !== MODULO_VISITAS_VEHICULOS &&
      formModulo !== MODULO_MUTUOS_ACUERDOS &&
      formModulo !== MODULO_INCIDENTES &&
      formModulo !== MODULO_LLAVES &&
      formModulo !== MODULO_LLAVEROS &&
      formModulo !== MODULO_MAESTRO_QUEJAS &&
      formModulo !== MODULO_PRODUCTO_NO_CONFORME &&
      formModulo !== MODULO_REGISTRO_INDUCCION_RECORRIDO &&
      formModulo !== MODULO_REGISTRO_INDUCCION_GENERAL &&
      formModulo !== MODULO_MANUALES_PUESTO &&
      formModulo !== MODULO_ARTICULOS_PUESTO &&
      formModulo !== MODULO_MANTENIMIENTO_ARTICULOS &&
      formModulo !== MODULO_REGISTRO_VEHICULOS_CORPORATIVOS &&
      formModulo !== MODULO_REVISION_VEHICULOS &&
      formModulo !== MODULO_SOLICITUDES_PERMISO
    ) {
      setFormTipoReporte('Consolidado');
    }
  }, [formModulo]);

  useEffect(() => {
    formTipoReporteRef.current = formTipoReporte;
  }, [formTipoReporte]);

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

  useEffect(() => {
    if (isOnline !== true) return;
    void (async () => {
      try {
        await purgeOldMobileReports({ refreshAccessToken, logout });
      } catch {
        /* limpieza en segundo plano; no bloquear la pantalla */
      }
    })();
  }, [isOnline, refreshAccessToken, logout]);

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
    | 'listCupResponsable'
    | 'modalCupResponsable'
    | 'listRcCapEmpleado'
    | 'modalRcCapEmpleado'
    | 'listRcResponsable'
    | 'modalRcResponsable'
      | 'listRvResponsable'
      | 'listVvResponsable'
      | 'modalRvResponsable'
      | 'modalVvResponsable'
      | 'listTaEmpleado'
      | 'modalTaEmpleado'
      | 'listSpEmpleado'
      | 'modalSpEmpleado',
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
      if (mode === 'listVvResponsable') setListVvResponsableResults(rows);
      if (mode === 'modalRvResponsable') setModalRvResponsableResults(rows);
      if (mode === 'modalVvResponsable') setModalVvResponsableResults(rows);
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
      if (mode === 'listCupResponsable') setListCupResponsableResults(rows);
      if (mode === 'modalCupResponsable') setModalCupResponsableResults(rows);
      if (mode === 'listRcCapEmpleado') setListRcCapEmpResults(rows);
      if (mode === 'modalRcCapEmpleado') setModalRcCapEmpResults(rows);
      if (mode === 'listRcResponsable') setListRcResponsableResults(rows);
      if (mode === 'modalRcResponsable') setModalRcResponsableResults(rows);
      if (mode === 'listTaEmpleado') setListTaEmpleadoResults(rows);
      if (mode === 'modalTaEmpleado') setModalTaEmpleadoResults(rows);
      if (mode === 'listSpEmpleado') setListSpEmpleadoResults(rows);
      if (mode === 'modalSpEmpleado') setModalSpEmpleadoResults(rows);
    } finally {
      setEmployeeSearchMode(null);
    }
  };

  const runSearchAlmuerzoCedulas = async (
    q: string,
    mode: 'listTaCedula' | 'modalTaCedula',
  ) => {
    const ok = await getOnline();
    if (!ok) {
      Alert.alert('Sin conexión', 'Esta pantalla requiere internet.');
      return;
    }
    if (!q.trim()) {
      Alert.alert('Buscar', 'Escriba una cédula.');
      return;
    }
    setEmployeeSearchMode(mode);
    try {
      const res = await searchAlmuerzoCedulas({ q: q.trim(), refreshAccessToken, logout });
      if (!res.status) {
        Alert.alert('Error', res.message || 'No se pudo buscar');
        return;
      }
      const rows = res.data || [];
      if (mode === 'listTaCedula') setListTaCedulaResults(rows);
      if (mode === 'modalTaCedula') setModalTaCedulaResults(rows);
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
      | 'listRcCapPuesto'
      | 'modalEmpresa'
      | 'modalCliente'
      | 'modalDivision'
      | 'modalContrato'
      | 'modalCorpo'
      | 'modalPuesto'
      | 'modalLlavero'
      | 'modalAccPlaza'
      | 'modalEjecutivo'
      | 'modalMutEjecutivo'
      | 'modalRcCapPuesto',
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
      if (mode === 'listRcCapPuesto') setListRcCapPuestoResults(rows);
      if (mode === 'modalRcCapPuesto') setModalRcCapPuestoResults(rows);
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
  const pickListCupResponsable = (e: EmpleadoLite) => {
    setListCupResponsableSelected((prev) => (prev.some((x) => x.id === e.id) ? prev : [...prev, e]));
    setListCupResponsableResults([]);
    setListCupResponsableSearch('');
  };
  const removeListCupResponsable = (id: number) => setListCupResponsableSelected((prev) => prev.filter((x) => x.id !== id));
  const pickModalCupResponsable = (e: EmpleadoLite) => {
    setModalCupResponsableSelected((prev) => (prev.some((x) => x.id === e.id) ? prev : [...prev, e]));
    setModalCupResponsableResults([]);
    setModalCupResponsableSearch('');
  };
  const removeModalCupResponsable = (id: number) => setModalCupResponsableSelected((prev) => prev.filter((x) => x.id !== id));
  const pickListRcCapEmp = (e: EmpleadoLite) => {
    setListRcCapEmpSelected((prev) => (prev.some((x) => x.id === e.id) ? prev : [...prev, e]));
    setListRcCapEmpResults([]);
    setListRcCapEmpSearch('');
  };
  const removeListRcCapEmp = (id: number) => setListRcCapEmpSelected((prev) => prev.filter((x) => x.id !== id));
  const pickModalRcCapEmp = (e: EmpleadoLite) => {
    setModalRcCapEmpSelected((prev) => (prev.some((x) => x.id === e.id) ? prev : [...prev, e]));
    setModalRcCapEmpResults([]);
    setModalRcCapEmpSearch('');
  };
  const removeModalRcCapEmp = (id: number) => setModalRcCapEmpSelected((prev) => prev.filter((x) => x.id !== id));
  const pickListRcResponsable = (e: EmpleadoLite) => {
    setListRcResponsableSelected((prev) => (prev.some((x) => x.id === e.id) ? prev : [...prev, e]));
    setListRcResponsableResults([]);
    setListRcResponsableSearch('');
  };
  const removeListRcResponsable = (id: number) => setListRcResponsableSelected((prev) => prev.filter((x) => x.id !== id));
  const pickModalRcResponsable = (e: EmpleadoLite) => {
    setModalRcResponsableSelected((prev) => (prev.some((x) => x.id === e.id) ? prev : [...prev, e]));
    setModalRcResponsableResults([]);
    setModalRcResponsableSearch('');
  };
  const removeModalRcResponsable = (id: number) => setModalRcResponsableSelected((prev) => prev.filter((x) => x.id !== id));
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

  const addListRigColaboradorCedula = () => {
    const t = listRigColaboradorSearch.trim().replace(/\s+/g, '');
    if (!t) {
      Alert.alert('Colaboradores', 'Escriba una cédula.');
      return;
    }
    setListRigColaboradorCedulas((prev) => (prev.some((x) => x.toLowerCase() === t.toLowerCase()) ? prev : [...prev, t]));
    setListRigColaboradorSearch('');
  };
  const removeListRigColaboradorCedula = (ced: string) =>
    setListRigColaboradorCedulas((prev) => prev.filter((x) => x !== ced));
  const addListRigCapacitadorCedula = () => {
    const t = listRigCapacitadorSearch.trim().replace(/\s+/g, '');
    if (!t) {
      Alert.alert('Capacitadores', 'Escriba una cédula.');
      return;
    }
    setListRigCapacitadorCedulas((prev) => (prev.some((x) => x.toLowerCase() === t.toLowerCase()) ? prev : [...prev, t]));
    setListRigCapacitadorSearch('');
  };
  const removeListRigCapacitadorCedula = (ced: string) =>
    setListRigCapacitadorCedulas((prev) => prev.filter((x) => x !== ced));

  const addModalRigColaboradorCedula = () => {
    const t = modalRigColaboradorSearch.trim().replace(/\s+/g, '');
    if (!t) {
      Alert.alert('Colaboradores', 'Escriba una cédula.');
      return;
    }
    setModalRigColaboradorCedulas((prev) => (prev.some((x) => x.toLowerCase() === t.toLowerCase()) ? prev : [...prev, t]));
    setModalRigColaboradorSearch('');
  };
  const removeModalRigColaboradorCedula = (ced: string) =>
    setModalRigColaboradorCedulas((prev) => prev.filter((x) => x !== ced));
  const addModalRigCapacitadorCedula = () => {
    const t = modalRigCapacitadorSearch.trim().replace(/\s+/g, '');
    if (!t) {
      Alert.alert('Capacitadores', 'Escriba una cédula.');
      return;
    }
    setModalRigCapacitadorCedulas((prev) => (prev.some((x) => x.toLowerCase() === t.toLowerCase()) ? prev : [...prev, t]));
    setModalRigCapacitadorSearch('');
  };
  const removeModalRigCapacitadorCedula = (ced: string) =>
    setModalRigCapacitadorCedulas((prev) => prev.filter((x) => x !== ced));

  const pickListTaEmpleado = (e: EmpleadoLite) => {
    setListTaEmpleadoSelected((prev) => (prev.some((x) => x.id === e.id) ? prev : [...prev, e]));
    setListTaEmpleadoResults([]);
    setListTaEmpleadoSearch('');
  };
  const removeListTaEmpleado = (id: number) => setListTaEmpleadoSelected((prev) => prev.filter((x) => x.id !== id));
  const pickListTaCedula = (c: CedulaAlmuerzoLite) => {
    const t = String(c.cedula || '').trim();
    if (!t) return;
    setListTaCedulasSelected((prev) => (prev.some((x) => x.toLowerCase() === t.toLowerCase()) ? prev : [...prev, t]));
    setListTaCedulaResults([]);
    setListTaCedulaSearch('');
  };
  const removeListTaCedula = (ced: string) => setListTaCedulasSelected((prev) => prev.filter((x) => x !== ced));
  const pickModalTaEmpleado = (e: EmpleadoLite) => {
    setModalTaEmpleadoSelected((prev) => (prev.some((x) => x.id === e.id) ? prev : [...prev, e]));
    setModalTaEmpleadoResults([]);
    setModalTaEmpleadoSearch('');
  };
  const removeModalTaEmpleado = (id: number) => setModalTaEmpleadoSelected((prev) => prev.filter((x) => x.id !== id));
  const pickModalTaCedula = (c: CedulaAlmuerzoLite) => {
    const t = String(c.cedula || '').trim();
    if (!t) return;
    setModalTaCedulasSelected((prev) => (prev.some((x) => x.toLowerCase() === t.toLowerCase()) ? prev : [...prev, t]));
    setModalTaCedulaResults([]);
    setModalTaCedulaSearch('');
  };
  const removeModalTaCedula = (ced: string) => setModalTaCedulasSelected((prev) => prev.filter((x) => x !== ced));

  const pickListSpEmpleado = (e: EmpleadoLite) => {
    setListSpEmpleadoSelected((prev) => (prev.some((x) => x.id === e.id) ? prev : [...prev, e]));
    setListSpEmpleadoResults([]);
    setListSpEmpleadoSearch('');
  };
  const removeListSpEmpleado = (id: number) => setListSpEmpleadoSelected((prev) => prev.filter((x) => x.id !== id));
  const addListSpTipoTurno = () => {
    const t = listSpTipoTurnoPick.trim();
    if (!t) return;
    setListSpTiposTurnoSelected((prev) => (prev.some((x) => x.toLowerCase() === t.toLowerCase()) ? prev : [...prev, t]));
  };
  const removeListSpTipoTurno = (tipo: string) => setListSpTiposTurnoSelected((prev) => prev.filter((x) => x !== tipo));
  const addListMaEstado = () => {
    if (listMaEstadoPick === 'todos') return;
    setListMaEstadosSelected((prev) => (prev.includes(listMaEstadoPick) ? prev : [...prev, listMaEstadoPick]));
  };
  const removeListMaEstado = (estado: string) => setListMaEstadosSelected((prev) => prev.filter((x) => x !== estado));
  const addListMaAccion = () => {
    if (listMaAccionPick === 'todos') return;
    setListMaAccionesSelected((prev) => (prev.includes(listMaAccionPick) ? prev : [...prev, listMaAccionPick]));
  };
  const removeListMaAccion = (accion: string) => setListMaAccionesSelected((prev) => prev.filter((x) => x !== accion));
  const addModalMaEstado = () => {
    if (modalMaEstadoPick === 'todos') return;
    setModalMaEstadosSelected((prev) => (prev.includes(modalMaEstadoPick) ? prev : [...prev, modalMaEstadoPick]));
  };
  const removeModalMaEstado = (estado: string) => setModalMaEstadosSelected((prev) => prev.filter((x) => x !== estado));
  const addModalMaAccion = () => {
    if (modalMaAccionPick === 'todos') return;
    setModalMaAccionesSelected((prev) => (prev.includes(modalMaAccionPick) ? prev : [...prev, modalMaAccionPick]));
  };
  const removeModalMaAccion = (accion: string) => setModalMaAccionesSelected((prev) => prev.filter((x) => x !== accion));
  const addListRvcTipoVehiculo = () => {
    const t = listRvcTipoVehiculoPick;
    setListRvcTiposVehiculoSelected((prev) => (prev.includes(t) ? prev : [...prev, t]));
  };
  const removeListRvcTipoVehiculo = (tipo: string) => setListRvcTiposVehiculoSelected((prev) => prev.filter((x) => x !== tipo));
  const addListRvcTipoAutoria = () => {
    const t = listRvcTipoAutoriaPick;
    setListRvcTiposAutoriaSelected((prev) => (prev.includes(t) ? prev : [...prev, t]));
  };
  const removeListRvcTipoAutoria = (tipo: string) => setListRvcTiposAutoriaSelected((prev) => prev.filter((x) => x !== tipo));
  const addModalRvcTipoVehiculo = () => {
    const t = modalRvcTipoVehiculoPick;
    setModalRvcTiposVehiculoSelected((prev) => (prev.includes(t) ? prev : [...prev, t]));
  };
  const removeModalRvcTipoVehiculo = (tipo: string) => setModalRvcTiposVehiculoSelected((prev) => prev.filter((x) => x !== tipo));
  const addModalRvcTipoAutoria = () => {
    const t = modalRvcTipoAutoriaPick;
    setModalRvcTiposAutoriaSelected((prev) => (prev.includes(t) ? prev : [...prev, t]));
  };
  const removeModalRvcTipoAutoria = (tipo: string) => setModalRvcTiposAutoriaSelected((prev) => prev.filter((x) => x !== tipo));

  const formatVehiculoLite = (v: VehiculoCorporativoLite) => {
    const placa = v.placa || 'Sin placa';
    const desc = [v.marca, v.modelo].filter(Boolean).join(' ').trim();
    const tipo = v.tipo || '';
    const corpo = v.corpo_nombre || '';
    return `${placa}${desc ? ` — ${desc}` : ''}${tipo ? ` (${tipo})` : ''}${corpo ? ` · ${corpo}` : ''}`;
  };

  const runSearchCorporateVehicles = async (
    q: string,
    mode: 'listRvdVehiculo' | 'modalRvdVehiculo',
  ) => {
    const ok = await getOnline();
    if (!ok) {
      Alert.alert('Sin conexión', 'Esta pantalla requiere internet.');
      return;
    }
    if (!q.trim()) {
      Alert.alert('Buscar', 'Escriba placa, marca o modelo.');
      return;
    }
    setEmployeeSearchMode(mode);
    try {
      const res = await searchCorporateVehicles({ q: q.trim(), refreshAccessToken, logout });
      if (!res.status) {
        Alert.alert('Error', res.message || 'No se pudo buscar');
        return;
      }
      const rows = res.data || [];
      if (mode === 'listRvdVehiculo') setListRvdVehiculoResults(rows);
      if (mode === 'modalRvdVehiculo') setModalRvdVehiculoResults(rows);
    } finally {
      setEmployeeSearchMode(null);
    }
  };

  const pickListRvdVehiculo = (v: VehiculoCorporativoLite) => {
    setListRvdVehiculoSelected((prev) => (prev.some((x) => x.id === v.id) ? prev : [...prev, v]));
    setListRvdVehiculoResults([]);
    setListRvdVehiculoSearch('');
  };
  const removeListRvdVehiculo = (id: number) => setListRvdVehiculoSelected((prev) => prev.filter((x) => x.id !== id));
  const pickModalRvdVehiculo = (v: VehiculoCorporativoLite) => {
    setModalRvdVehiculoSelected((prev) => (prev.some((x) => x.id === v.id) ? prev : [...prev, v]));
    setModalRvdVehiculoResults([]);
    setModalRvdVehiculoSearch('');
  };
  const removeModalRvdVehiculo = (id: number) => setModalRvdVehiculoSelected((prev) => prev.filter((x) => x.id !== id));

  const pickModalSpEmpleado = (e: EmpleadoLite) => {
    setModalSpEmpleadoSelected((prev) => (prev.some((x) => x.id === e.id) ? prev : [...prev, e]));
    setModalSpEmpleadoResults([]);
    setModalSpEmpleadoSearch('');
  };
  const removeModalSpEmpleado = (id: number) => setModalSpEmpleadoSelected((prev) => prev.filter((x) => x.id !== id));
  const addModalSpTipoTurno = () => {
    const t = modalSpTipoTurnoPick.trim();
    if (!t) return;
    setModalSpTiposTurnoSelected((prev) => (prev.some((x) => x.toLowerCase() === t.toLowerCase()) ? prev : [...prev, t]));
  };
  const removeModalSpTipoTurno = (tipo: string) => setModalSpTiposTurnoSelected((prev) => prev.filter((x) => x !== tipo));

  const pickListVvResponsable = (e: EmpleadoLite) => {
    setListVvResponsableSelected((prev) => (prev.some((x) => x.id === e.id) ? prev : [...prev, e]));
    setListVvResponsableResults([]);
    setListVvResponsableSearch('');
  };
  const removeListVvResponsable = (id: number) => setListVvResponsableSelected((prev) => prev.filter((x) => x.id !== id));
  const addListVvTipo = () => {
    const t = listVvTipoPick.trim();
    if (!t) return;
    setListVvTiposSelected((prev) => (prev.some((x) => x.toLowerCase() === t.toLowerCase()) ? prev : [...prev, t]));
  };
  const removeListVvTipo = (tipo: string) => setListVvTiposSelected((prev) => prev.filter((x) => x !== tipo));
  const addListVvPlaca = () => {
    const p = listVvPlacaInput.trim();
    if (!p) return;
    setListVvPlacasSelected((prev) => (prev.some((x) => x.toLowerCase() === p.toLowerCase()) ? prev : [...prev, p]));
    setListVvPlacaInput('');
  };
  const removeListVvPlaca = (placa: string) => setListVvPlacasSelected((prev) => prev.filter((x) => x !== placa));
  const pickModalVvResponsable = (e: EmpleadoLite) => {
    setModalVvResponsableSelected((prev) => (prev.some((x) => x.id === e.id) ? prev : [...prev, e]));
    setModalVvResponsableResults([]);
    setModalVvResponsableSearch('');
  };
  const removeModalVvResponsable = (id: number) => setModalVvResponsableSelected((prev) => prev.filter((x) => x.id !== id));
  const addModalVvTipo = () => {
    const t = modalVvTipoPick.trim();
    if (!t) return;
    setModalVvTiposSelected((prev) => (prev.some((x) => x.toLowerCase() === t.toLowerCase()) ? prev : [...prev, t]));
  };
  const removeModalVvTipo = (tipo: string) => setModalVvTiposSelected((prev) => prev.filter((x) => x !== tipo));
  const addModalVvPlaca = () => {
    const p = modalVvPlacaInput.trim();
    if (!p) return;
    setModalVvPlacasSelected((prev) => (prev.some((x) => x.toLowerCase() === p.toLowerCase()) ? prev : [...prev, p]));
    setModalVvPlacaInput('');
  };
  const removeModalVvPlaca = (placa: string) => setModalVvPlacasSelected((prev) => prev.filter((x) => x !== placa));

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
      } else if (modulo === MODULO_VISITAS_VEHICULOS) {
        if (listActaDesdeD && listActaDesdeT) q.listVvCreadoDesde = combineDateAndTime(ymd(listActaDesdeD), hm(listActaDesdeT));
        if (listActaHastaD && listActaHastaT) q.listVvCreadoHasta = combineDateAndTime(ymd(listActaHastaD), hm(listActaHastaT));
        if (listEmpresaSelected.length) q.listVvEmpresaIds = listEmpresaSelected.map((x) => String(x.id)).join(',');
        if (listClienteSelected.length) q.listVvClienteIds = listClienteSelected.map((x) => String(x.id)).join(',');
        if (listDivisionSelected.length) q.listVvDivisionIds = listDivisionSelected.map((x) => String(x.id)).join(',');
        if (listContratoSelected.length) q.listVvContratoIds = listContratoSelected.map((x) => String(x.id)).join(',');
        if (listCorpoSelected.length) q.listVvCorpoIds = listCorpoSelected.map((x) => String(x.id)).join(',');
        if (listPuestoSelected.length) q.listVvPuestoIds = listPuestoSelected.map((x) => String(x.id)).join(',');
        if (listVvResponsableSelected.length)
          q.listVvResponsableIds = listVvResponsableSelected.map((x) => String(x.id)).join(',');
        if (listVvCedulaVisitante.trim()) q.listVvCedulaVisitante = listVvCedulaVisitante.trim();
        if (listVvTiposSelected.length) q.listVvTiposVehiculo = listVvTiposSelected.join(',');
        if (listVvPlacasSelected.length) q.listVvPlacas = listVvPlacasSelected.join(',');
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
      } else if (modulo === MODULO_NOTAS_VOZ) {
        if (listActaDesdeD && listActaDesdeT) q.listNvCreadoDesde = combineDateAndTime(ymd(listActaDesdeD), hm(listActaDesdeT));
        if (listActaHastaD && listActaHastaT) q.listNvCreadoHasta = combineDateAndTime(ymd(listActaHastaD), hm(listActaHastaT));
        if (listEmpresaSelected.length) q.listNvEmpresaIds = listEmpresaSelected.map((x) => String(x.id)).join(',');
        if (listClienteSelected.length) q.listNvClienteIds = listClienteSelected.map((x) => String(x.id)).join(',');
        if (listDivisionSelected.length) q.listNvDivisionIds = listDivisionSelected.map((x) => String(x.id)).join(',');
        if (listContratoSelected.length) q.listNvContratoIds = listContratoSelected.map((x) => String(x.id)).join(',');
        if (listCorpoSelected.length) q.listNvCorpoIds = listCorpoSelected.map((x) => String(x.id)).join(',');
        if (listPuestoSelected.length) q.listNvPuestoIds = listPuestoSelected.map((x) => String(x.id)).join(',');
      } else if (modulo === MODULO_CAMBIOS_UBICACION_PUESTO) {
        if (listActaDesdeD && listActaDesdeT) q.listCupCreadoDesde = combineDateAndTime(ymd(listActaDesdeD), hm(listActaDesdeT));
        if (listActaHastaD && listActaHastaT) q.listCupCreadoHasta = combineDateAndTime(ymd(listActaHastaD), hm(listActaHastaT));
        if (listEmpresaSelected.length) q.listCupEmpresaIds = listEmpresaSelected.map((x) => String(x.id)).join(',');
        if (listClienteSelected.length) q.listCupClienteIds = listClienteSelected.map((x) => String(x.id)).join(',');
        if (listDivisionSelected.length) q.listCupDivisionIds = listDivisionSelected.map((x) => String(x.id)).join(',');
        if (listContratoSelected.length) q.listCupContratoIds = listContratoSelected.map((x) => String(x.id)).join(',');
        if (listCorpoSelected.length) q.listCupCorpoIds = listCorpoSelected.map((x) => String(x.id)).join(',');
        if (listPuestoSelected.length) q.listCupPuestoIds = listPuestoSelected.map((x) => String(x.id)).join(',');
        if (listCupResponsableSelected.length) q.listCupResponsableIds = listCupResponsableSelected.map((x) => String(x.id)).join(',');
      } else if (modulo === MODULO_REGISTRO_CAPACITACIONES) {
        if (listActaDesdeD && listActaDesdeT) q.listRcCreadoDesde = combineDateAndTime(ymd(listActaDesdeD), hm(listActaDesdeT));
        if (listActaHastaD && listActaHastaT) q.listRcCreadoHasta = combineDateAndTime(ymd(listActaHastaD), hm(listActaHastaT));
        if (listEmpresaSelected.length) q.listRcEmpresaIds = listEmpresaSelected.map((x) => String(x.id)).join(',');
        if (listClienteSelected.length) q.listRcClienteIds = listClienteSelected.map((x) => String(x.id)).join(',');
        if (listDivisionSelected.length) q.listRcDivisionIds = listDivisionSelected.map((x) => String(x.id)).join(',');
        if (listContratoSelected.length) q.listRcContratoIds = listContratoSelected.map((x) => String(x.id)).join(',');
        if (listCorpoSelected.length) q.listRcCorpoIds = listCorpoSelected.map((x) => String(x.id)).join(',');
        if (listPuestoSelected.length) q.listRcPuestoIds = listPuestoSelected.map((x) => String(x.id)).join(',');
        if (listRcTipoCapacitacion !== 'todos') q.listRcTipoCapacitacion = listRcTipoCapacitacion;
        if (listRcCapEmpSelected.length) q.listRcCapacitacionEmpleadoIds = listRcCapEmpSelected.map((x) => String(x.id)).join(',');
        if (listRcCapPuestoSelected.length) q.listRcCapacitacionPuestoIds = listRcCapPuestoSelected.map((x) => String(x.id)).join(',');
        if (listRcResponsableSelected.length) q.listRcResponsableIds = listRcResponsableSelected.map((x) => String(x.id)).join(',');
      } else if (modulo === MODULO_REGISTRO_INDUCCION_GENERAL) {
        if (listActaDesdeD && listActaDesdeT) q.listRigCreadoDesde = combineDateAndTime(ymd(listActaDesdeD), hm(listActaDesdeT));
        if (listActaHastaD && listActaHastaT) q.listRigCreadoHasta = combineDateAndTime(ymd(listActaHastaD), hm(listActaHastaT));
        if (listEmpresaSelected.length) q.listRigEmpresaIds = listEmpresaSelected.map((x) => String(x.id)).join(',');
        if (listClienteSelected.length) q.listRigClienteIds = listClienteSelected.map((x) => String(x.id)).join(',');
        if (listDivisionSelected.length) q.listRigDivisionIds = listDivisionSelected.map((x) => String(x.id)).join(',');
        if (listContratoSelected.length) q.listRigContratoIds = listContratoSelected.map((x) => String(x.id)).join(',');
        if (listCorpoSelected.length) q.listRigCorpoIds = listCorpoSelected.map((x) => String(x.id)).join(',');
        if (listPuestoSelected.length) q.listRigPuestoIds = listPuestoSelected.map((x) => String(x.id)).join(',');
        if (listRigColaboradorCedulas.length) q.listRigColaboradorCedulas = listRigColaboradorCedulas.join(',');
        if (listRigCapacitadorCedulas.length) q.listRigCapacitadorCedulas = listRigCapacitadorCedulas.join(',');
      } else if (modulo === MODULO_TIEMPO_ALMUERZO) {
        if (listActaDesdeD && listActaDesdeT) q.listTaInicioDesde = combineDateAndTime(ymd(listActaDesdeD), hm(listActaDesdeT));
        if (listActaHastaD && listActaHastaT) q.listTaFinHasta = combineDateAndTime(ymd(listActaHastaD), hm(listActaHastaT));
        if (listEmpresaSelected.length) q.listTaEmpresaIds = listEmpresaSelected.map((x) => String(x.id)).join(',');
        if (listClienteSelected.length) q.listTaClienteIds = listClienteSelected.map((x) => String(x.id)).join(',');
        if (listDivisionSelected.length) q.listTaDivisionIds = listDivisionSelected.map((x) => String(x.id)).join(',');
        if (listContratoSelected.length) q.listTaContratoIds = listContratoSelected.map((x) => String(x.id)).join(',');
        if (listCorpoSelected.length) q.listTaCorpoIds = listCorpoSelected.map((x) => String(x.id)).join(',');
        if (listPuestoSelected.length) q.listTaPuestoIds = listPuestoSelected.map((x) => String(x.id)).join(',');
        if (listTaEmpleadoSelected.length) q.listTaEmpleadoIds = listTaEmpleadoSelected.map((x) => String(x.id)).join(',');
        if (listTaCedulasSelected.length) q.listTaCedulas = listTaCedulasSelected.join(',');
      } else if (modulo === MODULO_SOLICITUDES_PERMISO) {
        if (listActaDesdeD && listActaDesdeT) q.listSpCreadoDesde = combineDateAndTime(ymd(listActaDesdeD), hm(listActaDesdeT));
        if (listActaHastaD && listActaHastaT) q.listSpCreadoHasta = combineDateAndTime(ymd(listActaHastaD), hm(listActaHastaT));
        if (listEmpresaSelected.length) q.listSpEmpresaIds = listEmpresaSelected.map((x) => String(x.id)).join(',');
        if (listClienteSelected.length) q.listSpClienteIds = listClienteSelected.map((x) => String(x.id)).join(',');
        if (listDivisionSelected.length) q.listSpDivisionIds = listDivisionSelected.map((x) => String(x.id)).join(',');
        if (listContratoSelected.length) q.listSpContratoIds = listContratoSelected.map((x) => String(x.id)).join(',');
        if (listCorpoSelected.length) q.listSpCorpoIds = listCorpoSelected.map((x) => String(x.id)).join(',');
        if (listPuestoSelected.length) q.listSpPuestoIds = listPuestoSelected.map((x) => String(x.id)).join(',');
        if (listSpEmpleadoSelected.length) q.listSpEmpleadoIds = listSpEmpleadoSelected.map((x) => String(x.id)).join(',');
        if (listEjecutivoSelected.length) q.listSpEjecutivoIds = listEjecutivoSelected.map((x) => String(x.id)).join(',');
        if (listSpTiposTurnoSelected.length) q.listSpTiposTurno = listSpTiposTurnoSelected.join(',');
        if (listSpTipoSalario !== 'todos') q.listSpTipoSalario = listSpTipoSalario;
        if (listSpEstado !== 'todos') q.listSpEstado = listSpEstado;
      } else if (modulo === MODULO_MANUALES_PUESTO) {
        if (listActaDesdeD && listActaDesdeT) q.listMpCreadoDesde = combineDateAndTime(ymd(listActaDesdeD), hm(listActaDesdeT));
        if (listActaHastaD && listActaHastaT) q.listMpCreadoHasta = combineDateAndTime(ymd(listActaHastaD), hm(listActaHastaT));
        if (listEmpresaSelected.length) q.listMpEmpresaIds = listEmpresaSelected.map((x) => String(x.id)).join(',');
        if (listClienteSelected.length) q.listMpClienteIds = listClienteSelected.map((x) => String(x.id)).join(',');
        if (listDivisionSelected.length) q.listMpDivisionIds = listDivisionSelected.map((x) => String(x.id)).join(',');
        if (listContratoSelected.length) q.listMpContratoIds = listContratoSelected.map((x) => String(x.id)).join(',');
        if (listCorpoSelected.length) q.listMpCorpoIds = listCorpoSelected.map((x) => String(x.id)).join(',');
        if (listPuestoSelected.length) q.listMpPuestoIds = listPuestoSelected.map((x) => String(x.id)).join(',');
      } else if (modulo === MODULO_ARTICULOS_PUESTO) {
        if (listEmpresaSelected.length) q.listApEmpresaIds = listEmpresaSelected.map((x) => String(x.id)).join(',');
        if (listClienteSelected.length) q.listApClienteIds = listClienteSelected.map((x) => String(x.id)).join(',');
        if (listDivisionSelected.length) q.listApDivisionIds = listDivisionSelected.map((x) => String(x.id)).join(',');
        if (listContratoSelected.length) q.listApContratoIds = listContratoSelected.map((x) => String(x.id)).join(',');
        if (listCorpoSelected.length) q.listApCorpoIds = listCorpoSelected.map((x) => String(x.id)).join(',');
        if (listPuestoSelected.length) q.listApPuestoIds = listPuestoSelected.map((x) => String(x.id)).join(',');
      } else if (modulo === MODULO_MANTENIMIENTO_ARTICULOS) {
        if (listActaDesdeD && listActaDesdeT) q.listMaCreadoDesde = combineDateAndTime(ymd(listActaDesdeD), hm(listActaDesdeT));
        if (listActaHastaD && listActaHastaT) q.listMaCreadoHasta = combineDateAndTime(ymd(listActaHastaD), hm(listActaHastaT));
        if (listMaSolDesdeD && listMaSolDesdeT) q.listMaSolucionadoDesde = combineDateAndTime(ymd(listMaSolDesdeD), hm(listMaSolDesdeT));
        if (listMaSolHastaD && listMaSolHastaT) q.listMaSolucionadoHasta = combineDateAndTime(ymd(listMaSolHastaD), hm(listMaSolHastaT));
        if (listEmpresaSelected.length) q.listMaEmpresaIds = listEmpresaSelected.map((x) => String(x.id)).join(',');
        if (listClienteSelected.length) q.listMaClienteIds = listClienteSelected.map((x) => String(x.id)).join(',');
        if (listDivisionSelected.length) q.listMaDivisionIds = listDivisionSelected.map((x) => String(x.id)).join(',');
        if (listContratoSelected.length) q.listMaContratoIds = listContratoSelected.map((x) => String(x.id)).join(',');
        if (listCorpoSelected.length) q.listMaCorpoIds = listCorpoSelected.map((x) => String(x.id)).join(',');
        if (listPuestoSelected.length) q.listMaPuestoIds = listPuestoSelected.map((x) => String(x.id)).join(',');
        if (listMaEstadosSelected.length) q.listMaEstados = listMaEstadosSelected.join(',');
        if (listMaAccionesSelected.length) q.listMaAcciones = listMaAccionesSelected.join(',');
      } else if (modulo === MODULO_REGISTRO_VEHICULOS_CORPORATIVOS) {
        if (listActaDesdeD && listActaDesdeT) q.listRvcCreadoDesde = combineDateAndTime(ymd(listActaDesdeD), hm(listActaDesdeT));
        if (listActaHastaD && listActaHastaT) q.listRvcCreadoHasta = combineDateAndTime(ymd(listActaHastaD), hm(listActaHastaT));
        if (listEmpresaSelected.length) q.listRvcEmpresaIds = listEmpresaSelected.map((x) => String(x.id)).join(',');
        if (listClienteSelected.length) q.listRvcClienteIds = listClienteSelected.map((x) => String(x.id)).join(',');
        if (listDivisionSelected.length) q.listRvcDivisionIds = listDivisionSelected.map((x) => String(x.id)).join(',');
        if (listContratoSelected.length) q.listRvcContratoIds = listContratoSelected.map((x) => String(x.id)).join(',');
        if (listCorpoSelected.length) q.listRvcCorpoIds = listCorpoSelected.map((x) => String(x.id)).join(',');
        if (listPuestoSelected.length) q.listRvcPuestoIds = listPuestoSelected.map((x) => String(x.id)).join(',');
        if (listRvcTiposVehiculoSelected.length) q.listRvcTiposVehiculo = listRvcTiposVehiculoSelected.join(',');
        if (listRvcTiposAutoriaSelected.length) q.listRvcTiposAutoria = listRvcTiposAutoriaSelected.join(',');
        if (listRvcPlaca.trim()) q.listRvcPlaca = listRvcPlaca.trim();
        if (listRvcAnno.trim()) q.listRvcAnno = listRvcAnno.trim();
        if (listRvcModelo.trim()) q.listRvcModelo = listRvcModelo.trim();
      } else if (modulo === MODULO_REVISION_VEHICULOS) {
        if (listActaDesdeD && listActaDesdeT) q.listRevCreadoDesde = combineDateAndTime(ymd(listActaDesdeD), hm(listActaDesdeT));
        if (listActaHastaD && listActaHastaT) q.listRevCreadoHasta = combineDateAndTime(ymd(listActaHastaD), hm(listActaHastaT));
        if (listEmpresaSelected.length) q.listRevEmpresaIds = listEmpresaSelected.map((x) => String(x.id)).join(',');
        if (listClienteSelected.length) q.listRevClienteIds = listClienteSelected.map((x) => String(x.id)).join(',');
        if (listDivisionSelected.length) q.listRevDivisionIds = listDivisionSelected.map((x) => String(x.id)).join(',');
        if (listContratoSelected.length) q.listRevContratoIds = listContratoSelected.map((x) => String(x.id)).join(',');
        if (listCorpoSelected.length) q.listRevCorpoIds = listCorpoSelected.map((x) => String(x.id)).join(',');
        if (listPuestoSelected.length) q.listRevPuestoIds = listPuestoSelected.map((x) => String(x.id)).join(',');
        if (listRvdVehiculoSelected.length) q.listRevVehiculoIds = listRvdVehiculoSelected.map((x) => String(x.id)).join(',');
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
      } else if (formModulo === MODULO_ARTICULOS_PUESTO) {
        const mf: Record<string, unknown> = {
          empresaIds: modalEmpresaSelected.map((x) => x.id),
          clienteIds: modalClienteSelected.map((x) => x.id),
          divisionIds: modalDivisionSelected.map((x) => x.id),
          contratoIds: modalContratoSelected.map((x) => x.id),
          corpoIds: modalCorpoSelected.map((x) => x.id),
          puestoIds: modalPuestoSelected.map((x) => x.id),
        };
        res = await previewArticulosPuesto({
          moduleFilters: mf,
          order_by: formOrder,
          refreshAccessToken,
          logout,
        });
      } else if (formModulo === MODULO_MANTENIMIENTO_ARTICULOS) {
        if (!modalActaDesdeD || !modalActaDesdeT || !modalActaHastaD || !modalActaHastaT) {
          Alert.alert('Filtros', 'Complete fechas y horas desde/hasta.');
          return;
        }
        const mf: Record<string, unknown> = {
          creadoDesde: combineDateAndTime(ymd(modalActaDesdeD), hm(modalActaDesdeT)),
          creadoHasta: combineDateAndTime(ymd(modalActaHastaD), hm(modalActaHastaT)),
          empresaIds: modalEmpresaSelected.map((x) => x.id),
          clienteIds: modalClienteSelected.map((x) => x.id),
          divisionIds: modalDivisionSelected.map((x) => x.id),
          contratoIds: modalContratoSelected.map((x) => x.id),
          corpoIds: modalCorpoSelected.map((x) => x.id),
          puestoIds: modalPuestoSelected.map((x) => x.id),
        };
        if (modalMaEstadosSelected.length) mf.estados = [...modalMaEstadosSelected];
        if (modalMaAccionesSelected.length) mf.tiposAccion = [...modalMaAccionesSelected];
        if (modalMaSolDesdeD && modalMaSolDesdeT) {
          mf.solucionadoDesde = combineDateAndTime(ymd(modalMaSolDesdeD), hm(modalMaSolDesdeT));
        }
        if (modalMaSolHastaD && modalMaSolHastaT) {
          mf.solucionadoHasta = combineDateAndTime(ymd(modalMaSolHastaD), hm(modalMaSolHastaT));
        }
        res = await previewMantenimientoArticulos({
          moduleFilters: mf,
          order_by: formOrder,
          refreshAccessToken,
          logout,
        });
      } else if (formModulo === MODULO_REGISTRO_VEHICULOS_CORPORATIVOS) {
        if (!modalActaDesdeD || !modalActaDesdeT || !modalActaHastaD || !modalActaHastaT) {
          Alert.alert('Filtros', 'Complete fechas y horas desde/hasta.');
          return;
        }
        const mf: Record<string, unknown> = {
          creadoDesde: combineDateAndTime(ymd(modalActaDesdeD), hm(modalActaDesdeT)),
          creadoHasta: combineDateAndTime(ymd(modalActaHastaD), hm(modalActaHastaT)),
          empresaIds: modalEmpresaSelected.map((x) => x.id),
          clienteIds: modalClienteSelected.map((x) => x.id),
          divisionIds: modalDivisionSelected.map((x) => x.id),
          contratoIds: modalContratoSelected.map((x) => x.id),
          corpoIds: modalCorpoSelected.map((x) => x.id),
          puestoIds: modalPuestoSelected.map((x) => x.id),
        };
        if (modalRvcTiposVehiculoSelected.length) mf.tiposVehiculo = [...modalRvcTiposVehiculoSelected];
        if (modalRvcTiposAutoriaSelected.length) mf.tiposAutoria = [...modalRvcTiposAutoriaSelected];
        if (modalRvcPlaca.trim()) mf.placaContains = modalRvcPlaca.trim();
        if (modalRvcAnno.trim()) mf.anno = Number(modalRvcAnno.trim());
        if (modalRvcModelo.trim()) mf.modeloContains = modalRvcModelo.trim();
        res = await previewRegistroVehiculosCorporativos({
          moduleFilters: mf,
          order_by: formOrder,
          refreshAccessToken,
          logout,
        });
      } else if (formModulo === MODULO_REVISION_VEHICULOS) {
        if (!modalActaDesdeD || !modalActaDesdeT || !modalActaHastaD || !modalActaHastaT) {
          Alert.alert('Filtros', 'Complete fechas y horas desde/hasta.');
          return;
        }
        const mfRev: Record<string, unknown> = {
          creadoDesde: combineDateAndTime(ymd(modalActaDesdeD), hm(modalActaDesdeT)),
          creadoHasta: combineDateAndTime(ymd(modalActaHastaD), hm(modalActaHastaT)),
          empresaIds: modalEmpresaSelected.map((x) => x.id),
          clienteIds: modalClienteSelected.map((x) => x.id),
          divisionIds: modalDivisionSelected.map((x) => x.id),
          contratoIds: modalContratoSelected.map((x) => x.id),
          corpoIds: modalCorpoSelected.map((x) => x.id),
          puestoIds: modalPuestoSelected.map((x) => x.id),
        };
        if (modalRvdVehiculoSelected.length) mfRev.vehiculoIds = modalRvdVehiculoSelected.map((x) => x.id);
        res = await previewRevisionVehiculos({
          moduleFilters: mfRev,
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
      formModulo === MODULO_VISITAS_VEHICULOS ||
        formModulo === MODULO_MUTUOS_ACUERDOS ||
        formModulo === MODULO_EVALUACION_PERSONAL ||
        formModulo === MODULO_PRODUCTO_NO_CONFORME ||
        formModulo === MODULO_REGISTRO_INDUCCION_RECORRIDO ||
        formModulo === MODULO_REGISTRO_INDUCCION_GENERAL ||
        formModulo === MODULO_NOTAS_VOZ ||
        formModulo === MODULO_CAMBIOS_UBICACION_PUESTO ||
        formModulo === MODULO_REGISTRO_CAPACITACIONES ||
        formModulo === MODULO_TIEMPO_ALMUERZO ||
        formModulo === MODULO_SOLICITUDES_PERMISO ||
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
            : formModulo === MODULO_TIEMPO_ALMUERZO
              ? {
                  inicioDesde: combineDateAndTime(ymd(modalActaDesdeD), hm(modalActaDesdeT)),
                  finHasta: combineDateAndTime(ymd(modalActaHastaD), hm(modalActaHastaT)),
                  empresaIds: modalEmpresaSelected.map((x) => x.id),
                  clienteIds: modalClienteSelected.map((x) => x.id),
                  divisionIds: modalDivisionSelected.map((x) => x.id),
                  contratoIds: modalContratoSelected.map((x) => x.id),
                  corpoIds: modalCorpoSelected.map((x) => x.id),
                  puestoIds: modalPuestoSelected.map((x) => x.id),
                  empleadoIds: modalTaEmpleadoSelected.map((x) => x.id),
                  cedulas: [...modalTaCedulasSelected],
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
        if (formModulo === MODULO_VISITAS_VEHICULOS) {
          if (modalVvCedulaVisitante.trim() !== '') mf.cedulaVisitante = modalVvCedulaVisitante.trim();
          if (modalVvTiposSelected.length) mf.tiposVehiculo = [...modalVvTiposSelected];
          if (modalVvPlacasSelected.length) mf.placas = [...modalVvPlacasSelected];
          if (modalVvResponsableSelected.length > 0) mf.responsableIds = modalVvResponsableSelected.map((e) => Number(e.id));
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
        if (formModulo === MODULO_REGISTRO_INDUCCION_GENERAL) {
          if (modalRigColaboradorCedulas.length > 0) mf.colaboradorCedulas = [...modalRigColaboradorCedulas];
          if (modalRigCapacitadorCedulas.length > 0) mf.capacitadorCedulas = [...modalRigCapacitadorCedulas];
        }
        if (formModulo === MODULO_TIEMPO_ALMUERZO) {
          if (modalTaEmpleadoSelected.length > 0) mf.empleadoIds = modalTaEmpleadoSelected.map((e) => Number(e.id));
          if (modalTaCedulasSelected.length > 0) mf.cedulas = [...modalTaCedulasSelected];
        }
        if (formModulo === MODULO_SOLICITUDES_PERMISO) {
          if (modalSpEmpleadoSelected.length) mf.empleadoIds = modalSpEmpleadoSelected.map((e) => Number(e.id));
          if (modalEjecutivoSelected.length) mf.ejecutivoCuentaIds = modalEjecutivoSelected.map((x) => x.id);
          if (modalSpTiposTurnoSelected.length) mf.tiposTurno = [...modalSpTiposTurnoSelected];
          if (modalSpTipoSalario !== 'todos') mf.tipoSalario = modalSpTipoSalario;
          if (modalSpEstado !== 'todos') mf.estado = modalSpEstado;
        }
        if (formModulo === MODULO_CAMBIOS_UBICACION_PUESTO && modalCupResponsableSelected.length > 0) {
          mf.responsableIds = modalCupResponsableSelected.map((e) => Number(e.id));
        }
        if (formModulo === MODULO_REGISTRO_CAPACITACIONES) {
          if (modalRcTipoCapacitacion !== 'todos') mf.tipoCapacitacion = modalRcTipoCapacitacion;
          if (modalRcCapEmpSelected.length > 0) mf.capacitacionEmpleadoIds = modalRcCapEmpSelected.map((e) => Number(e.id));
          if (modalRcCapPuestoSelected.length > 0) mf.capacitacionPuestoIds = modalRcCapPuestoSelected.map((x) => x.id);
          if (modalRcResponsableSelected.length > 0) mf.responsableIds = modalRcResponsableSelected.map((e) => Number(e.id));
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
        } else if (formModulo === MODULO_VISITAS_VEHICULOS) {
          res = await previewVisitasVehiculos({
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
        } else if (formModulo === MODULO_NOTAS_VOZ) {
          res = await previewNotasVoz({
            moduleFilters: mf,
            order_by: formOrder,
            refreshAccessToken,
            logout,
          });
        } else if (formModulo === MODULO_CAMBIOS_UBICACION_PUESTO) {
          res = await previewCambiosUbicacionPuesto({
            moduleFilters: mf,
            order_by: formOrder,
            refreshAccessToken,
            logout,
          });
        } else if (formModulo === MODULO_REGISTRO_CAPACITACIONES) {
          res = await previewRegistroCapacitaciones({
            moduleFilters: mf,
            order_by: formOrder,
            refreshAccessToken,
            logout,
          });
        } else if (formModulo === MODULO_REGISTRO_INDUCCION_GENERAL) {
          res = await previewRegistroInduccionGeneral({
            moduleFilters: mf,
            order_by: formOrder,
            refreshAccessToken,
            logout,
          });
        } else if (formModulo === MODULO_TIEMPO_ALMUERZO) {
          res = await previewTiempoAlmuerzo({
            moduleFilters: mf,
            order_by: formOrder,
            refreshAccessToken,
            logout,
          });
        } else if (formModulo === MODULO_SOLICITUDES_PERMISO) {
          res = await previewSolicitudesPermiso({
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
      } else if (formModulo === MODULO_ARTICULOS_PUESTO) {
        moduleFilters.empresaIds = modalEmpresaSelected.map((x) => x.id);
        moduleFilters.clienteIds = modalClienteSelected.map((x) => x.id);
        moduleFilters.divisionIds = modalDivisionSelected.map((x) => x.id);
        moduleFilters.contratoIds = modalContratoSelected.map((x) => x.id);
        moduleFilters.corpoIds = modalCorpoSelected.map((x) => x.id);
        moduleFilters.puestoIds = modalPuestoSelected.map((x) => x.id);
      } else if (formModulo === MODULO_MANTENIMIENTO_ARTICULOS) {
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
        if (modalMaEstadosSelected.length) moduleFilters.estados = [...modalMaEstadosSelected];
        if (modalMaAccionesSelected.length) moduleFilters.tiposAccion = [...modalMaAccionesSelected];
        if (modalMaSolDesdeD && modalMaSolDesdeT) {
          moduleFilters.solucionadoDesde = combineDateAndTime(ymd(modalMaSolDesdeD), hm(modalMaSolDesdeT));
        }
        if (modalMaSolHastaD && modalMaSolHastaT) {
          moduleFilters.solucionadoHasta = combineDateAndTime(ymd(modalMaSolHastaD), hm(modalMaSolHastaT));
        }
      } else if (formModulo === MODULO_REGISTRO_VEHICULOS_CORPORATIVOS) {
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
        if (modalRvcTiposVehiculoSelected.length) moduleFilters.tiposVehiculo = [...modalRvcTiposVehiculoSelected];
        if (modalRvcTiposAutoriaSelected.length) moduleFilters.tiposAutoria = [...modalRvcTiposAutoriaSelected];
        if (modalRvcPlaca.trim()) moduleFilters.placaContains = modalRvcPlaca.trim();
        if (modalRvcAnno.trim()) moduleFilters.anno = Number(modalRvcAnno.trim());
        if (modalRvcModelo.trim()) moduleFilters.modeloContains = modalRvcModelo.trim();
      } else if (formModulo === MODULO_REVISION_VEHICULOS) {
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
        if (modalRvdVehiculoSelected.length) moduleFilters.vehiculoIds = modalRvdVehiculoSelected.map((x) => x.id);
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
      formModulo === MODULO_VISITAS_VEHICULOS ||
        formModulo === MODULO_MUTUOS_ACUERDOS ||
        formModulo === MODULO_EVALUACION_PERSONAL ||
        formModulo === MODULO_PRODUCTO_NO_CONFORME ||
        formModulo === MODULO_REGISTRO_INDUCCION_RECORRIDO ||
        formModulo === MODULO_REGISTRO_INDUCCION_GENERAL ||
        formModulo === MODULO_NOTAS_VOZ ||
        formModulo === MODULO_CAMBIOS_UBICACION_PUESTO ||
        formModulo === MODULO_REGISTRO_CAPACITACIONES ||
        formModulo === MODULO_TIEMPO_ALMUERZO ||
        formModulo === MODULO_SOLICITUDES_PERMISO ||
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
        if (formModulo === MODULO_TIEMPO_ALMUERZO) {
          moduleFilters.inicioDesde = moduleFilters.creadoDesde;
          moduleFilters.finHasta = moduleFilters.creadoHasta;
          delete moduleFilters.creadoDesde;
          delete moduleFilters.creadoHasta;
          if (modalTaEmpleadoSelected.length > 0) moduleFilters.empleadoIds = modalTaEmpleadoSelected.map((e) => Number(e.id));
          if (modalTaCedulasSelected.length > 0) moduleFilters.cedulas = [...modalTaCedulasSelected];
        }
        if (formModulo === MODULO_SOLICITUDES_PERMISO) {
          if (modalSpEmpleadoSelected.length) moduleFilters.empleadoIds = modalSpEmpleadoSelected.map((e) => Number(e.id));
          if (modalEjecutivoSelected.length) moduleFilters.ejecutivoCuentaIds = modalEjecutivoSelected.map((x) => x.id);
          if (modalSpTiposTurnoSelected.length) moduleFilters.tiposTurno = [...modalSpTiposTurnoSelected];
          if (modalSpTipoSalario !== 'todos') moduleFilters.tipoSalario = modalSpTipoSalario;
          if (modalSpEstado !== 'todos') moduleFilters.estado = modalSpEstado;
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
        if (formModulo === MODULO_VISITAS_VEHICULOS) {
          if (modalVvCedulaVisitante.trim() !== '') moduleFilters.cedulaVisitante = modalVvCedulaVisitante.trim();
          if (modalVvTiposSelected.length) moduleFilters.tiposVehiculo = [...modalVvTiposSelected];
          if (modalVvPlacasSelected.length) moduleFilters.placas = [...modalVvPlacasSelected];
          if (modalVvResponsableSelected.length > 0) moduleFilters.responsableIds = modalVvResponsableSelected.map((e) => Number(e.id));
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
        if (formModulo === MODULO_REGISTRO_INDUCCION_GENERAL) {
          if (modalRigColaboradorCedulas.length > 0) moduleFilters.colaboradorCedulas = [...modalRigColaboradorCedulas];
          if (modalRigCapacitadorCedulas.length > 0) moduleFilters.capacitadorCedulas = [...modalRigCapacitadorCedulas];
          moduleFilters.reportOutputType = formTipoReporteRef.current;
        }
        if (formModulo === MODULO_CAMBIOS_UBICACION_PUESTO && modalCupResponsableSelected.length > 0) {
          moduleFilters.responsableIds = modalCupResponsableSelected.map((e) => Number(e.id));
        }
        if (formModulo === MODULO_REGISTRO_CAPACITACIONES) {
          if (modalRcTipoCapacitacion !== 'todos') moduleFilters.tipoCapacitacion = modalRcTipoCapacitacion;
          if (modalRcCapEmpSelected.length > 0) moduleFilters.capacitacionEmpleadoIds = modalRcCapEmpSelected.map((e) => Number(e.id));
          if (modalRcCapPuestoSelected.length > 0) moduleFilters.capacitacionPuestoIds = modalRcCapPuestoSelected.map((x) => x.id);
          if (modalRcResponsableSelected.length > 0) moduleFilters.responsableIds = modalRcResponsableSelected.map((e) => Number(e.id));
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

      const tipoReporte = resolveTipoReporteForCreate(formModulo, formTipoReporteRef.current);

      const res = await createReportJob({
        body: {
          nombre: formNombre.trim(),
          numero: formNumero.trim(),
          nomenclatura: formNomenclatura.trim(),
          descripcion: formDescripcion.trim(),
          modulo: formModulo,
          tipo_reporte: tipoReporte,
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
      formModulo === MODULO_VISITAS_VEHICULOS ||
        formModulo === MODULO_MUTUOS_ACUERDOS ||
        formModulo === MODULO_EVALUACION_PERSONAL ||
        formModulo === MODULO_PRODUCTO_NO_CONFORME ||
        formModulo === MODULO_REGISTRO_INDUCCION_RECORRIDO ||
        formModulo === MODULO_REGISTRO_INDUCCION_GENERAL ||
        formModulo === MODULO_NOTAS_VOZ ||
        formModulo === MODULO_CAMBIOS_UBICACION_PUESTO ||
        formModulo === MODULO_REGISTRO_CAPACITACIONES ||
        formModulo === MODULO_TIEMPO_ALMUERZO ||
        formModulo === MODULO_SOLICITUDES_PERMISO ||
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
    const createdByLabel =
      item.created_by_nombre?.trim() ||
      (item.created_by > 0 ? `Empleado #${item.created_by}` : '-');
    const reportFields: { label: string; value: string }[] = [
      { label: 'Número', value: item.numero || '-' },
      { label: 'Nomenclatura', value: item.nomenclatura || '-' },
      { label: 'Descripción', value: item.descripcion?.trim() || '-' },
      { label: 'Módulo', value: formatModuloLabel(item.modulo) || '-' },
      { label: 'Tipo de reporte', value: formatTipoReporteDisplay(item.tipo_reporte) },
      { label: 'Estado', value: formatEstadoDisplay(item.estado) },
      { label: 'Creado por', value: createdByLabel },
      { label: 'Fecha de creación', value: formatReportCreatedAt(item.created_at) },
    ];
    return (
      <ThemedView style={styles.card}>
        <ThemedText style={styles.cardTitle}>{item.nombre}</ThemedText>

        {reportFields.map((field) => (
          <ThemedText key={field.label} style={styles.cardLine}>
            <ThemedText style={styles.cardLabel}>{field.label}: </ThemedText>
            <ThemedText style={styles.cardValue}>{field.value}</ThemedText>
          </ThemedText>
        ))}

        <TouchableOpacity style={styles.collapseButton} onPress={() => toggleExpand(item.id)} activeOpacity={0.85}>
          <ThemedText style={styles.collapseButtonText}>
            {open ? 'Ocultar filtros' : 'Ver filtros'}
          </ThemedText>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color="#007AFF" />
        </TouchableOpacity>

        {open ? (
          <ThemedView style={styles.collapsableContent}>
            {Object.entries(filtersPretty).map(([k, v]) => (
              <ThemedText key={k} style={styles.detailText}>
                {k}: {typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v)}
              </ThemedText>
            ))}
          </ThemedView>
        ) : null}

        {item.estado === 'completado' ? (
          <TouchableOpacity
            style={[styles.downloadBtn, styles.downloadBtnCard]}
            onPress={() => void openDownload(item)}
            activeOpacity={0.85}
          >
            <Ionicons name="download-outline" size={20} color="#fff" />
            <ThemedText style={styles.downloadBtnText}>Descargar archivo</ThemedText>
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
                modulo === MODULO_VISITAS_VEHICULOS ||
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
                modulo === MODULO_REGISTRO_INDUCCION_GENERAL ||
                modulo === MODULO_NOTAS_VOZ ||
                modulo === MODULO_CAMBIOS_UBICACION_PUESTO ||
                modulo === MODULO_REGISTRO_CAPACITACIONES ||
                modulo === MODULO_TIEMPO_ALMUERZO ||
                modulo === MODULO_SOLICITUDES_PERMISO ||
                modulo === MODULO_MANUALES_PUESTO ||
                modulo === MODULO_ARTICULOS_PUESTO ||
                modulo === MODULO_MANTENIMIENTO_ARTICULOS ||
                modulo === MODULO_REGISTRO_VEHICULOS_CORPORATIVOS ||
                modulo === MODULO_REVISION_VEHICULOS ? (
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
                                    : modulo === MODULO_VISITAS_VEHICULOS
                                      ? 'Filtros — Visitas de vehículos'
                                    : modulo === MODULO_MUTUOS_ACUERDOS
                                      ? 'Filtros — Mutuos acuerdos'
                                    : modulo === MODULO_EVALUACION_PERSONAL
                                      ? 'Filtros — Evaluación de personal'
                                    : modulo === MODULO_REGISTRO_INDUCCION_RECORRIDO
                                      ? 'Filtros — Registro de inducción y recorrido'
                                    : modulo === MODULO_REGISTRO_INDUCCION_GENERAL
                                      ? 'Filtros — Registro de inducción general'
                                    : modulo === MODULO_NOTAS_VOZ
                                      ? 'Filtros — Notas de voz'
                                    : modulo === MODULO_CAMBIOS_UBICACION_PUESTO
                                      ? 'Filtros — Cambios en ubicación del puesto'
                                    : modulo === MODULO_REGISTRO_CAPACITACIONES
                                      ? 'Filtros — Registro de capacitaciones'
                                    : modulo === MODULO_TIEMPO_ALMUERZO
                                      ? 'Filtros — Tiempo de almuerzo'
                                    : modulo === MODULO_SOLICITUDES_PERMISO
                                      ? 'Filtros — Solicitudes de permiso'
                                    : modulo === MODULO_MANUALES_PUESTO
                                      ? 'Filtros — Manuales de puesto'
                                    : modulo === MODULO_ARTICULOS_PUESTO
                                      ? 'Filtros — Artículos del puesto'
                                    : modulo === MODULO_MANTENIMIENTO_ARTICULOS
                                      ? 'Filtros — Mantenimiento de artículos'
                                    : modulo === MODULO_REGISTRO_VEHICULOS_CORPORATIVOS
                                      ? 'Filtros — Registro de vehículos'
                                    : modulo === MODULO_REVISION_VEHICULOS
                                      ? 'Filtros — Revisión de vehículos'
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
                    ) : modulo === MODULO_ARTICULOS_PUESTO ? null : (
                      <>
                        <ThemedText style={styles.label}>
                          {modulo === MODULO_TIEMPO_ALMUERZO ? 'Inicio desde (fecha y hora)' : 'Creado desde (fecha y hora)'}
                        </ThemedText>
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
                        <ThemedText style={styles.label}>
                          {modulo === MODULO_TIEMPO_ALMUERZO ? 'Fin hasta (fecha y hora)' : 'Creado hasta (fecha y hora)'}
                        </ThemedText>
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
                    {modulo === MODULO_MANTENIMIENTO_ARTICULOS ? (
                      <>
                        <ThemedText style={styles.label}>Estado</ThemedText>
                        <View style={styles.row}>
                          <View style={[styles.pickerWrapper, styles.inputFlex]}>
                            <Picker
                              selectedValue={listMaEstadoPick}
                              onValueChange={(v) => setListMaEstadoPick(String(v) as typeof listMaEstadoPick)}
                              style={styles.picker}
                            >
                              <Picker.Item label="Todos" value="todos" color="#000000" />
                              <Picker.Item label="Bueno" value="Bueno" color="#000000" />
                              <Picker.Item label="Malo" value="Malo" color="#000000" />
                              <Picker.Item label="No está" value="No está" color="#000000" />
                            </Picker>
                          </View>
                          <TouchableOpacity style={styles.searchIconBtn} onPress={addListMaEstado} activeOpacity={0.85}>
                            <Ionicons name="add" size={22} color="#fff" />
                          </TouchableOpacity>
                        </View>
                        <ThemedView style={styles.assignedList}>
                          {listMaEstadosSelected.length === 0 ? (
                            <ThemedText style={styles.helperText}>Opcional: uno o más estados.</ThemedText>
                          ) : (
                            listMaEstadosSelected.map((estado) => (
                              <ThemedView key={`list-ma-est-${estado}`} style={styles.assignedUserItem}>
                                <ThemedText style={styles.assignedUserTitle}>{estado}</ThemedText>
                                <TouchableOpacity style={styles.removeUserButton} onPress={() => removeListMaEstado(estado)}>
                                  <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                                </TouchableOpacity>
                              </ThemedView>
                            ))
                          )}
                        </ThemedView>
                        <ThemedText style={styles.label}>Tipo de acción</ThemedText>
                        <View style={styles.row}>
                          <View style={[styles.pickerWrapper, styles.inputFlex]}>
                            <Picker
                              selectedValue={listMaAccionPick}
                              onValueChange={(v) => setListMaAccionPick(String(v) as typeof listMaAccionPick)}
                              style={styles.picker}
                            >
                              <Picker.Item label="Todos" value="todos" color="#000000" />
                              <Picker.Item label="Reemplazar" value="Reemplazar" color="#000000" />
                              <Picker.Item label="Rellenar" value="Rellenar" color="#000000" />
                              <Picker.Item label="Reparar en puesto" value="Reparar en puesto" color="#000000" />
                              <Picker.Item label="Reparar en taller" value="Reparar en taller" color="#000000" />
                            </Picker>
                          </View>
                          <TouchableOpacity style={styles.searchIconBtn} onPress={addListMaAccion} activeOpacity={0.85}>
                            <Ionicons name="add" size={22} color="#fff" />
                          </TouchableOpacity>
                        </View>
                        <ThemedView style={styles.assignedList}>
                          {listMaAccionesSelected.length === 0 ? (
                            <ThemedText style={styles.helperText}>Opcional: uno o más tipos de acción.</ThemedText>
                          ) : (
                            listMaAccionesSelected.map((accion) => (
                              <ThemedView key={`list-ma-acc-${accion}`} style={styles.assignedUserItem}>
                                <ThemedText style={styles.assignedUserTitle}>{accion}</ThemedText>
                                <TouchableOpacity style={styles.removeUserButton} onPress={() => removeListMaAccion(accion)}>
                                  <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                                </TouchableOpacity>
                              </ThemedView>
                            ))
                          )}
                        </ThemedView>
                        <ThemedText style={styles.label}>Solucionado desde (fecha y hora)</ThemedText>
                        <View style={styles.dateRow}>
                          {Platform.OS === 'web' ? (
                            <>
                              <TextInput
                                style={[styles.input, styles.inputFlex, styles.epWebDtInput]}
                                value={listMaSolDesdeD ? ymd(listMaSolDesdeD) : ''}
                                onChangeText={(v) => setListMaSolDesdeD(ymdOkStr(v) ? parseYmdToLocalDate(v) : null)}
                                placeholder="AAAA-MM-DD"
                                placeholderTextColor="#999"
                                {...({ type: 'date' } as object)}
                              />
                              <TextInput
                                style={[styles.input, styles.inputFlex, styles.epWebDtInput]}
                                value={listMaSolDesdeT ? hm(listMaSolDesdeT) : ''}
                                onChangeText={(v) => setListMaSolDesdeT(hmOkStr(v) ? parseHmToLocalDate(v) : null)}
                                placeholder="HH:mm"
                                placeholderTextColor="#999"
                                {...({ type: 'time' } as object)}
                              />
                            </>
                          ) : (
                            <>
                              <TouchableOpacity style={styles.dateButtonHalf} onPress={() => setShowListMaSolDd(true)} activeOpacity={0.85}>
                                <ThemedText style={styles.dateButtonText}>{listMaSolDesdeD ? formatDateOnlyLabel(listMaSolDesdeD) : 'Fecha'}</ThemedText>
                                <Ionicons name="calendar-outline" size={18} color="#007AFF" />
                              </TouchableOpacity>
                              <TouchableOpacity style={styles.dateButtonHalf} onPress={() => setShowListMaSolDt(true)} activeOpacity={0.85}>
                                <ThemedText style={styles.dateButtonText}>{listMaSolDesdeT ? hm(listMaSolDesdeT) : 'Hora'}</ThemedText>
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
                                value={listMaSolHastaD ? ymd(listMaSolHastaD) : ''}
                                onChangeText={(v) => setListMaSolHastaD(ymdOkStr(v) ? parseYmdToLocalDate(v) : null)}
                                placeholder="AAAA-MM-DD"
                                placeholderTextColor="#999"
                                {...({ type: 'date' } as object)}
                              />
                              <TextInput
                                style={[styles.input, styles.inputFlex, styles.epWebDtInput]}
                                value={listMaSolHastaT ? hm(listMaSolHastaT) : ''}
                                onChangeText={(v) => setListMaSolHastaT(hmOkStr(v) ? parseHmToLocalDate(v) : null)}
                                placeholder="HH:mm"
                                placeholderTextColor="#999"
                                {...({ type: 'time' } as object)}
                              />
                            </>
                          ) : (
                            <>
                              <TouchableOpacity style={styles.dateButtonHalf} onPress={() => setShowListMaSolHd(true)} activeOpacity={0.85}>
                                <ThemedText style={styles.dateButtonText}>{listMaSolHastaD ? formatDateOnlyLabel(listMaSolHastaD) : 'Fecha'}</ThemedText>
                                <Ionicons name="calendar-outline" size={18} color="#007AFF" />
                              </TouchableOpacity>
                              <TouchableOpacity style={styles.dateButtonHalf} onPress={() => setShowListMaSolHt(true)} activeOpacity={0.85}>
                                <ThemedText style={styles.dateButtonText}>{listMaSolHastaT ? hm(listMaSolHastaT) : 'Hora'}</ThemedText>
                                <Ionicons name="time-outline" size={18} color="#007AFF" />
                              </TouchableOpacity>
                            </>
                          )}
                        </View>
                      </>
                    ) : null}
                    {modulo === MODULO_REGISTRO_VEHICULOS_CORPORATIVOS ? (
                      <>
                        <ThemedText style={styles.label}>Tipo de vehículo</ThemedText>
                        <View style={styles.row}>
                          <View style={[styles.pickerWrapper, styles.inputFlex]}>
                            <Picker
                              selectedValue={listRvcTipoVehiculoPick}
                              onValueChange={(v) => setListRvcTipoVehiculoPick(String(v) as typeof listRvcTipoVehiculoPick)}
                              style={styles.picker}
                            >
                              <Picker.Item label="Vehículo" value="Vehículo" color="#000000" />
                              <Picker.Item label="Motocicleta" value="Motocicleta" color="#000000" />
                              <Picker.Item label="Bicicleta" value="Bicicleta" color="#000000" />
                            </Picker>
                          </View>
                          <TouchableOpacity style={styles.searchIconBtn} onPress={addListRvcTipoVehiculo} activeOpacity={0.85}>
                            <Ionicons name="add" size={22} color="#fff" />
                          </TouchableOpacity>
                        </View>
                        <ThemedView style={styles.assignedList}>
                          {listRvcTiposVehiculoSelected.length === 0 ? (
                            <ThemedText style={styles.helperText}>Opcional: uno o más tipos de vehículo.</ThemedText>
                          ) : (
                            listRvcTiposVehiculoSelected.map((tipo) => (
                              <ThemedView key={`list-rvc-tv-${tipo}`} style={styles.assignedUserItem}>
                                <ThemedText style={styles.assignedUserTitle}>{tipo}</ThemedText>
                                <TouchableOpacity style={styles.removeUserButton} onPress={() => removeListRvcTipoVehiculo(tipo)}>
                                  <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                                </TouchableOpacity>
                              </ThemedView>
                            ))
                          )}
                        </ThemedView>
                        <ThemedText style={styles.label}>Placa</ThemedText>
                        <TextInput
                          style={styles.input}
                          value={listRvcPlaca}
                          onChangeText={setListRvcPlaca}
                          placeholder="Opcional"
                          placeholderTextColor="#999"
                          autoCapitalize="characters"
                        />
                        <ThemedText style={styles.label}>Año</ThemedText>
                        <TextInput
                          style={styles.input}
                          value={listRvcAnno}
                          onChangeText={setListRvcAnno}
                          placeholder="Opcional"
                          placeholderTextColor="#999"
                          keyboardType="number-pad"
                        />
                        <ThemedText style={styles.label}>Modelo</ThemedText>
                        <TextInput
                          style={styles.input}
                          value={listRvcModelo}
                          onChangeText={setListRvcModelo}
                          placeholder="Opcional"
                          placeholderTextColor="#999"
                        />
                        <ThemedText style={styles.label}>Tipo de autoría</ThemedText>
                        <View style={styles.row}>
                          <View style={[styles.pickerWrapper, styles.inputFlex]}>
                            <Picker
                              selectedValue={listRvcTipoAutoriaPick}
                              onValueChange={(v) => setListRvcTipoAutoriaPick(String(v) as typeof listRvcTipoAutoriaPick)}
                              style={styles.picker}
                            >
                              <Picker.Item label="Cliente" value="Cliente" color="#000000" />
                              <Picker.Item label="Corporativo" value="Corporativo" color="#000000" />
                            </Picker>
                          </View>
                          <TouchableOpacity style={styles.searchIconBtn} onPress={addListRvcTipoAutoria} activeOpacity={0.85}>
                            <Ionicons name="add" size={22} color="#fff" />
                          </TouchableOpacity>
                        </View>
                        <ThemedView style={styles.assignedList}>
                          {listRvcTiposAutoriaSelected.length === 0 ? (
                            <ThemedText style={styles.helperText}>Opcional: uno o más tipos de autoría.</ThemedText>
                          ) : (
                            listRvcTiposAutoriaSelected.map((tipo) => (
                              <ThemedView key={`list-rvc-ta-${tipo}`} style={styles.assignedUserItem}>
                                <ThemedText style={styles.assignedUserTitle}>{tipo}</ThemedText>
                                <TouchableOpacity style={styles.removeUserButton} onPress={() => removeListRvcTipoAutoria(tipo)}>
                                  <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                                </TouchableOpacity>
                              </ThemedView>
                            ))
                          )}
                        </ThemedView>
                      </>
                    ) : null}
                    {modulo === MODULO_REVISION_VEHICULOS ? (
                      <>
                        <ThemedText style={styles.label}>Vehículo</ThemedText>
                        <View style={styles.row}>
                          <TextInput
                            style={[styles.input, styles.inputFlex]}
                            value={listRvdVehiculoSearch}
                            onChangeText={setListRvdVehiculoSearch}
                            placeholder="Placa, marca o modelo"
                            placeholderTextColor="#999"
                            autoCapitalize="characters"
                          />
                          <TouchableOpacity
                            style={styles.searchIconBtn}
                            onPress={() => void runSearchCorporateVehicles(listRvdVehiculoSearch, 'listRvdVehiculo')}
                            activeOpacity={0.85}
                            disabled={employeeSearchMode === 'listRvdVehiculo'}
                          >
                            {employeeSearchMode === 'listRvdVehiculo' ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <Ionicons name="search" size={22} color="#fff" />
                            )}
                          </TouchableOpacity>
                        </View>
                        {listRvdVehiculoResults.length ? (
                          <ThemedView style={styles.resultList}>
                            {listRvdVehiculoResults.map((v) => (
                              <TouchableOpacity key={`list-rvd-v-${v.id}`} style={styles.resultItem} onPress={() => pickListRvdVehiculo(v)}>
                                <ThemedText>{formatVehiculoLite(v)}</ThemedText>
                              </TouchableOpacity>
                            ))}
                          </ThemedView>
                        ) : null}
                        <ThemedView style={styles.assignedList}>
                          {listRvdVehiculoSelected.length === 0 ? (
                            <ThemedText style={styles.helperText}>Opcional: uno o más vehículos.</ThemedText>
                          ) : (
                            listRvdVehiculoSelected.map((v) => (
                              <ThemedView key={`list-rvd-v-sel-${v.id}`} style={styles.assignedUserItem}>
                                <ThemedText style={styles.assignedUserTitle}>{formatVehiculoLite(v)}</ThemedText>
                                <TouchableOpacity style={styles.removeUserButton} onPress={() => removeListRvdVehiculo(v.id)}>
                                  <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                                </TouchableOpacity>
                              </ThemedView>
                            ))
                          )}
                        </ThemedView>
                      </>
                    ) : null}
                    {modulo === MODULO_CAMBIOS_UBICACION_PUESTO ? (
                      <>
                        <ThemedText style={styles.label}>Responsable (creador del registro)</ThemedText>
                        <View style={styles.row}>
                          <TextInput
                            style={[styles.input, styles.inputFlex]}
                            value={listCupResponsableSearch}
                            onChangeText={setListCupResponsableSearch}
                            placeholder="Código o nombre"
                            placeholderTextColor="#999"
                          />
                          <TouchableOpacity
                            style={styles.searchIconBtn}
                            onPress={() => void runSearchEmployees(listCupResponsableSearch, 'listCupResponsable')}
                            activeOpacity={0.85}
                            disabled={employeeSearchMode === 'listCupResponsable'}
                          >
                            {employeeSearchMode === 'listCupResponsable' ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <Ionicons name="search" size={22} color="#fff" />
                            )}
                          </TouchableOpacity>
                        </View>
                        {listCupResponsableResults.length ? (
                          <ThemedView style={styles.resultList}>
                            {listCupResponsableResults.map((e) => (
                              <TouchableOpacity key={`list-cup-r-${e.id}`} style={styles.resultItem} onPress={() => pickListCupResponsable(e)}>
                                <ThemedText>
                                  {e.codigo} — {formatEmpleadoNombre(e)}
                                </ThemedText>
                              </TouchableOpacity>
                            ))}
                          </ThemedView>
                        ) : null}
                        <ThemedView style={styles.assignedList}>
                          {listCupResponsableSelected.length === 0 ? (
                            <ThemedText style={styles.helperText}>Opcional: uno o más responsables.</ThemedText>
                          ) : (
                            listCupResponsableSelected.map((e) => (
                              <ThemedView key={`list-cup-r-sel-${e.id}`} style={styles.assignedUserItem}>
                                <ThemedText style={styles.assignedUserTitle}>
                                  {e.codigo} — {formatEmpleadoNombre(e)}
                                </ThemedText>
                                <TouchableOpacity style={styles.removeUserButton} onPress={() => removeListCupResponsable(e.id)}>
                                  <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                                </TouchableOpacity>
                              </ThemedView>
                            ))
                          )}
                        </ThemedView>
                      </>
                    ) : null}
                    {modulo === MODULO_REGISTRO_CAPACITACIONES ? (
                      <>
                        <ThemedText style={styles.label}>Tipo de capacitación</ThemedText>
                        <View style={styles.pickerWrapper}>
                          <Picker
                            selectedValue={listRcTipoCapacitacion}
                            onValueChange={(v) => setListRcTipoCapacitacion(String(v) as 'todos' | 'Presencial' | 'Virtual')}
                            style={styles.picker}
                          >
                            <Picker.Item label="Todos" value="todos" color="#000000" />
                            <Picker.Item label="Presencial" value="Presencial" color="#000000" />
                            <Picker.Item label="Virtual" value="Virtual" color="#000000" />
                          </Picker>
                        </View>
                        <ThemedText style={styles.label}>Empleados de la capacitación</ThemedText>
                        <View style={styles.row}>
                          <TextInput
                            style={[styles.input, styles.inputFlex]}
                            value={listRcCapEmpSearch}
                            onChangeText={setListRcCapEmpSearch}
                            placeholder="Código o nombre"
                            placeholderTextColor="#999"
                          />
                          <TouchableOpacity
                            style={styles.searchIconBtn}
                            onPress={() => void runSearchEmployees(listRcCapEmpSearch, 'listRcCapEmpleado')}
                            activeOpacity={0.85}
                            disabled={employeeSearchMode === 'listRcCapEmpleado'}
                          >
                            {employeeSearchMode === 'listRcCapEmpleado' ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <Ionicons name="search" size={22} color="#fff" />
                            )}
                          </TouchableOpacity>
                        </View>
                        {listRcCapEmpResults.length ? (
                          <ThemedView style={styles.resultList}>
                            {listRcCapEmpResults.map((e) => (
                              <TouchableOpacity key={`list-rc-emp-${e.id}`} style={styles.resultItem} onPress={() => pickListRcCapEmp(e)}>
                                <ThemedText>
                                  {e.codigo} — {formatEmpleadoNombre(e)}
                                </ThemedText>
                              </TouchableOpacity>
                            ))}
                          </ThemedView>
                        ) : null}
                        <ThemedView style={styles.assignedList}>
                          {listRcCapEmpSelected.length === 0 ? (
                            <ThemedText style={styles.helperText}>Opcional: uno o más empleados.</ThemedText>
                          ) : (
                            listRcCapEmpSelected.map((e) => (
                              <ThemedView key={`list-rc-emp-sel-${e.id}`} style={styles.assignedUserItem}>
                                <ThemedText style={styles.assignedUserTitle}>
                                  {e.codigo} — {formatEmpleadoNombre(e)}
                                </ThemedText>
                                <TouchableOpacity style={styles.removeUserButton} onPress={() => removeListRcCapEmp(e.id)}>
                                  <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                                </TouchableOpacity>
                              </ThemedView>
                            ))
                          )}
                        </ThemedView>
                        <ThemedText style={styles.label}>Puestos de la capacitación</ThemedText>
                        <View style={styles.row}>
                          <TextInput
                            style={[styles.input, styles.inputFlex]}
                            value={listRcCapPuestoSearch}
                            onChangeText={setListRcCapPuestoSearch}
                            placeholder="Código o nombre de puesto"
                            placeholderTextColor="#999"
                          />
                          <TouchableOpacity
                            style={styles.searchIconBtn}
                            onPress={() => void runSearchActaStructure(listRcCapPuestoSearch, 'puesto', 'listRcCapPuesto')}
                            activeOpacity={0.85}
                            disabled={employeeSearchMode === 'listRcCapPuesto'}
                          >
                            {employeeSearchMode === 'listRcCapPuesto' ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <Ionicons name="search" size={22} color="#fff" />
                            )}
                          </TouchableOpacity>
                        </View>
                        {listRcCapPuestoResults.length ? (
                          <ThemedView style={styles.resultList}>
                            {listRcCapPuestoResults.map((it) => (
                              <TouchableOpacity
                                key={`list-rc-pto-${it.id}`}
                                style={styles.resultItem}
                                onPress={() => pickStructureLite(it, setListRcCapPuestoSelected, setListRcCapPuestoResults, setListRcCapPuestoSearch)}
                              >
                                <ThemedText>{formatStructureLite(it)}</ThemedText>
                              </TouchableOpacity>
                            ))}
                          </ThemedView>
                        ) : null}
                        <ThemedView style={styles.assignedList}>
                          {listRcCapPuestoSelected.length === 0 ? (
                            <ThemedText style={styles.helperText}>Opcional: uno o más puestos vinculados.</ThemedText>
                          ) : (
                            listRcCapPuestoSelected.map((it) => (
                              <ThemedView key={`list-rc-pto-sel-${it.id}`} style={styles.assignedUserItem}>
                                <ThemedText style={styles.assignedUserTitle}>{formatStructureLite(it)}</ThemedText>
                                <TouchableOpacity
                                  style={styles.removeUserButton}
                                  onPress={() => removeStructureLite(it.id, setListRcCapPuestoSelected)}
                                >
                                  <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                                </TouchableOpacity>
                              </ThemedView>
                            ))
                          )}
                        </ThemedView>
                        <ThemedText style={styles.label}>Responsable</ThemedText>
                        <View style={styles.row}>
                          <TextInput
                            style={[styles.input, styles.inputFlex]}
                            value={listRcResponsableSearch}
                            onChangeText={setListRcResponsableSearch}
                            placeholder="Código o nombre"
                            placeholderTextColor="#999"
                          />
                          <TouchableOpacity
                            style={styles.searchIconBtn}
                            onPress={() => void runSearchEmployees(listRcResponsableSearch, 'listRcResponsable')}
                            activeOpacity={0.85}
                            disabled={employeeSearchMode === 'listRcResponsable'}
                          >
                            {employeeSearchMode === 'listRcResponsable' ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <Ionicons name="search" size={22} color="#fff" />
                            )}
                          </TouchableOpacity>
                        </View>
                        {listRcResponsableResults.length ? (
                          <ThemedView style={styles.resultList}>
                            {listRcResponsableResults.map((e) => (
                              <TouchableOpacity key={`list-rc-r-${e.id}`} style={styles.resultItem} onPress={() => pickListRcResponsable(e)}>
                                <ThemedText>
                                  {e.codigo} — {formatEmpleadoNombre(e)}
                                </ThemedText>
                              </TouchableOpacity>
                            ))}
                          </ThemedView>
                        ) : null}
                        <ThemedView style={styles.assignedList}>
                          {listRcResponsableSelected.length === 0 ? (
                            <ThemedText style={styles.helperText}>Opcional: uno o más responsables.</ThemedText>
                          ) : (
                            listRcResponsableSelected.map((e) => (
                              <ThemedView key={`list-rc-r-sel-${e.id}`} style={styles.assignedUserItem}>
                                <ThemedText style={styles.assignedUserTitle}>
                                  {e.codigo} — {formatEmpleadoNombre(e)}
                                </ThemedText>
                                <TouchableOpacity style={styles.removeUserButton} onPress={() => removeListRcResponsable(e.id)}>
                                  <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                                </TouchableOpacity>
                              </ThemedView>
                            ))
                          )}
                        </ThemedView>
                      </>
                    ) : null}
                    {modulo === MODULO_INCIDENTES ||
                    modulo === MODULO_CHECKLIST_SUPERVISION ||
                    modulo === MODULO_SOLICITUDES_PERMISO ? (
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
                    {modulo === MODULO_VISITAS_VEHICULOS ? (
                      <>
                        <ThemedText style={styles.label}>Cédula del visitante</ThemedText>
                        <TextInput
                          style={styles.input}
                          value={listVvCedulaVisitante}
                          onChangeText={setListVvCedulaVisitante}
                          placeholder="Opcional"
                          placeholderTextColor="#999"
                        />
                        <ThemedText style={styles.label}>Tipo de vehículo</ThemedText>
                        <View style={styles.row}>
                          <View style={[styles.pickerWrapper, styles.inputFlex]}>
                            <Picker
                              selectedValue={listVvTipoPick}
                              onValueChange={(v) => setListVvTipoPick(String(v) as 'Particular' | 'Institucional')}
                              style={styles.picker}
                            >
                              <Picker.Item label="Particular" value="Particular" color="#000000" />
                              <Picker.Item label="Institucional" value="Institucional" color="#000000" />
                            </Picker>
                          </View>
                          <TouchableOpacity style={styles.searchIconBtn} onPress={addListVvTipo} activeOpacity={0.85}>
                            <Ionicons name="add" size={22} color="#fff" />
                          </TouchableOpacity>
                        </View>
                        <ThemedView style={styles.assignedList}>
                          {listVvTiposSelected.length === 0 ? (
                            <ThemedText style={styles.helperText}>Opcional: uno o más tipos.</ThemedText>
                          ) : (
                            listVvTiposSelected.map((tipo) => (
                              <ThemedView key={`list-vv-tipo-${tipo}`} style={styles.assignedUserItem}>
                                <ThemedText style={styles.assignedUserTitle}>{tipo}</ThemedText>
                                <TouchableOpacity style={styles.removeUserButton} onPress={() => removeListVvTipo(tipo)}>
                                  <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                                </TouchableOpacity>
                              </ThemedView>
                            ))
                          )}
                        </ThemedView>
                        <ThemedText style={styles.label}>Placa de vehículo</ThemedText>
                        <View style={styles.row}>
                          <TextInput
                            style={[styles.input, styles.inputFlex]}
                            value={listVvPlacaInput}
                            onChangeText={setListVvPlacaInput}
                            placeholder="Placa"
                            placeholderTextColor="#999"
                            autoCapitalize="characters"
                          />
                          <TouchableOpacity style={styles.searchIconBtn} onPress={addListVvPlaca} activeOpacity={0.85}>
                            <Ionicons name="add" size={22} color="#fff" />
                          </TouchableOpacity>
                        </View>
                        <ThemedView style={styles.assignedList}>
                          {listVvPlacasSelected.length === 0 ? (
                            <ThemedText style={styles.helperText}>Opcional: una o más placas.</ThemedText>
                          ) : (
                            listVvPlacasSelected.map((placa) => (
                              <ThemedView key={`list-vv-placa-${placa}`} style={styles.assignedUserItem}>
                                <ThemedText style={styles.assignedUserTitle}>{placa}</ThemedText>
                                <TouchableOpacity style={styles.removeUserButton} onPress={() => removeListVvPlaca(placa)}>
                                  <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                                </TouchableOpacity>
                              </ThemedView>
                            ))
                          )}
                        </ThemedView>
                        <ThemedText style={styles.label}>Responsable</ThemedText>
                        <View style={styles.row}>
                          <TextInput
                            style={[styles.input, styles.inputFlex]}
                            value={listVvResponsableSearch}
                            onChangeText={setListVvResponsableSearch}
                            placeholder="Código o nombre"
                            placeholderTextColor="#999"
                          />
                          <TouchableOpacity
                            style={styles.searchIconBtn}
                            onPress={() => void runSearchEmployees(listVvResponsableSearch, 'listVvResponsable')}
                            activeOpacity={0.85}
                            disabled={employeeSearchMode === 'listVvResponsable'}
                          >
                            {employeeSearchMode === 'listVvResponsable' ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <Ionicons name="search" size={22} color="#fff" />
                            )}
                          </TouchableOpacity>
                        </View>
                        {listVvResponsableResults.length ? (
                          <ThemedView style={styles.resultList}>
                            {listVvResponsableResults.map((e) => (
                              <TouchableOpacity key={`list-vv-r-${e.id}`} style={styles.resultItem} onPress={() => pickListVvResponsable(e)}>
                                <ThemedText>
                                  {e.codigo} — {formatEmpleadoNombre(e)}
                                </ThemedText>
                              </TouchableOpacity>
                            ))}
                          </ThemedView>
                        ) : null}
                        <ThemedView style={styles.assignedList}>
                          {listVvResponsableSelected.length === 0 ? (
                            <ThemedText style={styles.helperText}>Opcional: uno o más responsables.</ThemedText>
                          ) : (
                            listVvResponsableSelected.map((e) => (
                              <ThemedView key={`list-vv-sel-${e.id}`} style={styles.assignedUserItem}>
                                <ThemedText style={styles.assignedUserTitle}>
                                  {e.codigo} — {formatEmpleadoNombre(e)}
                                </ThemedText>
                                <TouchableOpacity style={styles.removeUserButton} onPress={() => removeListVvResponsable(e.id)}>
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
                    {modulo === MODULO_TIEMPO_ALMUERZO ? (
                      <>
                        <ThemedText style={styles.label}>Empleado</ThemedText>
                        <View style={styles.row}>
                          <TextInput
                            style={[styles.input, styles.inputFlex]}
                            value={listTaEmpleadoSearch}
                            onChangeText={setListTaEmpleadoSearch}
                            placeholder="Código o nombre"
                            placeholderTextColor="#999"
                          />
                          <TouchableOpacity
                            style={styles.searchIconBtn}
                            onPress={() => void runSearchEmployees(listTaEmpleadoSearch, 'listTaEmpleado')}
                            disabled={employeeSearchMode === 'listTaEmpleado'}
                          >
                            {employeeSearchMode === 'listTaEmpleado' ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <Ionicons name="search" size={22} color="#fff" />
                            )}
                          </TouchableOpacity>
                        </View>
                        {listTaEmpleadoResults.length ? (
                          <ThemedView style={styles.resultList}>
                            {listTaEmpleadoResults.map((e) => (
                              <TouchableOpacity key={`list-ta-e-${e.id}`} style={styles.resultItem} onPress={() => pickListTaEmpleado(e)}>
                                <ThemedText>
                                  {e.codigo} — {formatEmpleadoNombre(e)}
                                </ThemedText>
                              </TouchableOpacity>
                            ))}
                          </ThemedView>
                        ) : null}
                        <ThemedView style={styles.assignedList}>
                          {listTaEmpleadoSelected.length === 0 ? (
                            <ThemedText style={styles.helperText}>Opcional: uno o más empleados.</ThemedText>
                          ) : (
                            listTaEmpleadoSelected.map((e) => (
                              <ThemedView key={`list-ta-emp-${e.id}`} style={styles.assignedUserItem}>
                                <ThemedText style={styles.assignedUserTitle}>
                                  {e.codigo} — {formatEmpleadoNombre(e)}
                                </ThemedText>
                                <TouchableOpacity style={styles.removeUserButton} onPress={() => removeListTaEmpleado(e.id)}>
                                  <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                                </TouchableOpacity>
                              </ThemedView>
                            ))
                          )}
                        </ThemedView>
                        <ThemedText style={styles.label}>Cédula</ThemedText>
                        <View style={styles.row}>
                          <TextInput
                            style={[styles.input, styles.inputFlex]}
                            value={listTaCedulaSearch}
                            onChangeText={setListTaCedulaSearch}
                            placeholder="Cédula del empleado"
                            placeholderTextColor="#999"
                          />
                          <TouchableOpacity
                            style={styles.searchIconBtn}
                            onPress={() => void runSearchAlmuerzoCedulas(listTaCedulaSearch, 'listTaCedula')}
                            disabled={employeeSearchMode === 'listTaCedula'}
                          >
                            {employeeSearchMode === 'listTaCedula' ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <Ionicons name="search" size={22} color="#fff" />
                            )}
                          </TouchableOpacity>
                        </View>
                        {listTaCedulaResults.length ? (
                          <ThemedView style={styles.resultList}>
                            {listTaCedulaResults.map((c) => (
                              <TouchableOpacity
                                key={`list-ta-ced-${c.cedula}`}
                                style={styles.resultItem}
                                onPress={() => pickListTaCedula(c)}
                              >
                                <ThemedText>
                                  {c.cedula}
                                  {c.empleado_nombre ? ` — ${c.empleado_nombre}` : ''}
                                </ThemedText>
                              </TouchableOpacity>
                            ))}
                          </ThemedView>
                        ) : null}
                        <ThemedView style={styles.assignedList}>
                          {listTaCedulasSelected.length === 0 ? (
                            <ThemedText style={styles.helperText}>Opcional: una o más cédulas.</ThemedText>
                          ) : (
                            listTaCedulasSelected.map((ced) => (
                              <ThemedView key={`list-ta-ced-sel-${ced}`} style={styles.assignedUserItem}>
                                <ThemedText style={styles.assignedUserTitle}>{ced}</ThemedText>
                                <TouchableOpacity style={styles.removeUserButton} onPress={() => removeListTaCedula(ced)}>
                                  <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                                </TouchableOpacity>
                              </ThemedView>
                            ))
                          )}
                        </ThemedView>
                      </>
                    ) : null}
                    {modulo === MODULO_SOLICITUDES_PERMISO ? (
                      <>
                        <ThemedText style={styles.label}>Tipo de turno</ThemedText>
                        <View style={styles.row}>
                          <View style={[styles.pickerWrapper, styles.inputFlex]}>
                            <Picker
                              selectedValue={listSpTipoTurnoPick}
                              onValueChange={(v) =>
                                setListSpTipoTurnoPick(String(v) as 'Diurno' | 'Mixto' | 'Nocturno')
                              }
                              style={styles.picker}
                            >
                              <Picker.Item label="Diurno" value="Diurno" color="#000000" />
                              <Picker.Item label="Mixto" value="Mixto" color="#000000" />
                              <Picker.Item label="Nocturno" value="Nocturno" color="#000000" />
                            </Picker>
                          </View>
                          <TouchableOpacity style={styles.searchIconBtn} onPress={addListSpTipoTurno} activeOpacity={0.85}>
                            <Ionicons name="add" size={22} color="#fff" />
                          </TouchableOpacity>
                        </View>
                        <ThemedView style={styles.assignedList}>
                          {listSpTiposTurnoSelected.length === 0 ? (
                            <ThemedText style={styles.helperText}>Opcional: uno o más tipos de turno.</ThemedText>
                          ) : (
                            listSpTiposTurnoSelected.map((tipo) => (
                              <ThemedView key={`list-sp-tt-${tipo}`} style={styles.assignedUserItem}>
                                <ThemedText style={styles.assignedUserTitle}>{tipo}</ThemedText>
                                <TouchableOpacity style={styles.removeUserButton} onPress={() => removeListSpTipoTurno(tipo)}>
                                  <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                                </TouchableOpacity>
                              </ThemedView>
                            ))
                          )}
                        </ThemedView>
                        <ThemedText style={styles.label}>Tipo de salario</ThemedText>
                        <View style={styles.pickerWrapper}>
                          <Picker
                            selectedValue={listSpTipoSalario}
                            onValueChange={(v) =>
                              setListSpTipoSalario(String(v) as 'todos' | 'Con goce' | 'Sin goce')
                            }
                            style={styles.picker}
                          >
                            <Picker.Item label="Todos" value="todos" color="#000000" />
                            <Picker.Item label="Con goce" value="Con goce" color="#000000" />
                            <Picker.Item label="Sin goce" value="Sin goce" color="#000000" />
                          </Picker>
                        </View>
                        <ThemedText style={styles.label}>Estado</ThemedText>
                        <View style={styles.pickerWrapper}>
                          <Picker
                            selectedValue={listSpEstado}
                            onValueChange={(v) =>
                              setListSpEstado(String(v) as 'todos' | 'pendiente' | 'aprobado' | 'rechazado')
                            }
                            style={styles.picker}
                          >
                            <Picker.Item label="Todos" value="todos" color="#000000" />
                            <Picker.Item label="Pendiente" value="pendiente" color="#000000" />
                            <Picker.Item label="Aprobado" value="aprobado" color="#000000" />
                            <Picker.Item label="Rechazado" value="rechazado" color="#000000" />
                          </Picker>
                        </View>
                        <ThemedText style={styles.label}>Empleado</ThemedText>
                        <View style={styles.row}>
                          <TextInput
                            style={[styles.input, styles.inputFlex]}
                            value={listSpEmpleadoSearch}
                            onChangeText={setListSpEmpleadoSearch}
                            placeholder="Código o nombre"
                            placeholderTextColor="#999"
                          />
                          <TouchableOpacity
                            style={styles.searchIconBtn}
                            onPress={() => void runSearchEmployees(listSpEmpleadoSearch, 'listSpEmpleado')}
                            disabled={employeeSearchMode === 'listSpEmpleado'}
                          >
                            {employeeSearchMode === 'listSpEmpleado' ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <Ionicons name="search" size={22} color="#fff" />
                            )}
                          </TouchableOpacity>
                        </View>
                        {listSpEmpleadoResults.length ? (
                          <ThemedView style={styles.resultList}>
                            {listSpEmpleadoResults.map((e) => (
                              <TouchableOpacity key={`list-sp-e-${e.id}`} style={styles.resultItem} onPress={() => pickListSpEmpleado(e)}>
                                <ThemedText>
                                  {e.codigo} — {formatEmpleadoNombre(e)}
                                </ThemedText>
                              </TouchableOpacity>
                            ))}
                          </ThemedView>
                        ) : null}
                        <ThemedView style={styles.assignedList}>
                          {listSpEmpleadoSelected.length === 0 ? (
                            <ThemedText style={styles.helperText}>Opcional: uno o más empleados.</ThemedText>
                          ) : (
                            listSpEmpleadoSelected.map((e) => (
                              <ThemedView key={`list-sp-emp-${e.id}`} style={styles.assignedUserItem}>
                                <ThemedText style={styles.assignedUserTitle}>
                                  {e.codigo} — {formatEmpleadoNombre(e)}
                                </ThemedText>
                                <TouchableOpacity style={styles.removeUserButton} onPress={() => removeListSpEmpleado(e.id)}>
                                  <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                                </TouchableOpacity>
                              </ThemedView>
                            ))
                          )}
                        </ThemedView>
                      </>
                    ) : null}
                    {modulo === MODULO_REGISTRO_INDUCCION_GENERAL ? (
                      <>
                        <ThemedText style={styles.label}>Colaboradores (cédula)</ThemedText>
                        <View style={styles.row}>
                          <TextInput
                            style={[styles.input, styles.inputFlex]}
                            value={listRigColaboradorSearch}
                            onChangeText={setListRigColaboradorSearch}
                            placeholder="Cédula"
                            placeholderTextColor="#999"
                          />
                          <TouchableOpacity style={styles.searchIconBtn} onPress={addListRigColaboradorCedula} activeOpacity={0.85}>
                            <Ionicons name="add" size={22} color="#fff" />
                          </TouchableOpacity>
                        </View>
                        <ThemedView style={styles.assignedList}>
                          {listRigColaboradorCedulas.length === 0 ? (
                            <ThemedText style={styles.helperText}>Opcional: una o más cédulas.</ThemedText>
                          ) : (
                            listRigColaboradorCedulas.map((ced) => (
                              <ThemedView key={`list-rig-col-${ced}`} style={styles.assignedUserItem}>
                                <ThemedText style={styles.assignedUserTitle}>{ced}</ThemedText>
                                <TouchableOpacity style={styles.removeUserButton} onPress={() => removeListRigColaboradorCedula(ced)}>
                                  <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                                </TouchableOpacity>
                              </ThemedView>
                            ))
                          )}
                        </ThemedView>
                        <ThemedText style={styles.label}>Capacitadores (cédula)</ThemedText>
                        <View style={styles.row}>
                          <TextInput
                            style={[styles.input, styles.inputFlex]}
                            value={listRigCapacitadorSearch}
                            onChangeText={setListRigCapacitadorSearch}
                            placeholder="Cédula"
                            placeholderTextColor="#999"
                          />
                          <TouchableOpacity style={styles.searchIconBtn} onPress={addListRigCapacitadorCedula} activeOpacity={0.85}>
                            <Ionicons name="add" size={22} color="#fff" />
                          </TouchableOpacity>
                        </View>
                        <ThemedView style={styles.assignedList}>
                          {listRigCapacitadorCedulas.length === 0 ? (
                            <ThemedText style={styles.helperText}>Opcional: una o más cédulas.</ThemedText>
                          ) : (
                            listRigCapacitadorCedulas.map((ced) => (
                              <ThemedView key={`list-rig-cap-${ced}`} style={styles.assignedUserItem}>
                                <ThemedText style={styles.assignedUserTitle}>{ced}</ThemedText>
                                <TouchableOpacity style={styles.removeUserButton} onPress={() => removeListRigCapacitadorCedula(ced)}>
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
          <ThemedView style={styles.listContainer}>
            {reportes.length === 0 ? (
              <ThemedText style={styles.emptyText}>
                {loadingList ? 'Cargando lista…' : 'Sin datos. Abra filtros y pulse Buscar reportes.'}
              </ThemedText>
            ) : (
              reportes.map((item) => (
                <React.Fragment key={String(item.id)}>{renderReportItem({ item })}</React.Fragment>
              ))
            )}
          </ThemedView>
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
      {showListMaSolDd && (
        <DateTimePicker
          value={listMaSolDesdeD || horaAccionPickerBase}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, d) => {
            setShowListMaSolDd(Platform.OS === 'ios');
            if (d) setListMaSolDesdeD(d);
          }}
        />
      )}
      {showListMaSolDt && (
        <DateTimePicker
          value={listMaSolDesdeT || new Date(2000, 0, 1, 0, 0)}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, d) => {
            setShowListMaSolDt(Platform.OS === 'ios');
            if (d) setListMaSolDesdeT(d);
          }}
        />
      )}
      {showListMaSolHd && (
        <DateTimePicker
          value={listMaSolHastaD || horaAccionPickerBase}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, d) => {
            setShowListMaSolHd(Platform.OS === 'ios');
            if (d) setListMaSolHastaD(d);
          }}
        />
      )}
      {showListMaSolHt && (
        <DateTimePicker
          value={listMaSolHastaT || new Date(2000, 0, 1, 23, 59)}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, d) => {
            setShowListMaSolHt(Platform.OS === 'ios');
            if (d) setListMaSolHastaT(d);
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
      {modalVisible && showModalMaSolDd && (
        <DateTimePicker
          value={modalMaSolDesdeD || horaAccionPickerBase}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, d) => {
            setShowModalMaSolDd(Platform.OS === 'ios');
            if (d) setModalMaSolDesdeD(d);
          }}
        />
      )}
      {modalVisible && showModalMaSolDt && (
        <DateTimePicker
          value={modalMaSolDesdeT || new Date(2000, 0, 1, 0, 0)}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, d) => {
            setShowModalMaSolDt(Platform.OS === 'ios');
            if (d) setModalMaSolDesdeT(d);
          }}
        />
      )}
      {modalVisible && showModalMaSolHd && (
        <DateTimePicker
          value={modalMaSolHastaD || horaAccionPickerBase}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, d) => {
            setShowModalMaSolHd(Platform.OS === 'ios');
            if (d) setModalMaSolHastaD(d);
          }}
        />
      )}
      {modalVisible && showModalMaSolHt && (
        <DateTimePicker
          value={modalMaSolHastaT || new Date(2000, 0, 1, 23, 59)}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, d) => {
            setShowModalMaSolHt(Platform.OS === 'ios');
            if (d) setModalMaSolHastaT(d);
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
              formModulo === MODULO_VISITAS_VEHICULOS ||
              formModulo === MODULO_MUTUOS_ACUERDOS ||
              formModulo === MODULO_EVALUACION_PERSONAL ||
              formModulo === MODULO_PRODUCTO_NO_CONFORME ||
              formModulo === MODULO_REGISTRO_INDUCCION_RECORRIDO ||
              formModulo === MODULO_REGISTRO_INDUCCION_GENERAL ||
              formModulo === MODULO_NOTAS_VOZ ||
              formModulo === MODULO_CAMBIOS_UBICACION_PUESTO ||
              formModulo === MODULO_REGISTRO_CAPACITACIONES ||
              formModulo === MODULO_TIEMPO_ALMUERZO ||
              formModulo === MODULO_SOLICITUDES_PERMISO ||
              formModulo === MODULO_MANUALES_PUESTO ||
              formModulo === MODULO_ARTICULOS_PUESTO ||
              formModulo === MODULO_MANTENIMIENTO_ARTICULOS ||
              formModulo === MODULO_REGISTRO_VEHICULOS_CORPORATIVOS ||
              formModulo === MODULO_REVISION_VEHICULOS ||
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
                                  : formModulo === MODULO_VISITAS_VEHICULOS
                                    ? 'Filtros — Visitas de vehículos'
                                  : formModulo === MODULO_MUTUOS_ACUERDOS
                                    ? 'Filtros — Mutuos acuerdos'
                                : formModulo === MODULO_EVALUACION_PERSONAL
                                  ? 'Filtros — Evaluación de personal'
                                : formModulo === MODULO_REGISTRO_INDUCCION_RECORRIDO
                                  ? 'Filtros — Registro de inducción y recorrido'
                                : formModulo === MODULO_REGISTRO_INDUCCION_GENERAL
                                  ? 'Filtros — Registro de inducción general'
                                : formModulo === MODULO_NOTAS_VOZ
                                  ? 'Filtros — Notas de voz'
                                : formModulo === MODULO_CAMBIOS_UBICACION_PUESTO
                                  ? 'Filtros — Cambios en ubicación del puesto'
                                : formModulo === MODULO_REGISTRO_CAPACITACIONES
                                  ? 'Filtros — Registro de capacitaciones'
                                : formModulo === MODULO_TIEMPO_ALMUERZO
                                  ? 'Filtros — Tiempo de almuerzo'
                                : formModulo === MODULO_SOLICITUDES_PERMISO
                                  ? 'Filtros — Solicitudes de permiso'
                                : formModulo === MODULO_MANUALES_PUESTO
                                  ? 'Filtros — Manuales de puesto'
                                : formModulo === MODULO_ARTICULOS_PUESTO
                                  ? 'Filtros — Artículos del puesto'
                                : formModulo === MODULO_MANTENIMIENTO_ARTICULOS
                                  ? 'Filtros — Mantenimiento de artículos'
                                : formModulo === MODULO_REGISTRO_VEHICULOS_CORPORATIVOS
                                  ? 'Filtros — Registro de vehículos'
                                : formModulo === MODULO_REVISION_VEHICULOS
                                  ? 'Filtros — Revisión de vehículos'
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
                  {formModulo !== MODULO_ARTICULOS_PUESTO ? (
                    <>
                      <ThemedText style={styles.label}>
                        {formModulo === MODULO_TIEMPO_ALMUERZO ? 'Inicio desde' : 'Creado desde'}
                      </ThemedText>
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
                      <ThemedText style={styles.label}>
                        {formModulo === MODULO_TIEMPO_ALMUERZO ? 'Fin hasta' : 'Creado hasta'}
                      </ThemedText>
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
                    </>
                  ) : null}

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

                  {formModulo === MODULO_MANTENIMIENTO_ARTICULOS ? (
                    <>
                      <ThemedText style={styles.label}>Estado</ThemedText>
                      <View style={styles.row}>
                        <View style={[styles.pickerWrapper, styles.inputFlex]}>
                          <Picker
                            selectedValue={modalMaEstadoPick}
                            onValueChange={(v) => setModalMaEstadoPick(String(v) as typeof modalMaEstadoPick)}
                            style={styles.picker}
                          >
                            <Picker.Item label="Todos" value="todos" color="#000000" />
                            <Picker.Item label="Bueno" value="Bueno" color="#000000" />
                            <Picker.Item label="Malo" value="Malo" color="#000000" />
                            <Picker.Item label="No está" value="No está" color="#000000" />
                          </Picker>
                        </View>
                        <TouchableOpacity style={styles.searchIconBtn} onPress={addModalMaEstado} activeOpacity={0.85}>
                          <Ionicons name="add" size={22} color="#fff" />
                        </TouchableOpacity>
                      </View>
                      <ThemedView style={styles.assignedList}>
                        {modalMaEstadosSelected.length === 0 ? (
                          <ThemedText style={styles.helperText}>Opcional: uno o más estados.</ThemedText>
                        ) : (
                          modalMaEstadosSelected.map((estado) => (
                            <ThemedView key={`modal-ma-est-${estado}`} style={styles.assignedUserItem}>
                              <ThemedText style={styles.assignedUserTitle}>{estado}</ThemedText>
                              <TouchableOpacity style={styles.removeUserButton} onPress={() => removeModalMaEstado(estado)}>
                                <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                              </TouchableOpacity>
                            </ThemedView>
                          ))
                        )}
                      </ThemedView>
                      <ThemedText style={styles.label}>Tipo de acción</ThemedText>
                      <View style={styles.row}>
                        <View style={[styles.pickerWrapper, styles.inputFlex]}>
                          <Picker
                            selectedValue={modalMaAccionPick}
                            onValueChange={(v) => setModalMaAccionPick(String(v) as typeof modalMaAccionPick)}
                            style={styles.picker}
                          >
                            <Picker.Item label="Todos" value="todos" color="#000000" />
                            <Picker.Item label="Reemplazar" value="Reemplazar" color="#000000" />
                            <Picker.Item label="Rellenar" value="Rellenar" color="#000000" />
                            <Picker.Item label="Reparar en puesto" value="Reparar en puesto" color="#000000" />
                            <Picker.Item label="Reparar en taller" value="Reparar en taller" color="#000000" />
                          </Picker>
                        </View>
                        <TouchableOpacity style={styles.searchIconBtn} onPress={addModalMaAccion} activeOpacity={0.85}>
                          <Ionicons name="add" size={22} color="#fff" />
                        </TouchableOpacity>
                      </View>
                      <ThemedView style={styles.assignedList}>
                        {modalMaAccionesSelected.length === 0 ? (
                          <ThemedText style={styles.helperText}>Opcional: uno o más tipos de acción.</ThemedText>
                        ) : (
                          modalMaAccionesSelected.map((accion) => (
                            <ThemedView key={`modal-ma-acc-${accion}`} style={styles.assignedUserItem}>
                              <ThemedText style={styles.assignedUserTitle}>{accion}</ThemedText>
                              <TouchableOpacity style={styles.removeUserButton} onPress={() => removeModalMaAccion(accion)}>
                                <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                              </TouchableOpacity>
                            </ThemedView>
                          ))
                        )}
                      </ThemedView>
                      <ThemedText style={styles.label}>Solucionado desde (fecha y hora)</ThemedText>
                      <View style={styles.dateRow}>
                        <TouchableOpacity style={styles.dateButtonHalf} onPress={() => setShowModalMaSolDd(true)} activeOpacity={0.85}>
                          <ThemedText style={styles.dateButtonText}>{modalMaSolDesdeD ? formatDateOnlyLabel(modalMaSolDesdeD) : 'Fecha'}</ThemedText>
                          <Ionicons name="calendar-outline" size={18} color="#007AFF" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.dateButtonHalf} onPress={() => setShowModalMaSolDt(true)} activeOpacity={0.85}>
                          <ThemedText style={styles.dateButtonText}>{modalMaSolDesdeT ? hm(modalMaSolDesdeT) : 'Hora'}</ThemedText>
                          <Ionicons name="time-outline" size={18} color="#007AFF" />
                        </TouchableOpacity>
                      </View>
                      <ThemedText style={styles.label}>Solucionado hasta (fecha y hora)</ThemedText>
                      <View style={styles.dateRow}>
                        <TouchableOpacity style={styles.dateButtonHalf} onPress={() => setShowModalMaSolHd(true)} activeOpacity={0.85}>
                          <ThemedText style={styles.dateButtonText}>{modalMaSolHastaD ? formatDateOnlyLabel(modalMaSolHastaD) : 'Fecha'}</ThemedText>
                          <Ionicons name="calendar-outline" size={18} color="#007AFF" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.dateButtonHalf} onPress={() => setShowModalMaSolHt(true)} activeOpacity={0.85}>
                          <ThemedText style={styles.dateButtonText}>{modalMaSolHastaT ? hm(modalMaSolHastaT) : 'Hora'}</ThemedText>
                          <Ionicons name="time-outline" size={18} color="#007AFF" />
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : null}

                  {formModulo === MODULO_REGISTRO_VEHICULOS_CORPORATIVOS ? (
                    <>
                      <ThemedText style={styles.label}>Tipo de vehículo</ThemedText>
                      <View style={styles.row}>
                        <View style={[styles.pickerWrapper, styles.inputFlex]}>
                          <Picker
                            selectedValue={modalRvcTipoVehiculoPick}
                            onValueChange={(v) => setModalRvcTipoVehiculoPick(String(v) as typeof modalRvcTipoVehiculoPick)}
                            style={styles.picker}
                          >
                            <Picker.Item label="Vehículo" value="Vehículo" color="#000000" />
                            <Picker.Item label="Motocicleta" value="Motocicleta" color="#000000" />
                            <Picker.Item label="Bicicleta" value="Bicicleta" color="#000000" />
                          </Picker>
                        </View>
                        <TouchableOpacity style={styles.searchIconBtn} onPress={addModalRvcTipoVehiculo} activeOpacity={0.85}>
                          <Ionicons name="add" size={22} color="#fff" />
                        </TouchableOpacity>
                      </View>
                      <ThemedView style={styles.assignedList}>
                        {modalRvcTiposVehiculoSelected.length === 0 ? (
                          <ThemedText style={styles.helperText}>Opcional: uno o más tipos de vehículo.</ThemedText>
                        ) : (
                          modalRvcTiposVehiculoSelected.map((tipo) => (
                            <ThemedView key={`modal-rvc-tv-${tipo}`} style={styles.assignedUserItem}>
                              <ThemedText style={styles.assignedUserTitle}>{tipo}</ThemedText>
                              <TouchableOpacity style={styles.removeUserButton} onPress={() => removeModalRvcTipoVehiculo(tipo)}>
                                <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                              </TouchableOpacity>
                            </ThemedView>
                          ))
                        )}
                      </ThemedView>
                      <ThemedText style={styles.label}>Placa</ThemedText>
                      <TextInput
                        style={styles.input}
                        value={modalRvcPlaca}
                        onChangeText={setModalRvcPlaca}
                        placeholder="Opcional"
                        placeholderTextColor="#999"
                        autoCapitalize="characters"
                      />
                      <ThemedText style={styles.label}>Año</ThemedText>
                      <TextInput
                        style={styles.input}
                        value={modalRvcAnno}
                        onChangeText={setModalRvcAnno}
                        placeholder="Opcional"
                        placeholderTextColor="#999"
                        keyboardType="number-pad"
                      />
                      <ThemedText style={styles.label}>Modelo</ThemedText>
                      <TextInput
                        style={styles.input}
                        value={modalRvcModelo}
                        onChangeText={setModalRvcModelo}
                        placeholder="Opcional"
                        placeholderTextColor="#999"
                      />
                      <ThemedText style={styles.label}>Tipo de autoría</ThemedText>
                      <View style={styles.row}>
                        <View style={[styles.pickerWrapper, styles.inputFlex]}>
                          <Picker
                            selectedValue={modalRvcTipoAutoriaPick}
                            onValueChange={(v) => setModalRvcTipoAutoriaPick(String(v) as typeof modalRvcTipoAutoriaPick)}
                            style={styles.picker}
                          >
                            <Picker.Item label="Cliente" value="Cliente" color="#000000" />
                            <Picker.Item label="Corporativo" value="Corporativo" color="#000000" />
                          </Picker>
                        </View>
                        <TouchableOpacity style={styles.searchIconBtn} onPress={addModalRvcTipoAutoria} activeOpacity={0.85}>
                          <Ionicons name="add" size={22} color="#fff" />
                        </TouchableOpacity>
                      </View>
                      <ThemedView style={styles.assignedList}>
                        {modalRvcTiposAutoriaSelected.length === 0 ? (
                          <ThemedText style={styles.helperText}>Opcional: uno o más tipos de autoría.</ThemedText>
                        ) : (
                          modalRvcTiposAutoriaSelected.map((tipo) => (
                            <ThemedView key={`modal-rvc-ta-${tipo}`} style={styles.assignedUserItem}>
                              <ThemedText style={styles.assignedUserTitle}>{tipo}</ThemedText>
                              <TouchableOpacity style={styles.removeUserButton} onPress={() => removeModalRvcTipoAutoria(tipo)}>
                                <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                              </TouchableOpacity>
                            </ThemedView>
                          ))
                        )}
                      </ThemedView>
                    </>
                  ) : null}

                  {formModulo === MODULO_REVISION_VEHICULOS ? (
                    <>
                      <ThemedText style={styles.label}>Vehículo</ThemedText>
                      <View style={styles.row}>
                        <TextInput
                          style={[styles.input, styles.inputFlex]}
                          value={modalRvdVehiculoSearch}
                          onChangeText={setModalRvdVehiculoSearch}
                          placeholder="Placa, marca o modelo"
                          placeholderTextColor="#999"
                          autoCapitalize="characters"
                        />
                        <TouchableOpacity
                          style={styles.searchIconBtn}
                          onPress={() => void runSearchCorporateVehicles(modalRvdVehiculoSearch, 'modalRvdVehiculo')}
                          activeOpacity={0.85}
                          disabled={employeeSearchMode === 'modalRvdVehiculo'}
                        >
                          {employeeSearchMode === 'modalRvdVehiculo' ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Ionicons name="search" size={22} color="#fff" />
                          )}
                        </TouchableOpacity>
                      </View>
                      {modalRvdVehiculoResults.length ? (
                        <ThemedView style={styles.resultList}>
                          {modalRvdVehiculoResults.map((v) => (
                            <TouchableOpacity key={`modal-rvd-v-${v.id}`} style={styles.resultItem} onPress={() => pickModalRvdVehiculo(v)}>
                              <ThemedText>{formatVehiculoLite(v)}</ThemedText>
                            </TouchableOpacity>
                          ))}
                        </ThemedView>
                      ) : null}
                      <ThemedView style={styles.assignedList}>
                        {modalRvdVehiculoSelected.length === 0 ? (
                          <ThemedText style={styles.helperText}>Opcional: uno o más vehículos.</ThemedText>
                        ) : (
                          modalRvdVehiculoSelected.map((v) => (
                            <ThemedView key={`modal-rvd-v-sel-${v.id}`} style={styles.assignedUserItem}>
                              <ThemedText style={styles.assignedUserTitle}>{formatVehiculoLite(v)}</ThemedText>
                              <TouchableOpacity style={styles.removeUserButton} onPress={() => removeModalRvdVehiculo(v.id)}>
                                <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                              </TouchableOpacity>
                            </ThemedView>
                          ))
                        )}
                      </ThemedView>
                    </>
                  ) : null}

                  {formModulo === MODULO_CAMBIOS_UBICACION_PUESTO ? (
                    <>
                      <ThemedText style={styles.label}>Responsable (creador del registro)</ThemedText>
                      <View style={styles.row}>
                        <TextInput
                          style={[styles.input, styles.inputFlex]}
                          value={modalCupResponsableSearch}
                          onChangeText={setModalCupResponsableSearch}
                          placeholder="Código o nombre"
                          placeholderTextColor="#999"
                        />
                        <TouchableOpacity
                          style={styles.searchIconBtn}
                          onPress={() => void runSearchEmployees(modalCupResponsableSearch, 'modalCupResponsable')}
                          activeOpacity={0.85}
                          disabled={employeeSearchMode === 'modalCupResponsable'}
                        >
                          {employeeSearchMode === 'modalCupResponsable' ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Ionicons name="search" size={22} color="#fff" />
                          )}
                        </TouchableOpacity>
                      </View>
                      {modalCupResponsableResults.length ? (
                        <ThemedView style={styles.resultList}>
                          {modalCupResponsableResults.map((e) => (
                            <TouchableOpacity key={`modal-cup-r-${e.id}`} style={styles.resultItem} onPress={() => pickModalCupResponsable(e)}>
                              <ThemedText>
                                {e.codigo} — {formatEmpleadoNombre(e)}
                              </ThemedText>
                            </TouchableOpacity>
                          ))}
                        </ThemedView>
                      ) : null}
                      <ThemedView style={styles.assignedList}>
                        {modalCupResponsableSelected.length === 0 ? (
                          <ThemedText style={styles.helperText}>Opcional: uno o más responsables.</ThemedText>
                        ) : (
                          modalCupResponsableSelected.map((e) => (
                            <ThemedView key={`modal-cup-r-sel-${e.id}`} style={styles.assignedUserItem}>
                              <ThemedText style={styles.assignedUserTitle}>
                                {e.codigo} — {formatEmpleadoNombre(e)}
                              </ThemedText>
                              <TouchableOpacity style={styles.removeUserButton} onPress={() => removeModalCupResponsable(e.id)}>
                                <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                              </TouchableOpacity>
                            </ThemedView>
                          ))
                        )}
                      </ThemedView>
                    </>
                  ) : null}

                  {formModulo === MODULO_REGISTRO_CAPACITACIONES ? (
                    <>
                      <ThemedText style={styles.label}>Tipo de capacitación</ThemedText>
                      <View style={styles.pickerWrapper}>
                        <Picker
                          selectedValue={modalRcTipoCapacitacion}
                          onValueChange={(v) => setModalRcTipoCapacitacion(String(v) as 'todos' | 'Presencial' | 'Virtual')}
                          style={styles.picker}
                        >
                          <Picker.Item label="Todos" value="todos" color="#000000" />
                          <Picker.Item label="Presencial" value="Presencial" color="#000000" />
                          <Picker.Item label="Virtual" value="Virtual" color="#000000" />
                        </Picker>
                      </View>
                      <ThemedText style={styles.label}>Empleados de la capacitación</ThemedText>
                      <View style={styles.row}>
                        <TextInput
                          style={[styles.input, styles.inputFlex]}
                          value={modalRcCapEmpSearch}
                          onChangeText={setModalRcCapEmpSearch}
                          placeholder="Código o nombre"
                          placeholderTextColor="#999"
                        />
                        <TouchableOpacity
                          style={styles.searchIconBtn}
                          onPress={() => void runSearchEmployees(modalRcCapEmpSearch, 'modalRcCapEmpleado')}
                          activeOpacity={0.85}
                          disabled={employeeSearchMode === 'modalRcCapEmpleado'}
                        >
                          {employeeSearchMode === 'modalRcCapEmpleado' ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Ionicons name="search" size={22} color="#fff" />
                          )}
                        </TouchableOpacity>
                      </View>
                      {modalRcCapEmpResults.length ? (
                        <ThemedView style={styles.resultList}>
                          {modalRcCapEmpResults.map((e) => (
                            <TouchableOpacity key={`modal-rc-emp-${e.id}`} style={styles.resultItem} onPress={() => pickModalRcCapEmp(e)}>
                              <ThemedText>
                                {e.codigo} — {formatEmpleadoNombre(e)}
                              </ThemedText>
                            </TouchableOpacity>
                          ))}
                        </ThemedView>
                      ) : null}
                      <ThemedView style={styles.assignedList}>
                        {modalRcCapEmpSelected.length === 0 ? (
                          <ThemedText style={styles.helperText}>Opcional: uno o más empleados.</ThemedText>
                        ) : (
                          modalRcCapEmpSelected.map((e) => (
                            <ThemedView key={`modal-rc-emp-sel-${e.id}`} style={styles.assignedUserItem}>
                              <ThemedText style={styles.assignedUserTitle}>
                                {e.codigo} — {formatEmpleadoNombre(e)}
                              </ThemedText>
                              <TouchableOpacity style={styles.removeUserButton} onPress={() => removeModalRcCapEmp(e.id)}>
                                <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                              </TouchableOpacity>
                            </ThemedView>
                          ))
                        )}
                      </ThemedView>
                      <ThemedText style={styles.label}>Puestos de la capacitación</ThemedText>
                      <View style={styles.row}>
                        <TextInput
                          style={[styles.input, styles.inputFlex]}
                          value={modalRcCapPuestoSearch}
                          onChangeText={setModalRcCapPuestoSearch}
                          placeholder="Código o nombre de puesto"
                          placeholderTextColor="#999"
                        />
                        <TouchableOpacity
                          style={styles.searchIconBtn}
                          onPress={() => void runSearchActaStructure(modalRcCapPuestoSearch, 'puesto', 'modalRcCapPuesto')}
                          activeOpacity={0.85}
                          disabled={employeeSearchMode === 'modalRcCapPuesto'}
                        >
                          {employeeSearchMode === 'modalRcCapPuesto' ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Ionicons name="search" size={22} color="#fff" />
                          )}
                        </TouchableOpacity>
                      </View>
                      {modalRcCapPuestoResults.length ? (
                        <ThemedView style={styles.resultList}>
                          {modalRcCapPuestoResults.map((it) => (
                            <TouchableOpacity
                              key={`modal-rc-pto-${it.id}`}
                              style={styles.resultItem}
                              onPress={() => pickStructureLite(it, setModalRcCapPuestoSelected, setModalRcCapPuestoResults, setModalRcCapPuestoSearch)}
                            >
                              <ThemedText>{formatStructureLite(it)}</ThemedText>
                            </TouchableOpacity>
                          ))}
                        </ThemedView>
                      ) : null}
                      <ThemedView style={styles.assignedList}>
                        {modalRcCapPuestoSelected.length === 0 ? (
                          <ThemedText style={styles.helperText}>Opcional: uno o más puestos vinculados.</ThemedText>
                        ) : (
                          modalRcCapPuestoSelected.map((it) => (
                            <ThemedView key={`modal-rc-pto-sel-${it.id}`} style={styles.assignedUserItem}>
                              <ThemedText style={styles.assignedUserTitle}>{formatStructureLite(it)}</ThemedText>
                              <TouchableOpacity
                                style={styles.removeUserButton}
                                onPress={() => removeStructureLite(it.id, setModalRcCapPuestoSelected)}
                              >
                                <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                              </TouchableOpacity>
                            </ThemedView>
                          ))
                        )}
                      </ThemedView>
                      <ThemedText style={styles.label}>Responsable</ThemedText>
                      <View style={styles.row}>
                        <TextInput
                          style={[styles.input, styles.inputFlex]}
                          value={modalRcResponsableSearch}
                          onChangeText={setModalRcResponsableSearch}
                          placeholder="Código o nombre"
                          placeholderTextColor="#999"
                        />
                        <TouchableOpacity
                          style={styles.searchIconBtn}
                          onPress={() => void runSearchEmployees(modalRcResponsableSearch, 'modalRcResponsable')}
                          activeOpacity={0.85}
                          disabled={employeeSearchMode === 'modalRcResponsable'}
                        >
                          {employeeSearchMode === 'modalRcResponsable' ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Ionicons name="search" size={22} color="#fff" />
                          )}
                        </TouchableOpacity>
                      </View>
                      {modalRcResponsableResults.length ? (
                        <ThemedView style={styles.resultList}>
                          {modalRcResponsableResults.map((e) => (
                            <TouchableOpacity key={`modal-rc-r-${e.id}`} style={styles.resultItem} onPress={() => pickModalRcResponsable(e)}>
                              <ThemedText>
                                {e.codigo} — {formatEmpleadoNombre(e)}
                              </ThemedText>
                            </TouchableOpacity>
                          ))}
                        </ThemedView>
                      ) : null}
                      <ThemedView style={styles.assignedList}>
                        {modalRcResponsableSelected.length === 0 ? (
                          <ThemedText style={styles.helperText}>Opcional: uno o más responsables.</ThemedText>
                        ) : (
                          modalRcResponsableSelected.map((e) => (
                            <ThemedView key={`modal-rc-r-sel-${e.id}`} style={styles.assignedUserItem}>
                              <ThemedText style={styles.assignedUserTitle}>
                                {e.codigo} — {formatEmpleadoNombre(e)}
                              </ThemedText>
                              <TouchableOpacity style={styles.removeUserButton} onPress={() => removeModalRcResponsable(e.id)}>
                                <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                              </TouchableOpacity>
                            </ThemedView>
                          ))
                        )}
                      </ThemedView>
                    </>
                  ) : null}

                  {formModulo === MODULO_INCIDENTES ||
                  formModulo === MODULO_CHECKLIST_SUPERVISION ||
                  formModulo === MODULO_SOLICITUDES_PERMISO ? (
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
                  {formModulo === MODULO_VISITAS_VEHICULOS ? (
                    <>
                      <ThemedText style={styles.label}>Cédula del visitante</ThemedText>
                      <TextInput
                        style={styles.input}
                        value={modalVvCedulaVisitante}
                        onChangeText={setModalVvCedulaVisitante}
                        placeholder="Opcional"
                        placeholderTextColor="#999"
                      />
                      <ThemedText style={styles.label}>Tipo de vehículo</ThemedText>
                      <View style={styles.row}>
                        <View style={[styles.pickerWrapper, styles.inputFlex]}>
                          <Picker
                            selectedValue={modalVvTipoPick}
                            onValueChange={(v) => setModalVvTipoPick(String(v) as 'Particular' | 'Institucional')}
                            style={styles.picker}
                          >
                            <Picker.Item label="Particular" value="Particular" color="#000000" />
                            <Picker.Item label="Institucional" value="Institucional" color="#000000" />
                          </Picker>
                        </View>
                        <TouchableOpacity style={styles.searchIconBtn} onPress={addModalVvTipo} activeOpacity={0.85}>
                          <Ionicons name="add" size={22} color="#fff" />
                        </TouchableOpacity>
                      </View>
                      <ThemedView style={styles.assignedList}>
                        {modalVvTiposSelected.length === 0 ? (
                          <ThemedText style={styles.helperText}>Opcional: uno o más tipos.</ThemedText>
                        ) : (
                          modalVvTiposSelected.map((tipo) => (
                            <ThemedView key={`modal-vv-tipo-${tipo}`} style={styles.assignedUserItem}>
                              <ThemedText style={styles.assignedUserTitle}>{tipo}</ThemedText>
                              <TouchableOpacity style={styles.removeUserButton} onPress={() => removeModalVvTipo(tipo)}>
                                <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                              </TouchableOpacity>
                            </ThemedView>
                          ))
                        )}
                      </ThemedView>
                      <ThemedText style={styles.label}>Placa de vehículo</ThemedText>
                      <View style={styles.row}>
                        <TextInput
                          style={[styles.input, styles.inputFlex]}
                          value={modalVvPlacaInput}
                          onChangeText={setModalVvPlacaInput}
                          placeholder="Placa"
                          placeholderTextColor="#999"
                          autoCapitalize="characters"
                        />
                        <TouchableOpacity style={styles.searchIconBtn} onPress={addModalVvPlaca} activeOpacity={0.85}>
                          <Ionicons name="add" size={22} color="#fff" />
                        </TouchableOpacity>
                      </View>
                      <ThemedView style={styles.assignedList}>
                        {modalVvPlacasSelected.length === 0 ? (
                          <ThemedText style={styles.helperText}>Opcional: una o más placas.</ThemedText>
                        ) : (
                          modalVvPlacasSelected.map((placa) => (
                            <ThemedView key={`modal-vv-placa-${placa}`} style={styles.assignedUserItem}>
                              <ThemedText style={styles.assignedUserTitle}>{placa}</ThemedText>
                              <TouchableOpacity style={styles.removeUserButton} onPress={() => removeModalVvPlaca(placa)}>
                                <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                              </TouchableOpacity>
                            </ThemedView>
                          ))
                        )}
                      </ThemedView>
                      <ThemedText style={styles.label}>Responsable</ThemedText>
                      <View style={styles.row}>
                        <TextInput
                          style={[styles.input, styles.inputFlex]}
                          value={modalVvResponsableSearch}
                          onChangeText={setModalVvResponsableSearch}
                          placeholder="Código o nombre"
                          placeholderTextColor="#999"
                        />
                        <TouchableOpacity
                          style={styles.searchIconBtn}
                          onPress={() => void runSearchEmployees(modalVvResponsableSearch, 'modalVvResponsable')}
                          activeOpacity={0.85}
                          disabled={employeeSearchMode === 'modalVvResponsable'}
                        >
                          {employeeSearchMode === 'modalVvResponsable' ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Ionicons name="search" size={22} color="#fff" />
                          )}
                        </TouchableOpacity>
                      </View>
                      {modalVvResponsableResults.length ? (
                        <ThemedView style={styles.resultList}>
                          {modalVvResponsableResults.map((e) => (
                            <TouchableOpacity key={`modal-vv-r-${e.id}`} style={styles.resultItem} onPress={() => pickModalVvResponsable(e)}>
                              <ThemedText>
                                {e.codigo} — {formatEmpleadoNombre(e)}
                              </ThemedText>
                            </TouchableOpacity>
                          ))}
                        </ThemedView>
                      ) : null}
                      <ThemedView style={styles.assignedList}>
                        {modalVvResponsableSelected.length === 0 ? (
                          <ThemedText style={styles.helperText}>Opcional: uno o más responsables.</ThemedText>
                        ) : (
                          modalVvResponsableSelected.map((e) => (
                            <ThemedView key={`modal-vv-sel-${e.id}`} style={styles.assignedUserItem}>
                              <ThemedText style={styles.assignedUserTitle}>
                                {e.codigo} — {formatEmpleadoNombre(e)}
                              </ThemedText>
                              <TouchableOpacity style={styles.removeUserButton} onPress={() => removeModalVvResponsable(e.id)}>
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
                  {formModulo === MODULO_TIEMPO_ALMUERZO ? (
                    <>
                      <ThemedText style={styles.label}>Empleado</ThemedText>
                      <View style={styles.row}>
                        <TextInput
                          style={[styles.input, styles.inputFlex]}
                          value={modalTaEmpleadoSearch}
                          onChangeText={setModalTaEmpleadoSearch}
                          placeholder="Código o nombre"
                          placeholderTextColor="#999"
                        />
                        <TouchableOpacity
                          style={styles.searchIconBtn}
                          onPress={() => void runSearchEmployees(modalTaEmpleadoSearch, 'modalTaEmpleado')}
                          disabled={employeeSearchMode === 'modalTaEmpleado'}
                        >
                          {employeeSearchMode === 'modalTaEmpleado' ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Ionicons name="search" size={22} color="#fff" />
                          )}
                        </TouchableOpacity>
                      </View>
                      {modalTaEmpleadoResults.length ? (
                        <ThemedView style={styles.resultList}>
                          {modalTaEmpleadoResults.map((e) => (
                            <TouchableOpacity key={`modal-ta-e-${e.id}`} style={styles.resultItem} onPress={() => pickModalTaEmpleado(e)}>
                              <ThemedText>
                                {e.codigo} — {formatEmpleadoNombre(e)}
                              </ThemedText>
                            </TouchableOpacity>
                          ))}
                        </ThemedView>
                      ) : null}
                      <ThemedView style={styles.assignedList}>
                        {modalTaEmpleadoSelected.length === 0 ? (
                          <ThemedText style={styles.helperText}>Opcional: uno o más empleados.</ThemedText>
                        ) : (
                          modalTaEmpleadoSelected.map((e) => (
                            <ThemedView key={`modal-ta-emp-${e.id}`} style={styles.assignedUserItem}>
                              <ThemedText style={styles.assignedUserTitle}>
                                {e.codigo} — {formatEmpleadoNombre(e)}
                              </ThemedText>
                              <TouchableOpacity style={styles.removeUserButton} onPress={() => removeModalTaEmpleado(e.id)}>
                                <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                              </TouchableOpacity>
                            </ThemedView>
                          ))
                        )}
                      </ThemedView>
                      <ThemedText style={styles.label}>Cédula</ThemedText>
                      <View style={styles.row}>
                        <TextInput
                          style={[styles.input, styles.inputFlex]}
                          value={modalTaCedulaSearch}
                          onChangeText={setModalTaCedulaSearch}
                          placeholder="Cédula del empleado"
                          placeholderTextColor="#999"
                        />
                        <TouchableOpacity
                          style={styles.searchIconBtn}
                          onPress={() => void runSearchAlmuerzoCedulas(modalTaCedulaSearch, 'modalTaCedula')}
                          disabled={employeeSearchMode === 'modalTaCedula'}
                        >
                          {employeeSearchMode === 'modalTaCedula' ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Ionicons name="search" size={22} color="#fff" />
                          )}
                        </TouchableOpacity>
                      </View>
                      {modalTaCedulaResults.length ? (
                        <ThemedView style={styles.resultList}>
                          {modalTaCedulaResults.map((c) => (
                            <TouchableOpacity key={`modal-ta-ced-${c.cedula}`} style={styles.resultItem} onPress={() => pickModalTaCedula(c)}>
                              <ThemedText>
                                {c.cedula}
                                {c.empleado_nombre ? ` — ${c.empleado_nombre}` : ''}
                              </ThemedText>
                            </TouchableOpacity>
                          ))}
                        </ThemedView>
                      ) : null}
                      <ThemedView style={styles.assignedList}>
                        {modalTaCedulasSelected.length === 0 ? (
                          <ThemedText style={styles.helperText}>Opcional: una o más cédulas.</ThemedText>
                        ) : (
                          modalTaCedulasSelected.map((ced) => (
                            <ThemedView key={`modal-ta-ced-sel-${ced}`} style={styles.assignedUserItem}>
                              <ThemedText style={styles.assignedUserTitle}>{ced}</ThemedText>
                              <TouchableOpacity style={styles.removeUserButton} onPress={() => removeModalTaCedula(ced)}>
                                <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                              </TouchableOpacity>
                            </ThemedView>
                          ))
                        )}
                      </ThemedView>
                    </>
                  ) : null}
                  {formModulo === MODULO_SOLICITUDES_PERMISO ? (
                    <>
                      <ThemedText style={styles.label}>Tipo de turno</ThemedText>
                      <View style={styles.row}>
                        <View style={[styles.pickerWrapper, styles.inputFlex]}>
                          <Picker
                            selectedValue={modalSpTipoTurnoPick}
                            onValueChange={(v) =>
                              setModalSpTipoTurnoPick(String(v) as 'Diurno' | 'Mixto' | 'Nocturno')
                            }
                            style={styles.picker}
                          >
                            <Picker.Item label="Diurno" value="Diurno" color="#000000" />
                            <Picker.Item label="Mixto" value="Mixto" color="#000000" />
                            <Picker.Item label="Nocturno" value="Nocturno" color="#000000" />
                          </Picker>
                        </View>
                        <TouchableOpacity style={styles.searchIconBtn} onPress={addModalSpTipoTurno} activeOpacity={0.85}>
                          <Ionicons name="add" size={22} color="#fff" />
                        </TouchableOpacity>
                      </View>
                      <ThemedView style={styles.assignedList}>
                        {modalSpTiposTurnoSelected.length === 0 ? (
                          <ThemedText style={styles.helperText}>Opcional: uno o más tipos de turno.</ThemedText>
                        ) : (
                          modalSpTiposTurnoSelected.map((tipo) => (
                            <ThemedView key={`modal-sp-tt-${tipo}`} style={styles.assignedUserItem}>
                              <ThemedText style={styles.assignedUserTitle}>{tipo}</ThemedText>
                              <TouchableOpacity style={styles.removeUserButton} onPress={() => removeModalSpTipoTurno(tipo)}>
                                <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                              </TouchableOpacity>
                            </ThemedView>
                          ))
                        )}
                      </ThemedView>
                      <ThemedText style={styles.label}>Tipo de salario</ThemedText>
                      <View style={styles.pickerWrapper}>
                        <Picker
                          selectedValue={modalSpTipoSalario}
                          onValueChange={(v) =>
                            setModalSpTipoSalario(String(v) as 'todos' | 'Con goce' | 'Sin goce')
                          }
                          style={styles.picker}
                        >
                          <Picker.Item label="Todos" value="todos" color="#000000" />
                          <Picker.Item label="Con goce" value="Con goce" color="#000000" />
                          <Picker.Item label="Sin goce" value="Sin goce" color="#000000" />
                        </Picker>
                      </View>
                      <ThemedText style={styles.label}>Estado</ThemedText>
                      <View style={styles.pickerWrapper}>
                        <Picker
                          selectedValue={modalSpEstado}
                          onValueChange={(v) =>
                            setModalSpEstado(String(v) as 'todos' | 'pendiente' | 'aprobado' | 'rechazado')
                          }
                          style={styles.picker}
                        >
                          <Picker.Item label="Todos" value="todos" color="#000000" />
                          <Picker.Item label="Pendiente" value="pendiente" color="#000000" />
                          <Picker.Item label="Aprobado" value="aprobado" color="#000000" />
                          <Picker.Item label="Rechazado" value="rechazado" color="#000000" />
                        </Picker>
                      </View>
                      <ThemedText style={styles.label}>Empleado</ThemedText>
                      <View style={styles.row}>
                        <TextInput
                          style={[styles.input, styles.inputFlex]}
                          value={modalSpEmpleadoSearch}
                          onChangeText={setModalSpEmpleadoSearch}
                          placeholder="Código o nombre"
                          placeholderTextColor="#999"
                        />
                        <TouchableOpacity
                          style={styles.searchIconBtn}
                          onPress={() => void runSearchEmployees(modalSpEmpleadoSearch, 'modalSpEmpleado')}
                          disabled={employeeSearchMode === 'modalSpEmpleado'}
                        >
                          {employeeSearchMode === 'modalSpEmpleado' ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Ionicons name="search" size={22} color="#fff" />
                          )}
                        </TouchableOpacity>
                      </View>
                      {modalSpEmpleadoResults.length ? (
                        <ThemedView style={styles.resultList}>
                          {modalSpEmpleadoResults.map((e) => (
                            <TouchableOpacity key={`modal-sp-e-${e.id}`} style={styles.resultItem} onPress={() => pickModalSpEmpleado(e)}>
                              <ThemedText>
                                {e.codigo} — {formatEmpleadoNombre(e)}
                              </ThemedText>
                            </TouchableOpacity>
                          ))}
                        </ThemedView>
                      ) : null}
                      <ThemedView style={styles.assignedList}>
                        {modalSpEmpleadoSelected.length === 0 ? (
                          <ThemedText style={styles.helperText}>Opcional: uno o más empleados.</ThemedText>
                        ) : (
                          modalSpEmpleadoSelected.map((e) => (
                            <ThemedView key={`modal-sp-emp-${e.id}`} style={styles.assignedUserItem}>
                              <ThemedText style={styles.assignedUserTitle}>
                                {e.codigo} — {formatEmpleadoNombre(e)}
                              </ThemedText>
                              <TouchableOpacity style={styles.removeUserButton} onPress={() => removeModalSpEmpleado(e.id)}>
                                <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                              </TouchableOpacity>
                            </ThemedView>
                          ))
                        )}
                      </ThemedView>
                    </>
                  ) : null}
                  {formModulo === MODULO_REGISTRO_INDUCCION_GENERAL ? (
                    <>
                      <ThemedText style={styles.label}>Colaboradores (cédula)</ThemedText>
                      <View style={styles.row}>
                        <TextInput
                          style={[styles.input, styles.inputFlex]}
                          value={modalRigColaboradorSearch}
                          onChangeText={setModalRigColaboradorSearch}
                          placeholder="Cédula"
                          placeholderTextColor="#999"
                        />
                        <TouchableOpacity style={styles.searchIconBtn} onPress={addModalRigColaboradorCedula} activeOpacity={0.85}>
                          <Ionicons name="add" size={22} color="#fff" />
                        </TouchableOpacity>
                      </View>
                      <ThemedView style={styles.assignedList}>
                        {modalRigColaboradorCedulas.length === 0 ? (
                          <ThemedText style={styles.helperText}>Opcional: una o más cédulas.</ThemedText>
                        ) : (
                          modalRigColaboradorCedulas.map((ced) => (
                            <ThemedView key={`modal-rig-col-${ced}`} style={styles.assignedUserItem}>
                              <ThemedText style={styles.assignedUserTitle}>{ced}</ThemedText>
                              <TouchableOpacity style={styles.removeUserButton} onPress={() => removeModalRigColaboradorCedula(ced)}>
                                <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                              </TouchableOpacity>
                            </ThemedView>
                          ))
                        )}
                      </ThemedView>
                      <ThemedText style={styles.label}>Capacitadores (cédula)</ThemedText>
                      <View style={styles.row}>
                        <TextInput
                          style={[styles.input, styles.inputFlex]}
                          value={modalRigCapacitadorSearch}
                          onChangeText={setModalRigCapacitadorSearch}
                          placeholder="Cédula"
                          placeholderTextColor="#999"
                        />
                        <TouchableOpacity style={styles.searchIconBtn} onPress={addModalRigCapacitadorCedula} activeOpacity={0.85}>
                          <Ionicons name="add" size={22} color="#fff" />
                        </TouchableOpacity>
                      </View>
                      <ThemedView style={styles.assignedList}>
                        {modalRigCapacitadorCedulas.length === 0 ? (
                          <ThemedText style={styles.helperText}>Opcional: una o más cédulas.</ThemedText>
                        ) : (
                          modalRigCapacitadorCedulas.map((ced) => (
                            <ThemedView key={`modal-rig-cap-${ced}`} style={styles.assignedUserItem}>
                              <ThemedText style={styles.assignedUserTitle}>{ced}</ThemedText>
                              <TouchableOpacity style={styles.removeUserButton} onPress={() => removeModalRigCapacitadorCedula(ced)}>
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
                                  : formModulo === MODULO_VISITAS_VEHICULOS
                                    ? ORDER_OPTIONS_VISITAS_VEHICULOS
                                  : formModulo === MODULO_MUTUOS_ACUERDOS
                                    ? ORDER_OPTIONS_MUTUOS_ACUERDOS
                                : formModulo === MODULO_EVALUACION_PERSONAL
                                  ? ORDER_OPTIONS_EVALUACION_PERSONAL
                                : formModulo === MODULO_PRODUCTO_NO_CONFORME
                                  ? ORDER_OPTIONS_PRODUCTO_NO_CONFORME
                                : formModulo === MODULO_REGISTRO_INDUCCION_RECORRIDO
                                  ? ORDER_OPTIONS_INDUCCION_RECORRIDO
                                : formModulo === MODULO_REGISTRO_INDUCCION_GENERAL
                                  ? ORDER_OPTIONS_INDUCCION_RECORRIDO
                                : formModulo === MODULO_NOTAS_VOZ
                                  ? ORDER_OPTIONS_NOTAS_VOZ
                                : formModulo === MODULO_CAMBIOS_UBICACION_PUESTO
                                  ? ORDER_OPTIONS_CAMBIOS_UBICACION_PUESTO
                                : formModulo === MODULO_REGISTRO_CAPACITACIONES
                                  ? ORDER_OPTIONS_REGISTRO_CAPACITACIONES
                                : formModulo === MODULO_TIEMPO_ALMUERZO
                                  ? ORDER_OPTIONS_TIEMPO_ALMUERZO
                                : formModulo === MODULO_SOLICITUDES_PERMISO
                                  ? ORDER_OPTIONS_SOLICITUDES_PERMISO
                                : formModulo === MODULO_MANUALES_PUESTO
                                  ? ORDER_OPTIONS_MANUALES_PUESTO
                                : formModulo === MODULO_ARTICULOS_PUESTO
                                  ? ORDER_OPTIONS_ARTICULOS_PUESTO
                                : formModulo === MODULO_MANTENIMIENTO_ARTICULOS
                                  ? ORDER_OPTIONS_MANTENIMIENTO_ARTICULOS
                                : formModulo === MODULO_REGISTRO_VEHICULOS_CORPORATIVOS
                                  ? ORDER_OPTIONS_REGISTRO_VEHICULOS_CORPORATIVOS
                                : formModulo === MODULO_REVISION_VEHICULOS
                                  ? ORDER_OPTIONS_REVISION_VEHICULOS
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
                        formModulo === MODULO_MANUALES_PUESTO ||
                        formModulo === MODULO_ARTICULOS_PUESTO ||
                        formModulo === MODULO_MANTENIMIENTO_ARTICULOS ||
                        formModulo === MODULO_REGISTRO_VEHICULOS_CORPORATIVOS ||
                        formModulo === MODULO_NOTAS_VOZ ||
                        formModulo === MODULO_CAMBIOS_UBICACION_PUESTO ||
                        formModulo === MODULO_REGISTRO_CAPACITACIONES ||
                        formModulo === MODULO_TIEMPO_ALMUERZO
                          ? 'Consolidado'
                          : formTipoReporte
                      }
                      enabled={
                        formModulo !== MODULO_BITACORA_NOVEDADES &&
                        formModulo !== MODULO_CHECKLIST_SUPERVISION &&
                        formModulo !== MODULO_EVALUACION_PERSONAL &&
                        formModulo !== MODULO_MANUALES_PUESTO &&
                        formModulo !== MODULO_ARTICULOS_PUESTO &&
                        formModulo !== MODULO_MANTENIMIENTO_ARTICULOS &&
                        formModulo !== MODULO_REGISTRO_VEHICULOS_CORPORATIVOS &&
                        formModulo !== MODULO_NOTAS_VOZ &&
                        formModulo !== MODULO_CAMBIOS_UBICACION_PUESTO &&
                        formModulo !== MODULO_REGISTRO_CAPACITACIONES &&
                        formModulo !== MODULO_TIEMPO_ALMUERZO
                      }
                      onValueChange={(v) => {
                        const t = String(v).trim() as ReporteTipoSalida;
                        if (t === 'Consolidado' || t === 'Individual') {
                          applyFormTipoReporte(t);
                        }
                      }}
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
                            : formModulo === MODULO_VISITAS_VEHICULOS
                              ? previewRows.map((row, idx) => (
                                  <ThemedView key={`prev-vv-${idx}`} style={{ marginBottom: 12 }}>
                                    <ThemedText style={styles.detailText}>
                                      {row.placa ?? '—'} · {row.tipo ?? '—'} · {row.nombre ?? '—'}
                                    </ThemedText>
                                    <ThemedText style={styles.helperText}>
                                      {row.empresa_nombre ?? '—'} · {row.e_estructura_cliente?.nombre ?? '—'} · {row.division_nombre ?? '—'}
                                    </ThemedText>
                                    <ThemedText style={styles.helperText}>
                                      {row.contrato_nombre ?? '—'} · {row.e_estructura_sucursal?.nombre ?? '—'} ·{' '}
                                      {row.e_estructura_puesto?.nombre ?? '—'}
                                    </ThemedText>
                                    <ThemedText style={styles.helperText}>
                                      Entrada: {row.hora_entrada ?? '—'} · Salida: {row.hora_salida ?? '—'} · Responsable:{' '}
                                      {row.responsable_label ?? '—'}
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
                            : formModulo === MODULO_ARTICULOS_PUESTO
                              ? previewRows.map((row, idx) => (
                                  <ThemedView key={`prev-ap-${idx}`} style={{ marginBottom: 12 }}>
                                    <ThemedText style={styles.detailText}>{row.puesto_txt ?? '—'}</ThemedText>
                                    <ThemedText style={styles.helperText}>
                                      {row.empresa_txt ?? '—'} · {row.cliente_txt ?? '—'} · {row.division_txt ?? '—'}
                                    </ThemedText>
                                    <ThemedText style={styles.helperText}>
                                      {row.contrato_txt ?? '—'} · {row.corpo_txt ?? '—'} · Artículos: {row.articulos_count ?? 0}
                                    </ThemedText>
                                  </ThemedView>
                                ))
                            : formModulo === MODULO_MANTENIMIENTO_ARTICULOS
                              ? previewRows.map((row, idx) => (
                                  <ThemedView key={`prev-ma-${idx}`} style={{ marginBottom: 12 }}>
                                    <ThemedText style={styles.detailText}>
                                      #{row.id ?? '—'} · {row.articulo_nombre ?? '—'} · {row.estado ?? '—'}
                                    </ThemedText>
                                    <ThemedText style={styles.helperText}>
                                      {row.puesto_txt ?? '—'} · {row.origen ?? '—'} · Acción: {row.accion ?? '—'}
                                    </ThemedText>
                                    <ThemedText style={styles.helperText}>
                                      {row.empresa_txt ?? '—'} · {row.cliente_txt ?? '—'} · {row.division_txt ?? '—'}
                                    </ThemedText>
                                    <ThemedText style={styles.helperText}>
                                      Creado: {row.created_at_txt ?? '—'} · Solucionado: {row.fecha_solucion_txt ?? '—'}
                                    </ThemedText>
                                  </ThemedView>
                                ))
                            : formModulo === MODULO_REGISTRO_VEHICULOS_CORPORATIVOS
                              ? previewRows.map((row, idx) => (
                                  <ThemedView key={`prev-rvc-${idx}`} style={{ marginBottom: 12 }}>
                                    <ThemedText style={styles.detailText}>
                                      {row.placa || 'Sin placa'} · {row.tipo ?? '—'} · {row.tipo_autoria ?? '—'}
                                    </ThemedText>
                                    <ThemedText style={styles.helperText}>
                                      {row.marca ?? '—'} · {row.modelo ?? '—'} · Año: {row.anno ?? '—'} · {row.estado ?? '—'}
                                    </ThemedText>
                                    <ThemedText style={styles.helperText}>
                                      {row.empresa_txt ?? '—'} · {row.cliente_txt ?? '—'} · {row.division_txt ?? '—'}
                                    </ThemedText>
                                    <ThemedText style={styles.helperText}>
                                      {row.contrato_txt ?? '—'} · {row.corpo_txt ?? '—'} · {row.puesto_txt ?? '—'}
                                    </ThemedText>
                                    <ThemedText style={styles.helperText}>
                                      Creado: {row.created_at_txt ?? '—'} · Usos: {row.usos_count ?? 0} · Mantenimientos:{' '}
                                      {row.mantenimientos_count ?? 0}
                                    </ThemedText>
                                  </ThemedView>
                                ))
                            : formModulo === MODULO_REVISION_VEHICULOS
                              ? previewRows.map((row, idx) => (
                                  <ThemedView key={`prev-rev-${idx}`} style={{ marginBottom: 12 }}>
                                    <ThemedText style={styles.detailText}>
                                      #{row.id ?? '—'} · {row.tipo ?? '—'} · {row.vehiculo_txt ?? '—'}
                                    </ThemedText>
                                    <ThemedText style={styles.helperText}>
                                      {row.empresa_txt ?? '—'} · {row.cliente_txt ?? '—'} · {row.division_txt ?? '—'}
                                    </ThemedText>
                                    <ThemedText style={styles.helperText}>
                                      {row.contrato_txt ?? '—'} · {row.corpo_txt ?? '—'} · {row.puesto_txt ?? '—'}
                                    </ThemedText>
                                    <ThemedText style={styles.helperText}>
                                      Creado: {row.created_at_txt ?? '—'} · Info. general: {row.info_general_count ?? 0} · Revisión:{' '}
                                      {row.info_revision_count ?? 0} · Movimientos: {row.movimientos_count ?? 0}
                                    </ThemedText>
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
                            : formModulo === MODULO_NOTAS_VOZ
                              ? previewRows.map((row, idx) => (
                                  <ThemedView key={`prev-nv-${idx}`} style={{ marginBottom: 12 }}>
                                    <ThemedText style={styles.detailText}>
                                      {row.empresa_nombre ?? '—'} | {row.cliente_nombre ?? '—'} | {row.fecha_txt ?? '—'}
                                    </ThemedText>
                                    <ThemedText style={styles.helperText}>
                                      {row.division_nombre ?? '—'} · {row.contrato_nombre ?? '—'} · {row.corpo_nombre ?? '—'} ·{' '}
                                      {row.puesto_nombre ?? '—'}
                                    </ThemedText>
                                    <ThemedText style={styles.helperText}>Título: {row.titulo ?? '—'}</ThemedText>
                                    {row.descripcion != null && String(row.descripcion).trim() !== '' ? (
                                      <ThemedText selectable style={styles.helperText} numberOfLines={3}>
                                        {String(row.descripcion)}
                                      </ThemedText>
                                    ) : null}
                                    {row.transcripcion != null && String(row.transcripcion).trim() !== '' ? (
                                      <ThemedText selectable style={styles.helperText} numberOfLines={4}>
                                        Transcripción: {String(row.transcripcion)}
                                      </ThemedText>
                                    ) : null}
                                    <ThemedText style={styles.helperText}>Creado por: {row.creador_nombre ?? '—'}</ThemedText>
                                  </ThemedView>
                                ))
                            : formModulo === MODULO_CAMBIOS_UBICACION_PUESTO
                              ? previewRows.map((row, idx) => (
                                  <ThemedView key={`prev-cup-${idx}`} style={{ marginBottom: 12 }}>
                                    <ThemedText style={styles.detailText}>
                                      {row.empresa_nombre ?? '—'} | {row.cliente_nombre ?? '—'} | {row.fecha_txt ?? '—'}
                                    </ThemedText>
                                    <ThemedText style={styles.helperText}>
                                      {row.division_nombre ?? '—'} · {row.contrato_nombre ?? '—'} · {row.corpo_nombre ?? '—'} ·{' '}
                                      {row.puesto_nombre ?? '—'}
                                    </ThemedText>
                                    <ThemedText style={styles.helperText}>
                                      Lat: {row.latitud_anterior_txt || '—'} / {row.longitud_anterior_txt || '—'} →{' '}
                                      {row.latitud_nueva_txt || '—'} / {row.longitud_nueva_txt || '—'}
                                    </ThemedText>
                                    <ThemedText style={styles.helperText}>Responsable: {row.responsable_nombre ?? '—'}</ThemedText>
                                  </ThemedView>
                                ))
                            : formModulo === MODULO_REGISTRO_CAPACITACIONES
                              ? previewRows.map((row, idx) => (
                                  <ThemedView key={`prev-rc-${idx}`} style={{ marginBottom: 12 }}>
                                    <ThemedText style={styles.detailText}>
                                      {row.empresa_nombre ?? '—'} | {row.cliente_nombre ?? '—'} | {row.fecha_txt ?? '—'}
                                    </ThemedText>
                                    <ThemedText style={styles.helperText}>
                                      {row.division_nombre ?? '—'} · {row.contrato_nombre ?? '—'} · {row.corpo_nombre ?? '—'} ·{' '}
                                      {row.puesto_nombre ?? '—'}
                                    </ThemedText>
                                    <ThemedText style={styles.helperText}>
                                      Tipo: {row.tipo ?? '—'} · Título: {row.titulo ?? '—'}
                                    </ThemedText>
                                    {row.empleados_cap_txt ? (
                                      <ThemedText selectable style={styles.helperText} numberOfLines={3}>
                                        Empleados: {String(row.empleados_cap_txt)}
                                      </ThemedText>
                                    ) : null}
                                    {row.puestos_cap_txt ? (
                                      <ThemedText selectable style={styles.helperText} numberOfLines={3}>
                                        Puestos: {String(row.puestos_cap_txt)}
                                      </ThemedText>
                                    ) : null}
                                    <ThemedText style={styles.helperText}>Responsable: {row.responsable_nombre ?? '—'}</ThemedText>
                                  </ThemedView>
                                ))
                            : formModulo === MODULO_TIEMPO_ALMUERZO
                              ? previewRows.map((row, idx) => (
                                  <ThemedView key={`prev-ta-${idx}`} style={{ marginBottom: 12 }}>
                                    <ThemedText style={styles.detailText}>
                                      {row.empresa_nombre ?? '—'} | {row.cliente_nombre ?? '—'}
                                    </ThemedText>
                                    <ThemedText style={styles.helperText}>
                                      {row.division_nombre ?? '—'} · {row.contrato_nombre ?? '—'} · {row.corpo_nombre ?? '—'} ·{' '}
                                      {row.puesto_nombre ?? '—'}
                                    </ThemedText>
                                    <ThemedText style={styles.helperText}>
                                      {row.empleado_nombre ?? '—'} · Cédula: {row.cedula_empleado ?? '—'}
                                    </ThemedText>
                                    <ThemedText style={styles.helperText}>
                                      Inicio: {row.inicio_txt ?? '—'} · Fin: {row.fin_txt ?? '—'} · Minutos:{' '}
                                      {row.minutos_almuerzo ?? '—'} · Manual: {row.es_manual ? 'Sí' : 'No'}
                                    </ThemedText>
                                    {(row.pausas_list || []).length > 0 ? (
                                      <ThemedText style={styles.helperText}>
                                        Pausas: {(row.pausas_list as any[]).length}
                                      </ThemedText>
                                    ) : null}
                                  </ThemedView>
                                ))
                            : formModulo === MODULO_SOLICITUDES_PERMISO
                              ? previewRows.map((row, idx) => (
                                  <ThemedView key={`prev-sp-${idx}`} style={{ marginBottom: 12 }}>
                                    <ThemedText style={styles.detailText}>
                                      {row.empresa_nombre ?? '—'} | {row.cliente_nombre ?? '—'} | {row.created_at_txt ?? '—'}
                                    </ThemedText>
                                    <ThemedText style={styles.helperText}>
                                      {row.division_nombre ?? '—'} · {row.contrato_nombre ?? '—'} · {row.corpo_nombre ?? '—'} ·{' '}
                                      {row.puesto_nombre ?? '—'}
                                    </ThemedText>
                                    <ThemedText style={styles.helperText}>
                                      Empleado: {row.empleado_nombre ?? '—'} ({row.empleado_codigo ?? '—'}) · Ejecutivo:{' '}
                                      {row.ejecutivo_cuenta_nombre ?? '—'}
                                    </ThemedText>
                                    <ThemedText style={styles.helperText}>
                                      {row.fecha_inicio_txt ?? '—'} — {row.fecha_fin_txt ?? '—'} · Días: {row.dias_permiso ?? '—'} ·
                                      Salario: {row.tipo ?? '—'} · Estado: {row.estado ?? '—'}
                                    </ThemedText>
                                    {row.motivo_txt || row.motivo ? (
                                      <ThemedText style={styles.helperText}>Motivo: {row.motivo_txt ?? row.motivo}</ThemedText>
                                    ) : null}
                                    {row.observaciones_txt || row.observaciones ? (
                                      <ThemedText style={styles.helperText}>
                                        Observaciones: {row.observaciones_txt ?? row.observaciones}
                                      </ThemedText>
                                    ) : null}
                                    <ThemedText style={styles.helperText}>Firma empleado (manual)</ThemedText>
                                    {signatureUri(row.firma_empleado_manual_data_uri || row.firma_empleado_manual) ? (
                                      <Image
                                        source={{
                                          uri: signatureUri(
                                            row.firma_empleado_manual_data_uri || row.firma_empleado_manual,
                                          ) as string,
                                        }}
                                        style={{ width: 160, height: 72, borderWidth: 1, borderColor: '#DDD' }}
                                        resizeMode="contain"
                                      />
                                    ) : null}
                                    <ThemedText style={styles.helperText}>Firma ejecutivo (manual)</ThemedText>
                                    {signatureUri(row.firma_ejecutivo_manual_data_uri || row.firma_ejecutivo_cuenta_manual) ? (
                                      <Image
                                        source={{
                                          uri: signatureUri(
                                            row.firma_ejecutivo_manual_data_uri || row.firma_ejecutivo_cuenta_manual,
                                          ) as string,
                                        }}
                                        style={{ width: 160, height: 72, borderWidth: 1, borderColor: '#DDD', marginTop: 4 }}
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
                            : formModulo === MODULO_REGISTRO_INDUCCION_GENERAL
                              ? previewRows.map((row, idx) => (
                                  <ThemedView key={`prev-rig-${idx}`} style={{ marginBottom: 12 }}>
                                    <ThemedText style={styles.detailText}>
                                      {row.empresa_nombre ?? '—'} | {row.cliente_nombre ?? '—'} | {row.fecha_txt ?? '—'}
                                    </ThemedText>
                                    <ThemedText style={styles.helperText}>
                                      {row.division_nombre ?? '—'} · {row.contrato_nombre ?? '—'} · {row.corpo_nombre ?? '—'} ·{' '}
                                      {row.puesto_nombre ?? '—'}
                                    </ThemedText>
                                    <ThemedText style={styles.helperText}>
                                      Creador: {row.empleado_creador_nombre ?? '—'}
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
                                    {(row.colaboradores_preview || []).map((p: any, j: number) => (
                                      <ThemedView key={`prev-rig-col-${idx}-${j}`} style={{ marginTop: 8 }}>
                                        <ThemedText style={styles.detailText}>
                                          Colaborador: {String(p?.nombre ?? '—')} — {String(p?.cedula ?? '')}
                                        </ThemedText>
                                        {signatureUri(p?.firma_data_uri || p?.firma) ? (
                                          <Image
                                            source={{ uri: signatureUri(p.firma_data_uri || p.firma) as string }}
                                            style={{ width: 140, height: 60, borderWidth: 1, borderColor: '#DDD' }}
                                            resizeMode="contain"
                                          />
                                        ) : null}
                                      </ThemedView>
                                    ))}
                                    {(row.capacitadores_preview || []).map((p: any, j: number) => (
                                      <ThemedView key={`prev-rig-cap-${idx}-${j}`} style={{ marginTop: 8 }}>
                                        <ThemedText style={styles.detailText}>
                                          Capacitador: {String(p?.nombre ?? '—')} — {String(p?.cedula ?? '')}
                                        </ThemedText>
                                        {signatureUri(p?.firma_data_uri || p?.firma) ? (
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
  scrollView: { flex: 1, overflow: 'visible' as const },
  scrollContent: { padding: 16, paddingBottom: 120, flexGrow: 1 },
  content: { width: '100%', maxWidth: 800, alignSelf: 'center', overflow: 'visible' as const },

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

  listContainer: {
    width: '100%',
    overflow: 'visible' as const,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#000',
  },
  cardLine: {
    marginBottom: 8,
    fontSize: 14,
  },
  cardLabel: {
    fontWeight: '600',
    color: '#666',
  },
  cardValue: {
    color: '#000',
  },
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
  collapseButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007AFF',
  },
  collapsableContent: {
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
  },
  collapseContent: {
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
  },
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
  downloadBtn: { backgroundColor: '#34C759' },
  downloadBtnCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 8,
    alignSelf: 'stretch',
  },
  downloadBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
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
