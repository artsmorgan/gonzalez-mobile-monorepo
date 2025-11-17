import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

interface SaveManualSignatureParams {
    signature: string;
    employeeId?: string;
    refreshAccessToken?: () => Promise<boolean>;
    logout?: () => Promise<{ status: boolean; message: string }>;
}

export default async function saveManualSignature({
    signature,
    employeeId,
    refreshAccessToken,
    logout
}: SaveManualSignatureParams) {
    try {
        const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
        if (!apiUrl) {
            throw new Error('Server URL not configured');
        }

        const token = await AsyncStorage.getItem('access_token');
        if (!token) {
            throw new Error('No authentication token found');
        }

        const response = await fetch(`${apiUrl}/api/digital-signature/manual-signature/${employeeId}`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'ngrok-skip-browser-warning': '69420',
            },
            body: JSON.stringify({ manualSignature: signature }),
          });
  
          if (response.status === 401 || response.status === 403) {
            if (refreshAccessToken) {
              const refreshed = await refreshAccessToken();
              if (refreshed) {
                return saveManualSignature({ signature, employeeId, refreshAccessToken, logout });
              } else if (logout) {
                // If refresh fails, logout the user
                await logout();
              }
            }
          }
  
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
  
          const data = await response.json();

          if (data.status) {
            await AsyncStorage.removeItem('manual_signature_cache');
          }

          return data;
    } catch (error) {
        console.error('Error saving manual signature:', error);
        return { status: false, message: 'Error al guardar la firma' };
    }
}