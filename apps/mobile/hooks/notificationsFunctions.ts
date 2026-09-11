import Constants from "expo-constants";
import authedFetch from "./authedFetch";

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
        if (!refreshAccessToken || !logout) {
            throw new Error('Auth handlers not provided');
        }

        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) {
            throw new Error('Server URL not configured');
        }

        const response = await authedFetch({
            url: `${apiUrl}/api/notification`,
            init: {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ notifications: notificationIds }),
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
        console.error('Error marking notifications as read:', error);
        return { status: false, message: 'Error al marcar las notificaciones como leídas' };
    }
}

