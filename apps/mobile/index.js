import 'react-native-gesture-handler';
import 'react-native-get-random-values';
// Antes de cargar la app: las llaves sensibles de la sesión (tokens, empleado) pasan a expo-secure-store antes de que la app lea AsyncStorage.
import './hooks/installSecureStorage';
// Cabeceras de dispositivo y de evidencia (ubicación, hora) en todas las peticiones a la API.
import './hooks/installEvidenceFetch';
// Colas sin conexión (*_actions): propietario en cada acción y sin el token de Planillas (issues #176 y #170).
import './hooks/installQueueOwnership';
// Las acciones que se guardan sin conexión (*_actions) se sellan con la ubicación y la hora de ese momento, no las de la sincronización.
import './hooks/installEvidenceQueue';
// Versión web: React Native Web no implementa Alert.alert (mensajes y confirmaciones, como «Cerrar sesión», no aparecían). En el teléfono no hace nada.
import { installWebAlert } from './utils/installWebAlert';
import { registerRootComponent } from 'expo';
import App from './App';

installWebAlert();
registerRootComponent(App);
