import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

type CreateJobManualParams = {
  requestData: any;
  marcaId: number;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
};

type ListJobManualsParams = {
  marcaId: number;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
};

type DeleteJobManualParams = {
  id: number;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
};

type SignJobManualParams = {
  id: number;
  firma: string;
  quizAnswear?: string | null;
  files?: string | null;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
  marcaId: number;
};

type PutQuizResultParams = {
  id: number; // manual id
  marcaId: number;
  empleadoId: number;
  approved: boolean;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<any>;
};

export const createJobManual = async ({
  requestData,
  marcaId,
  refreshAccessToken,
  logout,
}: CreateJobManualParams): Promise<any> => {
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

  const response = await fetch(`${apiUrl}/api/job-manuals`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': '69420',
    },
    body: JSON.stringify({
      ...requestData,
      marca_id: marcaId,
    }),
  });

  if (response.status === 401 || response.status === 403) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return createJobManual({ requestData, marcaId, refreshAccessToken, logout });
    } else {
      await logout();
      return { status: false, message: 'Sesión expirada' };
    }
  }

  const data = await response.json();
  return data;
};

export const listJobManualsByMarca = async ({
  marcaId,
  refreshAccessToken,
  logout,
}: ListJobManualsParams): Promise<any> => {
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

  const response = await fetch(`${apiUrl}/api/job-manuals?m=${marcaId}`, {
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
      return listJobManualsByMarca({ marcaId, refreshAccessToken, logout });
    } else {
      await logout();
      return { status: false, message: 'Sesión expirada' };
    }
  }

  const data = await response.json();
  return data;
};

export const deleteJobManual = async ({
  id,
  refreshAccessToken,
  logout,
}: DeleteJobManualParams): Promise<any> => {
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

  const response = await fetch(`${apiUrl}/api/job-manuals/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': '69420',
    },
  });

  if (response.status === 401 || response.status === 403) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return deleteJobManual({ id, refreshAccessToken, logout });
    } else {
      await logout();
      return { status: false, message: 'Sesión expirada' };
    }
  }

  const data = await response.json();
  return data;
};

export const signJobManual = async ({
  id,
  firma,
  quizAnswear,
  files,
  refreshAccessToken,
  logout,
  marcaId,
}: SignJobManualParams): Promise<any> => {
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

  const response = await fetch(`${apiUrl}/api/job-manuals/${id}/sign`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': '69420',
    },
    body: JSON.stringify({ firma_empleado: firma, marca_id: marcaId, quiz_answear: quizAnswear ?? null, files: files ?? null }),
  });

  if (response.status === 401 || response.status === 403) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return signJobManual({ id, firma, quizAnswear, files, refreshAccessToken, logout, marcaId });
    } else {
      await logout();
      return { status: false, message: 'Sesión expirada' };
    }
  }

  const data = await response.json();
  return data;
};

export const putJobManualQuizResult = async ({
  id,
  marcaId,
  empleadoId,
  approved,
  refreshAccessToken,
  logout,
}: PutQuizResultParams): Promise<any> => {
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

  const response = await fetch(`${apiUrl}/api/job-manuals/${id}/quiz-result`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': '69420',
    },
    body: JSON.stringify({ empleado_id: empleadoId, approved, marca_id: marcaId }),
  });

  if (response.status === 401 || response.status === 403) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return putJobManualQuizResult({ id, marcaId, empleadoId, approved, refreshAccessToken, logout });
    } else {
      await logout();
      return { status: false, message: 'Sesión expirada' };
    }
  }

  const data = await response.json();
  return data;
};


