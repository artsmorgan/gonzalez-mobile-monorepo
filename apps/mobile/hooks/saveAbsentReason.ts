import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

interface saveAbsentReasonParams {
    reason: string;
    marcaId: number;
    refreshAccessToken?: () => Promise<boolean>;
    logout?: () => Promise<{ status: boolean; message: string }>;
}

export default async function saveAbsentReason({
    reason,
    marcaId,
    refreshAccessToken,
    logout
}: saveAbsentReasonParams) {
    try {
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) {
            throw new Error('Server URL not configured');
        }

        if (!reason) {
            throw new Error('Reason not found');
        }

        if (!marcaId) {
            throw new Error('Marca ID not found');
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

        const response = await fetch(`${apiUrl}/api/attendance/${marcaId}/absent-reason`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': '69420',
            },
            body: JSON.stringify({ reason }),
        });

        if (response.status === 401) {
            if (refreshAccessToken) {
                const refreshed = await refreshAccessToken();
                if (refreshed) {
                    return saveAbsentReason({ reason, marcaId, refreshAccessToken, logout });
                } else if (logout) {
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

        if (data.status) {
            await AsyncStorage.removeItem('absent_reason_cache');
        }

        return data;
    } catch (error) {
        console.error('Error saving absent reason:', error);
        return { status: false, message: 'Error al guardar el motivo de ausencia' };
    }
}