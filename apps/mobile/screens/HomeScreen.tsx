import AppHeader from '../components/AppHeader';
import AppFooter from '../components/AppFooter';
import SlideMenu from '../components/SlideMenu';
import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import EmployeeProfile from '../components/EmployeeProfile';
import { useAuth } from '../contexts/AuthContext';
import { useQRScanner } from '../hooks/useQRScanner';
import React, { useCallback, useState, useEffect } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, Alert, View, Image, ScrollView, Modal, Dimensions } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import {
  getPendingSyncActions,
  removePendingAction,
  pendingActionRowId,
  PendingSyncActions,
} from '../hooks/getPendingSyncActions';
import { eventBus } from '../hooks/eventBus';
import { convertDateTimestampToLocalString } from '@/hooks/convertDateTimestampToLocalString';
import {
  readExtrapolatedServerTimeMs,
  SERVER_TIME_UPDATED_EVENT,
} from '@/hooks/updateServerTime';
import {
  readLastLocationFromStorage,
  LAST_LOCATION_UPDATED_EVENT,
} from '@/hooks/updateLastLocation';
import * as Location from 'expo-location';

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

// Static mapping of company logos - Metro bundler requires static requires
const COMPANY_LOGOS: { [key: string]: any } = {
  'gonzalez': require('../assets/images/gonzalez-logo.png'),
  'charmander': require('../assets/images/charmander-logo.png'),
};

type AppVersionInfo = {
  id?: string;
  name?: string;
  version?: string;
  created_at?: string;
  title?: string;
  description?: string;
  notas?: Array<string | { title?: string; description?: string }>;
};

type MobileVersionPayload = {
  available: boolean;
  appVersion?: string;
  data?: AppVersionInfo | null;
};

function readEmbeddedAppVersionInfo(): AppVersionInfo {
  const raw = Constants.expoConfig?.extra?.APP_VERSION_INFO;
  if (!raw || typeof raw !== 'object') return {};
  return raw as AppVersionInfo;
}

function formatVersionReleaseDate(createdAt?: string): string {
  if (!createdAt || String(createdAt).trim() === '') return '';
  try {
    return convertDateTimestampToLocalString(createdAt, false);
  } catch {
    return '';
  }
}

