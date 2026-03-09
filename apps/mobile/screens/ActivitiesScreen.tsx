import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Modal, TextInput, Image, View, Platform, Dimensions } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useAuth } from '@/contexts/AuthContext';
import AppHeader from '@/components/AppHeader';
import AppFooter from '@/components/AppFooter';
import SlideMenu from '@/components/SlideMenu';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import * as Network from 'expo-network';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Picker } from '@react-native-picker/picker';
import * as Location from 'expo-location';
import { jwtDecode } from 'jwt-decode';
import { Buffer } from 'buffer';
import getHoraAccion from '@/hooks/getHoraAccion';
import { eventBus } from '@/hooks/eventBus';
import { useQRScanner } from '@/hooks/useQRScanner';
import { createActivity, deleteCreatedActivity, listCreatedActivitiesByPuesto, updateCreatedActivity } from '@/hooks/activitiesFunctions';
import authedFetch from '@/hooks/authedFetch';
import getValidAccessTokenOrLogout from '@/hooks/getValidAccessTokenOrLogout';

type ActivitiesScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Activities'>;

type EstadoArticulo = 'Bueno' | 'Malo' | 'No está';

type ArticleFormState = { estado: EstadoArticulo; cantidadReal: number; observaciones: string };

// Inventory Item Component
interface InventoryItemProps {
  activity: Actividad;
  inventory: Inventario;
  employee: any;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
  fetchActivities: () => Promise<any>;
  getActionIcon: (action: string) => React.ReactElement;
  getConnectionStatus: () => Promise<boolean>;
  onOpenCamera: (inventoryId: number) => void;
  inventoryImages: { [key: number]: string };
  onClearInventoryImage: (inventoryId: number) => void;
  getArticleFormState: (activityId: number, inventory: Inventario) => ArticleFormState;
  setArticleFormState: (activityId: number, inventory: Inventario, partial: Partial<ArticleFormState>) => void;
}

// Activity Item Component
interface ActivityItemProps {
  activity: Actividad;
  employee: any;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
  fetchActivities: () => Promise<any>;
  getActionIcon: (action: string) => React.ReactElement;
  getConnectionStatus: () => Promise<boolean>;
  openCameraForInventory: (inventoryId: number) => void;
  inventoryImages: { [key: number]: string };
  toggleActivity: (activity: Actividad) => void;
  onClearInventoryImage: (inventoryId: number) => void;
  onGoToEntregaPuestos: () => void;
  getArticleFormState: (activityId: number, inventory: Inventario) => ArticleFormState;
  setArticleFormState: (activityId: number, inventory: Inventario, partial: Partial<ArticleFormState>) => void;
}

const ActivityItemComponent: React.FC<ActivityItemProps> = ({
  activity,
  employee,
  refreshAccessToken,
  logout,
  fetchActivities,
  getActionIcon,
  getConnectionStatus,
  openCameraForInventory,
  inventoryImages,
  toggleActivity,
  onClearInventoryImage,
  onGoToEntregaPuestos,
  getArticleFormState,
  setArticleFormState,
}) => {
  const [cachedActivityImage, setCachedActivityImage] = React.useState<string | null>(null);
  const [serverActivityImageBase64, setServerActivityImageBase64] = React.useState<string | null>(null);
  const [activityImageRefreshKey, setActivityImageRefreshKey] = React.useState<number>(0);
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;

  // Function to get cached image for activity
  const getCachedActivityImage = async (activityId: number) => {
    try {
      const actionsStr = await AsyncStorage.getItem('activities_actions');
      if (actionsStr) {
        const actions = JSON.parse(actionsStr);
        const action = actions.find((a: any) =>
          a.type === 'update' &&
          a.activity_id === activityId
        );
        return action?.requestData?.file || null;
      }
    } catch (error) {
      console.error('Error getting cached activity image:', error);
    }
    return null;
  };

  const loadActivityImageFromServer = React.useCallback(async () => {
    if (!apiUrl || !activity.id) return;

    try {
      const token = (await AsyncStorage.getItem('access_token')) || '';
      const baseImageUrl = `${apiUrl}/api/activities/${activity.id}/get-image?t=${Date.now()}`;
      const imageUrl = token
        ? `${baseImageUrl}&token=${encodeURIComponent(token)}`
        : baseImageUrl;
      const response = await authedFetch({
        url: imageUrl,
        init: { method: 'GET' },
        refreshAccessToken,
        logout,
      });
      if (!response) return;

      if (response.ok) {
        const blob = await response.blob();

        // Convert blob to base64
        const base64Image = await new Promise<string | null>((resolve) => {
          const reader = new FileReader();

          reader.onerror = () => {
            console.error('Error al leer la imagen con FileReader');
            resolve(null);
          };

          reader.onloadend = () => {
            try {
              const base64data = reader.result as string;
              if (!base64data) {
                console.warn('No se pudo convertir la imagen a base64');
                resolve(null);
              } else {
                resolve(base64data);
              }
            } catch (error) {
              console.error('Error al procesar base64:', error);
              resolve(null);
            }
          };

          reader.readAsDataURL(blob);
        });

        if (base64Image) {
          setServerActivityImageBase64(base64Image);
        }
      }
    } catch (error) {
      console.error('Error fetching activity image:', error);
    }
  }, [apiUrl, activity.id]);

  React.useEffect(() => {
    const shouldLoadActivityImage =
      (!activity.is_revision_equipo && activity.imagen_adjunta) ||
      (activity.is_revision_equipo && activity.is_marcada && activity.imagen_adjunta);

    if (!shouldLoadActivityImage) {
      setCachedActivityImage(null);
      setServerActivityImageBase64(null);
      return;
    }

    const loadImages = async () => {
      const connectionStatus = await getConnectionStatus();

      // Always load cached image
      const cached = await getCachedActivityImage(activity.id);
      setCachedActivityImage(cached);

      // If online, also load from server
      if (connectionStatus) {
        await loadActivityImageFromServer();
      } else {
        setServerActivityImageBase64(null);
      }
    };

    loadImages();
  }, [activity.id, activity.is_revision_equipo, activity.is_marcada, activity.imagen_adjunta, loadActivityImageFromServer, getConnectionStatus]);

  return (
    <ThemedView style={styles.activityCard}>
      <ThemedView style={styles.activityHeader}>
        <ThemedView style={styles.activityInfo}>
          <ThemedText style={styles.activityName}>{activity.nombre_actividad}</ThemedText>
          <ThemedText style={activity.is_pendiente ? styles.activityFrecuenciaPending : styles.activityFrecuencia}>{activity.is_pendiente ? 'Pendiente' : activity.frecuencia}</ThemedText>
        </ThemedView>

        <ThemedView style={styles.checkboxContainer}>
          <TouchableOpacity
            style={[
              styles.checkbox,
              activity.is_marcada ? styles.checkboxChecked : styles.checkboxUnchecked
            ]}
            onPress={() => toggleActivity(activity)}
          >
            {activity.is_marcada && (
              <Ionicons name="checkmark" size={16} color="#fff" />
            )}
          </TouchableOpacity>
        </ThemedView>
      </ThemedView>

      <ThemedView style={styles.activityBody}>
        <ThemedText style={styles.activityDescription}>
          {activity.descripcion_actividad}
        </ThemedText>

        {activity.is_revision_equipo && activity.inventario && activity.inventario.length > 0 && (
          <ThemedView style={styles.inventoryContainer}>
            <ThemedText style={styles.inventoryTitle}>Artículos</ThemedText>
            <TouchableOpacity style={styles.goEntregaButton} onPress={onGoToEntregaPuestos} activeOpacity={0.85}>
              <Ionicons name="open-outline" size={16} color="#007AFF" />
              <ThemedText style={styles.goEntregaButtonText}>Revisa el equipo en la entrega de puestos</ThemedText>
            </TouchableOpacity>
            <View style={styles.tableWrapper}>
              <View style={styles.tableFixedColumn}>
                <View style={styles.tableHeaderFixed}>
                  <View style={styles.tableHeaderCellFirst}>
                    <ThemedText style={styles.tableHeaderText}>Artículo</ThemedText>
                  </View>
                </View>
                {activity.inventario.map((articulo) => (
                  <View key={articulo.id} style={styles.tableRowFixed}>
                    <View style={styles.tableCellFirst}>
                      <ThemedText style={styles.tableCellFirstText}>{articulo.nombre}</ThemedText>
                    </View>
                  </View>
                ))}
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={true}
                contentContainerStyle={styles.articulosScrollContent}
                style={styles.articulosScrollView}
              >
                <View style={styles.tableScrollableContainer}>
                  <View style={styles.tableHeader}>
                    <View style={styles.tableHeaderCell}>
                      <ThemedText style={styles.tableHeaderText}>Estado</ThemedText>
                    </View>
                    <View style={styles.tableHeaderCell}>
                      <ThemedText style={styles.tableHeaderText}>Cant. Requerida</ThemedText>
                    </View>
                    <View style={styles.tableHeaderCell}>
                      <ThemedText style={styles.tableHeaderText}>Cant. Real</ThemedText>
                    </View>
                    <View style={styles.tableHeaderCell}>
                      <ThemedText style={styles.tableHeaderText}>Observaciones</ThemedText>
                    </View>
                  </View>
                  {activity.inventario.map((inventory) => (
                    <InventoryItemComponent
                      key={inventory.id}
                      activity={activity}
                      inventory={inventory}
                      employee={employee}
                      refreshAccessToken={refreshAccessToken}
                      logout={logout}
                      fetchActivities={fetchActivities}
                      getActionIcon={getActionIcon}
                      getConnectionStatus={getConnectionStatus}
                      onOpenCamera={openCameraForInventory}
                      inventoryImages={inventoryImages}
                      onClearInventoryImage={onClearInventoryImage}
                      getArticleFormState={getArticleFormState}
                      setArticleFormState={setArticleFormState}
                    />
                  ))}
                </View>
              </ScrollView>
            </View>
          </ThemedView>
        )}

        {/* Show existing image for normal activities and for marked inventory review activities */}
        {activity.imagen_adjunta && (!activity.is_revision_equipo || activity.is_marcada) && (
          <ThemedView style={styles.imagePreviewContainer}>
            <ThemedText style={styles.imagePreviewTitle}>Imagen adjunta:</ThemedText>
            {(() => {
              const imageToShow = serverActivityImageBase64 || cachedActivityImage;
              if (!imageToShow) return null;

              const imageUri = imageToShow.startsWith('data:')
                ? imageToShow
                : `data:image/jpeg;base64,${imageToShow}`;

              return (
                <Image
                  source={{ uri: imageUri }}
                  style={styles.imagePreview}
                  resizeMode="contain"
                />
              );
            })()}
          </ThemedView>
        )}
      </ThemedView>
    </ThemedView>
  );
};

const getDefaultArticleFormState = (inventory: Inventario): ArticleFormState => ({
  estado: (inventory.estado as EstadoArticulo) || (inventory.revision_equipo?.marcada
    ? (inventory.revision_equipo.es_correcto ? 'Bueno' : 'Malo')
    : 'Bueno'),
  cantidadReal: typeof inventory.cantidad_real === 'number' ? inventory.cantidad_real : (inventory.cantidad_requerida ?? 0),
  observaciones: inventory.observaciones ?? inventory.revision_equipo?.motivo_incorrecto ?? '',
});

const InventoryItemComponent: React.FC<InventoryItemProps> = ({
  activity,
  inventory,
  employee,
  refreshAccessToken,
  logout,
  fetchActivities,
  getActionIcon,
  getConnectionStatus,
  onOpenCamera,
  inventoryImages,
  onClearInventoryImage,
  getArticleFormState,
  setArticleFormState,
}) => {
  const formState = getArticleFormState(activity.id, inventory);

  const estado = formState.estado;
  const cantidadReal = formState.cantidadReal;
  const observaciones = formState.observaciones;

  const handleEstadoChange = (value: EstadoArticulo) => {
    setArticleFormState(activity.id, inventory, {
      estado: value,
      cantidadReal: value === 'No está' ? 0 : formState.cantidadReal,
    });
  };

  const handleCantidadRealChange = (num: number) => {
    setArticleFormState(activity.id, inventory, {
      cantidadReal: num,
      estado: num === 0 ? 'No está' : formState.estado,
    });
  };

  const handleObservacionesChange = (text: string) => {
    setArticleFormState(activity.id, inventory, { observaciones: text });
  };

  // Function to get cached image from offline actions
  const getCachedImage = async () => {
    try {
      const actionsStr = await AsyncStorage.getItem('activities_actions');
      if (actionsStr) {
        const actions = JSON.parse(actionsStr);
        const action = actions.find((a: any) =>
          a.type === 'update-equipo' &&
          a.revisionEquipo_id === inventory.revision_equipo?.id &&
          a.inventory_id === inventory.id
        );
        return action?.requestData?.file || null;
      }
    } catch (error) {
      console.error('Error getting cached image:', error);
    }
    return null;
  };

  const [cachedImage, setCachedImage] = React.useState<string | null>(null);
  const [isConnected, setIsConnected] = React.useState<boolean>(true);
  const [serverImageBase64, setServerImageBase64] = React.useState<string | null>(null);
  const [imageRefreshKey, setImageRefreshKey] = React.useState<number>(0);
  const apiUrl = Constants.expoConfig?.extra?.API_SERVER;

  const loadImageFromServer = React.useCallback(async () => {
    if (
      !apiUrl ||
      !inventory.revision_equipo?.id ||
      !inventory.revision_equipo?.imagen_adjunta
    ) {
      return;
    }

    try {
      const token = (await AsyncStorage.getItem('access_token')) || '';
      const baseImageUrl = `${apiUrl}/api/activities/equipo/${inventory.revision_equipo.id}/get-image?article_id=${inventory.id}&t=${Date.now()}`;
      const imageUrl = token
        ? `${baseImageUrl}&token=${encodeURIComponent(token)}`
        : baseImageUrl;
      const response = await authedFetch({
        url: imageUrl,
        init: { method: 'GET' },
        refreshAccessToken,
        logout,
      });
      if (!response) return;

      if (response.ok) {
        const blob = await response.blob();

        // Convert blob to base64
        const base64Image = await new Promise<string | null>((resolve) => {
          const reader = new FileReader();

          reader.onerror = () => {
            console.error('Error al leer la imagen con FileReader');
            resolve(null);
          };

          reader.onloadend = () => {
            try {
              const base64data = reader.result as string;
              if (!base64data) {
                console.warn('No se pudo convertir la imagen a base64');
                resolve(null);
              } else {
                resolve(base64data);
              }
            } catch (error) {
              console.error('Error al procesar base64:', error);
              resolve(null);
            }
          };

          reader.readAsDataURL(blob);
        });

        if (base64Image) {
          setServerImageBase64(base64Image);
        }
      }
    } catch (error) {
      console.error('Error fetching image:', error);
    }
  }, [apiUrl, inventory.revision_equipo?.id, inventory.revision_equipo?.imagen_adjunta]);

  React.useEffect(() => {
    if (!inventory.revision_equipo?.imagen_adjunta) {
      // Esta revisión de equipo no tiene imagen asociada; evitamos peticiones innecesarias
      setCachedImage(null);
      setServerImageBase64(null);
      return;
    }

    const checkConnectionAndLoadImage = async () => {
      const connectionStatus = await getConnectionStatus();
      setIsConnected(connectionStatus);

      if (!connectionStatus) {
        // Offline: load from cache
        const cached = await getCachedImage();
        setCachedImage(cached);
        setServerImageBase64(null);
      } else {
        // Online: fetch image from server and convert to base64
        const cached = await getCachedImage();
        setCachedImage(cached);

        await loadImageFromServer();
      }
    };

    checkConnectionAndLoadImage();
  }, [inventory.revision_equipo?.id, inventory.revision_equipo?.imagen_adjunta, imageRefreshKey, loadImageFromServer]);

  return (
    <View style={styles.tableRow}>
      <View style={styles.tableCell}>
        <View style={styles.pickerContainerTable}>
          <Picker
            selectedValue={estado}
            onValueChange={(value) => handleEstadoChange(value as EstadoArticulo)}
            style={styles.pickerTable}
            itemStyle={styles.pickerItemStyle}
          >
            <Picker.Item label="Bueno" value="Bueno" />
            <Picker.Item label="Malo" value="Malo" />
            <Picker.Item label="No está" value="No está" />
          </Picker>
        </View>
      </View>
      <View style={styles.tableCell}>
        <ThemedText style={styles.tableCellText}>
          {typeof inventory.cantidad_requerida === 'number' ? String(inventory.cantidad_requerida) : '-'}
        </ThemedText>
      </View>
      <View style={styles.tableCell}>
        <TextInput
          style={styles.inputTable}
          value={String(cantidadReal)}
          onChangeText={(text) => {
            const num = parseInt(text, 10) || 0;
            handleCantidadRealChange(num);
          }}
          keyboardType="numeric"
          placeholderTextColor="#999"
        />
      </View>
      <View style={styles.tableCell}>
        <TextInput
          style={[styles.inputTable, styles.textAreaTable]}
          value={observaciones}
          onChangeText={handleObservacionesChange}
          placeholder="Observaciones..."
          placeholderTextColor="#999"
          multiline
          numberOfLines={3}
        />
        {inventoryImages[inventory.id] && (
          <ThemedView style={styles.imagePreviewContainer}>
            <Image
              source={{ uri: inventoryImages[inventory.id].startsWith('data:') ? inventoryImages[inventory.id] : `data:image/jpeg;base64,${inventoryImages[inventory.id]}` }}
              style={styles.imagePreview}
              resizeMode="contain"
            />
          </ThemedView>
        )}
        {!inventoryImages[inventory.id] && inventory.revision_equipo?.imagen_adjunta && (
          <ThemedView style={styles.imagePreviewContainer}>
            {(() => {
              const imageToShow = serverImageBase64 || cachedImage;
              if (!imageToShow) return null;
              const imageUri = imageToShow.startsWith('data:') ? imageToShow : `data:image/jpeg;base64,${imageToShow}`;
              return <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="contain" />;
            })()}
          </ThemedView>
        )}
      </View>
    </View>
  );
};

