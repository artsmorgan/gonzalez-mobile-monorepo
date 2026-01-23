import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Modal, View, Platform } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useAuth } from '@/contexts/AuthContext';
import AppHeader from '@/components/AppHeader';
import AppFooter from '@/components/AppFooter';
import SlideMenu from '@/components/SlideMenu';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import * as Network from 'expo-network';
import * as Location from 'expo-location';
import SignatureScreen from "react-native-signature-canvas";
import { useQRScanner } from '@/hooks/useQRScanner';
import { jwtDecode } from 'jwt-decode';
import getHoraAccion from '@/hooks/getHoraAccion';

type EntregaPuestosScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'EntregaPuestos'>;

interface CurrentMarca {
  id: number;
  hora_entrada_digitada: string | null;
  hora_salida_digitada: string | null;
  hora_inicio: string;
  hora_fin: string;
  fecha: string;
  tipo_turno: string;
  cliente: {
    id: number;
    nombre: string;
  };
  corpo: {
    id: number;
    nombre: string;
  };
  puesto: {
    id: number;
    nombre: string;
  };
}

interface EntregaPuestosInfo {
  previous_marca: {
    fecha: string;
    hora_inicio: string;
    hora_fin: string;
    tipo_turno: string;
  };
  previous_employee: {
    id: number;
    nombre: string;
  };
  incidentes: Array<{
    id: number;
    clasificacion: string;
    description: string;
    involucrados: string;
    estado: boolean;
    responsable: string;
  }>;
  notas: Array<{
    id: number;
    titulo: string;
    description: string;
    categoria: string | null;
    empleado: string;
    updated_at: string;
  }>;
  articulos: Array<{
    id: number;
    nombre: string;
    cantidad: number;
  }>;
}

interface ArticuloForm {
  id: number;
  nombre: string;
  cantidad_requerida: number;
  cantidad_real: number;
  estado: 'Bueno' | 'Malo' | 'No está';
}

const signatureWebStyle = `
  body, html {
    margin: 0;
    padding: 0;
    height: 100%;
    width: 100%;
  }
  .m-signature-pad {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    margin: 0;
    padding: 0;
    box-shadow: none;
    border: none;
    background-color: #FFFFFF;
  }
  .m-signature-pad--body {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border: none;
    margin: 0;
    padding: 0;
  }
  .m-signature-pad--body canvas {
    width: 100% !important;
    height: 100% !important;
    touch-action: none;
  }
  .m-signature-pad--footer {
    display: none;
  }
`;

