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
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import * as Location from 'expo-location';
import DateTimePicker from '@react-native-community/datetimepicker';
import Ionicons from '@expo/vector-icons/Ionicons';
import SignatureScreen from 'react-native-signature-canvas';
import { jwtDecode } from 'jwt-decode';

import AppHeader from '../components/AppHeader';
import AppFooter from '../components/AppFooter';
import SlideMenu from '../components/SlideMenu';
import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import { useAuth } from '../contexts/AuthContext';
import { eventBus } from '../hooks/eventBus';
import getHoraAccion from '../hooks/getHoraAccion';
import { useQRScanner } from '../hooks/useQRScanner';
import {
  createDocumentoEntregado,
  deleteDocumentoEntregado,
  DocumentoEntregadoItem,
  getDocumentTypes,
  updateDocumentoEntregado,
} from '../hooks/documentosEntregadosFunctions';
import { listDocumentosEntregados } from '../hooks/documentosEntregadosFunctions';

type DocUI = DocumentoEntregadoItem & { id_local?: string };
type DocumentTypeUI = { id: number; nombre: string };

export default function DocumentosEntregadosScreen() {
  const navigation = useNavigation<any>();
  const { employee, refreshAccessToken, logout } = useAuth();
  const { scanQR, QRScannerComponent } = useQRScanner();

  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const handleMenuPress = () => setIsMenuVisible(true);
  const handleMenuClose = () => setIsMenuVisible(false);
  const handleHomePress = () => navigation.navigate('Home');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCurrentMarca, setHasCurrentMarca] = useState(true);

  const [docs, setDocs] = useState<DocUI[]>([]);

  // filtros (collapsable)
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  const [filterSearch, setFilterSearch] = useState('');
  const [filterFecha, setFilterFecha] = useState('');
  const [showFilterFechaPicker, setShowFilterFechaPicker] = useState(false);

  // tipos de documento (cache + offline)
  const [documentTypes, setDocumentTypes] = useState<DocumentTypeUI[]>([]);
  const [isDocTypeModalVisible, setIsDocTypeModalVisible] = useState(false);

  // create/edit (oculta lista al estar activo)
  const [isCreating, setIsCreating] = useState(false);
  const [editing, setEditing] = useState<DocUI | null>(null);

  const [fecha, setFecha] = useState('');
  const [showFechaPicker, setShowFechaPicker] = useState(false);
  const [nombreEntrega, setNombreEntrega] = useState('');
  const [nombreRecibe, setNombreRecibe] = useState('');
  const [tipoDocumento, setTipoDocumento] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [firmaCliente, setFirmaCliente] = useState('');
  const [firmaResponsable, setFirmaResponsable] = useState('');
  const [isGeneratingFirma, setIsGeneratingFirma] = useState(false);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);

  // firma dibujada (modal flotante)
  const [isSignatureModalVisible, setIsSignatureModalVisible] = useState(false);
  const signatureRef = useRef<any>(null);
  const [signatureKey, setSignatureKey] = useState(0);
  const [isReadingSignature, setIsReadingSignature] = useState(false);

  const dateToLocalString = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
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
    return current;
  };

  const fetchDocumentTypes = async () => {
    const res = await getDocumentTypes({ refreshAccessToken, logout });
    if (res.status && Array.isArray(res.documentTypes)) {
      setDocumentTypes(res.documentTypes as any);
    } else {
      setDocumentTypes([]);
    }
  };

  const fetchDocs = async () => {
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
        const res = await listDocumentosEntregados({
          marcaId: current.id,
          refreshAccessToken,
          logout,
        });
        if (res.status) {
          const list = (res.data || []).map((it: any) => ({ ...it, id_local: it.id_local || '' }));
          setDocs(list);
          await AsyncStorage.setItem('documentos_entregados_cache', JSON.stringify(list));
        } else {
          setError(res.message || 'Error al cargar documentos entregados');
          const cacheStr = await AsyncStorage.getItem('documentos_entregados_cache');
          if (cacheStr) setDocs(JSON.parse(cacheStr));
        }
      } else {
        const cacheStr = await AsyncStorage.getItem('documentos_entregados_cache');
        if (cacheStr) setDocs(JSON.parse(cacheStr));
      }
    } catch (e: any) {
      setError(e.message || 'Error al cargar documentos entregados');
      const cacheStr = await AsyncStorage.getItem('documentos_entregados_cache');
      if (cacheStr) setDocs(JSON.parse(cacheStr));
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchDocs();
      fetchDocumentTypes();
    }, [])
  );

  useEffect(() => {
    const handler = () => {
      fetchDocs();
      fetchDocumentTypes();
    };
    eventBus.on('connectionRestored', handler);
    return () => {
      eventBus.off('connectionRestored', handler);
    };
  }, []);

  const resetForm = () => {
    setFecha(dateToLocalString(new Date()));
    setNombreEntrega('');
    setNombreRecibe('');
    setTipoDocumento('');
    setDescripcion('');
    setFirmaCliente('');
    setFirmaResponsable('');
  };

  const startCreating = () => {
    resetForm();
    setEditing(null);
    setIsCreating(true);
  };

  const startEditing = (it: DocUI) => {
    setEditing(it);
    setIsCreating(true);
    setFecha(it.fecha ? String(it.fecha).split('T')[0] : dateToLocalString(new Date()));
    setNombreEntrega(it.nombre_oficial_entrega || '');
    setNombreRecibe(it.nombre_oficial_recibe || '');
    setTipoDocumento(it.tipo_documento || '');
    setDescripcion(it.descripcion || '');
    setFirmaCliente(it.firma_representante_cliente || '');
    setFirmaResponsable((it as any).firma_responsable || '');
  };

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
    } catch {
      Alert.alert('Error', 'No se pudo escanear el QR');
    }
  };

  const cancelCreating = () => {
    setIsCreating(false);
    setEditing(null);
  };

  const validateForm = () => {
    const required = [
      { label: 'Fecha', v: fecha },
      { label: 'Nombre oficial que entrega', v: nombreEntrega },
      { label: 'Nombre oficial que recibe', v: nombreRecibe },
      { label: 'Tipo de documento', v: tipoDocumento },
      { label: 'Descripción', v: descripcion },
    ];
    const missing = required.find((x) => !x.v || String(x.v).trim().length === 0);
    if (missing) {
      Alert.alert('Error', `Campo requerido: ${missing.label}`);
      return false;
    }
    if (!firmaCliente) {
      Alert.alert('Error', 'Debes registrar la firma del representante del cliente');
      return false;
    }
    if (!firmaResponsable) {
      Alert.alert('Error', 'Debes registrar la firma del responsable');
      return false;
    }
    return true;
  };

  const buildPayload = async () => {
    const current = await loadMarcaContext();
    if (!current?.id) throw new Error('Marca no encontrada');
    return {
      marca_id: current.id,
      fecha,
      nombre_oficial_entrega: nombreEntrega,
      nombre_oficial_recibe: nombreRecibe,
      tipo_documento: tipoDocumento,
      descripcion,
      firma_representante_cliente: firmaCliente,
      firma_responsable: firmaResponsable,
    };
  };

  // offline actions (igual patrón que otros módulos)
  const upsertAction = async (action: any) => {
    const actionsStr = await AsyncStorage.getItem('documentos_entregados_actions');
    const actions = actionsStr ? JSON.parse(actionsStr) : [];
    actions.push(action);
    await AsyncStorage.setItem('documentos_entregados_actions', JSON.stringify(actions));
  };

  const removeActionsForLocalId = async (localId: string) => {
    const actionsStr = await AsyncStorage.getItem('documentos_entregados_actions');
    if (!actionsStr) return;
    const actions = JSON.parse(actionsStr) || [];
    const updated = actions.filter((a: any) => a.id !== localId);
    await AsyncStorage.setItem('documentos_entregados_actions', JSON.stringify(updated));
  };

  const updateCreateActionForLocalId = async (localId: string, requestData: any) => {
    const actionsStr = await AsyncStorage.getItem('documentos_entregados_actions');
    if (!actionsStr) return false;
    const actions = JSON.parse(actionsStr) || [];
    let updatedAny = false;
    const updated = actions.map((a: any) => {
      if (a.type === 'create' && a.id === localId) {
        updatedAny = true;
        return { ...a, requestData };
      }
      return a;
    });
    if (updatedAny) {
      await AsyncStorage.setItem('documentos_entregados_actions', JSON.stringify(updated));
      return true;
    }
    return false;
  };

  const handleSave = async () => {
    if (!employee) return;
    if (!validateForm()) return;

    const payload = await buildPayload();
    const isConnected = await getConnectionStatus();

    // create
    if (!editing) {
      if (isConnected) {
        const res = await createDocumentoEntregado({ requestData: payload, refreshAccessToken, logout });
        if (res.status) {
          Alert.alert('Éxito', 'Documento entregado creado correctamente');
          setIsCreating(false);
          await fetchDocs();
        } else {
          Alert.alert('Error', res.message || 'No se pudo crear el documento');
        }
      } else {
        const localId = `local-doc-${Date.now()}`;
        const localItem: DocUI = {
          id: 0,
          id_local: localId,
          cliente_id: 0,
          corpo_id: 0,
          fecha: payload.fecha,
          nombre_oficial_entrega: payload.nombre_oficial_entrega,
          nombre_oficial_recibe: payload.nombre_oficial_recibe,
          tipo_documento: payload.tipo_documento,
          descripcion: payload.descripcion,
          firma_representante_cliente: payload.firma_representante_cliente,
          firma_responsable: payload.firma_responsable,
        };
        const next = [localItem, ...docs];
        setDocs(next);
        await AsyncStorage.setItem('documentos_entregados_cache', JSON.stringify(next));
        await upsertAction({ type: 'create', id: localId, requestData: payload });
        Alert.alert('Guardado (offline)', 'Se sincronizará cuando vuelva la conexión.');
        setIsCreating(false);
      }
      return;
    }

    // update
    const isLocal = !!editing.id_local || editing.id === 0;
    if (isConnected && !isLocal) {
      const res = await updateDocumentoEntregado({ id: editing.id, requestData: payload, refreshAccessToken, logout });
      if (res.status) {
        Alert.alert('Éxito', 'Documento entregado actualizado correctamente');
        setIsCreating(false);
        setEditing(null);
        await fetchDocs();
      } else {
        Alert.alert('Error', res.message || 'No se pudo actualizar el documento');
      }
    } else {
      const next = docs.map((it) => {
        const match =
          (editing.id_local && it.id_local === editing.id_local) || (!editing.id_local && it.id === editing.id);
        if (!match) return it;
        return {
          ...it,
          fecha: payload.fecha,
          nombre_oficial_entrega: payload.nombre_oficial_entrega,
          nombre_oficial_recibe: payload.nombre_oficial_recibe,
          tipo_documento: payload.tipo_documento,
          descripcion: payload.descripcion,
          firma_representante_cliente: payload.firma_representante_cliente,
          firma_responsable: payload.firma_responsable,
        };
      });
      setDocs(next);
      await AsyncStorage.setItem('documentos_entregados_cache', JSON.stringify(next));

      if (editing.id_local) {
        const updated = await updateCreateActionForLocalId(editing.id_local, payload);
        if (!updated) await upsertAction({ type: 'create', id: editing.id_local, requestData: payload });
      } else {
        await upsertAction({ type: 'update', id: editing.id, requestData: payload });
      }

      Alert.alert('Guardado (offline)', 'Los cambios se sincronizarán cuando vuelva la conexión.');
      setIsCreating(false);
      setEditing(null);
    }
  };

  const handleDelete = async (it: DocUI) => {
    const current = await loadMarcaContext();
    if (!current?.id) return;

    Alert.alert('Confirmar', '¿Deseas eliminar este registro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          const isConnected = await getConnectionStatus();

          // local-only
          if (it.id_local || it.id === 0) {
            const next = docs.filter((x) => x.id_local !== it.id_local);
            setDocs(next);
            await AsyncStorage.setItem('documentos_entregados_cache', JSON.stringify(next));
            if (it.id_local) await removeActionsForLocalId(it.id_local);
            return;
          }

          if (isConnected) {
            const res = await deleteDocumentoEntregado({ id: it.id, marcaId: current.id, refreshAccessToken, logout });
            if (res.status) {
              Alert.alert('Éxito', 'Documento eliminado correctamente');
              await fetchDocs();
            } else {
              Alert.alert('Error', res.message || 'No se pudo eliminar el documento');
            }
          } else {
            const next = docs.filter((x) => x.id !== it.id);
            setDocs(next);
            await AsyncStorage.setItem('documentos_entregados_cache', JSON.stringify(next));
            await upsertAction({ type: 'delete', id: it.id, marcaId: current.id });
            Alert.alert('Eliminado (offline)', 'La eliminación se sincronizará cuando vuelva la conexión.');
          }
        },
      },
    ]);
  };

  const resetAllFilters = () => {
    setFilterSearch('');
    setFilterFecha('');
  };

  const filteredDocs = useMemo(() => {
    const q = filterSearch.trim().toLowerCase();
    return docs.filter((it) => {
      if (filterFecha) {
        const d = it.fecha ? String(it.fecha).split('T')[0] : '';
        if (d !== filterFecha) return false;
      }
      if (!q) return true;
      const haystack = `${it.tipo_documento ?? ''} ${it.nombre_oficial_entrega ?? ''} ${it.nombre_oficial_recibe ?? ''} ${it.descripcion ?? ''
        }`.toLowerCase();
      return haystack.includes(q);
    });
  }, [docs, filterSearch, filterFecha]);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpanded = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // firma: modal flotante con recuadro claro + readSignature()
  const openSignatureModal = () => {
    setIsReadingSignature(false);
    setSignatureKey((k) => k + 1);
    setIsSignatureModalVisible(true);
  };
  const closeSignatureModal = () => {
    setIsSignatureModalVisible(false);
    setIsReadingSignature(false);
  };
  const clearSignatureInModal = () => {
    try {
      signatureRef.current?.clearSignature?.();
    } catch { }
    setIsReadingSignature(false);
    setSignatureKey((k) => k + 1);
  };
  const acceptSignature = () => {
    try {
      setIsReadingSignature(true);
      signatureRef.current?.readSignature?.();
    } catch {
      setIsReadingSignature(false);
      Alert.alert('Error', 'No se pudo leer la firma. Intenta nuevamente.');
    }
  };
  const handleSignatureRead = (signature: string) => {
    const sig = String(signature || '').trim();
    if (!sig || sig.length < 10) {
      Alert.alert('Error', 'No se detectó la firma. Intenta de nuevo.');
      setIsReadingSignature(false);
      return;
    }
    setFirmaCliente(sig);
    setIsReadingSignature(false);
    closeSignatureModal();
  };

  const renderItem = (it: DocUI, index: number) => {
    const key = it.id !== 0 ? `doc-${it.id}` : it.id_local ? `doc-${it.id_local}` : `doc-${index}`;
    const isExp = expanded.has(key);
    const d = it.fecha ? String(it.fecha).split('T')[0] : '';
    return (
      <ThemedView key={key} style={styles.card}>
        <ThemedText style={styles.cardTitle}>
          {it.tipo_documento || 'Documento'}
          {it.id_local ? ' (offline)' : ''}
        </ThemedText>

        <ThemedText style={styles.line}>
          <ThemedText style={styles.labelInline}>Fecha: </ThemedText>
          <ThemedText style={styles.valueInline}>{d}</ThemedText>
        </ThemedText>
        <ThemedText style={styles.line}>
          <ThemedText style={styles.labelInline}>Entrega: </ThemedText>
          <ThemedText style={styles.valueInline}>{it.nombre_oficial_entrega}</ThemedText>
        </ThemedText>
        <ThemedText style={styles.line}>
          <ThemedText style={styles.labelInline}>Recibe: </ThemedText>
          <ThemedText style={styles.valueInline}>{it.nombre_oficial_recibe}</ThemedText>
        </ThemedText>

        <TouchableOpacity style={styles.collapseButton} onPress={() => toggleExpanded(key)}>
          <ThemedText style={styles.collapseButtonText}>{isExp ? 'Ocultar detalles' : 'Ver detalles'}</ThemedText>
          <Ionicons name={isExp ? 'chevron-up' : 'chevron-down'} size={20} color="#007AFF" />
        </TouchableOpacity>

        {isExp && (
          <ThemedView style={styles.collapseContent}>
            <ThemedText style={styles.line}>
              <ThemedText style={styles.labelInline}>Descripción: </ThemedText>
              <ThemedText style={styles.valueInline}>{it.descripcion || '-'}</ThemedText>
            </ThemedText>

            <ThemedText style={styles.sectionTitle}>Firma representante cliente</ThemedText>
            {it.firma_representante_cliente ? (
              <ThemedView style={styles.signaturePreviewContainer}>
                <Image source={{ uri: it.firma_representante_cliente }} style={styles.signaturePreview} resizeMode="contain" />
              </ThemedView>
            ) : (
              <ThemedText style={styles.signatureHintMuted}>Aún no hay firma.</ThemedText>
            )}

            <ThemedText style={styles.sectionTitle}>Firma responsable</ThemedText>
            {!(it as any).firma_responsable ? (
              <ThemedText style={styles.signatureHintMuted}>Aún no hay firma responsable.</ThemedText>
            ) : (
              <ThemedView style={[styles.firmaInfoBox, { marginTop: 10 }]}>
                <ThemedView style={{ flex: 1, paddingRight: 10 }}>
                  <ThemedText style={styles.firmaInfoTitle}>Información de la firma:</ThemedText>
                  {(() => {
                    const info = decodeFirmaHash((it as any).firma_responsable);
                    if (!info) {
                      return <ThemedText style={styles.firmaInfoValue}>Formato no decodificable</ThemedText>;
                    }
                    return (
                      <>
                        <ThemedText style={styles.firmaInfoValue}>Sesión: {info.sessionId || 'N/A'}</ThemedText>
                        <ThemedText style={styles.firmaInfoValue}>Empleado: {info.empleadoId || 'N/A'}</ThemedText>
                        <ThemedText style={styles.firmaInfoValue}>
                          Lat: {info.latitud || 'N/A'} | Long: {info.longitud || 'N/A'}
                        </ThemedText>
                        <ThemedText style={styles.firmaInfoValue}>Hora: {info.timestamp || 'N/A'}</ThemedText>
                      </>
                    );
                  })()}
                </ThemedView>
              </ThemedView>
            )}
          </ThemedView>
        )}

        <ThemedView style={styles.rowButtons}>
          <TouchableOpacity style={[styles.rowButton, styles.editButton]} onPress={() => startEditing(it)}>
            <Ionicons name="pencil" size={18} color="#FFFFFF" />
            <ThemedText style={styles.rowButtonText}>Editar</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.rowButton, styles.deleteButton]} onPress={() => handleDelete(it)}>
            <Ionicons name="trash" size={18} color="#FFFFFF" />
            <ThemedText style={styles.rowButtonText}>Eliminar</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ThemedView>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={handleMenuPress} title="Documentos entregados" />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <ThemedView style={styles.content}>
          {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}

          <ThemedView style={styles.titleContainer}>
            <ThemedText type="title" style={styles.title}>
              <Ionicons name="document-text" size={22} color="#000000" /> Documentos entregados
            </ThemedText>
            <ThemedText style={styles.subtitle}>Control de documentos entregados al cliente</ThemedText>
          </ThemedView>

          {!hasCurrentMarca ? (
            <ThemedView style={styles.emptyContainer}>
              <ThemedText style={styles.errorText}>Debes tener una marca activa para usar este módulo.</ThemedText>
            </ThemedView>
          ) : null}

          {/* Filtros */}
          {!isCreating && (
            <ThemedView style={styles.filtersMain}>
              <ThemedView style={styles.filterHeader}>
                <TouchableOpacity style={styles.filterToggleButton} onPress={() => setIsFiltersExpanded(!isFiltersExpanded)}>
                  <ThemedText style={styles.filterToggleText}>Filtros</ThemedText>
                  <Ionicons name={isFiltersExpanded ? 'chevron-up' : 'chevron-down'} size={20} color="#007AFF" />
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
                  <ThemedView style={styles.filterGroup}>
                    <ThemedText style={styles.filterLabel}>Buscar (tipo/nombres/desc):</ThemedText>
                    <TextInput
                      style={styles.searchInput}
                      value={filterSearch}
                      onChangeText={setFilterSearch}
                      placeholder="Ej: Contrato / Juan / Entrega..."
                      placeholderTextColor="#999"
                    />
                  </ThemedView>

                  <ThemedView style={styles.filterGroup}>
                    <ThemedText style={styles.filterLabel}>Fecha:</ThemedText>
                    <TouchableOpacity style={styles.dateButton} onPress={() => setShowFilterFechaPicker(true)}>
                      <ThemedText style={styles.dateButtonText}>{filterFecha || 'Seleccionar fecha'}</ThemedText>
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
              <ThemedText style={styles.formTitle}>{editing ? 'Editar registro' : 'Nuevo registro'}</ThemedText>

              <ThemedText style={styles.label}>Fecha *</ThemedText>
              <TouchableOpacity style={styles.dateButton} onPress={() => setShowFechaPicker(true)}>
                <ThemedText style={styles.dateButtonText}>{fecha || 'Seleccionar fecha'}</ThemedText>
                <Ionicons name="calendar-outline" size={18} color="#007AFF" />
              </TouchableOpacity>

              <ThemedText style={styles.label}>Nombre oficial que entrega *</ThemedText>
              <TextInput style={styles.input} placeholder="Nombre" placeholderTextColor="#999" value={nombreEntrega} onChangeText={setNombreEntrega} />

              <ThemedText style={styles.label}>Nombre oficial que recibe *</ThemedText>
              <TextInput style={styles.input} placeholder="Nombre" placeholderTextColor="#999" value={nombreRecibe} onChangeText={setNombreRecibe} />

              <ThemedText style={styles.label}>Tipo de documento *</ThemedText>
              <TouchableOpacity style={styles.selectButton} onPress={() => setIsDocTypeModalVisible(true)}>
                <ThemedText style={styles.selectButtonText}>{tipoDocumento || 'Seleccionar tipo de documento'}</ThemedText>
                <Ionicons name="chevron-down" size={18} color="#007AFF" />
              </TouchableOpacity>

              <ThemedText style={styles.label}>Descripción *</ThemedText>
              <TextInput
                style={[styles.input, styles.textArea]}
                multiline
                placeholder="Descripción..."
                placeholderTextColor="#999"
                value={descripcion}
                onChangeText={setDescripcion}
              />

              <ThemedText style={styles.sectionTitle}>Firma representante cliente *</ThemedText>
              {firmaCliente ? (
                <ThemedView style={styles.signaturePreviewContainer}>
                  <Image source={{ uri: firmaCliente }} style={styles.signaturePreview} resizeMode="contain" />
                  <TouchableOpacity style={styles.removeSignatureButton} onPress={() => setFirmaCliente('')}>
                    <Ionicons name="trash" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </ThemedView>
              ) : null}

              <TouchableOpacity style={styles.openSignatureButton} onPress={openSignatureModal}>
                <Ionicons name="create-outline" size={20} color="#000000" />
                <ThemedText style={styles.openSignatureButtonText}>{firmaCliente ? 'Modificar firma' : 'Agregar firma'}</ThemedText>
              </TouchableOpacity>

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
                <TouchableOpacity style={styles.signatureButton} onPress={handleScanFirmaResponsable}>
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
                          <ThemedText style={styles.firmaInfoValue}>
                            Lat: {info.latitud || 'N/A'} | Long: {info.longitud || 'N/A'}
                          </ThemedText>
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

          {/* Lista (oculta mientras se crea/edita) */}
          {!isCreating && (
            <>
              {isLoading ? (
                <ThemedView style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#007AFF" />
                  <ThemedText style={styles.loadingText}>Cargando...</ThemedText>
                </ThemedView>
              ) : filteredDocs.length === 0 ? (
                <ThemedView style={styles.emptyContainer}>
                  <ThemedText style={styles.emptyText}>No hay registros</ThemedText>
                </ThemedView>
              ) : (
                <ThemedView style={styles.listContainer}>{filteredDocs.map(renderItem)}</ThemedView>
              )}
            </>
          )}
        </ThemedView>
      </ScrollView>

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

      {showFechaPicker && (
        <DateTimePicker
          value={fecha ? new Date(fecha) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, date) => {
            setShowFechaPicker(false);
            if (date) setFecha(dateToLocalString(date));
          }}
        />
      )}

      {/* Modal select tipo_documento */}
      <Modal visible={isDocTypeModalVisible} transparent animationType="fade" onRequestClose={() => setIsDocTypeModalVisible(false)}>
        <View style={styles.overlay}>
          <ThemedView style={styles.floatModalCard}>
            <ThemedView style={styles.floatModalHeader}>
              <ThemedText style={styles.modalTitle}>Tipo de documento</ThemedText>
              <TouchableOpacity onPress={() => setIsDocTypeModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </ThemedView>
            <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ padding: 12 }}>
              {documentTypes.length === 0 ? (
                <ThemedText style={styles.signatureHintMuted}>No hay tipos disponibles (sin conexión y sin cache).</ThemedText>
              ) : (
                documentTypes.map((t) => (
                  <TouchableOpacity
                    key={String(t.id)}
                    style={[styles.optionRow, tipoDocumento === t.nombre && styles.optionRowSelected]}
                    onPress={() => {
                      setTipoDocumento(t.nombre);
                      setIsDocTypeModalVisible(false);
                    }}
                  >
                    <ThemedText style={styles.optionText}>{t.nombre}</ThemedText>
                    {tipoDocumento === t.nombre ? <Ionicons name="checkmark" size={18} color="#34C759" /> : null}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </ThemedView>
        </View>
      </Modal>

      {/* Modal flotante firma */}
      <Modal
        visible={isSignatureModalVisible}
        animationType="fade"
        transparent
        presentationStyle="overFullScreen"
        onRequestClose={closeSignatureModal}
      >
        <View style={styles.overlay}>
          <ThemedView style={styles.floatModalCard}>
            <ThemedView style={styles.floatModalHeader}>
              <ThemedText style={styles.modalTitle}>Dibujar firma</ThemedText>
              <TouchableOpacity onPress={closeSignatureModal}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </ThemedView>

            <ThemedText style={styles.signatureModalHint}>Firma dentro del recuadro blanco.</ThemedText>
            <View style={styles.signaturePadBox}>
              <SignatureScreen
                ref={signatureRef}
                onOK={handleSignatureRead}
                onEmpty={() => {
                  setIsReadingSignature(false);
                  Alert.alert('Error', 'No se detectó la firma. Intenta de nuevo.');
                }}
                descriptionText=""
                clearText=""
                confirmText=""
                webStyle={`
                  .m-signature-pad--footer {display: none; margin: 0px;}
                  .m-signature-pad {box-shadow: none; border: none;}
                  body,html {width: 100%; height: 100%; background: #ffffff;}
                `}
                key={signatureKey}
              />
            </View>

            <ThemedView style={styles.modalActions}>
              <TouchableOpacity style={styles.modalClearButton} onPress={clearSignatureInModal}>
                <Ionicons name="trash" size={20} color="#000000" />
                <ThemedText style={styles.modalClearButtonText}>Limpiar</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalAcceptButton, isReadingSignature && { opacity: 0.7 }]}
                onPress={acceptSignature}
                disabled={isReadingSignature}
              >
                {isReadingSignature ? <ActivityIndicator size="small" color="#000000" /> : <Ionicons name="checkmark" size={20} color="#000000" />}
                <ThemedText style={styles.modalAcceptButtonText}>Aceptar</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          </ThemedView>
        </View>
      </Modal>

      <AppFooter />
      <SlideMenu isVisible={isMenuVisible} onClose={handleMenuClose} onHomePress={handleHomePress} currentRoute="DocumentosEntregados" />
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
  title: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, opacity: 0.7, textAlign: 'center' },

  filtersMain: {
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F0F0F0',
  },
  filterToggleButton: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterToggleText: { fontSize: 14, fontWeight: '600', color: '#007AFF' },
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
  filterContent: { padding: 12, backgroundColor: '#F9F9F9', gap: 8 },
  filterGroup: { marginBottom: 8, backgroundColor: '#F9F9F9' },
  filterLabel: { fontSize: 13, fontWeight: '600', marginBottom: 4, color: '#000' },
  searchInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    backgroundColor: '#FFFFFF',
    color: '#000000',
  },

  dateButton: {
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  dateButtonText: { color: '#000', fontWeight: '600' },

  createButton: { backgroundColor: '#007AFF', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginBottom: 16 },
  createButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },

  formCard: { marginTop: 12, backgroundColor: '#fff', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#E0E0E0' },
  formTitle: { fontSize: 18, fontWeight: '800', marginBottom: 10, color: '#000' },
  label: { fontSize: 13, fontWeight: '700', marginTop: 10, color: '#333' },
  input: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, backgroundColor: '#fff', color: '#000', marginBottom: 6 },
  textArea: { minHeight: 90, textAlignVertical: 'top' },

  selectButton: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  selectButtonText: { color: '#000', fontWeight: '600' },

  sectionTitle: { marginTop: 14, fontSize: 15, fontWeight: '800', color: '#007AFF' },

  signaturePreviewContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    marginTop: 10,
    marginBottom: 10,
    position: 'relative',
  },
  signaturePreview: { width: '100%', height: '100%' },
  removeSignatureButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  openSignatureButton: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingVertical: 12,
    backgroundColor: '#F8F9FA',
    gap: 10,
  },
  openSignatureButtonText: { fontWeight: '800', color: '#000' },

  formActions: { marginTop: 16, flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  formActionButton: { flex: 1, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12 },
  formActionCancel: { backgroundColor: '#EDEDED' },
  formActionCancelText: { color: '#000', fontWeight: '800' },
  formActionSave: { backgroundColor: '#007AFF' },
  formActionSaveText: { color: '#fff', fontWeight: '800' },

  listContainer: {},
  emptyContainer: { padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 14, opacity: 0.6, textAlign: 'center', color: '#000' },

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
  line: { marginBottom: 6, color: '#000' },
  labelInline: { fontWeight: '700', color: '#333' },
  valueInline: { color: '#000' },

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
  collapseContent: { marginTop: 8, padding: 10, borderRadius: 8, backgroundColor: '#F8F9FA' },

  rowButtons: { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 8, gap: 8 },
  editButton: { backgroundColor: '#007AFF' },
  deleteButton: { backgroundColor: '#FF3B30' },
  rowButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },

  // overlays
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  floatModalCard: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  floatModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#F8F9FA',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#000' },
  signatureModalHint: { paddingHorizontal: 16, paddingTop: 12, color: '#666', fontSize: 13 },
  signaturePadBox: {
    marginTop: 10,
    marginHorizontal: 16,
    height: 260,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  modalClearButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#EDEDED',
    gap: 8,
  },
  modalClearButtonText: { fontWeight: '800', color: '#000' },
  modalAcceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#D7F5E5',
    gap: 8,
  },
  modalAcceptButtonText: { fontWeight: '800', color: '#000' },
  signatureHintMuted: { marginTop: 6, color: '#999' },

  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  optionRowSelected: {
    borderColor: '#34C759',
    backgroundColor: '#EAF9EF',
  },
  optionText: { fontWeight: '800', color: '#000' },

  // Firma responsable (mismo patrón que módulos anteriores)
  signatureButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, backgroundColor: '#fff', marginTop: 8 },
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
  signatureButtonDisabled: { backgroundColor: '#999' },
  signatureButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', marginLeft: 8 },

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
  firmaClearButtonTiny: { width: 38, height: 38, borderRadius: 8, backgroundColor: '#FF3B30', alignItems: 'center', justifyContent: 'center' },
});


