import 'react-native-gesture-handler';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import React, { useCallback, useEffect, useRef } from 'react';
import { NavigationContainer, DarkTheme, DefaultTheme, CommonActions, useFocusEffect } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './contexts/AuthContext';
import { useColorScheme } from './hooks/useColorScheme';
import saveLunchTime from './hooks/saveLunchTime';
import { useAuth } from './contexts/AuthContext';
import { createVehicle, updateVehicle, deleteVehicle } from './hooks/vehiclesFunctions';
import { createNote, updateNote } from './hooks/notesFunctions';
import { markNotificationsAsRead } from './hooks/notificationsFunctions';
import { createSurvey as createSurveyAPI } from './hooks/surveysFunctions';
import { createTraining } from './hooks/trainingFunctions';
import { createVoiceNote, deleteVoiceNote } from './hooks/voiceNotesFunctions';
import { eventBus } from './hooks/eventBus';

import HomeScreen from './screens/HomeScreen';
import LoginScreen from './screens/LoginScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import VerifyCodeScreen from './screens/VerifyCodeScreen';
import RecoverPasswordScreen from './screens/RecoverPasswordScreen';
import RolesScreen from './screens/RolesScreen';
import RulesScreen from './screens/RulesScreen';
import PermissionsScreen from './screens/PermissionsScreen';
import RolePermissionsScreen from './screens/RolePermissionsScreen';
import LunchTimeScreen from './screens/LunchTimeScreen';
import DigitalSignatureScreen from './screens/DigitalSignatureScreen';
import MarcarIngresoSalidaScreen from './screens/MarcarIngresoSalidaScreen';
import EmployeeProfileScreen from './screens/EmployeeProfileScreen';
import NotesScreen from './screens/NotesScreen';
import ActivitiesScreen from './screens/ActivitiesScreen';
import VehiclesScreen from './screens/VehiclesScreen';
import VisitorsScreen from './screens/VisitorsScreen';
import EvaluationsScreen from './screens/EvaluationsScreen';
import IncidentsScreen from './screens/IncidentsScreen';
import NotificationsScreen from './screens/NotificationsScreen';
// import SurveysScreen from './screens/SurveysScreen'; // TODO: Create this screen
import TrainingsScreen from './screens/TrainingsScreen';
import VoiceNotesScreen from './screens/VoiceNotesScreen';
import SatisfactionSurveysScreen from './screens/SatisfactionSurveysScreen';
import MileageControlScreen from './screens/MileageControlScreen';
import UniformRequestScreen from './screens/UniformRequestScreen';
import RoutesAndToursScreen from './screens/RoutesAndToursScreen';
import EmployeeSatisfactionScreen from './screens/EmployeeSatisfactionScreen';
import VehicleMaintenanceScreen from './screens/VehicleMaintenanceScreen';
import NonConformingProductScreen from './screens/NonConformingProductScreen';
import ComplaintsMasterScreen from './screens/ComplaintsMasterScreen';
import CleanersControlScreen from './screens/CleanersControlScreen';
import PhysicalMinuteAgendaScreen from './screens/PhysicalMinuteAgendaScreen';
import ActionPlanScreen from './screens/ActionPlanScreen';
import WorkRoleScreen from './screens/WorkRoleScreen';
import ContractBasicDataScreen from './screens/ContractBasicDataScreen';
import DeliveryScheduleScreen from './screens/DeliveryScheduleScreen';
import EnvironmentalManagementPlanScreen from './screens/EnvironmentalManagementPlanScreen';
import CleaningWorkPlanScreen from './screens/CleaningWorkPlanScreen';
import SpecialSituationsPlanScreen from './screens/SpecialSituationsPlanScreen';
import CleaningTasksActivitiesScreen from './screens/CleaningTasksActivitiesScreen';
import RiskMatrixScreen from './screens/RiskMatrixScreen';
import OpportunityMatrixScreen from './screens/OpportunityMatrixScreen';
import ProcessIndicatorMatrixScreen from './screens/ProcessIndicatorMatrixScreen';
import MonthlyWorkRoleScreen from './screens/MonthlyWorkRoleScreen';
import PermitRequestScreen from './screens/PermitRequestScreen';
import AttendanceControlScreen from './screens/AttendanceControlScreen';
import OpeningClosingPositionScreen from './screens/OpeningClosingPositionScreen';
import InductionTourRecordScreen from './screens/InductionTourRecordScreen';
import SupervisionReportScreen from './screens/SupervisionReportScreen';
import ElectricBrushGuideScreen from './screens/ElectricBrushGuideScreen';
import GeneralClientsListScreen from './screens/GeneralClientsListScreen';
import ImprovementActionsControlScreen from './screens/ImprovementActionsControlScreen';
import QualityPolicyScreen from './screens/QualityPolicyScreen';
import BusinessQualityObjectivesScreen from './screens/BusinessQualityObjectivesScreen';
import StakeholderAnalysisMatrixScreen from './screens/StakeholderAnalysisMatrixScreen';
import CommunicationPlanScreen from './screens/CommunicationPlanScreen';
import KnowledgeManagementMatrixScreen from './screens/KnowledgeManagementMatrixScreen';
import ChangePlanningScreen from './screens/ChangePlanningScreen';
import ManagementPlanningControlScreen from './screens/ManagementPlanningControlScreen';
import CommunicationPlanRequirementsScreen from './screens/CommunicationPlanRequirementsScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import saveManualSignature from './hooks/saveManualSignature';
import saveMarca from './hooks/saveMarca';
import saveAbsentReason from './hooks/saveAbsentReason';
import getHoraAccion from './hooks/getHoraAccion';
import updateServerTime, { setDisconnectedTime } from './hooks/updateServerTime';

export type RootStackParamList = {
  Home: undefined;
  Login: undefined;
  ForgotPassword: undefined;
  VerifyCode: {
    cedula: string;
    message?: string;
  };
  RecoverPassword: {
    token: string;
    employeeId: string;
    employeeName: string;
    employeeEmail: string;
    employeeCedula: string;
    employeeTelefono: string;
  };
  Roles: undefined;
  Rules: undefined;
  Permissions: undefined;
  RolePermissions: undefined;
  LunchTime: undefined;
  DigitalSignature: undefined;
  MarcarIngresoSalida: undefined;
  EmployeeProfile: undefined;
  Notes: undefined;
  Activities: undefined;
  Vehicles: undefined;
  Visitors: undefined;
  Evaluations: undefined;
  Incidents: undefined;
  Notifications: undefined;
  Surveys: undefined;
  Trainings: undefined;
  VoiceNotes: undefined;
  SatisfactionSurveys: undefined;
  MileageControl: undefined;
  UniformRequest: undefined;
  RoutesAndTours: undefined;
  EmployeeSatisfaction: undefined;
  VehicleMaintenance: undefined;
  NonConformingProduct: undefined;
  ComplaintsMaster: undefined;
  CleanersControl: undefined;
  PhysicalMinuteAgenda: undefined;
  ActionPlan: undefined;
  WorkRole: undefined;
  ContractBasicData: undefined;
  DeliverySchedule: undefined;
  EnvironmentalManagementPlan: undefined;
  CleaningWorkPlan: undefined;
  SpecialSituationsPlan: undefined;
  CleaningTasksActivities: undefined;
  RiskMatrix: undefined;
  OpportunityMatrix: undefined;
  ProcessIndicatorMatrix: undefined;
  MonthlyWorkRole: undefined;
  PermitRequest: undefined;
  AttendanceControl: undefined;
  OpeningClosingPosition: undefined;
  InductionTourRecord: undefined;
  SupervisionReport: undefined;
  ElectricBrushGuide: undefined;
  GeneralClientsList: undefined;
  ImprovementActionsControl: undefined;
  QualityPolicy: undefined;
  BusinessQualityObjectives: undefined;
  StakeholderAnalysisMatrix: undefined;
  CommunicationPlan: undefined;
  KnowledgeManagementMatrix: undefined;
  ChangePlanning: undefined;
  ManagementPlanningControl: undefined;
  CommunicationPlanRequirements: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function RootNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="VerifyCode" component={VerifyCodeScreen} />
      <Stack.Screen name="RecoverPassword" component={RecoverPasswordScreen} />
      <Stack.Screen name="Roles" component={RolesScreen} />
      <Stack.Screen name="Rules" component={RulesScreen} />
      <Stack.Screen name="Permissions" component={PermissionsScreen} />
      <Stack.Screen name="RolePermissions" component={RolePermissionsScreen} />
      <Stack.Screen name="LunchTime" component={LunchTimeScreen} />
      <Stack.Screen name="DigitalSignature" component={DigitalSignatureScreen} />
      <Stack.Screen name="MarcarIngresoSalida" component={MarcarIngresoSalidaScreen} />
      <Stack.Screen name="EmployeeProfile" component={EmployeeProfileScreen} />
      <Stack.Screen name="Notes" component={NotesScreen} />
      <Stack.Screen name="Activities" component={ActivitiesScreen} />
      <Stack.Screen name="Vehicles" component={VehiclesScreen} />
      <Stack.Screen name="Visitors" component={VisitorsScreen} />
      <Stack.Screen name="Evaluations" component={EvaluationsScreen} />
      <Stack.Screen name="Incidents" component={IncidentsScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      {/* <Stack.Screen name="Surveys" component={SurveysScreen} /> */}
      <Stack.Screen name="Trainings" component={TrainingsScreen} />
      <Stack.Screen name="VoiceNotes" component={VoiceNotesScreen} />
      <Stack.Screen name="SatisfactionSurveys" component={SatisfactionSurveysScreen} />
      <Stack.Screen name="MileageControl" component={MileageControlScreen} />
      <Stack.Screen name="UniformRequest" component={UniformRequestScreen} />
      <Stack.Screen name="RoutesAndTours" component={RoutesAndToursScreen} />
      <Stack.Screen name="EmployeeSatisfaction" component={EmployeeSatisfactionScreen} />
      <Stack.Screen name="VehicleMaintenance" component={VehicleMaintenanceScreen} />
      <Stack.Screen name="NonConformingProduct" component={NonConformingProductScreen} />
      <Stack.Screen name="ComplaintsMaster" component={ComplaintsMasterScreen} />
      <Stack.Screen name="CleanersControl" component={CleanersControlScreen} />
      <Stack.Screen name="PhysicalMinuteAgenda" component={PhysicalMinuteAgendaScreen} />
      <Stack.Screen name="ActionPlan" component={ActionPlanScreen} />
      <Stack.Screen name="WorkRole" component={WorkRoleScreen} />
      <Stack.Screen name="ContractBasicData" component={ContractBasicDataScreen} />
      <Stack.Screen name="DeliverySchedule" component={DeliveryScheduleScreen} />
      <Stack.Screen name="EnvironmentalManagementPlan" component={EnvironmentalManagementPlanScreen} />
      <Stack.Screen name="CleaningWorkPlan" component={CleaningWorkPlanScreen} />
      <Stack.Screen name="SpecialSituationsPlan" component={SpecialSituationsPlanScreen} />
      <Stack.Screen name="CleaningTasksActivities" component={CleaningTasksActivitiesScreen} />
      <Stack.Screen name="RiskMatrix" component={RiskMatrixScreen} />
      <Stack.Screen name="OpportunityMatrix" component={OpportunityMatrixScreen} />
      <Stack.Screen name="ProcessIndicatorMatrix" component={ProcessIndicatorMatrixScreen} />
      <Stack.Screen name="MonthlyWorkRole" component={MonthlyWorkRoleScreen} />
      <Stack.Screen name="PermitRequest" component={PermitRequestScreen} />
      <Stack.Screen name="AttendanceControl" component={AttendanceControlScreen} />
      <Stack.Screen name="OpeningClosingPosition" component={OpeningClosingPositionScreen} />
      <Stack.Screen name="InductionTourRecord" component={InductionTourRecordScreen} />
      <Stack.Screen name="SupervisionReport" component={SupervisionReportScreen} />
      <Stack.Screen name="ElectricBrushGuide" component={ElectricBrushGuideScreen} />
      <Stack.Screen name="GeneralClientsList" component={GeneralClientsListScreen} />
      <Stack.Screen name="ImprovementActionsControl" component={ImprovementActionsControlScreen} />
      <Stack.Screen name="QualityPolicy" component={QualityPolicyScreen} />
      <Stack.Screen name="BusinessQualityObjectives" component={BusinessQualityObjectivesScreen} />
      <Stack.Screen name="StakeholderAnalysisMatrix" component={StakeholderAnalysisMatrixScreen} />
      <Stack.Screen name="CommunicationPlan" component={CommunicationPlanScreen} />
      <Stack.Screen name="KnowledgeManagementMatrix" component={KnowledgeManagementMatrixScreen} />
      <Stack.Screen name="ChangePlanning" component={ChangePlanningScreen} />
      <Stack.Screen name="ManagementPlanningControl" component={ManagementPlanningControlScreen} />
      <Stack.Screen name="CommunicationPlanRequirements" component={CommunicationPlanRequirementsScreen} />
    </Stack.Navigator>
  );
}

