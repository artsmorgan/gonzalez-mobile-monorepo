import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

interface CreateVoiceNoteParams {
    requestData: any;
    marcaId: number;
    refreshAccessToken?: () => Promise<boolean>;
    logout?: () => Promise<{ status: boolean; message: string }>;
}

interface DeleteVoiceNoteParams {
    voiceNoteId: number;
    refreshAccessToken?: () => Promise<boolean>;
    logout?: () => Promise<{ status: boolean; message: string }>;
}

export async function createVoiceNote({
    requestData,
    marcaId,
    refreshAccessToken,
    logout
}: CreateVoiceNoteParams) {
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
        
        const response = await fetch(`${apiUrl}/api/voice-notes`, {
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
                    return createVoiceNote({ requestData, marcaId, refreshAccessToken, logout });
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
        return data;
    } catch (error) {
        console.error('Error creating voice note:', error);
        return { status: false, message: 'Error al crear la nota de voz' };
    }
}

export async function deleteVoiceNote({
    voiceNoteId,
    refreshAccessToken,
    logout
}: DeleteVoiceNoteParams) {
    try {
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) {
            throw new Error('Server URL not configured');
        }
        
        const token = await AsyncStorage.getItem('access_token');
        if (!token) {
            throw new Error('No authentication token found');
        }
        
        const response = await fetch(`${apiUrl}/api/voice-notes/${voiceNoteId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': '69420',
            },
        });
    
        if (response.status === 401 || response.status === 403) {
            if (refreshAccessToken) {
                const refreshed = await refreshAccessToken();
                if (refreshed) {
                    return deleteVoiceNote({ voiceNoteId, refreshAccessToken, logout });
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
        return data;
    } catch (error) {
        console.error('Error deleting voice note:', error);
        return { status: false, message: 'Error al eliminar la nota de voz' };
    }
}
