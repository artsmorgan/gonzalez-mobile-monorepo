import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import Constants from 'expo-constants';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, TextInput, TouchableOpacity } from 'react-native';

type ForgotPasswordScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen() {
  const [cedula, setCedula] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigation = useNavigation<ForgotPasswordScreenNavigationProp>();

  const handleResetPassword = async () => {
    if (!cedula.trim()) {
      Alert.alert('Error', 'Por favor ingresa tu cédula');
      return;
    }

    // Basic cedula validation (numeric and reasonable length)
    const cedulaRegex = /^[0-9]{7,12}$/;
    if (!cedulaRegex.test(cedula.trim())) {
      Alert.alert('Error', 'Por favor ingresa una cédula válida (7-12 dígitos numéricos)');
      return;
    }

    setIsLoading(true);

    try {
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) {
        Alert.alert('Error', 'URL del servidor no configurada');
        return;
      }

      const response = await fetch(`${apiUrl}/api/password/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '69420'
        },
        body: JSON.stringify({
          cedula: cedula.trim(),
        }),
      });

      const responseData = await response.json();

      if (responseData.status) {
        // Si el servidor responde exitosamente, navegar a la pantalla de verificación
        navigation.navigate('VerifyCode', { 
          cedula: cedula.trim(),
          message: responseData.message 
        });
      } else {
        Alert.alert('Error', responseData.message);
      }
    } catch (error) {
      console.error('Error sending forgot password request:', error);
      Alert.alert('Error', 'Error de conexión. Por favor intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    navigation.replace('Home');
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.contentContainer}>
        <ThemedText type="title" style={styles.title}>
          Cambiar contraseña
        </ThemedText>
        
        <ThemedText style={styles.description}>
          Ingrese su cédula y le enviaremos un código de verificación para restablecer su contraseña.
        </ThemedText>

        <ThemedView style={styles.inputContainer}>
          <ThemedText style={styles.label}>Cédula</ThemedText>
          <TextInput
            style={styles.input}
            value={cedula}
            onChangeText={setCedula}
            placeholder="Ingrese su cédula"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isLoading}
            keyboardType="numeric"
            maxLength={12}
          />
        </ThemedView>

        <TouchableOpacity 
          style={[styles.resetButton, isLoading && styles.resetButtonDisabled]} 
          onPress={handleResetPassword}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <ThemedText style={styles.resetButtonText}>Enviar código</ThemedText>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={handleBackToLogin} style={styles.backToLoginContainer}>
          <ThemedText style={styles.backToLoginText}>
            Volver al inicio de sesión
          </ThemedText>
        </TouchableOpacity>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  contentContainer: {
    alignItems: 'center',
    gap: 16,
    width: '100%',
    maxWidth: 400,
  },
  title: {
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    textAlign: 'center',
    opacity: 0.7,
    fontSize: 14,
    lineHeight: 20,
  },
  inputContainer: {
    gap: 8,
    width: '100%',
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cccccc',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#ffffff',
  },
  resetButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
    width: '100%',
    alignItems: 'center',
  },
  resetButtonDisabled: {
    backgroundColor: '#B0B0B0',
  },
  resetButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  backToLoginContainer: {
    alignItems: 'center',
    marginTop: 15,
  },
  backToLoginText: {
    color: '#007AFF',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});