interface Actividad {
  id: number;
  nombre_actividad: string;
  frecuencia: string;
  descripcion_actividad: string;
  is_revision_equipo: boolean;
  is_marcada: boolean;
  is_pendiente: boolean;
  inventario: Inventario[];
  imagen_adjunta: string;
}

interface Inventario {
  id: number;
  nombre: string;
  cantidad_requerida?: number;
  cantidad_real?: number;
  estado?: 'Bueno' | 'Malo' | 'No está';
  observaciones?: string;
  reglas: Reglas[];
  revision_equipo: RevisionEquipo;
}

interface Reglas {
  nombre: string;
  valor: string;
}

interface RevisionEquipo {
  id: number;
  marcada: boolean;
  es_correcto: boolean;
  motivo_incorrecto: string;
  imagen_adjunta: string;
}

interface EmpleadoOption {
  nombre: string;
  primer_apellido: string;
  segundo_apellido: string;
}

interface PlazaOption {
  id: number;
  nombre: string;
  empleados: EmpleadoOption[];
}

interface PuestoOption {
  id: number;
  nombre: string;
  plazas: PlazaOption[];
}

interface ArticuloOption {
  id: number;
  nombre: string;
}

interface AssignedResponsable {
  puestoId: number;
  puestoNombre: string;
  assignAll: boolean;
  plazas: { plazaId: number; plazaNombre: string }[];
}

interface ArticuloRuleEntry {
  articuloId: number;
  articuloNombre: string;
  reglas: { id: string; nombre: string; valor: string }[];
}

type MainStructurePuestoNode = { id: number; nombre: string; plazas: PlazaOption[] };
type MainStructureSucursalNode = { id: number; nombre: string; puestos: MainStructurePuestoNode[] };
type MainStructureContratoNode = { id: number; nombre: string; sucursales: MainStructureSucursalNode[] };
type MainStructureDivisionNode = { id: number; nombre: string; contratos: MainStructureContratoNode[] };
type MainStructureClienteNode = { id: number; nombre: string; division: MainStructureDivisionNode[] };
type MainStructureEmpresaNode = { id: number; nombre: string; clientes: MainStructureClienteNode[] };
type MainStructureTree = MainStructureEmpresaNode[];

interface CreatedActivityItem {
  id: number;
  nombre_actividad: string;
  descripcion_actividad: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  frecuencia: string;
  es_revision_equipo: boolean;
  firma_responsable: string;
}

interface SignatureData {
  raw: string;
  sessionId: string;
  employeeId: string;
  latitude: string;
  longitude: string;
  timestamp: string;
  employeeName?: string;
}

interface ActivitiesResponse {
  status: boolean;
  actividades?: Actividad[];
  message?: string;
}

interface ToggleActivityRequest {
  actividad_id: number;
  marca_id: number;
  empleado_id: number;
  estado: 'marcar' | 'desmarcar';
  bitacora: string | null;
}

interface ToggleActivityResponse {
  status: boolean;
  message: string;
}

interface InventoryRequest {
  actividad_id: number;
  articulo_id: number;
  es_correcto: boolean;
  motivo_incorrecto: string;
}

interface InventoryUpdateRequest {
  es_correcto: boolean;
  motivo_incorrecto: string;
}

interface InventoryResponse {
  status: boolean;
  message: string;
}

