import AsyncStorage from '@react-native-async-storage/async-storage';
import updateServerTime from './updateServerTime';
import { Alert } from 'react-native';

export default async function getHoraAccion() {
    try {
        await updateServerTime();
        const server_time = await AsyncStorage.getItem('server_time');
        let result = parseInt(String(Date.now()), 10);
        if (server_time) {
            const server_time_obj = JSON.parse(server_time);
            result = parseInt(server_time_obj.server_time, 10);
        }
        return result;
    } catch (error) {
        console.error('Error getting hora accion:', error);
        return parseInt(String(Date.now()), 10);
    }
}