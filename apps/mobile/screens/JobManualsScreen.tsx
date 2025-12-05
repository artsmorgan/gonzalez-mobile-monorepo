import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, ScrollView, StyleSheet, TextInput, TouchableOpacity, View, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Network from 'expo-network';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { useAuth } from '../contexts/AuthContext';
import { ThemedView } from '../components/ThemedView';
import { ThemedText } from '../components/ThemedText';
import AppHeader from '../components/AppHeader';
import AppFooter from '../components/AppFooter';
import SlideMenu from '../components/SlideMenu';
import { eventBus } from '../hooks/eventBus';
import { createJobManual, listJobManualsByMarca } from '../hooks/jobManualsFunctions';
import getHoraAccion from '../hooks/getHoraAccion';
import { useQRScanner } from '../hooks/useQRScanner';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import { jwtDecode } from 'jwt-decode';

type JobManualsNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

type RoleName = 'OPERATIVO' | 'SUPERVISOR' | 'ADMINISTRATIVO' | string | null;

interface Puesto {
  id: number;
  nombre: string;
}

interface FirmaData {
  sessionId: string;
  empleadoId: string;
  latitud: string;
  longitud: string;
  timestamp: string;
  empleadoDetalle?: {
    nombre: string;
    primer_apellido: string;
    segundo_apellido: string;
    cedula_empleado: string;
  };
}

interface ManualFileLocal {
  id: string;
  type: 'image' | 'audio' | 'video' | 'document';
  name: string;
  extension: string;
  base64: string;
}

interface ManualFileRemote {
  id: number;
  type: string;
  extension: string;
  name: string;
  url: string;
}

interface JobManualRemote {
  id: number;
  title: string;
  description: string;
  firma: string;
  puesto: {
    id: number;
    nombre: string;
  };
  created_by: string;
  created_at: string;
  files: ManualFileRemote[];
  visualizaciones: {
    id: number;
    empleado_id: number;
    manual_puesto_id: number;
    nombre_empleado: string;
    firma_empleado: string;
    created_at: string;
  }[];
  currentEmployeeSigned: boolean;
  id_local?: string;
}

