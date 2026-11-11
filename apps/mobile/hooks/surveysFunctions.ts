import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import authedFetch from "./authedFetch";

interface UpdateSurveySignatureParams {
    surveyId: number;
    field: 'firma_persona_evaluada';
    value: string | null;
    refreshAccessToken: () => Promise<boolean>;
    logout: () => Promise<{ status: boolean; message: string }>;
}

export async function updateSurveySignature({
    surveyId,
    field,
    value,
    refreshAccessToken,
    logout
}: UpdateSurveySignatureParams) {
    try {
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) {
            throw new Error('Server URL not configured');
        }

        const response = await authedFetch({
            url: `${apiUrl}/api/encuesta-nps/${surveyId}`,
            init: {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ field, value: value ?? '' }),
            },
            refreshAccessToken,
            logout,
        });

        if (!response) {
            return { status: false, message: 'Sesión expirada' };
        }

        const data = await response.json();

        if (!response.ok) {
            return { status: false, message: data?.message || 'Error al actualizar la firma' };
        }

        return data;
    } catch (error) {
        console.error('Error updating survey signature:', error);
        return { status: false, message: 'Error al actualizar la firma' };
    }
}

interface CreateSurveyParams {
    requestData: any;
    marcaId: number;
    refreshAccessToken?: () => Promise<boolean>;
    logout?: () => Promise<{ status: boolean; message: string }>;
}

export async function createSurvey({
    requestData,
    marcaId,
    refreshAccessToken,
    logout
}: CreateSurveyParams) {
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
            url: `${apiUrl}/api/encuesta-nps`,
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
        console.error('Error creating survey:', error);
        return { status: false, message: 'Error al crear la encuesta' };
    }
}

interface UpdateSurveyParams {
    surveyId: number;
    requestData: any;
    refreshAccessToken?: () => Promise<boolean>;
    logout?: () => Promise<{ status: boolean; message: string }>;
}

export async function updateSurvey({
    surveyId,
    requestData,
    refreshAccessToken,
    logout,
}: UpdateSurveyParams) {
    try {
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) {
            throw new Error('Server URL not configured');
        }
        if (!refreshAccessToken || !logout) {
            throw new Error('Auth handlers not provided');
        }

        const response = await authedFetch({
            url: `${apiUrl}/api/encuesta-nps/${surveyId}`,
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

        const data = await response.json();

        if (!response.ok) {
            return { status: false, message: data?.message || 'Error al actualizar la encuesta' };
        }

        return data;
    } catch (error) {
        console.error('Error updating survey:', error);
        return { status: false, message: 'Error al actualizar la encuesta' };
    }
}

interface DeleteSurveyParams {
    surveyId: number;
    refreshAccessToken?: () => Promise<boolean>;
    logout?: () => Promise<{ status: boolean; message: string }>;
}

export async function deleteSurvey({
    surveyId,
    refreshAccessToken,
    logout,
}: DeleteSurveyParams) {
    try {
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) {
            throw new Error('Server URL not configured');
        }
        if (!refreshAccessToken || !logout) {
            throw new Error('Auth handlers not provided');
        }

        const response = await authedFetch({
            url: `${apiUrl}/api/encuesta-nps/${surveyId}`,
            init: {
                method: 'DELETE',
            },
            refreshAccessToken,
            logout,
        });

        if (!response) {
            return { status: false, message: 'Sesión expirada' };
        }

        const data = await response.json();

        if (!response.ok) {
            return { status: false, message: data?.message || 'Error al eliminar la encuesta' };
        }

        return data;
    } catch (error) {
        console.error('Error deleting survey:', error);
        return { status: false, message: 'Error al eliminar la encuesta' };
    }
}