const appendTokenToUrl = (url: string, accessToken?: string | null): string => {
  if (!url) return '';
  if (!accessToken || accessToken.trim().length === 0) return url;
  if (/[?&]token=/.test(url)) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}token=${encodeURIComponent(accessToken)}`;
};

const compareSemver = (a: string, b: string): number => {
  const pa = String(a || '0.0.0').split('.').map((x) => parseInt(x, 10) || 0);
  const pb = String(b || '0.0.0').split('.').map((x) => parseInt(x, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const av = pa[i] ?? 0;
    const bv = pb[i] ?? 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
};

export default function HomeScreen() {
  const { isAuthenticated, isLoading, employee } = useAuth();
  const [currentCompany, setCurrentCompany] = useState<string | null>(null);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const { scanQR, QRScannerComponent } = useQRScanner();
  const [isSyncModalVisible, setIsSyncModalVisible] = useState(false);
  const [pendingActions, setPendingActions] = useState<PendingSyncActions>({});
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({});
  const [expandedActions, setExpandedActions] = useState<{ [key: string]: string | null }>({});
  const [isLoadingActions, setIsLoadingActions] = useState(false);
  const [isUpdateButtonVisible, setIsUpdateButtonVisible] = useState(false);
  const [isVersionModalVisible, setIsVersionModalVisible] = useState(false);
  const [versionModalMode, setVersionModalMode] = useState<'current' | 'update'>('current');
  const [mobileVersionInfo, setMobileVersionInfo] = useState<MobileVersionPayload['data']>(null);
  const embeddedVersionInfo = readEmbeddedAppVersionInfo();
  const [currentAppVersion, setCurrentAppVersion] = useState<string>(
    String(embeddedVersionInfo.version || '0.0.0'),
  );
  const versionReleaseDateLabel = formatVersionReleaseDate(embeddedVersionInfo.created_at);
  const [horaAccionLabel, setHoraAccionLabel] = useState('—');
  const [locationLabel, setLocationLabel] = useState('—');
  const [isLocationGpsOff, setIsLocationGpsOff] = useState(false);
  const isNewerServerVersion =
    !!mobileVersionInfo?.version &&
    compareSemver(String(mobileVersionInfo.version || '0.0.0'), currentAppVersion) === 1;
  const versionInfoForModal: AppVersionInfo =
    versionModalMode === 'update' && isNewerServerVersion && mobileVersionInfo
      ? mobileVersionInfo
      : embeddedVersionInfo;

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated && employee) {
        getCurrentUserStatus();
      }
      return () => {
        console.log('HomeScreen unfocused');
      };
    }, [isAuthenticated, employee])
  );

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigation.replace('Login');
    }
  }, [isAuthenticated, isLoading, navigation]);

  useEffect(() => {
    const handler = (payload?: MobileVersionPayload) => {
      const available = !!payload?.available && !!payload?.data;
      setIsUpdateButtonVisible(available);
      setMobileVersionInfo(payload?.data ?? null);
      if (payload?.appVersion) setCurrentAppVersion(String(payload.appVersion));
      if (!available) setIsVersionModalVisible(false);
    };
    eventBus.on('mobileVersionAvailabilityChanged', handler);
    return () => {
      eventBus.off('mobileVersionAvailabilityChanged', handler);
    };
  }, []);

  const refreshHoraAccionLabel = useCallback(async () => {
    const horaMs = await readExtrapolatedServerTimeMs();
    if (!Number.isFinite(horaMs)) {
      setHoraAccionLabel('—');
      return;
    }
    const formatted = convertDateTimestampToLocalString(new Date(horaMs).toISOString());
    setHoraAccionLabel(formatted.replace(/:\d{2}$/, ''));
  }, []);

  const refreshLocationLabel = useCallback(async () => {
    const gpsOn = await Location.hasServicesEnabledAsync();
    if (!gpsOn) {
      setIsLocationGpsOff(true);
      setLocationLabel('Activa la ubicación del dispositivo para registrar tu posición.');
      return;
    }

    setIsLocationGpsOff(false);
    const stored = await readLastLocationFromStorage();
    if (stored) {
      setLocationLabel(
        `Lat: ${stored.latitude.toFixed(6)}, Lng: ${stored.longitude.toFixed(6)}`
      );
      return;
    }

    setLocationLabel('Esperando señal GPS...');
  }, []);

  const refreshDeviceStatusLabels = useCallback(async () => {
    await Promise.all([refreshHoraAccionLabel(), refreshLocationLabel()]);
  }, [refreshHoraAccionLabel, refreshLocationLabel]);

  useEffect(() => {
    void refreshDeviceStatusLabels();
    eventBus.on(SERVER_TIME_UPDATED_EVENT, refreshHoraAccionLabel);
    eventBus.on(LAST_LOCATION_UPDATED_EVENT, refreshLocationLabel);
    return () => {
      eventBus.off(SERVER_TIME_UPDATED_EVENT, refreshHoraAccionLabel);
      eventBus.off(LAST_LOCATION_UPDATED_EVENT, refreshLocationLabel);
    };
  }, [refreshDeviceStatusLabels, refreshHoraAccionLabel, refreshLocationLabel]);

  useFocusEffect(
    useCallback(() => {
      void refreshDeviceStatusLabels();
      const horaTickId = setInterval(() => {
        void refreshHoraAccionLabel();
      }, 30000);
      return () => clearInterval(horaTickId);
    }, [refreshDeviceStatusLabels, refreshHoraAccionLabel])
  );

  const getCurrentUserStatus = async () => {
    const current_marca = await AsyncStorage.getItem('current_marca');
    if (!current_marca) {
      setCurrentCompany(null);
      return;
    }
    const current_marca_data = JSON.parse(current_marca);

    switch (current_marca_data.empresa.id) {
      case 9:
        setCurrentCompany('gonzalez');
        break;
      case 10:
        setCurrentCompany('charmander');
        break;
    }
  };

  // Show loading spinner while checking authentication
  if (isLoading || !isAuthenticated) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <ThemedText style={styles.loadingText}>Verificando autenticación...</ThemedText>
      </ThemedView>
    );
  }

  // Handle menu press from header
  const handleMenuPress = () => {
    setIsMenuVisible(true);
  };

  // Handle profile navigation from slide menu
  const handleProfilePress = () => {
    navigation.navigate('EmployeeProfile');
  };

  // Handle home navigation from slide menu
  const handleHomePress = () => {
    // Already on home screen, just close menu
    setIsMenuVisible(false);
  };

  // Handle closing slide menu
  const handleMenuClose = () => {
    setIsMenuVisible(false);
  };

  const handleRolesPress = () => {
    navigation.navigate('Roles');
  };

  const handleRulesPress = () => {
    navigation.navigate('Rules');
  };

  const handleDigitalSignaturePress = () => {
    navigation.navigate('DigitalSignature');
  };

  const handleLunchTimePress = () => {
    navigation.navigate('LunchTime');
  };

  const handleMarcarIngresoSalidaPress = () => {
    navigation.navigate('MarcarIngresoSalida');
  };

  const handleNotesPress = () => {
    navigation.navigate('Notes');
  };

  const handleActivitiesPress = () => {
    navigation.navigate('Activities');
  };

  const handleVehiclesPress = () => {
    navigation.navigate('Vehicles');
  };

  const handleVisitorsPress = () => {
    navigation.navigate('Visitors');
  };

  const handleEvaluationsPress = () => {
    navigation.navigate('Evaluations');
  };

  const handleIncidentsPress = () => {
    navigation.navigate('Incidents');
  };

  const handleSurveysPress = () => {
    navigation.navigate('SatisfactionSurveys');
  };

  const handleTrainingsPress = () => {
    navigation.navigate('Trainings');
  };

  const handleVoiceNotesPress = () => {
    navigation.navigate('VoiceNotes');
  };

  const handleJerarquiaPress = () => {
    navigation.navigate('Jerarquia');
  };

  const getActionIcon = (action: string, isActive: boolean) => {
    switch (action.toLowerCase()) {
      case 'profile': return <Ionicons name="person" size={30} color='#000000' />;
      case 'lunch-time': return <Ionicons name="hourglass" size={30} color='#000000' />;
      case 'digital-signature': return <Ionicons name="finger-print" size={30} color='#000000' />;
      case 'marcar-ingreso-salida': return <Ionicons name="time" size={30} color='#fff' />;
      case 'notes': return <Ionicons name="document" size={30} color='#000000' />;
      case 'activities': return <Ionicons name="list" size={30} color='#000000' />;
      case 'vehicles': return <Ionicons name="car" size={30} color='#000000' />;
      case 'visitors': return <Ionicons name="people" size={30} color='#000000' />;
      case 'evaluations': return <Ionicons name="clipboard" size={30} color='#000000' />;
      case 'incidents': return <Ionicons name="warning" size={30} color='#000000' />;
      case 'surveys': return <Ionicons name="document-text" size={30} color='#000000' />;
      case 'trainings': return <Ionicons name="school" size={30} color='#000000' />;
      case 'voice-notes': return <Ionicons name="mic" size={30} color='#000000' />;
      case 'logout': return <Ionicons name="log-out" size={30} color='#000000' />;
      case 'scan-qr': return <Ionicons name="scan" size={30} color='#fff' />;
    }
  };

  const handleScanQRPress = async () => {
    try {
      const qrData = await scanQR();
      if (qrData) {
        let data = atob(qrData);
        // Convertir a json separando por el caracter ":"
        let dataSplit = data.split(':');
        let dataJson = {
          session: dataSplit[0],
          user: dataSplit[1],
          latitude: dataSplit[2],
          longitude: dataSplit[3],
          timestamp: dataSplit[4],
        };
        Alert.alert(
          'QR Escaneado',
          `Datos del QR:\n\nSession: ${dataJson.session}\nUser: ${dataJson.user}\nLatitude: ${dataJson.latitude}\nLongitude: ${dataJson.longitude}\nHora: ${new Date(parseInt(dataJson.timestamp)).toISOString()}`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Cancelado', 'Escaneo de QR cancelado');
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo escanear el código QR');
      console.error('Error scanning QR:', error);
    }
  };

  const handleOpenSyncModal = async () => {
    setIsSyncModalVisible(true);
    await loadPendingActions();
  };

  const handleCloseSyncModal = () => {
    setIsSyncModalVisible(false);
    setPendingActions({});
    setExpandedSections({});
    setExpandedActions({});
  };

  const loadPendingActions = async () => {
    setIsLoadingActions(true);
    try {
      const actions = await getPendingSyncActions();
      setPendingActions(actions);
    } catch (error) {
      console.error('Error loading pending actions:', error);
      Alert.alert('Error', 'No se pudieron cargar las acciones pendientes');
    } finally {
      setIsLoadingActions(false);
    }
  };

  const handleDeleteAction = async (storageKey: string, actionId: string) => {
    Alert.alert(
      'Eliminar acción',
      '¿Estás seguro de que deseas eliminar esta acción pendiente?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const success = await removePendingAction(storageKey, actionId);
            if (success) {
              await loadPendingActions();
              Alert.alert('Éxito', 'Acción eliminada correctamente');
            } else {
              Alert.alert('Error', 'No se pudo eliminar la acción');
            }
          },
        },
      ]
    );
  };

  const handleDownloadMobileApk = async () => {
    try {
      const id = String(mobileVersionInfo?.id || '').trim();
      if (!id) {
        Alert.alert('Error', 'No se encontró el identificador de la versión.');
        return;
      }
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) {
        Alert.alert('Error', 'No se encontró la URL del servidor.');
        return;
      }
      const token = (await AsyncStorage.getItem('access_token'))?.trim() || '';
      const downloadUrl = appendTokenToUrl(`${apiUrl}/api/mobile-versions/${encodeURIComponent(id)}`, token);
      await Linking.openURL(downloadUrl);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'No se pudo iniciar la descarga del APK');
    }
  };

  const toggleSection = (storageKey: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [storageKey]: !prev[storageKey],
    }));
  };

  const toggleAction = (storageKey: string, actionId: string) => {
    setExpandedActions((prev) => ({
      ...prev,
      [storageKey]: prev[storageKey] === actionId ? null : actionId,
    }));
  };

  const getStorageKeyLabel = (key: string): string => {
    const labels: { [key: string]: string } = {
      'job_manuals_actions': 'Manuales de Trabajo',
      'visitors_actions': 'Visitantes',
      'vehicles_actions': 'Vehículos',
      'bitacora_vehiculo_detenido_actions': 'Bitácora Vehículo Detenido',
      'llaves_actions': 'Llaves',
      'movimientos_llaves_actions': 'Movimientos de Llaves',
      'llaveros_actions': 'Llaveros',
      'movimientos_llaveros_actions': 'Movimientos de Llaveros',
      'movimientos_activos_mantenimiento_actions': 'Movimientos Activos Mantenimiento',
      'articulo_mantenimiento_actions': 'Artículo Mantenimiento',
      'articulo_mantenimiento_delete_archivo_actions': 'Eliminar adjuntos mantenimiento',
      'movimientos_articulos_mantenimiento_actions': 'Movimientos Artículos Mantenimiento',
      'activo_mantenimiento_actions': 'Activo Mantenimiento',
      'documentos_entregados_actions': 'Documentos Entregados',
      'apreciacion_vulnerabilidad_actions': 'Apreciación Vulnerabilidad',
      'notifications_actions': 'Notificaciones',
      'lunchtime_actions': 'Tiempo de Almuerzo',
      'notes_actions': 'Notas',
      'activities_actions': 'Actividades',
      'evaluations_actions': 'Evaluaciones',
      'checklist_supervision_actions': 'Checklist de supervisión',
      'attendance_actions': 'Asistencia (ingreso/salida/ausencia)',
    };
    return labels[key] || key.replace('_actions', '').replace(/_/g, ' ');
  };

  const formatActionData = (action: any): string => {
    try {
      const keys = Object.keys(action).filter((k) => k !== 'id' && k !== 'type' && k !== 'action');
      if (keys.length === 0) return JSON.stringify(action, null, 2);
      return keys.map((k) => `${k}: ${JSON.stringify(action[k])}`).join('\n');
    } catch {
      return JSON.stringify(action, null, 2);
    }
  };

  const monthNames = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
  ];

  const formatDate = (dateString: string) => {
    try {
      // Convierte el string a número
      const timestamp = Number(dateString);

      // Si no es un número válido, lanza error
      if (isNaN(timestamp)) throw new Error("Invalid timestamp");

      // Crea el objeto Date
      const date = new Date(timestamp);

      // Obtiene hora y minutos en horario local
      let hours = date.getHours();
      const minutes = date.getMinutes();

      // AM / PM
      const ampm = hours >= 12 ? "pm" : "am";
      hours = hours % 12 || 12;

      // Formato final
      const formatted = `${hours}:${minutes.toString().padStart(2, "0")} ${ampm}`;

      return `${date.getDate()} de ${monthNames[date.getMonth()]} de ${date.getFullYear()}, ${formatted}`;
    } catch (error) {
      return dateString;
    }
  };

  // Show authenticated home screen
  return (
    <ThemedView style={styles.fullContainer}>
      <AppHeader onMenuPress={handleMenuPress} title="Inicio" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <ThemedView style={styles.container}>
          {/* Welcome message at the top */}
          <ThemedView style={styles.welcomeContainer}>
            <ThemedText type="title" style={styles.welcomeText}>
              Bienvenido a MonitoreApp
            </ThemedText>
            {employee && (
              <ThemedText style={styles.userText}>
                ¡Hola, {employee.name}!
              </ThemedText>
            )}
          </ThemedView>

          {/* Logo */}
          {currentCompany && COMPANY_LOGOS[currentCompany] && (
            <ThemedView style={styles.logoContainer}>
              <Image
                source={COMPANY_LOGOS[currentCompany]}
                style={styles.logo}
                resizeMode="contain"
              />
            </ThemedView>
          )}

          {/* Quick access buttons */}
          <ThemedView style={styles.quickAccessContainer}>

            <View style={styles.buttonsRow}>
              <TouchableOpacity
                style={styles.quickAccessButton}
                onPress={handleMarcarIngresoSalidaPress}
              >
                {getActionIcon('marcar-ingreso-salida', true)}
                <ThemedText style={styles.buttonText}>Marca</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickAccessButton, styles.scanButton]}
                onPress={handleScanQRPress}
              >
                {getActionIcon('scan-qr', true)}
                <ThemedText style={styles.buttonText}>Escanear Firma</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickAccessButton, { backgroundColor: '#FF9500' }]}
                onPress={handleJerarquiaPress}
              >
                <Ionicons name="git-network-outline" size={30} color="#fff" />
                <ThemedText style={styles.buttonText}>Jerarquía</ThemedText>
              </TouchableOpacity>
            </View>

            <View style={styles.buttonsRow}>
              <TouchableOpacity
                style={[styles.quickAccessButton, styles.syncPendingButton]}
                onPress={handleOpenSyncModal}
              >
                <Ionicons name="cloud-upload-outline" size={30} color="#fff" />
                <ThemedText style={styles.buttonText}>Sincronizaciones</ThemedText>
              </TouchableOpacity>
            </View>

            <ThemedView style={styles.deviceStatusBox}>
              <ThemedText style={styles.deviceStatusLabel}>
                {horaAccionLabel}
              </ThemedText>
              <ThemedText
                style={[
                  styles.deviceStatusLabel,
                  isLocationGpsOff && styles.deviceStatusLocationWarning,
                ]}
              >
                {locationLabel}
              </ThemedText>
            </ThemedView>
          </ThemedView>
        </ThemedView>
      </ScrollView>

      {/* Modal: Acciones pendientes de sincronización */}
      <Modal
        visible={isSyncModalVisible}
        animationType="fade"
        transparent
        presentationStyle="overFullScreen"
        onRequestClose={handleCloseSyncModal}
      >
        <View style={styles.overlay}>
          <ThemedView style={styles.floatModalCardMovimientos}>
            <ThemedView style={styles.floatModalHeader}>
              <ThemedText style={styles.modalTitle}>Sincronizaciones pendientes</ThemedText>
              <TouchableOpacity onPress={handleCloseSyncModal}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </ThemedView>

            <ScrollView style={{ maxHeight: Dimensions.get('window').height * 0.75 }} contentContainerStyle={{ padding: 16 }}>
              {isLoadingActions ? (
                <ThemedView style={styles.emptyContainer}>
                  <ActivityIndicator size="large" color="#007AFF" />
                  <ThemedText style={styles.emptyText}>Cargando sincronizaciones...</ThemedText>
                </ThemedView>
              ) : Object.keys(pendingActions).length === 0 ? (
                <ThemedView style={styles.emptyContainer}>
                  <ThemedText style={styles.emptyText}>No hay sincronizaciones pendientes</ThemedText>
                </ThemedView>
              ) : (
                Object.entries(pendingActions).map(([storageKey, actions]) => {
                  const isSectionExpanded = expandedSections[storageKey] || false;
                  const totalActions = actions.length;

                  return (
                    <ThemedView key={storageKey} style={styles.sectionContainer}>
                      <TouchableOpacity
                        style={styles.sectionHeader}
                        onPress={() => toggleSection(storageKey)}
                        activeOpacity={0.8}
                      >
                        <ThemedText style={styles.sectionTitleModal}>
                          {getStorageKeyLabel(storageKey)} ({totalActions})
                        </ThemedText>
                        <Ionicons
                          name={isSectionExpanded ? "chevron-up" : "chevron-down"}
                          size={18}
                          color="#007AFF"
                        />
                      </TouchableOpacity>

                      {isSectionExpanded && (
                        <ThemedView style={styles.actionsContainer}>
                          {actions.map((action, index) => {
                            const rowId = pendingActionRowId(storageKey, action, index);
                            const actionKey = `${storageKey}-${rowId}`;
                            const isActionExpanded = expandedActions[storageKey] === rowId;
                            const titleId =
                              storageKey === 'checklist_supervision_actions'
                                ? action.type === 'create'
                                  ? `local ${String(action.id_local || '').slice(0, 24)}`
                                  : `id ${action.id ?? action.id_local ?? 'N/A'}`
                                : action.id?.substring?.(0, 20) || action.id || 'N/A';

                            return (
                              <ThemedView key={actionKey} style={styles.actionItem}>
                                <TouchableOpacity
                                  style={styles.actionHeader}
                                  onPress={() => toggleAction(storageKey, rowId)}
                                  activeOpacity={0.8}
                                >
                                  <ThemedText style={styles.actionTitle}>
                                    {action.type || action.action || 'Acción'} — {titleId}
                                  </ThemedText>
                                  <Ionicons
                                    name={isActionExpanded ? "chevron-up" : "chevron-down"}
                                    size={16}
                                    color="#666"
                                  />
                                </TouchableOpacity>

                                {isActionExpanded && (
                                  <ThemedView style={styles.actionContent}>
                                    <ThemedText style={styles.actionData}>
                                      {formatActionData(action)}
                                    </ThemedText>
                                    <TouchableOpacity
                                      style={styles.deleteButton}
                                      onPress={() => handleDeleteAction(storageKey, rowId)}
                                    >
                                      <Ionicons name="trash" size={18} color="#FF3B30" />
                                      <ThemedText style={styles.deleteButtonText}>Eliminar</ThemedText>
                                    </TouchableOpacity>
                                  </ThemedView>
                                )}
                              </ThemedView>
                            );
                          })}
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

      {/* Versión actual de la app (toca para ver detalles) */}
      <View style={styles.versionFooterContainer}>
        <TouchableOpacity
          onPress={() => {
            setVersionModalMode('current');
            setIsVersionModalVisible(true);
          }}
          activeOpacity={0.85}
        >
          <ThemedText style={styles.appVersionText}>
            Versión:{' '}
            <ThemedText style={styles.appVersionStrong}>
              {currentAppVersion}
              {versionReleaseDateLabel ? ` (03-Julio-2026)` : ''}
            </ThemedText>
          </ThemedText>
        </TouchableOpacity>

        {isUpdateButtonVisible && (
          <TouchableOpacity
            style={[styles.updateBarButton, { marginTop: 8, backgroundColor: '#FF3B30' }]}
            onPress={() => {
              setVersionModalMode('update');
              setIsVersionModalVisible(true);
            }}
            activeOpacity={0.9}
          >
            <Ionicons name="download-outline" size={20} color="#fff" />
            <ThemedText style={styles.updateBarButtonText}>Actualización disponible</ThemedText>
          </TouchableOpacity>
        )}
      </View>

      {/* Modal: información de versión */}
      <Modal
        visible={isVersionModalVisible}
        animationType="fade"
        transparent
        presentationStyle="overFullScreen"
        onRequestClose={() => setIsVersionModalVisible(false)}
      >
        <View style={styles.overlay}>
          <ThemedView style={styles.floatModalCardMovimientos}>
            <ThemedView style={styles.floatModalHeader}>
              <ThemedText style={styles.modalTitle}>
                {versionModalMode === 'update' && isNewerServerVersion
                  ? 'Nueva versión disponible'
                  : 'Versión actual de la aplicación'}
              </ThemedText>
              <TouchableOpacity onPress={() => setIsVersionModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </ThemedView>
            <ScrollView style={{ maxHeight: Dimensions.get('window').height * 0.75 }} contentContainerStyle={{ padding: 16 }}>
              <ThemedText style={styles.cardLine}>
                <ThemedText style={styles.cardLabel}>
                  {versionModalMode === 'update' && isNewerServerVersion ? 'App actual: ' : 'Versión instalada: '}
                </ThemedText>
                {currentAppVersion}
              </ThemedText>
              {versionModalMode === 'update' && isNewerServerVersion && (
                <ThemedText style={styles.cardLine}>
                  <ThemedText style={styles.cardLabel}>Versión disponible: </ThemedText>
                  {mobileVersionInfo?.version || '-'}
                </ThemedText>
              )}
              <ThemedText style={styles.cardLine}>
                <ThemedText style={styles.cardLabel}>Nombre: </ThemedText>{versionInfoForModal.name || '-'}
              </ThemedText>
              <ThemedText style={styles.cardLine}>
                <ThemedText style={styles.cardLabel}>Título: </ThemedText>{versionInfoForModal.title || '-'}
              </ThemedText>
              <ThemedText style={styles.cardLine}>
                <ThemedText style={styles.cardLabel}>Descripción: </ThemedText>{versionInfoForModal.description || '-'}
              </ThemedText>
              {!!versionInfoForModal.created_at && (
                <ThemedText style={styles.cardLine}>
                  <ThemedText style={styles.cardLabel}>Fecha: </ThemedText>
                  {formatVersionReleaseDate(versionInfoForModal.created_at)}
                </ThemedText>
              )}
              {Array.isArray(versionInfoForModal.notas) && versionInfoForModal.notas.length > 0 && (
                <ThemedView style={{ marginTop: 8 }}>
                  <ThemedText style={[styles.cardLabel, { marginBottom: 6 }]}>Notas</ThemedText>
                  {versionInfoForModal.notas.map((n, idx) => (
                    <ThemedText key={`note-${idx}`} style={styles.cardLine}>
                      - {typeof n === 'string' ? n : `${n?.title ? `${n.title}: ` : ''}${n?.description || ''}`}
                    </ThemedText>
                  ))}
                </ThemedView>
              )}
              {versionModalMode === 'update' && isNewerServerVersion && (
                <TouchableOpacity
                  style={[styles.updateBarButton, { marginTop: 14 }]}
                  onPress={handleDownloadMobileApk}
                  activeOpacity={0.9}
                >
                  <Ionicons name="download-outline" size={20} color="#fff" />
                  <ThemedText style={styles.updateBarButtonText}>Descargar APK</ThemedText>
                </TouchableOpacity>
              )}
            </ScrollView>
          </ThemedView>
        </View>
      </Modal>
      <SlideMenu
        isVisible={isMenuVisible}
        onClose={handleMenuClose}
        onHomePress={handleHomePress}
      />
      {QRScannerComponent}
      <AppFooter />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fullContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    padding: 20,
  },
  welcomeContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  welcomeText: {
    textAlign: 'center',
    marginBottom: 8,
    fontSize: 24,
    fontWeight: 'bold',
  },
  userText: {
    textAlign: 'center',
    fontSize: 18,
    opacity: 0.8,
    marginTop: 8,
  },
  appVersionText: {
    fontSize: 12,
    color: '#007AFF',
    textAlign: 'center',
  },
  appVersionStrong: {
    fontWeight: '700',
    color: '#007AFF',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
  logo: {
    width: 200,
    height: 150,
  },
  quickAccessContainer: {
    paddingHorizontal: 10,
  },
  sectionTitle: {
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 20,
    fontWeight: 'bold',
  },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  quickAccessButton: {
    backgroundColor: '#007AFF',
    paddingBottom: 10,
    paddingTop: 15,
    paddingHorizontal: 15,
    borderRadius: 10,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '600',
  },
  scanButton: {
    backgroundColor: '#34C759', // Verde para distinguir el botón de escaneo
  },
  syncPendingButton: {
    backgroundColor: '#5856D6',
    flex: 1,
  },
  deviceStatusBox: {
    marginTop: 5,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F8F9FA',
    gap: 8,
  },
  deviceStatusLabel: {
    fontSize: 13,
    color: '#333',
    lineHeight: 18,
    textAlign: 'center',
  },
  deviceStatusLocationWarning: {
    color: '#DC2626',
    fontWeight: '600',
  },
  deviceStatusTitle: {
    fontWeight: '600',
    color: '#007AFF',
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 16,
    opacity: 0.7,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  floatModalCardMovimientos: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  floatModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
  },
  sectionContainer: {
    width: '100%',
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8F9FA',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  sectionTitleModal: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    flex: 1,
  },
  actionsContainer: {
    padding: 8,
  },
  actionItem: {
    marginBottom: 8,
    backgroundColor: '#F8F9FA',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  actionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  actionTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  actionContent: {
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  actionData: {
    fontSize: 11,
    color: '#666',
    fontFamily: 'monospace',
    marginBottom: 12,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FFEBEE',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF3B30',
    marginLeft: 6,
  },
  cardLine: {
    marginBottom: 8,
    color: '#222',
    fontSize: 14,
  },
  cardLabel: {
    fontWeight: '700',
    color: '#000',
  },
  updateBarButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    marginBottom: 8,
  },
  updateBarButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  versionFooterContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
  },
});

