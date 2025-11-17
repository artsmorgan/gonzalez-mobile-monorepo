import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';

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
const EMPLOYEE_KEY = 'employee_data';

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!employee && !!accessToken;

  // Load stored authentication data on app start
  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const [storedAccessToken, storedRefreshToken, storedEmployee] = await Promise.all([
        AsyncStorage.getItem(ACCESS_TOKEN_KEY),
        AsyncStorage.getItem(REFRESH_TOKEN_KEY),
        AsyncStorage.getItem(EMPLOYEE_KEY),
      ]);

      if (storedAccessToken && storedEmployee) {
        setAccessToken(storedAccessToken);
        setRefreshToken(storedRefreshToken);
        setEmployee(JSON.parse(storedEmployee));
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

      const response = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '69420'
        },
        body: JSON.stringify({
          cedula: cedula,
          password: password
        }),
      });

      if (!response.ok) {
        const responseData = await response.json();
        return { success: false, error: responseData.message };
      }

      const responseData = await response.json();

      if (!responseData.status) {
        return { success: false, passwordExpired: responseData.passwordExpired || false, error: responseData.message || 'Error de autenticación' };
      }

      const empleadoData = responseData.empleado;
      
      // Use real tokens from server response
      const accessToken = responseData.accessToken;
      const refreshToken = responseData.refreshToken;
      
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
      ]);

      setAccessToken(accessToken);
      setRefreshToken(refreshToken);
      setEmployee(employeeData);

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

          const responseData = await response.json();
          serverResponse = responseData;

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
        AsyncStorage.removeItem('temp_state'),
      ]);

      setAccessToken(null);
      setRefreshToken(null);
      setEmployee(null);

      return serverResponse;
    } catch (error) {
      console.error('Logout error:', error);
      return { status: false, message: 'Error al cerrar sesión' };
    }
  };

  const refreshAccessToken = async (): Promise<boolean> => {
    try {
      if (!refreshToken) {
        return false;
      }

      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) {
        return false;
      }

      // Make API call to refresh the token
      const response = await fetch(`${apiUrl}/api/auth/refresh-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '69420'
        },
        body: JSON.stringify({
          refreshToken: refreshToken
        }),
      });

      const responseData = await response.json();

      if (!responseData.status || !responseData.accessToken) {
        // logout
        return false;
      }

      const newAccessToken = responseData.accessToken;
      const newRefreshToken = responseData.refreshToken || refreshToken; // Use new refresh token if provided, otherwise keep current
      
      await Promise.all([
        AsyncStorage.setItem(ACCESS_TOKEN_KEY, newAccessToken),
        newRefreshToken !== refreshToken && AsyncStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken),
      ].filter(Boolean));

      setAccessToken(newAccessToken);
      if (newRefreshToken !== refreshToken) {
        setRefreshToken(newRefreshToken);
      }
      
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

