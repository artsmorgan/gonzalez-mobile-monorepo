import PasswordRecovery from '@/components/PasswordRecovery';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';

export default function RecoverPasswordScreen() {
  const { employeeId, employeeName, employeeEmail, employeeCedula, employeeTelefono } = useLocalSearchParams<{ 
    employeeId: string; 
    employeeName?: string; 
    employeeEmail?: string; 
    employeeCedula?: string;
    employeeTelefono?: string;
  }>();

  const handleBackToLogin = () => {
    router.replace('/');
  };

  if (!employeeId) {
    return (
      <ThemedView style={styles.container}>
        <ThemedView style={styles.contentContainer}>
          <ThemedText type="title" style={styles.title}>
            Error
          </ThemedText>
          <ThemedText style={styles.errorText}>
            ID de empleado no válido
          </ThemedText>
          <TouchableOpacity style={styles.backButton} onPress={handleBackToLogin}>
            <ThemedText style={styles.backButtonText}>Volver al inicio de sesión</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ThemedView>
    );
  }

  const employeeInfo = employeeName && employeeEmail ? {
    token: employeeId,
    name: employeeName,
    email: employeeEmail,
    cedula: employeeCedula || '',
    telefono: employeeTelefono || ''
  } : undefined;

  return (
    <PasswordRecovery 
      userId={employeeId}
      userInfo={employeeInfo}
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
