import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";

  export default async function updateServerTime() {
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
    await AsyncStorage.setItem('disconnected_info', JSON.stringify(disconnected_info_obj));
  };