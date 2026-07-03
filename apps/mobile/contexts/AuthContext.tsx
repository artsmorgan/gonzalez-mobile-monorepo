import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import React, { createContext, ReactNode, useContext, useEffect, useState, useRef } from 'react';
import { eventBus } from '../hooks/eventBus';
import { resolveAppConnectivity } from '../hooks/resolveAppConnectivity';
import * as Device from 'expo-device';
import {
  MAIN_STRUCTURE_FRAG_ASYNC_PREFIX,
  MAIN_STRUCTURE_SWEEP_PRESERVE_ASYNC_KEYS,
} from '@/hooks/mainStructureFragmentsStorage';

interface Role {
  id: number;
  name: string;
}

interface Division {
  id: number;
  name: string;
}

interface EmployeeRole {
  role: Role;
  division: Division;
}

interface ServerEmpleado {
  id: string;
  cedula: string;
  nombre: string;
  apellido: string;
  segundo_apellido?: string;
  Email: string;
  telefono?: string;
  tipoCedula?: string;
  fechaContratacion?: string;
  roles?: EmployeeRole[];
}

interface Employee {
  id: string;
  name: string;
  email: string;
  cedula: string;
  telefono: string;
  tipoCedula?: string;
  fechaContratacion: string;
  roles: EmployeeRole[];
  firmaManual: string;
  supervisor_id: number | null;
}

