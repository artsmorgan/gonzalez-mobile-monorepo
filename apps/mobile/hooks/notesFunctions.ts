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
    marcaId?: number;
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

        requestData.marca_id = marcaId;

        const response = await fetch(`${apiUrl}/api/puestos/${puestoId}/notas`, {
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
                    return createNote({ requestData, marcaId, puestoId, refreshAccessToken, logout });
                } else if (logout) {
                    await logout();
                    return { status: false, message: 'Sesión expirada' };
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
    marcaId: marcaIdParam,
    refreshAccessToken,
    logout
}: UpdateNoteParams) {
    try {
        // Prefer explicit marcaId (caller already knows it). Fallback to AsyncStorage.
        let marcaId: number | null = (marcaIdParam !== undefined && marcaIdParam !== null) ? Number(marcaIdParam) : null;

        if (!marcaId) {
            const currentMarcaStr = await AsyncStorage.getItem('current_marca');
            if (currentMarcaStr) {
                try {
                    const obj = JSON.parse(currentMarcaStr);
                    const id = obj?.id;
                    if (id !== undefined && id !== null) marcaId = Number(id);
                } catch { /* ignore */ }
            }
        }

        if (!marcaId) {
            const currentMarcaData = await AsyncStorage.getItem('current_marca');
            if (currentMarcaData) {
                try {
                    const currentMarcaDataObject = JSON.parse(currentMarcaData);
                    const id = currentMarcaDataObject?.id;
                    if (id !== undefined && id !== null) marcaId = Number(id);
                } catch { /* ignore */ }
            }
        }

        if (!marcaId) {
            throw new Error('Marca ID not found');
        }

        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) {
            throw new Error('Server URL not configured');
        }

        if (!puestoId) {
            throw new Error('Puesto ID not found');
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

        requestData.marca_id = marcaId;

        const response = await fetch(`${apiUrl}/api/puestos/${puestoId}/notas/${noteId}`, {
            method: 'PUT',
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
                    return updateNote({ requestData, noteId, puestoId, marcaId, refreshAccessToken, logout });
                } else if (logout) {
                    await logout();
                    return { status: false, message: 'Sesión expirada' };
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
        return data;
    } catch (error) {
        console.error('Error updating note:', error);
        return { status: false, message: 'Error al actualizar la nota' };
    }
}

