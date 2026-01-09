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
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import * as Location from 'expo-location';
import SignatureScreen from 'react-native-signature-canvas';
import { jwtDecode } from 'jwt-decode';

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
import {
  BitacoraVehiculoDetenidoItem,
  createBitacoraVehiculoDetenido,
  deleteBitacoraVehiculoDetenido,
  listBitacoraVehiculoDetenido,
  updateBitacoraVehiculoDetenido,
} from '@/hooks/bitacoraVehiculoDetenidoFunctions';

type Nav = NativeStackNavigationProp<RootStackParamList, 'BitacoraVehiculosDetenidos'>;

type TipoBitacora = 'Vehículo' | 'Bicicleta' | 'Motocicleta';
type ReviewStatus = 'Bueno' | 'Malo' | 'No existe';
type YesNo = 'Sí' | 'No';

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

const timeToHHmm = (d: Date): string => {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
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

export default function BitacoraVehiculosDetenidosScreen() {
  const navigation = useNavigation<Nav>();
  const { employee, refreshAccessToken, logout } = useAuth();
  const { scanQR, QRScannerComponent } = useQRScanner();

  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCurrentMarca, setHasCurrentMarca] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bitacoras, setBitacoras] = useState<BitacoraVehiculoDetenidoItem[]>([]);

  // Filtros (lista)
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  const [filterTipo, setFilterTipo] = useState<'all' | TipoBitacora>('all');
  const [filterFecha, setFilterFecha] = useState<string>(''); // yyyy-mm-dd
  const [filterSearch, setFilterSearch] = useState<string>(''); // placa/marca/oficial
  const [showFilterFechaPicker, setShowFilterFechaPicker] = useState(false);

  const [isCreating, setIsCreating] = useState(false);
  const [editing, setEditing] = useState<BitacoraVehiculoDetenidoItem | null>(null);

  const [tipo, setTipo] = useState<TipoBitacora>('Vehículo');
  const tipoRef = useRef<TipoBitacora>('Vehículo');

  const [empresaNombre, setEmpresaNombre] = useState<string>('');
  const [clienteNombre, setClienteNombre] = useState<string>('');
  const [marcaId, setMarcaId] = useState<number | null>(null);

  const [generalValues, setGeneralValues] = useState<Record<string, any>>({});
  const [revisionValues, setRevisionValues] = useState<Record<string, any>>({});
  const [revisionObs, setRevisionObs] = useState<Record<string, string>>({});
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

  const handleMenuPress = () => setIsMenuVisible(true);
  const handleMenuClose = () => setIsMenuVisible(false);
  const handleHomePress = () => navigation.navigate('Home');

  const resetAllFilters = () => {
    setFilterTipo('all');
    setFilterFecha('');
    setFilterSearch('');
  };

  const filteredBitacoras = useMemo(() => {
    const q = filterSearch.trim().toLowerCase();
    return bitacoras.filter((b) => {
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
  const toggleBitacoraExpanded = (key: string) => {
    setExpandedBitacoras((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const renderBitacoraItem = (b: BitacoraVehiculoDetenidoItem, index: number) => {
    const key =
      b.id !== 0
        ? `bit-${b.id}`
        : b.id_local
          ? `bit-${b.id_local}`
          : `bit-${index}`;
    const isExpanded = expandedBitacoras.has(key);
    const infoArr = safeParse<any[]>(b.informacion_general, []);
    const map: Record<string, any> = {};
    for (const f of infoArr) map[String(f.key)] = f.value;
    const placa = String(map.numero_placa ?? map.numero_de_placa ?? '');
    const marcaStr = String(map.marca ?? '');
    const colorStr = String(map.color ?? '');
    const fecha = b.created_at ? String(b.created_at).split('T')[0] : '';
    const firmaInfo = decodeFirmaHash(b.firma_responsable);

    // mostramos algunos campos informativos extra solo en el collapse
    const details = infoArr
      .filter((f) => f && f.label && f.value != null && String(f.value).trim() !== '')
      .filter((f) => String(f.kind || '') !== 'signature')
      .slice(0, 10);

    return (
      <ThemedView key={key} style={styles.bitacoraCard}>
        <ThemedText style={styles.bitTitle}>{b.tipo}</ThemedText>

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

        <ThemedText style={styles.bitLine}>
          <ThemedText style={styles.bitLabel}>Fecha: </ThemedText>
          <ThemedText style={styles.bitValue}>
            {fecha}
            {b.id_local ? ' (offline)' : ''}
          </ThemedText>
        </ThemedText>

        <TouchableOpacity style={styles.collapseButton} onPress={() => toggleBitacoraExpanded(key)}>
          <ThemedText style={styles.collapseButtonText}>
            {isExpanded ? 'Ocultar detalles' : 'Ver detalles'}
          </ThemedText>
          <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color="#007AFF" />
        </TouchableOpacity>

        {isExpanded && (
          <ThemedView style={styles.collapsableContent}>
            {details.length === 0 ? (
              <ThemedText style={styles.emptyText}>No hay detalles disponibles</ThemedText>
            ) : (
              details.map((f: any, i: number) => (
                <ThemedText key={`${key}-d-${i}`} style={styles.bitLine}>
                  <ThemedText style={styles.bitLabel}>{String(f.label)}: </ThemedText>
                  <ThemedText style={styles.bitValue}>{String(f.value)}</ThemedText>
                </ThemedText>
              ))
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
            style={[styles.listItemButton, styles.deleteButton]}
            onPress={() => handleDelete(b)}
          >
            <Ionicons name="trash" size={18} color="#FFFFFF" />
            <ThemedText style={styles.listItemButtonText}>Eliminar</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ThemedView>
    );
  };

  const getConnectionStatus = async (): Promise<boolean> => {
    const state = await Network.getNetworkStateAsync();
    return !!(state.isConnected && state.isInternetReachable);
  };

  const loadMarcaContext = async () => {
    const currentMarcaStr = await AsyncStorage.getItem('current_marca');
    if (!currentMarcaStr) {
      setHasCurrentMarca(false);
      return null;
    }
    const current = JSON.parse(currentMarcaStr);
    if (!current?.id) {
      setHasCurrentMarca(false);
      return null;
    }
    setHasCurrentMarca(true);
    setMarcaId(current.id);
    setEmpresaNombre(current?.empresa?.nombre ?? '');
    setClienteNombre(current?.cliente?.nombre ?? '');
    return current;
  };

  const fetchBitacoras = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const current = await loadMarcaContext();
      if (!current) {
        setIsLoading(false);
        return;
      }

      const isConnected = await getConnectionStatus();
      if (isConnected) {
        const res = await listBitacoraVehiculoDetenido({
          marcaId: current.id,
          refreshAccessToken,
          logout,
        });
        if (res.status) {
          const list = (res.data || []).map((b: any) => ({
            ...b,
            id_local: b.id_local || '',
          }));
          setBitacoras(list);
          await AsyncStorage.setItem('bitacora_vehiculo_detenido_cache', JSON.stringify(list));
        } else {
          setError(res.message || 'Error al cargar bitácoras');
          // fallback cache
          const cacheStr = await AsyncStorage.getItem('bitacora_vehiculo_detenido_cache');
          if (cacheStr) setBitacoras(JSON.parse(cacheStr));
        }
      } else {
        const cacheStr = await AsyncStorage.getItem('bitacora_vehiculo_detenido_cache');
        if (cacheStr) setBitacoras(JSON.parse(cacheStr));
      }
    } catch (e: any) {
      setError(e.message || 'Error al cargar bitácoras');
      const cacheStr = await AsyncStorage.getItem('bitacora_vehiculo_detenido_cache');
      if (cacheStr) setBitacoras(JSON.parse(cacheStr));
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchBitacoras();
    }, [])
  );

  useEffect(() => {
    const handler = () => fetchBitacoras();
    eventBus.on('connectionRestored', handler);
    return () => {
      eventBus.off('connectionRestored', handler);
    };
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

  const resetForm = async (tipoNext: TipoBitacora) => {
    const current = await loadMarcaContext();
    tipoRef.current = tipoNext;
    setTipo(tipoNext);

    const baseGeneral: Record<string, any> = {};
    baseGeneral.empresa = current?.empresa?.nombre ?? empresaNombre ?? '';
    baseGeneral.cliente = current?.cliente?.nombre ?? clienteNombre ?? '';
    baseGeneral.fecha = dateToLocalString(new Date());
    baseGeneral.hora = timeToHHmm(new Date());
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

    setMovimientos([
      { movimiento: '', fecha: dateToLocalString(new Date()), hora: timeToHHmm(new Date()), realizado_por: '', autorizado_por: '', _expanded: true },
    ]);
    setObservaciones('');
    setFirmaResponsable('');

    await requestLocation();
  };

  const startCreating = async () => {
    setIsCreating(true);
    setEditing(null);
    await resetForm('Vehículo');
  };

  const startEditing = async (item: BitacoraVehiculoDetenidoItem) => {
    setIsCreating(true);
    setEditing(item);
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

    setMovimientos(movs as any);
    setObservaciones(item.observaciones || '');
    setFirmaResponsable(item.firma_responsable || '');
    await requestLocation();
  };

  const cancelCreating = () => {
    setIsCreating(false);
    setEditing(null);
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

  const validateForm = () => {
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
    return true;
  };

  const buildPayload = async () => {
    const current = await loadMarcaContext();
    if (!current?.id) throw new Error('Marca no encontrada');

    const infoGeneralArr = generalConfig.map((g) => ({
      key: g.key,
      label: g.label,
      value: g.kind === 'readonly'
        ? (g.key === 'empresa' ? (current?.empresa?.nombre ?? empresaNombre) : (current?.cliente?.nombre ?? clienteNombre))
        : (generalValues[g.key] ?? ''),
      kind: g.kind,
    }));

    const infoRevisionArr: any[] = [];
    for (const r of revisionConfig) {
      if (r.kind === 'heading') {
        infoRevisionArr.push({ key: r.key, label: r.label, kind: 'heading' });
        continue;
      }
      const entry: any = { key: r.key, label: r.label, value: revisionValues[r.key] ?? '', kind: r.kind };
      if (r.withObservation) entry.observation = revisionObs[`${r.key}__obs`] ?? '';
      infoRevisionArr.push(entry);
    }

    const movs = movimientos.map((m) => ({
      movimiento: m.movimiento,
      fecha: m.fecha,
      hora: m.hora,
      realizado_por: m.realizado_por,
      autorizado_por: m.autorizado_por,
    }));

    return {
      marca_id: current.id,
      tipo: tipoRef.current,
      informacion_general: infoGeneralArr,
      informacion_revision: infoRevisionArr,
      movimientos_vehiculos: movs,
      observaciones,
      firma_responsable: firmaResponsable,
    };
  };

  const upsertOfflineCreateAction = async (localId: string, requestData: any) => {
    const actionsStr = await AsyncStorage.getItem('bitacora_vehiculo_detenido_actions');
    const actions = actionsStr ? JSON.parse(actionsStr) : [];
    const existingIdx = actions.findIndex((a: any) => a.type === 'create' && a.id === localId);
    if (existingIdx !== -1) {
      actions[existingIdx].requestData = requestData;
    } else {
      actions.push({ id: localId, type: 'create', requestData });
    }
    await AsyncStorage.setItem('bitacora_vehiculo_detenido_actions', JSON.stringify(actions));
  };

  const handleSave = async () => {
    if (!employee) return;
    if (!validateForm()) return;

    try {
      const requestData = await buildPayload();
      const isConnected = await getConnectionStatus();

      // Create
      if (!editing || !editing.id || editing.id === 0) {
        if (isConnected) {
          const res = await createBitacoraVehiculoDetenido({ requestData, refreshAccessToken, logout });
          if (!res.status) throw new Error(res.message || 'No se pudo crear');
          await fetchBitacoras();
          setIsCreating(false);
          Alert.alert('Éxito', 'Bitácora creada correctamente');
          return;
        }

        // Offline create
        const id_local = editing?.id_local && editing.id_local.length > 0 ? editing.id_local : generateRandomId();
        await upsertOfflineCreateAction(id_local, requestData);

        const cacheStr = await AsyncStorage.getItem('bitacora_vehiculo_detenido_cache');
        const cache = cacheStr ? JSON.parse(cacheStr) : [];
        const createdAt = new Date().toISOString();

        const localItem: any = {
          id: 0,
          empresa_id: 0,
          cliente_id: 0,
          sucursal_id: 0,
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

        const updatedCache = [localItem, ...cache.filter((b: any) => b.id_local !== id_local)];
        await AsyncStorage.setItem('bitacora_vehiculo_detenido_cache', JSON.stringify(updatedCache));
        setBitacoras(updatedCache);
        setIsCreating(false);
        Alert.alert('Modo offline', 'Bitácora guardada localmente. Se sincronizará cuando haya conexión.');
        return;
      }

      // Update
      if (isConnected) {
        const res = await updateBitacoraVehiculoDetenido({
          id: editing.id,
          requestData,
          refreshAccessToken,
          logout,
        });
        if (!res.status) throw new Error(res.message || 'No se pudo actualizar');
        await fetchBitacoras();
        setIsCreating(false);
        Alert.alert('Éxito', 'Bitácora actualizada correctamente');
        return;
      }

      // Offline update
      const actionsStr = await AsyncStorage.getItem('bitacora_vehiculo_detenido_actions');
      const actions = actionsStr ? JSON.parse(actionsStr) : [];
      actions.push({ id: editing.id, type: 'update', requestData });
      await AsyncStorage.setItem('bitacora_vehiculo_detenido_actions', JSON.stringify(actions));

      const cacheStr = await AsyncStorage.getItem('bitacora_vehiculo_detenido_cache');
      const cache = cacheStr ? JSON.parse(cacheStr) : [];
      const updatedCache = cache.map((b: any) => (b.id === editing.id ? { ...b, ...requestData } : b));
      await AsyncStorage.setItem('bitacora_vehiculo_detenido_cache', JSON.stringify(updatedCache));
      setBitacoras(updatedCache);
      setIsCreating(false);
      Alert.alert('Modo offline', 'Cambios guardados localmente. Se sincronizarán cuando haya conexión.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'No se pudo guardar');
    }
  };

  const handleDelete = async (item: BitacoraVehiculoDetenidoItem) => {
    Alert.alert('Eliminar', '¿Deseas eliminar este registro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            const isConnected = await getConnectionStatus();
            if (item.id === 0 && item.id_local) {
              // remove local
              const cacheStr = await AsyncStorage.getItem('bitacora_vehiculo_detenido_cache');
              const cache = cacheStr ? JSON.parse(cacheStr) : [];
              const updatedCache = cache.filter((b: any) => b.id_local !== item.id_local);
              await AsyncStorage.setItem('bitacora_vehiculo_detenido_cache', JSON.stringify(updatedCache));
              setBitacoras(updatedCache);

              const actionsStr = await AsyncStorage.getItem('bitacora_vehiculo_detenido_actions');
              const actions = actionsStr ? JSON.parse(actionsStr) : [];
              const updatedActions = actions.filter((a: any) => !(a.type === 'create' && a.id === item.id_local));
              await AsyncStorage.setItem('bitacora_vehiculo_detenido_actions', JSON.stringify(updatedActions));
              Alert.alert('Éxito', 'Registro eliminado localmente');
              return;
            }

            if (isConnected) {
              const res = await deleteBitacoraVehiculoDetenido({ id: item.id, refreshAccessToken, logout });
              if (!res.status) throw new Error(res.message || 'No se pudo eliminar');
              await fetchBitacoras();
              Alert.alert('Éxito', 'Registro eliminado correctamente');
              return;
            }

            // Offline delete
            const actionsStr = await AsyncStorage.getItem('bitacora_vehiculo_detenido_actions');
            const actions = actionsStr ? JSON.parse(actionsStr) : [];
            actions.push({ id: item.id, type: 'delete' });
            await AsyncStorage.setItem('bitacora_vehiculo_detenido_actions', JSON.stringify(actions));

            const cacheStr = await AsyncStorage.getItem('bitacora_vehiculo_detenido_cache');
            const cache = cacheStr ? JSON.parse(cacheStr) : [];
            const updatedCache = cache.filter((b: any) => b.id !== item.id);
            await AsyncStorage.setItem('bitacora_vehiculo_detenido_cache', JSON.stringify(updatedCache));
            setBitacoras(updatedCache);
            Alert.alert('Modo offline', 'Registro eliminado localmente. Se sincronizará cuando haya conexión.');
          } catch (e: any) {
            Alert.alert('Error', e.message || 'No se pudo eliminar');
          }
        },
      },
    ]);
  };

  const addMovimiento = () => {
    setMovimientos((prev) => [
      ...prev,
      { movimiento: '', fecha: dateToLocalString(new Date()), hora: timeToHHmm(new Date()), realizado_por: '', autorizado_por: '', _expanded: true },
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
    setDatePickerValue(currentValue ? new Date(currentValue) : new Date());
    setShowDatePicker(true);
  };

  const openTimePicker = (key: string, currentValue?: string) => {
    setTimePickerKey(key);
    const d = new Date();
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

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader onMenuPress={handleMenuPress} title="Vehículos detenidos" />
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando...</ThemedText>
        </ThemedView>
        <AppFooter />
        <SlideMenu isVisible={isMenuVisible} onClose={handleMenuClose} onHomePress={handleHomePress} currentRoute="BitacoraVehiculosDetenidos" />
      </ThemedView>
    );
  }

  if (!hasCurrentMarca) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader onMenuPress={handleMenuPress} title="Vehículos detenidos" />
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
      <AppHeader onMenuPress={handleMenuPress} title="Vehículos detenidos" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <ThemedView style={styles.content}>
          {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}

          <ThemedView style={styles.titleContainer}>
            <ThemedText type="title" style={styles.title}>
              <Ionicons name="car-sport" size={22} color="#000000" /> Bitácora de vehículos detenidos
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              Gestiona los registros de vehículos detenidos
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
                        <Picker.Item label="Todos los tipos" value="all" />
                        {TYPE_OPTIONS.map((t) => (
                          <Picker.Item key={t} label={t} value={t} />
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
                        {filterFecha || 'Seleccionar fecha'}
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

              {/* Tipo */}
              <ThemedText style={styles.label}>Tipo *</ThemedText>
              <ThemedView style={styles.pickerContainer}>
                <Picker
                  selectedValue={tipo}
                  onValueChange={(v) => {
                    const next = v as TipoBitacora;
                    if (editing) {
                      // no recreamos completamente en edición, solo cambiamos config (pero mantiene valores)
                      setTipo(next);
                      tipoRef.current = next;
                      return;
                    }
                    resetForm(next);
                  }}
                  style={styles.picker}
                >
                  {TYPE_OPTIONS.map((t) => (
                    <Picker.Item key={t} label={t} value={t} />
                  ))}
                </Picker>
              </ThemedView>

              {/* Formulario dinámico - información general */}
              <ThemedText style={styles.sectionTitle}>Información general</ThemedText>
              {generalConfig.map((f) => {
                const value = f.kind === 'readonly'
                  ? (f.key === 'empresa' ? (empresaNombre || generalValues.empresa) : (clienteNombre || generalValues.cliente))
                  : (generalValues[f.key] ?? '');

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
                        <ThemedText style={styles.dateButtonText}>{value || 'Seleccionar fecha'}</ThemedText>
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
                            <Picker.Item key={o} label={o} value={o} />
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
                    />
                  </ThemedView>
                );
              })}

              {/* Formulario dinámico - información de revisión */}
              <ThemedText style={styles.sectionTitle}>Información de revisión</ThemedText>
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
                    <ThemedView key={r.key} style={styles.row}>
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
                  );
                }

                if (r.kind === 'text') {
                  return (
                    <ThemedView key={r.key} style={styles.row}>
                      <ThemedText style={styles.label}>{r.label}</ThemedText>
                      <TextInput
                        style={styles.input}
                        value={String(revisionValues[r.key] ?? '')}
                        onChangeText={(t) => setRevisionValues((prev) => ({ ...prev, [r.key]: t }))}
                        placeholder={r.label}
                        placeholderTextColor="#999"
                      />
                    </ThemedView>
                  );
                }

                // select
                const val = revisionValues[r.key] as ReviewStatus | '';
                return (
                  <ThemedView key={r.key} style={styles.row}>
                    <ThemedText style={styles.label}>{r.label}{r.required ? ' *' : ''}</ThemedText>
                    <ThemedView style={styles.pickerContainer}>
                      <Picker
                        selectedValue={String(val)}
                        onValueChange={(v) => setRevisionValues((prev) => ({ ...prev, [r.key]: String(v) }))}
                        style={styles.picker}
                      >
                        {REVIEW_OPTIONS.map((o) => (
                          <Picker.Item key={o} label={o} value={o} />
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
                        onPress={() => {
                          setDatePickerKey(`mov_${idx}`);
                          setDatePickerValue(new Date());
                          setShowDatePicker(true);
                        }}
                      >
                        <ThemedText style={styles.dateButtonText}>Fecha: {m.fecha || 'Seleccionar'}</ThemedText>
                        <Ionicons name="calendar-outline" size={18} color="#007AFF" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.dateButton}
                        onPress={() => {
                          setTimePickerKey(`mov_${idx}`);
                          setTimePickerValue(new Date());
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

              <ThemedView style={styles.formActions}>
                <TouchableOpacity style={[styles.formActionButton, styles.formActionCancel]} onPress={cancelCreating}>
                  <Ionicons name="close" size={18} color="#000" />
                  <ThemedText style={styles.formActionCancelText}>Cancelar</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.formActionButton, styles.formActionSave]} onPress={handleSave}>
                  <Ionicons name="save" size={18} color="#fff" />
                  <ThemedText style={styles.formActionSaveText}>Guardar</ThemedText>
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>
          )}

          {!isCreating && (
            <ThemedView style={styles.listContainer}>
              {filteredBitacoras.length === 0 ? (
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
          value={filterFecha ? new Date(filterFecha) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, date) => {
            setShowFilterFechaPicker(false);
            if (date) setFilterFecha(dateToLocalString(date));
          }}
        />
      )}

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
  heading: { marginTop: 12, marginBottom: 4, fontSize: 14, fontWeight: '800', color: '#000' },
  row: { marginTop: 8 },

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
  formActionSaveText: { color: '#fff', fontWeight: '800' },

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
});


