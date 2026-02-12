import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import authedFetch from "./authedFetch";

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
        if (!refreshAccessToken || !logout) {
            throw new Error('Auth handlers not provided');
        }

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

        const response = await authedFetch({
            url: `${apiUrl}/api/attendance/${marcaId}/absent-reason`,
            init: {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ reason }),
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

        if (data.status) {
            await AsyncStorage.removeItem('absent_reason_cache');
        }

        return data;
    } catch (error) {
        console.error('Error saving absent reason:', error);
        return { status: false, message: 'Error al guardar el motivo de ausencia' };
    }
}