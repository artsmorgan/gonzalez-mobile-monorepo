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
import { Alert, Animated } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './contexts/AuthContext';
import { useColorScheme } from './hooks/useColorScheme';
import saveLunchTime from './hooks/saveLunchTime';
import {
  computeLunchEndTimeMs,
  markLunchTimeAsCompleted,
  mergeCurrentMarcaHierarchyIntoLunchRequest,
  releaseLunchTimerCompletionLock,
  tryAcquireLunchTimerCompletionLock,
} from './hooks/lunchTimeMarcaHierarchy';
import {
  clearHorarioMinutosActions,
  LUNCH_TIME_HORARIO_ACTIONS_KEY,
  readHorarioMinutosActions,
  updateHorarioMinutosAlmuerzo,
} from './hooks/lunchTimeHorarioApi';
import { useAuth } from './contexts/AuthContext';
import { createVehicle, updateVehicle, deleteVehicle, deleteVehicleAttachment } from './hooks/vehiclesFunctions';
import { getFile, deleteFile } from './hooks/fileStorage';
import {
  patchVehicleVisitasLocalCreateWithServerId,
  stripVehicleVisitasAttachmentForRow,
} from './hooks/vehiclesVisitasCacheHelpers';
import { createNote, updateNote, deleteNote } from './hooks/notesFunctions';
import { markNotificationsAsRead } from './hooks/notificationsFunctions';
import {
  createSurvey as createSurveyAPI,
  updateSurvey as updateSurveyAPI,
  deleteSurvey as deleteSurveyAPI,
  updateSurveySignature as updateSurveySignatureAPI,
} from './hooks/surveysFunctions';
import {
  upsertSurveyCacheRowForPuesto,
  buildSurveyCacheRowFromCreateRequest,
} from './hooks/satisfactionSurveysCacheHelpers';
import {
  createTraining,
  deleteTraining,
  updateTraining,
  deleteTrainingArchivo,
} from './hooks/trainingFunctions';
import { hydrateTrainingRequestDataForSync } from './hooks/trainingAttachmentsSync';
import { createVoiceNote, deleteVoiceNote, updateVoiceNote } from './hooks/voiceNotesFunctions';
import { createBitacoraVehiculoDetenido } from './hooks/bitacoraVehiculoDetenidoFunctions';
import { createLlave, deleteLlave, updateLlave } from './hooks/llavesFunctions';
import {
  readMainStructureTree,
  writeMainStructureTree,
  patchLlaveLocalKeyToServerIdInTree,
  patchLlaveroLocalKeyToServerIdInTree,
  patchMovimientoLlaveInTree,
  patchShadowMovimientoLlaveFromLlaveroSync,
  removeLlaveFromCorpoTreeAndStripLlaveroLinks,
  removeLlaveroFromCorpoTree,
  applyLlaveUpdatePayloadToTree,
  applyLlaveroUpdatePayloadToTree,
  patchAllLlaveroLinksLlaveIdLocalEverywhere,
  findCorpoAndLlaveRowInTree,
  findCorpoAndLlaveroRowInTree,
  patchMovimientoLlaveroInTree,
  stripLlaveMovimientosByIdLocal,
} from './hooks/llavesMainStructureHelpers';
import { createMovimientoLlave, deleteMovimientoLlave, updateMovimientoLlave } from './hooks/movimientosLlavesFunctions';
import { createLlavero, deleteLlavero, updateLlavero } from './hooks/llaverosFunctions';
import { createMovimientoLlavero, deleteMovimientoLlavero, updateMovimientoLlavero } from './hooks/movimientosLlaverosFunctions';
import { createMovimientoActivoMantenimiento, deleteMovimientoActivoMantenimiento, updateMovimientoActivoMantenimiento } from './hooks/movimientosActivosMantenimientoFunctions';
import {
  createMovimientoArticuloMantenimiento,
  deleteMovimientoArticuloMantenimiento,
  updateMovimientoArticuloMantenimiento,
} from './hooks/movimientosArticulosMantenimientoFunctions';
import { createDocumentoEntregado, deleteDocumentoEntregado, updateDocumentoEntregado } from './hooks/documentosEntregadosFunctions';
import {
  buildDocumentoEntregadoCacheRowFromRequest,
  getDocEntregadoCorpoId,
  upsertDocumentoEntregadoInCache,
} from './hooks/documentosEntregadosCacheHelpers';
import { createApreciacionVulnerabilidad, deleteApreciacionVulnerabilidad, deleteApreciacionVulnerabilidadImage, updateApreciacionVulnerabilidad, updateApreciacionVulnerabilidadFirmaSolicitante } from './hooks/apreciacionVulnerabilidadFunctions';
import { eventBus } from './hooks/eventBus';
import {
  patchSucursalPuestosUbicacionInFragments,
  writePuestoUbicacionDispositivo,
} from './hooks/mainStructureFragmentsStorage';
import { clearPuestoArticulosList } from './hooks/mantenimientoEquipoPuestoArticulosCache';
import {
  applyActaEntregaCreateSyncFromServer,
  applyActaEntregaUpdateSyncFromServer,
  readActaEntregaProductosCache,
  writeActaEntregaProductosCache,
} from './hooks/actaEntregaProductosCache';
import { replaceLocalVisitorIdInCache, syncVisitorsCacheFromNetwork } from './hooks/visitorsCacheHelpers';

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
import CorporateVehiclesScreen from './screens/CorporateVehiclesScreen';
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
import TrasladoPlazasScreen from './screens/TrasladoPlazasScreen';
import ActaEntregaProductosScreen from './screens/ActaEntregaProductosScreen';
import InductionTourRecordScreen from './screens/InductionTourRecordScreen';
import GeneralInductionRegisterScreen from './screens/GeneralInductionRegisterScreen';
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
import { FORCE_OFFLINE } from './constants/syncFlags';
import { resolveAppConnectivity } from './hooks/resolveAppConnectivity';
import {
  CURRENT_MARCA_UPDATED_EVENT,
  extractPushData,
  flushPushDeviceActions,
  PUSH_DEVICE_ACTIONS_KEY,
  resolvePushNavigationTarget,
  syncPushDeviceRegistration,
} from './hooks/pushNotificationsService';
import * as Notifications from 'expo-notifications';
import saveManualSignature from './hooks/saveManualSignature';
import saveMarca from './hooks/saveMarca';
import saveAbsentReason from './hooks/saveAbsentReason';
import revertAttendanceLeaving from './hooks/revertAttendanceLeaving';
import {
  readAttendanceActions,
  removeAttendanceActionById,
  writeAttendanceActions,
} from './hooks/attendanceActionsStorage';
import {
  attachPlanillasTokenToAllPendingActions,
  pendingActionsRequirePlanillasToken,
} from './hooks/planillasPendingActions';
import getHoraAccion from './hooks/getHoraAccion';
import authedFetch from './hooks/authedFetch';
import updateServerTime from './hooks/updateServerTime';
import updateLastLocation from './hooks/updateLastLocation';
import getValidAccessTokenOrLogout from './hooks/getValidAccessTokenOrLogout';
import { isStoredPlanillasTokenValid, readStoredPlanillasToken } from './hooks/planillasTokenStorage';
import PlanillasPasswordRevalidationModal from './components/PlanillasPasswordRevalidationModal';
import JobManualsScreen from './screens/JobManualsScreen';
import { createJobManual, deleteJobManual, signJobManual, putJobManualQuizResult, appendJobManualPuestos } from './hooks/jobManualsFunctions';
import { patchJobManualPuestosVinculadosInCache } from './hooks/jobManualsCacheHelpers';
import {
  applyJobManualCreateSuccess,
  deleteJobManualLocalFileRefsFromJson,
  hydrateJobManualCreateRequestData,
  hydrateJobManualSignFiles,
} from './hooks/jobManualsQueueUtils';
import StaffEvaluationsScreen from './screens/StaffEvaluationsScreen';
import BitacoraVehiculosDetenidosScreen from './screens/BitacoraVehiculosDetenidosScreen';
import LlavesScreen from './screens/LlavesScreen';
import MantenimientoEquipoScreen from './screens/MantenimientoEquipoScreen';
import DocumentosEntregadosScreen from './screens/DocumentosEntregadosScreen';
import ApreciacionVulnerabilidadScreen from './screens/ApreciacionVulnerabilidadScreen';
import MutuosAcuerdosScreen from './screens/MutuosAcuerdosScreen';
import EntregaPuestosScreen from './screens/EntregaPuestosScreen';
import ChecklistSupervisionScreen from './screens/ChecklistSupervisionScreen';
import PuestoUbicacionScreen from './screens/PuestoUbicacionScreen';
import JerarquiaScreen from './screens/JerarquiaScreen';
import NomencladoresScreen from './screens/NomencladoresScreen';
import ReportesScreen from './screens/ReportesScreen';
import {
  createStaffEvaluation,
  deleteStaffEvaluation,
  updateStaffEvaluationSignature,
} from './hooks/staffEvaluationsFunctions';
import { buildStaffEvaluacionForSubmit, deleteStaffEvalLocalImageFiles } from './hooks/staffEvaluationsMediaSync';
import {
  runCorporateEvaluationsSync,
  CORPORATE_EVALUATION_TYPES,
  BITACORA_VEHICULO_DETENIDO_EVAL_TYPE,
} from './hooks/corporateEvaluationsSync';
import { CacheSyncActionsOverlay } from './components/CacheSyncActionsOverlay';
import {
  HIERARCHY_UPDATE_OVERLAY_HIDE_EVENT,
  HIERARCHY_UPDATE_OVERLAY_SHOW_EVENT,
} from './hooks/backgroundMainStructureDownload';

/** Re-lee la cola en disco y aplica el mismo criterio que .filter, para no reintroducir acciones ya quitadas. */
async function persistFilteredMantenimientoEquipoActionQueue(
  storageKey: string,
  keep: (a: any) => boolean
): Promise<void> {
  let cur: any[] = [];
  try {
    const raw = await AsyncStorage.getItem(storageKey);
    if (raw) {
      const p = JSON.parse(raw);
      if (Array.isArray(p)) cur = p;
    }
  } catch {
    /* no-op */
  }
  const next = cur.filter(keep);
  if (next.length === 0) await AsyncStorage.removeItem(storageKey);
  else await AsyncStorage.setItem(storageKey, JSON.stringify(next));
}

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
  MutuosAcuerdos: undefined;
  Notifications: undefined;
  Surveys: undefined;
  Trainings: { matchCacheToFilterCorpo?: boolean } | undefined;
  VoiceNotes: undefined;
  SatisfactionSurveys: undefined;
  MileageControl: undefined;
  UniformRequest: undefined;
  RoutesAndTours: undefined;
  EmployeeSatisfaction: undefined;
  VehicleMaintenance: undefined;
  NonConformingProduct: undefined;
  ComplaintsMaster: undefined;
  CorporateVehicles: undefined;
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
  TrasladoPlazas: undefined;
  ActaEntregaProductos: undefined;
  InductionTourRecord: undefined;
  GeneralInductionRegister: undefined;
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
  JobManuals: undefined;
  StaffEvaluations: undefined;
  BitacoraVehiculosDetenidos:
  | undefined
  | {
    prefill?: {
      empresa_id?: number;
      cliente_id: number;
      division_id?: number;
      contrato_id?: number;
      sucursal_id: number;
      vehiculo_id?: number;
      uso_id?: number;
      vehiculo_id_local?: string;
      uso_id_local?: string;
      vehiculo_tipo?: string;
      vehiculo_placa?: string;
    };
    returnTo?: keyof RootStackParamList;
  };
  Llaves: undefined;
  MantenimientoEquipo: undefined;
  DocumentosEntregados: undefined;
  ApreciacionVulnerabilidad: undefined;
  EntregaPuestos: undefined;
  ChecklistSupervision: undefined;
  PuestoUbicacion: undefined;
  Jerarquia: undefined;
  Nomencladores: undefined;
  Reportes: undefined;
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
      <Stack.Screen name="MutuosAcuerdos" component={MutuosAcuerdosScreen} />
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
      <Stack.Screen name="CorporateVehicles" component={CorporateVehiclesScreen} />
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
      <Stack.Screen name="TrasladoPlazas" component={TrasladoPlazasScreen} />
      <Stack.Screen name="ActaEntregaProductos" component={ActaEntregaProductosScreen} />
      <Stack.Screen name="InductionTourRecord" component={InductionTourRecordScreen} />
      <Stack.Screen name="GeneralInductionRegister" component={GeneralInductionRegisterScreen} />
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
      <Stack.Screen name="JobManuals" component={JobManualsScreen} />
      <Stack.Screen name="StaffEvaluations" component={StaffEvaluationsScreen} />
      <Stack.Screen name="BitacoraVehiculosDetenidos" component={BitacoraVehiculosDetenidosScreen} />
      <Stack.Screen name="Llaves" component={LlavesScreen} />
      <Stack.Screen name="MantenimientoEquipo" component={MantenimientoEquipoScreen} />
      <Stack.Screen name="DocumentosEntregados" component={DocumentosEntregadosScreen} />
      <Stack.Screen name="ApreciacionVulnerabilidad" component={ApreciacionVulnerabilidadScreen} />
      <Stack.Screen name="EntregaPuestos" component={EntregaPuestosScreen} />
      <Stack.Screen name="ChecklistSupervision" component={ChecklistSupervisionScreen} />
      <Stack.Screen name="PuestoUbicacion" component={PuestoUbicacionScreen} />
      <Stack.Screen name="Jerarquia" component={JerarquiaScreen} />
      <Stack.Screen name="Nomencladores" component={NomencladoresScreen} />
      <Stack.Screen name="Reportes" component={ReportesScreen} />
    </Stack.Navigator>
  );
}

/**
 * Una sola ejecución global de sync (no por instancia de AppContent).
 * useRef dentro del componente falla con doble montaje / remount: el segundo mount ve lock en false.
 */
const SYNC_CACHES_GLOBAL_KEY = '__MONITOREAPP_SYNC_CACHES_SLOT__' as const;
type SyncCachesSlot = { inFlight: Promise<void> | null };
function getSyncCachesSlot(): SyncCachesSlot {
  const g = globalThis as unknown as Record<string, SyncCachesSlot>;
  if (!g[SYNC_CACHES_GLOBAL_KEY]) {
    g[SYNC_CACHES_GLOBAL_KEY] = { inFlight: null };
  }
  return g[SYNC_CACHES_GLOBAL_KEY];
}