interface AuthContextType {
  employee: Employee | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenCreatedAt: number | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (cedula: string, password: string) => Promise<{ success: boolean; passwordExpired?: boolean; error?: string }>;
  logout: () => Promise<{ status: boolean; message: string }>;
  refreshAccessToken: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const PLANILLAS_TOKEN_TOKEN_KEY = 'planillas_token';
const PLANILLAS_TOKEN_EXPIRES_AT_TOKEN_KEY = 'planillas_token_expires_at';
const EMPLOYEE_KEY = 'employee_data';
const TOKEN_CREATED_AT_KEY = 'token_created_at';

async function parseJsonResponseSafe(response: Response): Promise<{ data: any | null; raw: string }> {
  const raw = await response.text();
  if (!raw || raw.trim().length === 0) {
    return { data: null, raw: '' };
  }
  try {
    return { data: JSON.parse(raw), raw };
  } catch {
    return { data: null, raw };
  }
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [planillasToken, setPlanillasToken] = useState<string | null>(null);
  const [planillasTokenExpiresAt, setPlanillasTokenExpiresAt] = useState<string | null>(null);
  const [tokenCreatedAt, setTokenCreatedAt] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isRefreshingRef = useRef(false);
  const refreshPromiseRef = useRef<Promise<boolean> | null>(null);

  const isAuthenticated = !!employee && !!accessToken;

  // Load stored authentication data on app start
  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const [storedAccessToken, storedRefreshToken, storedEmployee, storedTokenCreatedAt, storedPlanillasToken, storedPlanillasTokenExpiresAt] = await Promise.all([
        AsyncStorage.getItem(ACCESS_TOKEN_KEY),
        AsyncStorage.getItem(REFRESH_TOKEN_KEY),
        AsyncStorage.getItem(EMPLOYEE_KEY),
        AsyncStorage.getItem(TOKEN_CREATED_AT_KEY),
        AsyncStorage.getItem(PLANILLAS_TOKEN_TOKEN_KEY),
        AsyncStorage.getItem(PLANILLAS_TOKEN_EXPIRES_AT_TOKEN_KEY),
      ]);

      if (storedAccessToken && storedEmployee) {
        setAccessToken(storedAccessToken);
        setRefreshToken(storedRefreshToken);
        setEmployee(JSON.parse(storedEmployee));
        if (storedTokenCreatedAt) {
          const parsed = parseInt(storedTokenCreatedAt, 10);
          if (!Number.isNaN(parsed)) setTokenCreatedAt(parsed);
        }
        if (storedPlanillasToken && storedPlanillasTokenExpiresAt) {
          setPlanillasToken(storedPlanillasToken);
          setPlanillasTokenExpiresAt(storedPlanillasTokenExpiresAt);
        }
      }
    } catch (error) {
      console.error('Error loading stored auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (cedula: string, password: string): Promise<{ success: boolean; passwordExpired?: boolean; error?: string }> => {
    try {
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) {
        return { success: false, error: 'Server URL not configured' };
      }

      console.log(Device.brand);
      console.log(Device.modelName);

      const response = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '69420'
        },
        body: JSON.stringify({
          cedula: cedula,
          password: password,
          deviceName: `${Device.brand}-${Device.modelName}`
        }),
      });

      const { data: responseData, raw: responseRaw } = await parseJsonResponseSafe(response);
      if (!responseData) {
        const compactRaw = String(responseRaw || '').replace(/\s+/g, ' ').trim();
        console.error('Error parsing login response: non-JSON payload:', compactRaw.slice(0, 300));
        if (!response.ok) {
          return { success: false, error: compactRaw || `Error HTTP ${response.status}` };
        }
        return { success: false, error: 'Respuesta inválida del servidor (no JSON)' };
      }

      if (!response.ok) {
        return { success: false, error: responseData?.message || 'Error de autenticación' };
      }

      if (!responseData.status) {
        return { success: false, passwordExpired: responseData.passwordExpired || false, error: responseData.message || 'Error de autenticación' };
      }

      const empleadoData = responseData.empleado;

      // Use real tokens from server response
      const accessToken = responseData.accessToken;
      const refreshToken = responseData.refreshToken;
      const tokenCreatedAt = responseData.createdAt;
      const planillasToken = responseData.planillasToken;
      const planillasTokenExpiresAt = responseData.planillasTokenExpiresAt;

      if (!accessToken || !refreshToken) {
        return { success: false, passwordExpired: false, error: 'Tokens no recibidos del servidor' };
      }

      // Create employee object from server empleado data
      const employeeData: Employee = {
        id: empleadoData.id,
        name: `${empleadoData.nombre} ${empleadoData.apellido} ${empleadoData.segundo_apellido || ''}`.trim(),
        email: empleadoData.Email,
        cedula: empleadoData.cedula,
        telefono: empleadoData.telefono || '',
        tipoCedula: empleadoData.tipoCedula || '',
        fechaContratacion: empleadoData.fechaContratacion || null, // Format YYYY-MM-DD
        roles: empleadoData.roles || [],
        firmaManual: empleadoData.firmaManual || '',
        supervisor_id: empleadoData.supervisor_id || null,
      };

      // Store tokens and employee data
      await Promise.all([
        AsyncStorage.setItem(ACCESS_TOKEN_KEY, accessToken),
        AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken),
        AsyncStorage.setItem(EMPLOYEE_KEY, JSON.stringify(employeeData)),
        AsyncStorage.setItem(TOKEN_CREATED_AT_KEY, tokenCreatedAt.toString()),
        AsyncStorage.setItem(PLANILLAS_TOKEN_TOKEN_KEY, planillasToken),
        AsyncStorage.setItem(PLANILLAS_TOKEN_EXPIRES_AT_TOKEN_KEY, JSON.stringify(planillasTokenExpiresAt)),
      ]);

      setAccessToken(accessToken);
      setRefreshToken(refreshToken);
      setTokenCreatedAt(tokenCreatedAt);
      setEmployee(employeeData);
      setPlanillasToken(planillasToken);
      setPlanillasTokenExpiresAt(planillasTokenExpiresAt);

      // Tras login: sincronizar cachés pendientes (mismo flujo que reconexión / foco en App.tsx)
      const connectivity = await resolveAppConnectivity();
      if (connectivity.ok) {
        queueMicrotask(() => {
          eventBus.emit('syncCachesRequested');
        });
      }

      const currentMarca = await AsyncStorage.getItem('current_marca');
      if (currentMarca) {
        const currentMarcaData = JSON.parse(currentMarca);
        if (currentMarcaData.empleadoFijo_id !== employeeData.id) {
          const exceptions = [
            'access_token',
            'employee_data',
            'refresh_token',
            'token_created_at',
            'remembered_cedula',
            'server_time',
            'main_structure_created_at',
            'categories_cache',
            'tipo_activos_cache',
            'incidents_classifications_cache',
            'document_types_cache',
            'executives_cache',
            'puestos_corpo_cache',
            'categoria_mantenimiento_cache',
            'tipo_quejas_cache',
            'tipo_clientes_quejas_cache',
            'last_location',
            'monitoring_previous_minutes'
          ];
          const keys = await AsyncStorage.getAllKeys();
    
          const keysToDelete = keys.filter((key) => {
            if (exceptions.includes(key)) return false;
            if (key.startsWith(MAIN_STRUCTURE_FRAG_ASYNC_PREFIX)) return false;
            if (MAIN_STRUCTURE_SWEEP_PRESERVE_ASYNC_KEYS.includes(key)) return false;
            return true;
          });
    
          await AsyncStorage.multiRemove(keysToDelete);
        }
      }

      return { success: true, passwordExpired: false };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, passwordExpired: false, error: 'Error de conexión' };
    }
  };

  const logout = async (): Promise<{ status: boolean; message: string }> => {
    try {
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      let serverResponse = { status: true, message: 'Sesión cerrada correctamente' };

      // Call logout API if we have a refresh token
      if (refreshToken && apiUrl) {
        try {
          const response = await fetch(`${apiUrl}/api/auth/logout`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'ngrok-skip-browser-warning': '69420'
            },
            body: JSON.stringify({
              refreshToken: refreshToken
            }),
          });

          const { data: responseData, raw } = await parseJsonResponseSafe(response);
          if (responseData && typeof responseData === 'object') {
            serverResponse = responseData;
          } else {
            serverResponse = {
              status: response.ok,
              message: raw?.trim() || (response.ok ? 'Sesión cerrada correctamente' : `Error HTTP ${response.status}`),
            };
          }

        } catch (apiError) {
          console.warn('Logout API call failed:', apiError);
          // Continue with local logout even if API call fails
          serverResponse = { status: true, message: 'Sesión cerrada localmente' };
        }
      }

      // Clear local storage and state
      await Promise.all([
        AsyncStorage.removeItem(ACCESS_TOKEN_KEY),
        AsyncStorage.removeItem(REFRESH_TOKEN_KEY),
        AsyncStorage.removeItem(EMPLOYEE_KEY),
        AsyncStorage.removeItem(TOKEN_CREATED_AT_KEY),
        AsyncStorage.removeItem(PLANILLAS_TOKEN_TOKEN_KEY),
        AsyncStorage.removeItem(PLANILLAS_TOKEN_EXPIRES_AT_TOKEN_KEY),
        AsyncStorage.removeItem('temp_state'),
      ]);

      setAccessToken(null);
      setRefreshToken(null);
      setEmployee(null);
      setTokenCreatedAt(null);
      setPlanillasToken(null);
      setPlanillasTokenExpiresAt(null);

      return serverResponse;
    } catch (error) {
      console.error('Logout error:', error);
      return { status: false, message: 'Error al cerrar sesión' };
    }
  };

  const refreshAccessToken = async (): Promise<boolean> => {
    if (isRefreshingRef.current && refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    isRefreshingRef.current = true;

    const promise = (async () => {
      const ok = await refreshAccessTokenSafe();
      isRefreshingRef.current = false;
      refreshPromiseRef.current = null;
      return ok;
    })();

    refreshPromiseRef.current = promise;
    return promise;
  }

  const refreshAccessTokenSafe = async (): Promise<boolean> => {
    try {
      // Preferir estado, pero hacer fallback a AsyncStorage para evitar false negativos
      // (p.ej. si el estado aún no se cargó en arranque pero AsyncStorage sí tiene el token).
      const tokenToUse = refreshToken || (await AsyncStorage.getItem(REFRESH_TOKEN_KEY));
      if (!tokenToUse) return false;

      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) {
        return false;
      }
      
      console.log(Device.brand);
      console.log(Device.modelName);

      // Make API call to refresh the token
      const response = await fetch(`${apiUrl}/api/auth/refresh-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '69420'
        },
        body: JSON.stringify({
          refreshToken: tokenToUse,
          deviceName: `${Device.brand}-${Device.modelName}`
        }),
      });

      if (!response.ok) {
        return false;
      }

      const { data: responseData, raw } = await parseJsonResponseSafe(response);
      if (!responseData || typeof responseData !== 'object') {
        console.error('Refresh token invalid JSON response:', raw?.slice(0, 300));
        return false;
      }

      if (!responseData.status || !responseData.newAccessToken) {
        // logout
        return false;
      }

      const newAccessToken = responseData.newAccessToken;
      const newRefreshToken = responseData.newRefreshToken;
      const newTokenCreatedAt = responseData.createdAt;

      console.log('newAccessToken', newAccessToken);
      console.log('newRefreshToken', newRefreshToken);
      console.log('tokenCreatedAt', tokenCreatedAt);

      const ops = [AsyncStorage.setItem(ACCESS_TOKEN_KEY, newAccessToken)];

      ops.push(AsyncStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken));

      ops.push(AsyncStorage.setItem(TOKEN_CREATED_AT_KEY, newTokenCreatedAt.toString()));

      await Promise.all(ops);

      setAccessToken(newAccessToken);
      if (newRefreshToken && newRefreshToken !== refreshToken) {
        setRefreshToken(newRefreshToken);
      }

      setTokenCreatedAt(newTokenCreatedAt);

      return true;
    } catch (error) {
      console.error('Token refresh error:', error);
      return false;
    }
  };

  const value: AuthContextType = {
    employee,
    accessToken,
    refreshToken,
    tokenCreatedAt,
    isLoading,
    isAuthenticated,
    login,
    logout,
    refreshAccessToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

