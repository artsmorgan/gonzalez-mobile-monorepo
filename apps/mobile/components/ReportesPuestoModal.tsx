import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { convertDateTimestampToLocalString } from '@/hooks/convertDateTimestampToLocalString';
import getCurrentUserDigitalSignature from '@/hooks/getCurrentUserDigitalSignature';
import { downloadReportsBundleToDevice } from '@/hooks/downloadReportFileToDevice';
import {
  createReportePuesto,
  listReportesPuesto,
  searchActaStructure,
  type StructureLite,
} from '@/hooks/reportesFunctions';
import {
  REPORTES_PUESTO_MODULOS,
  REPORTES_PUESTO_MODULO_LABEL,
  buildPuestoReportMetaFields,
  buildSelectionsFromCheckboxes,
  createEmptyCheckboxState,
  setAllCheckboxes,
  type ReportePuestoCheckboxState,
} from '@/hooks/reportesPuestoConfig';
import { useQRScanner } from '@/hooks/useQRScanner';

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function hm(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${mi}:00`;
}

function dateOnlyToIsoString(d: Date): string {
  return `${ymd(d)}T12:00:00.000Z`;
}

function formatDateOnlyLabel(d: Date, fallbackLabel = 'Fecha'): string {
  if (!d || Number.isNaN(d.getTime())) return fallbackLabel;
  try {
    return convertDateTimestampToLocalString(dateOnlyToIsoString(d), false);
  } catch {
    return fallbackLabel;
  }
}

function combineDateAndTime(dateStr: string, timeStr: string): string {
  return `${dateStr} ${timeStr}`;
}

function resolveOptionalDesde(date: Date | null, time: Date | null): string | undefined {
  if (!date) return undefined;
  return combineDateAndTime(ymd(date), time ? hm(time) : '00:00:00');
}

function resolveOptionalHasta(date: Date | null, time: Date | null): string | undefined {
  if (!date) return undefined;
  return combineDateAndTime(ymd(date), time ? hm(time) : '23:59:59');
}

function formatStructureLite(item: StructureLite): string {
  const parts = [item.codigo, item.numero, item.nombre].filter(Boolean);
  return parts.join(' — ') || String(item.id);
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

function formatEstado(estado: string): string {
  const e = String(estado || '').toLowerCase();
  if (e === 'completado') return 'Completado';
  if (e === 'pendiente') return 'Pendiente';
  if (e === 'procesando' || e === 'en_proceso') return 'Procesando';
  if (e === 'error' || e === 'fallido') return 'Error';
  return estado || '-';
}

export type ReportesPuestoModalProps = {
  visible: boolean;
  onClose: () => void;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<unknown>;
  employee: any;
  onCreated?: () => void;
};

type ReportePuestoRow = {
  id: number;
  nombre: string;
  numero: string;
  nomenclatura: string;
  descripcion?: string | null;
  puesto_id: number;
  puesto_label?: string;
  created_at?: string;
  aggregateEstado?: string;
  completadosCount?: number;
  totalCount?: number;
  childReports?: {
    id: number;
    modulo: string;
    tipo_reporte: string;
    estado: string;
    nombre: string;
    progress?: number;
  }[];
};

export default function ReportesPuestoModal({
  visible,
  onClose,
  refreshAccessToken,
  logout,
  employee,
  onCreated,
}: ReportesPuestoModalProps) {
  const { scanQR } = useQRScanner();
  const [tab, setTab] = useState<'crear' | 'consultar'>('crear');
  const [isMetaOpen, setIsMetaOpen] = useState(true);
  const [isConsultFiltersOpen, setIsConsultFiltersOpen] = useState(false);

  const [nombre, setNombre] = useState('');
  const [numero, setNumero] = useState('');
  const [nomenclatura, setNomenclatura] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [puestoSearch, setPuestoSearch] = useState('');
  const [puestoResults, setPuestoResults] = useState<StructureLite[]>([]);
  const [puestoSelected, setPuestoSelected] = useState<StructureLite | null>(null);
  const [puestoSearching, setPuestoSearching] = useState(false);

  const [desdeD, setDesdeD] = useState<Date | null>(null);
  const [desdeT, setDesdeT] = useState<Date | null>(null);
  const [hastaD, setHastaD] = useState<Date | null>(null);
  const [hastaT, setHastaT] = useState<Date | null>(null);
  const [datePickerSlot, setDatePickerSlot] = useState<string | null>(null);

  const [checkboxes, setCheckboxes] = useState<ReportePuestoCheckboxState>(createEmptyCheckboxState());
  const [firma, setFirma] = useState('');
  const [genFirmaLoading, setGenFirmaLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  const [listPuestoSearch, setListPuestoSearch] = useState('');
  const [listPuestoSelected, setListPuestoSelected] = useState<StructureLite | null>(null);
  const [listPuestoResults, setListPuestoResults] = useState<StructureLite[]>([]);
  const [listPuestoSearching, setListPuestoSearching] = useState(false);
  const [listDesdeD, setListDesdeD] = useState<Date | null>(null);
  const [listDesdeT, setListDesdeT] = useState<Date | null>(null);
  const [listHastaD, setListHastaD] = useState<Date | null>(null);
  const [listHastaT, setListHastaT] = useState<Date | null>(null);
  const [listDatePickerSlot, setListDatePickerSlot] = useState<string | null>(null);

  const [rows, setRows] = useState<ReportePuestoRow[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const regenerateMeta = useCallback(
    (
      puesto: StructureLite | null,
      range: {
        desdeD: Date | null;
        desdeT: Date | null;
        hastaD: Date | null;
        hastaT: Date | null;
      },
    ) => {
      if (!puesto) {
        setNombre('');
        setNumero('');
        setNomenclatura('');
        setDescripcion('');
        return;
      }
      const meta = buildPuestoReportMetaFields(formatStructureLite(puesto), new Date(), {
        desde: resolveOptionalDesde(range.desdeD, range.desdeT),
        hasta: resolveOptionalHasta(range.hastaD, range.hastaT),
      });
      setNombre(meta.nombre);
      setNumero(meta.numero);
      setNomenclatura(meta.nomenclatura);
      setDescripcion(meta.descripcion);
    },
    [],
  );

  const resetCrear = useCallback(() => {
    setPuestoSearch('');
    setPuestoResults([]);
    setPuestoSelected(null);
    setDesdeD(null);
    setDesdeT(null);
    setHastaD(null);
    setHastaT(null);
    setNombre('');
    setNumero('');
    setNomenclatura('');
    setDescripcion('');
    setCheckboxes(createEmptyCheckboxState());
    setFirma('');
    setIsMetaOpen(true);
  }, []);

  useEffect(() => {
    if (!visible) {
      setTab('crear');
      resetCrear();
      setRows([]);
      setListPuestoSearch('');
      setListPuestoSelected(null);
      setListPuestoResults([]);
      setListDesdeD(null);
      setListDesdeT(null);
      setListHastaD(null);
      setListHastaT(null);
      setExpandedId(null);
      setIsConsultFiltersOpen(false);
    }
  }, [visible, resetCrear]);

  useEffect(() => {
    regenerateMeta(puestoSelected, { desdeD, desdeT, hastaD, hastaT });
  }, [puestoSelected, desdeD, desdeT, hastaD, hastaT, regenerateMeta]);

  const selectPuesto = (it: StructureLite) => {
    setPuestoSelected(it);
    setPuestoSearch(formatStructureLite(it));
    setPuestoResults([]);
  };

  const clearPuesto = () => {
    setPuestoSelected(null);
    setPuestoSearch('');
    setPuestoResults([]);
  };

  const runPuestoSearch = async (q: string, mode: 'crear' | 'consultar') => {
    const trimmed = q.trim();
    if (!trimmed) {
      Alert.alert('Puesto', 'Escriba un nombre o código de puesto.');
      return;
    }
    if (mode === 'crear') setPuestoSearching(true);
    else setListPuestoSearching(true);
    try {
      const res = await searchActaStructure({
        entity: 'puesto',
        q: trimmed,
        refreshAccessToken,
        logout,
      });
      const data = res.status ? res.data ?? [] : [];
      if (mode === 'crear') {
        setPuestoResults(data);
        if (!data.length) Alert.alert('Puesto', 'Sin resultados.');
      } else {
        setListPuestoResults(data);
        if (!data.length) Alert.alert('Puesto', 'Sin resultados.');
      }
    } finally {
      if (mode === 'crear') setPuestoSearching(false);
      else setListPuestoSearching(false);
    }
  };

  const scanFirma = async () => {
    try {
      const d = await scanQR();
      if (!d) return;
      const decoded = decodeFirmaHash(d);
      if (!decoded) {
        Alert.alert('Error', 'El QR escaneado no tiene el formato correcto');
        return;
      }
      setFirma(String(d));
    } catch {
      Alert.alert('Error', 'No se pudo leer el código QR');
    }
  };

  const generateFirma = async () => {
    setGenFirmaLoading(true);
    try {
      const hash = await getCurrentUserDigitalSignature(employee);
      if (hash) setFirma(hash);
    } finally {
      setGenFirmaLoading(false);
    }
  };

  const toggleCheckbox = (modulo: string, tipo: 'Individual' | 'Consolidado', checked: boolean) => {
    setCheckboxes((prev) => ({
      ...prev,
      [modulo]: { ...prev[modulo], [tipo]: checked },
    }));
  };

  const handleCreate = async () => {
    if (!puestoSelected) {
      Alert.alert('Puesto', 'Seleccione un puesto.');
      return;
    }
    if (!nombre.trim() || !numero.trim() || !nomenclatura.trim()) {
      Alert.alert('Formulario', 'Nombre, número y nomenclatura son obligatorios.');
      return;
    }
    if (!firma.trim()) {
      Alert.alert('Firma', 'Agregue la firma del responsable.');
      return;
    }
    const selections = buildSelectionsFromCheckboxes(checkboxes);
    if (selections.length === 0) {
      Alert.alert('Módulos', 'Seleccione al menos un tipo de reporte.');
      return;
    }

    setSubmitLoading(true);
    try {
      const res = await createReportePuesto({
        body: {
          nombre: nombre.trim(),
          numero: numero.trim(),
          nomenclatura: nomenclatura.trim(),
          descripcion: descripcion.trim(),
          puestoId: puestoSelected.id,
          firma_responsable: firma.trim(),
          creadoDesde: resolveOptionalDesde(desdeD, desdeT),
          creadoHasta: resolveOptionalHasta(hastaD, hastaT),
          selections,
        },
        refreshAccessToken,
        logout,
      });
      if (!res.status) {
        Alert.alert('Error', res.message || 'No se pudo crear');
        return;
      }
      Alert.alert('Reporte por puesto', res.message || 'Se encoló correctamente.');
      resetCrear();
      onCreated?.();
      setTab('consultar');
      void loadList();
    } finally {
      setSubmitLoading(false);
    }
  };

  const loadList = async () => {
    setListLoading(true);
    try {
      const res = await listReportesPuesto({
        body: {
          puestoId: listPuestoSelected?.id,
          createdDesde: resolveOptionalDesde(listDesdeD, listDesdeT),
          createdHasta: resolveOptionalHasta(listHastaD, listHastaT),
        },
        refreshAccessToken,
        logout,
      });
      if (!res.status) {
        Alert.alert('Error', res.message || 'No se pudo cargar la lista');
        return;
      }
      setRows(res.data ?? []);
    } finally {
      setListLoading(false);
    }
  };

  const downloadPuestoZip = async (row: ReportePuestoRow) => {
    const children = row.childReports ?? [];
    const completados = children.filter((c) => String(c.estado).toLowerCase() === 'completado');
    if (completados.length === 0) {
      Alert.alert('Descarga', 'No hay reportes completados disponibles para descargar.');
      return;
    }
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      Alert.alert('Error', 'Server URL not configured');
      return;
    }
    setDownloadingId(row.id);
    try {
      const result = await downloadReportsBundleToDevice({
        reportIds: completados.map((c) => c.id),
        fallbackFileName: `reporte_puesto_${row.id}.zip`,
        apiUrl,
        refreshAccessToken,
        logout,
      });
      if (result.ok) {
        Alert.alert('Descarga', `Archivo guardado: ${result.fileName}`);
        return;
      }
      if (result.cancelled) return;
      Alert.alert('Error', result.message || 'No se pudo descargar');
    } finally {
      setDownloadingId(null);
    }
  };

  const getPickerValue = (slot: string): Date => {
    const now = new Date();
    switch (slot) {
      case 'desdeD':
        return desdeD ?? now;
      case 'desdeT':
        return desdeT ?? now;
      case 'hastaD':
        return hastaD ?? now;
      case 'hastaT':
        return hastaT ?? now;
      case 'listDesdeD':
        return listDesdeD ?? now;
      case 'listDesdeT':
        return listDesdeT ?? now;
      case 'listHastaD':
        return listHastaD ?? now;
      case 'listHastaT':
        return listHastaT ?? now;
      default:
        return now;
    }
  };

  const applyPickerResult = (slot: string, selected: Date) => {
    switch (slot) {
      case 'desdeD':
        setDesdeD(selected);
        break;
      case 'desdeT':
        setDesdeT(selected);
        break;
      case 'hastaD':
        setHastaD(selected);
        break;
      case 'hastaT':
        setHastaT(selected);
        break;
      case 'listDesdeD':
        setListDesdeD(selected);
        break;
      case 'listDesdeT':
        setListDesdeT(selected);
        break;
      case 'listHastaD':
        setListHastaD(selected);
        break;
      case 'listHastaT':
        setListHastaT(selected);
        break;
      default:
        break;
    }
  };

  const activePickerSlot = datePickerSlot ?? listDatePickerSlot;

  const renderDateRange = (
    prefix: 'crear' | 'consultar',
    desdeDate: Date | null,
    desdeTime: Date | null,
    hastaDate: Date | null,
    hastaTime: Date | null,
    onClearDesde: () => void,
    onClearHasta: () => void,
    labels: { desde: string; hasta: string } = { desde: 'Desde (opcional)', hasta: 'Hasta (opcional)' },
  ) => (
    <>
      <ThemedText style={styles.label}>{labels.desde}</ThemedText>
      <View style={styles.dateRow}>
        <TouchableOpacity
          style={styles.dateButtonHalf}
          onPress={() => (prefix === 'crear' ? setDatePickerSlot('desdeD') : setListDatePickerSlot('listDesdeD'))}
          activeOpacity={0.85}
        >
          <ThemedText style={styles.dateButtonText}>{desdeDate ? formatDateOnlyLabel(desdeDate) : 'Fecha'}</ThemedText>
          <Ionicons name="calendar-outline" size={18} color="#007AFF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.dateButtonHalf}
          onPress={() => (prefix === 'crear' ? setDatePickerSlot('desdeT') : setListDatePickerSlot('listDesdeT'))}
          activeOpacity={0.85}
        >
          <ThemedText style={styles.dateButtonText}>{desdeTime ? hm(desdeTime) : 'Hora'}</ThemedText>
          <Ionicons name="time-outline" size={18} color="#007AFF" />
        </TouchableOpacity>
      </View>
      {(desdeDate || desdeTime) && (
        <TouchableOpacity style={styles.clearDateLink} onPress={onClearDesde} activeOpacity={0.85}>
          <ThemedText style={styles.clearDateLinkText}>Quitar rango inferior</ThemedText>
        </TouchableOpacity>
      )}

      <ThemedText style={styles.label}>{labels.hasta}</ThemedText>
      <View style={styles.dateRow}>
        <TouchableOpacity
          style={styles.dateButtonHalf}
          onPress={() => (prefix === 'crear' ? setDatePickerSlot('hastaD') : setListDatePickerSlot('listHastaD'))}
          activeOpacity={0.85}
        >
          <ThemedText style={styles.dateButtonText}>{hastaDate ? formatDateOnlyLabel(hastaDate) : 'Fecha'}</ThemedText>
          <Ionicons name="calendar-outline" size={18} color="#007AFF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.dateButtonHalf}
          onPress={() => (prefix === 'crear' ? setDatePickerSlot('hastaT') : setListDatePickerSlot('listHastaT'))}
          activeOpacity={0.85}
        >
          <ThemedText style={styles.dateButtonText}>{hastaTime ? hm(hastaTime) : 'Hora'}</ThemedText>
          <Ionicons name="time-outline" size={18} color="#007AFF" />
        </TouchableOpacity>
      </View>
      {(hastaDate || hastaTime) && (
        <TouchableOpacity style={styles.clearDateLink} onPress={onClearHasta} activeOpacity={0.85}>
          <ThemedText style={styles.clearDateLinkText}>Quitar rango superior</ThemedText>
        </TouchableOpacity>
      )}
    </>
  );

  const renderPuestoSearch = (
    mode: 'crear' | 'consultar',
    search: string,
    setSearch: (v: string) => void,
    results: StructureLite[],
    selected: StructureLite | null,
    searching: boolean,
    onSelect: (it: StructureLite) => void,
    onClear: () => void,
  ) => (
    <>
      <ThemedText style={styles.label}>Puesto</ThemedText>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, styles.inputFlex]}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por nombre o código"
          placeholderTextColor="#999"
        />
        <TouchableOpacity
          style={styles.searchIconBtn}
          onPress={() => void runPuestoSearch(search, mode)}
          disabled={searching}
          activeOpacity={0.85}
        >
          {searching ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="search" size={22} color="#fff" />}
        </TouchableOpacity>
      </View>
      {results.length > 0 && (
        <ThemedView style={styles.resultList}>
          {results.map((it) => (
            <TouchableOpacity key={`${mode}-puesto-${it.id}`} style={styles.resultItem} onPress={() => onSelect(it)}>
              <ThemedText>{formatStructureLite(it)}</ThemedText>
            </TouchableOpacity>
          ))}
        </ThemedView>
      )}
      <ThemedView style={styles.assignedList}>
        {!selected ? (
          <ThemedText style={styles.helperText}>Seleccione un puesto para generar los datos del reporte.</ThemedText>
        ) : (
          <ThemedView style={styles.assignedUserItem}>
            <ThemedText style={styles.assignedUserTitle}>{formatStructureLite(selected)}</ThemedText>
            <TouchableOpacity style={styles.removeUserButton} onPress={onClear} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Ionicons name="trash-outline" size={18} color="#FF3B30" />
            </TouchableOpacity>
          </ThemedView>
        )}
      </ThemedView>
    </>
  );

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <ThemedView style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <ThemedText style={styles.modalTitle}>Reportes por puesto</ThemedText>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color="#333" />
            </TouchableOpacity>
          </View>

          <View style={styles.tabsRow}>
            <TouchableOpacity
              style={[styles.tabBtn, tab === 'crear' && styles.tabBtnActive]}
              onPress={() => setTab('crear')}
              activeOpacity={0.85}
            >
              <ThemedText style={[styles.tabBtnText, tab === 'crear' && styles.tabBtnTextActive]}>Crear</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, tab === 'consultar' && styles.tabBtnActive]}
              onPress={() => {
                setTab('consultar');
                void loadList();
              }}
              activeOpacity={0.85}
            >
              <ThemedText style={[styles.tabBtnText, tab === 'consultar' && styles.tabBtnTextActive]}>Consultar</ThemedText>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent} keyboardShouldPersistTaps="handled">
            {tab === 'crear' ? (
              <>
                <ThemedView style={styles.modalFormCard}>
                  <ThemedText style={styles.modalSectionTitle}>Puesto y rango de datos</ThemedText>
                  {renderPuestoSearch('crear', puestoSearch, setPuestoSearch, puestoResults, puestoSelected, puestoSearching, selectPuesto, clearPuesto)}
                  {renderDateRange('crear', desdeD, desdeT, hastaD, hastaT, () => {
                    setDesdeD(null);
                    setDesdeT(null);
                  }, () => {
                    setHastaD(null);
                    setHastaT(null);
                  })}
                </ThemedView>

                <ThemedView style={[styles.filtersContainer, { marginBottom: 14 }]}>
                  <ThemedView style={styles.filtersHeader}>
                    <TouchableOpacity style={styles.filterToggleButton} onPress={() => setIsMetaOpen((p) => !p)} activeOpacity={0.85}>
                      <ThemedText style={styles.filtersTitle}>Datos del reporte</ThemedText>
                      <Ionicons name={isMetaOpen ? 'chevron-up' : 'chevron-down'} size={20} color="#007AFF" />
                    </TouchableOpacity>
                  </ThemedView>
                  {isMetaOpen ? (
                    <ThemedView style={styles.filtersContent}>
                      {!puestoSelected ? (
                        <ThemedText style={styles.helperText}>
                          Nombre, número y nomenclatura se generan al seleccionar puesto o fechas/horas.
                        </ThemedText>
                      ) : null}
                      <ThemedText style={styles.label}>Nombre del reporte</ThemedText>
                      <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholderTextColor="#999" />
                      <ThemedText style={styles.label}>Número del reporte</ThemedText>
                      <TextInput style={styles.input} value={numero} onChangeText={setNumero} placeholderTextColor="#999" />
                      <ThemedText style={styles.label}>Nomenclatura del reporte</ThemedText>
                      <TextInput style={styles.input} value={nomenclatura} onChangeText={setNomenclatura} placeholderTextColor="#999" />
                      <ThemedText style={styles.label}>Descripción del reporte</ThemedText>
                      <TextInput
                        style={[styles.input, styles.textArea]}
                        multiline
                        value={descripcion}
                        onChangeText={setDescripcion}
                        placeholderTextColor="#999"
                      />
                    </ThemedView>
                  ) : null}
                </ThemedView>

                <ThemedView style={styles.modalFormCard}>
                  <ThemedText style={styles.modalSectionTitle}>Módulos de reporte</ThemedText>
                  <View style={styles.row}>
                    <TouchableOpacity style={styles.smallActionBtn} onPress={() => setCheckboxes(setAllCheckboxes(true))} activeOpacity={0.85}>
                      <ThemedText style={styles.smallActionBtnText}>Marcar todos</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.smallActionBtn} onPress={() => setCheckboxes(setAllCheckboxes(false))} activeOpacity={0.85}>
                      <ThemedText style={styles.smallActionBtnText}>Desmarcar todos</ThemedText>
                    </TouchableOpacity>
                  </View>
                  {REPORTES_PUESTO_MODULOS.map((mod) => (
                    <ThemedView key={mod.value} style={styles.moduleCard}>
                      <ThemedText style={styles.moduleTitle}>{mod.label}</ThemedText>
                      {mod.tipos.map((tipo) => (
                        <TouchableOpacity
                          key={`${mod.value}-${tipo}`}
                          style={styles.checkRow}
                          onPress={() => toggleCheckbox(mod.value, tipo, !checkboxes[mod.value]?.[tipo])}
                          activeOpacity={0.85}
                        >
                          <Ionicons
                            name={checkboxes[mod.value]?.[tipo] ? 'checkbox' : 'square-outline'}
                            size={22}
                            color="#007AFF"
                          />
                          <ThemedText style={styles.checkRowText}>{tipo}</ThemedText>
                        </TouchableOpacity>
                      ))}
                    </ThemedView>
                  ))}
                </ThemedView>

                <ThemedText style={styles.sectionTitle}>Firma del responsable</ThemedText>
                {!firma.trim() ? (
                  <>
                    <ThemedText style={styles.emptyText}>No hay firma registrada</ThemedText>
                    <TouchableOpacity
                      style={styles.signatureButtonPrimary}
                      onPress={() => void generateFirma()}
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
                    <TouchableOpacity style={[styles.signatureButtonPrimary, { marginTop: 8 }]} onPress={() => void scanFirma()} activeOpacity={0.85}>
                      <Ionicons name="qr-code-outline" size={18} color="#FFFFFF" />
                      <ThemedText style={styles.signatureButtonText}>Escanear QR</ThemedText>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    {(() => {
                      const info = decodeFirmaHash(firma);
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
                    <TouchableOpacity style={[styles.signatureButtonOutline, { marginTop: 10 }]} onPress={() => setFirma('')} activeOpacity={0.85}>
                      <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                      <ThemedText style={styles.signatureButtonOutlineText}>Eliminar firma</ThemedText>
                    </TouchableOpacity>
                  </>
                )}

                <TouchableOpacity
                  style={styles.modalPrimaryBtn}
                  onPress={() => void handleCreate()}
                  disabled={submitLoading}
                  activeOpacity={0.85}
                >
                  {submitLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
                      <ThemedText style={styles.modalPrimaryBtnText}>Confirmar y crear reporte por puesto</ThemedText>
                    </>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <ThemedView style={styles.filtersContainer}>
                  <ThemedView style={styles.filtersHeader}>
                    <TouchableOpacity
                      style={styles.filterToggleButton}
                      onPress={() => setIsConsultFiltersOpen((p) => !p)}
                      activeOpacity={0.85}
                    >
                      <ThemedText style={styles.filtersTitle}>Filtros de consulta</ThemedText>
                      <Ionicons name={isConsultFiltersOpen ? 'chevron-up' : 'chevron-down'} size={20} color="#007AFF" />
                    </TouchableOpacity>
                  </ThemedView>
                  {isConsultFiltersOpen ? (
                    <ThemedView style={styles.filtersContent}>
                      {renderPuestoSearch(
                        'consultar',
                        listPuestoSearch,
                        setListPuestoSearch,
                        listPuestoResults,
                        listPuestoSelected,
                        listPuestoSearching,
                        (it) => {
                          setListPuestoSelected(it);
                          setListPuestoSearch(formatStructureLite(it));
                          setListPuestoResults([]);
                        },
                        () => {
                          setListPuestoSelected(null);
                          setListPuestoSearch('');
                        },
                      )}
                      {renderDateRange('consultar', listDesdeD, listDesdeT, listHastaD, listHastaT, () => {
                        setListDesdeD(null);
                        setListDesdeT(null);
                      }, () => {
                        setListHastaD(null);
                        setListHastaT(null);
                      }, { desde: 'Creado desde (opcional)', hasta: 'Creado hasta (opcional)' })}
                      <TouchableOpacity style={styles.createButton} onPress={() => void loadList()} disabled={listLoading} activeOpacity={0.85}>
                        {listLoading ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <ThemedText style={styles.createButtonText}>
                            <Ionicons name="search" size={20} color="#FFFFFF" /> Buscar reportes por puesto
                          </ThemedText>
                        )}
                      </TouchableOpacity>
                    </ThemedView>
                  ) : null}
                </ThemedView>

                <ThemedText style={styles.sectionTitle}>Resultados</ThemedText>
                {rows.length === 0 ? (
                  <ThemedText style={styles.emptyText}>{listLoading ? 'Cargando lista…' : 'Sin reportes por puesto.'}</ThemedText>
                ) : (
                  rows.map((row) => (
                    <ThemedView key={row.id} style={styles.card}>
                      <ThemedText style={styles.cardTitle}>{row.nombre}</ThemedText>
                      <ThemedText style={styles.cardLine}>
                        <ThemedText style={styles.cardLabel}>Puesto: </ThemedText>
                        <ThemedText style={styles.cardValue}>{row.puesto_label ?? row.puesto_id}</ThemedText>
                      </ThemedText>
                      <ThemedText style={styles.cardLine}>
                        <ThemedText style={styles.cardLabel}>Estado: </ThemedText>
                        <ThemedText style={styles.cardValue}>
                          {formatEstado(row.aggregateEstado ?? 'pendiente')} ({row.completadosCount ?? 0}/{row.totalCount ?? 0} completados)
                        </ThemedText>
                      </ThemedText>
                      <TouchableOpacity style={styles.collapseButton} onPress={() => setExpandedId(expandedId === row.id ? null : row.id)} activeOpacity={0.85}>
                        <ThemedText style={styles.collapseButtonText}>
                          {expandedId === row.id ? 'Ocultar reportes incluidos' : 'Ver reportes incluidos'}
                        </ThemedText>
                        <Ionicons name={expandedId === row.id ? 'chevron-up' : 'chevron-down'} size={20} color="#007AFF" />
                      </TouchableOpacity>
                      {expandedId === row.id && (
                        <ThemedView style={styles.collapsableContent}>
                          {(row.childReports ?? []).map((c) => (
                            <ThemedText key={c.id} style={styles.detailText}>
                              • {REPORTES_PUESTO_MODULO_LABEL.get(c.modulo) ?? c.modulo} ({c.tipo_reporte}): {formatEstado(c.estado)}
                            </ThemedText>
                          ))}
                        </ThemedView>
                      )}
                      <TouchableOpacity
                        style={[styles.downloadBtnCard, downloadingId === row.id && { opacity: 0.6 }]}
                        onPress={() => void downloadPuestoZip(row)}
                        disabled={downloadingId != null}
                        activeOpacity={0.85}
                      >
                        {downloadingId === row.id ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Ionicons name="archive-outline" size={20} color="#fff" />
                        )}
                        <ThemedText style={styles.downloadBtnText}>Descargar ZIP (completados)</ThemedText>
                      </TouchableOpacity>
                    </ThemedView>
                  ))
                )}
              </>
            )}
          </ScrollView>
        </ThemedView>
      </View>

      {activePickerSlot ? (
        <DateTimePicker
          value={getPickerValue(activePickerSlot)}
          mode={activePickerSlot.endsWith('T') ? 'time' : 'date'}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(ev: { type?: string }, selected?: Date) => {
            const slot = activePickerSlot;
            if (Platform.OS === 'android') {
              setDatePickerSlot(null);
              setListDatePickerSlot(null);
              if (ev?.type !== 'set' || !selected || !slot) return;
              applyPickerResult(slot, selected);
              return;
            }
            if (!selected || !slot) return;
            applyPickerResult(slot, selected);
          }}
        />
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 16 },
  modalCard: {
    width: '100%',
    maxWidth: 820,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    maxHeight: '92%',
  },
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
  tabsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingTop: 10 },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  tabBtnActive: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  tabBtnText: { fontWeight: '700', color: '#333' },
  tabBtnTextActive: { color: '#fff' },
  modalBody: { maxHeight: 520 },
  modalBodyContent: { padding: 14, paddingBottom: 24 },

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
  filtersContent: { padding: 12, backgroundColor: '#F9F9F9', gap: 8 },

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
  textArea: { minHeight: 90, textAlignVertical: 'top' as const },

  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchIconBtn: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

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
  dateButtonText: { color: '#000', fontWeight: '700' },
  clearDateLink: { marginTop: 6, alignSelf: 'flex-start', marginBottom: 4 },
  clearDateLinkText: { color: '#FF3B30', fontSize: 13, fontWeight: '500' },

  modalFormCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 14,
  },
  modalSectionTitle: { fontSize: 15, fontWeight: '900', color: '#007AFF', marginBottom: 8 },
  sectionTitle: { marginTop: 14, marginBottom: 8, fontSize: 15, fontWeight: '800', color: '#007AFF' },

  resultList: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, overflow: 'hidden', marginTop: 4 },
  resultItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#E8E8E8', backgroundColor: '#FFFFFF' },
  assignedList: { marginTop: 8 },
  helperText: { fontSize: 13, color: '#666', lineHeight: 18 },
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

  smallActionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    alignItems: 'center',
    marginBottom: 10,
  },
  smallActionBtnText: { color: '#007AFF', fontWeight: '600' },
  moduleCard: {
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#FAFAFA',
  },
  moduleTitle: { fontWeight: '600', marginBottom: 4, color: '#000' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 8 },
  checkRowText: { flex: 1, fontSize: 14, color: '#000' },

  emptyText: { fontSize: 14, opacity: 0.6, textAlign: 'center', color: '#000', marginVertical: 12 },
  signatureButtonPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    gap: 8,
  },
  signatureButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
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
  signatureButtonOutlineText: { color: '#FF3B30', fontSize: 14, fontWeight: '600' },
  signatureInfo: { backgroundColor: '#F5F5F5', borderRadius: 8, padding: 10, marginTop: 8 },
  signatureInfoTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 4, color: '#000' },
  signatureInfoText: { fontSize: 12, marginBottom: 2, color: '#000' },

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

  createButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  createButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

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
  cardTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12, color: '#000' },
  cardLine: { marginBottom: 8, fontSize: 14 },
  cardLabel: { fontWeight: '600', color: '#666' },
  cardValue: { color: '#000' },
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
  collapsableContent: { marginTop: 8, padding: 10, borderRadius: 8, backgroundColor: '#F8F9FA' },
  detailText: { marginBottom: 6, color: '#000', fontSize: 12 },
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
    backgroundColor: '#34C759',
  },
  downloadBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
});
