import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

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

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
        if (refreshAccessToken) {
            const refreshed = await refreshAccessToken();
            if (!refreshed) {
                if (logout) await logout();
                throw new Error('Sesión expirada');
            }
            token = await AsyncStorage.getItem('access_token');
        } else {
            if (logout) await logout();
            throw new Error('Sesión expirada');
        }
    }

    const response = await fetch(`${apiUrl}/api/visitors`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': '69420',
        },
        body: JSON.stringify(requestData)
    });

    if (response.status === 401) {
        const refreshed = refreshAccessToken ? await refreshAccessToken() : false;
        if (refreshed) {
            return createVisitor({
                requestData,
                marcaId,
                refreshAccessToken,
                logout
            });
        } else {
            if (logout) {
                await logout();
            }
            throw new Error('Session expired');
        }
    }

    if (response.status === 403) {
        if (logout) await logout();
        throw new Error('Acceso denegado');
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

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
        if (refreshAccessToken) {
            const refreshed = await refreshAccessToken();
            if (!refreshed) {
                if (logout) await logout();
                throw new Error('Sesión expirada');
            }
            token = await AsyncStorage.getItem('access_token');
        } else {
            if (logout) await logout();
            throw new Error('Sesión expirada');
        }
    }

    const response = await fetch(`${apiUrl}/api/visitors/${visitorId}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': '69420',
        },
        body: JSON.stringify(requestData)
    });

    if (response.status === 401) {
        const refreshed = refreshAccessToken ? await refreshAccessToken() : false;
        if (refreshed) {
            return updateVisitor({
                requestData,
                visitorId,
                refreshAccessToken,
                logout
            });
        } else {
            if (logout) {
                await logout();
            }
            throw new Error('Session expired');
        }
    }

    if (response.status === 403) {
        if (logout) await logout();
        throw new Error('Acceso denegado');
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

    let token = await AsyncStorage.getItem('access_token');
    if (!token) {
        if (refreshAccessToken) {
            const refreshed = await refreshAccessToken();
            if (!refreshed) {
                if (logout) await logout();
                throw new Error('Sesión expirada');
            }
            token = await AsyncStorage.getItem('access_token');
        } else {
            if (logout) await logout();
            throw new Error('Sesión expirada');
        }
    }

    const response = await fetch(`${apiUrl}/api/visitors/${visitorId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': '69420',
        }
    });

    if (response.status === 401) {
        const refreshed = refreshAccessToken ? await refreshAccessToken() : false;
        if (refreshed) {
            return deleteVisitor({
                visitorId,
                refreshAccessToken,
                logout
            });
        } else {
            if (logout) {
                await logout();
            }
            throw new Error('Session expired');
        }
    }

    if (response.status === 403) {
        if (logout) await logout();
        throw new Error('Acceso denegado');
    }

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
}
