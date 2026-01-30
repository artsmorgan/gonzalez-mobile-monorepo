import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { useAuth } from '../contexts/AuthContext';
import React from 'react';
import { ActivityIndicator, Alert, Animated, Dimensions, Modal, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/build/Ionicons';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface SlideMenuProps {
  isVisible: boolean;
  onClose: () => void;
  onHomePress: () => void;
  onProfilePress?: () => void;
  currentRoute?: string;
}

interface Action {
  nombre: string;
  validate: boolean;
}

interface Permission {
  nombre: string;
  actions: Action[];
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MENU_WIDTH = SCREEN_WIDTH * 0.75;

export default function SlideMenu({ isVisible, onClose, onHomePress, onProfilePress, currentRoute }: SlideMenuProps) {
  const navigation = useNavigation<NavigationProp>();
  const { employee, logout, accessToken, refreshAccessToken } = useAuth();
  const slideAnim = React.useRef(new Animated.Value(MENU_WIDTH)).current;
  const [shouldRender, setShouldRender] = React.useState(false);
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const [role, setRole] = React.useState<string | null>(null);
  const [division, setDivision] = React.useState<string | null>(null);
  const [expandedSections, setExpandedSections] = React.useState<{ [key: string]: boolean }>({});
  const [permissions, setPermissions] = React.useState<Permission[]>([{ nombre: 'Acciones', actions: [] }]);

  React.useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
      const loadCurrentMarca = async () => {
        const currentMarca = await AsyncStorage.getItem('current_marca');
        if (currentMarca) {
          const currentMarcaData = JSON.parse(currentMarca);
          setRole(currentMarcaData.roleDivision.role.nombre);
          setDivision(currentMarcaData.roleDivision.division.nombre);
        }
        else {
          setRole(null);
          setDivision(null);
        }
        console.log('Role:', role);
        console.log('Division:', division);
      };
      loadCurrentMarca();
    } else {
      Animated.timing(slideAnim, {
        toValue: MENU_WIDTH,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setShouldRender(false);
      });
    }
    //fetchPermissions();
  }, [isVisible, slideAnim]);

  const handleLogout = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que deseas cerrar sesión?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Cerrar Sesión',
          style: 'destructive',
          onPress: async () => {
            setIsLoggingOut(true);
            onClose();
            try {
              const result = await logout();
              if (result && result.status) {
                // Show success message
                Alert.alert(
                  'Éxito',
                  result.message || 'Sesión cerrada correctamente',
                  [{ text: 'OK' }]
                );
              }
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert(
                'Error',
                'Ocurrió un error al cerrar sesión',
                [{ text: 'OK' }]
              );
            } finally {
              setIsLoggingOut(false);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const fetchPermissions = async () => {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    let token = await AsyncStorage.getItem('access_token');

    // Try to refresh token if we don't have one
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        throw new Error('No valid authentication token');
      }
      token = await AsyncStorage.getItem('access_token');
    }

    // El id del empleado actual
    const employeeId = employee?.id;
    const response = await fetch(`${apiUrl}/api/check-permissions?id=${employeeId}&actions=contratos`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420'
      },
    });

    if (response.status === 401 || response.status === 403) {
      // Token might be expired, try to refresh
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        // Retry the request with the new token
        return fetchPermissions();
      } else {
        // If refresh fails, logout the user
        Alert.alert('4', 'Sesión expirada. Por favor inicie sesión nuevamente.');
        await logout();
      }
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();

    setPermissions(data.filter((permission: Permission) => permission.nombre == 'acciones')[0]);
  };

  const handleProfilePress = () => {
    onClose();
    if (onProfilePress) {
      onProfilePress();
    } else {
      navigation.navigate('EmployeeProfile');
    }
  };

  const handleHomePress = () => {
    onClose();
    onHomePress();
  };

  const toggleSection = (sectionName: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionName]: !prev[sectionName]
    }));
  };

  const handleRolesPress = () => {
    onClose();
    navigation.navigate('Roles');
  };

  const handleRulesPress = () => {
    onClose();
    navigation.navigate('Rules');
  };

  const handleLunchTimePress = () => {
    onClose();
    navigation.navigate('LunchTime');
  };

  const handleDigitalSignaturePress = () => {
    onClose();
    navigation.navigate('DigitalSignature');
  };

  const handleTrasladoPlazasPress = () => {
    onClose();
    navigation.navigate('TrasladoPlazas');
  };

  const handleMarcarIngresoSalidaPress = () => {
    onClose();
    navigation.navigate('MarcarIngresoSalida');
  };

  const handleNotesPress = () => {
    onClose();
    navigation.navigate('Notes');
  };

  const handleActivitiesPress = () => {
    onClose();
    navigation.navigate('Activities');
  };

  const handleVehiclesPress = () => {
    onClose();
    navigation.navigate('Vehicles');
  };

  const handleVisitorsPress = () => {
    onClose();
    navigation.navigate('Visitors');
  };

  const handleEvaluationsPress = () => {
    onClose();
    navigation.navigate('StaffEvaluations');
  };

  const handleIncidentsPress = () => {
    onClose();
    navigation.navigate('Incidents');
  };

  const handleMutuosAcuerdosPress = () => {
    onClose();
    navigation.navigate('MutuosAcuerdos');
  };

  const handleBitacoraVehiculosDetenidosPress = () => {
    onClose();
    navigation.navigate('BitacoraVehiculosDetenidos');
  };

  const handleLlavesPress = () => {
    onClose();
    navigation.navigate('Llaves');
  };

  const handleMantenimientoEquipoPress = () => {
    onClose();
    navigation.navigate('MantenimientoEquipo');
  };

  const handleApreciacionVulnerabilidadPress = () => {
    onClose();
    navigation.navigate('ApreciacionVulnerabilidad');
  };

  const handleDocumentosEntregadosPress = () => {
    onClose();
    navigation.navigate('DocumentosEntregados');
  };

  const handleSurveysPress = () => {
    onClose();
    navigation.navigate('SatisfactionSurveys');
  };

  const handleTrainingsPress = () => {
    onClose();
    navigation.navigate('Trainings');
  };

  const handleVoiceNotesPress = () => {
    onClose();
    navigation.navigate('VoiceNotes');
  };

  const handleJobManualsPress = () => {
    onClose();
    navigation.navigate('JobManuals');
  };

  const handleComplaintsMasterPress = () => {
    onClose();
    navigation.navigate('ComplaintsMaster');
  };

  const handleNonConformingProductPress = () => {
    onClose();
    navigation.navigate('NonConformingProduct');
  };

  const handleCorporateVehiclesPress = () => {
    onClose();
    navigation.navigate('CorporateVehicles');
  };

  const handleInductionTourRecordPress = () => {
    onClose();
    navigation.navigate('InductionTourRecord');
  };

  const handleGeneralInductionRegisterPress = () => {
    onClose();
    navigation.navigate('GeneralInductionRegister');
  };

  const handlePhysicalMinuteAgendaPress = () => {
    onClose();
    navigation.navigate('PhysicalMinuteAgenda');
  };

  const handleChecklistSupervisionPress = () => {
    onClose();
    navigation.navigate('ChecklistSupervision');
  };

  const handlePermitRequestPress = () => {
    onClose();
    navigation.navigate('PermitRequest');
  };

  const handleAttendanceControlPress = () => {
    onClose();
    navigation.navigate('AttendanceControl');
  };

  const handleOpeningClosingPositionPress = () => {
    onClose();
    navigation.navigate('OpeningClosingPosition');
  };

  const handleActaEntregaProductosPress = () => {
    onClose();
    navigation.navigate('ActaEntregaProductos');
  };

  const handleEntregaPuestosPress = () => {
    onClose();
    navigation.navigate('EntregaPuestos');
  };

  const isActiveRoute = (route: string) => {
    return currentRoute === route;
  };

  if (!shouldRender) {
    return null;
  }

  const getActionIcon = (action: string, isActive: boolean) => {
    switch (action.toLowerCase()) {
      case 'home': return <Ionicons name="home-sharp" size={20} color={isActive ? '#007AFF' : '#000000'} />;
      case 'profile': return <Ionicons name="person" size={20} color={isActive ? '#007AFF' : '#000000'} />;
      case 'lunch-time': return <Ionicons name="hourglass" size={20} color={isActive ? '#007AFF' : '#000000'} />;
      case 'digital-signature': return <Ionicons name="finger-print" size={20} color={isActive ? '#007AFF' : '#000000'} />;
      case 'marcar-ingreso-salida': return <Ionicons name="time" size={20} color={isActive ? '#007AFF' : '#000000'} />;
      case 'notes': return <Ionicons name="document" size={20} color={isActive ? '#007AFF' : '#000000'} />;
      case 'activities': return <Ionicons name="list" size={20} color={isActive ? '#007AFF' : '#000000'} />;
      case 'vehicles': return <Ionicons name="car" size={20} color={isActive ? '#007AFF' : '#000000'} />;
      case 'visitors': return <Ionicons name="people" size={20} color={isActive ? '#007AFF' : '#000000'} />;
      case 'staffevaluations': return <Ionicons name="clipboard" size={20} color={isActive ? '#007AFF' : '#000000'} />;
      case 'incidents': return <Ionicons name="warning" size={20} color={isActive ? '#007AFF' : '#000000'} />;
      case 'mutuos-acuerdos': return <Ionicons name="document-text" size={20} color={isActive ? '#007AFF' : '#000000'} />;
      case 'non-conforming-product': return <Ionicons name="alert-circle" size={20} color={isActive ? '#007AFF' : '#000000'} />;
      case 'corporate-vehicles': return <Ionicons name="car-sport" size={20} color={isActive ? '#007AFF' : '#000000'} />;
      case 'bitacora-vehiculos-detenidos': return <Ionicons name="car-sport" size={20} color={isActive ? '#007AFF' : '#000000'} />;
      case 'llaves': return <Ionicons name="key" size={20} color={isActive ? '#007AFF' : '#000000'} />;
      case 'mantenimiento-equipo': return <Ionicons name="construct" size={20} color={isActive ? '#007AFF' : '#000000'} />;
      case 'entrega-puestos': return <Ionicons name="document-text" size={20} color={isActive ? '#007AFF' : '#000000'} />;
      case 'documentos-entregados': return <Ionicons name="document-text" size={20} color={isActive ? '#007AFF' : '#000000'} />;
      case 'apreciacion-vulnerabilidad': return <Ionicons name="shield-checkmark" size={20} color={isActive ? '#007AFF' : '#000000'} />;
      case 'surveys': return <Ionicons name="document-text" size={20} color={isActive ? '#007AFF' : '#000000'} />;
      case 'trainings': return <Ionicons name="school" size={20} color={isActive ? '#007AFF' : '#000000'} />;
      case 'voice-notes': return <Ionicons name="mic" size={20} color={isActive ? '#007AFF' : '#000000'} />;
      case 'job-manuals': return <Ionicons name="book" size={20} color={isActive ? '#007AFF' : '#000000'} />;
      case 'complaints-master': return <Ionicons name="chatbubbles" size={20} color={isActive ? '#007AFF' : '#000000'} />;
      case 'induction-tour-record': return <Ionicons name="document-text" size={20} color={isActive ? '#007AFF' : '#000000'} />;
      case 'general-induction-register': return <Ionicons name="document-text" size={20} color={isActive ? '#007AFF' : '#000000'} />;
      case 'attendance-control': return <Ionicons name="people" size={20} color={isActive ? '#007AFF' : '#000000'} />;
      case 'permit-request': return <Ionicons name="document-text" size={20} color={isActive ? '#007AFF' : '#000000'} />;
      case 'opening-closing-position': return <Ionicons name="business" size={20} color={isActive ? '#007AFF' : '#000000'} />;
      case 'acta-entrega-productos': return <Ionicons name="clipboard" size={20} color={isActive ? '#007AFF' : '#000000'} />;
      case 'physical-minute-agenda': return <Ionicons name="document-text" size={20} color={isActive ? '#007AFF' : '#000000'} />;
      case 'checklist-supervision': return <Ionicons name="checkmark-circle" size={20} color={isActive ? '#007AFF' : '#000000'} />;
      case 'traslado-plazas': return <Ionicons name="swap-horizontal" size={20} color={isActive ? '#007AFF' : '#000000'} />;
      case 'logout': return <Ionicons name="log-out" size={20} color={isActive ? '#007AFF' : '#ffffff'} />;
    }
  };

  return (
    <>
      {/* Overlay */}
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      />

      {/* Slide Menu */}
      <Animated.View
        style={[
          styles.menuContainer,
          { transform: [{ translateX: slideAnim }] }
        ]}
      >
        <ThemedView style={styles.menu}>
          {/* Header Section */}
          <ThemedView style={styles.headerSection}>
            <ThemedText type="title" style={styles.appTitle}>
              Gonzalez App
            </ThemedText>
            {employee && (
              <ThemedView style={styles.userInfo}>
                <ThemedText style={styles.userName}>{employee.name}</ThemedText>
                <ThemedText style={styles.userEmail}>{employee.email}</ThemedText>
              </ThemedView>
            )}
          </ThemedView>

          {/* Menu Options */}
          <ScrollView style={styles.menuOptions} contentContainerStyle={styles.menuOptionsContent}>
            {/* Basic Menu Items */}
            <TouchableOpacity
              style={[
                styles.menuItem,
                isActiveRoute('home') && styles.activeMenuItem
              ]}
              onPress={handleHomePress}
            >
              <ThemedText
                style={[
                  styles.menuItemText,
                  isActiveRoute('home') && styles.activeMenuItemText
                ]}
              >
                {getActionIcon('home', isActiveRoute('home'))}
              </ThemedText>
              <ThemedText
                style={[
                  styles.menuItemText,
                  isActiveRoute('home') && styles.activeMenuItemText
                ]}
              >
                Inicio
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.menuItem,
                isActiveRoute('EmployeeProfile') && styles.activeMenuItem
              ]}
              onPress={handleProfilePress}
            >
              <ThemedText
                style={[
                  styles.menuItemText,
                  isActiveRoute('EmployeeProfile') && styles.activeMenuItemText
                ]}
              >
                {getActionIcon('profile', isActiveRoute('EmployeeProfile'))}
              </ThemedText>
              <ThemedText
                style={[
                  styles.menuItemText,
                  isActiveRoute('EmployeeProfile') && styles.activeMenuItemText
                ]}
              >
                Perfil de Usuario
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.menuItem,
                isActiveRoute('lunch-time') && styles.activeMenuItem
              ]}
              onPress={handleLunchTimePress}
            >
              <ThemedText
                style={[
                  styles.menuItemText,
                  isActiveRoute('lunch-time') && styles.activeMenuItemText
                ]}
              >
                {getActionIcon('lunch-time', isActiveRoute('lunch-time'))}
              </ThemedText>
              <ThemedText
                style={[
                  styles.menuItemText,
                  isActiveRoute('lunch-time') && styles.activeMenuItemText
                ]}
              >
                Tiempo de Almuerzo
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.menuItem,
                isActiveRoute('digital-signature') && styles.activeMenuItem
              ]}
              onPress={handleDigitalSignaturePress}
            >
              <ThemedText
                style={[
                  styles.menuItemText,
                  isActiveRoute('digital-signature') && styles.activeMenuItemText
                ]}
              >
                {getActionIcon('digital-signature', isActiveRoute('digital-signature'))}
              </ThemedText>
              <ThemedText
                style={[
                  styles.menuItemText,
                  isActiveRoute('digital-signature') && styles.activeMenuItemText
                ]}
              >
                Mi Firma Digital
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.menuItem,
                isActiveRoute('marcar-ingreso-salida') && styles.activeMenuItem
              ]}
              onPress={handleMarcarIngresoSalidaPress}
            >
              <ThemedText
                style={[
                  styles.menuItemText,
                  isActiveRoute('marcar-ingreso-salida') && styles.activeMenuItemText
                ]}
              >
                {getActionIcon('marcar-ingreso-salida', isActiveRoute('marcar-ingreso-salida'))}
              </ThemedText>
              <ThemedText
                style={[
                  styles.menuItemText,
                  isActiveRoute('marcar-ingreso-salida') && styles.activeMenuItemText
                ]}
              >
                Marcar Ingreso/Salida
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.menuItem,
                isActiveRoute('Notes') && styles.activeMenuItem
              ]}
              onPress={handleNotesPress}
            >
              <ThemedText
                style={[
                  styles.menuItemText,
                  isActiveRoute('Notes') && styles.activeMenuItemText
                ]}
              >
                {getActionIcon('notes', isActiveRoute('Notes'))}
              </ThemedText>
              <ThemedText
                style={[
                  styles.menuItemText,
                  isActiveRoute('Notes') && styles.activeMenuItemText
                ]}
              >
                Bitácora de Notas
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.menuItem,
                isActiveRoute('Activities') && styles.activeMenuItem
              ]}
              onPress={handleActivitiesPress}
            >
              <ThemedText
                style={[
                  styles.menuItemText,
                  isActiveRoute('Activities') && styles.activeMenuItemText
                ]}
              >
                {getActionIcon('activities', isActiveRoute('Activities'))}
              </ThemedText>
              <ThemedText
                style={[
                  styles.menuItemText,
                  isActiveRoute('Activities') && styles.activeMenuItemText
                ]}
              >
                Actividades
              </ThemedText>
            </TouchableOpacity>

            {((role === 'OPERATIVO' || role === 'SUPERVISOR') && division === 'Seguridad') && (
              <TouchableOpacity
                style={[
                  styles.menuItem,
                  isActiveRoute('Vehicles') && styles.activeMenuItem
                ]}
                onPress={handleVehiclesPress}
              >
                <ThemedText
                  style={[
                    styles.menuItemText,
                    isActiveRoute('Vehicles') && styles.activeMenuItemText
                  ]}
                >
                  {getActionIcon('vehicles', isActiveRoute('Vehicles'))}
                </ThemedText>
                <ThemedText
                  style={[
                    styles.menuItemText,
                    isActiveRoute('Vehicles') && styles.activeMenuItemText
                  ]}
                >
                  Visitas de Vehículos
                </ThemedText>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.menuItem,
                isActiveRoute('Visitors') && styles.activeMenuItem
              ]}
              onPress={handleVisitorsPress}
            >
              <ThemedText
                style={[
                  styles.menuItemText,
                  isActiveRoute('Visitors') && styles.activeMenuItemText
                ]}
              >
                {getActionIcon('visitors', isActiveRoute('Visitors'))}
              </ThemedText>
              <ThemedText
                style={[
                  styles.menuItemText,
                  isActiveRoute('Visitors') && styles.activeMenuItemText
                ]}
              >
                Registro de Visitantes
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.menuItem,
                isActiveRoute('StaffEvaluations') && styles.activeMenuItem
              ]}
              onPress={handleEvaluationsPress}
            >
              <ThemedText
                style={[
                  styles.menuItemText,
                  isActiveRoute('StaffEvaluations') && styles.activeMenuItemText
                ]}
              >
                {getActionIcon('staffEvaluations', isActiveRoute('StaffEvaluations'))}
              </ThemedText>
              <ThemedText
                style={[
                  styles.menuItemText,
                  isActiveRoute('StaffEvaluations') && styles.activeMenuItemText
                ]}
              >
                Evaluación de personal
              </ThemedText>
            </TouchableOpacity>

            {division === 'Seguridad' && (
              <TouchableOpacity
                style={[
                  styles.menuItem,
                  isActiveRoute('Incidents') && styles.activeMenuItem
                ]}
                onPress={handleIncidentsPress}
              >
                <ThemedText
                  style={[
                    styles.menuItemText,
                    isActiveRoute('Incidents') && styles.activeMenuItemText
                  ]}
                >
                  {getActionIcon('incidents', isActiveRoute('Incidents'))}
                </ThemedText>
                <ThemedText
                  style={[
                    styles.menuItemText,
                    isActiveRoute('Incidents') && styles.activeMenuItemText
                  ]}
                >
                  Incidentes
                </ThemedText>
              </TouchableOpacity>
            )}

            {role === 'OPERATIVO' && division === 'Seguridad' && (
              <TouchableOpacity
                style={[
                  styles.menuItem,
                  isActiveRoute('MutuosAcuerdos') && styles.activeMenuItem
                ]}
                onPress={handleMutuosAcuerdosPress}
              >
                <ThemedText
                  style={[
                    styles.menuItemText,
                    isActiveRoute('MutuosAcuerdos') && styles.activeMenuItemText
                  ]}
                >
                  {getActionIcon('mutuos-acuerdos', isActiveRoute('MutuosAcuerdos'))}
                </ThemedText>
                <ThemedText
                  style={[
                    styles.menuItemText,
                    isActiveRoute('MutuosAcuerdos') && styles.activeMenuItemText
                  ]}
                >
                  Mutuos acuerdos
                </ThemedText>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.menuItem,
                isActiveRoute('TrasladoPlazas') && styles.activeMenuItem
              ]}
              onPress={handleTrasladoPlazasPress}
            >
              <ThemedText
                style={[
                  styles.menuItemText,
                  isActiveRoute('TrasladoPlazas') && styles.activeMenuItemText
                ]}
              >
                {getActionIcon('traslado-plazas', isActiveRoute('TrasladoPlazas'))}
              </ThemedText>
              <ThemedText
                style={[
                  styles.menuItemText,
                  isActiveRoute('TrasladoPlazas') && styles.activeMenuItemText
                ]}
              >
                Traslado de plazas
              </ThemedText>
            </TouchableOpacity>

            {role === 'OPERATIVO' && division === 'Seguridad' && (
              <TouchableOpacity
                style={[
                  styles.menuItem,
                  isActiveRoute('BitacoraVehiculosDetenidos') && styles.activeMenuItem
                ]}
                onPress={handleBitacoraVehiculosDetenidosPress}
              >
                <ThemedText
                  style={[
                    styles.menuItemText,
                    isActiveRoute('BitacoraVehiculosDetenidos') && styles.activeMenuItemText
                  ]}
                >
                  {getActionIcon('bitacora-vehiculos-detenidos', isActiveRoute('BitacoraVehiculosDetenidos'))}
                </ThemedText>
                <ThemedText
                  style={[
                    styles.menuItemText,
                    isActiveRoute('BitacoraVehiculosDetenidos') && styles.activeMenuItemText
                  ]}
                >
                  Bitácora de vehículos detenidos
                </ThemedText>
              </TouchableOpacity>
            )}

            {role === 'SUPERVISOR' && division === 'Seguridad' && (
              <TouchableOpacity
                style={[
                  styles.menuItem,
                  isActiveRoute('ChecklistSupervision') && styles.activeMenuItem
                ]}
                onPress={handleChecklistSupervisionPress}
              >
                <ThemedText
                  style={[
                    styles.menuItemText,
                    isActiveRoute('ChecklistSupervision') && styles.activeMenuItemText
                  ]}
                >
                  {getActionIcon('checklist-supervision', isActiveRoute('ChecklistSupervision'))}
                </ThemedText>
                <ThemedText
                  style={[
                    styles.menuItemText,
                    isActiveRoute('ChecklistSupervision') && styles.activeMenuItemText
                  ]}
                >
                  Checklist de Supervisión
                </ThemedText>
              </TouchableOpacity>
            )}

            {role === 'OPERATIVO' && division === 'Seguridad' && (
              <TouchableOpacity
                style={[
                  styles.menuItem,
                  isActiveRoute('Llaves') && styles.activeMenuItem
                ]}
                onPress={handleLlavesPress}
              >
                <ThemedText
                  style={[
                    styles.menuItemText,
                    isActiveRoute('Llaves') && styles.activeMenuItemText
                  ]}
                >
                  {getActionIcon('llaves', isActiveRoute('Llaves'))}
                </ThemedText>
                <ThemedText
                  style={[
                    styles.menuItemText,
                    isActiveRoute('Llaves') && styles.activeMenuItemText
                  ]}
                >
                  Llaves
                </ThemedText>
              </TouchableOpacity>
            )}

            {/* Estamos aquí */}
            {role === 'ADMINISTRATIVO' || role === 'SUPERVISOR' && (
              <TouchableOpacity
                style={[
                  styles.menuItem,
                  isActiveRoute('MantenimientoEquipo') && styles.activeMenuItem
                ]}
                onPress={handleMantenimientoEquipoPress}
              >
                <ThemedText
                  style={[
                    styles.menuItemText,
                    isActiveRoute('MantenimientoEquipo') && styles.activeMenuItemText
                  ]}
                >
                  {getActionIcon('mantenimiento-equipo', isActiveRoute('MantenimientoEquipo'))}
                </ThemedText>
                <ThemedText
                  style={[
                    styles.menuItemText,
                    isActiveRoute('MantenimientoEquipo') && styles.activeMenuItemText
                  ]}
                >
                  Mantenimiento de equipo
                </ThemedText>
              </TouchableOpacity>
            )}

            {(role === 'ADMINISTRATIVO' || role === 'SUPERVISOR') && (
              <TouchableOpacity
                style={[
                  styles.menuItem,
                  isActiveRoute('PhysicalMinuteAgenda') && styles.activeMenuItem
                ]}
                onPress={handlePhysicalMinuteAgendaPress}
              >
                <ThemedText
                  style={[
                    styles.menuItemText,
                    isActiveRoute('PhysicalMinuteAgenda') && styles.activeMenuItemText
                  ]}
                >
                  {getActionIcon('physical-minute-agenda', isActiveRoute('PhysicalMinuteAgenda'))}
                </ThemedText>
                <ThemedText
                  style={[
                    styles.menuItemText,
                    isActiveRoute('PhysicalMinuteAgenda') && styles.activeMenuItemText
                  ]}
                >
                  Agenda minuta
                </ThemedText>
              </TouchableOpacity>
            )}

            {role === 'OPERATIVO' && division === 'Seguridad' && (
              <TouchableOpacity
                style={[
                  styles.menuItem,
                  isActiveRoute('EntregaPuestos') && styles.activeMenuItem
                ]}
                onPress={handleEntregaPuestosPress}
              >
                <ThemedText
                  style={[
                    styles.menuItemText,
                    isActiveRoute('EntregaPuestos') && styles.activeMenuItemText
                  ]}
                >
                  {getActionIcon('entrega-puestos', isActiveRoute('EntregaPuestos'))}
                </ThemedText>
                <ThemedText
                  style={[
                    styles.menuItemText,
                    isActiveRoute('EntregaPuestos') && styles.activeMenuItemText
                  ]}
                >
                  Entrega de Puestos
                </ThemedText>
              </TouchableOpacity>
            )}

            {(role === 'OPERATIVO' || role === 'SUPERVISOR') && division === 'Seguridad' && (
              <TouchableOpacity
                style={[
                  styles.menuItem,
                  isActiveRoute('DocumentosEntregados') && styles.activeMenuItem
                ]}
                onPress={handleDocumentosEntregadosPress}
              >
                <ThemedText
                  style={[
                    styles.menuItemText,
                    isActiveRoute('DocumentosEntregados') && styles.activeMenuItemText
                  ]}
                >
                  {getActionIcon('documentos-entregados', isActiveRoute('DocumentosEntregados'))}
                </ThemedText>
                <ThemedText
                  style={[
                    styles.menuItemText,
                    isActiveRoute('DocumentosEntregados') && styles.activeMenuItemText
                  ]}
                >
                  Documentos entregados
                </ThemedText>
              </TouchableOpacity>
            )}

            {role === 'SUPERVISOR' && division === 'Seguridad' && (
              <TouchableOpacity
                style={[
                  styles.menuItem,
                  isActiveRoute('ApreciacionVulnerabilidad') && styles.activeMenuItem
                ]}
                onPress={handleApreciacionVulnerabilidadPress}
              >
                <ThemedText
                  style={[
                    styles.menuItemText,
                    isActiveRoute('ApreciacionVulnerabilidad') && styles.activeMenuItemText
                  ]}
                >
                  {getActionIcon('apreciacion-vulnerabilidad', isActiveRoute('ApreciacionVulnerabilidad'))}
                </ThemedText>
                <ThemedText
                  style={[
                    styles.menuItemText,
                    isActiveRoute('ApreciacionVulnerabilidad') && styles.activeMenuItemText
                  ]}
                >
                  Apreciación de vulnerabilidad
                </ThemedText>
              </TouchableOpacity>
            )}

            {(role === 'SUPERVISOR' || role === 'ADMINISTRATIVO') && (
              <TouchableOpacity
                style={[
                  styles.menuItem,
                  isActiveRoute('SatisfactionSurveys') && styles.activeMenuItem
                ]}
                onPress={handleSurveysPress}
              >
                <ThemedText
                  style={[
                    styles.menuItemText,
                    isActiveRoute('SatisfactionSurveys') && styles.activeMenuItemText
                  ]}
                >
                  {getActionIcon('surveys', isActiveRoute('SatisfactionSurveys'))}
                </ThemedText>
                <ThemedText
                  style={[
                    styles.menuItemText,
                    isActiveRoute('SatisfactionSurveys') && styles.activeMenuItemText
                  ]}
                >
                  Encuestas de Satisfacción
                </ThemedText>
              </TouchableOpacity>
            )}

            {(role === 'SUPERVISOR' || role === 'ADMINISTRATIVO') && (
              <TouchableOpacity
                style={[
                  styles.menuItem,
                  isActiveRoute('Trainings') && styles.activeMenuItem
                ]}
                onPress={handleTrainingsPress}
              >
                <ThemedText
                  style={[
                    styles.menuItemText,
                    isActiveRoute('Trainings') && styles.activeMenuItemText
                  ]}
                >
                  {getActionIcon('trainings', isActiveRoute('Trainings'))}
                </ThemedText>
                <ThemedText
                  style={[
                    styles.menuItemText,
                    isActiveRoute('Trainings') && styles.activeMenuItemText
                  ]}
                >
                  Registro de Capacitaciones
                </ThemedText>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.menuItem,
                isActiveRoute('VoiceNotes') && styles.activeMenuItem
              ]}
              onPress={handleVoiceNotesPress}
            >
              <ThemedText
                style={[
                  styles.menuItemText,
                  isActiveRoute('VoiceNotes') && styles.activeMenuItemText
                ]}
              >
                {getActionIcon('voice-notes', isActiveRoute('VoiceNotes'))}
              </ThemedText>
              <ThemedText
                style={[
                  styles.menuItemText,
                  isActiveRoute('VoiceNotes') && styles.activeMenuItemText
                ]}
              >
                Notas de Voz
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.menuItem,
                isActiveRoute('JobManuals') && styles.activeMenuItem
              ]}
              onPress={handleJobManualsPress}
            >
              <ThemedText
                style={[
                  styles.menuItemText,
                  isActiveRoute('JobManuals') && styles.activeMenuItemText
                ]}
              >
                {getActionIcon('job-manuals', isActiveRoute('JobManuals'))}
              </ThemedText>
              <ThemedText
                style={[
                  styles.menuItemText,
                  isActiveRoute('JobManuals') && styles.activeMenuItemText
                ]}
              >
                Manuales de Trabajo
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.menuItem,
                isActiveRoute('ComplaintsMaster') && styles.activeMenuItem
              ]}
              onPress={handleComplaintsMasterPress}
            >
              <ThemedText
                style={[
                  styles.menuItemText,
                  isActiveRoute('ComplaintsMaster') && styles.activeMenuItemText
                ]}
              >
                {getActionIcon('complaints-master', isActiveRoute('ComplaintsMaster'))}
              </ThemedText>
              <ThemedText
                style={[
                  styles.menuItemText,
                  isActiveRoute('ComplaintsMaster') && styles.activeMenuItemText
                ]}
              >
                Maestro de Quejas y reclamos
              </ThemedText>
            </TouchableOpacity>

            {(role === 'ADMINISTRATIVO' || role === 'SUPERVISOR') && division === 'Aseo y Limpieza' && (
              <TouchableOpacity
                style={[
                  styles.menuItem,
                  isActiveRoute('NonConformingProduct') && styles.activeMenuItem
                ]}
                onPress={handleNonConformingProductPress}
              >
                <ThemedText
                  style={[
                    styles.menuItemText,
                    isActiveRoute('NonConformingProduct') && styles.activeMenuItemText
                  ]}
                >
                  {getActionIcon('non-conforming-product', isActiveRoute('NonConformingProduct'))}
                </ThemedText>
                <ThemedText
                  style={[
                    styles.menuItemText,
                    isActiveRoute('NonConformingProduct') && styles.activeMenuItemText
                  ]}
                >
                  Producto no conforme
                </ThemedText>
              </TouchableOpacity>
            )}

            {(role === 'ADMINISTRATIVO' || role === 'SUPERVISOR') && (
              <TouchableOpacity
                style={[
                  styles.menuItem,
                  isActiveRoute('CorporateVehicles') && styles.activeMenuItem
                ]}
                onPress={handleCorporateVehiclesPress}
              >
                <ThemedText
                  style={[
                    styles.menuItemText,
                    isActiveRoute('CorporateVehicles') && styles.activeMenuItemText
                  ]}
                >
                  {getActionIcon('corporate-vehicles', isActiveRoute('CorporateVehicles'))}
                </ThemedText>
                <ThemedText
                  style={[
                    styles.menuItemText,
                    isActiveRoute('CorporateVehicles') && styles.activeMenuItemText
                  ]}
                >
                  Vehículos corporativos
                </ThemedText>
              </TouchableOpacity>
            )}

            {(role === 'SUPERVISOR' || role === 'ADMINISTRATIVO') && division === 'Aseo y Limpieza' && (
              <TouchableOpacity
                style={[
                  styles.menuItem,
                  isActiveRoute('InductionTourRecord') && styles.activeMenuItem
                ]}
                onPress={handleInductionTourRecordPress}
              >
                <ThemedText
                  style={[
                    styles.menuItemText,
                    isActiveRoute('InductionTourRecord') && styles.activeMenuItemText
                  ]}
                >
                  {getActionIcon('induction-tour-record', isActiveRoute('InductionTourRecord'))}
                </ThemedText>
                <ThemedText
                  style={[
                    styles.menuItemText,
                    isActiveRoute('InductionTourRecord') && styles.activeMenuItemText
                  ]}
                >
                  Registro de Induc. y Recorrd.
                </ThemedText>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.menuItem,
                isActiveRoute('GeneralInductionRegister') && styles.activeMenuItem
              ]}
              onPress={handleGeneralInductionRegisterPress}
            >
              <ThemedText
                style={[
                  styles.menuItemText,
                  isActiveRoute('GeneralInductionRegister') && styles.activeMenuItemText
                ]}
              >
                {getActionIcon('general-induction-register', isActiveRoute('GeneralInductionRegister'))}
              </ThemedText>
              <ThemedText
                style={[
                  styles.menuItemText,
                  isActiveRoute('GeneralInductionRegister') && styles.activeMenuItemText
                ]}
              >
                Registro Inducción General
              </ThemedText>
            </TouchableOpacity>

            {(role === 'OPERATIVO' || role === 'SUPERVISOR') && division === 'Aseo y Limpieza' && (
              <TouchableOpacity
                style={[
                  styles.menuItem,
                  isActiveRoute('AttendanceControl') && styles.activeMenuItem
                ]}
                onPress={handleAttendanceControlPress}
              >
                <ThemedText
                  style={[
                    styles.menuItemText,
                    isActiveRoute('AttendanceControl') && styles.activeMenuItemText
                  ]}
                >
                  {getActionIcon('attendance-control', isActiveRoute('AttendanceControl'))}
                </ThemedText>
                <ThemedText
                  style={[
                    styles.menuItemText,
                    isActiveRoute('AttendanceControl') && styles.activeMenuItemText
                  ]}
                >
                  Control de Asistencia
                </ThemedText>
              </TouchableOpacity>
            )}

            { /* Empezamos aquí */}
            <TouchableOpacity
              style={[
                styles.menuItem,
                isActiveRoute('PermitRequest') && styles.activeMenuItem
              ]}
              onPress={handlePermitRequestPress}
            >
              <ThemedText
                style={[
                  styles.menuItemText,
                  isActiveRoute('PermitRequest') && styles.activeMenuItemText
                ]}
              >
                {getActionIcon('permit-request', isActiveRoute('PermitRequest'))}
              </ThemedText>
              <ThemedText
                style={[
                  styles.menuItemText,
                  isActiveRoute('PermitRequest') && styles.activeMenuItemText
                ]}
              >
                Solicitud de permiso
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.menuItem,
                isActiveRoute('OpeningClosingPosition') && styles.activeMenuItem
              ]}
              onPress={handleOpeningClosingPositionPress}
            >
              <ThemedText
                style={[
                  styles.menuItemText,
                  isActiveRoute('OpeningClosingPosition') && styles.activeMenuItemText
                ]}
              >
                {getActionIcon('opening-closing-position', isActiveRoute('OpeningClosingPosition'))}
              </ThemedText>
              <ThemedText
                style={[
                  styles.menuItemText,
                  isActiveRoute('OpeningClosingPosition') && styles.activeMenuItemText
                ]}
              >
                Apertura-Cierre de Puesto
              </ThemedText>
            </TouchableOpacity>

            {(role === 'ADMINISTRADOR' || role === 'SUPERVISOR') && division === 'Aseo y Limpieza' && (
              <TouchableOpacity
                style={[
                  styles.menuItem,
                  isActiveRoute('ActaEntregaProductos') && styles.activeMenuItem
                ]}
                onPress={handleActaEntregaProductosPress}
              >
                <ThemedText
                  style={[
                    styles.menuItemText,
                    isActiveRoute('ActaEntregaProductos') && styles.activeMenuItemText
                  ]}
                >
                  {getActionIcon('acta-entrega-productos', isActiveRoute('ActaEntregaProductos'))}
                </ThemedText>
                <ThemedText
                  style={[
                    styles.menuItemText,
                    isActiveRoute('ActaEntregaProductos') && styles.activeMenuItemText
                  ]}
                >
                  Acta de entrega de productos
                </ThemedText>
              </TouchableOpacity>
            )}

            {false && (
              <ThemedView style={styles.collapsibleSection}>
                {/* Configuraciones Section */}
                <TouchableOpacity
                  style={styles.sectionHeader}
                  onPress={() => toggleSection('configuraciones')}
                >
                  <ThemedText style={styles.sectionHeaderText}>Configuraciones</ThemedText>
                  <ThemedText style={styles.sectionArrow}>
                    {expandedSections['configuraciones'] ? '▼' : '▶'}
                  </ThemedText>
                </TouchableOpacity>

                {/*expandedSections['configuraciones'] && (
                <ThemedView style={styles.sectionContent}>
                  <TouchableOpacity 
                    style={[
                      styles.subMenuItem,
                      isActiveRoute('roles') && styles.activeSubMenuItem
                    ]} 
                    onPress={handleRolesPress}
                  >
                    <ThemedText 
                      style={[
                        styles.subMenuItemText,
                        isActiveRoute('roles') && styles.activeSubMenuItemText
                      ]}
                    >
                      Roles
                    </ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[
                      styles.subMenuItem,
                      isActiveRoute('rules') && styles.activeSubMenuItem
                    ]} 
                    onPress={handleRulesPress}
                  >
                    <ThemedText 
                      style={[
                        styles.subMenuItemText,
                        isActiveRoute('rules') && styles.activeSubMenuItemText
                      ]}
                    >
                      Reglas
                    </ThemedText>
                  </TouchableOpacity>
                </ThemedView>
              )*/}
              </ThemedView>
            )}
          </ScrollView>

          {/* Logout Section at Bottom */}
          <ThemedView style={styles.logoutSection}>
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <ThemedText style={styles.logoutButtonText}>{getActionIcon('logout', false)} Cerrar Sesión</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        </ThemedView>
      </Animated.View>

      {/* Logout Loading Modal */}
      <Modal
        visible={isLoggingOut}
        transparent={true}
        animationType="fade"
      >
        <ThemedView style={styles.loadingOverlay}>
          <ThemedView style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <ThemedText style={styles.loadingText}>
              Cerrando sesión...
            </ThemedText>
          </ThemedView>
        </ThemedView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 999,
  },
  menuContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: MENU_WIDTH,
    zIndex: 1000,
  },
  menu: {
    flex: 1,
    paddingTop: 50, // Account for status bar
  },
  headerSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  appTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  userInfo: {
    gap: 4,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
  },
  userEmail: {
    fontSize: 14,
    opacity: 0.7,
  },
  menuOptions: {
    flex: 1,
  },
  menuOptionsContent: {
    paddingTop: 20,
    paddingBottom: 20,
  },
  menuItem: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '500',
  },
  collapsibleSection: {
    marginTop: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1
  },
  sectionHeaderText: {
    fontSize: 16,
    fontWeight: '600',
  },
  sectionArrow: {
    fontSize: 14,
    color: '#666666',
  },
  sectionContent: {

  },
  subMenuItem: {
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderBottomWidth: 1
  },
  subMenuItemText: {
    fontSize: 15,
    fontWeight: '400',
  },
  activeMenuItem: {
    backgroundColor: '#E3F2FD',
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  activeMenuItemText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  activeSubMenuItem: {
    backgroundColor: '#E8F4FD',
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  activeSubMenuItemText: {
    color: '#007AFF',
    fontWeight: '500',
  },
  logoutSection: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  logoutButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    backgroundColor: '#ffffff',
    padding: 30,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
    textAlign: 'center',
  },
});
