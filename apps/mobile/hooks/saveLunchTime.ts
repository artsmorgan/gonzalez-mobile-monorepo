import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

interface SaveLunchTimeParams {
    requestData: any;
    employeeId?: string;
    refreshAccessToken?: () => Promise<boolean>;
    logout?: () => Promise<{ status: boolean; message: string }>;
}

export default async function saveLunchTime({
    requestData,
    employeeId,
    refreshAccessToken,
    logout
}: SaveLunchTimeParams) {
    try {
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) {
            throw new Error('Server URL not configured');
        }

        let token = await AsyncStorage.getItem('access_token');
        if (!token) {
            if (refreshAccessToken) {
                const refreshed = await refreshAccessToken();
                if (!refreshed) {
                    if (logout) await logout();
                    throw new Error('Sesión expirada');
                }
                token = await AsyncStorage.getItem('access_token');
            } else {
                if (logout) await logout();
                throw new Error('Sesión expirada');
            }
        }

        if (requestData.empleadoId == 0 && employeeId) {
            requestData.empleadoId = employeeId;
        }
        const response = await fetch(`${apiUrl}/api/lunch-time`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': '69420',
            },
            body: JSON.stringify(requestData),
        });

        if (response.status === 401) {
            if (refreshAccessToken) {
                const refreshed = await refreshAccessToken();
                if (refreshed) {
                    return saveLunchTime({ requestData, employeeId, refreshAccessToken, logout });
                } else if (logout) {
                    // If refresh fails, logout the user
                    await logout();
                }
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

        console.log(data);

        return data;
    } catch (error) {
        console.error('Error saving lunch time:', error);
        return { status: false, message: 'Error al guardar el tiempo de almuerzo' };
    }
}