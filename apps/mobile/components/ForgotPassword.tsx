import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import Constants from 'expo-constants';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, TextInput, TouchableOpacity } from 'react-native';

interface ForgotPasswordProps {
  onBackToLogin?: () => void;
}

export default function ForgotPassword({ onBackToLogin }: ForgotPasswordProps) {
  const [cedula, setCedula] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleResetPassword = async () => {
    if (!cedula.trim()) {
      Alert.alert('Error', 'Por favor ingresa tu número de cédula');
      return;
    }

    // Basic cedula validation (numeric and reasonable length)
    const cedulaRegex = /^\d{6,12}$/;
    if (!cedulaRegex.test(cedula.trim())) {
      Alert.alert('Error', 'Por favor ingresa un número de cédula válido (6-12 dígitos)');
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
          ced: cedula.trim(),
        }),
      });

      const responseData = await response.json();

      Alert.alert(
        responseData.status ? 'Éxito' : 'Error',
        responseData.message,
        [
          {
            text: 'OK',
            onPress: () => {
              if (responseData.status) {
                // Clear the cedula field on success
                setCedula('');
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error sending forgot password request:', error);
      Alert.alert('Error', 'Error de conexión. Por favor intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.contentContainer}>
        <ThemedText type="title" style={styles.title}>
          ¿Olvidó su contraseña?
        </ThemedText>
        
        <ThemedText style={styles.description}>
          Ingrese su número de cédula y le enviaremos un enlace para restablecer su contraseña.
        </ThemedText>

        <ThemedView style={styles.inputContainer}>
          <ThemedText style={styles.label}>Número de cédula</ThemedText>
          <TextInput
            style={styles.input}
            value={cedula}
            onChangeText={setCedula}
            placeholder="Ingrese su número de cédula"
            keyboardType="numeric"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isLoading}
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
            <ThemedText style={styles.resetButtonText}>Enviar enlace</ThemedText>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={onBackToLogin} style={styles.backToLoginContainer}>
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