export default function EntregaPuestosScreen() {
  const { employee, refreshAccessToken, logout } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<EntregaPuestosScreenNavigationProp>();
  const { scanQR, QRScannerComponent } = useQRScanner();

  const handleHomePress = () => {
    navigation.navigate('Home');
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

  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentMarca, setCurrentMarca] = useState<CurrentMarca | null>(null);
  const [info, setInfo] = useState<EntregaPuestosInfo | null>(null);
  const [articulos, setArticulos] = useState<ArticuloForm[]>([]);
  const [observaciones, setObservaciones] = useState('');
  const [firmaResponsable, setFirmaResponsable] = useState<string>('');
  const [isSignatureModalVisible, setIsSignatureModalVisible] = useState(false);
  const [isGeneratingFirma, setIsGeneratingFirma] = useState(false);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const signatureRef = useRef<any>(null);
  const [signatureKey, setSignatureKey] = useState(0);

  const getConnectionStatus = async (): Promise<boolean> => {
    const networkState = await Network.getNetworkStateAsync();
    return networkState.isConnected && networkState.isInternetReachable ? true : false;
  };

  const generateRandomId = (): string => {
    return `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const formatDate = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatTime = (time: string | Date): string => {
    if (typeof time === 'string') {
      // Si es un string de tiempo (HH:MM:SS o HH:MM)
      const parts = time.split(':');
      if (parts.length >= 2) {
        return `${parts[0]}:${parts[1]}`;
      }
      return time;
    }
    // Si es un Date
    const hours = String(time.getHours()).padStart(2, '0');
    const minutes = String(time.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
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

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const currentMarcaStr = await AsyncStorage.getItem('current_marca');
      if (!currentMarcaStr) {
        setError('No hay marca actual activa');
        setIsLoading(false);
        return;
      }

      const currentMarcaData = JSON.parse(currentMarcaStr);
      setCurrentMarca(currentMarcaData);

      const isConnected = await getConnectionStatus();
      if (!isConnected) {
        setError('Se requiere conexión a internet para cargar los datos');
        setIsLoading(false);
        return;
      }

      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) {
        throw new Error('Server URL not configured');
      }

      let token = await AsyncStorage.getItem('access_token');
      if (!token) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
          setError('No se pudo autenticar');
          setIsLoading(false);
          if (logout) await logout();
          throw new Error('Sesión expirada');
          return;
        }
        token = await AsyncStorage.getItem('access_token');
      }

      const response = await fetch(`${apiUrl}/api/entrega-puestos?m=${currentMarcaData.id}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '69420',
        },
      });

      if (response.status === 401) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          return loadData();
        } else {
          await logout();
          return;
        }
      }

      if (response.status === 403) {
        if (logout) await logout();
        throw new Error('Acceso denegado');
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (!data.status) {
        setError(data.message || 'Error al cargar los datos');
        setIsLoading(false);
        return;
      }

      setInfo(data.info);

      // Inicializar artículos con estado por defecto "Bueno"
      const articulosForm: ArticuloForm[] = data.info.articulos.map((art: any) => ({
        id: art.id,
        nombre: art.nombre,
        cantidad_requerida: art.cantidad,
        cantidad_real: art.cantidad,
        estado: 'Bueno' as const,
      }));
      setArticulos(articulosForm);
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError(err.message || 'Error al cargar los datos');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleArticuloEstadoChange = (index: number, estado: 'Bueno' | 'Malo' | 'No está') => {
    const newArticulos = [...articulos];
    newArticulos[index].estado = estado;
    if (estado === 'No está') {
      newArticulos[index].cantidad_real = 0;
    }
    setArticulos(newArticulos);
  };

  const handleArticuloCantidadChange = (index: number, cantidad: number) => {
    const newArticulos = [...articulos];
    newArticulos[index].cantidad_real = cantidad;
    if (cantidad === 0) {
      newArticulos[index].estado = 'No está';
    }
    setArticulos(newArticulos);
  };

  const handleSignatureOK = (signature: string) => {
    setFirmaResponsable(signature);
    setIsSignatureModalVisible(false);
    setSignatureKey(prev => prev + 1);
  };

  const handleSignatureClear = () => {
    setFirmaResponsable('');
    setSignatureKey(prev => prev + 1);
  };

  const handleGenerateFirma = async () => {
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

  const handleScanFirma = async () => {
    try {
      const qrData = await scanQR();
      if (!qrData) return;
      setFirmaResponsable(qrData);
    } catch {
      Alert.alert('Error', 'No se pudo escanear el QR');
    }
  };

  const calculateFechaSalida = (fecha: string, horaInicio: string, horaFin: string): string => {
    const fechaObj = new Date(fecha);
    // Comparar solo las horas, no las fechas completas
    const inicioParts = horaInicio.split(':');
    const finParts = horaFin.split(':');
    const inicioHour = parseInt(inicioParts[0]) || 0;
    const inicioMin = parseInt(inicioParts[1]) || 0;
    const finHour = parseInt(finParts[0]) || 0;
    const finMin = parseInt(finParts[1]) || 0;

    const inicioMinutes = inicioHour * 60 + inicioMin;
    const finMinutes = finHour * 60 + finMin;

    if (inicioMinutes >= finMinutes) {
      // Si hora_inicio >= hora_fin, la fecha de fin es el día siguiente
      fechaObj.setDate(fechaObj.getDate() + 1);
    }
    return formatDate(fechaObj);
  };

  const handleSave = async () => {
    if (!currentMarca || !info) {
      Alert.alert('Error', 'Faltan datos necesarios');
      return;
    }

    if (!firmaResponsable) {
      Alert.alert('Error', 'Debe generar o escanear la firma responsable');
      return;
    }

    Alert.alert(
      'Confirmar',
      '¿Desea guardar el registro de entrega de puesto?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Guardar',
          onPress: async () => {
            try {
              setIsCreating(true);

              const fechaEntradaEntrega = formatDate(info.previous_marca.fecha);
              const fechaSalidaEntrega = calculateFechaSalida(
                info.previous_marca.fecha,
                info.previous_marca.hora_inicio,
                info.previous_marca.hora_fin
              );
              const horaEntradaEntrega = formatTime(info.previous_marca.hora_inicio);
              const horaSalidaEntrega = formatTime(info.previous_marca.hora_fin);

              const fechaEntradaRecibe = formatDate(currentMarca.fecha);
              const fechaSalidaRecibe = calculateFechaSalida(
                currentMarca.fecha,
                currentMarca.hora_inicio,
                currentMarca.hora_fin
              );
              const horaEntradaRecibe = formatTime(currentMarca.hora_inicio);
              const horaSalidaRecibe = formatTime(currentMarca.hora_fin);

              const articulosPuesto = articulos && articulos.length > 0 ? JSON.stringify(articulos) : '[]';

              const requestData = {
                cliente_id: currentMarca.cliente.id,
                corpo_id: currentMarca.corpo.id,
                puesto_id: currentMarca.puesto.id,
                oficial_entrega: info.previous_employee.nombre,
                fecha_entrada_entrega: fechaEntradaEntrega,
                fecha_salida_entrega: fechaSalidaEntrega,
                hora_entrada_entrega: horaEntradaEntrega,
                hora_salida_entrega: horaSalidaEntrega,
                turno_entrega: info.previous_marca.tipo_turno,
                oficial_recibe: employee?.name || 'Desconocido',
                fecha_entrada_recibe: fechaEntradaRecibe,
                fecha_salida_recibe: fechaSalidaRecibe,
                hora_entrada_recibe: horaEntradaRecibe,
                hora_salida_recibe: horaSalidaRecibe,
                turno_recibe: currentMarca.tipo_turno,
                articulos_puesto: articulosPuesto,
                observaciones: observaciones,
                firma_responsable: firmaResponsable,
                marca_id: currentMarca.id,
              };

              const isConnected = await getConnectionStatus();
              if (isConnected) {
                const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
                if (!apiUrl) {
                  throw new Error('Server URL not configured');
                }

                let token = await AsyncStorage.getItem('access_token');
                if (!token) {
                  const refreshed = await refreshAccessToken();
                  if (!refreshed) {
                    if (logout) await logout();
                    throw new Error('Sesión expirada');
                  }
                  token = await AsyncStorage.getItem('access_token');
                }

                const response = await fetch(`${apiUrl}/api/entrega-puestos`, {
                  method: 'POST',
                  headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': '69420',
                  },
                  body: JSON.stringify(requestData),
                });

                if (response.status === 401) {
                  const refreshed = await refreshAccessToken();
                  if (refreshed) {
                    return handleSave();
                  } else {
                    await logout();
                    return;
                  }
                }

                if (response.status === 403) {
                  if (logout) await logout();
                  throw new Error('Acceso denegado');
                }

                if (!response.ok) {
                  const errorData = await response.json();
                  throw new Error(errorData.message || 'Error al guardar');
                }

                const data = await response.json();
                if (!data.status) {
                  throw new Error(data.message || 'Error al guardar');
                }

                Alert.alert('Éxito', 'Registro de entrega de puesto guardado correctamente');
                navigation.goBack();
              } else {
                // Modo offline
                const localId = generateRandomId();
                const actionsStr = await AsyncStorage.getItem('entrega_puestos_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                actions.push({
                  requestData,
                  marcaId: currentMarca.id,
                  id: localId,
                  type: 'create',
                });
                await AsyncStorage.setItem('entrega_puestos_actions', JSON.stringify(actions));

                Alert.alert('Modo Offline', 'Registro guardado localmente. Se sincronizará cuando haya conexión.');
                navigation.goBack();
              }
            } catch (err: any) {
              console.error('Error saving:', err);
              Alert.alert('Error', err.message || 'No se pudo guardar el registro');
            } finally {
              setIsCreating(false);
            }
          },
        },
      ]
    );
  };

  const getInvolucrados = (involucrados: string) => {
    const involucradosArray = JSON.parse(involucrados);
    let involucradosText = "";
    for (let i = 0; i < involucradosArray.length; i++) {
      const involucrado = involucradosArray[i];
      let coma = "";
      if (i > 0) { // Si es el primero, debe incluir una coma
        coma = ", ";
      }
      involucradosText = `${involucrado.nombre} (${involucrado.codigo || ""})${coma}`;
    }
    return involucradosText;
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader onMenuPress={() => setIsMenuVisible(true)} title="Entrega de Puestos" />
        <ThemedView style={styles.centerContent}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando datos...</ThemedText>
        </ThemedView>
        <AppFooter />
        <SlideMenu
          isVisible={isMenuVisible}
          onClose={() => setIsMenuVisible(false)}
          onHomePress={handleHomePress}
          currentRoute="EntregaPuestos"
        />
      </ThemedView>
    );
  }

  if (error || !info || !currentMarca) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader onMenuPress={() => setIsMenuVisible(true)} title="Entrega de Puestos" />
        <ThemedView style={styles.centerContent}>
          <ThemedText style={styles.errorText}>{error || 'No se pudieron cargar los datos'}</ThemedText>
          <TouchableOpacity style={styles.retryButton} onPress={loadData}>
            <ThemedText style={styles.retryButtonText}>Reintentar</ThemedText>
          </TouchableOpacity>
        </ThemedView>
        <AppFooter />
        <SlideMenu
          isVisible={isMenuVisible}
          onClose={() => setIsMenuVisible(false)}
          onHomePress={handleHomePress}
          currentRoute="EntregaPuestos"
        />
      </ThemedView>
    );
  }

  const fechaEntradaEntrega = formatDate(info.previous_marca.fecha);
  const fechaSalidaEntrega = calculateFechaSalida(
    info.previous_marca.fecha,
    info.previous_marca.hora_inicio,
    info.previous_marca.hora_fin
  );
  const horaEntradaEntrega = formatTime(info.previous_marca.hora_inicio);
  const horaSalidaEntrega = formatTime(info.previous_marca.hora_fin);

  const fechaEntradaRecibe = formatDate(currentMarca.fecha);
  const fechaSalidaRecibe = calculateFechaSalida(
    currentMarca.fecha,
    currentMarca.hora_inicio,
    currentMarca.hora_fin
  );
  const horaEntradaRecibe = formatTime(currentMarca.hora_inicio);
  const horaSalidaRecibe = formatTime(currentMarca.hora_fin);

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={() => setIsMenuVisible(true)} title="Entrega de Puestos" />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <ThemedView style={styles.content}>
          {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}

          <ThemedView style={styles.titleContainer}>
            <ThemedText type="title" style={styles.title}>
              <Ionicons name="swap-horizontal" size={22} color="#000000" /> Entrega de Puestos
            </ThemedText>
            <ThemedText style={styles.subtitle}>Registro de entrega y recepción de puestos</ThemedText>
          </ThemedView>

          {/* Formulario principal */}
          <ThemedView style={styles.formCard}>
            <ThemedText style={styles.formTitle}>Datos de Entrega y Recepción</ThemedText>

            {/* Sección de datos informativos */}
            <ThemedView style={styles.infoSection}>
              <ThemedText style={styles.sectionTitle}>Datos de Entrega</ThemedText>
              <ThemedView style={styles.infoRow}>
                <ThemedText style={styles.infoLabel}>Cliente:</ThemedText>
                <ThemedText style={styles.infoValue}>{currentMarca.cliente.nombre}</ThemedText>
              </ThemedView>
              <ThemedView style={styles.infoRow}>
                <ThemedText style={styles.infoLabel}>Sucursal:</ThemedText>
                <ThemedText style={styles.infoValue}>{currentMarca.corpo.nombre}</ThemedText>
              </ThemedView>
              <ThemedView style={styles.infoRow}>
                <ThemedText style={styles.infoLabel}>Puesto:</ThemedText>
                <ThemedText style={styles.infoValue}>{currentMarca.puesto.nombre}</ThemedText>
              </ThemedView>
              <ThemedView style={styles.infoRow}>
                <ThemedText style={styles.infoLabel}>Oficial Entrega:</ThemedText>
                <ThemedText style={styles.infoValue}>{info.previous_employee.nombre}</ThemedText>
              </ThemedView>
              <ThemedView style={styles.infoRow}>
                <ThemedText style={styles.infoLabel}>Fecha Entrada Entrega:</ThemedText>
                <ThemedText style={styles.infoValue}>{fechaEntradaEntrega}</ThemedText>
              </ThemedView>
              <ThemedView style={styles.infoRow}>
                <ThemedText style={styles.infoLabel}>Fecha Salida Entrega:</ThemedText>
                <ThemedText style={styles.infoValue}>{fechaSalidaEntrega}</ThemedText>
              </ThemedView>
              <ThemedView style={styles.infoRow}>
                <ThemedText style={styles.infoLabel}>Hora Entrada Entrega:</ThemedText>
                <ThemedText style={styles.infoValue}>{horaEntradaEntrega.split("T")[1].split(".")[0]}</ThemedText>
              </ThemedView>
              <ThemedView style={styles.infoRow}>
                <ThemedText style={styles.infoLabel}>Hora Salida Entrega:</ThemedText>
                <ThemedText style={styles.infoValue}>{horaSalidaEntrega.split("T")[1].split(".")[0]}</ThemedText>
              </ThemedView>
              <ThemedView style={styles.infoRow}>
                <ThemedText style={styles.infoLabel}>Turno Entrega:</ThemedText>
                <ThemedText style={styles.infoValue}>{info.previous_marca.tipo_turno}</ThemedText>
              </ThemedView>
              <ThemedView style={styles.infoRow}>
                <ThemedText style={styles.infoLabel}>Oficial Recibe:</ThemedText>
                <ThemedText style={styles.infoValue}>{employee?.name || 'Desconocido'}</ThemedText>
              </ThemedView>
              <ThemedView style={styles.infoRow}>
                <ThemedText style={styles.infoLabel}>Fecha Entrada Recibe:</ThemedText>
                <ThemedText style={styles.infoValue}>{fechaEntradaRecibe}</ThemedText>
              </ThemedView>
              <ThemedView style={styles.infoRow}>
                <ThemedText style={styles.infoLabel}>Fecha Salida Recibe:</ThemedText>
                <ThemedText style={styles.infoValue}>{fechaSalidaRecibe}</ThemedText>
              </ThemedView>
              <ThemedView style={styles.infoRow}>
                <ThemedText style={styles.infoLabel}>Hora Entrada Recibe:</ThemedText>
                <ThemedText style={styles.infoValue}>{horaEntradaRecibe.split("T")[1].split(".")[0]}</ThemedText>
              </ThemedView>
              <ThemedView style={styles.infoRow}>
                <ThemedText style={styles.infoLabel}>Hora Salida Recibe:</ThemedText>
                <ThemedText style={styles.infoValue}>{horaSalidaRecibe.split("T")[1].split(".")[0]}</ThemedText>
              </ThemedView>
              <ThemedView style={styles.infoRow}>
                <ThemedText style={styles.infoLabel}>Turno Recibe:</ThemedText>
                <ThemedText style={styles.infoValue}>{currentMarca.tipo_turno}</ThemedText>
              </ThemedView>
            </ThemedView>

            {/* Sección de incidentes */}
            {info.incidentes.length > 0 && (
              <ThemedView style={styles.infoSection}>
                <ThemedText style={styles.sectionTitle}>Incidentes</ThemedText>
                {info.incidentes.map((incidente) => (
                  <ThemedView key={incidente.id} style={styles.bitacoraCard}>
                    <ThemedText style={styles.bitTitle}>ID: {incidente.id}</ThemedText>
                    <ThemedText style={styles.bitLine}>
                      <ThemedText style={styles.bitLabel}>Clasificación: </ThemedText>
                      <ThemedText style={styles.bitValue}>{incidente.clasificacion}</ThemedText>
                    </ThemedText>
                    <ThemedText style={styles.bitLine}>
                      <ThemedText style={styles.bitLabel}>Descripción: </ThemedText>
                      <ThemedText style={styles.bitValue}>{incidente.description}</ThemedText>
                    </ThemedText>
                    <ThemedText style={styles.bitLine}>
                      <ThemedText style={styles.bitLabel}>Involucrados: </ThemedText>
                      <ThemedText style={styles.bitValue}>{getInvolucrados(incidente.involucrados)}</ThemedText>
                    </ThemedText>
                    <ThemedText style={styles.bitLine}>
                      <ThemedText style={styles.bitLabel}>Estado: </ThemedText>
                      <ThemedText style={styles.bitValue}>{incidente.estado ? 'Activo' : 'Resuelto'}</ThemedText>
                    </ThemedText>
                    <ThemedText style={styles.bitLine}>
                      <ThemedText style={styles.bitLabel}>Responsable: </ThemedText>
                      <ThemedText style={styles.bitValue}>{incidente.responsable}</ThemedText>
                    </ThemedText>
                  </ThemedView>
                ))}
              </ThemedView>
            )}

            {/* Sección de notas */}
            {info.notas.length > 0 && (
              <ThemedView style={styles.infoSection}>
                <ThemedText style={styles.sectionTitle}>Notas</ThemedText>
                {info.notas.map((nota) => (
                  <ThemedView key={nota.id} style={styles.bitacoraCard}>
                    <ThemedText style={styles.bitTitle}>{nota.titulo}</ThemedText>
                    <ThemedText style={styles.bitLine}>
                      <ThemedText style={styles.bitValue}>{nota.description}</ThemedText>
                    </ThemedText>
                    {nota.categoria && (
                      <ThemedText style={styles.bitLine}>
                        <ThemedText style={styles.bitLabel}>Categoría: </ThemedText>
                        <ThemedText style={styles.bitValue}>{nota.categoria}</ThemedText>
                      </ThemedText>
                    )}
                    <ThemedText style={styles.bitLine}>
                      <ThemedText style={styles.bitLabel}>Empleado: </ThemedText>
                      <ThemedText style={styles.bitValue}>{nota.empleado}</ThemedText>
                    </ThemedText>
                    <ThemedText style={styles.bitLine}>
                      <ThemedText style={styles.bitLabel}>Fecha: </ThemedText>
                      <ThemedText style={styles.bitValue}>{new Date(nota.updated_at).toLocaleString()}</ThemedText>
                    </ThemedText>
                  </ThemedView>
                ))}
              </ThemedView>
            )}

            {/* Sección de artículos */}
            {articulos.length > 0 && (
              <ThemedView style={styles.infoSection}>
                <ThemedText style={styles.sectionTitle}>Artículos</ThemedText>
                {articulos.map((articulo, index) => (
                  <ThemedView key={articulo.id} style={styles.bitacoraCard}>
                    <ThemedText style={styles.bitTitle}>{articulo.nombre}</ThemedText>
                    <ThemedText style={styles.label}>Estado:</ThemedText>
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={articulo.estado}
                        onValueChange={(value) => handleArticuloEstadoChange(index, value)}
                        style={styles.picker}
                      >
                        <Picker.Item label="Bueno" value="Bueno" />
                        <Picker.Item label="Malo" value="Malo" />
                        <Picker.Item label="No está" value="No está" />
                      </Picker>
                    </View>
                    <ThemedText style={styles.label}>Cantidad Requerida:</ThemedText>
                    <TextInput
                      style={[styles.input, styles.inputReadOnly]}
                      value={String(articulo.cantidad_requerida)}
                      editable={false}
                      placeholderTextColor="#999"
                    />
                    <ThemedText style={styles.label}>Cantidad Real:</ThemedText>
                    <TextInput
                      style={styles.input}
                      value={String(articulo.cantidad_real)}
                      onChangeText={(text) => {
                        const num = parseInt(text) || 0;
                        handleArticuloCantidadChange(index, num);
                      }}
                      keyboardType="numeric"
                      placeholderTextColor="#999"
                    />
                  </ThemedView>
                ))}
              </ThemedView>
            )}

            {/* Observaciones */}
            <ThemedText style={styles.label}>Observaciones</ThemedText>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={observaciones}
              onChangeText={setObservaciones}
              placeholder="Ingrese observaciones..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
            />

            {/* Firma Responsable */}
            <ThemedText style={styles.sectionTitle}>Firma responsable *</ThemedText>
            <ThemedView style={styles.signatureButtons}>
              <TouchableOpacity
                style={[styles.signatureButton, isGeneratingFirma && styles.signatureButtonDisabled]}
                onPress={handleGenerateFirma}
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
              <TouchableOpacity style={styles.signatureButton} onPress={handleScanFirma}>
                <Ionicons name="qr-code" size={18} color="#FFFFFF" />
                <ThemedText style={styles.signatureButtonText}>Escanear QR</ThemedText>
              </TouchableOpacity>
            </ThemedView>

            {!firmaResponsable ? (
              <ThemedText style={styles.signatureHintMuted}>Aún no hay firma responsable.</ThemedText>
            ) : (
              <ThemedView style={styles.firmaInfoBox}>
                <ThemedView style={{ flex: 1, paddingRight: 10, backgroundColor: '#F9F9F9' }}>
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
              <TouchableOpacity style={[styles.formActionButton, styles.formActionSave]} onPress={handleSave} disabled={isCreating}>
                {isCreating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="save" size={18} color="#fff" />
                    <ThemedText style={styles.formActionSaveText}>Guardar</ThemedText>
                  </>
                )}
              </TouchableOpacity>
            </ThemedView>
          </ThemedView>
        </ThemedView>
      </ScrollView >

      {/* Modal de Firma */}
      < Modal
        visible={isSignatureModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsSignatureModalVisible(false)
        }
      >
        <ThemedView style={styles.modalContainer}>
          <ThemedView style={styles.modalHeader}>
            <ThemedText style={styles.modalTitle}>Firma Manual</ThemedText>
            <TouchableOpacity onPress={() => setIsSignatureModalVisible(false)}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </ThemedView>
          <ThemedView style={styles.signatureContainer}>
            <SignatureScreen
              ref={signatureRef}
              onOK={handleSignatureOK}
              onClear={handleSignatureClear}
              descriptionText=""
              clearText="Limpiar"
              confirmText="Guardar"
              webStyle={signatureWebStyle}
              key={signatureKey}
            />
          </ThemedView>
        </ThemedView>
      </Modal >

      <AppFooter />
      <SlideMenu
        isVisible={isMenuVisible}
        onClose={() => setIsMenuVisible(false)}
        onHomePress={handleHomePress}
        currentRoute="EntregaPuestos"
      />
      {QRScannerComponent}
    </ThemedView >
  );
}

