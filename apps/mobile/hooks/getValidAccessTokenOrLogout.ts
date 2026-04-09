import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import getHoraAccion from './getHoraAccion';
import updateServerTime from './updateServerTime';

type GetValidAccessTokenOrLogoutArgs = {
    refreshAccessToken: () => Promise<boolean>;
    logout: () => Promise<any>;
};

/**
 * Preflight para llamadas autenticadas:
 * - Verifica que existan `access_token`, `refresh_token` y `token_created_at` en AsyncStorage.
 *   Si falta alguno -> logout inmediato.
 * - Verifica expiración con `getHoraAccion()` vs `token_created_at + MINUTES_LIFE_TIME_TOKEN`.
 *   Si expiró (o no se puede calcular) -> refresca antes del request. Si falla -> logout.
 *
 * Retorna un `access_token` válido (posiblemente refrescado) o `null` si se deslogueó.
 */
export default async function getValidAccessTokenOrLogout({
    refreshAccessToken,
    logout,
}: GetValidAccessTokenOrLogoutArgs): Promise<string | null> {

    try {
        await updateServerTime();
    } catch (error) {
        console.error('Error updating server time:', error);
    }

    const [storedAccess, storedRefresh, storedCreatedAt] = await Promise.all([
        AsyncStorage.getItem('access_token'),
        AsyncStorage.getItem('refresh_token'),
        AsyncStorage.getItem('token_created_at'),
    ]);

    if (!storedAccess || !storedRefresh || !storedCreatedAt) {
        console.log('1 ----------------------------- No stored access, refresh or created at');
        await logout();
        return null;
    }

    // Backend entrega `createdAt` y `server_time` en epoch ms.
    // Config está en minutos, así que lo convertimos a ms.
    const lifetimeMinutes = Number(Constants.expoConfig?.extra?.MINUTES_LIFE_TIME_TOKEN ?? (24 * 60)); // 24 hours
    const lifetimeMs = lifetimeMinutes * 60 * 1000;
    const createdAtNum = parseInt(String(storedCreatedAt), 10);
    if (!Number.isFinite(createdAtNum)) {
        console.log('2 ----------------------------- No valid created at');
        await logout();
        return null;
    }

    console.log('createdAtNum', createdAtNum);
    console.log('lifetimeMs', lifetimeMs);
    console.log('createdAtNum + lifetimeMs', createdAtNum + lifetimeMs);

    let shouldRefresh = false;
    try {
        const horaAccion = await getHoraAccion();
        shouldRefresh = horaAccion > createdAtNum + lifetimeMs;
    } catch {
        // Si no podemos calcular horaAccion (p.ej. falta server_time), refrescamos preventivamente
        console.log('shouldRefresh error');
        shouldRefresh = true;
    }

    if (shouldRefresh) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
            console.log('3 ----------------------------- No refreshed');
            await logout();
            return null;
        }
    }

    // Releer por si el refresh actualizó el token
    const [nextAccess, nextRefresh, nextCreatedAt] = await Promise.all([
        AsyncStorage.getItem('access_token'),
        AsyncStorage.getItem('refresh_token'),
        AsyncStorage.getItem('token_created_at'),
    ]);

    if (!nextAccess || !nextRefresh || !nextCreatedAt) {
        console.log('4 ----------------------------- No next access, refresh or created at');
        await logout();
        return null;
    }

    return nextAccess;
}


