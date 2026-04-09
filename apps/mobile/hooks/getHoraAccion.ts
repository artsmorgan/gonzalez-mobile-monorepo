import AsyncStorage from '@react-native-async-storage/async-storage';

export default async function getHoraAccion() {
    const server_time = await AsyncStorage.getItem('server_time');
    if (!server_time) {
        throw new Error('Server time not found');
    }
    let result = parseInt(server_time, 10);
    if (!Number.isFinite(result)) {
        throw new Error('Invalid server time');
    }
    const disconnected_info = await AsyncStorage.getItem('disconnected_info');
    if (disconnected_info) {
        try {
            const disconnected_info_obj = JSON.parse(disconnected_info) as { count?: unknown };
            const add = parseInt(String(disconnected_info_obj?.count ?? '0'), 10);
            if (Number.isFinite(add)) result += add;
        } catch {
            // ignorar JSON corrupto
        }
    }
    if (!Number.isFinite(result)) {
        throw new Error('Invalid hora acción');
    }
    return result;
}