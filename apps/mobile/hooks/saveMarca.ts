import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

interface saveMarcaParams {
    data_params: {
        type: string;
        reason: string;
        horaAccion: number;
    };
    marcaId: number;
    refreshAccessToken?: () => Promise<boolean>;
    logout?: () => Promise<{ status: boolean; message: string }>;
}

export default async function saveMarca({
    data_params,
    marcaId,
    refreshAccessToken,
    logout
}: saveMarcaParams) {
    try {
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) {
        throw new Error('Server URL not configured');
        }
        
        if (!marcaId) {
        throw new Error('Marca ID not found');
        }
        
        const token = await AsyncStorage.getItem('access_token');
        if (!token) {
        throw new Error('No authentication token found');
        }
        
        const response = await fetch(`${apiUrl}/api/attendance/${marcaId}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': '69420',
        },
        body: JSON.stringify({ type: data_params.type, reason: data_params.reason, horaAccion: data_params.horaAccion }),
        });
    
        if (response.status === 401 || response.status === 403) {
            if (refreshAccessToken) {
                const refreshed = await refreshAccessToken();
                if (refreshed) {
                    return saveMarca({ data_params, marcaId, refreshAccessToken, logout });
                } else if (logout) {
                    await logout();
                }
            }
            }
    
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    
        const data = await response.json();

        if (data.status) {
            await AsyncStorage.removeItem('marca_cache');
        }

        return data;
    } catch (error) {
        console.error('Error saving marca:', error);
        return { status: false, message: 'Error al guardar la marca' };
    }
}