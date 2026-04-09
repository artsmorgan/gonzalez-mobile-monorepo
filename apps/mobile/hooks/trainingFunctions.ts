import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import authedFetch from "./authedFetch";

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

        if (!refreshAccessToken || !logout) {
            throw new Error('Auth handlers not provided');
        }

        const response = await authedFetch({
            url: `${apiUrl}/api/training`,
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
        console.error('Error creating training:', error);
        return { status: false, message: 'Error al crear la capacitación' };
    }
}

export async function deleteTraining({
    trainingId,
    refreshAccessToken,
    logout,
}: {
    trainingId: number;
    refreshAccessToken?: () => Promise<boolean>;
    logout?: () => Promise<{ status: boolean; message: string }>;
}) {
    try {
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) {
            throw new Error('Server URL not configured');
        }
        if (!refreshAccessToken || !logout) {
            throw new Error('Auth handlers not provided');
        }
        const response = await authedFetch({
            url: `${apiUrl}/api/training/${trainingId}`,
            init: { method: 'DELETE' },
            refreshAccessToken,
            logout,
        });
        if (!response) {
            return { status: false, message: 'Sesión expirada' };
        }
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return {
                status: false,
                message: (data as { message?: string })?.message || `Error ${response.status}`,
            };
        }
        return data;
    } catch (error) {
        console.error('Error deleting training:', error);
        return { status: false, message: 'Error al eliminar la capacitación' };
    }
}

