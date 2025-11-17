import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Modal, TextInput, Image } from 'react-native';
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
import getHoraAccion from '@/hooks/getHoraAccion';
import { eventBus } from '@/hooks/eventBus';

type ActivitiesScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Activities'>;

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
  inventoryImages: {[key: number]: string};
  onClearInventoryImage: (inventoryId: number) => void;
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
  inventoryImages: {[key: number]: string};
  toggleActivity: (activity: Actividad) => void;
  onClearInventoryImage: (inventoryId: number) => void;
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
      const imageUrl = `${apiUrl}/api/activities/${activity.id}/get-image?t=${Date.now()}`;
      const response = await fetch(imageUrl);
      
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
    if (!activity.is_revision_equipo) {
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
    }
  }, [activity.id, activity.is_revision_equipo, activity.imagen_adjunta, loadActivityImageFromServer, getConnectionStatus]);

  return (
    <ThemedView style={styles.activityCard}>
      <ThemedView style={styles.activityHeader}>
        <ThemedView style={styles.activityInfo}>
          <ThemedText style={styles.activityName}>{activity.nombre_actividad}</ThemedText>
          <ThemedText style={activity.is_pendiente ? styles.activityFrecuenciaPending : styles.activityFrecuencia}>{activity.is_pendiente ? 'Pendiente' : activity.frecuencia}</ThemedText>
        </ThemedView>
        
        {!activity.is_revision_equipo && (
          <ThemedView style={styles.checkboxContainer}>
            <TouchableOpacity
              style={[
                styles.checkbox,
                activity.is_marcada ? styles.checkboxChecked : styles.checkboxUnchecked
              ]}
              onPress={() => toggleActivity(activity)}
            >
              {activity.is_marcada && (
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </ThemedView>
        )}
      </ThemedView>
      
      <ThemedView style={styles.activityBody}>
        <ThemedText style={styles.activityDescription}>
          {activity.descripcion_actividad}
        </ThemedText>
        
        {activity.is_revision_equipo && activity.inventario && (
          <ThemedView style={styles.inventoryContainer}>
            <ThemedText style={styles.inventoryTitle}>Inventario:</ThemedText>
            {activity.inventario.map(inventory => (
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
              />
            ))}
          </ThemedView>
        )}

        {/* Show existing image for normal activities (is_revision_equipo = false) */}
        {!activity.is_revision_equipo && activity.imagen_adjunta && (
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
}) => {
  const [isCorrect, setIsCorrect] = useState<boolean | undefined>(
    inventory.revision_equipo?.marcada ? inventory.revision_equipo.es_correcto : undefined
  );
  const [motivo, setMotivo] = useState<string>(
    inventory.revision_equipo?.motivo_incorrecto || ''
  );
  const [showMotivoInput, setShowMotivoInput] = useState<boolean>(true);
  const [showConfirmButton, setShowConfirmButton] = useState<boolean>(false);
  const [showImageCapture, setShowImageCapture] = useState<boolean>(false);

  const handleRadioChange = (value: boolean) => {
    setIsCorrect(value);
    setShowMotivoInput(true);
    setShowConfirmButton(true);
    setShowImageCapture(true);
    
    if (value) {
      setMotivo('');
    }
  };

  const submitInventory = async () => {
    if (!employee?.id) {
      Alert.alert('Error', 'No se encontró la información del empleado.');
      return;
    }

    if (isCorrect === undefined) {
      Alert.alert('Error', 'Por favor, selecciona una opción.');
      return;
    }

    if (!isCorrect && (!motivo || motivo.trim() === '')) {
      Alert.alert('Error', 'Por favor, ingresa el motivo de por qué es incorrecto.');
      return;
    }

    const revisionEquipoId = inventory.revision_equipo?.id;
    if (!revisionEquipoId) {
      Alert.alert('Error', 'No se encontró el ID de revisión del equipo');
      return;
    }

    const isConnected = await getConnectionStatus();

    const requestData: any = {
      e: parseInt(employee.id),
      es_correcto: isCorrect,
      motivo_incorrecto: (isCorrect && (!motivo || motivo.trim() === '')) ? '-' : motivo,
    };

    // Add image if captured
    const inventoryImage = inventoryImages[inventory.id];
    if (inventoryImage) {
      requestData.file = inventoryImage;
    } else {
      requestData.file = null;
    }

    if (isConnected) {
      // Online: call API
      try {
        const { updateRevisionEquipo } = await import('@/hooks/activitiesFunctions');
        const result = await updateRevisionEquipo({
          requestData,
          revisionEquipoId,
          refreshAccessToken,
          logout,
        });

        if (result.status) {
          Alert.alert('Éxito', result.message);
          setShowConfirmButton(false);
          // Clear captured image from state after successful submission
          if (inventoryImages[inventory.id]) {
            onClearInventoryImage(inventory.id);
          }
          await fetchActivities();
          // Force reload of server image
          setImageRefreshKey(prev => prev + 1);
        } else {
          Alert.alert('Error', result.message);
        }
      } catch (err) {
        console.error('Error submitting inventory:', err);
        Alert.alert('Error', 'No se pudo actualizar el inventario');
      }
    } else {
      // Offline: queue action and update cache
      try {
        const actionsStr = await AsyncStorage.getItem('activities_actions');
        let actions = actionsStr ? JSON.parse(actionsStr) : [];

        // Check if there's already an action for this revision
        const existingActionIndex = actions.findIndex(
          (action: any) => action.revisionEquipo_id === revisionEquipoId && action.type === 'update-equipo'
        );

        const horaAccion = await getHoraAccion();

        if (existingActionIndex !== -1) {
          // Replace existing action with new one
          actions[existingActionIndex] = {
            type: 'update-equipo',
            revisionEquipo_id: revisionEquipoId,
            activity_id: activity.id,
            inventory_id: inventory.id,
            requestData,
            timestamp: horaAccion,
          };
          Alert.alert('Acción actualizada', 'La acción se sincronizará cuando recuperes la conexión.');
          setShowConfirmButton(false);
        } else {
          // Add new action
          actions.push({
            type: 'update-equipo',
            revisionEquipo_id: revisionEquipoId,
            activity_id: activity.id,
            inventory_id: inventory.id,
            requestData,
            timestamp: horaAccion,
          });
          Alert.alert('Guardado offline', 'La acción se sincronizará cuando recuperes la conexión.');
          setShowConfirmButton(false);
        }

        await AsyncStorage.setItem('activities_actions', JSON.stringify(actions));

        // Update cache - always apply the change (whether new or replacement)
        const cachedActivities = await AsyncStorage.getItem('activities_cache');
        if (cachedActivities) {
          let activities = JSON.parse(cachedActivities);
          const activityIndex = activities.findIndex((a: Actividad) => a.id === activity.id);
          
          if (activityIndex !== -1) {
            const inventoryIndex = activities[activityIndex].inventario.findIndex(
              (inv: Inventario) => inv.id === inventory.id
            );
            
            if (inventoryIndex !== -1) {
              // Always apply the current change
              activities[activityIndex].inventario[inventoryIndex].revision_equipo.marcada = true;
              activities[activityIndex].inventario[inventoryIndex].revision_equipo.es_correcto = isCorrect;
              activities[activityIndex].inventario[inventoryIndex].revision_equipo.motivo_incorrecto = isCorrect ? '-' : motivo;
              
              await AsyncStorage.setItem('activities_cache', JSON.stringify(activities));
              await fetchActivities();
            }
          }
        }
      } catch (error) {
        console.error('Error en modo offline:', error);
        Alert.alert('Error', 'No se pudo guardar la acción offline');
      }
    }
  };

  // Function to get cached image from offline actions
  const getCachedImage = async () => {
    try {
      const actionsStr = await AsyncStorage.getItem('activities_actions');
      if (actionsStr) {
        const actions = JSON.parse(actionsStr);
        const action = actions.find((a: any) => 
          a.type === 'update-equipo' && 
          a.revisionEquipo_id === inventory.revision_equipo?.id
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
    if (!apiUrl || !inventory.revision_equipo?.id) return;
    
    try {
      const imageUrl = `${apiUrl}/api/activities/equipo/${inventory.revision_equipo.id}/get-image?t=${Date.now()}`;
      const response = await fetch(imageUrl);
      
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
  }, [apiUrl, inventory.revision_equipo?.id]);

  React.useEffect(() => {
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
  }, [inventory.revision_equipo?.id, imageRefreshKey, loadImageFromServer]);

  return (
    <ThemedView style={styles.inventoryItem}>
      <ThemedText style={styles.inventoryName}>{inventory.nombre}</ThemedText>
      
      {/* Reglas */}
      {inventory.reglas && inventory.reglas.length > 0 && (
        <ThemedView style={styles.reglasContainer}>
          <ThemedText style={styles.reglasTitle}>Especificaciones:</ThemedText>
          {inventory.reglas.map((regla, index) => (
            <ThemedView key={index} style={styles.reglaItem}>
              <ThemedText style={styles.reglaNombre}>{regla.nombre}:</ThemedText>
              <ThemedText style={styles.reglaValor}>{regla.valor}</ThemedText>
            </ThemedView>
          ))}
        </ThemedView>
      )}
      
      <ThemedView style={styles.radioContainer}>
        <TouchableOpacity
          style={styles.radioButton}
          onPress={() => handleRadioChange(true)}
        >
          <ThemedView style={[
            styles.radioCircle,
            isCorrect === true ? styles.radioSelected : styles.radioUnselected
          ]}>
            {isCorrect === true && <ThemedView style={styles.radioInner} />}
          </ThemedView>
          <ThemedText style={styles.radioLabel}>Correcto</ThemedText>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.radioButton}
          onPress={() => handleRadioChange(false)}
        >
          <ThemedView style={[
            styles.radioCircle,
            isCorrect === false ? styles.radioSelected : styles.radioUnselected
          ]}>
            {isCorrect === false && <ThemedView style={styles.radioInner} />}
          </ThemedView>
          <ThemedText style={styles.radioLabel}>Incorrecto</ThemedText>
        </TouchableOpacity>
      </ThemedView>
      
      {showMotivoInput && (
        <TextInput
          style={styles.motivoInput}
          value={motivo}
          onChangeText={setMotivo}
          placeholder={isCorrect === false ? "Motivo de por qué es incorrecto..." : "Motivo (opcional)..."}
          placeholderTextColor="#999"
          multiline={true}
          numberOfLines={2}
          textAlignVertical="top"
        />
      )}

      {/* Image capture button */}
      {showImageCapture && (
        <TouchableOpacity
          style={styles.captureImageButton}
          onPress={() => onOpenCamera(inventory.id)}
        >
          <Ionicons name="camera" size={20} color="#007AFF" />
          <ThemedText style={styles.captureImageButtonText}>
            {inventoryImages[inventory.id] ? 'Cambiar imagen' : 'Capturar imagen'}
          </ThemedText>
        </TouchableOpacity>
      )}

      {/* Show captured image preview */}
      {inventoryImages[inventory.id] && (
        <ThemedView style={styles.imagePreviewContainer}>
          <ThemedText style={styles.imagePreviewTitle}>Imagen capturada:</ThemedText>
          <Image
            source={{ uri: inventoryImages[inventory.id].startsWith('data:') ? inventoryImages[inventory.id] : `data:image/jpeg;base64,${inventoryImages[inventory.id]}` }}
            style={styles.imagePreview}
            resizeMode="contain"
          />
        </ThemedView>
      )}

      {/* Show existing image from server or cache */}
      {!inventoryImages[inventory.id] && !showConfirmButton && inventory.revision_equipo?.imagen_adjunta && (
        <ThemedView style={styles.imagePreviewContainer}>
          <ThemedText style={styles.imagePreviewTitle}>Imagen adjunta:</ThemedText>
          {(() => {
            const imageToShow = serverImageBase64 || cachedImage;
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
      
      {showConfirmButton && (
        <TouchableOpacity
          style={styles.confirmInventoryButton}
          onPress={submitInventory}
        >
          <ThemedText style={styles.confirmInventoryButtonText}>
            {getActionIcon('confirm')}
          </ThemedText>
        </TouchableOpacity>
      )}
    </ThemedView>
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
  const [hasCurrentMarca, setHasCurrentMarca] = useState<boolean>(false);
  
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
  const [inventoryImages, setInventoryImages] = useState<{[key: number]: string}>({});
  useFocusEffect(
    useCallback(() => {
      fetchActivities();
    }, [])
  );

  
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

  const fetchActivities = async () => {
    try {
      setIsLoading(true);
      setError(null);

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

        let token = await AsyncStorage.getItem('access_token');
        if (!token) {
          const refreshed = await refreshAccessToken();
          if (!refreshed) {
            throw new Error('No authentication token found');
          }
          token = await AsyncStorage.getItem('access_token');
        }

        const response = await fetch(`${apiUrl}/api/activities/marca/${marcaId}`, {
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
            return fetchActivities();
          } else {
            Alert.alert('Error', 'Sesión expirada. Por favor inicie sesión nuevamente.');
            await logout();
            return;
          }
        }

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: ActivitiesResponse = await response.json();

        if (data.status && data.actividades) {
          setActivities(data.actividades);
          // Cache the activities
          await AsyncStorage.setItem('activities_cache', JSON.stringify(data.actividades));
        } else {
          setError(data.message || 'Error al cargar las actividades');
          Alert.alert('Error', data.message || 'Error al cargar las actividades');
        }
      } else {
        // Offline: load from cache
        const cachedActivities = await AsyncStorage.getItem('activities_cache');
        if (cachedActivities) {
          const parsedActivities = JSON.parse(cachedActivities);
          setActivities(parsedActivities);
          Alert.alert('Modo Offline', 'Mostrando actividades guardadas. Los cambios se sincronizarán cuando recuperes la conexión.');
        } else {
          setError('No hay actividades guardadas');
          Alert.alert('Sin conexión', 'No hay actividades guardadas para mostrar sin conexión.');
        }
      }
    } catch (err) {
      console.error('Error fetching activities:', err);
      setError('Error al cargar las actividades');
      
      // Try to load from cache if online fetch fails
      const cachedActivities = await AsyncStorage.getItem('activities_cache');
      if (cachedActivities) {
        const parsedActivities = JSON.parse(cachedActivities);
        setActivities(parsedActivities);
        Alert.alert('Modo Offline', 'Mostrando actividades guardadas debido a un error de conexión.');
      } else {
        Alert.alert('Error', 'No se pudieron cargar las actividades');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'activities': return <Ionicons name="list" size={25} color='#FFFFFF' />;
      case 'check': return <Ionicons name="checkmark" size={20} color='#34C759' />;
      case 'uncheck': return <Ionicons name="close" size={20} color='#FF3B30' />;
      case 'confirm': return <Ionicons name="checkmark" size={35} color='#FFFFFF' />;
      case 'cancel': return <Ionicons name="close" size={35} color='#FFFFFF' />;
      default: return <Ionicons name="list" size={25} color='#FFFFFF' />;
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
    const action = activity.is_marcada ? 'desmarcar' : 'marcar';
    const actionText = activity.is_marcada ? 'desmarcar' : 'marcar';
    
    if (action === 'marcar') {
      // Para marcar, mostrar modal de bitácora
      setSelectedActivity(activity);
      setBitacoraText('');
      setActivityImageBase64(null);
      setIsBitacoraModalVisible(true);
    } else {
      // Para desmarcar, confirmar directamente
      Alert.alert(
        'Confirmar acción',
        `¿Estás seguro de que deseas ${actionText} esta actividad?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Confirmar',
            onPress: () => executeToggleActivity(activity, 'desmarcar', "-", null),
          },
        ]
      );
    }
  };

  const executeToggleActivity = async (activity: Actividad, estado: 'marcar' | 'desmarcar', bitacora: string | null, imageBase64: string | null) => {
    if (!employee?.id) {
      Alert.alert('Error', 'No se encontró la información necesaria del empleado.');
      return;
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

        await AsyncStorage.setItem('activities_actions', JSON.stringify(actions));

        // Update cache
        const cachedActivities = await AsyncStorage.getItem('activities_cache');
        if (cachedActivities) {
          let activities = JSON.parse(cachedActivities);
          const activityIndex = activities.findIndex((a: Actividad) => a.id === activity.id);
          
          if (activityIndex !== -1) {
            // Apply the change (marcar or desmarcar)
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
        onClearInventoryImage={(inventoryId) => {
          setInventoryImages((prev: {[key: number]: string}) => {
            const updated = { ...prev };
            delete updated[inventoryId];
            return updated;
          });
        }}
      />
    );
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
            <Ionicons name="arrow-back" size={20} color="#fff" />
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
              Lista de actividades asignadas
            </ThemedText>
          </ThemedView>

          {/* Activities List */}
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
        </ThemedView>
      </ScrollView>
      <AppFooter />
      <SlideMenu 
        isVisible={isMenuVisible} 
        onClose={handleMenuClose}
        onHomePress={handleHomePress}
        currentRoute="Activities"
      />

      {/* Bitacora Modal */}
      <Modal
        visible={isBitacoraModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleBitacoraCancel}
      >
        <ThemedView style={styles.modalOverlay}>
          <ThemedView style={styles.modalContainer}>
            <ThemedText style={styles.modalTitle}>
              Agregar Bitácora
            </ThemedText>
            <ThemedText style={styles.modalSubtitle}>
              Ingresa una descripción de la actividad realizada (opcional):
            </ThemedText>
            
            <TextInput
              style={styles.bitacoraInput}
              value={bitacoraText}
              onChangeText={setBitacoraText}
              placeholder="Ej: Completé la revisión del equipo, realicé mantenimiento preventivo..."
              placeholderTextColor="#999"
              multiline={true}
              numberOfLines={4}
              textAlignVertical="top"
            />

            {/* Image capture button */}
            <TouchableOpacity
              style={styles.captureImageButton}
              onPress={openCameraForActivity}
            >
              <Ionicons name="camera" size={20} color="#007AFF" />
              <ThemedText style={styles.captureImageButtonText}>
                {activityImageBase64 ? 'Cambiar imagen' : 'Capturar imagen (opcional)'}
              </ThemedText>
            </TouchableOpacity>

            {/* Show captured image preview */}
            {activityImageBase64 && (
              <ThemedView style={styles.imagePreviewContainer}>
                <ThemedText style={styles.imagePreviewTitle}>Imagen capturada:</ThemedText>
                <Image
                  source={{ uri: activityImageBase64.startsWith('data:') ? activityImageBase64 : `data:image/jpeg;base64,${activityImageBase64}` }}
                  style={styles.imagePreview}
                  resizeMode="contain"
                />
              </ThemedView>
            )}
            
            <ThemedView style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={handleBitacoraCancel}
              >
                <ThemedText style={styles.modalCancelButtonText}>
                  {getActionIcon('cancel')}
                </ThemedText>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmButton]}
                onPress={handleBitacoraConfirm}
              >
                <ThemedText style={styles.modalConfirmButtonText}>
                  {getActionIcon('confirm')}
                </ThemedText>
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
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#333333',
  },
  modalSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
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
    marginBottom: 24,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: '#FAFAFA',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#E0E0E0',
  },
  modalConfirmButton: {
    backgroundColor: '#FF3B30',
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  modalConfirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Inventory styles
  inventoryContainer: {
    marginTop: 16,
    gap: 12,
    backgroundColor: '#fff',
  },
  inventoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  inventoryItem: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  inventoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
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
});
