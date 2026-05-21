import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Network from 'expo-network';

  const getConnectionStatus = async (): Promise<boolean> => {
    const networkState = await Network.getNetworkStateAsync();
    return networkState.isConnected && networkState.isInternetReachable ? true : false;
  };

  export default async function updateServerTime() {
    const isConnected = await getConnectionStatus();
    if (!isConnected) {
      await setDisconnectedTime();
      return;
    }
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }
    const response = await fetch(`${apiUrl}/api/server-time`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
      },
    });
    const data = await response.json();

    if (data.status) {
      console.log('Actualizamos la hora del servidor');
      await AsyncStorage.setItem('server_time', data.current_time.toString());
      await AsyncStorage.removeItem('disconnected_info');
    }
  };

  export async function setDisconnectedTime() {
    const disconnected_info = await AsyncStorage.getItem('disconnected_info');
    let disconnected_info_obj = { time: new Date().getTime(), count: 0 };
    if (disconnected_info) {
      disconnected_info_obj = JSON.parse(disconnected_info);
      const new_date = new Date().getTime();
      let diff_time = 0;
      if (new_date >= disconnected_info_obj.time) {
        diff_time = new_date - disconnected_info_obj.time;
      }
      else {
        diff_time = disconnected_info_obj.time - new_date;
      }
      
      disconnected_info_obj.count += diff_time;
      disconnected_info_obj.time = new_date;
    }
    console.log('Actualizamos el tiempo de desconectado');
    await AsyncStorage.setItem('disconnected_info', JSON.stringify(disconnected_info_obj));
  };