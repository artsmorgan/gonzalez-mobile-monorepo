import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

interface CreateTrainingParams {
    requestData: any;
    marcaId: number;
    refreshAccessToken?: () => Promise<boolean>;
    logout?: () => Promise<{ status: boolean; message: string }>;
}

export async function createTraining({
    requestData,
    marcaId,
    refreshAccessToken,
    logout
}: CreateTrainingParams) {
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
        
        const response = await fetch(`${apiUrl}/api/training`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': '69420',
            },
            body: JSON.stringify(requestData),
        });
    
        if (response.status === 401 || response.status === 403) {
            if (refreshAccessToken) {
                const refreshed = await refreshAccessToken();
                if (refreshed) {
                    return createTraining({ requestData, marcaId, refreshAccessToken, logout });
                } else if (logout) {
                    await logout();
                    return { status: false, message: 'Sesión expirada' };
                }
            }
        }
    
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    
        const data = await response.json();
        console.log(data);
        return data;
    } catch (error) {
        console.error('Error creating training:', error);
        return { status: false, message: 'Error al crear la capacitación' };
    }
}


