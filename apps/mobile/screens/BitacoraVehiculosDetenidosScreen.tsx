import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Dimensions,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { formatDateDMY } from '@/utils/formatDate';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import * as Location from 'expo-location';
import SignatureScreen from 'react-native-signature-canvas';
import { jwtDecode } from 'jwt-decode';
import Constants from 'expo-constants';

import { CameraView, useCameraPermissions } from 'expo-camera';
import AppHeader from '@/components/AppHeader';
import AppFooter from '@/components/AppFooter';
import SlideMenu from '@/components/SlideMenu';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { RootStackParamList } from '../App';
import { useAuth } from '@/contexts/AuthContext';
import { eventBus } from '@/hooks/eventBus';
import getHoraAccion from '@/hooks/getHoraAccion';
import { useQRScanner } from '@/hooks/useQRScanner';
import authedFetch from '@/hooks/authedFetch';
import {
  BitacoraVehiculoDetenidoItem,
  createBitacoraVehiculoDetenido,
  deleteBitacoraRevisionImage,
  deleteBitacoraVehiculoDetenido,
  listBitacoraVehiculoDetenido,
  updateBitacoraVehiculoDetenido,
} from '@/hooks/bitacoraVehiculoDetenidoFunctions';
import { BITACORA_VEHICULO_DETENIDO_EVAL_TYPE } from '@/hooks/corporateEvaluationsSync';
import {
  bitacoraLinkFromCacheItem,
  bitacoraLinkFromRequestPayload,
  clearBitacoraFromMainStructureByBitacoraRef,
  findBitacoraDetenidoInMainStructureByLocalKey,
  loadMainStructureTreeMerged,
  mergeBitacorasDetenidosForSucursalFromServer,
  moveBitacoraDetenidoRowBetweenSucursales,
  moveBitacoraOnMainStructureCache,
  readBitacorasForSucursalFromMainStructure,
  removeBitacoraDetenidoRowFromMainStructure,
  setBitacoraOnUsoInMainStructureCache,
  upsertBitacoraDetenidoRowInMainStructure,
} from '@/hooks/bitacoraMainStructureCache';
import {
  findHierarchyByCorpoIn,
  findHierarchyByPuestoIn,
  getFirstPuestoIdFromSucursalInTree,
} from '@/hooks/llavesMainStructureHelpers';
import { readCorporateVehiclesForSucursalFromMainStructure } from '@/hooks/corporateVehiclesMainStructure';
import {
  bitacoraRevMakeLocalImageRef,
  bitacoraRevParseLocalImageRef,
  buildBitacoraRevisionForSubmit,
  mergeRevisionImagesIntoArray,
  mergeNewRevisionImagesWithExisting,
  deleteBitacoraRevLocalImageFilesFromMap,
  removeImageFromRevisionArray,
  resolveBitacoraRevImageDisplayUri,
  saveCameraPhotoToBitacoraRevFile,
  type BitacoraRevisionEntry,
} from '@/hooks/bitacoraRevisionMediaSync';
import { deleteFile } from '@/hooks/fileStorage';

type Nav = NativeStackNavigationProp<RootStackParamList, 'BitacoraVehiculosDetenidos'>;

type TipoBitacora = 'Vehículo' | 'Bicicleta' | 'Motocicleta';

function isTipoBicicleta(tipo: string): boolean {
  return String(tipo || '').trim() === 'Bicicleta';
}

function clearVehiculoInfoCamposNoBicicleta(setters: {
  setVehKilometraje: (v: string) => void;
  setVehProxCambioAceite: (v: string) => void;
  setVehModelo: (v: string) => void;
  setVehAnno: (v: string) => void;
  setVehTituloPropiedad: (v: boolean | null) => void;
  setVehRTV: (v: boolean | null) => void;
  setVehMarchamo: (v: boolean | null) => void;
}) {
  setters.setVehKilometraje('');
  setters.setVehProxCambioAceite('');
  setters.setVehModelo('');
  setters.setVehAnno('');
  setters.setVehTituloPropiedad(null);
  setters.setVehRTV(null);
  setters.setVehMarchamo(null);
}
type ReviewStatus = 'Bueno' | 'Malo' | 'No existe';
type YesNo = 'Sí' | 'No';

type MainStructureTree = any[];

type RoleName = 'OPERATIVO' | 'SUPERVISOR' | 'ADMINISTRATIVO' | string | null;

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
  filterSucursalId: number | null;
};

function buildBitacoraListFetchKey(
  snap: MarcaSnapshot | null,
  filterSucursalId: number | null
): string | null {
  if (!snap) return null;
  const sid = snap.isOperativo ? snap.marcaCorpoId : filterSucursalId ?? snap.marcaCorpoId;
  if (sid == null || Number(sid) <= 0) {
    return snap.isOperativo ? 'op:pending' : 'filt:pending';
  }
  return snap.isOperativo ? `op:${sid}` : `filt:${sid}`;
}

type BitacoraRevisionThumbnailProps = {
  uri: string;
  onDelete: () => void;
  variant: 'list' | 'form';
};

const BitacoraRevisionThumbnail = React.memo(function BitacoraRevisionThumbnail({
  uri,
  onDelete,
  variant,
}: BitacoraRevisionThumbnailProps) {
  if (!uri) return null;
  const isList = variant === 'list';
  return (
    <ThemedView style={isList ? styles.revisionImageWrap : styles.revisionFormImageWrap}>
      <Image
        source={{ uri }}
        style={isList ? styles.revisionImagePreview : styles.revisionImagePreviewForm}
        resizeMode={isList ? 'contain' : 'cover'}
        {...(Platform.OS === 'android' ? { resizeMethod: 'resize' as const } : {})}
      />
      <TouchableOpacity
        style={isList ? styles.revisionImageDeleteBtn : styles.revisionImageDeleteBtnForm}
        onPress={onDelete}
      >
        <Ionicons name="trash" size={isList ? 20 : 14} color={isList ? '#FFFFFF' : '#FF3B30'} />
      </TouchableOpacity>
    </ThemedView>
  );
});

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

/** ID sucursal en registro o caché (`sucursal_id` o `corpo_id`). */
function bitacoraRecordSucursalId(b: any): number {
  return Number(b?.sucursal_id ?? b?.corpo_id ?? 0);
}

function normalizeVehiculoNodeFromTree(v: any): any {
  const usosRaw = v?.usos ?? v?.c_usos_vehiculos_corporativos ?? [];
  const usos = Array.isArray(usosRaw) ? usosRaw : [];
  return { ...v, usos, c_usos_vehiculos_corporativos: usos };
}

function isPositiveServerId(value: unknown): boolean {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

function resolveLocalEntityKey(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s) return null;
  return isPositiveServerId(s) ? null : s;
}

/** Vehículos corporativos de una sucursal según el árbol principal (fragmentos mergeados o caché legada). */
function getVehiculosCorporativosFromTree(tree: MainStructureTree, corpoId: number): any[] {
  const cid = Number(corpoId);
  for (const empresa of tree || []) {
    for (const cliente of empresa.clientes || []) {
      const divisiones = cliente.division || cliente.divisiones || [];
      for (const division of divisiones) {
        for (const contrato of division.contratos || []) {
          for (const sucursal of contrato.sucursales || []) {
            if (Number(sucursal.id) === cid) {
              const raw = sucursal.vehiculos_corporativos || sucursal.c_vehiculos_corporativos || [];
              if (!Array.isArray(raw)) return [];
              return raw.map(normalizeVehiculoNodeFromTree);
            }
          }
        }
      }
    }
  }
  return [];
}

type MovimientoVehiculo = {
  movimiento: string;
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:mm
  realizado_por: string;
  autorizado_por: string;
  _expanded?: boolean;
};

type RevisionEntry = {
  key: string;
  label: string;
  kind: 'select' | 'radio' | 'heading' | 'text';
  required?: boolean;
  withObservation?: boolean;
};

type GeneralEntry = {
  key: string;
  label: string;
  kind: 'readonly' | 'text' | 'date' | 'time' | 'select' | 'signature';
  required?: boolean;
  options?: string[];
};

const REVIEW_OPTIONS: ReviewStatus[] = ['Bueno', 'Malo', 'No existe'];
const TYPE_OPTIONS: TipoBitacora[] = ['Vehículo', 'Bicicleta', 'Motocicleta'];

const generateRandomId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 10; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
};

const dateToLocalString = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatYMDToDMY = (value?: string): string => {
  const v = String(value || '').trim();
  if (!v) return '';
  const onlyDate = v.split('T')[0];
  const ymd = onlyDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) return `${ymd[3]}-${ymd[2]}-${ymd[1]}`;
  const dmy = onlyDate.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmy) return `${dmy[1]}-${dmy[2]}-${dmy[3]}`;
  return onlyDate;
};