const styles = StyleSheet.create({
  // Estructura/layout (igual que LlavesScreen)
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  content: { width: '100%', maxWidth: 800, alignSelf: 'center' },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 16, fontSize: 16, opacity: 0.7 },
  errorText: { color: '#FF3B30', textAlign: 'center', marginBottom: 12 },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },

  titleContainer: {
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, opacity: 0.7, textAlign: 'center' },

  formCard: { marginTop: 12, backgroundColor: '#fff', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#E0E0E0' },
  formTitle: { fontSize: 18, fontWeight: '800', marginBottom: 10, color: '#000' },
  label: { fontSize: 13, fontWeight: '700', marginTop: 10, color: '#333' },
  input: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, backgroundColor: '#fff', color: '#000', marginBottom: 6 },
  inputReadOnly: { backgroundColor: '#F0F0F0' },
  textArea: { minHeight: 90, textAlignVertical: 'top' },

  infoSection: {
    marginTop: 16,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  sectionTitle: { marginTop: 14, fontSize: 15, fontWeight: '800', color: '#007AFF', marginBottom: 10 },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  infoLabel: {
    fontWeight: '700',
    width: 150,
    color: '#333',
  },
  infoValue: {
    flex: 1,
    color: '#000',
  },

  // Cards (igual que LlavesScreen)
  bitacoraCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  bitTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10, color: '#000' },
  bitLine: { marginBottom: 6, color: '#000' },
  bitLabel: { fontWeight: '700', color: '#333' },
  bitValue: { color: '#000' },

  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    marginBottom: 6,
    backgroundColor: '#fff',
  },
  picker: {
    height: 50,
  },

  // Firma responsable (igual que LlavesScreen)
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
  signatureHintMuted: { marginTop: 6, color: '#999' },

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

  formActions: { marginTop: 16, flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  formActionButton: { flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12 },
  formActionSave: { backgroundColor: '#007AFF' },
  formActionSaveText: { color: '#fff', fontWeight: '800' },

  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  signatureContainer: {
    flex: 1,
  },
});

