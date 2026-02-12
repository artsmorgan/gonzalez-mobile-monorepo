import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import authedFetch from "./authedFetch";

interface SaveLunchTimeParams {
    requestData: any;
    employeeId?: string;
    refreshAccessToken?: () => Promise<boolean>;
    logout?: () => Promise<{ status: boolean; message: string }>;
}

export default async function saveLunchTime({
    requestData,
    employeeId,
    refreshAccessToken,
    logout
}: SaveLunchTimeParams) {
    try {
        if (!refreshAccessToken || !logout) {
            throw new Error('Auth handlers not provided');
        }

        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) {
            throw new Error('Server URL not configured');
        }

        if (requestData.empleadoId == 0 && employeeId) {
            requestData.empleadoId = employeeId;
        }
        const response = await authedFetch({
            url: `${apiUrl}/api/lunch-time`,
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
        console.error('Error saving lunch time:', error);
        return { status: false, message: 'Error al guardar el tiempo de almuerzo' };
    }
}