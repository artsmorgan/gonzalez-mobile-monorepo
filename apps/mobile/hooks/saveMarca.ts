import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import authedFetch from "./authedFetch";

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
        if (!refreshAccessToken || !logout) {
            throw new Error('Auth handlers not provided');
        }

        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) {
            throw new Error('Server URL not configured');
        }

        if (!marcaId) {
            throw new Error('Marca ID not found');
        }

        const response = await authedFetch({
            url: `${apiUrl}/api/attendance/${marcaId}`,
            init: {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ type: data_params.type, reason: data_params.reason, horaAccion: data_params.horaAccion }),
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
            await AsyncStorage.removeItem('marca_cache');
        }

        return data;
    } catch (error) {
        console.error('Error saving marca:', error);
        return { status: false, message: 'Error al guardar la marca' };
    }
}