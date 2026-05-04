import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import authedFetch from "./authedFetch";

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

interface DeleteNoteParams {
    noteId: number;
    puestoId: number;
    refreshAccessToken?: () => Promise<boolean>;
    logout?: () => Promise<{ status: boolean; message: string }>;
}

interface DeleteNoteImageParams {
    noteId: number;
    puestoId: number;
    imageId: number;
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

        if (!refreshAccessToken || !logout) {
            throw new Error('Auth handlers not provided');
        }

        requestData.marca_id = marcaId;

        const response = await authedFetch({
            url: `${apiUrl}/api/puestos/${puestoId}/notas`,
            init: {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
            },
            refreshAccessToken,
            logout,
        });

        if (!response) {
            return { status: false, message: 'Sesión expirada' };
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

        if (!refreshAccessToken || !logout) {
            throw new Error('Auth handlers not provided');
        }

        requestData.marca_id = marcaId;

        const response = await authedFetch({
            url: `${apiUrl}/api/puestos/${puestoId}/notas/${noteId}`,
            init: {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
            },
            refreshAccessToken,
            logout,
        });

        if (!response) {
            return { status: false, message: 'Sesión expirada' };
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

export async function deleteNote({
    noteId,
    puestoId,
    refreshAccessToken,
    logout
}: DeleteNoteParams) {
    try {
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) {
            throw new Error('Server URL not configured');
        }

        if (!puestoId) {
            throw new Error('Puesto ID not found');
        }

        if (!refreshAccessToken || !logout) {
            throw new Error('Auth handlers not provided');
        }

        const response = await authedFetch({
            url: `${apiUrl}/api/puestos/${puestoId}/notas/${noteId}`,
            init: {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
            },
            refreshAccessToken,
            logout,
        });

        if (!response) {
            return { status: false, message: 'Sesión expirada' };
        }

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error deleting note:', error);
        return { status: false, message: 'Error al eliminar la nota' };
    }
}

export async function deleteNoteImage({
    noteId,
    puestoId,
    imageId,
    refreshAccessToken,
    logout
}: DeleteNoteImageParams) {
    try {
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) throw new Error('Server URL not configured');
        if (!puestoId) throw new Error('Puesto ID not found');
        if (!noteId) throw new Error('Note ID not found');
        if (!imageId) throw new Error('Image ID not found');
        if (!refreshAccessToken || !logout) throw new Error('Auth handlers not provided');

        const response = await authedFetch({
            url: `${apiUrl}/api/puestos/${puestoId}/notas/${noteId}/images/${imageId}`,
            init: {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
            },
            refreshAccessToken,
            logout,
        });
        if (!response) return { status: false, message: 'Sesión expirada' };
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('Error deleting note image:', error);
        return { status: false, message: 'Error al eliminar el archivo de la nota' };
    }
}

