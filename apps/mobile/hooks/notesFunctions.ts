import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

interface CreateNoteParams {
    requestData: any;
    marcaId: number;
    puestoId: number;
    refreshAccessToken?: () => Promise<boolean>;
    logout?: () => Promise<{ status: boolean; message: string }>;
}

interface UpdateNoteParams {
    requestData: any;
    noteId: number;
    puestoId: number;
    refreshAccessToken?: () => Promise<boolean>;
    logout?: () => Promise<{ status: boolean; message: string }>;
}

export async function createNote({
    requestData,
    marcaId,
    puestoId,
    refreshAccessToken,
    logout
}: CreateNoteParams) {
    try {
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) {
            throw new Error('Server URL not configured');
        }

        if (!marcaId) {
            throw new Error('Marca ID not found');
        }

        if (!puestoId) {
            throw new Error('Puesto ID not found');
        }
        
        const token = await AsyncStorage.getItem('access_token');
        if (!token) {
            throw new Error('No authentication token found');
        }
        
        const response = await fetch(`${apiUrl}/api/puestos/${puestoId}/notas`, {
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
                    return createNote({ requestData, marcaId, puestoId, refreshAccessToken, logout });
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
        console.error('Error creating note:', error);
        return { status: false, message: 'Error al crear la nota' };
    }
}

export async function updateNote({
    requestData,
    noteId,
    puestoId,
    refreshAccessToken,
    logout
}: UpdateNoteParams) {
    try {
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) {
            throw new Error('Server URL not configured');
        }

        if (!puestoId) {
            throw new Error('Puesto ID not found');
        }
        
        const token = await AsyncStorage.getItem('access_token');
        if (!token) {
            throw new Error('No authentication token found');
        }
        
        const response = await fetch(`${apiUrl}/api/puestos/${puestoId}/notas/${noteId}`, {
            method: 'PUT',
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
                    return updateNote({ requestData, noteId, puestoId, refreshAccessToken, logout });
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
        console.error('Error updating note:', error);
        return { status: false, message: 'Error al actualizar la nota' };
    }
}

