import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, TextInput, TouchableOpacity } from 'react-native';

interface PasswordRecoveryProps {
  userId: string;
  userInfo?: {
    token: string;
    name: string;
    email: string;
    cedula: string;
    telefono: string;
    tipoCedula: string;
  };
}

export default function PasswordRecovery({ userId, userInfo }: PasswordRecoveryProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validatePasswords = (): boolean => {
    if (!password.trim()) {
      Alert.alert('Error', 'Por favor ingresa una nueva contraseña');
      return false;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
      return false;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Las contraseñas no coinciden');
      return false;
    }

    return true;
  };

  const handlePasswordReset = () => {
    if (validatePasswords()) {
      Alert.alert(
        'Confirmar',
        '¿Estás seguro de que quieres cambiar tu contraseña?',
        [
          {
            text: 'Cancelar',
            style: 'cancel'
          },
          {
            text: 'Confirmar',
            onPress: submitPasswordReset
          }
        ]
      );
    }
  };

  const submitPasswordReset = async () => {
    setIsSubmitting(true);
    
    try {
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) {
        Alert.alert('Error', 'URL del servidor no configurada');
        return;
      }

      const response = await fetch(`${apiUrl}/api/password/recover-password/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '69420'
        },
        body: JSON.stringify({
          password: password
        })
      });

      if (!response.ok) {
        Alert.alert('Error', `Error del servidor: ${response.status}`);
        return;
      }

      const responseText = await response.text();

      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (jsonError) {
        Alert.alert('Error', 'Respuesta inválida del servidor');
        return;
      }

      // Show server message
      Alert.alert(
        responseData.status ? 'Éxito' : 'Error',
        responseData.message || 'Operación completada',
        [
          {
            text: 'OK',
            onPress: () => {
              if (responseData.status) {
                // Redirect to login on success
                router.replace('/');
              }
            }
          }
        ]
      );

    } catch (error) {
      console.error('Error submitting password reset:', error);
      Alert.alert('Error', 'Error de conexión');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackToLogin = () => {
    router.replace('/');
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.contentContainer}>
        <ThemedText type="title" style={styles.title}>
          Recuperar Contraseña
        </ThemedText>
        
        {userInfo && (
          <ThemedView style={styles.userInfoContainer}>
            <ThemedText style={styles.userInfoTitle}>Información del Usuario</ThemedText>
            <ThemedText style={styles.userInfoText}>
              <ThemedText style={styles.userInfoLabel}>Nombre: </ThemedText>
              {userInfo.name}
            </ThemedText>
            <ThemedText style={styles.userInfoText}>
              <ThemedText style={styles.userInfoLabel}>Cédula: </ThemedText>
              {userInfo.cedula} ({userInfo.tipoCedula})
            </ThemedText>
            <ThemedText style={styles.userInfoText}>
              <ThemedText style={styles.userInfoLabel}>Email: </ThemedText>
              {userInfo.email}
            </ThemedText>
            <ThemedText style={styles.userInfoText}>
              <ThemedText style={styles.userInfoLabel}>Teléfono: </ThemedText>
              {userInfo.telefono || 'No disponible'}
            </ThemedText>
          </ThemedView>
        )}

        <ThemedView style={styles.inputContainer}>
          <ThemedText style={styles.label}>Nueva contraseña</ThemedText>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Ingresa tu nueva contraseña"
            placeholderTextColor="#999"
            secureTextEntry
            autoCapitalize="none"
          />
        </ThemedView>

        <ThemedView style={styles.inputContainer}>
          <ThemedText style={styles.label}>Confirmar contraseña</ThemedText>
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirma tu nueva contraseña"
            placeholderTextColor="#999"
            secureTextEntry
            autoCapitalize="none"
          />
        </ThemedView>

        <TouchableOpacity 
          style={[styles.submitButton, isSubmitting && styles.disabledButton]} 
          onPress={handlePasswordReset}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <ThemedText style={styles.submitButtonText}>Confirmar</ThemedText>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.backButton} onPress={handleBackToLogin}>
          <ThemedText style={styles.backButtonText}>Volver al inicio de sesión</ThemedText>
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
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    gap: 16,
  },
  title: {
    textAlign: 'center',
    marginBottom: 8,
  },
  userInfoContainer: {
    width: '100%',
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  userInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  userInfoText: {
    fontSize: 14,
    marginBottom: 6,
    lineHeight: 20,
  },
  userInfoLabel: {
    fontWeight: '600',
    fontSize: 14,
  },
  inputContainer: {
    width: '100%',
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#000',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
  },
  disabledButton: {
    backgroundColor: '#999',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    marginTop: 16,
    paddingVertical: 8,
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 14,
    textAlign: 'center',
  },
});
