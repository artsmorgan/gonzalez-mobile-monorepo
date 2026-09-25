import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import authedFetch from "./authedFetch";
import { parseApiErrorResponse } from "./parseApiErrorResponse";

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

interface DeleteVehicleAttachmentParams {
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

        if (!refreshAccessToken || !logout) {
            throw new Error('Auth handlers not provided');
        }

        const response = await authedFetch({
            url: `${apiUrl}/api/vehicles`,
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
            return parseApiErrorResponse(response, `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error creating vehicle:', error);
        const message = error instanceof Error ? error.message : 'Error al crear el vehículo';
        return { status: false, message };
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

        if (!refreshAccessToken || !logout) {
            throw new Error('Auth handlers not provided');
        }

        const response = await authedFetch({
            url: `${apiUrl}/api/vehicles/${vehicleId}`,
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
            return parseApiErrorResponse(response, `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error updating vehicle:', error);
        const message = error instanceof Error ? error.message : 'Error al actualizar el vehículo';
        return { status: false, message };
    }
}

export async function deleteVehicleAttachment({
    vehicleId,
    refreshAccessToken,
    logout,
}: DeleteVehicleAttachmentParams) {
    try {
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) {
            throw new Error('Server URL not configured');
        }

        if (!refreshAccessToken || !logout) {
            throw new Error('Auth handlers not provided');
        }

        const response = await authedFetch({
            url: `${apiUrl}/api/vehicles/${vehicleId}/attachment`,
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
            return parseApiErrorResponse(response, `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error deleting vehicle attachment:', error);
        const message = error instanceof Error ? error.message : 'Error al eliminar el adjunto';
        return { status: false, message };
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

        if (!refreshAccessToken || !logout) {
            throw new Error('Auth handlers not provided');
        }

        const response = await authedFetch({
            url: `${apiUrl}/api/vehicles/${vehicleId}`,
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
            return parseApiErrorResponse(response, `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error deleting vehicle:', error);
        const message = error instanceof Error ? error.message : 'Error al eliminar el vehículo';
        return { status: false, message };
    }
}