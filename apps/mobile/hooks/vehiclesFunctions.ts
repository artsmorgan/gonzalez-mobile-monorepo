import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

interface CreateVehicleParams {
    requestData: any;
    marcaId: number;
    refreshAccessToken?: () => Promise<boolean>;
    logout?: () => Promise<{ status: boolean; message: string }>;
}

interface UpdateVehicleParams {
    requestData: any;
    vehicleId: number;
    marcaId: number;
    refreshAccessToken?: () => Promise<boolean>;
    logout?: () => Promise<{ status: boolean; message: string }>;
}

interface DeleteVehicleParams {
    vehicleId: number;
    refreshAccessToken?: () => Promise<boolean>;
    logout?: () => Promise<{ status: boolean; message: string }>;
}

export async function createVehicle({
    requestData,
    marcaId,
    refreshAccessToken,
    logout
}: CreateVehicleParams) {
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
        
        const response = await fetch(`${apiUrl}/api/vehicles`, {
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
                    return createVehicle({ requestData, marcaId, refreshAccessToken, logout });
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
        console.error('Error creating vehicle:', error);
        return { status: false, message: 'Error al crear el vehículo' };
    }
}

export async function updateVehicle({
    requestData,
    vehicleId,
    marcaId,
    refreshAccessToken,
    logout
}: UpdateVehicleParams) {
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
        
        const response = await fetch(`${apiUrl}/api/vehicles/${vehicleId}`, {
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
                    return updateVehicle({ requestData, vehicleId, marcaId, refreshAccessToken, logout });
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
        console.error('Error updating vehicle:', error);
        return { status: false, message: 'Error al actualizar el vehículo' };
    }
}

export async function deleteVehicle({
    vehicleId,
    refreshAccessToken,
    logout
}: DeleteVehicleParams) {
    try {
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) {
            throw new Error('Server URL not configured');
        }
        
        const token = await AsyncStorage.getItem('access_token');
        if (!token) {
            throw new Error('No authentication token found');
        }
        
        const response = await fetch(`${apiUrl}/api/vehicles/${vehicleId}`, {
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
                    return deleteVehicle({ vehicleId, refreshAccessToken, logout });
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
        console.error('Error deleting vehicle:', error);
        return { status: false, message: 'Error al eliminar el vehículo' };
    }
}