export default function ActivitiesScreen() {
  const { employee, refreshAccessToken, logout } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<ActivitiesScreenNavigationProp>();

  // Activities state
  const [activities, setActivities] = useState<Actividad[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Importante: "sin internet" NO cuenta como error (solo es un estado informativo)
  const [offlineMessage, setOfflineMessage] = useState<string | null>(null);
  const [hasCurrentMarca, setHasCurrentMarca] = useState<boolean>(false);
  const [moduleStep, setModuleStep] = useState<'assigned' | 'created' | 'form'>('assigned');

  // Bitacora modal state
  const [isBitacoraModalVisible, setIsBitacoraModalVisible] = useState(false);
  const [bitacoraText, setBitacoraText] = useState('');
  const [selectedActivity, setSelectedActivity] = useState<Actividad | null>(null);
  const [activityImageBase64, setActivityImageBase64] = useState<string | null>(null);

  // Camera state
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [cameraTarget, setCameraTarget] = useState<'activity' | 'inventory'>('activity');
  const [targetInventoryId, setTargetInventoryId] = useState<number | null>(null);
  const [inventoryImages, setInventoryImages] = useState<{ [key: number]: string }>({});
  const [articleFormState, setArticleFormState] = useState<Record<string, ArticleFormState>>({});
  const getArticleFormState = useCallback((activityId: number, inventory: Inventario) => {
    const key = `${activityId}-${inventory.id}`;
    return articleFormState[key] ?? getDefaultArticleFormState(inventory);
  }, [articleFormState]);
  const setArticleFormStateCallback = useCallback((activityId: number, inventory: Inventario, partial: Partial<ArticleFormState>) => {
    setArticleFormState(prev => {
      const key = `${activityId}-${inventory.id}`;
      const current = prev[key] ?? getDefaultArticleFormState(inventory);
      return { ...prev, [key]: { ...current, ...partial } };
    });
  }, []);
  // Repetition config modal state
  const [isCreateActivityVisible, setIsCreateActivityVisible] = useState(false);
  const [isEditingCreatedActivity, setIsEditingCreatedActivity] = useState(false);
  const [editingCreatedActivityId, setEditingCreatedActivityId] = useState<number | null>(null);
  const [repetitionType, setRepetitionType] = useState<'daily' | 'weekly' | 'monthly-weekday' | 'monthly-last' | 'yearly' | 'weekdays' | 'custom'>('custom');
  const [weeklyLabel, setWeeklyLabel] = useState<string>('Cada semana');
  const [monthlyWeekdayLabel, setMonthlyWeekdayLabel] = useState<string>('Mes (día sem.)');
  const [monthlyLastLabel, setMonthlyLastLabel] = useState<string>('Mes (último día sem.)');
  const [yearlyLabel, setYearlyLabel] = useState<string>('Anual');
  const [monthDayOfMonthLabel, setMonthDayOfMonthLabel] = useState<string>('Día del mes actual');
  const [monthWeekdayOfMonthLabel, setMonthWeekdayOfMonthLabel] = useState<string>('Mismo día de semana');
  const [customInterval, setCustomInterval] = useState<string>('1');
  const [customUnit, setCustomUnit] = useState<'day' | 'week' | 'month' | 'year'>('week');
  const [selectedWeekdays, setSelectedWeekdays] = useState<string[]>([]);
  const [monthOption, setMonthOption] = useState<'day-of-month' | 'weekday-of-month'>('day-of-month');
  const [yearMonth, setYearMonth] = useState<string>('1');
  const [yearDay, setYearDay] = useState<string>('1');
  const [endType, setEndType] = useState<'never' | 'date'>('never');
  const [endDate, setEndDate] = useState<string>('');
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [activityName, setActivityName] = useState('');
  const [activityDescription, setActivityDescription] = useState('');
  const [activityStartDate, setActivityStartDate] = useState<Date>(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [tipoActividad, setTipoActividad] = useState<'Normal' | 'Inventario'>('Normal');
  const [puestos, setPuestos] = useState<PuestoOption[]>([]);
  const [articulosCatalog, setArticulosCatalog] = useState<ArticuloOption[]>([]);
  const [selectedPuestoId, setSelectedPuestoId] = useState<string>('');
  const [markedPlazaIds, setMarkedPlazaIds] = useState<string[]>([]);
  const [selectedArticuloId, setSelectedArticuloId] = useState<string>('');
  const [assignedResponsables, setAssignedResponsables] = useState<AssignedResponsable[]>([]);
  const [articuloRules, setArticuloRules] = useState<ArticuloRuleEntry[]>([]);
  const [isLoadingCatalogs, setIsLoadingCatalogs] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [currentMarcaId, setCurrentMarcaId] = useState<number | null>(null);
  const [currentCorpoId, setCurrentCorpoId] = useState<number | null>(null);
  const [signatureData, setSignatureData] = useState<SignatureData | null>(null);
  const [signatureEmployeeName, setSignatureEmployeeName] = useState<string | null>(null);
  const [isProcessingSignature, setIsProcessingSignature] = useState(false);
  const [isSubmittingActivity, setIsSubmittingActivity] = useState(false);
  const [createdActivities, setCreatedActivities] = useState<CreatedActivityItem[]>([]);
  const [isLoadingCreatedActivities, setIsLoadingCreatedActivities] = useState(false);

  // Jerarquía desde cache (sin endpoint)
  const [structure, setStructure] = useState<MainStructureTree>([]);
  const [isStructureLoading, setIsStructureLoading] = useState(false);
  const [assignToAllDivision, setAssignToAllDivision] = useState(false);
  const [selectedDivisionForAll, setSelectedDivisionForAll] = useState<number | null>(null);
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<number | null>(null);
  const [selectedClienteId, setSelectedClienteId] = useState<number | null>(null);
  const [selectedDivisionId, setSelectedDivisionId] = useState<number | null>(null);
  const [selectedContratoId, setSelectedContratoId] = useState<number | null>(null);
  const [selectedSucursalId, setSelectedSucursalId] = useState<number | null>(null);
  const [selectedPuestoFilterId, setSelectedPuestoFilterId] = useState<number | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const { scanQR, QRScannerComponent } = useQRScanner();

  // Modal: ver cambios de actividades creadas
  const [isCambiosModalVisible, setIsCambiosModalVisible] = useState(false);
  const [cambiosTitle, setCambiosTitle] = useState<string>('Cambios');
  const [cambiosItems, setCambiosItems] = useState<any[]>([]);
  const [expandedCambioId, setExpandedCambioId] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      //findCurrentMarca();
      fetchActivities();
    }, [])
  );

  // Update dynamic labels for monthly and yearly options
  useEffect(() => {
    const baseDate = activityStartDate || new Date();
    const weekdays = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const weekOrdinals = ['primer', 'segundo', 'tercer', 'cuarto', 'último'];
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

    const currentWeekday = baseDate.getDay();
    const weekdayName = weekdays[currentWeekday];
    const weekOrdinal = getWeekOrdinal(baseDate);
    const ordinalName = weekOrdinals[weekOrdinal - 1] || 'último';

    const currentDay = baseDate.getDate();
    const currentMonth = baseDate.getMonth();
    const monthName = months[currentMonth];

    // Calculate last weekday of current month
    const lastWeekdayName = weekdays[currentWeekday];

    setWeeklyLabel(`Cada semana el ${weekdayName}`);
    setMonthlyWeekdayLabel(`Cada mes el ${ordinalName} ${weekdayName}`);
    setMonthlyLastLabel(`Cada mes el último ${weekdayName}`);
    setYearlyLabel(`Anual (${currentDay} de ${monthName})`);
    setMonthDayOfMonthLabel(`Cada mes el día ${currentDay}`);
    setMonthWeekdayOfMonthLabel(`Cada mes el ${ordinalName} ${lastWeekdayName}`);
  }, [activityStartDate]);

  useEffect(() => {
    if (!activityStartDate) return;
    const monthString = String(activityStartDate.getMonth() + 1);
    const dayString = String(activityStartDate.getDate());
    setYearMonth(prev => (prev === monthString ? prev : monthString));
    setYearDay(prev => (prev === dayString ? prev : dayString));
  }, [activityStartDate]);

  useEffect(() => {
    const handler = () => {
      fetchActivities();
    };

    eventBus.on('connectionRestored', handler);
    return () => {
      eventBus.off('connectionRestored', handler);
    };
  }, []);

  const getConnectionStatus = async (): Promise<boolean> => {
    const networkState = await Network.getNetworkStateAsync();
    return networkState.isConnected && networkState.isInternetReachable ? true : false;
  };

  const isProbablyNetworkError = (err: any) => {
    const msg = String(err?.message ?? err ?? '').toLowerCase();
    return (
      msg.includes('network request failed') ||
      msg.includes('failed to fetch') ||
      msg.includes('networkerror') ||
      msg.includes('timeout') ||
      msg.includes('timed out')
    );
  };

  const fetchActivities = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setOfflineMessage(null);

      // Verificar si existe current_marca
      const currentMarca = await AsyncStorage.getItem('current_marca');
      if (!currentMarca) {
        setHasCurrentMarca(false);
        setIsLoading(false);
        return;
      }

      const currentMarcaData = JSON.parse(currentMarca);
      const marcaId = currentMarcaData.id;
      setHasCurrentMarca(true);

      const isConnected = await getConnectionStatus();

      if (isConnected) {
        // Online: fetch from API and cache
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) {
          throw new Error('Server URL not configured');
        }

        const response = await authedFetch({
          url: `${apiUrl}/api/activities/marca/${marcaId}`,
          init: {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          },
          refreshAccessToken,
          logout,
        });
        if (!response) return;

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: ActivitiesResponse = await response.json();

        if (data.status && data.actividades) {
          setActivities(data.actividades);
          // Cache the activities
          await AsyncStorage.setItem('activities_cache', JSON.stringify(data.actividades));
        } else {
          // Error real del servidor / lógica (sí cuenta como error)
          setError(data.message || 'Error al cargar las actividades');
        }
      } else {
        // Offline: load from cache
        const cachedActivities = await AsyncStorage.getItem('activities_cache');
        if (cachedActivities) {
          const parsedActivities = JSON.parse(cachedActivities);
          setActivities(parsedActivities);
          setOfflineMessage('Modo Offline: mostrando actividades guardadas. Los cambios se sincronizarán cuando recuperes la conexión.');
        } else {
          // Sin internet NO es error
          setActivities([]);
          setOfflineMessage('Sin conexión: no hay actividades guardadas para mostrar.');
        }
      }
    } catch (err) {
      console.error('Error fetching activities:', err);

      // Try to load from cache if online fetch fails
      const cachedActivities = await AsyncStorage.getItem('activities_cache');
      if (cachedActivities) {
        const parsedActivities = JSON.parse(cachedActivities);
        setActivities(parsedActivities);
        setOfflineMessage('Modo Offline: mostrando actividades guardadas debido a un error de conexión.');
      } else {
        if (isProbablyNetworkError(err)) {
          setActivities([]);
          setOfflineMessage('Sin conexión: no hay actividades guardadas para mostrar.');
        } else {
          setError('Error al cargar las actividades');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const resetCreateActivityForm = (_horaAccion: string) => {
    setActivityName('');
    setActivityDescription('');
    // Siempre iniciar en la fecha actual para evitar fechas inválidas
    setActivityStartDate(new Date());
    setShowStartDatePicker(false);
    setTipoActividad('Normal');
    setSelectedPuestoId('');
    setMarkedPlazaIds([]);
    setSelectedArticuloId('');
    setAssignedResponsables([]);
    setArticuloRules([]);
    setSignatureData(null);
    setSignatureEmployeeName(null);
    setCatalogError(null);
    setRepetitionType('custom');
    setCustomInterval('1');
    setCustomUnit('week');
    setSelectedWeekdays([]);
    setMonthOption('day-of-month');
    setYearMonth('1');
    setYearDay('1');
    setEndType('never');
    setEndDate('');
    setShowEndDatePicker(false);
  };

  const prepareCreateActivityForm = async () => {
    try {
      setCatalogError(null);
      setIsLoadingCatalogs(true);
      setModuleStep('form');
      setIsCreateActivityVisible(true);
      const currentMarcaStr = await AsyncStorage.getItem('current_marca');
      if (!currentMarcaStr) {
        Alert.alert('Error', 'No se encontró la marca actual. Registra una marca antes de crear actividades.');
        setIsCreateActivityVisible(false);
        setModuleStep('created');
        return;
      }

      const currentMarcaData = JSON.parse(currentMarcaStr);
      if (!currentMarcaData?.id || !currentMarcaData?.corpo?.id) {
        Alert.alert('Error', 'La marca actual no tiene información del corpo.');
        setIsCreateActivityVisible(false);
        return;
      }

      setCurrentMarcaId(currentMarcaData.id);
      setCurrentCorpoId(currentMarcaData.corpo.id);

      const isConnected = await getConnectionStatus();
      if (!isConnected) {
        Alert.alert('Sin conexión', 'Este submódulo funciona exclusivamente con internet.');
        setIsCreateActivityVisible(false);
        setModuleStep('created');
        return;
      }
      await Promise.all([
        loadMainStructureCache(),
        loadArticulosCatalog(isConnected),
      ]);
    } catch (error) {
      console.error('Error preparing activity form:', error);
      setCatalogError('No se pudieron cargar los catálogos. Intenta nuevamente.');
    } finally {
      setIsLoadingCatalogs(false);
    }
  };

  const loadMainStructureCache = async () => {
    try {
      setIsStructureLoading(true);
      const cache = await AsyncStorage.getItem('main_structure_cache');
      const parsed = cache ? JSON.parse(cache) : [];
      const empresas = Array.isArray(parsed) ? parsed : [];
      setStructure(empresas);
    } catch (error) {
      console.error('Error loading main_structure_cache:', error);
      setStructure([]);
      setCatalogError('No se pudo leer la jerarquía guardada.');
    } finally {
      setIsStructureLoading(false);
    }
  };

  const loadPuestosCatalog = async (corpoId: number, isConnected: boolean) => {
    const loadFromCache = async () => {
      const cache = await AsyncStorage.getItem('puestos_corpo_cache');
      if (cache) {
        const parsed = JSON.parse(cache);
        setPuestos(parsed);
      } else {
        throw new Error('No hay puestos guardados en caché');
      }
    };

    if (isConnected) {
      try {
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) {
          throw new Error('Server URL not configured');
        }

        const response = await authedFetch({
          url: `${apiUrl}/api/puestos/corpo/${corpoId}`,
          init: {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          },
          refreshAccessToken,
          logout,
        });
        if (!response) return;

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (data.status && data.puestos) {
          setPuestos(data.puestos);
          await AsyncStorage.setItem('puestos_corpo_cache', JSON.stringify(data.puestos));
        } else {
          throw new Error(data.message || 'No se pudieron cargar los puestos');
        }
      } catch (error) {
        console.error('Error fetching puestos catalog:', error);
        try {
          await loadFromCache();
          Alert.alert('Modo offline', 'No se pudo conectar al servidor. Se usarán los puestos guardados.');
        } catch (cacheError) {
          console.error('No puestos cache available:', cacheError);
          setCatalogError('No hay información de puestos disponible sin conexión.');
          setPuestos([]);
        }
      }
    } else {
      try {
        await loadFromCache();
      } catch (error) {
        console.error('No puestos cache available:', error);
        setCatalogError('No hay información de puestos disponible sin conexión.');
        setPuestos([]);
      }
    }
  };

  const loadArticulosCatalog = async (isConnected: boolean) => {
    const loadFromCache = async () => {
      const cache = await AsyncStorage.getItem('articulos_cache');
      if (cache) {
        const parsed = JSON.parse(cache);
        setArticulosCatalog(parsed);
      } else {
        throw new Error('No hay artículos guardados en caché');
      }
    };

    if (isConnected) {
      try {
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) {
          throw new Error('Server URL not configured');
        }

        const response = await authedFetch({
          url: `${apiUrl}/api/articulos`,
          init: {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          },
          refreshAccessToken,
          logout,
        });
        if (!response) return;

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (data.status && data.articulos) {
          setArticulosCatalog(data.articulos);
          await AsyncStorage.setItem('articulos_cache', JSON.stringify(data.articulos));
        } else {
          throw new Error(data.message || 'No se pudieron cargar los artículos');
        }
      } catch (error) {
        console.error('Error fetching articulos catalog:', error);
        try {
          await loadFromCache();
          Alert.alert('Modo offline', 'No se pudo conectar al servidor. Se usarán los artículos guardados.');
        } catch (cacheError) {
          console.error('No articulos cache available:', cacheError);
          setCatalogError('No hay artículos disponibles sin conexión.');
          setArticulosCatalog([]);
        }
      }
    } else {
      try {
        await loadFromCache();
      } catch (error) {
        console.error('No articulos cache available:', error);
        setCatalogError('No hay artículos disponibles sin conexión.');
        setArticulosCatalog([]);
      }
    }
  };

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'activities': return <Ionicons name="list" size={25} color='#000000' />;
      case 'check': return <Ionicons name="checkmark" size={20} color='#34C759' />;
      case 'uncheck': return <Ionicons name="close" size={20} color='#FF3B30' />;
      case 'confirm': return <Ionicons name="checkmark" size={35} color='#fff' />;
      case 'cancel': return <Ionicons name="close" size={35} color='#fff' />;
      case 'clear': return <Ionicons name="trash" size={20} color='#000000' />;
      default: return <Ionicons name="list" size={25} color='#000000' />;
    }
  };

  const generateDateTime = (timestamp: string) => {
    const fecha = new Date(parseInt(timestamp)).toISOString();
    const fechaSplit = fecha.split('T');
    fechaSplit[1] = fechaSplit[1].split('.')[0];
    return fechaSplit[0] + ' ' + fechaSplit[1];
  };

  // ===== Repetition configuration helpers (based on repeticion-evento project) =====

  const getWeekOrdinal = (date: Date) => {
    const dayOfMonth = date.getDate();
    const dayOfWeek = date.getDay();

    const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const firstWeekday = firstDayOfMonth.getDay();

    const daysToFirstWeekday = (dayOfWeek - firstWeekday + 7) % 7;
    const firstWeekdayDate = 1 + daysToFirstWeekday;

    const ordinal = Math.floor((dayOfMonth - firstWeekdayDate) / 7) + 1;

    const lastWeekdayDate = getLastWeekdayOfMonth(date.getFullYear(), date.getMonth(), dayOfWeek);
    if (dayOfMonth === lastWeekdayDate) {
      return 5; // último
    }

    return ordinal;
  };

  const getLastWeekdayOfMonth = (year: number, month: number, weekday: number) => {
    const lastDay = new Date(year, month + 1, 0);
    const lastWeekday = lastDay.getDay();
    const daysToSubtract = (lastWeekday - weekday + 7) % 7;
    const targetDate = new Date(year, month + 1, 0 - daysToSubtract);
    return targetDate.getDate();
  };

  const generateRepetitionTitle = (config: any, type: string) => {
    const weekdays = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const weekOrdinals = ['primer', 'segundo', 'tercer', 'cuarto', 'último'];

    let title = '';

    switch (type) {
      case 'daily':
        if (config.interval === 1) {
          title = 'Cada día';
        } else {
          title = `Cada ${config.interval} días`;
        }
        break;
      case 'weekly': {
        const weekdayName = weekdays[config.weekday];
        if (config.interval === 1) {
          title = `Cada semana el ${weekdayName}`;
        } else {
          title = `Cada ${config.interval} semanas el ${weekdayName}`;
        }
        break;
      }
      case 'monthly-weekday': {
        const weekdayName2 = weekdays[config.weekday];
        const ordinalName = weekOrdinals[config.weekOrdinal - 1] || 'último';
        if (config.interval === 1) {
          title = `Cada mes el ${ordinalName} ${weekdayName2}`;
        } else {
          title = `Cada ${config.interval} meses el ${ordinalName} ${weekdayName2}`;
        }
        break;
      }
      case 'monthly-last': {
        const weekdayName3 = weekdays[config.weekday];
        if (config.interval === 1) {
          title = `Cada mes el último ${weekdayName3}`;
        } else {
          title = `Cada ${config.interval} meses el último ${weekdayName3}`;
        }
        break;
      }
      case 'yearly': {
        const monthName = months[config.month - 1];
        if (config.interval === 1) {
          title = `Anualmente el ${config.day} de ${monthName}`;
        } else {
          title = `Cada ${config.interval} años el ${config.day} de ${monthName}`;
        }
        break;
      }
      case 'weekdays':
        if (config.interval === 1) {
          title = 'Todos los días laborables (lunes a viernes)';
        } else {
          title = `Cada ${config.interval} días laborables (lunes a viernes)`;
        }
        break;
      case 'custom': {
        const unit = config.unit;
        const interval = config.interval;

        switch (unit) {
          case 'day':
            title = `Cada ${interval} ${interval === 1 ? 'día' : 'días'}`;
            break;
          case 'week':
            if (config.weekdays && config.weekdays.length > 0) {
              const weekdayMap: Record<string, string> = {
                sunday: 'domingo',
                monday: 'lunes',
                tuesday: 'martes',
                wednesday: 'miércoles',
                thursday: 'jueves',
                friday: 'viernes',
                saturday: 'sábado',
              };
              const selectedWeekdays = config.weekdays
                .map((wd: string) => weekdayMap[wd] || wd)
                .join(', ');
              title = `Cada ${interval} ${interval === 1 ? 'semana' : 'semanas'} los ${selectedWeekdays}`;
            } else {
              title = `Cada ${interval} ${interval === 1 ? 'semana' : 'semanas'}`;
            }
            break;
          case 'month':
            if (config.monthOption === 'day-of-month') {
              title = `Cada ${interval} ${interval === 1 ? 'mes' : 'meses'} el día ${config.day}`;
            } else {
              const weekdayName4 = weekdays[config.weekday];
              const ordinalName2 = weekOrdinals[config.weekOrdinal - 1] || 'último';
              title = `Cada ${interval} ${interval === 1 ? 'mes' : 'meses'} el ${ordinalName2} ${weekdayName4}`;
            }
            break;
          case 'year': {
            const monthName2 = months[config.month - 1];
            title = `Cada ${interval} ${interval === 1 ? 'año' : 'años'} el ${config.day} de ${monthName2}`;
            break;
          }
          default:
            title = `Repetición personalizada cada ${interval} ${unit}`;
        }
        break;
      }
      default:
        title = 'Configuración de la actividad';
    }

    if (config.endType === 'date' && config.endDate) {
      const endDateObj = new Date(config.endDate);
      const endDateStr = formatDateForDisplay(endDateObj);
      title += ` (termina el ${endDateStr})`;
    } else if (config.endType === 'never') {
      title += ' (sin fecha de finalización)';
    }

    return title;
  };

  const toggleWeekday = (value: string) => {
    setSelectedWeekdays(prev =>
      prev.includes(value) ? prev.filter(w => w !== value) : [...prev, value]
    );
  };

  const openRepetitionModal = async () => {
    const horaAccion = await getHoraAccion();
    if (!horaAccion) {
      Alert.alert('Error', 'No se pudo obtener la hora de acción');
      return;
    }
    resetCreateActivityForm(String(horaAccion));
    setIsEditingCreatedActivity(false);
    setEditingCreatedActivityId(null);
    setIsCreateActivityVisible(true);
    await prepareCreateActivityForm();
  };

  const closeRepetitionModal = async () => {
    const horaAccion = await getHoraAccion();
    if (!horaAccion) {
      Alert.alert('Error', 'No se pudo obtener la hora de acción');
      return;
    }
    resetCreateActivityForm(String(horaAccion));
    setIsCreateActivityVisible(false);
    setModuleStep('created');
    setIsEditingCreatedActivity(false);
    setEditingCreatedActivityId(null);
  };

  const formatDateForDisplay = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${day}-${month}-${year}`;
  };

  const formatDateForApi = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatPlazaLabel = (plaza: PlazaOption) => {
    if (!plaza.empleados || plaza.empleados.length === 0) {
      return plaza.nombre;
    }
    const empleadosNombres = plaza.empleados.map(emp => emp.nombre).join(', ');
    return `${plaza.nombre} (${empleadosNombres})`;
  };

  const handleStartDateChange = (_event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowStartDatePicker(false);
    }
    if (selectedDate) {
      setActivityStartDate(selectedDate);
    }
  };

  useEffect(() => {
    if (!selectedPuestoId) {
      setMarkedPlazaIds([]);
      return;
    }
    const puestoId = parseInt(selectedPuestoId, 10);
    const existing = assignedResponsables.find(
      (r) => r.puestoId === puestoId && !r.assignAll
    );
    if (existing) {
      setMarkedPlazaIds(existing.plazas.map((p: { plazaId: number }) => String(p.plazaId)));
    } else {
      setMarkedPlazaIds([]);
    }
    
  }, [selectedPuestoId, assignedResponsables]);

  const findCurrentMarca = async () => {
    const currentMarca = await AsyncStorage.getItem('current_marca');
    setRole(null);
    if (currentMarca) {
      const currentMarcaData = JSON.parse(currentMarca);
      setRole(currentMarcaData.roleDivision.role.nombre);
      console.log('Role:', role);
    }
  };

  const handleSelectPuesto = (value: string) => {
    setSelectedPuestoId(value);
    if (!value) {
      setMarkedPlazaIds([]);
      return;
    }
    const puestoId = parseInt(value, 10);
    const existing = assignedResponsables.find(
      (r) => r.puestoId === puestoId && !r.assignAll
    );
    if (existing) {
      setMarkedPlazaIds(existing.plazas.map((p: { plazaId: number }) => String(p.plazaId)));
    } else {
      setMarkedPlazaIds([]);
    }
  };

  const handleAddSelectedPlazas = () => {
    if (!selectedPuestoId) {
      Alert.alert('Validación', 'Selecciona un puesto.');
      return;
    }

    const puestoId = parseInt(selectedPuestoId, 10);
    const puesto = effectivePuestos.find(p => p.id === puestoId);
    if (!puesto) {
      Alert.alert('Validación', 'El puesto seleccionado no es válido.');
      return;
    }

    if (markedPlazaIds.length === 0) {
      Alert.alert('Validación', 'Selecciona al menos una plaza de la lista.');
      return;
    }

    const plazasToAdd = puesto.plazas.filter(plaza =>
      markedPlazaIds.includes(String(plaza.id))
    );

    if (plazasToAdd.length === 0) {
      Alert.alert('Validación', 'Las plazas seleccionadas no son válidas para este puesto.');
      return;
    }

    const assignedEntry = assignedResponsables.find(r => r.puestoId === puestoId);
    if (assignedEntry?.assignAll) {
      Alert.alert('Aviso', 'La actividad ya está asignada a todo este puesto.');
      return;
    }

    const newPlazaRecords = plazasToAdd
      .filter(plaza => !(assignedEntry?.plazas.some(p => p.plazaId === plaza.id)))
      .map(plaza => ({
        plazaId: plaza.id,
        plazaNombre: formatPlazaLabel(plaza),
      }));

    if (newPlazaRecords.length === 0) {
      Alert.alert('Aviso', 'Las plazas seleccionadas ya fueron agregadas.');
      return;
    }

    setAssignedResponsables(prev => {
      const existing = prev.find(r => r.puestoId === puestoId);
      if (existing) {
        return prev.map(r =>
          r.puestoId === puestoId
            ? {
              ...r,
              plazas: [...r.plazas, ...newPlazaRecords],
            }
            : r
        );
      }

      return [
        ...prev,
        {
          puestoId,
          puestoNombre: puesto.nombre,
          assignAll: false,
          plazas: newPlazaRecords,
        },
      ];
    });
  };

  const handleAssignPuestoCompleto = () => {
    if (!selectedPuestoId) {
      Alert.alert('Validación', 'Selecciona un puesto.');
      return;
    }
    const puestoId = parseInt(selectedPuestoId, 10);
    const puesto = effectivePuestos.find(p => p.id === puestoId);
    if (!puesto) {
      Alert.alert('Validación', 'El puesto seleccionado no es válido.');
      return;
    }

    const alreadyAssigned = assignedResponsables.some(r => r.puestoId === puestoId);
    if (alreadyAssigned) {
      Alert.alert('Aviso', 'Ya agregaste plazas o este puesto completo.');
      return;
    }

    setAssignedResponsables(prev => [
      ...prev,
      {
        puestoId,
        puestoNombre: puesto.nombre,
        assignAll: true,
        plazas: [],
      },
    ]);
  };

  const togglePlazaSelection = (plazaId: string) => {
    if (selectedPuestoEntry?.assignAll) {
      return;
    }
    setMarkedPlazaIds(prev =>
      prev.includes(plazaId)
        ? prev.filter(id => id !== plazaId)
        : [...prev, plazaId]
    );
  };

  const handleRemovePuesto = (puestoId: number) => {
    setAssignedResponsables(prev => prev.filter(r => r.puestoId !== puestoId));
  };

  const handleRemovePlaza = (puestoId: number, plazaId: number) => {
    setAssignedResponsables(prev =>
      prev
        .map(r =>
          r.puestoId === puestoId
            ? {
              ...r,
              plazas: r.plazas.filter(p => p.plazaId !== plazaId),
            }
            : r
        )
        .filter(r => r.assignAll || r.plazas.length > 0)
    );
  };

  const generateRuleId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const handleArticuloSelection = (value: string) => {
    setSelectedArticuloId(value);
    if (!value) return;

    const articuloId = parseInt(value, 10);
    if (articuloRules.some(rule => rule.articuloId === articuloId)) {
      return;
    }

    const articulo = articulosCatalog.find(a => a.id === articuloId);
    setArticuloRules(prev => [
      ...prev,
      {
        articuloId,
        articuloNombre: articulo?.nombre || 'Artículo',
        reglas: [{ id: generateRuleId(), nombre: '', valor: '' }],
      },
    ]);
    setSelectedArticuloId('');
  };

  const handleRemoveArticulo = (articuloId: number) => {
    setArticuloRules(prev => prev.filter(rule => rule.articuloId !== articuloId));
  };

  const handleAddRule = (articuloId: number) => {
    setArticuloRules(prev =>
      prev.map(rule =>
        rule.articuloId === articuloId
          ? {
            ...rule,
            reglas: [...rule.reglas, { id: generateRuleId(), nombre: '', valor: '' }],
          }
          : rule
      )
    );
  };

  const handleRuleChange = (articuloId: number, ruleId: string, field: 'nombre' | 'valor', value: string) => {
    setArticuloRules(prev =>
      prev.map(rule =>
        rule.articuloId === articuloId
          ? {
            ...rule,
            reglas: rule.reglas.map(r =>
              r.id === ruleId
                ? {
                  ...r,
                  [field]: value,
                }
                : r
            ),
          }
          : rule
      )
    );
  };

  const handleRemoveRule = (articuloId: number, ruleId: string) => {
    setArticuloRules(prev =>
      prev
        .map(rule =>
          rule.articuloId === articuloId
            ? {
              ...rule,
              reglas: rule.reglas.filter(r => r.id !== ruleId),
            }
            : rule
        )
        .filter(rule => rule.reglas.length > 0)
    );
  };

  const decodeSignatureHash = (hash: string) => {
    const decoded = Buffer.from(hash, 'base64').toString('utf-8');
    const parts = decoded.split(':');
    if (parts.length < 5) {
      throw new Error('Formato de firma inválido');
    }
    const [sessionId, employeeId, latitude, longitude, timestamp] = parts;
    return { sessionId, employeeId, latitude, longitude, timestamp };
  };

  const fetchSignatureEmployee = async (employeeId: string) => {
    try {
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) {
        throw new Error('Server URL not configured');
      }

      const response = await authedFetch({
        url: `${apiUrl}/api/empleados/${employeeId}`,
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

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data?.nombre) {
        return `${data.nombre} ${data.primer_apellido || ''} ${data.segundo_apellido || ''}`.trim();
      }
      return null;
    } catch (error) {
      console.error('Error fetching employee info:', error);
      return null;
    }
  };

  const handleSignatureData = async (hash: string) => {
    try {
      setIsProcessingSignature(true);
      const decoded = decodeSignatureHash(hash);
      const fullName = await fetchSignatureEmployee(decoded.employeeId);
      setSignatureData({
        raw: hash,
        sessionId: decoded.sessionId,
        employeeId: decoded.employeeId,
        latitude: decoded.latitude,
        longitude: decoded.longitude,
        timestamp: decoded.timestamp,
        employeeName: fullName || undefined,
      });
      setSignatureEmployeeName(fullName);
    } catch (error) {
      console.error('Error processing signature:', error);
      Alert.alert('Error', 'La firma no tiene el formato esperado.');
    } finally {
      setIsProcessingSignature(false);
    }
  };

  const handleGenerateSignature = async () => {
    try {
      if (!employee?.id) {
        Alert.alert('Error', 'No se encontró información del empleado.');
        return;
      }

      setIsProcessingSignature(true);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permisos', 'Debes otorgar permiso de ubicación para generar la firma.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const horaAccion = await getHoraAccion();
      if (!horaAccion) {
        throw new Error('No se pudo obtener la hora actual');
      }
      const storedToken = await getValidAccessTokenOrLogout({ refreshAccessToken, logout });
      if (!storedToken) return;

      const decodedToken = jwtDecode(storedToken);
      const sessionId = JSON.parse(JSON.stringify(decodedToken)).sessionId;

      const payload = `${sessionId}:${employee.id}:${location.coords.latitude}:${location.coords.longitude}:${horaAccion}`;
      const hash = Buffer.from(payload).toString('base64');
      await handleSignatureData(hash);
      Alert.alert('Éxito', 'Firma generada correctamente.');
    } catch (error) {
      console.error('Error generating signature:', error);
      Alert.alert('Error', 'No se pudo generar la firma. Intenta nuevamente.');
    } finally {
      setIsProcessingSignature(false);
    }
  };

  const handleScanSignature = async () => {
    try {
      const qrData = await scanQR();
      if (!qrData) {
        Alert.alert('Cancelado', 'Se canceló el escaneo de la firma.');
        return;
      }
      await handleSignatureData(qrData);
      Alert.alert('Éxito', 'Firma escaneada correctamente.');
    } catch (error) {
      console.error('Error scanning signature:', error);
      Alert.alert('Error', 'No se pudo procesar el QR de la firma.');
    }
  };

  const queueCreateActivityAction = async (requestData: any) => {
    const actionsStr = await AsyncStorage.getItem('activities_actions');
    const actions = actionsStr ? JSON.parse(actionsStr) : [];
    const actionId = Date.now();
    actions.push({
      id: actionId,
      type: 'create',
      requestData,
    });
    await AsyncStorage.setItem('activities_actions', JSON.stringify(actions));
  };

  const validateCreateActivityForm = () => {
    if (!activityName.trim()) {
      return 'Debes ingresar el nombre de la actividad.';
    }
    if (!activityDescription.trim()) {
      return 'Debes ingresar la descripción de la actividad.';
    }
    if (assignedResponsables.length === 0) {
      return 'Debes asignar al menos un puesto o plaza responsable.';
    }
    if (assignedResponsables.some(r => !r.assignAll && r.plazas.length === 0)) {
      return 'Las asignaciones por puesto deben incluir al menos una plaza o marcarse como puesto completo.';
    }
    if (tipoActividad === 'Inventario') {
      if (articuloRules.length === 0) {
        return 'Agrega al menos un artículo en la sección de reglas.';
      }
      for (const articulo of articuloRules) {
        if (articulo.reglas.length === 0) {
          return `El artículo ${articulo.articuloNombre} debe tener al menos una regla.`;
        }
        for (const regla of articulo.reglas) {
          if (!regla.nombre.trim() || !regla.valor.trim()) {
            return `Completa los campos de nombre y valor para todas las reglas del artículo ${articulo.articuloNombre}.`;
          }
        }
      }
    }
    if (!signatureData?.raw) {
      return 'Debes generar o escanear la firma del responsable.';
    }
    if (!currentMarcaId) {
      return 'No se encontró la marca actual.';
    }
    return null;
  };

  const submitCreateActivity = async () => {
    try {
      setIsSubmittingActivity(true);
      const frequencyConfig = await buildFrequencyConfig();
      const frequencyString = JSON.stringify(frequencyConfig);

      const reglasPayload = articuloRules.map(rule => ({
        id: rule.articuloId,
        reglas: rule.reglas.map(r => ({
          nombre: r.nombre.trim(),
          valor: r.valor.trim(),
        })),
      }));

      const puestosPayload = assignedResponsables.map(responsable => ({
        puesto_id: responsable.puestoId,
        plazas: responsable.assignAll
          ? []
          : responsable.plazas.map(plaza => ({
            plaza_id: plaza.plazaId,
          })),
      }));

      const fechaInicioStr = formatDateForApi(activityStartDate);
      const fechaFinValue =
        endType === 'date' && endDate
          ? endDate
          : null;

      const requestData = {
        marca_id: currentMarcaId,
        nombre_actividad: activityName.trim(),
        fecha_inicio: fechaInicioStr,
        fecha_fin: fechaFinValue,
        frecuencia: frequencyString,
        es_revision_equipo: tipoActividad === 'Inventario',
        descripcion_actividad: activityDescription.trim(),
        reglas: JSON.stringify(reglasPayload),
        puestos_plazas: JSON.stringify(puestosPayload),
        firma_responsable: signatureData?.raw || '',
      };

      const isConnected = await getConnectionStatus();
      if (!isConnected) {
        Alert.alert(
          'Sin conexión',
          'La creación y edición de actividades solo está disponible con conexión a internet.'
        );
        return;
      }

      const response = isEditingCreatedActivity && editingCreatedActivityId
        ? await updateCreatedActivity({
            activityId: editingCreatedActivityId,
            requestData: {
              ...requestData,
              puestos_ids: Array.from(new Set(assignedResponsables.map((r) => r.puestoId))),
            },
            refreshAccessToken,
            logout,
          })
        : await createActivity({
            requestData,
            refreshAccessToken,
            logout,
          });

      if (response.status) {
        Alert.alert('Éxito', isEditingCreatedActivity ? 'La actividad se actualizó correctamente.' : 'La actividad se creó correctamente.');
        closeRepetitionModal();
        await fetchActivities();
        if (selectedPuestoFilterId) {
          await fetchCreatedActivitiesByPuesto(selectedPuestoFilterId);
        }
        eventBus.emit('activitiesUpdated');
      } else {
        Alert.alert('Error', response.message || 'No se pudo guardar la actividad.');
      }
    } catch (error) {
      console.error('Error creating activity:', error);
      Alert.alert('Error', 'No se pudo crear la actividad. Intenta nuevamente.');
    } finally {
      setIsSubmittingActivity(false);
    }
  };

  const handleConfirmCreateActivity = () => {
    const validationError = validateCreateActivityForm();
    if (validationError) {
      Alert.alert('Validación', validationError);
      return;
    }

    const selectedPuestosCount = Array.from(new Set(assignedResponsables.map((r) => r.puestoId))).length;
    const confirmationMessage = selectedPuestosCount > 100
      ? `Se seleccionaron ${selectedPuestosCount} puestos. El proceso puede tardar un tiempo. ¿Deseas continuar?`
      : (isEditingCreatedActivity ? '¿Deseas actualizar esta actividad?' : '¿Deseas crear esta actividad?');

    Alert.alert(
      'Confirmar',
      confirmationMessage,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: isEditingCreatedActivity ? 'Actualizar' : 'Crear', onPress: submitCreateActivity },
      ],
      { cancelable: false }
    );
  };

  const buildFrequencyConfig = async () => {
    const horaAccion = await getHoraAccion();
    if (!horaAccion) {
      throw new Error('No se pudo obtener la hora de acción');
    }
    const baseDate = activityStartDate || new Date(String(horaAccion));
    const currentWeekday = baseDate.getDay();
    const currentDay = baseDate.getDate();
    const currentMonth = baseDate.getMonth() + 1;

    const config: any = {
      type: repetitionType,
      interval: 1,
    };

    if (repetitionType === 'weekly') {
      config.weekday = currentWeekday;
    } else if (repetitionType === 'monthly-weekday') {
      config.weekday = currentWeekday;
      config.weekOrdinal = getWeekOrdinal(baseDate);
    } else if (repetitionType === 'monthly-last') {
      config.weekday = currentWeekday;
      config.weekOrdinal = 5;
    } else if (repetitionType === 'yearly') {
      config.day = currentDay;
      config.month = currentMonth;
    }

    if (repetitionType === 'custom') {
      const intervalNumber = parseInt(customInterval || '1', 10) || 1;
      config.interval = intervalNumber;
      config.unit = customUnit;

      if (customUnit === 'week') {
        if (selectedWeekdays.length > 0) {
          config.weekdays = selectedWeekdays;
        }
      } else if (customUnit === 'month') {
        config.monthOption = monthOption;
        if (monthOption === 'day-of-month') {
          config.day = currentDay;
        } else {
          config.weekday = currentWeekday;
          config.weekOrdinal = getWeekOrdinal(baseDate);
        }
      } else if (customUnit === 'year') {
        const monthNumber = parseInt(yearMonth || `${currentMonth}`, 10) || currentMonth;
        const dayNumber = parseInt(yearDay || `${currentDay}`, 10) || currentDay;
        config.month = monthNumber;
        config.day = dayNumber;
      }
    }

    config.endType = endType;
    if (endType === 'date' && endDate) {
      config.endDate = endDate;
    }

    config.title = generateRepetitionTitle(config, repetitionType);
    return config;
  };

  const handleEndDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowEndDatePicker(false);
    }
    if (selectedDate) {
      // Formatear la fecha a AAAA-MM-DD
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const formattedDate = `${year}-${month}-${day}`;
      setEndDate(formattedDate);
    }
  };

  // Handle menu press from header
  const handleMenuPress = () => {
    setIsMenuVisible(true);
  };

  // Handle menu close
  const handleMenuClose = () => {
    setIsMenuVisible(false);
  };

  // Handle back navigation
  const handleBack = () => {
    navigation.goBack();
  };

  // Handle home navigation from slide menu
  const handleHomePress = () => {
    navigation.navigate('Home');
  };

  const openCameraForActivity = async () => {
    if (!permission) {
      const permissionResult = await requestPermission();
      if (!permissionResult.granted) {
        Alert.alert('Error', 'Se necesita permiso para acceder a la cámara');
        return;
      }
    }

    if (!permission?.granted) {
      const permissionResult = await requestPermission();
      if (!permissionResult.granted) {
        Alert.alert('Error', 'Se necesita permiso para acceder a la cámara');
        return;
      }
    }

    setCameraTarget('activity');
    setIsCameraVisible(true);
  };

  const openCameraForInventory = async (inventoryId: number) => {
    if (!permission) {
      const permissionResult = await requestPermission();
      if (!permissionResult.granted) {
        Alert.alert('Error', 'Se necesita permiso para acceder a la cámara');
        return;
      }
    }

    if (!permission?.granted) {
      const permissionResult = await requestPermission();
      if (!permissionResult.granted) {
        Alert.alert('Error', 'Se necesita permiso para acceder a la cámara');
        return;
      }
    }

    setCameraTarget('inventory');
    setTargetInventoryId(inventoryId);
    setIsCameraVisible(true);
  };

  const takePicture = async () => {
    if (!cameraRef.current) {
      Alert.alert('Error', 'Cámara no disponible');
      return;
    }

    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.7,
        skipProcessing: false
      });

      if (!photo) {
        Alert.alert('Error', 'No se pudo capturar la foto. Por favor intente nuevamente.');
        setIsCameraVisible(false);
        return;
      }

      if (!photo.base64) {
        Alert.alert('Error', 'No se pudo procesar la imagen. Por favor intente nuevamente.');
        setIsCameraVisible(false);
        return;
      }

      setIsCameraVisible(false);

      // Format base64 with data URI prefix
      const formattedBase64 = `data:image/jpeg;base64,${photo.base64!}`;

      setTimeout(() => {
        if (cameraTarget === 'activity') {
          setActivityImageBase64(formattedBase64);
        } else if (cameraTarget === 'inventory' && targetInventoryId !== null) {
          setInventoryImages(prev => ({
            ...prev,
            [targetInventoryId]: formattedBase64
          }));
        }
      }, 100);
    } catch (error) {
      console.error('Error capturing image:', error);
      Alert.alert('Error', 'No se pudo capturar la imagen');
      setIsCameraVisible(false);
    }
  };

  const toggleActivity = (activity: Actividad) => {
    if (activity.is_marcada) return;
    setSelectedActivity(activity);
    setBitacoraText('');
    setActivityImageBase64(null);
    setIsBitacoraModalVisible(true);
  };

  const executeToggleActivity = async (activity: Actividad, estado: 'marcar' | 'desmarcar', bitacora: string | null, imageBase64: string | null) => {
    if (!employee?.id) {
      Alert.alert('Error', 'No se encontró la información necesaria del empleado.');
      return;
    }

    if (estado === 'marcar' && activity.is_revision_equipo && activity.inventario?.length) {
      for (const inv of activity.inventario) {
        const form = getArticleFormState(activity.id, inv);
        if (form.estado !== 'Bueno' && (!form.observaciones || !form.observaciones.trim())) {
          Alert.alert('Observaciones requeridas', `El artículo "${inv.nombre}" tiene estado "${form.estado}". Ingresa observaciones antes de marcar la actividad.`);
          return;
        }
      }
    }

    const isConnected = await getConnectionStatus();

    const requestData: any = {
      e: parseInt(employee.id),
      estado: estado,
      bitacora: bitacora || '-',
    };

    // Add image if captured (already formatted as data:image/jpeg;base64,...)
    if (imageBase64) {
      requestData.file = imageBase64;
    } else {
      requestData.file = null;
    }

    if (isConnected) {
      // Online: call API
      try {
        const { updateActivity } = await import('@/hooks/activitiesFunctions');
        const result = await updateActivity({
          requestData,
          activityId: activity.id,
          refreshAccessToken,
          logout,
        });

        if (result.status) {
          if (estado === 'marcar' && activity.is_revision_equipo && activity.inventario?.length && employee?.id) {
            const { updateRevisionEquipo } = await import('@/hooks/activitiesFunctions');
            for (const inv of activity.inventario) {
              const form = getArticleFormState(activity.id, inv);
              const revisionEquipoId = inv.revision_equipo?.id;
              if (!revisionEquipoId) continue;
              const requestData: any = {
                e: parseInt(employee.id),
                articulo_id: inv.id,
                es_correcto: form.estado === 'Bueno',
                motivo_incorrecto: form.estado === 'Bueno' ? '-' : (form.observaciones.trim() || '-'),
                estado: form.estado,
                cantidad_real: form.cantidadReal,
              };
              const img = inventoryImages[inv.id];
              requestData.file = img ?? null;
              try {
                await updateRevisionEquipo({
                  requestData,
                  revisionEquipoId,
                  refreshAccessToken,
                  logout,
                });
              } catch (e) {
                console.error('Error actualizando artículo revisión:', e);
              }
            }
          }
          Alert.alert('Éxito', result.message);
          await fetchActivities();
        } else {
          Alert.alert('Error', result.message);
        }
      } catch (err) {
        console.error('Error toggling activity:', err);
        Alert.alert('Error', 'No se pudo actualizar el estado de la actividad');
      }
    } else {
      // Offline: queue action and update cache
      try {
        const actionsStr = await AsyncStorage.getItem('activities_actions');
        let actions = actionsStr ? JSON.parse(actionsStr) : [];

        // Check if there's already an action for this activity
        const existingActionIndex = actions.findIndex(
          (action: any) => action.activity_id === activity.id && action.type === 'update'
        );

        const horaAccion = await getHoraAccion();

        if (existingActionIndex !== -1) {
          // Replace existing action with new one (including new bitacora and image)
          actions[existingActionIndex] = {
            type: 'update',
            activity_id: activity.id,
            requestData,
            timestamp: horaAccion,
          };
          Alert.alert('Acción actualizada', 'La acción se sincronizará cuando recuperes la conexión.');
        } else {
          // Add new action
          actions.push({
            type: 'update',
            activity_id: activity.id,
            requestData,
            timestamp: horaAccion,
          });
          Alert.alert('Guardado offline', 'La acción se sincronizará cuando recuperes la conexión.');
        }

        // Si es revisión de equipo, también encolar el estado de los artículos
        if (estado === 'marcar' && activity.is_revision_equipo && activity.inventario?.length && employee?.id) {
          for (const inv of activity.inventario) {
            const form = getArticleFormState(activity.id, inv);
            const revisionEquipoId = inv.revision_equipo?.id;
            if (!revisionEquipoId) continue;

            const req: any = {
              e: parseInt(employee.id),
              articulo_id: inv.id,
              es_correcto: form.estado === 'Bueno',
              motivo_incorrecto: form.estado === 'Bueno' ? '-' : (form.observaciones.trim() || '-'),
              estado: form.estado,
              cantidad_real: form.cantidadReal,
            };
            const img = inventoryImages[inv.id];
            req.file = img ?? null;

            const existingEquipIndex = actions.findIndex(
              (a: any) =>
                a.type === 'update-equipo' &&
                a.revisionEquipo_id === revisionEquipoId &&
                a.inventory_id === inv.id
            );

            const newAction = {
              type: 'update-equipo',
              revisionEquipo_id: revisionEquipoId,
              activity_id: activity.id,
              inventory_id: inv.id,
              requestData: req,
              timestamp: horaAccion,
            };

            if (existingEquipIndex !== -1) {
              actions[existingEquipIndex] = newAction;
            } else {
              actions.push(newAction);
            }
          }
        }

        await AsyncStorage.setItem('activities_actions', JSON.stringify(actions));

        // Update cache
        const cachedActivities = await AsyncStorage.getItem('activities_cache');
        if (cachedActivities) {
          let activities = JSON.parse(cachedActivities);
          const activityIndex = activities.findIndex((a: Actividad) => a.id === activity.id);

          if (activityIndex !== -1) {
            // Apply the change (marcar o dejar marcada)
            activities[activityIndex].is_marcada = estado === 'marcar';

            await AsyncStorage.setItem('activities_cache', JSON.stringify(activities));
          }
        }

        // Reload activities list after offline update
        await fetchActivities();
      } catch (error) {
        console.error('Error en modo offline:', error);
        Alert.alert('Error', 'No se pudo guardar la acción offline');
      }
    }
  };

  const handleBitacoraConfirm = () => {
    if (!selectedActivity) return;

    setIsBitacoraModalVisible(false);
    const bitacora = bitacoraText.trim() || "-";
    executeToggleActivity(selectedActivity, 'marcar', bitacora, activityImageBase64);
    setSelectedActivity(null);
    setBitacoraText('');
    setActivityImageBase64(null);
  };

  const handleBitacoraCancel = () => {
    setIsBitacoraModalVisible(false);
    setSelectedActivity(null);
    setBitacoraText('');
    setActivityImageBase64(null);
  };

  const renderActivityItem = (activity: Actividad) => {
    return (
      <ActivityItemComponent
        key={activity.id}
        activity={activity}
        employee={employee}
        refreshAccessToken={refreshAccessToken}
        logout={logout}
        fetchActivities={fetchActivities}
        getActionIcon={getActionIcon}
        getConnectionStatus={getConnectionStatus}
        openCameraForInventory={openCameraForInventory}
        inventoryImages={inventoryImages}
        toggleActivity={toggleActivity}
        onGoToEntregaPuestos={() => navigation.navigate('EntregaPuestos')}
        onClearInventoryImage={(inventoryId) => {
          setInventoryImages((prev: { [key: number]: string }) => {
            const updated = { ...prev };
            delete updated[inventoryId];
            return updated;
          });
        }}
        getArticleFormState={getArticleFormState}
        setArticleFormState={setArticleFormStateCallback}
      />
    );
  };

  const empresasOptions = structure;
  const selectedEmpresa = empresasOptions.find((e) => e.id === selectedEmpresaId) || null;
  const clientesOptions = selectedEmpresa?.clientes || [];
  const selectedCliente = clientesOptions.find((c) => c.id === selectedClienteId) || null;
  const divisionesOptions = selectedCliente?.division || [];
  const selectedDivision = divisionesOptions.find((d) => d.id === selectedDivisionId) || null;
  const contratosOptions = selectedDivision?.contratos || [];
  const selectedContrato = contratosOptions.find((c) => c.id === selectedContratoId) || null;
  const sucursalesOptions = selectedContrato?.sucursales || [];
  const selectedSucursal = sucursalesOptions.find((s) => s.id === selectedSucursalId) || null;
  const puestosOptionsFromHierarchy = selectedSucursal?.puestos || [];
  const filteredPuestos = selectedPuestoFilterId
    ? puestosOptionsFromHierarchy.filter((p) => p.id === selectedPuestoFilterId)
    : puestosOptionsFromHierarchy;

  const getDivisionPuestos = useCallback((divisionId: number) => {
    for (const empresa of structure) {
      for (const cliente of empresa.clientes || []) {
        for (const division of cliente.division || []) {
          if (division.id !== divisionId) continue;
          return (division.contratos || [])
            .flatMap((contrato) => contrato.sucursales || [])
            .flatMap((sucursal) => sucursal.puestos || []);
        }
      }
    }
    return [];
  }, [structure]);

  const effectivePuestos = assignToAllDivision && selectedDivisionForAll
    ? getDivisionPuestos(selectedDivisionForAll)
    : filteredPuestos;

  const handleConfirmPuestosSelection = () => {
    const uniquePuestosCount = Array.from(new Set(effectivePuestos.map((p) => p.id))).length;
    if (uniquePuestosCount === 0) {
      Alert.alert('Validación', 'Selecciona una jerarquía válida para obtener puestos.');
      return;
    }
    if (uniquePuestosCount > 100) {
      Alert.alert(
        'Confirmación',
        `Se seleccionarán ${uniquePuestosCount} puestos. Este proceso puede tardar más de lo normal.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Confirmar',
            style: 'default',
            onPress: () => {
              setAssignedResponsables(
                effectivePuestos.map((puesto) => ({
                  puestoId: puesto.id,
                  puestoNombre: puesto.nombre,
                  assignAll: true,
                  plazas: [],
                }))
              );
            },
          },
        ]
      );
      return;
    }
    setAssignedResponsables(
      effectivePuestos.map((puesto) => ({
        puestoId: puesto.id,
        puestoNombre: puesto.nombre,
        assignAll: true,
        plazas: [],
      }))
    );
    Alert.alert('Listo', `Se utilizarán ${uniquePuestosCount} puestos en el formulario.`);
  };

  const fetchCreatedActivitiesByPuesto = useCallback(async (puestoId: number) => {
    try {
      const isConnected = await getConnectionStatus();
      if (!isConnected) {
        Alert.alert('Sin conexión', 'Este submódulo funciona exclusivamente con internet.');
        return;
      }
      setIsLoadingCreatedActivities(true);
      const data = await listCreatedActivitiesByPuesto({ puestoId, refreshAccessToken, logout });
      if (data.status) {
        setCreatedActivities(Array.isArray(data.actividades) ? data.actividades : []);
      } else {
        Alert.alert('Error', data.message || 'No se pudo cargar la lista de actividades creadas.');
      }
    } finally {
      setIsLoadingCreatedActivities(false);
    }
  }, [getConnectionStatus, logout, refreshAccessToken]);

  const handleDeleteCreatedActivity = async (activityId: number) => {
    const isConnected = await getConnectionStatus();
    if (!isConnected) {
      Alert.alert('Sin conexión', 'Este submódulo funciona exclusivamente con internet.');
      return;
    }
    Alert.alert('Eliminar actividad', '¿Deseas eliminar esta actividad?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          const response = await deleteCreatedActivity({ activityId, refreshAccessToken, logout });
          if (!response.status) {
            Alert.alert('Error', response.message || 'No se pudo eliminar la actividad.');
            return;
          }
          if (selectedPuestoFilterId) {
            await fetchCreatedActivitiesByPuesto(selectedPuestoFilterId);
          }
        },
      },
    ]);
  };

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

  const formatFrequencyForDisplay = (rawValue: any): string => {
    let parsed: any = rawValue;
    if (typeof rawValue === 'string') {
      try {
        parsed = JSON.parse(rawValue);
      } catch {
        return rawValue;
      }
    }
    if (!parsed || typeof parsed !== 'object') return String(rawValue ?? '-');

    const labels: Record<string, string> = {
      title: 'Título',
      type: 'Tipo',
      interval: 'Intervalo',
      unit: 'Unidad',
      weekday: 'Día de semana',
      weekdays: 'Días seleccionados',
      weekOrdinal: 'Ordinal semanal',
      monthOption: 'Opción mensual',
      month: 'Mes',
      day: 'Día',
      endType: 'Finalización',
      endDate: 'Fecha de finalización',
    };
    const orderedKeys = [
      'title', 'type', 'interval', 'unit', 'weekday', 'weekdays',
      'weekOrdinal', 'monthOption', 'month', 'day', 'endType', 'endDate',
    ];

    const lines: string[] = [];
    for (const key of orderedKeys) {
      if (parsed[key] === undefined || parsed[key] === null || parsed[key] === '') continue;
      const value = Array.isArray(parsed[key]) ? parsed[key].join(', ') : String(parsed[key]);
      lines.push(`${labels[key] || key}: ${value}`);
    }

    for (const [key, value] of Object.entries(parsed)) {
      if (orderedKeys.includes(key)) continue;
      lines.push(`${labels[key] || key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`);
    }

    return lines.join('\n') || '-';
  };

  const formatDigitalSignatureForDisplay = (rawValue: any): string => {
    if (!rawValue) return '-';
    if (typeof rawValue !== 'string') return String(rawValue);
    try {
      const decoded = decodeSignatureHash(rawValue);
      return [
        `Sesión: ${decoded.sessionId || 'N/A'}`,
        `Empleado: ${decoded.employeeId || 'N/A'}`,
        `Latitud: ${decoded.latitude || 'N/A'}`,
        `Longitud: ${decoded.longitude || 'N/A'}`,
        `Hora: ${decoded.timestamp ? generateDateTime(decoded.timestamp) : 'N/A'}`,
      ].join('\n');
    } catch {
      return 'Firma digital (formato no decodificable)';
    }
  };

  const formatChangeValue = (prop: string, value: any): string => {
    if (value === null || value === undefined) return '-';
    if (prop === 'frecuencia') return formatFrequencyForDisplay(value);
    if (prop === 'firma_responsable') return formatDigitalSignatureForDisplay(value);

    if (typeof value === 'string') {
      if (value.trim().startsWith('{') || value.trim().startsWith('[')) {
        try {
          const parsed = JSON.parse(value);
          if (prop === 'frecuencia') return formatFrequencyForDisplay(parsed);
          if (typeof parsed === 'object') return JSON.stringify(parsed, null, 2);
        } catch {
          return value;
        }
      }
      return value;
    }

    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  const handleViewCreatedActivityChanges = async (activityId: number) => {
    try {
      const isConnected = await getConnectionStatus();
      if (!isConnected) {
        Alert.alert('Sin conexión', 'Este submódulo funciona exclusivamente con internet.');
        return;
      }
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) {
        Alert.alert('Error', 'No se encontró la URL del servidor.');
        return;
      }
      const response = await authedFetch({
        url: `${apiUrl}/api/cambios-apps-modules?tabla=e_actividades&registro_id=${activityId}`,
        init: { method: 'GET' },
        refreshAccessToken,
        logout,
      });
      if (!response) return;
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.status) {
        throw new Error(data.message || 'No se pudieron cargar los cambios');
      }
      const items = Array.isArray(data.data) ? data.data : [];
      setCambiosItems(items);
      setCambiosTitle(`Cambios - Actividad #${activityId}`);
      setIsCambiosModalVisible(true);
    } catch (error: any) {
      console.error('Error loading activity changes:', error);
      Alert.alert('Error', error?.message || 'No se pudo consultar el registro de cambios.');
    }
  };

  const startEditCreatedActivity = (activity: CreatedActivityItem) => {
    setEditingCreatedActivityId(activity.id);
    setIsEditingCreatedActivity(true);
    setActivityName(activity.nombre_actividad || '');
    setActivityDescription(activity.descripcion_actividad || '');
    setActivityStartDate(activity.fecha_inicio ? new Date(activity.fecha_inicio) : new Date());
    setEndType('date');
    setEndDate(activity.fecha_fin ? formatDateForApi(new Date(activity.fecha_fin)) : formatDateForApi(new Date()));
    setTipoActividad(activity.es_revision_equipo ? 'Inventario' : 'Normal');
    try {
      const decoded = decodeSignatureHash(activity.firma_responsable || '');
      setSignatureData({
        raw: activity.firma_responsable || '',
        sessionId: decoded.sessionId,
        employeeId: decoded.employeeId,
        latitude: decoded.latitude,
        longitude: decoded.longitude,
        timestamp: decoded.timestamp,
      });
    } catch {
      setSignatureData(null);
    }
    setIsCreateActivityVisible(true);
    setModuleStep('form');
  };

  const selectedPuesto = selectedPuestoId ? effectivePuestos.find(p => p.id === parseInt(selectedPuestoId, 10)) : null;
  const selectedPuestoEntry = selectedPuesto ? assignedResponsables.find(r => r.puestoId === selectedPuesto.id) : null;
  const selectedPuestoPlazas = selectedPuesto?.plazas || [];
  const canAssignEntirePuesto = Boolean(selectedPuesto && !selectedPuestoEntry);

  const resetHierarchyBelowEmpresa = () => {
    setSelectedClienteId(null);
    setSelectedDivisionId(null);
    setSelectedContratoId(null);
    setSelectedSucursalId(null);
    setSelectedPuestoFilterId(null);
    setCreatedActivities([]);
  };

  const resetHierarchyBelowCliente = () => {
    setSelectedDivisionId(null);
    setSelectedContratoId(null);
    setSelectedSucursalId(null);
    setSelectedPuestoFilterId(null);
    setCreatedActivities([]);
  };

  const resetHierarchyBelowDivision = () => {
    setSelectedContratoId(null);
    setSelectedSucursalId(null);
    setSelectedPuestoFilterId(null);
    setCreatedActivities([]);
  };

  const resetHierarchyBelowContrato = () => {
    setSelectedSucursalId(null);
    setSelectedPuestoFilterId(null);
    setCreatedActivities([]);
  };

  const resetHierarchyBelowSucursal = () => {
    setSelectedPuestoFilterId(null);
    setCreatedActivities([]);
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader onMenuPress={handleMenuPress} title="Actividades" />
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando actividades...</ThemedText>
        </ThemedView>
        <AppFooter />
        <SlideMenu
          isVisible={isMenuVisible}
          onClose={handleMenuClose}
          onHomePress={handleHomePress}
          currentRoute="Activities"
        />
      </ThemedView>
    );
  }

  // Si no hay marca registrada, mostrar mensaje
  if (!hasCurrentMarca) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader onMenuPress={handleMenuPress} title="Actividades" />
        <ThemedView style={styles.noMarcaContainer}>
          <Ionicons name="alert-circle-outline" size={80} color="#FF9500" />
          <ThemedText style={styles.noMarcaTitle}>No hay marca registrada</ThemedText>
          <ThemedText style={styles.noMarcaMessage}>
            Debes registrar una marca de ingreso antes de acceder a las actividades.
          </ThemedText>
          <TouchableOpacity
            style={styles.goBackButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={20} color="#000000" />
            <ThemedText style={styles.goBackButtonText}>Volver</ThemedText>
          </TouchableOpacity>
        </ThemedView>
        <AppFooter />
        <SlideMenu
          isVisible={isMenuVisible}
          onClose={handleMenuClose}
          onHomePress={handleHomePress}
          currentRoute="Activities"
        />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={handleMenuPress} title="Actividades" />
      {!!error && (
        <ThemedView style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={18} color="#B00020" />
          <ThemedText style={styles.errorBannerText}>{error}</ThemedText>
        </ThemedView>
      )}
      {!!offlineMessage && !error && (
        <ThemedView style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={18} color="#8A6D00" />
          <ThemedText style={styles.offlineBannerText}>{offlineMessage}</ThemedText>
        </ThemedView>
      )}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <ThemedView style={styles.contentContainer}>

          {/* Module Title */}
          <ThemedView style={styles.titleContainer}>
            <ThemedText type="title" style={styles.title}>
              {getActionIcon('activities')} Actividades
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              {moduleStep === 'assigned'
                ? 'Actividades asignadas'
                : moduleStep === 'created'
                  ? 'Actividades creadas'
                  : 'Formulario de actividad'}
            </ThemedText>
          </ThemedView>

          {moduleStep === 'assigned' && role !== 'OPERATIVO' && (
            <TouchableOpacity
              style={styles.createButton}
              onPress={async () => {
                const isConnected = await getConnectionStatus();
                if (!isConnected) {
                  Alert.alert('Sin conexión', 'Este submódulo funciona exclusivamente con internet.');
                  return;
                }
                await loadMainStructureCache();
                setModuleStep('created');
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          )}

          {/* Activities List */}
          {moduleStep === 'assigned' && (
            <ThemedView style={styles.activitiesContainer}>
              {error ? (
                <ThemedView style={styles.errorContainer}>
                  <ThemedText style={styles.errorText}>{error}</ThemedText>
                  <TouchableOpacity
                    style={styles.retryButton}
                    onPress={fetchActivities}
                  >
                    <ThemedText style={styles.retryButtonText}>Reintentar</ThemedText>
                  </TouchableOpacity>
                </ThemedView>
              ) : activities.length === 0 ? (
                <ThemedView style={styles.emptyContainer}>
                  <ThemedText style={styles.emptyText}>
                    No hay actividades asignadas
                  </ThemedText>
                </ThemedView>
              ) : (
                activities.map(activity => renderActivityItem(activity))
              )}
            </ThemedView>
          )}

          {moduleStep === 'created' && (
            <ThemedView style={styles.repetitionModalContainer}>
              <TouchableOpacity style={styles.secondaryButtonOutline} onPress={() => setModuleStep('assigned')}>
                <Ionicons name="arrow-back" size={18} color="#007AFF" />
                <ThemedText style={styles.secondaryButtonOutlineText}>Volver a asignadas</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.createButton, { marginTop: 10 }]} onPress={openRepetitionModal}>
                <Ionicons name="add" size={20} color="#fff" />
              </TouchableOpacity>

              <ThemedView style={styles.sectionCard}>
                {isStructureLoading ? (
                  <ActivityIndicator size="small" color="#007AFF" />
                ) : (
                  <>
                    <ThemedText style={styles.formLabel}>Empresa</ThemedText>
                    <ThemedView style={styles.pickerContainer}>
                      <Picker
                        selectedValue={selectedEmpresaId ? String(selectedEmpresaId) : ''}
                        onValueChange={(v) => { setSelectedEmpresaId(v ? Number(v) : null); resetHierarchyBelowEmpresa(); }}
                        style={styles.picker}
                      >
                        <Picker.Item label="Selecciona empresa" value="" />
                        {empresasOptions.map((empresa) => (
                          <Picker.Item key={empresa.id} label={empresa.nombre} value={String(empresa.id)} />
                        ))}
                      </Picker>
                    </ThemedView>

                    {selectedEmpresaId && (
                      <>
                        <ThemedText style={styles.formLabel}>Cliente</ThemedText>
                        <ThemedView style={styles.pickerContainer}>
                          <Picker
                            selectedValue={selectedClienteId ? String(selectedClienteId) : ''}
                            onValueChange={(v) => { setSelectedClienteId(v ? Number(v) : null); resetHierarchyBelowCliente(); }}
                            style={styles.picker}
                          >
                            <Picker.Item label="Selecciona cliente" value="" />
                            {clientesOptions.map((cliente) => (
                              <Picker.Item key={cliente.id} label={cliente.nombre} value={String(cliente.id)} />
                            ))}
                          </Picker>
                        </ThemedView>
                      </>
                    )}

                    {selectedClienteId && (
                      <>
                        <ThemedText style={styles.formLabel}>División</ThemedText>
                        <ThemedView style={styles.pickerContainer}>
                          <Picker
                            selectedValue={selectedDivisionId ? String(selectedDivisionId) : ''}
                            onValueChange={(v) => { setSelectedDivisionId(v ? Number(v) : null); resetHierarchyBelowDivision(); }}
                            style={styles.picker}
                          >
                            <Picker.Item label="Selecciona división" value="" />
                            {divisionesOptions.map((division) => (
                              <Picker.Item key={division.id} label={division.nombre} value={String(division.id)} />
                            ))}
                          </Picker>
                        </ThemedView>
                      </>
                    )}

                    {selectedDivisionId && (
                      <>
                        <ThemedText style={styles.formLabel}>Contrato</ThemedText>
                        <ThemedView style={styles.pickerContainer}>
                          <Picker
                            selectedValue={selectedContratoId ? String(selectedContratoId) : ''}
                            onValueChange={(v) => { setSelectedContratoId(v ? Number(v) : null); resetHierarchyBelowContrato(); }}
                            style={styles.picker}
                          >
                            <Picker.Item label="Selecciona contrato" value="" />
                            {contratosOptions.map((contrato) => (
                              <Picker.Item key={contrato.id} label={contrato.nombre} value={String(contrato.id)} />
                            ))}
                          </Picker>
                        </ThemedView>
                      </>
                    )}

                    {selectedContratoId && (
                      <>
                        <ThemedText style={styles.formLabel}>Sucursal</ThemedText>
                        <ThemedView style={styles.pickerContainer}>
                          <Picker
                            selectedValue={selectedSucursalId ? String(selectedSucursalId) : ''}
                            onValueChange={(v) => { setSelectedSucursalId(v ? Number(v) : null); resetHierarchyBelowSucursal(); }}
                            style={styles.picker}
                          >
                            <Picker.Item label="Selecciona sucursal" value="" />
                            {sucursalesOptions.map((sucursal) => (
                              <Picker.Item key={sucursal.id} label={sucursal.nombre} value={String(sucursal.id)} />
                            ))}
                          </Picker>
                        </ThemedView>
                      </>
                    )}

                    {selectedSucursalId && (
                      <>
                        <ThemedText style={styles.formLabel}>Puesto</ThemedText>
                        <ThemedView style={styles.pickerContainer}>
                          <Picker
                            selectedValue={selectedPuestoFilterId ? String(selectedPuestoFilterId) : ''}
                            onValueChange={async (v) => {
                              const next = v ? Number(v) : null;
                              setSelectedPuestoFilterId(next);
                              setCreatedActivities([]);
                              if (next) await fetchCreatedActivitiesByPuesto(next);
                            }}
                            style={styles.picker}
                          >
                            <Picker.Item label="Selecciona puesto" value="" />
                            {puestosOptionsFromHierarchy.map((puesto) => (
                              <Picker.Item key={puesto.id} label={puesto.nombre} value={String(puesto.id)} />
                            ))}
                          </Picker>
                        </ThemedView>
                      </>
                    )}
                  </>
                )}
              </ThemedView>

              {isLoadingCreatedActivities ? (
                <ActivityIndicator size="small" color="#007AFF" />
              ) : createdActivities.length === 0 ? (
                <ThemedText style={styles.helperText}>Selecciona un puesto para cargar actividades creadas.</ThemedText>
              ) : (
                createdActivities.map((item) => (
                  <ThemedView key={item.id} style={styles.assignedItem}>
                    <ThemedText style={styles.assignedTitle}>{item.nombre_actividad}</ThemedText>
                    <ThemedText style={styles.helperText}>{item.descripcion_actividad}</ThemedText>
                    <View style={styles.modalButtons}>
                      <TouchableOpacity
                        style={[styles.editButton, styles.createdActionButton]}
                        onPress={() => startEditCreatedActivity(item)}
                      >
                        <Ionicons name="pencil" size={18} color="#FFFFFF" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.changesButton, styles.createdActionButton]}
                        onPress={() => handleViewCreatedActivityChanges(item.id)}
                      >
                        <Ionicons name="time-outline" size={18} color="#FFFFFF" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.deleteButton, styles.createdActionButton]}
                        onPress={() => handleDeleteCreatedActivity(item.id)}
                      >
                        <Ionicons name="trash" size={18} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  </ThemedView>
                ))
              )}
            </ThemedView>
          )}

          {/* Activity creation form (inline, hides activities list) */}
          {moduleStep === 'form' && isCreateActivityVisible && (
            <ThemedView style={styles.repetitionModalContainer}>
              <ScrollView
                contentContainerStyle={{ paddingBottom: 16 }}
                showsVerticalScrollIndicator={true}
                keyboardShouldPersistTaps="handled"
              >
                <ThemedText style={[styles.modalTitle, { marginBottom: 20 }]}>
                  Configuración de la actividad
                </ThemedText>

                <ThemedText style={styles.formLabel}>Nombre de la actividad</ThemedText>
                <TextInput
                  style={styles.textInput}
                  placeholder="Ingresa el nombre de la actividad"
                  value={activityName}
                  onChangeText={setActivityName}
                />
                <ThemedText style={styles.formLabel}>Descripción de la actividad</ThemedText>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  placeholder="Describe la actividad"
                  multiline
                  value={activityDescription}
                  onChangeText={setActivityDescription}
                />
                <ThemedText style={styles.formLabel}>Fecha de inicio de la actividad</ThemedText>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowStartDatePicker(true)}
                >
                  <ThemedText style={styles.dateButtonText}>
                    {formatDateForDisplay(activityStartDate)}
                  </ThemedText>
                  <Ionicons name="calendar" size={20} color="#007AFF" />
                </TouchableOpacity>
                {showStartDatePicker && (
                  <DateTimePicker
                    value={activityStartDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleStartDateChange}
                  />
                )}

                <ThemedView style={styles.sectionCard}>
                  {catalogError ? (
                    <ThemedText style={styles.formErrorText}>{catalogError}</ThemedText>
                  ) : null}
                  {isLoadingCatalogs ? (
                    <ActivityIndicator size="small" color="#007AFF" />
                  ) : (
                    <>
                      <ThemedText style={styles.formLabel}>Jerarquía para puestos</ThemedText>
                      <ThemedView style={styles.pickerContainer}>
                        <Picker
                          selectedValue={selectedEmpresaId ? String(selectedEmpresaId) : ''}
                          onValueChange={(v) => { setSelectedEmpresaId(v ? Number(v) : null); resetHierarchyBelowEmpresa(); }}
                          style={styles.picker}
                        >
                          <Picker.Item label="Selecciona empresa" value="" />
                          {empresasOptions.map((empresa) => (
                            <Picker.Item key={empresa.id} label={empresa.nombre} value={String(empresa.id)} />
                          ))}
                        </Picker>
                      </ThemedView>
                      {!!selectedEmpresaId && (
                        <ThemedView style={styles.pickerContainer}>
                          <Picker
                            selectedValue={selectedClienteId ? String(selectedClienteId) : ''}
                            onValueChange={(v) => { setSelectedClienteId(v ? Number(v) : null); resetHierarchyBelowCliente(); }}
                            style={styles.picker}
                          >
                            <Picker.Item label="Selecciona cliente" value="" />
                            {clientesOptions.map((cliente) => (
                              <Picker.Item key={cliente.id} label={cliente.nombre} value={String(cliente.id)} />
                            ))}
                          </Picker>
                        </ThemedView>
                      )}
                      {!!selectedClienteId && (
                        <ThemedView style={styles.pickerContainer}>
                          <Picker
                            selectedValue={selectedDivisionId ? String(selectedDivisionId) : ''}
                            onValueChange={(v) => { setSelectedDivisionId(v ? Number(v) : null); resetHierarchyBelowDivision(); }}
                            style={styles.picker}
                          >
                            <Picker.Item label="Selecciona división" value="" />
                            {divisionesOptions.map((division) => (
                              <Picker.Item key={division.id} label={division.nombre} value={String(division.id)} />
                            ))}
                          </Picker>
                        </ThemedView>
                      )}
                      {!!selectedDivisionId && (
                        <>
                          <TouchableOpacity
                            style={styles.secondaryButtonOutline}
                            onPress={() => {
                              setAssignToAllDivision(!assignToAllDivision);
                              setSelectedDivisionForAll(assignToAllDivision ? null : selectedDivisionId);
                            }}
                          >
                            <ThemedText style={styles.secondaryButtonOutlineText}>
                              {assignToAllDivision ? 'Quitar selección de toda la división' : 'Seleccionar todos los puestos de la división'}
                            </ThemedText>
                          </TouchableOpacity>
                          {!assignToAllDivision && (
                            <ThemedView style={styles.pickerContainer}>
                              <Picker
                                selectedValue={selectedContratoId ? String(selectedContratoId) : ''}
                                onValueChange={(v) => { setSelectedContratoId(v ? Number(v) : null); resetHierarchyBelowContrato(); }}
                                style={styles.picker}
                              >
                                <Picker.Item label="Selecciona contrato" value="" />
                                {contratosOptions.map((contrato) => (
                                  <Picker.Item key={contrato.id} label={contrato.nombre} value={String(contrato.id)} />
                                ))}
                              </Picker>
                            </ThemedView>
                          )}
                          {!assignToAllDivision && !!selectedContratoId && (
                            <ThemedView style={styles.pickerContainer}>
                              <Picker
                                selectedValue={selectedSucursalId ? String(selectedSucursalId) : ''}
                                onValueChange={(v) => { setSelectedSucursalId(v ? Number(v) : null); resetHierarchyBelowSucursal(); }}
                                style={styles.picker}
                              >
                                <Picker.Item label="Selecciona sucursal" value="" />
                                {sucursalesOptions.map((sucursal) => (
                                  <Picker.Item key={sucursal.id} label={sucursal.nombre} value={String(sucursal.id)} />
                                ))}
                              </Picker>
                            </ThemedView>
                          )}
                        </>
                      )}
                      <ThemedText style={styles.helperText}>Puestos disponibles: {effectivePuestos.length}</ThemedText>
                      <TouchableOpacity style={styles.secondaryButton} onPress={handleConfirmPuestosSelection}>
                        <ThemedText style={styles.secondaryButtonText}>Confirmar selección de puestos</ThemedText>
                      </TouchableOpacity>

                      <ThemedText style={styles.formLabel}>Puestos</ThemedText>
                      <ThemedView style={styles.pickerContainer}>
                          <Picker
                            selectedValue={selectedPuestoId}
                            onValueChange={handleSelectPuesto}
                            style={styles.picker}
                          >
                            <Picker.Item label="Selecciona un puesto" value="" />
                            {effectivePuestos.map(puesto => (
                              <Picker.Item key={puesto.id} label={puesto.nombre} value={String(puesto.id)} />
                            ))}
                          </Picker>
                      </ThemedView>

                      {selectedPuesto && (
                        <>
                          <ThemedText style={styles.formLabel}>Plazas</ThemedText>
                          {selectedPuestoEntry?.assignAll ? (
                            <ThemedText style={styles.helperText}>
                              Este puesto ya se asignó completo. Elimina la asignación para seleccionar plazas específicas.
                            </ThemedText>
                          ) : selectedPuestoPlazas.length === 0 ? (
                            <ThemedText style={styles.helperText}>
                              Este puesto no tiene plazas configuradas.
                            </ThemedText>
                          ) : (
                            <>
                              <ThemedView style={styles.plazaListContainer}>
                                {selectedPuestoPlazas.map((plaza, index) => {
                                  const plazaIdStr = String(plaza.id);
                                  const isChecked = markedPlazaIds.includes(plazaIdStr);
                                  const employeesLabel = plaza.empleados && plaza.empleados.length > 0
                                    ? plaza.empleados.map(emp => emp.nombre).join(', ')
                                    : 'Sin empleados asignados';
                                  const isLast = index === selectedPuestoPlazas.length - 1;
                                  return (
                                    <TouchableOpacity
                                      key={plaza.id}
                                      style={[
                                        styles.plazaListItem,
                                        isChecked && styles.plazaListItemSelected,
                                        isLast && styles.plazaListItemLast,
                                      ]}
                                      onPress={() => togglePlazaSelection(plazaIdStr)}
                                      activeOpacity={0.8}
                                    >
                                      <View style={[styles.plazaCheckbox, isChecked && styles.plazaCheckboxChecked]}>
                                        {isChecked && <Ionicons name="checkmark" size={14} color="#fff" />}
                                      </View>
                                      <View style={styles.plazaInfo}>
                                        <ThemedText style={styles.plazaName}>{plaza.nombre}</ThemedText>
                                        <ThemedText
                                          style={
                                            plaza.empleados && plaza.empleados.length > 0
                                              ? styles.plazaEmployees
                                              : styles.plazaEmployeesEmpty
                                          }
                                        >
                                          {employeesLabel}
                                        </ThemedText>
                                      </View>
                                    </TouchableOpacity>
                                  );
                                })}
                              </ThemedView>
                              <TouchableOpacity
                                style={[
                                  styles.secondaryButton,
                                  (markedPlazaIds.length === 0) && styles.secondaryButtonDisabled,
                                ]}
                                onPress={handleAddSelectedPlazas}
                                disabled={markedPlazaIds.length === 0}
                              >
                                <Ionicons name="add-circle" size={18} color="#fff" />
                                <ThemedText style={styles.secondaryButtonText}>Agregar plaza</ThemedText>
                              </TouchableOpacity>
                            </>
                          )}

                          {canAssignEntirePuesto && (
                            <TouchableOpacity
                              style={styles.secondaryButtonOutline}
                              onPress={handleAssignPuestoCompleto}
                            >
                              <Ionicons name="people-circle-outline" size={18} color="#007AFF" />
                              <ThemedText style={styles.secondaryButtonOutlineText}>
                                Asignar a todo el puesto
                              </ThemedText>
                            </TouchableOpacity>
                          )}
                        </>
                      )}

                      <ThemedView style={styles.assignedList}>
                        {assignedResponsables.length === 0 ? (
                          <ThemedText style={styles.helperText}>
                            Aún no has asignado plazas o puestos completos.
                          </ThemedText>
                        ) : (
                          assignedResponsables.map(responsable => (
                            <ThemedView key={responsable.puestoId} style={styles.assignedItem}>
                              <View style={styles.assignedHeader}>
                                <ThemedText style={styles.assignedTitle}>{responsable.puestoNombre}</ThemedText>
                                <TouchableOpacity
                                  style={styles.removeButton}
                                  onPress={() => handleRemovePuesto(responsable.puestoId)}
                                >
                                  <Ionicons name="trash" size={18} color="#FF3B30" />
                                </TouchableOpacity>
                              </View>
                              {responsable.assignAll ? (
                                <ThemedText style={styles.helperText}>
                                  Actividad asignada a todo el puesto.
                                </ThemedText>
                              ) : (
                                responsable.plazas.map(plaza => (
                                  <View key={plaza.plazaId} style={styles.plazaChip}>
                                    <ThemedText style={styles.plazaChipText}>{plaza.plazaNombre}</ThemedText>
                                    <TouchableOpacity
                                      style={styles.removeButton}
                                      onPress={() => handleRemovePlaza(responsable.puestoId, plaza.plazaId)}
                                    >
                                      <Ionicons name="close-circle" size={18} color="#FF3B30" />
                                    </TouchableOpacity>
                                  </View>
                                ))
                              )}
                            </ThemedView>
                          ))
                        )}
                      </ThemedView>
                    </>
                  )}
                </ThemedView>

                <ThemedText style={styles.sectionTitle}>Tipo de actividad</ThemedText>
                <ThemedView style={styles.pickerContainer}>
                  <Picker
                    selectedValue={tipoActividad}
                    onValueChange={(value) => setTipoActividad(value as 'Normal' | 'Inventario')}
                    style={styles.picker}
                  >
                    <Picker.Item label="Normal" value="Normal" />
                    <Picker.Item label="Inventario" value="Inventario" />
                  </Picker>
                </ThemedView>

                {tipoActividad === 'Inventario' && (
                  <ThemedView style={styles.sectionCard}>
                    <ThemedText style={styles.sectionTitle}>Reglas</ThemedText>
                    <ThemedText style={styles.formLabel}>Artículos</ThemedText>
                    <ThemedView style={styles.pickerContainer}>
                      <Picker
                        selectedValue={selectedArticuloId}
                        onValueChange={handleArticuloSelection}
                        style={styles.picker}
                      >
                        <Picker.Item label="Selecciona un artículo" value="" />
                        {articulosCatalog.map(articulo => (
                          <Picker.Item key={articulo.id} label={articulo.nombre} value={String(articulo.id)} />
                        ))}
                      </Picker>
                    </ThemedView>

                    {articuloRules.length === 0 ? (
                      <ThemedText style={styles.helperText}>
                        Selecciona un artículo para comenzar a definir reglas.
                      </ThemedText>
                    ) : (
                      articuloRules.map(articulo => (
                        <ThemedView key={articulo.articuloId} style={styles.articleCard}>
                          <View style={styles.assignedHeader}>
                            <ThemedText style={styles.assignedTitle}>{articulo.articuloNombre}</ThemedText>
                            <TouchableOpacity
                              style={styles.removeButton}
                              onPress={() => handleRemoveArticulo(articulo.articuloId)}
                            >
                              <Ionicons name="trash" size={18} color="#FF3B30" />
                            </TouchableOpacity>
                          </View>
                          {articulo.reglas.map(regla => (
                            <View key={regla.id} style={styles.ruleRow}>
                              <TextInput
                                style={[styles.textInput, styles.ruleInput]}
                                placeholder="Nombre"
                                value={regla.nombre}
                                onChangeText={text => handleRuleChange(articulo.articuloId, regla.id, 'nombre', text)}
                              />
                              <TextInput
                                style={[styles.textInput, styles.ruleInput]}
                                placeholder="Valor"
                                value={regla.valor}
                                onChangeText={text => handleRuleChange(articulo.articuloId, regla.id, 'valor', text)}
                              />
                              <TouchableOpacity
                                style={styles.removeButton}
                                onPress={() => handleRemoveRule(articulo.articuloId, regla.id)}
                              >
                                <Ionicons name="close-circle" size={20} color="#FF3B30" />
                              </TouchableOpacity>
                            </View>
                          ))}
                          <TouchableOpacity
                            style={styles.secondaryButton}
                            onPress={() => handleAddRule(articulo.articuloId)}
                          >
                            <Ionicons name="add-circle" size={18} color="#fff" />
                            <ThemedText style={styles.secondaryButtonText}>Agregar regla</ThemedText>
                          </TouchableOpacity>
                        </ThemedView>
                      ))
                    )}
                  </ThemedView>
                )}

                <ThemedView style={styles.sectionCard}>
                  <ThemedText style={styles.sectionTitle}>Repetición de la actividad</ThemedText>
                  <ThemedView style={styles.pickerContainer}>
                    <Picker
                      selectedValue={repetitionType}
                      onValueChange={(value) => setRepetitionType(value as any)}
                      style={styles.picker}
                    >
                      <Picker.Item label="Cada día" value="daily" />
                      <Picker.Item label={weeklyLabel} value="weekly" />
                      <Picker.Item label={monthlyWeekdayLabel} value="monthly-weekday" />
                      <Picker.Item label={monthlyLastLabel} value="monthly-last" />
                      <Picker.Item label={yearlyLabel} value="yearly" />
                      <Picker.Item label="Todos los días laborales (lunes a viernes)" value="weekdays" />
                      <Picker.Item label="Personalizado" value="custom" />
                    </Picker>
                  </ThemedView>

                  {repetitionType === 'custom' && (
                    <>
                      <ThemedText style={styles.formLabel}>Repetir cada:</ThemedText>
                      <View style={styles.intervalRow}>
                        <TextInput
                          style={styles.intervalInput}
                          value={customInterval}
                          onChangeText={text => setCustomInterval(text.replace(/[^0-9]/g, '') || '1')}
                          keyboardType="numeric"
                        />
                        <ThemedView style={styles.pickerContainerInline}>
                          <Picker
                            selectedValue={customUnit}
                            onValueChange={(value) => setCustomUnit(value as any)}
                            style={styles.picker}
                          >
                            <Picker.Item label="día" value="day" />
                            <Picker.Item label="semana" value="week" />
                            <Picker.Item label="mes" value="month" />
                            <Picker.Item label="año" value="year" />
                          </Picker>
                        </ThemedView>
                      </View>
                      {customUnit === 'week' && (
                        <ThemedView style={{ marginTop: 16 }}>
                          <ThemedText style={styles.formLabel}>
                            Se repite el... (puedes seleccionar múltiples días)
                          </ThemedText>
                          <View style={styles.weekdaysRow}>
                            {[
                              { value: 'monday', label: 'L' },
                              { value: 'tuesday', label: 'M' },
                              { value: 'wednesday', label: 'X' },
                              { value: 'thursday', label: 'J' },
                              { value: 'friday', label: 'V' },
                              { value: 'saturday', label: 'S' },
                              { value: 'sunday', label: 'D' },
                            ].map(day => (
                              <TouchableOpacity
                                key={day.value}
                                style={[
                                  styles.weekdayChip,
                                  selectedWeekdays.includes(day.value) && styles.weekdayChipSelected,
                                ]}
                                onPress={() => toggleWeekday(day.value)}
                              >
                                <ThemedText
                                  style={[
                                    styles.weekdayChipText,
                                    selectedWeekdays.includes(day.value) && styles.weekdayChipTextSelected,
                                  ]}
                                >
                                  {day.label}
                                </ThemedText>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </ThemedView>
                      )}

                      {customUnit === 'month' && (
                        <ThemedView style={{ marginTop: 16 }}>
                          <ThemedText style={styles.formLabel}>Opción de mes:</ThemedText>
                          <ThemedView style={styles.pickerContainer}>
                            <Picker
                              selectedValue={monthOption}
                              onValueChange={(value) => setMonthOption(value as 'day-of-month' | 'weekday-of-month')}
                              style={styles.picker}
                            >
                              <Picker.Item label={monthDayOfMonthLabel} value="day-of-month" />
                              <Picker.Item label={monthWeekdayOfMonthLabel} value="weekday-of-month" />
                            </Picker>
                          </ThemedView>
                        </ThemedView>
                      )}

                      {customUnit === 'year' && (
                        <ThemedView style={styles.formGroup}>
                          <ThemedText style={styles.formLabel}>Configuración anual:</ThemedText>
                          <View style={styles.yearRow}>
                            <View style={styles.yearFieldMonth}>
                              <ThemedText style={styles.formLabelSmall}>Mes</ThemedText>
                              <ThemedView style={styles.pickerContainer}>
                                <Picker
                                  selectedValue={yearMonth}
                                  onValueChange={(value) => setYearMonth(value)}
                                  style={styles.picker}
                                >
                                  <Picker.Item label="Enero" value="1" />
                                  <Picker.Item label="Febrero" value="2" />
                                  <Picker.Item label="Marzo" value="3" />
                                  <Picker.Item label="Abril" value="4" />
                                  <Picker.Item label="Mayo" value="5" />
                                  <Picker.Item label="Junio" value="6" />
                                  <Picker.Item label="Julio" value="7" />
                                  <Picker.Item label="Agosto" value="8" />
                                  <Picker.Item label="Septiembre" value="9" />
                                  <Picker.Item label="Octubre" value="10" />
                                  <Picker.Item label="Noviembre" value="11" />
                                  <Picker.Item label="Diciembre" value="12" />
                                </Picker>
                              </ThemedView>
                            </View>
                            <View style={styles.yearFieldDay}>
                              <ThemedText style={styles.formLabelSmall}>Día (1-31)</ThemedText>
                              <TextInput
                                style={styles.intervalInput}
                                value={yearDay}
                                onChangeText={text => setYearDay(text.replace(/[^0-9]/g, ''))}
                                keyboardType="numeric"
                              />
                            </View>
                          </View>
                        </ThemedView>
                      )}
                    </>
                  )}

                  <ThemedView style={styles.formGroup}>
                    <ThemedText style={styles.formLabel}>Termina...</ThemedText>
                    <ThemedView style={styles.radioGroup}>
                      <TouchableOpacity
                        style={styles.radioOption}
                        onPress={() => setEndType('never')}
                      >
                        <ThemedView style={[
                          styles.radioCircle,
                          endType === 'never' ? styles.radioSelected : styles.radioUnselected
                        ]}>
                          {endType === 'never' && <ThemedView style={styles.radioInner} />}
                        </ThemedView>
                        <ThemedText style={styles.radioLabel}>Nunca</ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.radioOption}
                        onPress={() => {
                          setEndType('date');
                          if (!endDate) {
                            const startDateString = formatDateForApi(activityStartDate);
                            setEndDate(startDateString);
                          }
                        }}
                      >
                        <ThemedView style={[
                          styles.radioCircle,
                          endType === 'date' ? styles.radioSelected : styles.radioUnselected
                        ]}>
                          {endType === 'date' && <ThemedView style={styles.radioInner} />}
                        </ThemedView>
                        <ThemedText style={styles.radioLabel}>El...</ThemedText>
                      </TouchableOpacity>
                    </ThemedView>
                  </ThemedView>

                  {endType === 'date' && (
                    <ThemedView>
                      <ThemedText style={styles.formLabel}>Fecha de finalización:</ThemedText>
                      <TouchableOpacity
                        style={styles.dateButton}
                        onPress={() => setShowEndDatePicker(true)}
                      >
                        <ThemedText style={styles.dateButtonText}>
                          {endDate ? formatDateForDisplay(new Date(`${endDate}T00:00:00`)) : 'Seleccionar fecha'}
                        </ThemedText>
                        <Ionicons name="calendar" size={20} color="#007AFF" />
                      </TouchableOpacity>
                      {showEndDatePicker && (
                        <DateTimePicker
                          value={endDate ? new Date(endDate) : activityStartDate}
                          mode="date"
                          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                          onChange={handleEndDateChange}
                        />
                      )}
                    </ThemedView>
                  )}
                </ThemedView>

                <ThemedText style={styles.sectionTitle}>Firma del responsable</ThemedText>
                <ThemedView style={styles.signatureButtons}>
                  <TouchableOpacity
                    style={styles.signatureButton}
                    onPress={handleGenerateSignature}
                    disabled={isProcessingSignature}
                  >
                    {isProcessingSignature ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="finger-print" size={20} color="#FFFFFF" />
                        <ThemedText style={styles.signatureButtonText}>Generar</ThemedText>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.signatureButton}
                    onPress={handleScanSignature}
                  >
                    <Ionicons name="qr-code" size={20} color="#FFFFFF" />
                    <ThemedText style={styles.signatureButtonText}>Escanear QR</ThemedText>
                  </TouchableOpacity>
                </ThemedView>
                {signatureData && (
                  <ThemedView style={styles.signatureInfo}>
                    <ThemedText style={styles.signatureInfoTitle}>Información de la firma:</ThemedText>
                    <ThemedText style={styles.signatureInfoText}>ID de sesión: {signatureData.sessionId}</ThemedText>
                    <ThemedText style={styles.signatureInfoText}>ID del empleado: {signatureData.employeeId}</ThemedText>
                    {signatureEmployeeName && (
                      <ThemedView style={styles.signatureInfoDetail}>
                        <ThemedText style={styles.signatureInfoDetailText}>
                          {signatureEmployeeName}
                        </ThemedText>
                      </ThemedView>
                    )}
                    <ThemedText style={styles.signatureInfoText}>Latitud: {signatureData.latitude}</ThemedText>
                    <ThemedText style={styles.signatureInfoText}>Longitud: {signatureData.longitude}</ThemedText>
                    <ThemedText style={styles.signatureInfoText}>Hora actual: {generateDateTime(signatureData.timestamp)}</ThemedText>
                    <TouchableOpacity
                      style={styles.clearSignatureButton}
                      onPress={() => {
                        setSignatureData(null);
                        setSignatureEmployeeName(null);
                      }}
                    >
                      <ThemedText style={styles.clearSignatureText}>{getActionIcon('clear')}</ThemedText>
                    </TouchableOpacity>
                  </ThemedView>
                )}

                <ThemedView style={styles.repetitionModalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalCancelButton]}
                    onPress={closeRepetitionModal}
                    disabled={isSubmittingActivity}
                  >
                    <ThemedText style={styles.modalCancelButtonText}>
                      Cancelar
                    </ThemedText>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalConfirmButton, isSubmittingActivity && styles.modalButtonDisabled]}
                    onPress={handleConfirmCreateActivity}
                    disabled={isSubmittingActivity}
                  >
                    {isSubmittingActivity ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <ThemedText style={styles.modalConfirmButtonText}>
                        Crear actividad
                      </ThemedText>
                    )}
                  </TouchableOpacity>
                </ThemedView>
              </ScrollView>
            </ThemedView>
          )}
        </ThemedView>
      </ScrollView>
      {QRScannerComponent}

      {/* Bitacora Modal */}
      <Modal
        visible={isBitacoraModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={handleBitacoraCancel}
      >
        <ThemedView style={styles.modalOverlay}>
          <ThemedView style={styles.modalContainer}>
            <ThemedView style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Bitácora de Actividad</ThemedText>
              <TouchableOpacity onPress={handleBitacoraCancel}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </ThemedView>

            <ThemedText style={styles.modalSubtitle}>
              {selectedActivity?.nombre_actividad}
            </ThemedText>

            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Bitácora:</ThemedText>
              <TextInput
                style={styles.bitacoraInput}
                value={bitacoraText}
                onChangeText={setBitacoraText}
                placeholder="Ingresa la bitácora de la actividad..."
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </ThemedView>

            <ThemedView style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Adjuntar imagen (opcional):</ThemedText>
              <TouchableOpacity
                style={styles.captureImageButton}
                onPress={openCameraForActivity}
              >
                <Ionicons name="camera" size={20} color="#007AFF" />
                <ThemedText style={styles.captureImageButtonText}>
                  {activityImageBase64 ? 'Cambiar imagen' : 'Capturar imagen'}
                </ThemedText>
              </TouchableOpacity>

              {activityImageBase64 && (
                <ThemedView style={styles.imagePreviewContainer}>
                  <ThemedText style={styles.imagePreviewTitle}>Imagen capturada:</ThemedText>
                  <Image
                    source={{ uri: activityImageBase64 }}
                    style={styles.imagePreview}
                    resizeMode="contain"
                  />
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => setActivityImageBase64(null)}
                  >
                    <Ionicons name="trash" size={20} color="#FF3B30" />
                    <ThemedText style={styles.removeImageText}>Eliminar imagen</ThemedText>
                  </TouchableOpacity>
                </ThemedView>
              )}
            </ThemedView>

            <ThemedView style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={handleBitacoraCancel}
              >
                <ThemedText style={styles.modalCancelButtonText}>Cancelar</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmButton]}
                onPress={handleBitacoraConfirm}
              >
                <ThemedText style={styles.modalConfirmButtonText}>Confirmar</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          </ThemedView>
        </ThemedView>
      </Modal>

      {/* Camera Modal */}
      <Modal
        visible={isCameraVisible}
        animationType="slide"
        onRequestClose={() => setIsCameraVisible(false)}
      >
        <ThemedView style={{ flex: 1, backgroundColor: '#000' }}>
          <CameraView
            ref={cameraRef}
            style={{ flex: 1 }}
            facing="back"
          >
            <TouchableOpacity
              style={styles.cameraCloseButton}
              onPress={() => setIsCameraVisible(false)}
            >
              <Ionicons name="close" size={30} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cameraCaptureButton}
              onPress={takePicture}
            >
              <ThemedView style={styles.cameraCaptureButtonInner} />
            </TouchableOpacity>
          </CameraView>
        </ThemedView>
      </Modal>

      {/* Modal: ver cambios de actividades creadas */}
      <Modal
        visible={isCambiosModalVisible}
        animationType="fade"
        transparent
        presentationStyle="overFullScreen"
        onRequestClose={closeCambiosModal}
      >
        <ThemedView style={styles.modalOverlay}>
          <ThemedView style={styles.modalContainer}>
            <ThemedView style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>{cambiosTitle}</ThemedText>
              <TouchableOpacity onPress={closeCambiosModal}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </ThemedView>

            <ScrollView
              style={{ maxHeight: Dimensions.get('window').height * 0.75 }}
              contentContainerStyle={{ padding: 16 }}
            >
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
                                const prop = String(c?.prop ?? '-');
                                const value = c?.after;

                                if (prop === '__created__' && value && typeof value === 'object') {
                                  const created: any = value;
                                  return (
                                    <React.Fragment key={`c-${row.id}-${idx}-created`}>
                                      <ThemedView style={styles.changeDescriptionContainer}>
                                        <ThemedText style={styles.changeDescription}>
                                          <ThemedText style={{ fontWeight: '800' }}>Registro creado</ThemedText>
                                        </ThemedText>
                                      </ThemedView>

                                      {Object.entries(created).map(([k, v]) => {
                                        const displayValue = formatChangeValue(k, v);
                                        return (
                                          <ThemedView key={`c-${row.id}-${idx}-${k}`} style={styles.changeDescriptionContainer}>
                                            <ThemedText style={styles.changeDescription}>
                                              <ThemedText style={{ fontWeight: '800' }}>{k}: </ThemedText>
                                              {displayValue}
                                            </ThemedText>
                                          </ThemedView>
                                        );
                                      })}
                                    </React.Fragment>
                                  );
                                }

                                const displayValue = formatChangeValue(prop, value);
                                return (
                                  <ThemedView key={`c-${row.id}-${idx}`} style={styles.changeDescriptionContainer}>
                                    <ThemedText style={styles.changeDescription}>
                                      <ThemedText style={{ fontWeight: '800' }}>{prop}: </ThemedText>
                                      {displayValue}
                                    </ThemedText>
                                  </ThemedView>
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
        </ThemedView>
      </Modal>

      <AppFooter />
      <SlideMenu
        isVisible={isMenuVisible}
        onClose={handleMenuClose}
        onHomePress={handleHomePress}
        currentRoute="Activities"
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  titleContainer: {
    alignItems: 'center',
    marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    width: '100%',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
  },
  createButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    opacity: 0.7,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F5C2C7',
    backgroundColor: '#F8D7DA',
  },
  errorBannerText: {
    flex: 1,
    color: '#B00020',
    fontSize: 14,
    fontWeight: '600',
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFEBAA',
    backgroundColor: '#FFF3CD',
  },
  offlineBannerText: {
    flex: 1,
    color: '#8A6D00',
    fontSize: 14,
    fontWeight: '600',
  },
  noMarcaContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 20,
  },
  noMarcaTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF9500',
    textAlign: 'center',
  },
  noMarcaMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 400,
  },
  goBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  goBackButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  activitiesContainer: {
    width: '100%',
    gap: 16,
  },
  activityCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    backgroundColor: '#fff',
  },
  activityInfo: {
    flex: 1,
    gap: 8,
    backgroundColor: '#fff',
  },
  activityName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  activityFrecuencia: {
    fontSize: 10,
    color: '#fff',
    backgroundColor: '#007AFF',
    paddingHorizontal: 6,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  activityFrecuenciaPending: {
    fontSize: 10,
    color: '#fff',
    backgroundColor: '#FF9500',
    paddingHorizontal: 6,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  teamReviewBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  teamReviewText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  checkboxContainer: {
    marginLeft: 12,
    backgroundColor: '#fff',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#34C759',
    borderColor: '#34C759',
  },
  checkboxUnchecked: {
    backgroundColor: '#fff',
    borderColor: '#E0E0E0',
  },
  activityBody: {
    padding: 16,
    paddingTop: 0,
    backgroundColor: '#fff',
  },
  activityDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 20,
    minHeight: 300,
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.5,
    textAlign: 'center',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
    color: '#333333',
  },
  modalSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666666',
    lineHeight: 22,
  },
  bitacoraInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#F8F9FA',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: '#FAFAFA',
  },
  cambioCollapsableMain: {
    width: '100%',
    marginBottom: 10,
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  cambioCollapsableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F8F9FA',
  },
  cambioCollapsableTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    flex: 1,
  },
  cambioCollapsableContent: {
    padding: 12,
    backgroundColor: '#F8F9FA',
    gap: 8,
  },
  changeDescriptionContainer: {
    marginBottom: 8,
  },
  changeDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: '#666',
  },
  filterGroupSearch: {
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#000000',
  },
  createdActionButton: {
    flex: 1,
    marginTop: 8,
  },
  repetitionModalContainer: {
    width: '100%',
    maxWidth: 600,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 20,
    marginBottom: 20,
  },
  sectionCard: {
    marginTop: 12,
    marginBottom: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#ffffff',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  formErrorText: {
    color: '#FF3B30',
    fontSize: 13,
    marginBottom: 8,
  },
  formGroup: {
    marginTop: 12,
    marginBottom: 12,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  formLabelSmall: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  pickerContainer: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
    overflow: 'hidden',
    minHeight: 50,
    marginBottom: 12,
  },
  pickerContainerInline: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
    overflow: 'hidden',
    height: 50,
    marginBottom: 0,
  },
  picker: {
    width: '100%',
    height: 50,
    color: '#000000',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#F9FAFB',
    color: '#111827',
    marginBottom: 12,
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  helperText: {
    fontSize: 13,
    color: '#6B7280',
  },
  radioGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#fff',
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
    marginBottom: 10,
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
  },
  chipSmall: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: '#F0F0F0',
  },
  chipSelected: {
    backgroundColor: '#007AFF',
  },
  chipText: {
    fontSize: 12,
    color: '#333',
  },
  chipTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  intervalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  intervalInput: {
    width: 70,
    height: 50,
    paddingHorizontal: 10,
    paddingVertical: 0,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    fontSize: 14,
    backgroundColor: '#F9F9F9',
    color: '#000000',
    textAlignVertical: 'center',
  },
  weekdaysRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 4,
  },
  weekdayChip: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  weekdayChipSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  weekdayChipText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '600',
  },
  weekdayChipTextSelected: {
    color: '#fff',
  },
  yearRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  yearFieldMonth: {
    flex: 1,
  },
  yearFieldDay: {
    width: 70,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#F9F9F9',
    marginBottom: 12,
  },
  dateButtonText: {
    fontSize: 16,
    color: '#000000',
  },
  repetitionModalButtons: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  modalCancelButton: {
    backgroundColor: '#E0E0E0',
  },
  modalConfirmButton: {
    backgroundColor: '#FF3B30',
  },
  modalButtonDisabled: {
    opacity: 0.5,
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    lineHeight: 20,
    textAlign: 'center',
  },
  modalConfirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    lineHeight: 20,
    textAlign: 'center',
  },
  secondaryButton: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#34C759',
    paddingVertical: 10,
    borderRadius: 8,
  },
  secondaryButtonDisabled: {
    opacity: 0.5,
  },
  secondaryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  secondaryButtonOutline: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 10,
  },
  secondaryButtonOutlineText: {
    color: '#007AFF',
    fontWeight: '600',
    textAlign: 'center',
  },
  
  editButton: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    borderRadius: 8,
  },
  editButtonDisabled: {
    opacity: 0.5,
  },
  editButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  editButtonOutline: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 10,
  },
  editButtonOutlineText: {
    color: '#007AFF',
    fontWeight: '600',
    textAlign: 'center',
  },
  changesButton: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#5856D6' , // Púrpura oscuro
    paddingVertical: 10,
    borderRadius: 8,
  },
  changesButtonDisabled: {
    opacity: 0.5,
  },
  changesButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  changesButtonOutline: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#5856D6',
    borderRadius: 8,
    paddingVertical: 10,
  },
  changesButtonOutlineText: {
    color: '#5856D6',
    fontWeight: '600',
    textAlign: 'center',
  },
  
  deleteButton: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F44336' , // Rojo oscuro
    paddingVertical: 10,
    borderRadius: 8,
  },
  deleteButtonDisabled: {
    opacity: 0.5,
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  deleteButtonOutline: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#F44336',
    borderRadius: 8,
    paddingVertical: 10,
  },
  deleteButtonOutlineText: {
    color: '#F44336',
    fontWeight: '600',
    textAlign: 'center', 
  },
  assignedList: {
    marginTop: 12,
    gap: 12,
  },
  assignedItem: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#F9FAFB',
  },
  assignedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  assignedTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    flexShrink: 1,
    marginRight: 8,
  },
  plazaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  plazaChipText: {
    fontSize: 13,
    color: '#111827',
    flex: 1,
    flexShrink: 1,
    marginRight: 8,
  },
  removeButton: {
    flexShrink: 0,
  },
  plazaListContainer: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  plazaListItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  plazaListItemLast: {
    borderBottomWidth: 0,
  },
  plazaListItemSelected: {
    backgroundColor: '#E6F0FF',
  },
  plazaCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#BFD2F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 4,
    backgroundColor: '#fff',
  },
  plazaCheckboxChecked: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  plazaInfo: {
    flex: 1,
  },
  plazaName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  plazaEmployees: {
    fontSize: 12,
    color: '#475569',
    marginTop: 4,
  },
  plazaEmployeesEmpty: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
    fontStyle: 'italic',
  },
  articleCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    backgroundColor: '#F9FAFB',
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  ruleInput: {
    flex: 1,
    marginBottom: 0,
  },
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
    opacity: 0.6,
  },
  signatureButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  signatureInfo: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  signatureInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000000',
  },
  signatureInfoText: {
    fontSize: 14,
    marginBottom: 4,
    color: '#000000',
  },
  signatureInfoDetail: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#BDE4FF',
    borderRadius: 8,
    marginBottom: 4,
  },
  signatureInfoDetailText: {
    fontSize: 12,
    color: '#000000',
  },
  clearSignatureButton: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#FF3B30',
    borderRadius: 6,
    alignItems: 'center',
    width: '100%',
  },
  clearSignatureText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  // Inventory styles
  inventoryContainer: {
    marginTop: 16,
    backgroundColor: '#fff',
  },
  inventoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  goEntregaButton: {
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F4F9FF',
    marginBottom: 8,
  },
  goEntregaButtonText: {
    color: '#007AFF',
    fontWeight: '700',
    fontSize: 12,
  },
  tableWrapper: {
    flexDirection: 'row',
    marginTop: 10,
  },
  tableFixedColumn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRightWidth: 0,
  },
  tableHeaderFixed: {
    backgroundColor: '#F5F5F5',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    height: 50,
  },
  tableRowFixed: {
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    height: 70,
  },
  articulosScrollView: {
    flex: 1,
  },
  articulosScrollContent: {
    paddingRight: 16,
  },
  tableScrollableContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderLeftWidth: 0,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    height: 50,
  },
  tableHeaderCell: {
    padding: 10,
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0',
    width: 150,
    justifyContent: 'center',
    height: 50,
  },
  tableHeaderCellFirst: {
    padding: 10,
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0',
    width: 100,
    justifyContent: 'center',
    height: 50,
  },
  tableHeaderText: {
    color: '#333',
    fontWeight: '600',
    fontSize: 13,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    height: 70,
  },
  tableCell: {
    padding: 10,
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0',
    width: 150,
    justifyContent: 'center',
    height: 70,
  },
  tableCellFirst: {
    padding: 10,
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0',
    width: 100,
    justifyContent: 'center',
    height: 70,
  },
  tableCellFirstText: {
    color: '#000',
    fontSize: 10,
    textAlign: 'center',
    flexShrink: 1,
  },
  tableCellText: {
    color: '#000',
    fontSize: 13,
    textAlign: 'center',
    flexShrink: 1,
  },
  pickerContainerTable: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 4,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  pickerTable: {
    height: 50,
    color: '#000',
  },
  pickerItemStyle: {
    color: '#000',
    fontSize: 13,
  },
  inputTable: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 4,
    padding: 8,
    fontSize: 13,
    backgroundColor: '#fff',
    minHeight: 35,
    textAlign: 'center',
  },
  textAreaTable: {
    minHeight: 50,
    textAlignVertical: 'top',
    textAlign: 'left',
  },
  reglasContainer: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#F0F8FF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E0E8F0',
  },
  reglasTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  reglaItem: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingVertical: 2,
    backgroundColor: '#F0F8FF',
  },
  reglaNombre: {
    fontSize: 13,
    fontWeight: '500',
    color: '#555',
    minWidth: 80,
  },
  reglaValor: {
    fontSize: 13,
    color: '#333',
    flex: 1,
    marginLeft: 8,
  },
  radioContainer: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 12,
    backgroundColor: '#fafafa',
  },
  radioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fafafa',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fafafa',
    marginRight: 8,
  },
  radioSelected: {
    borderColor: '#007AFF',
  },
  radioUnselected: {
    borderColor: '#E0E0E0',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#007AFF',
  },
  radioLabel: {
    fontSize: 14,
    color: '#333',
  },
  motivoInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    backgroundColor: '#fff',
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  confirmInventoryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignSelf: 'flex-start',
    width: '100%',
  },
  confirmInventoryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  captureImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0F8FF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    marginBottom: 12,
  },
  captureImageButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  imagePreviewContainer: {
    marginTop: 12,
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  imagePreviewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
  },
  cameraCloseButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 25,
    padding: 10,
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
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
  removeImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#FFEBEE',
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  removeImageText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '600',
  },
});