export default function JobManualsScreen() {
  const { employee, refreshAccessToken, logout } = useAuth();
  const navigation = useNavigation<JobManualsNavigationProp>();
  const [isMenuVisible, setIsMenuVisible] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [hasMarca, setHasMarca] = useState(false);
  const [marcaId, setMarcaId] = useState<number | null>(null);
  const [roleName, setRoleName] = useState<RoleName>(null);
  const [puestoActualNombre, setPuestoActualNombre] = useState<string>('');

  const [isCreating, setIsCreating] = useState(false);
  const [manuals, setManuals] = useState<JobManualRemote[]>([]);
  const [isLoadingManuals, setIsLoadingManuals] = useState(false);
  const [selectedManual, setSelectedManual] = useState<JobManualRemote | null>(null);
  const [isViewerVisible, setIsViewerVisible] = useState(false);

  const tituloRef = useRef('');
  const descripcionRef = useRef('');

  const [availablePuestos, setAvailablePuestos] = useState<Puesto[]>([]);
  const [selectedPuestos, setSelectedPuestos] = useState<number[]>([]);

  const [textFiles, setTextFiles] = useState<ManualFileLocal[]>([]);
  const [imageFiles, setImageFiles] = useState<ManualFileLocal[]>([]);
  const [audioFiles, setAudioFiles] = useState<ManualFileLocal[]>([]);
  const [videoFiles, setVideoFiles] = useState<ManualFileLocal[]>([]);

  const [firmaResponsable, setFirmaResponsable] = useState<FirmaData | null>(null);
  const [isGeneratingFirma, setIsGeneratingFirma] = useState(false);

  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  const { scanQR, QRScannerComponent } = useQRScanner();

  const getConnectionStatus = async (): Promise<boolean> => {
    try {
      const networkState = await Network.getNetworkStateAsync();
      return networkState.isConnected === true && networkState.isInternetReachable === true;
    } catch (error) {
      console.error('Error checking network:', error);
      return false;
    }
  };

  const fetchCurrentMarca = useCallback(async () => {
    try {
      setIsLoading(true);
      const currentMarcaStr = await AsyncStorage.getItem('current_marca');
      if (!currentMarcaStr) {
        setHasMarca(false);
        setIsLoading(false);
        return;
      }

      const currentMarca = JSON.parse(currentMarcaStr);
      setHasMarca(true);
      setMarcaId(currentMarca.id);
      setPuestoActualNombre(currentMarca.puesto?.nombre || '');
      const role = currentMarca.roleDivision?.role?.nombre || null;
      setRoleName(role);

      // Cargar puestos por corpo para selección en formulario (similar a NotesScreen)
      const corpoId = currentMarca.corpo?.id;
      if (corpoId) {
        await fetchPuestosCorpo(corpoId);
      }

      // Cargar manuales para visualización
      await fetchManuals(currentMarca.id);
    } catch (error) {
      console.error('Error fetching current marca for job manuals:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchPuestosCorpo = async (corpoId: number) => {
    try {
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) {
        throw new Error('Server URL not configured');
      }

      const isConnected = await getConnectionStatus();

      if (isConnected) {
        let token = await AsyncStorage.getItem('access_token');
        if (!token) {
          const refreshed = await refreshAccessToken();
          if (!refreshed) {
            throw new Error('No authentication token found');
          }
          token = await AsyncStorage.getItem('access_token');
        }

        const response = await fetch(`${apiUrl}/api/puestos/corpo/${corpoId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': '69420',
          },
        });

        if (response.status === 401 || response.status === 403) {
          const refreshed = await refreshAccessToken();
          if (refreshed) {
            return fetchPuestosCorpo(corpoId);
          } else {
            await logout();
            return;
          }
        }

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const puestosData: Puesto[] = data?.puestos || [];
        setAvailablePuestos(puestosData);
        await AsyncStorage.setItem(`puestos_corpo_cache_${corpoId}`, JSON.stringify(puestosData));
      } else {
        const puestosCache = await AsyncStorage.getItem(`puestos_corpo_cache_${corpoId}`);
        if (puestosCache) {
          const cachedPuestos = JSON.parse(puestosCache);
          setAvailablePuestos(cachedPuestos);
        } else {
          setAvailablePuestos([]);
        }
      }
    } catch (error) {
      console.error('Error fetching puestos corpo for job manuals:', error);
    }
  };

  const fetchManuals = async (marcaIdToUse: number) => {
    try {
      setIsLoadingManuals(true);
      const isConnected = await getConnectionStatus();

      if (isConnected) {
        const result = await listJobManualsByMarca({
          marcaId: marcaIdToUse,
          refreshAccessToken,
          logout,
        });

        if (result.status && result.manuals) {
          setManuals(result.manuals as JobManualRemote[]);
          await AsyncStorage.setItem('job_manuals_cache', JSON.stringify(result.manuals));
        } else {
          setManuals([]);
        }
      } else {
        const cacheStr = await AsyncStorage.getItem('job_manuals_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          setManuals(cache);
        } else {
          setManuals([]);
        }
      }
    } catch (error) {
      console.error('Error fetching job manuals:', error);
      try {
        const cacheStr = await AsyncStorage.getItem('job_manuals_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          setManuals(cache);
        }
      } catch (cacheErr) {
        console.error('Error loading job manuals from cache:', cacheErr);
      }
    } finally {
      setIsLoadingManuals(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchCurrentMarca();
      const handler = () => {
        if (marcaId) {
          fetchManuals(marcaId);
        } else {
          fetchCurrentMarca();
        }
      };
      eventBus.on('connectionRestored', handler);
      return () => {
        eventBus.off('connectionRestored', handler);
      };
    }, [fetchCurrentMarca, marcaId])
  );

  useEffect(() => {
    // Para el ejemplo del formulario, no obtenemos la localización real.
    // Se puede integrar expo-location luego, como en TrainingsScreen.
    setLocation(null);
  }, []);

  const handleMenuPress = () => {
    setIsMenuVisible(true);
  };

  const handleMenuClose = () => {
    setIsMenuVisible(false);
  };

  const handleHomePress = () => {
    navigation.navigate('Home');
  };

  const startCreating = () => {
    setIsCreating(true);
    tituloRef.current = '';
    descripcionRef.current = '';
    setSelectedPuestos([]);
    setTextFiles([]);
    setImageFiles([]);
    setAudioFiles([]);
    setVideoFiles([]);
    setFirmaResponsable(null);
  };

  const cancelCreating = () => {
    setIsCreating(false);
  };

  const togglePuestoSelection = (puestoId: number) => {
    setSelectedPuestos(prev => {
      if (prev.includes(puestoId)) {
        return prev.filter(id => id !== puestoId);
      }
      return [...prev, puestoId];
    });
  };

  const handleAddFilePlaceholder = (type: ManualFileLocal['type']) => {
    Alert.alert(
      'Pendiente',
      `La selección de archivos de tipo ${type} se implementará en el siguiente paso. Por ahora, el formulario está preparado para recibirlos.`
    );
  };

  const generateSignature = async () => {
    if (!employee) {
      Alert.alert('Error', 'No se pudo obtener la información del empleado');
      return;
    }

    if (!location) {
      Alert.alert('Error', 'No se pudo obtener la ubicación (pendiente de implementar)');
      return;
    }

    setIsGeneratingFirma(true);

    try {
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) {
        throw new Error('Server URL not configured');
      }

      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const decodedToken: any = jwtDecode(token);
      const sessionId = decodedToken.sessionId;

      const horaAccion = await getHoraAccion();
      if (!horaAccion) {
        throw new Error('Hora de acción not found');
      }

      const hash = btoa(
        sessionId +
          ':' +
          employee.id +
          ':' +
          location.latitude +
          ':' +
          location.longitude +
          ':' +
          horaAccion
      );

      const decodedHash = atob(hash);
      const [decodedSessionId, decodedEmpleadoId, decodedLatitud, decodedLongitud, decodedTimestamp] =
        decodedHash.split(':');

      let empleadoDetalle = undefined;
      const isConnected = await getConnectionStatus();
      if (isConnected) {
        const response = await fetch(`${apiUrl}/api/empleados/${decodedEmpleadoId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': '69420',
          },
        });

        if (response.ok) {
          const empleadoData = await response.json();
          empleadoDetalle = {
            nombre: empleadoData.nombre,
            primer_apellido: empleadoData.primer_apellido,
            segundo_apellido: empleadoData.segundo_apellido,
            cedula_empleado: empleadoData.cedula,
          };
        }
      }

      setFirmaResponsable({
        sessionId: decodedSessionId,
        empleadoId: decodedEmpleadoId,
        latitud: decodedLatitud,
        longitud: decodedLongitud,
        timestamp: decodedTimestamp,
        empleadoDetalle,
      });
    } catch (error) {
      console.error('Error generating signature for job manual:', error);
      Alert.alert('Error', 'No se pudo generar la firma');
    } finally {
      setIsGeneratingFirma(false);
    }
  };

  const handleScanQR = async () => {
    try {
      const result = await scanQR();
      if (!result) return;
      Alert.alert('QR', 'Escaneo de QR para firma aún no implementado en este módulo.');
    } catch (error) {
      console.error('Error scanning QR for job manual:', error);
      Alert.alert('Error', 'No se pudo escanear el código QR');
    }
  };

  const handleCreateManual = async () => {
    try {
      if (!marcaId) {
        Alert.alert('Error', 'No se encontró la marca actual');
        return;
      }

      if (!tituloRef.current.trim()) {
        Alert.alert('Error', 'El título es obligatorio');
        return;
      }

      if (!descripcionRef.current.trim()) {
        Alert.alert('Error', 'La descripción es obligatoria');
        return;
      }

      if (!firmaResponsable) {
        Alert.alert('Error', 'La firma del responsable es obligatoria');
        return;
      }

      const puestosArray = selectedPuestos.length > 0 ? selectedPuestos : [];
      const filesPayload: ManualFileLocal[] = [
        ...textFiles,
        ...imageFiles,
        ...audioFiles,
        ...videoFiles,
      ];

      const signatureString = `${firmaResponsable.sessionId}:${firmaResponsable.empleadoId}:${firmaResponsable.latitud}:${firmaResponsable.longitud}:${firmaResponsable.timestamp}`;
      const signatureHash = btoa(signatureString);

      const requestBody = {
        title: tituloRef.current,
        description: descripcionRef.current,
        firma_responsable: signatureHash,
        puestos: JSON.stringify(puestosArray),
        files: JSON.stringify(
          filesPayload.map(f => ({
            type: f.type,
            extension: f.extension,
            file_base64: f.base64,
          }))
        ),
      };

      const isConnected = await getConnectionStatus();

      if (isConnected) {
        const result = await createJobManual({
          requestData: requestBody,
          marcaId,
          refreshAccessToken,
          logout,
        });

        if (result.status) {
          Alert.alert('Éxito', result.message || 'Manual creado correctamente');
          setIsCreating(false);
        } else {
          Alert.alert('Error', result.message || 'No se pudo crear el manual');
        }
      } else {
        const localId = `local_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const actionsStr = await AsyncStorage.getItem('job_manuals_actions');
        const actions = actionsStr ? JSON.parse(actionsStr) : [];
        actions.push({
          requestData: requestBody,
          marcaId,
          id: localId,
          type: 'create',
        });
        await AsyncStorage.setItem('job_manuals_actions', JSON.stringify(actions));

        // Opcional: cache local de manuales
        const cacheStr = await AsyncStorage.getItem('job_manuals_cache');
        const cache = cacheStr ? JSON.parse(cacheStr) : [];
        cache.push({
          id: 0,
          id_local: localId,
          title: tituloRef.current,
          description: descripcionRef.current,
          puestoActualNombre,
          created_by: employee?.name || '-',
          created_at: new Date().toISOString(),
        });
        await AsyncStorage.setItem('job_manuals_cache', JSON.stringify(cache));

        Alert.alert('Modo Offline', 'Manual registrado localmente. Se sincronizará cuando haya conexión.');
        setIsCreating(false);
      }
    } catch (error) {
      console.error('Error creating job manual:', error);
      Alert.alert('Error', 'No se pudo crear el manual');
    }
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <ThemedText style={styles.loadingText}>Cargando...</ThemedText>
      </ThemedView>
    );
  }

  if (!hasMarca) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText style={styles.noMarcaTitle}>No se encontró la marca actual</ThemedText>
        <ThemedText style={styles.noMarcaMessage}>
          Este módulo requiere una marca activa para mostrar los manuales de puesto disponibles.
        </ThemedText>
      </ThemedView>
    );
  }

  const canCreate = roleName === 'SUPERVISOR' || roleName === 'ADMINISTRATIVO';

  return (
    <ThemedView style={styles.fullContainer}>
      <AppHeader onMenuPress={handleMenuPress} title="Manuales de puesto" />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <ThemedView style={styles.contentContainer}>
          <ThemedView style={styles.titleContainer}>
            <ThemedText type="title" style={styles.title}>
              Manuales de puesto
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              Consulta y registra manuales asociados a tu puesto.
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.puestoContainer}>
            <ThemedText style={styles.puestoLabel}>Puesto actual:</ThemedText>
            <ThemedText style={styles.puestoName}>{puestoActualNombre || 'No disponible'}</ThemedText>
          </ThemedView>

          {canCreate && !isCreating && (
            <TouchableOpacity style={styles.createButton} onPress={startCreating}>
              <Ionicons name="add-circle" size={20} color="#FFFFFF" />
              <ThemedText style={styles.createButtonText}>Crear nuevo manual</ThemedText>
            </TouchableOpacity>
          )}

          {canCreate && isCreating && (
            <ThemedView style={styles.formCard}>
              <ThemedText style={styles.formTitle}>Nuevo manual de puesto</ThemedText>

              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Título *</ThemedText>
                <TextInput
                  style={styles.formInput}
                  defaultValue={tituloRef.current}
                  onChangeText={(text) => {
                    tituloRef.current = text;
                  }}
                  placeholder="Título del manual"
                  placeholderTextColor="#999"
                />
              </ThemedView>

              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Descripción *</ThemedText>
                <TextInput
                  style={[styles.formInput, styles.textArea]}
                  defaultValue={descripcionRef.current}
                  onChangeText={(text) => {
                    descripcionRef.current = text;
                  }}
                  placeholder="Descripción del manual"
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={4}
                />
              </ThemedView>

              {/* Selección de puestos */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Puestos que recibirán el manual:</ThemedText>
                {availablePuestos.length === 0 ? (
                  <ThemedText style={styles.emptyText}>
                    No hay puestos disponibles para este corpo.
                  </ThemedText>
                ) : (
                  <ThemedView style={styles.puestosList}>
                    {availablePuestos.map((puesto) => {
                      const isSelected = selectedPuestos.includes(puesto.id);
                      return (
                        <TouchableOpacity
                          key={puesto.id}
                          style={[
                            styles.puestoItem,
                            isSelected && styles.puestoItemSelected,
                          ]}
                          onPress={() => togglePuestoSelection(puesto.id)}
                        >
                          <ThemedText
                            style={[
                              styles.puestoItemText,
                              isSelected && styles.puestoItemTextSelected,
                            ]}
                          >
                            {puesto.nombre}
                          </ThemedText>
                        </TouchableOpacity>
                      );
                    })}
                  </ThemedView>
                )}
              </ThemedView>

              {/* Archivos por tipo - placeholders */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Archivos de texto</ThemedText>
                <TouchableOpacity
                  style={styles.addFileButton}
                  onPress={() => handleAddFilePlaceholder('document')}
                >
                  <Ionicons name="document-text-outline" size={18} color="#007AFF" />
                  <ThemedText style={styles.addFileButtonText}>Añadir archivo de texto</ThemedText>
                </TouchableOpacity>
              </ThemedView>

              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Imágenes</ThemedText>
                <TouchableOpacity
                  style={styles.addFileButton}
                  onPress={() => handleAddFilePlaceholder('image')}
                >
                  <Ionicons name="image-outline" size={18} color="#007AFF" />
                  <ThemedText style={styles.addFileButtonText}>Añadir imagen</ThemedText>
                </TouchableOpacity>
              </ThemedView>

              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Audio</ThemedText>
                <TouchableOpacity
                  style={styles.addFileButton}
                  onPress={() => handleAddFilePlaceholder('audio')}
                >
                  <Ionicons name="mic-outline" size={18} color="#007AFF" />
                  <ThemedText style={styles.addFileButtonText}>Añadir audio</ThemedText>
                </TouchableOpacity>
              </ThemedView>

              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Video</ThemedText>
                <TouchableOpacity
                  style={styles.addFileButton}
                  onPress={() => handleAddFilePlaceholder('video')}
                >
                  <Ionicons name="videocam-outline" size={18} color="#007AFF" />
                  <ThemedText style={styles.addFileButtonText}>Añadir video</ThemedText>
                </TouchableOpacity>
              </ThemedView>

              {/* Firma responsable */}
              <ThemedView style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Firma del responsable *</ThemedText>
                {!firmaResponsable ? (
                  <ThemedView style={styles.signatureButtons}>
                    <TouchableOpacity
                      style={styles.signatureButton}
                      onPress={generateSignature}
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
                      onPress={handleScanQR}
                    >
                      <Ionicons name="qr-code-outline" size={18} color="#FFFFFF" />
                      <ThemedText style={styles.signatureButtonText}>Escanear QR</ThemedText>
                    </TouchableOpacity>
                  </ThemedView>
                ) : (
                  <ThemedView style={styles.signatureInfo}>
                    <ThemedText style={styles.signatureInfoTitle}>Información de la firma:</ThemedText>
                    <ThemedText style={styles.signatureInfoText}>ID de sesión: {firmaResponsable.sessionId}</ThemedText>
                    <ThemedText style={styles.signatureInfoText}>ID del empleado: {firmaResponsable.empleadoId}</ThemedText>
                    {firmaResponsable.empleadoDetalle && (
                      <ThemedView style={styles.signatureInfoDetail}>
                        <ThemedText style={styles.signatureInfoDetailText}>
                          {firmaResponsable.empleadoDetalle.nombre}{' '}
                          {firmaResponsable.empleadoDetalle.primer_apellido}{' '}
                          {firmaResponsable.empleadoDetalle.segundo_apellido}{' '}
                          ({firmaResponsable.empleadoDetalle.cedula_empleado})
                        </ThemedText>
                      </ThemedView>
                    )}
                    <ThemedText style={styles.signatureInfoText}>Latitud: {firmaResponsable.latitud}</ThemedText>
                    <ThemedText style={styles.signatureInfoText}>Longitud: {firmaResponsable.longitud}</ThemedText>
                    <ThemedText style={styles.signatureInfoText}>Hora actual: {firmaResponsable.timestamp}</ThemedText>
                    <TouchableOpacity
                      style={styles.clearSignatureButton}
                      onPress={() => setFirmaResponsable(null)}
                    >
                      <ThemedText style={styles.clearSignatureText}>Limpiar</ThemedText>
                    </TouchableOpacity>
                  </ThemedView>
                )}
              </ThemedView>

              {/* Acciones del formulario */}
              <ThemedView style={styles.formActions}>
                <TouchableOpacity
                  style={[styles.formButton, styles.cancelButton]}
                  onPress={cancelCreating}
                >
                  <ThemedText style={styles.formButtonText}>Cancelar</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.formButton, styles.confirmButton]}
                  onPress={handleCreateManual}
                >
                  <ThemedText style={styles.formButtonText}>Guardar</ThemedText>
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>
          )}

          {/* Lista de manuales para todos los roles */}
          <ThemedView style={styles.listContainer}>
            {isLoadingManuals ? (
              <ThemedView style={styles.loadingManualsContainer}>
                <ActivityIndicator size="small" color="#007AFF" />
                <ThemedText style={styles.loadingText}>Cargando manuales...</ThemedText>
              </ThemedView>
            ) : manuals.length === 0 ? (
              <ThemedText style={styles.emptyText}>
                No hay manuales de puesto registrados para este puesto.
              </ThemedText>
            ) : (
              manuals.map((manual) => (
                <TouchableOpacity
                  key={manual.id || manual.id_local || `manual-${manual.title}`}
                  style={styles.manualCard}
                  onPress={() => {
                    setSelectedManual(manual);
                    setIsViewerVisible(true);
                  }}
                >
                  <ThemedText style={styles.manualTitle}>{manual.title}</ThemedText>
                  <ThemedText numberOfLines={2} style={styles.manualDescription}>
                    {manual.description}
                  </ThemedText>
                  <ThemedView style={styles.manualMetaRow}>
                    <ThemedText style={styles.manualMetaText}>
                      {manual.puesto?.nombre || puestoActualNombre}
                    </ThemedText>
                    <ThemedText style={styles.manualMetaText}>
                      {manual.files?.length || 0} archivo(s)
                    </ThemedText>
                  </ThemedView>
                </TouchableOpacity>
              ))
            )}
          </ThemedView>
        </ThemedView>
      </ScrollView>

      <AppFooter />

      <SlideMenu
        isVisible={isMenuVisible}
        onClose={handleMenuClose}
        onHomePress={handleHomePress}
        currentRoute="JobManuals"
      />

      {/* QR Scanner (reutilizable) */}
      {QRScannerComponent}

      {/* Modal de visualización de manual con audio y video */}
      <Modal
        visible={isViewerVisible && !!selectedManual}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setIsViewerVisible(false);
          setSelectedManual(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <ThemedView style={styles.viewerModalContainer}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle} numberOfLines={2}>
                {selectedManual?.title || 'Manual de puesto'}
              </ThemedText>
              <TouchableOpacity
                onPress={() => {
                  setIsViewerVisible(false);
                  setSelectedManual(null);
                }}
              >
                <Ionicons name="close" size={24} color="#666666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {selectedManual?.description ? (
                <ThemedText style={styles.viewerDescription}>
                  {selectedManual.description}
                </ThemedText>
              ) : null}

              {/* Imágenes */}
              {selectedManual?.files?.some(f => f.type === 'image') && (
                <ThemedView style={styles.viewerSection}>
                  <ThemedText style={styles.viewerSectionTitle}>Imágenes</ThemedText>
                  {selectedManual.files
                    .filter(f => f.type === 'image')
                    .map(file => (
                      <Image
                        key={file.id}
                        source={{ uri: file.url }}
                        style={styles.viewerImage}
                        resizeMode="contain"
                      />
                    ))}
                </ThemedView>
              )}

              {/* Audio */}
              {selectedManual?.files?.some(f => f.type === 'audio') && (
                <ThemedView style={styles.viewerSection}>
                  <ThemedText style={styles.viewerSectionTitle}>Audios</ThemedText>
                  {selectedManual.files
                    .filter(f => f.type === 'audio')
                    .map(file => (
                      <ManualAudioPlayer
                        key={file.id}
                        sourceUrl={file.url}
                        label={file.name}
                      />
                    ))}
                </ThemedView>
              )}

              {/* Video */}
              {selectedManual?.files?.some(f => f.type === 'video') && (
                <ThemedView style={styles.viewerSection}>
                  <ThemedText style={styles.viewerSectionTitle}>Videos</ThemedText>
                  {selectedManual.files
                    .filter(f => f.type === 'video')
                    .map(file => (
                      <ManualVideoPlayer
                        key={file.id}
                        sourceUrl={file.url}
                        label={file.name}
                      />
                    ))}
                </ThemedView>
              )}

              {/* Documentos / texto descargable */}
              {selectedManual?.files?.some(f => f.type === 'document') && (
                <ThemedView style={styles.viewerSection}>
                  <ThemedText style={styles.viewerSectionTitle}>Documentos</ThemedText>
                  {selectedManual.files
                    .filter(f => f.type === 'document')
                    .map(file => (
                      <TouchableOpacity
                        key={file.id}
                        style={styles.documentRow}
                        onPress={() => Linking.openURL(file.url)}
                      >
                        <Ionicons name="document-text-outline" size={20} color="#007AFF" />
                        <ThemedText numberOfLines={1} style={styles.documentText}>
                          {file.name}
                        </ThemedText>
                      </TouchableOpacity>
                    ))}
                </ThemedView>
              )}
            </ScrollView>
          </ThemedView>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fullContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    padding: 20,
  },
  contentContainer: {
    width: '100%',
    maxWidth: 600,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    opacity: 0.7,
  },
  noMarcaTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  noMarcaMessage: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    width: '100%',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
  },
  puestoContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    width: '100%',
  },
  puestoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  puestoName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 20,
    gap: 8,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  formCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginBottom: 24,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    color: '#000000',
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: '#FFFFFF',
    color: '#000000',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  puestosList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  puestoItem: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  puestoItemSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  puestoItemText: {
    fontSize: 12,
    color: '#333',
  },
  puestoItemTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  addFileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#F8F9FA',
  },
  addFileButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  signatureButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  signatureButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  signatureButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  signatureInfo: {
    backgroundColor: '#F0F4FF',
    borderRadius: 8,
    padding: 12,
    gap: 4,
  },
  signatureInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  signatureInfoText: {
    fontSize: 12,
    color: '#333',
  },
  signatureInfoDetail: {
    marginTop: 4,
  },
  signatureInfoDetailText: {
    fontSize: 12,
    fontWeight: '600',
  },
  clearSignatureButton: {
    marginTop: 8,
    alignSelf: 'flex-end',
  },
  clearSignatureText: {
    fontSize: 12,
    color: '#FF3B30',
    fontWeight: '600',
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
  },
  formButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  cancelButton: {
    backgroundColor: '#FF3B30',
  },
  confirmButton: {
    backgroundColor: '#34C759',
  },
  formButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    opacity: 0.6,
  },
  listContainer: {
    marginTop: 8,
    marginBottom: 24,
    gap: 12,
  },
  loadingManualsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  manualCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    padding: 12,
  },
  manualTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  manualDescription: {
    fontSize: 13,
    color: '#555555',
    marginBottom: 8,
  },
  manualMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  manualMetaText: {
    fontSize: 12,
    color: '#777777',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  viewerModalContainer: {
    width: '100%',
    maxWidth: 600,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 8,
  },
  modalContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  viewerDescription: {
    fontSize: 14,
    marginTop: 8,
    marginBottom: 12,
    color: '#333333',
  },
  viewerSection: {
    marginTop: 12,
    marginBottom: 8,
  },
  viewerSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
  },
  viewerImage: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#F0F0F0',
  },
  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  documentText: {
    flex: 1,
    fontSize: 13,
    color: '#007AFF',
  },
});

// Audio player for manuals (progress bar + timer)
function ManualAudioPlayer({ sourceUrl, label }: { sourceUrl: string; label?: string }) {
  const player = useAudioPlayer(sourceUrl);
  const status = useAudioPlayerStatus(player);
  const [isPlaying, setIsPlaying] = useState(false);

  const duration = status.duration ?? 0;
  const position = status.currentTime ?? 0;
  const progress = duration > 0 ? position / duration : 0;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const togglePlayPause = () => {
    if (!player) return;
    try {
      if (!isPlaying) {
        player.play();
        setIsPlaying(true);
      } else {
        player.pause();
        setIsPlaying(false);
      }
    } catch (error) {
      console.error('Error controlling audio player:', error);
    }
  };

  useEffect(() => {
    if (!status.playing && isPlaying && position >= duration && duration > 0) {
      setIsPlaying(false);
    }
  }, [status.playing, position, duration, isPlaying]);

  return (
    <ThemedView style={{ marginBottom: 12 }}>
      {label ? (
        <ThemedText style={{ fontSize: 13, marginBottom: 4 }}>{label}</ThemedText>
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <TouchableOpacity
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: '#007AFF',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onPress={togglePlayPause}
        >
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={18}
            color="#FFFFFF"
          />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <View
            style={{
              height: 4,
              borderRadius: 2,
              backgroundColor: '#E0E0E0',
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${Math.min(progress * 100, 100)}%`,
                height: '100%',
                backgroundColor: '#007AFF',
              }}
            />
          </View>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginTop: 4,
            }}
          >
            <ThemedText style={{ fontSize: 11, color: '#555555' }}>
              {formatTime(position)}
            </ThemedText>
            <ThemedText style={{ fontSize: 11, color: '#555555' }}>
              {formatTime(duration)}
            </ThemedText>
          </View>
        </View>
      </View>
    </ThemedView>
  );
}

