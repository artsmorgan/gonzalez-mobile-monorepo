import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

interface MarkAsReadParams {
    notificationIds: { id: number, is_plaza: boolean }[];
    refreshAccessToken?: () => Promise<boolean>;
    logout?: () => Promise<{ status: boolean; message: string }>;
}

export async function markNotificationsAsRead({
    notificationIds,
    refreshAccessToken,
    logout
}: MarkAsReadParams) {
    try {
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

        const response = await fetch(`${apiUrl}/api/notification`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': '69420',
            },
            body: JSON.stringify({ notifications: notificationIds }),
        });

        if (response.status === 401) {
            if (refreshAccessToken) {
                const refreshed = await refreshAccessToken();
                if (refreshed) {
                    return markNotificationsAsRead({ notificationIds, refreshAccessToken, logout });
                } else if (logout) {
                    await logout();
                    return { status: false, message: 'Sesión expirada' };
                }
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
    } catch (error) {
        console.error('Error marking notifications as read:', error);
        return { status: false, message: 'Error al marcar las notificaciones como leídas' };
    }
}

