import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';

interface Employee {
  nombre: string;
  primer_apellido: string;
  segundo_apellido: string;
  cedula: string;
  Email: string;
  telefono: string;
  tipoCedula: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  cedula: string;
  telefono: string;
  tipoCedula: string;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (cedula: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<{ status: boolean; message: string }>;
  refreshAccessToken: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_KEY = 'user_data';

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user && !!accessToken;

  // Load stored authentication data on app start
  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const [storedAccessToken, storedRefreshToken, storedUser] = await Promise.all([
        AsyncStorage.getItem(ACCESS_TOKEN_KEY),
        AsyncStorage.getItem(REFRESH_TOKEN_KEY),
        AsyncStorage.getItem(USER_KEY),
      ]);

      if (storedAccessToken && storedUser) {
        setAccessToken(storedAccessToken);
        setRefreshToken(storedRefreshToken);
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error('Error loading stored auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (cedula: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const apiUrl = Constants.expoConfig?.extra?.JSON_WEB_SERVER;
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
          ced: cedula,
          password: password
        }),
      });

      const responseData = await response.json();

      if (!responseData.status) {
        return { success: false, error: responseData.message || 'Error de autenticación' };
      }

      const employeeData: Employee = responseData.employee;
      
      // Use real tokens from server response
      const accessToken = responseData.accessToken;
      const refreshToken = responseData.refreshToken;
      
      if (!accessToken || !refreshToken) {
        return { success: false, error: 'Tokens no recibidos del servidor' };
      }

      // Create user object from employee data
      const userData: User = {
        id: employeeData.cedula,
        name: `${employeeData.nombre} ${employeeData.primer_apellido} ${employeeData.segundo_apellido}`.trim(),
        email: employeeData.Email,
        cedula: employeeData.cedula,
        telefono: employeeData.telefono,
        tipoCedula: employeeData.tipoCedula,
        createdAt: new Date().toISOString(), // Since we don't have this from the API
      };

      // Store tokens and user data
      await Promise.all([
        AsyncStorage.setItem(ACCESS_TOKEN_KEY, accessToken),
        AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken),
        AsyncStorage.setItem(USER_KEY, JSON.stringify(userData)),
      ]);

      setAccessToken(accessToken);
      setRefreshToken(refreshToken);
      setUser(userData);

      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Error de conexión' };
    }
  };

  const logout = async (): Promise<{ status: boolean; message: string }> => {
    try {
      const apiUrl = Constants.expoConfig?.extra?.JSON_WEB_SERVER;
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
        AsyncStorage.removeItem(USER_KEY),
      ]);

      setAccessToken(null);
      setRefreshToken(null);
      setUser(null);

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

      const apiUrl = Constants.expoConfig?.extra?.JSON_WEB_SERVER;
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
    user,
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