function AppContent() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('./assets/fonts/SpaceMono-Regular.ttf'),
  });
  const { employee, accessToken, refreshAccessToken, logout } = useAuth();

  const navigationRef = useRef<any>(null);
  const routeNameRef = useRef<string | undefined>(undefined);
  // 🆕 Variable de estado para conexión a internet
  const [isConnected, setIsConnected] = React.useState<boolean | null>(null);
  const [cacheSyncModalVisible, setCacheSyncModalVisible] = React.useState(false);
  const [hierarchyUpdateModalVisible, setHierarchyUpdateModalVisible] = React.useState(false);
  const [showPlanillasRevalidationModal, setShowPlanillasRevalidationModal] = React.useState(false);
  const planillasRevalidationModalShownRef = useRef(false);
  const cacheSyncFadeAnim = useRef(new Animated.Value(0));
  const hierarchyUpdateFadeAnim = useRef(new Animated.Value(0));
  const cacheSyncOverlayActiveRef = useRef(false);
  const hierarchyUpdateOverlayActiveRef = useRef(false);

  const dismissCacheSyncOverlayOnly = useCallback(() => {
    Animated.timing(cacheSyncFadeAnim.current, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        cacheSyncOverlayActiveRef.current = false;
        setCacheSyncModalVisible(false);
      }
    });
  }, []);

  const dismissHierarchyUpdateOverlayOnly = useCallback(() => {
    Animated.timing(hierarchyUpdateFadeAnim.current, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        hierarchyUpdateOverlayActiveRef.current = false;
        setHierarchyUpdateModalVisible(false);
      }
    });
  }, []);

  const showHierarchyUpdateOverlay = useCallback(() => {
    hierarchyUpdateOverlayActiveRef.current = true;
    setHierarchyUpdateModalVisible(true);
    hierarchyUpdateFadeAnim.current.setValue(0);
    requestAnimationFrame(() => {
      Animated.timing(hierarchyUpdateFadeAnim.current, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start();
    });
  }, []);

  const hideHierarchyUpdateOverlay = useCallback(() => {
    if (!hierarchyUpdateOverlayActiveRef.current) return;
    Animated.timing(hierarchyUpdateFadeAnim.current, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        hierarchyUpdateOverlayActiveRef.current = false;
        setHierarchyUpdateModalVisible(false);
      }
    });
  }, []);

  useEffect(() => {
    const onShow = () => showHierarchyUpdateOverlay();
    const onHide = () => hideHierarchyUpdateOverlay();
    eventBus.on(HIERARCHY_UPDATE_OVERLAY_SHOW_EVENT, onShow);
    eventBus.on(HIERARCHY_UPDATE_OVERLAY_HIDE_EVENT, onHide);
    return () => {
      eventBus.off(HIERARCHY_UPDATE_OVERLAY_SHOW_EVENT, onShow);
      eventBus.off(HIERARCHY_UPDATE_OVERLAY_HIDE_EVENT, onHide);
    };
  }, [showHierarchyUpdateOverlay, hideHierarchyUpdateOverlay]);

  /**
   * Colas de sincronización. Bitácoras: `bitacora_vehiculo_detenido_cache` (`bySucursalId`). Checklists: misma forma en
   * `checklist_supervision_cache` (`checklistSupervisionCacheStorage`). Jerarquía: `loadMainStructureTreeMerged` / fragmentos.
   */
  const ACTION_STORAGE_KEYS = [
    'lunch_time_actions',
    LUNCH_TIME_HORARIO_ACTIONS_KEY,
    'vehicles_actions',
    'bitacora_vehiculo_detenido_actions',
    'llaves_actions',
    'movimientos_llaves_actions',
    'llaveros_actions',
    'movimientos_llaveros_actions',
    'articulo_mantenimiento_actions',
    'articulo_mantenimiento_delete_archivo_actions',
    'movimientos_articulos_mantenimiento_actions',
    'documentos_entregados_actions',
    'apreciacion_vulnerabilidad_actions',
    'notifications_actions',
    'visitors_actions',
    'notes_actions',
    'activities_actions',
    'evaluations_actions',
    'surveys_actions',
    'trainings_actions',
    'incidents_actions',
    'mutuos_acuerdos_actions',
    'incident_contributions_actions',
    'voice_notes_actions',
    'evaluations_staff_actions',
    'job_manuals_actions',
    'checklist_supervision_actions',
    'attendance_actions',
    PUSH_DEVICE_ACTIONS_KEY,
  ];

  const authedFetchCb = useCallback(
    async (args: { url: string; init: RequestInit }): Promise<Response | null> => {
      return authedFetch({ ...args, refreshAccessToken, logout });
    },
    [refreshAccessToken, logout]
  );

  const hasPendingActionsInStorage = useCallback(async (): Promise<boolean> => {
    const values = await Promise.all(ACTION_STORAGE_KEYS.map((key) => AsyncStorage.getItem(key)));
    return values.some((raw) => {
      if (!raw) return false;
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) && parsed.length > 0;
      } catch {
        return false;
      }
    });
  }, []);

  /** Evento global: cualquier parte de la app puede hacer `eventBus.emit('syncCachesRequested')`. */
  const SYNC_CACHES_EVENT = 'syncCachesRequested' as const;
  const MOBILE_VERSION_EVENT = 'mobileVersionAvailabilityChanged' as const;

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

  const checkMobileVersionAvailability = useCallback(async () => {
    try {
      const connectivity = await resolveAppConnectivity();
      const appVersionInfo = Constants.expoConfig?.extra?.APP_VERSION_INFO;
      const appVersion = String(appVersionInfo?.version || '0.0.0');
      if (!connectivity.ok) {
        eventBus.emit(MOBILE_VERSION_EVENT, { available: false, data: null, appVersion });
      return;
    }

      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl || !appVersionInfo) {
        eventBus.emit(MOBILE_VERSION_EVENT, { available: false, data: null, appVersion });
        return;
      }

      const response = await authedFetchCb({
        url: `${apiUrl}/api/mobile-versions`,
        init: {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': '69420',
          },
        },
      });
      if (!response || !response.ok) {
        eventBus.emit(MOBILE_VERSION_EVENT, { available: false, data: null, appVersion });
        return;
      }

      const versionData = await response.json().catch(() => null);
      const serverVersion = String(versionData?.version || '0.0.0');
      const isNewer = compareSemver(serverVersion, appVersion) === 1;

      eventBus.emit(MOBILE_VERSION_EVENT, {
        available: isNewer,
        data: versionData,
        appVersion,
      });
    } catch (error) {
      console.error('Error checking mobile versions:', error);
      const appVersionInfo = Constants.expoConfig?.extra?.APP_VERSION_INFO;
      eventBus.emit(MOBILE_VERSION_EVENT, { available: false, data: null, appVersion: String(appVersionInfo?.version || '0.0.0') });
    }
  }, [authedFetchCb]);

  const requestPlanillasTokenForSyncIfNeeded = useCallback(async (): Promise<boolean> => {
    const requiresPlanillas = await pendingActionsRequirePlanillasToken();
    if (!requiresPlanillas) {
      return true;
    }

    let referenceMs: number;
    try {
      referenceMs = await getHoraAccion();
    } catch {
      referenceMs = Date.now();
    }

    const tokenCheck = await isStoredPlanillasTokenValid(referenceMs);
    if (tokenCheck.valid) {
      planillasRevalidationModalShownRef.current = false;
      setShowPlanillasRevalidationModal(false);
      return true;
    }

    if (!planillasRevalidationModalShownRef.current) {
      planillasRevalidationModalShownRef.current = true;
      setShowPlanillasRevalidationModal(true);
    }

    return false;
  }, []);

  const handlePlanillasRevalidationSuccess = useCallback(async () => {
    setShowPlanillasRevalidationModal(false);
    planillasRevalidationModalShownRef.current = false;

    const stored = await readStoredPlanillasToken();
    if (stored?.token) {
      await attachPlanillasTokenToAllPendingActions(stored.token);
    }

    eventBus.emit('syncCachesRequested');
  }, []);

  const handlePlanillasRevalidationDismiss = useCallback(() => {
    planillasRevalidationModalShownRef.current = false;
    setShowPlanillasRevalidationModal(false);
  }, []);

  /**
   * Sincronización de colas pendientes y tareas online agregadas (hora servidor, versión APK, firma manual).
   * Requiere `resolveAppConnectivity()` (incluye FORCE_OFFLINE). Las funciones `check*ActionsCache` asumen
   * que solo se llaman desde aquí tras esa comprobación; no duplican el chequeo en cada una.
   */
  const syncPendingActionsIfOnline = useCallback(() => {
    const slot = getSyncCachesSlot();
    if (slot.inFlight != null) {
      console.log('[syncCaches] Omitido: ya hay una ejecución en curso (global)');
      return;
    }
    slot.inFlight = (async () => {
      try {
        const connectivity = await resolveAppConnectivity();
        setIsConnected(connectivity.ok);
        if (!connectivity.ok) {
          console.log('[syncCaches] Sin conexión:', connectivity.reason);
          return;
        }
        if (!employee) {
          console.log('[syncCaches] Esperando employee en memoria para ejecutar checks');
          return;
        }

        console.log('Conectado — sync cachés (única instancia)');

      await Promise.all([
          updateServerTime(),
          //checkMobileVersionAvailability(),
      ]);
        await checkManualSignatureCache();

      const hasPendingActions = await hasPendingActionsInStorage();
      if (!hasPendingActions) return;

      const validAccessToken = await getValidAccessTokenOrLogout({ refreshAccessToken, logout });
      if (!validAccessToken) {
        console.log('Sincronización cancelada: token inválido o expirado');
        return;
      }

      const hasValidPlanillasToken = await requestPlanillasTokenForSyncIfNeeded();
      if (!hasValidPlanillasToken) {
        console.log('[syncCaches] Sincronización en espera: token de Planillas requerido');
        return;
      }

      const storedPlanillas = await readStoredPlanillasToken();
      if (storedPlanillas?.token) {
        await attachPlanillasTokenToAllPendingActions(storedPlanillas.token);
      }

        console.log(' -------------------------- sincronizando cachés');
        cacheSyncOverlayActiveRef.current = true;
        setCacheSyncModalVisible(true);
        cacheSyncFadeAnim.current.setValue(0);
        requestAnimationFrame(() => {
          Animated.timing(cacheSyncFadeAnim.current, {
            toValue: 1,
            duration: 220,
            useNativeDriver: true,
          }).start();
        });

        let actionsSyncError: unknown = null;
        try {
          await checkAttendanceActionsCache();
          await checkLunchTimeHorarioActionsCache();
          // Incidente debe existir en servidor antes que aportes (acciones con incidentLocalKey).
          await checkIncidentsActionsCache();
          await checkIncidentContributionsActionsCache();
          await checkArticuloMantenimientoDeleteArchivoActionsCache();
      await Promise.all([
        checkLunchTimeActionsCache(),
            checkActivitiesActionsCache(),
            checkChecklistSupervisionActionsCache(),
        checkVehiclesActionsCache(),
        checkArticuloMantenimientoActionsCache(),
        checkMovimientosArticulosMantenimientoActionsCache(),
        checkDocumentosEntregadosActionsCache(),
        checkApreciacionVulnerabilidadActionsCache(),
        checkNotificationsActionsCache(),
        checkPushDeviceActionsCache(),
        checkVisitorsActionsCache(),
        checkNotesActionsCache(),
        checkSurveysActionsCache(),
        checkTrainingsActionsCache(),
        checkMutuosAcuerdosActionsCache(),
        checkVoiceNotesActionsCache(),
        checkStaffEvaluationsActionsCache(),
        checkJobManualsActionsCache(),
      ]);
          // Llaves → movimientos llave → llaveros → movimientos llavero (dependencias), luego evaluaciones/corporativos al final
          await checkLlavesActionsCache();
          await checkMovimientosLlavesActionsCache();
          await checkLlaverosActionsCache();
          await checkMovimientosLlaverosActionsCache();
          await checkEvaluationsActionsCache();
      eventBus.emit('connectionRestored');
        } catch (e) {
          actionsSyncError = e;
          console.error('[syncCaches] Error sincronizando acciones en caché:', e);
    } finally {
          const finishOverlay = () => {
            if (cacheSyncOverlayActiveRef.current) {
              Animated.timing(cacheSyncFadeAnim.current, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
              }).start(({ finished }) => {
                if (finished) {
                  cacheSyncOverlayActiveRef.current = false;
                  setCacheSyncModalVisible(false);
                  if (!actionsSyncError) {
                    Alert.alert('Sincronización completada');
                  }
                }
              });
            } else if (!actionsSyncError) {
              Alert.alert('Sincronización completada');
            }
          };
          finishOverlay();
        }
      } finally {
        slot.inFlight = null;
      }
    })();
  }, [requestPlanillasTokenForSyncIfNeeded, checkMobileVersionAvailability, employee, hasPendingActionsInStorage, logout, refreshAccessToken]);

  // eventBus + foco de app + reconexión → intentar sincronizar cachés (con comprobación de red dentro)
  useEffect(() => {
    const onSyncRequested = () => {
    syncPendingActionsIfOnline();
    };
    eventBus.on(SYNC_CACHES_EVENT, onSyncRequested);
    // Al montar (inicio de sesión / arranque)
    onSyncRequested();
    return () => {
      eventBus.off(SYNC_CACHES_EVENT, onSyncRequested);
    };
  }, [syncPendingActionsIfOnline]);

  // Red: reconexión dispara sync; intervalo periódico (sync comprueba red dentro)
  useEffect(() => {
    if (FORCE_OFFLINE) {
      setIsConnected(false);
      return;
    }

    const wasOnlineRef = { current: false };

    (async () => {
      const networkState = await Network.getNetworkStateAsync();
  
      const online = (networkState.isConnected === true && networkState.isInternetReachable === true);
      wasOnlineRef.current = online;
      setIsConnected(online);
    })();

    const subscription = Network.addNetworkStateListener((s) => {
      const online = !!(s.isConnected === true && s.isInternetReachable === true);
      setIsConnected(online);
      if (online && !wasOnlineRef.current) {
        eventBus.emit(SYNC_CACHES_EVENT);
      }
      wasOnlineRef.current = online;
    });

    const intervalId = setInterval(() => {
      eventBus.emit(SYNC_CACHES_EVENT);
    }, 60 * 1000);

    return () => {
      subscription.remove();
      clearInterval(intervalId);
    };
  }, []);

  const checkManualSignatureCache = async () => {
    if (!employee) return;
    const connectivity = await resolveAppConnectivity();
    if (!connectivity.ok) {
      return;
    }
    const manual_signature_cache = await AsyncStorage.getItem('manual_signature_cache');
    if (manual_signature_cache) {
      const data = await saveManualSignature({ signature: manual_signature_cache, employeeId: employee.id, refreshAccessToken, logout });
      if (data.status) {
        console.log('Firma guardada correctamente');
      }
    }
  }

  const checkAttendanceActionsCache = async () => {
    if (!employee) return;

    const legacyMarca = await AsyncStorage.getItem('marca_cache');
    if (legacyMarca) {
      try {
        const p = JSON.parse(legacyMarca);
        const list = await readAttendanceActions();
        list.push({
          id: `mig_marca_${Date.now()}`,
          type: 'salida',
          marcaId: Number(p.marcaId),
          reason: String(p.reason ?? ''),
          horaAccion: Number(p.horaAccion),
        });
        await writeAttendanceActions(list);
      } catch (e) {
        console.error('Migración marca_cache', e);
      }
      await AsyncStorage.removeItem('marca_cache');
    }

    const legacyAbsent = await AsyncStorage.getItem('absent_reason_cache');
    if (legacyAbsent) {
      try {
        const p = JSON.parse(legacyAbsent);
        const hora = await getHoraAccion();
        const list = await readAttendanceActions();
        list.push({
          id: `mig_abs_${Date.now()}`,
          type: 'absent_reason',
          marcaId: Number(p.marcaId),
          reason: String(p.reason ?? ''),
          horaAccion: hora && Number.isFinite(Number(hora)) ? Number(hora) : Date.now(),
        });
        await writeAttendanceActions(list);
      } catch (e) {
        console.error('Migración absent_reason_cache', e);
      }
      await AsyncStorage.removeItem('absent_reason_cache');
    }

    const actions = await readAttendanceActions();
    if (actions.length === 0) return;

    console.log('Sincronizando attendance_actions:', actions.length);

    for (const action of actions) {
      try {
        if (action.type === 'salida') {
          const data = await saveMarca({
            data_params: {
              type: 'salida',
              reason: action.reason,
              horaAccion: action.horaAccion,
            },
            marcaId: action.marcaId,
            planillasToken: action.planillasToken,
            refreshAccessToken,
            logout,
          });
      if (data.status) {
            await removeAttendanceActionById(action.id);
            console.log('Salida offline sincronizada');
          }
        } else if (action.type === 'absent_reason') {
          const data = await saveAbsentReason({
            reason: action.reason,
            marcaId: action.marcaId,
            horaAccion: action.horaAccion,
            refreshAccessToken,
            logout,
          });
          if (data.status) {
            await removeAttendanceActionById(action.id);
            console.log('Motivo de ausencia sincronizado');
          }
        } else if (action.type === 'revert_leaving') {
          const data = await revertAttendanceLeaving({
            marcaId: action.marcaId,
            horaAccion: action.horaAccion,
            planillasToken: action.planillasToken,
            refreshAccessToken,
            logout,
          });
          if (data.status) {
            await removeAttendanceActionById(action.id);
            console.log('Revertir salida sincronizado');
          }
        }
      } catch (e) {
        console.error('attendance_actions error', e);
      }
    }
  };

  const checkJobManualsActionsCache = async () => {
    if (!employee) return;

    const actionsStr = await AsyncStorage.getItem('job_manuals_actions');
    if (!actionsStr) return;

    const actions = JSON.parse(actionsStr);
    if (!Array.isArray(actions) || actions.length === 0) return;

    let work: any[] = actions.slice();
    console.log('Sincronizando acciones de manuales de trabajo:', work.length);

    /** Quita de la cola en storage; siempre parte del estado actual (evita reinsertar acciones ya procesadas). */
    const removeJobManualActionsFromStorage = async (shouldRemove: (a: any) => boolean) => {
      const latestStr = await AsyncStorage.getItem('job_manuals_actions');
      if (!latestStr) return;
      let latest: any[];
      try {
        latest = JSON.parse(latestStr);
      } catch {
        return;
      }
      if (!Array.isArray(latest)) return;
      const next = latest.filter((a) => !shouldRemove(a));
      if (next.length === 0) {
        await AsyncStorage.removeItem('job_manuals_actions');
      } else {
        await AsyncStorage.setItem('job_manuals_actions', JSON.stringify(next));
      }
    };

    const actionStillQueued = async (action: any): Promise<boolean> => {
      const qStr = await AsyncStorage.getItem('job_manuals_actions');
      if (!qStr) return false;
      let q: any[];
      try {
        q = JSON.parse(qStr);
      } catch {
        return false;
      }
      if (!Array.isArray(q)) return false;
      return q.some((a: any) => {
        if (a.type !== action.type) return false;
        if (action.type === 'sign' && (action as any).manualLocalId) {
          return String((a as any).manualLocalId) === String((action as any).manualLocalId);
        }
        if (action.type === 'create' || action.type === 'delete' || action.type === 'sign') {
          return String(a.id) === String(action.id);
        }
        if (action.type === 'append_puestos') {
          return String(a.action_queue_id ?? a.id) === String(action.action_queue_id ?? action.id);
        }
        if (action.type === 'quiz_result') {
          if ((action as any).manualLocalId) {
            return (
              String((a as any).manualLocalId) === String((action as any).manualLocalId) &&
              Number(a.empleadoId) === Number(action.empleadoId)
            );
          }
          return (
            String(a.id) === String(action.id) && Number(a.empleadoId) === Number(action.empleadoId)
          );
        }
        return false;
      });
    };

    // Reprocesa la cola tras un `create` (reasigna sign/quiz/append a id de servidor)
    for (let i = 0; i < work.length; i++) {
      const action = work[i];
      try {
        const horaAccion = await getHoraAccion();
        if (!horaAccion) {
          return;
        }
        if (!(await actionStillQueued(action))) {
          continue;
        }
        if (action.type === 'create') {
          console.log('Creando manual de trabajo:', action.id);
          const requestData = await hydrateJobManualCreateRequestData(action.requestData);
          const result = await createJobManual({
            requestData,
            marcaId: action.marcaId,
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            console.log('Manual de trabajo creado correctamente');
            const createId = String(action.id);
            const serverId = Number(result.id ?? result.manualIds?.[0] ?? 0) || 0;
            await applyJobManualCreateSuccess({
              createId,
              serverId,
              requestData: action.requestData,
              result,
            });
            const freshStr = await AsyncStorage.getItem('job_manuals_actions');
            work = freshStr ? JSON.parse(freshStr) : [];
            i = -1;
          }
        } else if (action.type === 'delete') {
          console.log('Eliminando manual de trabajo:', action.id);
          const result = await deleteJobManual({
            id: action.id,
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            const delId = String(action.id);
            await removeJobManualActionsFromStorage(
              (a: any) => a.type === 'delete' && String(a.id) === delId
            );

            // Sacar de cache si existiera
            const cacheStr = await AsyncStorage.getItem('job_manuals_cache');
            if (cacheStr) {
              const cache = JSON.parse(cacheStr);
              const updatedCache = cache.filter((item: any) => String(item.id) !== delId);
              await AsyncStorage.setItem('job_manuals_cache', JSON.stringify(updatedCache));
            }
          }
        } else if (action.type === 'sign') {
          const signManualId = Number(action.id);
          if (!Number.isFinite(signManualId) || signManualId <= 0) {
            if ((action as any).manualLocalId) {
              console.log('Firmar manual: pendiente reasignación de id de servidor, se reintentará luego');
            } else {
              console.warn('Firmar manual: acción con id inválido, se omite');
            }
            continue;
          }
          console.log('Firmando manual de trabajo:', action.id);
          const filesHydrated = await hydrateJobManualSignFiles(action.files ?? null);
          const result = await signJobManual({
            id: signManualId,
            firma: action.firma,
            quizAnswear: action.quizAnswear ?? null,
            files: filesHydrated,
            refreshAccessToken,
            logout,
            marcaId: action.marcaId,
          });

          if (result.status) {
            const signId = String(action.id);
            const visId =
              Number((result as any).visualizacion_id ?? (result as any).id ?? 0) || Date.now();
            await deleteJobManualLocalFileRefsFromJson(action.files);
            await removeJobManualActionsFromStorage(
              (a: any) => a.type === 'sign' && String(a.id) === signId
            );

            // Actualizar cache: marcar como firmado y agregar visualización
            const cacheStr = await AsyncStorage.getItem('job_manuals_cache');
            if (cacheStr) {
              const cache = JSON.parse(cacheStr);
              const updatedCache = cache.map((item: any) => {
                if (String(item.id) === signId) {
                  const visualizaciones = item.visualizaciones || [];
                  let filesForVis: any[] = [];
                  try {
                    const parsed = typeof action.files === 'string' ? JSON.parse(action.files) : [];
                    if (Array.isArray(parsed)) {
                      filesForVis = parsed.map((f: any) => ({
                        id: Date.now() + Math.random(),
                        id_local: `vis_file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                        type: f.type,
                        extension: f.extension,
                        name: f.original_name || `archivo.${f.extension || 'dat'}`,
                        original_name: f.original_name,
                        base64: f.file_base64,
                        localFileName: f.localFileName,
                        mimeType: f.mimeType,
                        url: '',
                      }));
                    }
                  } catch {
                    filesForVis = [];
                  }

                  const newVis = {
                    id: visId,
                    empleado_id: employee?.id || 0,
                    manual_puesto_id: action.id,
                    nombre_empleado: employee?.name || 'Empleado',
                    firma_empleado: action.firma,
                    quiz_answear: action.quizAnswear ?? null,
                    approved: null,
                    created_at: new Date(horaAccion).toISOString(),
                    updated_at: new Date(horaAccion).toISOString(),
                    files: filesForVis,
                  };
                  return {
                    ...item,
                    currentEmployeeSigned: true,
                    visualizaciones: [...visualizaciones, newVis],
                  };
                }
                return item;
              });
              await AsyncStorage.setItem('job_manuals_cache', JSON.stringify(updatedCache));
            }
          }
        } else if (action.type === 'append_puestos') {
          console.log('Vinculando puestos adicionales al manual:', action.manualId);
          const result = await appendJobManualPuestos({
            manualId: Number(action.manualId),
            marcaId: Number(action.marcaId),
            puestosIds: Array.isArray(action.puestos_ids) ? action.puestos_ids.map((n: any) => Number(n)) : [],
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            const puestosIds = Array.isArray(action.puestos_ids)
              ? action.puestos_ids.map((n: any) => Number(n))
              : [];
            if (puestosIds.length > 0) {
              await patchJobManualPuestosVinculadosInCache(
                {
                  manualServerId: Number(action.manualId),
                  replaceAll: false,
                },
                puestosIds
              );
            }
            const actionQueueId = String(action.action_queue_id ?? action.id);
            await removeJobManualActionsFromStorage(
              (a: any) =>
                a.type === 'append_puestos' &&
                String(a.action_queue_id ?? a.id) === actionQueueId
            );
          }
        } else if (action.type === 'quiz_result') {
          const qMid = Number(action.id);
          if (!Number.isFinite(qMid) || qMid <= 0) {
            if ((action as any).manualLocalId) {
              console.log('Quiz manual: pendiente reasignación de id, se reintenta luego');
            } else {
              console.warn('Quiz manual: acción con id de manual inválido, se omite');
            }
            continue;
          }
          console.log('Actualizando resultado de quiz (manual):', action.id, action.empleadoId, action.approved);
          const result = await putJobManualQuizResult({
            id: qMid,
            marcaId: action.marcaId,
            empleadoId: action.empleadoId,
            approved: action.approved,
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            const qId = String(action.id);
            const qEmp = Number(action.empleadoId);
            await removeJobManualActionsFromStorage(
              (a: any) =>
                a.type === 'quiz_result' &&
                String(a.id) === qId &&
                Number(a.empleadoId) === qEmp
            );

            // Actualizar cache (si aún no estaba reflejado por UI)
            const cacheStr = await AsyncStorage.getItem('job_manuals_cache');
            if (cacheStr) {
              const cache = JSON.parse(cacheStr);
              const updatedCache = cache.map((item: any) => {
                if (String(item.id) === qId) {
                  const visualizaciones = (item.visualizaciones || []).map((v: any) => {
                    if (Number(v.empleado_id) === qEmp) {
                      return {
                        ...v,
                        approved: action.approved,
                        approved_pending: false,
                        updated_at: new Date(horaAccion).toISOString(),
                      };
                    }
                    return v;
                  });
                  return { ...item, visualizaciones };
                }
                return item;
              });
              await AsyncStorage.setItem('job_manuals_cache', JSON.stringify(updatedCache));
            }
          }
        }
      } catch (error) {
        console.error('Error procesando acción de manual de trabajo:', error);
      }
    }
  }

  const checkVisitorsActionsCache = async () => {
    if (!employee) return;

    const actionsStr = await AsyncStorage.getItem('visitors_actions');
    if (!actionsStr) return;

    const raw = JSON.parse(actionsStr);
    if (!Array.isArray(raw) || raw.length === 0) return;

    const seenDeleteVisitor = new Set<number>();
    let actions = raw.filter((a: any) => {
      if (a?.type === 'delete' && a.id != null) {
        const vid = Number(a.id);
        if (!Number.isFinite(vid)) return true;
        if (seenDeleteVisitor.has(vid)) return false;
        seenDeleteVisitor.add(vid);
      }
      return true;
    });

    if (actions.length !== raw.length) {
      if (actions.length === 0) {
        await AsyncStorage.removeItem('visitors_actions');
        return;
      }
      await AsyncStorage.setItem('visitors_actions', JSON.stringify(actions));
    }

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
            const r = result as { data?: { id?: number } };
            const serverId = r.data?.id;
            if (serverId != null && action.id != null) {
              const corpo = Number((action as any).requestData?.corpo_id);
              if (Number.isFinite(corpo) && corpo > 0) {
                try {
                  await replaceLocalVisitorIdInCache(String(action.id), Number(serverId), corpo);
                } catch (e) {
                  console.error('replaceLocalVisitorIdInCache', e);
                }
              }
            }
            const m = Number(
              (action as any).marcaId != null
                ? (action as any).marcaId
                : (action as any).requestData?.marca_id
            );
            const c = Number((action as any).requestData?.corpo_id);
            if (Number.isFinite(m) && m > 0 && Number.isFinite(c) && c > 0) {
              try {
                await syncVisitorsCacheFromNetwork({ marcaId: m, corpoId: c, refreshAccessToken, logout });
              } catch (e) {
                console.warn('syncVisitorsCacheFromNetwork after visitor create', e);
              }
            }
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
            const m = Number((action as any).requestData?.marca_id);
            const c = Number(
              (action as any).requestData?.sucursal_sync_corpo_id ?? (action as any).requestData?.corpo_id
            );
            if (Number.isFinite(m) && m > 0 && Number.isFinite(c) && c > 0) {
              try {
                await syncVisitorsCacheFromNetwork({ marcaId: m, corpoId: c, refreshAccessToken, logout });
              } catch (e) {
                console.warn('syncVisitorsCacheFromNetwork after visitor update', e);
              }
            }
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
            const vid = Number(action.id);
            const updatedActions = actions.filter(
              (a: any) =>
                !(
                  (a.type === 'delete' && Number(a.id) === vid) ||
                  (a.type === 'update' && Number(a.id) === vid)
                )
            );
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

    const raw = JSON.parse(actionsStr);
    if (!Array.isArray(raw) || raw.length === 0) return;

    const seenDeleteVehicle = new Set<number>();
    const seenDeleteVehicleAttachment = new Set<number>();
    let actions = raw.filter((a: any) => {
      if (a?.type === 'delete' && a.id != null) {
        const vid = Number(a.id);
        if (!Number.isFinite(vid)) return true;
        if (seenDeleteVehicle.has(vid)) return false;
        seenDeleteVehicle.add(vid);
      }
      if (a?.type === 'delete_vehicle_attachment' && a.id != null) {
        const vid = Number(a.id);
        if (!Number.isFinite(vid)) return true;
        if (seenDeleteVehicleAttachment.has(vid)) return false;
        seenDeleteVehicleAttachment.add(vid);
      }
      return true;
    });

    if (actions.length !== raw.length) {
      if (actions.length === 0) {
        await AsyncStorage.removeItem('vehicles_actions');
        return;
      }
      await AsyncStorage.setItem('vehicles_actions', JSON.stringify(actions));
    }

    console.log('Sincronizando acciones de vehículos:', actions.length);

    // Procesar acciones una por una
    for (const action of actions) {
      try {
        if (action.type === 'create') {
          console.log('Creando vehículo:', action.id);
          let requestData = { ...(action.requestData || {}) };
          if (action.attachmentLocalFileName) {
            try {
              const g = await getFile(String(action.attachmentLocalFileName));
              requestData.file = g.base64;
            } catch (e) {
              console.warn('Sincronización vehículo (create): no se pudo leer adjunto local', e);
            }
          }
          const result = await createVehicle({
            requestData,
            marcaId: action.marcaId,
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            console.log('Vehículo creado correctamente');
            const sid = Number((result as { id?: number }).id);
            if (Number.isFinite(sid) && sid > 0 && action.id != null) {
              await patchVehicleVisitasLocalCreateWithServerId(String(action.id), sid);
            }
            if (action.attachmentLocalFileName) {
              try {
                await deleteFile(String(action.attachmentLocalFileName));
              } catch {
                /* idempotente */
              }
            }
            const updatedActions = actions.filter(
              (a: any) => !(a.type === 'create' && String(a.id) === String(action.id))
            );
            await AsyncStorage.setItem('vehicles_actions', JSON.stringify(updatedActions));
          }
        } else if (action.type === 'update') {
          console.log('Actualizando vehículo:', action.id);
          let requestData = { ...(action.requestData || {}) };
          if (action.attachmentLocalFileName) {
            try {
              const g = await getFile(String(action.attachmentLocalFileName));
              requestData.file = g.base64;
            } catch (e) {
              console.warn('Sincronización vehículo (update): no se pudo leer adjunto local', e);
            }
          }
          const result = await updateVehicle({
            requestData,
            vehicleId: action.id,
            marcaId: action.requestData.marca_id,
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            console.log('Vehículo actualizado correctamente');
            if (action.attachmentLocalFileName) {
              try {
                await deleteFile(String(action.attachmentLocalFileName));
              } catch {
                /* idempotente */
              }
            }
            const updatedActions = actions.filter(
              (a: any) => !(a.type === 'update' && Number(a.id) === Number(action.id))
            );
            await AsyncStorage.setItem('vehicles_actions', JSON.stringify(updatedActions));
          }
        } else if (action.type === 'delete_vehicle_attachment') {
          console.log('Eliminando adjunto de vehículo:', action.id);
          const result = await deleteVehicleAttachment({
            vehicleId: Number(action.id),
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            const vid = Number(action.id);
            await stripVehicleVisitasAttachmentForRow(vid, '');
            const updatedActions = actions.filter(
              (a: any) => !(a.type === 'delete_vehicle_attachment' && Number(a.id) === vid)
            );
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
            const vid = Number(action.id);
            const updatedActions = actions.filter(
              (a: any) =>
                !(
                  (a.type === 'delete' && Number(a.id) === vid) ||
                  (a.type === 'update' && Number(a.id) === vid) ||
                  (a.type === 'delete_vehicle_attachment' && Number(a.id) === vid)
                )
            );
            await AsyncStorage.setItem('vehicles_actions', JSON.stringify(updatedActions));
          }
        }
      } catch (error) {
        console.error('Error procesando acción de vehículo:', error);
      }
    }
  }

  const sortLlavesLikeActions = (list: any[]) => {
    const rank = (t: string) => (t === 'create' ? 0 : t === 'update' ? 1 : 2);
    return [...list].sort((a, b) => rank(String(a.type)) - rank(String(b.type)));
  };

  const patchMovimientosLlavesAfterLlaveServerId = async (llaveLocalKey: string, serverLlaveId: number) => {
    const raw = await AsyncStorage.getItem('movimientos_llaves_actions');
    if (!raw) return;
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return;
    const next = list.map((a: any) => {
      const loc = a.llaveLocalId || a.llave_id_local;
      if (
        a.type === 'create' &&
        loc &&
        String(loc) === String(llaveLocalKey)
      ) {
        return {
          ...a,
          llaveId: serverLlaveId,
          llaveLocalId: undefined,
          llave_id_local: undefined,
        };
      }
      return a;
    });
    await AsyncStorage.setItem('movimientos_llaves_actions', JSON.stringify(next));
  };

  const patchMovimientosLlaverosAfterLlaveroServerId = async (llaveroLocalKey: string, serverLlaveroId: number) => {
    const raw = await AsyncStorage.getItem('movimientos_llaveros_actions');
    if (!raw) return;
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return;
    const next = list.map((a: any) => {
      const loc = a.llaveroLocalId || a.llavero_id_local;
      if (a.type === 'create' && loc && String(loc) === String(llaveroLocalKey)) {
        return {
          ...a,
          llaveroId: serverLlaveroId,
          llaveroLocalId: undefined,
          llavero_id_local: undefined,
        };
      }
      return a;
    });
    await AsyncStorage.setItem('movimientos_llaveros_actions', JSON.stringify(next));
  };

  const normalizeLlaveroRequestForApi = (rd: any) => {
    if (!rd || typeof rd !== 'object') return rd;
    const out = { ...rd };
    let nums: number[] = [];
    if (Array.isArray(out.llaves_refs) && out.llaves_refs.length > 0) {
      nums = out.llaves_refs
        .map((r: any) => Number(r.llave_id))
        .filter((n: number) => Number.isFinite(n) && n > 0);
    } else if (Array.isArray(out.llaves)) {
      nums = out.llaves
        .map((x: any) => {
          if (typeof x === 'number') return x;
          if (x && typeof x === 'object' && x.llave_id != null) return Number(x.llave_id);
          return 0;
        })
        .filter((n: number) => Number.isFinite(n) && n > 0);
    }
    const seen = new Set<number>();
    const dedup: number[] = [];
    for (const n of nums) {
      if (seen.has(n)) continue;
      seen.add(n);
      dedup.push(n);
    }
    delete out.llaves_refs;
    out.llaves = dedup;
    return out;
  };

  /** Resuelve llave_id_local → id servidor con llaves_cache y el árbol (además del patch al crear cada llave). */
  const enrichLlaveroRequestDataWithCachedLlaveIds = async (rd: any) => {
    if (!rd || typeof rd !== 'object') return rd;
    const out: any = { ...rd };
    let cache: any[] = [];
    try {
      const cacheStr = await AsyncStorage.getItem('llaves_cache');
      if (cacheStr) {
        const parsed = JSON.parse(cacheStr);
        if (Array.isArray(parsed)) cache = parsed;
      }
    } catch (_) {
      /* ignore */
    }
    let tree: any[] = [];
    try {
      tree = await readMainStructureTree();
    } catch (_) {
      /* ignore */
    }

    const resolveLocal = (localKey: string): number | null => {
      if (!localKey) return null;
      const f = cache.find(
        (it: any) => it?.id_local && String(it.id_local) === String(localKey) && it.id > 0
      );
      if (f) return Number(f.id);
      try {
        const hit = findCorpoAndLlaveRowInTree(tree, { id_local: String(localKey) });
        if (hit?.row?.id && Number(hit.row.id) > 0) return Number(hit.row.id);
      } catch (_) {
        /* ignore */
      }
      return null;
    };

    if (Array.isArray(out.llaves_refs) && out.llaves_refs.length > 0) {
      out.llaves_refs = out.llaves_refs.map((r: any) => {
        if (!r || typeof r !== 'object') return r;
        const n = r.llave_id != null ? Number(r.llave_id) : 0;
        if (Number.isFinite(n) && n > 0) return { llave_id: n };
        const loc = r.llave_id_local != null && String(r.llave_id_local).trim() !== '' ? String(r.llave_id_local) : '';
        if (loc) {
          const rid = resolveLocal(loc);
          if (rid) return { llave_id: rid };
        }
        return r;
      });
      out.llaves = out.llaves_refs
        .map((r: any) => Number(r.llave_id))
        .filter((n: number) => Number.isFinite(n) && n > 0);
    } else if (Array.isArray(out.llaves) && out.llaves.length > 0) {
      out.llaves = out.llaves.map((x: any) => {
        if (typeof x === 'number') {
          if (x > 0) return x;
          return x;
        }
        if (x && typeof x === 'object') {
          const n = x.llave_id != null ? Number(x.llave_id) : 0;
          if (Number.isFinite(n) && n > 0) return x;
          const loc = x.llave_id_local != null && String(x.llave_id_local).trim() !== '' ? String(x.llave_id_local) : '';
          if (loc) {
            const rid = resolveLocal(loc);
            if (rid) return { ...x, llave_id: rid, llave_id_local: undefined };
          }
        }
        return x;
      });
    }
    return out;
  };

  const llaveroRequestHasUnresolvedLocalRefs = (enriched: any) => {
    const refs = Array.isArray(enriched?.llaves_refs) ? enriched.llaves_refs : [];
    return refs.some(
      (r: any) =>
        r &&
        r.llave_id_local != null &&
        String(r.llave_id_local).trim() !== '' &&
        (!Number.isFinite(Number(r.llave_id)) || Number(r.llave_id) <= 0)
    );
  };

  const patchLlaverosAfterLlaveServerId = async (llaveLocalKey: string, serverLlaveId: number) => {
    const patchRefs = (payload: any) => {
      if (!payload || typeof payload !== 'object') return payload;
      const next = { ...payload };
      if (Array.isArray(next.llaves_refs)) {
        next.llaves_refs = next.llaves_refs.map((r: any) => {
          if (String(r?.llave_id_local || '') === String(llaveLocalKey)) {
            return { llave_id: serverLlaveId };
          }
          return r;
        });
        next.llaves = next.llaves_refs
          .map((r: any) => Number(r.llave_id))
          .filter((n: number) => Number.isFinite(n) && n > 0);
      } else if (Array.isArray(next.llaves)) {
        next.llaves = next.llaves.map((x: any) => {
          if (x && typeof x === 'object') {
            if (String(x.llave_id_local || '') === String(llaveLocalKey)) {
              const { llave_id_local: _loc, ...rest } = x;
              return { ...rest, llave_id: serverLlaveId };
            }
            return x;
          }
          if (typeof x === 'number' && x === 0) {
            return serverLlaveId;
          }
          return x;
        });
      }
      return next;
    };

    const actStr = await AsyncStorage.getItem('llaveros_actions');
    if (actStr) {
      const actList = JSON.parse(actStr);
      if (Array.isArray(actList)) {
        const nextAct = actList.map((a: any) => {
          if (!a?.requestData) return a;
          const rd = a.requestData;
          const refs: any[] = Array.isArray(rd.llaves_refs) ? rd.llaves_refs : [];
          const touchedRefs = refs.some((r: any) => String(r?.llave_id_local || '') === String(llaveLocalKey));
          const llavesArr: any[] = Array.isArray(rd.llaves) ? rd.llaves : [];
          const touchedObjs = llavesArr.some(
            (x: any) => x && typeof x === 'object' && String(x.llave_id_local || '') === String(llaveLocalKey)
          );
          if (!touchedRefs && !touchedObjs) return a;
          return { ...a, requestData: patchRefs(a.requestData) };
        });
        await AsyncStorage.setItem('llaveros_actions', JSON.stringify(nextAct));
      }
    }

    const cacheStr = await AsyncStorage.getItem('llaveros_cache');
            if (cacheStr) {
              const cache = JSON.parse(cacheStr);
      if (Array.isArray(cache)) {
        const nextCache = cache.map((item: any) => {
          if (!Array.isArray(item.llaves)) return item;
          const nextLlaves = item.llaves.map((link: any) => {
            if (link && typeof link === 'object') {
              if (String(link.llave_id_local || '') === String(llaveLocalKey)) {
                const { llave_id_local: _l, ...rest } = link;
                return { ...rest, llave_id: serverLlaveId };
              }
              return link;
            }
            return link;
          });
          return { ...item, llaves: nextLlaves };
        });
        await AsyncStorage.setItem('llaveros_cache', JSON.stringify(nextCache));
      }
    }

    try {
      const tree = await readMainStructureTree();
      const nextTree = patchAllLlaveroLinksLlaveIdLocalEverywhere(tree, llaveLocalKey, serverLlaveId);
      await writeMainStructureTree(nextTree);
    } catch (e) {
      console.warn('[sync] main_structure patchLlaverosAfterLlaveServerId:', e);
    }
  };

  const checkLlavesActionsCache = async () => {
    if (!employee) return;

    const actionsStr = await AsyncStorage.getItem('llaves_actions');
    if (!actionsStr) return;

    const actions = sortLlavesLikeActions(JSON.parse(actionsStr));
    if (!actions || actions.length === 0) return;

    console.log('Sincronizando acciones de llaves:', actions.length);

    for (const action of actions) {
      try {
        if (action.type === 'create') {
          const result = await createLlave({
            requestData: action.requestData,
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.type === 'create'));
            await AsyncStorage.setItem('llaves_actions', JSON.stringify(updatedActions));

            const serverId = Number(result.id);
            if (Number.isFinite(serverId) && serverId > 0) {
              const localKey = String(action.id);
              await patchMovimientosLlavesAfterLlaveServerId(localKey, serverId);
              await patchLlaverosAfterLlaveServerId(localKey, serverId);

              const corpoId = Number(action.corpo_id) || Number(action.requestData?.corpo_id);
              if (Number.isFinite(corpoId) && corpoId > 0) {
                try {
                  const treeMs = await readMainStructureTree();
                  const nextMs = patchLlaveLocalKeyToServerIdInTree(treeMs, corpoId, localKey, serverId);
                  await writeMainStructureTree(nextMs);
                } catch (e) {
                  console.warn('[sync] main_structure llave create id:', e);
                }
              }

              const llavesCacheStr = await AsyncStorage.getItem('llaves_cache');
              if (llavesCacheStr) {
                const cache = JSON.parse(llavesCacheStr);
                const updatedCache = cache.map((it: any) => {
                  if (it.id_local && it.id_local === action.id) {
                    return { ...it, id: serverId, id_local: '' };
                  }
                  return it;
                });
                await AsyncStorage.setItem('llaves_cache', JSON.stringify(updatedCache));
              }
            }
          }
        } else if (action.type === 'update') {
          const result = await updateLlave({
            id: action.id,
            requestData: action.requestData,
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.type === 'update'));
            await AsyncStorage.setItem('llaves_actions', JSON.stringify(updatedActions));
            try {
              const treeMs = await readMainStructureTree();
              const nextMs = applyLlaveUpdatePayloadToTree(treeMs, Number(action.id), action.requestData || {});
              await writeMainStructureTree(nextMs);
            } catch (e) {
              console.warn('[sync] main_structure llave update:', e);
            }
          }
        } else if (action.type === 'delete') {
          const result = await deleteLlave({
            id: action.id,
            marcaId: action.marcaId,
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.type === 'delete'));
            await AsyncStorage.setItem('llaves_actions', JSON.stringify(updatedActions));

            const cacheStr = await AsyncStorage.getItem('llaves_cache');
            if (cacheStr) {
              const cache = JSON.parse(cacheStr);
              const updatedCache = cache.filter((it: any) => it.id !== action.id);
              await AsyncStorage.setItem('llaves_cache', JSON.stringify(updatedCache));
            }

            try {
              const treeMs = await readMainStructureTree();
              const hit = findCorpoAndLlaveRowInTree(treeMs, { id: Number(action.id) });
              if (hit) {
                const nextMs = removeLlaveFromCorpoTreeAndStripLlaveroLinks(treeMs, hit.corpoId, { id: Number(action.id) });
                await writeMainStructureTree(nextMs);
              }
            } catch (e) {
              console.warn('[sync] main_structure llave delete:', e);
            }
          }
        }
      } catch (error) {
        console.error('Error procesando acción de llaves:', error);
      }
    }
  }

  const checkMovimientosLlavesActionsCache = async () => {
    if (!employee) return;

    const actionsStr = await AsyncStorage.getItem('movimientos_llaves_actions');
    if (!actionsStr) return;

    const actions = sortLlavesLikeActions(JSON.parse(actionsStr));
    if (!actions || actions.length === 0) return;

    console.log('Sincronizando acciones de movimientos de llaves:', actions.length);

    const movLlaveActionStillQueued = async (action: any) => {
      const raw = await AsyncStorage.getItem('movimientos_llaves_actions');
      const list = raw ? sortLlavesLikeActions(JSON.parse(raw)) : [];
      return list.some((a: any) => String(a.id) === String(action.id) && a.type === action.type);
    };

    for (const action of actions) {
      try {
        if (!(await movLlaveActionStillQueued(action))) continue;

        // Resolver llaveId real si viene de una llave creada offline (llaveLocalId)
        let llaveId: number = Number(action.llaveId) || 0;
        if ((!llaveId || llaveId === 0) && action.llaveLocalId) {
          const cacheStr = await AsyncStorage.getItem('llaves_cache');
          if (cacheStr) {
            const cache = JSON.parse(cacheStr);
            const found = cache.find(
              (it: any) => it.id_local && String(it.id_local) === String(action.llaveLocalId)
            );
            if (found?.id && found.id !== 0) llaveId = found.id;
          }
        }
        if ((!llaveId || llaveId === 0) && action.llaveLocalId) {
          try {
            const tree = await readMainStructureTree();
            const hit = findCorpoAndLlaveRowInTree(tree, { id_local: String(action.llaveLocalId) });
            if (hit?.row?.id && Number(hit.row.id) > 0) llaveId = Number(hit.row.id);
          } catch (_) {}
        }

        // Si aún no hay llaveId real, posponer
        if (!llaveId || llaveId === 0) continue;

        if (action.type === 'create') {
          const result = await createMovimientoLlave({
            llaveId,
            requestData: action.requestData,
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            const rawQ = await AsyncStorage.getItem('movimientos_llaves_actions');
            const cur = sortLlavesLikeActions(JSON.parse(rawQ || '[]'));
            const updatedActions = cur.filter(
              (a: any) => !(String(a.id) === String(action.id) && a.type === 'create')
            );
            await AsyncStorage.setItem('movimientos_llaves_actions', JSON.stringify(updatedActions));

            // Reemplazar id_local por id real en cache (dentro de movimientos de la llave)
            const newId = Number(result.id);
            if (Number.isFinite(newId) && newId > 0) {
              const cacheStr = await AsyncStorage.getItem('llaves_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr);
                const updatedCache = cache.map((it: any) => {
                  if (it.id !== llaveId) return it;
                  const movs = Array.isArray(it.movimientos) ? it.movimientos : [];
                  const nextMovs = movs.map((m: any) => {
                    if (m.id_local && String(m.id_local) === String(action.id)) {
                      return { ...m, id: newId, id_local: '' };
                    }
                    return m;
                  });
                  return { ...it, movimientos: nextMovs };
                });
                await AsyncStorage.setItem('llaves_cache', JSON.stringify(updatedCache));
              }
              try {
                const treeMs = await readMainStructureTree();
                const nextMs = patchMovimientoLlaveInTree(treeMs, llaveId, String(action.id), newId);
                await writeMainStructureTree(nextMs);
              } catch (e) {
                console.warn('[sync] main_structure mov llave create:', e);
              }
            }
          } else if (result.message) {
            console.warn('[sync] movimiento llave create:', result.message);
          }
        } else if (action.type === 'update') {
          const result = await updateMovimientoLlave({
            llaveId,
            id: action.id,
            requestData: action.requestData,
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            const rawQ = await AsyncStorage.getItem('movimientos_llaves_actions');
            const cur = sortLlavesLikeActions(JSON.parse(rawQ || '[]'));
            const updatedActions = cur.filter(
              (a: any) => !(String(a.id) === String(action.id) && a.type === 'update')
            );
            await AsyncStorage.setItem('movimientos_llaves_actions', JSON.stringify(updatedActions));
          }
        } else if (action.type === 'delete') {
          const result = await deleteMovimientoLlave({
            llaveId,
            id: action.id,
            marcaId: action.marcaId,
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            const rawQ = await AsyncStorage.getItem('movimientos_llaves_actions');
            const cur = sortLlavesLikeActions(JSON.parse(rawQ || '[]'));
            const updatedActions = cur.filter(
              (a: any) => !(String(a.id) === String(action.id) && a.type === 'delete')
            );
            await AsyncStorage.setItem('movimientos_llaves_actions', JSON.stringify(updatedActions));

            const cacheStr = await AsyncStorage.getItem('llaves_cache');
            if (cacheStr) {
              const cache = JSON.parse(cacheStr);
              const updatedCache = cache.map((it: any) => {
                if (it.id !== llaveId) return it;
                const movs = Array.isArray(it.movimientos) ? it.movimientos : [];
                const nextMovs = movs.filter((m: any) => m.id !== action.id);
                return { ...it, movimientos: nextMovs };
              });
              await AsyncStorage.setItem('llaves_cache', JSON.stringify(updatedCache));
            }
          }
        }
      } catch (error) {
        console.error('Error procesando acción de movimientos de llaves:', error);
      }
    }
  }

  const checkLlaverosActionsCache = async () => {
    if (!employee) return;

    const countStr0 = await AsyncStorage.getItem('llaveros_actions');
    const n0 = countStr0 ? sortLlavesLikeActions(JSON.parse(countStr0)).length : 0;
    if (n0 > 0) {
      console.log('Sincronizando acciones de llaveros:', n0);
    }

    let rotateStreak = 0;
    for (let iter = 0; iter < 300; iter++) {
      const actionsStr = await AsyncStorage.getItem('llaveros_actions');
      if (!actionsStr) return;
      const list = sortLlavesLikeActions(JSON.parse(actionsStr));
      if (!list.length) return;
      const action = list[0];
      const qLen = list.length;

      try {
        if (action.type === 'create') {
          const enriched = await enrichLlaveroRequestDataWithCachedLlaveIds({ ...(action.requestData || {}) });
          if (llaveroRequestHasUnresolvedLocalRefs(enriched)) {
            if (qLen === 1) {
              return;
            }
            const tail = list.slice(1);
            if (!tail.length) return;
            await AsyncStorage.setItem('llaveros_actions', JSON.stringify([...tail, list[0]]));
            rotateStreak += 1;
            if (rotateStreak >= qLen) {
              return;
            }
            continue;
          }
          rotateStreak = 0;
          const result = await createLlavero({
            requestData: normalizeLlaveroRequestForApi(enriched),
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            const cur = sortLlavesLikeActions(JSON.parse((await AsyncStorage.getItem('llaveros_actions')) || '[]'));
            const updatedActions = cur.filter(
              (a: any) => !(String(a.id) === String(action.id) && a.type === 'create')
            );
            await AsyncStorage.setItem('llaveros_actions', JSON.stringify(updatedActions));

            const serverId = Number(result.id);
            if (Number.isFinite(serverId) && serverId > 0) {
              const localKey = String(action.id);
              await patchMovimientosLlaverosAfterLlaveroServerId(localKey, serverId);

              const corpoId = Number(action.corpo_id) || Number(action.requestData?.corpo_id);
              if (Number.isFinite(corpoId) && corpoId > 0) {
                try {
                  const treeMs = await readMainStructureTree();
                  const nextMs = patchLlaveroLocalKeyToServerIdInTree(treeMs, corpoId, localKey, serverId);
                  await writeMainStructureTree(nextMs);
                } catch (e) {
                  console.warn('[sync] main_structure llavero create id:', e);
                }
              }

              const cacheStr = await AsyncStorage.getItem('llaveros_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr);
                const updatedCache = cache.map((it: any) => {
                  if (it.id_local && String(it.id_local) === String(action.id)) {
                    const nextLlaves = Array.isArray(it.llaves)
                      ? it.llaves.map((l: any) =>
                          l && typeof l === 'object' && (!l.llavero_id || l.llavero_id === 0)
                            ? { ...l, llavero_id: serverId }
                            : l
                        )
                      : it.llaves;
                    return { ...it, id: serverId, id_local: '', llaves: nextLlaves };
                  }
                  return it;
                });
                await AsyncStorage.setItem('llaveros_cache', JSON.stringify(updatedCache));
              }
            }
          } else {
            return;
          }
        } else if (action.type === 'update') {
          rotateStreak = 0;
          const rd0 = action.requestData || {};
          const enriched = await enrichLlaveroRequestDataWithCachedLlaveIds({ ...rd0 });
          const result = await updateLlavero({
            id: action.id,
            requestData: normalizeLlaveroRequestForApi(enriched),
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            const cur = sortLlavesLikeActions(JSON.parse((await AsyncStorage.getItem('llaveros_actions')) || '[]'));
            const updatedActions = cur.filter(
              (a: any) => !(String(a.id) === String(action.id) && a.type === 'update')
            );
            await AsyncStorage.setItem('llaveros_actions', JSON.stringify(updatedActions));
            try {
              const rd = normalizeLlaveroRequestForApi({ ...enriched });
              const nums = Array.isArray(rd.llaves) ? rd.llaves : null;
              const treeMs = await readMainStructureTree();
              const nextMs = applyLlaveroUpdatePayloadToTree(treeMs, Number(action.id), { ...rd0, ...rd }, nums);
              await writeMainStructureTree(nextMs);
            } catch (e) {
              console.warn('[sync] main_structure llavero update:', e);
            }
          } else {
            return;
          }
        } else if (action.type === 'delete') {
          rotateStreak = 0;
          const result = await deleteLlavero({
            id: action.id,
            marcaId: action.marcaId,
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            const cur = sortLlavesLikeActions(JSON.parse((await AsyncStorage.getItem('llaveros_actions')) || '[]'));
            const updatedActions = cur.filter(
              (a: any) => !(String(a.id) === String(action.id) && a.type === 'delete')
            );
            await AsyncStorage.setItem('llaveros_actions', JSON.stringify(updatedActions));

            const cacheStr = await AsyncStorage.getItem('llaveros_cache');
            if (cacheStr) {
              const cache = JSON.parse(cacheStr);
              const updatedCache = cache.filter((it: any) => it.id !== action.id);
              await AsyncStorage.setItem('llaveros_cache', JSON.stringify(updatedCache));
            }

            try {
              const treeMs = await readMainStructureTree();
              const hit = findCorpoAndLlaveroRowInTree(treeMs, { id: Number(action.id) });
              if (hit) {
                const nextMs = removeLlaveroFromCorpoTree(treeMs, hit.corpoId, { id: Number(action.id) });
                await writeMainStructureTree(nextMs);
              }
            } catch (e) {
              console.warn('[sync] main_structure llavero delete:', e);
            }
          } else {
            return;
          }
        }
      } catch (error) {
        console.error('Error procesando acción de llaveros:', error);
        return;
      }
    }
  }

  const checkMovimientosLlaverosActionsCache = async () => {
    if (!employee) return;

    const actionsStr = await AsyncStorage.getItem('movimientos_llaveros_actions');
    if (!actionsStr) return;

    const actions = sortLlavesLikeActions(JSON.parse(actionsStr));
    if (!actions || actions.length === 0) return;

    console.log('Sincronizando acciones de movimientos de llaveros:', actions.length);

    const movLlaveroActionStillQueued = async (action: any) => {
      const raw = await AsyncStorage.getItem('movimientos_llaveros_actions');
      const list = raw ? sortLlavesLikeActions(JSON.parse(raw)) : [];
      return list.some((a: any) => String(a.id) === String(action.id) && a.type === action.type);
    };

    for (const action of actions) {
      try {
        if (!(await movLlaveroActionStillQueued(action))) continue;

        // Resolver llaveroId real si viene de un llavero creado offline (llaveroLocalId)
        let llaveroId: number = Number(action.llaveroId) || 0;
        if ((!llaveroId || llaveroId === 0) && action.llaveroLocalId) {
          const cacheStr = await AsyncStorage.getItem('llaveros_cache');
          if (cacheStr) {
            const cache = JSON.parse(cacheStr);
            const found = cache.find(
              (it: any) => it.id_local && String(it.id_local) === String(action.llaveroLocalId)
            );
            if (found?.id && found.id !== 0) llaveroId = found.id;
          }
        }
        if ((!llaveroId || llaveroId === 0) && action.llaveroLocalId) {
          try {
            const tree = await readMainStructureTree();
            const hit = findCorpoAndLlaveroRowInTree(tree, { id_local: String(action.llaveroLocalId) });
            if (hit?.row?.id && Number(hit.row.id) > 0) llaveroId = Number(hit.row.id);
          } catch (_) {}
        }

        // Si aún no hay llaveroId real, posponer
        if (!llaveroId || llaveroId === 0) continue;

        if (action.type === 'create') {
          const result = await createMovimientoLlavero({
            llaveroId,
            requestData: action.requestData,
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            const rawQ = await AsyncStorage.getItem('movimientos_llaveros_actions');
            const cur = sortLlavesLikeActions(JSON.parse(rawQ || '[]'));
            const updatedActions = cur.filter(
              (a: any) => !(String(a.id) === String(action.id) && a.type === 'create')
            );
            await AsyncStorage.setItem('movimientos_llaveros_actions', JSON.stringify(updatedActions));

            // Reemplazar id_local por id real en cache (dentro de movimientos del llavero)
            const newMovId = Number(result.id);
            if (Number.isFinite(newMovId) && newMovId > 0) {
              const cacheStr = await AsyncStorage.getItem('llaveros_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr);
                const updatedCache = cache.map((it: any) => {
                  if (it.id !== llaveroId) return it;
                  const movs = Array.isArray(it.movimientos) ? it.movimientos : [];
                  const nextMovs = movs.map((m: any) => {
                    if (m.id_local && String(m.id_local) === String(action.id)) {
                      return { ...m, id: newMovId, id_local: '' };
                    }
                    return m;
                  });
                  return { ...it, movimientos: nextMovs };
                });
                await AsyncStorage.setItem('llaveros_cache', JSON.stringify(updatedCache));
              }
            }

            const rd = action.requestData || {};
            const extras = Array.isArray(result.llave_movements) ? result.llave_movements : [];
            const llavesCacheStr = await AsyncStorage.getItem('llaves_cache');
            if (llavesCacheStr) {
              const actionLocalKey = String(action.id);
              let llavesCache = JSON.parse(llavesCacheStr) as any[];
              llavesCache = llavesCache.map((it: any) => {
                const movs = Array.isArray(it.movimientos) ? [...it.movimientos] : [];
                const stripped = movs.filter(
                  (m: any) => !(m.id_local && String(m.id_local) === actionLocalKey)
                );
                return { ...it, movimientos: stripped };
              });
              if (extras.length > 0) {
                llavesCache = llavesCache.map((it: any) => {
                  const row = extras.find((e: any) => Number(e.llave_id) === Number(it.id));
                  if (!row || !row.id) return it;
                  const movs = Array.isArray(it.movimientos) ? [...it.movimientos] : [];
                  const newMov = {
                    id: row.id,
                    llave_id: row.llave_id,
                    id_local: '',
                    nombre_persona_recibe: rd.nombre_persona_recibe,
                    nombre_persona_entrega: rd.nombre_persona_entrega,
                    departamento: rd.departamento,
                    telefono: rd.telefono,
                    fecha: rd.fecha,
                    hora: rd.hora,
                    firma_entrega: rd.firma_entrega ?? null,
                    firma_recibe: rd.firma_recibe ?? null,
                    firma_responsable: rd.firma_responsable,
                  };
                  const withoutDup = movs.filter((m: any) => Number(m.id) !== Number(newMov.id));
                  return { ...it, movimientos: [newMov, ...withoutDup] };
                });
              }
              await AsyncStorage.setItem('llaves_cache', JSON.stringify(llavesCache));
            }

            try {
              const actionLocalKey = String(action.id);
              const rdMs = action.requestData || {};
              const extrasMs = Array.isArray(result.llave_movements) ? result.llave_movements : [];
              let treeMs = await readMainStructureTree();
              if (Number.isFinite(newMovId) && newMovId > 0) {
                treeMs = patchMovimientoLlaveroInTree(treeMs, llaveroId, actionLocalKey, newMovId);
              }
              if (extrasMs.length > 0) {
                for (const e of extrasMs) {
                  treeMs = patchShadowMovimientoLlaveFromLlaveroSync(
                    treeMs,
                    Number(e.llave_id),
                    actionLocalKey,
                    rdMs,
                    Number(e.id)
                  );
                }
              } else {
                treeMs = stripLlaveMovimientosByIdLocal(treeMs, actionLocalKey);
              }
              await writeMainStructureTree(treeMs);
            } catch (e) {
              console.warn('[sync] main_structure mov llavero create:', e);
            }
          } else if (result.message) {
            console.warn('[sync] movimiento llavero create:', result.message);
          }
        } else if (action.type === 'update') {
          const result = await updateMovimientoLlavero({
            llaveroId,
            id: action.id,
            requestData: action.requestData,
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            const rawQ = await AsyncStorage.getItem('movimientos_llaveros_actions');
            const cur = sortLlavesLikeActions(JSON.parse(rawQ || '[]'));
            const updatedActions = cur.filter(
              (a: any) => !(String(a.id) === String(action.id) && a.type === 'update')
            );
            await AsyncStorage.setItem('movimientos_llaveros_actions', JSON.stringify(updatedActions));
          }
        } else if (action.type === 'delete') {
          const result = await deleteMovimientoLlavero({
            llaveroId,
            id: action.id,
            marcaId: action.marcaId,
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            const rawQ = await AsyncStorage.getItem('movimientos_llaveros_actions');
            const cur = sortLlavesLikeActions(JSON.parse(rawQ || '[]'));
            const updatedActions = cur.filter(
              (a: any) => !(String(a.id) === String(action.id) && a.type === 'delete')
            );
            await AsyncStorage.setItem('movimientos_llaveros_actions', JSON.stringify(updatedActions));

            const cacheStr = await AsyncStorage.getItem('llaveros_cache');
            if (cacheStr) {
              const cache = JSON.parse(cacheStr);
              const updatedCache = cache.map((it: any) => {
                if (it.id !== llaveroId) return it;
                const movs = Array.isArray(it.movimientos) ? it.movimientos : [];
                const nextMovs = movs.filter((m: any) => m.id !== action.id);
                return { ...it, movimientos: nextMovs };
              });
              await AsyncStorage.setItem('llaveros_cache', JSON.stringify(updatedCache));
            }
          }
        }
      } catch (error) {
        console.error('Error procesando acción de movimientos de llaveros:', error);
      }
    }
  }

  const checkMovimientosActivosMantenimientoActionsCache = async () => {
    if (!employee) return;

    const actionsStr = await AsyncStorage.getItem('movimientos_activos_mantenimiento_actions');
    if (!actionsStr) return;

    const actions = JSON.parse(actionsStr);
    if (!actions || actions.length === 0) return;

    console.log('Sincronizando acciones de movimientos de activos de mantenimiento:', actions.length);

    for (const action of actions) {
      try {
        // Resolver activoId real si viene de un activo creado offline (activoLocalId)
        let activoId: number = Number(action.activoId) || 0;
        if ((!activoId || activoId === 0) && action.activoLocalId) {
          // Buscar en cache de activos del reporte
          const reporteId = action.reporteId;
          if (reporteId) {
            const cacheStr = await AsyncStorage.getItem(`activos_mantenimiento_${reporteId}_cache`);
            if (cacheStr) {
              const cache = JSON.parse(cacheStr);
              const found = cache.find((it: any) => it.id_local && it.id_local === action.activoLocalId);
              if (found?.id && found.id !== 0) activoId = found.id;
            }
          }
        }

        // Si aún no hay activoId real, posponer
        if (!activoId || activoId === 0) continue;

        if (action.type === 'create') {
          const result = await createMovimientoActivoMantenimiento({
            activoId,
            requestData: action.requestData,
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            await persistFilteredMantenimientoEquipoActionQueue('movimientos_activos_mantenimiento_actions', (a: any) =>
              !(a.id === action.id && a.type === 'create')
            );

            // Reemplazar id_local por id real en cache (dentro de movimientos del activo)
            if (result.id) {
              const cacheStr = await AsyncStorage.getItem(`movimientos_activo_${activoId}_cache`);
              if (cacheStr) {
                const cache = JSON.parse(cacheStr);
                const nextMovs = cache.map((m: any) => {
                  if (m.id_local && m.id_local === action.id) {
                    return { ...m, id: result.id, id_local: '' };
                  }
                  return m;
                });
                await AsyncStorage.setItem(`movimientos_activo_${activoId}_cache`, JSON.stringify(nextMovs));
              }
            }
          }
        } else if (action.type === 'update') {
          const result = await updateMovimientoActivoMantenimiento({
            activoId,
            id: action.id,
            requestData: action.requestData,
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            await persistFilteredMantenimientoEquipoActionQueue('movimientos_activos_mantenimiento_actions', (a: any) =>
              !(a.id === action.id && a.type === 'update')
            );
          }
        } else if (action.type === 'delete') {
          const marcaId = action.marcaId;
          if (!marcaId) continue;

          const result = await deleteMovimientoActivoMantenimiento({
            activoId,
            id: action.id,
            marcaId,
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            await persistFilteredMantenimientoEquipoActionQueue('movimientos_activos_mantenimiento_actions', (a: any) =>
              !(a.id === action.id && a.type === 'delete')
            );

            const cacheStr = await AsyncStorage.getItem(`movimientos_activo_${activoId}_cache`);
            if (cacheStr) {
              const cache = JSON.parse(cacheStr);
              const nextMovs = cache.filter((m: any) => m.id !== action.id);
              await AsyncStorage.setItem(`movimientos_activo_${activoId}_cache`, JSON.stringify(nextMovs));
            }
          }
        }
      } catch (error) {
        console.error('Error procesando acción de movimientos de activos de mantenimiento:', error);
      }
    }
  }

  const checkArticuloMantenimientoDeleteArchivoActionsCache = async () => {
    if (!employee) return;

    const key = 'articulo_mantenimiento_delete_archivo_actions';
    const actionsStr = await AsyncStorage.getItem(key);
    if (!actionsStr) return;

    const actions = JSON.parse(actionsStr);
    if (!Array.isArray(actions) || actions.length === 0) return;

    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) return;

    const still: any[] = [];
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      try {
        if (action.type !== 'delete_archivo') {
          still.push(action);
          continue;
        }
        const mid = Number(action.activoMantenimientoId);
        const aid = Number(action.archivoId);
        if (!Number.isFinite(mid) || mid <= 0 || !Number.isFinite(aid) || aid <= 0) {
          continue;
        }

        const response = await authedFetchCb({
          url: `${apiUrl}/api/articulo-mantenimiento/${mid}/archivos/${aid}`,
          init: {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
          },
        });

        if (!response) {
          still.push(...actions.slice(i));
          break;
        }

        const data = await response.json().catch(() => ({}));
        if (response.ok && data?.status) {
          const pid = action?.puestoId;
          if (pid != null && Number.isFinite(Number(pid)) && Number(pid) > 0) {
            await clearPuestoArticulosList(Number(pid));
          }
        } else {
          still.push(action);
        }
      } catch (error) {
        console.error('Error sincronizando eliminación de adjunto de mantenimiento de artículo:', error);
        still.push(action);
      }
    }

    if (still.length === 0) {
      await AsyncStorage.removeItem(key);
    } else {
      await AsyncStorage.setItem(key, JSON.stringify(still));
    }
  };

  const checkArticuloMantenimientoActionsCache = async () => {
    if (!employee) return;

    const actionsStr = await AsyncStorage.getItem('articulo_mantenimiento_actions');
    if (!actionsStr) return;

    const actions = JSON.parse(actionsStr);
    if (!actions || actions.length === 0) return;

    console.log('Sincronizando acciones de mantenimientos de artículos:', actions.length);

    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) return;

    for (const action of actions) {
      try {
        console.log('action', action);
        if (action.type !== 'update' && action.type !== 'create') continue;

        const isCreate = action.type === 'create';
        const url = isCreate
          ? `${apiUrl}/api/articulo-mantenimiento`
          : `${apiUrl}/api/articulo-mantenimiento/${action.id}`;
        const method = isCreate ? 'POST' : 'PUT';

        console.log('action.requestData', action.requestData);
        const payload: any = { ...(action.requestData ?? {}) };
        if (action.type === 'update' && action?.meta?.source && action?.meta?.estructuraId) {
          const estructuraId = Number(action.meta.estructuraId);
          if (Number.isFinite(estructuraId) && estructuraId > 0) {
            if (String(action.meta.source) === 'plan') {
              payload.articulo_plan_id = estructuraId;
            } else if (String(action.meta.source) === 'asignado') {
              payload.articulo_asignado_id = estructuraId;
            }
          }
        }
        if (!payload.hora_accion) {
          try {
            const horaAccion = await getHoraAccion();
            if (horaAccion) payload.hora_accion = new Date(horaAccion).toISOString();
          } catch {
            // ignore
          }
        }

        const response = await authedFetchCb({
          url,
          init: {
            method,
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          },
        });

        if (!response) {
          // Logout ya fue ejecutado (o tokens inválidos). Detener sincronización.
          return;
        }

        if (response.ok) {
          const data = await response.json().catch(() => ({}));
          console.log('data', data);
          if (data.status) {
            const pid = action?.meta?.puestoId;
            if (pid != null && Number.isFinite(Number(pid)) && Number(pid) > 0) {
              await clearPuestoArticulosList(Number(pid));
            }
            await persistFilteredMantenimientoEquipoActionQueue('articulo_mantenimiento_actions', (a: any) => {
              if (isCreate) {
                return !(a.type === 'create' && a.id_local === action.id_local);
              }
              return !(a.id === action.id && a.type === 'update');
            });
          } else {
            // Si el servidor rechaza por ser una acción más antigua (updated_at más reciente),
            // eliminamos la acción local para evitar reintentos infinitos.
            const msg = String(data?.message || '');
            if (msg.toLowerCase().includes('más antiguo') || msg.toLowerCase().includes('updated_at')) {
              await persistFilteredMantenimientoEquipoActionQueue('articulo_mantenimiento_actions', (a: any) => {
                if (isCreate) return !(a.type === 'create' && a.id_local === action.id_local);
                return !(a.id === action.id && a.type === 'update');
              });
            }
          }
        }
      } catch (error) {
        console.error('Error procesando acción de mantenimiento de artículo:', error);
      }
    }
  };

  const checkMovimientosArticulosMantenimientoActionsCache = async () => {
    if (!employee) return;

    const actionsStr = await AsyncStorage.getItem('movimientos_articulos_mantenimiento_actions');
    if (!actionsStr) return;

    const actions = JSON.parse(actionsStr);
    if (!actions || actions.length === 0) return;

    console.log('Sincronizando acciones de movimientos de artículos de mantenimiento:', actions.length);

    for (const action of actions) {
      try {
        const parent = action.parent;
        if (!parent?.source || !parent?.estructuraId) continue;

        if (action.type === 'create') {
          const result = await createMovimientoArticuloMantenimiento({
            parent,
            requestData: action.requestData,
            refreshAccessToken,
            logout,
          });
          if (result.status) {
            await persistFilteredMantenimientoEquipoActionQueue('movimientos_articulos_mantenimiento_actions', (a: any) =>
              !(a.id === action.id && a.type === 'create')
            );
          }
        } else if (action.type === 'update') {
          const result = await updateMovimientoArticuloMantenimiento({
            parent,
            id: action.id,
            requestData: action.requestData,
            refreshAccessToken,
            logout,
          });
          if (result.status) {
            await persistFilteredMantenimientoEquipoActionQueue('movimientos_articulos_mantenimiento_actions', (a: any) =>
              !(a.id === action.id && a.type === 'update')
            );
          }
        } else if (action.type === 'delete') {
          const marcaId = action.marcaId;
          if (!marcaId) continue;

          const result = await deleteMovimientoArticuloMantenimiento({
            parent,
            id: action.id,
            marcaId,
            refreshAccessToken,
            logout,
          });
          if (result.status) {
            await persistFilteredMantenimientoEquipoActionQueue('movimientos_articulos_mantenimiento_actions', (a: any) =>
              !(a.id === action.id && a.type === 'delete')
            );
          }
        }
      } catch (error) {
        console.error('Error procesando acción de movimientos de artículos de mantenimiento:', error);
      }
    }
  };

  const checkActivoMantenimientoActionsCache = async () => {
    if (!employee) return;

    const actionsStr = await AsyncStorage.getItem('activo_mantenimiento_actions');
    if (!actionsStr) return;

    const actions = JSON.parse(actionsStr);
    if (!actions || actions.length === 0) return;

    console.log('Sincronizando acciones de activos de mantenimiento:', actions.length);

    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) return;

    for (const action of actions) {
      try {
        if (action.type === 'update') {
          const response = await authedFetchCb({
            url: `${apiUrl}/api/activo-mantenimiento/${action.id}`,
            init: {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(action.requestData),
            },
          });

          if (!response) {
            // Logout ya fue ejecutado. Detener sincronización.
            return;
          }

          if (response.ok) {
            const data = await response.json().catch(() => ({}));
            if (data.status) {
              await persistFilteredMantenimientoEquipoActionQueue('activo_mantenimiento_actions', (a: any) =>
                !(a.id === action.id && a.type === 'update')
              );

              // Actualizar cache si existe
              const reporteId = action.reporteId;
              if (reporteId) {
                const cacheStr = await AsyncStorage.getItem(`activos_mantenimiento_${reporteId}_cache`);
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.map((a: any) =>
                    a.id === action.id ? { ...a, ...action.requestData, id_local: '' } : a
                  );
                  await AsyncStorage.setItem(`activos_mantenimiento_${reporteId}_cache`, JSON.stringify(updatedCache));
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Error procesando acción de activo de mantenimiento:', error);
      }
    }
  };

  const checkDocumentosEntregadosActionsCache = async () => {
    if (!employee) return;

    const sameQueuedDocAction = (a: any, b: any) =>
      a?.type === b?.type && String(a?.id ?? '') === String(b?.id ?? '');

    const readDocActionsQueue = async () => {
      const s = await AsyncStorage.getItem('documentos_entregados_actions');
      if (!s) return [] as any[];
      try {
        const parsed = JSON.parse(s);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    };

    let queue = await readDocActionsQueue();
    if (queue.length === 0) return;

    console.log('Sincronizando acciones de documentos entregados:', queue.length);

    while (queue.length > 0) {
      const action = queue[0];
      let success = false;
      try {
        if (action.type === 'create') {
          const result = await createDocumentoEntregado({
            requestData: action.requestData,
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            success = true;
            if (result.id) {
              const cacheStr = await AsyncStorage.getItem('documentos_entregados_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr) as any[];
                const serverId = Number(result.id);
                const corpoId = getDocEntregadoCorpoId(action.requestData);
                const pruned = cache.filter(
                  (it: any) =>
                    !(
                      String(it?.id_local ?? '') === String(action.id) &&
                      getDocEntregadoCorpoId(it) === corpoId
                    )
                );
                const row = buildDocumentoEntregadoCacheRowFromRequest(action.requestData, serverId, '');
                const next = upsertDocumentoEntregadoInCache(pruned, row);
                await AsyncStorage.setItem('documentos_entregados_cache', JSON.stringify(next));
              }
            }
          }
        } else if (action.type === 'update') {
          const updateId = Number(action.id);
          const result = await updateDocumentoEntregado({
            id: updateId,
            requestData: action.requestData,
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            success = true;
            const cacheStr = await AsyncStorage.getItem('documentos_entregados_cache');
            if (cacheStr) {
              const cache = JSON.parse(cacheStr);
              const row = buildDocumentoEntregadoCacheRowFromRequest(action.requestData, updateId, '');
              const next = upsertDocumentoEntregadoInCache(cache, row);
              await AsyncStorage.setItem('documentos_entregados_cache', JSON.stringify(next));
            }
          }
        } else if (action.type === 'delete') {
          const delId = Number(action.id);
          const result = await deleteDocumentoEntregado({
            id: delId,
            corpoId: action.corpoId,
            clienteId: action.clienteId,
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            success = true;
            const cacheStr = await AsyncStorage.getItem('documentos_entregados_cache');
            if (cacheStr) {
              const cache = JSON.parse(cacheStr);
              const updatedCache = cache.filter(
                (it: any) => String(it?.id ?? '') !== String(delId)
              );
              await AsyncStorage.setItem('documentos_entregados_cache', JSON.stringify(updatedCache));
            }
          }
        }
      } catch (error) {
        console.error('Error procesando acción de documentos entregados:', error);
      }

      if (!success) break;

      const remaining = queue.filter((a: any) => !sameQueuedDocAction(a, action));
      await AsyncStorage.setItem('documentos_entregados_actions', JSON.stringify(remaining));
      queue = remaining;
    }
  }

  const checkApreciacionVulnerabilidadActionsCache = async () => {
    if (!employee) return;
    const saveActions = async (next: any[]) => {
      if (next.length === 0) {
        await AsyncStorage.removeItem('apreciacion_vulnerabilidad_actions');
      } else {
        await AsyncStorage.setItem('apreciacion_vulnerabilidad_actions', JSON.stringify(next));
      }
    };

    const loadActions = async (): Promise<any[]> => {
      const actionsStr = await AsyncStorage.getItem('apreciacion_vulnerabilidad_actions');
      if (!actionsStr) return [];
      try {
        const parsed = JSON.parse(actionsStr);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    };

    let actions = await loadActions();
    if (actions.length === 0) return;
    console.log('Sincronizando acciones de apreciación de vulnerabilidad:', actions.length);

    let i = 0;
    while (i < actions.length) {
      const action = actions[i];
      try {
        if (action.type === 'create') {
          const payload = { ...(action.requestData || {}) };
          if (Array.isArray(action?.requestData?.apreciacion_images_meta)) {
            const { buildApreciacionImagenesJsonForUpload } = await import('@/hooks/apreciacionVulnerabilidadFilesSync');
            payload.imagenes = await buildApreciacionImagenesJsonForUpload({
              meta: action.requestData.apreciacion_images_meta,
            });
          }
          const result = await createApreciacionVulnerabilidad({
            requestData: payload,
            refreshAccessToken,
            logout,
          });
          if (result.status) {
            const serverId = Number((result as any).id ?? (result as any).data?.id ?? 0);
            actions = actions
              .filter((a: any) => !(a.type === 'create' && String(a.id) === String(action.id)))
              .map((a: any) => {
                if (
                  serverId > 0 &&
                  String(a.id) === String(action.id) &&
                  (a.type === 'update' || a.type === 'delete_file' || a.type === 'update_solicitante_firma')
                ) {
                  return { ...a, id: serverId };
                }
                return a;
              });
            await saveActions(actions);

            const cacheStr = await AsyncStorage.getItem('apreciacion_vulnerabilidad_cache');
            if (cacheStr && serverId > 0) {
              const cache = JSON.parse(String(cacheStr));
              const updatedCache = Array.isArray(cache)
                ? cache.map((it: any) => (String(it?.id_local || '') === String(action.id) ? { ...it, id: serverId, id_local: '' } : it))
                : [];
              await AsyncStorage.setItem('apreciacion_vulnerabilidad_cache', JSON.stringify(updatedCache));
            }
            if (Array.isArray(action?.requestData?.apreciacion_images_meta)) {
              const { deleteApreciacionLocalFilesFromMeta } = await import('@/hooks/apreciacionVulnerabilidadFilesSync');
              await deleteApreciacionLocalFilesFromMeta(action.requestData.apreciacion_images_meta);
            }
            i = 0;
            continue;
          }
        } else if (action.type === 'update') {
          const payload = { ...(action.requestData || {}) };
          if (Array.isArray(action?.requestData?.apreciacion_images_meta)) {
            const { buildApreciacionImagenesJsonForUpload } = await import('@/hooks/apreciacionVulnerabilidadFilesSync');
            payload.imagenes = await buildApreciacionImagenesJsonForUpload({
              meta: action.requestData.apreciacion_images_meta,
            });
          }
          const result = await updateApreciacionVulnerabilidad({
            id: Number(action.id),
            requestData: payload,
            refreshAccessToken,
            logout,
          });
          if (result.status) {
            actions = actions.filter((a: any) => !(a.type === 'update' && Number(a.id) === Number(action.id)));
            await saveActions(actions);

            const cacheStr = await AsyncStorage.getItem('apreciacion_vulnerabilidad_cache');
            if (cacheStr) {
              const cache = JSON.parse(String(cacheStr));
              const rid = Number(action.id);
              const updatedCache = (Array.isArray(cache) ? cache : []).map((row: any) =>
                Number(row.id) === rid ? { ...row, ...action.requestData, id: rid } : row
              );
              await AsyncStorage.setItem('apreciacion_vulnerabilidad_cache', JSON.stringify(updatedCache));
            }
            if (Array.isArray(action?.requestData?.apreciacion_images_meta)) {
              const { deleteApreciacionLocalFilesFromMeta } = await import('@/hooks/apreciacionVulnerabilidadFilesSync');
              await deleteApreciacionLocalFilesFromMeta(action.requestData.apreciacion_images_meta);
            }
            i = 0;
            continue;
          }
        } else if (action.type === 'delete') {
          const result = await deleteApreciacionVulnerabilidad({
            id: Number(action.id),
            refreshAccessToken,
            logout,
          });
          if (result.status) {
            actions = actions.filter((a: any) => !(a.type === 'delete' && Number(a.id) === Number(action.id)));
            await saveActions(actions);
            const cacheStr = await AsyncStorage.getItem('apreciacion_vulnerabilidad_cache');
            if (cacheStr) {
              const cache = JSON.parse(String(cacheStr));
              const updatedCache = (Array.isArray(cache) ? cache : []).filter((it: any) => Number(it.id) !== Number(action.id));
              await AsyncStorage.setItem('apreciacion_vulnerabilidad_cache', JSON.stringify(updatedCache));
            }
            i = 0;
            continue;
          }
        } else if (action.type === 'delete_file') {
          const boletaId = Number(action.id);
          const fileId = Number(action.fileId);
          if (boletaId > 0 && fileId > 0) {
            const result = await deleteApreciacionVulnerabilidadImage({
              boletaId,
              imageId: fileId,
              refreshAccessToken,
              logout,
            });
            if (result.status) {
              actions = actions.filter((a: any) => !(a.type === 'delete_file' && Number(a.id) === boletaId && Number(a.fileId) === fileId));
              await saveActions(actions);
              i = 0;
              continue;
            }
          }
        } else if (action.type === 'update_solicitante_firma') {
          const recordId = Number(action.id);
          if (recordId > 0 && typeof action.firma_solicitante === 'string' && action.firma_solicitante.trim() !== '') {
            const result = await updateApreciacionVulnerabilidadFirmaSolicitante({
              id: recordId,
              firma_solicitante: String(action.firma_solicitante),
              refreshAccessToken,
              logout,
            });
            if (result.status) {
              actions = actions.filter(
                (a: any) => !(a.type === 'update_solicitante_firma' && Number(a.id) === recordId)
              );
              await saveActions(actions);
              const cacheStr = await AsyncStorage.getItem('apreciacion_vulnerabilidad_cache');
              if (cacheStr) {
                const cache = JSON.parse(String(cacheStr));
                const updatedCache = (Array.isArray(cache) ? cache : []).map((row: any) =>
                  Number(row.id) === recordId ? { ...row, firma_solicitante: String(action.firma_solicitante) } : row
                );
                await AsyncStorage.setItem('apreciacion_vulnerabilidad_cache', JSON.stringify(updatedCache));
              }
              i = 0;
              continue;
            }
          }
        }
      } catch (error) {
        console.error('Error procesando acción de apreciación de vulnerabilidad:', error);
      }
      i += 1;
    }
  }

  const checkChecklistSupervisionActionsCache = async () => {
    if (!employee) return;

    const storageKey = 'checklist_supervision_actions';

    const queueAfterSuccess = (queue: any[], action: any): any[] => {
      if (action.type === 'create') {
        const il = String(action?.id_local ?? '');
        return queue.filter(
          (a: any) => !(a.type === 'create' && String(a?.id_local ?? '') === il)
        );
      }
      if (action.type === 'update') {
        const aid = Number(action.id);
        return queue.filter((a: any) => !(a.type === 'update' && Number(a.id) === aid));
      }
      if (action.type === 'update_supervisor_firma') {
        const aid = Number(action.id);
        return queue.filter(
          (a: any) => !(a.type === 'update_supervisor_firma' && Number(a.id) === aid)
        );
      }
      if (action.type === 'delete') {
        const aid = Number(action.id);
        return queue.filter((a: any) => !(a.type === 'delete' && Number(a.id) === aid));
      }
      return queue;
    };

    const persistQueue = async (next: any[]) => {
      if (!Array.isArray(next) || next.length === 0) {
        await AsyncStorage.removeItem(storageKey);
      } else {
        await AsyncStorage.setItem(storageKey, JSON.stringify(next));
      }
    };

    while (true) {
      const actionsStr = await AsyncStorage.getItem(storageKey);
      if (!actionsStr) return;

      const queue = JSON.parse(actionsStr);
      if (!Array.isArray(queue) || queue.length === 0) return;

      const action = queue[0];
      let success = false;

      try {
        if (action.type === 'create') {
          const { createChecklistSupervision } = await import('@/hooks/checklistSupervisionFunctions');
          const result = await createChecklistSupervision({
            requestData: action.requestData,
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            const newId = Number((result as any).id ?? (result as any).data?.id ?? 0);
            const serverPayload = (result as any).data;
            if (newId > 0) {
              const { patchChecklistSupervisionCacheAfterSync } = await import(
                '@/hooks/checklistSupervisionCacheStorage'
              );
              await patchChecklistSupervisionCacheAfterSync({
                matchIdLocal: action?.id_local,
                matchServerId: newId,
                serverPayload: serverPayload && typeof serverPayload === 'object' ? serverPayload : { id: newId },
                requestData: action.requestData,
              });
            }
            const puestoId = Number(action?.requestData?.puesto_id ?? 0);
            if (puestoId > 0) {
              const { refreshPuestoArticulosFromServer } = await import('@/hooks/puestoArticulosSync');
              await refreshPuestoArticulosFromServer({ puestoId, refreshAccessToken, logout });
            }
            success = true;
          }
        } else if (action.type === 'update') {
          const { updateChecklistSupervision } = await import('@/hooks/checklistSupervisionFunctions');
          let resolvedId: any = action.id;
          try {
            const { loadChecklistSupervisionCacheFlat } = await import('@/hooks/checklistSupervisionCacheStorage');
            const flatPre = await loadChecklistSupervisionCacheFlat();
            const idl = String(action?.id_local ?? '');
            const found = flatPre.find(
              (x: any) =>
                String(x.id_local || '') === idl && x.id && Number(x.id) > 0
            );
            if (found?.id) resolvedId = found.id;
          } catch {
            /* ignore */
          }
          const result = await updateChecklistSupervision({
            id: resolvedId,
            requestData: action.requestData,
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            const { patchChecklistSupervisionCacheAfterSync } = await import(
              '@/hooks/checklistSupervisionCacheStorage'
            );
            const aid = Number(resolvedId);
            const serverData = (result as any).data;
            await patchChecklistSupervisionCacheAfterSync({
              matchIdLocal: action.id_local,
              matchServerId: aid,
              serverPayload: serverData,
              requestData: action.requestData,
            });
            const puestoId = Number(action?.requestData?.puesto_id ?? 0);
            if (puestoId > 0) {
              const { refreshPuestoArticulosFromServer } = await import('@/hooks/puestoArticulosSync');
              await refreshPuestoArticulosFromServer({ puestoId, refreshAccessToken, logout });
            }
            success = true;
          }
        } else if (action.type === 'update_supervisor_firma') {
          const { updateChecklistSupervisionFirmaSupervisor } = await import('@/hooks/checklistSupervisionFunctions');
          const result = await updateChecklistSupervisionFirmaSupervisor({
            id: Number(action.id),
            firma_supervisor: action.firma_supervisor,
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            const serverData = (result as any).data;
            if (serverData && typeof serverData === 'object') {
              const { patchChecklistSupervisionCacheAfterSync } = await import(
                '@/hooks/checklistSupervisionCacheStorage'
              );
              await patchChecklistSupervisionCacheAfterSync({
                matchServerId: Number(action.id),
                serverPayload: serverData,
              });
            }
            success = true;
          }
        } else if (action.type === 'delete') {
          const { deleteChecklistSupervision } = await import('@/hooks/checklistSupervisionFunctions');
          const result = await deleteChecklistSupervision({
            id: action.id,
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            const { patchChecklistSupervisionCacheAfterSync } = await import(
              '@/hooks/checklistSupervisionCacheStorage'
            );
            await patchChecklistSupervisionCacheAfterSync({
              matchServerId: action.id,
              matchIdLocal: action.id_local,
              remove: true,
            });
            success = true;
          }
        }
      } catch (error) {
        console.error('Error procesando acción de checklist de supervisión:', error);
        return;
      }

      if (!success) return;

      const next = queueAfterSuccess(queue, action);
      await persistQueue(next);
    }
  }

  const checkPushDeviceActionsCache = async () => {
    if (!employee) return;
    const token = await getValidAccessTokenOrLogout({ refreshAccessToken, logout });
    if (!token) return;
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    await flushPushDeviceActions({ accessToken: token, apiUrl });
  };

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

            const notificationsStr = await AsyncStorage.getItem('notifications');
            if (notificationsStr) {
              try {
                const notificationsData = JSON.parse(notificationsStr);
                if (Array.isArray(notificationsData)) {
                  const refs: { id: number; is_plaza: boolean }[] = Array.isArray(action.notificationIds)
                    ? action.notificationIds
                    : [];
                  const markRef = (n: any) =>
                    refs.some(
                      (r) => Number(r.id) === Number(n.id) && Boolean(r.is_plaza) === Boolean(n.is_plaza)
                    );
                  const updatedNotifications = notificationsData.map((n: any) =>
                    markRef(n) ? { ...n, watched: true } : n
                  );
                  await AsyncStorage.setItem('notifications', JSON.stringify(updatedNotifications));
                }
              } catch {
                /* ignore parse errors */
              }
            }

            // Eliminar esta acción específica del array
            const updatedActions = actions.filter((a: any) =>
              !(a.type === 'markAsRead' && JSON.stringify(a.notificationIds) === JSON.stringify(action.notificationIds))
            );
            await AsyncStorage.setItem('notifications_actions', JSON.stringify(updatedActions));

            // Emitir evento para actualizar la UI
            eventBus.emit('notificationsUpdated');
            eventBus.emit('notificationsUpdatedCounter');
          }
        }
      } catch (error) {
        console.error('Error procesando acción de notificación:', error);
      }
    }
  }

  const checkLunchTimeHorarioActionsCache = async () => {
    if (!employee) return;

    const actions = await readHorarioMinutosActions();
    if (!actions.length) return;

    console.log('Sincronizando acciones de minutos de alimentación (horario):', actions.length);

    for (const action of actions) {
      try {
        if (action.type === 'update_minutos') {
          const result = await updateHorarioMinutosAlmuerzo(action.horarioId, action.minutos, {
            refreshAccessToken,
            logout,
          }, action.planillasToken);
          if (result.status) {
            await clearHorarioMinutosActions();
          }
        }
      } catch (error) {
        console.error('Error procesando acción de minutos de horario:', error);
      }
    }
  };

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

    let actions = JSON.parse(actionsStr);
    if (!actions || actions.length === 0) return;

    console.log('Sincronizando acciones de notas:', actions.length);

    // Procesar acciones una por una
    const saveActions = async (next: any[]) => {
      actions = next;
      await AsyncStorage.setItem('notes_actions', JSON.stringify(next));
    };

    let i = 0;
    while (i < actions.length) {
      const action = actions[i];
      try {
        if (action.type === 'create') {
          console.log('Creando nota:', action.id);
          let payload = { ...(action.requestData || {}) };
          if (Array.isArray(action.notes_images_meta) && action.notes_images_meta.length > 0) {
            const { buildNotesImagenesJsonForUpload } = await import('@/hooks/notesFilesSync');
            payload.imagenes = await buildNotesImagenesJsonForUpload({ meta: action.notes_images_meta });
          }
          const result = await createNote({
            requestData: payload,
            marcaId: action.marcaId,
            puestoId: action.puestoId,
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            console.log('Nota creada correctamente');
            const serverId = Number((result as any).id ?? (result as any)?.data?.id ?? 0);
            const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.type === 'create'));
            const nextActions = updatedActions.map((a: any) => {
              if (serverId > 0 && String(a?.id) === String(action.id) && a.type === 'update') {
                return { ...a, id: serverId };
              }
              if (serverId > 0 && String(a?.id) === String(action.id) && a.type === 'delete_file') {
                return { ...a, id: serverId };
              }
              return a;
            });
            await saveActions(nextActions);

            try {
              const cacheStr = await AsyncStorage.getItem('notes_cache');
              const parsed = cacheStr ? JSON.parse(String(cacheStr)) : { notas: [] };
              if (Array.isArray(parsed?.notas)) {
                parsed.notas = parsed.notas.map((n: any) =>
                  String(n?.id_local) === String(action.id)
                    ? { ...n, id: serverId > 0 ? serverId : n.id, id_local: '', synced: true }
                    : n
                );
                await AsyncStorage.setItem('notes_cache', JSON.stringify(parsed));
              }
            } catch {
              /* ignore */
            }

            if (Array.isArray(action.notes_images_meta) && action.notes_images_meta.length > 0) {
              const { deleteNotesLocalFilesFromMeta } = await import('@/hooks/notesFilesSync');
              await deleteNotesLocalFilesFromMeta(action.notes_images_meta);
            }
            i = 0;
            continue;
          }
        } else if (action.type === 'update') {
          console.log('Actualizando nota:', action.id);
          let payload = { ...(action.requestData || {}) };
          if (Array.isArray(action.notes_images_meta) && action.notes_images_meta.length > 0) {
            const { buildNotesImagenesJsonForUpload } = await import('@/hooks/notesFilesSync');
            payload.imagenes = await buildNotesImagenesJsonForUpload({ meta: action.notes_images_meta });
          }
          const result = await updateNote({
            requestData: payload,
            noteId: action.id,
            puestoId: action.puestoId,
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            console.log('Nota actualizada correctamente');
            const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.type === 'update'));
            await saveActions(updatedActions);
            if (Array.isArray(action.notes_images_meta) && action.notes_images_meta.length > 0) {
              const { deleteNotesLocalFilesFromMeta } = await import('@/hooks/notesFilesSync');
              await deleteNotesLocalFilesFromMeta(action.notes_images_meta);
            }
            i = 0;
            continue;
          }
        } else if (action.type === 'delete') {
          console.log('Eliminando nota:', action.id);
          const puestoId = Number(action.puestoId) || 0;
          const delId = action.id;
          const matchesDelete = (a: any) =>
            a.type === 'delete' && String(a.id) === String(delId);
          if (!puestoId) {
            console.warn('Acción delete de nota sin puestoId; se descarta');
            await AsyncStorage.setItem(
              'notes_actions',
              JSON.stringify(actions.filter((a: any) => !matchesDelete(a)))
            );
            continue;
          }
          const result = await deleteNote({
            noteId: action.id,
            puestoId,
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            console.log('Nota eliminada correctamente');
            const updatedActions = actions.filter((a: any) => !matchesDelete(a));
            await saveActions(updatedActions);
            i = 0;
            continue;
          }
        } else if (action.type === 'delete_file') {
          const noteId = Number(action.id || 0);
          const puestoId = Number(action.puestoId || 0);
          const fileId = Number(action.fileId || 0);
          if (!noteId || !puestoId || !fileId) continue;
          const { deleteNoteImage } = await import('@/hooks/notesFunctions');
          const result = await deleteNoteImage({
            noteId,
            puestoId,
            imageId: fileId,
            refreshAccessToken,
            logout,
          });
          if (result.status) {
            const updatedActions = actions.filter(
              (a: any) => !(a.type === 'delete_file' && Number(a.id) === noteId && Number(a.fileId) === fileId)
            );
            await saveActions(updatedActions);
            try {
              const cacheStr = await AsyncStorage.getItem('notes_cache');
              const parsed = cacheStr ? JSON.parse(String(cacheStr)) : null;
              if (parsed && Array.isArray(parsed.notas)) {
                parsed.notas = parsed.notas.map((n: any) => {
                  if (Number(n?.id) !== noteId) return n;
                  const imgs = Array.isArray(n?.images) ? n.images.filter((im: any) => Number(im?.id) !== fileId) : [];
                  return { ...n, images: imgs };
                });
                await AsyncStorage.setItem('notes_cache', JSON.stringify(parsed));
              }
            } catch {
              /* ignore */
            }
            i = 0;
            continue;
          }
        }
      } catch (error) {
        console.error('Error procesando acción de nota:', error);
      }
      i += 1;
    }
  }

  const checkActivitiesActionsCache = async () => {
    if (!employee) return;

    let actionsStr = await AsyncStorage.getItem('activities_actions');
    if (!actionsStr) return;

    let actions: any[] = JSON.parse(actionsStr);
    if (!Array.isArray(actions) || actions.length === 0) return;

    const patchActivityMarkInCache = async (activityId: number, marked: boolean) => {
      try {
        const cacheStr = await AsyncStorage.getItem('activities_cache');
        if (!cacheStr) return;
        const parsed = JSON.parse(cacheStr);
        if (!Array.isArray(parsed)) return;
        const next = parsed.map((row: any) =>
          Number(row?.id) === Number(activityId) ? { ...row, is_marcada: marked } : row
        );
        await AsyncStorage.setItem('activities_cache', JSON.stringify(next));
      } catch (e) {
        console.warn('patchActivityMarkInCache', e);
      }
    };

    const refreshActivitiesCacheFromServer = async () => {
      try {
        const cmStr = await AsyncStorage.getItem('current_marca');
        if (!cmStr) return;
        const cm = JSON.parse(cmStr);
        const marcaId = Number(cm?.id);
        if (!Number.isFinite(marcaId) || marcaId <= 0) return;
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) return;
        const response = await authedFetch({
          url: `${apiUrl}/api/activities/marca/${marcaId}`,
          init: {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          },
          refreshAccessToken,
          logout,
        });
        if (!response?.ok) return;
        const data = await response.json();
        if (!data?.status || !Array.isArray(data?.actividades)) return;
        const activeRows = data.actividades.filter((r: any) => r?.isActive !== false);
        // Limpieza + actualización: reemplaza cache por estado de servidor vigente
        await AsyncStorage.setItem('activities_cache', JSON.stringify(activeRows));
      } catch (e) {
        console.warn('refreshActivitiesCacheFromServer', e);
      }
    };

    console.log('Sincronizando acciones de actividades:', actions.length);

    // Procesar siempre sobre la cola actual; tras cada éxito se elimina ese registro
    // y se reescribe AsyncStorage para no dejar acciones ya sincronizadas.
    let i = 0;
    while (i < actions.length) {
      const action = actions[i];
      try {
        let result: { status: boolean; message?: string } | null = null;

        if (action.type === 'create') {
          console.log('Creando actividad desde cache');
          const { createActivity } = await import('@/hooks/activitiesFunctions');
          result = await createActivity({
            requestData: action.requestData,
            refreshAccessToken,
            logout,
          });
        } else if (action.type === 'update') {
          console.log('Actualizando actividad:', action.activity_id);
          const { updateActivity } = await import('@/hooks/activitiesFunctions');
          result = await updateActivity({
            requestData: action.requestData,
            activityId: action.activity_id,
            refreshAccessToken,
            logout,
          });
        } else if (action.type === 'update-equipo') {
          console.log('Actualizando revisión de equipo:', action.revisionEquipo_id);
          const { updateRevisionEquipo } = await import('@/hooks/activitiesFunctions');
          result = await updateRevisionEquipo({
            requestData: action.requestData,
            revisionEquipoId: action.revisionEquipo_id,
            refreshAccessToken,
            logout,
          });
        } else {
          // Tipo desconocido: quitar para no bloquear el resto
          console.warn('Acción de actividades desconocida, omitiendo:', action?.type);
          actions.splice(i, 1);
          await AsyncStorage.setItem('activities_actions', JSON.stringify(actions));
          continue;
        }

        if (result && result.status) {
          if (action.type === 'update') {
            const estado = String(action?.requestData?.estado || '').toLowerCase();
            await patchActivityMarkInCache(Number(action?.activity_id), estado === 'marcar');
          }
          try {
            const { deleteFile } = await import('@/hooks/fileStorage');
            const fn = action.requestData?.file_local_file_name;
            if (typeof fn === 'string' && fn.trim()) {
              await deleteFile(fn.trim());
            }
          } catch {
            /* archivo ya borrado o sin ruta local */
          }
          // Quitar solo la acción que acaba de sincronizarse (evita filtros ambiguos)
          actions.splice(i, 1);
          await AsyncStorage.setItem('activities_actions', JSON.stringify(actions));
          if (action.type === 'update') {
            console.log('Actividad actualizada correctamente');
          } else if (action.type === 'update-equipo') {
            console.log('Revisión de equipo actualizada correctamente');
          }
          // No incrementar i: el siguiente elemento pasa a ser actions[i]
          continue;
        }
      } catch (error) {
        console.error('Error procesando acción de actividad:', error);
      }
      // Fallo o sin status: avanzar para no reprocesar en bucle infinito
      i++;
    }

    await refreshActivitiesCacheFromServer();
  }

  const checkEvaluationsActionsCache = async () => {
    if (!employee) return;

    // Bitácora pasó a evaluations_actions + corporateEvaluationsSync; migrar cola antigua (create/update/delete).
    try {
      const legacyBitStr = await AsyncStorage.getItem('bitacora_vehiculo_detenido_actions');
      if (legacyBitStr) {
        const legacy = JSON.parse(legacyBitStr);
        if (Array.isArray(legacy)) {
          const legacyBitActions = legacy.filter(
            (a: any) =>
              (a?.type === 'create' || a?.type === 'update' || a?.type === 'delete') &&
              a?.id != null
          );
          if (legacyBitActions.length > 0) {
            const evStr0 = await AsyncStorage.getItem('evaluations_actions');
            const ev0: any[] = evStr0 ? JSON.parse(evStr0) : [];
            for (const a of legacyBitActions) {
              const mappedAction = String(a.type);
              const mappedPayload = mappedAction === 'delete' ? {} : a.requestData || {};
              if (
                !ev0.some(
                  (e: any) =>
                    String(e.id) === String(a.id) &&
                    e.action === mappedAction &&
                    e.type === BITACORA_VEHICULO_DETENIDO_EVAL_TYPE
                )
              ) {
                ev0.push({
                  id: a.id,
                  action: mappedAction,
                  type: BITACORA_VEHICULO_DETENIDO_EVAL_TYPE,
                  payload: mappedPayload,
                  synced: false,
                });
              }
            }
            await AsyncStorage.setItem('evaluations_actions', JSON.stringify(ev0));
            const rest = legacy.filter(
              (a: any) => !(a?.type === 'create' || a?.type === 'update' || a?.type === 'delete')
            );
            if (rest.length === 0) await AsyncStorage.removeItem('bitacora_vehiculo_detenido_actions');
            else await AsyncStorage.setItem('bitacora_vehiculo_detenido_actions', JSON.stringify(rest));
          }
        }
      }
    } catch (e) {
      console.error('Migración bitácora → evaluations_actions:', e);
    }

    const actionsStr0 = await AsyncStorage.getItem('evaluations_actions');
    if (!actionsStr0) return;

    // `let` + reasignación tras cada éxito: si se usa un array fijo, cada `filter` vuelve a incluir
    // acciones ya eliminadas en el turno y se re-escriben en AsyncStorage (doble envío y duplicados).
    let actions: any[] = JSON.parse(actionsStr0);
    if (!actions || actions.length === 0) return;

    console.log('Sincronizando acciones de evaluaciones:', actions.length);

    // Procesar acciones una por una (vehículos corporativos al final vía runCorporateEvaluationsSync)
    for (const action of actions) {
      try {
        if (CORPORATE_EVALUATION_TYPES.has(action.type)) {
          continue;
        }
        if (action.type === BITACORA_VEHICULO_DETENIDO_EVAL_TYPE) {
          continue;
        }
        if (action.type === 'attendance_control_delete_image' && action.action === 'delete') {
          const { deleteAttendanceControlImage } = await import('@/hooks/evaluationFunctions');
          const controlId = action.payload?.controlId;
          const imageId = Number(action.payload?.imageId);
          if (controlId == null || !Number.isFinite(imageId) || imageId <= 0) {
            const updatedActions = actions.filter(
              (a: any) =>
                !(
                  String(a.id) === String(action.id) &&
                  a.type === 'attendance_control_delete_image' &&
                  a.action === 'delete'
                )
            );
            await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
            actions = updatedActions;
            continue;
          }
          const result = await deleteAttendanceControlImage({
            controlId,
            imageId,
            refreshAccessToken,
            logout,
          });
          if (result.status) {
            const updatedActions = actions.filter(
              (a: any) =>
                !(
                  String(a.id) === String(action.id) &&
                  a.type === 'attendance_control_delete_image' &&
                  a.action === 'delete'
                )
            );
            await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
            actions = updatedActions;
            try {
              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr);
                const updatedCache = cache.map((item: any) => {
                  if (item.type !== 'attendance_control') return item;
                  const same =
                    String(item.id) === String(controlId) ||
                    String(item.id_local) === String(controlId);
                  if (!same) return item;
                  const imgs = Array.isArray(item.images) ? item.images : [];
                  return {
                    ...item,
                    images: imgs.filter((im: any) => Number(im?.id) !== Number(imageId)),
                  };
                });
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
              }
            } catch {
              // ignore
            }
          }
          continue;
        }
        if (action.type === 'opening_closing_position' && action.action === 'delete_file') {
          const { deleteOpeningClosingPositionImage } = await import('@/hooks/evaluationFunctions');
          let openingClosingId: any = action.id;
          try {
            const cacheStrOcp = await AsyncStorage.getItem('evaluations_cache');
            if (cacheStrOcp) {
              const cacheOcp = JSON.parse(cacheStrOcp);
              const foundOcp = cacheOcp.find(
                (it: any) =>
                  it.type === 'opening_closing_position' &&
                  String(it.id_local) === String(action.id) &&
                  it.id
              );
              if (foundOcp?.id) openingClosingId = String(foundOcp.id);
            }
          } catch {
            // ignore
          }
          const imageId = Number(action.payload?.imageId);
          if (openingClosingId == null || !Number.isFinite(imageId) || imageId <= 0) {
            const updatedActions = actions.filter(
              (a: any) =>
                !(
                  String(a.id) === String(action.id) &&
                  a.type === 'opening_closing_position' &&
                  a.action === 'delete_file'
                )
            );
            await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
            actions = updatedActions;
            continue;
          }
          const result = await deleteOpeningClosingPositionImage({
            id: String(openingClosingId),
            imageId,
            refreshAccessToken,
            logout,
          });
          if (result.status) {
            const updatedActions = actions.filter(
              (a: any) =>
                !(
                  String(a.id) === String(action.id) &&
                  a.type === 'opening_closing_position' &&
                  a.action === 'delete_file' &&
                  Number(a?.payload?.imageId) === imageId
                )
            );
            await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
            actions = updatedActions;
            try {
              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr);
                const updatedCache = cache.map((item: any) => {
                  if (item.type !== 'opening_closing_position') return item;
                  const same =
                    String(item.id) === String(openingClosingId) ||
                    String(item.id_local) === String(openingClosingId);
                  if (!same) return item;
                  const imgs = Array.isArray(item.images) ? item.images : [];
                  return {
                    ...item,
                    images: imgs.filter((im: any) => Number(im?.id) !== imageId),
                  };
                });
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
              }
            } catch {
              // ignore
            }
          }
          continue;
        }
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
              actions = updatedActions;

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
              actions = updatedActions;

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
              actions = updatedActions;

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
              actions = updatedActions;

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
              actions = updatedActions;

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
            const {
              clearComplaintsMasterPendingFilesFromArchivoList,
              buildComplaintsMasterRequestDataForSync,
            } = await import('@/hooks/complaintsMasterFilesSync');
            const { requestData, rawArchivos, diskHydrationComplete } =
              await buildComplaintsMasterRequestDataForSync({
                action: 'create',
                actionId: action.id,
                payload: action.payload,
              });
            if (!diskHydrationComplete) {
              console.warn(
                '[complaints_master] Creación aplazada: no se pudieron leer adjuntos locales; no se envía ni se borran archivos.'
              );
                continue;
              }
            const result = await createComplaintsMaster({
              requestData: requestData as any,
              refreshAccessToken,
              logout,
            });

            if (result.status) {
              console.log('Queja creada correctamente');
              await clearComplaintsMasterPendingFilesFromArchivoList(rawArchivos);
              const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'create' && a.type === 'complaints_master'));
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
              actions = updatedActions;

              const { applyComplaintsMasterSyncCreateResult } = await import('@/hooks/complaintsMasterCacheStorage');
              await applyComplaintsMasterSyncCreateResult(String(action.id), result.data);
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
              actions = updatedActions;

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
          } else if (action.type === 'agenda_minuta' || action.type === 'physical_minute_agenda') {
            console.log('Creando agenda minuta:', action.id);
            const { createAgendaMinuta } = await import('@/hooks/evaluationFunctions');
            const result = await createAgendaMinuta({
              requestData: action.payload,
              refreshAccessToken,
              logout,
            });

            if (result.status) {
              console.log('Agenda minuta creada correctamente');
              const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'create' && (a.type === 'agenda_minuta' || a.type === 'physical_minute_agenda')));
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
              actions = updatedActions;

              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr);
                const localKey = String(action.id ?? '').trim();
                const updatedCache = cache.map((item: any) => {
                  if (
                    (item.type === 'agenda_minuta' || item.type === 'physical_minute_agenda') &&
                    localKey.length > 0 &&
                    String(item.id_local ?? '').trim() === localKey
                  ) {
                    return {
                      ...item,
                      synced: true,
                      id: result.data?.id || item.id,
                      id_local: '',
                      type: 'agenda_minuta',
                      isActive: true,
                    };
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
              actions = updatedActions;

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
              actions = updatedActions;

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
              actions = updatedActions;

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
              actions = updatedActions;

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
              actions = updatedActions;

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
              actions = updatedActions;

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
              actions = updatedActions;

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
              actions = updatedActions;

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
              actions = updatedActions;

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
              actions = updatedActions;

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
              actions = updatedActions;

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
              actions = updatedActions;

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
            const payloadWithDefaults = {
              ...action.payload,
              // Backward-compatible default for old queued actions
              division: action.payload?.division || 'Otros',
            };
            const result = await createPermitRequest({
              requestData: payloadWithDefaults,
              refreshAccessToken,
              logout,
            });

            if (result.status) {
              console.log('Solicitud de permiso creada correctamente');
              const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'create' && a.type === 'permit_request'));
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
              actions = updatedActions;

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
          } else if (action.type === 'acta_entrega_producto') {
            console.log('Creando acta de entrega de productos:', action.id);
            const rawPayload = action.payload || {};
            const { acta_entrega_images_meta, ...restPayload } = rawPayload as {
              acta_entrega_images_meta?: import('@/hooks/actaEntregaProductosImagesSync').ActaEntregaImageSyncMeta[];
            } & Record<string, unknown>;
            const requestData: Record<string, unknown> = { ...restPayload };

            if (Array.isArray(acta_entrega_images_meta) && acta_entrega_images_meta.length > 0) {
              const { buildActaEntregaImagenesJsonForUpload } = await import('@/hooks/actaEntregaProductosImagesSync');
              requestData.imagenes = await buildActaEntregaImagenesJsonForUpload({
                meta: acta_entrega_images_meta,
                actaIdForExistingServerImages: null,
                refreshAccessToken,
                logout,
              });
            }

            const { createActaEntregaProducto } = await import('@/hooks/evaluationFunctions');
            const result = await createActaEntregaProducto({
              requestData: requestData as any,
              refreshAccessToken,
              logout,
            });

            if (result.status) {
              console.log('Acta creada correctamente');
              const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'create' && a.type === 'acta_entrega_producto'));
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
              actions = updatedActions;

              if (Array.isArray(acta_entrega_images_meta) && acta_entrega_images_meta.length > 0) {
                const { deleteActaEntregaLocalFilesFromMeta } = await import('@/hooks/actaEntregaProductosImagesSync');
                await deleteActaEntregaLocalFilesFromMeta(acta_entrega_images_meta);
              }

              await applyActaEntregaCreateSyncFromServer(action.id, result.data, restPayload);
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
              actions = updatedActions;

              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr);
                const updatedCache = cache.map((item: any) => {
                  if (item.id_local === action.id && item.type === 'attendance_control') {
                    return {
                      ...item,
                      synced: true,
                      id: result.data?.id ?? item.id,
                      id_local: '',
                      images: result.data?.images || item.images || [],
                      images_local: [],
                    };
                  }
                  return item;
                });
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
              }
            }
          } else if (action.type === 'opening_closing_position') {
            console.log('Creando apertura-cierre de puesto:', action.id);
            const { createOpeningClosingPosition } = await import('@/hooks/evaluationFunctions');
            const {
              buildOpeningClosingImagenesJsonForUpload,
              deleteOpeningClosingLocalFilesFromMeta,
            } = await import('@/hooks/openingClosingPositionFilesSync');

            const rawPayload = { ...(action.payload || {}) };
            const metaAll = Array.isArray(rawPayload.imagenes_meta) ? rawPayload.imagenes_meta : [];
            const deleteMeta = Array.isArray(rawPayload.delete_imagenes_meta) ? rawPayload.delete_imagenes_meta : [];
            const deletedIds = new Set(
              deleteMeta.map((d: any) => Number(d?.id)).filter((n: number) => Number.isFinite(n) && n > 0)
            );
            const deletedLocals = new Set(
              deleteMeta.map((d: any) => String(d?.id_local || '')).filter((s: string) => s.length > 0)
            );
            const metaFiltered = metaAll.filter((m: any) => {
              if (m?.id != null && deletedIds.has(Number(m.id))) return false;
              if (m?.id_local != null && deletedLocals.has(String(m.id_local))) return false;
              return true;
            });
            delete rawPayload.imagenes_meta;
            delete rawPayload.delete_imagenes_meta;

            const imagenesStr = await buildOpeningClosingImagenesJsonForUpload({ meta: metaFiltered });
            if (imagenesStr) {
              rawPayload.imagenes = imagenesStr;
            }

            const result = await createOpeningClosingPosition({
              requestData: rawPayload,
              refreshAccessToken,
              logout,
            });

            if (result.status) {
              console.log('Apertura-Cierre de Puesto creado correctamente');
              await deleteOpeningClosingLocalFilesFromMeta(metaFiltered);

              const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'create' && a.type === 'opening_closing_position'));
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
              actions = updatedActions;

              const serverId = (result as any)?.data?.id;
              if (serverId != null) {
                const localKey = String(action.id);
                const sid = String(serverId);
                const remapActions = actions.map((a: any) => {
                  if (a.type !== 'opening_closing_position') return a;
                  if (a.action === 'create') return a;
                  if (String(a.id) === localKey) {
                    return { ...a, id: sid };
                  }
                  return a;
                });
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(remapActions));
                actions = remapActions;
              }

              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr);
                const updatedCache = cache.map((item: any) => {
                  if (item.id_local === action.id && item.type === 'opening_closing_position') {
                    return {
                      ...item,
                      synced: true,
                      id: result.data?.id || item.id,
                      id_local: '',
                      images: result.data?.images || item.images || [],
                      images_local: [],
                      isActive: (result.data as any)?.isActive !== false,
                    };
                  }
                  return item;
                });
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
              }
            }
          } else if (action.type === 'induction_tour_record') {
            console.log('Creando registro de inducción y recorrido:', action.id);
            const { createInductionTourRecord } = await import('@/hooks/evaluationFunctions');
            // Backward compatibility for older offline actions
            const payload = {
              division: 'Otros',
              firma_responsable: '',
              ...action.payload,
            };
            const result = await createInductionTourRecord({
              requestData: payload,
              refreshAccessToken,
              logout,
            });

            if (result.status) {
              console.log('Registro de inducción y recorrido creado correctamente');
              const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'create' && a.type === 'induction_tour_record'));
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
              actions = updatedActions;

              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              if (cacheStr && result.data) {
                const d = result.data as Record<string, unknown>;
                const cache = JSON.parse(cacheStr);
                const updatedCache = cache.map((item: any) => {
                  if (item.id_local === action.id && item.type === 'induction_tour_record') {
                    return {
                      ...item,
                      ...d,
                      synced: true,
                      id: (d as any).id ?? item.id,
                      type: 'induction_tour_record',
                      isActive: (d as any).isActive !== false,
                    };
                  }
                  return item;
                });
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
              }
            }
          } else if (action.type === 'general_induction_register') {
            console.log('Creando registro de inducción general:', action.id);
            const { createGeneralInductionRegister } = await import('@/hooks/evaluationFunctions');
            const result = await createGeneralInductionRegister({
              requestData: action.payload,
              refreshAccessToken,
              logout,
            });

            if (result.status) {
              console.log('Registro de inducción general creado correctamente');
              const updatedActions = actions.filter(
                (a: any) => !(a.id === action.id && a.action === 'create' && a.type === 'general_induction_register')
              );
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
              actions = updatedActions;

              if (result.data) {
                const { upsertGeneralInductionRegisterFromServerData } = await import(
                  '@/hooks/generalInductionRegisterCache'
                );
                await upsertGeneralInductionRegisterFromServerData({
                  idLocal: String(action.id),
                  serverRow: result.data,
                });
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
              actions = updatedActions;

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
              actions = updatedActions;

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
              actions = updatedActions;

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
              actions = updatedActions;

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
              actions = updatedActions;

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
              actions = updatedActions;

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
              actions = updatedActions;

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
              actions = updatedActions;

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
              actions = updatedActions;

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
              actions = updatedActions;

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
              actions = updatedActions;

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
              const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'create' && (!a.type || (a.type !== 'mileage_control' && a.type !== 'uniform_request' && a.type !== 'routes_and_tours' && a.type !== 'employee_satisfaction' && a.type !== 'vehicle_maintenance' && a.type !== 'non_conforming_product' && a.type !== 'complaints_master' && a.type !== 'cleaners_control' && a.type !== 'physical_minute_agenda' && a.type !== 'agenda_minuta' && a.type !== 'action_plan' && a.type !== 'work_role' && a.type !== 'contract_basic_data' && a.type !== 'delivery_schedule' && a.type !== 'environmental_management_plan' && a.type !== 'cleaning_work_plan' && a.type !== 'special_situations_plan' && a.type !== 'cleaning_tasks_activities' && a.type !== 'risk_matrix' && a.type !== 'opportunity_matrix' && a.type !== 'process_indicator_matrix' && a.type !== 'monthly_work_role' && a.type !== 'permit_request' && a.type !== 'attendance_control' && a.type !== 'opening_closing_position' && a.type !== 'acta_entrega_producto' && a.type !== 'induction_tour_record' && a.type !== 'supervision_report' && a.type !== 'electric_brush_guide'))));
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
              actions = updatedActions;
            }
          }
        } else if (action.action === 'delete_file') {
          if (action.type === 'complaints_master') {
            console.log('Eliminando archivo de queja:', action.id, action.payload?.fileId);
            const { deleteComplaintsMasterFile } = await import('@/hooks/evaluationFunctions');
            const result = await deleteComplaintsMasterFile({
              id: String(action.id),
              fileId: action.payload?.fileId,
              refreshAccessToken,
              logout,
            });

            if (result.status) {
              const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'delete_file' && a.type === 'complaints_master' && a.payload?.fileId === action.payload?.fileId));
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
              actions = updatedActions;

              const { patchComplaintsMasterFilesForRecord } = await import('@/hooks/complaintsMasterCacheStorage');
              await patchComplaintsMasterFilesForRecord(action.id, Number(action.payload?.fileId));
            }
          } else if (action.type === 'general_induction_register') {
            console.log('Eliminando adjunto registro inducción general:', action.id, action.payload?.imageId);
            const { deleteGeneralInductionRegisterImage } = await import('@/hooks/evaluationFunctions');
            const { removeImageFromGeneralInductionCache } = await import('@/hooks/generalInductionRegisterCache');
            const imageId = Number(action.payload?.imageId);
            const result = await deleteGeneralInductionRegisterImage({
              registroId: String(action.id),
              imageId,
              refreshAccessToken,
              logout,
            });
            if (result.status) {
              const updatedActions = actions.filter(
                (a: any) =>
                  !(
                    a.id === action.id &&
                    a.action === 'delete_file' &&
                    a.type === 'general_induction_register' &&
                    Number(a.payload?.imageId) === imageId
                  )
              );
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
              actions = updatedActions;
              await removeImageFromGeneralInductionCache(String(action.id), imageId);
            }
          } else if (action.type === 'acta_entrega_producto') {
            const actaId = Number(action.id);
            const imageId = Number(action.payload?.imageId);
            if (!Number.isFinite(actaId) || actaId <= 0 || !Number.isFinite(imageId) || imageId <= 0) {
              const updatedActions = actions.filter(
                (a: any) =>
                  !(
                    a.type === 'acta_entrega_producto' &&
                    a.action === 'delete_file' &&
                    String(a.id) === String(action.id)
                  )
              );
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
              actions = updatedActions;
            } else {
              const { deleteActaEntregaProductoImage } = await import('@/hooks/evaluationFunctions');
              const result = await deleteActaEntregaProductoImage({
                id: actaId,
                imageId,
                refreshAccessToken,
                logout,
              });
              if (result.status) {
                const updatedActions = actions.filter(
                  (a: any) =>
                    !(
                      a.type === 'acta_entrega_producto' &&
                      a.action === 'delete_file' &&
                      Number(a.id) === actaId &&
                      Number(a.payload?.imageId) === imageId
                    )
                );
                await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
                actions = updatedActions;

                const cache = await readActaEntregaProductosCache();
                const updatedCache = cache.map((item: any) => {
                  if (item?.type !== 'acta_entrega_producto' || Number(item?.id) !== actaId) return item;
                  const imgs = Array.isArray(item.images)
                    ? item.images.filter((im: any) => Number(im?.id) !== imageId)
                    : [];
                  return { ...item, images: imgs };
                });
                await writeActaEntregaProductosCache(updatedCache);
              }
            }
          }
        } else if (action.action === 'delete_archivo' && action.type === 'non_conforming_product') {
          const productoId = Number(action.payload?.productoId);
          const archivoId = Number(action.payload?.archivoId);
          if (!Number.isFinite(productoId) || productoId <= 0 || !Number.isFinite(archivoId) || archivoId <= 0) {
            const updatedActions = actions.filter((a: any) => a.id !== action.id);
            await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
            actions = updatedActions;
          } else {
            console.log('Eliminando adjunto de producto no conforme (cola):', productoId, archivoId);
            const { deleteNonConformingProductArchivo } = await import('@/hooks/evaluationFunctions');
            const result = await deleteNonConformingProductArchivo({
              productoId,
              archivoId,
              refreshAccessToken,
              logout,
            });
            if (result.status) {
              const updatedActions = actions.filter(
                (a: any) =>
                  !(
                    a.id === action.id &&
                    a.action === 'delete_archivo' &&
                    a.type === 'non_conforming_product' &&
                    Number(a.payload?.productoId) === productoId &&
                    Number(a.payload?.archivoId) === archivoId
                  )
              );
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
              actions = updatedActions;
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
              actions = updatedActions;
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
              actions = updatedActions;
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
              actions = updatedActions;
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
              actions = updatedActions;
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
              actions = updatedActions;
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
              actions = updatedActions;
            }
          } else if (action.type === 'complaints_master') {
            console.log('Actualizando queja:', action.id);
            const { updateComplaintsMaster } = await import('@/hooks/evaluationFunctions');
            const {
              clearComplaintsMasterPendingFilesFromArchivoList,
              buildComplaintsMasterRequestDataForSync,
            } = await import('@/hooks/complaintsMasterFilesSync');
            const { requestData, rawArchivos, diskHydrationComplete } =
              await buildComplaintsMasterRequestDataForSync({
                action: 'update',
                actionId: action.id,
                payload: action.payload,
              });
            if (!diskHydrationComplete) {
              console.warn(
                '[complaints_master] Actualización aplazada: no se pudieron leer adjuntos locales; no se envía ni se borran archivos.'
              );
              continue;
            }
            const result = await updateComplaintsMaster({
              id: action.id,
              requestData: requestData as any,
              refreshAccessToken,
              logout,
            });

            if (result.status) {
              console.log('Queja actualizada correctamente');
              await clearComplaintsMasterPendingFilesFromArchivoList(rawArchivos);
              const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'update' && a.type === 'complaints_master'));
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
              actions = updatedActions;

              const { patchComplaintsMasterRowByRecordId } = await import('@/hooks/complaintsMasterCacheStorage');
              const { normalizeServerFilesForComplaintCache } = await import('@/hooks/complaintsMasterFilesSync');
              const raw = (result as any).data;
              const serverRow =
                raw && typeof raw === 'object'
                  ? (() => {
                      const { c_anexos_quejas: _a, archivos: _ar, ...r } = raw as any;
                      return r;
                    })()
                  : {};
              await patchComplaintsMasterRowByRecordId(String(action.id), {
                ...serverRow,
                synced: true,
                id_local: '',
                type: 'complaints_master',
                ...(Array.isArray((raw as any)?.files)
                  ? { files: normalizeServerFilesForComplaintCache((raw as any).files) }
                  : {}),
              });
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
              actions = updatedActions;
            }
          } else if (action.type === 'puesto_ubicacion') {
            console.log('Actualizando ubicación del puesto:', action.puesto_id);
            const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
            if (!apiUrl) {
              console.error('Server URL not configured');
              continue;
            }

            try {
              const storedPlanillas = await readStoredPlanillasToken();
              const planillasToken =
                String(action?.planillasToken ?? '').trim() || storedPlanillas?.token || null;

              const response = await authedFetch({
                url: `${apiUrl}/api/puestos/${action.puesto_id}/ubicacion`,
                init: {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': '69420',
                    'Planillas-Token': encodeURIComponent(planillasToken ?? ''),
                  },
                  body: JSON.stringify({
                    latitud: action.payload.latitud,
                    longitud: action.payload.longitud,
                    horaAccion: action.payload?.horaAccion ?? action.horaAccion,
                  }),
                },
                refreshAccessToken,
                logout,
              });

              if (response) {
                const data = await response.json();
                if (data.status) {
                  console.log('Ubicación del puesto actualizada correctamente');
                  const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'update' && a.type === 'puesto_ubicacion'));
                  await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
                  actions = updatedActions;

                  // Actualizar cache
                  const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                  if (cacheStr) {
                    const cache = JSON.parse(cacheStr);
                    const updatedCache = cache.map((item: any) => {
                      if (item.id_local === action.id && item.type === 'puesto_ubicacion') {
                        return { ...item, synced: true };
                      }
                      return item;
                    });
                    await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                  }

                  const puestoId = Number(action?.puesto_id);
                  const rawLat = action?.payload?.latitud;
                  const rawLng = action?.payload?.longitud;
                  const clearingUbicacion = rawLat === null && rawLng === null;
                  const lat = clearingUbicacion ? null : String(rawLat ?? '');
                  const lng = clearingUbicacion ? null : String(rawLng ?? '');

                  if (puestoId > 0 && (clearingUbicacion || (lat && lng))) {
                    const sidHint =
                      action?.sucursal_id != null && action?.sucursal_id !== ''
                        ? Number(action.sucursal_id)
                        : null;
                    await writePuestoUbicacionDispositivo(puestoId, lat, lng);
                    await patchSucursalPuestosUbicacionInFragments(
                      puestoId,
                      lat,
                      lng,
                      Number.isFinite(Number(sidHint)) && Number(sidHint) > 0 ? sidHint : null,
                    );
                  }

                }
              }
            } catch (error) {
              console.error('Error syncing puesto ubicacion:', error);
            }
          } else if (action.type === 'agenda_minuta' || action.type === 'physical_minute_agenda') {
            console.log('Actualizando agenda minuta:', action.id);
            const { updateAgendaMinuta } = await import('@/hooks/evaluationFunctions');
            const result = await updateAgendaMinuta({
              id: action.remote_id || action.id,
              requestData: action.payload,
              refreshAccessToken,
              logout,
            });

            if (result.status) {
              console.log('Agenda minuta actualizada correctamente');
              const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'update' && (a.type === 'agenda_minuta' || a.type === 'physical_minute_agenda')));
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
              actions = updatedActions;

              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr);
                const targetId = String(action.remote_id || action.id);
                const actionLocalKey = String(action.id_local ?? '').trim();
                const updatedCache = cache.map((item: any) => {
                  const sameType = item.type === 'agenda_minuta' || item.type === 'physical_minute_agenda';
                  const sameRecord =
                    String(item.id) === targetId ||
                    String(item.id_local ?? '').trim() === String(action.id ?? '').trim() ||
                    (actionLocalKey.length > 0 && String(item.id_local ?? '').trim() === actionLocalKey);
                  if (sameType && sameRecord) {
                    return {
                      ...item,
                      ...(action.payload || {}),
                      ...(result.data || {}),
                      type: 'agenda_minuta',
                      synced: true,
                      isActive: true,
                    };
                  }
                  return item;
                });
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
              }
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
              actions = updatedActions;
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
              actions = updatedActions;
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
              actions = updatedActions;
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
              actions = updatedActions;
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
              actions = updatedActions;
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
              actions = updatedActions;
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
              actions = updatedActions;
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
              actions = updatedActions;
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
              actions = updatedActions;
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
              actions = updatedActions;
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
              actions = updatedActions;
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
              actions = updatedActions;
            }
          } else if (action.type === 'permit_request') {
            console.log('Actualizando solicitud de permiso:', action.id);
            const { updatePermitRequest } = await import('@/hooks/evaluationFunctions');
            const payloadWithDefaults = {
              ...action.payload,
              division: action.payload?.division || 'Otros',
            };
            const result = await updatePermitRequest({
              id: action.id,
              requestData: payloadWithDefaults,
              refreshAccessToken,
              logout,
            });

            if (result.status) {
              console.log('Solicitud de permiso actualizada correctamente');
              const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'update' && a.type === 'permit_request'));
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
              actions = updatedActions;
            }
          } else if (action.type === 'acta_entrega_producto') {
            console.log('Actualizando acta de entrega de productos:', action.id);
            const rawPayload = action.payload || {};
            const { acta_entrega_images_meta, ...restPayload } = rawPayload as {
              acta_entrega_images_meta?: import('@/hooks/actaEntregaProductosImagesSync').ActaEntregaImageSyncMeta[];
            } & Record<string, unknown>;
            const requestData: Record<string, unknown> = { ...restPayload };

            if (Array.isArray(acta_entrega_images_meta) && acta_entrega_images_meta.length > 0) {
              const { buildActaEntregaImagenesJsonForUpload } = await import('@/hooks/actaEntregaProductosImagesSync');
              requestData.imagenes = await buildActaEntregaImagenesJsonForUpload({
                meta: acta_entrega_images_meta,
                actaIdForExistingServerImages: Number(action.id),
                refreshAccessToken,
                logout,
              });
            }

            const { updateActaEntregaProducto } = await import('@/hooks/evaluationFunctions');
            const result = await updateActaEntregaProducto({
              id: action.id,
              requestData: requestData as any,
              refreshAccessToken,
              logout,
            });

            if (result.status) {
              console.log('Acta actualizada correctamente');
              const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'update' && a.type === 'acta_entrega_producto'));
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
              actions = updatedActions;

              if (Array.isArray(acta_entrega_images_meta) && acta_entrega_images_meta.length > 0) {
                const { deleteActaEntregaLocalFilesFromMeta } = await import('@/hooks/actaEntregaProductosImagesSync');
                await deleteActaEntregaLocalFilesFromMeta(acta_entrega_images_meta);
              }

              try {
                await applyActaEntregaUpdateSyncFromServer(action.id, result.data);
              } catch {
                // ignore
              }
            }
          } else if (action.type === 'attendance_control') {
            console.log('Actualizando control de asistencia:', action.id);
            const { updateAttendanceControl } = await import('@/hooks/evaluationFunctions');
            let resolvedId: any = action.id;
            try {
              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr);
                const found = cache.find(
                  (it: any) => it.type === 'attendance_control' && it.id_local === action.id && it.id
                );
                if (found?.id) resolvedId = String(found.id);
              }
            } catch {
              // ignore
            }
            const result = await updateAttendanceControl({
              id: resolvedId,
              requestData: action.payload,
              refreshAccessToken,
              logout,
            });

            if (result.status) {
              console.log('Control de asistencia actualizado correctamente');
              const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'update' && a.type === 'attendance_control'));
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
              actions = updatedActions;

              try {
                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.map((item: any) => {
                    if (
                      (item.id === resolvedId ||
                        String(item.id) === String(resolvedId) ||
                        item.id_local === action.id) &&
                      item.type === 'attendance_control'
                    ) {
                      return {
                        ...item,
                        synced: true,
                        id: result.data?.id ?? resolvedId ?? item.id,
                        id_local: '',
                        images: result.data?.images || item.images || [],
                        images_local: [],
                      };
                    }
                    return item;
                  });
                  await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                }
              } catch {
                // ignore
              }
            }
          } else if (action.type === 'opening_closing_position') {
            console.log('Actualizando apertura-cierre de puesto:', action.id);
            const { updateOpeningClosingPosition } = await import('@/hooks/evaluationFunctions');
            const {
              buildOpeningClosingImagenesJsonForUpload,
              deleteOpeningClosingLocalFilesFromMeta,
            } = await import('@/hooks/openingClosingPositionFilesSync');
            // Si el action.id es local, intentar resolver al ID real ya sincronizado
            let resolvedId: any = action.id;
            try {
              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr);
                const found = cache.find((it: any) => it.type === 'opening_closing_position' && it.id_local === action.id && it.id);
                if (found?.id) resolvedId = String(found.id);
              }
            } catch {
              // ignore
            }

            const rawUp = { ...(action.payload || {}) };
            const metaUp = Array.isArray(rawUp.imagenes_meta) ? rawUp.imagenes_meta : [];
            delete rawUp.imagenes_meta;
            const imagenesStrUp = await buildOpeningClosingImagenesJsonForUpload({ meta: metaUp });
            if (imagenesStrUp) {
              rawUp.imagenes = imagenesStrUp;
            }

            const result = await updateOpeningClosingPosition({
              id: resolvedId,
              requestData: rawUp,
              refreshAccessToken,
              logout,
            });

            if (result.status) {
              console.log('Apertura-Cierre de Puesto actualizado correctamente');
              await deleteOpeningClosingLocalFilesFromMeta(metaUp);

              const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'update' && a.type === 'opening_closing_position'));
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
              actions = updatedActions;

              // Marcar cache como sincronizado (y actualizar imágenes si vienen)
              try {
                const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                if (cacheStr) {
                  const cache = JSON.parse(cacheStr);
                  const updatedCache = cache.map((item: any) => {
                    if ((item.id === resolvedId || String(item.id) === String(resolvedId) || item.id_local === action.id) && item.type === 'opening_closing_position') {
                      return {
                        ...item,
                        synced: true,
                        images: result.data?.images || item.images || [],
                        images_local: [],
                        isActive: (result.data as any)?.isActive !== false,
                      };
                    }
                    return item;
                  });
                  await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                }
              } catch {
                // ignore
              }
            }
          } else if (action.type === 'induction_tour_record') {
            console.log('Actualizando registro de inducción y recorrido:', action.id);
            const { updateInductionTourRecord } = await import('@/hooks/evaluationFunctions');
            // Backward compatibility for older offline actions
            const payload = {
              division: 'Otros',
              firma_responsable: '',
              ...action.payload,
            };
            const result = await updateInductionTourRecord({
              id: action.id,
              requestData: payload,
              refreshAccessToken,
              logout,
            });

            if (result.status) {
              console.log('Registro de inducción y recorrido actualizado correctamente');
              const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'update' && a.type === 'induction_tour_record'));
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
              actions = updatedActions;
              try {
                if (result.data) {
                  const d = result.data as Record<string, unknown>;
                  const cacheStr = await AsyncStorage.getItem('evaluations_cache');
                  if (cacheStr) {
                    const cache = JSON.parse(cacheStr);
                    const updatedCache = cache.map((item: any) => {
                      if (item.type !== 'induction_tour_record') return item;
                      if (String(item.id) === String(action.id) || String(item.id_local) === String(action.id)) {
                        return {
                          ...item,
                          ...d,
                          type: 'induction_tour_record',
                          synced: true,
                          isActive: (d as any).isActive !== false,
                        };
                      }
                      return item;
                    });
                    await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
                  }
                }
              } catch {
                // ignore
              }
            }
          } else if (action.type === 'general_induction_register') {
            console.log('Actualizando registro de inducción general:', action.id);
            const { updateGeneralInductionRegister } = await import('@/hooks/evaluationFunctions');
            let resolvedId: string = String(action.id);
            if (resolvedId.startsWith('local-')) {
              try {
                const { readAllGeneralInductionRegisterRecords } = await import('@/hooks/generalInductionRegisterCache');
                const all = await readAllGeneralInductionRegisterRecords();
                const found = all.find(
                  (it: any) =>
                    it.id_local === action.id &&
                    it.id != null &&
                    !String(it.id).startsWith('local-')
                );
                if (found?.id) resolvedId = String(found.id);
              } catch {
                // ignore
              }
            }
            const result = await updateGeneralInductionRegister({
              id: resolvedId,
              requestData: action.payload,
              refreshAccessToken,
              logout,
            });

            if (result.status) {
              console.log('Registro de inducción general actualizado correctamente');
              const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'update' && a.type === 'general_induction_register'));
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
              actions = updatedActions;
              if (result.data) {
                const { upsertGeneralInductionRegisterFromServerData } = await import(
                  '@/hooks/generalInductionRegisterCache'
                );
                await upsertGeneralInductionRegisterFromServerData({
                  idLocal: String(action.id),
                  serverRow: result.data,
                });
              }
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
              actions = updatedActions;
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
              actions = updatedActions;
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
              actions = updatedActions;
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
              actions = updatedActions;
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
              actions = updatedActions;
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
              actions = updatedActions;
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
              actions = updatedActions;
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
              actions = updatedActions;
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
              actions = updatedActions;
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
              actions = updatedActions;
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
              actions = updatedActions;
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
              actions = updatedActions;

              // Eliminar del cache
              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr);
                const targetId = String(action.remote_id || action.id);
                const updatedCache = cache.filter((item: any) => {
                  const sameType = item.type === 'agenda_minuta' || item.type === 'physical_minute_agenda';
                  const sameRecord =
                    String(item.id) === targetId ||
                    String(item.id_local) === String(action.id) ||
                    String(item.id_local) === String(action.id_local || '');
                  return !(sameType && sameRecord);
                });
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
              actions = updatedActions;

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
              actions = updatedActions;

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
              actions = updatedActions;

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
              actions = updatedActions;

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
              actions = updatedActions;

              const { removeComplaintsMasterRowByRecordId } = await import('@/hooks/complaintsMasterCacheStorage');
              await removeComplaintsMasterRowByRecordId(action.id);
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
              actions = updatedActions;

              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr);
                const updatedCache = cache.filter((item: any) => !(item.id === action.id || item.id_local === action.id));
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
              }
            }
          } else if (action.type === 'agenda_minuta' || action.type === 'physical_minute_agenda') {
            console.log('Eliminando agenda minuta:', action.id);
            const { deleteAgendaMinuta } = await import('@/hooks/evaluationFunctions');
            const result = await deleteAgendaMinuta({
              id: action.remote_id || action.id,
              refreshAccessToken,
              logout,
            });

            if (result.status) {
              console.log('Agenda minuta eliminada correctamente');
              const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'delete' && (a.type === 'agenda_minuta' || a.type === 'physical_minute_agenda')));
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
              actions = updatedActions;

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
              actions = updatedActions;

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
              actions = updatedActions;

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
              actions = updatedActions;

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
              actions = updatedActions;

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
              actions = updatedActions;

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
              actions = updatedActions;

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
              actions = updatedActions;

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
              actions = updatedActions;

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
              actions = updatedActions;

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
              actions = updatedActions;

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
              actions = updatedActions;

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
              actions = updatedActions;

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
              actions = updatedActions;

              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr);
                const updatedCache = cache.filter((item: any) => !((item.id === action.id || item.id_local === action.id) && item.type === 'permit_request'));
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
              }
            }
          } else if (action.type === 'acta_entrega_producto') {
            console.log('Eliminando acta de entrega de productos:', action.id);
            const { deleteActaEntregaProducto } = await import('@/hooks/evaluationFunctions');
            const result = await deleteActaEntregaProducto({
              id: action.id,
              refreshAccessToken,
              logout,
            });

            if (result.status) {
              console.log('Acta eliminada correctamente');
              const updatedActions = actions.filter((a: any) => !(
                (a.id === action.id && a.action === 'delete' && a.type === 'acta_entrega_producto') ||
                (a.type === 'acta_entrega_producto' && a.action === 'delete_file' && String(a.id) === String(action.id))
              ));
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
              actions = updatedActions;

              const cache = await readActaEntregaProductosCache();
              const updatedCache = cache.filter(
                (item: any) => !((item.id === action.id || item.id_local === action.id) && item.type === 'acta_entrega_producto'),
              );
              await writeActaEntregaProductosCache(updatedCache);
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
              const removedControlKey = String(action.id);
              const updatedActions = actions.filter((a: any) => {
                if (a.id === action.id && a.action === 'delete' && a.type === 'attendance_control') return false;
                if (
                  a.type === 'attendance_control_delete_image' &&
                  a.action === 'delete' &&
                  String(a.payload?.controlId ?? '') === removedControlKey
                ) {
                  return false;
                }
                return true;
              });
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
              actions = updatedActions;

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
            // Si el action.id es local, intentar resolver al ID real ya sincronizado
            let resolvedId: any = action.id;
            try {
              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr);
                const found = cache.find((it: any) => it.type === 'opening_closing_position' && it.id_local === action.id && it.id);
                if (found?.id) resolvedId = String(found.id);
              }
            } catch {
              // ignore
            }
            const result = await deleteOpeningClosingPosition({
              id: resolvedId,
              refreshAccessToken,
              logout,
            });

            if (result.status) {
              console.log('Apertura-Cierre de Puesto eliminado correctamente');
              const updatedActions = actions.filter((a: any) => {
                if (a.type !== 'opening_closing_position') return true;
                if (a.action === 'delete' && a.id === action.id) return false;
                if (
                  a.action === 'delete_file' &&
                  (String(a.id) === String(resolvedId) || String(a.id) === String(action.id))
                ) {
                  return false;
                }
                return true;
              });
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
              actions = updatedActions;

              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr);
                const updatedCache = cache.filter((item: any) => !((item.id === resolvedId || String(item.id) === String(resolvedId) || item.id_local === action.id) && item.type === 'opening_closing_position'));
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
              actions = updatedActions;

              const cacheStr = await AsyncStorage.getItem('evaluations_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr);
                const updatedCache = cache.filter((item: any) => !((item.id === action.id || item.id_local === action.id) && item.type === 'induction_tour_record'));
                await AsyncStorage.setItem('evaluations_cache', JSON.stringify(updatedCache));
              }
            }
          } else if (action.type === 'general_induction_register') {
            console.log('Eliminando registro de inducción general:', action.id);
            const { deleteGeneralInductionRegister } = await import('@/hooks/evaluationFunctions');
            let resolvedId: string = String(action.id);
            if (resolvedId.startsWith('local-')) {
              try {
                const { readAllGeneralInductionRegisterRecords } = await import('@/hooks/generalInductionRegisterCache');
                const all = await readAllGeneralInductionRegisterRecords();
                const found = all.find(
                  (it: any) =>
                    it.id_local === action.id &&
                    it.id != null &&
                    !String(it.id).startsWith('local-')
                );
                if (found?.id) resolvedId = String(found.id);
              } catch {
                // ignore
              }
            }
            const result = await deleteGeneralInductionRegister({
              id: resolvedId,
              refreshAccessToken,
              logout,
            });

            if (result.status) {
              console.log('Registro de inducción general eliminado correctamente');
              const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.action === 'delete' && a.type === 'general_induction_register'));
              await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
              actions = updatedActions;

              const { removeGeneralInductionRegisterFromCacheByKeys } = await import(
                '@/hooks/generalInductionRegisterCache'
              );
              await removeGeneralInductionRegisterFromCacheByKeys(String(resolvedId), action.id);
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
              actions = updatedActions;

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
              actions = updatedActions;

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
              actions = updatedActions;

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
              actions = updatedActions;

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
              actions = updatedActions;

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
              actions = updatedActions;

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
              actions = updatedActions;

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
              actions = updatedActions;

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
              actions = updatedActions;

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
              actions = updatedActions;

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
              actions = updatedActions;

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

    await runCorporateEvaluationsSync({ refreshAccessToken, logout } as Parameters<typeof runCorporateEvaluationsSync>[0]);
  }

  const checkSurveysActionsCache = async () => {
    if (!employee) return;

    /* Procesar en orden: si la primera acción falla se detiene para reintentar tras la próxima reconexión. */
    while (true) {
    const actionsStr = await AsyncStorage.getItem('surveys_actions');
      if (!actionsStr) break;

    const actions = JSON.parse(actionsStr);
      if (!Array.isArray(actions) || actions.length === 0) break;

      const action = actions[0];
      let done = false;

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
            const newId = result.data?.id != null ? Number(result.data.id) : null;
            const cacheStr = await AsyncStorage.getItem('surveys_cache');
            const list = cacheStr ? JSON.parse(cacheStr) : [];
            const fullCache = Array.isArray(list) ? list : [];
            const puestoId = Number(action.requestData?.puesto_id);
            const withoutDraft = fullCache.filter(
              (s: any) => String(s?.id_local ?? '') !== String(action.id)
            );
            if (newId != null && Number.isFinite(newId) && newId > 0 && Number.isFinite(puestoId) && puestoId > 0) {
              const row = buildSurveyCacheRowFromCreateRequest(
                action.requestData,
                newId,
                ''
              );
              const merged = upsertSurveyCacheRowForPuesto(withoutDraft, row, puestoId);
              await AsyncStorage.setItem('surveys_cache', JSON.stringify(merged));
            } else {
              await AsyncStorage.setItem('surveys_cache', JSON.stringify(withoutDraft));
            }
            done = true;
          }
        } else if (action.type === 'update' && action.surveyId) {
          console.log('Actualizando encuesta:', action.surveyId);
          const result = await updateSurveyAPI({
            surveyId: action.surveyId,
            requestData: action.requestData,
            refreshAccessToken,
            logout,
          });
          if (result.status) done = true;
        } else if (action.type === 'patchFirmaPersona' && action.surveyId) {
          const result = await updateSurveySignatureAPI({
            surveyId: Number(action.surveyId),
            field: 'firma_persona_evaluada',
            value: action.value != null ? String(action.value) : '',
            refreshAccessToken,
            logout,
          });
          if (result.status) done = true;
        } else if (action.type === 'delete' && action.surveyId) {
          console.log('Eliminando encuesta:', action.surveyId);
          const result = await deleteSurveyAPI({
            surveyId: action.surveyId,
            refreshAccessToken,
            logout,
          });
          if (result.status) {
            const cacheStr = await AsyncStorage.getItem('surveys_cache');
            if (cacheStr) {
              const cache = JSON.parse(cacheStr);
              const updatedCache = cache.filter((s: any) => s.id !== action.surveyId);
              await AsyncStorage.setItem('surveys_cache', JSON.stringify(updatedCache));
            }
            done = true;
          }
        }
      } catch (error) {
        console.error('Error procesando acción de encuesta:', error);
        break;
      }

      if (done) {
        const rest = actions.slice(1);
        if (rest.length === 0) {
          await AsyncStorage.removeItem('surveys_actions');
        } else {
          await AsyncStorage.setItem('surveys_actions', JSON.stringify(rest));
        }
        eventBus.emit('surveysCacheUpdated');
      } else {
        break;
      }
    }
  }

  const checkTrainingsActionsCache = async () => {
    if (!employee) return;

    const actionsStr = await AsyncStorage.getItem('trainings_actions');
    if (!actionsStr) return;

    const raw = JSON.parse(actionsStr);
    if (!Array.isArray(raw) || raw.length === 0) return;

    const seenDeleteTraining = new Set<number>();
    const actions = raw.filter((a: any) => {
      if (a?.type === 'delete' && a.trainingId != null) {
        const tid = Number(a.trainingId);
        if (!Number.isFinite(tid)) return true;
        if (seenDeleteTraining.has(tid)) return false;
        seenDeleteTraining.add(tid);
      }
      return true;
    });

    if (actions.length !== raw.length) {
      if (actions.length === 0) {
        await AsyncStorage.removeItem('trainings_actions');
        return;
      }
      await AsyncStorage.setItem('trainings_actions', JSON.stringify(actions));
    }

    console.log('Sincronizando acciones de capacitaciones:', actions.length);

    const pending: any[] = [];
    for (const action of actions) {
      try {
        if (action.type === 'create') {
          console.log('Creando capacitación:', action.id);
          const requestData = await hydrateTrainingRequestDataForSync(action.requestData);
          const result = await createTraining({
            requestData,
            marcaId: action.marcaId,
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            const newId = Number(
              (result as { id?: number }).id ?? (result as { data?: { id?: number } }).data?.id
            );
            if (Number.isFinite(newId) && newId > 0 && action.id) {
              const cacheStr = await AsyncStorage.getItem('trainings_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr) as any[];
                const next = Array.isArray(cache)
                  ? cache.map((t: any) => {
                      if (t?.id === 0 && String(t?.id_local) === String(action.id)) {
                        const { id_local, ...rest } = t;
                        return { ...rest, id: newId };
                      }
                      return t;
                    })
                  : cache;
                await AsyncStorage.setItem('trainings_cache', JSON.stringify(next));
              }
            }
          } else {
            pending.push(action);
          }
        } else if (action.type === 'update' && action.trainingId != null) {
          const requestData = await hydrateTrainingRequestDataForSync(action.requestData);
          const result = await updateTraining({
            trainingId: Number(action.trainingId),
            requestData,
            refreshAccessToken,
            logout,
          });
          if (!result.status) {
            pending.push(action);
          }
        } else if (action.type === 'delete' && action.trainingId) {
          console.log('Eliminando capacitación:', action.trainingId);
          const result = await deleteTraining({
            trainingId: action.trainingId,
            refreshAccessToken,
            logout,
          });
          if (result.status) {
            const cacheStr = await AsyncStorage.getItem('trainings_cache');
            if (cacheStr) {
              const cache = JSON.parse(cacheStr);
              const updatedCache = cache.filter(
                (t: { id?: number }) => Number(t?.id) !== Number(action.trainingId)
              );
              await AsyncStorage.setItem('trainings_cache', JSON.stringify(updatedCache));
            }
          } else {
            pending.push(action);
          }
        } else if (action.type === 'delete_file' && action.trainingId && action.fileName) {
          const result = await deleteTrainingArchivo({
            trainingId: Number(action.trainingId),
            fileName: String(action.fileName),
            refreshAccessToken,
            logout,
          });
          if (result.status) {
            const cacheStr = await AsyncStorage.getItem('trainings_cache');
            if (cacheStr) {
              try {
                const cache = JSON.parse(cacheStr) as any[];
                const fn = String(action.fileName);
                const next = Array.isArray(cache)
                  ? cache.map((t: any) => {
                      if (Number(t?.id) !== Number(action.trainingId)) return t;
                      const arch = Array.isArray(t.archivos) ? t.archivos : [];
                      return {
                        ...t,
                        archivos: arch.filter((x: any) => x && x.name !== fn),
                      };
                    })
                  : cache;
                await AsyncStorage.setItem('trainings_cache', JSON.stringify(next));
              } catch {
                /* ignore */
              }
            }
          } else {
            pending.push(action);
          }
        } else {
          pending.push(action);
        }
      } catch (error) {
        console.error('Error procesando acción de capacitación:', error);
        pending.push(action);
      }
    }
    if (pending.length === 0) {
      await AsyncStorage.removeItem('trainings_actions');
    } else {
      await AsyncStorage.setItem('trainings_actions', JSON.stringify(pending));
    }
  }

  const checkStaffEvaluationsActionsCache = async () => {
    if (!employee) return;

    const readActions = async (): Promise<any[]> => {
      const s = await AsyncStorage.getItem('evaluations_staff_actions');
      if (!s) return [];
      const all = JSON.parse(s);
      return Array.isArray(all) ? all : [];
    };

    let actions = await readActions();
    if (actions.length === 0) return;

    console.log('Sincronizando acciones de evaluaciones de personal:', actions.length);

    const saveActions = async (next: any[]) => {
      if (next.length === 0) {
        await AsyncStorage.removeItem('evaluations_staff_actions');
      } else {
        await AsyncStorage.setItem('evaluations_staff_actions', JSON.stringify(next));
      }
    };

    const mergeFirmasIntoRequest = (req: any, a: any) => {
      if (a?.field === 'firma_empleado') {
        req.firma_empleado = a.value ?? null;
      } else if (a?.field === 'firma_empleado_manual') {
        req.firma_empleado_manual = a.value ?? null;
      }
    };

    for (const action of actions) {
      try {
        if (action.type === 'create') {
          console.log('Creando evaluación de personal:', action.id);
          actions = await readActions();
          const requestData = { ...action.requestData };
          for (const u of actions) {
            if (u.type === 'update' && u.id_local && String(u.id_local) === String(action.id)) {
              mergeFirmasIntoRequest(requestData, u);
            }
          }
          try {
            const sections = JSON.parse(
              typeof requestData.evaluacion === 'string' ? requestData.evaluacion : '[]',
            );
            const { evaluacion, fileSlots } = buildStaffEvaluacionForSubmit(sections);
            requestData.evaluacion = evaluacion;
            (requestData as any)._staffEvalFileSlots = fileSlots;
          } catch {
            /* noop */
          }

          const result = await createStaffEvaluation({
            requestData,
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            console.log('Evaluación de personal creada correctamente');
            const newId = result.evaluationId;
            try {
              const sec = JSON.parse(
                typeof action.requestData?.evaluacion === 'string' ? action.requestData.evaluacion : '[]',
              );
              await deleteStaffEvalLocalImageFiles(sec);
            } catch {
              /* noop */
            }
            actions = await readActions();
            const next = actions.filter((a: any) => {
              if (a.id === action.id && a.type === 'create') return false;
              if (a.type === 'update' && a.id_local && String(a.id_local) === String(action.id)) {
                return false;
              }
              return true;
            });
            await saveActions(next);
            if (newId) {
              const d = (result as any).data;
              const cacheStr = await AsyncStorage.getItem('evaluations_staff_cache');
              if (cacheStr) {
                try {
                  const cache = JSON.parse(cacheStr);
                  if (Array.isArray(cache)) {
                    const upd = cache.map((e: any) => {
                      if (!e.id_local || String(e.id_local) !== String(action.id)) return e;
                      const next: any = {
                        ...e,
                        id: newId,
                        id_local: '',
                        synced: true,
                        isActive: true,
                      };
                      if (d && typeof d === 'object') {
                        if (d.evaluacion != null) next.evaluacion = d.evaluacion;
                        if (d.comentarios != null) next.comentarios = d.comentarios;
                        if (d.firma_evaluador != null) next.firma_evaluador = d.firma_evaluador;
                        if (d.firma_empleado !== undefined) next.firma_empleado = d.firma_empleado;
                        if (d.firma_empleado_manual !== undefined) next.firma_empleado_manual = d.firma_empleado_manual;
                        if (d.tipo != null) next.tipo = d.tipo;
                        if (d.fecha_ingreso != null) next.fecha_ingreso = d.fecha_ingreso;
                        if (d.fecha_evaluacion != null) next.fecha_evaluacion = d.fecha_evaluacion;
                      }
                      return next;
                    });
                    await AsyncStorage.setItem('evaluations_staff_cache', JSON.stringify(upd));
                  }
                } catch {
                  /* ignore */
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Error procesando acción de evaluación de personal:', error);
      }
    }

    actions = await readActions();
    for (const action of actions) {
      try {
        if (action.type === 'update') {
          if (!action.evaluationId || Number(action.evaluationId) === 0) {
            if (action.id_local) {
              const cur = await readActions();
              if (cur.some((c: any) => c.type === 'create' && c.id && String(c.id) === String(action.id_local))) {
                continue;
              }
            }
            continue;
          }
          console.log('Actualizando firma evaluación de personal:', action.evaluationId, action.field);
          const result = await updateStaffEvaluationSignature({
            evaluationId: Number(action.evaluationId),
            field: action.field,
            value: action.value ?? '',
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            actions = await readActions();
            const updatedActions = actions.filter(
              (a: any) =>
                !(
                  a.type === 'update' &&
                  a.field === action.field &&
                  Number(a.evaluationId) === Number(action.evaluationId)
                ),
            );
            await saveActions(updatedActions);

            const cacheStr = await AsyncStorage.getItem('evaluations_staff_cache');
            if (cacheStr) {
              try {
                const cache = JSON.parse(cacheStr);
                if (Array.isArray(cache)) {
                  const patch: Record<string, string | null> =
                    action.field === 'firma_empleado'
                      ? { firma_empleado: action.value ?? null }
                      : { firma_empleado_manual: action.value ?? null };
                  const updatedCache = cache.map((e: any) =>
                    Number(e?.id) > 0 && Number(e?.id) === Number(action.evaluationId)
                      ? { ...e, ...patch }
                      : e,
                  );
                  await AsyncStorage.setItem('evaluations_staff_cache', JSON.stringify(updatedCache));
                }
              } catch {
                /* ignore */
              }
            }
          }
        } else if (action.type === 'delete') {
          console.log('Eliminando evaluación de personal:', action.id);
          const result = await deleteStaffEvaluation({
            id: action.id,
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            console.log('Evaluación de personal eliminada correctamente');
            const deletedId = Number(action.id);
            actions = await readActions();
            const updatedActions = actions.filter(
              (a: any) =>
                !(
                  (a.type === 'delete' && Number(a.id) === deletedId) ||
                  (a.type === 'update' && Number(a.evaluationId) === deletedId)
                ),
            );
            await saveActions(updatedActions);

            const cacheStr = await AsyncStorage.getItem('evaluations_staff_cache');
            if (cacheStr) {
              const cache = JSON.parse(cacheStr);
              const updatedCache = cache.filter((e: any) => e.id !== action.id);
              await AsyncStorage.setItem('evaluations_staff_cache', JSON.stringify(updatedCache));
            }
          }
        }
      } catch (error) {
        console.error('Error procesando acción de evaluación de personal:', error);
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

            // Actualizar cache: reemplazar id_local por id real (si el server lo devuelve)
            // También necesitamos recargar desde el servidor para obtener el valor correcto de 'owned'
            if (result.incidentId) {
              const cacheStr = await AsyncStorage.getItem('incidents_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr);
                const updatedCache = cache.map((i: any) => {
                  if (i.id_local && i.id_local === action.id) {
                    return {
                      ...i,
                      id: result.incidentId,
                      id_local: '',
                      owned: true, // Temporalmente true hasta que se recargue desde el servidor
                      corpo_id: action.corpoId != null ? Number(action.corpoId) : i.corpo_id,
                    };
                  }
                  return i;
                });
                await AsyncStorage.setItem('incidents_cache', JSON.stringify(updatedCache));
              }
            }
            if (result.incidentId) {
              const cStr = await AsyncStorage.getItem('incident_contributions_actions');
              if (cStr) {
                try {
                  const cList = JSON.parse(cStr);
                  if (Array.isArray(cList) && cList.length > 0) {
                    const nextC = cList.map((a: any) => {
                      if (a.incidentLocalKey && String(a.incidentLocalKey) === String(action.id)) {
                        return { ...a, incidentId: result.incidentId, incidentLocalKey: undefined };
                      }
                      return a;
                    });
                    await AsyncStorage.setItem('incident_contributions_actions', JSON.stringify(nextC));
                  }
                } catch {
                  /* ignore */
                }
              }
            }
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
        } else if (action.type === 'delete') {
          console.log('Eliminando incidente:', action.id);
          const { deleteIncident } = await import('@/hooks/incidentsFunctions');
          const result = await deleteIncident({
            incidentId: action.id,
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            console.log('Incidente eliminado correctamente');
            const updatedActions = actions.filter((a: any) => !(a.id === action.id && a.type === 'delete'));
            await AsyncStorage.setItem('incidents_actions', JSON.stringify(updatedActions));

            const cacheStr = await AsyncStorage.getItem('incidents_cache');
            if (cacheStr) {
              const cache = JSON.parse(cacheStr);
              const updatedCache = cache.filter((i: any) => i.id !== action.id);
              await AsyncStorage.setItem('incidents_cache', JSON.stringify(updatedCache));
            }
          }
        } else if (action.type === 'delete_file') {
          const { deleteIncidentFile } = await import('@/hooks/incidentsFunctions');
          const result = await deleteIncidentFile({
            incidentId: action.incidentId,
            fileId: action.fileId,
            refreshAccessToken,
            logout,
          });
          if (result.status) {
            const updatedActions = actions.filter(
              (a: any) =>
                !(
                  a.type === 'delete_file' &&
                  a.incidentId === action.incidentId &&
                  a.fileId === action.fileId
                )
            );
            await AsyncStorage.setItem('incidents_actions', JSON.stringify(updatedActions));

            const cacheStrDf = await AsyncStorage.getItem('incidents_cache');
            if (cacheStrDf) {
              try {
                const cache = JSON.parse(cacheStrDf);
                if (Array.isArray(cache)) {
                  const next = cache.map((row: any) => {
                    if (Number(row?.id) !== Number(action.incidentId)) return row;
                    const files = Array.isArray(row.files) ? row.files.filter((f: any) => Number(f?.id) !== Number(action.fileId)) : [];
                    return { ...row, files };
                  });
                  await AsyncStorage.setItem('incidents_cache', JSON.stringify(next));
                }
              } catch {
                /* ignore */
              }
            }
          }
        }
      } catch (error) {
        console.error('Error procesando acción de incidente:', error);
      }
    }
  }

  const checkMutuosAcuerdosActionsCache = async () => {
    if (!employee) return;

    // Mutuos acuerdos ahora es exclusivamente online: limpiar cola/cache legacy.
    const actionsStr = await AsyncStorage.getItem('mutuos_acuerdos_actions');
    const actions = actionsStr ? JSON.parse(actionsStr) : [];
    if (Array.isArray(actions) && actions.length > 0) {
      console.log('Limpiando acciones legacy de mutuos acuerdos (modo online):', actions.length);
      await AsyncStorage.removeItem('mutuos_acuerdos_actions');
    }
    const cacheStr = await AsyncStorage.getItem('mutuos_acuerdos_cache');
    const cache = cacheStr ? JSON.parse(cacheStr) : [];
    if (Array.isArray(cache) && cache.length > 0) {
      await AsyncStorage.removeItem('mutuos_acuerdos_cache');
    }
  }

  const checkIncidentContributionsActionsCache = async () => {
    if (!employee) return;

    const actionsStr = await AsyncStorage.getItem('incident_contributions_actions');
    if (!actionsStr) return;

    let actions = JSON.parse(actionsStr);
    if (!actions || !Array.isArray(actions) || actions.length === 0) return;

    console.log('Sincronizando acciones de aportes:', actions.length);

    const actionsToProcess = [...actions];
    for (const action of actionsToProcess) {
      try {
        if (action.type === 'create') {
          const incCacheStr = await AsyncStorage.getItem('incidents_cache');
          const incCache = incCacheStr ? JSON.parse(incCacheStr) : [];
          let incidentIdResolved = Number(action.incidentId);
          if (!Number.isFinite(incidentIdResolved) || incidentIdResolved <= 0) {
            if (action.incidentLocalKey) {
              const row = (incCache as any[]).find(
                (c) => c?.id_local && String(c.id_local) === String(action.incidentLocalKey)
              );
              if (row && row.id > 0) incidentIdResolved = row.id;
            }
          }
          if (!incidentIdResolved || incidentIdResolved <= 0) {
            continue;
          }
          const { createIncidentContribution } = await import('@/hooks/incidentsFunctions');
          const result = await createIncidentContribution({
            incidentId: incidentIdResolved,
            requestData: action.requestData,
            refreshAccessToken,
            logout,
          });

          if (result?.status) {
            actions = actions.filter((a: any) => !(a.type === 'create' && a.id === action.id));
            await AsyncStorage.setItem('incident_contributions_actions', JSON.stringify(actions));

            if (result.contributionId) {
              const cacheStr = await AsyncStorage.getItem('incidents_cache');
              if (cacheStr) {
                const cache = JSON.parse(cacheStr);
                const updated = Array.isArray(cache)
                  ? cache.map((inc: any) => {
                    const matchRow =
                      inc?.id === incidentIdResolved ||
                      (action.incidentLocalKey &&
                        inc?.id_local &&
                        String(inc.id_local) === String(action.incidentLocalKey));
                    if (!matchRow) return inc;
                    const aportes = Array.isArray(inc?.aportes) ? inc.aportes : [];
                    const updatedAportes = aportes.map((a: any) => {
                      if (a?.id_local && a.id_local === action.id) {
                        return { ...a, id: result.contributionId, id_local: '' };
                      }
                      return a;
                    });
                    const nextRow =
                      inc?.id > 0
                        ? inc
                        : { ...inc, id: incidentIdResolved, id_local: '' };
                    return { ...nextRow, aportes: updatedAportes };
                  })
                  : cache;
                await AsyncStorage.setItem('incidents_cache', JSON.stringify(updated));
              }
            }
          }
        } else if (action.type === 'update') {
          const { updateIncidentContribution } = await import('@/hooks/incidentsFunctions');
          const result = await updateIncidentContribution({
            incidentId: action.incidentId,
            contributionId: action.contributionId,
            requestData: action.requestData,
            refreshAccessToken,
            logout,
          });

          if (result?.status) {
            actions = actions.filter((a: any) => !(a.type === 'update' && a.incidentId === action.incidentId && a.contributionId === action.contributionId));
            await AsyncStorage.setItem('incident_contributions_actions', JSON.stringify(actions));
          }
        } else if (action.type === 'delete') {
          const { deleteIncidentContribution } = await import('@/hooks/incidentsFunctions');
          const result = await deleteIncidentContribution({
            incidentId: action.incidentId,
            contributionId: action.contributionId,
            refreshAccessToken,
            logout,
          });

          if (result?.status) {
            actions = actions.filter((a: any) => !(a.type === 'delete' && a.incidentId === action.incidentId && a.contributionId === action.contributionId));
            await AsyncStorage.setItem('incident_contributions_actions', JSON.stringify(actions));

            const cacheStr = await AsyncStorage.getItem('incidents_cache');
            if (cacheStr) {
              const cache = JSON.parse(cacheStr);
              const updated = Array.isArray(cache)
                ? cache.map((inc: any) => {
                  if (inc?.id !== action.incidentId) return inc;
                  const aportes = Array.isArray(inc?.aportes) ? inc.aportes : [];
                  const updatedAportes = aportes.filter((a: any) => a?.id !== action.contributionId);
                  return { ...inc, aportes: updatedAportes };
                })
                : cache;
              await AsyncStorage.setItem('incidents_cache', JSON.stringify(updated));
            }
          }
        } else if (action.type === 'delete_file') {
          const { deleteIncidentContributionFile } = await import('@/hooks/incidentsFunctions');
          const result = await deleteIncidentContributionFile({
            incidentId: action.incidentId,
            contributionId: action.contributionId,
            fileId: action.fileId,
            refreshAccessToken,
            logout,
          });

          if (result?.status) {
            actions = actions.filter((a: any) => !(a.type === 'delete_file' && a.incidentId === action.incidentId && a.contributionId === action.contributionId && a.fileId === action.fileId));
            await AsyncStorage.setItem('incident_contributions_actions', JSON.stringify(actions));

            const cacheStr = await AsyncStorage.getItem('incidents_cache');
            if (cacheStr) {
              const cache = JSON.parse(cacheStr);
              const updated = Array.isArray(cache)
                ? cache.map((inc: any) => {
                  if (inc?.id !== action.incidentId) return inc;
                  const aportes = Array.isArray(inc?.aportes) ? inc.aportes : [];
                  const updatedAportes = aportes.map((ap: any) => {
                    if (ap?.id !== action.contributionId) return ap;
                    const files = Array.isArray(ap?.files) ? ap.files : [];
                    return { ...ap, files: files.filter((f: any) => f?.id !== action.fileId) };
                  });
                  return { ...inc, aportes: updatedAportes };
                })
                : cache;
              await AsyncStorage.setItem('incidents_cache', JSON.stringify(updated));
            }
          }
        }
      } catch (error) {
        console.error('Error procesando acción de aporte:', error);
      }
    }
  };

  const checkVoiceNotesActionsCache = async () => {
    if (!employee) return;

    const actionsStr = await AsyncStorage.getItem('voice_notes_actions');
    if (!actionsStr) return;

    const raw = JSON.parse(actionsStr);
    if (!Array.isArray(raw) || raw.length === 0) return;

    const seenDeleteNote = new Set<number>();
    let actions = raw.filter((a: any) => {
      if (a?.type === 'delete' && a.id != null) {
        const nid = Number(a.id);
        if (!Number.isFinite(nid)) return true;
        if (seenDeleteNote.has(nid)) return false;
        seenDeleteNote.add(nid);
      }
      return true;
    });

    if (actions.length !== raw.length) {
      if (actions.length === 0) {
        await AsyncStorage.removeItem('voice_notes_actions');
        return;
      }
      await AsyncStorage.setItem('voice_notes_actions', JSON.stringify(actions));
    }

    console.log('Sincronizando acciones de notas de voz:', actions.length);

    for (const action of actions) {
      try {
        if (action.type === 'create') {
          console.log('Creando nota de voz:', action.id);
          const rawRd = { ...(action.requestData || {}) };
          const localAudio =
            rawRd.audio_local_file != null && String(rawRd.audio_local_file).trim() !== ''
              ? String(rawRd.audio_local_file).trim()
              : null;
          if (localAudio) {
            try {
              const g = await getFile(localAudio);
              rawRd.file_base64 = g.base64;
            } catch (e) {
              console.warn('Sincronización nota de voz (create): no se pudo leer audio local', e);
              continue;
            }
            delete rawRd.audio_local_file;
          }
          const result = await createVoiceNote({
            requestData: rawRd,
            marcaId: action.marcaId,
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            console.log('Nota de voz creada correctamente');
            const sid = Number(
              (result as { id?: number }).id ??
                (result as { data?: { id?: number } }).data?.id
            );
            if (Number.isFinite(sid) && sid > 0 && action.id != null) {
              const cacheStr = await AsyncStorage.getItem('voice_notes_cache');
              let arr: any[] = cacheStr ? JSON.parse(cacheStr) : [];
              if (!Array.isArray(arr)) arr = [];
              const localKey = String(action.id);
              arr = arr.map((v) => {
                if (v != null && String(v.id_local) === localKey) {
                  return {
                    ...v,
                    id: sid,
                    id_local: '',
                    file_base64: '',
                    local_audio_file: undefined,
                    isActive: true,
                  };
                }
                return v;
              });
              await AsyncStorage.setItem('voice_notes_cache', JSON.stringify(arr));
            }
            if (localAudio) {
              try {
                await deleteFile(localAudio);
              } catch {
                /* idempotente */
              }
            }
            const updatedActions = actions.filter(
              (a: any) => !(a.type === 'create' && String(a.id) === String(action.id))
            );
            await AsyncStorage.setItem('voice_notes_actions', JSON.stringify(updatedActions));
          }
        } else if (action.type === 'update') {
          console.log('Actualizando nota de voz:', action.id);
          const result = await updateVoiceNote({
            voiceNoteId: Number(action.id),
            payload: action.payload || {},
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            const updatedActions = actions.filter((a: any) => a.id !== action.id || a.type !== 'update');
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
            const nid = Number(action.id);
            const updatedActions = actions.filter(
              (a: any) =>
                !(
                  (a.type === 'delete' && Number(a.id) === nid) ||
                  (a.type === 'update' && Number(a.id) === nid)
                )
            );
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
          const connectivity = await resolveAppConnectivity();
          if (!connectivity.ok) {
            Alert.alert(
              'Sin conexión',
              connectivity.reason === 'force_offline'
                ? 'Modo offline forzado (pruebas). Desactiva FORCE_OFFLINE en syncFlags para verificar el enlace.'
                : 'No hay conexión a internet para verificar el enlace de recuperación.'
            );
            return;
          }
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
    const connectivity = await resolveAppConnectivity();
    console.log('Intentando actualizar hora de acción...');
    //await updateServerTime();

    const horaAccion = await getHoraAccion();
    return horaAccion;
  }

  const checkLunchTime = useCallback(async (
    temp_state: any,
    employeeId?: string,
    refreshAccessTokenFn?: () => Promise<boolean>,
    logoutFn?: () => Promise<{ status: boolean; message: string }>
  ) => {
    const stillRaw = await AsyncStorage.getItem('temp_state');
    if (!stillRaw) return;

    let stillParsed: any;
    try {
      stillParsed = JSON.parse(stillRaw);
    } catch {
      return;
    }
    if (!stillParsed?.running) return;

    const acquired = await tryAcquireLunchTimerCompletionLock();
    if (!acquired) return;

    try {
      const startTime = new Date(temp_state.startTime).getTime();
      const endTimeMs = computeLunchEndTimeMs(temp_state);
      const firma_empleado = temp_state.firma_empleado;

      const requestData: Record<string, any> = {
        empleadoId: employeeId,
        inicio: new Date(startTime),
        fin: new Date(endTimeMs),
        pausas: JSON.stringify(temp_state.inactivities ?? []),
        es_manual: false,
        firma_empleado: firma_empleado,
      };

      await mergeCurrentMarcaHierarchyIntoLunchRequest(requestData);

      const marcaId = Number(requestData.marca_id);
      if (!Number.isFinite(marcaId) || marcaId <= 0) {
        console.warn('[lunchTimer] No se encontró marca_id para completar el almuerzo');
        return;
      }

      const lunchConnectivity = await resolveAppConnectivity();
      if (lunchConnectivity.ok) {
        const responseData = await saveLunchTime({
          requestData,
          employeeId,
          refreshAccessToken: refreshAccessTokenFn,
          logout: logoutFn,
        });

        if (!responseData.status) {
          Alert.alert('Error', responseData.message);
          return;
        }

        await AsyncStorage.removeItem('temp_state');

        await markLunchTimeAsCompleted();

        Alert.alert(
          '🎉 ¡Tiempo de alimentación completado!',
          'Tu descanso ha terminado. ¡Es hora de volver al trabajo!',
          [{ text: 'OK', onPress: async () => {} }]
        );
      } else {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let localId = '';
        for (let i = 0; i < 10; i++) {
          localId += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        const actionsStr = await AsyncStorage.getItem('lunchtime_actions');
        const actions = actionsStr ? JSON.parse(actionsStr) : [];
        actions.push({
          requestData,
          id: localId,
          type: 'create',
        });
        await AsyncStorage.setItem('lunchtime_actions', JSON.stringify(actions));

        await AsyncStorage.removeItem('temp_state');
        await markLunchTimeAsCompleted();
        Alert.alert(
          'Modo Offline',
          'Tu descanso ha terminado. El registro se sincronizará cuando haya conexión.',
          [{ text: 'OK', onPress: async () => {} }]
        );
      }
    } finally {
      await releaseLunchTimerCompletionLock();
    }
  }, []);

  const lunchTimerPollInFlightRef = useRef(false);

  // Comprueba cada 30 s si el almuerzo terminó mientras el usuario está fuera del módulo.
  useEffect(() => {
    const pollLunchTimer = async () => {
      if (lunchTimerPollInFlightRef.current) return;

      let horaAccion: number;
      try {
        const connectivity = await resolveAppConnectivity();
        if (connectivity.ok) {
          horaAccion = await getHoraAccion();
        }
        else {
          const server_time = await AsyncStorage.getItem('server_time');
          if (server_time) {
            const server_time_obj = JSON.parse(server_time);
            const t = parseInt(String(server_time_obj.server_time), 10);
            if (Number.isFinite(t)) {
              horaAccion = t;
            }
            else {
              horaAccion = new Date().getTime();
            }
          }
          else {
            horaAccion = new Date().getTime();
          }
        }
      } catch (error) {
        console.error('[lunchTimer] Error obteniendo hora de referencia:', error);
        horaAccion = await getHoraAccion();
      }

      const temp_state_async = await AsyncStorage.getItem('temp_state');
      if (!temp_state_async) return;

      let temp_state: any;
      try {
        temp_state = JSON.parse(temp_state_async);
      } catch {
        return;
      }

      if (!temp_state?.running) return;

      const currentRoute = navigationRef.current?.getCurrentRoute()?.name;
      if (currentRoute === 'LunchTime') return;

      const endTimeMs = computeLunchEndTimeMs(temp_state);
      if (!Number.isFinite(endTimeMs) || endTimeMs > horaAccion) return;

      lunchTimerPollInFlightRef.current = true;
      try {
        await checkLunchTime(temp_state, employee?.id, refreshAccessToken, logout);
      } finally {
        lunchTimerPollInFlightRef.current = false;
      }
    };

    pollLunchTimer();
    const interval = setInterval(pollLunchTimer, 30000);
    return () => clearInterval(interval);
  }, [employee?.id, refreshAccessToken, logout, checkLunchTime]);


  const check_conection_time = async () => {
    console.log('Checking connection time...');
    await updateServerTime();
    const connectivity = await resolveAppConnectivity();
    if (connectivity.ok) {
      await get_notifications();
    }
    
    // Si no existe marca activa, forzar flujo de marcado de ingreso/salida.
    // Se evita redirigir cuando ya estamos en esa pantalla.
    try {
      const currentMarca = await AsyncStorage.getItem('current_marca');
      if (!currentMarca && navigationRef.current && employee?.id != null) {
        const currentRoute = navigationRef.current?.getCurrentRoute?.()?.name;
        if (currentRoute !== 'MarcarIngresoSalida' && currentRoute !== 'Login') {
          console.log("Redireccionamos");
          navigationRef.current?.navigate('MarcarIngresoSalida');
        }
      }
    } catch (e) {
      console.error('Error verificando current_marca tras actualización de hora:', e);
    }
  }

  const alert_lunch_time = async () => {
    try {
      const current_marca = await AsyncStorage.getItem('current_marca');
      if (!current_marca) return;

      const current_marca_obj = JSON.parse(current_marca);
      if (!current_marca_obj || !current_marca_obj.id) return;

      // Bandera: solo si está en true mostramos el recordatorio
      const alertFlag = await AsyncStorage.getItem('alert_lunch_time');
      if (!alertFlag || alertFlag !== 'true') return;

      const fechaRaw = String(current_marca_obj.fecha || '').trim();
      const horaInicioRaw = String(current_marca_obj.hora_inicio || '').trim();
      const horasDuracionRaw = current_marca_obj.horas_duracion;

      if (!fechaRaw || !horaInicioRaw || horasDuracionRaw === undefined || horasDuracionRaw === null) {
        return;
      }

      const horasDuracionNum = Number(horasDuracionRaw);
      if (!Number.isFinite(horasDuracionNum) || horasDuracionNum <= 0) {
        return;
      }

      const fechaPart = fechaRaw.split('T')[0];
      let horaPart = horaInicioRaw;
      if (horaInicioRaw.includes('T')) {
        horaPart = horaInicioRaw.split('T')[1];
      } else if (horaInicioRaw.includes(' ')) {
        horaPart = horaInicioRaw.split(' ')[1];
      }

      const inicioDate = new Date(`${fechaPart}T${horaPart}`);
      if (Number.isNaN(inicioDate.getTime())) return;

      const finDate = new Date(inicioDate.getTime() + horasDuracionNum * 60 * 60 * 1000);
      if (Number.isNaN(finDate.getTime())) return;

      const totalMs = finDate.getTime() - inicioDate.getTime();
      if (!(totalMs > 0)) return;
      const thresholdMs = inicioDate.getTime() + totalMs * 0.75;

      // Hora actual de referencia (servidor/offline) usando getHoraAccion
      const horaAccion = await getUpdatedHoraAccion();
      if (!horaAccion || typeof horaAccion !== 'number') return;

      if (horaAccion >= thresholdMs) {
        Alert.alert(
          'Recordatorio de alimentación',
          'Ya cumpliste el 75% de tu jornada. Recuerda tomar tu tiempo de alimentación.'
        );
        // Desactivar el alert para no volver a mostrarlo
        await AsyncStorage.setItem('alert_lunch_time', 'false');
      }
    } catch (error) {
      console.error('Error alerting lunch time:', error);
    }
  }

  const get_notifications = async () => {
    console.log('+++++++++++++++++++++++++++++++++++++++++ Getting notifications...');
    const planillas_token = await AsyncStorage.getItem('planillas_token');
    console.log('planillas_token:', planillas_token);
    const connectivity = await resolveAppConnectivity();
    if (!connectivity.ok) {
      console.log('[notifications] Omitido: sin conexión', connectivity.reason);
      return;
    }
    const current_marca = await AsyncStorage.getItem('current_marca');
    let employee_id = Number(employee?.id ?? 0);
    let marca_id = 0;
    if (current_marca) {
      const current_marca_obj = JSON.parse(current_marca);
      if (current_marca_obj.id) {
        if (current_marca_obj.hora_inicio_digitada == null || current_marca_obj.hora_salida_digitada != null) {
          marca_id = current_marca_obj.id;
        }
      }
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

    const response = await authedFetchCb({
      url: `${apiUrl}/api/notification?m=${marca_id}&e=${employee_id}`,
      init: {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
    });

    if (!response) {
      // Logout ya fue ejecutado.
      return;
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.status) {

      const serverNotifications = Array.isArray(data.notifications) ? data.notifications : [];
      let mergedNotifications = serverNotifications;

      if (currentNotificationsStr) {
        try {
          const currentNotifications = JSON.parse(currentNotificationsStr);
          if (Array.isArray(currentNotifications)) {
            const localByKey = new Map<string, { watched?: boolean }>(
              currentNotifications.map((n: any) => [
                `${Number(n.id)}:${n.is_plaza ? '1' : '0'}`,
                n,
              ])
            );
            mergedNotifications = serverNotifications.map((serverN: any) => {
              const key = `${Number(serverN.id)}:${serverN.is_plaza ? '1' : '0'}`;
              const local = localByKey.get(key);
              return {
                ...serverN,
                watched: Boolean(local?.watched || serverN.watched),
              };
            });
          }
        } catch {
          mergedNotifications = serverNotifications;
        }
      }

      await AsyncStorage.setItem('notifications', JSON.stringify(mergedNotifications));

      // Contar notificaciones no leídas en la respuesta del servidor
      const newUnwatchedCount = mergedNotifications.filter((n: any) => !n.watched).length;

      // Si hay más notificaciones no leídas en el servidor, recargar la ventana
      if (newUnwatchedCount > currentUnwatchedCount) {
        console.log('Nuevas notificaciones detectadas, recargando...');
        eventBus.emit('notificationsUpdated');
      }

      // Emitir evento para actualizar el contador en AppHeader
      eventBus.emit('notificationsUpdatedCounter');
    }
    else {
      
    }
  }

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const poll = async () => {
      await check_conection_time();
      await alert_lunch_time();
      timeoutId = setTimeout(poll, 30000) as unknown as NodeJS.Timeout;
    };

    if (isConnected) {
      poll(); // ejecuta inmediato
    }

    return () => {
      clearTimeout(timeoutId);
    };
  }, [isConnected]);

  /** Sondeo GPS silencioso cada 30 s → AsyncStorage `last_location` (sin depender de internet). */
  useEffect(() => {
    void updateLastLocation();
    const locationIntervalId = setInterval(() => {
      void updateLastLocation();
    }, 30000);
    return () => clearInterval(locationIntervalId);
  }, []);

  /** Registro FCM tras login / restauración de sesión; se actualiza si cambia current_marca. */
  useEffect(() => {
    if (!employee?.id || !accessToken) return;

    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      try {
        await syncPushDeviceRegistration({
          empleadoId: employee.id,
          accessToken,
          apiUrl: Constants.expoConfig?.extra?.API_SERVER,
        });
      } catch (error) {
        console.error('[push] Error registrando dispositivo:', error);
      }
    };

    void run();
    const onMarcaUpdated = () => {
      void run();
    };
    eventBus.on(CURRENT_MARCA_UPDATED_EVENT, onMarcaUpdated);
    return () => {
      cancelled = true;
      eventBus.off(CURRENT_MARCA_UPDATED_EVENT, onMarcaUpdated);
    };
  }, [employee?.id, accessToken]);

  /** Listeners FCM: primer plano + tap (background/cerrada). */
  useEffect(() => {
    if (!employee?.id) return;

    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      try {
        const data = extractPushData(notification.request.content);
        console.log('[push] Notificación en primer plano:', data);
        eventBus.emit('pushNotificationReceived', {
          title: notification.request.content.title,
          body: notification.request.content.body,
          data,
        });
        // Integración con inbox existente
        eventBus.emit('notificationsUpdated');
        eventBus.emit('notificationsUpdatedCounter');
        eventBus.emit('syncCachesRequested');
      } catch (error) {
        console.error('[push] Error procesando notificación recibida:', error);
      }
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      try {
        const data = extractPushData(response.notification.request.content);
        console.log('[push] Notificación abierta:', data);
        eventBus.emit('pushNotificationOpened', data);

        const target = resolvePushNavigationTarget(data);
        if (target?.screen && navigationRef.current) {
          // Pequeño delay para cold start
          setTimeout(() => {
            try {
              navigationRef.current?.navigate(target.screen as any, target.params as any);
            } catch (navErr) {
              console.warn('[push] No se pudo navegar a', target.screen, navErr);
              navigationRef.current?.navigate('Notifications');
            }
          }, 400);
        }
      } catch (error) {
        console.error('[push] Error procesando apertura de notificación:', error);
      }
    });

    // Cold start: notificación que abrió la app
    void (async () => {
      try {
        const last = await Notifications.getLastNotificationResponseAsync();
        if (!last) return;
        const data = extractPushData(last.notification.request.content);
        const target = resolvePushNavigationTarget(data);
        if (target?.screen) {
          setTimeout(() => {
            try {
              navigationRef.current?.navigate(target.screen as any, target.params as any);
            } catch {
              navigationRef.current?.navigate('Notifications');
            }
          }, 800);
        }
      } catch (error) {
        console.error('[push] Error leyendo última notificación:', error);
      }
    })();

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [employee?.id]);

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

          const currentIndex = (state as any).index ?? routes.length - 1;
          const currentRoute = routes[currentIndex];

          // Mantener siempre exactamente una referencia a Home (si existe)
          // y eliminar del stack cualquier pantalla que no esté enfocada.
          const homeRouteIndex = routes.findIndex((r: typeof routes[number]) => r.name === 'Home');
          const hasHome = homeRouteIndex !== -1;

          const newRoutes: typeof routes = [];

          if (hasHome) {
            // Conservar la primera aparición de Home como base del stack
            newRoutes.push(routes[homeRouteIndex]);
          }

          if (!hasHome) {
            // Si no hay Home en el stack (por ejemplo, en flujo de login),
            // solo conservamos la ruta actual.
            newRoutes.push(currentRoute);
          } else if (currentRoute.name !== 'Home') {
            // Si estamos en otra pantalla distinta de Home, la agregamos
            // encima de Home, quedando como máximo [Home, PantallaActual].
            newRoutes.push(currentRoute);
          }

          // Solo hacemos reset si el stack resultante cambia
          const routesChanged =
            newRoutes.length !== routes.length ||
            newRoutes.some((r: typeof routes[number], idx: number) => r.key !== routes[idx]?.key);

          if (routesChanged) {
            navigationRef.current?.dispatch(
              CommonActions.reset({
                index: newRoutes.length - 1,
                routes: newRoutes,
              })
            );
          }

          routeNameRef.current = navigationRef.current?.getCurrentRoute()?.name;
        }}
      >
        <RootNavigator />
        <StatusBar style="auto" />
      </NavigationContainer>
      <CacheSyncActionsOverlay
        visible={cacheSyncModalVisible}
        fadeAnim={cacheSyncFadeAnim.current}
        onRequestClose={dismissCacheSyncOverlayOnly}
      />
      <CacheSyncActionsOverlay
        visible={hierarchyUpdateModalVisible}
        fadeAnim={hierarchyUpdateFadeAnim.current}
        onRequestClose={dismissHierarchyUpdateOverlayOnly}
        message="Actualizando jerarquía, no cierre la aplicación"
      />
      <PlanillasPasswordRevalidationModal
        visible={showPlanillasRevalidationModal}
        refreshAccessToken={refreshAccessToken}
        logout={logout}
        onSuccess={() => void handlePlanillasRevalidationSuccess()}
        onDismiss={handlePlanillasRevalidationDismiss}
      />
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
