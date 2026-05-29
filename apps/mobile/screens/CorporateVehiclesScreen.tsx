import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  Dimensions,
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import AppHeader from '@/components/AppHeader';
import AppFooter from '@/components/AppFooter';
import SlideMenu from '@/components/SlideMenu';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  loadMainStructureTreeMerged,
  persistMergedMainStructureTree,
  readBitacorasForSucursalFromMainStructure,
  upsertBitacoraDetenidoRowInMainStructure,
} from '@/hooks/bitacoraMainStructureCache';
import * as Network from 'expo-network';
import getCurrentUserDigitalSignature from '@/hooks/getCurrentUserDigitalSignature';
import Constants from 'expo-constants';
import { Picker } from '@react-native-picker/picker';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '@/contexts/AuthContext';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/App';
import { eventBus } from '@/hooks/eventBus';
import {
  findCorporateVehicleServerIdByLocalKey,
  getCorporateVehiclesForCorpo,
  mergeCorporateVehiclesCorpoCacheForSucursal,
  removeVehicleFromCorpoCache,
  setVehicleUsosInCorpoCache,
  upsertVehicleInCorpoCache,
} from '@/hooks/corporateVehiclesCorpoCache';
import { mergeMainStructureFragments } from '@/hooks/mergeMainStructureFragments';
import { loadMainStructureFragmentsObject } from '@/hooks/mainStructureFragmentsStorage';
import { deleteFile, getFile, getLocalFileDisplayUri, saveFile } from '@/hooks/fileStorage';
import {
  readCorporateVehiclesForSucursalFromMainStructure,
  readCorporateVehiclesForSucursalFromFragmentStorage,
  mergeCorporateVehiclesForSucursalFromServer,
  upsertCorporateVehicleInMainStructure,
  moveCorporateVehicleInMainStructure,
  removeCorporateVehicleFromMainStructureEverywhere,
  updateVehicleUsosInMainStructureBranch,
  updateVehicleMantenimientosInMainStructureBranch,
  findSucursalIdForVehicleKeyInMainStructure,
  resolveCorporateVehicleServerIdFromMainStructure,
  isCorporateVehicleLocalDraft,
  resolveSucursalIdForVehiculoFromMainStructure,
  normalizeVehiculoCorporativoForMainStructureCache,
  recomputeBitacorasForSucursalNode,
} from '@/hooks/corporateVehiclesMainStructure';
import { useQRScanner } from '@/hooks/useQRScanner';
import authedFetch from '@/hooks/authedFetch';
import DateTimePicker from '@react-native-community/datetimepicker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import getHoraAccion from '@/hooks/getHoraAccion';
import SignatureScreen from 'react-native-signature-canvas';
import {
  createCorporateVehicle,
  createCorporateVehicleUse,
  deleteCorporateVehicleUse,
  deleteCorporateVehicle,
  deleteCorporateVehicleImage,
  listCorporateVehicleUses,
  listCorporateVehiclesByCorpo,
  updateCorporateVehicleUse,
  updateCorporateVehicle,
  createCorporateVehicleMaintenance,
  updateCorporateVehicleMaintenance,
  deleteCorporateVehicleMaintenance,
  deleteCorporateVehicleMaintenanceImage,
  listCorporateVehicleMaintenances,
  CorporateVehicleMaintenanceRequest,
} from '@/hooks/evaluationFunctions';
import { convertDateTimestampToLocalString } from '@/hooks/convertDateTimestampToLocalString';

type Nav = NativeStackNavigationProp<RootStackParamList, 'CorporateVehicles'>;

const CORPORATE_VEHICLE_IMAGE_PREFIX = 'corporate_vehicle';

type MainStructureTree = any[];

type FirmaData = {
  sessionId: string;
  empleadoId: string;
  latitud: string;
  longitud: string;
  timestamp: string;
};

type LocalImage = {
  id: string;
  name: string;
  extension: string;
  base64?: string;
  mimeType?: string;
  /** Archivo en `Paths.document` vía `fileStorage.saveFile`. */
  localFileName?: string;
  /** Imagen ya persistida en servidor (no se re-sube salvo que haya archivo local / base64 nuevo). */
  serverImageId?: number;
};

type VehicleImage = {
  id?: number | string;
  name: string;
  id_local?: string;
  base64?: string;
  extension?: string;
  stored_file_name?: string;
  localFileName?: string;
};

type VehicleUse = {
  id: number | string;
  id_local?: string;
  vehiculo_id: number | string;
  bitacora_id?: number | null;
  nombre_conductor: string;
  codigo_conductor: string;
  fecha_inicio: string; // ISO
  fecha_fin: string; // ISO
  hora_inicio: string; // ISO
  hora_fin: string; // ISO
  combustible_inicio: string;
  combustible_fin: string;
  km_inicio: number;
  km_fin: number;
  motivo: string;
  firma_conductor?: string | null;
  firma_responsable: string;
  bitacora?: any | null; // ignorar por ahora en UI
  synced?: boolean;
};

type VehicleMaintenance = {
  id: number | string;
  id_local?: string;
  vehiculo_id: number | string;
  fecha: string; // ISO
  imagen_antes: string; // base64 or file_name
  imagen_antes_local_file?: string;
  tipo: string;
  mantenimiento: string;
  diagnostico: string;
  kilometraje_siguiente_revision: number;
  imagen_despues: string; // base64 or file_name
  imagen_despues_local_file?: string;
  nombre_mecanico: string;
  firma_mecanico?: string | null; // base64 signature (opcional)
  firma_responsable: string; // base64 hash
  created_by?: number;
  created_at?: string;
  synced?: boolean;
};

type VehicleRecord = {
  id: number | string;
  id_local?: string;
  synced?: boolean;
  type?: string;

  empresa_id: number;
  cliente_id: number;
  corpo_id: number; // sucursal_id
  division_id?: number;
  contrato_id?: number;
  puesto_id?: number;

  placa: string | null;
  tipo: string;
  tipo_autoria: string;
  estado?: string;
  kilometraje: number | null;
  prox_cambio_aceite: number | null;
  modelo: string | null;
  anno: number | null;
  marca: string;
  descripcion: string | null;

  titulo_propiedad: boolean | null;
  rtv: boolean | null;
  marchamo: boolean | null;

  firma_responsable: string;
  created_by?: number;
  created_at?: string;

  images?: VehicleImage[];
  usos?: VehicleUse[];
  mantenimientos?: VehicleMaintenance[];
};

/** Une lista del árbol principal con filas de `corporate_vehicles_corpo_cache` (offline / borradores). */
function mergeCorporateVehicleDisplayLists(a: VehicleRecord[], b: VehicleRecord[]): VehicleRecord[] {
  const map = new Map<string, VehicleRecord>();
  const keyOf = (v: VehicleRecord) => {
    const idNum = typeof v.id === 'number' && v.id > 0 ? v.id : null;
    if (idNum != null) return `n:${idNum}`;
    const loc =
      (v as any).id_local != null && String((v as any).id_local).trim() !== ''
        ? String((v as any).id_local)
        : typeof v.id === 'string' && v.id.startsWith('local-')
          ? v.id
          : '';
    if (loc) return `l:${loc}`;
    return `u:${String(v.id)}`;
  };
  const prefer = (cur: VehicleRecord, next: VehicleRecord) => {
    if (isCorporateVehicleLocalDraft(next) && !isCorporateVehicleLocalDraft(cur)) return next;
    return cur;
  };
  for (const v of a) map.set(keyOf(v), v);
  for (const v of b) {
    const k = keyOf(v);
    const cur = map.get(k);
    if (!cur) map.set(k, v);
    else map.set(k, prefer(cur, v));
  }
  return Array.from(map.values());
}

const getBase64Only = (value: string | null | undefined): string => {
  if (!value) return '';
  const s = String(value);
  if (s.startsWith('data:')) {
    const parts = s.split(',');
    return parts.length > 1 ? parts.slice(1).join(',') : '';
  }
  return s;
};

const decodeFirmaHash = (hash?: string | null) => {
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
};

/** Normaliza una fecha a YYYY-MM-DD. Acepta entrada en YYYY-MM-DD o DD-MM-YYYY (solo para guardar/envío). */
const normalizeDateToYMD = (value?: string): string => {
  const v = String(value || '').trim().split('T')[0];
  if (!v) return '';
  const ymdMatch = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymdMatch) return `${ymdMatch[1]}-${ymdMatch[2].padStart(2, '0')}-${ymdMatch[3].padStart(2, '0')}`;
  const dmyMatch = v.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
  return '';
};

const toIsoFromDateAndTime = (dateStr: string, timeStr: string) => {
  const d = normalizeDateToYMD(dateStr);
  const t = String(timeStr || '').trim();
  if (!d) return new Date().toISOString();
  const hhmm = t && /^\d{2}:\d{2}$/.test(t) ? t : '00:00';
  const base = new Date(`${d}T${hhmm}:00`);
  if (Number.isNaN(base.getTime())) return new Date().toISOString();
  // Ajuste por timezone para que la hora visual se mantenga
  const adjusted = new Date(base.getTime() - base.getTimezoneOffset() * 60000);
  return adjusted.toISOString();
};

const dateToYMD = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const timeToHHmm = (d: Date) => {
  const adjusted = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  const iso = adjusted.toISOString();
  return iso.substring(11, 16); // HH:mm
};

const normalizeTimeHHmm = (value?: string): string => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.includes('T')) return (raw.split('T')[1] || '').substring(0, 5);
  return raw.length >= 5 ? raw.substring(0, 5) : raw;
};

const timeHHmmToPickerDate = (value?: string): Date => {
  const normalized = normalizeTimeHHmm(value);
  if (!normalized) return new Date();
  const [h, m] = normalized.split(':');
  const date = new Date();
  date.setHours(Number(h) || 0, Number(m) || 0, 0, 0);
  return date;
};

const isoToDate = (iso?: string) => {
  if (!iso) return '';
  // Preservar la parte de fecha tal cual venga (YYYY-MM-DD o similar)
  return String(iso).split('T')[0];
};

/** Formato solo para visualización: devuelve DD-MM-YYYY. Acepta entrada en YYYY-MM-DD o DD-MM-YYYY. */
const formatYMDToDMY = (value?: string) => {
  const v = String(value || '').trim();
  if (!v) return '';
  const onlyDate = v.split('T')[0];
  const ymd = onlyDate.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymd) return `${ymd[3].padStart(2, '0')}-${ymd[2].padStart(2, '0')}-${ymd[1]}`;
  const dmy = onlyDate.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmy) return `${dmy[1].padStart(2, '0')}-${dmy[2].padStart(2, '0')}-${dmy[3]}`;
  return onlyDate;
};

const isoToTime = (iso?: string) => {
  if (!iso) return '';
  const s = String(iso);
  if (s.includes('T')) {
    const timePart = s.split('T')[1] || '';
    return timePart.substring(0, 5);
  }
  // Si viene solo HH:mm o HH:mm:ss lo normalizamos
  const m = s.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
  if (m) return `${m[1]}:${m[2]}`;
  return '';
};

const COMBUSTIBLE_OPTIONS = ['Vacío', 'Un cuarto', 'Medio', 'Tres cuartos', 'Lleno'];

type TipoBitacora = 'Vehículo' | 'Bicicleta' | 'Motocicleta';

function isTipoBicicleta(tipo: string): boolean {
  return String(tipo || '').trim() === 'Bicicleta';
}

function clearCamposNoAplicanBicicleta(setters: {
  setPlaca: (v: string) => void;
  setKilometraje: (v: string) => void;
  setProxCambioAceite: (v: string) => void;
  setModelo: (v: string) => void;
  setAnno: (v: string) => void;
  setTituloPropiedad: (v: boolean) => void;
  setRtv: (v: boolean) => void;
  setMarchamo: (v: boolean) => void;
}) {
  setters.setPlaca('');
  setters.setKilometraje('');
  setters.setProxCambioAceite('');
  setters.setModelo('');
  setters.setAnno('');
  setters.setTituloPropiedad(false);
  setters.setRtv(false);
  setters.setMarchamo(false);
}
type ReviewStatus = 'Bueno' | 'Malo' | 'No existe';
type YesNo = 'Sí' | 'No';

type GeneralEntry = {
  key: string;
  label: string;
  kind: 'readonly' | 'text' | 'date' | 'time' | 'select' | 'signature';
  required?: boolean;
  options?: string[];
};

type RevisionEntry = {
  key: string;
  label: string;
  kind: 'select' | 'radio' | 'heading' | 'text';
  required?: boolean;
  withObservation?: boolean;
};

const buildGeneralConfig = (tipo: TipoBitacora): GeneralEntry[] => {
  if (tipo === 'Motocicleta') {
    return [
      { key: 'empresa', label: 'Empresa', kind: 'readonly' },
      { key: 'cliente', label: 'Cliente', kind: 'readonly' },
      { key: 'nombre_oficial_corporacion', label: 'Nombre oficial de corporación', kind: 'text', required: true },
      { key: 'firma_oficial_corporacion', label: 'Firma (oficial corporación)', kind: 'signature', required: true },
      { key: 'fecha', label: 'Fecha', kind: 'date', required: true },
      { key: 'hora', label: 'Hora', kind: 'time', required: true },
      { key: 'codigo', label: 'Código', kind: 'text', required: true },
      { key: 'numero_placa', label: 'Número placa', kind: 'text', required: true },
      { key: 'marca', label: 'Marca', kind: 'text', required: true },
      { key: 'color', label: 'Color', kind: 'text', required: true },
      { key: 'nombre_oficial_transito', label: 'Nombre oficial de tránsito', kind: 'text', required: true },
      { key: 'firma_oficial_transito', label: 'Firma (oficial tránsito)', kind: 'signature', required: true },
    ];
  }

  if (tipo === 'Bicicleta') {
    return [
      { key: 'empresa', label: 'Empresa', kind: 'readonly' },
      { key: 'cliente', label: 'Cliente', kind: 'readonly' },
      { key: 'nombre_oficial_corporacion', label: 'Nombre oficial de corporación', kind: 'text', required: true },
      { key: 'firma_oficial_corporacion', label: 'Firma del oficial', kind: 'signature', required: true },
      { key: 'fecha', label: 'Fecha', kind: 'date', required: true },
      { key: 'hora', label: 'Hora', kind: 'time', required: true },
      { key: 'codigo', label: 'Código', kind: 'text', required: true },
      { key: 'numero_placa', label: 'Número de placa', kind: 'text', required: true },
      { key: 'marca', label: 'Marca', kind: 'text', required: true },
      { key: 'color', label: 'Color', kind: 'text', required: true },
      { key: 'nombre_oficial_transito', label: 'Nombre de oficial de tránsito', kind: 'text', required: true },
      { key: 'firma_oficial_transito', label: 'Firma (tránsito)', kind: 'signature', required: true },
    ];
  }

  // Vehículo
  return [
    { key: 'empresa', label: 'Empresa', kind: 'readonly' },
    { key: 'cliente', label: 'Cliente', kind: 'readonly' },
    { key: 'oficial_transito', label: 'Oficial de tránsito', kind: 'text', required: true },
    { key: 'codigo_oficial_transito', label: 'Código del oficial (tránsito)', kind: 'text', required: true },
    { key: 'firma_oficial_transito', label: 'Firma del oficial (tránsito)', kind: 'signature', required: true },
    { key: 'oficial_seguridad', label: 'Nombre oficial de seguridad', kind: 'text', required: true },
    { key: 'codigo_oficial_seguridad', label: 'Código del oficial (seguridad)', kind: 'text', required: true },
    { key: 'firma_oficial_seguridad', label: 'Firma del oficial (seguridad)', kind: 'signature', required: true },
    { key: 'fecha', label: 'Fecha', kind: 'date', required: true },
    { key: 'hora', label: 'Hora', kind: 'time', required: true },
    { key: 'km', label: 'KM que marca', kind: 'text', required: true },
    { key: 'numero_motor', label: 'Número de motor', kind: 'text', required: true },
    { key: 'numero_placa', label: 'Número de placa', kind: 'text', required: true },
    { key: 'marca', label: 'Marca', kind: 'text', required: true },
    { key: 'tipo_vehiculo', label: 'Tipo', kind: 'text', required: true },
    { key: 'color', label: 'Color', kind: 'text', required: true },
    { key: 'vin', label: 'Número de Vin o chases', kind: 'text', required: true },
    {
      key: 'combustible',
      label: 'Combustible',
      kind: 'select',
      required: true,
      options: ['Lleno', '3/4', '1/2', '1/4', 'Marcador malo'],
    },
    { key: 'encargado_deposito', label: 'Encargado de depósito', kind: 'text', required: true },
    { key: 'codigo_encargado', label: 'Código del encargado', kind: 'text', required: true },
    { key: 'firma_encargado', label: 'Firma del encargado', kind: 'signature', required: true },
  ];
};

