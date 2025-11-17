import 'react-native-gesture-handler';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import React, { useEffect, useRef } from 'react';
import { NavigationContainer, DarkTheme, DefaultTheme, CommonActions } from '@react-navigation/native';
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
import { createSurvey as createSurveyAPI } from './hooks/surveysFunctions';
import { createTraining } from './hooks/trainingFunctions';
import { createVoiceNote, deleteVoiceNote } from './hooks/voiceNotesFunctions';
import { eventBus } from './hooks/eventBus';
// Import screens
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
// import SurveysScreen from './screens/SurveysScreen'; // TODO: Create this screen
import TrainingsScreen from './screens/TrainingsScreen';
import VoiceNotesScreen from './screens/VoiceNotesScreen';
import SatisfactionSurveysScreen from './screens/SatisfactionSurveysScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import saveManualSignature from './hooks/saveManualSignature';
import saveMarca from './hooks/saveMarca';
import saveAbsentReason from './hooks/saveAbsentReason';

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
  Surveys: undefined;
  Trainings: undefined;
  VoiceNotes: undefined;
  SatisfactionSurveys: undefined;
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
      {/* <Stack.Screen name="Surveys" component={SurveysScreen} /> */}
      <Stack.Screen name="Trainings" component={TrainingsScreen} />
      <Stack.Screen name="VoiceNotes" component={VoiceNotesScreen} />
      <Stack.Screen name="SatisfactionSurveys" component={SatisfactionSurveysScreen} />
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
          checkVehiclesActionsCache(),
          checkVisitorsActionsCache(),
          checkNotesActionsCache(),
          checkActivitiesActionsCache(),
          checkEvaluationsActionsCache(),
          checkSurveysActionsCache(),
          checkTrainingsActionsCache(),
          checkIncidentsActionsCache(),
          checkVoiceNotesActionsCache()
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
        if (action.type === 'create') {
          console.log('Creando evaluación:', action.id);
          const { createEvaluation } = await import('@/hooks/evaluationFunctions');
          const result = await createEvaluation({
            requestData: action.requestData,
            refreshAccessToken,
            logout,
          });

          if (result.status) {
            console.log('Evaluación creada correctamente');
            // Eliminar acción del array
            const updatedActions = actions.filter((a: any) => a.id !== action.id || a.type !== 'create');
            await AsyncStorage.setItem('evaluations_actions', JSON.stringify(updatedActions));
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
      if (current != 'LunchTime' && !exist_lunch_time) {
        console.log(4);
        await checkLunchTime(temp_state, employee?.id, refreshAccessToken, logout);
      }
    };

    // Ejecuta una vez al inicio
    fetchData();

    // Ejecuta cada 30 segundos (30,000 ms)
    const interval = setInterval(fetchData, 30000);

    // Limpieza al desmontar el componente
    return () => clearInterval(interval);
  }, []);
  
  // ✅ Aquí agregas la función que se ejecutará cada 30 segundos
  useEffect(() => {
    // Define la función de consulta (puedes personalizarla)
    const get_server_time = async () => {
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) {
        throw new Error('Server URL not configured');
      }
      const response = await fetch(`${apiUrl}/api/server-time`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '69420',
        },
      });
      const data = await response.json();

      if (data.status) {
        await AsyncStorage.setItem('server_time', data.current_time.toString());
        await AsyncStorage.removeItem('disconnected_info');
      }
    };

    const set_disconnected_time = async () => {
      const disconnected_info = await AsyncStorage.getItem('disconnected_info');
      let disconnected_info_obj = { time: new Date().getTime(), count: 0 };
      if (disconnected_info) {
        disconnected_info_obj = JSON.parse(disconnected_info);
        const new_date = new Date().getTime();
        let diff_time = 0;
        if (new_date >= disconnected_info_obj.time) {
          diff_time = new_date - disconnected_info_obj.time;
        }
        else {
          diff_time = disconnected_info_obj.time - new_date;
        }
        
        disconnected_info_obj.count += diff_time;
        disconnected_info_obj.time = new_date;
      }
      await AsyncStorage.setItem('disconnected_info', JSON.stringify(disconnected_info_obj));
    };

    // Ejecuta una vez al inicio

    const check_conection_time = async () => {
      console.log('Checking connection time...');
      if (isConnected) {
        get_server_time();
      }
      else {
        set_disconnected_time();
      }
    }

    check_conection_time();

    // Ejecuta cada 60 segundos (60,000 ms)
    const interval = setInterval(check_conection_time, 60000);

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
        
    Alert.alert(
      '🎉 ¡Tiempo de Almuerzo Completado!',
      'Tu descanso ha terminado. ¡Es hora de volver al trabajo!',
      [
        {
          text: 'OK',
          onPress: async () => {
            await AsyncStorage.removeItem('temp_state');
          },
        },
      ]
    );
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
