import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Network from 'expo-network';
import { Alert } from "react-native";
import { eventBus } from './eventBus';

export const SERVER_TIME_UPDATED_EVENT = 'serverTimeUpdated';

export async function readExtrapolatedServerTimeMs(): Promise<number> {
  try {
    const server_time = await AsyncStorage.getItem('server_time');
    if (!server_time) return Date.now();
    const server_time_obj = JSON.parse(server_time);
    const serverMs = parseInt(String(server_time_obj.server_time), 10);
    const localMs = parseInt(String(server_time_obj.local_time), 10);
    if (!Number.isFinite(serverMs)) return Date.now();
    if (!Number.isFinite(localMs)) return serverMs;
    const now = Date.now();
    const diff = Math.abs(now - localMs);
    return now >= localMs ? serverMs + diff : serverMs - diff;
  } catch {
    return Date.now();
  }
}

function emitServerTimeUpdated(): void {
  eventBus.emit(SERVER_TIME_UPDATED_EVENT);
}

  const getConnectionStatus = async (): Promise<boolean> => {
    //return false;
    const networkState = await Network.getNetworkStateAsync();

    return (
      networkState.isConnected === true &&
      networkState.isInternetReachable === true
    );
  };

  export default async function updateServerTime() {
    try {
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
        const time_to_store = { server_time: String(data.current_time), local_time: String(new Date().getTime()) };
        await AsyncStorage.setItem('server_time', JSON.stringify(time_to_store));
        emitServerTimeUpdated();
      } else {
        await setDisconnectedTime();
      }
    } catch (error) {
      console.error('Error updating server time:', error);
      await setDisconnectedTime();
    }
  };

  export async function setDisconnectedTime() {
    let default_server_time = JSON.stringify({ server_time: String(new Date().getTime()), local_time: String(new Date().getTime()) });
    try {
      let server_time = await AsyncStorage.getItem('server_time');
      if (!server_time) {
        server_time = default_server_time;
      }

      const server_time_obj = JSON.parse(server_time);
      const new_date = parseInt(String(new Date().getTime()), 10);
      let diff_time = 0;
      if (new_date >= parseInt(server_time_obj.local_time, 10)) {
        diff_time = new_date - parseInt(server_time_obj.local_time, 10);
      }
      else {
        diff_time = parseInt(server_time_obj.local_time, 10) - new_date;
      }
      server_time_obj.server_time = String(parseInt(server_time_obj.server_time, 10) + diff_time);
      server_time_obj.local_time = String(new_date);


      await AsyncStorage.setItem('server_time', JSON.stringify(server_time_obj));
      emitServerTimeUpdated();
    } catch (error) {
      await AsyncStorage.setItem('server_time', default_server_time);
      emitServerTimeUpdated();
      console.error('Error setting disconnected time:', error);
    }
  };