// Video player for manuals using expo-video (progress bar + timer)
function ManualVideoPlayer({ sourceUrl, label }: { sourceUrl: string; label?: string }) {
  const player = useVideoPlayer(sourceUrl);
  const status: any = (player as any)?.status || {};
  const [isPlaying, setIsPlaying] = useState(false);

  const duration = status.duration ?? 0;
  const position = status.currentTime ?? 0;
  const progress = duration > 0 ? position / duration : 0;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const togglePlayPause = () => {
    if (!player) return;
    try {
      if (!isPlaying) {
        player.play();
        setIsPlaying(true);
      } else {
        player.pause();
        setIsPlaying(false);
      }
    } catch (error) {
      console.error('Error controlling video player:', error);
    }
  };

  useEffect(() => {
    if (!status.playing && isPlaying && position >= duration && duration > 0) {
      setIsPlaying(false);
    }
  }, [status.playing, position, duration, isPlaying]);

  return (
    <ThemedView style={{ marginBottom: 16 }}>
      {label ? (
        <ThemedText style={{ fontSize: 13, marginBottom: 4 }}>{label}</ThemedText>
      ) : null}
      <VideoView
        player={player}
        style={{
          width: '100%',
          aspectRatio: 16 / 9,
          backgroundColor: '#000000',
          borderRadius: 8,
          marginBottom: 6,
        }}
      />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <TouchableOpacity
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: '#007AFF',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onPress={togglePlayPause}
        >
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={18}
            color="#FFFFFF"
          />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <View
            style={{
              height: 4,
              borderRadius: 2,
              backgroundColor: '#E0E0E0',
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${Math.min(progress * 100, 100)}%`,
                height: '100%',
                backgroundColor: '#007AFF',
              }}
            />
          </View>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginTop: 4,
            }}
          >
            <ThemedText style={{ fontSize: 11, color: '#555555' }}>
              {formatTime(position)}
            </ThemedText>
            <ThemedText style={{ fontSize: 11, color: '#555555' }}>
              {formatTime(duration)}
            </ThemedText>
          </View>
        </View>
      </View>
    </ThemedView>
  );
}


