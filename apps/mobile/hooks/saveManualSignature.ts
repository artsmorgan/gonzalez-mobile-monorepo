import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import authedFetch from "./authedFetch";

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
    if (!refreshAccessToken || !logout) {
      throw new Error('Auth handlers not provided');
    }

    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) {
      throw new Error('Server URL not configured');
    }

    const response = await authedFetch({
      url: `${apiUrl}/api/digital-signature/manual-signature/${employeeId}`,
      init: {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ manualSignature: signature }),
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

    if (data.status) {
      await AsyncStorage.removeItem('manual_signature_cache');
    }

    return data;
  } catch (error) {
    console.error('Error saving manual signature:', error);
    return { status: false, message: 'Error al guardar la firma' };
  }
}