function AppContent() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('./assets/fonts/SpaceMono-Regular.ttf'),
  });
  const { employee, refreshAccessToken, logout } = useAuth();

  const navigationRef = useRef<any>(null);
  const routeNameRef = useRef<string | undefined>(undefined);
  // 🆕 Variable de estado para conexión a internet
  const [isConnected, setIsConnected] = React.useState<boolean | null>(null);
 
  const FORCE_OFFLINE = false;
  
  // 🆕 useEffect para escuchar el estado de conexión en tiempo real
  useEffect(() => {
    // Verificar conexión inicial
    if (FORCE_OFFLINE) {
      setIsConnected(false);
      return;
    }

    const checkInitialConnection = async () => {
      const state = await Network.getNetworkStateAsync();
      setIsConnected(state.isConnected && state.isInternetReachable ? true : false);
    };

    checkInitialConnection();

    // Suscribirse a cambios en la conexión
    const subscription = Network.addNetworkStateListener(state => {
      setIsConnected(state.isConnected && state.isInternetReachable ? true : false);
    });

    return () => subscription.remove();
  }, []);
 
  // 🆕 Mostrar alerta si se pierde la conexión
  useEffect(() => {
    const checkCaches = async () => {
      if (isConnected === false) {
        console.log('Sin conexión');
      }
      else {
        console.log('Conectado');
        console.log('Funciones que se ejecutarán cuando se recupera la conexión');
        await Promise.all([
          checkManualSignatureCache(),
          checkMarcaCache(),
          checkAbsentReasonCache(),
          checkLunchTimeActionsCache(), 
          checkVehiclesActionsCache(),
          checkNotificationsActionsCache(),
          checkVisitorsActionsCache(),
          checkNotesActionsCache(),
          checkActivitiesActionsCache(),
          checkEvaluationsActionsCache(),
          checkSurveysActionsCache(),
          checkTrainingsActionsCache(),
          checkIncidentsActionsCache(),
          checkVoiceNotesActionsCache(),
        ]);
        eventBus.emit('connectionRestored');
      }
    }
    checkCaches();
  }, [isConnected]);

  const checkManualSignatureCache = async () => {
    if (!employee) return;
    const manual_signature_cache = await AsyncStorage.getItem('manual_signature_cache');
    if(manual_signature_cache) {
      const data = await saveManualSignature({ signature: manual_signature_cache, employeeId: employee.id, refreshAccessToken, logout }); 
      if (data.status) {
        console.log('Firma guardada correctamente');
      }
    }
  }

  const checkMarcaCache = async () => {
    const marca_cache = await AsyncStorage.getItem('marca_cache');
    if(marca_cache) {
      const data_params = JSON.parse(marca_cache);
      const data = await saveMarca({ data_params: { type: data_params.type, reason: data_params.reason, horaAccion: data_params.horaAccion }, marcaId: data_params.marcaId, refreshAccessToken, logout });
      if (data.status) {
        console.log('Marca guardada correctamente');
      }
    }
  }

  const checkAbsentReasonCache = async () => {
    const absent_reason_cache = await AsyncStorage.getItem('absent_reason_cache');
    if(absent_reason_cache) {
      const data_params = JSON.parse(absent_reason_cache);
      const data = await saveAbsentReason({ reason: data_params.reason, marcaId: data_params.marcaId, refreshAccessToken, logout });
      if (data.status) {
        console.log('Motivo de ausencia guardado correctamente');
      }
    }
  }

  const checkVisitorsActionsCache = async () => {
    if (!employee) return;
    
    const actionsStr = await AsyncStorage.getItem('visitors_actions');
    if (!actionsStr) return;

    const actions = JSON.parse(actionsStr);
    if (!actions || actions.length === 0) return;

    console.log('Sincronizando acciones de visitantes:', actions.length);

    // Procesar acciones una por una
    for (const action of actions) {
      try {
        if (action.type === 'create') {
          console.log('Creando visitante:', action.id);
          const { createVisitor } = await import('@/hooks/visitorsFunctions');
          const result = await createVisitor({
            requestData: action.requestData,
            marcaId: action.marcaId,
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            console.log('Visitante creado correctamente');
            // Eliminar acción del array
            const updatedActions = actions.filter((a: any) => a.id !== action.id || a.type !== 'create');
            await AsyncStorage.setItem('visitors_actions', JSON.stringify(updatedActions));
          }
        } else if (action.type === 'update') {
          console.log('Actualizando visitante:', action.id);
          const { updateVisitor } = await import('@/hooks/visitorsFunctions');
          const result = await updateVisitor({
            requestData: action.requestData,
            visitorId: action.id,
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            console.log('Visitante actualizado correctamente');
            // Eliminar acción del array
            const updatedActions = actions.filter((a: any) => a.id !== action.id || a.type !== 'update');
            await AsyncStorage.setItem('visitors_actions', JSON.stringify(updatedActions));
          }
        } else if (action.type === 'delete') {
          console.log('Eliminando visitante:', action.id);
          const { deleteVisitor } = await import('@/hooks/visitorsFunctions');
          const result = await deleteVisitor({
            visitorId: action.id,
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            console.log('Visitante eliminado correctamente');
            // Eliminar acción del array
            const updatedActions = actions.filter((a: any) => a.id !== action.id || a.type !== 'delete');
            await AsyncStorage.setItem('visitors_actions', JSON.stringify(updatedActions));
          }
        }
      } catch (error) {
        console.error('Error procesando acción de visitante:', error);
      }
    }
  }

  const checkVehiclesActionsCache = async () => {
    if (!employee) return;
    
    const actionsStr = await AsyncStorage.getItem('vehicles_actions');
    if (!actionsStr) return;

    const actions = JSON.parse(actionsStr);
    if (!actions || actions.length === 0) return;

    console.log('Sincronizando acciones de vehículos:', actions.length);

    // Procesar acciones una por una
    for (const action of actions) {
      try {
        if (action.type === 'create') {
          console.log('Creando vehículo:', action.id);
          const result = await createVehicle({
            requestData: action.requestData,
            marcaId: action.marcaId,
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            console.log('Vehículo creado correctamente');
            // Eliminar acción del array
            const updatedActions = actions.filter((a: any) => a.id !== action.id || a.type !== 'create');
            await AsyncStorage.setItem('vehicles_actions', JSON.stringify(updatedActions));
          }
        } else if (action.type === 'update') {
          console.log('Actualizando vehículo:', action.id);
          const result = await updateVehicle({
            requestData: action.requestData,
            vehicleId: action.id,
            marcaId: action.requestData.marca_id,
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            console.log('Vehículo actualizado correctamente');
            // Eliminar acción del array
            const updatedActions = actions.filter((a: any) => a.id !== action.id || a.type !== 'update');
            await AsyncStorage.setItem('vehicles_actions', JSON.stringify(updatedActions));
          }
        } else if (action.type === 'delete') {
          console.log('Eliminando vehículo:', action.id);
          const result = await deleteVehicle({
            vehicleId: action.id,
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            console.log('Vehículo eliminado correctamente');
            // Eliminar acción del array
            const updatedActions = actions.filter((a: any) => a.id !== action.id || a.type !== 'delete');
            await AsyncStorage.setItem('vehicles_actions', JSON.stringify(updatedActions));
          }
        }
      } catch (error) {
        console.error('Error procesando acción de vehículo:', error);
      }
    }
  }

  const checkNotificationsActionsCache = async () => {
    if (!employee) return;
    
    const actionsStr = await AsyncStorage.getItem('notifications_actions');
    if (!actionsStr) return;

    const actions = JSON.parse(actionsStr);
    if (!actions || actions.length === 0) return;

    console.log('Sincronizando acciones de notificaciones:', actions.length);

    // Procesar acciones una por una
    for (const action of actions) {
      try {
        if (action.type === 'markAsRead') {
          console.log('Marcando notificaciones como leídas:', action.notificationIds);
          const result = await markNotificationsAsRead({
            notificationIds: action.notificationIds,
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            console.log('Notificaciones marcadas como leídas correctamente');
            // Eliminar esta acción específica del array
            const updatedActions = actions.filter((a: any) => 
              !(a.type === 'markAsRead' && JSON.stringify(a.notificationIds) === JSON.stringify(action.notificationIds))
            );
            await AsyncStorage.setItem('notifications_actions', JSON.stringify(updatedActions));
            
            // Emitir evento para actualizar la UI
            eventBus.emit('notificationsUpdated');
          }
        }
      } catch (error) {
        console.error('Error procesando acción de notificación:', error);
      }
    }
  }

  const checkLunchTimeActionsCache = async () => {
    if (!employee) return;
    
    const actionsStr = await AsyncStorage.getItem('lunchtime_actions');
    if (!actionsStr) return;

    const actions = JSON.parse(actionsStr);
    if (!actions || actions.length === 0) return;

    console.log('Sincronizando acciones de lunch time:', actions.length);

    // Procesar acciones una por una
    for (const action of actions) {
      try {
        if (action.type === 'create') {
          console.log('Guardando lunch time:', action.id);
          const result = await saveLunchTime({
            requestData: action.requestData,
            employeeId: employee.id,
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            console.log('Lunch time guardado correctamente');
            // Eliminar acción del array
            const updatedActions = actions.filter((a: any) => a.id !== action.id || a.type !== 'create');
            await AsyncStorage.setItem('lunchtime_actions', JSON.stringify(updatedActions));
          }
        }
      } catch (error) {
        console.error('Error procesando acción de lunch time:', error);
      }
    }
  }

  const checkNotesActionsCache = async () => {
    if (!employee) return;
    
    const actionsStr = await AsyncStorage.getItem('notes_actions');
    if (!actionsStr) return;

    const actions = JSON.parse(actionsStr);
    if (!actions || actions.length === 0) return;

    console.log('Sincronizando acciones de notas:', actions.length);

    // Procesar acciones una por una
    for (const action of actions) {
      try {
        if (action.type === 'create') {
          console.log('Creando nota:', action.id);
          const result = await createNote({
            requestData: action.requestData,
            marcaId: action.marcaId,
            puestoId: action.puestoId,
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            console.log('Nota creada correctamente');
            // Eliminar acción del array
            const updatedActions = actions.filter((a: any) => a.id !== action.id || a.type !== 'create');
            await AsyncStorage.setItem('notes_actions', JSON.stringify(updatedActions));
          }
        } else if (action.type === 'update') {
          console.log('Actualizando nota:', action.id);
          const result = await updateNote({
            requestData: action.requestData,
            noteId: action.id,
            puestoId: action.puestoId,
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            console.log('Nota actualizada correctamente');
            // Eliminar acción del array
            const updatedActions = actions.filter((a: any) => a.id !== action.id || a.type !== 'update');
            await AsyncStorage.setItem('notes_actions', JSON.stringify(updatedActions));
          }
        }
      } catch (error) {
        console.error('Error procesando acción de nota:', error);
      }
    }
  }

  const checkActivitiesActionsCache = async () => {
    if (!employee) return;
    
    const actionsStr = await AsyncStorage.getItem('activities_actions');
    if (!actionsStr) return;

    const actions = JSON.parse(actionsStr);
    if (!actions || actions.length === 0) return;

    console.log('Sincronizando acciones de actividades:', actions.length);

    for (const action of actions) {
      try {
        if (action.type === 'update') {
          console.log('Actualizando actividad:', action.activity_id);
          const { updateActivity } = await import('@/hooks/activitiesFunctions');
          const result = await updateActivity({
            requestData: action.requestData,
            activityId: action.activity_id,
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            console.log('Actividad actualizada correctamente');
            const updatedActions = actions.filter(
              (a: any) => !(a.activity_id === action.activity_id && a.type === 'update')
            );
            await AsyncStorage.setItem('activities_actions', JSON.stringify(updatedActions));
          }
        } else if (action.type === 'update-equipo') {
          console.log('Actualizando revisión de equipo:', action.revisionEquipo_id);
          const { updateRevisionEquipo } = await import('@/hooks/activitiesFunctions');
          const result = await updateRevisionEquipo({
            requestData: action.requestData,
            revisionEquipoId: action.revisionEquipo_id,
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            console.log('Revisión de equipo actualizada correctamente');
            const updatedActions = actions.filter(
              (a: any) => !(a.revisionEquipo_id === action.revisionEquipo_id && a.type === 'update-equipo')
            );
            await AsyncStorage.setItem('activities_actions', JSON.stringify(updatedActions));
          }
        }
      } catch (error) {
        console.error('Error procesando acción de actividad:', error);
      }
    }
  }
  
  const checkEvaluationsActionsCache = async () => {
    if (!employee) return;
    
    const actionsStr = await AsyncStorage.getItem('evaluations_actions');
    if (!actionsStr) return;

    const actions = JSON.parse(actionsStr);
    if (!actions || actions.length === 0) return;

    console.log('Sincronizando acciones de evaluaciones:', actions.length);

    // Procesar acciones una por una
    for (const action of actions) {
      try {
        if (action.action === 'create') {
          if (action.type === 'mileage_control') {
            console.log('Creando control de kilometraje:', action.id);
            const { createMileageControl } = await import('@/hooks/evaluationFunctions');
            const result = await createMileageControl({
              requestData: action.payload,
              refreshAccessToken,
              logout,
            });

            if (result.status) {
              console.log('Control de kilometraje creado correctamente');
              // Eliminar acción del array
              const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'create' && a.type === 'mileage_control'));
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
              
              // Actualizar cache para marcar como sincronizado
              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr);
                const updatedCache = cache.map((item: any) => {
                  if (item.id_local === action.id && item.type === 'mileage_control') {
                    return { ...item, synced: true, id: result.data?.id || item.id };
                  }
                  return item;
                });
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
              }
            }
          } else if (action.type === 'uniform_request') {
            console.log('Creando solicitud de uniforme:', action.id);
            const { createUniformRequest } = await import('@/hooks/evaluationFunctions');
            const result = await createUniformRequest({
              requestData: action.payload,
              refreshAccessToken,
              logout,
            });

            if (result.status) {
              console.log('Solicitud de uniforme creada correctamente');
              // Eliminar acción del array
              const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'create' && a.type === 'uniform_request'));
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
              
              // Actualizar cache para marcar como sincronizado
              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr);
                const updatedCache = cache.map((item: any) => {
                  if (item.id_local === action.id && item.type === 'uniform_request') {
                    return { ...item, synced: true, id: result.data?.id || item.id };
                  }
                  return item;
                });
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                  }
                }
              } else if (action.type === 'employee_satisfaction') {
                console.log('Creando encuesta de satisfacción:', action.id);
                const { createEmployeeSatisfaction } = await import('@/hooks/evaluationFunctions');
                const result = await createEmployeeSatisfaction({
                  requestData: action.payload,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  console.log('Encuesta de satisfacción creada correctamente');
                  const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'create' && a.type === 'employee_satisfaction'));
                  await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
                  
                  const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                  if (cacheStr) {
                    const cache = JSON.parse(cacheStr);
                    const updatedCache = cache.map((item: any) => {
                      if (item.id_local === action.id && item.type === 'employee_satisfaction') {
                        return { ...item, synced: true, id: result.data?.id || item.id };
                      }
                      return item;
                    });
                    await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                  }
                }
              } else if (action.type === 'vehicle_maintenance') {
                console.log('Creando planificación de mantenimiento:', action.id);
                const { createVehicleMaintenance } = await import('@/hooks/evaluationFunctions');
                const result = await createVehicleMaintenance({
                  requestData: action.payload,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  console.log('Planificación de mantenimiento creada correctamente');
                  const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'create' && a.type === 'vehicle_maintenance'));
                  await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
                  
                  const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                  if (cacheStr) {
                    const cache = JSON.parse(cacheStr);
                    const updatedCache = cache.map((item: any) => {
                      if (item.id_local === action.id && item.type === 'vehicle_maintenance') {
                        return { ...item, synced: true, id: result.data?.id || item.id };
                      }
                      return item;
                    });
                    await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                  }
                }
              } else if (action.type === 'non_conforming_product') {
                console.log('Creando producto no conforme:', action.id);
                const { createNonConformingProduct } = await import('@/hooks/evaluationFunctions');
                const result = await createNonConformingProduct({
                  requestData: action.payload,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  console.log('Producto no conforme creado correctamente');
                  const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'create' && a.type === 'non_conforming_product'));
                  await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
                  
                  const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                  if (cacheStr) {
                    const cache = JSON.parse(cacheStr);
                    const updatedCache = cache.map((item: any) => {
                      if (item.id_local === action.id && item.type === 'non_conforming_product') {
                        return { ...item, synced: true, id: result.data?.id || item.id };
                      }
                      return item;
                    });
                    await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                  }
                }
              } else if (action.type === 'complaints_master') {
                console.log('Creando queja:', action.id);
                const { createComplaintsMaster } = await import('@/hooks/evaluationFunctions');
                const result = await createComplaintsMaster({
                  requestData: action.payload,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  console.log('Queja creada correctamente');
                  const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'create' && a.type === 'complaints_master'));
                  await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
                  
                  const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                  if (cacheStr) {
                    const cache = JSON.parse(cacheStr);
                    const updatedCache = cache.map((item: any) => {
                      if (item.id_local === action.id && item.type === 'complaints_master') {
                        return { ...item, synced: true, id: result.data?.id || item.id };
                      }
                      return item;
                    });
                    await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                  }
                }
              } else if (action.type === 'cleaners_control') {
                console.log('Creando control de aseadores:', action.id);
                const { createCleanersControl } = await import('@/hooks/evaluationFunctions');
                const result = await createCleanersControl({
                  requestData: action.payload,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  console.log('Control de aseadores creado correctamente');
                  const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'create' && a.type === 'cleaners_control'));
                  await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
                  
                  const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                  if (cacheStr) {
                    const cache = JSON.parse(cacheStr);
                    const updatedCache = cache.map((item: any) => {
                      if (item.id_local === action.id && item.type === 'cleaners_control') {
                        return { ...item, synced: true, id: result.data?.id || item.id };
                      }
                      return item;
                    });
                    await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                  }
                }
              } else if (action.type === 'physical_minute_agenda') {
                console.log('Creando agenda minuta física:', action.id);
                const { createPhysicalMinuteAgenda } = await import('@/hooks/evaluationFunctions');
                const result = await createPhysicalMinuteAgenda({
                  requestData: action.payload,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  console.log('Agenda minuta física creada correctamente');
                  const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'create' && a.type === 'physical_minute_agenda'));
                  await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
                  
                  const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                  if (cacheStr) {
                    const cache = JSON.parse(cacheStr);
                    const updatedCache = cache.map((item: any) => {
                      if (item.id_local === action.id && item.type === 'physical_minute_agenda') {
                        return { ...item, synced: true, id: result.data?.id || item.id };
                      }
                      return item;
                    });
                    await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                  }
                }
              } else if (action.type === 'action_plan') {
                console.log('Creando plan de acción:', action.id);
                const { createActionPlan } = await import('@/hooks/evaluationFunctions');
                const result = await createActionPlan({
                  requestData: action.payload,
                  refreshAccessToken,
                  logout,
                });

                if (result.status) {
                  console.log('Plan de acción creado correctamente');
                  const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'create' && a.type === 'action_plan'));
                  await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
                  
                  const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                  if (cacheStr) {
                    const cache = JSON.parse(cacheStr);
                    const updatedCache = cache.map((item: any) => {
                      if (item.id_local === action.id && item.type === 'action_plan') {
                        return { ...item, synced: true, id: result.data?.id || item.id };
                      }
                      return item;
                    });
                    await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                  }
                }
                  } else if (action.type === 'work_role') {
                    console.log('Creando rol de trabajo:', action.id);
                    const { createWorkRole } = await import('@/hooks/evaluationFunctions');
                    const result = await createWorkRole({
                      requestData: action.payload,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Rol de trabajo creado correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'create' && a.type === 'work_role'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));

                      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                      if (cacheStr) {
                        const cache = JSON.parse(cacheStr);
                        const updatedCache = cache.map((item: any) => {
                          if (item.id_local === action.id && item.type === 'work_role') {
                            return { ...item, synced: true, id: result.data?.id || item.id };
                          }
                          return item;
                        });
                        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                      }
                    }
                  } else if (action.type === 'contract_basic_data') {
                    console.log('Creando datos básicos de contrato:', action.id);
                    const { createContractBasicData } = await import('@/hooks/evaluationFunctions');
                    const result = await createContractBasicData({
                      requestData: action.payload,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Datos básicos de contrato creados correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'create' && a.type === 'contract_basic_data'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));

                      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                      if (cacheStr) {
                        const cache = JSON.parse(cacheStr);
                        const updatedCache = cache.map((item: any) => {
                          if (item.id_local === action.id && item.type === 'contract_basic_data') {
                            return { ...item, synced: true, id: result.data?.id || item.id };
                          }
                          return item;
                        });
                        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                      }
                    }
                  } else if (action.type === 'delivery_schedule') {
                    console.log('Creando cronograma de entrega:', action.id);
                    const { createDeliverySchedule } = await import('@/hooks/evaluationFunctions');
                    const result = await createDeliverySchedule({
                      requestData: action.payload,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Cronograma de entrega creado correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'create' && a.type === 'delivery_schedule'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));

                      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                      if (cacheStr) {
                        const cache = JSON.parse(cacheStr);
                        const updatedCache = cache.map((item: any) => {
                          if (item.id_local === action.id && item.type === 'delivery_schedule') {
                            return { ...item, synced: true, id: result.data?.id || item.id };
                          }
                          return item;
                        });
                        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                      }
                    }
                  } else if (action.type === 'environmental_management_plan') {
                    console.log('Creando plan de gestión ambiental:', action.id);
                    const { createEnvironmentalManagementPlan } = await import('@/hooks/evaluationFunctions');
                    const result = await createEnvironmentalManagementPlan({
                      requestData: action.payload,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Plan de gestión ambiental creado correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'create' && a.type === 'environmental_management_plan'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));

                      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                      if (cacheStr) {
                        const cache = JSON.parse(cacheStr);
                        const updatedCache = cache.map((item: any) => {
                          if (item.id_local === action.id && item.type === 'environmental_management_plan') {
                            return { ...item, synced: true, id: result.data?.id || item.id };
                          }
                          return item;
                        });
                        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                      }
                    }
                  } else if (action.type === 'cleaning_work_plan') {
                    console.log('Creando plan de trabajo - Personal Aseo y limpieza:', action.id);
                    const { createCleaningWorkPlan } = await import('@/hooks/evaluationFunctions');
                    const result = await createCleaningWorkPlan({
                      requestData: action.payload,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Plan de trabajo - Personal Aseo y limpieza creado correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'create' && a.type === 'cleaning_work_plan'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));

                      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                      if (cacheStr) {
                        const cache = JSON.parse(cacheStr);
                        const updatedCache = cache.map((item: any) => {
                          if (item.id_local === action.id && item.type === 'cleaning_work_plan') {
                            return { ...item, synced: true, id: result.data?.id || item.id };
                          }
                          return item;
                        });
                        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                      }
                    }
                  } else if (action.type === 'special_situations_plan') {
                    console.log('Creando plan para la atención de situaciones especiales:', action.id);
                    const { createSpecialSituationsPlan } = await import('@/hooks/evaluationFunctions');
                    const result = await createSpecialSituationsPlan({
                      requestData: action.payload,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Plan para la atención de situaciones especiales creado correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'create' && a.type === 'special_situations_plan'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));

                      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                      if (cacheStr) {
                        const cache = JSON.parse(cacheStr);
                        const updatedCache = cache.map((item: any) => {
                          if (item.id_local === action.id && item.type === 'special_situations_plan') {
                            return { ...item, synced: true, id: result.data?.id || item.id };
                          }
                          return item;
                        });
                        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                      }
                    }
                  } else if (action.type === 'cleaning_tasks_activities') {
                    console.log('Creando registro de tareas o actividades de limpieza:', action.id);
                    const { createCleaningTasksActivities } = await import('@/hooks/evaluationFunctions');
                    const result = await createCleaningTasksActivities({
                      requestData: action.payload,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Registro de tareas o actividades de limpieza creado correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'create' && a.type === 'cleaning_tasks_activities'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));

                      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                      if (cacheStr) {
                        const cache = JSON.parse(cacheStr);
                        const updatedCache = cache.map((item: any) => {
                          if (item.id_local === action.id && item.type === 'cleaning_tasks_activities') {
                            return { ...item, synced: true, id: result.data?.id || item.id };
                          }
                          return item;
                        });
                        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                      }
                    }
                  } else if (action.type === 'risk_matrix') {
                    console.log('Creando matriz de riesgos:', action.id);
                    const { createRiskMatrix } = await import('@/hooks/evaluationFunctions');
                    const result = await createRiskMatrix({
                      requestData: action.payload,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Matriz de riesgos creada correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'create' && a.type === 'risk_matrix'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));

                      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                      if (cacheStr) {
                        const cache = JSON.parse(cacheStr);
                        const updatedCache = cache.map((item: any) => {
                          if (item.id_local === action.id && item.type === 'risk_matrix') {
                            return { ...item, synced: true, id: result.data?.id || item.id };
                          }
                          return item;
                        });
                        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                      }
                    }
                  } else if (action.type === 'opportunity_matrix') {
                    console.log('Creando matriz de oportunidades:', action.id);
                    const { createOpportunityMatrix } = await import('@/hooks/evaluationFunctions');
                    const result = await createOpportunityMatrix({
                      requestData: action.payload,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Matriz de oportunidades creada correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'create' && a.type === 'opportunity_matrix'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));

                      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                      if (cacheStr) {
                        const cache = JSON.parse(cacheStr);
                        const updatedCache = cache.map((item: any) => {
                          if (item.id_local === action.id && item.type === 'opportunity_matrix') {
                            return { ...item, synced: true, id: result.data?.id || item.id };
                          }
                          return item;
                        });
                        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                      }
                    }
                  } else if (action.type === 'process_indicator_matrix') {
                    console.log('Creando matriz de indicador de procesos:', action.id);
                    const { createProcessIndicatorMatrix } = await import('@/hooks/evaluationFunctions');
                    const result = await createProcessIndicatorMatrix({
                      requestData: action.payload,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Matriz de indicador de procesos creada correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'create' && a.type === 'process_indicator_matrix'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));

                      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                      if (cacheStr) {
                        const cache = JSON.parse(cacheStr);
                        const updatedCache = cache.map((item: any) => {
                          if (item.id_local === action.id && item.type === 'process_indicator_matrix') {
                            return { ...item, synced: true, id: result.data?.id || item.id };
                          }
                          return item;
                        });
                        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                      }
                    }
                  } else if (action.type === 'monthly_work_role') {
                    console.log('Creando rol de trabajo mensual:', action.id);
                    const { createMonthlyWorkRole } = await import('@/hooks/evaluationFunctions');
                    const result = await createMonthlyWorkRole({
                      requestData: action.payload,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Rol de trabajo mensual creado correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'create' && a.type === 'monthly_work_role'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));

                      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                      if (cacheStr) {
                        const cache = JSON.parse(cacheStr);
                        const updatedCache = cache.map((item: any) => {
                          if (item.id_local === action.id && item.type === 'monthly_work_role') {
                            return { ...item, synced: true, id: result.data?.id || item.id };
                          }
                          return item;
                        });
                        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                      }
                    }
                  } else if (action.type === 'permit_request') {
                    console.log('Creando solicitud de permiso:', action.id);
                    const { createPermitRequest } = await import('@/hooks/evaluationFunctions');
                    const result = await createPermitRequest({
                      requestData: action.payload,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Solicitud de permiso creada correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'create' && a.type === 'permit_request'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));

                      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                      if (cacheStr) {
                        const cache = JSON.parse(cacheStr);
                        const updatedCache = cache.map((item: any) => {
                          if (item.id_local === action.id && item.type === 'permit_request') {
                            return { ...item, synced: true, id: result.data?.id || item.id };
                          }
                          return item;
                        });
                        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                      }
                    }
                  } else if (action.type === 'attendance_control') {
                    console.log('Creando control de asistencia:', action.id);
                    const { createAttendanceControl } = await import('@/hooks/evaluationFunctions');
                    const result = await createAttendanceControl({
                      requestData: action.payload,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Control de asistencia creado correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'create' && a.type === 'attendance_control'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));

                      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                      if (cacheStr) {
                        const cache = JSON.parse(cacheStr);
                        const updatedCache = cache.map((item: any) => {
                          if (item.id_local === action.id && item.type === 'attendance_control') {
                            return { ...item, synced: true, id: result.data?.id || item.id };
                          }
                          return item;
                        });
                        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                      }
                    }
                  } else if (action.type === 'opening_closing_position') {
                    console.log('Creando apertura-cierre de puesto:', action.id);
                    const { createOpeningClosingPosition } = await import('@/hooks/evaluationFunctions');
                    const result = await createOpeningClosingPosition({
                      requestData: action.payload,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Apertura-Cierre de Puesto creado correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'create' && a.type === 'opening_closing_position'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));

                      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                      if (cacheStr) {
                        const cache = JSON.parse(cacheStr);
                        const updatedCache = cache.map((item: any) => {
                          if (item.id_local === action.id && item.type === 'opening_closing_position') {
                            return { ...item, synced: true, id: result.data?.id || item.id };
                          }
                          return item;
                        });
                        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                      }
                    }
                  } else if (action.type === 'induction_tour_record') {
                    console.log('Creando registro de inducción y recorrido:', action.id);
                    const { createInductionTourRecord } = await import('@/hooks/evaluationFunctions');
                    const result = await createInductionTourRecord({
                      requestData: action.payload,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Registro de inducción y recorrido creado correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'create' && a.type === 'induction_tour_record'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));

                      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                      if (cacheStr) {
                        const cache = JSON.parse(cacheStr);
                        const updatedCache = cache.map((item: any) => {
                          if (item.id_local === action.id && item.type === 'induction_tour_record') {
                            return { ...item, synced: true, id: result.data?.id || item.id };
                          }
                          return item;
                        });
                        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                      }
                    }
                  } else if (action.type === 'supervision_report') {
                    console.log('Creando informe de supervisión:', action.id);
                    const { createSupervisionReport } = await import('@/hooks/evaluationFunctions');
                    const result = await createSupervisionReport({
                      requestData: action.payload,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Informe de supervisión creado correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'create' && a.type === 'supervision_report'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));

                      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                      if (cacheStr) {
                        const cache = JSON.parse(cacheStr);
                        const updatedCache = cache.map((item: any) => {
                          if (item.id_local === action.id && item.type === 'supervision_report') {
                            return { ...item, synced: true, id: result.data?.id || item.id };
                          }
                          return item;
                        });
                        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                      }
                    }
                  } else if (action.type === 'electric_brush_guide') {
                    console.log('Creando guía de uso de cepillo eléctrico:', action.id);
                    const { createElectricBrushGuide } = await import('@/hooks/evaluationFunctions');
                    const result = await createElectricBrushGuide({
                      requestData: action.payload,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Guía de uso de cepillo eléctrico creada correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'create' && a.type === 'electric_brush_guide'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));

                      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                      if (cacheStr) {
                        const cache = JSON.parse(cacheStr);
                        const updatedCache = cache.map((item: any) => {
                          if (item.id_local === action.id && item.type === 'electric_brush_guide') {
                            return { ...item, synced: true, id: result.data?.id || item.id };
                          }
                          return item;
                        });
                        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                      }
                    }
                  } else if (action.type === 'general_clients_list') {
                    console.log('Creando listado general de clientes:', action.id);
                    const { createGeneralClientsList } = await import('@/hooks/evaluationFunctions');
                    const result = await createGeneralClientsList({
                      requestData: action.payload,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Listado general de clientes creado correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'create' && a.type === 'general_clients_list'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));

                      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                      if (cacheStr) {
                        const cache = JSON.parse(cacheStr);
                        const updatedCache = cache.map((item: any) => {
                          if (item.id_local === action.id && item.type === 'general_clients_list') {
                            return { ...item, synced: true, id: result.data?.id || item.id };
                          }
                          return item;
                        });
                        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                      }
                    }
                  } else if (action.type === 'improvement_actions_control') {
                    console.log('Creando control de acciones de mejora:', action.id);
                    const { createImprovementActionsControl } = await import('@/hooks/evaluationFunctions');
                    const result = await createImprovementActionsControl({
                      requestData: action.payload,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Control de acciones de mejora creado correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'create' && a.type === 'improvement_actions_control'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));

                      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                      if (cacheStr) {
                        const cache = JSON.parse(cacheStr);
                        const updatedCache = cache.map((item: any) => {
                          if (item.id_local === action.id && item.type === 'improvement_actions_control') {
                            return { ...item, synced: true, id: result.data?.id || item.id };
                          }
                          return item;
                        });
                        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                      }
                    }
                  } else if (action.type === 'quality_policy') {
                    console.log('Creando política de calidad:', action.id);
                    const { createQualityPolicy } = await import('@/hooks/evaluationFunctions');
                    const result = await createQualityPolicy({
                      requestData: action.payload,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Política de calidad creada correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'create' && a.type === 'quality_policy'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));

                      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                      if (cacheStr) {
                        const cache = JSON.parse(cacheStr);
                        const updatedCache = cache.map((item: any) => {
                          if (item.id_local === action.id && item.type === 'quality_policy') {
                            return { ...item, synced: true, id: result.data?.id || item.id };
                          }
                          return item;
                        });
                        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                      }
                    }
                  } else if (action.type === 'business_quality_objectives') {
                    console.log('Creando objetivos empresariales de calidad:', action.id);
                    const { createBusinessQualityObjectives } = await import('@/hooks/evaluationFunctions');
                    const result = await createBusinessQualityObjectives({
                      requestData: action.payload,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Objetivos empresariales de calidad creados correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'create' && a.type === 'business_quality_objectives'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));

                      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                      if (cacheStr) {
                        const cache = JSON.parse(cacheStr);
                        const updatedCache = cache.map((item: any) => {
                          if (item.id_local === action.id && item.type === 'business_quality_objectives') {
                            return { ...item, synced: true, id: result.data?.id || item.id };
                          }
                          return item;
                        });
                        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                      }
                    }
                  } else if (action.type === 'stakeholder_analysis_matrix') {
                    console.log('Creando matriz de análisis de partes interesadas:', action.id);
                    const { createStakeholderAnalysisMatrix } = await import('@/hooks/evaluationFunctions');
                    const result = await createStakeholderAnalysisMatrix({
                      requestData: action.payload,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Matriz de análisis de partes interesadas creada correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'create' && a.type === 'stakeholder_analysis_matrix'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));

                      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                      if (cacheStr) {
                        const cache = JSON.parse(cacheStr);
                        const updatedCache = cache.map((item: any) => {
                          if (item.id_local === action.id && item.type === 'stakeholder_analysis_matrix') {
                            return { ...item, synced: true, id: result.data?.id || item.id };
                          }
                          return item;
                        });
                        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                      }
                    }
                  } else if (action.type === 'communication_plan') {
                    console.log('Creando plan de comunicación:', action.id);
                    const { createCommunicationPlan } = await import('@/hooks/evaluationFunctions');
                    const result = await createCommunicationPlan({
                      requestData: action.payload,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Plan de comunicación creado correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'create' && a.type === 'communication_plan'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));

                      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                      if (cacheStr) {
                        const cache = JSON.parse(cacheStr);
                        const updatedCache = cache.map((item: any) => {
                          if (item.id_local === action.id && item.type === 'communication_plan') {
                            return { ...item, synced: true, id: result.data?.id || item.id };
                          }
                          return item;
                        });
                        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                      }
                    }
                  } else if (action.type === 'knowledge_management_matrix') {
                    console.log('Creando matriz de gestión del conocimiento:', action.id);
                    const { createKnowledgeManagementMatrix } = await import('@/hooks/evaluationFunctions');
                    const result = await createKnowledgeManagementMatrix({
                      requestData: action.payload,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Matriz de gestión del conocimiento creada correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'create' && a.type === 'knowledge_management_matrix'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));

                      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                      if (cacheStr) {
                        const cache = JSON.parse(cacheStr);
                        const updatedCache = cache.map((item: any) => {
                          if (item.id_local === action.id && item.type === 'knowledge_management_matrix') {
                            return { ...item, synced: true, id: result.data?.id || item.id };
                          }
                          return item;
                        });
                        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                      }
                    }
                  } else if (action.type === 'change_planning') {
                    console.log('Creando planificación de cambios del SGC:', action.id);
                    const { createChangePlanning } = await import('@/hooks/evaluationFunctions');
                    const result = await createChangePlanning({
                      requestData: action.payload,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Planificación de cambios del SGC creada correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'create' && a.type === 'change_planning'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));

                      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                      if (cacheStr) {
                        const cache = JSON.parse(cacheStr);
                        const updatedCache = cache.map((item: any) => {
                          if (item.id_local === action.id && item.type === 'change_planning') {
                            return { ...item, synced: true, id: result.data?.id || item.id };
                          }
                          return item;
                        });
                        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                      }
                    }
                  } else if (action.type === 'routes_and_tours') {
                console.log('Creando ruta o gira:', action.id);
            const { createRouteAndTour } = await import('@/hooks/evaluationFunctions');
            const result = await createRouteAndTour({
              requestData: action.payload,
              refreshAccessToken,
              logout,
            });

            if (result.status) {
              console.log('Ruta o gira creada correctamente');
              // Eliminar acción del array
              const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'create' && a.type === 'routes_and_tours'));
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
              
              // Actualizar cache para marcar como sincronizado
              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr);
                const updatedCache = cache.map((item: any) => {
                  if (item.id_local === action.id && item.type === 'routes_and_tours') {
                    return { ...item, synced: true, id: result.data?.id || item.id };
                  }
                  return item;
                });
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
              }
            }
          } else {
            // Evaluación normal
          console.log('Creando evaluación:', action.id);
          const { createEvaluation } = await import('@/hooks/evaluationFunctions');
          const result = await createEvaluation({
              requestData: action.requestData || action.payload,
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            console.log('Evaluación creada correctamente');
            // Eliminar acción del array
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'create' && (!a.type || (a.type !== 'mileage_control' && a.type !== 'uniform_request' && a.type !== 'routes_and_tours' && a.type !== 'employee_satisfaction' && a.type !== 'vehicle_maintenance' && a.type !== 'non_conforming_product' && a.type !== 'complaints_master' && a.type !== 'cleaners_control' && a.type !== 'physical_minute_agenda' && a.type !== 'action_plan' && a.type !== 'work_role' && a.type !== 'contract_basic_data' && a.type !== 'delivery_schedule' && a.type !== 'environmental_management_plan' && a.type !== 'cleaning_work_plan' && a.type !== 'special_situations_plan' && a.type !== 'cleaning_tasks_activities' && a.type !== 'risk_matrix' && a.type !== 'opportunity_matrix' && a.type !== 'process_indicator_matrix' && a.type !== 'monthly_work_role' && a.type !== 'permit_request' && a.type !== 'attendance_control' && a.type !== 'opening_closing_position' && a.type !== 'induction_tour_record' && a.type !== 'supervision_report' && a.type !== 'electric_brush_guide'))));
            await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
            }
          }
        } else if (action.action === 'update') {
          if (action.type === 'mileage_control') {
            console.log('Actualizando control de kilometraje:', action.id);
            const { updateMileageControl } = await import('@/hooks/evaluationFunctions');
            const result = await updateMileageControl({
              id: action.id,
              requestData: action.payload,
              refreshAccessToken,
              logout,
            });

            if (result.status) {
              console.log('Control de kilometraje actualizado correctamente');
              // Eliminar acción del array
              const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'update' && a.type === 'mileage_control'));
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
            }
          } else if (action.type === 'uniform_request') {
            console.log('Actualizando solicitud de uniforme:', action.id);
            const { updateUniformRequest } = await import('@/hooks/evaluationFunctions');
            const result = await updateUniformRequest({
              id: action.id,
              requestData: action.payload,
              refreshAccessToken,
              logout,
            });

            if (result.status) {
              console.log('Solicitud de uniforme actualizada correctamente');
              // Eliminar acción del array
              const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'update' && a.type === 'uniform_request'));
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
            }
          } else if (action.type === 'employee_satisfaction') {
            console.log('Actualizando encuesta de satisfacción:', action.id);
            const { updateEmployeeSatisfaction } = await import('@/hooks/evaluationFunctions');
            const result = await updateEmployeeSatisfaction({
              id: action.id,
              requestData: action.payload,
              refreshAccessToken,
              logout,
            });

            if (result.status) {
              console.log('Encuesta de satisfacción actualizada correctamente');
              const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'update' && a.type === 'employee_satisfaction'));
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
            }
          } else if (action.type === 'employee_satisfaction') {
            console.log('Actualizando encuesta de satisfacción:', action.id);
            const { updateEmployeeSatisfaction } = await import('@/hooks/evaluationFunctions');
            const result = await updateEmployeeSatisfaction({
              id: action.id,
              requestData: action.payload,
              refreshAccessToken,
              logout,
            });

            if (result.status) {
              console.log('Encuesta de satisfacción actualizada correctamente');
              const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'update' && a.type === 'employee_satisfaction'));
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
            }
          } else if (action.type === 'vehicle_maintenance') {
            console.log('Actualizando planificación de mantenimiento:', action.id);
            const { updateVehicleMaintenance } = await import('@/hooks/evaluationFunctions');
            const result = await updateVehicleMaintenance({
              id: action.id,
              requestData: action.payload,
              refreshAccessToken,
              logout,
            });

            if (result.status) {
              console.log('Planificación de mantenimiento actualizada correctamente');
              const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'update' && a.type === 'vehicle_maintenance'));
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
            }
          } else if (action.type === 'non_conforming_product') {
            console.log('Actualizando producto no conforme:', action.id);
            const { updateNonConformingProduct } = await import('@/hooks/evaluationFunctions');
            const result = await updateNonConformingProduct({
              id: action.id,
              requestData: action.payload,
              refreshAccessToken,
              logout,
            });

            if (result.status) {
              console.log('Producto no conforme actualizado correctamente');
              const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'update' && a.type === 'non_conforming_product'));
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
            }
          } else if (action.type === 'complaints_master') {
            console.log('Actualizando queja:', action.id);
            const { updateComplaintsMaster } = await import('@/hooks/evaluationFunctions');
            const result = await updateComplaintsMaster({
              id: action.id,
              requestData: action.payload,
              refreshAccessToken,
              logout,
            });

            if (result.status) {
              console.log('Queja actualizada correctamente');
              const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'update' && a.type === 'complaints_master'));
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
            }
          } else if (action.type === 'cleaners_control') {
            console.log('Actualizando control de aseadores:', action.id);
            const { updateCleanersControl } = await import('@/hooks/evaluationFunctions');
            const result = await updateCleanersControl({
              id: action.id,
              requestData: action.payload,
              refreshAccessToken,
              logout,
            });

            if (result.status) {
              console.log('Control de aseadores actualizado correctamente');
              const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'update' && a.type === 'cleaners_control'));
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
            }
          } else if (action.type === 'physical_minute_agenda') {
            console.log('Actualizando agenda minuta física:', action.id);
            const { updatePhysicalMinuteAgenda } = await import('@/hooks/evaluationFunctions');
            const result = await updatePhysicalMinuteAgenda({
              id: action.id,
              requestData: action.payload,
              refreshAccessToken,
              logout,
            });

            if (result.status) {
              console.log('Agenda minuta física actualizada correctamente');
              const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'update' && a.type === 'physical_minute_agenda'));
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
            }
          } else if (action.type === 'action_plan') {
            console.log('Actualizando plan de acción:', action.id);
            const { updateActionPlan } = await import('@/hooks/evaluationFunctions');
            const result = await updateActionPlan({
              id: action.id,
              requestData: action.payload,
              refreshAccessToken,
              logout,
            });

            if (result.status) {
              console.log('Plan de acción actualizado correctamente');
              const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'update' && a.type === 'action_plan'));
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
            }
                  } else if (action.type === 'work_role') {
                    console.log('Actualizando rol de trabajo:', action.id);
                    const { updateWorkRole } = await import('@/hooks/evaluationFunctions');
                    const result = await updateWorkRole({
                      id: action.id,
                      requestData: action.payload,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Rol de trabajo actualizado correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'update' && a.type === 'work_role'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
                    }
                  } else if (action.type === 'contract_basic_data') {
                    console.log('Actualizando datos básicos de contrato:', action.id);
                    const { updateContractBasicData } = await import('@/hooks/evaluationFunctions');
                    const result = await updateContractBasicData({
                      id: action.id,
                      requestData: action.payload,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Datos básicos de contrato actualizados correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'update' && a.type === 'contract_basic_data'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
                    }
                  } else if (action.type === 'delivery_schedule') {
                    console.log('Actualizando cronograma de entrega:', action.id);
                    const { updateDeliverySchedule } = await import('@/hooks/evaluationFunctions');
                    const result = await updateDeliverySchedule({
                      id: action.id,
                      requestData: action.payload,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Cronograma de entrega actualizado correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'update' && a.type === 'delivery_schedule'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
                    }
                  } else if (action.type === 'environmental_management_plan') {
                    console.log('Actualizando plan de gestión ambiental:', action.id);
                    const { updateEnvironmentalManagementPlan } = await import('@/hooks/evaluationFunctions');
                    const result = await updateEnvironmentalManagementPlan({
                      id: action.id,
                      requestData: action.payload,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Plan de gestión ambiental actualizado correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'update' && a.type === 'environmental_management_plan'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
                    }
                  } else if (action.type === 'cleaning_work_plan') {
                    console.log('Actualizando plan de trabajo - Personal Aseo y limpieza:', action.id);
                    const { updateCleaningWorkPlan } = await import('@/hooks/evaluationFunctions');
                    const result = await updateCleaningWorkPlan({
                      id: action.id,
                      requestData: action.payload,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Plan de trabajo - Personal Aseo y limpieza actualizado correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'update' && a.type === 'cleaning_work_plan'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
                    }
                  } else if (action.type === 'special_situations_plan') {
                    console.log('Actualizando plan para la atención de situaciones especiales:', action.id);
                    const { updateSpecialSituationsPlan } = await import('@/hooks/evaluationFunctions');
                    const result = await updateSpecialSituationsPlan({
                      id: action.id,
                      requestData: action.payload,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Plan para la atención de situaciones especiales actualizado correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'update' && a.type === 'special_situations_plan'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
                    }
                  } else if (action.type === 'cleaning_tasks_activities') {
                    console.log('Actualizando registro de tareas o actividades de limpieza:', action.id);
                    const { updateCleaningTasksActivities } = await import('@/hooks/evaluationFunctions');
                    const result = await updateCleaningTasksActivities({
                      id: action.id,
                      requestData: action.payload,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Registro de tareas o actividades de limpieza actualizado correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'update' && a.type === 'cleaning_tasks_activities'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
                    }
                  } else if (action.type === 'risk_matrix') {
                    console.log('Actualizando matriz de riesgos:', action.id);
                    const { updateRiskMatrix } = await import('@/hooks/evaluationFunctions');
                    const result = await updateRiskMatrix({
                      id: action.id,
                      requestData: action.payload,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Matriz de riesgos actualizada correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'update' && a.type === 'risk_matrix'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
                    }
                  } else if (action.type === 'opportunity_matrix') {
                    console.log('Actualizando matriz de oportunidades:', action.id);
                    const { updateOpportunityMatrix } = await import('@/hooks/evaluationFunctions');
                    const result = await updateOpportunityMatrix({
                      id: action.id,
                      requestData: action.payload,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Matriz de oportunidades actualizada correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'update' && a.type === 'opportunity_matrix'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
                    }
                  } else if (action.type === 'process_indicator_matrix') {
                    console.log('Actualizando matriz de indicador de procesos:', action.id);
                    const { updateProcessIndicatorMatrix } = await import('@/hooks/evaluationFunctions');
                    const result = await updateProcessIndicatorMatrix({
                      id: action.id,
                      requestData: action.payload,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Matriz de indicador de procesos actualizada correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'update' && a.type === 'process_indicator_matrix'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
                    }
                  } else if (action.type === 'monthly_work_role') {
                    console.log('Actualizando rol de trabajo mensual:', action.id);
                    const { updateMonthlyWorkRole } = await import('@/hooks/evaluationFunctions');
                    const result = await updateMonthlyWorkRole({
                      id: action.id,
                      requestData: action.payload,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Rol de trabajo mensual actualizado correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'update' && a.type === 'monthly_work_role'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
                    }
                  } else if (action.type === 'permit_request') {
                    console.log('Actualizando solicitud de permiso:', action.id);
                    const { updatePermitRequest } = await import('@/hooks/evaluationFunctions');
                    const result = await updatePermitRequest({
                      id: action.id,
                      requestData: action.payload,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Solicitud de permiso actualizada correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'update' && a.type === 'permit_request'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
                    }
                  } else if (action.type === 'attendance_control') {
                    console.log('Actualizando control de asistencia:', action.id);
                    const { updateAttendanceControl } = await import('@/hooks/evaluationFunctions');
                    const result = await updateAttendanceControl({
                      id: action.id,
                      requestData: action.payload,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Control de asistencia actualizado correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'update' && a.type === 'attendance_control'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
                    }
                  } else if (action.type === 'opening_closing_position') {
                    console.log('Actualizando apertura-cierre de puesto:', action.id);
                    const { updateOpeningClosingPosition } = await import('@/hooks/evaluationFunctions');
                    const result = await updateOpeningClosingPosition({
                      id: action.id,
                      requestData: action.payload,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Apertura-Cierre de Puesto actualizado correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'update' && a.type === 'opening_closing_position'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
                    }
                  } else if (action.type === 'induction_tour_record') {
                    console.log('Actualizando registro de inducción y recorrido:', action.id);
                    const { updateInductionTourRecord } = await import('@/hooks/evaluationFunctions');
                    const result = await updateInductionTourRecord({
                      id: action.id,
                      requestData: action.payload,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Registro de inducción y recorrido actualizado correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'update' && a.type === 'induction_tour_record'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
                    }
                  } else if (action.type === 'supervision_report') {
                    console.log('Actualizando informe de supervisión:', action.id);
                    const { updateSupervisionReport } = await import('@/hooks/evaluationFunctions');
                    const result = await updateSupervisionReport({
                      id: action.id,
                      requestData: action.payload,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Informe de supervisión actualizado correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'update' && a.type === 'supervision_report'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
                    }
                  } else if (action.type === 'electric_brush_guide') {
                    console.log('Actualizando guía de uso de cepillo eléctrico:', action.id);
                    const { updateElectricBrushGuide } = await import('@/hooks/evaluationFunctions');
                    const result = await updateElectricBrushGuide({
                      id: action.id,
                      requestData: action.payload,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Guía de uso de cepillo eléctrico actualizada correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'update' && a.type === 'electric_brush_guide'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
                    }
                  } else if (action.type === 'general_clients_list') {
                    console.log('Actualizando listado general de clientes:', action.id);
                    const { updateGeneralClientsList } = await import('@/hooks/evaluationFunctions');
                    const result = await updateGeneralClientsList({
                      id: action.id,
                      requestData: action.payload,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Listado general de clientes actualizado correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'update' && a.type === 'general_clients_list'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
                    }
                  } else if (action.type === 'improvement_actions_control') {
                    console.log('Actualizando control de acciones de mejora:', action.id);
                    const { updateImprovementActionsControl } = await import('@/hooks/evaluationFunctions');
                    const result = await updateImprovementActionsControl({
                      id: action.id,
                      requestData: action.payload,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Control de acciones de mejora actualizado correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'update' && a.type === 'improvement_actions_control'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
                    }
                  } else if (action.type === 'quality_policy') {
                    console.log('Actualizando política de calidad:', action.id);
                    const { updateQualityPolicy } = await import('@/hooks/evaluationFunctions');
                    const result = await updateQualityPolicy({
                      id: action.id,
                      requestData: action.payload,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Política de calidad actualizada correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'update' && a.type === 'quality_policy'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
                    }
                  } else if (action.type === 'business_quality_objectives') {
                    console.log('Actualizando objetivos empresariales de calidad:', action.id);
                    const { updateBusinessQualityObjectives } = await import('@/hooks/evaluationFunctions');
                    const result = await updateBusinessQualityObjectives({
                      id: action.id,
                      requestData: action.payload,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Objetivos empresariales de calidad actualizados correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'update' && a.type === 'business_quality_objectives'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
                    }
                  } else if (action.type === 'stakeholder_analysis_matrix') {
                    console.log('Actualizando matriz de análisis de partes interesadas:', action.id);
                    const { updateStakeholderAnalysisMatrix } = await import('@/hooks/evaluationFunctions');
                    const result = await updateStakeholderAnalysisMatrix({
                      id: action.id,
                      requestData: action.payload,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Matriz de análisis de partes interesadas actualizada correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'update' && a.type === 'stakeholder_analysis_matrix'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
                    }
                  } else if (action.type === 'communication_plan') {
                    console.log('Actualizando plan de comunicación:', action.id);
                    const { updateCommunicationPlan } = await import('@/hooks/evaluationFunctions');
                    const result = await updateCommunicationPlan({
                      id: action.id,
                      requestData: action.payload,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Plan de comunicación actualizado correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'update' && a.type === 'communication_plan'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
                    }
                  } else if (action.type === 'knowledge_management_matrix') {
                    console.log('Actualizando matriz de gestión del conocimiento:', action.id);
                    const { updateKnowledgeManagementMatrix } = await import('@/hooks/evaluationFunctions');
                    const result = await updateKnowledgeManagementMatrix({
                      id: action.id,
                      requestData: action.payload,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Matriz de gestión del conocimiento actualizada correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'update' && a.type === 'knowledge_management_matrix'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
                    }
                  } else if (action.type === 'change_planning') {
                    console.log('Actualizando planificación de cambios del SGC:', action.id);
                    const { updateChangePlanning } = await import('@/hooks/evaluationFunctions');
                    const result = await updateChangePlanning({
                      id: action.id,
                      requestData: action.payload,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Planificación de cambios del SGC actualizada correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'update' && a.type === 'change_planning'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
                    }
                  } else if (action.type === 'routes_and_tours') {
            console.log('Actualizando ruta o gira:', action.id);
            const { updateRouteAndTour } = await import('@/hooks/evaluationFunctions');
            const result = await updateRouteAndTour({
              id: action.id,
              requestData: action.payload,
              refreshAccessToken,
              logout,
            });

            if (result.status) {
              console.log('Ruta o gira actualizada correctamente');
              // Eliminar acción del array
              const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'update' && a.type === 'routes_and_tours'));
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
            }
          }
        } else if (action.action === 'delete') {
          if (action.type === 'mileage_control') {
            console.log('Eliminando control de kilometraje:', action.id);
            const { deleteMileageControl } = await import('@/hooks/evaluationFunctions');
            const result = await deleteMileageControl({
              id: action.id,
              refreshAccessToken,
              logout,
            });

            if (result.status) {
              console.log('Control de kilometraje eliminado correctamente');
              // Eliminar acción del array
              const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'delete' && a.type === 'mileage_control'));
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
              
              // Eliminar del cache
              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr);
                const updatedCache = cache.filter((item: any) => !(item.id === action.id || item.id_local === action.id));
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
              }
            }
          } else if (action.type === 'uniform_request') {
            console.log('Eliminando solicitud de uniforme:', action.id);
            const { deleteUniformRequest } = await import('@/hooks/evaluationFunctions');
            const result = await deleteUniformRequest({
              id: action.id,
              refreshAccessToken,
              logout,
            });

            if (result.status) {
              console.log('Solicitud de uniforme eliminada correctamente');
              // Eliminar acción del array
              const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'delete' && a.type === 'uniform_request'));
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
              
              // Eliminar del cache
              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr);
                const updatedCache = cache.filter((item: any) => !(item.id === action.id || item.id_local === action.id));
                  await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                }
              }
            } else if (action.type === 'employee_satisfaction') {
              console.log('Eliminando encuesta de satisfacción:', action.id);
              const { deleteEmployeeSatisfaction } = await import('@/hooks/evaluationFunctions');
              const result = await deleteEmployeeSatisfaction({
                id: action.id,
                refreshAccessToken,
                logout,
              });

              if (result.status) {
                console.log('Encuesta de satisfacción eliminada correctamente');
                const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'delete' && a.type === 'employee_satisfaction'));
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
                
                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.filter((item: any) => !(item.id === action.id || item.id_local === action.id));
                  await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                }
              }
            } else if (action.type === 'vehicle_maintenance') {
              console.log('Eliminando planificación de mantenimiento:', action.id);
              const { deleteVehicleMaintenance } = await import('@/hooks/evaluationFunctions');
              const result = await deleteVehicleMaintenance({
                id: action.id,
                refreshAccessToken,
                logout,
              });

              if (result.status) {
                console.log('Planificación de mantenimiento eliminada correctamente');
                const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'delete' && a.type === 'vehicle_maintenance'));
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
                
                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.filter((item: any) => !(item.id === action.id || item.id_local === action.id));
                  await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                }
              }
            } else if (action.type === 'non_conforming_product') {
              console.log('Eliminando producto no conforme:', action.id);
              const { deleteNonConformingProduct } = await import('@/hooks/evaluationFunctions');
              const result = await deleteNonConformingProduct({
                id: action.id,
                refreshAccessToken,
                logout,
              });

              if (result.status) {
                console.log('Producto no conforme eliminado correctamente');
                const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'delete' && a.type === 'non_conforming_product'));
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
                
                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.filter((item: any) => !(item.id === action.id || item.id_local === action.id));
                  await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                }
              }
            } else if (action.type === 'complaints_master') {
              console.log('Eliminando queja:', action.id);
              const { deleteComplaintsMaster } = await import('@/hooks/evaluationFunctions');
              const result = await deleteComplaintsMaster({
                id: action.id,
                refreshAccessToken,
                logout,
              });

              if (result.status) {
                console.log('Queja eliminada correctamente');
                const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'delete' && a.type === 'complaints_master'));
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
                
                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.filter((item: any) => !(item.id === action.id || item.id_local === action.id));
                  await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                }
              }
            } else if (action.type === 'cleaners_control') {
              console.log('Eliminando control de aseadores:', action.id);
              const { deleteCleanersControl } = await import('@/hooks/evaluationFunctions');
              const result = await deleteCleanersControl({
                id: action.id,
                refreshAccessToken,
                logout,
              });

              if (result.status) {
                console.log('Control de aseadores eliminado correctamente');
                const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'delete' && a.type === 'cleaners_control'));
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
                
                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.filter((item: any) => !(item.id === action.id || item.id_local === action.id));
                  await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                }
              }
            } else if (action.type === 'physical_minute_agenda') {
              console.log('Eliminando agenda minuta física:', action.id);
              const { deletePhysicalMinuteAgenda } = await import('@/hooks/evaluationFunctions');
              const result = await deletePhysicalMinuteAgenda({
                id: action.id,
                refreshAccessToken,
                logout,
              });

              if (result.status) {
                console.log('Agenda minuta física eliminada correctamente');
                const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'delete' && a.type === 'physical_minute_agenda'));
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
                
                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.filter((item: any) => !(item.id === action.id || item.id_local === action.id));
                  await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                }
              }
            } else if (action.type === 'action_plan') {
              console.log('Eliminando plan de acción:', action.id);
              const { deleteActionPlan } = await import('@/hooks/evaluationFunctions');
              const result = await deleteActionPlan({
                id: action.id,
                refreshAccessToken,
                logout,
              });

              if (result.status) {
                console.log('Plan de acción eliminado correctamente');
                const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'delete' && a.type === 'action_plan'));
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
                
                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.filter((item: any) => !(item.id === action.id || item.id_local === action.id));
                  await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                }
              }
                  } else if (action.type === 'work_role') {
                    console.log('Eliminando rol de trabajo:', action.id);
                    const { deleteWorkRole } = await import('@/hooks/evaluationFunctions');
                    const result = await deleteWorkRole({
                      id: action.id,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Rol de trabajo eliminado correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'delete' && a.type === 'work_role'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));

                      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                      if (cacheStr) {
                        const cache = JSON.parse(cacheStr);
                        const updatedCache = cache.filter((item: any) => !(item.id === action.id || item.id_local === action.id));
                        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                      }
                    }
                  } else if (action.type === 'contract_basic_data') {
                    console.log('Eliminando datos básicos de contrato:', action.id);
                    const { deleteContractBasicData } = await import('@/hooks/evaluationFunctions');
                    const result = await deleteContractBasicData({
                      id: action.id,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Datos básicos de contrato eliminados correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'delete' && a.type === 'contract_basic_data'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));

                      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                      if (cacheStr) {
                        const cache = JSON.parse(cacheStr);
                        const updatedCache = cache.filter((item: any) => !(item.id === action.id || item.id_local === action.id));
                        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                      }
                    }
                  } else if (action.type === 'delivery_schedule') {
                    console.log('Eliminando cronograma de entrega:', action.id);
                    const { deleteDeliverySchedule } = await import('@/hooks/evaluationFunctions');
                    const result = await deleteDeliverySchedule({
                      id: action.id,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Cronograma de entrega eliminado correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'delete' && a.type === 'delivery_schedule'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));

                      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                      if (cacheStr) {
                        const cache = JSON.parse(cacheStr);
                        const updatedCache = cache.filter((item: any) => !(item.id === action.id || item.id_local === action.id));
                        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                      }
                    }
                  } else if (action.type === 'environmental_management_plan') {
                    console.log('Eliminando plan de gestión ambiental:', action.id);
                    const { deleteEnvironmentalManagementPlan } = await import('@/hooks/evaluationFunctions');
                    const result = await deleteEnvironmentalManagementPlan({
                      id: action.id,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Plan de gestión ambiental eliminado correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'delete' && a.type === 'environmental_management_plan'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));

                      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                      if (cacheStr) {
                        const cache = JSON.parse(cacheStr);
                        const updatedCache = cache.filter((item: any) => !(item.id === action.id || item.id_local === action.id));
                        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                      }
                    }
                  } else if (action.type === 'cleaning_work_plan') {
                    console.log('Eliminando plan de trabajo - Personal Aseo y limpieza:', action.id);
                    const { deleteCleaningWorkPlan } = await import('@/hooks/evaluationFunctions');
                    const result = await deleteCleaningWorkPlan({
                      id: action.id,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Plan de trabajo - Personal Aseo y limpieza eliminado correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'delete' && a.type === 'cleaning_work_plan'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));

                      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                      if (cacheStr) {
                        const cache = JSON.parse(cacheStr);
                        const updatedCache = cache.filter((item: any) => !((item.id === action.id || item.id_local === action.id) && item.type === 'cleaning_work_plan'));
                        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                      }
                    }
                  } else if (action.type === 'special_situations_plan') {
                    console.log('Eliminando plan para la atención de situaciones especiales:', action.id);
                    const { deleteSpecialSituationsPlan } = await import('@/hooks/evaluationFunctions');
                    const result = await deleteSpecialSituationsPlan({
                      id: action.id,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Plan para la atención de situaciones especiales eliminado correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'delete' && a.type === 'special_situations_plan'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));

                      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                      if (cacheStr) {
                        const cache = JSON.parse(cacheStr);
                        const updatedCache = cache.filter((item: any) => !((item.id === action.id || item.id_local === action.id) && item.type === 'special_situations_plan'));
                        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                      }
                    }
                  } else if (action.type === 'cleaning_tasks_activities') {
                    console.log('Eliminando registro de tareas o actividades de limpieza:', action.id);
                    const { deleteCleaningTasksActivities } = await import('@/hooks/evaluationFunctions');
                    const result = await deleteCleaningTasksActivities({
                      id: action.id,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Registro de tareas o actividades de limpieza eliminado correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'delete' && a.type === 'cleaning_tasks_activities'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));

                      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                      if (cacheStr) {
                        const cache = JSON.parse(cacheStr);
                        const updatedCache = cache.filter((item: any) => !((item.id === action.id || item.id_local === action.id) && item.type === 'cleaning_tasks_activities'));
                        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                      }
                    }
                  } else if (action.type === 'risk_matrix') {
                    console.log('Eliminando matriz de riesgos:', action.id);
                    const { deleteRiskMatrix } = await import('@/hooks/evaluationFunctions');
                    const result = await deleteRiskMatrix({
                      id: action.id,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Matriz de riesgos eliminada correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'delete' && a.type === 'risk_matrix'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));

                      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                      if (cacheStr) {
                        const cache = JSON.parse(cacheStr);
                        const updatedCache = cache.filter((item: any) => !((item.id === action.id || item.id_local === action.id) && item.type === 'risk_matrix'));
                        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                      }
                    }
                  } else if (action.type === 'opportunity_matrix') {
                    console.log('Eliminando matriz de oportunidades:', action.id);
                    const { deleteOpportunityMatrix } = await import('@/hooks/evaluationFunctions');
                    const result = await deleteOpportunityMatrix({
                      id: action.id,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Matriz de oportunidades eliminada correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'delete' && a.type === 'opportunity_matrix'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));

                      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                      if (cacheStr) {
                        const cache = JSON.parse(cacheStr);
                        const updatedCache = cache.filter((item: any) => !((item.id === action.id || item.id_local === action.id) && item.type === 'opportunity_matrix'));
                        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                      }
                    }
                  } else if (action.type === 'process_indicator_matrix') {
                    console.log('Eliminando matriz de indicador de procesos:', action.id);
                    const { deleteProcessIndicatorMatrix } = await import('@/hooks/evaluationFunctions');
                    const result = await deleteProcessIndicatorMatrix({
                      id: action.id,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Matriz de indicador de procesos eliminada correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'delete' && a.type === 'process_indicator_matrix'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));

                      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                      if (cacheStr) {
                        const cache = JSON.parse(cacheStr);
                        const updatedCache = cache.filter((item: any) => !((item.id === action.id || item.id_local === action.id) && item.type === 'process_indicator_matrix'));
                        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                      }
                    }
                  } else if (action.type === 'monthly_work_role') {
                    console.log('Eliminando rol de trabajo mensual:', action.id);
                    const { deleteMonthlyWorkRole } = await import('@/hooks/evaluationFunctions');
                    const result = await deleteMonthlyWorkRole({
                      id: action.id,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Rol de trabajo mensual eliminado correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'delete' && a.type === 'monthly_work_role'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));

                      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                      if (cacheStr) {
                        const cache = JSON.parse(cacheStr);
                        const updatedCache = cache.filter((item: any) => !((item.id === action.id || item.id_local === action.id) && item.type === 'monthly_work_role'));
                        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                      }
                    }
                  } else if (action.type === 'permit_request') {
                    console.log('Eliminando solicitud de permiso:', action.id);
                    const { deletePermitRequest } = await import('@/hooks/evaluationFunctions');
                    const result = await deletePermitRequest({
                      id: action.id,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Solicitud de permiso eliminada correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'delete' && a.type === 'permit_request'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));

                      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                      if (cacheStr) {
                        const cache = JSON.parse(cacheStr);
                        const updatedCache = cache.filter((item: any) => !((item.id === action.id || item.id_local === action.id) && item.type === 'permit_request'));
                        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                      }
                    }
                  } else if (action.type === 'attendance_control') {
                    console.log('Eliminando control de asistencia:', action.id);
                    const { deleteAttendanceControl } = await import('@/hooks/evaluationFunctions');
                    const result = await deleteAttendanceControl({
                      id: action.id,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Control de asistencia eliminado correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'delete' && a.type === 'attendance_control'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));

                      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                      if (cacheStr) {
                        const cache = JSON.parse(cacheStr);
                        const updatedCache = cache.filter((item: any) => !((item.id === action.id || item.id_local === action.id) && item.type === 'attendance_control'));
                        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                      }
                    }
                  } else if (action.type === 'opening_closing_position') {
                    console.log('Eliminando apertura-cierre de puesto:', action.id);
                    const { deleteOpeningClosingPosition } = await import('@/hooks/evaluationFunctions');
                    const result = await deleteOpeningClosingPosition({
                      id: action.id,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Apertura-Cierre de Puesto eliminado correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'delete' && a.type === 'opening_closing_position'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));

                      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                      if (cacheStr) {
                        const cache = JSON.parse(cacheStr);
                        const updatedCache = cache.filter((item: any) => !((item.id === action.id || item.id_local === action.id) && item.type === 'opening_closing_position'));
                        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                      }
                    }
                  } else if (action.type === 'induction_tour_record') {
                    console.log('Eliminando registro de inducción y recorrido:', action.id);
                    const { deleteInductionTourRecord } = await import('@/hooks/evaluationFunctions');
                    const result = await deleteInductionTourRecord({
                      id: action.id,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Registro de inducción y recorrido eliminado correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'delete' && a.type === 'induction_tour_record'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));

                      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                      if (cacheStr) {
                        const cache = JSON.parse(cacheStr);
                        const updatedCache = cache.filter((item: any) => !((item.id === action.id || item.id_local === action.id) && item.type === 'induction_tour_record'));
                        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                      }
                    }
                  } else if (action.type === 'supervision_report') {
                    console.log('Eliminando informe de supervisión:', action.id);
                    const { deleteSupervisionReport } = await import('@/hooks/evaluationFunctions');
                    const result = await deleteSupervisionReport({
                      id: action.id,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Informe de supervisión eliminado correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'delete' && a.type === 'supervision_report'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));

                      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                      if (cacheStr) {
                        const cache = JSON.parse(cacheStr);
                        const updatedCache = cache.filter((item: any) => !((item.id === action.id || item.id_local === action.id) && item.type === 'supervision_report'));
                        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                      }
                    }
                  } else if (action.type === 'electric_brush_guide') {
                    console.log('Eliminando guía de uso de cepillo eléctrico:', action.id);
                    const { deleteElectricBrushGuide } = await import('@/hooks/evaluationFunctions');
                    const result = await deleteElectricBrushGuide({
                      id: action.id,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Guía de uso de cepillo eléctrico eliminada correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'delete' && a.type === 'electric_brush_guide'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));

                      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                      if (cacheStr) {
                        const cache = JSON.parse(cacheStr);
                        const updatedCache = cache.filter((item: any) => !((item.id === action.id || item.id_local === action.id) && item.type === 'electric_brush_guide'));
                        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                      }
                    }
                  } else if (action.type === 'general_clients_list') {
                    console.log('Eliminando listado general de clientes:', action.id);
                    const { deleteGeneralClientsList } = await import('@/hooks/evaluationFunctions');
                    const result = await deleteGeneralClientsList({
                      id: action.id,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Listado general de clientes eliminado correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'delete' && a.type === 'general_clients_list'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));

                      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                      if (cacheStr) {
                        const cache = JSON.parse(cacheStr);
                        const updatedCache = cache.filter((item: any) => !((item.id === action.id || item.id_local === action.id) && item.type === 'general_clients_list'));
                        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                      }
                    }
                  } else if (action.type === 'improvement_actions_control') {
                    console.log('Eliminando control de acciones de mejora:', action.id);
                    const { deleteImprovementActionsControl } = await import('@/hooks/evaluationFunctions');
                    const result = await deleteImprovementActionsControl({
                      id: action.id,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Control de acciones de mejora eliminado correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'delete' && a.type === 'improvement_actions_control'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));

                      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                      if (cacheStr) {
                        const cache = JSON.parse(cacheStr);
                        const updatedCache = cache.filter((item: any) => !((item.id === action.id || item.id_local === action.id) && item.type === 'improvement_actions_control'));
                        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                      }
                    }
                  } else if (action.type === 'quality_policy') {
                    console.log('Eliminando política de calidad:', action.id);
                    const { deleteQualityPolicy } = await import('@/hooks/evaluationFunctions');
                    const result = await deleteQualityPolicy({
                      id: action.id,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Política de calidad eliminada correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'delete' && a.type === 'quality_policy'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));

                      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                      if (cacheStr) {
                        const cache = JSON.parse(cacheStr);
                        const updatedCache = cache.filter((item: any) => !((item.id === action.id || item.id_local === action.id) && item.type === 'quality_policy'));
                        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                      }
                    }
                  } else if (action.type === 'business_quality_objectives') {
                    console.log('Eliminando objetivos empresariales de calidad:', action.id);
                    const { deleteBusinessQualityObjectives } = await import('@/hooks/evaluationFunctions');
                    const result = await deleteBusinessQualityObjectives({
                      id: action.id,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Objetivos empresariales de calidad eliminados correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'delete' && a.type === 'business_quality_objectives'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));

                      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                      if (cacheStr) {
                        const cache = JSON.parse(cacheStr);
                        const updatedCache = cache.filter((item: any) => !((item.id === action.id || item.id_local === action.id) && item.type === 'business_quality_objectives'));
                        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                      }
                    }
                  } else if (action.type === 'stakeholder_analysis_matrix') {
                    console.log('Eliminando matriz de análisis de partes interesadas:', action.id);
                    const { deleteStakeholderAnalysisMatrix } = await import('@/hooks/evaluationFunctions');
                    const result = await deleteStakeholderAnalysisMatrix({
                      id: action.id,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Matriz de análisis de partes interesadas eliminada correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'delete' && a.type === 'stakeholder_analysis_matrix'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));

                      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                      if (cacheStr) {
                        const cache = JSON.parse(cacheStr);
                        const updatedCache = cache.filter((item: any) => !((item.id === action.id || item.id_local === action.id) && item.type === 'stakeholder_analysis_matrix'));
                        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                      }
                    }
                  } else if (action.type === 'communication_plan') {
                    console.log('Eliminando plan de comunicación:', action.id);
                    const { deleteCommunicationPlan } = await import('@/hooks/evaluationFunctions');
                    const result = await deleteCommunicationPlan({
                      id: action.id,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Plan de comunicación eliminado correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'delete' && a.type === 'communication_plan'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));

                      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                      if (cacheStr) {
                        const cache = JSON.parse(cacheStr);
                        const updatedCache = cache.filter((item: any) => !((item.id === action.id || item.id_local === action.id) && item.type === 'communication_plan'));
                        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                      }
                    }
                  } else if (action.type === 'knowledge_management_matrix') {
                    console.log('Eliminando matriz de gestión del conocimiento:', action.id);
                    const { deleteKnowledgeManagementMatrix } = await import('@/hooks/evaluationFunctions');
                    const result = await deleteKnowledgeManagementMatrix({
                      id: action.id,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Matriz de gestión del conocimiento eliminada correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'delete' && a.type === 'knowledge_management_matrix'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));

                      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                      if (cacheStr) {
                        const cache = JSON.parse(cacheStr);
                        const updatedCache = cache.filter((item: any) => !((item.id === action.id || item.id_local === action.id) && item.type === 'knowledge_management_matrix'));
                        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                      }
                    }
                  } else if (action.type === 'change_planning') {
                    console.log('Eliminando planificación de cambios del SGC:', action.id);
                    const { deleteChangePlanning } = await import('@/hooks/evaluationFunctions');
                    const result = await deleteChangePlanning({
                      id: action.id,
                      refreshAccessToken,
                      logout,
                    });

                    if (result.status) {
                      console.log('Planificación de cambios del SGC eliminada correctamente');
                      const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'delete' && a.type === 'change_planning'));
                      await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));

                      const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                      if (cacheStr) {
                        const cache = JSON.parse(cacheStr);
                        const updatedCache = cache.filter((item: any) => !((item.id === action.id || item.id_local === action.id) && item.type === 'change_planning'));
                        await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                      }
                    }
                  } else if (action.type === 'routes_and_tours') {
              console.log('Eliminando ruta o gira:', action.id);
            const { deleteRouteAndTour } = await import('@/hooks/evaluationFunctions');
            const result = await deleteRouteAndTour({
              id: action.id,
              refreshAccessToken,
              logout,
            });

            if (result.status) {
              console.log('Ruta o gira eliminada correctamente');
              // Eliminar acción del array
              const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'delete' && a.type === 'routes_and_tours'));
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
              
              // Eliminar del cache
              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr);
                const updatedCache = cache.filter((item: any) => !(item.id === action.id || item.id_local === action.id));
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
              }
            }
          }
        }
      } catch (error) {
        console.error('Error procesando acción de evaluación:', error);
      }
    }
  }

  const checkSurveysActionsCache = async () => {
    if (!employee) return;

    const actionsStr = await AsyncStorage.getItem('surveys_actions');
    if (!actionsStr) return;

    const actions = JSON.parse(actionsStr);
    if (!actions || actions.length === 0) return;

    console.log('Sincronizando acciones de encuestas:', actions.length);

    // Procesar acciones una por una
    for (const action of actions) {
      try {
        if (action.type === 'create') {
          console.log('Creando encuesta:', action.id);
          const result = await createSurveyAPI({
            requestData: action.requestData,
            marcaId: action.marcaId,
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            console.log('Encuesta creada correctamente');
            
            // Eliminar encuesta del cache local (la que tiene id_local)
            const cacheStr = await AsyncStorage.getItem('surveys_cache');
            if (cacheStr) {
              const cache = JSON.parse(cacheStr);
              const updatedCache = cache.filter((s: any) => s.id_local !== action.id);
              await AsyncStorage.setItem('surveys_cache', JSON.stringify(updatedCache));
            }
            
            // Eliminar acción del array
            const updatedActions = actions.filter((a: any) => a.id !== action.id || a.type !== 'create');
            await AsyncStorage.setItem('surveys_actions', JSON.stringify(updatedActions));
          }
        }
      } catch (error) {
        console.error('Error procesando acción de encuesta:', error);
      }
    }
  }

  const checkTrainingsActionsCache = async () => {
    if (!employee) return;

    const actionsStr = await AsyncStorage.getItem('trainings_actions');
    if (!actionsStr) return;

    const actions = JSON.parse(actionsStr);
    if (!actions || actions.length === 0) return;

    console.log('Sincronizando acciones de capacitaciones:', actions.length);

    // Procesar acciones una por una
    for (const action of actions) {
      try {
        if (action.type === 'create') {
          console.log('Creando capacitación:', action.id);
          const result = await createTraining({
            requestData: action.requestData,
            marcaId: action.marcaId,
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            console.log('Capacitación creada correctamente');
            // Eliminar acción del array
            const updatedActions = actions.filter((a: any) => a.id !== action.id || a.type !== 'create');
            await AsyncStorage.setItem('trainings_actions', JSON.stringify(updatedActions));
          }
        }
      } catch (error) {
        console.error('Error procesando acción de capacitación:', error);
      }
    }
  }

  const checkIncidentsActionsCache = async () => {
    if (!employee) return;

    const actionsStr = await AsyncStorage.getItem('incidents_actions');
    if (!actionsStr) return;

    const actions = JSON.parse(actionsStr);
    if (!actions || actions.length === 0) return;

    console.log('Sincronizando acciones de incidentes:', actions.length);

    for (const action of actions) {
      try {
        if (action.type === 'create') {
          console.log('Creando incidente:', action.id);
          const { createIncident } = await import('@/hooks/incidentsFunctions');
          const result = await createIncident({
            requestData: action.requestData,
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            console.log('Incidente creado correctamente');
            // Remove action from queue
            const updatedActions = actions.filter((a: any) => a.id !== action.id || a.type !== 'create');
            await AsyncStorage.setItem('incidents_actions', JSON.stringify(updatedActions));
          }
        } else if (action.type === 'update') {
          console.log('Actualizando incidente:', action.id);
          const { updateIncident } = await import('@/hooks/incidentsFunctions');
          const result = await updateIncident({
            requestData: action.requestData,
            incidentId: action.id,
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            console.log('Incidente actualizado correctamente');
            // Remove action from queue
            const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.type === 'update'));
            await AsyncStorage.setItem('incidents_actions', JSON.stringify(updatedActions));
          }
        }
      } catch (error) {
        console.error('Error procesando acción de incidente:', error);
      }
    }
  }

  const checkVoiceNotesActionsCache = async () => {
    if (!employee) return;

    const actionsStr = await AsyncStorage.getItem('voice_notes_actions');
    if (!actionsStr) return;

    const actions = JSON.parse(actionsStr);
    if (!actions || actions.length === 0) return;

    console.log('Sincronizando acciones de notas de voz:', actions.length);

    for (const action of actions) {
      try {
        if (action.type === 'create') {
          console.log('Creando nota de voz:', action.id);
          const result = await createVoiceNote({
            requestData: action.requestData,
            marcaId: action.marcaId,
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            console.log('Nota de voz creada correctamente');
            // Remove action from queue
            const updatedActions = actions.filter((a: any) => a.id !== action.id || a.type !== 'create');
            await AsyncStorage.setItem('voice_notes_actions', JSON.stringify(updatedActions));
          }
        } else if (action.type === 'delete') {
          console.log('Eliminando nota de voz:', action.id);
          const result = await deleteVoiceNote({
            voiceNoteId: action.id,
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            console.log('Nota de voz eliminada correctamente');
            // Remove action from queue
            const updatedActions = actions.filter((a: any) => a.id !== action.id || a.type !== 'delete');
            await AsyncStorage.setItem('voice_notes_actions', JSON.stringify(updatedActions));
          }
        }
      } catch (error) {
        console.error('Error procesando acción de nota de voz:', error);
      }
    }
  }

  // Handle deep linking for password recovery
  useEffect(() => {
    const handleDeepLink = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl && initialUrl.includes('/recover-password/')) {
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        const token = initialUrl.split('/recover-password/')[1];
        
        try {
          const response = await fetch(apiUrl + '/api/password/check-recovery-password-token/' + token, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'ngrok-skip-browser-warning': '69420',
            },
          });
          const responseData = await response.json();
          
          if (responseData.status && responseData.empleado) {
            // Navigate to RecoverPassword screen with employee data
            setTimeout(() => {
              navigationRef.current?.navigate('RecoverPassword', {
                token: token,
                employeeId: responseData.empleado.id || '',
                employeeName: responseData.empleado.nombre ? 
                  `${responseData.empleado.nombre} ${responseData.empleado.apellido || ''} ${responseData.empleado.segundo_apellido || ''}`.trim() 
                  : '',
                employeeEmail: responseData.empleado.Email || '',
                employeeCedula: responseData.empleado.cedula || '',
                employeeTelefono: responseData.empleado.telefono || '',
              });
            }, 500);
          } else {
            Alert.alert('Error', responseData.message || 'Token inválido');
          }
        } catch (error) {
          console.error('Error checking recovery token:', error);
          Alert.alert('Error', 'Error al verificar el token de recuperación');
        }
      }
    };

    handleDeepLink();
  }, []);

  const getUpdatedHoraAccion = async () => {
    if (isConnected) {
      await updateServerTime();
    }
    else {
      await setDisconnectedTime();
    }
    const horaAccion = await getHoraAccion();
    return horaAccion;
  }

  // ✅ Aquí agregas la función que se ejecutará cada 30 segundos
  useEffect(() => {
    // Define la función de consulta (puedes personalizarla)
    const fetchData = async () => {
      console.log('Consultando estado del temporizador...');
      const temp_state_async = await AsyncStorage.getItem('temp_state');
      if (!temp_state_async) {
        return;
      }
      console.log(1);
      const temp_state = JSON.parse(temp_state_async);
      if (!temp_state.running) {
        return;
      }
      console.log(2);
      const current = navigationRef.current?.getCurrentRoute()?.name;
      let exist_lunch_time = false;
      for (let i = 0; i < navigationRef.current?.getRootState()?.routes.length; i++) {
        if (navigationRef.current?.getRootState()?.routes[i].name === 'LunchTime') {
          exist_lunch_time = true;
        }
      }
      console.log(3);
      if (current == 'LunchTime') {
        return;
      }
      console.log(4);
      if (exist_lunch_time) {
        return;
      }
      console.log(5);
      const horaAccion = await getUpdatedHoraAccion();
      if (new Date(temp_state.currentTimestamp + temp_state.remainingSeconds).getTime() > horaAccion) {
        return;
      }
      console.log(6);
      await checkLunchTime(temp_state, employee?.id, refreshAccessToken, logout);
    };

    // Ejecuta una vez al inicio
    fetchData();

    // Ejecuta cada 30 segundos (30,000 ms)
    const interval = setInterval(fetchData, 30000);

    // Limpieza al desmontar el componente
    return () => clearInterval(interval);
  }, []);

  
  const check_conection_time = async () => {
    console.log('Checking connection time...');
    if (isConnected) {
      Promise.all([
        updateServerTime(),
        get_notifications()
      ]);
    }
    else {
      setDisconnectedTime();
    }
  }

  const get_notifications = async () => {
    const token = await AsyncStorage.getItem('access_token');
    if (!token) {
      return;
    }
    const current_marca = await AsyncStorage.getItem('current_marca');
    if (!current_marca) {
      return;
    }
    const current_marca_obj = JSON.parse(current_marca);
    if (!current_marca_obj.plaza.id) {
      return;
    }
    
    // Obtener notificaciones actuales en AsyncStorage antes de eliminarlas
    const currentNotificationsStr = await AsyncStorage.getItem('notifications');
    let currentUnwatchedCount = 0;
    if (currentNotificationsStr) {
      const currentNotifications = JSON.parse(currentNotificationsStr);
      currentUnwatchedCount = currentNotifications.filter((n: any) => !n.watched).length;
    }
    
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }
    const response = await fetch(`${apiUrl}/api/notification/plaza/${current_marca_obj.plaza.id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });
    const data = await response.json();
    if (data.status) {
      
      await AsyncStorage.setItem('notifications', JSON.stringify(data.notifications));
      
      // Contar notificaciones no leídas en la respuesta del servidor
      const newUnwatchedCount = data.notifications.filter((n: any) => !n.watched).length;
      
      // Si hay más notificaciones no leídas en el servidor, recargar la ventana
      if (newUnwatchedCount > currentUnwatchedCount) {
        console.log('Nuevas notificaciones detectadas, recargando...');
        eventBus.emit('notificationsUpdated');
      }
      
      // Emitir evento para actualizar el contador en AppHeader
      eventBus.emit('notificationsUpdatedCounter');
    }
    else {
      Alert.alert('Error', data.message);
    }
  }

  
  // ✅ Aquí agregas la función que se ejecutará cada 30 segundos
  useEffect(() => {
    // Ejecuta una vez al inicio
    check_conection_time();

    // Ejecuta cada 60 segundos (60,000 ms)
    const interval = setInterval(check_conection_time, 30000);

    // Limpieza al desmontar el componente
    return () => clearInterval(interval);
  }, [isConnected]);

  if (!loaded) {
    return null;
  }

  const linking = {
    prefixes: ['gonzalez://', 'https://gonzalez.app'],
    config: {
      screens: {
        Home: '',
        Login: 'login',
        ForgotPassword: 'forgot-password',
        VerifyCode: 'verify-code',
        RecoverPassword: 'recover-password/:token',
      },
    },
  };

  const checkLunchTime = async (
    temp_state: any,
    employeeId?: string,
    refreshAccessToken?: () => Promise<boolean>,
    logout?: () => Promise<{ status: boolean; message: string }>
  ) => {
    
    const startTime = new Date(temp_state.startTime).getTime();
    const current = temp_state.currentTimestamp;
    const remainingSeconds = temp_state.remainingSeconds;
    
    const requestData = {
      empleadoId: employeeId,
      inicio: new Date(startTime),
      fin: new Date(current + remainingSeconds),
      pausas: JSON.stringify(temp_state.inactivities),
      es_manual: false
    };

    console.log('requestData', requestData);

    if (isConnected) {
      // Con internet: llamar a la función API
      const responseData = await saveLunchTime({
        requestData,
        employeeId,
        refreshAccessToken,
        logout
      });
      
      if (!responseData.status) {
        Alert.alert('Error', responseData.message);
        return;
      }
      
      await AsyncStorage.removeItem('temp_state');
          
      Alert.alert(
        '🎉 ¡Tiempo de Almuerzo Completado!',
        'Tu descanso ha terminado. ¡Es hora de volver al trabajo!',
        [
          {
            text: 'OK',
            onPress: async () => {
              
            },
          },
        ]
      );
    } else {
      // Sin internet: modo offline
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let localId = '';
      for (let i = 0; i < 10; i++) {
        localId += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      
      // Crear entrada en lunchtime_actions
      const actionsStr = await AsyncStorage.getItem('lunchtime_actions');
      const actions = actionsStr ? JSON.parse(actionsStr) : [];
      actions.push({
        requestData: requestData,
        id: localId,
        type: 'create',
      });
      await AsyncStorage.setItem('lunchtime_actions', JSON.stringify(actions));

      await AsyncStorage.removeItem('temp_state');
      Alert.alert(
        'Modo Offline',
        'Tu descanso ha terminado. El registro se sincronizará cuando haya conexión.',
        [
          {
            text: 'OK',
            onPress: async () => {
              
            },
          },
        ]
      );
    }
  }

  console.log('Estado de conexión:', isConnected);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
      theme={colorScheme === 'dark' ? DarkTheme : DefaultTheme}
      onReady={() => {
        routeNameRef.current = navigationRef.current?.getCurrentRoute()?.name;
        console.log('Pantalla inicial:', routeNameRef.current);
      }}
      onStateChange={() => {
        const state = navigationRef.current?.getRootState();
        const routes = state?.routes ?? [];
        if (!routes.length) return;

        const filteredRoutes: typeof routes = [];
        const seen = new Set<string>();

        for (let i = routes.length - 1; i >= 0; i--) {
          const route = routes[i];
          if (!seen.has(route.name)) {
            filteredRoutes.unshift(route);
            seen.add(route.name);
          }
        }

        if (filteredRoutes.length !== routes.length) {
          navigationRef.current?.dispatch(
            CommonActions.reset({
              index: filteredRoutes.length - 1,
              routes: filteredRoutes,
            })
          );
        }

        routeNameRef.current = navigationRef.current?.getCurrentRoute()?.name;
      }}
    >
      <RootNavigator />
      <StatusBar style="auto" />
    </NavigationContainer>
    </GestureHandlerRootView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
