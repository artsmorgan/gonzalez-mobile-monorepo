import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import Constants from 'expo-constants';
import { useFonts } from 'expo-font';
import * as Linking from 'expo-linking';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { AuthProvider } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Alert } from 'react-native';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Handle deep links by always redirecting to home
  useEffect(() => {
    // Check for initial URL when app opens
    const getInitialUrl = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        if (initialUrl.includes('/recover-password/')) {
          const apiUrl = Constants.expoConfig?.extra?.JSON_WEB_SERVER;
          let id = initialUrl.split('/recover-password/')[1];
          let response = await fetch(apiUrl + '/api/password/check-recovery-password-token/' + id, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'ngrok-skip-browser-warning': '69420'
            },
          });
          let responseData = await response.json();
          if (responseData.status) {
            // Redirect to password recovery screen with user data
            router.replace({
              pathname: '/recover-password',
              params: {
                userId: id,
                userName: responseData.user.name,
                userEmail: responseData.user.email,
                userCedula: responseData.user.cedula,
                userTelefono: responseData.user.telefono,
                userTipoCedula: responseData.user.tipoCedula
              }
            });
          }
          else{
            Alert.alert('Error', responseData.message);
          }
        }
      }
    };


    getInitialUrl();
  }, [router]);

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </AuthProvider>
  );
}