const parseDateStringToDate = (value?: string): Date => {
  const v = String(value || '').trim();
  if (!v) return new Date();
  const onlyDate = v.split('T')[0];
  const ymd = onlyDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) return new Date(`${onlyDate}T00:00:00`);
  const dmy = onlyDate.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmy) return new Date(`${dmy[3]}-${dmy[2]}-${dmy[1]}T00:00:00`);
  const parsed = new Date(v);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const timeToHHmm = (d: Date): string => {
  // Ajuste por timezone: usamos toISOString() de una fecha ajustada
  // para que la hora visual seleccionada sea exactamente la que se guarda.
  const adjusted = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  const iso = adjusted.toISOString(); // YYYY-MM-DDTHH:mm:ss.sssZ
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

const buildGeneralConfig = (tipo: TipoBitacora): GeneralEntry[] => {
  if (tipo === 'Motocicleta') {
    return [
      { key: 'empresa', label: 'Empresa', kind: 'readonly' },
      { key: 'cliente', label: 'Cliente', kind: 'readonly' },
      { key: 'corpo', label: 'Sucursal', kind: 'readonly' },
      { key: 'nombre_oficial_corporacion', label: 'Nombre oficial de corporación', kind: 'text', required: true },
      { key: 'firma_oficial_corporacion', label: 'Firma (oficial corporación)', kind: 'signature', required: false },
      { key: 'fecha', label: 'Fecha', kind: 'date', required: true },
      { key: 'hora', label: 'Hora', kind: 'time', required: true },
      { key: 'codigo', label: 'Código', kind: 'text', required: true },
      { key: 'numero_placa', label: 'Número placa', kind: 'text', required: true },
      { key: 'marca', label: 'Marca', kind: 'text', required: true },
      { key: 'color', label: 'Color', kind: 'text', required: true },
      { key: 'nombre_oficial_transito', label: 'Nombre oficial de tránsito', kind: 'text', required: true },
      { key: 'firma_oficial_transito', label: 'Firma (oficial tránsito)', kind: 'signature', required: false },
      { key: 'km', label: 'KM que marca', kind: 'text', required: false },
      { key: 'numero_motor', label: 'Número de motor', kind: 'text', required: false },
      { key: 'tipo_vehiculo', label: 'Tipo', kind: 'text', required: false },
      { key: 'vin', label: 'Número de Vin o chases', kind: 'text', required: false },
      {
        key: 'combustible',
        label: 'Combustible',
        kind: 'select',
        required: false,
        options: ['Lleno', '3/4', '1/2', '1/4', 'Marcador malo'],
      },
      { key: 'encargado_deposito', label: 'Encargado de depósito', kind: 'text', required: false },
      { key: 'codigo_encargado', label: 'Código del encargado', kind: 'text', required: false },
      { key: 'firma_encargado', label: 'Firma del encargado', kind: 'signature', required: false },
    ];
  }

  if (tipo === 'Bicicleta') {
    return [
      { key: 'empresa', label: 'Empresa', kind: 'readonly' },
      { key: 'cliente', label: 'Cliente', kind: 'readonly' },
      { key: 'corpo', label: 'Sucursal', kind: 'readonly' },
      { key: 'nombre_oficial_corporacion', label: 'Nombre oficial de corporación', kind: 'text', required: true },
      { key: 'firma_oficial_corporacion', label: 'Firma del oficial', kind: 'signature', required: false },
      { key: 'fecha', label: 'Fecha', kind: 'date', required: true },
      { key: 'hora', label: 'Hora', kind: 'time', required: true },
      { key: 'codigo', label: 'Código', kind: 'text', required: true },
      { key: 'numero_placa', label: 'Número de placa', kind: 'text', required: false },
      { key: 'marca', label: 'Marca', kind: 'text', required: true },
      { key: 'color', label: 'Color', kind: 'text', required: true },
      { key: 'nombre_oficial_transito', label: 'Nombre de oficial de tránsito', kind: 'text', required: true },
      { key: 'firma_oficial_transito', label: 'Firma (tránsito)', kind: 'signature', required: false },
      { key: 'codigo_encargado', label: 'Código del encargado', kind: 'text', required: false },
      { key: 'firma_encargado', label: 'Firma del encargado', kind: 'signature', required: false }
    ];
  }

  // Vehículo
  return [
    { key: 'empresa', label: 'Empresa', kind: 'readonly' },
    { key: 'cliente', label: 'Cliente', kind: 'readonly' },
    { key: 'corpo', label: 'Sucursal', kind: 'readonly' },
    // A excepción de Empresa / Cliente / Sucursal / Fecha / Hora, el resto será opcional
    { key: 'oficial_transito', label: 'Oficial de tránsito', kind: 'text', required: false },
    { key: 'codigo_oficial_transito', label: 'Código del oficial (tránsito)', kind: 'text', required: false },
    { key: 'firma_oficial_transito', label: 'Firma del oficial (tránsito)', kind: 'signature', required: false },
    { key: 'oficial_seguridad', label: 'Nombre oficial de seguridad', kind: 'text', required: false },
    { key: 'codigo_oficial_seguridad', label: 'Código del oficial (seguridad)', kind: 'text', required: false },
    { key: 'firma_oficial_seguridad', label: 'Firma del oficial (seguridad)', kind: 'signature', required: false },
    { key: 'fecha', label: 'Fecha', kind: 'date', required: true },
    { key: 'hora', label: 'Hora', kind: 'time', required: true },
    { key: 'km', label: 'KM que marca', kind: 'text', required: false },
    { key: 'numero_motor', label: 'Número de motor', kind: 'text', required: false },
    { key: 'numero_placa', label: 'Número de placa', kind: 'text', required: false },
    { key: 'marca', label: 'Marca', kind: 'text', required: false },
    { key: 'tipo_vehiculo', label: 'Tipo', kind: 'text', required: false },
    { key: 'color', label: 'Color', kind: 'text', required: false },
    { key: 'vin', label: 'Número de Vin o chases', kind: 'text', required: false },
    {
      key: 'combustible',
      label: 'Combustible',
      kind: 'select',
      required: false,
      options: ['Lleno', '3/4', '1/2', '1/4', 'Marcador malo'],
    },
    { key: 'encargado_deposito', label: 'Encargado de depósito', kind: 'text', required: false },
    { key: 'codigo_encargado', label: 'Código del encargado', kind: 'text', required: false },
    { key: 'firma_encargado', label: 'Firma del encargado', kind: 'signature', required: false },
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
      'Pito',
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

export default function BitacoraVehiculosDetenidosScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'BitacoraVehiculosDetenidos'>>();
  const { employee, refreshAccessToken, logout, accessToken } = useAuth();
  const appendTokenToUrl = (url: string) => {
    if (!url) return '';
    if (!accessToken || accessToken.trim().length === 0) return url;
    if (/[?&]token=/.test(url)) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}token=${encodeURIComponent(accessToken)}`;
  };
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [currentRevisionKey, setCurrentRevisionKey] = useState<string | null>(null);
  const { scanQR, QRScannerComponent } = useQRScanner();

  const prefill = route.params?.prefill;
  const returnTo = route.params?.returnTo;
  const isPrefillMode = !!prefill;

  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasCurrentMarca, setHasCurrentMarca] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bitacoras, setBitacoras] = useState<BitacoraVehiculoDetenidoItem[]>([]);

  // Modal: ver cambios (auditoría)
  const [isCambiosModalVisible, setIsCambiosModalVisible] = useState(false);
  const [cambiosTitle, setCambiosTitle] = useState<string>('Cambios');
  const [cambiosItems, setCambiosItems] = useState<any[]>([]);
  const [expandedCambioId, setExpandedCambioId] = useState<number | null>(null);

  // Filtros (lista)
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  const [filterTipo, setFilterTipo] = useState<'all' | TipoBitacora>('all');
  const [filterFecha, setFilterFecha] = useState<string>(''); // yyyy-mm-dd
  const [filterSearch, setFilterSearch] = useState<string>(''); // placa/marca/oficial
  const [showFilterFechaPicker, setShowFilterFechaPicker] = useState(false);

  const [isCreating, setIsCreating] = useState(false);
  const [editing, setEditing] = useState<BitacoraVehiculoDetenidoItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingBitacoraKey, setDeletingBitacoraKey] = useState<string | null>(null);
  const [submitResponse, setSubmitResponse] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const getBitacoraRowKey = (item: BitacoraVehiculoDetenidoItem) =>
    item.id_local ? `local:${item.id_local}` : `id:${item.id}`;

  const [tipo, setTipo] = useState<TipoBitacora>('Vehículo');
  const tipoRef = useRef<TipoBitacora>('Vehículo');
  const isPreloadingVehiculoUsoRef = useRef(false);

  const [empresaNombre, setEmpresaNombre] = useState<string>('');
  const [clienteNombre, setClienteNombre] = useState<string>('');
  const [corpoNombre, setCorpoNombre] = useState<string>('');
  const [marcaId, setMarcaId] = useState<number | null>(null);

  // IDs obtenidos de current_marca o del vehículo (prefill)
  const [marcaEmpresaId, setMarcaEmpresaId] = useState<number | null>(null);
  const [marcaClienteId, setMarcaClienteId] = useState<number | null>(null);
  const [marcaCorpoId, setMarcaCorpoId] = useState<number | null>(null);
  const [marcaDivisionId, setMarcaDivisionId] = useState<number | null>(null);
  const [roleName, setRoleName] = useState<RoleName>(null);

  const [filterEmpresaId, setFilterEmpresaId] = useState<number | null>(null);
  const [filterClienteId, setFilterClienteId] = useState<number | null>(null);
  const [filterDivisionId, setFilterDivisionId] = useState<number | null>(null);
  const [filterContratoId, setFilterContratoId] = useState<number | null>(null);
  const [filterSucursalId, setFilterSucursalId] = useState<number | null>(null);
  const listFiltersSyncedFromMarcaOnceRef = useRef(false);
  const filterSucursalIdRef = useRef<number | null>(null);
  const filterEmpresaIdRef = useRef<number | null>(null);
  const filterClienteIdRef = useRef<number | null>(null);
  const lastBitacoraListFetchKeyRef = useRef<string | null>(null);
  const bitacoraListFetchInFlightRef = useRef<Promise<void> | null>(null);
  const listFocusSessionRef = useRef(0);
  const serverRevisionImageUrlCacheRef = useRef<Map<string, string>>(new Map());

  const [structure, setStructure] = useState<MainStructureTree>([]);
  const [isStructureLoading, setIsStructureLoading] = useState(false);

  /** Jerarquía del formulario (visible si no es OPERATIVO). */
  const [formEmpresaId, setFormEmpresaId] = useState<number | null>(null);
  const [formClienteId, setFormClienteId] = useState<number | null>(null);
  const [formDivisionId, setFormDivisionId] = useState<number | null>(null);
  const [formContratoId, setFormContratoId] = useState<number | null>(null);
  const [formSucursalId, setFormSucursalId] = useState<number | null>(null);
  const [formPuestoId, setFormPuestoId] = useState<number | null>(null);

  // Vehículo corporativo / Uso (vinculación bitácora)
  const [selectedCorporateVehicleId, setSelectedCorporateVehicleId] = useState<number | null>(null);
  const [selectedCorporateUseId, setSelectedCorporateUseId] = useState<number | null>(null);
  /** IDs locales (offline) para payload y pickers cuando `id` no es numérico de servidor. */
  const [selectedCorporateVehicleIdLocal, setSelectedCorporateVehicleIdLocal] = useState<string | null>(null);
  const [selectedCorporateUseIdLocal, setSelectedCorporateUseIdLocal] = useState<string | null>(null);
  const [corporateVehicles, setCorporateVehicles] = useState<any[]>([]);
  const [availableCorporateUses, setAvailableCorporateUses] = useState<any[]>([]);
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(false);
  const [prefillVehicleInfo, setPrefillVehicleInfo] = useState<{ vehiculo?: any; uso?: any } | null>(null);
  /** Prefill desde CorporateVehicles: jerarquía elegida automáticamente y selects bloqueados. */
  const [prefillFormHierarchyLocked, setPrefillFormHierarchyLocked] = useState(false);
  // Vehículo temporal para casos donde el vehículo no está en la lista cargada
  const [tempVehicle, setTempVehicle] = useState<any | null>(null);
  const loadedVehiclesCorpoRef = useRef<number | null>(null);

  // Datos adicionales del vehículo (opcionales) y control para registrar vehículo nuevo
  const [shouldRegisterVehicle, setShouldRegisterVehicle] = useState<boolean>(false);
  const [vehKilometraje, setVehKilometraje] = useState<string>('');
  const [vehProxCambioAceite, setVehProxCambioAceite] = useState<string>('');
  const [vehModelo, setVehModelo] = useState<string>('');
  const [vehAnno, setVehAnno] = useState<string>('');
  const [vehTipoAutoria, setVehTipoAutoria] = useState<string>('');
  const [vehTituloPropiedad, setVehTituloPropiedad] = useState<boolean | null>(null);
  const [vehRTV, setVehRTV] = useState<boolean | null>(null);
  const [vehMarchamo, setVehMarchamo] = useState<boolean | null>(null);

  const [generalValues, setGeneralValues] = useState<Record<string, any>>({});
  const [revisionValues, setRevisionValues] = useState<Record<string, any>>({});
  const [revisionObs, setRevisionObs] = useState<Record<string, string>>({});
  const [revisionImages, setRevisionImages] = useState<Record<string, string[]>>({});
  const [movimientos, setMovimientos] = useState<MovimientoVehiculo[]>([]);
  const [observaciones, setObservaciones] = useState<string>('');

  const [firmaResponsable, setFirmaResponsable] = useState<string>('');
  const [isGeneratingFirma, setIsGeneratingFirma] = useState(false);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);

  // Signature capture modal (para firmas dibujadas)
  const [signatureModalVisible, setSignatureModalVisible] = useState(false);
  const [signatureTargetKey, setSignatureTargetKey] = useState<string | null>(null);
  const [signatureKey, setSignatureKey] = useState(0);
  const signatureRef = useRef<any>(null);

  const signatureWebStyle = `
    body, html { margin: 0; padding: 0; height: 100%; width: 100%; }
    .m-signature-pad { position: absolute; top: 0; left: 0; right: 0; bottom: 0; box-shadow: none; border: none; background-color: #FFFFFF; }
    .m-signature-pad--body { position: absolute; top: 0; left: 0; right: 0; bottom: 0; border: none; margin: 0; padding: 0; }
    .m-signature-pad--body canvas { width: 100% !important; height: 100% !important; touch-action: none; }
    .m-signature-pad--footer { display: none; }
  `;

  const formatSignatureForDisplay = (signature: any): string | null => {
    if (!signature) return null;
    const s = String(signature);
    if (s.startsWith('data:')) return s;
    return `data:image/png;base64,${s}`;
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

  // Date/Time pickers
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerKey, setDatePickerKey] = useState<string | null>(null);
  const [datePickerValue, setDatePickerValue] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerKey, setTimePickerKey] = useState<string | null>(null);
  const [timePickerValue, setTimePickerValue] = useState(new Date());

  const generalConfig = useMemo(() => buildGeneralConfig(tipo), [tipo]);
  const revisionConfig = useMemo(() => buildRevisionConfig(tipo), [tipo]);
  const isEditingBitacoraRecord = useMemo(
    () => !!(editing && ((Number(editing.id) || 0) > 0 || editing.id_local)),
    [editing],
  );


  const handleMenuPress = () => setIsMenuVisible(true);
  const handleMenuClose = () => setIsMenuVisible(false);
  const handleHomePress = () => navigation.navigate('Home');

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
        setRoleName(null);
        if (applyFiltersFromMarca) {
          setFilterEmpresaId(null);
          setFilterClienteId(null);
          setFilterDivisionId(null);
          setFilterContratoId(null);
          setFilterSucursalId(null);
          filterSucursalIdRef.current = null;
        }
        return null;
      }
      try {
        const current = JSON.parse(currentMarcaStr);
        if (!current?.id) {
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
          current?.roleDivision?.role?.nombre ?? current?.role_division?.role?.nombre ?? null;
        const rn = typeof role === 'string' ? (role as RoleName) : null;

        setMarcaDivisionId(divId);
        setMarcaCorpoId(corpoId);
        setMarcaClienteId(clienteId);
        setMarcaEmpresaId(empresaId);
        setRoleName(rn);
        setMarcaId(Number(current.id));

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
          setFilterSucursalId(fs);
          filterSucursalIdRef.current = fs;
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
          filterSucursalId: fs,
        };
      } catch {
        setHasCurrentMarca(false);
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
      const fs = currentMarca.corpo?.id != null ? Number(currentMarca.corpo.id) : null;
      setFilterSucursalId(fs);
      filterSucursalIdRef.current = fs;
    } catch (e) {
      console.error('resetListFiltersFromCurrentMarca (bitácora vehículos):', e);
    }
  }, []);

  const fetchMainStructure = useCallback(async () => {
    setIsStructureLoading(true);
    try {
      const loaded = await loadMainStructureTreeMerged();
      setStructure(Array.isArray(loaded) ? loaded : []);
    } catch (e) {
      console.error('Error loading main structure (bitácora vehículos):', e);
      setStructure([]);
    } finally {
      setIsStructureLoading(false);
    }
  }, []);

  const filterEmpresaOptions = useMemo(() => structure ?? [], [structure]);
  const filterClienteOptionsMemo = useMemo(() => {
    const empresa = structure.find((e) => e.id === filterEmpresaId);
    return empresa?.clientes ?? [];
  }, [structure, filterEmpresaId]);
  const filterDivisionOptionsMemo = useMemo(() => {
    const cliente = filterClienteOptionsMemo.find((c: any) => c.id === filterClienteId);
    return cliente?.division ?? [];
  }, [filterClienteOptionsMemo, filterClienteId]);
  const filterContratoOptionsMemo = useMemo(() => {
    const division = filterDivisionOptionsMemo.find((d: any) => d.id === filterDivisionId);
    return division?.contratos ?? [];
  }, [filterDivisionOptionsMemo, filterDivisionId]);
  const filterSucursalOptionsMemo = useMemo(() => {
    const contrato = filterContratoOptionsMemo.find((c: any) => c.id === filterContratoId);
    return contrato?.sucursales ?? [];
  }, [filterContratoOptionsMemo, filterContratoId]);

  const formEmpresaNode = useMemo(() => {
    if (formEmpresaId === null) return null;
    return structure.find((e) => e.id === formEmpresaId) ?? null;
  }, [structure, formEmpresaId]);
  const formClienteOptions = useMemo(() => {
    if (!formEmpresaNode) return [];
    return (formEmpresaNode.clientes || []).map((c: any) => ({ id: c.id, nombre: c.nombre }));
  }, [formEmpresaNode]);
  const formClienteNode = useMemo(() => {
    if (!formEmpresaNode || formClienteId === null) return null;
    return formEmpresaNode.clientes.find((c: any) => c.id === formClienteId) ?? null;
  }, [formEmpresaNode, formClienteId]);
  const formDivisionOptions = useMemo(() => {
    if (!formClienteNode) return [];
    return (formClienteNode.division || []).map((d: any) => ({ id: d.id, nombre: d.nombre }));
  }, [formClienteNode]);
  const formDivisionNode = useMemo(() => {
    if (!formClienteNode || formDivisionId === null) return null;
    return (formClienteNode.division || []).find((d: any) => d.id === formDivisionId) ?? null;
  }, [formClienteNode, formDivisionId]);
  const formContratoOptions = useMemo(() => {
    if (!formDivisionNode) return [];
    return (formDivisionNode.contratos || []).map((c: any) => ({ id: c.id, nombre: c.nombre }));
  }, [formDivisionNode]);
  const formContratoNode = useMemo(() => {
    if (!formDivisionNode || formContratoId === null) return null;
    return (formDivisionNode.contratos || []).find((c: any) => c.id === formContratoId) ?? null;
  }, [formDivisionNode, formContratoId]);
  const formSucursalOptions = useMemo(() => {
    if (!formContratoNode) return [];
    return (formContratoNode.sucursales || []).map((s: any) => ({ id: s.id, nombre: s.nombre }));
  }, [formContratoNode]);

  const formSucursalNode = useMemo(() => {
    if (!formContratoNode || formSucursalId === null) return null;
    return (formContratoNode.sucursales || []).find((s: any) => Number(s.id) === Number(formSucursalId)) ?? null;
  }, [formContratoNode, formSucursalId]);

  const formPuestoOptions = useMemo(() => {
    if (!formSucursalNode) return [];
    return (formSucursalNode.puestos || []).map((p: any) => ({
      id: p.id,
      nombre: p.nombre != null ? String(p.nombre) : String(p.codigo ?? p.id),
    }));
  }, [formSucursalNode]);

  const applyCurrentMarcaToFormHierarchy = useCallback(async () => {
    try {
      const currentMarcaStr = await AsyncStorage.getItem('current_marca');
      if (!currentMarcaStr) return;
      const marca = JSON.parse(currentMarcaStr);

      setFormEmpresaId(marca.empresa?.id != null ? Number(marca.empresa.id) : null);
      setFormClienteId(marca.cliente?.id != null ? Number(marca.cliente.id) : null);
      setFormDivisionId(getDivisionIdFromMarcaJson(marca));
      setFormContratoId(marca.contrato?.id != null ? Number(marca.contrato.id) : null);
      setFormSucursalId(marca.corpo?.id != null ? Number(marca.corpo.id) : null);
      setFormPuestoId(marca.puesto?.id != null ? Number(marca.puesto.id) : null);
    } catch (e) {
      console.error('applyCurrentMarcaToFormHierarchy (bitácora vehículos):', e);
    }
  }, []);

  const handleFormEmpresaChange = (empresaId: number | null) => {
    setFormEmpresaId(empresaId);
    setFormClienteId(null);
    setFormDivisionId(null);
    setFormContratoId(null);
    setFormSucursalId(null);
    setFormPuestoId(null);
  };
  const handleFormClienteChange = (clienteId: number | null) => {
    setFormClienteId(clienteId);
    setFormDivisionId(null);
    setFormContratoId(null);
    setFormSucursalId(null);
    setFormPuestoId(null);
  };
  const handleFormDivisionChange = (divisionId: number | null) => {
    setFormDivisionId(divisionId);
    setFormContratoId(null);
    setFormSucursalId(null);
    setFormPuestoId(null);
  };
  const handleFormContratoChange = (contratoId: number | null) => {
    setFormContratoId(contratoId);
    setFormSucursalId(null);
    setFormPuestoId(null);
  };

  const runFetchBitacoras = useCallback(
    async (snap: MarcaSnapshot | null, opts?: { force?: boolean }) => {
      const fetchKey = buildBitacoraListFetchKey(snap, filterSucursalIdRef.current);
      if (
        !opts?.force &&
        fetchKey &&
        fetchKey === lastBitacoraListFetchKeyRef.current &&
        bitacoraListFetchInFlightRef.current
      ) {
        await bitacoraListFetchInFlightRef.current;
        return;
      }
      if (!opts?.force && fetchKey && fetchKey === lastBitacoraListFetchKeyRef.current) {
        return;
      }

      const run = async () => {
      try {
        setIsLoading(true);
        setError(null);

        if (isPrefillMode && !snap) {
          setIsLoading(false);
          return;
        }

        if (!snap) {
          setBitacoras([]);
          setIsLoading(false);
          return;
        }

        const isOperativo = snap.isOperativo;
        const listCorpoId = isOperativo
          ? snap.marcaCorpoId
          : filterSucursalIdRef.current ?? snap.marcaCorpoId;

        const sid = listCorpoId != null && Number(listCorpoId) > 0 ? Number(listCorpoId) : null;
        const fromMain =
          sid != null ? await readBitacorasForSucursalFromMainStructure(sid) : [];

        const isConnected = await getConnectionStatus();

        if (!isConnected) {
          setBitacoras(fromMain as BitacoraVehiculoDetenidoItem[]);
          if (!sid) {
            setError(
              isOperativo
                ? 'No se encontró la sucursal en la marca actual'
                : 'Seleccione sucursal en el filtro para ver registros en caché'
            );
          } else {
            setError(null);
            if (fetchKey) lastBitacoraListFetchKeyRef.current = fetchKey;
          }
          setIsLoading(false);
          return;
        }

        if (!sid || sid <= 0) {
          setBitacoras(fromMain as BitacoraVehiculoDetenidoItem[]);
          setError(
            isOperativo
              ? 'No se encontró el ID de la sucursal (corpo) en la marca actual'
              : 'Seleccione sucursal (corpo) en el filtro jerárquico para cargar los registros'
          );
          setIsLoading(false);
          return;
        }

        setError(null);

        const empresaIdForApi = isOperativo
          ? snap.marcaEmpresaId ?? undefined
          : filterEmpresaIdRef.current ?? undefined;
        const clienteIdForApi = isOperativo
          ? snap.marcaClienteId ?? undefined
          : filterClienteIdRef.current ?? undefined;

        const res = await listBitacoraVehiculoDetenido({
          marcaId: Number(snap.current?.id ?? 0),
          empresaId: typeof empresaIdForApi === 'number' ? empresaIdForApi : undefined,
          clienteId: typeof clienteIdForApi === 'number' ? clienteIdForApi : undefined,
          sucursalId: sid,
          refreshAccessToken,
          logout,
        });

        if (!res.status) {
          setError(res.message || 'Error al cargar bitácoras');
          setBitacoras(fromMain as BitacoraVehiculoDetenidoItem[]);
          setIsLoading(false);
          return;
        }

        const serverItems = Array.isArray(res.data) ? res.data : [];
        const filteredItems = serverItems.filter((b: any) => bitacoraRecordSucursalId(b) === sid);
        const serverList = filteredItems.map((b: any) => ({
          ...b,
          id_local: b.id_local || '',
        }));

        await mergeBitacorasDetenidosForSucursalFromServer({
          sucursalId: sid,
          serverRows: serverList,
        });
        const merged = await readBitacorasForSucursalFromMainStructure(sid);
        setBitacoras(merged as BitacoraVehiculoDetenidoItem[]);
        if (fetchKey) lastBitacoraListFetchKeyRef.current = fetchKey;
      } catch (e: any) {
        setError(e.message || 'Error al cargar bitácoras');
        try {
          const snap2 = await syncMarcaFromStorage({ applyFiltersFromMarca: false });
          const isOp = snap2?.isOperativo ?? false;
          const cid = isOp
            ? snap2?.marcaCorpoId
            : filterSucursalIdRef.current ?? snap2?.marcaCorpoId;
          if (cid) {
            const rows = await readBitacorasForSucursalFromMainStructure(Number(cid));
            setBitacoras(rows as BitacoraVehiculoDetenidoItem[]);
          } else {
            setBitacoras([]);
          }
        } catch {
          /* ignore */
        }
      } finally {
        setIsLoading(false);
      }
      };

      const promise = run();
      bitacoraListFetchInFlightRef.current = promise;
      try {
        await promise;
      } finally {
        if (bitacoraListFetchInFlightRef.current === promise) {
          bitacoraListFetchInFlightRef.current = null;
        }
      }
    },
    [isPrefillMode, refreshAccessToken, logout, syncMarcaFromStorage]
  );

  const fetchRecords = useCallback(async () => {
    const snap = await syncMarcaFromStorage({ applyFiltersFromMarca: false });
    if (!snap && !isPrefillMode) {
      setBitacoras([]);
      return;
    }
    await runFetchBitacoras(snap, { force: true });
  }, [syncMarcaFromStorage, runFetchBitacoras, isPrefillMode]);

  useEffect(() => {
    filterSucursalIdRef.current = filterSucursalId;
  }, [filterSucursalId]);
  useEffect(() => {
    filterEmpresaIdRef.current = filterEmpresaId;
  }, [filterEmpresaId]);
  useEffect(() => {
    filterClienteIdRef.current = filterClienteId;
  }, [filterClienteId]);

  useEffect(() => {
    if (!isPrefillMode) setPrefillFormHierarchyLocked(false);
  }, [isPrefillMode]);

  /** Sucursal activa para el formulario: marca si OPERATIVO; si no, sucursal elegida en el formulario. */
  const resolveFormCorpoId = useCallback((): number | null => {
    if (roleName === 'OPERATIVO') return marcaCorpoId;
    return formSucursalId;
  }, [roleName, marcaCorpoId, formSucursalId]);

  /** Sincroniza empresa/cliente/sucursal del payload según rol y selects del formulario. */
  const syncMarcaIdsFromFormOrMarca = useCallback(async () => {
    if (roleName === 'OPERATIVO') {
      const currentMarcaStr = await AsyncStorage.getItem('current_marca');
      if (currentMarcaStr) {
        const current = JSON.parse(currentMarcaStr);
        setMarcaEmpresaId(numOrNull(current?.empresa?.id ?? current?.empresa_id));
        setMarcaClienteId(numOrNull(current?.cliente?.id ?? current?.cliente_id));
        setMarcaCorpoId(numOrNull(current?.corpo?.id ?? current?.corpo_id));
      }
      return;
    }
    setMarcaEmpresaId(formEmpresaId);
    setMarcaClienteId(formClienteId);
    setMarcaCorpoId(formSucursalId);
  }, [roleName, formEmpresaId, formClienteId, formSucursalId]);

  /** Nombres para campos readonly (empresa/cliente/sucursal) según árbol o marca. */
  const resolveHierarchyDisplayNames = useCallback(async () => {
    if (roleName === 'OPERATIVO') {
      const currentMarcaStr = await AsyncStorage.getItem('current_marca');
      const current = currentMarcaStr ? JSON.parse(currentMarcaStr) : null;
      return {
        empresa: current?.empresa?.nombre ?? empresaNombre,
        cliente: current?.cliente?.nombre ?? clienteNombre,
        corpo: current?.corpo?.nombre ?? corpoNombre,
      };
    }
    const fe = structure.find((e) => e.id === formEmpresaId);
    const fc = fe?.clientes?.find((c: any) => c.id === formClienteId);
    const fd = fc?.division?.find((d: any) => d.id === formDivisionId);
    const fct = fd?.contratos?.find((c: any) => c.id === formContratoId);
    const fs = fct?.sucursales?.find((s: any) => s.id === formSucursalId);
    return {
      empresa: fe?.nombre ?? '',
      cliente: fc?.nombre ?? '',
      corpo: fs?.nombre ?? '',
    };
  }, [roleName, structure, formEmpresaId, formClienteId, formDivisionId, formContratoId, formSucursalId, empresaNombre, clienteNombre, corpoNombre]);

  const resetAllFilters = () => {
    setFilterTipo('all');
    setFilterFecha('');
    setFilterSearch('');
    void (async () => {
      await resetListFiltersFromCurrentMarca();
      await fetchRecords();
    })();
  };

  const filteredBitacoras = useMemo(() => {
    const q = filterSearch.trim().toLowerCase();
    return bitacoras.filter((b) => {
      if (b.isActive === false) return false;
      if (filterTipo !== 'all' && String(b.tipo) !== String(filterTipo)) return false;
      if (filterFecha) {
        const d = b.created_at ? String(b.created_at).split('T')[0] : '';
        if (d !== filterFecha) return false;
      }
      if (!q) return true;

      const infoArr = safeParse<any[]>(b.informacion_general, []);
      const map: Record<string, any> = {};
      for (const f of infoArr) map[String(f.key)] = f.value;
      const placa = String(map.numero_placa ?? map.numero_de_placa ?? '');
      const marcaStr = String(map.marca ?? '');
      const oficialStr = String(
        map.oficial_transito ??
        map.nombre_oficial_transito ??
        map.oficial_seguridad ??
        map.nombre_oficial_corporacion ??
        ''
      );

      const haystack = `${b.tipo ?? ''} ${placa} ${marcaStr} ${oficialStr}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [bitacoras, filterTipo, filterFecha, filterSearch]);

  const [expandedBitacoras, setExpandedBitacoras] = useState<Set<string>>(new Set());

  useEffect(() => {
    serverRevisionImageUrlCacheRef.current.clear();
  }, [accessToken]);

  const getBitacoraServerImageUrl = useCallback(
    (bitacoraId: number, fileName: string) => {
      const cacheKey = `${bitacoraId}:${fileName}`;
      const cached = serverRevisionImageUrlCacheRef.current.get(cacheKey);
      if (cached) return cached;
      const url = appendTokenToUrl(
        `${Constants.expoConfig?.extra?.API_SERVER}/api/bitacora-vehiculo-detenido/${bitacoraId}/get-image/${encodeURIComponent(fileName)}`
      );
      serverRevisionImageUrlCacheRef.current.set(cacheKey, url);
      return url;
    },
    [appendTokenToUrl]
  );

  const resolveFormRevisionImageUri = useCallback(
    (raw: string, bitacoraId = 0, hasIdLocal = false) =>
      resolveBitacoraRevImageDisplayUri(raw, {
        bitacoraId,
        hasIdLocal,
        getServerImageUrl: (name) => getBitacoraServerImageUrl(bitacoraId, name),
      }),
    [getBitacoraServerImageUrl]
  );

  const appendRevisionImage = (revisionKey: string, ref: string) => {
    setRevisionImages((prev) => {
      const list = Array.isArray(prev[revisionKey]) ? prev[revisionKey].slice() : [];
      list.push(ref);
      return { ...prev, [revisionKey]: list };
    });
  };

  const removeRevisionImageFromForm = async (revisionKey: string, index: number) => {
    const list = revisionImages[revisionKey] || [];
    const target = list[index];
    if (!target) return;
    Alert.alert('Confirmar', '¿Eliminar esta foto?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          const localName = bitacoraRevParseLocalImageRef(target);
          if (localName) {
            try {
              await deleteFile(localName);
            } catch {
              /* idempotente */
            }
          }

          setRevisionImages((prev) => {
            const curr = Array.isArray(prev[revisionKey]) ? prev[revisionKey].slice() : [];
            curr.splice(index, 1);
            const next = { ...prev };
            if (curr.length === 0) delete next[revisionKey];
            else next[revisionKey] = curr;
            return next;
          });
        },
      },
    ]);
  };

  const openCameraForRevision = async (revisionKey: string) => {
    if (!permission) {
      const perm = await requestPermission();
      if (!perm.granted) {
        Alert.alert('Permiso', 'Se necesita permiso para acceder a la cámara');
        return;
      }
    } else if (!permission.granted) {
      const perm = await requestPermission();
      if (!perm.granted) {
        Alert.alert('Permiso', 'Se necesita permiso para acceder a la cámara');
        return;
      }
    }
    setCurrentRevisionKey(revisionKey);
    setCameraVisible(true);
  };

  const takePictureForRevision = async () => {
    if (!cameraRef.current || !currentRevisionKey) {
      setCameraVisible(false);
      return;
    }
    try {
      const photo: any = await cameraRef.current.takePictureAsync({
        quality: Platform.OS === 'android' ? 0.5 : 0.6,
        skipProcessing: true,
      });
      setCameraVisible(false);
      if (!photo?.uri) {
        Alert.alert('Error', 'No se pudo capturar la imagen');
        return;
      }
      const fileName = await saveCameraPhotoToBitacoraRevFile(photo.uri);
      appendRevisionImage(currentRevisionKey, bitacoraRevMakeLocalImageRef(fileName));
    } catch (error) {
      console.error('Error capturing revision image:', error);
      setCameraVisible(false);
      Alert.alert('Error', 'No se pudo capturar la imagen');
    }
  };

  const upsertBitacoraRevisionInCache = async (
    row: BitacoraVehiculoDetenidoItem,
    nextRevision: BitacoraRevisionEntry[]
  ) => {
    const sid = numOrNull(row.sucursal_id ?? (row as any).corpo_id) ?? 0;
    const updated = { ...row, informacion_revision: nextRevision };
    if (sid > 0) {
      await upsertBitacoraDetenidoRowInMainStructure(updated, sid, row.id_local || null);
    }
    setBitacoras((prev) =>
      prev.map((x) => {
        const same =
          (row.id_local && x.id_local === row.id_local) ||
          (row.id > 0 && x.id === row.id);
        return same ? updated : x;
      })
    );
  };

  const updateOfflineBitacoraQueueRevision = async (
    localKey: string,
    nextRevision: BitacoraRevisionEntry[]
  ) => {
    const actionsStr = await AsyncStorage.getItem('evaluations_actions');
    const actions = actionsStr ? JSON.parse(actionsStr) : [];
    const idx = actions.findIndex(
      (a: any) =>
        a.action === 'create' &&
        a.type === BITACORA_VEHICULO_DETENIDO_EVAL_TYPE &&
        String(a.id) === String(localKey)
    );
    if (idx === -1) return;
    actions[idx] = {
      ...actions[idx],
      payload: { ...(actions[idx].payload || {}), informacion_revision: nextRevision },
    };
    await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));
  };

  const removeImageFromBitacoraRecord = async (
    record: BitacoraVehiculoDetenidoItem,
    revisionKey: string,
    imageRef: string
  ) => {
    Alert.alert('Confirmar', '¿Eliminar esta foto?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          const infoR = safeParse<BitacoraRevisionEntry[]>(record.informacion_revision, []);
          const nextRevision = removeImageFromRevisionArray(infoR, revisionKey, imageRef);
          const localName = bitacoraRevParseLocalImageRef(imageRef);
          const serverImageName =
            !localName && typeof imageRef === 'string' && imageRef.trim() && !imageRef.startsWith('data:')
              ? imageRef.trim()
              : null;
          const bitacoraId = Number(record.id || 0);
          const isServerImage = bitacoraId > 0 && !!serverImageName;

          if (isServerImage) {
            const isConnected = await getConnectionStatus();
            if (isConnected) {
              const res = await deleteBitacoraRevisionImage({
                id: bitacoraId,
                imageName: serverImageName!,
                revisionKey,
                refreshAccessToken,
                logout,
              });
              if (!res.status) {
                Alert.alert('Error', res.message || 'No se pudo eliminar la imagen');
                return;
              }
              const fromServer = res.data?.informacion_revision;
              await upsertBitacoraRevisionInCache(
                record,
                Array.isArray(fromServer) ? fromServer : nextRevision
              );
            } else {
              const actionsStr = await AsyncStorage.getItem('evaluations_actions');
              const actions = actionsStr ? JSON.parse(actionsStr) : [];
              actions.push({
                id: bitacoraId,
                action: 'delete_image',
                type: BITACORA_VEHICULO_DETENIDO_EVAL_TYPE,
                payload: {
                  revisionKey,
                  imageName: serverImageName,
                  sucursal_id: record.sucursal_id,
                  informacion_revision: nextRevision,
                },
              });
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));
              await upsertBitacoraRevisionInCache(record, nextRevision);
            }
          } else {
            if (localName) {
              try {
                await deleteFile(localName);
              } catch {
                /* noop */
              }
            }
            await upsertBitacoraRevisionInCache(record, nextRevision);
            if (record.id_local) {
              await updateOfflineBitacoraQueueRevision(record.id_local, nextRevision);
            }
          }
        },
      },
    ]);
  };

  const prepareBitacoraRequestForApi = (requestData: any) => {
    const revArr = Array.isArray(requestData.informacion_revision)
      ? (requestData.informacion_revision as BitacoraRevisionEntry[])
      : [];
    const { informacion_revision, fileSlots } = buildBitacoraRevisionForSubmit(revArr);
    const { informacion_revision: _arr, ...rest } = requestData;
    return {
      ...rest,
      informacion_revision,
      ...(fileSlots.length > 0 ? { _bitacoraRevFileSlots: fileSlots } : {}),
    };
  };

  const renderRevisionPhotoSection = (revisionKey: string) => {
    const imgs = revisionImages[revisionKey] || [];
    const editingId = Number(editing?.id || 0);
    const hasIdLocal = !!(editing?.id_local && String(editing.id_local).length > 0);
    const cameraLabel = isEditingBitacoraRecord
      ? imgs.length > 0
        ? 'Agregar otra foto nueva'
        : 'Agregar foto nueva (opcional)'
      : imgs.length > 0
        ? 'Agregar otra imagen'
        : 'Tomar imagen (opcional)';
    return (
      <ThemedView style={styles.revisionPhotoSection}>
        <TouchableOpacity
          style={styles.cameraSmallButton}
          onPress={() => openCameraForRevision(revisionKey)}
        >
          <Ionicons name="camera" size={18} color="#007AFF" />
          <ThemedText style={styles.cameraSmallButtonText}>{cameraLabel}</ThemedText>
        </TouchableOpacity>
        {imgs.length > 0 ? (
          <ThemedView style={styles.revisionImagesRow}>
            {imgs.map((uri, idx) => (
              <BitacoraRevisionThumbnail
                key={`${revisionKey}-form-img-${idx}-${uri}`}
                uri={resolveFormRevisionImageUri(uri, editingId, hasIdLocal)}
                variant="form"
                onDelete={() => removeRevisionImageFromForm(revisionKey, idx)}
              />
            ))}
          </ThemedView>
        ) : null}
      </ThemedView>
    );
  };

  const toggleBitacoraExpanded = (key: string) => {
    setExpandedBitacoras((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const renderBitacoraItem = (b: BitacoraVehiculoDetenidoItem, index: number) => {
    const rowKey = getBitacoraRowKey(b);
    const isDeletingThis = deletingBitacoraKey === rowKey;
    const key =
      b.id !== 0
        ? `bit-${b.id}`
        : b.id_local
          ? `bit-${b.id_local}`
          : `bit-${index}`;
    const isExpanded = expandedBitacoras.has(key);
    const infoArr = safeParse<any[]>(b.informacion_general, []);
    const infoRevArr = safeParse<BitacoraRevisionEntry[]>(b.informacion_revision, []);
    const map: Record<string, any> = {};
    for (const f of infoArr) map[String(f.key)] = f.value;
    const placa = String(map.numero_placa ?? map.numero_de_placa ?? '');
    const marcaStr = String(map.marca ?? '');
    const colorStr = String(map.color ?? '');
    const fecha = formatDateDMY(b.created_at, '');
    const firmaInfo = decodeFirmaHash(b.firma_responsable);
    const hasIdLocal = !!(b.id_local && String(b.id_local).length > 0);
    const bitacoraIdForImages = Number(b.id || 0);

    const generalDetails = infoArr.filter(
      (f) => f && f.label && f.value != null && String(f.value).trim() !== '' && String(f.kind || '') !== 'signature'
    );
    const revisionDetails = infoRevArr.filter((f) => f && f.kind !== 'heading');

    return (
      <ThemedView key={key} style={styles.bitacoraCard}>
        <ThemedText style={styles.bitTitle}>{b.tipo} {b.id_local ? ' (offline)' : ''}</ThemedText> 

        {placa ? (
          <ThemedText style={styles.bitLine}>
            <ThemedText style={styles.bitLabel}>Placa: </ThemedText>
            <ThemedText style={styles.bitValue}>{placa}</ThemedText>
          </ThemedText>
        ) : null}

        {(marcaStr || colorStr) ? (
          <ThemedText style={styles.bitLine}>
            <ThemedText style={styles.bitLabel}>Vehículo: </ThemedText>
            <ThemedText style={styles.bitValue}>
              {[marcaStr, colorStr].filter(Boolean).join(' - ') || '-'}
            </ThemedText>
          </ThemedText>
        ) : null}

        <TouchableOpacity style={styles.collapseButton} onPress={() => toggleBitacoraExpanded(key)}>
          <ThemedText style={styles.collapseButtonText}>
            {isExpanded ? 'Ocultar detalles' : 'Ver detalles'}
          </ThemedText>
          <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color="#007AFF" />
        </TouchableOpacity>

        {isExpanded && (
          <ThemedView style={styles.collapsableContent}>
            <ThemedText style={styles.subSectionTitle}>Información general</ThemedText>
            {generalDetails.length === 0 ? (
              <ThemedText style={styles.emptyText}>No hay información general</ThemedText>
            ) : (
              generalDetails.map((f: any, i: number) => (
                <ThemedText key={`${key}-g-${i}`} style={styles.bitLine}>
                  <ThemedText style={styles.bitLabel}>{String(f.label)}: </ThemedText>
                  <ThemedText style={styles.bitValue}>{String(f.value)}</ThemedText>
                </ThemedText>
              ))
            )}

            <ThemedText style={[styles.subSectionTitle, { marginTop: 12 }]}>Información de revisión</ThemedText>
            {revisionDetails.length === 0 ? (
              <ThemedText style={styles.emptyText}>No hay información de revisión</ThemedText>
            ) : (
              revisionDetails.map((f, i) => {
                const imgs = Array.isArray(f.images) ? f.images : [];
                return (
                  <ThemedView key={`${key}-r-${i}`} style={styles.revisionDetailBlock}>
                    <ThemedText style={styles.bitLine}>
                      <ThemedText style={styles.bitLabel}>{String(f.label || f.key)}: </ThemedText>
                      <ThemedText style={styles.bitValue}>{String(f.value ?? '-')}</ThemedText>
                    </ThemedText>
                    {f.observation ? (
                      <ThemedText style={styles.bitLine}>
                        <ThemedText style={styles.bitLabel}>Obs.: </ThemedText>
                        <ThemedText style={styles.bitValue}>{String(f.observation)}</ThemedText>
                      </ThemedText>
                    ) : null}
                    {imgs.length > 0 ? (
                      <ThemedView style={styles.revisionImagesRow}>
                        {imgs.map((imgRef, imgIdx) => {
                          const uri = resolveFormRevisionImageUri(
                            String(imgRef),
                            bitacoraIdForImages,
                            hasIdLocal
                          );
                          return (
                            <BitacoraRevisionThumbnail
                              key={`${key}-ri-${i}-${imgIdx}-${String(imgRef)}`}
                              uri={uri}
                              variant="list"
                              onDelete={() =>
                                removeImageFromBitacoraRecord(b, String(f.key), String(imgRef))
                              }
                            />
                          );
                        })}
                      </ThemedView>
                    ) : null}
                  </ThemedView>
                );
              })
            )}

            {/* Firma responsable */}
            <ThemedView style={[styles.firmaInfoBox, { marginTop: 10 }]}>
              <ThemedView style={{ flex: 1, paddingRight: 10 }}>
                <ThemedText style={styles.firmaInfoTitle}>Firma responsable:</ThemedText>
                {!b.firma_responsable ? (
                  <ThemedText style={styles.firmaInfoValue}>Aún no registrada</ThemedText>
                ) : !firmaInfo ? (
                  <>
                    <ThemedText style={styles.firmaInfoValue}>Formato no decodificable</ThemedText>
                    <ThemedText style={styles.firmaInfoValue}>
                      Valor: {String(b.firma_responsable).slice(0, 32)}
                      {String(b.firma_responsable).length > 32 ? '…' : ''}
                    </ThemedText>
                  </>
                ) : (
                  <>
                    <ThemedText style={styles.firmaInfoValue}>Sesión: {firmaInfo.sessionId || 'N/A'}</ThemedText>
                    <ThemedText style={styles.firmaInfoValue}>Empleado: {firmaInfo.empleadoId || 'N/A'}</ThemedText>
                    <ThemedText style={styles.firmaInfoValue}>Lat: {firmaInfo.latitud || 'N/A'} | Long: {firmaInfo.longitud || 'N/A'}</ThemedText>
                    <ThemedText style={styles.firmaInfoValue}>Hora: {firmaInfo.timestamp || 'N/A'}</ThemedText>
                  </>
                )}
              </ThemedView>
            </ThemedView>
          </ThemedView>
        )}

        <ThemedView style={styles.listItemButtons}>
          <TouchableOpacity
            style={[styles.listItemButton, styles.editButton]}
            onPress={() => startEditing(b)}
          >
            <Ionicons name="pencil" size={18} color="#FFFFFF" />
            <ThemedText style={styles.listItemButtonText}>Editar</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.listItemButton, styles.changesButton]}
            onPress={() => {
              if (b.id_local || b.id === 0) {
                Alert.alert('Sin conexión', 'Este registro es local/offline. Los cambios solo se pueden consultar en el servidor.');
                return;
              }
              setCambiosTitle(`Cambios - Bitácora #${b.id}`);
              fetchCambios('c_bitacora_vehiculo_detenido', b.id);
            }}
          >
            <Ionicons name="list-outline" size={18} color="#FFFFFF" />
            <ThemedText style={styles.listItemButtonText}>Cambios</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.listItemButton, styles.deleteButton, isDeletingThis && styles.buttonDisabled]}
            onPress={() => handleDelete(b)}
            disabled={isDeletingThis}
          >
            {isDeletingThis ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="trash" size={18} color="#FFFFFF" />
                <ThemedText style={styles.listItemButtonText}>Eliminar</ThemedText>
              </>
            )}
          </TouchableOpacity>
        </ThemedView>
      </ThemedView>
    );
  };

  const getConnectionStatus = async (): Promise<boolean> => {
    //return false;
    const state = await Network.getNetworkStateAsync();
    return !!(state.isConnected && state.isInternetReachable);
  };

  const closeCambiosModal = () => {
    setIsCambiosModalVisible(false);
    setCambiosItems([]);
    setExpandedCambioId(null);
  };

  const formatCambioCreatedAt = (value: any) => {
    if (!value) return '';
    try {
      const d = new Date(String(value));
      if (isNaN(d.getTime())) return String(value);
      const day = d.getDate().toString().padStart(2, '0');
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const year = d.getFullYear();
      const hours = d.getHours().toString().padStart(2, '0');
      const minutes = d.getMinutes().toString().padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch {
      return String(value);
    }
  };

  const formatInformacionGeneralForDisplay = (infoGeneral: any): string => {
    if (!infoGeneral) return '';
    try {
      const info = typeof infoGeneral === 'string' ? JSON.parse(infoGeneral) : infoGeneral;
      if (!Array.isArray(info)) return String(infoGeneral);

      const partes: string[] = [];
      for (const item of info) {
        if (item && typeof item === 'object' && item.key && item.label) {
          // Excluir firmas (kind === 'signature')
          if (item.kind !== 'signature' && item.value) {
            partes.push(`${item.label}: ${item.value}`);
          }
        }
      }
      return partes.length > 0 ? partes.join(' | ') : 'Sin información';
    } catch {
      return String(infoGeneral);
    }
  };

  const formatInformacionRevisionForDisplay = (infoRevision: any): string => {
    if (!infoRevision) return '';
    try {
      const info = typeof infoRevision === 'string' ? JSON.parse(infoRevision) : infoRevision;
      if (!Array.isArray(info)) return String(infoRevision);

      const partes: string[] = [];
      for (const item of info) {
        if (item && typeof item === 'object') {
          if (item.kind === 'heading') {
            partes.push(`[${item.label}]`);
          } else if (item.key && item.label) {
            const value = item.value || '';
            const obs = item.observation ? ` (Obs: ${item.observation})` : '';
            partes.push(`${item.label}: ${value}${obs}`);
          }
        }
      }
      return partes.length > 0 ? partes.join(' | ') : 'Sin información';
    } catch {
      return String(infoRevision);
    }
  };

  const formatMovimientosForDisplay = (movimientos: any): string => {
    if (!movimientos) return '';
    try {
      const movs = typeof movimientos === 'string' ? JSON.parse(movimientos) : movimientos;
      if (!Array.isArray(movs)) return String(movimientos);

      const partes: string[] = [];
      for (const mov of movs) {
        if (mov && typeof mov === 'object') {
          const movParts: string[] = [];
          if (mov.movimiento) movParts.push(`Mov: ${mov.movimiento}`);
          if (mov.fecha) movParts.push(`Fecha: ${mov.fecha}`);
          if (mov.hora) movParts.push(`Hora: ${mov.hora}`);
          if (mov.realizado_por) movParts.push(`Por: ${mov.realizado_por}`);
          if (mov.autorizado_por) movParts.push(`Autorizado: ${mov.autorizado_por}`);
          if (movParts.length > 0) {
            partes.push(`{${movParts.join(', ')}}`);
          }
        }
      }
      return partes.length > 0 ? partes.join(' | ') : 'Sin movimientos';
    } catch {
      return String(movimientos);
    }
  };

  const formatChangeValue = (prop: string, value: any): string => {
    if (prop === 'informacion_general') {
      return formatInformacionGeneralForDisplay(value);
    }
    if (prop === 'informacion_revision') {
      return formatInformacionRevisionForDisplay(value);
    }
    if (prop === 'movimientos_vehiculos') {
      return formatMovimientosForDisplay(value);
    }
    if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
      try {
        if (Array.isArray(value)) {
          return JSON.stringify(value, null, 2);
        }
        const keys = Object.keys(value);
        if (keys.length > 0 && keys.length <= 5) {
          return keys.map(k => `${k}: ${value[k]}`).join(', ');
        }
        return JSON.stringify(value, null, 2);
      } catch {
        return String(value);
      }
    }
    return String(value ?? '');
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

  const loadMarcaContext = useCallback(async () => {
    const currentMarcaStr = await AsyncStorage.getItem('current_marca');
    if (!currentMarcaStr) {
      setHasCurrentMarca(false);
      setMarcaEmpresaId(null);
      setMarcaClienteId(null);
      setMarcaCorpoId(null);
      setMarcaDivisionId(null);
      setRoleName(null);
      return null;
    }
    const current = JSON.parse(currentMarcaStr);
    if (!current?.id) {
      setHasCurrentMarca(false);
      setMarcaEmpresaId(null);
      setMarcaClienteId(null);
      setMarcaCorpoId(null);
      setMarcaDivisionId(null);
      setRoleName(null);
      return null;
    }
    setHasCurrentMarca(true);
    setMarcaId(current.id);
    setEmpresaNombre(current?.empresa?.nombre ?? '');
    setClienteNombre(current?.cliente?.nombre ?? '');
    setCorpoNombre(current?.corpo?.nombre ?? '');

    const empresaIdRaw = current?.empresa?.id ?? current?.empresa_id;
    const clienteIdRaw = current?.cliente?.id ?? current?.cliente_id;
    const corpoIdRaw = current?.corpo?.id ?? current?.corpo_id;
    const divIdRaw = current?.roleDivision?.division?.id ?? current?.division_id;
    const role =
      current?.roleDivision?.role?.nombre ?? current?.role_division?.role?.nombre ?? null;
    setRoleName(typeof role === 'string' ? (role as RoleName) : null);
    setMarcaDivisionId(divIdRaw !== undefined && divIdRaw !== null ? Number(divIdRaw) : null);

    setMarcaEmpresaId(empresaIdRaw !== undefined && empresaIdRaw !== null ? Number(empresaIdRaw) : null);
    setMarcaClienteId(clienteIdRaw !== undefined && clienteIdRaw !== null ? Number(clienteIdRaw) : null);
    setMarcaCorpoId(corpoIdRaw !== undefined && corpoIdRaw !== null ? Number(corpoIdRaw) : null);

    return current;
  }, []);

  /** Vehículos y usos desde el árbol principal (fragmentos / caché legada), sucursal / corpo. */
  const fetchCorporateVehicles = useCallback(async (corpoId: number) => {
    try {
      setIsLoadingVehicles(true);
      const fromMain = await readCorporateVehiclesForSucursalFromMainStructure(Number(corpoId));
      let list = Array.isArray(fromMain) ? fromMain.map(normalizeVehiculoNodeFromTree) : [];
      if (list.length === 0) {
        const tree = await loadMainStructureTreeMerged();
        list = getVehiculosCorporativosFromTree(Array.isArray(tree) ? tree : [], corpoId);
      }
      setCorporateVehicles(list);
    } catch (e: any) {
      console.error('Error loading corporate vehicles from main structure:', e);
      setCorporateVehicles([]);
    } finally {
      setIsLoadingVehicles(false);
    }
  }, []);

  const getCorporateVehiclesForCorpo = useCallback(async (corpoId: number) => {
    try {
      const fromMain = await readCorporateVehiclesForSucursalFromMainStructure(Number(corpoId));
      if (Array.isArray(fromMain) && fromMain.length > 0) {
        return fromMain.map(normalizeVehiculoNodeFromTree);
      }
      const tree = await loadMainStructureTreeMerged();
      if (!Array.isArray(tree) || tree.length === 0) return [];
      return getVehiculosCorporativosFromTree(tree, corpoId);
    } catch {
      return [];
    }
  }, []);

  const fetchCorporateVehicleUses = useCallback(
    async (vehiculoId: number, attempt = 0): Promise<any[] | null> => {
      try {
        const isConnected = await getConnectionStatus();
        if (!isConnected) return null;
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) return null;

        const response = await authedFetch({
          url: `${apiUrl}/api/corporate-vehicles/${vehiculoId}/uses`,
          init: {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          },
          refreshAccessToken,
          logout,
        });
        if (!response) return null;
        if (!response.ok) return null;
        const data = await response.json().catch(() => ({}));
        if (data?.status && Array.isArray(data?.data)) return data.data;
        return null;
      } catch (e) {
        console.error('Error fetching vehicle uses:', e);
        return null;
      }
    },
    [refreshAccessToken, logout]
  );

  const preloadVehiculoYUso = useCallback(
    async (params: {
      corpoId: number | null;
      vehiculoId: number | null;
      usoId: number | null;
      vehiculoIdLocal?: string | null;
      usoIdLocal?: string | null;
      vehicleMeta?: { placa?: string; tipo?: string; empresa_id?: number; cliente_id?: number; sucursal_id?: number; corpo_id?: number };
    }) => {
      const { corpoId, vehiculoId, usoId, vehiculoIdLocal, usoIdLocal, vehicleMeta } = params;
      isPreloadingVehiculoUsoRef.current = true;
      try {
        if (corpoId) {
          await fetchCorporateVehicles(Number(corpoId));
        }
        const list = corpoId ? await getCorporateVehiclesForCorpo(Number(corpoId)) : [];

        const applyVehicleFields = (vehiculo: any) => {
          setVehKilometraje(String(vehiculo?.kilometraje ?? ''));
          setVehProxCambioAceite(String(vehiculo?.prox_cambio_aceite ?? ''));
          setVehModelo(String(vehiculo?.modelo ?? ''));
          setVehAnno(String(vehiculo?.anno ?? ''));
          if (vehiculo?.marca != null && String(vehiculo.marca).trim() !== '') {
            setGeneralValues((prev) => ({ ...prev, marca: String(vehiculo.marca) }));
          }
          setVehTipoAutoria(String(vehiculo?.tipo_autoria ?? ''));
          setVehTituloPropiedad(vehiculo?.titulo_propiedad ?? false);
          setVehRTV(vehiculo?.rtv ?? false);
          setVehMarchamo(vehiculo?.marchamo ?? false);
        };

        if (vehiculoId && Number(vehiculoId) > 0) {
          setSelectedCorporateVehicleId(Number(vehiculoId));
          setSelectedCorporateVehicleIdLocal(null);

          const vehiculo = list.find((v: any) => Number(v.id) === Number(vehiculoId));

          if (vehiculo) {
            applyVehicleFields(vehiculo);
          }

          const usos = await fetchCorporateVehicleUses(Number(vehiculoId));
          if (Array.isArray(usos)) {
            setTempVehicle((prev: any) => ({
              ...(prev && Number(prev?.id) === Number(vehiculoId) ? prev : {}),
              ...(vehicleMeta || {}),
              id: Number(vehiculoId),
              usos,
              c_usos_vehiculos_corporativos: usos,
            }));
          } else {
            const v2 = vehiculo ?? list.find((v: any) => Number(v.id) === Number(vehiculoId));
            const embedded = v2?.usos || v2?.c_usos_vehiculos_corporativos || [];
            const usosEmb = Array.isArray(embedded) ? embedded : [];
            if (v2 && usosEmb.length) {
              setTempVehicle({
                ...v2,
                ...(vehicleMeta || {}),
                id: Number(vehiculoId),
                usos: usosEmb,
                c_usos_vehiculos_corporativos: usosEmb,
              });
            }
          }
        }

        // Vehículo/uso solo con claves locales (aún no sincronizados) — usos vienen del caché corporativo
        if (!(vehiculoId && Number(vehiculoId) > 0) && vehiculoIdLocal) {
          const vehiculo = list.find((v: any) => String(v.id ?? v.id_local) === vehiculoIdLocal);
          if (vehiculo) {
            setSelectedCorporateVehicleIdLocal(vehiculoIdLocal);
            setSelectedCorporateVehicleId(null);
            applyVehicleFields(vehiculo);
            const usosRaw = vehiculo.usos || vehiculo.c_usos_vehiculos_corporativos || [];
            const usosArr = Array.isArray(usosRaw) ? usosRaw : [];
            setTempVehicle({
              ...vehiculo,
              id: vehiculo.id ?? vehiculo.id_local,
              id_local: vehiculo.id_local,
              usos: usosArr,
              c_usos_vehiculos_corporativos: usosArr,
              ...(vehicleMeta || {}),
            });
          }
        }

        if (usoIdLocal) {
          setSelectedCorporateUseId(null);
          setSelectedCorporateUseIdLocal(usoIdLocal);
        } else if (usoId && Number(usoId) > 0) {
          setSelectedCorporateUseId(Number(usoId));
          setSelectedCorporateUseIdLocal(null);
        }
      } finally {
        setTimeout(() => {
          isPreloadingVehiculoUsoRef.current = false;
        }, 0);
      }
    },
    [fetchCorporateVehicles, fetchCorporateVehicleUses, getCorporateVehiclesForCorpo]
  );

  useEffect(() => {
    if (!isCreating || isPrefillMode) {
      loadedVehiclesCorpoRef.current = null;
      return;
    }
    const cid = resolveFormCorpoId();
    if (cid != null && cid > 0) {
      if (loadedVehiclesCorpoRef.current === Number(cid)) return;
      loadedVehiclesCorpoRef.current = Number(cid);
      void fetchCorporateVehicles(cid);
    } else {
      loadedVehiclesCorpoRef.current = null;
      setCorporateVehicles([]);
    }
  }, [
    isCreating,
    isPrefillMode,
    formSucursalId,
    marcaCorpoId,
    roleName,
    fetchCorporateVehicles,
    resolveFormCorpoId,
  ]);

  // Obtener usos disponibles del vehículo seleccionado
  const selectedCorporateVehicle = useMemo(() => {
    const key =
      selectedCorporateVehicleIdLocal ??
      (selectedCorporateVehicleId != null && selectedCorporateVehicleId > 0
        ? String(selectedCorporateVehicleId)
        : '');
    if (!key) return null;
    const found = corporateVehicles.find((v: any) => String(v.id ?? v.id_local) === key);
    if (found) return found;
    if (tempVehicle && String(tempVehicle.id ?? tempVehicle.id_local) === key) return tempVehicle;
    return null;
  }, [
    corporateVehicles,
    selectedCorporateVehicleId,
    selectedCorporateVehicleIdLocal,
    tempVehicle,
  ]);

  // Actualizar usos disponibles cuando cambia el vehículo seleccionado
  useEffect(() => {
    if (!selectedCorporateVehicle) {
      setAvailableCorporateUses([]);
      setSelectedCorporateUseId(null);
      setSelectedCorporateUseIdLocal(null);
      return;
    }
    const usos = (selectedCorporateVehicle as any)?.usos || (selectedCorporateVehicle as any)?.c_usos_vehiculos_corporativos || [];
    const list = Array.isArray(usos) ? usos : [];
    const lockedUsoId = isPrefillMode
      ? prefill?.uso_id && prefill.uso_id > 0
        ? Number(prefill.uso_id)
        : null
      : editing?.uso_id
        ? Number(editing.uso_id)
        : null;
    const lockedUsoLocal =
      isPrefillMode && prefill?.uso_id_local ? String(prefill.uso_id_local) : null;
    // Solo los que NO tienen bitácora asignada, pero mantener el uso "actual" (prefill o edición) aunque tenga bitácora.
    const filtered = list.filter(
      (u: any) =>
        (u?.bitacora_id == null && !(u as any)?.bitacora) ||
        (lockedUsoId != null && Number(u?.id) === Number(lockedUsoId)) ||
        (lockedUsoLocal != null && String(u.id ?? u.id_local) === lockedUsoLocal)
    );
    setAvailableCorporateUses(filtered);
    // Limpiar uso seleccionado si no está en la nueva lista
    if (selectedCorporateUseId != null || selectedCorporateUseIdLocal) {
      const stillAvailable = filtered.some(
        (u: any) =>
          (selectedCorporateUseId != null && Number(u.id) === Number(selectedCorporateUseId)) ||
          (selectedCorporateUseIdLocal != null &&
            String(u.id ?? u.id_local) === String(selectedCorporateUseIdLocal))
      );
      if (!stillAvailable && !isPreloadingVehiculoUsoRef.current) {
        setSelectedCorporateUseId(null);
        setSelectedCorporateUseIdLocal(null);
      }
    }
  }, [
    selectedCorporateVehicle,
    selectedCorporateUseId,
    selectedCorporateUseIdLocal,
    isPrefillMode,
    prefill,
    editing,
  ]);

  // Cargar información del vehículo y uso en modo prefill cuando se actualizan los vehículos
  useEffect(() => {
    if (!isPrefillMode || !prefill) return;

    const vehKey = prefill.vehiculo_id_local
      ? String(prefill.vehiculo_id_local)
      : prefill.vehiculo_id != null && prefill.vehiculo_id > 0
        ? String(prefill.vehiculo_id)
        : null;

    const vehicle =
      (vehKey &&
        corporateVehicles.find((v: any) => String(v.id ?? v.id_local) === vehKey)) ||
      (vehKey && tempVehicle && String(tempVehicle.id ?? tempVehicle.id_local) === vehKey ? tempVehicle : null);

    const usos = (vehicle as any)?.usos || (vehicle as any)?.c_usos_vehiculos_corporativos || [];
    const uso = Array.isArray(usos)
      ? usos.find((u: any) => {
          if (prefill.uso_id_local) return String(u.id ?? u.id_local) === String(prefill.uso_id_local);
          if (prefill.uso_id != null && prefill.uso_id > 0) return Number(u.id) === Number(prefill.uso_id);
          return false;
        })
      : null;
    setPrefillVehicleInfo({ vehiculo: vehicle || undefined, uso: uso || undefined });
  }, [isPrefillMode, prefill, corporateVehicles, tempVehicle]);

  const runFetchBitacorasRef = useRef(runFetchBitacoras);
  runFetchBitacorasRef.current = runFetchBitacoras;
  const fetchMainStructureRef = useRef(fetchMainStructure);
  fetchMainStructureRef.current = fetchMainStructure;
  const loadMarcaContextRef = useRef(loadMarcaContext);
  loadMarcaContextRef.current = loadMarcaContext;
  const syncMarcaFromStorageRef = useRef(syncMarcaFromStorage);
  syncMarcaFromStorageRef.current = syncMarcaFromStorage;
  const isPrefillModeRef = useRef(isPrefillMode);
  isPrefillModeRef.current = isPrefillMode;

  useFocusEffect(
    useCallback(() => {
      const session = ++listFocusSessionRef.current;
      let cancelled = false;
      void (async () => {
        const firstLoad = !listFiltersSyncedFromMarcaOnceRef.current;
        const snap = await syncMarcaFromStorageRef.current({ applyFiltersFromMarca: firstLoad });
        if (cancelled || session !== listFocusSessionRef.current) return;
        listFiltersSyncedFromMarcaOnceRef.current = true;
        await Promise.all([fetchMainStructureRef.current(), loadMarcaContextRef.current()]);
        if (cancelled || session !== listFocusSessionRef.current) return;
        if (!snap) {
          if (!isPrefillModeRef.current) setBitacoras([]);
          return;
        }
        const selectedSucursal = filterSucursalIdRef.current ?? snap.marcaCorpoId;
        const shouldFetchList =
          snap.isOperativo || (selectedSucursal != null && Number(selectedSucursal) > 0);
        if (shouldFetchList) {
          await runFetchBitacorasRef.current(snap);
        } else {
          setBitacoras([]);
        }
      })();
      const handler = () => {
        void (async () => {
          const snap = await syncMarcaFromStorageRef.current({ applyFiltersFromMarca: false });
          if (!snap) return;
          const selectedSucursal = filterSucursalIdRef.current ?? snap.marcaCorpoId;
          const shouldFetchList =
            snap.isOperativo || (selectedSucursal != null && Number(selectedSucursal) > 0);
          if (shouldFetchList) await runFetchBitacorasRef.current(snap, { force: true });
        })();
      };
      eventBus.on('connectionRestored', handler);
      return () => {
        cancelled = true;
        eventBus.off('connectionRestored', handler);
      };
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      (async () => {
        if (!prefill) return;
        // Abre el formulario en modo creación con datos precargados
        setIsCreating(true);
        setEditing(null);
        setTempVehicle(null);
        setPrefillFormHierarchyLocked(false);

        await fetchMainStructure();

        const rawM = await AsyncStorage.getItem('current_marca');
        const marca = rawM ? JSON.parse(rawM) : null;
        const rn =
          marca?.roleDivision?.role?.nombre ?? marca?.role_division?.role?.nombre ?? null;

        let corpoId = prefill.sucursal_id ? Number(prefill.sucursal_id) : null;
        if (corpoId == null || !Number.isFinite(corpoId) || corpoId <= 0) {
          corpoId = numOrNull(marca?.corpo?.id ?? marca?.corpo_id);
        }

        // Simplificado como CorporateVehicles: precarga jerárquica desde datos directos (prefill/marca),
        // sin recorrer árbol por corpo en esta fase.
        if (rn !== 'OPERATIVO') {
          const empresaId = numOrNull(prefill.empresa_id) ?? numOrNull(marca?.empresa?.id ?? marca?.empresa_id);
          const clienteId = numOrNull(prefill.cliente_id) ?? numOrNull(marca?.cliente?.id ?? marca?.cliente_id);
          const divisionId = numOrNull(prefill.division_id) ?? getDivisionIdFromMarcaJson(marca);
          const contratoId = numOrNull(prefill.contrato_id) ?? numOrNull(marca?.contrato?.id ?? marca?.contrato_id);
          const sucursalId = numOrNull(prefill.sucursal_id) ?? numOrNull(marca?.corpo?.id ?? marca?.corpo_id);
          const puestoId =
            numOrNull((prefill as any).puesto_id) ?? numOrNull(marca?.puesto?.id ?? marca?.puesto_id);

          setFormEmpresaId(empresaId);
          setFormClienteId(clienteId);
          setFormDivisionId(divisionId);
          setFormContratoId(contratoId);
          setFormSucursalId(sucursalId);
          setFormPuestoId(puestoId);
          setPrefillFormHierarchyLocked(true);
        }

        // Obtener datos del vehículo pasado como parámetro
        if (prefill.empresa_id) setMarcaEmpresaId(Number(prefill.empresa_id));
        if (prefill.cliente_id) setMarcaClienteId(Number(prefill.cliente_id));
        if (prefill.sucursal_id) setMarcaCorpoId(Number(prefill.sucursal_id));
        else if (corpoId != null && corpoId > 0) setMarcaCorpoId(corpoId);

        const tipoCandidate = String(prefill.vehiculo_tipo || '').trim() as TipoBitacora;
        const tipoNext: TipoBitacora = TYPE_OPTIONS.includes(tipoCandidate) ? tipoCandidate : 'Vehículo';
        tipoRef.current = tipoNext;
        setTipo(tipoNext);

        // Inicializa defaults del formulario y luego fuerza placa/tipo
        await resetForm(tipoNext);
        if (prefill.vehiculo_placa) {
          setGeneralValues((prev) => ({
            ...prev,
            numero_placa: String(prefill.vehiculo_placa),
            numero_de_placa: String(prefill.vehiculo_placa),
          }));
        }

        // Secuencia requerida: cargar vehículos -> seleccionar vehículo -> cargar usos -> seleccionar uso
        const vehiculoId =
          prefill.vehiculo_id != null && prefill.vehiculo_id > 0 ? Number(prefill.vehiculo_id) : null;
        const usoId = prefill.uso_id != null && prefill.uso_id > 0 ? Number(prefill.uso_id) : null;
        const vehiculoIdLocal = prefill.vehiculo_id_local ? String(prefill.vehiculo_id_local) : null;
        const usoIdLocal = prefill.uso_id_local ? String(prefill.uso_id_local) : null;
        await preloadVehiculoYUso({
          corpoId,
          vehiculoId,
          usoId,
          vehiculoIdLocal,
          usoIdLocal,
          vehicleMeta: {
            placa: String(prefill.vehiculo_placa || ''),
            tipo: String(prefill.vehiculo_tipo || ''),
            empresa_id: prefill.empresa_id ? Number(prefill.empresa_id) : undefined,
            cliente_id: prefill.cliente_id ? Number(prefill.cliente_id) : undefined,
            sucursal_id: prefill.sucursal_id ? Number(prefill.sucursal_id) : corpoId ?? undefined,
            corpo_id: prefill.sucursal_id ? Number(prefill.sucursal_id) : corpoId ?? undefined,
          },
        });
      })();
    }, [prefill, preloadVehiculoYUso, fetchMainStructure])
  );


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

  const resetForm = async (tipoNext: TipoBitacora) => {

    const horaAccion = await getHoraAccion();
    if (!horaAccion) {
      Alert.alert('Error', 'No se pudo obtener la hora');
      return;
    }

    await loadMarcaContext();
    await syncMarcaIdsFromFormOrMarca();
    tipoRef.current = tipoNext;
    setTipo(tipoNext);

    const baseGeneral: Record<string, any> = {};
    // empresa/cliente/corpo para display (readonly en config actual)
    const now = new Date(horaAccion);
    const names = await resolveHierarchyDisplayNames();
    baseGeneral.empresa = names.empresa;
    baseGeneral.cliente = names.cliente;
    baseGeneral.corpo = names.corpo;
    baseGeneral.fecha = dateToLocalString(now);
    baseGeneral.hora = timeToHHmm(now);
    setGeneralValues(baseGeneral);

    const baseRev: Record<string, any> = {};
    const baseObs: Record<string, string> = {};
    for (const r of buildRevisionConfig(tipoNext)) {
      if (r.kind === 'select') baseRev[r.key] = 'Bueno';
      if (r.kind === 'radio') baseRev[r.key] = '';
      if (r.kind === 'select' && r.withObservation) baseObs[`${r.key}__obs`] = '';
    }
    setRevisionValues(baseRev);
    setRevisionObs(baseObs);
    setRevisionImages({});

    setMovimientos([
      { movimiento: '', fecha: dateToLocalString(now), hora: timeToHHmm(now), realizado_por: '', autorizado_por: '', _expanded: true },
    ]);
    setObservaciones('');
    setFirmaResponsable('');

    setVehKilometraje('');
    setVehProxCambioAceite('');
    setVehModelo('');
    setVehAnno('');
    setVehTipoAutoria('');
    setVehTituloPropiedad(null);
    setVehRTV(null);
    setVehMarchamo(null);
    if (isTipoBicicleta(tipoNext)) {
      clearVehiculoInfoCamposNoBicicleta({
        setVehKilometraje,
        setVehProxCambioAceite,
        setVehModelo,
        setVehAnno,
        setVehTituloPropiedad,
        setVehRTV,
        setVehMarchamo,
      });
    }

    await requestLocation();
  };

  const startCreating = async () => {
    setIsCreating(true);
    setEditing(null);
    setPrefillVehicleInfo(null);
    setSelectedCorporateVehicleId(null);
    setSelectedCorporateUseId(null);
    setSelectedCorporateVehicleIdLocal(null);
    setSelectedCorporateUseIdLocal(null);
    await fetchMainStructure();
    await applyCurrentMarcaToFormHierarchy();
    await loadMarcaContext();
    await resetForm('Vehículo');

    const raw = await AsyncStorage.getItem('current_marca');
    const marca = raw ? JSON.parse(raw) : null;
    const corpoForVeh = numOrNull(marca?.corpo?.id ?? marca?.corpo_id);
    if (corpoForVeh != null && corpoForVeh > 0) {
      await fetchCorporateVehicles(corpoForVeh);
    }
  };

  const startEditing = async (item: BitacoraVehiculoDetenidoItem) => {
    setIsCreating(true);
    setEditing(item);
    setTempVehicle(null);
    const tipoVal = item.tipo as TipoBitacora;
    tipoRef.current = tipoVal;
    setTipo(tipoVal);

    const infoG = safeParse<any[]>(item.informacion_general, []);
    const infoR = safeParse<any[]>(item.informacion_revision, []);
    const movs = safeParse<any[]>(item.movimientos_vehiculos, []);

    const gMap: Record<string, any> = {};
    for (const f of infoG) gMap[f.key] = f.value;
    setGeneralValues(gMap);

    const rMap: Record<string, any> = {};
    const oMap: Record<string, string> = {};
    for (const f of infoR) {
      rMap[f.key] = f.value;
      if (f.observation !== undefined) oMap[`${f.key}__obs`] = f.observation;
    }
    // Defaults: en "Información de revisión" los selects quedan en "Bueno" si vienen vacíos
    for (const r of buildRevisionConfig(tipoVal)) {
      if (r.kind === 'select' && !String(rMap[r.key] ?? '').trim()) {
        rMap[r.key] = 'Bueno';
      }
    }
    setRevisionValues(rMap);
    setRevisionObs(oMap);
    setRevisionImages({});

    setMovimientos(movs as any);
    setObservaciones(item.observaciones || '');
    setFirmaResponsable(item.firma_responsable || '');
    await requestLocation();

    // Secuencia requerida al editar (modo normal): cargar vehículos -> seleccionar vehículo -> cargar usos -> seleccionar uso.
    if (!isPrefillMode) {
      const vehiculoIdFromItem =
        item.vehiculo_id !== undefined && item.vehiculo_id !== null ? Number(item.vehiculo_id) : null;
      const usoIdFromItem = item.uso_id !== undefined && item.uso_id !== null ? Number(item.uso_id) : null;

      const treeArr =
        Array.isArray(structure) && structure.length > 0 ? structure : await loadMainStructureTreeMerged();
      const rawM = await AsyncStorage.getItem('current_marca');
      const marca = rawM ? JSON.parse(rawM) : null;
      const rn =
        marca?.roleDivision?.role?.nombre ?? marca?.role_division?.role?.nombre ?? null;
      const itemCorpo = numOrNull(item.sucursal_id ?? (item as any).corpo_id);
      const itemPuesto = numOrNull((item as any).puesto_id);
      if (rn === 'OPERATIVO' && Array.isArray(treeArr) && treeArr.length > 0) {
        let filledOp = false;
        if (itemPuesto && itemPuesto > 0) {
          const hp = findHierarchyByPuestoIn(treeArr, itemPuesto);
          if (hp) {
            setFormEmpresaId(hp.empresaId);
            setFormClienteId(hp.clienteId);
            setFormDivisionId(hp.divisionId);
            setFormContratoId(hp.contratoId);
            setFormSucursalId(hp.corpoId);
            setFormPuestoId(hp.puestoId);
            filledOp = true;
          }
        }
        if (!filledOp && itemCorpo != null && itemCorpo > 0) {
          const h = findHierarchyByCorpoIn(treeArr, itemCorpo);
          if (h) {
            setFormEmpresaId(h.empresaId);
            setFormClienteId(h.clienteId);
            setFormDivisionId(h.divisionId);
            setFormContratoId(h.contratoId);
            setFormSucursalId(h.corpoId);
          }
          const divStored = numOrNull((item as any).division_id);
          const ctStored = numOrNull((item as any).contrato_id);
          if (divStored) setFormDivisionId(divStored);
          if (ctStored) setFormContratoId(ctStored);
          if (itemPuesto) setFormPuestoId(itemPuesto);
          else {
            const firstP = getFirstPuestoIdFromSucursalInTree(treeArr, itemCorpo);
            if (firstP) setFormPuestoId(firstP);
          }
        }
      }
      if (rn !== 'OPERATIVO' && Array.isArray(treeArr) && treeArr.length > 0) {
        let filledFromPuesto = false;
        if (itemPuesto && itemPuesto > 0) {
          const hp = findHierarchyByPuestoIn(treeArr, itemPuesto);
          if (hp) {
            setFormEmpresaId(hp.empresaId);
            setFormClienteId(hp.clienteId);
            setFormDivisionId(hp.divisionId);
            setFormContratoId(hp.contratoId);
            setFormSucursalId(hp.corpoId);
            setFormPuestoId(hp.puestoId);
            filledFromPuesto = true;
          }
        }
        if (!filledFromPuesto && itemCorpo != null && itemCorpo > 0) {
          const h = findHierarchyByCorpoIn(treeArr, itemCorpo);
          if (h) {
            setFormEmpresaId(h.empresaId);
            setFormClienteId(h.clienteId);
            setFormDivisionId(h.divisionId);
            setFormContratoId(h.contratoId);
            setFormSucursalId(h.corpoId);
          }
          const divStored = numOrNull((item as any).division_id);
          const ctStored = numOrNull((item as any).contrato_id);
          if (divStored) setFormDivisionId(divStored);
          if (ctStored) setFormContratoId(ctStored);
          if (itemPuesto) {
            setFormPuestoId(itemPuesto);
          } else {
            const firstP = getFirstPuestoIdFromSucursalInTree(treeArr, itemCorpo);
            if (firstP) setFormPuestoId(firstP);
          }
        }
      }

      const corpoId = itemCorpo;
      if (corpoId != null && corpoId > 0) {
        await fetchCorporateVehicles(corpoId);
      }
      await loadMarcaContext();

      // Resolver vehiculoId: preferimos el del registro; fallback para registros viejos usando uso_id
      let vehiculoId: number | null = vehiculoIdFromItem && vehiculoIdFromItem > 0 ? vehiculoIdFromItem : null;
      if (!vehiculoId && usoIdFromItem && usoIdFromItem > 0) {
        try {
          const isConnected = await getConnectionStatus();
          if (isConnected) {
            const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
            if (apiUrl) {
              const usoResponse = await authedFetch({
                url: `${apiUrl}/api/corporate-vehicles/uses/${usoIdFromItem}`,
                init: {
                  method: 'GET',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                },
                refreshAccessToken,
                logout,
              });
              if (!usoResponse) return;
              if (usoResponse.ok) {
                const usoData = await usoResponse.json().catch(() => ({}));
                if (usoData?.status && usoData?.data?.vehiculo_id) {
                  vehiculoId = Number(usoData.data.vehiculo_id);
                }
              }
            }
          }
        } catch (e) {
          console.error('Error resolving vehiculo_id from uso_id:', e);
        }
      }

      await preloadVehiculoYUso({
        corpoId,
        vehiculoId,
        usoId: usoIdFromItem,
      });
    }

    // Cargar también en los campos específicos de "Información del vehículo" los valores guardados en informacion_general
    const kmFromInfo = gMap.kilometraje;
    const proxAceiteFromInfo = gMap.prox_cambio_aceite;
    const modeloFromInfo = gMap.modelo;
    const annoFromInfo = gMap.anno;
    const tipoAutoriaFromInfo = gMap.tipo_autoria;
    const tituloPropFromInfo = gMap.titulo_propiedad;
    const rtvFromInfo = gMap.rtv;
    const marchamoFromInfo = gMap.marchamo;

    setVehKilometraje((prev) =>
      kmFromInfo !== undefined && kmFromInfo !== null && String(kmFromInfo).trim() !== ''
        ? String(kmFromInfo)
        : prev
    );
    setVehProxCambioAceite((prev) =>
      proxAceiteFromInfo !== undefined &&
      proxAceiteFromInfo !== null &&
      String(proxAceiteFromInfo).trim() !== ''
        ? String(proxAceiteFromInfo)
        : prev
    );
    setVehModelo((prev) =>
      modeloFromInfo !== undefined && modeloFromInfo !== null && String(modeloFromInfo).trim() !== ''
        ? String(modeloFromInfo)
        : prev
    );
    setVehAnno((prev) =>
      annoFromInfo !== undefined && annoFromInfo !== null && String(annoFromInfo).trim() !== ''
        ? String(annoFromInfo)
        : prev
    );
    setVehTipoAutoria((prev) =>
      tipoAutoriaFromInfo !== undefined &&
      tipoAutoriaFromInfo !== null &&
      String(tipoAutoriaFromInfo).trim() !== ''
        ? String(tipoAutoriaFromInfo)
        : prev
    );

    const parseBoolFromInfo = (raw: any): boolean | null => {
      if (raw === undefined || raw === null) return null;
      if (typeof raw === 'boolean') return raw;
      const txt = String(raw).trim().toLowerCase();
      if (!txt) return null;
      if (txt === 'true' || txt === '1' || txt === 'sí' || txt === 'si') return true;
      if (txt === 'false' || txt === '0' || txt === 'no') return false;
      return null;
    };

    const tituloParsed = parseBoolFromInfo(tituloPropFromInfo);
    const rtvParsed = parseBoolFromInfo(rtvFromInfo);
    const marchamoParsed = parseBoolFromInfo(marchamoFromInfo);

    setVehTituloPropiedad((prev) => (tituloParsed !== null ? tituloParsed : prev));
    setVehRTV((prev) => (rtvParsed !== null ? rtvParsed : prev));
    setVehMarchamo((prev) => (marchamoParsed !== null ? marchamoParsed : prev));

    if (isTipoBicicleta(tipoVal)) {
      setGeneralValues((prev) => ({ ...prev, numero_placa: '' }));
      clearVehiculoInfoCamposNoBicicleta({
        setVehKilometraje,
        setVehProxCambioAceite,
        setVehModelo,
        setVehAnno,
        setVehTituloPropiedad,
        setVehRTV,
        setVehMarchamo,
      });
    }
  };

  const cancelCreating = () => {
    setIsCreating(false);
    setEditing(null);
    setSelectedCorporateVehicleId(null);
    setSelectedCorporateUseId(null);
    setSelectedCorporateVehicleIdLocal(null);
    setSelectedCorporateUseIdLocal(null);
    setPrefillVehicleInfo(null);
    if (returnTo) {
      navigation.goBack();
    }
  };

  const openSignatureModal = (key: string) => {
    setSignatureTargetKey(key);
    setSignatureKey((k) => k + 1);
    setSignatureModalVisible(true);
  };

  const onSignatureOK = (signature: string) => {
    if (!signatureTargetKey) return;
    setGeneralValues((prev) => ({ ...prev, [signatureTargetKey]: signature }));
    setSignatureModalVisible(false);
    setSignatureTargetKey(null);
  };

  const clearSignatureInModal = () => {
    setSignatureKey((k) => k + 1);
    signatureRef.current?.clearSignature?.();
  };

  const handleGenerateFirmaResponsable = async () => {
    if (isGeneratingFirma) return;
    setIsGeneratingFirma(true);
    try {
      const loc = location ?? (await requestLocation());
      if (!loc || !employee) {
        Alert.alert('Error', 'No se pudo obtener ubicación o usuario');
        return;
      }
      const token = await AsyncStorage.getItem('access_token');
      if (!token) throw new Error('No authentication token found');
      const decodedToken: any = jwtDecode(token);
      const sessionId = decodedToken.sessionId;
      const horaAccion = await getHoraAccion();
      const hash = btoa(`${sessionId}:${employee.id}:${loc.coords.latitude}:${loc.coords.longitude}:${horaAccion}`);
      setFirmaResponsable(hash);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'No se pudo generar la firma');
    } finally {
      setIsGeneratingFirma(false);
    }
  };

  const handleScanFirmaResponsable = async () => {
    try {
      const qrData = await scanQR();
      if (!qrData) return;
      setFirmaResponsable(qrData);
    } catch (e) {
      Alert.alert('Error', 'No se pudo escanear el QR');
    }
  };

  const validateForm = async () => {
    await syncMarcaIdsFromFormOrMarca();
    const rawM = await AsyncStorage.getItem('current_marca');
    const marca = rawM ? JSON.parse(rawM) : null;
    const rn =
      marca?.roleDivision?.role?.nombre ?? marca?.role_division?.role?.nombre ?? null;
    if (rn !== 'OPERATIVO') {
      if (!formSucursalId) {
        Alert.alert('Error', 'Seleccione la sucursal (corpo) en la jerarquía del formulario');
        return false;
      }
      if (!formPuestoId) {
        Alert.alert('Error', 'Seleccione el puesto en la jerarquía del formulario');
        return false;
      }
    } else {
      const rawOp = await AsyncStorage.getItem('current_marca');
      const mOp = rawOp ? JSON.parse(rawOp) : null;
      let puestoOp = numOrNull(mOp?.puesto?.id ?? mOp?.puesto_id);
      const corpoOp = numOrNull(mOp?.corpo?.id ?? mOp?.corpo_id);
      if (!puestoOp && corpoOp) {
        puestoOp = getFirstPuestoIdFromSucursalInTree(structure, corpoOp);
      }
      if (!puestoOp) {
        Alert.alert('Error', 'No se encontró el puesto en la marca actual. Verifique la marca o la estructura en caché.');
        return false;
      }
    }
    if (!marcaClienteId) {
      Alert.alert('Error', 'No se encontró el cliente; revise la jerarquía o la marca actual');
      return false;
    }
    if (!marcaCorpoId) {
      Alert.alert('Error', 'No se encontró la sucursal; revise la jerarquía o la marca actual');
      return false;
    }
    // Seleccionar vehículo y uso es opcional: solo validamos jerarquía y contenido
    for (const g of generalConfig) {
      if (!g.required) continue;
      const val = generalValues[g.key];
      if (!val || String(val).trim().length === 0) {
        Alert.alert('Error', `Campo requerido: ${g.label}`);
        return false;
      }
    }
    for (const r of revisionConfig) {
      if (!r.required) continue;
      if (r.kind === 'heading') continue;
      const val = revisionValues[r.key];
      if (!val || String(val).trim().length === 0) {
        Alert.alert('Error', `Campo requerido: ${r.label}`);
        return false;
      }
    }
    if (!firmaResponsable) {
      Alert.alert('Error', 'Debes registrar la firma responsable');
      return false;
    }

    // Validación al registrar vehículo nuevo: marca viene de Información general
    if (!selectedCorporateVehicleId && !selectedCorporateVehicleIdLocal && shouldRegisterVehicle) {
      if (!String(generalValues.marca ?? '').trim()) {
        Alert.alert('Error', 'Marca es requerida para registrar el vehículo (Información general)');
        return false;
      }
    }
    return true;
  };

  const buildPayload = async () => {
    await syncMarcaIdsFromFormOrMarca();
    const current = await loadMarcaContext();
    const names = await resolveHierarchyDisplayNames();
    // Si no hay marca activa, el server permite crear usando empresa/cliente/sucursal
    const marca_id = current?.id ? Number(current.id) : undefined;

    /** IDs de ubicación (empresa → puesto); evitar estado desfasado tras syncMarcaIdsFromFormOrMarca. */
    let payloadEmpresaId = marcaEmpresaId;
    let payloadClienteId = marcaClienteId;
    let payloadSucursalId = marcaCorpoId;
    let payloadDivisionId: number | null = null;
    let payloadContratoId: number | null = null;
    let payloadPuestoId: number | null = null;

    if (roleName === 'OPERATIVO') {
      const rawM = await AsyncStorage.getItem('current_marca');
      if (rawM) {
        try {
          const m = JSON.parse(rawM);
          payloadEmpresaId = numOrNull(m?.empresa?.id ?? m?.empresa_id);
          payloadClienteId = numOrNull(m?.cliente?.id ?? m?.cliente_id);
          payloadSucursalId = numOrNull(m?.corpo?.id ?? m?.corpo_id);
          payloadDivisionId = getDivisionIdFromMarcaJson(m);
          payloadContratoId = numOrNull(m?.contrato?.id ?? m?.contrato_id);
          payloadPuestoId = numOrNull(m?.puesto?.id ?? m?.puesto_id);
        } catch {
          /* mantener estado */
        }
      }
    } else {
      payloadEmpresaId = formEmpresaId;
      payloadClienteId = formClienteId;
      payloadSucursalId = formSucursalId;
      payloadDivisionId = formDivisionId;
      payloadContratoId = formContratoId;
      payloadPuestoId = formPuestoId;
    }

    const tree = Array.isArray(structure) ? structure : [];
    if (payloadSucursalId && (!payloadDivisionId || !payloadContratoId)) {
      const hc = findHierarchyByCorpoIn(tree, payloadSucursalId);
      if (hc) {
        payloadDivisionId = payloadDivisionId ?? hc.divisionId;
        payloadContratoId = payloadContratoId ?? hc.contratoId;
      }
    }
    if (!payloadPuestoId && payloadSucursalId) {
      payloadPuestoId = getFirstPuestoIdFromSucursalInTree(tree, payloadSucursalId);
    }
    if (payloadPuestoId && (!payloadDivisionId || !payloadContratoId || !payloadSucursalId)) {
      const hp = findHierarchyByPuestoIn(tree, payloadPuestoId);
      if (hp) {
        payloadDivisionId = payloadDivisionId ?? hp.divisionId;
        payloadContratoId = payloadContratoId ?? hp.contratoId;
        payloadSucursalId = payloadSucursalId ?? hp.corpoId;
        payloadEmpresaId = payloadEmpresaId ?? hp.empresaId;
        payloadClienteId = payloadClienteId ?? hp.clienteId;
      }
    }

    const infoGeneralArr = generalConfig.map((g) => {
      let value = '';
      if (g.kind === 'readonly') {
        if (g.key === 'empresa') {
          value = names.empresa || current?.empresa?.nombre || empresaNombre;
        } else if (g.key === 'cliente') {
          value = names.cliente || current?.cliente?.nombre || clienteNombre;
        } else if (g.key === 'corpo') {
          value = names.corpo || current?.corpo?.nombre || corpoNombre;
        }
      } else {
        value = generalValues[g.key] ?? '';
      }
      return {
        key: g.key,
        label: g.label,
        value,
        kind: g.kind,
      };
    });

    // Guardar también en informacion_general los campos de la sección "Información del vehículo"
    infoGeneralArr.push(
      {
        key: 'kilometraje',
        label: 'Kilometraje',
        value: vehKilometraje,
        kind: 'text',
      },
      {
        key: 'prox_cambio_aceite',
        label: 'Próximo cambio de aceite',
        value: vehProxCambioAceite,
        kind: 'text',
      },
      {
        key: 'modelo',
        label: 'Modelo',
        value: vehModelo,
        kind: 'text',
      },
      {
        key: 'anno',
        label: 'Año',
        value: vehAnno,
        kind: 'text',
      },
      {
        key: 'tipo_autoria',
        label: 'Tipo de autoría',
        value: vehTipoAutoria,
        kind: 'select',
      },
      {
        key: 'titulo_propiedad',
        label: 'Título propiedad',
        value:
          vehTituloPropiedad === null
            ? ''
            : vehTituloPropiedad
            ? 'true'
            : 'false',
        kind: 'text',
      },
      {
        key: 'rtv',
        label: 'RTV',
        value:
          vehRTV === null
            ? ''
            : vehRTV
            ? 'true'
            : 'false',
        kind: 'text',
      },
      {
        key: 'marchamo',
        label: 'Marchamo',
        value:
          vehMarchamo === null
            ? ''
            : vehMarchamo
            ? 'true'
            : 'false',
        kind: 'text',
      }
    );

    const infoRevisionArr: BitacoraRevisionEntry[] = [];
    for (const r of revisionConfig) {
      if (r.kind === 'heading') {
        infoRevisionArr.push({ key: r.key, label: r.label, kind: 'heading' });
        continue;
      }
      const entry: BitacoraRevisionEntry = {
        key: r.key,
        label: r.label,
        value: revisionValues[r.key] ?? '',
        kind: r.kind,
      };
      if (r.withObservation) entry.observation = revisionObs[`${r.key}__obs`] ?? '';
      infoRevisionArr.push(entry);
    }
    const existingRevisionForMerge = editing
      ? safeParse<BitacoraRevisionEntry[]>(editing.informacion_revision, [])
      : [];
    const infoRevisionMerged = isEditingBitacoraRecord
      ? mergeNewRevisionImagesWithExisting(existingRevisionForMerge, infoRevisionArr, revisionImages)
      : mergeRevisionImagesIntoArray(infoRevisionArr, revisionImages);

    const movs = movimientos.map((m) => ({
      movimiento: m.movimiento,
      fecha: m.fecha,
      hora: m.hora,
      realizado_por: m.realizado_por,
      autorizado_por: m.autorizado_por,
    }));

    // Datos para registro opcional de vehículo nuevo (cuando no hay vehiculo_id seleccionado)
    let registerVehiclePayload: any = undefined;
    if (!selectedCorporateVehicleId && !selectedCorporateVehicleIdLocal && shouldRegisterVehicle) {
      const tipoVeh = tipoRef.current || "";
      const esBicicleta = isTipoBicicleta(tipoVeh);
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
      registerVehiclePayload = {
        placa: esBicicleta ? null : strOrNull(String(generalValues.numero_placa ?? '')),
        tipo: tipoVeh,
        tipo_autoria: vehTipoAutoria.trim() || null,
        kilometraje: esBicicleta ? null : numOrNull(vehKilometraje),
        prox_cambio_aceite: esBicicleta ? null : numOrNull(vehProxCambioAceite),
        modelo: esBicicleta ? null : strOrNull(vehModelo),
        anno: esBicicleta ? null : numOrNull(vehAnno),
        marca: String(generalValues.marca ?? '').trim(),
        titulo_propiedad: esBicicleta ? null : vehTituloPropiedad,
        rtv: esBicicleta ? null : vehRTV,
        marchamo: esBicicleta ? null : vehMarchamo,
      };
    }

    let vehiculo_id: number | null = selectedCorporateVehicleId;
    let uso_id: number | null = selectedCorporateUseId;
    let vehiculo_id_local: string | undefined;
    let uso_id_local: string | undefined;

    if (selectedCorporateVehicleIdLocal) {
      vehiculo_id = null;
      vehiculo_id_local = selectedCorporateVehicleIdLocal;
    } else if (selectedCorporateVehicle) {
      const veh = selectedCorporateVehicle as any;
      const vl = veh.id_local;
      const vid = veh.id;
      const vidLocalKey = resolveLocalEntityKey(vid);
      const vlLocalKey = resolveLocalEntityKey(vl);
      if (vidLocalKey) {
        vehiculo_id = null;
        vehiculo_id_local = vidLocalKey;
      } else if (vlLocalKey) {
        vehiculo_id_local = vlLocalKey;
        if (!(typeof vid === 'number' && vid > 0)) vehiculo_id = null;
      }
    }

    if (selectedCorporateUseIdLocal) {
      uso_id = null;
      uso_id_local = selectedCorporateUseIdLocal;
    } else if (selectedCorporateUseId != null && selectedCorporateVehicle) {
      const usos =
        (selectedCorporateVehicle as any)?.usos ||
        (selectedCorporateVehicle as any)?.c_usos_vehiculos_corporativos ||
        [];
      const u = (Array.isArray(usos) ? usos : []).find(
        (x: any) => Number(x.id) === Number(selectedCorporateUseId)
      );
      if (u) {
        const ul = u.id_local;
        const uid = u.id;
        const uidLocalKey = resolveLocalEntityKey(uid);
        const ulLocalKey = resolveLocalEntityKey(ul);
        if (uidLocalKey) {
          uso_id = null;
          uso_id_local = uidLocalKey;
        } else if (ulLocalKey) {
          uso_id_local = ulLocalKey;
          if (!(typeof uid === 'number' && uid > 0)) uso_id = null;
        }
      }
    }

    return {
      ...(marca_id ? { marca_id } : {}),
      empresa_id: payloadEmpresaId,
      cliente_id: payloadClienteId,
      sucursal_id: payloadSucursalId,
      division_id: payloadDivisionId,
      contrato_id: payloadContratoId,
      puesto_id: payloadPuestoId,
      isActive: true,
      vehiculo_id,
      uso_id,
      ...(vehiculo_id_local ? { vehiculo_id_local } : {}),
      ...(uso_id_local ? { uso_id_local } : {}),
      tipo: tipoRef.current,
      informacion_general: infoGeneralArr,
      informacion_revision: infoRevisionMerged,
      movimientos_vehiculos: movs,
      observaciones,
      firma_responsable: firmaResponsable,
      ...(registerVehiclePayload ? { register_vehicle: registerVehiclePayload } : {}),
    };
  };

  /** Cola de creación offline: va en evaluations_actions y se envía tras sync de vehículo/uso en corporateEvaluationsSync. */
  const upsertOfflineBitacoraCreateInEvaluations = async (localId: string, requestData: any) => {
    const actionsStr = await AsyncStorage.getItem('evaluations_actions');
    const actions = actionsStr ? JSON.parse(actionsStr) : [];
    const existingIdx = actions.findIndex(
      (a: any) =>
        a.action === 'create' && a.type === BITACORA_VEHICULO_DETENIDO_EVAL_TYPE && a.id === localId
    );
    const entry = {
      id: localId,
      action: 'create',
      type: BITACORA_VEHICULO_DETENIDO_EVAL_TYPE,
      payload: { ...requestData, bitacora_action_local_id: localId },
    };
    if (existingIdx !== -1) actions[existingIdx] = entry;
    else actions.push(entry);
    await AsyncStorage.setItem('evaluations_actions', JSON.stringify(actions));
  };

  const executeSave = async () => {
    if (!employee) return;

    setIsSubmitting(true);
    setSubmitResponse(null);

    try {
      const horaAccion = await getHoraAccion();
      if (!horaAccion) {
        Alert.alert('Error', 'No se pudo obtener la hora');
        return;
      }

      const requestData = await buildPayload();
      const isConnected = await getConnectionStatus();

      const sidForPayload = numOrNull(requestData.sucursal_id) ?? marcaCorpoId ?? formSucursalId;
      const isUnsyncedDraft = !!(editing?.id === 0 && editing?.id_local);

      const refreshBitacoraListFromMainStructure = async (savedSucursalId?: number | null) => {
        const snapV = await syncMarcaFromStorage({ applyFiltersFromMarca: false });
        const saved =
          savedSucursalId != null && Number(savedSucursalId) > 0 ? Number(savedSucursalId) : null;
        const listSid =
          saved ??
          (snapV?.isOperativo
            ? snapV.marcaCorpoId
            : filterSucursalIdRef.current ?? snapV?.marcaCorpoId);
        if (listSid != null && listSid > 0) {
          const rows = await readBitacorasForSucursalFromMainStructure(Number(listSid));
          setBitacoras(rows as BitacoraVehiculoDetenidoItem[]);
        } else {
          setBitacoras([]);
        }
      };

      // Create (nuevo registro) o borrador offline sin id de servidor
      if (!editing || !editing.id || editing.id === 0) {
        // Edición de un CREATE pendiente: actualizar cola, caché y árbol principal + fragmentos (sin POST duplicado)
        if (isUnsyncedDraft && editing.id_local) {
          const id_local = editing.id_local;
          await upsertOfflineBitacoraCreateInEvaluations(id_local, requestData);
          const foundPrev = await findBitacoraDetenidoInMainStructureByLocalKey(id_local);
          const prevRow = foundPrev?.row;
          const oldLink = bitacoraLinkFromCacheItem(prevRow);
          const newLink = bitacoraLinkFromRequestPayload(sidForPayload, requestData);
          const createdAtKeep = prevRow?.created_at ?? new Date(horaAccion).toISOString();
          await moveBitacoraOnMainStructureCache({
            oldLink,
            newLink,
            bitacora: {
              id: 0,
              id_local,
              tipo: tipoRef.current,
              created_at: createdAtKeep,
            },
          });
          const localItem: any = {
            ...(prevRow || {}),
            id: 0,
            empresa_id: Number((requestData.empresa_id ?? marcaEmpresaId) || 0),
            cliente_id: Number((requestData.cliente_id ?? marcaClienteId) || 0),
            sucursal_id: Number((requestData.sucursal_id ?? marcaCorpoId) || 0),
            division_id: requestData.division_id ?? (prevRow as any)?.division_id,
            contrato_id: requestData.contrato_id ?? (prevRow as any)?.contrato_id,
            puesto_id: requestData.puesto_id ?? (prevRow as any)?.puesto_id,
            isActive: requestData.isActive !== false,
            vehiculo_id: requestData.vehiculo_id ?? null,
            uso_id: requestData.uso_id ?? null,
            vehiculo_id_local: requestData.vehiculo_id_local,
            uso_id_local: requestData.uso_id_local,
            tipo: tipoRef.current,
            informacion_general: requestData.informacion_general,
            informacion_revision: requestData.informacion_revision,
            movimientos_vehiculos: requestData.movimientos_vehiculos,
            observaciones: requestData.observaciones,
            firma_responsable: requestData.firma_responsable,
            created_by: Number(employee.id),
            created_at: createdAtKeep,
            id_local,
          };
          const prevSid = foundPrev?.sucursalId ?? numOrNull(prevRow?.sucursal_id ?? prevRow?.corpo_id) ?? 0;
          const newSid = Number((requestData.sucursal_id ?? marcaCorpoId) || 0);
          if (prevSid && newSid && prevSid !== newSid) {
            await moveBitacoraDetenidoRowBetweenSucursales({
              row: localItem,
              oldSucursalId: prevSid,
              newSucursalId: newSid,
              matchLocalKey: id_local,
            });
          } else {
            await upsertBitacoraDetenidoRowInMainStructure(localItem, newSid || prevSid, id_local);
          }
          await refreshBitacoraListFromMainStructure(numOrNull(requestData.sucursal_id));
          Alert.alert(
            'Éxito',
            isConnected
              ? 'Cambios guardados. Se sincronizará con el servidor cuando corresponda.'
              : 'Bitácora guardada localmente. Se sincronizará cuando haya conexión.'
          );
          setTimeout(() => {
            setIsCreating(false);
            if (returnTo) navigation.goBack();
          }, 2000);
          return;
        }

        if (isConnected) {
          const apiPayload = prepareBitacoraRequestForApi(requestData);
          const res = await createBitacoraVehiculoDetenido({ requestData: apiPayload, refreshAccessToken, logout });
          if (!res.status) throw new Error(res.message || 'No se pudo crear');
          try {
            await deleteBitacoraRevLocalImageFilesFromMap(revisionImages);
          } catch {
            /* noop */
          }

          const newBitId = numOrNull((res as any).id ?? (res as any).data?.id);
          const linkNew = bitacoraLinkFromRequestPayload(sidForPayload, requestData);
          if (newBitId && linkNew) {
            await setBitacoraOnUsoInMainStructureCache({
              ...linkNew,
              bitacora: {
                id: newBitId,
                tipo: tipoRef.current,
                created_at: new Date(horaAccion).toISOString(),
              },
            });
          }
          if (newBitId && sidForPayload) {
            await upsertBitacoraDetenidoRowInMainStructure(
              {
                id: newBitId,
                empresa_id: requestData.empresa_id,
                cliente_id: requestData.cliente_id,
                sucursal_id: sidForPayload,
                corpo_id: sidForPayload,
                division_id: requestData.division_id,
                contrato_id: requestData.contrato_id,
                puesto_id: requestData.puesto_id,
                isActive: requestData.isActive !== false,
                vehiculo_id: requestData.vehiculo_id ?? null,
                uso_id: requestData.uso_id ?? null,
                vehiculo_id_local: requestData.vehiculo_id_local,
                uso_id_local: requestData.uso_id_local,
                tipo: tipoRef.current,
                informacion_general: requestData.informacion_general,
                informacion_revision: requestData.informacion_revision,
                movimientos_vehiculos: requestData.movimientos_vehiculos,
                observaciones: requestData.observaciones,
                firma_responsable: requestData.firma_responsable,
                created_by: Number(employee.id),
                created_at: new Date(horaAccion).toISOString(),
                id_local: '',
              },
              sidForPayload,
              null
            );
          }

          Alert.alert('Éxito', res.message || 'Bitácora creada correctamente');
          setTimeout(async () => {
            await fetchRecords();
            setIsCreating(false);
            if (returnTo) navigation.goBack();
          }, 2000);
          return;
        }

        // Offline create
        const id_local =
          editing?.id_local && editing.id_local.length > 0
            ? editing.id_local
            : `local-bitacora-${Date.now()}-${generateRandomId()}`;
        await upsertOfflineBitacoraCreateInEvaluations(id_local, requestData);

        const createdAt = new Date(horaAccion).toISOString();

        const localItem: any = {
          id: 0,
          empresa_id: Number(requestData.empresa_id ?? 0),
          cliente_id: Number(requestData.cliente_id ?? 0),
          sucursal_id: Number(numOrNull(requestData.sucursal_id) || 0),
          division_id: requestData.division_id,
          contrato_id: requestData.contrato_id,
          puesto_id: requestData.puesto_id,
          isActive: requestData.isActive !== false,
          vehiculo_id: requestData.vehiculo_id ?? null,
          uso_id: requestData.uso_id ?? null,
          vehiculo_id_local: requestData.vehiculo_id_local,
          uso_id_local: requestData.uso_id_local,
          tipo: tipoRef.current,
          informacion_general: requestData.informacion_general,
          informacion_revision: requestData.informacion_revision,
          movimientos_vehiculos: requestData.movimientos_vehiculos,
          observaciones: requestData.observaciones,
          firma_responsable: requestData.firma_responsable,
          created_by: Number(employee.id),
          created_at: createdAt,
          id_local,
        };

        const linkOff = bitacoraLinkFromRequestPayload(sidForPayload, requestData);
        if (linkOff) {
          await setBitacoraOnUsoInMainStructureCache({
            ...linkOff,
            bitacora: {
              id: 0,
              id_local,
              tipo: tipoRef.current,
              created_at: createdAt,
            },
          });
        }

        const offSid = numOrNull(requestData.sucursal_id) ?? numOrNull(sidForPayload) ?? 0;
        if (offSid) await upsertBitacoraDetenidoRowInMainStructure(localItem, offSid, id_local);
        await refreshBitacoraListFromMainStructure(numOrNull(requestData.sucursal_id));
        Alert.alert('Éxito', 'Bitácora guardada localmente. Se sincronizará cuando haya conexión.');
        setTimeout(() => {
          setIsCreating(false);
          if (returnTo) navigation.goBack();
        }, 2000);
        return;
      }

      // Update (registro con id de servidor)
      const oldLinkUp = bitacoraLinkFromRequestPayload(numOrNull(editing.sucursal_id), {
        sucursal_id: editing.sucursal_id,
        vehiculo_id: editing.vehiculo_id,
        uso_id: editing.uso_id,
        vehiculo_id_local: (editing as any).vehiculo_id_local,
        uso_id_local: (editing as any).uso_id_local,
      });
      const newLinkUp = bitacoraLinkFromRequestPayload(sidForPayload, requestData);
      const bitacoraSnapUp = {
        id: editing.id,
        tipo: requestData.tipo ?? editing.tipo,
        created_at: editing.created_at,
      };

      const mergedRowUp: any = {
        ...editing,
        ...requestData,
        id: editing.id,
        tipo: requestData.tipo ?? editing.tipo,
        informacion_general: requestData.informacion_general,
        informacion_revision: requestData.informacion_revision,
        movimientos_vehiculos: requestData.movimientos_vehiculos,
        observaciones: requestData.observaciones,
        firma_responsable: requestData.firma_responsable,
        vehiculo_id_local: requestData.vehiculo_id_local,
        uso_id_local: requestData.uso_id_local,
      };

      if (isConnected) {
        const apiPayload = prepareBitacoraRequestForApi(requestData);
        const res = await updateBitacoraVehiculoDetenido({
          id: editing.id,
          requestData: apiPayload,
          refreshAccessToken,
          logout,
        });
        if (!res.status) throw new Error(res.message || 'No se pudo actualizar');
        try {
          await deleteBitacoraRevLocalImageFilesFromMap(revisionImages);
        } catch {
          /* noop */
        }
        await moveBitacoraOnMainStructureCache({
          oldLink: oldLinkUp,
          newLink: newLinkUp,
          bitacora: bitacoraSnapUp,
        });
        const oldSidUp = numOrNull(editing.sucursal_id);
        const newSidUp = numOrNull(requestData.sucursal_id) ?? sidForPayload ?? 0;
        if (oldSidUp && newSidUp && oldSidUp !== newSidUp) {
          await moveBitacoraDetenidoRowBetweenSucursales({
            row: mergedRowUp,
            oldSucursalId: oldSidUp,
            newSucursalId: newSidUp,
            matchLocalKey: null,
          });
        } else if (newSidUp) {
          await upsertBitacoraDetenidoRowInMainStructure(mergedRowUp, newSidUp, null);
        }
        Alert.alert('Éxito', res.message || 'Bitácora actualizada correctamente');
        setTimeout(async () => {
          await fetchRecords();
          setIsCreating(false);
          if (returnTo) navigation.goBack();
        }, 2000);
        return;
      }

      // Offline update: cola un `update` en evaluations_actions (una sola entrada por id).
      const evStrUp = await AsyncStorage.getItem('evaluations_actions');
      const evUp = evStrUp ? JSON.parse(evStrUp) : [];
      const nextEvUp = Array.isArray(evUp)
        ? evUp.filter(
            (a: any) =>
              !(
                a.type === BITACORA_VEHICULO_DETENIDO_EVAL_TYPE &&
                a.action === 'update' &&
                String(a.id) === String(editing.id)
              )
          )
        : [];
      nextEvUp.push({
        id: editing.id,
        action: 'update',
        type: BITACORA_VEHICULO_DETENIDO_EVAL_TYPE,
        payload: requestData,
        synced: false,
      });
      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(nextEvUp));

      await moveBitacoraOnMainStructureCache({
        oldLink: oldLinkUp,
        newLink: newLinkUp,
        bitacora: bitacoraSnapUp,
      });
      const oldSidOff = numOrNull(editing.sucursal_id);
      const newSidOff = numOrNull(requestData.sucursal_id) ?? sidForPayload ?? 0;
      if (oldSidOff && newSidOff && oldSidOff !== newSidOff) {
        await moveBitacoraDetenidoRowBetweenSucursales({
          row: mergedRowUp,
          oldSucursalId: oldSidOff,
          newSucursalId: newSidOff,
          matchLocalKey: null,
        });
      } else if (newSidOff) {
        await upsertBitacoraDetenidoRowInMainStructure(mergedRowUp, newSidOff, null);
      }
      await refreshBitacoraListFromMainStructure(numOrNull(requestData.sucursal_id));
      Alert.alert('Éxito', 'Cambios guardados localmente. Se sincronizarán cuando haya conexión.');
      setTimeout(() => {
        setIsCreating(false);
        if (returnTo) navigation.goBack();
      }, 2000);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'No se pudo guardar');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSave = () => {
    if (!employee) return;
    void (async () => {
      if (!(await validateForm())) return;
      const isCreate = !editing || !editing.id || editing.id === 0;
      Alert.alert(
        isCreate ? 'Confirmar registro' : 'Confirmar modificación',
        isCreate
          ? '¿Deseas crear esta bitácora con los datos ingresados?'
          : '¿Deseas guardar los cambios en esta bitácora?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Aceptar', onPress: () => void executeSave() },
        ]
      );
    })();
  };

  const executeDelete = async (item: BitacoraVehiculoDetenidoItem) => {
    const rowKey = getBitacoraRowKey(item);
    setDeletingBitacoraKey(rowKey);
    try {
      const isConnected = await getConnectionStatus();
      if (item.id === 0 && item.id_local) {
        await clearBitacoraFromMainStructureByBitacoraRef({ idLocal: item.id_local });
        await removeBitacoraDetenidoRowFromMainStructure({ idLocal: item.id_local });
        const snapD = await syncMarcaFromStorage({ applyFiltersFromMarca: false });
        const listSidD = snapD?.isOperativo
          ? snapD.marcaCorpoId
          : filterSucursalIdRef.current ?? snapD?.marcaCorpoId;
        if (listSidD != null && listSidD > 0) {
          const rows = await readBitacorasForSucursalFromMainStructure(Number(listSidD));
          setBitacoras(rows as BitacoraVehiculoDetenidoItem[]);
        } else {
          setBitacoras([]);
        }

        const evStr = await AsyncStorage.getItem('evaluations_actions');
        if (evStr) {
          const ev = JSON.parse(evStr);
          const nextEv = ev.filter(
            (e: any) =>
              !(
                e.type === BITACORA_VEHICULO_DETENIDO_EVAL_TYPE &&
                String(e.id) === String(item.id_local)
              )
          );
          await AsyncStorage.setItem('evaluations_actions', JSON.stringify(nextEv));
        }
        Alert.alert('Éxito', 'Registro eliminado localmente');
        return;
      }

      if (isConnected) {
        const res = await deleteBitacoraVehiculoDetenido({ id: item.id, refreshAccessToken, logout });
        if (!res.status) throw new Error(res.message || 'No se pudo eliminar');
        await clearBitacoraFromMainStructureByBitacoraRef({ bitacoraId: item.id });
        await removeBitacoraDetenidoRowFromMainStructure({ bitacoraId: item.id });
        await fetchRecords();
        Alert.alert('Éxito', 'Registro eliminado correctamente');
        return;
      }

      await clearBitacoraFromMainStructureByBitacoraRef({ bitacoraId: item.id });
      await removeBitacoraDetenidoRowFromMainStructure({ bitacoraId: item.id });
      const evStrDel = await AsyncStorage.getItem('evaluations_actions');
      const evDel = evStrDel ? JSON.parse(evStrDel) : [];
      const nextEvDel = Array.isArray(evDel)
        ? evDel.filter(
            (e: any) =>
              !(
                e.type === BITACORA_VEHICULO_DETENIDO_EVAL_TYPE &&
                e.action === 'delete' &&
                String(e.id) === String(item.id)
              )
          )
        : [];
      nextEvDel.push({
        id: item.id,
        action: 'delete',
        type: BITACORA_VEHICULO_DETENIDO_EVAL_TYPE,
        payload: {},
        synced: false,
      });
      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(nextEvDel));

      const snapD = await syncMarcaFromStorage({ applyFiltersFromMarca: false });
      const listSidD = snapD?.isOperativo
        ? snapD.marcaCorpoId
        : filterSucursalIdRef.current ?? snapD?.marcaCorpoId;
      if (listSidD != null && listSidD > 0) {
        const rows = await readBitacorasForSucursalFromMainStructure(Number(listSidD));
        setBitacoras(rows as BitacoraVehiculoDetenidoItem[]);
      } else {
        setBitacoras([]);
      }
      Alert.alert('Modo offline', 'Registro eliminado localmente. Se sincronizará cuando haya conexión.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'No se pudo eliminar');
    } finally {
      setDeletingBitacoraKey(null);
    }
  };

  const handleDelete = (item: BitacoraVehiculoDetenidoItem) => {
    if (deletingBitacoraKey) return;
    Alert.alert('Eliminar', '¿Deseas eliminar este registro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Aceptar',
        style: 'destructive',
        onPress: () => void executeDelete(item),
      },
    ]);
  };

  const addMovimiento = async () => {
    const horaAccion = await getHoraAccion();
    if (!horaAccion) {
      Alert.alert('Error', 'No se pudo obtener la hora');
      return;
    }
    setMovimientos((prev) => [
      ...prev,
      { movimiento: '', fecha: dateToLocalString(new Date(horaAccion)), hora: timeToHHmm(new Date(horaAccion)), realizado_por: '', autorizado_por: '', _expanded: true },
    ]);
  };

  const updateMovimiento = (idx: number, patch: Partial<MovimientoVehiculo>) => {
    setMovimientos((prev) => prev.map((m, i) => (i === idx ? { ...m, ...patch } : m)));
  };

  const removeMovimiento = (idx: number) => {
    setMovimientos((prev) => prev.filter((_, i) => i !== idx));
  };

  const openDatePicker = (key: string, currentValue?: string) => {
    setDatePickerKey(key);
    setDatePickerValue(parseDateStringToDate(currentValue));
    setShowDatePicker(true);
  };

  const openTimePicker = async (key: string, currentValue?: string) => {
    const horaAccion = await getHoraAccion();
    if (!horaAccion) {
      Alert.alert('Error', 'No se pudo obtener la hora');
      return;
    }
    setTimePickerKey(key);
    const d = new Date(horaAccion);
    if (currentValue && currentValue.includes(':')) {
      const [hh, mm] = currentValue.split(':');
      d.setHours(parseInt(hh || '0', 10), parseInt(mm || '0', 10), 0, 0);
    }
    setTimePickerValue(d);
    setShowTimePicker(true);
  };

  const onDatePicked = (_event: any, selected?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (!selected || !datePickerKey) return;
    const iso = dateToLocalString(selected);
    if (datePickerKey.startsWith('mov_')) {
      const idx = parseInt(datePickerKey.split('_')[1], 10);
      updateMovimiento(idx, { fecha: iso });
    } else {
      setGeneralValues((prev) => ({ ...prev, [datePickerKey]: iso }));
    }
  };

  const onTimePicked = (_event: any, selected?: Date) => {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (!selected || !timePickerKey) return;
    const hhmm = timeToHHmm(selected);
    if (timePickerKey.startsWith('mov_')) {
      const idx = parseInt(timePickerKey.split('_')[1], 10);
      updateMovimiento(idx, { hora: hhmm });
    } else {
      setGeneralValues((prev) => ({ ...prev, [timePickerKey]: hhmm }));
    }
  };

  if (!hasCurrentMarca && !isPrefillMode) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader onMenuPress={handleMenuPress} title="Revisión de vehículos" />
        <ThemedView style={styles.loadingContainer}>
          <ThemedText style={styles.errorText}>Debes tener una marca activa para usar este módulo.</ThemedText>
        </ThemedView>
        <AppFooter />
        <SlideMenu isVisible={isMenuVisible} onClose={handleMenuClose} onHomePress={handleHomePress} currentRoute="BitacoraVehiculosDetenidos" />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={handleMenuPress} title="Revisión de vehículos" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <ThemedView style={styles.content}>
          {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}

          <ThemedView style={styles.titleContainer}>
            <ThemedText type="title" style={styles.title}>
              <Ionicons name="build" size={22} color="#000000" /> Revisión de vehículos
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              Gestiona los registros de revisión de vehículos
            </ThemedText>
          </ThemedView>

          {/* Filtros (collapsable) */}
          {!isCreating && (
            <ThemedView style={styles.filtersMain}>
              <ThemedView style={styles.filterHeader}>
                <TouchableOpacity
                  style={styles.filterToggleButton}
                  onPress={() => setIsFiltersExpanded(!isFiltersExpanded)}
                >
                  <ThemedText style={styles.filterToggleText}>Filtros</ThemedText>
                  <Ionicons
                    name={isFiltersExpanded ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color="#007AFF"
                  />
                </TouchableOpacity>

                {isFiltersExpanded && (
                  <TouchableOpacity style={styles.resetFiltersButton} onPress={resetAllFilters}>
                    <Ionicons name="refresh" size={16} color="#FF3B30" />
                    <ThemedText style={styles.resetFiltersText}>Reiniciar</ThemedText>
                  </TouchableOpacity>
                )}
              </ThemedView>

              {isFiltersExpanded && (
                <ThemedView style={styles.filterContent}>
                  {roleName != null && roleName !== 'OPERATIVO' ? (
                    <>
                      {isStructureLoading ? (
                        <ThemedView style={styles.inlineLoading}>
                          <ActivityIndicator size="small" color="#007AFF" />
                          <ThemedText style={styles.inlineLoadingText}>Cargando estructura...</ThemedText>
                        </ThemedView>
                      ) : structure.length === 0 ? (
                        <ThemedText style={styles.emptyText}>Sin estructura en caché. Sincronice la app.</ThemedText>
                      ) : (
                        <>
                          <ThemedText style={styles.filterHierarchyTitle}>Jerarquía (lista)</ThemedText>
                          <ThemedView style={styles.filterGroup}>
                            <ThemedText style={styles.filterLabel}>Empresa</ThemedText>
                            <View style={styles.pickerWrapper}>
                              <Picker
                                selectedValue={filterEmpresaId ?? 0}
                                onValueChange={(v) => {
                                  const next = Number(v) || 0;
                                  setFilterEmpresaId(next === 0 ? null : next);
                                  setFilterClienteId(null);
                                  setFilterDivisionId(null);
                                  setFilterContratoId(null);
                                  setFilterSucursalId(null);
                                  filterSucursalIdRef.current = null;
                                }}
                                style={styles.picker}
                              >
                                <Picker.Item label="Seleccione empresa..." value={0} color="#000000" />
                                {filterEmpresaOptions.map((e: any) => (
                                  <Picker.Item key={e.id} label={e.nombre} value={e.id} color="#000000" />
                                ))}
                              </Picker>
                            </View>
                          </ThemedView>
                          <ThemedView style={styles.filterGroup}>
                            <ThemedText style={styles.filterLabel}>Cliente</ThemedText>
                            <View style={styles.pickerWrapper}>
                              <Picker
                                enabled={filterEmpresaId != null && filterClienteOptionsMemo.length > 0}
                                selectedValue={filterClienteId ?? 0}
                                onValueChange={(v) => {
                                  const next = Number(v) || 0;
                                  setFilterClienteId(next === 0 ? null : next);
                                  setFilterDivisionId(null);
                                  setFilterContratoId(null);
                                  setFilterSucursalId(null);
                                  filterSucursalIdRef.current = null;
                                }}
                                style={styles.picker}
                              >
                                <Picker.Item
                                  label={filterEmpresaId ? 'Seleccione cliente...' : 'Seleccione empresa primero'}
                                  value={0}
                                  color="#000000"
                                />
                                {filterClienteOptionsMemo.map((c: any) => (
                                  <Picker.Item key={c.id} label={c.nombre} value={c.id} color="#000000" />
                                ))}
                              </Picker>
                            </View>
                          </ThemedView>
                          <ThemedView style={styles.filterGroup}>
                            <ThemedText style={styles.filterLabel}>División</ThemedText>
                            <View style={styles.pickerWrapper}>
                              <Picker
                                enabled={filterClienteId != null && filterDivisionOptionsMemo.length > 0}
                                selectedValue={filterDivisionId ?? 0}
                                onValueChange={(v) => {
                                  const next = Number(v) || 0;
                                  setFilterDivisionId(next === 0 ? null : next);
                                  setFilterContratoId(null);
                                  setFilterSucursalId(null);
                                  filterSucursalIdRef.current = null;
                                }}
                                style={styles.picker}
                              >
                                <Picker.Item
                                  label={filterClienteId ? 'Seleccione división...' : 'Seleccione cliente primero'}
                                  value={0}
                                  color="#000000"
                                />
                                {filterDivisionOptionsMemo.map((d: any) => (
                                  <Picker.Item key={d.id} label={d.nombre} value={d.id} color="#000000" />
                                ))}
                              </Picker>
                            </View>
                          </ThemedView>
                          <ThemedView style={styles.filterGroup}>
                            <ThemedText style={styles.filterLabel}>Contrato</ThemedText>
                            <View style={styles.pickerWrapper}>
                              <Picker
                                enabled={filterDivisionId != null && filterContratoOptionsMemo.length > 0}
                                selectedValue={filterContratoId ?? 0}
                                onValueChange={(v) => {
                                  const next = Number(v) || 0;
                                  setFilterContratoId(next === 0 ? null : next);
                                  setFilterSucursalId(null);
                                  filterSucursalIdRef.current = null;
                                }}
                                style={styles.picker}
                              >
                                <Picker.Item
                                  label={filterDivisionId ? 'Seleccione contrato...' : 'Seleccione división primero'}
                                  value={0}
                                  color="#000000"
                                />
                                {filterContratoOptionsMemo.map((c: any) => (
                                  <Picker.Item key={c.id} label={c.nombre} value={c.id} color="#000000" />
                                ))}
                              </Picker>
                            </View>
                          </ThemedView>
                          <ThemedView style={styles.filterGroup}>
                            <ThemedText style={styles.filterLabel}>Sucursal (corpo)</ThemedText>
                            <View style={styles.pickerWrapper}>
                              <Picker
                                enabled={filterContratoId != null && filterSucursalOptionsMemo.length > 0}
                                selectedValue={filterSucursalId ?? 0}
                                onValueChange={(v) => {
                                  const next = Number(v) || 0;
                                  const nextSuc = next === 0 ? null : next;
                                  filterSucursalIdRef.current = nextSuc;
                                  setFilterSucursalId(nextSuc);
                                  void fetchRecords();
                                }}
                                style={styles.picker}
                              >
                                <Picker.Item
                                  label={filterContratoId ? 'Seleccione sucursal...' : 'Seleccione contrato primero'}
                                  value={0}
                                  color="#000000"
                                />
                                {filterSucursalOptionsMemo.map((s: any) => (
                                  <Picker.Item key={s.id} label={s.nombre} value={s.id} color="#000000" />
                                ))}
                              </Picker>
                            </View>
                          </ThemedView>
                        </>
                      )}
                    </>
                  ) : null}

                  <ThemedView style={styles.filterGroupSearch}>
                    <ThemedText style={styles.filterLabel}>Buscar (placa/marca/oficial):</ThemedText>
                    <TextInput
                      style={styles.searchInput}
                      value={filterSearch}
                      onChangeText={setFilterSearch}
                      placeholder="Ej: ABC123 / Toyota / Juan"
                      placeholderTextColor="#999"
                    />
                  </ThemedView>

                  <ThemedView style={styles.filterGroupSearch}>
                    <ThemedText style={styles.filterLabel}>Tipo:</ThemedText>
                    <ThemedView style={styles.pickerContainer}>
                      <Picker
                        selectedValue={filterTipo}
                        onValueChange={(v) => setFilterTipo(v as any)}
                        style={styles.picker}
                      >
                        <Picker.Item label="Todos los tipos" value="all" color="#000000" />
                        {TYPE_OPTIONS.map((t) => (
                          <Picker.Item key={t} label={t} value={t} color="#000000" />
                        ))}
                      </Picker>
                    </ThemedView>
                  </ThemedView>

                  <ThemedView style={styles.filterGroupSearch}>
                    <ThemedText style={styles.filterLabel}>Fecha de registro:</ThemedText>
                    <TouchableOpacity
                      style={styles.dateButton}
                      onPress={() => setShowFilterFechaPicker(true)}
                    >
                      <ThemedText style={styles.dateButtonText}>
                        {filterFecha ? formatYMDToDMY(filterFecha) : 'Seleccionar fecha'}
                      </ThemedText>
                      <Ionicons name="calendar-outline" size={18} color="#007AFF" />
                    </TouchableOpacity>
                  </ThemedView>
                </ThemedView>
              )}
            </ThemedView>
          )}

          {!isCreating && (
            <TouchableOpacity style={styles.createButton} onPress={startCreating}>
              <ThemedText style={styles.createButtonText}>
                <Ionicons name="add" size={20} color="#FFFFFF" /> Nuevo registro
              </ThemedText>
            </TouchableOpacity>
          )}

          {isCreating && (
            <ThemedView style={styles.formCard}>
              <ThemedText style={styles.formTitle}>
                {editing ? 'Editar registro' : 'Nuevo registro'}
              </ThemedText>

              {roleName != null && roleName !== 'OPERATIVO' ? (
                <ThemedView style={{ marginBottom: 12 }}>
                  <ThemedText style={styles.sectionTitle}>Ubicación del registro</ThemedText>
                  {isStructureLoading ? (
                    <ThemedText style={[styles.emptyText, { marginBottom: 8 }]}>
                      Cargando estructura...
                    </ThemedText>
                  ) : null}
                  {structure.length === 0 ? (
                    <ThemedText style={[styles.emptyText, { marginBottom: 8 }]}>
                      Sin estructura en caché. Los valores se mostrarán al terminar la carga.
                    </ThemedText>
                  ) : null}
                  <>
                      <ThemedText style={styles.filterLabel}>Empresa</ThemedText>
                      <View style={styles.pickerWrapper}>
                        <Picker
                          enabled={!prefillFormHierarchyLocked && !isStructureLoading}
                          selectedValue={formEmpresaId ?? 0}
                          onValueChange={(v) => {
                            const next = Number(v) || 0;
                            handleFormEmpresaChange(next === 0 ? null : next);
                            setSelectedCorporateVehicleId(null);
                            setSelectedCorporateVehicleIdLocal(null);
                            setSelectedCorporateUseId(null);
                            setSelectedCorporateUseIdLocal(null);
                          }}
                          style={styles.picker}
                        >
                          <Picker.Item label="Seleccione empresa..." value={0} color="#000000" />
                          {structure.map((e: any) => (
                            <Picker.Item key={e.id} label={e.nombre} value={e.id} color="#000000" />
                          ))}
                        </Picker>
                      </View>
                      <ThemedText style={styles.filterLabel}>Cliente</ThemedText>
                      <View style={styles.pickerWrapper}>
                        <Picker
                          enabled={
                            !prefillFormHierarchyLocked &&
                            !isStructureLoading &&
                            formEmpresaId != null &&
                            formClienteOptions.length > 0
                          }
                          selectedValue={formClienteId ?? 0}
                          onValueChange={(v) => {
                            const next = Number(v) || 0;
                            handleFormClienteChange(next === 0 ? null : next);
                            setSelectedCorporateVehicleId(null);
                            setSelectedCorporateVehicleIdLocal(null);
                            setSelectedCorporateUseId(null);
                            setSelectedCorporateUseIdLocal(null);
                          }}
                          style={styles.picker}
                        >
                          <Picker.Item
                            label={formEmpresaId ? 'Seleccione cliente...' : 'Empresa primero'}
                            value={0}
                            color="#000000"
                          />
                          {formClienteOptions.map((c: { id: number; nombre: string }) => (
                            <Picker.Item key={c.id} label={c.nombre} value={c.id} color="#000000" />
                          ))}
                        </Picker>
                      </View>
                      <ThemedText style={styles.filterLabel}>División</ThemedText>
                      <View style={styles.pickerWrapper}>
                        <Picker
                          enabled={
                            !prefillFormHierarchyLocked &&
                            !isStructureLoading &&
                            formClienteId != null &&
                            formDivisionOptions.length > 0
                          }
                          selectedValue={formDivisionId ?? 0}
                          onValueChange={(v) => {
                            const next = Number(v) || 0;
                            handleFormDivisionChange(next === 0 ? null : next);
                            setSelectedCorporateVehicleId(null);
                            setSelectedCorporateVehicleIdLocal(null);
                            setSelectedCorporateUseId(null);
                            setSelectedCorporateUseIdLocal(null);
                          }}
                          style={styles.picker}
                        >
                          <Picker.Item
                            label={formClienteId ? 'Seleccione división...' : 'Cliente primero'}
                            value={0}
                            color="#000000"
                          />
                          {formDivisionOptions.map((d: { id: number; nombre: string }) => (
                            <Picker.Item key={d.id} label={d.nombre} value={d.id} color="#000000" />
                          ))}
                        </Picker>
                      </View>
                      <ThemedText style={styles.filterLabel}>Contrato</ThemedText>
                      <View style={styles.pickerWrapper}>
                        <Picker
                          enabled={
                            !prefillFormHierarchyLocked &&
                            !isStructureLoading &&
                            formDivisionId != null &&
                            formContratoOptions.length > 0
                          }
                          selectedValue={formContratoId ?? 0}
                          onValueChange={(v) => {
                            const next = Number(v) || 0;
                            handleFormContratoChange(next === 0 ? null : next);
                            setSelectedCorporateVehicleId(null);
                            setSelectedCorporateVehicleIdLocal(null);
                            setSelectedCorporateUseId(null);
                            setSelectedCorporateUseIdLocal(null);
                          }}
                          style={styles.picker}
                        >
                          <Picker.Item
                            label={formDivisionId ? 'Seleccione contrato...' : 'División primero'}
                            value={0}
                            color="#000000"
                          />
                          {formContratoOptions.map((c: { id: number; nombre: string }) => (
                            <Picker.Item key={c.id} label={c.nombre} value={c.id} color="#000000" />
                          ))}
                        </Picker>
                      </View>
                      <ThemedText style={styles.filterLabel}>Sucursal (corpo)</ThemedText>
                      <View style={styles.pickerWrapper}>
                        <Picker
                          enabled={
                            !prefillFormHierarchyLocked &&
                            !isStructureLoading &&
                            formContratoId != null &&
                            formSucursalOptions.length > 0
                          }
                          selectedValue={formSucursalId ?? 0}
                          onValueChange={(v) => {
                            const next = Number(v) || 0;
                            setFormSucursalId(next === 0 ? null : next);
                            setFormPuestoId(null);
                            setSelectedCorporateVehicleId(null);
                            setSelectedCorporateVehicleIdLocal(null);
                            setSelectedCorporateUseId(null);
                            setSelectedCorporateUseIdLocal(null);
                          }}
                          style={styles.picker}
                        >
                          <Picker.Item
                            label={formContratoId ? 'Seleccione sucursal...' : 'Contrato primero'}
                            value={0}
                            color="#000000"
                          />
                          {formSucursalOptions.map((s: { id: number; nombre: string }) => (
                            <Picker.Item key={s.id} label={s.nombre} value={s.id} color="#000000" />
                          ))}
                        </Picker>
                      </View>
                      <ThemedText style={styles.filterLabel}>Puesto</ThemedText>
                      <View style={styles.pickerWrapper}>
                        <Picker
                          enabled={
                            !prefillFormHierarchyLocked &&
                            !isStructureLoading &&
                            formSucursalId != null &&
                            formPuestoOptions.length > 0
                          }
                          selectedValue={formPuestoId ?? 0}
                          onValueChange={(v) => {
                            const next = Number(v) || 0;
                            setFormPuestoId(next === 0 ? null : next);
                          }}
                          style={styles.picker}
                        >
                          <Picker.Item
                            label={formSucursalId ? 'Seleccione puesto...' : 'Sucursal primero'}
                            value={0}
                            color="#000000"
                          />
                          {formPuestoOptions.map((p: { id: number; nombre: string }) => (
                            <Picker.Item key={p.id} label={p.nombre} value={p.id} color="#000000" />
                          ))}
                        </Picker>
                      </View>
                  </>
                </ThemedView>
              ) : null}

              <ThemedText style={styles.sectionTitle}>Vinculación (Vehículos corporativos)</ThemedText>

              {isPrefillMode && prefillVehicleInfo ? (
                <>
                  <ThemedView style={styles.row}>
                    <ThemedText style={styles.label}>Vehículo corporativo</ThemedText>
                    <ThemedText style={styles.readonlyValue}>
                      {prefillVehicleInfo.vehiculo ? `${String(prefillVehicleInfo.vehiculo.placa || '—')} (${String(prefillVehicleInfo.vehiculo.tipo || '—')})` : '—'}
                    </ThemedText>
                  </ThemedView>
                  <ThemedView style={styles.row}>
                    <ThemedText style={styles.label}>Uso</ThemedText>
                    <ThemedText style={styles.readonlyValue}>
                      {prefillVehicleInfo.uso ? `${String(prefillVehicleInfo.uso.nombre_conductor || '—')} - ${String(prefillVehicleInfo.uso.fecha || '').slice(0, 10)}` : '—'}
                    </ThemedText>
                  </ThemedView>
                </>
              ) : (
                <>
                  <ThemedText style={styles.label}>Vehículo corporativo</ThemedText>
                  <ThemedView style={styles.pickerContainer}>
                    <Picker
                        selectedValue={
                          selectedCorporateVehicleIdLocal ??
                          (selectedCorporateVehicleId != null && selectedCorporateVehicleId > 0
                            ? String(selectedCorporateVehicleId)
                            : '0')
                        }
                        onValueChange={async (v) => {
                          const s = String(v);
                          if (!s || s === '0') {
                            setSelectedCorporateVehicleId(null);
                            setSelectedCorporateVehicleIdLocal(null);
                            setSelectedCorporateUseId(null);
                            setSelectedCorporateUseIdLocal(null);
                            return;
                          }
                          const localKey = resolveLocalEntityKey(s);
                          if (localKey) {
                            setSelectedCorporateVehicleIdLocal(localKey);
                            setSelectedCorporateVehicleId(null);
                          } else {
                            setSelectedCorporateVehicleIdLocal(null);
                            setSelectedCorporateVehicleId(Number(s));
                          }
                          setSelectedCorporateUseId(null);
                          setSelectedCorporateUseIdLocal(null);

                          const selectedVehicle =
                            corporateVehicles.find((veh: any) => String(veh.id ?? veh.id_local) === s) ||
                            (tempVehicle && String(tempVehicle.id ?? tempVehicle.id_local) === s ? tempVehicle : null);

                          // Si se deselecciona el vehículo, no hacemos nada más
                          if (!selectedVehicle) {
                            return;
                          }

                          if (selectedVehicle) {
                            // Establecer automáticamente el tipo basándose en el tipo del vehículo seleccionado
                            if (selectedVehicle.tipo) {
                              const vehicleTipo = String(selectedVehicle.tipo).trim();
                              // Verificar si el tipo del vehículo coincide con uno de los tipos válidos
                              if (TYPE_OPTIONS.includes(vehicleTipo as TipoBitacora)) {
                                const tipoToSet = vehicleTipo as TipoBitacora;
                                setTipo(tipoToSet);
                                tipoRef.current = tipoToSet;
                                // Si no estamos editando, resetear el formulario con el nuevo tipo
                                if (!editing) {
                                  await resetForm(tipoToSet);
                                }
                              }
                            }

                            // Autocompletar información adicional del vehículo
                          const kmVal = selectedVehicle.kilometraje;
                          const proxAceiteVal = selectedVehicle.prox_cambio_aceite;
                          const modeloVal = selectedVehicle.modelo;
                          const annoVal = selectedVehicle.anno;
                          const marcaVal = selectedVehicle.marca;
                          const tipoAutoriaVal = selectedVehicle.tipo_autoria;

                            setVehKilometraje(
                              kmVal !== null && kmVal !== undefined ? String(kmVal) : ''
                            );
                            setVehProxCambioAceite(
                              proxAceiteVal !== null && proxAceiteVal !== undefined
                                ? String(proxAceiteVal)
                                : ''
                            );
                            setVehModelo(
                              modeloVal !== null && modeloVal !== undefined ? String(modeloVal) : ''
                            );
                            setVehAnno(
                              annoVal !== null && annoVal !== undefined ? String(annoVal) : ''
                            );
                            if (marcaVal !== null && marcaVal !== undefined && String(marcaVal).trim() !== '') {
                              setGeneralValues((prev) => ({ ...prev, marca: String(marcaVal) }));
                            }
                          if (tipoAutoriaVal === 'Cliente' || tipoAutoriaVal === 'Corporativo') {
                            setVehTipoAutoria(String(tipoAutoriaVal));
                          } else {
                            setVehTipoAutoria('');
                          }

                            // Documentos
                            if (
                              selectedVehicle.titulo_propiedad === true ||
                              selectedVehicle.titulo_propiedad === false
                            ) {
                              setVehTituloPropiedad(selectedVehicle.titulo_propiedad);
                            } else {
                              setVehTituloPropiedad(null);
                            }

                            if (selectedVehicle.rtv === true || selectedVehicle.rtv === false) {
                              setVehRTV(selectedVehicle.rtv);
                            } else {
                              setVehRTV(null);
                            }

                            if (
                              selectedVehicle.marchamo === true ||
                              selectedVehicle.marchamo === false
                            ) {
                              setVehMarchamo(selectedVehicle.marchamo);
                            } else {
                              setVehMarchamo(null);
                            }
                          }
                        }}
                        style={styles.picker}
                        enabled={!isPrefillMode && !isLoadingVehicles}
                      >
                        <Picker.Item
                          label={isLoadingVehicles ? 'Cargando vehículos...' : 'Seleccione...'}
                          value="0"
                          color="#000000"
                        />
                        {corporateVehicles.map((v: any) => (
                          <Picker.Item
                            key={`veh_${v.id ?? v.id_local}`}
                            label={`${String(v.placa || '—')} (${String(v.tipo || '—')})${v.synced === false ? ' (offline)' : ''}`}
                            value={String(v.id ?? v.id_local)}
                            color="#000000"
                          />
                        ))}
                        {tempVehicle &&
                          !corporateVehicles.find(
                            (v: any) => String(v.id ?? v.id_local) === String(tempVehicle.id ?? tempVehicle.id_local)
                          ) && (
                          <Picker.Item
                            key={`veh_temp_${tempVehicle.id ?? tempVehicle.id_local}`}
                            label={`${String(tempVehicle.placa || '—')} (${String(tempVehicle.tipo || '—')})`}
                            value={String(tempVehicle.id ?? tempVehicle.id_local)}
                            color="#000000"
                          />
                        )}
                      </Picker>
                  </ThemedView>
                  {!isLoadingVehicles &&
                    !!(formSucursalId || marcaCorpoId) &&
                    corporateVehicles.length === 0 &&
                    !tempVehicle && (
                      <ThemedText style={styles.pickerEmptyHint}>No hay vehículos disponibles</ThemedText>
                    )}

                  <ThemedText style={styles.label}>Uso (solo sin bitácora)</ThemedText>
                  <ThemedView style={styles.pickerContainer}>
                    <Picker
                      selectedValue={
                        selectedCorporateUseIdLocal ??
                        (selectedCorporateUseId != null && selectedCorporateUseId > 0
                          ? String(selectedCorporateUseId)
                          : '0')
                      }
                      onValueChange={(v) => {
                        const s = String(v);
                        if (!s || s === '0') {
                          setSelectedCorporateUseId(null);
                          setSelectedCorporateUseIdLocal(null);
                          return;
                        }
                        const localKey = resolveLocalEntityKey(s);
                        if (localKey) {
                          setSelectedCorporateUseIdLocal(localKey);
                          setSelectedCorporateUseId(null);
                        } else {
                          setSelectedCorporateUseIdLocal(null);
                          setSelectedCorporateUseId(Number(s));
                        }
                      }}
                      style={styles.picker}
                      enabled={
                        !isPrefillMode &&
                        !!(selectedCorporateVehicleId ?? selectedCorporateVehicleIdLocal)
                      }
                    >
                      <Picker.Item
                        label={
                          selectedCorporateVehicleId || selectedCorporateVehicleIdLocal
                            ? 'Seleccione...'
                            : 'Seleccione vehículo primero'
                        }
                        value="0"
                        color="#000000"
                      />
                      {availableCorporateUses.map((u: any) => {
                        const label = `${String(u.nombre_conductor || '—')} - ${String(u.fecha || '').slice(0, 10)}${u.synced === false ? ' (offline)' : ''}`;
                        return (
                          <Picker.Item
                            key={`uso_${u.id ?? u.id_local}`}
                            label={label}
                            value={String(u.id ?? u.id_local)}
                            color="#000000"
                          />
                        );
                      })}
                    </Picker>
                  </ThemedView>
                  {(selectedCorporateVehicleId || selectedCorporateVehicleIdLocal) &&
                    availableCorporateUses.length === 0 && (
                      <ThemedText style={styles.pickerEmptyHint}>
                        No hay registros de uso disponibles
                      </ThemedText>
                    )}
                </>
              )}

              {/* Tipo */}
              <ThemedText style={styles.label}>Tipo *</ThemedText>
              <ThemedView style={styles.pickerContainer}>
                <Picker
                  selectedValue={tipo}
                  onValueChange={(v) => {
                    if (selectedCorporateVehicleId || selectedCorporateVehicleIdLocal) return;
                    const next = v as TipoBitacora;
                    if (editing) {
                      setTipo(next);
                      tipoRef.current = next;
                      if (isTipoBicicleta(next)) {
                        setGeneralValues((prev) => ({ ...prev, numero_placa: '' }));
                        clearVehiculoInfoCamposNoBicicleta({
                          setVehKilometraje,
                          setVehProxCambioAceite,
                          setVehModelo,
                          setVehAnno,
                          setVehTituloPropiedad,
                          setVehRTV,
                          setVehMarchamo,
                        });
                      }
                      return;
                    }
                    resetForm(next);
                  }}
                  style={styles.picker}
                  enabled={!isPrefillMode && !selectedCorporateVehicleId && !selectedCorporateVehicleIdLocal}
                >
                  {TYPE_OPTIONS.map((t) => (
                    <Picker.Item key={t} label={t} value={t} color="#000000" />
                  ))}
                </Picker>
              </ThemedView>
              {(selectedCorporateVehicleId || selectedCorporateVehicleIdLocal) && (
                <ThemedText style={styles.infoText}>
                  El tipo se establece automáticamente según el vehículo seleccionado
                </ThemedText>
              )}

              {/* Información adicional del vehículo (opcional) */}
              <ThemedView style={styles.vehicleExtraContainer}>
                {/* Checkbox "Registrar vehículo" solo si NO hay vehículo seleccionado */}
                {!selectedCorporateVehicleId && !selectedCorporateVehicleIdLocal && (
                  <TouchableOpacity
                    style={styles.registerVehicleRow}
                    onPress={() => setShouldRegisterVehicle((prev) => !prev)}
                  >
                    <View style={styles.checkboxOuter}>
                      {shouldRegisterVehicle && <View style={styles.checkboxInner} />}
                    </View>
                    <ThemedText style={styles.registerVehicleLabel}>Registrar vehículo</ThemedText>
                  </TouchableOpacity>
                )}

                <ThemedText style={styles.sectionSubtitle}>
                  Información del vehículo{shouldRegisterVehicle ? '' : ' (opcional)'}
                </ThemedText>

                {!isTipoBicicleta(tipo) ? (
                  <>
                    <ThemedView style={styles.row}>
                      <ThemedText style={styles.label}>Kilometraje</ThemedText>
                      <TextInput
                        style={styles.input}
                        value={vehKilometraje}
                        onChangeText={setVehKilometraje}
                        placeholder="Kilometraje"
                        placeholderTextColor="#999"
                        keyboardType="numeric"
                      />
                    </ThemedView>

                    <ThemedView style={styles.row}>
                      <ThemedText style={styles.label}>Próximo cambio de aceite</ThemedText>
                      <TextInput
                        style={styles.input}
                        value={vehProxCambioAceite}
                        onChangeText={setVehProxCambioAceite}
                        placeholder="Próximo cambio de aceite"
                        placeholderTextColor="#999"
                        keyboardType="numeric"
                      />
                    </ThemedView>

                    <ThemedView style={styles.row}>
                      <ThemedText style={styles.label}>Modelo</ThemedText>
                      <TextInput
                        style={styles.input}
                        value={vehModelo}
                        onChangeText={setVehModelo}
                        placeholder="Modelo"
                        placeholderTextColor="#999"
                      />
                    </ThemedView>

                    <ThemedView style={styles.row}>
                      <ThemedText style={styles.label}>Año</ThemedText>
                      <TextInput
                        style={styles.input}
                        value={vehAnno}
                        onChangeText={setVehAnno}
                        placeholder="Año"
                        placeholderTextColor="#999"
                        keyboardType="numeric"
                      />
                    </ThemedView>
                  </>
                ) : null}

                <ThemedView style={styles.row}>
                  <ThemedText style={styles.label}>Tipo de autoría</ThemedText>
                  <ThemedView style={styles.pickerContainer}>
                    <Picker
                      selectedValue={vehTipoAutoria || ''}
                      onValueChange={(v) => setVehTipoAutoria(String(v))}
                      style={styles.picker}
                    >
                      <Picker.Item label="Seleccionar..." value="" color="#000000" />
                      <Picker.Item label="Cliente" value="Cliente" color="#000000" />
                      <Picker.Item label="Corporativo" value="Corporativo" color="#000000"  />
                    </Picker>
                  </ThemedView>
                </ThemedView>

                {!isTipoBicicleta(tipo) ? (
                  <>
                    <ThemedText style={styles.sectionSubtitle}>Documentos (opcional)</ThemedText>

                    <ThemedView style={styles.checkboxGroup}>
                      <TouchableOpacity
                        style={styles.checkboxRow}
                        onPress={() =>
                          setVehTituloPropiedad((prev) =>
                            prev === null ? true : !prev
                          )
                        }
                      >
                        <View style={styles.checkboxOuter}>
                          {vehTituloPropiedad && <View style={styles.checkboxInner} />}
                        </View>
                        <ThemedText style={styles.checkboxLabel}>Título propiedad</ThemedText>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.checkboxRow}
                        onPress={() =>
                          setVehRTV((prev) =>
                            prev === null ? true : !prev
                          )
                        }
                      >
                        <View style={styles.checkboxOuter}>
                          {vehRTV && <View style={styles.checkboxInner} />}
                        </View>
                        <ThemedText style={styles.checkboxLabel}>RTV</ThemedText>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.checkboxRow}
                        onPress={() =>
                          setVehMarchamo((prev) =>
                            prev === null ? true : !prev
                          )
                        }
                      >
                        <View style={styles.checkboxOuter}>
                          {vehMarchamo && <View style={styles.checkboxInner} />}
                        </View>
                        <ThemedText style={styles.checkboxLabel}>Marchamo</ThemedText>
                      </TouchableOpacity>
                    </ThemedView>
                  </>
                ) : null}
              </ThemedView>

              {/* Formulario dinámico - información general */}
              <ThemedText style={styles.sectionTitle}>Información general</ThemedText>
              {generalConfig.map((f) => {
                if (f.key === 'numero_placa' && isTipoBicicleta(tipo)) {
                  return null;
                }
                let value = '';
                if (f.kind === 'readonly') {
                  if (f.key === 'empresa') {
                    value = empresaNombre || generalValues.empresa || '';
                  } else if (f.key === 'cliente') {
                    value = clienteNombre || generalValues.cliente || '';
                  } else if (f.key === 'corpo') {
                    value = corpoNombre || generalValues.corpo || '';
                  }
                } else {
                  value = generalValues[f.key] ?? '';
                }

                if (f.kind === 'readonly') {
                  return (
                    <ThemedView key={f.key} style={styles.row}>
                      <ThemedText style={styles.label}>{f.label}</ThemedText>
                      <ThemedText style={styles.readonlyValue}>{String(value || '')}</ThemedText>
                    </ThemedView>
                  );
                }

                if (f.kind === 'signature') {
                  const sig = formatSignatureForDisplay(generalValues[f.key]);
                  return (
                    <ThemedView key={f.key} style={styles.row}>
                      <ThemedText style={styles.label}>{f.label}{f.required ? ' *' : ''}</ThemedText>
                      {!sig ? (
                        <TouchableOpacity
                          style={styles.drawSignatureButton}
                          onPress={() => openSignatureModal(f.key)}
                        >
                          <Ionicons name="create-outline" size={24} color="#007AFF" />
                          <ThemedText style={styles.drawSignatureButtonText}>Toca para dibujar la firma</ThemedText>
                        </TouchableOpacity>
                      ) : (
                        <ThemedView style={styles.drawSignaturePreviewContainer}>
                          <Image source={{ uri: sig }} style={styles.drawSignaturePreview} />
                          <TouchableOpacity
                            style={styles.drawSignatureClearButton}
                            onPress={() => setGeneralValues((prev) => ({ ...prev, [f.key]: '' }))}
                          >
                            <Ionicons name="trash" size={16} color="#FF3B30" />
                            <ThemedText style={styles.drawSignatureClearButtonText}>Eliminar Firma</ThemedText>
                          </TouchableOpacity>
                        </ThemedView>
                      )}
                    </ThemedView>
                  );
                }

                if (f.kind === 'date') {
                  return (
                    <ThemedView key={f.key} style={styles.row}>
                      <ThemedText style={styles.label}>{f.label}{f.required ? ' *' : ''}</ThemedText>
                      <TouchableOpacity style={styles.dateButton} onPress={() => openDatePicker(f.key, value)}>
                        <ThemedText style={styles.dateButtonText}>{value ? formatYMDToDMY(String(value)) : 'Seleccionar fecha'}</ThemedText>
                        <Ionicons name="calendar-outline" size={18} color="#007AFF" />
                      </TouchableOpacity>
                    </ThemedView>
                  );
                }

                if (f.kind === 'time') {
                  return (
                    <ThemedView key={f.key} style={styles.row}>
                      <ThemedText style={styles.label}>{f.label}{f.required ? ' *' : ''}</ThemedText>
                      <TouchableOpacity style={styles.dateButton} onPress={() => openTimePicker(f.key, value)}>
                        <ThemedText style={styles.dateButtonText}>{value || 'Seleccionar hora'}</ThemedText>
                        <Ionicons name="time-outline" size={18} color="#007AFF" />
                      </TouchableOpacity>
                    </ThemedView>
                  );
                }

                if (f.kind === 'select') {
                  return (
                    <ThemedView key={f.key} style={styles.row}>
                      <ThemedText style={styles.label}>{f.label}{f.required ? ' *' : ''}</ThemedText>
                      <ThemedView style={styles.pickerContainer}>
                        <Picker
                          selectedValue={String(value)}
                          onValueChange={(v) => setGeneralValues((prev) => ({ ...prev, [f.key]: String(v) }))}
                          style={styles.picker}
                        >
                          <Picker.Item label="Seleccionar..." value="" />
                          {(f.options || []).map((o) => (
                            <Picker.Item key={o} label={o} value={o} color="#000000" />
                          ))}
                        </Picker>
                      </ThemedView>
                    </ThemedView>
                  );
                }

                return (
                  <ThemedView key={f.key} style={styles.row}>
                    <ThemedText style={styles.label}>{f.label}{f.required ? ' *' : ''}</ThemedText>
                    <TextInput
                      style={styles.input}
                      value={String(value)}
                      onChangeText={(t) => setGeneralValues((prev) => ({ ...prev, [f.key]: t }))}
                      placeholder={f.label}
                      placeholderTextColor="#999"
                      editable={!isPrefillMode || f.key !== 'numero_placa'}
                    />
                  </ThemedView>
                );
              })}

              {/* Formulario dinámico - información de revisión */}
              <ThemedText style={styles.sectionTitle}>Información de revisión</ThemedText>
              {isEditingBitacoraRecord ? (
                <ThemedView style={styles.revisionEditHintBox}>
                  <Ionicons name="information-circle-outline" size={20} color="#007AFF" />
                  <ThemedText style={styles.revisionEditHintText}>
                    Las fotos ya guardadas se consultan y eliminan desde la lista principal (botón «Ver detalles»).
                    Aquí solo puede agregar fotos nuevas; al guardar, se sumarán a las existentes sin borrarlas.
                  </ThemedText>
                </ThemedView>
              ) : null}
              {revisionConfig.map((r) => {
                if (r.kind === 'heading') {
                  return (
                    <ThemedText key={r.key} style={styles.heading}>
                      {r.label}
                    </ThemedText>
                  );
                }

                if (r.kind === 'radio') {
                  const val = revisionValues[r.key] as YesNo | '';
                  return (
                    <ThemedView key={r.key}>
                      <ThemedView style={styles.row}>
                        <ThemedText style={styles.label}>{r.label}{r.required ? ' *' : ''}</ThemedText>
                        <ThemedView style={styles.radioGroup}>
                          {(['Sí', 'No'] as YesNo[]).map((opt) => (
                            <TouchableOpacity
                              key={opt}
                              style={[styles.radioOption, val === opt && styles.radioOptionSelected]}
                              onPress={() => setRevisionValues((prev) => ({ ...prev, [r.key]: opt }))}
                            >
                              <Ionicons
                                name={val === opt ? 'radio-button-on' : 'radio-button-off'}
                                size={18}
                                color={val === opt ? '#007AFF' : '#999999'}
                              />
                              <ThemedText style={[styles.radioOptionText, val === opt && styles.radioOptionTextSelected]}>
                                {opt}
                              </ThemedText>
                            </TouchableOpacity>
                          ))}
                        </ThemedView>
                      </ThemedView>
                      {renderRevisionPhotoSection(r.key)}
                    </ThemedView>
                  );
                }

                if (r.kind === 'text') {
                  return (
                    <ThemedView key={r.key}>
                      <ThemedView style={styles.row}>
                        <ThemedText style={styles.label}>{r.label}</ThemedText>
                        <TextInput
                          style={styles.input}
                          value={String(revisionValues[r.key] ?? '')}
                          onChangeText={(t) => setRevisionValues((prev) => ({ ...prev, [r.key]: t }))}
                          placeholder={r.label}
                          placeholderTextColor="#999"
                        />
                      </ThemedView>
                      {renderRevisionPhotoSection(r.key)}
                    </ThemedView>
                  );
                }

                // select
                const val = revisionValues[r.key] as ReviewStatus | '';
                return (
                  <ThemedView key={r.key}>
                    <ThemedView style={styles.row}>
                      <ThemedText style={styles.label}>{r.label}{r.required ? ' *' : ''}</ThemedText>
                      <ThemedView style={styles.pickerContainer}>
                        <Picker
                          selectedValue={String(val)}
                          onValueChange={(v) => setRevisionValues((prev) => ({ ...prev, [r.key]: String(v) }))}
                          style={styles.picker}
                        >
                          {REVIEW_OPTIONS.map((o) => (
                            <Picker.Item key={o} label={o} value={o} color="#000000" />
                          ))}
                        </Picker>
                      </ThemedView>
                      {r.withObservation && (
                        <TextInput
                          style={styles.input}
                          value={revisionObs[`${r.key}__obs`] ?? ''}
                          onChangeText={(t) => setRevisionObs((prev) => ({ ...prev, [`${r.key}__obs`]: t }))}
                          placeholder="Observaciones (Opcional)"
                          placeholderTextColor="#999"
                        />
                      )}
                    </ThemedView>
                    {renderRevisionPhotoSection(r.key)}
                  </ThemedView>
                );
              })}

              {/* Movimientos (después de formularios dinámicos) */}
              <ThemedText style={styles.sectionTitle}>Movimientos de vehículos</ThemedText>
              {movimientos.map((m, idx) => (
                <ThemedView key={idx} style={styles.movementCard}>
                  <TouchableOpacity
                    style={styles.movementHeader}
                    onPress={() => updateMovimiento(idx, { _expanded: !m._expanded })}
                  >
                    <ThemedText style={styles.movementTitle}>Movimiento #{idx + 1}</ThemedText>
                    <Ionicons name={m._expanded ? 'chevron-up' : 'chevron-down'} size={20} color="#007AFF" />
                  </TouchableOpacity>
                  {m._expanded && (
                    <>
                      <TextInput
                        style={styles.input}
                        value={m.movimiento}
                        onChangeText={(t) => updateMovimiento(idx, { movimiento: t })}
                        placeholder="Movimiento (Descripción)"
                        placeholderTextColor="#999"
                      />
                      <TouchableOpacity
                        style={styles.dateButton}
                        onPress={async () => {
                          const horaAccion = await getHoraAccion();
                          if (!horaAccion) {
                            Alert.alert('Error', 'No se pudo obtener la hora');
                            return;
                          }
                          setDatePickerKey(`mov_${idx}`);
                          setDatePickerValue(new Date(horaAccion));
                          setShowDatePicker(true);
                        }}
                      >
                        <ThemedText style={styles.dateButtonText}>Fecha: {m.fecha ? formatYMDToDMY(m.fecha) : 'Seleccionar'}</ThemedText>
                        <Ionicons name="calendar-outline" size={18} color="#007AFF" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.dateButton}
                        onPress={async () => {
                          const horaAccion = await getHoraAccion();
                          if (!horaAccion) {
                            Alert.alert('Error', 'No se pudo obtener la hora');
                            return;
                          }
                          setTimePickerKey(`mov_${idx}`);
                          setTimePickerValue(new Date(horaAccion));
                          setShowTimePicker(true);
                        }}
                      >
                        <ThemedText style={styles.dateButtonText}>Hora: {m.hora || 'Seleccionar'}</ThemedText>
                        <Ionicons name="time-outline" size={18} color="#007AFF" />
                      </TouchableOpacity>
                      <TextInput
                        style={styles.input}
                        value={m.realizado_por}
                        onChangeText={(t) => updateMovimiento(idx, { realizado_por: t })}
                        placeholder="Realizado por"
                        placeholderTextColor="#999"
                      />
                      <TextInput
                        style={styles.input}
                        value={m.autorizado_por}
                        onChangeText={(t) => updateMovimiento(idx, { autorizado_por: t })}
                        placeholder="Autorizado por"
                        placeholderTextColor="#999"
                      />
                      <TouchableOpacity style={styles.actionCardButtonDangerFull} onPress={() => removeMovimiento(idx)}>
                        <Ionicons name="trash" size={18} color="#FF3B30" />
                        <ThemedText style={styles.actionCardTextDanger}>Eliminar movimiento</ThemedText>
                      </TouchableOpacity>
                    </>
                  )}
                </ThemedView>
              ))}
              <TouchableOpacity style={styles.actionCardButton} onPress={addMovimiento}>
                <Ionicons name="add-circle-outline" size={18} color="#007AFF" />
                <ThemedText style={styles.actionCardText}>Agregar movimiento</ThemedText>
                <Ionicons name="chevron-forward" size={18} color="#007AFF" />
              </TouchableOpacity>

              {/* Observaciones */}
              <ThemedText style={styles.label}>Observaciones *</ThemedText>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={observaciones}
                onChangeText={setObservaciones}
                placeholder="Observaciones"
                placeholderTextColor="#999"
                multiline
              />

              {/* Firma responsable (al final) */}
              <ThemedText style={styles.sectionTitle}>Firma responsable *</ThemedText>
              <ThemedView style={styles.signatureButtons}>
                <TouchableOpacity
                  style={[styles.signatureButton, isGeneratingFirma && styles.signatureButtonDisabled]}
                  onPress={handleGenerateFirmaResponsable}
                  disabled={isGeneratingFirma}
                >
                  {isGeneratingFirma ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="finger-print" size={18} color="#FFFFFF" />
                      <ThemedText style={styles.signatureButtonText}>Generar</ThemedText>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.signatureButton}
                  onPress={handleScanFirmaResponsable}
                >
                  <Ionicons name="qr-code" size={18} color="#FFFFFF" />
                  <ThemedText style={styles.signatureButtonText}>Escanear QR</ThemedText>
                </TouchableOpacity>
              </ThemedView>
              {!firmaResponsable ? (
                <ThemedText style={styles.signatureHintMuted}>Aún no hay firma responsable.</ThemedText>
              ) : (
                <ThemedView style={styles.firmaInfoBox}>
                  <ThemedView style={{ flex: 1, paddingRight: 10 }}>
                    <ThemedText style={styles.firmaInfoTitle}>Información de la firma:</ThemedText>
                    {(() => {
                      const info = decodeFirmaHash(firmaResponsable);
                      if (!info) {
                        return <ThemedText style={styles.firmaInfoValue}>Formato no decodificable</ThemedText>;
                      }
                      return (
                        <>
                          <ThemedText style={styles.firmaInfoValue}>Sesión: {info.sessionId || 'N/A'}</ThemedText>
                          <ThemedText style={styles.firmaInfoValue}>Empleado: {info.empleadoId || 'N/A'}</ThemedText>
                          <ThemedText style={styles.firmaInfoValue}>Lat: {info.latitud || 'N/A'} | Long: {info.longitud || 'N/A'}</ThemedText>
                          <ThemedText style={styles.firmaInfoValue}>Hora: {info.timestamp || 'N/A'}</ThemedText>
                        </>
                      );
                    })()}
                  </ThemedView>
                  <TouchableOpacity style={styles.firmaClearButtonTiny} onPress={() => setFirmaResponsable('')}>
                    <Ionicons name="trash" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </ThemedView>
              )}

              {submitResponse && (
                <ThemedView style={[styles.responseContainer, submitResponse.type === 'success' ? styles.responseSuccess : styles.responseError]}>
                  <ThemedText style={styles.responseText}>
                    {submitResponse.type === 'success' ? '✓ ' : '✗ '}
                    {submitResponse.message}
                  </ThemedText>
                </ThemedView>
              )}
              <ThemedView style={styles.formActions}>
                <TouchableOpacity 
                  style={[styles.formActionButton, styles.formActionCancel]} 
                  onPress={cancelCreating}
                  disabled={isSubmitting}
                >
                  <Ionicons name="close" size={18} color="#000" />
                  <ThemedText style={styles.formActionCancelText}>Cancelar</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.formActionButton, styles.formActionSave, isSubmitting && styles.buttonDisabled]} 
                  onPress={handleSave}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <View style={styles.formActionSaveInner}>
                      <Ionicons name="checkmark-sharp" size={18} color="#fff" />
                      <Text style={styles.formActionSaveText}>Aceptar</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>
          )}

          {!isCreating && (
            <ThemedView style={styles.listContainer}>
              {isLoading ? (
                <ThemedView style={styles.inlineLoading}>
                  <ActivityIndicator size="small" color="#007AFF" />
                  <ThemedText style={styles.inlineLoadingText}>Cargando registros...</ThemedText>
                </ThemedView>
              ) : filteredBitacoras.length === 0 ? (
                <ThemedView style={styles.emptyContainer}>
                  <ThemedText style={styles.emptyText}>No hay registros.</ThemedText>
                </ThemedView>
              ) : (
                filteredBitacoras.map((b, idx) => renderBitacoraItem(b, idx))
              )}
            </ThemedView>
          )}
        </ThemedView>
      </ScrollView>

      {/* Signature modal */}
      <Modal
        visible={signatureModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setSignatureModalVisible(false)}
      >
        <ThemedView style={styles.drawSignatureModalOverlay}>
          <ThemedView style={styles.drawSignatureModalContainer}>
            <ThemedView style={styles.drawSignatureModalHeader}>
              <ThemedText style={styles.drawSignatureModalTitle}>Firma</ThemedText>
              <TouchableOpacity onPress={() => setSignatureModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </ThemedView>

            <ThemedView style={styles.drawSignatureModalSignatureContainer}>
              <SignatureScreen
                ref={signatureRef}
                onOK={onSignatureOK}
                descriptionText="Dibuja la firma en el área blanca"
                clearText=""
                confirmText=""
                webStyle={signatureWebStyle}
                key={signatureKey}
              />
            </ThemedView>

            <ThemedView style={styles.drawSignatureModalActions}>
              <TouchableOpacity style={styles.drawSignatureModalClearButton} onPress={clearSignatureInModal}>
                <Ionicons name="trash" size={20} color="#000000" />
                <ThemedText style={styles.drawSignatureModalClearButtonText}>Limpiar</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.drawSignatureModalAcceptButton}
                onPress={() => signatureRef.current?.readSignature?.()}
              >
                <Ionicons name="checkmark" size={20} color="#000000" />
                <ThemedText style={styles.drawSignatureModalAcceptButtonText}>Aceptar</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          </ThemedView>
        </ThemedView>
      </Modal>

      {showDatePicker && (
        <DateTimePicker
          value={datePickerValue}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onDatePicked}
        />
      )}
      {showTimePicker && (
        <DateTimePicker
          value={timePickerValue}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onTimePicked}
        />
      )}

      {showFilterFechaPicker && (
        <DateTimePicker
          value={filterFecha ? parseDateStringToDate(filterFecha) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, date) => {
            setShowFilterFechaPicker(false);
            if (date) setFilterFecha(dateToLocalString(date));
          }}
        />
      )}

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
                  const createdAtLabel = formatCambioCreatedAt(row?.created_at);
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
                              {(Array.isArray(parsed) ? parsed : []).map((c: any, idx: number) => {
                                const propName = String(c?.prop ?? '-');
                                const value = formatChangeValue(propName, c?.after);

                                return (
                                  <ThemedText key={`c-${row.id}-${idx}`} style={styles.changeDescription}>
                                    <ThemedText style={{ fontWeight: '800' }}>{propName}: </ThemedText>
                                    {value}
                                  </ThemedText>
                                );
                              })}
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

      <Modal
        visible={cameraVisible}
        animationType="slide"
        onRequestClose={() => setCameraVisible(false)}
      >
        <ThemedView style={{ flex: 1, backgroundColor: '#000' }}>
          <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back">
            <TouchableOpacity
              style={styles.cameraCloseButton}
              onPress={() => setCameraVisible(false)}
            >
              <Ionicons name="close" size={30} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.cameraCaptureButton} onPress={takePictureForRevision}>
              <ThemedView style={styles.cameraCaptureButtonInner} />
            </TouchableOpacity>
          </CameraView>
        </ThemedView>
      </Modal>

      <AppFooter />
      <SlideMenu isVisible={isMenuVisible} onClose={handleMenuClose} onHomePress={handleHomePress} currentRoute="BitacoraVehiculosDetenidos" />
      {QRScannerComponent}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  content: { width: '100%', maxWidth: 800, alignSelf: 'center' },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 16, fontSize: 16, opacity: 0.7 },
  errorText: { color: '#FF3B30', textAlign: 'center', marginBottom: 12 },

  titleContainer: {
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
  },

  filtersMain: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
    overflow: 'hidden',
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F0F0F0',
  },
  filterToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterToggleText: {
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
  filterContent: {
    padding: 12,
    backgroundColor: '#F9F9F9',
    gap: 8,
  },
  filterGroupSearch: {
    marginBottom: 8,
    backgroundColor: '#F9F9F9',
  },
  filterGroup: {
    marginBottom: 10,
  },
  filterHierarchyTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    color: '#007AFF',
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
    color: '#000',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    backgroundColor: '#FFFFFF',
    color: '#000000',
  },

  createButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  primaryButton: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#007AFF', paddingVertical: 12, borderRadius: 8 },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  secondaryButton: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#007AFF', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#fff' },
  secondaryButtonText: { color: '#007AFF', fontWeight: '700' },
  dangerButton: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FF3B30', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, marginTop: 10 },
  dangerButtonText: { color: '#fff', fontWeight: '700' },

  formCard: { marginTop: 12, backgroundColor: '#fff', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#E0E0E0' },
  formTitle: { fontSize: 18, fontWeight: '800', marginBottom: 10, color: '#000' },
  label: { fontSize: 13, fontWeight: '700', marginTop: 10, color: '#333' },
  input: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, backgroundColor: '#fff', color: '#000', marginBottom: 6 },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  pickerContainer: { marginBottom: 6, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, overflow: 'hidden', backgroundColor: '#fff' },
  picker: { height: 50, width: '100%', color: '#000', },
  readonlyValue: { paddingVertical: 10, paddingHorizontal: 10, backgroundColor: '#F5F5F5', borderRadius: 8, color: '#000' },

  sectionTitle: { marginTop: 14, fontSize: 15, fontWeight: '800', color: '#007AFF' },
  sectionSubtitle: { marginTop: 10, fontSize: 13, fontWeight: '700', color: '#555' },
  heading: { marginTop: 12, marginBottom: 4, fontSize: 14, fontWeight: '800', color: '#000' },
  row: { marginTop: 8 },

  // Contenedor extra de información del vehículo
  vehicleExtraContainer: {
    marginTop: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
    gap: 8,
  },
  registerVehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  checkboxOuter: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxInner: {
    width: 12,
    height: 12,
    borderRadius: 2,
    backgroundColor: '#007AFF',
  },
  registerVehicleLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007AFF',
  },

  movementCard: { marginTop: 10, marginBottom: 10, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10, padding: 10, backgroundColor: '#FAFAFA' },
  movementHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  movementTitle: { fontSize: 14, fontWeight: '800', color: '#000' },

  dateButton: { marginBottom: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, backgroundColor: '#fff' },
  dateButtonText: { color: '#000', fontWeight: '600' },

  signatureRow: { marginTop: 8, flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  signatureHint: { marginTop: 6, color: '#34C759', fontWeight: '700' },
  signatureHintMuted: { marginTop: 6, color: '#999' },
  signaturePreviewBox: {
    marginTop: 8,
    width: '100%',
    maxWidth: 260,
    alignSelf: 'flex-start',
    aspectRatio: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signaturePreviewImage: { width: '100%', height: '100%' },

  // Firmas dibujadas (mismo patrón visual que InductionTourRecordScreen)
  drawSignatureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2196F3',
    gap: 8,
    minHeight: 100,
    marginTop: 8,
  },
  drawSignatureButtonText: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '600',
  },
  drawSignaturePreviewContainer: {
    padding: 10,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginTop: 8,
  },
  drawSignaturePreview: {
    width: '100%',
    height: 150,
    resizeMode: 'contain',
    marginBottom: 10,
  },
  drawSignatureClearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    backgroundColor: '#FFEBEE',
    borderRadius: 6,
    gap: 6,
  },
  drawSignatureClearButtonText: {
    fontSize: 12,
    color: '#FF3B30',
    fontWeight: '600',
  },

  actionCardButton: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    gap: 10,
  },
  actionCardText: { flex: 1, color: '#000000', fontWeight: '700' },
  actionCardButtonDanger: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFE1E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FFF5F5',
    gap: 10,
  },
  actionCardButtonDangerFull: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFE1E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FFF5F5',
    gap: 10,
  },
  actionCardTextDanger: { color: '#FF3B30', fontWeight: '800' },

  // Firma responsable (mismo patrón que VoiceNotesScreen)
  signatureButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    backgroundColor: '#fff',
    marginTop: 8,
  },
  signatureButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minWidth: '45%',
  },
  signatureButtonDisabled: {
    backgroundColor: '#999',
  },
  signatureButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },

  // Info firma digital (hash) visible
  firmaInfoBox: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
  },
  firmaInfoTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8, color: '#333' },
  firmaInfoValue: { fontSize: 13, color: '#333', marginBottom: 4 },
  firmaClearButtonTiny: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },

  radioGroup: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 10,
  },
  radioOption: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },

  // Checkboxes reutilizan checkboxOuter/checkboxInner
  checkboxGroup: {
    marginTop: 8,
    gap: 8,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkboxLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  radioOptionSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#EAF4FF',
  },
  radioOptionText: { color: '#000000', fontWeight: '700' },
  radioOptionTextSelected: { color: '#007AFF' },

  formActions: { marginTop: 16, flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  formActionButton: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  formActionCancel: {
    backgroundColor: '#EDEDED',
  },
  formActionCancelText: { color: '#000', fontWeight: '800' },
  formActionSave: {
    backgroundColor: '#007AFF',
  },
  formActionSaveInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'transparent',
  },
  formActionSaveText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
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
  emptyContainer: { padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 14, opacity: 0.6, textAlign: 'center', color: '#000' },

  bitacoraCard: {
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
  bitTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10, color: '#000' },
  bitLine: { marginBottom: 6, color: '#000' },
  bitLabel: { fontWeight: '700', color: '#333' },
  bitValue: { color: '#000' },
  inlineLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  inlineLoadingText: {
    fontSize: 14,
    color: '#666',
  },

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
  collapseButtonText: { fontSize: 13, fontWeight: '600', color: '#007AFF' },
  collapsableContent: {
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
  },

  // Botones lista (mismo patrón que InductionTourRecordScreen)
  listItemButtons: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  listItemButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  editButton: { backgroundColor: '#007AFF' },
  deleteButton: { backgroundColor: '#FF3B30' },
  listItemButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },

  signatureModal: { flex: 1, backgroundColor: '#fff' },
  signatureModalHeader: { padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  signatureModalTitle: { fontSize: 16, fontWeight: '800', color: '#000' },
  signatureModalBody: { flex: 1, padding: 12, gap: 12 },
  signatureTargetHint: { color: '#666', fontWeight: '700' },
  changesButton: { backgroundColor: '#5856D6', flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 8, gap: 8 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  floatModalCardMovimientos: { backgroundColor: '#FFFFFF', borderRadius: 12, width: '100%', maxWidth: 500, maxHeight: '80%', borderWidth: 1, borderColor: '#E0E0E0', overflow: 'hidden' },
  floatModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#000' },
  cambioCollapsableMain: { width: '100%', marginBottom: 10, backgroundColor: '#fff', borderRadius: 6, borderWidth: 1, borderColor: '#E0E0E0', overflow: 'hidden' },
  cambioCollapsableHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#F8F9FA' },
  cambioCollapsableTitle: { fontSize: 14, fontWeight: '600', color: '#007AFF', flex: 1 },
  cambioCollapsableContent: { padding: 12, gap: 8, backgroundColor: '#F8F9FA' },
  changeDescription: { fontSize: 14, lineHeight: 20, color: '#666', marginBottom: 8 },
  signatureCanvasSquare: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
    aspectRatio: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  signatureActions: { flexDirection: 'row', gap: 10 },

  // Modal de firmas dibujadas (mismo patrón visual que InductionTourRecordScreen)
  drawSignatureModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  drawSignatureModalContainer: {
    width: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 20,
  },
  drawSignatureModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  drawSignatureModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  drawSignatureModalSignatureContainer: {
    height: 300,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  drawSignatureModalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  drawSignatureModalClearButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#E0E0E0',
    borderRadius: 8,
    gap: 8,
  },
  drawSignatureModalClearButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  drawSignatureModalAcceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    gap: 8,
  },
  drawSignatureModalAcceptButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  infoText: {
    fontSize: 12,
    color: '#666666',
    fontStyle: 'italic',
    marginTop: 4,
    marginBottom: 8,
  },
  pickerEmptyHint: {
    fontSize: 13,
    color: '#666666',
    marginTop: 4,
    marginBottom: 8,
  },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 6,
  },
  revisionDetailBlock: {
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  revisionImagesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  revisionImageWrap: {
    position: 'relative',
    width: '100%',
    maxWidth: 360,
    height: 200,
    alignSelf: 'stretch',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#EEE',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  revisionImagePreview: {
    width: '100%',
    height: '100%',
  },
  revisionImageDeleteBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255,59,48,0.9)',
    borderRadius: 14,
    padding: 6,
  },
  revisionEditHintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 14,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#E8F4FF',
    borderWidth: 1,
    borderColor: '#B8D9F5',
  },
  revisionEditHintText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: '#333333',
  },
  revisionPhotoSection: {
    marginBottom: 12,
    paddingLeft: 4,
  },
  cameraSmallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  cameraSmallButtonText: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '600',
  },
  revisionFormImageWrap: {
    position: 'relative',
    width: 96,
    height: 96,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#EEE',
  },
  revisionImagePreviewForm: {
    width: '100%',
    height: '100%',
  },
  revisionImageDeleteBtnForm: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 4,
  },
  cameraCloseButton: {
    position: 'absolute',
    top: 48,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 20,
    padding: 8,
  },
  cameraCaptureButton: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraCaptureButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
  },
});