const buildRevisionConfig = (tipo: TipoBitacora): RevisionEntry[] => {
  if (tipo === 'Motocicleta') {
    const motoItems = [
      'Guardabarro delantero',
      'Llanta delantera',
      'Aro delantero',
      'Compensadores delanteros',
      'Silvin',
      'Direccional delantero izquierdo',
      'Direccional delantero derecho',
      'Espejo delantero derecho',
      'Espejo delantero izquierdo',
      'Manija izquierda',
      'Manija derecha',
      'Velocímetro',
      'Tacómetro',
      'Cable de freno',
      'Cable de embrague',
      'Manivela',
      'Tanque',
      'Tapón de combustible',
      'Guardabarro trasero',
      'Llanta trasera',
      'Aro trasero',
      'Compensadores traseros',
      'Direccional trasero izquierdo',
      'Direccional trasero derecho',
      'Stop trasero',
      'Mufla',
      'Cadena',
      'Cubre cadena',
      'Patilla de cambios',
      'Patilla de frenos',
      'Asiento',
      'Batería',
      'Pinto',
      'Carburador',
    ];
    const base: RevisionEntry[] = motoItems.map((label) => ({
      key: `rev_${label.toLowerCase().replace(/\s+/g, '_')}`,
      label,
      kind: 'select',
      required: true,
      withObservation: false,
    }));
    base.push({ key: 'llaves', label: 'Llaves', kind: 'radio', required: true });
    base.push({ key: 'entregado_a', label: 'Entregado a', kind: 'text' });
    base.push({ key: 'fecha_entrega', label: 'Fecha de entrega', kind: 'text' });
    base.push({ key: 'hora_entrega', label: 'Hora de entrega', kind: 'text' });
    return base;
  }

  if (tipo === 'Bicicleta') {
    const items = [
      'Guardabarro delantero',
      'Llantas',
      'Eje delantero',
      'Orquilla delantera',
      'Manivela',
      'Manija izquierda',
      'Cobertor izquierdo',
      'Manija derecha',
      'Cobertor derecho',
      'Foco',
      'Cable de freno delantero',
      'Espejo retrovisor izquierdo',
      'Espejo retrovisor derecho',
      'Asiento',
      'Cadena',
      'Cubrecadena',
      'Llanta trasera',
      'Aro trasero',
      'Eje trasero',
      'Sistema de cambios',
      'Pedales',
      'Inflador',
      'Doble plato',
      'Pasador',
    ];
    return items.map((label) => ({
      key: `rev_${label.toLowerCase().replace(/\s+/g, '_')}`,
      label,
      kind: 'select',
      required: true,
      withObservation: true,
    }));
  }

  // Vehículo
  const external = [
    'Placa delantera',
    'Bumper delantero',
    'Silvin izquierdo delantero',
    'Direccional izquierdo delantero',
    'Direccional derecho delantero',
    'Silvin derecho delantero',
    'Luces para neblina',
    'Parrilla delantera',
    'Tapa de motor',
    'Parabrisas delantero',
    'Escobillas',
    'Guardabarro derecho delanter',
    'Llanta delantera derecha',
    'Aro delantero derecho',
    'Copa delantera derecha',
    'Puerta delantera derecha',
    'Puerta trasera derecha',
    'Espejo lateral derecho',
    'Costado derecho de pintura',
    'Costado derecho de vidrios',
    'Costado derecho de carrocería',
    'Guardabarro trasero derecho',
    'Llanta trasera derecha',
    'Aro trasero derecho',
    'Copa trasera derecha',
    'Bumper trasero',
    'Cajón o batea',
    'Cabina posterior',
    'Placa trasera',
    'Luces de placa trasera',
    'Direccional trasero derecho',
    'Direccional trasero izquierdo',
    'Parabrisas trasero',
    'Guardabarro trasero izquierdo',
    'Llanta trasera izquierda',
    'Aro trasero izquierdo',
    'Copa trasera izquierda',
    'Puerta trasera izquierda',
    'Puerta delantera izquierda',
    'Espejo lateral izquierdo',
    'Costado izquierdo de pintura',
    'Costado izquierdo de vidrios',
    'Costado izquierdo de carrocería',
    'Guardabarro delantero izquierdo',
    'Llanta izquierda delantera',
    'Aro delantero izquierdo',
    'Copa delantera izquierda',
    'Techo de vehículo',
    'Canasta',
  ];
  const internal = [
    'Velocímetro',
    'Espejo retrovisor interno',
    'Alfombras',
    'Asientos delanteros',
    'Asientos traseros',
    'Cubreasientos',
    'Silla porta menores de edad',
    'Búster para menores',
    'Cinturones de seguridad',
    'Hules de pedales',
    'Perilla de marcha',
    'Encendedor',
    'Ceniceros',
    "Radio musical (Marca)",
    'Planta de radio',
    'Parlantes para radio',
    "Discos o Cd's",
    'Casetes',
    'Antena musical',
    'Herramientas ¿Cuántas?',
    'Llave rana',
    'Gata',
    'Triangulo de seguridad',
    'Extintor de incendios',
    'Botiquín de primeros auxilios',
    'Lagartos',
    'Chaleco',
    'Conos',
    'Llanta de repuesto',
    'Llave de ignición del vehículo',
    'Tapón de radiado',
    'Tapón de aceite',
    'Batería (Acumulador)',
    'Depurador',
    'Carburador',
    'Tapa carburador',
    'Bobina',
    'Distribuidor',
    'Mangueras del distribuidor',
    'Chupones de las bujías',
    'Mangueras',
    'Alternador o generador',
    'Arrancador',
    'Mufla o silenciador',
    'Tapón de combustible',
  ];

  const cfg: RevisionEntry[] = [];
  cfg.push({ key: 'heading_externos', label: 'Accesorios externos', kind: 'heading' });
  cfg.push(
    ...external.map<RevisionEntry>((label) => ({
      key: `rev_${label.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
      label,
      kind: 'select',
      required: true,
      withObservation: true,
    }))
  );
  cfg.push({ key: 'heading_internos', label: 'Accesorios internos', kind: 'heading' });
  cfg.push(
    ...internal.map<RevisionEntry>((label) => ({
      key: `rev_${label.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
      label,
      kind: 'select',
      required: true,
      withObservation: true,
    }))
  );
  cfg.push({ key: 'funciona_motor', label: '¿Funciona el motor?', kind: 'radio', required: true });
  return cfg;
};

const signatureWebStyle = `
  .m-signature-pad {box-shadow: none; border: none;}
  .m-signature-pad--body {border: 1px solid #e0e0e0;}
  .m-signature-pad--footer {display: none; margin: 0px;}
  body,html {width: 100%; height: 100%; margin: 0; padding: 0;}
`;

const safeParse = <T,>(value: any, fallback: T): T => {
  try {
    if (typeof value === 'string') {
      const t = value.trim();
      if (!t) return fallback;
      return JSON.parse(t) as T;
    }
    if (value === null || value === undefined) return fallback;
    return value as T;
  } catch {
    return fallback;
  }
};

type RoleName = 'OPERATIVO' | 'SUPERVISOR' | 'ADMINISTRATIVO' | string | null;

function numOrNull(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getDivisionIdFromMarcaJson(marca: any): number | null {
  const raw =
    marca?.roleDivision?.division?.id ??
    marca?.role_division?.division?.id ??
    marca?.division?.id ??
    marca?.division_id;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

type HierarchyCorpoIds = {
  empresaId: number;
  clienteId: number;
  divisionId: number;
  contratoId: number;
  corpoId: number;
};

function findHierarchyByCorpoIn(structureArr: MainStructureTree, corpoId: number): HierarchyCorpoIds | null {
  const cid = Number(corpoId);
  if (!Number.isFinite(cid)) return null;
  for (const empresa of structureArr || []) {
    for (const cliente of empresa?.clientes || []) {
      const divA = Array.isArray(cliente.division) ? cliente.division : [];
      const divB = Array.isArray(cliente.divisiones) ? cliente.divisiones : [];
      const byDivId = new Map<number, any>();
      for (const d of [...divA, ...divB]) {
        const id = Number(d?.id);
        if (Number.isFinite(id) && !byDivId.has(id)) byDivId.set(id, d);
      }
      for (const division of byDivId.values()) {
        for (const contrato of division.contratos || []) {
          for (const sucursal of contrato.sucursales || []) {
            if (Number(sucursal.id) === cid) {
              return {
                empresaId: Number(empresa.id),
                clienteId: Number(cliente.id),
                divisionId: Number(division.id),
                contratoId: Number(contrato.id),
                corpoId: Number(sucursal.id),
              };
            }
          }
        }
      }
    }
  }
  return null;
}

export default function CorporateVehiclesScreen() {
  const navigation = useNavigation<Nav>();
  const { employee, refreshAccessToken, logout, accessToken } = useAuth();
  const { scanQR, QRScannerComponent } = useQRScanner();
  const appendTokenToUrl = (url: string) => {
    if (!url) return '';
    if (!accessToken || accessToken.trim().length === 0) return url;
    if (/[?&]token=/.test(url)) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}token=${encodeURIComponent(accessToken)}`;
  };

  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [hasCurrentMarca, setHasCurrentMarca] = useState(true);
  const [marcaDivisionId, setMarcaDivisionId] = useState<number | null>(null);
  const [marcaCorpoId, setMarcaCorpoId] = useState<number | null>(null);
  const [marcaClienteId, setMarcaClienteId] = useState<number | null>(null);
  const [marcaEmpresaId, setMarcaEmpresaId] = useState<number | null>(null);
  const [marcaContratoId, setMarcaContratoId] = useState<number | null>(null);
  const [marcaPuestoId, setMarcaPuestoId] = useState<number | null>(null);
  const [roleName, setRoleName] = useState<RoleName>(null);
  const listFiltersSyncedFromMarcaOnceRef = useRef(false);
  const [deletingRecordKey, setDeletingRecordKey] = useState<string | null>(null);
  const [deletingUseKey, setDeletingUseKey] = useState<string | null>(null);
  const [deletingMaintenanceKey, setDeletingMaintenanceKey] = useState<string | null>(null);
  const [deletingMaintImageKey, setDeletingMaintImageKey] = useState<string | null>(null);

  // Estados para filtros jerárquicos
  const [filterEmpresaId, setFilterEmpresaId] = useState<number | null>(null);
  const [filterClienteId, setFilterClienteId] = useState<number | null>(null);
  const [filterDivisionId, setFilterDivisionId] = useState<number | null>(null);
  const [filterContratoId, setFilterContratoId] = useState<number | null>(null);
  const [filterCorpoId, setFilterCorpoId] = useState<number | null>(null);
  const [isHierarchyFiltersExpanded, setIsHierarchyFiltersExpanded] = useState(false);

  // estructura
  const [structure, setStructure] = useState<MainStructureTree>([]);
  const [isStructureLoading, setIsStructureLoading] = useState(false);

  const [selectedEmpresaId, setSelectedEmpresaId] = useState<number | null>(null);
  const [selectedClienteId, setSelectedClienteId] = useState<number | null>(null);
  const [selectedDivisionId, setSelectedDivisionId] = useState<number | null>(null);
  const [selectedContratoId, setSelectedContratoId] = useState<number | null>(null);
  const [selectedSucursalId, setSelectedSucursalId] = useState<number | null>(null);
  const [selectedPuestoId, setSelectedPuestoId] = useState<number | null>(null);

  // lista
  const [records, setRecords] = useState<VehicleRecord[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Modal: ver cambios (auditoría)
  const [isCambiosModalVisible, setIsCambiosModalVisible] = useState(false);
  const [cambiosTitle, setCambiosTitle] = useState<string>('Cambios');
  const [cambiosItems, setCambiosItems] = useState<any[]>([]);
  const [expandedCambioId, setExpandedCambioId] = useState<number | null>(null);

  // submódulo: usos (modal)
  const [usesModalVisible, setUsesModalVisible] = useState(false);
  const [usesVehicleKey, setUsesVehicleKey] = useState<string | null>(null);
  const [useRecords, setUseRecords] = useState<VehicleUse[]>([]);
  const [isUseFormOpen, setIsUseFormOpen] = useState(false);
  const [useEditing, setUseEditing] = useState<VehicleUse | null>(null);
  const [expandedBitacoras, setExpandedBitacoras] = useState<Set<string>>(new Set());

  const [useNombreConductor, setUseNombreConductor] = useState('');
  const [useCodigoConductor, setUseCodigoConductor] = useState('');
  const [useInicioFecha, setUseInicioFecha] = useState(''); // YYYY-MM-DD
  const [useInicioHora, setUseInicioHora] = useState(''); // HH:mm
  const [useFinFecha, setUseFinFecha] = useState(''); // YYYY-MM-DD
  const [useFinHora, setUseFinHora] = useState(''); // HH:mm
  const [useCombInicio, setUseCombInicio] = useState('');
  const [useCombFin, setUseCombFin] = useState('');
  const [useKmInicio, setUseKmInicio] = useState('');
  const [useKmFin, setUseKmFin] = useState('');
  const [useMotivo, setUseMotivo] = useState('');
  const [useFirmaConductor, setUseFirmaConductor] = useState<string>('');
  const [useFirmaResponsable, setUseFirmaResponsable] = useState<FirmaData | null>(null);

  // pickers (fechas/horas) para usos
  const [showUseDatePicker, setShowUseDatePicker] = useState(false);
  const [useDatePickerValue, setUseDatePickerValue] = useState(new Date());
  const [showUseTimePicker, setShowUseTimePicker] = useState(false);
  const [useTimePickerValue, setUseTimePickerValue] = useState(new Date());
  const [usePickerKey, setUsePickerKey] = useState<'inicio_fecha' | 'inicio_hora' | 'fin_fecha' | 'fin_hora' | null>(null);

  // submódulo: mantenimiento (modal)
  const [maintenanceModalVisible, setMaintenanceModalVisible] = useState(false);
  const [maintenanceVehicleKey, setMaintenanceVehicleKey] = useState<string | null>(null);
  const [maintenanceRecords, setMaintenanceRecords] = useState<VehicleMaintenance[]>([]);
  const [isMaintenanceFormOpen, setIsMaintenanceFormOpen] = useState(false);
  const [maintenanceEditing, setMaintenanceEditing] = useState<VehicleMaintenance | null>(null);

  const [maintenanceFecha, setMaintenanceFecha] = useState(''); // YYYY-MM-DD
  const [maintenanceImagenAntes, setMaintenanceImagenAntes] = useState<string>(''); // preview uri
  const [maintenanceImagenAntesRef, setMaintenanceImagenAntesRef] = useState<string>(''); // local file reference
  const [maintenanceTipo, setMaintenanceTipo] = useState('');
  const [maintenanceMantenimiento, setMaintenanceMantenimiento] = useState('');
  const [maintenanceDiagnostico, setMaintenanceDiagnostico] = useState('');
  const [maintenanceKmSiguiente, setMaintenanceKmSiguiente] = useState('');
  const [maintenanceImagenDespues, setMaintenanceImagenDespues] = useState<string>(''); // preview uri
  const [maintenanceImagenDespuesRef, setMaintenanceImagenDespuesRef] = useState<string>(''); // local file reference
  const [maintenanceNombreMecanico, setMaintenanceNombreMecanico] = useState('');
  const [maintenanceFirmaMecanico, setMaintenanceFirmaMecanico] = useState<string>(''); // base64 signature
  const [maintenanceFirmaResponsable, setMaintenanceFirmaResponsable] = useState<FirmaData | null>(null);

  // pickers para mantenimiento
  const [showMaintenanceDatePicker, setShowMaintenanceDatePicker] = useState(false);
  const [maintenanceDatePickerValue, setMaintenanceDatePickerValue] = useState(new Date());

  // cámara para fotos
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [cameraType, setCameraType] = useState<'antes' | 'despues' | null>(null);
  const cameraRef = useRef<any>(null);

  // signature modal para firma_mecanico
  const signatureRef = useRef<any>(null);
  const [signatureModalVisible, setSignatureModalVisible] = useState(false);
  const [signatureKey, setSignatureKey] = useState(0);
  const [signatureTarget, setSignatureTarget] = useState<'maintenance_mecanico' | 'use_conductor' | null>(null);

  const usesVehicle = useMemo(() => {
    if (!usesVehicleKey) return null;
    return records.find((r) => String(r.id || r.id_local) === usesVehicleKey) ?? null;
  }, [records, usesVehicleKey]);

  // crear/editar
  const [isCreating, setIsCreating] = useState(false);
  const [editing, setEditing] = useState<{ id: number | string; id_local?: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResponse, setSubmitResponse] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [isSubmittingUse, setIsSubmittingUse] = useState(false);
  const [submitResponseUse, setSubmitResponseUse] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [isSubmittingMaintenance, setIsSubmittingMaintenance] = useState(false);
  const [submitResponseMaintenance, setSubmitResponseMaintenance] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // form
  const [placa, setPlaca] = useState('');
  const [tipo, setTipo] = useState('');
  const [estado, setEstado] = useState<'Activo' | 'Inactivo'>('Activo');
  const [kilometraje, setKilometraje] = useState('');
  const [proxCambioAceite, setProxCambioAceite] = useState('');
  const [tipoAutoria, setTipoAutoria] = useState('');
  const [modelo, setModelo] = useState('');
  const [anno, setAnno] = useState('');
  const [marca, setMarca] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [tituloPropiedad, setTituloPropiedad] = useState(true);
  const [rtv, setRtv] = useState(true);
  const [marchamo, setMarchamo] = useState(true);

  // firma responsable (QR/generar)
  const [firmaResponsable, setFirmaResponsable] = useState<FirmaData | null>(null);
  const [isGeneratingFirma, setIsGeneratingFirma] = useState(false);

  // imágenes
  const [imageFiles, setImageFiles] = useState<LocalImage[]>([]);

  const closeCambiosModal = () => {
    setIsCambiosModalVisible(false);
    setCambiosItems([]);
    setExpandedCambioId(null);
  };

  const formatCambioCreatedAt = (value: any) => {
    if (!value) return '-';
    try {
      const date = new Date(value);
      return date.toLocaleString('es-CR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
    } catch {
      return String(value);
    }
  };

  const formatChangeValue = (prop: string, value: any): string => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  const fetchCambios = useCallback(async (tabla: string, registroId: number) => {
    const isConnected = await getConnectionStatus();
    if (!isConnected) {
      Alert.alert('Sin conexión', 'Esta función solo está disponible con conexión a internet.');
      return;
    }
    try {
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) throw new Error('Server URL not configured');
      const resp = await authedFetch({
        url: `${apiUrl}/api/cambios-apps-modules?tabla=${encodeURIComponent(tabla)}&registro_id=${registroId}`,
        init: {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
        refreshAccessToken,
        logout,
      });
      if (!resp) return;

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.status) {
        throw new Error(data.message || 'No se pudieron cargar los cambios');
      }
      setCambiosItems(Array.isArray(data.data) ? data.data : []);
      setIsCambiosModalVisible(true);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'No se pudieron cargar los cambios');
    }
  }, [refreshAccessToken, logout]);

  const getConnectionStatus = async (): Promise<boolean> => {
    //return false;
    const networkState = await Network.getNetworkStateAsync();

    return (
      networkState.isConnected === true &&
      networkState.isInternetReachable === true
    );
  };

  type MarcaSnapshot = {
    current: Record<string, any>;
    roleName: RoleName;
    isOperativo: boolean;
    marcaDivisionId: number | null;
    marcaCorpoId: number | null;
    marcaClienteId: number | null;
    marcaEmpresaId: number | null;
    filterEmpresaId: number | null;
    filterClienteId: number | null;
    filterDivisionId: number | null;
    filterContratoId: number | null;
    filterCorpoId: number | null;
  };

  const syncMarcaFromStorage = useCallback(
    async (opts?: { applyFiltersFromMarca?: boolean }): Promise<MarcaSnapshot | null> => {
      const applyFiltersFromMarca = opts?.applyFiltersFromMarca !== false;
    const currentMarcaStr = await AsyncStorage.getItem('current_marca');
    if (!currentMarcaStr) {
      setHasCurrentMarca(false);
      setMarcaDivisionId(null);
      setMarcaCorpoId(null);
      setMarcaClienteId(null);
      setMarcaEmpresaId(null);
      setMarcaContratoId(null);
      setMarcaPuestoId(null);
        setRoleName(null);
        if (applyFiltersFromMarca) {
          setFilterEmpresaId(null);
          setFilterClienteId(null);
          setFilterDivisionId(null);
          setFilterContratoId(null);
          setFilterCorpoId(null);
        }
      return null;
    }
    try {
      const current = JSON.parse(currentMarcaStr);
      if (!current) {
        setHasCurrentMarca(false);
        return null;
      }
      setHasCurrentMarca(true);
        const divIdRaw = current?.roleDivision?.division?.id ?? current?.division_id;
      const corpoIdRaw = current?.corpo?.id ?? current?.corpo_id;
      const clienteIdRaw = current?.cliente?.id ?? current?.cliente_id;
      const empresaIdRaw = current?.empresa?.id ?? current?.empresa_id;
        const divId = numOrNull(divIdRaw);
        const corpoId = numOrNull(corpoIdRaw);
        const clienteId = numOrNull(clienteIdRaw);
        const empresaId = numOrNull(empresaIdRaw);
        const role =
          current?.roleDivision?.role?.nombre ??
          current?.role_division?.role?.nombre ??
          null;
        const rn = typeof role === 'string' ? (role as RoleName) : null;

        setMarcaDivisionId(divId);
        setMarcaCorpoId(corpoId);
        setMarcaClienteId(clienteId);
        setMarcaEmpresaId(empresaId);
        setMarcaContratoId(numOrNull(current?.contrato?.id));
        setMarcaPuestoId(
          numOrNull(
            current?.puesto?.id ??
              current?.plaza?.puesto?.id ??
              current?.roleDivision?.puesto_id ??
              current?.role_division?.puesto_id
          )
        );
        setRoleName(rn);

        const divFromMarca = getDivisionIdFromMarcaJson(current);
        const fe = numOrNull(current?.empresa?.id);
        const fc = numOrNull(current?.cliente?.id);
        const fco = numOrNull(current?.contrato?.id);
        const fs = numOrNull(current?.corpo?.id);
        if (applyFiltersFromMarca) {
          setFilterEmpresaId(fe);
          setFilterClienteId(fc);
          setFilterDivisionId(divFromMarca);
          setFilterContratoId(fco);
          setFilterCorpoId(fs);
        }

        return {
          current,
          roleName: rn,
          isOperativo: rn === 'OPERATIVO',
          marcaDivisionId: divId,
          marcaCorpoId: corpoId,
          marcaClienteId: clienteId,
          marcaEmpresaId: empresaId,
          filterEmpresaId: fe,
          filterClienteId: fc,
          filterDivisionId: divFromMarca,
          filterContratoId: fco,
          filterCorpoId: fs,
        };
    } catch {
      setHasCurrentMarca(false);
      setMarcaDivisionId(null);
      setMarcaCorpoId(null);
      setMarcaClienteId(null);
      setMarcaEmpresaId(null);
      setMarcaContratoId(null);
      setMarcaPuestoId(null);
        setRoleName(null);
      return null;
    }
    },
    []
  );

  const resetListFiltersFromCurrentMarca = useCallback(async () => {
    try {
      const currentMarcaStr = await AsyncStorage.getItem('current_marca');
      if (!currentMarcaStr) return;
      const currentMarca = JSON.parse(currentMarcaStr);
      const divId = getDivisionIdFromMarcaJson(currentMarca);
      setFilterEmpresaId(currentMarca.empresa?.id != null ? Number(currentMarca.empresa.id) : null);
      setFilterClienteId(currentMarca.cliente?.id != null ? Number(currentMarca.cliente.id) : null);
      setFilterDivisionId(divId);
      setFilterContratoId(currentMarca.contrato?.id != null ? Number(currentMarca.contrato.id) : null);
      setFilterCorpoId(currentMarca.corpo?.id != null ? Number(currentMarca.corpo.id) : null);
    } catch (e) {
      console.error('resetListFiltersFromCurrentMarca (CorporateVehicles):', e);
    }
  }, []);

  /** Creación: precargar jerarquía solo desde JSON de marca (sin recorrer árbol por corpo_id). */
  const applyCurrentMarcaToCreateHierarchy = useCallback(async () => {
    try {
      const currentMarcaStr = await AsyncStorage.getItem('current_marca');
      if (!currentMarcaStr) return;
      const marca = JSON.parse(currentMarcaStr);
      const rn = marca?.roleDivision?.role?.nombre ?? marca?.role_division?.role?.nombre ?? null;
      if (rn === 'OPERATIVO') return;

      setSelectedEmpresaId(marca.empresa?.id != null ? Number(marca.empresa.id) : null);
      setSelectedClienteId(marca.cliente?.id != null ? Number(marca.cliente.id) : null);
      setSelectedDivisionId(getDivisionIdFromMarcaJson(marca));
      setSelectedContratoId(marca.contrato?.id != null ? Number(marca.contrato.id) : null);
      setSelectedSucursalId(marca.corpo?.id != null ? Number(marca.corpo.id) : null);
      const pId =
        marca.puesto?.id != null
          ? Number(marca.puesto.id)
          : numOrNull(marca?.plaza?.puesto?.id ?? marca?.plaza?.puesto_id);
      setSelectedPuestoId(pId);
    } catch (e) {
      console.error('applyCurrentMarcaToCreateHierarchy (CorporateVehicles):', e);
    }
  }, []);

  const fetchMainStructure = useCallback(async () => {
    setIsStructureLoading(true);
    try {
      const fragments = await loadMainStructureFragmentsObject();
      if (fragments && Object.keys(fragments).length > 0) {
        const mergedFromFrag = mergeMainStructureFragments(fragments);
        if (Array.isArray(mergedFromFrag) && mergedFromFrag.length > 0) {
          setStructure(mergedFromFrag);
          return;
        }
      }
      const merged = await loadMainStructureTreeMerged();
      if (Array.isArray(merged)) setStructure(merged);
    } finally {
      setIsStructureLoading(false);
    }
  }, []);

  const empresas = useMemo(() => (Array.isArray(structure) ? structure : []), [structure]);
  const clientes = useMemo(() => {
    const emp = empresas.find((e: any) => Number(e.id) === Number(selectedEmpresaId));
    return emp?.clientes || [];
  }, [empresas, selectedEmpresaId]);
  const divisiones = useMemo(() => {
    const cli = clientes.find((c: any) => Number(c.id) === Number(selectedClienteId));
    // La estructura usa `division` (como en otras pantallas). Mantenemos fallback a `divisiones` por compat.
    return cli?.division || cli?.divisiones || [];
  }, [clientes, selectedClienteId]);
  const contratos = useMemo(() => {
    const div = divisiones.find((d: any) => Number(d.id) === Number(selectedDivisionId));
    return div?.contratos || [];
  }, [divisiones, selectedDivisionId]);
  const sucursales = useMemo(() => {
    const cont = contratos.find((c: any) => Number(c.id) === Number(selectedContratoId));
    return cont?.sucursales || [];
  }, [contratos, selectedContratoId]);

  const selectedSucursalNodeForForm = useMemo(() => {
    if (!selectedSucursalId) return null;
    for (const emp of empresas) {
      for (const cli of emp?.clientes || []) {
        const divs = cli?.division || cli?.divisiones || [];
        for (const div of divs) {
          for (const ct of div?.contratos || []) {
            for (const suc of ct?.sucursales || []) {
              if (Number(suc?.id) === Number(selectedSucursalId)) return suc;
            }
          }
        }
      }
    }
    return null;
  }, [empresas, selectedSucursalId]);

  const puestosForm = useMemo(() => {
    const arr = selectedSucursalNodeForForm?.puestos;
    return Array.isArray(arr) ? arr : [];
  }, [selectedSucursalNodeForForm]);

  // Nodos computados para filtros jerárquicos
  const filterEmpresas = useMemo(() => (Array.isArray(structure) ? structure : []), [structure]);

  const filterClientes = useMemo(() => {
    const empresa = filterEmpresas.find((e: any) => e.id === filterEmpresaId);
    return empresa?.clientes || [];
  }, [filterEmpresas, filterEmpresaId]);

  const filterDivisiones = useMemo(() => {
    if (!filterClienteId) return [];
    const empresa = filterEmpresas.find((e: any) => e.id === filterEmpresaId);
    if (!empresa) return [];
    const cliente = empresa.clientes?.find((c: any) => c.id === filterClienteId);
    if (!cliente) return [];
    return cliente.division || cliente.divisiones || [];
  }, [filterEmpresas, filterEmpresaId, filterClienteId]);

  const filterContratos = useMemo(() => {
    if (!filterDivisionId) return [];
    const empresa = filterEmpresas.find((e: any) => e.id === filterEmpresaId);
    if (!empresa) return [];
    const cliente = empresa.clientes?.find((c: any) => c.id === filterClienteId);
    if (!cliente) return [];
    const divs = cliente.division || cliente.divisiones || [];
    const division = divs.find((d: any) => Number(d.id) === Number(filterDivisionId));
    return division?.contratos || [];
  }, [filterEmpresas, filterEmpresaId, filterClienteId, filterDivisionId]);

  const filterSucursales = useMemo(() => {
    // Sucursal depende del contrato (cadena: Empresa -> Cliente -> División -> Contrato -> Sucursal)
    if (!filterClienteId || filterContratoId == null) return [];

    const empresa = filterEmpresas.find((e: any) => e.id === filterEmpresaId);
    if (!empresa) return [];
    const cliente = empresa.clientes?.find((c: any) => c.id === filterClienteId);
    if (!cliente) return [];

    const divs = cliente.division || cliente.divisiones || [];
    const sucursalesMap = new Map<number, any>();

    divs.forEach((division: any) => {
      if (filterDivisionId != null && Number(division.id) !== Number(filterDivisionId)) return;
      (division.contratos || []).forEach((contrato: any) => {
        if (Number(contrato.id) !== Number(filterContratoId)) return;
        (contrato.sucursales || []).forEach((sucursal: any) => {
          const idNum = Number(sucursal?.id);
          if (!sucursalesMap.has(idNum)) sucursalesMap.set(idNum, sucursal);
        });
      });
    });

    return Array.from(sucursalesMap.values());
  }, [filterEmpresas, filterEmpresaId, filterClienteId, filterDivisionId, filterContratoId]);

  const findPathForSucursal = useCallback(
    (clienteId: number | null, sucursalId: number | null) => {
      if (!clienteId || !sucursalId) return null;
      const tree = Array.isArray(structure) ? structure : [];

      // 1) Búsqueda priorizando el cliente
      for (const emp of tree) {
        const clientesLocal = emp?.clientes || [];
        const cli = clientesLocal.find((c: any) => Number(c.id) === Number(clienteId));
        if (!cli) continue;
        const divs = cli?.division || cli?.divisiones || [];
        for (const div of divs) {
          for (const ct of div?.contratos || []) {
            for (const suc of ct?.sucursales || []) {
              if (Number(suc?.id) === Number(sucursalId)) {
                return {
                  empresa_id: Number(emp.id),
                  cliente_id: Number(cli.id),
                  division_id: Number(div.id),
                  contrato_id: Number(ct.id),
                  sucursal_id: Number(suc.id),
                };
              }
            }
          }
        }
      }

      // 2) Fallback: buscar solo por sucursal
      for (const emp of tree) {
        for (const cli of emp?.clientes || []) {
          const divs = cli?.division || cli?.divisiones || [];
          for (const div of divs) {
            for (const ct of div?.contratos || []) {
              for (const suc of ct?.sucursales || []) {
                if (Number(suc?.id) === Number(sucursalId)) {
                  return {
                    empresa_id: Number(emp.id),
                    cliente_id: Number(cli.id),
                    division_id: Number(div.id),
                    contrato_id: Number(ct.id),
                    sucursal_id: Number(suc.id),
                  };
                }
              }
            }
          }
        }
      }
      return null;
    },
    [structure]
  );

  const handleEmpresaChange = (empresaId: number | null) => {
    setSelectedEmpresaId(empresaId);
    setSelectedClienteId(null);
    setSelectedDivisionId(null);
    setSelectedContratoId(null);
    setSelectedSucursalId(null);
  };
  const handleClienteChange = (clienteId: number | null) => {
    setSelectedClienteId(clienteId);
    setSelectedDivisionId(null);
    setSelectedContratoId(null);
    setSelectedSucursalId(null);
  };
  const handleDivisionChange = (divisionId: number | null) => {
    setSelectedDivisionId(divisionId);
    setSelectedContratoId(null);
    setSelectedSucursalId(null);
  };
  const handleContratoChange = (contratoId: number | null) => {
    setSelectedContratoId(contratoId);
    setSelectedSucursalId(null);
  };
  const handleSucursalChange = (sucursalId: number | null) => {
    setSelectedSucursalId(sucursalId);
    setSelectedPuestoId(null);
  };

  const toggleExpanded = (key: string) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  };

  const buildImageUrl = (vehiculoId: number | undefined, img: VehicleImage) => {
    const stored =
      (typeof img.stored_file_name === 'string' && img.stored_file_name.trim()) ||
      (typeof img.localFileName === 'string' && img.localFileName.trim()) ||
      '';
    if (stored) {
      const uri = getLocalFileDisplayUri(stored.trim());
      if (uri) return uri;
    }
    const hasLocal = img.id_local && String(img.id_local).trim().length > 0;
    if (hasLocal && img.base64) {
      const ext = (img.extension || 'jpg').toLowerCase();
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      return `data:${mime};base64,${img.base64}`;
    }

    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (apiUrl && vehiculoId) {
      return appendTokenToUrl(`${apiUrl}/api/corporate-vehicles/${vehiculoId}/get-image/${encodeURIComponent(img.name)}`);
    }
    return '';
  };

  const buildMaintenanceImageUrl = (vehiculoId: number | undefined, imageName: string | null | undefined) => {
    if (!imageName || imageName.trim().length === 0) return '';

    // Si es una data URI (base64), retornarla directamente
    if (imageName.startsWith('data:')) {
      return imageName;
    }
    const localUri = getLocalFileDisplayUri(imageName.trim());
    if (localUri) return localUri;

    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (apiUrl && vehiculoId) {
      return appendTokenToUrl(`${apiUrl}/api/corporate-vehicles/${vehiculoId}/get-maintenance-image/${encodeURIComponent(imageName)}`);
    }
    return '';
  };

  const updateMainStructureCacheFromFetchedVehicles = useCallback(
    async (params: { sucursalId: number | null; vehicles: VehicleRecord[] }) => {
      const { sucursalId, vehicles } = params;
      if (!sucursalId || !Array.isArray(vehicles) || vehicles.length === 0) return;

      try {
        const tree = await loadMainStructureTreeMerged();
        if (!Array.isArray(tree) || tree.length === 0) return;

        let updated = false;

        for (const empresa of tree) {
          const clientes = empresa?.clientes || [];
          for (const cliente of clientes) {
            const divisiones = cliente?.division || cliente?.divisiones || [];
            for (const division of divisiones) {
              const contratos = division?.contratos || [];
              for (const contrato of contratos) {
                const sucursales = contrato?.sucursales || [];
                for (const sucursal of sucursales) {
                  if (Number(sucursal?.id) !== Number(sucursalId)) continue;

                  const targetKey = Array.isArray(sucursal?.vehiculos_corporativos)
                    ? 'vehiculos_corporativos'
                    : Array.isArray(sucursal?.c_vehiculos_corporativos)
                      ? 'c_vehiculos_corporativos'
                      : 'vehiculos_corporativos';

                  const vehiculos: any[] = Array.isArray(sucursal?.[targetKey])
                    ? sucursal[targetKey]
                    : [];

                  // Mapa por id para upsert sin destruir los demás campos del objeto.
                  const byId = new Map<number, any>();
                  for (const v of vehiculos) {
                    const vid = Number(v?.id);
                    if (Number.isFinite(vid)) byId.set(vid, v);
                  }

                  for (const fv of vehicles) {
                    const fid = Number((fv as any)?.id);
                    if (!Number.isFinite(fid)) continue;

                    const existing = byId.get(fid);
                    if (existing) {
                      // Actualizamos usos (incluye bitacora desde el endpoint GET).
                      if (Array.isArray((fv as any)?.usos)) {
                        const serverUsos = (fv as any).usos;
                        const currentUsos: any[] = Array.isArray(existing.usos)
                          ? existing.usos
                          : Array.isArray(existing.c_usos_vehiculos_corporativos)
                            ? existing.c_usos_vehiculos_corporativos
                            : [];

                        // Conservamos usos locales/pendientes si existieran (id_local o synced=false).
                        const serverIds = new Set(
                          serverUsos
                            .map((u: any) => (typeof u?.id === 'number' ? u.id : null))
                            .filter((id: any) => Number.isFinite(id))
                        );
                        const localUnsyncedUsos = currentUsos.filter((u: any) => {
                          const idLocal = u?.id_local;
                          const id = u?.id;
                          if (typeof idLocal === 'string' && idLocal.startsWith('local-')) return true;
                          if (typeof id === 'string' && id.startsWith('local-')) return true;
                          if (u?.synced === false) return true;
                          return false;
                        });
                        const localToKeep = localUnsyncedUsos.filter((u: any) => {
                          const idNum = typeof u?.id === 'number' ? u.id : null;
                          if (idNum != null && serverIds.has(idNum)) return false;
                          return true;
                        });

                        const mergedUsos = [...serverUsos, ...localToKeep];
                        existing.usos = mergedUsos;
                        // Algunos módulos usan el alias "c_usos_..." si no existe "usos".
                        existing.c_usos_vehiculos_corporativos = mergedUsos;
                      }

                      // Actualizamos mantenimientos.
                      if (Array.isArray((fv as any)?.mantenimientos)) {
                        const serverMants = (fv as any).mantenimientos;
                        const currentMants: any[] = Array.isArray(existing.mantenimientos)
                          ? existing.mantenimientos
                          : Array.isArray(existing.c_mantenimiento_vehiculos_corporativos)
                            ? existing.c_mantenimiento_vehiculos_corporativos
                            : [];

                        const serverMantIds = new Set(
                          serverMants
                            .map((m: any) => (typeof m?.id === 'number' ? m.id : null))
                            .filter((id: any) => Number.isFinite(id))
                        );
                        const localUnsyncedMants = currentMants.filter((m: any) => {
                          const idLocal = m?.id_local;
                          const id = m?.id;
                          if (typeof idLocal === 'string' && idLocal.startsWith('local-')) return true;
                          if (typeof id === 'string' && id.startsWith('local-')) return true;
                          if (m?.synced === false) return true;
                          return false;
                        });
                        const localMantsToKeep = localUnsyncedMants.filter((m: any) => {
                          const idNum = typeof m?.id === 'number' ? m.id : null;
                          if (idNum != null && serverMantIds.has(idNum)) return false;
                          return true;
                        });

                        const mergedMants = [...serverMants, ...localMantsToKeep];
                        existing.c_mantenimiento_vehiculos_corporativos = mergedMants;
                      }

                      // Actualizamos campos base (sin tocar imágenes para evitar perder base64 offline).
                      const baseFields = [
                        'empresa_id',
                        'cliente_id',
                        'sucursal_id',
                        'corpo_id',
                        'placa',
                        'tipo',
                        'tipo_autoria',
                        'estado',
                        'kilometraje',
                        'prox_cambio_aceite',
                        'modelo',
                        'marca',
                        'anno',
                        'descripcion',
                        'titulo_propiedad',
                        'rtv',
                        'marchamo',
                        'firma_responsable',
                        'created_by',
                        'created_at',
                      ] as const;
                      for (const k of baseFields) {
                        if ((fv as any)[k] !== undefined) existing[k] = (fv as any)[k];
                      }

                      updated = true;
                    } else {
                      // Añadimos si el cache no tenía el vehículo.
                      vehiculos.push({
                        ...fv,
                        c_usos_vehiculos_corporativos: Array.isArray((fv as any)?.usos) ? (fv as any).usos : [],
                        c_mantenimiento_vehiculos_corporativos: Array.isArray((fv as any)?.mantenimientos)
                          ? (fv as any).mantenimientos
                          : [],
                      });
                      updated = true;
                      byId.set(fid, vehiculos[vehiculos.length - 1]);
                    }
                  }

                  const normalizedVehiculos = vehiculos.map(normalizeVehiculoCorporativoForMainStructureCache);
                  sucursal[targetKey] = normalizedVehiculos;
                  recomputeBitacorasForSucursalNode(sucursal, normalizedVehiculos);
                }
              }
            }
          }
        }

        if (updated) {
          await persistMergedMainStructureTree(tree, [Number(sucursalId)]);
        }
      } catch (e) {
        console.error('Error updating main_structure_cache (fetched vehicles):', e);
      }
    },
    []
  );

  const updateMainStructureCacheFromFetchedVehicleUses = useCallback(
    async (params: { sucursalId: number | null; vehiculoId: number; usos: VehicleUse[] }) => {
      const { sucursalId, vehiculoId, usos } = params;
      if (!vehiculoId || !Array.isArray(usos) || usos.length === 0) return;

      try {
        const tree = await loadMainStructureTreeMerged();
        if (!Array.isArray(tree) || tree.length === 0) return;

        const sidResolved =
          sucursalId ?? (await resolveSucursalIdForVehiculoFromMainStructure(Number(vehiculoId)));
        if (!sidResolved) return;

        let updated = false;

        for (const empresa of tree) {
          const clientes = empresa?.clientes || [];
          for (const cliente of clientes) {
            const divisiones = cliente?.division || cliente?.divisiones || [];
            for (const division of divisiones) {
              const contratos = division?.contratos || [];
              for (const contrato of contratos) {
                const sucursales = contrato?.sucursales || [];
                for (const sucursal of sucursales) {
                  if (Number(sucursal?.id) !== Number(sidResolved)) continue;

                  const targetKey = Array.isArray(sucursal?.vehiculos_corporativos)
                    ? 'vehiculos_corporativos'
                    : Array.isArray(sucursal?.c_vehiculos_corporativos)
                      ? 'c_vehiculos_corporativos'
                      : 'vehiculos_corporativos';

                  const vehiculos: any[] = Array.isArray(sucursal?.[targetKey]) ? sucursal[targetKey] : [];
                  if (!vehiculos.length) continue;

                  const targetVehiculo = vehiculos.find((v: any) => Number(v?.id) === Number(vehiculoId));
                  if (!targetVehiculo) continue;

                  const currentUsos: any[] = Array.isArray(targetVehiculo?.usos)
                    ? targetVehiculo.usos
                    : Array.isArray(targetVehiculo?.c_usos_vehiculos_corporativos)
                      ? targetVehiculo.c_usos_vehiculos_corporativos
                      : [];

                  const serverUsos = usos;
                  const serverIds = new Set(
                    serverUsos
                      .map((u: any) => (typeof u?.id === 'number' ? u.id : null))
                      .filter((id: any) => Number.isFinite(id))
                  );

                  // Preservamos los usos locales/pending si existieran.
                  const localUnsyncedUsos = currentUsos.filter((u: any) => {
                    const idLocal = u?.id_local;
                    if (typeof idLocal === 'string' && idLocal.startsWith('local-')) return true;
                    if (typeof u?.id === 'string' && u.id.startsWith('local-')) return true;
                    if (u?.synced === false) return true;
                    return false;
                  });

                  const localToKeep = localUnsyncedUsos.filter((u: any) => {
                    const idNum = typeof u?.id === 'number' ? u.id : null;
                    if (idNum != null && serverIds.has(idNum)) return false;
                    return true;
                  });

                  const mergedUsos = [...serverUsos, ...localToKeep];

                  targetVehiculo.usos = mergedUsos;
                  targetVehiculo.c_usos_vehiculos_corporativos = mergedUsos;

                  const normalizedVehiculos = vehiculos.map(normalizeVehiculoCorporativoForMainStructureCache);
                  sucursal[targetKey] = normalizedVehiculos;
                  recomputeBitacorasForSucursalNode(sucursal, normalizedVehiculos);

                  updated = true;
                }
              }
            }
          }
        }

        if (updated) {
          await persistMergedMainStructureTree(tree, [Number(sidResolved)]);
        }
      } catch (e) {
        console.error('Error updating main_structure_cache (fetched vehicle uses):', e);
      }
    },
    []
  );

  const updateMainStructureCacheFromFetchedVehicleMaintenances = useCallback(
    async (params: { sucursalId: number | null; vehiculoId: number; mantenimientos: VehicleMaintenance[] }) => {
      const { sucursalId, vehiculoId, mantenimientos } = params;
      if (!sucursalId || !Number.isFinite(vehiculoId) || !Array.isArray(mantenimientos) || mantenimientos.length === 0) return;

      try {
        const tree = await loadMainStructureTreeMerged();
        if (!Array.isArray(tree) || tree.length === 0) return;

        let updated = false;

        for (const empresa of tree) {
          const clientes = empresa?.clientes || [];
          for (const cliente of clientes) {
            const divisiones = cliente?.division || cliente?.divisiones || [];
            for (const division of divisiones) {
              const contratos = division?.contratos || [];
              for (const contrato of contratos) {
                const sucursales = contrato?.sucursales || [];
                for (const sucursal of sucursales) {
                  if (Number(sucursal?.id) !== Number(sucursalId)) continue;

                  const targetKey = Array.isArray(sucursal?.vehiculos_corporativos)
                    ? 'vehiculos_corporativos'
                    : Array.isArray(sucursal?.c_vehiculos_corporativos)
                      ? 'c_vehiculos_corporativos'
                      : 'vehiculos_corporativos';

                  const vehiculos: any[] = Array.isArray(sucursal?.[targetKey]) ? sucursal[targetKey] : [];
                  if (!vehiculos.length) continue;

                  const targetVehiculo = vehiculos.find((v: any) => Number(v?.id) === Number(vehiculoId));
                  if (!targetVehiculo) continue;

                  const currentMants: any[] = Array.isArray(targetVehiculo?.mantenimientos)
                    ? targetVehiculo.mantenimientos
                    : Array.isArray(targetVehiculo?.c_mantenimiento_vehiculos_corporativos)
                      ? targetVehiculo.c_mantenimiento_vehiculos_corporativos
                      : [];

                  const serverMants = mantenimientos;
                  const serverIds = new Set(
                    serverMants
                      .map((m: any) => (typeof m?.id === 'number' ? m.id : null))
                      .filter((id: any) => Number.isFinite(id))
                  );

                  const localUnsyncedMants = currentMants.filter((m: any) => {
                    const idLocal = m?.id_local;
                    if (typeof idLocal === 'string' && idLocal.startsWith('local-')) return true;
                    if (typeof m?.id === 'string' && m.id.startsWith('local-')) return true;
                    if (m?.synced === false) return true;
                    return false;
                  });

                  const localMantsToKeep = localUnsyncedMants.filter((m: any) => {
                    const idNum = typeof m?.id === 'number' ? m.id : null;
                    if (idNum != null && serverIds.has(idNum)) return false;
                    return true;
                  });

                  const mergedMants = [...serverMants, ...localMantsToKeep];

                  targetVehiculo.c_mantenimiento_vehiculos_corporativos = mergedMants;

                  const normalizedVehiculosM = vehiculos.map(normalizeVehiculoCorporativoForMainStructureCache);
                  sucursal[targetKey] = normalizedVehiculosM;
                  recomputeBitacorasForSucursalNode(sucursal, normalizedVehiculosM);

                  updated = true;
                }
              }
            }
          }
        }

        if (updated) {
          await persistMergedMainStructureTree(tree, [Number(sucursalId)]);
        }
      } catch (e) {
        console.error('Error updating main_structure_cache (fetched vehicle maintenances):', e);
      }
    },
    []
  );

  const runFetchRecords = useCallback(
    async (snap: MarcaSnapshot) => {
    try {
      setIsLoading(true);
      setError(null);

        if (!snap?.current) {
        return;
      }

      await fetchMainStructure();

        /**
         * Listado solo con sucursal/corpo: OPERATIVO → `current_marca.corpo`;
         * resto → filtro jerárquico o, si falta, mismo id desde `current_marca`.
         */
        const corpoId = snap.isOperativo
          ? snap.marcaCorpoId
          : (snap.filterCorpoId ?? snap.marcaCorpoId);
        if (!corpoId || corpoId <= 0) {
          setError(
            snap.isOperativo
              ? 'No se encontró el ID de la sucursal (corpo) en la marca actual'
              : 'Seleccione sucursal en el filtro o defina la sucursal en la marca actual'
          );
          setRecords([]);
        return;
      }

        const listFromFragment = await readCorporateVehiclesForSucursalFromFragmentStorage(Number(corpoId));
        const listFromMainStructure = await readCorporateVehiclesForSucursalFromMainStructure(Number(corpoId));
        const listOfflineSource = mergeCorporateVehicleDisplayLists(
          listFromFragment as VehicleRecord[],
          listFromMainStructure as VehicleRecord[]
        );
        const fromCorpoCache = await getCorporateVehiclesForCorpo(Number(corpoId));

      const isConnected = await getConnectionStatus();
      if (!isConnected) {
          setRecords(
            mergeCorporateVehicleDisplayLists(listOfflineSource, fromCorpoCache as VehicleRecord[])
          );
        return;
      }

        const res = await listCorporateVehiclesByCorpo({
          corpo_id: String(corpoId),
        refreshAccessToken,
        logout,
      });
      if (!res.status) {
          setRecords(
            mergeCorporateVehicleDisplayLists(listOfflineSource, fromCorpoCache as VehicleRecord[])
          );
        return;
      }

      const serverItems: VehicleRecord[] = Array.isArray(res.data)
        ? (res.data as any).filter((r: any) => r?.isActive !== false)
        : [];
        await mergeCorporateVehiclesForSucursalFromServer({
          sucursalId: Number(corpoId),
          serverVehicles: serverItems as any[],
        });
        await mergeCorporateVehiclesCorpoCacheForSucursal(Number(corpoId), serverItems as any[]);
        const mergedList = await readCorporateVehiclesForSucursalFromMainStructure(Number(corpoId));
        setRecords(mergedList as VehicleRecord[]);
    } catch (e: any) {
      console.error('Error fetching corporate vehicles:', e);
      setError(e?.message || 'Error al cargar los vehículos');
    } finally {
      setIsLoading(false);
    }
    },
    [fetchMainStructure, refreshAccessToken, logout]
  );

  const fetchRecords = useCallback(async () => {
    const snap = await syncMarcaFromStorage({ applyFiltersFromMarca: false });
    if (!snap) return;
    await runFetchRecords({
      ...snap,
      filterEmpresaId,
      filterClienteId,
      filterDivisionId,
      filterContratoId,
      filterCorpoId,
    });
  }, [
    syncMarcaFromStorage,
    runFetchRecords,
    filterEmpresaId,
    filterClienteId,
    filterDivisionId,
    filterContratoId,
    filterCorpoId,
  ]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        if (!listFiltersSyncedFromMarcaOnceRef.current) {
          const snap = await syncMarcaFromStorage({ applyFiltersFromMarca: true });
          if (cancelled) return;
          listFiltersSyncedFromMarcaOnceRef.current = true;
          if (snap) await runFetchRecords(snap);
          else await fetchRecords();
        } else {
          await fetchRecords();
        }
      })();
      const handler = () => void fetchRecords();
      eventBus.on('connectionRestored', handler);
      return () => {
        cancelled = true;
        eventBus.off('connectionRestored', handler);
      };
    }, [syncMarcaFromStorage, runFetchRecords, fetchRecords])
  );

  const resetForm = () => {
    setPlaca('');
    setTipo('');
    setEstado('Activo');
    setKilometraje('');
    setProxCambioAceite('');
    setTipoAutoria('');
    setModelo('');
    setAnno('');
    setMarca('');
    setDescripcion('');
    setTituloPropiedad(true);
    setRtv(true);
    setMarchamo(true);
    setFirmaResponsable(null);
    setImageFiles([]);
    setSelectedPuestoId(null);
  };

  const resetUseForm = () => {
    setUseNombreConductor('');
    setUseCodigoConductor('');
    setUseInicioFecha('');
    setUseInicioHora('');
    setUseFinFecha('');
    setUseFinHora('');
    setUseCombInicio('');
    setUseCombFin('');
    setUseKmInicio('');
    setUseKmFin('');
    setUseMotivo('');
    setUseFirmaConductor('');
    setUseFirmaResponsable(null);
    setShowUseDatePicker(false);
    setShowUseTimePicker(false);
    setUsePickerKey(null);
  };

  const openUseDatePicker = async (key: 'inicio_fecha' | 'fin_fecha', current?: string) => {
    const horaAccion = await getHoraAccion();
    if (!horaAccion) {
      Alert.alert('Error', 'No se pudo obtener la hora');
      return;
    }
    setUsePickerKey(key);
    const ymd = normalizeDateToYMD(current);
    const base = ymd ? new Date(`${ymd}T00:00:00`) : new Date(horaAccion);
    setUseDatePickerValue(Number.isNaN(base.getTime()) ? new Date(horaAccion) : base);
    setShowUseDatePicker(true);
  };

  const openUseTimePicker = async (key: 'inicio_hora' | 'fin_hora', current?: string) => {
    const horaAccion = await getHoraAccion();
    if (!horaAccion) {
      Alert.alert('Error', 'No se pudo obtener la hora');
      return;
    }
    setUsePickerKey(key);
    const base = current ? timeHHmmToPickerDate(current) : new Date(horaAccion);
    setUseTimePickerValue(base);
    setShowUseTimePicker(true);
  };

  const onUseDatePicked = (_event: any, selected?: Date) => {
    if (Platform.OS === 'android') setShowUseDatePicker(false);
    const dt = selected;
    if (!dt || !usePickerKey) return;
    const ymd = dateToYMD(dt);
    if (usePickerKey === 'inicio_fecha') setUseInicioFecha(ymd);
    if (usePickerKey === 'fin_fecha') setUseFinFecha(ymd);
    setShowUseDatePicker(false);
    setUsePickerKey(null);
  };

  const onUseTimePicked = (_event: any, selected?: Date) => {
    if (Platform.OS === 'android') setShowUseTimePicker(false);
    const dt = selected;
    if (!dt || !usePickerKey) return;
    const hhmm = timeToHHmm(dt);
    if (usePickerKey === 'inicio_hora') setUseInicioHora(hhmm);
    if (usePickerKey === 'fin_hora') setUseFinHora(hhmm);
    setShowUseTimePicker(false);
    setUsePickerKey(null);
  };

  const setUsesForVehicleKey = useCallback(async (vehicleKey: string, usos: VehicleUse[]) => {
    setRecords((prev) =>
      prev.map((r) => {
        const key = String(r.id || r.id_local);
        if (key !== vehicleKey) return r;
        return { ...r, usos, c_usos_vehiculos_corporativos: usos };
      })
    );

    const sid = await findSucursalIdForVehicleKeyInMainStructure(vehicleKey);
    if (sid) await updateVehicleUsosInMainStructureBranch(sid, vehicleKey, usos);
    await setVehicleUsosInCorpoCache(vehicleKey, usos);
  }, []);

  const openUsesModal = useCallback(
    async (vehicle: VehicleRecord) => {
      const key = String(vehicle.id || vehicle.id_local);
      setUsesVehicleKey(key);
      setUsesModalVisible(true);
      setIsUseFormOpen(false);
      setUseEditing(null);
      resetUseForm();

      const initial = (vehicle.usos || []).map((u) => ({
        ...u,
        synced:
          u.synced !== undefined
            ? u.synced
            : typeof u.id === 'number' && !String(u.id).startsWith('local-')
              ? true
              : false,
      }));
      setUseRecords(initial);

      console.log('Checking connection for vehicle', vehicle.id);
      const isConnected = await getConnectionStatus();
      if (!isConnected) return;
      if (typeof vehicle.id !== 'number') return; // si no hay id real, no podemos refrescar del server aún

      console.log('Fetching uses for vehicle', vehicle.id);
      const res = await listCorporateVehicleUses({
        vehiculo_id: String(vehicle.id),
        refreshAccessToken,
        logout,
      });
      if (!res.status) return;
      const serverUsos: VehicleUse[] = Array.isArray(res.data)
        ? (res.data as any).map((u: any) => ({ ...u, id_local: '', synced: true }))
        : [];
      setUseRecords(serverUsos);
      await setUsesForVehicleKey(key, serverUsos);

       // Sincronizamos `usos` dentro del árbol offline para que `main_structure_cache`
       // tenga la misma lista que el endpoint GET.
       void updateMainStructureCacheFromFetchedVehicleUses({
         sucursalId: Number(vehicle.corpo_id ?? (vehicle as any)?.sucursal_id ?? 0) || null,
         vehiculoId: Number(vehicle.id),
         usos: serverUsos,
       });
    },
    [getConnectionStatus, listCorporateVehicleUses, refreshAccessToken, logout, resetUseForm, setUsesForVehicleKey, updateMainStructureCacheFromFetchedVehicleUses]
  );

  const closeUsesModal = () => {
    setUsesModalVisible(false);
    setUsesVehicleKey(null);
    setUseRecords([]);
    setIsUseFormOpen(false);
    setUseEditing(null);
    resetUseForm();
  };

  const startCreateUse = () => {
    setIsUseFormOpen(true);
    setUseEditing(null);
    resetUseForm();
  };

  const startEditingUse = (u: VehicleUse) => {
    setIsUseFormOpen(true);
    setUseEditing(u);
    setUseNombreConductor(String(u.nombre_conductor || ''));
    setUseCodigoConductor(String((u as any).codigo_conductor || ''));
    const inicioFechaIso = String((u as any).fecha_inicio || (u as any).inicio || (u as any).hora_inicio || '');
    const finFechaIso = String((u as any).fecha_fin || (u as any).fin || (u as any).hora_fin || '');
    const inicioHoraIso = String((u as any).hora_inicio || (u as any).inicio || '');
    const finHoraIso = String((u as any).hora_fin || (u as any).fin || '');
    setUseInicioFecha(isoToDate(inicioFechaIso));
    setUseInicioHora(isoToTime(inicioHoraIso));
    setUseFinFecha(isoToDate(finFechaIso));
    setUseFinHora(isoToTime(finHoraIso));
    setUseCombInicio(String(u.combustible_inicio ?? ''));
    setUseCombFin(String(u.combustible_fin ?? ''));
    setUseKmInicio(String(u.km_inicio ?? ''));
    setUseKmFin(String(u.km_fin ?? ''));
    setUseMotivo(String(u.motivo || ''));
    setUseFirmaConductor(String((u as any).firma_conductor || ''));
    setUseFirmaResponsable(decodeFirmaHash(u.firma_responsable) as any);
  };

  const searchUseConductorByCode = async () => {
    const codigo = useCodigoConductor.trim();
    if (!codigo) {
      Alert.alert('Dato requerido', 'Ingresa el código del conductor.');
      return;
    }

    const isConnected = await getConnectionStatus();
    if (!isConnected) {
      Alert.alert('Sin conexión', 'La búsqueda de conductor requiere internet.');
      return;
    }

    try {
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) throw new Error('Server URL not configured');

      const resp = await authedFetch({
        url: `${apiUrl}/api/empleados/codigo/${encodeURIComponent(codigo)}`,
        init: {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        },
        refreshAccessToken,
        logout,
      });
      if (!resp) return;

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.status || !data?.data) {
        throw new Error(data?.message || 'No se encontró un empleado con ese código');
      }

      setUseNombreConductor(String(data.data.nombre_completo || data.data.nombre || ''));
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo buscar el conductor');
    }
  };

  const getUseFirmaHashForSave = (): string => {
    if (useFirmaResponsable) {
      return btoa(
        `${useFirmaResponsable.sessionId}:${useFirmaResponsable.empleadoId}:${useFirmaResponsable.latitud}:${useFirmaResponsable.longitud}:${useFirmaResponsable.timestamp}`
      );
    }
    const u = useEditing;
    const existing = u?.firma_responsable;
    if (typeof existing === 'string' && existing.trim().length > 0) return existing.trim();
    return '';
  };

  const validateUseForm = () => {
    if (!usesVehicleKey) return 'No se encontró el vehículo seleccionado';
    if (!useCodigoConductor.trim()) return 'Código del conductor es requerido';
    if (!useNombreConductor.trim()) return 'Nombre del conductor es requerido';
    if (!useInicioFecha.trim()) return 'Fecha de inicio es requerida';
    if (!useInicioHora.trim()) return 'Hora de inicio es requerida';
    if (!useFinFecha.trim()) return 'Fecha de fin es requerida';
    if (!useFinHora.trim()) return 'Hora de fin es requerida';
    if (!useCombInicio.trim()) return 'Combustible inicio es requerido';
    if (!useCombFin.trim()) return 'Combustible fin es requerido';
    if (!getUseFirmaHashForSave().trim()) return 'Firma del responsable (QR o Generar) es requerida';
    return null;
  };

  const buildUseRequestData = (horaAccion: number) => {
    const firmaHash = getUseFirmaHashForSave();

    const inicioHoraIso = toIsoFromDateAndTime(useInicioFecha, useInicioHora);
    const finHoraIso = toIsoFromDateAndTime(useFinFecha, useFinHora);
    return {
      nombre_conductor: useNombreConductor.trim(),
      codigo_conductor: useCodigoConductor.trim(),
      fecha_inicio: toIsoFromDateAndTime(useInicioFecha, '00:00'),
      fecha_fin: toIsoFromDateAndTime(useFinFecha, '00:00'),
      hora_inicio: inicioHoraIso,
      hora_fin: finHoraIso,
      fecha: new Date(horaAccion).toISOString(),
      combustible_inicio: useCombInicio.trim(),
      combustible_fin: useCombFin.trim(),
      km_inicio: Number(useKmInicio || 0),
      km_fin: Number(useKmFin || 0),
      motivo: useMotivo.trim(),
      firma_conductor: getBase64Only(useFirmaConductor) || null,
      firma_responsable: firmaHash,
    };
  };

  const resolveServerVehicleId = async (vehiculoIdOrLocal: number | string): Promise<number | null> => {
    if (typeof vehiculoIdOrLocal === 'number') return vehiculoIdOrLocal;
    const v = String(vehiculoIdOrLocal);
    if (!v.startsWith('local-')) return null;

    const fromMs = await resolveCorporateVehicleServerIdFromMainStructure(v);
    if (fromMs) return fromMs;
    const fromCorpo = await findCorporateVehicleServerIdByLocalKey(v);
    if (fromCorpo) return fromCorpo;
    const cacheStr = await AsyncStorage.getItem('evaluations_cache');
    const cache = cacheStr ? JSON.parse(cacheStr) : [];
    const found = cache.find((item: any) => item.type === 'corporate_vehicle' && String(item.id_local) === v && typeof item.id === 'number');
    return found && typeof found.id === 'number' ? found.id : null;
  };

  /** id_local del vehículo padre cuando el registro aún no está sincronizado (para usos/mantenimientos). */
  const getVehiculoIdLocalForChildPayload = (v: VehicleRecord): string | undefined => {
    if (v.id_local != null && String(v.id_local).trim() !== '') return String(v.id_local);
    if (typeof v.id === 'string' && v.id.startsWith('local-')) return v.id;
    return undefined;
  };

  const handleSaveUseRecord = () => {
    const errMsg = validateUseForm();
    if (errMsg) {
      Alert.alert('Error', errMsg);
      return;
    }

    if (!usesVehicleKey) {
      Alert.alert('Error', 'No se encontró el vehículo seleccionado');
      return;
    }

    Alert.alert('Confirmar', '¿Desea guardar el uso?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Aceptar', onPress: () => void executeSaveUseRecord() },
    ]);
  };

  const executeSaveUseRecord = async () => {
    if (!usesVehicleKey) {
      Alert.alert('Error', 'No se encontró el vehículo seleccionado');
      return;
    }
    const useVehicleKeyStr = usesVehicleKey;
    setIsSubmittingUse(true);
    setSubmitResponseUse(null);

    try {
      const vehicle = records.find((r) => String(r.id || r.id_local) === useVehicleKeyStr);
      if (!vehicle) {
        Alert.alert('Error', 'No se encontró el vehículo seleccionado');
        setIsSubmittingUse(false);
        return;
      }

      const horaAccion = await getHoraAccion();
      if (!horaAccion) {
        Alert.alert('Error', 'No se pudo obtener la hora');
        return;
      }

      const requestData = buildUseRequestData(horaAccion);
      if (!requestData) {
        Alert.alert('Error', 'No se pudo obtener los datos del uso');
        return;
      }
      const isConnected = await getConnectionStatus();
      const vehicleIdForAction = String(vehicle.id_local || vehicle.id);
      const vehiculoIdLocal = getVehiculoIdLocalForChildPayload(vehicle);

      if (!isConnected) {
        const actionsStr = await AsyncStorage.getItem('evaluations_actions');
        let actions = actionsStr ? JSON.parse(actionsStr) : [];

        if (!useEditing) {
          const localUseId = `local-use-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
          actions.push({
            id: localUseId,
            action: 'create',
            type: 'corporate_vehicle_use',
            payload: {
              vehiculo_id: vehicleIdForAction,
              id_local: localUseId,
              ...(vehiculoIdLocal ? { vehiculo_id_local: vehiculoIdLocal } : {}),
              ...requestData,
            },
            synced: false,
          });
          await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

          const newUse: VehicleUse = {
            id: localUseId,
            id_local: localUseId,
            vehiculo_id: vehicleIdForAction,
            synced: false,
            ...requestData,
          } as any;
          const updated = [...useRecords, newUse];
          setUseRecords(updated);
          await setUsesForVehicleKey(useVehicleKeyStr, updated);
        } else {
          const useId = String(useEditing.id || useEditing.id_local);
          if (useId.startsWith('local-')) {
            actions = actions.filter(
              (a: any) =>
                !(
                  a.type === 'corporate_vehicle_use' &&
                  a.action === 'update' &&
                  String(a.id) === useId
                )
            );
            const ci = actions.findIndex(
              (a: any) =>
                a.action === 'create' &&
                a.type === 'corporate_vehicle_use' &&
                String(a.id) === useId
            );
            const nextPayload = {
              vehiculo_id: vehicleIdForAction,
              ...(vehiculoIdLocal ? { vehiculo_id_local: vehiculoIdLocal } : {}),
              ...requestData,
              id_local: useId,
            };
            if (ci !== -1) {
              const prev = actions[ci].payload || {};
              actions[ci] = {
                ...actions[ci],
                payload: { ...prev, ...nextPayload },
                synced: false,
              };
            } else {
              actions.push({
                id: useId,
                action: 'create',
                type: 'corporate_vehicle_use',
                payload: nextPayload,
                synced: false,
              });
            }
          } else {
          actions.push({
            id: useId,
            action: 'update',
            type: 'corporate_vehicle_use',
            payload: { vehiculo_id: vehicleIdForAction, ...requestData },
            synced: false,
          });
          }
          await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

          const updated = useRecords.map((u) =>
            String(u.id) === useId || String(u.id_local) === useId ? ({ ...u, ...requestData, synced: false } as any) : u
          );
          setUseRecords(updated);
          await setUsesForVehicleKey(useVehicleKeyStr, updated);
        }

        Alert.alert('Éxito', 'El uso se guardó en el dispositivo. Se sincronizará al reconectar.');
        setTimeout(() => {
          setIsUseFormOpen(false);
          setUseEditing(null);
          resetUseForm();
        }, 2000);
        return;
      }

      const serverVehicleId = await resolveServerVehicleId(vehicle.id);
      const vehiculoId = serverVehicleId ?? (typeof vehicle.id === 'number' ? vehicle.id : null);
      if (!vehiculoId) {
        Alert.alert('Error', 'Este vehículo aún no está sincronizado. Conéctate y sincroniza el vehículo primero.');
        setIsSubmittingUse(false);
        return;
      }

      if (!useEditing) {
        const res = await createCorporateVehicleUse({
          vehiculo_id: String(vehiculoId),
          requestData,
          refreshAccessToken,
          logout,
        });
        if (!res.status) throw new Error(res.message || 'No se pudo crear el uso');
        Alert.alert('Éxito', res.message || 'Uso guardado correctamente');
      } else {
        const useId = String(useEditing.id);
        if (useId.startsWith('local-')) {
          Alert.alert('Error', 'Este uso aún no está sincronizado. Se sincronizará automáticamente al reconectar.');
          setIsSubmittingUse(false);
          return;
        }
        const res = await updateCorporateVehicleUse({
          use_id: useId,
          requestData,
          refreshAccessToken,
          logout,
        });
        if (!res.status) throw new Error(res.message || 'No se pudo actualizar el uso');
        Alert.alert('Éxito', res.message || 'Uso guardado correctamente');
      }

      // refrescar desde servidor
      const ref = await listCorporateVehicleUses({ vehiculo_id: String(vehiculoId), refreshAccessToken, logout });
      if (ref.status) {
        const serverUsos: VehicleUse[] = Array.isArray(ref.data) ? (ref.data as any).map((u: any) => ({ ...u, id_local: '', synced: true })) : [];
        setUseRecords(serverUsos);
        await setUsesForVehicleKey(useVehicleKeyStr, serverUsos);
      }

      setTimeout(() => {
        setIsUseFormOpen(false);
        setUseEditing(null);
        resetUseForm();
      }, 2000);
    } catch (e: any) {
      console.error('Error saving use:', e);
      Alert.alert('Error', e?.message || 'No se pudo guardar el uso');
    } finally {
      setIsSubmittingUse(false);
    }
  };

  const confirmDeleteUse = (u: VehicleUse) => {
    const useKey = String(u.id || u.id_local);
    Alert.alert('Eliminar', '¿Deseas eliminar este uso?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => void executeDeleteUse(u, useKey),
      },
    ]);
  };

  const executeDeleteUse = async (u: VehicleUse, useKey: string) => {
          if (!usesVehicleKey) return;
          const vehicle = records.find((r) => String(r.id || r.id_local) === usesVehicleKey);
          if (!vehicle) return;

    setDeletingUseKey(useKey);
    try {
          const isConnected = await getConnectionStatus();
          const useId = String(u.id || u.id_local);
          const vehicleIdForAction = String(vehicle.id_local || vehicle.id);

            if (!isConnected || useId.startsWith('local-') || !u.synced) {
              const actionsStr = await AsyncStorage.getItem('evaluations_actions');
        let actions = actionsStr ? JSON.parse(actionsStr) : [];
        if (useId.startsWith('local-')) {
          actions = actions.filter(
            (a: any) =>
              !(
                a.type === 'corporate_vehicle_use' &&
                (a.action === 'create' || a.action === 'update') &&
                String(a.id) === useId
              )
          );
        } else {
              actions.push({
                id: useId,
                action: 'delete',
                type: 'corporate_vehicle_use',
                payload: { vehiculo_id: vehicleIdForAction },
                synced: false,
              });
        }
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

              const updated = useRecords.filter((x) => String(x.id) !== useId && String(x.id_local) !== useId);
              setUseRecords(updated);
              await setUsesForVehicleKey(usesVehicleKey, updated);
              await clearDeletedUseReferenceInBitacoras({
                sucursalId: Number(vehicle?.corpo_id || usesVehicle?.corpo_id || 0),
                useIdRaw: useId,
                useLocalKey: resolveCorporateLocalKey(u),
              });
              await clearDeletedUseReferenceInBitacoraActions({
                useIdRaw: useId,
                useLocalKey: resolveCorporateLocalKey(u),
              });
              return;
            }

            const res = await deleteCorporateVehicleUse({ use_id: useId, refreshAccessToken, logout });
            if (!res.status) throw new Error(res.message || 'No se pudo eliminar el uso');

            const updated = useRecords.filter((x) => String(x.id) !== useId);
            setUseRecords(updated);
            await setUsesForVehicleKey(usesVehicleKey, updated);
            await clearDeletedUseReferenceInBitacoras({
              sucursalId: Number(vehicle?.corpo_id || usesVehicle?.corpo_id || 0),
              useIdRaw: useId,
              useLocalKey: resolveCorporateLocalKey(u),
            });
            await clearDeletedUseReferenceInBitacoraActions({
              useIdRaw: useId,
              useLocalKey: resolveCorporateLocalKey(u),
            });
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'No se pudo eliminar el uso');
          } finally {
      setDeletingUseKey(null);
    }
  };

  const resolveCorporateServerNumericId = (raw: number | string | undefined): number | undefined => {
    if (raw === undefined || raw === null) return undefined;
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
    const s = String(raw);
    if (s.startsWith('local-')) return undefined;
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };

  const resolveCorporateLocalKey = (record: { id?: number | string; id_local?: string }): string | undefined => {
    if (record.id_local != null && String(record.id_local).trim() !== '') return String(record.id_local);
    if (typeof record.id === 'string' && record.id.startsWith('local-')) return record.id;
    return undefined;
  };

  const clearDeletedUseReferenceInBitacoras = useCallback(
    async (params: { sucursalId: number | null; useIdRaw: string; useLocalKey?: string }) => {
      const sid = Number(params.sucursalId || 0);
      if (!Number.isFinite(sid) || sid <= 0) return;

      const serverUseId = resolveCorporateServerNumericId(params.useIdRaw);
      const localUseKey =
        params.useLocalKey && String(params.useLocalKey).trim() !== ''
          ? String(params.useLocalKey).trim()
          : serverUseId
            ? ''
            : String(params.useIdRaw || '').trim();

      const rows = await readBitacorasForSucursalFromMainStructure(sid);
      if (!Array.isArray(rows) || rows.length === 0) return;

      for (const row of rows) {
        const matchByServerId = serverUseId != null && Number(row?.uso_id) === Number(serverUseId);
        const matchByLocalId =
          !!localUseKey &&
          (String(row?.uso_id_local ?? '') === localUseKey || String(row?.uso_id ?? '') === localUseKey);
        if (!matchByServerId && !matchByLocalId) continue;

        await upsertBitacoraDetenidoRowInMainStructure(
          {
            ...row,
            uso_id: null,
            uso_id_local: '',
            uso: null,
          },
          sid,
          row?.id_local ? String(row.id_local) : null
        );
      }
    },
    []
  );

  const clearDeletedUseReferenceInBitacoraActions = useCallback(
    async (params: { useIdRaw: string; useLocalKey?: string }) => {
      const serverUseId = resolveCorporateServerNumericId(params.useIdRaw);
      const localUseKey =
        params.useLocalKey && String(params.useLocalKey).trim() !== ''
          ? String(params.useLocalKey).trim()
          : serverUseId
            ? ''
            : String(params.useIdRaw || '').trim();

      const actionsStr = await AsyncStorage.getItem('evaluations_actions');
      const actions = actionsStr ? JSON.parse(actionsStr) : [];
      if (!Array.isArray(actions) || actions.length === 0) return;

      let changed = false;
      const next = actions.map((a: any) => {
        if (a?.type !== 'bitacora_vehiculo_detenido') return a;
        if (a?.action !== 'create' && a?.action !== 'update') return a;
        const payload = a?.payload && typeof a.payload === 'object' ? { ...a.payload } : null;
        if (!payload) return a;

        const matchByServerId = serverUseId != null && Number(payload?.uso_id) === Number(serverUseId);
        const matchByLocalId =
          !!localUseKey &&
          (String(payload?.uso_id_local ?? '') === localUseKey || String(payload?.uso_id ?? '') === localUseKey);
        if (!matchByServerId && !matchByLocalId) return a;

        changed = true;
        return {
          ...a,
          payload: {
            ...payload,
            uso_id: null,
            uso_id_local: '',
            uso: null,
          },
        };
      });

      if (changed) {
        await AsyncStorage.setItem('evaluations_actions', JSON.stringify(next));
      }
    },
    []
  );

  const handleAssignEstado = async (u: VehicleUse) => {
    try {
      if (!usesVehicle) return;
      if ((u as any)?.bitacora_id != null || (u as any)?.bitacora) {
        Alert.alert('Info', 'Este uso ya tiene una bitácora asignada.');
        return;
      }

      const vehIdNum = resolveCorporateServerNumericId(usesVehicle.id);
      const vehLocal = resolveCorporateLocalKey(usesVehicle);
      if (!vehIdNum && !vehLocal) {
        Alert.alert('Error', 'No se pudo identificar el vehículo.');
        return;
      }

      const usoIdNum = resolveCorporateServerNumericId(u.id);
      const usoLocal = resolveCorporateLocalKey(u);
      if (!usoIdNum && !usoLocal) {
        Alert.alert('Error', 'No se pudo identificar el uso.');
        return;
      }

      await upsertVehicleInCorpoCache(
        {
          ...usesVehicle,
          usos: useRecords,
          c_usos_vehiculos_corporativos: useRecords,
        } as any,
        { synced: usesVehicle.synced !== false }
      );

      await fetchMainStructure();
      const path = findPathForSucursal(Number(usesVehicle.cliente_id), Number(usesVehicle.corpo_id));

      // Cerramos el modal para evitar overlays al volver
      closeUsesModal();

      navigation.navigate('BitacoraVehiculosDetenidos', {
        prefill: {
          ...(path || {
            empresa_id: Number(usesVehicle.empresa_id || 0),
            cliente_id: Number(usesVehicle.cliente_id),
            sucursal_id: Number(usesVehicle.corpo_id)
          }),
          empresa_id: Number(usesVehicle.empresa_id || 0),
          cliente_id: Number(usesVehicle.cliente_id),
          sucursal_id: Number(usesVehicle.corpo_id),
          ...(vehIdNum != null ? { vehiculo_id: vehIdNum } : {}),
          ...(usoIdNum != null ? { uso_id: usoIdNum } : {}),
          ...(vehLocal ? { vehiculo_id_local: vehLocal } : {}),
          ...(usoLocal ? { uso_id_local: usoLocal } : {}),
          vehiculo_tipo: String(usesVehicle.tipo || ''),
          vehiculo_placa: String(usesVehicle.placa || ''),
        },
        returnTo: 'CorporateVehicles',
      });
    } catch (e: any) {
      console.error('Error navigating to bitacora:', e);
      Alert.alert('Error', e?.message || 'No se pudo abrir la bitácora');
    }
  };

  // Funciones para mantenimiento
  const maintenanceVehicle = useMemo(() => {
    if (!maintenanceVehicleKey) return null;
    return records.find((r) => String(r.id || r.id_local) === maintenanceVehicleKey) ?? null;
  }, [records, maintenanceVehicleKey]);

  const resetMaintenanceForm = useCallback(() => {
    setMaintenanceFecha('');
    setMaintenanceImagenAntes('');
    setMaintenanceImagenAntesRef('');
    setMaintenanceTipo('');
    setMaintenanceMantenimiento('');
    setMaintenanceDiagnostico('');
    setMaintenanceKmSiguiente('');
    setMaintenanceImagenDespues('');
    setMaintenanceImagenDespuesRef('');
    setMaintenanceNombreMecanico('');
    setMaintenanceFirmaMecanico('');
    setMaintenanceFirmaResponsable(null);
  }, []);

  const setMaintenancesForVehicleKey = useCallback(async (vehicleKey: string, mantenimientos: VehicleMaintenance[]) => {
    setRecords((prev) =>
      prev.map((r) => {
        const key = String(r.id || r.id_local);
        if (key !== vehicleKey) return r;
        return {
          ...r,
          mantenimientos,
          c_mantenimiento_vehiculos_corporativos: mantenimientos,
        };
      })
    );

    const sid = await findSucursalIdForVehicleKeyInMainStructure(vehicleKey);
    if (sid) await updateVehicleMantenimientosInMainStructureBranch(sid, vehicleKey, mantenimientos);
  }, []);

  const openMaintenanceModal = useCallback(
    async (vehicle: VehicleRecord) => {
      const key = String(vehicle.id || vehicle.id_local);
      setMaintenanceVehicleKey(key);
      setMaintenanceModalVisible(true);
      setIsMaintenanceFormOpen(false);
      setMaintenanceEditing(null);
      resetMaintenanceForm();

      const initial = (
        Array.isArray((vehicle as any).mantenimientos)
          ? (vehicle as any).mantenimientos
          : Array.isArray((vehicle as any).c_mantenimiento_vehiculos_corporativos)
            ? (vehicle as any).c_mantenimiento_vehiculos_corporativos
            : []
      ).map((m: any) => ({
        ...m,
        synced:
          m.synced !== undefined
            ? m.synced
            : typeof m.id === 'number' && !String(m.id).startsWith('local-')
              ? true
              : false,
      }));
      setMaintenanceRecords(initial);

      const isConnected = await getConnectionStatus();
      if (!isConnected) return;
      if (typeof vehicle.id !== 'number') return;

      const res = await listCorporateVehicleMaintenances({
        vehiculo_id: String(vehicle.id),
        refreshAccessToken,
        logout,
      });
      if (!res.status) return;
      const serverMaintenances: VehicleMaintenance[] = Array.isArray(res.data)
        ? (res.data as any).map((m: any) => ({ ...m, id_local: '', synced: true }))
        : [];
      setMaintenanceRecords(serverMaintenances);
      await setMaintenancesForVehicleKey(key, serverMaintenances);

      void updateMainStructureCacheFromFetchedVehicleMaintenances({
        sucursalId: Number(vehicle.corpo_id),
        vehiculoId: Number(vehicle.id),
        mantenimientos: serverMaintenances,
      });
    },
    [
      getConnectionStatus,
      listCorporateVehicleMaintenances,
      refreshAccessToken,
      logout,
      resetMaintenanceForm,
      setMaintenancesForVehicleKey,
      updateMainStructureCacheFromFetchedVehicleMaintenances,
    ]
  );

  const closeMaintenanceModal = () => {
    setMaintenanceModalVisible(false);
    setMaintenanceVehicleKey(null);
    setMaintenanceRecords([]);
    setIsMaintenanceFormOpen(false);
    setMaintenanceEditing(null);
    resetMaintenanceForm();
  };

  const startCreateMaintenance = () => {
    setIsMaintenanceFormOpen(true);
    setMaintenanceEditing(null);
    resetMaintenanceForm();
  };

  const startEditingMaintenance = (m: VehicleMaintenance) => {
    setIsMaintenanceFormOpen(true);
    setMaintenanceEditing(m);
    setMaintenanceFecha(isoToDate(m.fecha));

    setMaintenanceImagenAntes('');
    setMaintenanceImagenAntesRef('');
    setMaintenanceImagenDespues('');
    setMaintenanceImagenDespuesRef('');
    setMaintenanceTipo(m.tipo || '');
    setMaintenanceMantenimiento(m.mantenimiento || '');
    setMaintenanceDiagnostico(m.diagnostico || '');
    setMaintenanceKmSiguiente(String(m.kilometraje_siguiente_revision ?? ''));
    setMaintenanceNombreMecanico(m.nombre_mecanico || '');
    // Cargar firma del mecánico formateada correctamente
    setMaintenanceFirmaMecanico(formatSignatureForDisplay(m.firma_mecanico));
    setMaintenanceFirmaResponsable(decodeFirmaHash(m.firma_responsable) as any);
  };

  const getMaintenanceFirmaHashForSave = (): string => {
    if (maintenanceFirmaResponsable) {
      return btoa(
        `${maintenanceFirmaResponsable.sessionId}:${maintenanceFirmaResponsable.empleadoId}:${maintenanceFirmaResponsable.latitud}:${maintenanceFirmaResponsable.longitud}:${maintenanceFirmaResponsable.timestamp}`
      );
    }
    const m = maintenanceEditing;
    const existing = m?.firma_responsable;
    if (typeof existing === 'string' && existing.trim().length > 0) return existing.trim();
    return '';
  };

  const validateMaintenanceForm = () => {
    if (!maintenanceVehicleKey) return 'No se encontró el vehículo seleccionado';
    if (!maintenanceFecha.trim()) return 'Fecha es requerida';
    if (!maintenanceTipo.trim()) return 'Tipo es requerido';
    if (!maintenanceMantenimiento.trim()) return 'Mantenimiento es requerido';
    if (!maintenanceNombreMecanico.trim()) return 'Nombre del mecánico es requerido';
    if (!getMaintenanceFirmaHashForSave().trim()) return 'Firma del responsable (QR o Generar) es requerida';
    return null;
  };

  const buildMaintenanceRequestData = ():
    | CorporateVehicleMaintenanceRequest
    | Partial<CorporateVehicleMaintenanceRequest> => {
    const firmaHash = getMaintenanceFirmaHashForSave();
    const base: Record<string, unknown> = {
      fecha: toIsoFromDateAndTime(maintenanceFecha, '00:00'),
      tipo: maintenanceTipo.trim(),
      mantenimiento: maintenanceMantenimiento.trim(),
      diagnostico: maintenanceDiagnostico.trim(),
      kilometraje_siguiente_revision: Number(maintenanceKmSiguiente || 0),
      nombre_mecanico: maintenanceNombreMecanico.trim(),
      firma_mecanico: (getBase64Only(maintenanceFirmaMecanico) as string | null),
      firma_responsable: firmaHash,
    };
    if (maintenanceImagenAntesRef) {
      base.imagen_antes = '';
      (base as any).imagen_antes_local_file = maintenanceImagenAntesRef;
    }
    if (maintenanceImagenDespuesRef) {
      base.imagen_despues = '';
      (base as any).imagen_despues_local_file = maintenanceImagenDespuesRef;
    }
    if (!maintenanceEditing) {
      return base as CorporateVehicleMaintenanceRequest;
    }
    const partial: Record<string, unknown> = { ...base };
    return partial as Partial<CorporateVehicleMaintenanceRequest>;
  };

  const hydrateMaintenanceImagesForApi = useCallback(async (payload: Record<string, any>) => {
    const next: Record<string, any> = { ...(payload || {}) };
    const refs: Array<{ field: 'imagen_antes' | 'imagen_despues'; refField: 'imagen_antes_local_file' | 'imagen_despues_local_file' }> = [
      { field: 'imagen_antes', refField: 'imagen_antes_local_file' },
      { field: 'imagen_despues', refField: 'imagen_despues_local_file' },
    ];
    for (const { field, refField } of refs) {
      const key = typeof next[refField] === 'string' ? next[refField].trim() : '';
      if (key) {
        try {
          const g = await getFile(key);
          if (g?.base64) next[field] = String(g.base64);
        } catch {
          // ignore missing local file; sync/API validation will handle it
        }
      }
      delete next[refField];
    }
    return next;
  }, []);

  const handleSaveMaintenanceRecord = () => {
    const errMsg = validateMaintenanceForm();
    if (errMsg) {
      Alert.alert('Error', errMsg);
      return;
    }

    if (!maintenanceVehicleKey) {
      Alert.alert('Error', 'No se encontró el vehículo seleccionado');
      return;
    }

    Alert.alert('Confirmar', '¿Desea guardar el mantenimiento?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Aceptar', onPress: () => void executeSaveMaintenanceRecord() },
    ]);
  };

  const executeSaveMaintenanceRecord = async () => {
    if (!maintenanceVehicleKey) {
      Alert.alert('Error', 'No se encontró el vehículo seleccionado');
      return;
    }
    const maintenanceVehicleKeyStr = maintenanceVehicleKey;
    setIsSubmittingMaintenance(true);
    setSubmitResponseMaintenance(null);

    try {
      const vehicle = records.find((r) => String(r.id || r.id_local) === maintenanceVehicleKeyStr);
      if (!vehicle) {
        Alert.alert('Error', 'No se encontró el vehículo seleccionado');
        setIsSubmittingMaintenance(false);
        return;
      }

      const requestData = buildMaintenanceRequestData();
      const isConnected = await getConnectionStatus();
      const vehicleIdForAction = String(vehicle.id_local || vehicle.id);
      const vehiculoIdLocal = getVehiculoIdLocalForChildPayload(vehicle);

      if (!isConnected) {
        const actionsStr = await AsyncStorage.getItem('evaluations_actions');
        let actions = actionsStr ? JSON.parse(actionsStr) : [];

        if (!maintenanceEditing) {
          const localMaintenanceId = `local-maintenance-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
          actions.push({
            id: localMaintenanceId,
            action: 'create',
            type: 'corporate_vehicle_maintenance',
            payload: {
              vehiculo_id: vehicleIdForAction,
              id_local: localMaintenanceId,
              ...(vehiculoIdLocal ? { vehiculo_id_local: vehiculoIdLocal } : {}),
              ...requestData,
            },
            synced: false,
          });
          await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

          const newMaintenance: VehicleMaintenance = {
            id: localMaintenanceId,
            id_local: localMaintenanceId,
            vehiculo_id: vehicleIdForAction,
            synced: false,
            ...requestData,
          } as any;
          const updated = [...maintenanceRecords, newMaintenance];
          setMaintenanceRecords(updated);
          await setMaintenancesForVehicleKey(maintenanceVehicleKeyStr, updated);
        } else {
          const maintenanceId = String(maintenanceEditing.id || maintenanceEditing.id_local);
          if (String(maintenanceId).startsWith('local-')) {
            actions = actions.filter(
              (a: any) =>
                !(
                  a.type === 'corporate_vehicle_maintenance' &&
                  a.action === 'update' &&
                  String(a.id) === maintenanceId
                )
            );
            const ci = actions.findIndex(
              (a: any) =>
                a.action === 'create' &&
                a.type === 'corporate_vehicle_maintenance' &&
                String(a.id) === maintenanceId
            );
            const nextPayload = {
              vehiculo_id: vehicleIdForAction,
              ...(vehiculoIdLocal ? { vehiculo_id_local: vehiculoIdLocal } : {}),
              ...requestData,
              id_local: maintenanceId,
            };
            if (ci !== -1) {
              const prev = actions[ci].payload || {};
              actions[ci] = {
                ...actions[ci],
                payload: { ...prev, ...nextPayload },
                synced: false,
              };
            } else {
              actions.push({
                id: maintenanceId,
                action: 'create',
                type: 'corporate_vehicle_maintenance',
                payload: nextPayload,
                synced: false,
              });
            }
          } else {
          actions.push({
            id: maintenanceId,
            action: 'update',
            type: 'corporate_vehicle_maintenance',
            payload: { vehiculo_id: vehicleIdForAction, ...requestData },
            synced: false,
          });
          }
          await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

          const updated = maintenanceRecords.map((m) =>
            String(m.id) === maintenanceId || String(m.id_local) === maintenanceId
              ? ({ ...m, ...requestData, synced: false } as any)
              : m
          );
          setMaintenanceRecords(updated);
          await setMaintenancesForVehicleKey(maintenanceVehicleKeyStr, updated);
        }

        Alert.alert('Éxito', 'El mantenimiento se guardó en el dispositivo. Se sincronizará al reconectar.');
        setTimeout(() => {
          setIsMaintenanceFormOpen(false);
          setMaintenanceEditing(null);
          resetMaintenanceForm();
        }, 2000);
        return;
      }

      const requestDataForApi = await hydrateMaintenanceImagesForApi(requestData as Record<string, any>);

      const vehicleIdForResolve = vehicle.id || vehicle.id_local;
      if (!vehicleIdForResolve) {
        Alert.alert('Error', 'No se pudo obtener el ID del vehículo');
        setIsSubmittingMaintenance(false);
        return;
      }
      const serverVehicleId = await resolveServerVehicleId(vehicleIdForResolve);
      if (!serverVehicleId) {
        Alert.alert('Error', 'No se pudo obtener el ID del vehículo en el servidor');
        setIsSubmittingMaintenance(false);
        return;
      }

      if (!maintenanceEditing) {
        const res = await createCorporateVehicleMaintenance({
          vehiculo_id: String(serverVehicleId),
          requestData: requestDataForApi as CorporateVehicleMaintenanceRequest,
          refreshAccessToken,
          logout,
        });
        if (!res.status) throw new Error(res.message || 'No se pudo crear');
        Alert.alert('Éxito', res.message || 'Mantenimiento guardado correctamente');
      } else {
        const maintenanceId = String(maintenanceEditing.id);
        const serverMaintenanceId = maintenanceId.startsWith('local-')
          ? String(maintenanceEditing.id_local || '')
          : maintenanceId;
        if (!serverMaintenanceId || serverMaintenanceId.startsWith('local-')) {
          Alert.alert('Error', 'Este mantenimiento aún no está sincronizado');
          setIsSubmittingMaintenance(false);
          return;
        }
        const res = await updateCorporateVehicleMaintenance({
          maintenance_id: serverMaintenanceId,
          requestData: requestDataForApi,
          refreshAccessToken,
          logout,
        });
        if (!res.status) throw new Error(res.message || 'No se pudo actualizar');
        Alert.alert('Éxito', res.message || 'Mantenimiento guardado correctamente');
      }

      // Refrescar desde servidor
      const res = await listCorporateVehicleMaintenances({
        vehiculo_id: String(serverVehicleId),
        refreshAccessToken,
        logout,
      });
      if (res.status) {
        const serverMaintenances: VehicleMaintenance[] = Array.isArray(res.data)
          ? (res.data as any).map((m: any) => ({ ...m, id_local: '', synced: true }))
          : [];
        setMaintenanceRecords(serverMaintenances);
        await setMaintenancesForVehicleKey(maintenanceVehicleKeyStr, serverMaintenances);
      }

      setTimeout(() => {
        setIsMaintenanceFormOpen(false);
        setMaintenanceEditing(null);
        resetMaintenanceForm();
      }, 2000);
    } catch (e: any) {
      console.error('Error saving maintenance:', e);
      Alert.alert('Error', e?.message || 'No se pudo guardar el mantenimiento');
    } finally {
      setIsSubmittingMaintenance(false);
    }
  };

  const confirmDeleteMaintenance = (m: VehicleMaintenance) => {
    const maintKey = String(m.id || m.id_local);
    Alert.alert('Eliminar', '¿Deseas eliminar este mantenimiento?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => void executeDeleteMaintenance(m, maintKey),
      },
    ]);
  };

  const executeDeleteMaintenance = async (m: VehicleMaintenance, maintKey: string) => {
    if (!maintenanceVehicleKey) return;
    const maintenanceVehicleKeyStr = maintenanceVehicleKey;
    setDeletingMaintenanceKey(maintKey);
    try {
            const isConnected = await getConnectionStatus();
            const maintenanceId = String(m.id || m.id_local);

            if (!isConnected || maintenanceId.startsWith('local-') || !m.synced) {
              const actionsStr = await AsyncStorage.getItem('evaluations_actions');
        let actions = actionsStr ? JSON.parse(actionsStr) : [];
        if (String(maintenanceId).startsWith('local-')) {
          actions = actions.filter(
            (a: any) =>
              !(
                a.type === 'corporate_vehicle_maintenance' &&
                (a.action === 'create' || a.action === 'update') &&
                String(a.id) === String(maintenanceId)
              )
          );
        } else {
              actions.push({
                id: maintenanceId,
                action: 'delete',
                type: 'corporate_vehicle_maintenance',
                payload: {},
                synced: false,
              });
        }
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

        const updated = maintenanceRecords.filter(
          (maintenance) => String(maintenance.id) !== maintenanceId && String(maintenance.id_local) !== maintenanceId
        );
              setMaintenanceRecords(updated);
        await setMaintenancesForVehicleKey(maintenanceVehicleKeyStr, updated);
              Alert.alert('Eliminado offline', 'Se eliminará al sincronizar');
              return;
            }

            const res = await deleteCorporateVehicleMaintenance({
              maintenance_id: maintenanceId,
              refreshAccessToken,
              logout,
            });
            if (!res.status) throw new Error(res.message || 'No se pudo eliminar');

            const updated = maintenanceRecords.filter((maintenance) => String(maintenance.id) !== maintenanceId);
            setMaintenanceRecords(updated);
      await setMaintenancesForVehicleKey(maintenanceVehicleKeyStr, updated);
            Alert.alert('Éxito', 'Mantenimiento eliminado correctamente');
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'No se pudo eliminar el mantenimiento');
          } finally {
      setDeletingMaintenanceKey(null);
          }
  };

  const confirmRemoveMaintenanceListImage = (m: VehicleMaintenance, slot: 'antes' | 'despues') => {
    const label = slot === 'antes' ? 'la foto "antes"' : 'la foto "después"';
    Alert.alert('Eliminar imagen', `¿Quitar ${label} de este mantenimiento?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => void executeRemoveMaintenanceListImage(m, slot) },
    ]);
  };

  const patchPendingMaintenanceImageInQueue = async (
    localMaintId: string,
    field: 'imagen_antes' | 'imagen_despues'
  ) => {
    const actionsStr = await AsyncStorage.getItem('evaluations_actions');
    let actions = actionsStr ? JSON.parse(actionsStr) : [];
    for (const act of ['create', 'update'] as const) {
      const idx = actions.findIndex(
        (a: any) =>
          a.type === 'corporate_vehicle_maintenance' &&
          a.action === act &&
          String(a.id) === String(localMaintId)
      );
      if (idx === -1) continue;
      const p = { ...(actions[idx].payload || {}) };
      p[field] = '';
      const refField = field === 'imagen_antes' ? 'imagen_antes_local_file' : 'imagen_despues_local_file';
      delete p[refField];
      actions[idx] = { ...actions[idx], payload: p };
    }
    await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));
  };

  const executeRemoveMaintenanceListImage = async (m: VehicleMaintenance, slot: 'antes' | 'despues') => {
    if (!maintenanceVehicleKey || !maintenanceVehicle) return;
    const field = slot === 'antes' ? 'imagen_antes' : 'imagen_despues';
    const maintKey = String(m.id || m.id_local);
    const opKey = `${maintKey}-${slot}`;
    setDeletingMaintImageKey(opKey);
    try {
      const isConnected = await getConnectionStatus();
      const vehiculoId = typeof maintenanceVehicle.id === 'number' ? maintenanceVehicle.id : undefined;
      const vehicleIdForAction = String(maintenanceVehicle.id_local || maintenanceVehicle.id);
      const refField = field === 'imagen_antes' ? 'imagen_antes_local_file' : 'imagen_despues_local_file';
      const localRef = typeof (m as any)?.[refField] === 'string' ? String((m as any)[refField]).trim() : '';
      const hasImage =
        (!!(m as any)[field] && String((m as any)[field]).trim().length > 0) ||
        (localRef != null && localRef.length > 0);
      if (localRef) {
        try {
          await deleteFile(localRef);
        } catch {
          // ignore
        }
      }
      if (!hasImage) return;

      if (maintKey.startsWith('local-')) {
        const next = maintenanceRecords.map((row) => {
          if (String(row.id) !== maintKey && String(row.id_local) !== maintKey) return row;
          return { ...row, [field]: '', [refField]: '' };
        });
        setMaintenanceRecords(next);
        await setMaintenancesForVehicleKey(maintenanceVehicleKey, next);
        await patchPendingMaintenanceImageInQueue(maintKey, field);
        return;
      }

      if (!isConnected) {
        const actionsStr = await AsyncStorage.getItem('evaluations_actions');
        const actions = actionsStr ? JSON.parse(actionsStr) : [];
        actions.push({
          id: String(m.id),
          action: 'delete_image',
          type: 'corporate_vehicle_maintenance',
          payload: {
            slot,
            vehiculo_id: vehiculoId && vehiculoId > 0 ? vehiculoId : vehicleIdForAction,
            corpo_id: maintenanceVehicle.corpo_id,
          },
          synced: false,
        });
        await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));
        const next = maintenanceRecords.map((row) => {
          if (String(row.id) !== String(m.id)) return row;
          return { ...row, [field]: '', [refField]: '' };
        });
        setMaintenanceRecords(next);
        await setMaintenancesForVehicleKey(maintenanceVehicleKey, next);
        return;
      }

      const res = await deleteCorporateVehicleMaintenanceImage({
        maintenance_id: String(m.id),
        slot,
        refreshAccessToken,
        logout,
      });
      if (!res.status) throw new Error(res.message || 'No se pudo eliminar la imagen');

      const vehiculoRef = maintenanceVehicle.id ?? maintenanceVehicle.id_local;
      if (vehiculoRef == null || vehiculoRef === '') {
        return;
      }
      const serverVehicleId = await resolveServerVehicleId(vehiculoRef);
      if (serverVehicleId) {
        const listRes = await listCorporateVehicleMaintenances({
          vehiculo_id: String(serverVehicleId),
          refreshAccessToken,
          logout,
        });
        if (listRes.status) {
          const serverMaintenances: VehicleMaintenance[] = Array.isArray(listRes.data)
            ? (listRes.data as any).map((x: any) => ({ ...x, id_local: '', synced: true }))
            : [];
          setMaintenanceRecords(serverMaintenances);
          await setMaintenancesForVehicleKey(maintenanceVehicleKey, serverMaintenances);
        }
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo eliminar la imagen');
    } finally {
      setDeletingMaintImageKey(null);
    }
  };

  // Funciones para cámara
  const openCamera = async (type: 'antes' | 'despues') => {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert('Permisos', 'Se requiere permiso de cámara para tomar fotos');
        return;
      }
    }
    setCameraType(type);
    setIsCameraVisible(true);
  };

  const takePicture = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });
      if (photo?.uri) {
        const fileName = await saveFile({
          uri: photo.uri,
          originalName: `maintenance-${cameraType || 'image'}`,
          extension: 'jpg',
          type: 'image',
          prefix: 'corporate_vehicle_maintenance',
        });
        const previewUri = getLocalFileDisplayUri(fileName) || photo.uri;
        if (cameraType === 'antes') {
          if (maintenanceImagenAntesRef) {
            try {
              await deleteFile(maintenanceImagenAntesRef);
            } catch {
              // ignore
            }
          }
          setMaintenanceImagenAntesRef(fileName);
          setMaintenanceImagenAntes(previewUri);
        } else {
          if (maintenanceImagenDespuesRef) {
            try {
              await deleteFile(maintenanceImagenDespuesRef);
            } catch {
              // ignore
            }
          }
          setMaintenanceImagenDespuesRef(fileName);
          setMaintenanceImagenDespues(previewUri);
        }
      }
      setIsCameraVisible(false);
      setCameraType(null);
    } catch (e) {
      console.error('Error taking picture:', e);
      Alert.alert('Error', 'No se pudo tomar la foto');
    }
  };

  // Funciones para signature
  const formatSignatureForDisplay = (value?: string | null) => {
    if (!value) return '';
    return value.startsWith('data:') ? value : `data:image/png;base64,${value}`;
  };

  const openSignatureModal = (target: 'maintenance_mecanico' | 'use_conductor') => {
    setSignatureTarget(target);
    setSignatureModalVisible(true);
    setSignatureKey((prev) => prev + 1);
  };

  const closeSignatureModal = () => {
    setSignatureModalVisible(false);
    setSignatureTarget(null);
  };

  const clearSignatureInModal = () => {
    setSignatureKey((prev) => prev + 1);
    if (signatureRef.current) signatureRef.current.clearSignature();
  };

  const handleSignatureRead = (signature: string) => {
    if (!signature) {
      Alert.alert('Error', 'No se pudo obtener la firma');
      return;
    }
    const formatted = signature.startsWith('data:') ? signature : `data:image/png;base64,${signature}`;
    if (signatureTarget === 'maintenance_mecanico') {
      setMaintenanceFirmaMecanico(formatted);
    } else if (signatureTarget === 'use_conductor') {
      setUseFirmaConductor(formatted);
    }
    setSignatureModalVisible(false);
    setSignatureTarget(null);
  };

  const acceptSignature = () => {
    if (signatureRef.current) signatureRef.current.readSignature();
  };

  const applyGeneratedFirmaResponsable = async (
    setFirma: React.Dispatch<React.SetStateAction<FirmaData | null>>,
  ) => {
    if (!employee) {
      Alert.alert('Error', 'No se encontró el empleado');
      return;
    }
    const hash = await getCurrentUserDigitalSignature(employee);
    if (!hash) return;
    const decoded = decodeFirmaHash(hash);
    if (!decoded) {
      Alert.alert('Error', 'No se pudo generar la firma');
      return;
    }
    setFirma(decoded);
  };

  // Funciones para firma_responsable
  const generateMaintenanceFirmaResponsable = async () => {
    try {
      setIsGeneratingFirma(true);
      await applyGeneratedFirmaResponsable(setMaintenanceFirmaResponsable);
    } finally {
      setIsGeneratingFirma(false);
    }
  };

  const handleScanQRMaintenance = async () => {
    try {
      const qrData = await scanQR();
      if (!qrData) return;
      const decoded = decodeFirmaHash(qrData);
      if (!decoded) {
        Alert.alert('Error', 'El QR no tiene la estructura esperada');
        return;
      }
      setMaintenanceFirmaResponsable(decoded);
    } catch (e) {
      console.error('Error reading QR (maintenance):', e);
      Alert.alert('Error', 'No se pudo leer el QR');
    }
  };

  // Picker para fecha de mantenimiento
  const openMaintenanceDatePicker = (currentDate: string) => {
    if (currentDate) {
      const d = new Date(currentDate);
      if (!Number.isNaN(d.getTime())) {
        setMaintenanceDatePickerValue(d);
      }
    }
    setShowMaintenanceDatePicker(true);
  };

  const onMaintenanceDatePicked = (event: any, selectedDate?: Date) => {
    setShowMaintenanceDatePicker(false);
    if (event.type === 'set' && selectedDate) {
      setMaintenanceDatePickerValue(selectedDate);
      setMaintenanceFecha(isoToDate(selectedDate.toISOString()));
    }
  };

  const startCreate = () => {
    setIsCreating(true);
    setEditing(null);
    resetForm();
    void applyCurrentMarcaToCreateHierarchy();
  };

  const startEditing = (r: VehicleRecord) => {
    setIsCreating(true);
    setEditing({ id: r.id, id_local: r.id_local });

    if (roleName != null && roleName !== 'OPERATIVO' && Array.isArray(structure) && structure.length > 0) {
      const h = findHierarchyByCorpoIn(structure, Number(r.corpo_id));
      if (h) {
        setSelectedEmpresaId(h.empresaId);
        setSelectedClienteId(h.clienteId);
        setSelectedDivisionId(h.divisionId);
        setSelectedContratoId(h.contratoId);
        setSelectedSucursalId(h.corpoId);
      } else {
        const path = findPathForSucursal(Number(r.cliente_id), Number(r.corpo_id));
        if (path) {
          setSelectedEmpresaId(path.empresa_id);
          setSelectedClienteId(path.cliente_id);
          setSelectedDivisionId(path.division_id);
          setSelectedContratoId(path.contrato_id);
          setSelectedSucursalId(path.sucursal_id);
        } else {
          const empresaFound = empresas.find((e: any) =>
            (e?.clientes || []).some((c: any) => Number(c.id) === Number(r.cliente_id))
          );
          if (empresaFound) setSelectedEmpresaId(Number(empresaFound.id));
          setSelectedClienteId(r.cliente_id != null ? Number(r.cliente_id) : null);
          if ((r as any).division_id != null && Number((r as any).division_id) > 0) {
            setSelectedDivisionId(Number((r as any).division_id));
          } else setSelectedDivisionId(null);
          if ((r as any).contrato_id != null && Number((r as any).contrato_id) > 0) {
            setSelectedContratoId(Number((r as any).contrato_id));
          } else setSelectedContratoId(null);
          setSelectedSucursalId(r.corpo_id != null ? Number(r.corpo_id) : null);
        }
      }
    } else {
      setSelectedEmpresaId(null);
      setSelectedClienteId(null);
      setSelectedDivisionId(null);
      setSelectedContratoId(null);
      setSelectedSucursalId(null);
    }

    if ((r as any).puesto_id != null && Number((r as any).puesto_id) > 0) {
      setSelectedPuestoId(Number((r as any).puesto_id));
    } else {
      setSelectedPuestoId(null);
    }

    const allowedTipos = new Set(['Vehículo', 'Bicicleta', 'Motocicleta']);
    const allowedEstados = new Set(['Activo', 'Inactivo']);
    const loadedTipo = allowedTipos.has(String(r.tipo || '')) ? String(r.tipo) : '';
    setTipo(loadedTipo);
    setEstado(allowedEstados.has(String((r as any)?.estado || '')) ? (String((r as any).estado) as any) : 'Activo');
    setTipoAutoria(r.tipo_autoria || '');
    setMarca(r.marca || '');
    setDescripcion(r.descripcion ?? '');
    if (isTipoBicicleta(loadedTipo)) {
      clearCamposNoAplicanBicicleta({
        setPlaca,
        setKilometraje,
        setProxCambioAceite,
        setModelo,
        setAnno,
        setTituloPropiedad,
        setRtv,
        setMarchamo,
      });
    } else {
      setPlaca(r.placa ?? '');
      setKilometraje(r.kilometraje != null ? String(r.kilometraje) : '');
      setProxCambioAceite(r.prox_cambio_aceite != null ? String(r.prox_cambio_aceite) : '');
      setModelo(r.modelo ?? '');
      setAnno(r.anno != null ? String(r.anno) : '');
      setTituloPropiedad(!!r.titulo_propiedad);
      setRtv(!!r.rtv);
      setMarchamo(!!r.marchamo);
    }
    setFirmaResponsable(decodeFirmaHash(r.firma_responsable) as any);

    setImageFiles([]);
  };

  const getEditingVehicleRecord = (): VehicleRecord | undefined => {
    if (!editing) return undefined;
    return records.find(
      (rec) => String(rec.id) === String(editing.id) || String(rec.id_local) === String(editing.id_local)
    );
  };

  const getVehicleFirmaHashForSave = (): string => {
    if (firmaResponsable) {
      return btoa(
        `${firmaResponsable.sessionId}:${firmaResponsable.empleadoId}:${firmaResponsable.latitud}:${firmaResponsable.longitud}:${firmaResponsable.timestamp}`
      );
    }
    const rec = getEditingVehicleRecord();
    const existing = rec?.firma_responsable;
    if (typeof existing === 'string' && existing.trim().length > 0) return existing.trim();
    return '';
  };

  const validateForm = () => {
    if (!hasCurrentMarca) return 'Debes tener una marca activa para usar este módulo.';
    if (roleName == null) return 'Cargando contexto de marca...';
    if (roleName === 'OPERATIVO') {
      if (!marcaClienteId || !marcaCorpoId) return 'No se pudo determinar cliente o sucursal desde la marca actual';
      const h = marcaCorpoId ? findHierarchyByCorpoIn(structure, Number(marcaCorpoId)) : null;
      const divOk = h?.divisionId || marcaDivisionId;
      if (!divOk) return 'No se pudo determinar la división desde la marca o la estructura';
      if (!marcaPuestoId || marcaPuestoId <= 0) return 'No se pudo determinar el puesto desde la marca actual';
    } else {
      if (!selectedEmpresaId || !selectedClienteId || !selectedSucursalId) return 'Empresa, cliente y sucursal son obligatorios';
      if (!selectedDivisionId) return 'División es obligatoria';
      if (!selectedContratoId) return 'Contrato es obligatorio';
      if (!selectedPuestoId || selectedPuestoId <= 0) return 'Puesto es obligatorio';
    }
    if (!tipo.trim()) return 'Tipo es requerido';
    if (!marca.trim()) return 'Marca es requerida';
    if (!tipoAutoria.trim()) return 'Tipo de autoría es requerido';
    if (!getVehicleFirmaHashForSave().trim()) return 'Firma del responsable (QR o Generar) es requerida';
    return null;
  };

  const generateFirmaResponsable = async () => {
    try {
      setIsGeneratingFirma(true);
      await applyGeneratedFirmaResponsable(setFirmaResponsable);
    } finally {
      setIsGeneratingFirma(false);
    }
  };

  const handleScanQR = async () => {
    try {
      const qrData = await scanQR();
      if (!qrData) return;
      const decoded = decodeFirmaHash(qrData);
      if (!decoded) {
        Alert.alert('Error', 'El QR no tiene la estructura esperada');
        return;
      }
      setFirmaResponsable(decoded);
    } catch (e) {
      console.error('Error reading QR:', e);
      Alert.alert('Error', 'No se pudo leer el QR');
    }
  };

  const generateUseFirmaResponsable = async () => {
    try {
      setIsGeneratingFirma(true);
      await applyGeneratedFirmaResponsable(setUseFirmaResponsable);
    } finally {
      setIsGeneratingFirma(false);
    }
  };

  const handleScanQRUse = async () => {
    try {
      const qrData = await scanQR();
      if (!qrData) return;
      const decoded = decodeFirmaHash(qrData);
      if (!decoded) {
        Alert.alert('Error', 'El QR no tiene la estructura esperada');
        return;
      }
      setUseFirmaResponsable(decoded);
    } catch (e) {
      console.error('Error reading QR (use):', e);
      Alert.alert('Error', 'No se pudo leer el QR');
    }
  };

  const handleAddImage = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*'],
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      let extension = '';
      if (asset.name && asset.name.includes('.')) extension = asset.name.split('.').pop() || '';
      else if (asset.mimeType && asset.mimeType.includes('/')) extension = asset.mimeType.split('/').pop() || '';
      const displayName = asset.name || `imagen.${extension || 'jpg'}`;
      const stem = displayName.includes('.') ? displayName.slice(0, displayName.lastIndexOf('.')) : displayName;
      const extNorm = String(extension || 'jpg').replace(/^\./, '');

      const localFileName = await saveFile({
        uri: asset.uri,
        originalName: stem.trim() || 'imagen',
        extension: extNorm,
        type: 'image',
        prefix: CORPORATE_VEHICLE_IMAGE_PREFIX,
      });

      const localId = `local_img_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const newFile: LocalImage = {
        id: localId,
        name: displayName,
        extension: extNorm,
        mimeType: asset.mimeType,
        localFileName,
      };

      setImageFiles((p) => [...p, newFile]);
    } catch (e) {
      console.error('Error picking image (CorporateVehicles):', e);
      Alert.alert('Error', 'No se pudo seleccionar la imagen.');
    }
  };

  const buildImagenesForOfflineQueueFromList = (list: LocalImage[]): any[] => {
    const out: any[] = [];
    for (const f of list) {
      if (f.serverImageId && f.serverImageId > 0 && !f.localFileName && !f.base64) continue;
      const ext = String(f.extension || 'jpg').replace(/^\./, '');
      if (f.localFileName != null && String(f.localFileName).trim() !== '') {
        out.push({
          extension: ext,
          stored_file_name: String(f.localFileName).trim(),
          original_name: f.name,
        });
      } else if (f.base64 != null && String(f.base64).trim() !== '') {
        out.push({
          extension: ext,
          file_base64: getBase64Only(f.base64),
          original_name: f.name,
        });
      }
    }
    return out;
  };

  const updatePendingCorporateVehicleImagenes = async (localKey: string, list: LocalImage[]) => {
    const queuePayload = buildImagenesForOfflineQueueFromList(list);
    const imagenesField = queuePayload.length > 0 ? queuePayload : '[]';
    const actionsStr = await AsyncStorage.getItem('evaluations_actions');
    let actions = actionsStr ? JSON.parse(actionsStr) : [];
    const idxCreate = actions.findIndex(
      (a: any) =>
        a.type === 'corporate_vehicle' && a.action === 'create' && String(a.id) === String(localKey)
    );
    if (idxCreate !== -1) {
      actions[idxCreate] = {
        ...actions[idxCreate],
        payload: { ...(actions[idxCreate].payload || {}), imagenes: imagenesField },
      };
      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));
      return;
    }
    const idxUp = actions.findIndex(
      (a: any) =>
        a.type === 'corporate_vehicle' && a.action === 'update' && String(a.id) === String(localKey)
    );
    if (idxUp !== -1) {
      actions[idxUp] = {
        ...actions[idxUp],
        payload: { ...(actions[idxUp].payload || {}), imagenes: imagenesField },
      };
      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));
    }
  };

  /** Quitar del formulario solo archivos **nuevos** añadidos en esta edición (no hay adjuntos del servidor en el form). */
  const confirmRemoveFormImage = (id: string) => {
    Alert.alert('Confirmar', '¿Quitar esta imagen del formulario?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Quitar', style: 'destructive', onPress: () => void executeRemoveFormImage(id) },
    ]);
  };

  const executeRemoveFormImage = async (id: string) => {
    const target = imageFiles.find((f) => f.id === id);
    if (!target) return;
    if (target.localFileName != null && String(target.localFileName).trim() !== '') {
      try {
        await deleteFile(String(target.localFileName).trim());
      } catch {
        /* noop */
      }
    }
    const next = imageFiles.filter((f) => f.id !== id);
    setImageFiles(next);
    const rec = getEditingVehicleRecord();
    const isLocalDraft =
      rec &&
      (String(rec.id || '').startsWith('local-') || String(rec.id_local || '').startsWith('local-'));
    if (isLocalDraft) {
      const key = String(rec?.id_local || rec?.id);
      if (key.startsWith('local-')) {
        await updatePendingCorporateVehicleImagenes(key, next);
      }
    }
  };

  const buildImagenesForApi = async (): Promise<{ extension: string; file_base64: string; original_name?: string }[]> => {
    const out: { extension: string; file_base64: string; original_name?: string }[] = [];
    for (const f of imageFiles) {
      if (f.serverImageId && f.serverImageId > 0 && !f.localFileName && !f.base64) continue;
      const ext = String(f.extension || 'jpg').replace(/^\./, '');
      if (f.localFileName != null && String(f.localFileName).trim() !== '') {
        try {
          const { base64 } = await getFile(String(f.localFileName).trim());
          if (base64 && String(base64).length > 0) {
            out.push({ extension: ext, file_base64: String(base64), original_name: f.name });
          }
        } catch {
          /* omitir */
        }
      } else if (f.base64 != null && String(f.base64).trim() !== '') {
        out.push({ extension: ext, file_base64: getBase64Only(f.base64), original_name: f.name });
      }
    }
    return out;
  };

  /** Referencias a disco para cola offline / `evaluations_actions` (se hidratan en sync). */
  const buildImagenesForOfflineQueue = (): any[] => buildImagenesForOfflineQueueFromList(imageFiles);

  const buildRequestDataBase = () => {
    const firmaHash = getVehicleFirmaHashForSave();
    const h =
      roleName === 'OPERATIVO' && marcaCorpoId
        ? findHierarchyByCorpoIn(structure, Number(marcaCorpoId))
        : null;
    const empresaId =
      roleName === 'OPERATIVO' ? (marcaEmpresaId ?? 0) : (selectedEmpresaId ?? 0);
    const clienteId =
      roleName === 'OPERATIVO' ? (marcaClienteId ?? 0) : (selectedClienteId ?? 0);
    const corpoId =
      roleName === 'OPERATIVO' ? (marcaCorpoId ?? 0) : (selectedSucursalId ?? 0);
    const divisionId =
      roleName === 'OPERATIVO'
        ? Number(h?.divisionId ?? marcaDivisionId ?? 0)
        : Number(selectedDivisionId ?? 0);
    const contratoId =
      roleName === 'OPERATIVO'
        ? Number(h?.contratoId ?? marcaContratoId ?? 0)
        : Number(selectedContratoId ?? 0);
    const puestoId =
      roleName === 'OPERATIVO'
        ? Number(marcaPuestoId ?? 0)
        : Number(selectedPuestoId ?? 0);

    const esBicicleta = isTipoBicicleta(tipo);
    const numOrNull = (raw: string): number | null => {
      const s = raw.trim();
      if (!s) return null;
      const n = Number(s);
      return Number.isFinite(n) ? n : null;
    };
    const strOrNull = (raw: string): string | null => {
      const s = raw.trim();
      return s ? s : null;
    };

    return {
      empresa_id: Number(empresaId),
      cliente_id: Number(clienteId),
      corpo_id: Number(corpoId),
      division_id: divisionId,
      contrato_id: contratoId,
      puesto_id: puestoId,
      placa: esBicicleta ? null : strOrNull(placa),
      tipo: tipo.trim(),
      tipo_autoria: tipoAutoria.trim(),
      estado: String(estado || 'Activo'),
      kilometraje: esBicicleta ? null : numOrNull(kilometraje),
      prox_cambio_aceite: esBicicleta ? null : numOrNull(proxCambioAceite),
      modelo: esBicicleta ? null : strOrNull(modelo),
      marca: marca.trim(),
      anno: esBicicleta ? null : numOrNull(anno),
      descripcion: strOrNull(descripcion),
      titulo_propiedad: esBicicleta ? null : tituloPropiedad,
      rtv: esBicicleta ? null : rtv,
      marchamo: esBicicleta ? null : marchamo,
      firma_responsable: firmaHash,
    };
  };

  const handleTipoChange = (v: string) => {
    const next = String(v || '');
    setTipo(next);
    if (isTipoBicicleta(next)) {
      clearCamposNoAplicanBicicleta({
        setPlaca,
        setKilometraje,
        setProxCambioAceite,
        setModelo,
        setAnno,
        setTituloPropiedad,
        setRtv,
        setMarchamo,
      });
    }
  };

  const handleSaveRecord = () => {
    const errMsg = validateForm();
    if (errMsg) {
      Alert.alert('Error', errMsg);
      return;
    }
    Alert.alert('Confirmar', '¿Desea guardar el registro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Aceptar', onPress: () => void executeSaveRecord() },
    ]);
  };

  const executeSaveRecord = async () => {
    setIsSubmitting(true);
    setSubmitResponse(null);

    try {
      const editingVehicle: VehicleRecord | null =
        editing == null
          ? null
          : records.find(
              (r) => String(r.id || r.id_local) === String(editing.id || editing.id_local)
            ) ?? null;

      const basePayload = buildRequestDataBase();
      const imagenesQueue = buildImagenesForOfflineQueue();
      type VehicleSaveFields = ReturnType<typeof buildRequestDataBase>;
      const offlineRequestPayload: VehicleSaveFields & { imagenes?: any[] | string } = {
        ...basePayload,
        ...(imagenesQueue.length > 0 ? { imagenes: imagenesQueue } : {}),
      };

      const isConnected = await getConnectionStatus();

      if (!isConnected) {
        const requestData: VehicleSaveFields & { imagenes?: any[] | string } = offlineRequestPayload;
        const localId = editing?.id_local || `local-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        const actionsStr = await AsyncStorage.getItem('evaluations_actions');
        let actions = actionsStr ? JSON.parse(actionsStr) : [];

        if (!editing) {
          actions.push({
            id: localId,
            action: 'create',
            type: 'corporate_vehicle',
            payload: { ...requestData, id_local: localId },
            synced: false,
          });
        } else {
          const recordKey = String(editing.id_local || editing.id || '');
          const isDraft = String(recordKey).startsWith('local-');
          if (isDraft) {
            actions = actions.filter(
              (a: any) =>
                !(
                  a.type === 'corporate_vehicle' &&
                  a.action === 'update' &&
                  String(a.id) === recordKey
                )
            );
            const ci = actions.findIndex(
              (a: any) =>
                a.action === 'create' &&
                a.type === 'corporate_vehicle' &&
                String(a.id) === recordKey
            );
            const mergedPayload = { ...requestData, id_local: recordKey };
            if (ci !== -1) {
              actions[ci] = {
                ...actions[ci],
                payload: { ...(actions[ci].payload || {}), ...mergedPayload },
                synced: false,
              };
            } else {
              actions.push({
                id: recordKey,
                action: 'create',
                type: 'corporate_vehicle',
                payload: mergedPayload,
                synced: false,
              });
            }
          } else {
            actions.push({
              id: recordKey,
              action: 'update',
              type: 'corporate_vehicle',
              payload: requestData,
              synced: false,
            });
          }
        }
        await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

        const horaAccion = await getHoraAccion();
        if (!horaAccion) {
          Alert.alert('Error', 'No se pudo obtener la hora');
          return;
        }

        const newImageRows = imageFiles.map((f) => ({
          name: f.name,
          id: f.serverImageId,
          id_local: f.id,
          extension: f.extension,
          ...(f.localFileName != null && String(f.localFileName).trim() !== ''
            ? { stored_file_name: String(f.localFileName).trim() }
            : f.base64 != null && String(f.base64).trim() !== ''
              ? { base64: f.base64 }
              : {}),
        }));
        const existingImages = Array.isArray(editingVehicle?.images) ? editingVehicle!.images! : [];
        const imagesPayload = editing
          ? [...existingImages, ...newImageRows]
          : newImageRows;

        if (!editing) {
          const localItem: VehicleRecord = {
            id: localId,
            id_local: localId,
            synced: false,
            type: 'corporate_vehicle',
            empresa_id: requestData.empresa_id,
            cliente_id: requestData.cliente_id,
            corpo_id: requestData.corpo_id,
            division_id: requestData.division_id,
            contrato_id: requestData.contrato_id,
            puesto_id: requestData.puesto_id,
            placa: requestData.placa,
            tipo: requestData.tipo,
            tipo_autoria: requestData.tipo_autoria,
            estado: requestData.estado,
            kilometraje: requestData.kilometraje,
            prox_cambio_aceite: requestData.prox_cambio_aceite,
            modelo: requestData.modelo,
            anno: requestData.anno,
            marca: requestData.marca,
            descripcion: requestData.descripcion,
            titulo_propiedad: requestData.titulo_propiedad,
            rtv: requestData.rtv,
            marchamo: requestData.marchamo,
            firma_responsable: requestData.firma_responsable,
            created_at: new Date(horaAccion).toISOString(),
            images: imagesPayload,
          };
          await upsertCorporateVehicleInMainStructure(
            {
              ...localItem,
              sucursal_id: requestData.corpo_id,
              usos: [],
              c_usos_vehiculos_corporativos: [],
              mantenimientos: [],
              c_mantenimiento_vehiculos_corporativos: [],
            },
            localId
          );
          await upsertVehicleInCorpoCache(localItem as any, { synced: false });
        } else {
          if (!editingVehicle) {
            Alert.alert('Error', 'No se encontró el registro a editar.');
            return;
          }
          const recordKey = String(editing.id_local || editing.id || '');
          const isDraft = String(recordKey).startsWith('local-');
          const usos = editingVehicle.usos || (editingVehicle as any).c_usos_vehiculos_corporativos || [];
          const mantenimientos =
            editingVehicle.mantenimientos ||
            (editingVehicle as any).c_mantenimiento_vehiculos_corporativos ||
            [];
          const merged: any = {
            ...editingVehicle,
                ...requestData,
            id: isDraft ? recordKey : editingVehicle.id,
            id_local: isDraft ? recordKey : editingVehicle.id_local,
            sucursal_id: requestData.corpo_id,
            corpo_id: requestData.corpo_id,
                synced: false,
            type: 'corporate_vehicle',
            images: imagesPayload,
            usos,
            c_usos_vehiculos_corporativos: usos,
            mantenimientos,
            c_mantenimiento_vehiculos_corporativos: mantenimientos,
          };
          let oldCorpo = Number(editingVehicle.corpo_id ?? (editingVehicle as any).sucursal_id ?? 0);
          if (!oldCorpo) {
            const foundS = await findSucursalIdForVehicleKeyInMainStructure(recordKey);
            if (foundS) oldCorpo = foundS;
          }
          const newCorpo = Number(requestData.corpo_id);
          if (oldCorpo && newCorpo && oldCorpo !== newCorpo) {
            await moveCorporateVehicleInMainStructure({
              vehicle: merged,
              oldCorpoId: oldCorpo,
              newCorpoId: newCorpo,
              matchLocalKey: isDraft ? recordKey : null,
            });
          } else {
            await upsertCorporateVehicleInMainStructure(merged, isDraft ? recordKey : null);
          }
          await upsertVehicleInCorpoCache(merged as any, { synced: false });
        }

        Alert.alert('Éxito', 'Se guardó el registro en el dispositivo. Se sincronizará al reconectar.');
        setTimeout(async () => {
          setIsCreating(false);
          setEditing(null);
          resetForm();
          await fetchRecords();
        }, 2000);
        return;
      }

      if (!editing) {
        const imagenesForApiCreate = await buildImagenesForApi();
        const requestData = {
          ...buildRequestDataBase(),
          ...(imagenesForApiCreate.length > 0 ? { imagenes: imagenesForApiCreate } : {}),
        };
        const res = await createCorporateVehicle({ requestData, refreshAccessToken, logout });
        if (!res.status) throw new Error(res.message || 'No se pudo crear');
        const newId = Number((res as any).data?.id ?? 0);
        if (newId && requestData.corpo_id) {
          const createdLayer: any = {
            ...requestData,
            ...(typeof (res as any).data === 'object' ? (res as any).data : {}),
            id: newId,
            corpo_id: requestData.corpo_id,
            sucursal_id: requestData.corpo_id,
            usos: [],
            c_usos_vehiculos_corporativos: [],
            mantenimientos: [],
            c_mantenimiento_vehiculos_corporativos: [],
            images: (res as any).data?.images,
            synced: true,
            type: 'corporate_vehicle',
          };
          await upsertCorporateVehicleInMainStructure(createdLayer, null);
          await upsertVehicleInCorpoCache(createdLayer, { synced: true });
        }
        Alert.alert('Éxito', res.message || 'Registro guardado correctamente');
      } else {
        if (!editingVehicle) throw new Error('No se encontró el registro a editar');
        const newFilesOnly = await buildImagenesForApi();
        const requestData: Record<string, unknown> = { ...buildRequestDataBase() };
        if (newFilesOnly.length > 0) {
          requestData.imagenes = newFilesOnly;
        }
        const idToUpdate = String(editing.id);
        const serverId = idToUpdate.startsWith('local-') ? String(editing.id_local || '') : idToUpdate;
        const res = await updateCorporateVehicle({
          id: serverId,
          requestData: requestData as any,
          refreshAccessToken,
          logout,
        });
        if (!res.status) throw new Error(res.message || 'No se pudo actualizar');
        const vid = Number(
          String(editing.id).startsWith('local-') ? (res as any).data?.id ?? editing.id : editing.id
        );
        const usos = editingVehicle.usos || (editingVehicle as any).c_usos_vehiculos_corporativos || [];
        const mantenimientos =
          editingVehicle.mantenimientos ||
          (editingVehicle as any).c_mantenimiento_vehiculos_corporativos ||
          [];
        const mergedLayer: any = {
          ...editingVehicle,
          ...requestData,
          ...(typeof (res as any).data === 'object' ? (res as any).data : {}),
          id: vid,
          corpo_id: requestData.corpo_id,
          sucursal_id: requestData.corpo_id,
          usos,
          c_usos_vehiculos_corporativos: usos,
          mantenimientos,
          c_mantenimiento_vehiculos_corporativos: mantenimientos,
          images: (res as any).data?.images ?? editingVehicle.images,
          synced: true,
          type: 'corporate_vehicle',
        };
        let oldCorpo = Number(editingVehicle.corpo_id ?? (editingVehicle as any).sucursal_id ?? 0);
        if (!oldCorpo) {
          const sk = String(editing.id_local || editing.id);
          const foundS = await findSucursalIdForVehicleKeyInMainStructure(sk);
          if (foundS) oldCorpo = foundS;
        }
        const newCorpo = Number(requestData.corpo_id);
        const isDraftKey = String(editing.id || editing.id_local || '').startsWith('local-');
        if (oldCorpo && newCorpo && oldCorpo !== newCorpo) {
          await moveCorporateVehicleInMainStructure({
            vehicle: mergedLayer,
            oldCorpoId: oldCorpo,
            newCorpoId: newCorpo,
            matchLocalKey: isDraftKey ? String(editing.id_local || editing.id) : null,
          });
        } else if (newCorpo && vid) {
          await upsertCorporateVehicleInMainStructure(
            mergedLayer,
            isDraftKey ? String(editing.id_local || editing.id) : null
          );
        }
        await upsertVehicleInCorpoCache(mergedLayer, { synced: true });
        Alert.alert('Éxito', res.message || 'Registro guardado correctamente');
      }

      setTimeout(async () => {
        setIsCreating(false);
        setEditing(null);
        resetForm();
        await fetchRecords();
      }, 2000);
    } catch (e: any) {
      console.error('Error saving corporate vehicle:', e);
      Alert.alert('Error', e?.message || 'No se pudo guardar');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = (r: VehicleRecord) => {
    const recordKey = String(r.id || r.id_local);
    Alert.alert('Eliminar', '¿Deseas eliminar este registro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => void executeDeleteVehicle(r, recordKey),
      },
    ]);
  };

  const executeDeleteVehicle = async (r: VehicleRecord, recordKey: string) => {
    setDeletingRecordKey(recordKey);
    try {
            const isConnected = await getConnectionStatus();
            const recordId = String(r.id);
            const sucursalIdHint =
              roleName === 'OPERATIVO'
                ? marcaCorpoId ?? null
                : selectedSucursalId ?? filterCorpoId ?? marcaCorpoId ?? null;

            if (!isConnected || String(r.id_local || '').startsWith('local-') || recordId.startsWith('local-') || !r.synced) {
              const actionsStr = await AsyncStorage.getItem('evaluations_actions');
        let actions = actionsStr ? JSON.parse(actionsStr) : [];
        const localDraftKey =
          String(r.id_local || '').startsWith('local-') || recordId.startsWith('local-')
            ? String(r.id_local || recordId)
            : null;
        if (localDraftKey) {
          actions = actions.filter(
            (a: any) =>
              !(
                a.type === 'corporate_vehicle' &&
                (a.action === 'create' || a.action === 'update') &&
                (String(a.id) === String(r.id) || String(a.id) === String(r.id_local))
              )
          );
        } else {
              actions.push({ id: recordId, action: 'delete', type: 'corporate_vehicle', payload: {}, synced: false });
        }
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));

        await removeCorporateVehicleFromMainStructureEverywhere({
          vehicleId: r.id,
          idLocal:
            (r.id_local && String(r.id_local).startsWith('local-') ? String(r.id_local) : undefined) ||
            (String(r.id).startsWith('local-') ? String(r.id) : undefined),
          sucursalIdHint,
        });
        await removeVehicleFromCorpoCache({ id: r.id, id_local: r.id_local });
              await fetchRecords();
              return;
            }

            const res = await deleteCorporateVehicle({ id: recordId, refreshAccessToken, logout });
            if (!res.status) throw new Error(res.message || 'No se pudo eliminar');
      await removeCorporateVehicleFromMainStructureEverywhere({
        vehicleId: r.id,
        idLocal:
          (r.id_local && String(r.id_local).startsWith('local-') ? String(r.id_local) : undefined) ||
          (String(r.id).startsWith('local-') ? String(r.id) : undefined),
        sucursalIdHint,
      });
      await removeVehicleFromCorpoCache({ id: r.id, id_local: r.id_local });
            await fetchRecords();
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'No se pudo eliminar');
          } finally {
      setDeletingRecordKey(null);
          }
  };

  const vehicleImagesToLocalForPending = (nextImages: VehicleImage[]): LocalImage[] =>
    (nextImages || []).map((im: any, i: number) => ({
      id: `list_${i}`,
      name: im.name || `imagen-${i + 1}`,
      extension: im.extension || 'jpg',
      base64: im.base64,
      localFileName: im.stored_file_name || im.localFileName,
      serverImageId: typeof im.id === 'number' && im.id > 0 ? im.id : undefined,
    }));

  const confirmRemoveListImage = (r: VehicleRecord, img: VehicleImage, imageIndex: number) => {
    Alert.alert('Confirmar', '¿Eliminar este archivo adjunto?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => void executeRemoveListImage(r, img, imageIndex) },
    ]);
  };

  const executeRemoveListImage = async (r: VehicleRecord, img: any, imageIndex: number) => {
    const regIdStr = r.id != null && r.id !== '' ? String(r.id) : '';
    const registroServerId =
      regIdStr && !regIdStr.startsWith('local-') && Number(regIdStr) > 0 ? regIdStr : null;
    const imageId = img?.id != null && Number(img.id) > 0 ? Number(img.id) : null;
    const imgs = Array.isArray(r.images) ? [...r.images] : [];
    const nextImages = imgs.filter((_: any, i: number) => i !== imageIndex);
    const recordKey = String(r.id_local || r.id);

    const deleteLocalStored = async () => {
      if (img?.localFileName != null && String(img.localFileName).trim() !== '') {
        try {
          await deleteFile(String(img.localFileName).trim());
        } catch {
          /* */
        }
      }
      const stored = (img as any)?.stored_file_name;
      if (stored != null && String(stored).trim() !== '') {
        try {
          await deleteFile(String(stored).trim());
        } catch {
          /* */
        }
      }
    };

    if (imageId && registroServerId) {
      const connected = await getConnectionStatus();
      if (connected) {
        const res = await deleteCorporateVehicleImage({
          vehiculoId: registroServerId,
          imageId,
          refreshAccessToken,
          logout,
        });
        if (!res.status) {
          Alert.alert('Error', res.message || 'No se pudo eliminar el archivo');
          return;
        }
      } else {
        const actionsStr = await AsyncStorage.getItem('evaluations_actions');
        const actions = actionsStr ? JSON.parse(actionsStr) : [];
        actions.push({
          id: String(registroServerId),
          action: 'delete_image',
          type: 'corporate_vehicle',
          payload: { imageId, sucursalId: r.corpo_id },
          synced: false,
        });
        await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));
      }
      await deleteLocalStored();
      const merged: any = { ...r, images: nextImages, type: 'corporate_vehicle' };
      const isDraft = String(r.id_local || '').startsWith('local-') || String(r.id).startsWith('local-');
      await upsertCorporateVehicleInMainStructure(merged, isDraft ? recordKey : null);
      try {
        await upsertVehicleInCorpoCache(merged, { synced: r.synced !== false });
      } catch {
        /* */
      }
      await fetchRecords();
      return;
    }

    await deleteLocalStored();
    const mergedOffline: any = { ...r, images: nextImages, type: 'corporate_vehicle' };
    const isLocalDraft = String(r.id_local || '').startsWith('local-') || String(r.id).startsWith('local-');
    if (isLocalDraft && recordKey.startsWith('local-')) {
      await updatePendingCorporateVehicleImagenes(recordKey, vehicleImagesToLocalForPending(nextImages));
    }
    let oldCorpo = Number(r.corpo_id ?? (r as any).sucursal_id ?? 0);
    if (!oldCorpo) {
      const foundS = await findSucursalIdForVehicleKeyInMainStructure(recordKey);
      if (foundS) oldCorpo = foundS;
    }
    const newCorpo = Number(mergedOffline.corpo_id ?? (mergedOffline as any).sucursal_id ?? 0);
    if (oldCorpo && newCorpo && oldCorpo !== newCorpo) {
      await moveCorporateVehicleInMainStructure({
        vehicle: mergedOffline,
        oldCorpoId: oldCorpo,
        newCorpoId: newCorpo,
        matchLocalKey: isLocalDraft ? recordKey : null,
      });
    } else {
      await upsertCorporateVehicleInMainStructure(mergedOffline, isLocalDraft ? recordKey : null);
    }
    try {
      await upsertVehicleInCorpoCache(mergedOffline, { synced: r.synced !== false });
    } catch {
      /* */
    }
    await fetchRecords();
  };

  const renderImagesPreview = (r: VehicleRecord) => {
    const recordKey = String(r.id || r.id_local);
    const vehiculoId = typeof r.id === 'number' && r.id > 0 && !String(r.id).startsWith('local-') ? r.id : undefined;
    const imgs = r.images || [];
    if (imgs.length === 0) return null;
    return (
      <>
        <ThemedText style={styles.mediaLabel}>Imágenes</ThemedText>
        <ThemedView style={styles.imagesList}>
          {imgs.map((img, idx) => {
            const uri = buildImageUrl(vehiculoId, img);
            if (!uri) return null;
            return (
              <ThemedView key={`${recordKey}_img_${idx}`} style={styles.imageWideWrap}>
                <Image source={{ uri }} style={styles.imageWide} resizeMode="contain" />
                <TouchableOpacity
                  style={styles.removeImageBtn}
                  onPress={() => confirmRemoveListImage(r, img, idx)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                </TouchableOpacity>
              </ThemedView>
            );
          })}
        </ThemedView>
      </>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <AppHeader title="Registro de vehículos" onMenuPress={() => setIsMenuVisible(true)} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <ThemedView style={styles.content}>
          {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}

          <ThemedView style={styles.titleContainer}>
            <ThemedText type="title" style={styles.title}>
              <Ionicons name="bus" size={22} color="#000000" /> Registro de vehículos
            </ThemedText>
            <ThemedText style={styles.subtitle}>Registro con firma e imágenes (offline + sync)</ThemedText>
          </ThemedView>

          {!hasCurrentMarca ? (
            <ThemedView style={styles.emptyContainer}>
              <ThemedText style={styles.errorText}>Debes tener una marca activa para usar este módulo.</ThemedText>
            </ThemedView>
          ) : null}

          {/* Filtros Jerárquicos (solo si el rol no es OPERATIVO) */}
          {!isCreating && hasCurrentMarca && roleName != null && roleName !== 'OPERATIVO' ? (
            <ThemedView style={styles.filtersContainer}>
              <ThemedView style={styles.filtersHeader}>
                <TouchableOpacity
                  style={styles.filterToggleButton}
                  onPress={() => setIsHierarchyFiltersExpanded(!isHierarchyFiltersExpanded)}
                >
                  <ThemedText style={styles.filtersTitle}>
                    Filtros Jerárquicos
                  </ThemedText>
                  <Ionicons
                    name={isHierarchyFiltersExpanded ? "chevron-up" : "chevron-down"}
                    size={20}
                    color="#007AFF"
                  />
                </TouchableOpacity>
                {isHierarchyFiltersExpanded ? (
                  <TouchableOpacity
                    style={styles.resetFiltersButton}
                    onPress={() => {
                      void (async () => {
                        await resetListFiltersFromCurrentMarca();
                        void fetchRecords();
                      })();
                    }}
                  >
                    <Ionicons name="refresh" size={16} color="#FF3B30" />
                    <ThemedText style={styles.resetFiltersText}>Reiniciar</ThemedText>
                  </TouchableOpacity>
                ) : null}
              </ThemedView>
              {isHierarchyFiltersExpanded && (
                <ThemedView style={styles.filtersContent}>
                  <ThemedView style={styles.filterGroup}>
                    <ThemedText style={styles.filterLabel}>Empresa:</ThemedText>
                    <View style={styles.pickerWrapper}>
                      <Picker
                        selectedValue={filterEmpresaId ?? ''}
                        onValueChange={(value) => {
                          setFilterEmpresaId(value && value !== '' ? Number(value) : null);
                          setFilterClienteId(null);
                          setFilterDivisionId(null);
                          setFilterContratoId(null);
                          setFilterCorpoId(null);
                        }}
                        style={styles.picker}
                      >
                        <Picker.Item label="Seleccionar..." value="" color="#000000" />
                        {filterEmpresas.map((e: any) => (
                          <Picker.Item key={e.id} label={e.nombre} value={e.id} color="#000000" />
                        ))}
                      </Picker>
                    </View>
                  </ThemedView>

                  {filterEmpresaId != null && (
                    <ThemedView style={styles.filterGroup}>
                      <ThemedText style={styles.filterLabel}>Cliente:</ThemedText>
                      <View style={styles.pickerWrapper}>
                        <Picker
                          selectedValue={filterClienteId ?? ''}
                          onValueChange={(value) => {
                            setFilterClienteId(value && value !== '' ? Number(value) : null);
                            setFilterDivisionId(null);
                            setFilterContratoId(null);
                            setFilterCorpoId(null);
                          }}
                          style={styles.picker}
                        >
                          <Picker.Item label="Seleccionar..." value="" color="#000000" />
                          {filterClientes.map((c: any) => (
                            <Picker.Item key={c.id} label={c.nombre} value={c.id} color="#000000" />
                          ))}
                        </Picker>
                      </View>
                    </ThemedView>
                  )}

                  {filterClienteId != null && (
                    <ThemedView style={styles.filterGroup}>
                      <ThemedText style={styles.filterLabel}>División:</ThemedText>
                      <View style={styles.pickerWrapper}>
                        <Picker
                          selectedValue={filterDivisionId ?? ''}
                          onValueChange={(value) => {
                            setFilterDivisionId(value && value !== '' ? Number(value) : null);
                            setFilterContratoId(null);
                            setFilterCorpoId(null);
                          }}
                          style={styles.picker}
                        >
                          <Picker.Item label="Seleccionar..." value="" color="#000000" />
                          {filterDivisiones.map((d: any) => (
                            <Picker.Item key={d.id} label={d.nombre} value={d.id} color="#000000" />
                          ))}
                        </Picker>
                      </View>
                    </ThemedView>
                  )}

                  {filterDivisionId != null && (
                    <ThemedView style={styles.filterGroup}>
                      <ThemedText style={styles.filterLabel}>Contrato:</ThemedText>
                      <View style={styles.pickerWrapper}>
                        <Picker
                          selectedValue={filterContratoId ?? ''}
                          onValueChange={(value) => {
                            setFilterContratoId(value && value !== '' ? Number(value) : null);
                            setFilterCorpoId(null);
                          }}
                          style={styles.picker}
                        >
                          <Picker.Item label="Seleccionar..." value="" color="#000000" />
                          {filterContratos.map((c: any) => (
                            <Picker.Item key={c.id} label={c.nombre} value={c.id} color="#000000" />
                          ))}
                        </Picker>
                      </View>
                    </ThemedView>
                  )}

                  {filterContratoId != null && (
                    <ThemedView style={styles.filterGroup}>
                      <ThemedText style={styles.filterLabel}>Sucursal:</ThemedText>
                      <View style={styles.pickerWrapper}>
                        <Picker
                          selectedValue={filterCorpoId ?? ''}
                          onValueChange={(value) => {
                            setFilterCorpoId(value && value !== '' ? Number(value) : null);
                            void fetchRecords();
                          }}
                          style={styles.picker}
                        >
                          <Picker.Item label="Seleccionar..." value="" color="#000000" />
                          {filterSucursales.map((s: any) => (
                            <Picker.Item key={s.id} label={s.nombre} value={s.id} color="#000000" />
                          ))}
                        </Picker>
                      </View>
                    </ThemedView>
                  )}
                </ThemedView>
              )}
            </ThemedView>
          ) : null}

          {!isCreating && !isLoading ? (
            <TouchableOpacity style={styles.createButton} onPress={startCreate} activeOpacity={0.85}>
              <ThemedText style={styles.createButtonText}>
                <Ionicons name="add" size={20} color="#FFFFFF" /> Nuevo registro
              </ThemedText>
            </TouchableOpacity>
          ) : null}

          {isCreating ? (
            <ThemedView style={styles.formCard}>
              <ThemedText style={styles.formTitle}>{editing ? 'Editar registro' : 'Nuevo registro'}</ThemedText>

              {roleName != null && roleName !== 'OPERATIVO' ? (
                <>
              <ThemedText style={styles.sectionTitle}>Jerarquía (hasta sucursal)</ThemedText>

              <ThemedText style={styles.label}>Empresa</ThemedText>
              <ThemedView style={styles.pickerWrapper}>
                <Picker selectedValue={selectedEmpresaId ?? 0} onValueChange={(v) => handleEmpresaChange(Number(v) || null)} style={styles.picker}>
                      <Picker.Item label="Seleccione..." value={0} color="#000000" />
                  {empresas.map((e: any) => (
                        <Picker.Item key={`emp_${e.id}`} label={String(e.nombre)} value={Number(e.id)} color="#000000" />
                  ))}
                </Picker>
              </ThemedView>

              <ThemedText style={styles.label}>Cliente</ThemedText>
              <ThemedView style={styles.pickerWrapper}>
                <Picker selectedValue={selectedClienteId ?? 0} onValueChange={(v) => handleClienteChange(Number(v) || null)} style={styles.picker} enabled={!!selectedEmpresaId}>
                      <Picker.Item label="Seleccione..." value={0} color="#000000" />
                  {clientes.map((c: any) => (
                        <Picker.Item key={`cli_${c.id}`} label={String(c.nombre)} value={Number(c.id)} color="#000000" />
                  ))}
                </Picker>
              </ThemedView>

              <ThemedText style={styles.label}>División</ThemedText>
              <ThemedView style={styles.pickerWrapper}>
                <Picker
                  selectedValue={selectedDivisionId ?? 0}
                  onValueChange={(v) => handleDivisionChange(Number(v) || null)}
                  enabled={!!selectedClienteId && divisiones.length > 0}
                  style={styles.picker}
                >
                      <Picker.Item label={selectedClienteId ? 'Seleccione...' : 'Seleccione cliente primero'} value={0} color="#000000" />
                  {divisiones.map((d: any) => (
                        <Picker.Item key={`div_${d.id}`} label={String(d.nombre)} value={Number(d.id)} color="#000000" />
                  ))}
                </Picker>
              </ThemedView>

              <ThemedText style={styles.label}>Contrato</ThemedText>
              <ThemedView style={styles.pickerWrapper}>
                <Picker selectedValue={selectedContratoId ?? 0} onValueChange={(v) => handleContratoChange(Number(v) || null)} style={styles.picker} enabled={!!selectedDivisionId}>
                      <Picker.Item label="Seleccione..." value={0} color="#000000" />
                  {contratos.map((c: any) => (
                        <Picker.Item key={`cont_${c.id}`} label={String(c.nombre)} value={Number(c.id)} color="#000000" />
                  ))}
                </Picker>
              </ThemedView>

              <ThemedText style={styles.label}>Sucursal</ThemedText>
              <ThemedView style={styles.pickerWrapper}>
                <Picker selectedValue={selectedSucursalId ?? 0} onValueChange={(v) => handleSucursalChange(Number(v) || null)} style={styles.picker} enabled={!!selectedContratoId}>
                      <Picker.Item label="Seleccione..." value={0} color="#000000" />
                  {sucursales.map((s: any) => (
                        <Picker.Item key={`suc_${s.id}`} label={String(s.nombre)} value={Number(s.id)} color="#000000" />
                  ))}
                </Picker>
              </ThemedView>

              <ThemedText style={styles.label}>Puesto</ThemedText>
              <ThemedView style={styles.pickerWrapper}>
                <Picker
                  selectedValue={selectedPuestoId ?? 0}
                  onValueChange={(v) => {
                    setSelectedPuestoId(Number(v) || null);
                  }}
                  style={styles.picker}
                  enabled={!!selectedSucursalId}
                >
                  <Picker.Item label="Seleccione..." value={0} color="#000000" />
                  {puestosForm.map((p: any) => (
                    <Picker.Item key={`puesto_${p.id}`} label={String(p.nombre)} value={Number(p.id)} color="#000000" />
                  ))}
                </Picker>
              </ThemedView>
                </>
              ) : null}

              <ThemedText style={styles.sectionTitle}>Datos del vehículo</ThemedText>

              <ThemedText style={styles.label}>Tipo *</ThemedText>
              <ThemedView style={styles.pickerWrapper}>
                <Picker selectedValue={tipo} onValueChange={(v) => handleTipoChange(String(v || ''))} style={styles.picker}>
                  <Picker.Item label="Seleccione..." value="" color="#000000" />
                  <Picker.Item label="Vehículo" value="Vehículo" color="#000000" />
                  <Picker.Item label="Bicicleta" value="Bicicleta" color="#000000" />
                  <Picker.Item label="Motocicleta" value="Motocicleta" color="#000000" />
                </Picker>
              </ThemedView>

              {!isTipoBicicleta(tipo) ? (
                <>
                  <ThemedText style={styles.label}>Placa</ThemedText>
                  <TextInput value={placa} onChangeText={setPlaca} style={styles.input} placeholder="Placa" placeholderTextColor="#999" />
                </>
              ) : null}

              <ThemedText style={styles.label}>Tipo de autoría</ThemedText>
              <ThemedView style={styles.pickerWrapper}>
                <Picker
                  selectedValue={tipoAutoria}
                  onValueChange={(v) => setTipoAutoria(String(v || ''))}
                  style={styles.picker}
                >
                  <Picker.Item label="Seleccione..." value="" color="#000000" />
                  <Picker.Item label="Cliente" value="Cliente" color="#000000" />
                  <Picker.Item label="Corporativo" value="Corporativo" color="#000000" />
                </Picker>
              </ThemedView>

              <ThemedText style={styles.label}>Estado</ThemedText>
              <ThemedView style={styles.pickerWrapper}>
                <Picker selectedValue={estado} onValueChange={(v) => setEstado((String(v) as any) || 'Activo')} style={styles.picker}>
                  <Picker.Item label="Activo" value="Activo" color="#000000" />
                  <Picker.Item label="Inactivo" value="Inactivo" color="#000000" />
                </Picker>
              </ThemedView>

              {!isTipoBicicleta(tipo) ? (
                <>
                  <ThemedText style={styles.label}>Kilometraje</ThemedText>
                  <TextInput value={kilometraje} onChangeText={setKilometraje} style={styles.input} placeholder="0" keyboardType="numeric" placeholderTextColor="#999" />

                  <ThemedText style={styles.label}>Próximo cambio de aceite</ThemedText>
                  <TextInput value={proxCambioAceite} onChangeText={setProxCambioAceite} style={styles.input} placeholder="0" keyboardType="numeric" placeholderTextColor="#999" />

                  <ThemedText style={styles.label}>Modelo</ThemedText>
                  <TextInput value={modelo} onChangeText={setModelo} style={styles.input} placeholder="Modelo" placeholderTextColor="#999" />

                  <ThemedText style={styles.label}>Año</ThemedText>
                  <TextInput value={anno} onChangeText={setAnno} style={styles.input} placeholder="2026" keyboardType="numeric" placeholderTextColor="#999" />
                </>
              ) : null}

              <ThemedText style={styles.label}>Marca *</ThemedText>
              <TextInput value={marca} onChangeText={setMarca} style={styles.input} placeholder="Marca" placeholderTextColor="#999" />

              <ThemedText style={styles.label}>Descripción</ThemedText>
              <TextInput
                value={descripcion}
                onChangeText={setDescripcion}
                style={[styles.input, styles.textArea]}
                placeholder="Descripción"
                placeholderTextColor="#999"
                multiline
              />

              {!isTipoBicicleta(tipo) ? (
                <>
                  <ThemedText style={styles.sectionTitle}>Documentos</ThemedText>
                  <ThemedView style={styles.switchRow}>
                    <TouchableOpacity style={[styles.switchBtn, tituloPropiedad && styles.switchBtnOn]} onPress={() => setTituloPropiedad((p) => !p)} activeOpacity={0.85}>
                      <Ionicons name={tituloPropiedad ? 'checkbox' : 'square-outline'} size={18} color={tituloPropiedad ? '#34C759' : '#666'} />
                      <ThemedText style={styles.switchText}>Título propiedad</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.switchBtn, rtv && styles.switchBtnOn]} onPress={() => setRtv((p) => !p)} activeOpacity={0.85}>
                      <Ionicons name={rtv ? 'checkbox' : 'square-outline'} size={18} color={rtv ? '#34C759' : '#666'} />
                      <ThemedText style={styles.switchText}>RTV</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.switchBtn, marchamo && styles.switchBtnOn]} onPress={() => setMarchamo((p) => !p)} activeOpacity={0.85}>
                      <Ionicons name={marchamo ? 'checkbox' : 'square-outline'} size={18} color={marchamo ? '#34C759' : '#666'} />
                      <ThemedText style={styles.switchText}>Marchamo</ThemedText>
                    </TouchableOpacity>
                  </ThemedView>
                </>
              ) : null}

              <ThemedText style={styles.sectionTitle}>Firma responsable</ThemedText>
              {firmaResponsable ? (
                <ThemedView style={styles.signatureInfo}>
                  <ThemedText style={styles.signatureLine}>
                    <ThemedText style={styles.cardLabel}>Empleado: </ThemedText>
                    <ThemedText style={styles.cardValue}>{firmaResponsable.empleadoId}</ThemedText>
                  </ThemedText>
                  <ThemedText style={styles.signatureLine}>
                    <ThemedText style={styles.cardLabel}>Sesión: </ThemedText>
                    <ThemedText style={styles.cardValue}>{firmaResponsable.sessionId}</ThemedText>
                  </ThemedText>
                </ThemedView>
              ) : (
                <ThemedText style={styles.emptyText}>No hay firma registrada</ThemedText>
              )}
              {!firmaResponsable ? (
                <TouchableOpacity
                  style={styles.signatureButtonPrimary}
                  onPress={generateFirmaResponsable}
                  disabled={isGeneratingFirma}
                  activeOpacity={0.85}
                >
                  {isGeneratingFirma ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="sparkles-outline" size={18} color="#FFFFFF" />
                      <ThemedText style={styles.signatureButtonText}>Generar firma</ThemedText>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <ThemedView style={styles.signatureInfo}>
                  <ThemedText style={styles.signatureInfoTitle}>
                    Información de la firma del responsable
                  </ThemedText>
                  <ThemedText style={styles.signatureInfoText}>
                    ID de sesión: {firmaResponsable.sessionId}
                  </ThemedText>
                  <ThemedText style={styles.signatureInfoText}>
                    ID del empleado: {firmaResponsable.empleadoId}
                  </ThemedText>
                  <ThemedText style={styles.signatureInfoText}>
                    Latitud: {firmaResponsable.latitud}
                  </ThemedText>
                  <ThemedText style={styles.signatureInfoText}>
                    Longitud: {firmaResponsable.longitud}
                  </ThemedText>
                  <ThemedText style={styles.signatureInfoText}>
                    Fecha y hora: {convertDateTimestampToLocalString(new Date(Number(firmaResponsable.timestamp)).toISOString())}
                  </ThemedText>
                </ThemedView>
              )}
              {!firmaResponsable && (
                <TouchableOpacity
                  style={[styles.signatureButtonPrimary, { marginTop: 8 }]}
                  onPress={handleScanQR}
                  activeOpacity={0.85}
                >
                  <Ionicons name="qr-code-outline" size={18} color="#FFFFFF" />
                  <ThemedText style={styles.signatureButtonText}>Escanear QR</ThemedText>
                </TouchableOpacity>
              )}

              <ThemedText style={styles.sectionTitle}>Imágenes nuevas (opcional)</ThemedText>
              <ThemedText style={styles.formHierarchyHint}>
                {editing
                  ? 'Solo se suben imágenes que agregue aquí. En el listado puede ver o eliminar los archivos ya guardados.'
                  : 'Las imágenes se guardan en el dispositivo y se suben al confirmar.'}
              </ThemedText>
              <TouchableOpacity style={styles.attachButton} onPress={handleAddImage} activeOpacity={0.85}>
                <Ionicons name="image-outline" size={20} color="#007AFF" />
                <ThemedText style={styles.attachButtonText}>Adjuntar imagen</ThemedText>
              </TouchableOpacity>

              {imageFiles.length > 0 ? (
                <ThemedView style={styles.imagesList}>
                  {imageFiles.map((img) => {
                    const ext = (img.extension || 'jpg').toLowerCase();
                    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
                    const fileUri =
                      img.localFileName != null && String(img.localFileName).trim() !== ''
                        ? getLocalFileDisplayUri(String(img.localFileName).trim())
                        : '';
                    const uri =
                      fileUri ||
                      (img.base64 != null && String(img.base64).trim() !== ''
                        ? `data:${mime};base64,${img.base64}`
                        : '');
                    if (!uri) {
                      return (
                        <ThemedView key={img.id} style={styles.imageWideWrap}>
                          <ThemedText style={styles.emptyText}>Imagen no disponible</ThemedText>
                        </ThemedView>
                      );
                    }
                    return (
                      <ThemedView key={img.id} style={styles.imageWideWrap}>
                        <ThemedText style={styles.imagePreviewTitle}>Nueva imagen</ThemedText>
                        <Image source={{ uri }} style={styles.imageWide} resizeMode="contain" />
                        <TouchableOpacity style={styles.removeImageBtn} onPress={() => confirmRemoveFormImage(img.id)} activeOpacity={0.85}>
                          <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                        </TouchableOpacity>
                      </ThemedView>
                    );
                  })}
                </ThemedView>
              ) : null}

              <ThemedView style={styles.formActions}>
                <TouchableOpacity style={[styles.formActionBtn, styles.cancelBtn]} onPress={() => { setIsCreating(false); setEditing(null); resetForm(); }} activeOpacity={0.85}>
                  <Ionicons name="close" size={18} color="#000000" />
                  <ThemedText style={styles.cancelBtnText}>Cancelar</ThemedText>
                </TouchableOpacity>
                {submitResponse && (
                  <ThemedView style={[styles.responseContainer, submitResponse.type === 'success' ? styles.responseSuccess : styles.responseError]}>
                    <ThemedText style={styles.responseText}>
                      {submitResponse.type === 'success' ? '✓ ' : '✗ '}
                      {submitResponse.message}
                    </ThemedText>
                  </ThemedView>
                )}
                <TouchableOpacity 
                  style={[styles.formActionBtn, styles.saveBtn, isSubmitting && styles.buttonDisabled]} 
                  onPress={handleSaveRecord} 
                  activeOpacity={0.85}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="save-outline" size={18} color="#FFFFFF" />
                      <ThemedText style={styles.saveBtnText}>Aceptar</ThemedText>
                    </>
                  )}
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>
          ) : null}

          {isLoading ? <ThemedText style={styles.loadingText}>Cargando...</ThemedText> : null}

          {!isLoading && records.length === 0 ? (
            <ThemedView style={styles.emptyContainer}>
              <ThemedText style={styles.emptyText}>No hay registros</ThemedText>
            </ThemedView>
          ) : (
            <ThemedView style={styles.listContainer}>
              {records.map((r) => {
                const recordKey = String(r.id || r.id_local);
                const isOffline = !r.synced || String(r.id_local || '').startsWith('local-') || String(r.id).startsWith('local-');
                const isExpanded = expanded.has(recordKey);
                const vehiculoId = typeof r.id === 'number' ? r.id : undefined;

                return (
                  <ThemedView key={recordKey} style={styles.card}>
                    <ThemedText style={styles.cardTitle}>
                      {r.placa || '—'}
                      {isOffline ? ' (offline)' : ''}
                    </ThemedText>

                    <ThemedText style={styles.cardLine}>
                      <ThemedText style={styles.cardLabel}>Tipo: </ThemedText>
                      <ThemedText style={styles.cardValue}>{r.tipo || '—'}</ThemedText>
                    </ThemedText>
                    <ThemedText style={styles.cardLine}>
                      <ThemedText style={styles.cardLabel}>Tipo de autoria: </ThemedText>
                      <ThemedText style={styles.cardValue}>{r.tipo_autoria || '—'}</ThemedText>
                    </ThemedText>
                    <ThemedText style={styles.cardLine}>
                      <ThemedText style={styles.cardLabel}>Estado: </ThemedText>
                      <ThemedText style={styles.cardValue}>{(r as any)?.estado || 'Activo'}</ThemedText>
                    </ThemedText>

                    <TouchableOpacity style={styles.collapseButton} onPress={() => toggleExpanded(recordKey)} activeOpacity={0.85}>
                      <ThemedText style={styles.collapseButtonText}>{isExpanded ? 'Ocultar detalles' : 'Ver detalles'}</ThemedText>
                      <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color="#007AFF" />
                    </TouchableOpacity>

                    {isExpanded ? (
                      <ThemedView style={styles.collapseContent}>
                        <ThemedText style={styles.detailText}>
                          <ThemedText style={styles.cardLabel}>Descripción: </ThemedText>
                          <ThemedText style={styles.cardValue}>{r.descripcion || '—'}</ThemedText>
                        </ThemedText>
                        <ThemedText style={styles.detailText}>
                          <ThemedText style={styles.cardLabel}>Kilometraje: </ThemedText>
                          <ThemedText style={styles.cardValue}>{String(r.kilometraje ?? '—')}</ThemedText>
                        </ThemedText>
                        <ThemedText style={styles.detailText}>
                          <ThemedText style={styles.cardLabel}>Próximo cambio aceite: </ThemedText>
                          <ThemedText style={styles.cardValue}>{String(r.prox_cambio_aceite ?? '—')}</ThemedText>
                        </ThemedText>

                        {renderImagesPreview(r)}
                      </ThemedView>
                    ) : null}

                    <ThemedView style={styles.actionsRow}>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.usesBtn]}
                        onPress={() => openUsesModal(r)}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="list-outline" size={18} color="#FFFFFF" />
                        <ThemedText style={styles.actionBtnText}>Usos</ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.usesBtn]}
                        onPress={() => openMaintenanceModal(r)}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="construct-outline" size={18} color="#FFFFFF" />
                        <ThemedText style={styles.actionBtnText}>Mantenimiento</ThemedText>
                      </TouchableOpacity>
                    </ThemedView>
                    <ThemedView style={styles.actionsRow}>
                      <TouchableOpacity style={[styles.actionBtn, styles.editBtn]} onPress={() => startEditing(r)} activeOpacity={0.85}>
                        <Ionicons name="create-outline" size={18} color="#FFFFFF" />
                        <ThemedText style={styles.actionBtnText}>Editar</ThemedText>
                      </TouchableOpacity>
                      {!(r.id_local || String(r.id).startsWith('local-') || r.id === 0) && (
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.changesButton]}
                          onPress={() => {
                            setCambiosTitle(`Cambios - Vehículo ${r.placa || r.id}`);
                            fetchCambios('c_vehiculos_corporativos', Number(r.id));
                          }}
                          activeOpacity={0.85}
                        >
                          <Ionicons name="list-outline" size={18} color="#FFFFFF" />
                          <ThemedText style={styles.actionBtnText}>Cambios</ThemedText>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.deleteBtn, deletingRecordKey === recordKey && styles.buttonDisabled]}
                        onPress={() => confirmDelete(r)}
                        activeOpacity={0.85}
                        disabled={deletingRecordKey === recordKey}
                      >
                        {deletingRecordKey === recordKey ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                        <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
                        <ThemedText style={styles.actionBtnText}>Eliminar</ThemedText>
                          </>
                        )}
                      </TouchableOpacity>
                    </ThemedView>
                  </ThemedView>
                );
              })}
            </ThemedView>
          )}
        </ThemedView>
      </ScrollView>

      <AppFooter />
      <SlideMenu
        isVisible={isMenuVisible}
        onClose={() => setIsMenuVisible(false)}
        onHomePress={() => navigation.navigate('Home')}
        currentRoute="CorporateVehicles"
      />

      <Modal
        transparent
        visible={usesModalVisible}
        animationType="fade"
        onRequestClose={closeUsesModal}
      >
        <ThemedView style={styles.modalBackdrop}>
          <ThemedView style={styles.modalCard}>
            <ThemedView style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>
                Usos{usesVehicle?.placa ? ` - ${usesVehicle.placa}` : ''}
              </ThemedText>
              <TouchableOpacity onPress={closeUsesModal} style={styles.modalCloseBtn} activeOpacity={0.85}>
                <Ionicons name="close" size={22} color="#000" />
              </TouchableOpacity>
            </ThemedView>

            <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent} keyboardShouldPersistTaps="handled">
              <TouchableOpacity style={styles.modalPrimaryBtn} onPress={startCreateUse} activeOpacity={0.85}>
                <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
                <ThemedText style={styles.modalPrimaryBtnText}>Nuevo uso</ThemedText>
              </TouchableOpacity>

              {isUseFormOpen ? (
                <ThemedView style={styles.modalFormCard}>
                  <ThemedText style={styles.modalSectionTitle}>{useEditing ? 'Editar uso' : 'Nuevo uso'}</ThemedText>

                  <ThemedText style={styles.label}>Código del conductor</ThemedText>
                  <TextInput
                    style={styles.input}
                    value={useCodigoConductor}
                    onChangeText={setUseCodigoConductor}
                    placeholder="Código del conductor"
                    placeholderTextColor="#999"
                  />
                  <TouchableOpacity
                    style={[styles.formActionBtn, styles.saveBtn, { marginBottom: 8 }]}
                    onPress={searchUseConductorByCode}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="search-outline" size={18} color="#FFFFFF" />
                    <ThemedText style={styles.saveBtnText}>Buscar conductor</ThemedText>
                  </TouchableOpacity>

                  <ThemedText style={styles.label}>Nombre del conductor</ThemedText>
                  <TextInput
                    style={styles.input}
                    value={useNombreConductor}
                    onChangeText={setUseNombreConductor}
                    placeholder="Nombre"
                    placeholderTextColor="#999"
                  />

                  <ThemedText style={styles.label}>Inicio (fecha)</ThemedText>
                  <TouchableOpacity style={styles.dateButton} onPress={() => openUseDatePicker('inicio_fecha', useInicioFecha)} activeOpacity={0.85}>
                    <ThemedText style={styles.dateButtonText}>{useInicioFecha ? convertDateTimestampToLocalString(new Date(useInicioFecha).toISOString(), false) : 'Seleccionar fecha'}</ThemedText>
                    <Ionicons name="calendar-outline" size={18} color="#007AFF" />
                  </TouchableOpacity>

                  <ThemedText style={styles.label}>Inicio (hora)</ThemedText>
                  <TouchableOpacity style={styles.dateButton} onPress={() => openUseTimePicker('inicio_hora', useInicioHora)} activeOpacity={0.85}>
                    <ThemedText style={styles.dateButtonText}>{useInicioHora || 'Seleccionar hora'}</ThemedText>
                    <Ionicons name="time-outline" size={18} color="#007AFF" />
                  </TouchableOpacity>

                  <ThemedText style={styles.label}>Fin (fecha)</ThemedText>
                  <TouchableOpacity style={styles.dateButton} onPress={() => openUseDatePicker('fin_fecha', useFinFecha)} activeOpacity={0.85}>
                    <ThemedText style={styles.dateButtonText}>{useFinFecha ? convertDateTimestampToLocalString(new Date(useFinFecha).toISOString(), false) : 'Seleccionar fecha'}</ThemedText>
                    <Ionicons name="calendar-outline" size={18} color="#007AFF" />
                  </TouchableOpacity>

                  <ThemedText style={styles.label}>Fin (hora)</ThemedText>
                  <TouchableOpacity style={styles.dateButton} onPress={() => openUseTimePicker('fin_hora', useFinHora)} activeOpacity={0.85}>
                    <ThemedText style={styles.dateButtonText}>{useFinHora || 'Seleccionar hora'}</ThemedText>
                    <Ionicons name="time-outline" size={18} color="#007AFF" />
                  </TouchableOpacity>

                  {showUseDatePicker ? (
                    <DateTimePicker
                      value={useDatePickerValue}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'inline' : 'default'}
                      onChange={onUseDatePicked}
                    />
                  ) : null}

                  {showUseTimePicker ? (
                    <DateTimePicker
                      value={useTimePickerValue}
                      mode="time"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={onUseTimePicked}
                    />
                  ) : null}

                  <ThemedText style={styles.label}>Combustible inicio</ThemedText>
                  <ThemedView style={styles.pickerWrapper}>
                    <Picker selectedValue={useCombInicio} onValueChange={(v) => setUseCombInicio(String(v))} style={styles.picker}>
                      <Picker.Item label="Seleccione combustible inicio..." value="" color="#000000" />
                      {COMBUSTIBLE_OPTIONS.map((opt) => (
                        <Picker.Item key={`comb-i-${opt}`} label={opt} value={opt} color="#000000" />
                      ))}
                    </Picker>
                  </ThemedView>

                  <ThemedText style={styles.label}>Combustible fin</ThemedText>
                  <ThemedView style={styles.pickerWrapper}>
                    <Picker selectedValue={useCombFin} onValueChange={(v) => setUseCombFin(String(v))} style={styles.picker}>
                      <Picker.Item label="Seleccione combustible fin..." value="" color="#000000" />
                      {COMBUSTIBLE_OPTIONS.map((opt) => (
                        <Picker.Item key={`comb-f-${opt}`} label={opt} value={opt} color="#000000" />
                      ))}
                    </Picker>
                  </ThemedView>

                  <ThemedText style={styles.label}>KM inicio</ThemedText>
                  <TextInput style={styles.input} value={useKmInicio} onChangeText={setUseKmInicio} placeholder="0" keyboardType="numeric" placeholderTextColor="#999" />

                  <ThemedText style={styles.label}>KM fin</ThemedText>
                  <TextInput style={styles.input} value={useKmFin} onChangeText={setUseKmFin} placeholder="0" keyboardType="numeric" placeholderTextColor="#999" />

                  <ThemedText style={styles.label}>Motivo</ThemedText>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={useMotivo}
                    onChangeText={setUseMotivo}
                    placeholder="Motivo"
                    placeholderTextColor="#999"
                    multiline
                  />

                  <ThemedText style={styles.sectionTitle}>Firma del conductor</ThemedText>
                  <ThemedView style={styles.signatureInfo}>
                    {useFirmaConductor ? (
                      <Image source={{ uri: formatSignatureForDisplay(useFirmaConductor) }} style={styles.signaturePreview} resizeMode="contain" />
                    ) : (
                      <ThemedText style={styles.signatureLine}>Sin firma del conductor</ThemedText>
                    )}
                    <TouchableOpacity
                      style={[styles.signatureButtonPrimary, { marginTop: 8 }]}
                      onPress={() => openSignatureModal('use_conductor')}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="create-outline" size={18} color="#FFFFFF" />
                      <ThemedText style={styles.signatureButtonText}>Dibujar firma</ThemedText>
                    </TouchableOpacity>
                  </ThemedView>

                  <ThemedText style={styles.sectionTitle}>Firma responsable</ThemedText>
                  <ThemedView style={styles.signatureInfo}>
                    {useFirmaResponsable ? (
                      <>
                        <ThemedText style={styles.signatureLine}>Empleado: {useFirmaResponsable.empleadoId}</ThemedText>
                        <ThemedText style={styles.signatureLine}>Lat: {useFirmaResponsable.latitud} | Lon: {useFirmaResponsable.longitud}</ThemedText>
                        <ThemedText style={styles.signatureLine}>TS: {useFirmaResponsable.timestamp}</ThemedText>
                      </>
                    ) : (
                      <ThemedText style={styles.signatureLine}>Sin firma</ThemedText>
                    )}

                    {!useFirmaResponsable ? (
                      <TouchableOpacity
                        style={styles.signatureButtonPrimary}
                        onPress={generateUseFirmaResponsable}
                        disabled={isGeneratingFirma}
                        activeOpacity={0.85}
                      >
                        {isGeneratingFirma ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Ionicons name="sparkles-outline" size={18} color="#FFFFFF" />
                            <ThemedText style={styles.signatureButtonText}>Generar firma</ThemedText>
                          </>
                        )}
                      </TouchableOpacity>
                    ) : (
                      <ThemedView style={styles.signatureInfo}>
                        <ThemedText style={styles.signatureInfoTitle}>
                          Información de la firma del responsable
                        </ThemedText>
                        <ThemedText style={styles.signatureInfoText}>
                          ID de sesión: {useFirmaResponsable.sessionId}
                        </ThemedText>
                        <ThemedText style={styles.signatureInfoText}>
                          ID del empleado: {useFirmaResponsable.empleadoId}
                        </ThemedText>
                        <ThemedText style={styles.signatureInfoText}>
                          Latitud: {useFirmaResponsable.latitud}
                        </ThemedText>
                        <ThemedText style={styles.signatureInfoText}>
                          Longitud: {useFirmaResponsable.longitud}
                        </ThemedText>
                        <ThemedText style={styles.signatureInfoText}>
                          Fecha y hora: {convertDateTimestampToLocalString(new Date(Number(useFirmaResponsable.timestamp)).toISOString())}
                        </ThemedText>
                      </ThemedView>
                    )}
                    {!useFirmaResponsable && (
                      <TouchableOpacity
                        style={[styles.signatureButtonPrimary, { marginTop: 8 }]}
                        onPress={handleScanQRUse}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="qr-code-outline" size={18} color="#FFFFFF" />
                        <ThemedText style={styles.signatureButtonText}>Escanear QR</ThemedText>
                      </TouchableOpacity>
                    )}
                  </ThemedView>

                  <ThemedView style={styles.formActions}>
                    <TouchableOpacity
                      style={[styles.formActionBtn, styles.cancelBtn]}
                      onPress={() => {
                        setIsUseFormOpen(false);
                        setUseEditing(null);
                        resetUseForm();
                      }}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="close" size={18} color="#000000" />
                      <ThemedText style={styles.cancelBtnText}>Cancelar</ThemedText>
                    </TouchableOpacity>
                    {submitResponseUse && (
                      <ThemedView style={[styles.responseContainer, submitResponseUse.type === 'success' ? styles.responseSuccess : styles.responseError]}>
                        <ThemedText style={styles.responseText}>
                          {submitResponseUse.type === 'success' ? '✓ ' : '✗ '}
                          {submitResponseUse.message}
                        </ThemedText>
                      </ThemedView>
                    )}
                    <TouchableOpacity 
                      style={[styles.formActionBtn, styles.saveBtn, isSubmittingUse && styles.buttonDisabled]} 
                      onPress={handleSaveUseRecord} 
                      activeOpacity={0.85}
                      disabled={isSubmittingUse}
                    >
                      {isSubmittingUse ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="save-outline" size={18} color="#FFFFFF" />
                          <ThemedText style={styles.saveBtnText}>Aceptar</ThemedText>
                        </>
                      )}
                    </TouchableOpacity>
                  </ThemedView>
                </ThemedView>
              ) : null}

              {useRecords.length === 0 ? (
                <ThemedText style={styles.emptyText}>No hay usos registrados</ThemedText>
              ) : (
                <ThemedView style={styles.modalList}>
                  {useRecords.map((u) => {
                    const k = String(u.id || u.id_local);
                    const offline = !u.synced || k.startsWith('local-');
                    return (
                      <ThemedView key={k} style={styles.modalListItem}>
                        <ThemedText style={styles.modalListTitle}>
                          {u.nombre_conductor || '—'}
                          {offline ? ' (offline)' : ''}
                        </ThemedText>
                        <ThemedText style={styles.detailText}>
                          <ThemedText style={styles.cardLabel}>Código conductor: </ThemedText>
                          <ThemedText style={styles.cardValue}>{(u as any).codigo_conductor || '—'}</ThemedText>
                        </ThemedText>
                        <ThemedText style={styles.detailText}>
                          <ThemedText style={styles.cardLabel}>Inicio: </ThemedText>
                          <ThemedText style={styles.cardValue}>
                            {`${convertDateTimestampToLocalString(new Date(isoToDate((u as any).fecha_inicio || (u as any).inicio || (u as any).hora_inicio)).toISOString(), false)} ${isoToTime((u as any).hora_inicio || (u as any).inicio)}`.trim() || '—'}
                          </ThemedText>
                        </ThemedText>
                        <ThemedText style={styles.detailText}>
                          <ThemedText style={styles.cardLabel}>Fin: </ThemedText>
                          <ThemedText style={styles.cardValue}>
                            {`${convertDateTimestampToLocalString(new Date(isoToDate((u as any).fecha_fin || (u as any).fin || (u as any).hora_fin)).toISOString(), false)} ${isoToTime((u as any).hora_fin || (u as any).fin)}`.trim() || '—'}
                          </ThemedText>
                        </ThemedText>

                        <ThemedView style={styles.modalItemActions}>
                          <TouchableOpacity style={[styles.actionBtn, styles.editBtn]} onPress={() => startEditingUse(u)} activeOpacity={0.85}>
                            <Ionicons name="create-outline" size={18} color="#FFFFFF" />
                            <ThemedText style={styles.actionBtnText}>Editar</ThemedText>
                          </TouchableOpacity>
                          {!(u.id_local || String(u.id).startsWith('local-') || u.id === 0) && (
                            <TouchableOpacity
                              style={[styles.actionBtn, styles.changesButton]}
                              onPress={() => {
                                setCambiosTitle(`Cambios - Uso #${u.id}`);
                                fetchCambios('c_usos_vehiculos_corporativos', Number(u.id));
                              }}
                              activeOpacity={0.85}
                            >
                              <Ionicons name="list-outline" size={18} color="#FFFFFF" />
                              <ThemedText style={styles.actionBtnText}>Cambios</ThemedText>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity
                            style={[styles.actionBtn, styles.deleteBtn, deletingUseKey === k && styles.buttonDisabled]}
                            onPress={() => confirmDeleteUse(u)}
                            activeOpacity={0.85}
                            disabled={deletingUseKey === k}
                          >
                            {deletingUseKey === k ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <>
                            <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
                            <ThemedText style={styles.actionBtnText}>Eliminar</ThemedText>
                              </>
                            )}
                          </TouchableOpacity>
                        </ThemedView>

                        <ThemedView style={styles.modalItemActions}>
                          {((u as any)?.bitacora_id == null && !(u as any)?.bitacora) && (
                            <TouchableOpacity style={[styles.actionBtn, styles.assignBtn]} onPress={() => handleAssignEstado(u)} activeOpacity={0.85}>
                              <Ionicons name="clipboard-outline" size={18} color="#FFFFFF" />
                              <ThemedText style={styles.actionBtnText}>Asignar estado</ThemedText>
                            </TouchableOpacity>
                          )}
                        </ThemedView>

                        {/* Bitácora colapsable */}
                        {((u as any)?.bitacora_id != null || (u as any)?.bitacora) && (() => {
                          const bitacora = (u as any)?.bitacora;
                          if (!bitacora) return null;

                          const bitacoraKey = `bit_${k}`;
                          const isBitacoraExpanded = expandedBitacoras.has(bitacoraKey);
                          const tipo = String(bitacora.tipo || 'Vehículo') as TipoBitacora;
                          const generalConfig = buildGeneralConfig(tipo);
                          const revisionConfig = buildRevisionConfig(tipo);

                          const infoGeneral = safeParse<any[]>(bitacora.informacion_general, []);
                          const infoRevision = safeParse<any[]>(bitacora.informacion_revision, []);
                          const movimientos = safeParse<any[]>(bitacora.movimientos_vehiculos, []);
                          const observaciones = String(bitacora.observaciones || '');

                          // Mapear información general
                          const generalMap: Record<string, any> = {};
                          for (const f of infoGeneral) {
                            if (f && f.key) generalMap[String(f.key)] = f.value;
                          }

                          // Mapear información de revisión
                          const revisionMap: Record<string, any> = {};
                          const revisionObsMap: Record<string, string> = {};
                          for (const f of infoRevision) {
                            if (f && f.key) {
                              revisionMap[String(f.key)] = f.value;
                              if (f.observation !== undefined) {
                                revisionObsMap[`${f.key}__obs`] = String(f.observation || '');
                              }
                            }
                          }

                          return (
                            <ThemedView style={{ marginTop: 12 }}>
                              <TouchableOpacity
                                style={styles.collapseButton}
                                onPress={() => {
                                  const newSet = new Set(expandedBitacoras);
                                  if (isBitacoraExpanded) {
                                    newSet.delete(bitacoraKey);
                                  } else {
                                    newSet.add(bitacoraKey);
                                  }
                                  setExpandedBitacoras(newSet);
                                }}
                                activeOpacity={0.85}
                              >
                                <ThemedText style={styles.collapseButtonText}>
                                  {isBitacoraExpanded ? 'Ocultar bitácora' : 'Ver bitácora'}
                                </ThemedText>
                                <Ionicons name={isBitacoraExpanded ? 'chevron-up' : 'chevron-down'} size={20} color="#007AFF" />
                              </TouchableOpacity>

                              {isBitacoraExpanded && (
                                <ThemedView style={styles.collapsableContent}>
                                  {/* Información General */}
                                  <ThemedText style={styles.bitacoraSectionTitle}>Información General</ThemedText>
                                  {generalConfig.map((g) => {
                                    const value = generalMap[g.key];
                                    if (g.kind === 'readonly' || !value) return null;

                                    if (g.kind === 'signature') {
                                      const sig = String(value || '');
                                      const isBase64 = sig.startsWith('data:') || (!sig.includes(':') && sig.length > 50);
                                      return (
                                        <ThemedView key={g.key} style={styles.bitacoraField}>
                                          <ThemedText style={styles.bitacoraLabel}>{g.label}:</ThemedText>
                                          {isBase64 ? (
                                            <Image source={{ uri: sig.startsWith('data:') ? sig : `data:image/png;base64,${sig}` }} style={styles.signaturePreview} />
                                          ) : (
                                            <ThemedText style={styles.bitacoraValue}>Firma registrada</ThemedText>
                                          )}
                                        </ThemedView>
                                      );
                                    }

                                    return (
                                      <ThemedView key={g.key} style={styles.bitacoraField}>
                                        <ThemedText style={styles.bitacoraLabel}>{g.label}:</ThemedText>
                                        <ThemedText style={styles.bitacoraValue}>{String(value || '—')}</ThemedText>
                                      </ThemedView>
                                    );
                                  })}

                                  {/* Información de Revisión */}
                                  <ThemedText style={styles.bitacoraSectionTitle}>Información de Revisión</ThemedText>
                                  {revisionConfig.map((r) => {
                                    if (r.kind === 'heading') {
                                      return (
                                        <ThemedText key={r.key} style={styles.bitacoraHeading}>
                                          {r.label}
                                        </ThemedText>
                                      );
                                    }

                                    const value = revisionMap[r.key];
                                    const obs = revisionObsMap[`${r.key}__obs`];

                                    return (
                                      <ThemedView key={r.key} style={styles.bitacoraField}>
                                        <ThemedText style={styles.bitacoraLabel}>{r.label}:</ThemedText>
                                        <ThemedText style={styles.bitacoraValue}>{String(value || '—')}</ThemedText>
                                        {r.withObservation && obs && (
                                          <ThemedText style={styles.bitacoraObservation}>Obs: {obs}</ThemedText>
                                        )}
                                      </ThemedView>
                                    );
                                  })}

                                  {/* Movimientos */}
                                  {movimientos.length > 0 && (
                                    <>
                                      <ThemedText style={styles.bitacoraSectionTitle}>Movimientos de Vehículos</ThemedText>
                                      {movimientos.map((mov: any, idx: number) => (
                                        <ThemedView key={idx} style={styles.movimientoCard}>
                                          <ThemedText style={styles.movimientoTitle}>Movimiento #{idx + 1}</ThemedText>
                                          <ThemedView style={styles.bitacoraField}>
                                            <ThemedText style={styles.bitacoraLabel}>Movimiento:</ThemedText>
                                            <ThemedText style={styles.bitacoraValue}>{String(mov.movimiento || '—')}</ThemedText>
                                          </ThemedView>
                                          <ThemedView style={styles.bitacoraField}>
                                            <ThemedText style={styles.bitacoraLabel}>Fecha:</ThemedText>
                                            <ThemedText style={styles.bitacoraValue}>{String(mov.fecha || '—')}</ThemedText>
                                          </ThemedView>
                                          <ThemedView style={styles.bitacoraField}>
                                            <ThemedText style={styles.bitacoraLabel}>Hora:</ThemedText>
                                            <ThemedText style={styles.bitacoraValue}>{String(mov.hora || '—')}</ThemedText>
                                          </ThemedView>
                                          <ThemedView style={styles.bitacoraField}>
                                            <ThemedText style={styles.bitacoraLabel}>Realizado por:</ThemedText>
                                            <ThemedText style={styles.bitacoraValue}>{String(mov.realizado_por || '—')}</ThemedText>
                                          </ThemedView>
                                          <ThemedView style={styles.bitacoraField}>
                                            <ThemedText style={styles.bitacoraLabel}>Autorizado por:</ThemedText>
                                            <ThemedText style={styles.bitacoraValue}>{String(mov.autorizado_por || '—')}</ThemedText>
                                          </ThemedView>
                                        </ThemedView>
                                      ))}
                                    </>
                                  )}

                                  {/* Observaciones */}
                                  {observaciones && (
                                    <>
                                      <ThemedText style={styles.bitacoraSectionTitle}>Observaciones</ThemedText>
                                      <ThemedText style={styles.bitacoraObservaciones}>{observaciones}</ThemedText>
                                    </>
                                  )}
                                </ThemedView>
                              )}
                            </ThemedView>
                          );
                        })()}
                      </ThemedView>
                    );
                  })}
                </ThemedView>
              )}
            </ScrollView>

            <ThemedView style={styles.modalFooter}>
              <TouchableOpacity style={[styles.formActionBtn, styles.cancelBtn]} onPress={closeUsesModal} activeOpacity={0.85}>
                <Ionicons name="arrow-back" size={18} color="#000000" />
                <ThemedText style={styles.cancelBtnText}>Cerrar</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          </ThemedView>
        </ThemedView>
      </Modal>

      {/* Modal de Mantenimiento */}
      <Modal
        transparent
        visible={maintenanceModalVisible}
        animationType="fade"
        onRequestClose={closeMaintenanceModal}
      >
        <ThemedView style={styles.modalBackdrop}>
          <ThemedView style={styles.modalCard}>
            <ThemedView style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>
                Mantenimiento{maintenanceVehicle?.placa ? ` - ${maintenanceVehicle.placa}` : ''}
              </ThemedText>
              <TouchableOpacity onPress={closeMaintenanceModal} style={styles.modalCloseBtn} activeOpacity={0.85}>
                <Ionicons name="close" size={22} color="#000" />
              </TouchableOpacity>
            </ThemedView>

            <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent} keyboardShouldPersistTaps="handled">
              <TouchableOpacity style={styles.modalPrimaryBtn} onPress={startCreateMaintenance} activeOpacity={0.85}>
                <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
                <ThemedText style={styles.modalPrimaryBtnText}>Nuevo mantenimiento</ThemedText>
              </TouchableOpacity>

              {isMaintenanceFormOpen ? (
                <ThemedView style={styles.modalFormCard}>
                  <ThemedText style={styles.modalSectionTitle}>{maintenanceEditing ? 'Editar mantenimiento' : 'Nuevo mantenimiento'}</ThemedText>

                  <ThemedText style={styles.label}>Fecha</ThemedText>
                  <TouchableOpacity style={styles.dateButton} onPress={() => openMaintenanceDatePicker(maintenanceFecha)} activeOpacity={0.85}>
                    <ThemedText style={styles.dateButtonText}>{maintenanceFecha ? convertDateTimestampToLocalString(new Date(maintenanceFecha).toISOString(), false) : 'Seleccionar fecha'}</ThemedText>
                    <Ionicons name="calendar-outline" size={18} color="#007AFF" />
                  </TouchableOpacity>

                  {showMaintenanceDatePicker ? (
                    <DateTimePicker
                      value={maintenanceDatePickerValue}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'inline' : 'default'}
                      onChange={onMaintenanceDatePicked}
                    />
                  ) : null}

                  <ThemedText style={styles.label}>Tipo</ThemedText>
                  <ThemedView style={styles.pickerWrapper}>
                    <Picker selectedValue={maintenanceTipo} onValueChange={(v) => setMaintenanceTipo(String(v || ''))} style={styles.picker}>
                      <Picker.Item label="Seleccione..." value="" color="#000000" />
                      <Picker.Item label="Preventivo" value="Preventivo" color="#000000" />
                      <Picker.Item label="Correctivo" value="Correctivo" color="#000000" />
                      <Picker.Item label="Emergencia" value="Emergencia" color="#000000" />
                    </Picker>
                  </ThemedView>

                  <ThemedText style={styles.label}>Mantenimiento</ThemedText>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={maintenanceMantenimiento}
                    onChangeText={setMaintenanceMantenimiento}
                    placeholder="Descripción del mantenimiento"
                    placeholderTextColor="#999"
                    multiline
                  />

                  <ThemedText style={styles.label}>Diagnóstico</ThemedText>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={maintenanceDiagnostico}
                    onChangeText={setMaintenanceDiagnostico}
                    placeholder="Diagnóstico"
                    placeholderTextColor="#999"
                    multiline
                  />

                  <ThemedText style={styles.label}>Kilometraje siguiente revisión</ThemedText>
                  <TextInput
                    style={styles.input}
                    value={maintenanceKmSiguiente}
                    onChangeText={setMaintenanceKmSiguiente}
                    placeholder="0"
                    keyboardType="numeric"
                    placeholderTextColor="#999"
                  />

                  <ThemedText style={styles.label}>Nombre del mecánico</ThemedText>
                  <TextInput
                    style={styles.input}
                    value={maintenanceNombreMecanico}
                    onChangeText={setMaintenanceNombreMecanico}
                    placeholder="Nombre del mecánico"
                    placeholderTextColor="#999"
                  />

                  <ThemedText style={styles.sectionTitle}>Fotos nuevas (opcional)</ThemedText>
                  <ThemedText style={styles.formHierarchyHint}>
                    {maintenanceEditing
                      ? 'Solo se suben fotos que tome aquí. En el listado puede ver o eliminar las imágenes ya guardadas.'
                      : 'Puede adjuntar fotos antes y después del servicio.'}
                  </ThemedText>

                  <ThemedText style={styles.label}>Foto antes</ThemedText>
                  {maintenanceImagenAntes ? (
                    <ThemedView style={styles.imageWideWrap}>
                      <ThemedText style={styles.imagePreviewTitle}>Nueva foto</ThemedText>
                      <Image source={{ uri: maintenanceImagenAntes }} style={styles.imageWide} resizeMode="contain" />
                      <TouchableOpacity
                        style={styles.removeImageBtn}
                        onPress={async () => {
                          if (maintenanceImagenAntesRef) {
                            try {
                              await deleteFile(maintenanceImagenAntesRef);
                            } catch {
                              // ignore
                            }
                          }
                          setMaintenanceImagenAntesRef('');
                          setMaintenanceImagenAntes('');
                        }}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                      </TouchableOpacity>
                    </ThemedView>
                  ) : (
                    <TouchableOpacity style={styles.attachButton} onPress={() => openCamera('antes')} activeOpacity={0.85}>
                      <Ionicons name="camera-outline" size={20} color="#007AFF" />
                      <ThemedText style={styles.attachButtonText}>Tomar foto antes</ThemedText>
                    </TouchableOpacity>
                  )}

                  <ThemedText style={styles.label}>Foto después</ThemedText>
                  {maintenanceImagenDespues ? (
                    <ThemedView style={styles.imageWideWrap}>
                      <ThemedText style={styles.imagePreviewTitle}>Nueva foto</ThemedText>
                      <Image source={{ uri: maintenanceImagenDespues }} style={styles.imageWide} resizeMode="contain" />
                      <TouchableOpacity
                        style={styles.removeImageBtn}
                        onPress={async () => {
                          if (maintenanceImagenDespuesRef) {
                            try {
                              await deleteFile(maintenanceImagenDespuesRef);
                            } catch {
                              // ignore
                            }
                          }
                          setMaintenanceImagenDespuesRef('');
                          setMaintenanceImagenDespues('');
                        }}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                      </TouchableOpacity>
                    </ThemedView>
                  ) : (
                    <TouchableOpacity style={styles.attachButton} onPress={() => openCamera('despues')} activeOpacity={0.85}>
                      <Ionicons name="camera-outline" size={20} color="#007AFF" />
                      <ThemedText style={styles.attachButtonText}>Tomar foto después</ThemedText>
                    </TouchableOpacity>
                  )}

                  <ThemedText style={styles.sectionTitle}>Firma del mecánico</ThemedText>
                  {!maintenanceFirmaMecanico ? (
                    <TouchableOpacity
                      style={styles.signatureButtonPrimary}
                      onPress={() => openSignatureModal('maintenance_mecanico')}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="create-outline" size={18} color="#FFFFFF" />
                      <ThemedText style={styles.signatureButtonText}>Dibujar firma</ThemedText>
                    </TouchableOpacity>
                  ) : (
                    <ThemedView style={styles.signatureInfo}>
                      <ThemedText style={styles.signatureInfoTitle}>Firma del mecánico registrada</ThemedText>
                      <ThemedView style={styles.imageWideWrap}>
                        <Image source={{ uri: formatSignatureForDisplay(maintenanceFirmaMecanico) }} style={styles.signaturePreview} resizeMode="contain" />
                        <TouchableOpacity
                          style={styles.removeImageBtn}
                          onPress={() => setMaintenanceFirmaMecanico('')}
                          activeOpacity={0.85}
                        >
                          <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                        </TouchableOpacity>
                      </ThemedView>
                    </ThemedView>
                  )}

                  <ThemedText style={styles.sectionTitle}>Firma responsable</ThemedText>
                  {!maintenanceFirmaResponsable ? (
                    <TouchableOpacity
                      style={styles.signatureButtonPrimary}
                      onPress={generateMaintenanceFirmaResponsable}
                      disabled={isGeneratingFirma}
                      activeOpacity={0.85}
                    >
                      {isGeneratingFirma ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="sparkles-outline" size={18} color="#FFFFFF" />
                          <ThemedText style={styles.signatureButtonText}>Generar firma</ThemedText>
                        </>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <ThemedView style={styles.signatureInfo}>
                      <ThemedText style={styles.signatureInfoTitle}>
                        Información de la firma del responsable
                      </ThemedText>
                      <ThemedText style={styles.signatureInfoText}>
                        ID de sesión: {maintenanceFirmaResponsable.sessionId}
                      </ThemedText>
                      <ThemedText style={styles.signatureInfoText}>
                        ID del empleado: {maintenanceFirmaResponsable.empleadoId}
                      </ThemedText>
                      <ThemedText style={styles.signatureInfoText}>
                        Latitud: {maintenanceFirmaResponsable.latitud}
                      </ThemedText>
                      <ThemedText style={styles.signatureInfoText}>
                        Longitud: {maintenanceFirmaResponsable.longitud}
                      </ThemedText>
                      <ThemedText style={styles.signatureInfoText}>
                        Fecha y hora: {convertDateTimestampToLocalString(new Date(Number(maintenanceFirmaResponsable.timestamp)).toISOString())}
                      </ThemedText>
                    </ThemedView>
                  )}
                  {!maintenanceFirmaResponsable && (
                    <TouchableOpacity
                      style={[styles.signatureButtonPrimary, { marginTop: 8 }]}
                      onPress={handleScanQRMaintenance}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="qr-code-outline" size={18} color="#FFFFFF" />
                      <ThemedText style={styles.signatureButtonText}>Escanear QR</ThemedText>
                    </TouchableOpacity>
                  )}

                  <ThemedView style={styles.formActions}>
                    <TouchableOpacity
                      style={[styles.formActionBtn, styles.cancelBtn]}
                      onPress={() => {
                        setIsMaintenanceFormOpen(false);
                        setMaintenanceEditing(null);
                        resetMaintenanceForm();
                      }}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="close" size={18} color="#000000" />
                      <ThemedText style={styles.cancelBtnText}>Cancelar</ThemedText>
                    </TouchableOpacity>
                    {submitResponseMaintenance && (
                      <ThemedView style={[styles.responseContainer, submitResponseMaintenance.type === 'success' ? styles.responseSuccess : styles.responseError]}>
                        <ThemedText style={styles.responseText}>
                          {submitResponseMaintenance.type === 'success' ? '✓ ' : '✗ '}
                          {submitResponseMaintenance.message}
                        </ThemedText>
                      </ThemedView>
                    )}
                    <TouchableOpacity 
                      style={[styles.formActionBtn, styles.saveBtn, isSubmittingMaintenance && styles.buttonDisabled]} 
                      onPress={handleSaveMaintenanceRecord} 
                      activeOpacity={0.85}
                      disabled={isSubmittingMaintenance}
                    >
                      {isSubmittingMaintenance ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="save-outline" size={18} color="#FFFFFF" />
                          <ThemedText style={styles.saveBtnText}>Aceptar</ThemedText>
                        </>
                      )}
                    </TouchableOpacity>
                  </ThemedView>
                </ThemedView>
              ) : null}

              {!isMaintenanceFormOpen && maintenanceRecords.length === 0 ? (
                <ThemedText style={styles.emptyText}>No hay mantenimientos registrados</ThemedText>
              ) : null}
              {!isMaintenanceFormOpen && maintenanceRecords.length > 0 ? (
                <ThemedView style={styles.modalList}>
                  {maintenanceRecords.map((m) => {
                    const k = String(m.id || m.id_local);
                    const offline = !m.synced || k.startsWith('local-');
                    const vehiculoIdForMaint =
                      typeof maintenanceVehicle?.id === 'number' && maintenanceVehicle.id > 0
                        ? maintenanceVehicle.id
                        : undefined;
                    const uriAntes = m.imagen_antes_local_file
                      ? getLocalFileDisplayUri(String(m.imagen_antes_local_file))
                      : m.imagen_antes
                        ? m.imagen_antes.startsWith('data:')
                          ? m.imagen_antes
                          : buildMaintenanceImageUrl(vehiculoIdForMaint, m.imagen_antes)
                        : '';
                    const uriDespues = m.imagen_despues_local_file
                      ? getLocalFileDisplayUri(String(m.imagen_despues_local_file))
                      : m.imagen_despues
                        ? m.imagen_despues.startsWith('data:')
                          ? m.imagen_despues
                          : buildMaintenanceImageUrl(vehiculoIdForMaint, m.imagen_despues)
                        : '';
                    return (
                      <ThemedView key={k} style={styles.modalListItem}>
                        <ThemedText style={styles.modalListTitle}>
                          {m.tipo || '—'} {offline ? ' (offline)' : ''}
                        </ThemedText>
                        <ThemedText style={styles.detailText}>
                          <ThemedText style={styles.cardLabel}>Fecha: </ThemedText>
                          <ThemedText style={styles.cardValue}>{convertDateTimestampToLocalString(new Date(isoToDate(m.fecha)).toISOString(), false) || '—'}</ThemedText>
                        </ThemedText>
                        <ThemedText style={styles.detailText}>
                          <ThemedText style={styles.cardLabel}>Mecánico: </ThemedText>
                          <ThemedText style={styles.cardValue}>{m.nombre_mecanico || '—'}</ThemedText>
                        </ThemedText>

                        {(uriAntes || uriDespues) && (
                          <ThemedView style={styles.maintenanceListImagesRow}>
                            {uriAntes ? (
                              <ThemedView style={styles.maintenanceListImageBlock}>
                                <ThemedText style={styles.maintenanceListImageLabel}>Antes</ThemedText>
                                <ThemedView style={styles.maintenanceListImageWrap}>
                                  <Image source={{ uri: uriAntes }} style={styles.maintenanceListThumb} resizeMode="cover" />
                                  <TouchableOpacity
                                    style={styles.removeImageBtn}
                                    onPress={() => confirmRemoveMaintenanceListImage(m, 'antes')}
                                    activeOpacity={0.85}
                                    disabled={deletingMaintImageKey === `${k}-antes`}
                                  >
                                    {deletingMaintImageKey === `${k}-antes` ? (
                                      <ActivityIndicator size="small" color="#FF3B30" />
                                    ) : (
                                      <Ionicons name="trash-outline" size={16} color="#FF3B30" />
                                    )}
                                  </TouchableOpacity>
                                </ThemedView>
                              </ThemedView>
                            ) : null}
                            {uriDespues ? (
                              <ThemedView style={styles.maintenanceListImageBlock}>
                                <ThemedText style={styles.maintenanceListImageLabel}>Después</ThemedText>
                                <ThemedView style={styles.maintenanceListImageWrap}>
                                  <Image source={{ uri: uriDespues }} style={styles.maintenanceListThumb} resizeMode="cover" />
                                  <TouchableOpacity
                                    style={styles.removeImageBtn}
                                    onPress={() => confirmRemoveMaintenanceListImage(m, 'despues')}
                                    activeOpacity={0.85}
                                    disabled={deletingMaintImageKey === `${k}-despues`}
                                  >
                                    {deletingMaintImageKey === `${k}-despues` ? (
                                      <ActivityIndicator size="small" color="#FF3B30" />
                                    ) : (
                                      <Ionicons name="trash-outline" size={16} color="#FF3B30" />
                                    )}
                                  </TouchableOpacity>
                                </ThemedView>
                              </ThemedView>
                            ) : null}
                          </ThemedView>
                        )}

                        <ThemedView style={styles.modalItemActions}>
                          <TouchableOpacity style={[styles.actionBtn, styles.editBtn]} onPress={() => startEditingMaintenance(m)} activeOpacity={0.85}>
                            <Ionicons name="create-outline" size={18} color="#FFFFFF" />
                            <ThemedText style={styles.actionBtnText}>Editar</ThemedText>
                          </TouchableOpacity>
                          {!(m.id_local || String(m.id).startsWith('local-') || m.id === 0) && (
                            <TouchableOpacity
                              style={[styles.actionBtn, styles.changesButton]}
                              onPress={() => {
                                setCambiosTitle(`Cambios - Mantenimiento #${m.id}`);
                                fetchCambios('c_mantenimiento_vehiculos_corporativos', Number(m.id));
                              }}
                              activeOpacity={0.85}
                            >
                              <Ionicons name="list-outline" size={18} color="#FFFFFF" />
                              <ThemedText style={styles.actionBtnText}>Cambios</ThemedText>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity
                            style={[styles.actionBtn, styles.deleteBtn, deletingMaintenanceKey === k && styles.buttonDisabled]}
                            onPress={() => confirmDeleteMaintenance(m)}
                            activeOpacity={0.85}
                            disabled={deletingMaintenanceKey === k}
                          >
                            {deletingMaintenanceKey === k ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <>
                            <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
                            <ThemedText style={styles.actionBtnText}>Eliminar</ThemedText>
                              </>
                            )}
                          </TouchableOpacity>
                        </ThemedView>
                      </ThemedView>
                    );
                  })}
                </ThemedView>
              ) : null}
            </ScrollView>

            <ThemedView style={styles.modalFooter}>
              <TouchableOpacity style={[styles.formActionBtn, styles.cancelBtn]} onPress={closeMaintenanceModal} activeOpacity={0.85}>
                <Ionicons name="arrow-back" size={18} color="#000000" />
                <ThemedText style={styles.cancelBtnText}>Cerrar</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          </ThemedView>
        </ThemedView>
      </Modal>

      {/* Modal de Cámara */}
      <Modal
        visible={isCameraVisible}
        animationType="slide"
        onRequestClose={() => setIsCameraVisible(false)}
      >
        <ThemedView style={{ flex: 1, backgroundColor: '#000' }}>
          {cameraPermission?.granted ? (
            <CameraView
              ref={cameraRef}
              style={{ flex: 1 }}
              facing="back"
            >
              <TouchableOpacity
                style={styles.cameraCloseButton}
                onPress={() => setIsCameraVisible(false)}
              >
                <Ionicons name="close" size={30} color="#000000" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cameraCaptureButton}
                onPress={takePicture}
              >
                <ThemedView style={styles.cameraCaptureButtonInner} />
              </TouchableOpacity>
            </CameraView>
          ) : (
            <ThemedView style={styles.cameraPermissionContainer}>
              <ThemedText style={styles.cameraPermissionText}>Se requiere permiso de cámara</ThemedText>
              <TouchableOpacity style={styles.cameraPermissionBtn} onPress={requestCameraPermission} activeOpacity={0.85}>
                <ThemedText style={styles.cameraPermissionBtnText}>Solicitar permiso</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          )}
        </ThemedView>
      </Modal>

      {/* Modal de Signature */}
      <Modal visible={signatureModalVisible} animationType="fade" transparent={true} onRequestClose={closeSignatureModal}>
        <ThemedView style={styles.modalOverlay}>
          <ThemedView style={styles.modalContainer}>
            <ThemedView style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Firma del mecánico</ThemedText>
              <TouchableOpacity onPress={closeSignatureModal}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </ThemedView>

            <View style={styles.modalSignatureContainer}>
              <SignatureScreen
                ref={signatureRef}
                onOK={handleSignatureRead}
                descriptionText="Dibuja la firma en el área blanca"
                clearText=""
                confirmText=""
                webStyle={signatureWebStyle}
                key={signatureKey}
              />
            </View>

            <ThemedView style={styles.modalActions}>
              <TouchableOpacity style={styles.modalClearButton} onPress={clearSignatureInModal}>
                <Ionicons name="trash" size={20} color="#000000" />
                <ThemedText style={styles.modalClearButtonText}>Limpiar</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalAcceptButton} onPress={acceptSignature}>
                <Ionicons name="checkmark" size={20} color="#000000" />
                <ThemedText style={styles.modalAcceptButtonText}>Aceptar</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          </ThemedView>
        </ThemedView>
      </Modal>

      {/* Modal: ver cambios */}
      <Modal
        visible={isCambiosModalVisible}
        animationType="fade"
        transparent
        presentationStyle="overFullScreen"
        onRequestClose={closeCambiosModal}
      >
        <View style={styles.overlay}>
          <ThemedView style={styles.floatModalCardMovimientos}>
            <ThemedView style={styles.floatModalHeader}>
              <ThemedText style={styles.modalTitle}>{cambiosTitle}</ThemedText>
              <TouchableOpacity onPress={closeCambiosModal}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </ThemedView>

            <ScrollView style={{ maxHeight: Dimensions.get('window').height * 0.75 }} contentContainerStyle={{ padding: 16 }}>
              {(!cambiosItems || cambiosItems.length === 0) ? (
                <ThemedView style={styles.emptyContainer}>
                  <ThemedText style={styles.emptyText}>No hay cambios registrados</ThemedText>
                </ThemedView>
              ) : (
                cambiosItems.map((row: any) => {
                  let parsed: any[] = [];
                  try {
                    parsed = row?.cambios ? JSON.parse(row.cambios) : [];
                  } catch {
                    parsed = [];
                  }
                  const createdAtLabel = convertDateTimestampToLocalString(new Date(row?.created_at).toISOString());
                  const isOpen = expandedCambioId === row.id;

                  return (
                    <ThemedView key={`chg-${row.id}`} style={styles.cambioCollapsableMain}>
                      <TouchableOpacity
                        style={styles.cambioCollapsableHeader}
                        onPress={() => setExpandedCambioId((prev) => (prev === row.id ? null : row.id))}
                        activeOpacity={0.8}
                      >
                        <ThemedText style={styles.cambioCollapsableTitle}>
                          {createdAtLabel}
                        </ThemedText>
                        <Ionicons
                          name={isOpen ? "chevron-up" : "chevron-down"}
                          size={18}
                          color="#007AFF"
                        />
                      </TouchableOpacity>

                      {isOpen && (
                        <ThemedView style={styles.cambioCollapsableContent}>
                          <ThemedView style={styles.filterGroupSearch}>
                            <ThemedText style={styles.filterLabel}>Cambio realizado por:</ThemedText>
                            <ThemedText style={styles.changeDescription}>
                              {row.empleado_nombre || 'Desconocido'}
                              {row.empleado_cedula ? ` - Cédula: ${row.empleado_cedula}` : ''}
                            </ThemedText>
                          </ThemedView>

                          {(Array.isArray(parsed) ? parsed : []).length > 0 && (
                            <ThemedView style={styles.filterGroupSearch}>
                              <ThemedText style={styles.filterLabel}>Cambios:</ThemedText>
                              {(Array.isArray(parsed) ? parsed : []).map((c: any, idx: number) => (
                                <ThemedText key={`c-${row.id}-${idx}`} style={styles.changeDescription}>
                                  <ThemedText style={{ fontWeight: '800' }}>{String(c?.prop ?? '-')}: </ThemedText>
                                  {formatChangeValue(c?.prop, c?.after)}
                                </ThemedText>
                              ))}
                            </ThemedView>
                          )}
                        </ThemedView>
                      )}
                    </ThemedView>
                  );
                })
              )}
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
  scrollContent: { padding: 16 },
  content: { width: '100%', maxWidth: 800, alignSelf: 'center' },

  titleContainer: { alignItems: 'center', marginBottom: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  title: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, opacity: 0.7, textAlign: 'center' },

  loadingText: { marginTop: 10, fontSize: 14, color: '#000', opacity: 0.7, textAlign: 'center' },
  errorText: { color: '#FF3B30', textAlign: 'center', marginBottom: 12 },
  emptyContainer: { padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 14, opacity: 0.6, textAlign: 'center', color: '#000' },

  createButton: { backgroundColor: '#007AFF', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginBottom: 16 },
  createButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  formCard: { marginTop: 12, backgroundColor: '#fff', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#E0E0E0' },
  formTitle: { fontSize: 18, fontWeight: '800', marginBottom: 10, color: '#000' },
  label: { fontSize: 13, fontWeight: '700', marginTop: 10, color: '#333' },
  input: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, backgroundColor: '#fff', color: '#000', marginBottom: 6 },
  textArea: { minHeight: 90, textAlignVertical: 'top' as any },
  pickerWrapper: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, overflow: 'hidden', backgroundColor: '#FFFFFF', justifyContent: 'center' },
  picker: { height: 54, width: '100%', color: '#000' },
  dateButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 12, backgroundColor: '#fff', marginBottom: 6 },
  dateButtonText: { color: '#000', fontWeight: '700' },

  sectionTitle: { marginTop: 14, fontSize: 15, fontWeight: '800', color: '#007AFF' },
  formHierarchyHint: { fontSize: 13, color: '#666', marginBottom: 8, marginTop: 2 },
  imagePreviewTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: '#333' },

  maintenanceListImagesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10, marginBottom: 4 },
  maintenanceListImageBlock: { flex: 1, minWidth: 120, maxWidth: '48%' as any },
  maintenanceListImageLabel: { fontSize: 12, fontWeight: '700', color: '#333', marginBottom: 6 },
  maintenanceListImageWrap: { position: 'relative' as const, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#E0E0E0' },
  maintenanceListThumb: { width: '100%', height: 100, backgroundColor: '#F5F5F5' },

  switchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  switchBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 10, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, backgroundColor: '#FFFFFF' },
  switchBtnOn: { backgroundColor: '#F2FFF6', borderColor: '#B7F5CA' },
  switchText: { color: '#000000', fontWeight: '700' },

  signatureLine: { fontSize: 13, color: '#000000', opacity: 0.8, marginBottom: 4 },
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
  },
  signatureInfoText: {
    fontSize: 12,
    marginBottom: 2,
  },

  attachButton: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#007AFF', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 12, backgroundColor: '#FFFFFF', marginBottom: 10, marginTop: 10 },
  attachButtonText: { color: '#007AFF', fontWeight: '700' },

  imagesList: { marginTop: 8, gap: 12, marginBottom: 10 },
  imageWideWrap: { width: '100%', borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#E0E0E0', backgroundColor: '#FFFFFF', position: 'relative' },
  imageWide: { width: '100%', height: 220, backgroundColor: '#FFFFFF' },
  removeImageBtn: { position: 'absolute', top: 8, right: 8, padding: 6, borderRadius: 16, backgroundColor: '#FFFFFFCC' },

  formActions: { marginTop: 16, flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  formActionBtn: { flex: 1, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12 },
  cancelBtn: { backgroundColor: '#EDEDED' },
  cancelBtnText: { color: '#000', fontWeight: '800' },
  saveBtn: { backgroundColor: '#007AFF' },
  saveBtnText: { color: '#fff', fontWeight: '800' },
  buttonDisabled: {
    opacity: 0.6,
  },
  responseContainer: {
    padding: 12,
    borderRadius: 6,
    marginBottom: 12,
  },
  responseSuccess: {
    backgroundColor: '#D4EDDA',
    borderWidth: 1,
    borderColor: '#C3E6CB',
  },
  responseError: {
    backgroundColor: '#F8D7DA',
    borderWidth: 1,
    borderColor: '#F5C6CB',
  },
  responseText: {
    fontSize: 14,
    fontWeight: '600',
  },

  listContainer: {},
  card: { backgroundColor: '#FFFFFF', borderRadius: 8, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  cardTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10, color: '#000' },
  cardLine: { marginBottom: 6, color: '#000' },
  cardLabel: { fontWeight: '700', color: '#333' },
  cardValue: { color: '#000' },

  collapseButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E0E0E0', marginTop: 8, backgroundColor: '#FAFAFA' },
  collapseButtonText: { fontSize: 13, fontWeight: '700', color: '#007AFF' },
  collapseContent: { marginTop: 8, padding: 10, borderRadius: 8, backgroundColor: '#F8F9FA' },
  detailText: { marginBottom: 6, color: '#000' },

  mediaLabel: { fontSize: 14, fontWeight: '800', color: '#000', marginTop: 10, marginBottom: 8 },

  actionsRow: { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 8, gap: 8 },
  usesBtn: { backgroundColor: '#34C759' },
  editBtn: { backgroundColor: '#007AFF' },
  changesButton: { backgroundColor: '#5856D6', flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 8, gap: 8 },
  deleteBtn: { backgroundColor: '#FF3B30' },
  actionBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  floatModalCardMovimientos: { backgroundColor: '#FFFFFF', borderRadius: 12, width: '100%', maxWidth: 500, maxHeight: '80%', borderWidth: 1, borderColor: '#E0E0E0', overflow: 'hidden' },
  floatModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  cambioCollapsableMain: { width: '100%', marginBottom: 10, backgroundColor: '#fff', borderRadius: 6, borderWidth: 1, borderColor: '#E0E0E0', overflow: 'hidden' },
  cambioCollapsableHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#F8F9FA' },
  cambioCollapsableTitle: { fontSize: 14, fontWeight: '600', color: '#007AFF', flex: 1 },
  cambioCollapsableContent: { padding: 12, gap: 8, backgroundColor: '#F8F9FA' },
  changeDescription: { fontSize: 14, lineHeight: 20, color: '#666', marginBottom: 8 },
  filterGroupSearch: { marginBottom: 12 },

  // modal (estilo bootstrap)
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 16 },
  modalCard: { width: '100%', maxWidth: 820, alignSelf: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  modalTitle: { fontSize: 16, fontWeight: '900', color: '#000' },
  modalCloseBtn: { padding: 6, borderRadius: 18, backgroundColor: '#F2F2F2' },
  modalBody: { maxHeight: 520 },
  modalBodyContent: { padding: 14, paddingBottom: 18 },
  modalFooter: { padding: 12, borderTopWidth: 1, borderTopColor: '#E0E0E0', backgroundColor: '#FAFAFA' },

  modalPrimaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#007AFF', borderRadius: 10, paddingVertical: 12, marginBottom: 12 },
  modalPrimaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  modalFormCard: { backgroundColor: '#fff', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#E0E0E0', marginBottom: 14 },
  modalSectionTitle: { fontSize: 15, fontWeight: '900', color: '#007AFF', marginBottom: 8 },
  modalList: { gap: 12 },
  modalListItem: { backgroundColor: '#FFFFFF', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#E0E0E0' },
  modalListTitle: { fontSize: 14, fontWeight: '900', color: '#000', marginBottom: 8 },
  modalItemActions: { marginTop: 10, flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  assignBtn: { backgroundColor: '#FF9500' },

  // Bitácora colapsable
  collapsableContent: { marginTop: 10, padding: 12, backgroundColor: '#FAFAFA', borderRadius: 8, borderWidth: 1, borderColor: '#E0E0E0' },
  bitacoraSectionTitle: { fontSize: 15, fontWeight: '800', color: '#007AFF', marginTop: 12, marginBottom: 8 },
  bitacoraHeading: { fontSize: 14, fontWeight: '700', color: '#333', marginTop: 10, marginBottom: 6 },
  bitacoraField: { marginBottom: 8 },
  bitacoraLabel: { fontSize: 13, fontWeight: '700', color: '#666', marginBottom: 2 },
  bitacoraValue: { fontSize: 13, color: '#000' },
  bitacoraObservation: { fontSize: 12, color: '#666', fontStyle: 'italic', marginTop: 2 },
  bitacoraObservaciones: { fontSize: 13, color: '#000', lineHeight: 20 },
  signaturePreview: { width: '100%', height: 120, resizeMode: 'contain', marginTop: 4, backgroundColor: '#FFFFFF', borderRadius: 4, borderWidth: 1, borderColor: '#E0E0E0' },
  movimientoCard: { backgroundColor: '#FFFFFF', borderRadius: 8, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: '#E0E0E0' },
  movimientoTitle: { fontSize: 14, fontWeight: '700', color: '#007AFF', marginBottom: 8 },

  // Camera modal
  cameraCloseButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  cameraCaptureButton: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#fff',
  },
  cameraCaptureButtonInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
  },
  cameraPermissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  cameraPermissionText: { fontSize: 16, color: '#FFFFFF', marginBottom: 20, textAlign: 'center' },
  cameraPermissionBtn: { backgroundColor: '#007AFF', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  cameraPermissionBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  // Signature modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  modalContainer: { backgroundColor: '#FFF', borderRadius: 12, overflow: 'hidden' },
  modalSignatureContainer: { height: 280, backgroundColor: '#FFF' },
  modalActions: { flexDirection: 'row', gap: 10, padding: 14, justifyContent: 'flex-end' },
  modalClearButton: { backgroundColor: '#F1F5F9', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', gap: 8, alignItems: 'center' },
  modalClearButtonText: { color: '#111', fontWeight: '800' },
  modalAcceptButton: { backgroundColor: '#D1FAE5', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', gap: 8, alignItems: 'center' },
  modalAcceptButtonText: { color: '#111', fontWeight: '800' },

  // Filtros jerárquicos
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
  filterToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filtersTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  resetFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#FFECEC',
  },
  resetFiltersText: {
    fontSize: 12,
    color: '#FF3B30',
    fontWeight: '600',
  },
  filtersContent: {
    padding: 12,
    backgroundColor: '#F9F9F9',
    gap: 8,
  },
  filterGroup: {
    marginBottom: 8,
    backgroundColor: '#F9F9F9',
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
});


