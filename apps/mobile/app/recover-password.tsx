import PasswordRecovery from '@/components/PasswordRecovery';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';

export default function RecoverPasswordScreen() {
  const { userId, userName, userEmail, userCedula, userTelefono, userTipoCedula } = useLocalSearchParams<{ 
    userId: string; 
    userName?: string; 
    userEmail?: string; 
    userCedula?: string;
    userTelefono?: string;
    userTipoCedula?: string;
  }>();

  const handleBackToLogin = () => {
    router.replace('/');
  };

  if (!userId) {
    return (
      <ThemedView style={styles.container}>
        <ThemedView style={styles.contentContainer}>
          <ThemedText type="title" style={styles.title}>
            Error
          </ThemedText>
          <ThemedText style={styles.errorText}>
            ID de usuario no válido
          </ThemedText>
          <TouchableOpacity style={styles.backButton} onPress={handleBackToLogin}>
            <ThemedText style={styles.backButtonText}>Volver al inicio de sesión</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ThemedView>
    );
  }

  const userInfo = userName && userEmail ? {
    token: userId,
    name: userName,
    email: userEmail,
    cedula: userCedula || '',
    telefono: userTelefono || '',
    tipoCedula: userTipoCedula || ''
  } : undefined;

  return (
    <PasswordRecovery 
      userId={userId}
      userInfo={userInfo}
    />
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
  },
  title: {
    textAlign: 'center',
    marginBottom: 8,
  },
  errorText: {
    textAlign: 'center',
    opacity: 0.7,
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
