import Constants from "expo-constants";
import authedFetch from "./authedFetch";
import { parseApiErrorResponse } from "./parseApiErrorResponse";

interface CreateVisitorParams {
    requestData: any;
    marcaId: number;
    refreshAccessToken?: () => Promise<boolean>;
    logout?: () => Promise<{ status: boolean; message: string }>;
}

interface UpdateVisitorParams {
    requestData: any;
    visitorId: number;
    refreshAccessToken?: () => Promise<boolean>;
    logout?: () => Promise<{ status: boolean; message: string }>;
}

interface DeleteVisitorParams {
    visitorId: number;
    refreshAccessToken?: () => Promise<boolean>;
    logout?: () => Promise<{ status: boolean; message: string }>;
}

export async function createVisitor({
    requestData,
    marcaId,
    refreshAccessToken,
    logout
}: CreateVisitorParams) {
    try {
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) {
            throw new Error('Server URL not configured');
        }

        if (!refreshAccessToken || !logout) {
            throw new Error('Auth handlers not provided');
        }

        const response = await authedFetch({
            url: `${apiUrl}/api/visitors`,
            init: {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
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
        console.error('Error creating visitor:', error);
        const message = error instanceof Error ? error.message : 'Error al crear la visita';
        return { status: false, message };
    }
}

export async function updateVisitor({
    requestData,
    visitorId,
    refreshAccessToken,
    logout
}: UpdateVisitorParams) {
    try {
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) {
            throw new Error('Server URL not configured');
        }

        if (!refreshAccessToken || !logout) {
            throw new Error('Auth handlers not provided');
        }

        const response = await authedFetch({
            url: `${apiUrl}/api/visitors/${visitorId}`,
            init: {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
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
        console.error('Error updating visitor:', error);
        const message = error instanceof Error ? error.message : 'Error al actualizar la visita';
        return { status: false, message };
    }
}

export async function deleteVisitor({
    visitorId,
    refreshAccessToken,
    logout
}: DeleteVisitorParams) {
    try {
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) {
            throw new Error('Server URL not configured');
        }

        if (!refreshAccessToken || !logout) {
            throw new Error('Auth handlers not provided');
        }

        const response = await authedFetch({
            url: `${apiUrl}/api/visitors/${visitorId}`,
            init: {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                }
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
        console.error('Error deleting visitor:', error);
        const message = error instanceof Error ? error.message : 'Error al eliminar la visita';
        return { status: false, message };
    }
}
