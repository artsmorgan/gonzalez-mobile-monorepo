import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import authedFetch from "./authedFetch";

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
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
}

export async function updateVisitor({
    requestData,
    visitorId,
    refreshAccessToken,
    logout
}: UpdateVisitorParams) {
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
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
}

export async function deleteVisitor({
    visitorId,
    refreshAccessToken,
    logout
}: DeleteVisitorParams) {
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
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
}
