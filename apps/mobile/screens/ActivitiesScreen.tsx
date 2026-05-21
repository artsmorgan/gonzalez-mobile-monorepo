import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Modal, TextInput, Image, View, Platform, Dimensions, Animated } from 'react-native';
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
import { appendCreatedActivityPuestos, createActivity, deleteCreatedActivity, duplicateCreatedActivity, listCreatedActivitiesByPuesto, unlinkCreatedActivityPuesto, updateCreatedActivity } from '@/hooks/activitiesFunctions';
import authedFetch from '@/hooks/authedFetch';
import getValidAccessTokenOrLogout from '@/hooks/getValidAccessTokenOrLogout';
import { loadMainStructureTreeMerged } from '@/hooks/bitacoraMainStructureCache';
import { convertDateTimestampToLocalString } from '@/hooks/convertDateTimestampToLocalString';
import { deleteFile, getLocalFileDisplayUri, saveFile } from '@/hooks/fileStorage';
import { loadPuestoArticulosForTable, rewritePuestoArticulosInMainStructure } from '@/hooks/puestoArticulosSync';

const ACTIVITIES_MARK_PHOTO_PREFIX = 'activities_mark';

/** Vista previa: nombre en documentos, data URL o file URI. */
function resolveLocalMarkImageUri(ref: string | null | undefined): string | undefined {
  if (!ref || !String(ref).trim()) return undefined;
  const s = String(ref).trim();
  if (s.startsWith('data:') || s.startsWith('file:')) return s;
  return getLocalFileDisplayUri(s) || undefined;
}

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
  inventoryRows: Inventario[];
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
  inventoryRows,
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
        const rd = action?.requestData;
        if (!rd) return null;
        const fn = rd.file_local_file_name;
        if (typeof fn === 'string' && fn.trim()) {
          const u = getLocalFileDisplayUri(fn.trim());
          return u || null;
        }
        return rd.file || null;
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
          {(() => {
            const scheduleLbl = formatScheduleUiLabel(activity.schedule ?? []);
            return scheduleLbl ? <ThemedText style={styles.activityScheduleHint}>{scheduleLbl}</ThemedText> : null;
          })()}
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

        {activity.is_revision_equipo && inventoryRows.length > 0 && (
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
                {inventoryRows.map((articulo) => (
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
                  {inventoryRows.map((inventory) => (
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

              const imageUri =
                imageToShow.startsWith('data:') || imageToShow.startsWith('file:')
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

  // Las acciones offline `update-equipo` fueron removidas.
  const getCachedImage = async () => {
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
            <Picker.Item label="Bueno" value="Bueno" color="#000000" />
            <Picker.Item label="Malo" value="Malo" color="#000000" />
            <Picker.Item label="No está" value="No está" color="#000000" />
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
              source={{ uri: resolveLocalMarkImageUri(inventoryImages[inventory.id]) || '' }}
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
              const imageUri =
                imageToShow.startsWith('data:') || imageToShow.startsWith('file:')
                  ? imageToShow
                  : `data:image/jpeg;base64,${imageToShow}`;
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
  /** Horas HH:mm desde `frecuencia.schedule` (solo lista por marca; informativo). */
  schedule?: string[];
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

/** Hora local HH:mm desde un `Date` (sin conversión TZ; igual criterio que ReportesScreen). */
function activitiesHmFromDate(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function activitiesHmOkStr(s: string): boolean {
  return /^\d{2}:\d{2}$/.test(String(s || '').trim());
}

function activitiesParseHmToLocalDate(hmStr: string): Date {
  const t = String(hmStr || '').trim();
  const [h, m] = t.split(':').map((x) => parseInt(x, 10));
  const base = new Date(2000, 0, 1, 0, 0, 0, 0);
  base.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
  return base;
}

/** Lee `schedule` desde el JSON almacenado en `e_actividades.frecuencia`. */
function parseScheduleFromFrecuenciaJsonStore(frecuenciaStr: string | null | undefined): string[] {
  if (!frecuenciaStr || !String(frecuenciaStr).trim()) return [];
  try {
    const parsed = JSON.parse(String(frecuenciaStr));
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.schedule)) return [];
    return parsed.schedule
      .filter((x: unknown) => typeof x === 'string' && activitiesHmOkStr(String(x).trim()))
      .map((x: string) => String(x).trim())
      .sort();
  } catch {
    return [];
  }
}

function formatScheduleUiLabel(times: string[]): string | null {
  if (!times.length) return null;
  return `Horario: ${times.join(', ')}`;
}

interface RevisionEquipo {
  id: number;
  marcada: boolean;
  es_correcto: boolean;
  motivo_incorrecto: string;
  imagen_adjunta: string;
}

function normalizeCantidadNecesaria(value: any): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.floor(n));
}

type ActivityArticleFormRow = {
  id: number;
  tipo?: string;
  cantidad_requerida: number;
  cantidad_real: number;
  estado: EstadoArticulo;
  observaciones: string;
};

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
  articulos?: PuestoArticuloOption[];
}

interface PuestoArticuloOption {
  id: number;
  nombre: string;
  tipo?: string;
  marca?: string | null;
  serie?: string | null;
  cantidad?: number | null;
  cantidad_plan?: number | null;
}

interface ActivityInventoryArticleEntry {
  puestoId: number;
  puestoNombre: string;
  articuloId: number;
  articuloNombre: string;
  tipo?: string;
  marca?: string | null;
  serie?: string | null;
  cantidad: number;
}

interface AssignedResponsable {
  puestoId: number;
  puestoNombre: string;
  assignAll: boolean;
  plazas: { plazaId: number; plazaNombre: string }[];
}

type MainStructurePuestoNode = { id: number; nombre: string; plazas: PlazaOption[]; articulos?: PuestoArticuloOption[] };
type MainStructureSucursalNode = { id: number; nombre: string; puestos: MainStructurePuestoNode[] };
type MainStructureContratoNode = { id: number; nombre: string; sucursales: MainStructureSucursalNode[] };
type MainStructureDivisionNode = { id: number; nombre: string; contratos: MainStructureContratoNode[] };
type MainStructureClienteNode = { id: number; nombre: string; division: MainStructureDivisionNode[] };
type MainStructureEmpresaNode = { id: number; nombre: string; clientes: MainStructureClienteNode[] };
type MainStructureTree = MainStructureEmpresaNode[];

const getMarcaRoleDivisionId = (current: any): number | null => {
  const raw = current?.roleDivision?.division?.id
    ?? current?.role_division?.division?.id
    ?? current?.division?.id
    ?? current?.division_id;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const resolveDivisionIdInStructure = (
  tree: MainStructureTree,
  empresaId: number | null,
  clienteId: number | null,
  divisionId: number | null
): number | null => {
  if (!Array.isArray(tree) || tree.length === 0 || divisionId == null) return divisionId;
  const empresa = tree.find((e: any) => Number(e?.id) === Number(empresaId));
  const clientes = Array.isArray(empresa?.clientes) ? empresa.clientes : [];
  const cliente = clientes.find((c: any) => Number(c?.id) === Number(clienteId));
  const divisiones = Array.isArray(cliente?.division) ? cliente.division : [];
  if (divisiones.some((d: any) => Number(d?.id) === Number(divisionId))) return divisionId;
  return null;
};

interface CreatedActivityPuestoVinculado {
  id: number;
  nombre: string;
  codigo: string | null;
}

interface CreatedActivityItem {
  id: number;
  nombre_actividad: string;
  descripcion_actividad: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  frecuencia: string;
  es_revision_equipo: boolean;
  firma_responsable: string;
  puestos_vinculados?: CreatedActivityPuestoVinculado[];
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

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

function ScalePressButton({
  children,
  onPress,
  disabled,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: object | object[];
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () => {
    if (disabled) return;
    Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, friction: 6 }).start();
  };
  const pressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5 }).start();
  };
  return (
    <AnimatedTouchable
      activeOpacity={1}
      disabled={disabled}
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      style={[style, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedTouchable>
  );
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
  /** Nombre de archivo en `Paths.document` (saveFile) para la foto opcional al marcar. */
  const [activityImageLocalFileName, setActivityImageLocalFileName] = useState<string | null>(null);

  // Camera state
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [cameraTarget, setCameraTarget] = useState<'activity' | 'inventory'>('activity');
  const [targetInventoryId, setTargetInventoryId] = useState<number | null>(null);
  /** Por id de artículo: nombre de archivo local (no base64 en memoria). */
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
  const [activityScheduleExpanded, setActivityScheduleExpanded] = useState(false);
  /** Horarios HH:mm informativos (se guardan en `frecuencia.schedule`). */
  const [activityScheduleSlots, setActivityScheduleSlots] = useState<string[]>([]);
  const [scheduleSlotPickerIndex, setScheduleSlotPickerIndex] = useState<number | null>(null);
  const scheduleSlotPickerIndexRef = useRef<number | null>(null);
  const [tipoActividad, setTipoActividad] = useState<'Normal' | 'Inventario'>('Normal');
  const [puestos, setPuestos] = useState<PuestoOption[]>([]);
  const [selectedPuestoId, setSelectedPuestoId] = useState<string>('');
  const [markedPlazaIds, setMarkedPlazaIds] = useState<string[]>([]);
  const [assignedResponsables, setAssignedResponsables] = useState<AssignedResponsable[]>([]);
  const [isSelectedPuestosExpanded, setIsSelectedPuestosExpanded] = useState(false);
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
  const [deletingCreatedActivityId, setDeletingCreatedActivityId] = useState<number | null>(null);
  const [duplicatingCreatedActivityId, setDuplicatingCreatedActivityId] = useState<number | null>(null);
  const [expandedCreatedActivityPuestosIds, setExpandedCreatedActivityPuestosIds] = useState<number[]>([]);
  const [unlinkingCreatedActivityPuestoKey, setUnlinkingCreatedActivityPuestoKey] = useState<string | null>(null);

  /** Modal: añadir puestos vinculados (no elimina asignaciones previas) */
  const [isUpdPuestosModalVisible, setIsUpdPuestosModalVisible] = useState(false);
  const [updPuestosActivity, setUpdPuestosActivity] = useState<CreatedActivityItem | null>(null);
  const [updPSubmitting, setUpdPSubmitting] = useState(false);
  const [updPAssignAllDivision, setUpdPAssignAllDivision] = useState(false);
  const [updPSelectedDivisionForAll, setUpdPSelectedDivisionForAll] = useState<number | null>(null);
  const [updPEmpresaId, setUpdPEmpresaId] = useState<number | null>(null);
  const [updPClienteId, setUpdPClienteId] = useState<number | null>(null);
  const [updPDivisionId, setUpdPDivisionId] = useState<number | null>(null);
  const [updPContratoId, setUpdPContratoId] = useState<number | null>(null);
  const [updPSucursalId, setUpdPSucursalId] = useState<number | null>(null);
  const [updPSelectedPuestoId, setUpdPSelectedPuestoId] = useState('');
  const [updPMarkedPlazaIds, setUpdPMarkedPlazaIds] = useState<string[]>([]);
  const [updPAssignedResponsables, setUpdPAssignedResponsables] = useState<AssignedResponsable[]>([]);
  const [updPIsSelectedPuestosExpanded, setUpdPIsSelectedPuestosExpanded] = useState(false);

  /** Jerarquía: mismo árbol que PhysicalMinuteAgenda (`loadMainStructureTreeMerged` → encadenar nodos). */
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
  const [puestoInventorySource, setPuestoInventorySource] = useState<Inventario[]>([]);
  const { scanQR, QRScannerComponent } = useQRScanner();

  // Modal: ver cambios de actividades creadas
  const [isCambiosModalVisible, setIsCambiosModalVisible] = useState(false);
  const [cambiosTitle, setCambiosTitle] = useState<string>('Cambios');
  const [cambiosItems, setCambiosItems] = useState<any[]>([]);
  const [expandedCambioId, setExpandedCambioId] = useState<number | null>(null);

  /**
   * Misma fuente que PhysicalMinuteAgendaScreen: `loadMainStructureTreeMerged` (fragmentos + caché legada si hace falta).
   */
  const loadMainStructureCache = useCallback(async (): Promise<MainStructureTree> => {
    setIsStructureLoading(true);
    try {
      const tree = await loadMainStructureTreeMerged();
      const empresas = Array.isArray(tree) ? tree : [];
      setStructure(empresas as MainStructureTree);
      return empresas as MainStructureTree;
    } catch (error) {
      console.error('Error loading main structure:', error);
      setStructure([]);
      setCatalogError('No se pudo leer la jerarquía guardada.');
      return [];
    } finally {
      setIsStructureLoading(false);
    }
  }, []);

  /**
   * Actualiza la jerarquía principal (fragmentos `puesto_*_articulos` o caché legado) con el último mantenimiento de los artículos del puesto actual
   * usando el estado de los formularios de inventario de actividades de revisión de equipo.
   * @param activityOverride Si se pasa (p. ej. justo después de marcar), se usa como fuente principal
   *        para el mapa de artículos; evita depender de `activities` aún no refrescado tras el PUT.
   */
  const updateMainStructureCacheFromActivities = useCallback(async (activityOverride?: Actividad | null) => {
    try {
      if (activityOverride && !activityOverride.is_revision_equipo) return;
      const currentMarcaStr = await AsyncStorage.getItem('current_marca');
      if (!currentMarcaStr) return;
      const currentMarca = JSON.parse(currentMarcaStr);
      const puestoId = Number(currentMarca?.puesto?.id);
      if (!Number.isFinite(puestoId) || puestoId <= 0) return;

      const horaAccionValue = await getHoraAccion();
      const horaAccionMs = horaAccionValue ?? Date.now();

      const articleMap = new Map<number, ActivityArticleFormRow>();

      const pushInventario = (act: Actividad) => {
        if (!act?.is_revision_equipo || !Array.isArray(act.inventario)) return;
        act.inventario.forEach((inv) => {
          const form = getArticleFormState(act.id, inv);
          articleMap.set(inv.id, {
            id: inv.id,
            tipo: (inv as any)?.tipo,
            cantidad_requerida: normalizeCantidadNecesaria(
              inv.cantidad_requerida ?? (inv as any)?.cantidad_requerida
            ),
            cantidad_real: form.cantidadReal,
            estado: form.estado,
            observaciones: form.observaciones || '',
          });
        });
      };

      if (activityOverride) {
        pushInventario(activityOverride);
      }
      activities.forEach((act) => {
        if (activityOverride && act.id === activityOverride.id) return;
        pushInventario(act);
      });
      if (articleMap.size === 0) return;
      console.log('articleMap', articleMap);
      await rewritePuestoArticulosInMainStructure({
        puestoId,
        formsById: articleMap,
        horaAccionMs,
        origin: 'activities',
      });
      const merged = await loadMainStructureTreeMerged();
      if (Array.isArray(merged)) setStructure(merged as MainStructureTree);
    } catch (e) {
      console.error('Error updating main_structure_cache from activities:', e);
    }
  }, [activities, getArticleFormState]);

  /**
   * Actualiza activities_cache con el estado actual de los artículos
   * para todas las actividades de revisión de equipo, sin depender de conexión.
   */
  const updateActivitiesCacheFromActivities = useCallback(async () => {
    try {
      const cacheStr = await AsyncStorage.getItem('activities_cache');
      if (!cacheStr) return;
      const parsed: any = JSON.parse(cacheStr);
      if (!Array.isArray(parsed)) return;

      const updatedActivities = parsed.map((act: any) => {
        if (!act?.is_revision_equipo || !Array.isArray(act.inventario)) return act;

        const updatedInventario = act.inventario.map((inv: any) => {
          const activityId = act.id;
          const form = getArticleFormState(activityId, inv as Inventario);
          const estado = form.estado;
          const cantidad_real = form.cantidadReal;
          const observaciones = form.observaciones || '';
          const rev = inv.revision_equipo || {};

          return {
            ...inv,
            cantidad_requerida:
              inv.cantidad_requerida != null
                ? normalizeCantidadNecesaria(inv.cantidad_requerida)
                : normalizeCantidadNecesaria((inv as any)?.cantidad_requerida),
            cantidad_real,
            estado,
            observaciones,
            revision_equipo: {
              ...rev,
              es_correcto: estado === 'Bueno',
              motivo_incorrecto: estado === 'Bueno' ? '-' : (observaciones || '-'),
            },
          };
        });

        return {
          ...act,
          inventario: updatedInventario,
        };
      });

      await AsyncStorage.setItem('activities_cache', JSON.stringify(updatedActivities));
    } catch (e) {
      console.error('Error updating activities_cache from activities:', e);
    }
  }, [getArticleFormState]);

  useFocusEffect(
    useCallback(() => {
      void loadMainStructureCache();
      fetchActivities();
    }, [loadMainStructureCache]),
  );

  // Etiquetas de repetición según **Fecha inicio** (día de semana / ordinal / mes), no el día actual del dispositivo
  useEffect(() => {
    const baseDate = calendarDateFromPicker(activityStartDate || new Date());
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
    //return false;
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

  const patchActivityWithCurrentFormState = useCallback((row: any, marked: boolean) => {
    if (!row || typeof row !== 'object') return row;
    if (!row?.is_revision_equipo || !Array.isArray(row?.inventario)) {
      return { ...row, is_marcada: marked };
    }
    const inventario = row.inventario.map((inv: any) => {
      const form = getArticleFormState(Number(row.id), inv as Inventario);
      const estado = form.estado;
      const observaciones = form.observaciones || '';
      const rev = inv?.revision_equipo || {};
      return {
        ...inv,
        cantidad_real: form.cantidadReal,
        estado,
        observaciones,
        revision_equipo: {
          ...rev,
          es_correcto: estado === 'Bueno',
          motivo_incorrecto: estado === 'Bueno' ? '-' : (observaciones || '-'),
        },
      };
    });
    return { ...row, is_marcada: marked, inventario };
  }, [getArticleFormState]);

  const loadInventorySourceFromPuesto = useCallback(async (puestoIdRaw: any): Promise<Inventario[]> => {
    try {
      const puestoId = Number(puestoIdRaw);
      if (!Number.isFinite(puestoId) || puestoId <= 0) {
        setPuestoInventorySource([]);
        return [];
      }
      const sourceArticulos = await loadPuestoArticulosForTable(puestoId);
      const normalized: Inventario[] = (Array.isArray(sourceArticulos) ? sourceArticulos : [])
        .map((art: any) => {
          const aid = Number(art?.id);
          if (!Number.isFinite(aid) || aid <= 0) return null;
          const ultimo = art?.ultimo_mantenimiento ?? art?.ultimo_registro_mantenimiento ?? null;
          const estadoUltimo = ultimo?.estado;
          const estado =
            estadoUltimo === 'Bueno' || estadoUltimo === 'Malo' || estadoUltimo === 'No está'
              ? (estadoUltimo as EstadoArticulo)
              : ('Bueno' as EstadoArticulo);
          const cantidadRealRaw =
            typeof ultimo?.cantidad_real === 'number'
              ? ultimo.cantidad_real
              : typeof art?.cantidad_real === 'number'
                ? art.cantidad_real
                : typeof art?.cantidad === 'number'
                  ? art.cantidad
                  : Number(art?.cantidad) || 0;
          const cantidad_real = estado === 'No está' ? 0 : Math.max(0, Number(cantidadRealRaw) || 0);
          const observacionesUltimo =
            ultimo?.observaciones != null && String(ultimo.observaciones).trim() !== ''
              ? String(ultimo.observaciones)
              : (art?.observaciones ? String(art.observaciones) : '');
          return {
            id: aid,
            nombre: String(art?.nombre || 'Artículo'),
            cantidad_requerida: normalizeCantidadNecesaria(art?.cantidad_plan ?? art?.cantidad ?? 1),
            cantidad_real,
            estado,
            observaciones: observacionesUltimo,
            reglas: [],
            revision_equipo: {
              id: Number(ultimo?.id ?? 0) || 0,
              marcada: false,
              es_correcto: estado === 'Bueno',
              motivo_incorrecto: estado === 'Bueno' ? '-' : (observacionesUltimo || '-'),
              imagen_adjunta: '',
            },
          } as Inventario;
        })
        .filter((x: Inventario | null): x is Inventario => x != null);
      setPuestoInventorySource(normalized);
      return normalized;
    } catch (e) {
      console.error('Error loading inventory source from puestoArticulosSync:', e);
      setPuestoInventorySource([]);
      return [];
    }
  }, []);

  const getInventoryRowsForActivity = useCallback((activity: Actividad): Inventario[] => {
    const baseRows = Array.isArray(activity?.inventario) ? activity.inventario : [];
    if (!activity?.is_revision_equipo) return baseRows;
    if (!Array.isArray(puestoInventorySource) || puestoInventorySource.length === 0) return baseRows;
    const byId = new Map<number, Inventario>();
    for (const row of baseRows) byId.set(Number(row.id), row);
    return puestoInventorySource.map((src) => {
      const prev = byId.get(Number(src.id));
      if (!prev) return src;
      return {
        ...prev,
        ...src,
        id: Number(src.id),
        nombre: src.nombre || prev.nombre,
        cantidad_requerida: src.cantidad_requerida ?? prev.cantidad_requerida,
        cantidad_real: src.cantidad_real,
        estado: src.estado,
        observaciones: src.observaciones,
        revision_equipo: {
          ...(prev.revision_equipo || {}),
          ...(src.revision_equipo || {}),
        },
      } as Inventario;
    });
  }, [puestoInventorySource]);

  const upsertMarkedActivityInCache = useCallback(async (activity: Actividad, marked: boolean) => {
    try {
      const cacheStr = await AsyncStorage.getItem('activities_cache');
      const parsed = cacheStr ? JSON.parse(cacheStr) : [];
      const list = Array.isArray(parsed) ? parsed : [];
      const next = list.map((row: any) => {
        if (Number(row?.id) !== Number(activity.id)) return row;
        return patchActivityWithCurrentFormState(row, marked);
      });
      await AsyncStorage.setItem('activities_cache', JSON.stringify(next));
    } catch (e) {
      console.error('Error updating activities_cache mark state:', e);
    }
  }, [patchActivityWithCurrentFormState]);

  const applyPendingActionsOverActivities = useCallback(async (rows: any[]): Promise<any[]> => {
    const base = Array.isArray(rows) ? rows : [];
    try {
      const actionsStr = await AsyncStorage.getItem('activities_actions');
      const actions = actionsStr ? JSON.parse(actionsStr) : [];
      if (!Array.isArray(actions) || actions.length === 0) return base;
      const markById = new Map<number, boolean>();
      for (const a of actions) {
        if (a?.type !== 'update') continue;
        const activityId = Number(a?.activity_id);
        if (!Number.isFinite(activityId) || activityId <= 0) continue;
        const estado = String(a?.requestData?.estado || '').toLowerCase();
        markById.set(activityId, estado === 'marcar');
      }
      if (markById.size === 0) return base;
      return base.map((row: any) => {
        const id = Number(row?.id);
        if (!markById.has(id)) return row;
        return patchActivityWithCurrentFormState(row, Boolean(markById.get(id)));
      });
    } catch {
      return base;
    }
  }, [patchActivityWithCurrentFormState]);

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
      await loadInventorySourceFromPuesto(currentMarcaData?.puesto?.id);
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
          const activeRows = (Array.isArray(data.actividades) ? data.actividades : []).filter(
            (r: any) => r?.isActive !== false
          );
          const withPending = await applyPendingActionsOverActivities(activeRows);
          setActivities(withPending);
          // Reemplazo completo del cache con la respuesta más reciente (limpieza + actualización)
          await AsyncStorage.setItem('activities_cache', JSON.stringify(withPending));
        } else {
          // Error real del servidor / lógica (sí cuenta como error)
          setError(data.message || 'Error al cargar las actividades');
        }
      } else {
        // Offline: load from cache
        const cachedActivities = await AsyncStorage.getItem('activities_cache');
        if (cachedActivities) {
          const parsedActivities = await applyPendingActionsOverActivities(JSON.parse(cachedActivities));
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
        const parsedActivities = await applyPendingActionsOverActivities(JSON.parse(cachedActivities));
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

  /** Día de la semana en inglés según la fecha (para repetición personalizada). */
  const weekdayKeyFromDate = (d: Date) => {
    const keys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
    return keys[d.getDay()];
  };

  /** Fecha local de calendario (mediodía) para evaluar día/mes sin desfases por zona. */
  const calendarDateFromPicker = (d: Date) => {
    if (!d || isNaN(d.getTime())) return new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
  };

  const resetCreateActivityForm = (horaAccion: number) => {
    setActivityName('');
    setActivityDescription('');
    const start = calendarDateFromPicker(new Date(horaAccion));
    setActivityStartDate(start);
    setShowStartDatePicker(false);
    setTipoActividad('Normal');
    setSelectedPuestoId('');
    setMarkedPlazaIds([]);
    setAssignedResponsables([]);
    setSignatureData(null);
    setSignatureEmployeeName(null);
    setCatalogError(null);
    setRepetitionType('custom');
    setCustomInterval('1');
    setCustomUnit('week');
    // Repetición semanal alineada al día de la fecha de inicio (no al “hoy” implícito sin picker)
    setSelectedWeekdays([weekdayKeyFromDate(start)]);
    setMonthOption('day-of-month');
    setYearMonth('1');
    setYearDay('1');
    setEndType('never');
    setEndDate('');
    setShowEndDatePicker(false);
    setActivityScheduleExpanded(false);
    setActivityScheduleSlots([]);
    setScheduleSlotPickerIndex(null);
    scheduleSlotPickerIndexRef.current = null;
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
      ]);
    } catch (error) {
      console.error('Error preparing activity form:', error);
      setCatalogError('No se pudieron cargar los catálogos. Intenta nuevamente.');
    } finally {
      setIsLoadingCatalogs(false);
    }
  };

  const preloadCreatedHierarchyFiltersFromMarca = useCallback(async (treeOverride?: MainStructureTree) => {
    try {
      const currentMarcaStr = await AsyncStorage.getItem('current_marca');
      if (!currentMarcaStr) return;
      const currentMarcaData = JSON.parse(currentMarcaStr);
      let tree: MainStructureTree = Array.isArray(treeOverride) ? treeOverride : structure;
      if (!Array.isArray(tree) || tree.length === 0) {
        tree = await loadMainStructureCache();
      }
      if (!Array.isArray(tree) || tree.length === 0) return;

      const empresaIdRaw = currentMarcaData?.empresa?.id ?? currentMarcaData?.empresa_id;
      const clienteIdRaw = currentMarcaData?.cliente?.id ?? currentMarcaData?.cliente_id;
      const contratoIdRaw = currentMarcaData?.contrato?.id ?? currentMarcaData?.contrato_id;
      const sucursalIdRaw = currentMarcaData?.corpo?.id ?? currentMarcaData?.corpo_id;
      const divisionIdRaw = getMarcaRoleDivisionId(currentMarcaData);

      const empresaId = empresaIdRaw != null ? Number(empresaIdRaw) : null;
      const clienteId = clienteIdRaw != null ? Number(clienteIdRaw) : null;
      const contratoId = contratoIdRaw != null ? Number(contratoIdRaw) : null;
      const sucursalId = sucursalIdRaw != null ? Number(sucursalIdRaw) : null;
      const divisionId = resolveDivisionIdInStructure(tree, empresaId, clienteId, divisionIdRaw);

      setSelectedEmpresaId(empresaId);
      setSelectedClienteId(clienteId);
      setSelectedDivisionId(divisionId);
      setSelectedContratoId(contratoId);
      setSelectedSucursalId(sucursalId);
      setSelectedPuestoFilterId(null);
      setCreatedActivities([]);
    } catch (error) {
      console.error('Error preloading hierarchy from current_marca:', error);
    }
  }, [structure, loadMainStructureCache]);

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
      const endDateStr = convertDateTimestampToLocalString(endDateObj.toISOString(), false);
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
    resetCreateActivityForm(horaAccion);
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
    resetCreateActivityForm(horaAccion);
    setIsCreateActivityVisible(false);
    setModuleStep('created');
    setIsEditingCreatedActivity(false);
    setEditingCreatedActivityId(null);
  };

  useEffect(() => {
    if (moduleStep !== 'created') return;
    preloadCreatedHierarchyFiltersFromMarca();
  }, [moduleStep, preloadCreatedHierarchyFiltersFromMarca]);

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
      const cal = calendarDateFromPicker(selectedDate);
      setActivityStartDate(cal);
      if (customUnit === 'week') {
        setSelectedWeekdays([weekdayKeyFromDate(cal)]);
      }
    }
  };

  const handleScheduleSlotTimeChange = (_event: any, selectedDate?: Date) => {
    const idx = scheduleSlotPickerIndexRef.current;
    if (Platform.OS === 'android') {
      setScheduleSlotPickerIndex(null);
      scheduleSlotPickerIndexRef.current = null;
    }
    if (selectedDate && idx !== null && idx >= 0) {
      const hm = activitiesHmFromDate(selectedDate);
      setActivityScheduleSlots((prev) => {
        const next = [...prev];
        if (idx < next.length) next[idx] = hm;
        return next;
      });
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

  useEffect(() => {
    if (!updPSelectedPuestoId) {
      setUpdPMarkedPlazaIds([]);
      return;
    }
    const puestoId = parseInt(updPSelectedPuestoId, 10);
    const existing = updPAssignedResponsables.find(
      (r) => r.puestoId === puestoId && !r.assignAll
    );
    if (existing) {
      setUpdPMarkedPlazaIds(existing.plazas.map((p: { plazaId: number }) => String(p.plazaId)));
    } else {
      setUpdPMarkedPlazaIds([]);
    }
  }, [updPSelectedPuestoId, updPAssignedResponsables]);

  const findCurrentMarca = async () => {
    const currentMarca = await AsyncStorage.getItem('current_marca');
    setRole(null);
    if (currentMarca) {
      const currentMarcaData = JSON.parse(currentMarca);
      setRole(currentMarcaData.roleDivision.role.nombre);
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

    const plazasToAdd = puesto.plazas.filter((plaza: any) =>
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
      .filter((plaza: any) => !(assignedEntry?.plazas.some(p => p.plazaId === plaza.id)))
      .map((plaza: any) => ({
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

  const normalizeInventoryArticle = (articulo: any): PuestoArticuloOption | null => {
    const articuloId = Number(articulo?.id);
    if (!Number.isFinite(articuloId) || articuloId <= 0) return null;
    const cantidadRaw = articulo?.cantidad_plan ?? articulo?.cantidad ?? 0;
    const cantidad = Number(cantidadRaw);
    return {
      id: articuloId,
      nombre: String(articulo?.nombre || 'Artículo'),
      tipo: articulo?.tipo ? String(articulo.tipo) : undefined,
      marca: articulo?.marca != null ? String(articulo.marca) : null,
      serie: articulo?.serie != null ? String(articulo.serie) : null,
      cantidad: Number.isFinite(cantidad) ? cantidad : 0,
      cantidad_plan: articulo?.cantidad_plan != null && Number.isFinite(Number(articulo?.cantidad_plan))
        ? Number(articulo.cantidad_plan)
        : null,
    };
  };

  const getPuestoInventoryArticles = useCallback((puestoId: number): PuestoArticuloOption[] => {
    const targetId = Number(puestoId);
    if (!Number.isFinite(targetId) || targetId <= 0) return [];
    for (const empresa of structure as any[]) {
      for (const cliente of empresa?.clientes || []) {
        for (const division of cliente?.division || []) {
          for (const contrato of division?.contratos || []) {
            for (const sucursal of contrato?.sucursales || []) {
              for (const puesto of sucursal?.puestos || []) {
                if (Number(puesto?.id) !== targetId) continue;
                const source = Array.isArray(puesto?.articulos) ? puesto.articulos : [];
                return source
                  .map((art: any) => normalizeInventoryArticle(art))
                  .filter((art: PuestoArticuloOption | null): art is PuestoArticuloOption => art != null);
              }
            }
          }
        }
      }
    }
    return [];
  }, [structure]);

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

  const assignedInventoryArticleEntries = useMemo<ActivityInventoryArticleEntry[]>(() => {
    const entries: ActivityInventoryArticleEntry[] = [];
    const dedupe = new Set<string>();
    for (const responsable of assignedResponsables) {
      const puestoArticles = getPuestoInventoryArticles(responsable.puestoId);
      for (const article of puestoArticles) {
        const uniqueKey = `${responsable.puestoId}:${article.tipo || ''}:${article.id}`;
        if (dedupe.has(uniqueKey)) continue;
        dedupe.add(uniqueKey);
        entries.push({
          puestoId: responsable.puestoId,
          puestoNombre: responsable.puestoNombre,
          articuloId: article.id,
          articuloNombre: article.nombre,
          tipo: article.tipo,
          marca: article.marca ?? null,
          serie: article.serie ?? null,
          cantidad: Number(article.cantidad_plan ?? article.cantidad ?? 0),
        });
      }
    }
    return entries;
  }, [assignedResponsables, getPuestoInventoryArticles]);

  const validateCreateActivityForm = () => {
    if (!activityName.trim()) {
      return 'Debes ingresar el nombre de la actividad.';
    }
    if (!activityDescription.trim()) {
      return 'Debes ingresar la descripción de la actividad.';
    }
    if (!isEditingCreatedActivity) {
    if (assignedResponsables.length === 0) {
      return 'Debes asignar al menos un puesto o plaza responsable.';
    }
    if (assignedResponsables.some(r => !r.assignAll && r.plazas.length === 0)) {
      return 'Las asignaciones por puesto deben incluir al menos una plaza o marcarse como puesto completo.';
    }
    if (tipoActividad === 'Inventario') {
        if (assignedInventoryArticleEntries.length === 0) {
          return 'Los puestos seleccionados no tienen artículos de inventario en la jerarquía cargada.';
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
      const frequencyConfig = buildFrequencyConfig();
      const frequencyString = JSON.stringify(frequencyConfig);

      const reglasPayload = tipoActividad === 'Inventario'
        ? assignedInventoryArticleEntries.map((article) => ({
            id: article.articuloId,
            puesto_id: article.puestoId,
            puesto_nombre: article.puestoNombre,
            tipo: article.tipo || null,
            marca: article.marca || null,
            serie: article.serie || null,
            cantidad: Number.isFinite(Number(article.cantidad)) ? Number(article.cantidad) : 0,
            reglas: [],
          }))
        : [];

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
              nombre_actividad: activityName.trim(),
              descripcion_actividad: activityDescription.trim(),
              fecha_inicio: fechaInicioStr,
              fecha_fin: fechaFinValue,
              frecuencia: frequencyString,
              es_revision_equipo: tipoActividad === 'Inventario',
              firma_responsable: signatureData?.raw || '',
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
    const confirmationMessage = isEditingCreatedActivity
      ? '¿Deseas actualizar esta actividad?'
      : selectedPuestosCount > 100
        ? `Se seleccionaron ${selectedPuestosCount} puestos. El proceso puede tardar un tiempo. ¿Deseas continuar?`
        : '¿Deseas crear esta actividad?';

    Alert.alert(
      'Confirmar',
      confirmationMessage,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Aceptar', onPress: submitCreateActivity },
      ],
      { cancelable: false }
    );
  };

  const buildFrequencyConfig = () => {
    const baseDate = calendarDateFromPicker(activityStartDate || new Date());
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
        config.weekdays =
          selectedWeekdays.length > 0 ? selectedWeekdays : [weekdayKeyFromDate(baseDate)];
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

    const scheduleClean = [
      ...new Set(
        activityScheduleSlots.map((s) => String(s).trim()).filter(activitiesHmOkStr)
      ),
    ].sort();
    if (scheduleClean.length > 0) {
      config.schedule = scheduleClean;
    }

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
        base64: false,
        quality: 0.7,
        skipProcessing: false,
      });

      if (!photo?.uri) {
        Alert.alert('Error', 'No se pudo capturar la foto. Por favor intente nuevamente.');
        setIsCameraVisible(false);
        return;
      }

        setIsCameraVisible(false);

      let storedFileName: string;
      try {
        storedFileName = await saveFile({
          uri: photo.uri,
          originalName: 'foto',
          extension: 'jpg',
          type: 'image',
          prefix: ACTIVITIES_MARK_PHOTO_PREFIX,
        });
      } catch (saveErr) {
        console.error('[Activities] saveFile failed:', saveErr);
        Alert.alert('Error', 'No se pudo guardar la foto en el dispositivo');
        return;
      }

      setTimeout(() => {
        if (cameraTarget === 'activity') {
          setActivityImageLocalFileName((prev) => {
            if (prev) void deleteFile(prev).catch(() => {});
            return storedFileName;
          });
        } else if (cameraTarget === 'inventory' && targetInventoryId !== null) {
          const tid = targetInventoryId;
          setInventoryImages((prev) => {
            const old = prev[tid];
            if (old) void deleteFile(old).catch(() => {});
            return { ...prev, [tid]: storedFileName };
          });
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
    setActivityImageLocalFileName((prev) => {
      if (prev) void deleteFile(prev).catch(() => {});
      return null;
    });
    setIsBitacoraModalVisible(true);
  };

  const executeToggleActivity = async (
    activity: Actividad,
    estado: 'marcar' | 'desmarcar',
    bitacora: string | null,
    activityLocalImageFileName: string | null,
  ) => {
    if (!employee?.id) {
      Alert.alert('Error', 'No se encontró la información necesaria del empleado.');
      return;
    }

    const invImgSnap = { ...inventoryImages };
    const inventoryRows = getInventoryRowsForActivity(activity);

    const horaAccionNumber = await getHoraAccion();
    if (!horaAccionNumber) {
      Alert.alert('Error', 'No se pudo obtener la hora de acción');
          return;
        }
    const horaAccionIso = new Date(horaAccionNumber).toISOString();

    const isConnected = await getConnectionStatus();

    const requestData: any = {
      e: parseInt(employee.id),
      estado: estado,
      bitacora: bitacora || '-',
      hora_accion: horaAccionIso,
    };

    // Para actividades de revisión de equipo, enviar también el estado actual de los artículos mostrado en la tabla
    if (estado === 'marcar' && activity.is_revision_equipo && inventoryRows.length > 0) {
      requestData.articles_state = inventoryRows.map((inv) => {
        const form = getArticleFormState(activity.id, inv);
        return {
          id: inv.id,
          estado: form.estado,
          cantidad_real: form.cantidadReal,
          observaciones: form.observaciones?.trim() || '',
        };
      });
    }

    if (activityLocalImageFileName) {
      requestData.file_local_file_name = activityLocalImageFileName;
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
          await upsertMarkedActivityInCache(activity, estado === 'marcar');
          if (activityLocalImageFileName) {
            await deleteFile(activityLocalImageFileName).catch(() => {});
          }

          // Sincronizar solo para actividades de inventario.
          if (activity.is_revision_equipo) {
            await updateMainStructureCacheFromActivities(activity);
            await updateActivitiesCacheFromActivities();
          }

          if (estado === 'marcar' && activity.is_revision_equipo && inventoryRows.length > 0 && employee?.id) {
            const { updateRevisionEquipo } = await import('@/hooks/activitiesFunctions');
            for (const inv of inventoryRows) {
              const form = getArticleFormState(activity.id, inv);
              const revisionEquipoId = inv.revision_equipo?.id;
              if (!revisionEquipoId) continue;
              const revisionReq: any = {
                e: parseInt(employee.id),
                articulo_id: inv.id,
                es_correcto: form.estado === 'Bueno',
                motivo_incorrecto: form.estado === 'Bueno' ? '-' : (form.observaciones.trim() || '-'),
                estado: form.estado,
                cantidad_real: form.cantidadReal,
                hora_accion: horaAccionIso,
              };
              const imgLocal = invImgSnap[inv.id];
              if (imgLocal) {
                revisionReq.file_local_file_name = imgLocal;
              } else {
                revisionReq.file = null;
              }
              try {
                const revResult = await updateRevisionEquipo({
                  requestData: revisionReq,
                  revisionEquipoId,
                  refreshAccessToken,
                  logout,
                });
                if (revResult.status && imgLocal) {
                  await deleteFile(imgLocal).catch(() => {});
                }
              } catch (e) {
                console.error('Error actualizando artículo revisión:', e);
              }
            }
          }
          setInventoryImages({});
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

        if (existingActionIndex !== -1) {
          const prevFn = actions?.[existingActionIndex]?.requestData?.file_local_file_name;
          if (
            typeof prevFn === 'string' &&
            prevFn.trim() &&
            prevFn.trim() !== String(requestData?.file_local_file_name || '').trim()
          ) {
            await deleteFile(prevFn.trim()).catch(() => {});
          }
          // Replace existing action with new one (including new bitacora and image)
          actions[existingActionIndex] = {
            type: 'update',
            activity_id: activity.id,
            requestData,
            timestamp: horaAccionNumber,
          };
          Alert.alert('Acción actualizada', 'La acción se sincronizará cuando recuperes la conexión.');
        } else {
          // Add new action
          actions.push({
            type: 'update',
            activity_id: activity.id,
            requestData,
            timestamp: horaAccionNumber,
          });
          Alert.alert('Guardado offline', 'La acción se sincronizará cuando recuperes la conexión.');
        }

        await AsyncStorage.setItem('activities_actions', JSON.stringify(actions));

        // Update cache siempre (offline también)
        await upsertMarkedActivityInCache(activity, estado === 'marcar');

        // Sincronizar solo para actividades de inventario (offline también)
        if (activity.is_revision_equipo) {
          await updateMainStructureCacheFromActivities(activity);
          await updateActivitiesCacheFromActivities();
        }

        // Reload activities list after offline update
        setInventoryImages({});
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
    executeToggleActivity(selectedActivity, 'marcar', bitacora, activityImageLocalFileName);
    setSelectedActivity(null);
    setBitacoraText('');
    setActivityImageLocalFileName(null);
  };

  const handleBitacoraCancel = () => {
    setIsBitacoraModalVisible(false);
    setSelectedActivity(null);
    setBitacoraText('');
    setActivityImageLocalFileName((prev) => {
      if (prev) void deleteFile(prev).catch(() => {});
      return null;
    });
  };

  const renderActivityItem = (activity: Actividad) => {
    const inventoryRows = getInventoryRowsForActivity(activity);
    return (
      <ActivityItemComponent
        key={activity.id}
        activity={activity}
        inventoryRows={inventoryRows}
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
            const fn = prev[inventoryId];
            if (fn) void deleteFile(fn).catch(() => {});
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

  const empresasOptions = useMemo(
    () => (Array.isArray(structure) ? structure : []),
    [structure],
  );

  const selectedEmpresa = useMemo(
    () => empresasOptions.find((e: any) => Number(e.id) === Number(selectedEmpresaId)) || null,
    [empresasOptions, selectedEmpresaId],
  );

  const clientesOptions = useMemo(() => {
    if (selectedEmpresaId == null) return [];
    const empresa = empresasOptions.find((e: any) => Number(e.id) === Number(selectedEmpresaId));
    return Array.isArray(empresa?.clientes) ? empresa.clientes : [];
  }, [empresasOptions, selectedEmpresaId]);

  const selectedCliente = useMemo(
    () => clientesOptions.find((c: any) => Number(c.id) === Number(selectedClienteId)) || null,
    [clientesOptions, selectedClienteId],
  );

  const divisionesOptions = useMemo(() => {
    if (selectedEmpresaId == null || selectedClienteId == null) return [];
    const empresa = empresasOptions.find((e: any) => Number(e.id) === Number(selectedEmpresaId));
    const cliente = empresa?.clientes?.find((c: any) => Number(c.id) === Number(selectedClienteId));
    if (Array.isArray(cliente?.division)) return cliente.division;
    return Array.isArray((cliente as any)?.divisiones) ? (cliente as any).divisiones : [];
  }, [empresasOptions, selectedEmpresaId, selectedClienteId]);

  const selectedDivision = useMemo(
    () => divisionesOptions.find((d: any) => Number(d.id) === Number(selectedDivisionId)) || null,
    [divisionesOptions, selectedDivisionId],
  );

  const contratosOptions = useMemo(() => {
    if (selectedDivisionId == null) return [];
    const division = divisionesOptions.find((d: any) => Number(d.id) === Number(selectedDivisionId));
    return Array.isArray(division?.contratos) ? division.contratos : [];
  }, [divisionesOptions, selectedDivisionId]);

  const selectedContrato = useMemo(
    () => contratosOptions.find((c: any) => Number(c.id) === Number(selectedContratoId)) || null,
    [contratosOptions, selectedContratoId],
  );

  const sucursalesOptions = useMemo(() => {
    if (selectedContratoId == null) return [];
    const contrato = contratosOptions.find((c: any) => Number(c.id) === Number(selectedContratoId));
    return Array.isArray(contrato?.sucursales) ? contrato.sucursales : [];
  }, [contratosOptions, selectedContratoId]);

  const selectedSucursal = useMemo(
    () => sucursalesOptions.find((s: any) => Number(s.id) === Number(selectedSucursalId)) || null,
    [sucursalesOptions, selectedSucursalId],
  );

  const normalizeDivisionName = (name: string) =>
    String(name || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  const getUniquePuestos = (puestos: any[]) => {
    const map = new Map<number, any>();
    for (const puesto of Array.isArray(puestos) ? puestos : []) {
      const id = Number(puesto?.id);
      if (!id || map.has(id)) continue;
      map.set(id, puesto);
    }
    return Array.from(map.values());
  };

  /** Puestos desde el árbol mergeado (incluye plazas/artículos enlazados por fragmentos). */
  const puestosOptionsFromHierarchy = useMemo<any[]>(() => {
    if (!selectedEmpresaId || !Array.isArray(structure) || structure.length === 0) return [];
    const empresa = structure.find((x: any) => Number(x.id) === Number(selectedEmpresaId));
    if (!empresa) return [];
    const pool: any[] = [];
    for (const c of empresa.clientes || []) {
      if (selectedClienteId && Number(c.id) !== Number(selectedClienteId)) continue;
      for (const d of c.division || []) {
        if (selectedDivisionId && Number(d.id) !== Number(selectedDivisionId)) continue;
        for (const ct of d.contratos || []) {
          if (selectedContratoId && Number(ct.id) !== Number(selectedContratoId)) continue;
          for (const s of ct.sucursales || []) {
            if (selectedSucursalId && Number(s.id) !== Number(selectedSucursalId)) continue;
            pool.push(...(s.puestos || []));
          }
        }
      }
    }
    return getUniquePuestos(pool);
  }, [
    structure,
    selectedEmpresaId,
    selectedClienteId,
    selectedDivisionId,
    selectedContratoId,
    selectedSucursalId,
  ]);

  const divisionMassiveOptions = useMemo<Array<{ id: number; nombre: string }>>(() => {
    const targetNames = ['seguridad', 'aseo y limpieza'];
    const fallbackByName: Record<string, { id: number; nombre: string }> = {
      seguridad: { id: 4, nombre: 'Seguridad' },
      'aseo y limpieza': { id: 5, nombre: 'Aseo y limpieza' },
    };
    const picked = new Map<string, { id: number; nombre: string }>();
    for (const empresa of structure || []) {
      for (const cliente of empresa?.clientes || []) {
        for (const division of cliente?.division || []) {
          const id = Number(division?.id);
          const nombre = String(division?.nombre || '').trim();
          const normalized = normalizeDivisionName(nombre);
          if (!id || !targetNames.includes(normalized) || picked.has(normalized)) continue;
          picked.set(normalized, { id, nombre });
        }
      }
    }
    return targetNames
      .map((name) => picked.get(name) || fallbackByName[name])
      .filter((item): item is { id: number; nombre: string } => !!item);
  }, [structure]);

  const filteredPuestos: any[] = selectedPuestoFilterId
    ? puestosOptionsFromHierarchy.filter((p: any) => p.id === selectedPuestoFilterId)
    : puestosOptionsFromHierarchy;

  // Igual que en JobManuals: recorre el árbol mergeado y agrega
  // todos los puestos de contratos/sucursales de la división seleccionada.
  const getDivisionPuestos = useCallback((divisionId: number): any[] => {
    if (!structure || structure.length === 0) return [];
    const seen = new Set<number>();
    const out: any[] = [];

    for (const empresa of structure as any[]) {
      for (const cliente of empresa?.clientes || []) {
        for (const division of cliente?.division || []) {
          if (Number(division?.id) !== Number(divisionId)) continue;
          for (const contrato of division?.contratos || []) {
            for (const sucursal of contrato?.sucursales || []) {
              for (const puesto of sucursal?.puestos || []) {
                const puestoId = Number(puesto?.id);
                if (!puestoId || seen.has(puestoId)) continue;
                seen.add(puestoId);
                out.push(puesto);
              }
            }
          }
        }
      }
    }

    return out;
  }, [structure]);

  const effectivePuestos = assignToAllDivision && selectedDivisionForAll
    ? getDivisionPuestos(selectedDivisionForAll)
    : filteredPuestos;

  const updPEmpresa = useMemo(
    () => empresasOptions.find((e: any) => Number(e.id) === Number(updPEmpresaId)) || null,
    [empresasOptions, updPEmpresaId],
  );

  const updPClientesOptions = useMemo(() => {
    if (updPEmpresaId == null) return [];
    const empresa = empresasOptions.find((e: any) => Number(e.id) === Number(updPEmpresaId));
    return Array.isArray(empresa?.clientes) ? empresa.clientes : [];
  }, [empresasOptions, updPEmpresaId]);

  const updPSelectedCliente = useMemo(
    () => updPClientesOptions.find((c: any) => Number(c.id) === Number(updPClienteId)) || null,
    [updPClientesOptions, updPClienteId],
  );

  const updPDivisionesOptions = useMemo(() => {
    if (updPEmpresaId == null || updPClienteId == null) return [];
    const empresa = empresasOptions.find((e: any) => Number(e.id) === Number(updPEmpresaId));
    const cliente = empresa?.clientes?.find((c: any) => Number(c.id) === Number(updPClienteId));
    if (Array.isArray(cliente?.division)) return cliente.division;
    return Array.isArray((cliente as any)?.divisiones) ? (cliente as any).divisiones : [];
  }, [empresasOptions, updPEmpresaId, updPClienteId]);

  const updPSelectedDivision = useMemo(
    () => updPDivisionesOptions.find((d: any) => Number(d.id) === Number(updPDivisionId)) || null,
    [updPDivisionesOptions, updPDivisionId],
  );

  const updPContratosOptions = useMemo(() => {
    if (updPDivisionId == null) return [];
    const division = updPDivisionesOptions.find((d: any) => Number(d.id) === Number(updPDivisionId));
    return Array.isArray(division?.contratos) ? division.contratos : [];
  }, [updPDivisionesOptions, updPDivisionId]);

  const updPSelectedContrato = useMemo(
    () => updPContratosOptions.find((c: any) => Number(c.id) === Number(updPContratoId)) || null,
    [updPContratosOptions, updPContratoId],
  );

  const updPSucursalesOptions = useMemo(() => {
    if (updPContratoId == null) return [];
    const contrato = updPContratosOptions.find((c: any) => Number(c.id) === Number(updPContratoId));
    return Array.isArray(contrato?.sucursales) ? contrato.sucursales : [];
  }, [updPContratosOptions, updPContratoId]);

  const updPSelectedSucursal = useMemo(
    () => updPSucursalesOptions.find((s: any) => Number(s.id) === Number(updPSucursalId)) || null,
    [updPSucursalesOptions, updPSucursalId],
  );

  const updPFilteredPuestos = useMemo(() => {
    if (!updPEmpresaId || !Array.isArray(structure) || structure.length === 0) return [];
    const empresa = structure.find((x: any) => Number(x.id) === Number(updPEmpresaId));
    if (!empresa) return [];
    const pool: any[] = [];
    for (const c of empresa.clientes || []) {
      if (updPClienteId && Number(c.id) !== Number(updPClienteId)) continue;
      for (const d of c.division || []) {
        if (updPDivisionId && Number(d.id) !== Number(updPDivisionId)) continue;
        for (const ct of d.contratos || []) {
          if (updPContratoId && Number(ct.id) !== Number(updPContratoId)) continue;
          for (const s of ct.sucursales || []) {
            if (updPSucursalId && Number(s.id) !== Number(updPSucursalId)) continue;
            pool.push(...(s.puestos || []));
          }
        }
      }
    }
    return getUniquePuestos(pool);
  }, [structure, updPEmpresaId, updPClienteId, updPDivisionId, updPContratoId, updPSucursalId]);

  const updPEffectivePuestos =
    updPAssignAllDivision && updPSelectedDivisionForAll
      ? getDivisionPuestos(updPSelectedDivisionForAll)
      : updPFilteredPuestos;

  const updPSelectedPuesto = updPSelectedPuestoId
    ? updPEffectivePuestos.find((p: any) => p.id === parseInt(updPSelectedPuestoId, 10))
    : null;
  const updPSelectedPuestoEntry = updPSelectedPuesto
    ? updPAssignedResponsables.find((r) => r.puestoId === updPSelectedPuesto.id)
    : null;
  const updPSelectedPuestoPlazas = updPSelectedPuesto?.plazas || [];
  const updPCanAssignEntirePuesto = Boolean(updPSelectedPuesto && !updPSelectedPuestoEntry);

  const resetUpdPHierarchyBelowEmpresa = () => {
    setUpdPClienteId(null);
    setUpdPDivisionId(null);
    setUpdPContratoId(null);
    setUpdPSucursalId(null);
  };
  const resetUpdPHierarchyBelowCliente = () => {
    setUpdPDivisionId(null);
    setUpdPContratoId(null);
    setUpdPSucursalId(null);
  };
  const resetUpdPHierarchyBelowDivision = () => {
    setUpdPContratoId(null);
    setUpdPSucursalId(null);
  };
  const resetUpdPHierarchyBelowContrato = () => {
    setUpdPSucursalId(null);
  };

  const handleConfirmPuestosSelection = () => {
    if (assignToAllDivision && !selectedDivisionForAll) {
      Alert.alert('Validación', 'Selecciona una división para asignar todos sus puestos.');
      return;
    }
    const uniquePuestosCount = Array.from(new Set(effectivePuestos.map((p: any) => p.id))).length;
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
                effectivePuestos.map((puesto: any) => ({
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
      effectivePuestos.map((puesto: any) => ({
        puestoId: puesto.id,
        puestoNombre: puesto.nombre,
        assignAll: true,
        plazas: [],
      }))
    );
    setIsSelectedPuestosExpanded(false);
    Alert.alert('Listo', `Se utilizarán ${uniquePuestosCount} puestos en el formulario.`);
  };

  const handleUpdPConfirmPuestosSelection = () => {
    if (updPAssignAllDivision && !updPSelectedDivisionForAll) {
      Alert.alert('Validación', 'Selecciona una división para asignar todos sus puestos.');
      return;
    }
    const uniquePuestosCount = Array.from(new Set(updPEffectivePuestos.map((p: any) => p.id))).length;
    if (uniquePuestosCount === 0) {
      Alert.alert('Validación', 'Selecciona una jerarquía válida para obtener puestos.');
      return;
    }
    const applyBulk = () => {
      setUpdPAssignedResponsables(
        updPEffectivePuestos.map((puesto: any) => ({
          puestoId: puesto.id,
          puestoNombre: puesto.nombre,
          assignAll: true,
          plazas: [],
        }))
      );
      setUpdPIsSelectedPuestosExpanded(false);
    };
    if (uniquePuestosCount > 100) {
      Alert.alert(
        'Confirmación',
        `Se seleccionarán ${uniquePuestosCount} puestos. Este proceso puede tardar más de lo normal.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Confirmar', style: 'default', onPress: applyBulk },
        ]
      );
      return;
    }
    applyBulk();
    Alert.alert('Listo', `Se utilizarán ${uniquePuestosCount} puestos. Pulsa "Guardar" para vincularlos a la actividad.`);
  };

  const handleUpdPSelectPuesto = (value: string) => {
    setUpdPSelectedPuestoId(value);
    if (!value) {
      setUpdPMarkedPlazaIds([]);
      return;
    }
    const puestoId = parseInt(value, 10);
    const existing = updPAssignedResponsables.find((r) => r.puestoId === puestoId && !r.assignAll);
    if (existing) {
      setUpdPMarkedPlazaIds(existing.plazas.map((p: { plazaId: number }) => String(p.plazaId)));
    } else {
      setUpdPMarkedPlazaIds([]);
    }
  };

  const handleUpdPAddSelectedPlazas = () => {
    if (!updPSelectedPuestoId) {
      Alert.alert('Validación', 'Selecciona un puesto.');
      return;
    }
    const puestoId = parseInt(updPSelectedPuestoId, 10);
    const puesto = updPEffectivePuestos.find((p: any) => p.id === puestoId);
    if (!puesto) {
      Alert.alert('Validación', 'El puesto seleccionado no es válido.');
      return;
    }
    if (updPMarkedPlazaIds.length === 0) {
      Alert.alert('Validación', 'Selecciona al menos una plaza de la lista.');
      return;
    }
    const plazasToAdd = puesto.plazas.filter((plaza: any) => updPMarkedPlazaIds.includes(String(plaza.id)));
    if (plazasToAdd.length === 0) {
      Alert.alert('Validación', 'Las plazas seleccionadas no son válidas para este puesto.');
      return;
    }
    const assignedEntry = updPAssignedResponsables.find((r) => r.puestoId === puestoId);
    if (assignedEntry?.assignAll) {
      Alert.alert('Aviso', 'La actividad ya incluye este puesto completo en la selección.');
      return;
    }
    const newPlazaRecords = plazasToAdd
      .filter((plaza: any) => !(assignedEntry?.plazas.some((p) => p.plazaId === plaza.id)))
      .map((plaza: any) => ({
        plazaId: plaza.id,
        plazaNombre: formatPlazaLabel(plaza),
      }));
    if (newPlazaRecords.length === 0) {
      Alert.alert('Aviso', 'Las plazas seleccionadas ya fueron agregadas.');
      return;
    }
    setUpdPAssignedResponsables((prev) => {
      const existingRow = prev.find((r) => r.puestoId === puestoId);
      if (existingRow) {
        return prev.map((r) =>
          r.puestoId === puestoId
            ? { ...r, plazas: [...r.plazas, ...newPlazaRecords] }
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

  const handleUpdPAssignPuestoCompleto = () => {
    if (!updPSelectedPuestoId) {
      Alert.alert('Validación', 'Selecciona un puesto.');
      return;
    }
    const puestoId = parseInt(updPSelectedPuestoId, 10);
    const puesto = updPEffectivePuestos.find((p: any) => p.id === puestoId);
    if (!puesto) {
      Alert.alert('Validación', 'El puesto seleccionado no es válido.');
      return;
    }
    if (updPAssignedResponsables.some((r) => r.puestoId === puestoId)) {
      Alert.alert('Aviso', 'Ya agregaste plazas o este puesto completo.');
      return;
    }
    setUpdPAssignedResponsables((prev) => [
      ...prev,
      {
        puestoId,
        puestoNombre: puesto.nombre,
        assignAll: true,
        plazas: [],
      },
    ]);
  };

  const toggleUpdPPlazaSelection = (plazaId: string) => {
    if (updPSelectedPuestoEntry?.assignAll) return;
    setUpdPMarkedPlazaIds((prev) =>
      prev.includes(plazaId) ? prev.filter((id) => id !== plazaId) : [...prev, plazaId]
    );
  };

  const handleUpdPRemovePuesto = (puestoId: number) => {
    setUpdPAssignedResponsables((prev) => prev.filter((r) => r.puestoId !== puestoId));
  };

  const handleUpdPRemovePlaza = (puestoId: number, plazaId: number) => {
    setUpdPAssignedResponsables((prev) =>
      prev
        .map((r) =>
          r.puestoId === puestoId
            ? { ...r, plazas: r.plazas.filter((p) => p.plazaId !== plazaId) }
            : r
        )
        .filter((r) => r.assignAll || r.plazas.length > 0)
    );
  };

  const closeUpdatePuestosModal = () => {
    setIsUpdPuestosModalVisible(false);
    setUpdPuestosActivity(null);
    setUpdPSubmitting(false);
  };

  const openUpdatePuestosModal = async (item: CreatedActivityItem) => {
    try {
      const isConnected = await getConnectionStatus();
      if (!isConnected) {
        Alert.alert('Sin conexión', 'Este submódulo funciona exclusivamente con internet.');
        return;
      }
      let tree: MainStructureTree = structure;
      if (!Array.isArray(tree) || tree.length === 0) {
        tree = await loadMainStructureCache();
      }
      setUpdPuestosActivity(item);
      setUpdPAssignAllDivision(false);
      setUpdPSelectedDivisionForAll(null);
      setUpdPSelectedPuestoId('');
      setUpdPMarkedPlazaIds([]);
      setUpdPAssignedResponsables([]);
      setUpdPIsSelectedPuestosExpanded(false);
      try {
        const currentMarcaStr = await AsyncStorage.getItem('current_marca');
        if (currentMarcaStr) {
          const currentMarcaData = JSON.parse(currentMarcaStr);
          const empresaIdRaw = currentMarcaData?.empresa?.id ?? currentMarcaData?.empresa_id;
          const clienteIdRaw = currentMarcaData?.cliente?.id ?? currentMarcaData?.cliente_id;
          const contratoIdRaw = currentMarcaData?.contrato?.id ?? currentMarcaData?.contrato_id;
          const sucursalIdRaw = currentMarcaData?.corpo?.id ?? currentMarcaData?.corpo_id;
          const divisionIdRaw = getMarcaRoleDivisionId(currentMarcaData);
          const empresaId = empresaIdRaw != null ? Number(empresaIdRaw) : null;
          const clienteId = clienteIdRaw != null ? Number(clienteIdRaw) : null;
          const contratoId = contratoIdRaw != null ? Number(contratoIdRaw) : null;
          const sucursalId = sucursalIdRaw != null ? Number(sucursalIdRaw) : null;
          const divisionId = resolveDivisionIdInStructure(tree, empresaId, clienteId, divisionIdRaw);
          setUpdPEmpresaId(empresaId);
          setUpdPClienteId(clienteId);
          setUpdPDivisionId(divisionId);
          setUpdPContratoId(contratoId);
          setUpdPSucursalId(sucursalId);
        } else {
          setUpdPEmpresaId(null);
          resetUpdPHierarchyBelowEmpresa();
        }
      } catch {
        setUpdPEmpresaId(null);
        resetUpdPHierarchyBelowEmpresa();
      }
      setIsUpdPuestosModalVisible(true);
    } catch (e) {
      console.error('openUpdatePuestosModal', e);
      Alert.alert('Error', 'No se pudo abrir el formulario.');
    }
  };

  const submitUpdatePuestosModal = async () => {
    if (!updPuestosActivity) return;
    const ids = Array.from(new Set(updPAssignedResponsables.map((r) => r.puestoId)));
    if (ids.length === 0) {
      Alert.alert('Validación', 'Selecciona al menos un puesto.');
      return;
    }
    try {
      const raw = await AsyncStorage.getItem('current_marca');
      if (!raw) {
        Alert.alert('Error', 'No se encontró la marca actual.');
        return;
      }
      const marca = JSON.parse(raw);
      const marcaId = Number(marca?.id);
      if (!Number.isFinite(marcaId) || marcaId <= 0) {
        Alert.alert('Error', 'Marca inválida.');
        return;
      }
      setUpdPSubmitting(true);
      const res = await appendCreatedActivityPuestos({
        activityId: updPuestosActivity.id,
        marcaId,
        puestosIds: ids,
        refreshAccessToken,
        logout,
      });
      if (res.status) {
        Alert.alert('Éxito', res.message || 'Puestos actualizados.');
        closeUpdatePuestosModal();
        if (selectedPuestoFilterId) {
          await fetchCreatedActivitiesByPuesto(selectedPuestoFilterId);
        }
        eventBus.emit('activitiesUpdated');
      } else {
        Alert.alert('Error', res.message || 'No se pudo actualizar.');
      }
    } catch (err) {
      console.error('submitUpdatePuestosModal', err);
      Alert.alert('Error', 'No se pudo completar la operación.');
    } finally {
      setUpdPSubmitting(false);
    }
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
        setExpandedCreatedActivityPuestosIds([]);
      } else {
        Alert.alert('Error', data.message || 'No se pudo cargar la lista de actividades creadas.');
      }
    } finally {
      setIsLoadingCreatedActivities(false);
    }
  }, [getConnectionStatus, logout, refreshAccessToken]);

  const toggleCreatedActivityPuestosExpanded = (activityId: number) => {
    setExpandedCreatedActivityPuestosIds((prev) =>
      prev.includes(activityId) ? prev.filter((id) => id !== activityId) : [...prev, activityId],
    );
  };

  const createdActivityPuestoUnlinkKey = (activityId: number, puestoId: number) => `${activityId}-${puestoId}`;

  const handleUnlinkCreatedActivityPuesto = (
    activityId: number,
    puesto: CreatedActivityPuestoVinculado,
  ) => {
    Alert.alert(
      'Desvincular puesto',
      `¿Deseas quitar el puesto "${puesto.nombre}" de esta actividad?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const isConnected = await getConnectionStatus();
            if (!isConnected) {
              Alert.alert('Sin conexión', 'Este submódulo funciona exclusivamente con internet.');
              return;
            }
            const unlinkKey = createdActivityPuestoUnlinkKey(activityId, puesto.id);
            try {
              setUnlinkingCreatedActivityPuestoKey(unlinkKey);
              const response = await unlinkCreatedActivityPuesto({
                activityId,
                puestoId: puesto.id,
                refreshAccessToken,
                logout,
              });
              if (!response.status) {
                Alert.alert('Error', response.message || 'No se pudo desvincular el puesto.');
                return;
              }
              if (selectedPuestoFilterId) {
                await fetchCreatedActivitiesByPuesto(selectedPuestoFilterId);
              } else {
                setCreatedActivities((prev) =>
                  prev.map((act) =>
                    act.id === activityId
                      ? {
                          ...act,
                          puestos_vinculados: (act.puestos_vinculados ?? []).filter(
                            (p) => p.id !== puesto.id,
                          ),
                        }
                      : act,
                  ),
                );
              }
            } finally {
              setUnlinkingCreatedActivityPuestoKey((prev) => (prev === unlinkKey ? null : prev));
            }
          },
        },
      ],
    );
  };

  const handleDuplicateCreatedActivity = async (activityId: number) => {
    const isConnected = await getConnectionStatus();
    if (!isConnected) {
      Alert.alert('Sin conexión', 'Este submódulo funciona exclusivamente con internet.');
      return;
    }
    Alert.alert('Duplicar actividad', '¿Deseas duplicar esta actividad y sus puestos vinculados?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Duplicar',
        onPress: async () => {
          try {
            setDuplicatingCreatedActivityId(activityId);
            const response = await duplicateCreatedActivity({ activityId, refreshAccessToken, logout });
            if (!response.status) {
              Alert.alert('Error', response.message || 'No se pudo duplicar la actividad.');
              return;
            }
            Alert.alert('Éxito', response.message || 'Actividad duplicada correctamente.');
            if (selectedPuestoFilterId) {
              await fetchCreatedActivitiesByPuesto(selectedPuestoFilterId);
            }
          } finally {
            setDuplicatingCreatedActivityId((prev) => (prev === activityId ? null : prev));
          }
        },
      },
    ]);
  };

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
          try {
            setDeletingCreatedActivityId(activityId);
            const response = await deleteCreatedActivity({ activityId, refreshAccessToken, logout });
            if (!response.status) {
              Alert.alert('Error', response.message || 'No se pudo eliminar la actividad.');
              return;
            }
            if (selectedPuestoFilterId) {
              await fetchCreatedActivitiesByPuesto(selectedPuestoFilterId);
            }
          } finally {
            setDeletingCreatedActivityId((prev) => (prev === activityId ? null : prev));
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
      schedule: 'Horario',
    };
    const orderedKeys = [
      'title', 'type', 'interval', 'unit', 'weekday', 'weekdays',
      'weekOrdinal', 'monthOption', 'month', 'day', 'endType', 'endDate',
      'schedule',
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
        `Hora: ${decoded.timestamp ? convertDateTimestampToLocalString(new Date(Number(decoded.timestamp)).toISOString()) : 'N/A'}`,
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

  const startEditCreatedActivity = async (activity: CreatedActivityItem) => {
    const horaAccion = await getHoraAccion();
    if (!horaAccion) {
      Alert.alert('Error', 'No se pudo obtener la hora de acción');
      return;
    }
    setEditingCreatedActivityId(activity.id);
    setIsEditingCreatedActivity(true);
    setActivityScheduleExpanded(false);
    setScheduleSlotPickerIndex(null);
    scheduleSlotPickerIndexRef.current = null;
    setActivityName(activity.nombre_actividad || '');
    setActivityDescription(activity.descripcion_actividad || '');
    const startCal = calendarDateFromPicker(
      activity.fecha_inicio ? new Date(activity.fecha_inicio) : new Date(horaAccion)
    );
    setActivityStartDate(startCal);
    setEndType('date');
    setEndDate(
      activity.fecha_fin
        ? formatDateForApi(new Date(activity.fecha_fin))
        : formatDateForApi(startCal)
    );
    try {
      const freq = activity.frecuencia ? JSON.parse(activity.frecuencia) : null;
      if (freq && typeof freq === 'object') {
        if (freq.type) setRepetitionType(freq.type);
        if (typeof freq.interval === 'number') setCustomInterval(String(freq.interval));
        if (freq.unit) setCustomUnit(freq.unit);
        if (Array.isArray(freq.weekdays) && freq.weekdays.length > 0) {
          setSelectedWeekdays(freq.weekdays);
        } else {
          setSelectedWeekdays([weekdayKeyFromDate(startCal)]);
        }
        if (freq.monthOption) setMonthOption(freq.monthOption);
        if (freq.endType) setEndType(freq.endType);
        if (freq.endDate) setEndDate(freq.endDate);
        if (freq.month != null) setYearMonth(String(freq.month));
        if (freq.day != null) setYearDay(String(freq.day));
        const sched = parseScheduleFromFrecuenciaJsonStore(activity.frecuencia);
        setActivityScheduleSlots(sched.length ? [...sched] : []);
      } else {
        setSelectedWeekdays([weekdayKeyFromDate(startCal)]);
        setActivityScheduleSlots([]);
      }
    } catch {
      setSelectedWeekdays([weekdayKeyFromDate(startCal)]);
      setActivityScheduleSlots([]);
    }
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
    try {
      const currentMarcaStr = await AsyncStorage.getItem('current_marca');
      if (currentMarcaStr) {
        const md = JSON.parse(currentMarcaStr);
        const mid = md?.id != null ? Number(md.id) : NaN;
        setCurrentMarcaId(Number.isFinite(mid) && mid > 0 ? mid : null);
      } else {
        setCurrentMarcaId(null);
      }
    } catch {
      setCurrentMarcaId(null);
    }
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
            <ScalePressButton
              style={styles.createButton}
              onPress={async () => {
                const isConnected = await getConnectionStatus();
                if (!isConnected) {
                  Alert.alert('Sin conexión', 'Este submódulo funciona exclusivamente con internet.');
                  return;
                }
                const tree = await loadMainStructureCache();
                await preloadCreatedHierarchyFiltersFromMarca(tree);
                setModuleStep('created');
              }}
            >
              <Ionicons name="add" size={20} color="#FFFFFF" />
            </ScalePressButton>
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
              <ScalePressButton style={styles.secondaryButtonOutline} onPress={() => setModuleStep('assigned')}>
                <Ionicons name="arrow-back" size={18} color="#007AFF" />
                <ThemedText style={styles.secondaryButtonOutlineText}>Volver a asignadas</ThemedText>
              </ScalePressButton>

              <ScalePressButton style={[styles.createButton, { marginTop: 10 }]} onPress={openRepetitionModal}>
                <Ionicons name="add" size={20} color="#fff" />
              </ScalePressButton>

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
                        <Picker.Item label="Selecciona empresa" value="" color="#000000" />
                        {empresasOptions.map((empresa) => (
                          <Picker.Item key={empresa.id} label={empresa.nombre} value={String(empresa.id)} color="#000000" />
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
                            <Picker.Item label="Selecciona cliente" value="" color="#000000" />
                            {clientesOptions.map((cliente: any) => (
                              <Picker.Item key={cliente.id} label={cliente.nombre} value={String(cliente.id)} color="#000000" />
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
                            <Picker.Item label="Selecciona división" value="" color="#000000" />
                            {divisionesOptions.map((division: any) => (
                              <Picker.Item key={division.id} label={division.nombre} value={String(division.id)} color="#000000" />
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
                            <Picker.Item label="Selecciona contrato" value="" color="#000000" />
                            {contratosOptions.map((contrato: any) => (
                              <Picker.Item key={contrato.id} label={contrato.nombre} value={String(contrato.id)} color="#000000" />
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
                            <Picker.Item label="Selecciona sucursal" value="" color="#000000" />
                            {sucursalesOptions.map((sucursal: any) => (
                              <Picker.Item key={sucursal.id} label={sucursal.nombre} value={String(sucursal.id)} color="#000000" />
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
                            <Picker.Item label="Selecciona puesto" value="" color="#000000" />
                            {puestosOptionsFromHierarchy.map((puesto) => (
                              <Picker.Item key={puesto.id} label={puesto.nombre} value={String(puesto.id)} color="#000000" />
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
                createdActivities.map((item) => {
                  const createdScheduleLbl = formatScheduleUiLabel(parseScheduleFromFrecuenciaJsonStore(item.frecuencia));
                  const puestosVinculados = Array.isArray(item.puestos_vinculados) ? item.puestos_vinculados : [];
                  const isPuestosExpanded = expandedCreatedActivityPuestosIds.includes(item.id);
                  return (
                  <ThemedView key={item.id} style={styles.assignedItem}>
                    <ThemedText style={styles.assignedTitle}>{item.nombre_actividad}</ThemedText>
                    <ThemedText style={styles.helperText}>{item.descripcion_actividad}</ThemedText>
                    {createdScheduleLbl ? (
                      <ThemedText style={[styles.helperText, { marginTop: 4 }]}>
                        {createdScheduleLbl}
                      </ThemedText>
                    ) : null}
                    <ThemedView style={styles.collapsableSection}>
                      <TouchableOpacity
                        style={styles.collapsableHeader}
                        onPress={() => toggleCreatedActivityPuestosExpanded(item.id)}
                        accessibilityRole="button"
                        accessibilityState={{ expanded: isPuestosExpanded }}
                      >
                        <ThemedText style={styles.collapsableHeaderText}>
                          {isPuestosExpanded
                            ? 'Ocultar puestos vinculados'
                            : `Puestos vinculados (${puestosVinculados.length})`}
                        </ThemedText>
                        <Ionicons
                          name={isPuestosExpanded ? 'chevron-up' : 'chevron-down'}
                          size={20}
                          color="#007AFF"
                        />
                      </TouchableOpacity>
                      {isPuestosExpanded ? (
                        <ThemedView style={styles.collapsableContent}>
                          {puestosVinculados.length === 0 ? (
                            <ThemedText style={styles.helperText}>No hay puestos vinculados.</ThemedText>
                          ) : (
                            puestosVinculados.map((puesto) => {
                              const unlinkKey = createdActivityPuestoUnlinkKey(item.id, puesto.id);
                              const isUnlinking = unlinkingCreatedActivityPuestoKey === unlinkKey;
                              return (
                              <ThemedView key={`${item.id}-puesto-${puesto.id}`} style={styles.linkedPuestoRow}>
                                <ThemedView style={styles.linkedPuestoInfo}>
                                  <ThemedText style={styles.linkedPuestoName}>{puesto.nombre}</ThemedText>
                                  {puesto.codigo ? (
                                    <ThemedText style={styles.linkedPuestoCode}>{puesto.codigo}</ThemedText>
                                  ) : null}
                                </ThemedView>
                                <TouchableOpacity
                                  style={styles.linkedPuestoDeleteButton}
                                  onPress={() => handleUnlinkCreatedActivityPuesto(item.id, puesto)}
                                  disabled={isUnlinking}
                                  accessibilityRole="button"
                                  accessibilityLabel={`Desvincular puesto ${puesto.nombre}`}
                                >
                                  {isUnlinking ? (
                                    <ActivityIndicator size="small" color="#F44336" />
                                  ) : (
                                    <Ionicons name="trash-outline" size={20} color="#F44336" />
                                  )}
                                </TouchableOpacity>
                              </ThemedView>
                              );
                            })
                          )}
                        </ThemedView>
                      ) : null}
                    </ThemedView>
                    <View style={[styles.modalButtons, { flexWrap: 'wrap' }]}>
                      <ScalePressButton
                        style={[styles.editButton, styles.createdActionButton]}
                        onPress={() => startEditCreatedActivity(item)}
                      >
                        <Ionicons name="pencil" size={18} color="#FFFFFF" />
                      </ScalePressButton>
                      <ScalePressButton
                        style={[styles.changesButton, styles.createdActionButton]}
                        onPress={() => handleViewCreatedActivityChanges(item.id)}
                      >
                        <Ionicons name="time-outline" size={18} color="#FFFFFF" />
                      </ScalePressButton>
                      <ScalePressButton
                        style={[
                          styles.duplicateButton,
                          styles.createdActionButton,
                          duplicatingCreatedActivityId === item.id && styles.modalButtonDisabled,
                        ]}
                        onPress={() => handleDuplicateCreatedActivity(item.id)}
                        disabled={
                          duplicatingCreatedActivityId === item.id || deletingCreatedActivityId === item.id
                        }
                      >
                        {duplicatingCreatedActivityId === item.id ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Ionicons name="copy-outline" size={18} color="#FFFFFF" />
                        )}
                      </ScalePressButton>
                      <ScalePressButton
                        style={[
                          styles.deleteButton,
                          styles.createdActionButton,
                          deletingCreatedActivityId === item.id && styles.modalButtonDisabled,
                        ]}
                        onPress={() => handleDeleteCreatedActivity(item.id)}
                        disabled={
                          deletingCreatedActivityId === item.id || duplicatingCreatedActivityId === item.id
                        }
                      >
                        {deletingCreatedActivityId === item.id ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Ionicons name="trash" size={18} color="#FFFFFF" />
                        )}
                      </ScalePressButton>
                    </View>
                    <ScalePressButton
                      style={[styles.secondaryButton, styles.createdActionButton, { minWidth: 120 }]}
                      onPress={() => openUpdatePuestosModal(item)}
                    >
                      <ThemedText style={styles.secondaryButtonText}>Actualizar puestos</ThemedText>
                    </ScalePressButton>
                  </ThemedView>
                  );
                })
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
                    {convertDateTimestampToLocalString(new Date(activityStartDate).toISOString(), false)}
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

                <TouchableOpacity
                  style={styles.dateButton}
                  activeOpacity={0.85}
                  onPress={() => {
                    setActivityScheduleExpanded((prev) => {
                      const next = !prev;
                      if (!next) {
                        setScheduleSlotPickerIndex(null);
                        scheduleSlotPickerIndexRef.current = null;
                      }
                      return next;
                    });
                  }}
                >
                  <ThemedText style={styles.dateButtonText}>Horario (opcional)</ThemedText>
                  <Ionicons name={activityScheduleExpanded ? 'chevron-up' : 'chevron-down'} size={20} color="#007AFF" />
                </TouchableOpacity>
                {activityScheduleExpanded ? (
                  <ThemedView style={{ marginBottom: 12 }}>
                    <ThemedText style={[styles.helperText, { marginBottom: 10 }]}>
                      Horas locales informativas (no afectan el marcado).
                    </ThemedText>
                    {activityScheduleSlots.map((slot, idx) => (
                      <ThemedView
                        key={`schedule-slot-${idx}`}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}
                      >
                        <TouchableOpacity
                          style={[styles.dateButton, { flex: 1, marginBottom: 0 }]}
                          onPress={() => {
                            scheduleSlotPickerIndexRef.current = idx;
                            setScheduleSlotPickerIndex(idx);
                          }}
                        >
                          <ThemedText style={styles.dateButtonText}>{slot}</ThemedText>
                          <Ionicons name="time-outline" size={20} color="#007AFF" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          accessibilityLabel="Eliminar hora"
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          onPress={() => {
                            setActivityScheduleSlots((prev) => prev.filter((_, j) => j !== idx));
                            setScheduleSlotPickerIndex(null);
                            scheduleSlotPickerIndexRef.current = null;
                          }}
                        >
                          <Ionicons name="trash-outline" size={22} color="#FF3B30" />
                        </TouchableOpacity>
                      </ThemedView>
                    ))}
                    <ScalePressButton
                      style={[styles.secondaryButton, { alignSelf: 'flex-start', minWidth: 140 }]}
                      onPress={() => {
                        setActivityScheduleSlots((prev) => [
                          ...prev,
                          prev.length ? prev[prev.length - 1] : '09:00',
                        ]);
                      }}
                    >
                      <ThemedText style={styles.secondaryButtonText}>Añadir hora</ThemedText>
                    </ScalePressButton>
                    {scheduleSlotPickerIndex !== null &&
                    scheduleSlotPickerIndex >= 0 &&
                    scheduleSlotPickerIndex < activityScheduleSlots.length ? (
                      <DateTimePicker
                        value={activitiesParseHmToLocalDate(
                          activityScheduleSlots[scheduleSlotPickerIndex] || '09:00'
                        )}
                        mode="time"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={handleScheduleSlotTimeChange}
                      />
                    ) : null}
                  </ThemedView>
                ) : null}

                <ThemedText style={styles.sectionTitle}>Tipo de actividad</ThemedText>
                <ThemedView style={styles.pickerContainer}>
                  <Picker
                    selectedValue={tipoActividad}
                    onValueChange={(value) => setTipoActividad(value as 'Normal' | 'Inventario')}
                    style={styles.picker}
                  >
                    <Picker.Item label="Normal" value="Normal" color="#000000" />
                    <Picker.Item label="Inventario" value="Inventario" color="#000000" />
                  </Picker>
                </ThemedView>

                {!isEditingCreatedActivity ? (
                <ThemedView style={styles.sectionCard}>
                  {catalogError ? (
                    <ThemedText style={styles.formErrorText}>{catalogError}</ThemedText>
                  ) : null}
                  {isLoadingCatalogs ? (
                    <ActivityIndicator size="small" color="#007AFF" />
                  ) : (
                    <>
                      <ThemedView style={styles.hierarchyModeToggleContainer}>
                        <TouchableOpacity
                          style={styles.hierarchyModeToggleRow}
                          onPress={() => {
                            const nextMode = !assignToAllDivision;
                            setAssignToAllDivision(nextMode);
                            setSelectedPuestoFilterId(null);
                            setSelectedPuestoId('');
                            if (!nextMode) {
                              setSelectedDivisionForAll(null);
                            }
                          }}
                        >
                          <Ionicons
                            name={assignToAllDivision ? 'checkbox' : 'square-outline'}
                            size={20}
                            color={assignToAllDivision ? '#007AFF' : '#999'}
                          />
                          <ThemedText style={styles.hierarchyModeToggleLabel}>
                            Asignar a todos los puestos de una división
                          </ThemedText>
                        </TouchableOpacity>
                      </ThemedView>

                      {assignToAllDivision ? (
                        <ThemedView style={styles.pickerContainer}>
                          <Picker
                            selectedValue={selectedDivisionForAll ? String(selectedDivisionForAll) : ''}
                            onValueChange={(v) => {
                              setSelectedDivisionForAll(v ? Number(v) : null);
                              setSelectedPuestoFilterId(null);
                              setSelectedPuestoId('');
                            }}
                            style={styles.picker}
                          >
                            <Picker.Item label="Selecciona división" value="" color="#000000" />
                            {divisionMassiveOptions.map((division: { id: number; nombre: string }) => (
                              <Picker.Item key={division.id} label={division.nombre} value={String(division.id)} color="#000000" />
                            ))}
                          </Picker>
                        </ThemedView>
                      ) : (
                        <>
                          <ThemedText style={styles.formLabel}>Jerarquía para puestos</ThemedText>
                          <ThemedView style={styles.pickerContainer}>
                            <Picker
                              selectedValue={selectedEmpresaId ? String(selectedEmpresaId) : ''}
                              onValueChange={(v) => { setSelectedEmpresaId(v ? Number(v) : null); resetHierarchyBelowEmpresa(); }}
                              style={styles.picker}
                            >
                              <Picker.Item label="Selecciona empresa" value="" color="#000000" />
                              {empresasOptions.map((empresa) => (
                                <Picker.Item key={empresa.id} label={empresa.nombre} value={String(empresa.id)} color="#000000" />
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
                                <Picker.Item label="Selecciona cliente" value="" color="#000000" />
                                {clientesOptions.map((cliente: any) => (
                                  <Picker.Item key={cliente.id} label={cliente.nombre} value={String(cliente.id)} color="#000000" />
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
                                <Picker.Item label="Selecciona división" value="" color="#000000" />
                                {divisionesOptions.map((division: any) => (
                                  <Picker.Item key={division.id} label={division.nombre} value={String(division.id)} color="#000000" />
                                ))}
                              </Picker>
                            </ThemedView>
                          )}
                          {!!selectedDivisionId && (
                            <ThemedView style={styles.pickerContainer}>
                              <Picker
                                selectedValue={selectedContratoId ? String(selectedContratoId) : ''}
                                onValueChange={(v) => { setSelectedContratoId(v ? Number(v) : null); resetHierarchyBelowContrato(); }}
                                style={styles.picker}
                              >
                                <Picker.Item label="Selecciona contrato" value="" color="#000000" />
                                {contratosOptions.map((contrato: any) => (
                                  <Picker.Item key={contrato.id} label={contrato.nombre} value={String(contrato.id)} color="#000000" />
                                ))}
                              </Picker>
                            </ThemedView>
                          )}
                          {!!selectedContratoId && (
                            <ThemedView style={styles.pickerContainer}>
                              <Picker
                                selectedValue={selectedSucursalId ? String(selectedSucursalId) : ''}
                                onValueChange={(v) => { setSelectedSucursalId(v ? Number(v) : null); resetHierarchyBelowSucursal(); }}
                                style={styles.picker}
                              >
                                <Picker.Item label="Selecciona sucursal" value="" color="#000000" />
                                {sucursalesOptions.map((sucursal: any) => (
                                  <Picker.Item key={sucursal.id} label={sucursal.nombre} value={String(sucursal.id)} color="#000000" />
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

                      {!!selectedSucursalId && (
                    <>
                      <ThemedText style={styles.formLabel}>Puestos</ThemedText>
                      <ThemedView style={styles.pickerContainer}>
                        <Picker
                          selectedValue={selectedPuestoId}
                          onValueChange={handleSelectPuesto}
                          style={styles.picker}
                        >
                              <Picker.Item label="Selecciona un puesto" value="" color="#000000" />
                              {effectivePuestos.map((puesto: any) => (
                                <Picker.Item key={puesto.id} label={puesto.nombre} value={String(puesto.id)} color="#000000" />
                          ))}
                        </Picker>
                      </ThemedView>
                        </>
                      )}

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
                                {selectedPuestoPlazas.map((plaza: any, index: number) => {
                                  const plazaIdStr = String(plaza.id);
                                  const isChecked = markedPlazaIds.includes(plazaIdStr);
                                  const employeesLabel = plaza.empleados && plaza.empleados.length > 0
                                    ? plaza.empleados.map((emp: any) => emp.nombre).join(', ')
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
                          <>
                            <TouchableOpacity
                              style={styles.selectedPuestosHeader}
                              onPress={() => setIsSelectedPuestosExpanded((prev) => !prev)}
                              activeOpacity={0.85}
                            >
                              <ThemedText style={styles.selectedPuestosHeaderText}>
                                Puestos seleccionados ({assignedResponsables.length})
                              </ThemedText>
                              <Ionicons
                                name={isSelectedPuestosExpanded ? 'chevron-up' : 'chevron-down'}
                                size={18}
                                color="#007AFF"
                              />
                            </TouchableOpacity>

                            {isSelectedPuestosExpanded &&
                              assignedResponsables.map((responsable) => (
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
                                    responsable.plazas.map((plaza) => (
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
                                  {tipoActividad === 'Inventario' && (
                                    <ThemedView style={styles.reglasContainer}>
                                      <ThemedText style={styles.reglasTitle}>
                                        Artículos del puesto
                                      </ThemedText>
                                      {/* Aqui debe hber una línea de separación */}
                                      <View style={styles.reglasSeparator} />
                                      <ThemedView style={styles.reglasContent}>
                                      {getPuestoInventoryArticles(responsable.puestoId).length === 0 ? (
                                        <ThemedText style={styles.helperText}>
                                          Este puesto no tiene artículos vinculados.
                                        </ThemedText>
                                      ) : (
                                        getPuestoInventoryArticles(responsable.puestoId).map((articulo) => (
                                          <View
                                            key={`${responsable.puestoId}-${articulo.tipo || ''}-${articulo.id}`}
                                            style={styles.reglaItem}
                                          >
                                            <ThemedText style={styles.reglaNombre}>
                                              {articulo.nombre}
                                            </ThemedText>
                                            <ThemedText style={styles.reglaValor}>
                                              • Marca: {articulo.marca || '-'}
                                            </ThemedText>
                                            <ThemedText style={styles.reglaValor}>
                                              • Serie: {articulo.serie || '-'}
                                            </ThemedText>
                                            <ThemedText style={styles.reglaValor}>
                                              • Cantidad: {Number(articulo.cantidad_plan ?? articulo.cantidad ?? 0)}
                                            </ThemedText>
                                          </View>
                          ))
                        )}
                      </ThemedView>
                                    </ThemedView>
                                  )}
                                </ThemedView>
                              ))}
                    </>
                  )}
                </ThemedView>
                    </>
                  )}
                </ThemedView>
                ) : (
                  <ThemedView style={styles.sectionCard}>
                  <ThemedText style={[styles.helperText, { textAlign: 'center' }]}>
                    Los puestos vinculados no se editan en este formulario. En la lista de actividades creadas, usa «Actualizar puestos» para añadir más puestos. Las asignaciones ya existentes no se eliminan.
                      </ThemedText>
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
                      <Picker.Item label="Cada día" value="daily" color="#000000" />
                      <Picker.Item label={weeklyLabel} value="weekly" color="#000000" />
                      <Picker.Item label={monthlyWeekdayLabel} value="monthly-weekday" color="#000000" />
                      <Picker.Item label={monthlyLastLabel} value="monthly-last" color="#000000" />
                      <Picker.Item label={yearlyLabel} value="yearly" color="#000000" />
                      <Picker.Item label="Todos los días laborales (lunes a viernes)" value="weekdays" color="#000000" />
                      <Picker.Item label="Personalizado" value="custom" color="#000000" />
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
                            <Picker.Item label="día" value="day" color="#000000" />
                            <Picker.Item label="semana" value="week" color="#000000" />
                            <Picker.Item label="mes" value="month" color="#000000" />
                            <Picker.Item label="año" value="year" color="#000000" />
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
                              <Picker.Item label={monthDayOfMonthLabel} value="day-of-month" color="#000000" />
                              <Picker.Item label={monthWeekdayOfMonthLabel} value="weekday-of-month" color="#000000" />
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
                                  <Picker.Item label="Enero" value="1" color="#000000" />
                                  <Picker.Item label="Febrero" value="2" color="#000000" />
                                  <Picker.Item label="Marzo" value="3" color="#000000" />
                                  <Picker.Item label="Abril" value="4" color="#000000" />
                                  <Picker.Item label="Mayo" value="5" color="#000000" />
                                  <Picker.Item label="Junio" value="6" color="#000000" />
                                  <Picker.Item label="Julio" value="7" color="#000000" />
                                  <Picker.Item label="Agosto" value="8" color="#000000" />
                                  <Picker.Item label="Septiembre" value="9" color="#000000" />
                                  <Picker.Item label="Octubre" value="10" color="#000000" />
                                  <Picker.Item label="Noviembre" value="11" color="#000000" />
                                  <Picker.Item label="Diciembre" value="12" color="#000000" />
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
                          {endDate ? convertDateTimestampToLocalString(new Date(`${endDate}T00:00:00`).toISOString(), false) : 'Seleccionar fecha'}
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
                    <ThemedText style={styles.signatureInfoText}>Hora actual: {convertDateTimestampToLocalString(new Date(Number(signatureData.timestamp)).toISOString())}</ThemedText>
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
                  <ScalePressButton
                    style={[styles.modalButton, styles.modalCancelButton]}
                    onPress={closeRepetitionModal}
                    disabled={isSubmittingActivity}
                  >
                    <ThemedText style={styles.modalCancelButtonText}>
                      Cancelar
                    </ThemedText>
                  </ScalePressButton>

                  <ScalePressButton
                    style={[styles.modalButton, styles.modalConfirmButton, isSubmittingActivity && styles.modalButtonDisabled]}
                    onPress={handleConfirmCreateActivity}
                    disabled={isSubmittingActivity}
                  >
                    {isSubmittingActivity ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <ThemedText style={styles.modalConfirmButtonText}>
                        Aceptar
                      </ThemedText>
                    )}
                  </ScalePressButton>
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
                  {activityImageLocalFileName ? 'Cambiar imagen' : 'Capturar imagen'}
                </ThemedText>
              </TouchableOpacity>

              {activityImageLocalFileName && (
                <ThemedView style={styles.imagePreviewContainer}>
                  <ThemedText style={styles.imagePreviewTitle}>Imagen capturada:</ThemedText>
                  <Image
                    source={{ uri: resolveLocalMarkImageUri(activityImageLocalFileName) || '' }}
                    style={styles.imagePreview}
                    resizeMode="contain"
                  />
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() =>
                      setActivityImageLocalFileName((prev) => {
                        if (prev) void deleteFile(prev).catch(() => {});
                        return null;
                      })
                    }
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

      {/* Actualizar puestos (solo añade vínculos; no quita los existentes) */}
      <Modal
        visible={isUpdPuestosModalVisible}
        animationType="fade"
        transparent
        onRequestClose={closeUpdatePuestosModal}
      >
        <ThemedView style={styles.modalOverlay}>
          <ThemedView style={[styles.modalContainer, styles.updatePuestosModalContainer]}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              showsVerticalScrollIndicator
              style={{ maxHeight: Dimensions.get('window').height * 0.72 }}
              contentContainerStyle={{ paddingBottom: 12 }}
            >
              <ThemedText style={styles.modalTitle}>Actualizar puestos</ThemedText>
              <ThemedText style={[styles.modalSubtitle, { marginBottom: 12 }]}>
                Las asignaciones a puestos que ya tenía la actividad no se eliminan. Solo se añadirán vínculos nuevos
                para los puestos que selecciones. Quienes reciban la actividad por primera vez recibirán una notificación.
              </ThemedText>
              {updPuestosActivity ? (
                <ThemedText style={[styles.helperText, { marginBottom: 12, fontWeight: '600' }]}>
                  {updPuestosActivity.nombre_actividad}
                </ThemedText>
              ) : null}

              {isStructureLoading && (!structure || structure.length === 0) ? (
                <ActivityIndicator size="small" color="#007AFF" />
              ) : (
                <>
                  <ThemedView style={styles.hierarchyModeToggleContainer}>
                    <TouchableOpacity
                      style={styles.hierarchyModeToggleRow}
                      onPress={() => {
                        const next = !updPAssignAllDivision;
                        setUpdPAssignAllDivision(next);
                        setUpdPSelectedPuestoId('');
                        if (!next) setUpdPSelectedDivisionForAll(null);
                      }}
                    >
                      <Ionicons
                        name={updPAssignAllDivision ? 'checkbox' : 'square-outline'}
                        size={20}
                        color={updPAssignAllDivision ? '#007AFF' : '#999'}
                      />
                      <ThemedText style={styles.hierarchyModeToggleLabel}>
                        Asignar a todos los puestos de una división
                      </ThemedText>
                    </TouchableOpacity>
                  </ThemedView>

                  {updPAssignAllDivision ? (
                    <ThemedView style={styles.pickerContainer}>
                      <Picker
                        selectedValue={updPSelectedDivisionForAll ? String(updPSelectedDivisionForAll) : ''}
                        onValueChange={(v) => {
                          setUpdPSelectedDivisionForAll(v ? Number(v) : null);
                          setUpdPSelectedPuestoId('');
                        }}
                        style={styles.picker}
                      >
                        <Picker.Item label="Selecciona división" value="" color="#000000" />
                        {divisionMassiveOptions.map((division: { id: number; nombre: string }) => (
                          <Picker.Item key={division.id} label={division.nombre} value={String(division.id)} color="#000000" />
                        ))}
                      </Picker>
                    </ThemedView>
                  ) : (
                    <>
                      <ThemedText style={styles.formLabel}>Jerarquía para puestos</ThemedText>
                      <ThemedView style={styles.pickerContainer}>
                        <Picker
                          selectedValue={updPEmpresaId ? String(updPEmpresaId) : ''}
                          onValueChange={(v) => {
                            setUpdPEmpresaId(v ? Number(v) : null);
                            resetUpdPHierarchyBelowEmpresa();
                          }}
                          style={styles.picker}
                        >
                          <Picker.Item label="Selecciona empresa" value="" color="#000000" />
                          {empresasOptions.map((empresa) => (
                            <Picker.Item key={empresa.id} label={empresa.nombre} value={String(empresa.id)} color="#000000" />
                          ))}
                        </Picker>
                      </ThemedView>
                      {!!updPEmpresaId && (
                        <ThemedView style={styles.pickerContainer}>
                          <Picker
                            selectedValue={updPClienteId ? String(updPClienteId) : ''}
                            onValueChange={(v) => {
                              setUpdPClienteId(v ? Number(v) : null);
                              resetUpdPHierarchyBelowCliente();
                            }}
                            style={styles.picker}
                          >
                            <Picker.Item label="Selecciona cliente" value="" color="#000000" />
                            {updPClientesOptions.map((cliente: any) => (
                              <Picker.Item key={cliente.id} label={cliente.nombre} value={String(cliente.id)} color="#000000" />
                            ))}
                          </Picker>
                        </ThemedView>
                      )}
                      {!!updPClienteId && (
                        <ThemedView style={styles.pickerContainer}>
                          <Picker
                            selectedValue={updPDivisionId ? String(updPDivisionId) : ''}
                            onValueChange={(v) => {
                              setUpdPDivisionId(v ? Number(v) : null);
                              resetUpdPHierarchyBelowDivision();
                            }}
                            style={styles.picker}
                          >
                            <Picker.Item label="Selecciona división" value="" color="#000000" />
                            {updPDivisionesOptions.map((division: any) => (
                              <Picker.Item key={division.id} label={division.nombre} value={String(division.id)} color="#000000" />
                            ))}
                          </Picker>
                        </ThemedView>
                      )}
                      {!!updPDivisionId && (
                        <ThemedView style={styles.pickerContainer}>
                          <Picker
                            selectedValue={updPContratoId ? String(updPContratoId) : ''}
                            onValueChange={(v) => {
                              setUpdPContratoId(v ? Number(v) : null);
                              resetUpdPHierarchyBelowContrato();
                            }}
                            style={styles.picker}
                          >
                            <Picker.Item label="Selecciona contrato" value="" color="#000000" />
                            {updPContratosOptions.map((contrato: any) => (
                              <Picker.Item key={contrato.id} label={contrato.nombre} value={String(contrato.id)} color="#000000" />
                            ))}
                          </Picker>
                        </ThemedView>
                      )}
                      {!!updPContratoId && (
                        <ThemedView style={styles.pickerContainer}>
                          <Picker
                            selectedValue={updPSucursalId ? String(updPSucursalId) : ''}
                            onValueChange={(v) => {
                              setUpdPSucursalId(v ? Number(v) : null);
                            }}
                            style={styles.picker}
                          >
                            <Picker.Item label="Selecciona sucursal" value="" color="#000000" />
                            {updPSucursalesOptions.map((sucursal: any) => (
                              <Picker.Item key={sucursal.id} label={sucursal.nombre} value={String(sucursal.id)} color="#000000" />
                            ))}
                          </Picker>
                        </ThemedView>
                      )}
                    </>
                  )}
                  <ThemedText style={styles.helperText}>Puestos disponibles: {updPEffectivePuestos.length}</ThemedText>
                  <TouchableOpacity style={styles.secondaryButton} onPress={handleUpdPConfirmPuestosSelection}>
                    <ThemedText style={styles.secondaryButtonText}>Confirmar selección de puestos</ThemedText>
                  </TouchableOpacity>

                  {!!updPSucursalId && (
                    <>
                      <ThemedText style={styles.formLabel}>Puestos</ThemedText>
                      <ThemedView style={styles.pickerContainer}>
                        <Picker
                          selectedValue={updPSelectedPuestoId}
                          onValueChange={handleUpdPSelectPuesto}
                          style={styles.picker}
                        >
                          <Picker.Item label="Selecciona un puesto" value="" color="#000000" />
                          {updPEffectivePuestos.map((puesto: any) => (
                            <Picker.Item key={puesto.id} label={puesto.nombre} value={String(puesto.id)} color="#000000" />
                          ))}
                        </Picker>
                      </ThemedView>
                    </>
                  )}

                  {updPSelectedPuesto ? (
                    <>
                      <ThemedText style={styles.formLabel}>Plazas</ThemedText>
                      {updPSelectedPuestoEntry?.assignAll ? (
                        <ThemedText style={styles.helperText}>
                          Este puesto ya está en la selección como puesto completo. Elimínalo de la lista para elegir plazas.
                        </ThemedText>
                      ) : updPSelectedPuestoPlazas.length === 0 ? (
                        <ThemedText style={styles.helperText}>Este puesto no tiene plazas configuradas.</ThemedText>
                      ) : (
                        <>
                          <ThemedView style={styles.plazaListContainer}>
                            {updPSelectedPuestoPlazas.map((plaza: any, index: number) => {
                              const plazaIdStr = String(plaza.id);
                              const isChecked = updPMarkedPlazaIds.includes(plazaIdStr);
                              const employeesLabel =
                                plaza.empleados && plaza.empleados.length > 0
                                  ? plaza.empleados.map((emp: any) => emp.nombre).join(', ')
                                  : 'Sin empleados asignados';
                              const isLast = index === updPSelectedPuestoPlazas.length - 1;
                              return (
                                <TouchableOpacity
                                  key={plaza.id}
                                  style={[
                                    styles.plazaListItem,
                                    isChecked && styles.plazaListItemSelected,
                                    isLast && styles.plazaListItemLast,
                                  ]}
                                  onPress={() => toggleUpdPPlazaSelection(plazaIdStr)}
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
                              updPMarkedPlazaIds.length === 0 && styles.secondaryButtonDisabled,
                            ]}
                            onPress={handleUpdPAddSelectedPlazas}
                            disabled={updPMarkedPlazaIds.length === 0}
                          >
                            <Ionicons name="add-circle" size={18} color="#fff" />
                            <ThemedText style={styles.secondaryButtonText}>Agregar plaza</ThemedText>
                          </TouchableOpacity>
                        </>
                      )}
                      {updPCanAssignEntirePuesto && (
                        <TouchableOpacity style={styles.secondaryButtonOutline} onPress={handleUpdPAssignPuestoCompleto}>
                          <Ionicons name="people-circle-outline" size={18} color="#007AFF" />
                          <ThemedText style={styles.secondaryButtonOutlineText}>Asignar a todo el puesto</ThemedText>
                        </TouchableOpacity>
                      )}
                    </>
                  ) : null}

                  <ThemedView style={styles.assignedList}>
                    {updPAssignedResponsables.length === 0 ? (
                      <ThemedText style={styles.helperText}>Aún no has agregado puestos para vincular.</ThemedText>
                    ) : (
                      <>
                        <TouchableOpacity
                          style={styles.selectedPuestosHeader}
                          onPress={() => setUpdPIsSelectedPuestosExpanded((p) => !p)}
                          activeOpacity={0.85}
                        >
                          <ThemedText style={styles.selectedPuestosHeaderText}>
                            Puestos a vincular ({updPAssignedResponsables.length})
                          </ThemedText>
                          <Ionicons
                            name={updPIsSelectedPuestosExpanded ? 'chevron-up' : 'chevron-down'}
                            size={18}
                            color="#007AFF"
                          />
                        </TouchableOpacity>
                        {updPIsSelectedPuestosExpanded &&
                          updPAssignedResponsables.map((responsable) => (
                            <ThemedView key={responsable.puestoId} style={styles.assignedItem}>
                              <View style={styles.assignedHeader}>
                                <ThemedText style={styles.assignedTitle}>{responsable.puestoNombre}</ThemedText>
                                <TouchableOpacity
                                  style={styles.removeButton}
                                  onPress={() => handleUpdPRemovePuesto(responsable.puestoId)}
                                >
                                  <Ionicons name="trash" size={18} color="#FF3B30" />
                                </TouchableOpacity>
                              </View>
                              {responsable.assignAll ? (
                                <ThemedText style={styles.helperText}>Puesto completo.</ThemedText>
                              ) : (
                                responsable.plazas.map((plaza) => (
                                  <View key={plaza.plazaId} style={styles.plazaChip}>
                                    <ThemedText style={styles.plazaChipText}>{plaza.plazaNombre}</ThemedText>
                                    <TouchableOpacity
                                      style={styles.removeButton}
                                      onPress={() => handleUpdPRemovePlaza(responsable.puestoId, plaza.plazaId)}
                                    >
                                      <Ionicons name="close-circle" size={18} color="#FF3B30" />
                                    </TouchableOpacity>
                                  </View>
                                ))
                              )}
                            </ThemedView>
                          ))}
                      </>
                    )}
                  </ThemedView>
                </>
              )}
            </ScrollView>
            <ThemedView style={styles.modalButtons}>
              <ScalePressButton
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={closeUpdatePuestosModal}
                disabled={updPSubmitting}
              >
                <ThemedText style={styles.modalCancelButtonText}>Cerrar</ThemedText>
              </ScalePressButton>
              <ScalePressButton
                style={[
                  styles.modalButton,
                  styles.modalConfirmButton,
                  updPSubmitting && styles.modalButtonDisabled,
                ]}
                onPress={submitUpdatePuestosModal}
                disabled={updPSubmitting}
              >
                {updPSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <ThemedText style={styles.modalConfirmButtonText}>Guardar</ThemedText>
                )}
              </ScalePressButton>
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
  activityScheduleHint: {
    fontSize: 13,
    color: '#555',
    fontWeight: '500',
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
  updatePuestosModalContainer: {
    maxWidth: 440,
    maxHeight: Dimensions.get('window').height * 0.92,
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
  selectedPuestosHeader: {
    marginTop: 12,
    marginBottom: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#F2F4F7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedPuestosHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  hierarchyModeToggleContainer: {
    marginBottom: 8,
  },
  hierarchyModeToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  hierarchyModeToggleLabel: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
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
  duplicateButton: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FF9500',
    paddingVertical: 10,
    borderRadius: 8,
  },
  collapsableSection: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
    overflow: 'hidden',
  },
  collapsableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F0F0F0',
  },
  collapsableHeaderText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginRight: 8,
  },
  collapsableContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  linkedPuestoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  linkedPuestoInfo: {
    flex: 1,
    paddingRight: 8,
  },
  linkedPuestoDeleteButton: {
    padding: 8,
    minWidth: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkedPuestoName: {
    fontSize: 14,
    fontWeight: '500',
  },
  linkedPuestoCode: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
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
  },
  reglasContent: {
    width: '100%',
    backgroundColor: '#F0F8FF',
  },
  reglasSeparator: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 10,
  },
  reglaItem: {
    flexDirection: 'column'
  },
  reglaNombre: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 6,
  },
  reglaValor: {
    fontSize: 13,
    color: '#333',
    marginBottom: 2,
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
