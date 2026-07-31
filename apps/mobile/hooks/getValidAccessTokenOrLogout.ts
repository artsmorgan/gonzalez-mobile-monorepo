import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import getHoraAccion from './getHoraAccion';
import { resolveAppConnectivity } from './resolveAppConnectivity';

type GetValidAccessTokenOrLogoutArgs = {
    refreshAccessToken: () => Promise<boolean>;
    logout: () => Promise<any>;
};

/**
 * Preflight para llamadas autenticadas:
 * - Requiere conectividad (mismo criterio que sync: resolveAppConnectivity).
 * - Verifica tokens en AsyncStorage; si faltan -> logout.
 * - Refresca si expiró según getHoraAccion + MINUTES_LIFE_TIME_TOKEN.
 *
 * Retorna access_token válido o null (sin logout si solo falta red).
 */
export default async function getValidAccessTokenOrLogout({
    refreshAccessToken,
    logout,
}: GetValidAccessTokenOrLogoutArgs): Promise<string | null> {
    const connectivity = await resolveAppConnectivity();
    if (!connectivity.ok) {
        return null;
    }

    const [storedAccess, storedRefresh, storedCreatedAt] = await Promise.all([
        AsyncStorage.getItem('access_token'),
        AsyncStorage.getItem('refresh_token'),
        AsyncStorage.getItem('token_created_at'),
    ]);

    if (!storedAccess || !storedRefresh || !storedCreatedAt) {
        await logout();
        return null;
    }

    const lifetimeMinutes = Number(Constants.expoConfig?.extra?.MINUTES_LIFE_TIME_TOKEN ?? (24 * 60));
    const lifetimeMs = lifetimeMinutes * 60 * 1000;
    const createdAtNum = parseInt(String(storedCreatedAt), 10);
    if (!Number.isFinite(createdAtNum)) {
        await logout();
        return null;
    }

    let shouldRefresh = false;
    try {
        const horaAccion = await getHoraAccion();
        shouldRefresh = horaAccion > createdAtNum + lifetimeMs;
    } catch {
        shouldRefresh = true;
    }

    if (shouldRefresh) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
            await logout();
            return null;
        }
    }

    const [nextAccess, nextRefresh, nextCreatedAt] = await Promise.all([
        AsyncStorage.getItem('access_token'),
        AsyncStorage.getItem('refresh_token'),
        AsyncStorage.getItem('token_created_at'),
    ]);

    if (!nextAccess || !nextRefresh || !nextCreatedAt) {
        await logout();
        return null;
    }

    return nextAccess;
}
