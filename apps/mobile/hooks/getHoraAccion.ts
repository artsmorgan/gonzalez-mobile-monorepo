import AsyncStorage from '@react-native-async-storage/async-storage';

export default async function getHoraAccion() {
    const server_time = await AsyncStorage.getItem('server_time');
    if (!server_time) {
        throw new Error('Server time not found');
    }
    let result = parseInt(server_time);
    const disconnected_info = await AsyncStorage.getItem('disconnected_info');
    if (disconnected_info) {
        const disconnected_info_obj = JSON.parse(disconnected_info);
        result += parseInt(disconnected_info_obj.count);
    }
    return result;
}