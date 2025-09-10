import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useAuth } from '@/contexts/AuthContext';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, TextInput, TouchableOpacity } from 'react-native';

interface LoginFormProps {
  onForgotPassword?: () => void;
  onLoginSuccess?: () => void;
}

export default function LoginForm({ onForgotPassword, onLoginSuccess }: LoginFormProps) {
  const [cedula, setCedula] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleLogin = async () => {
    if (!cedula.trim() || !password.trim()) {
      Alert.alert('Error', 'Por favor ingrese su cédula y contraseña');
      return;
    }

    setIsLoading(true);
    try {
      const result = await login(cedula.trim(), password);
      
      if (result.success) {
        // Login successful, the AuthContext will handle the state update
        onLoginSuccess?.();
      } else {
        Alert.alert('Error de autenticación', result.error || 'Credenciales incorrectas');
      }
    } catch (error) {
      Alert.alert('Error', 'Ocurrió un error inesperado');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.contentContainer}>
        <ThemedText type="title" style={styles.title}>
          Iniciar Sesión
        </ThemedText>
        
        <ThemedView style={styles.inputContainer}>
          <ThemedText style={styles.label}>Cédula</ThemedText>
          <TextInput
            style={styles.input}
            value={cedula}
            onChangeText={setCedula}
            placeholder="Ingrese su número de cédula"
            keyboardType="numeric"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </ThemedView>

        <ThemedView style={styles.inputContainer}>
          <ThemedText style={styles.label}>Contraseña</ThemedText>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Ingrese su contraseña"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
        </ThemedView>

        <TouchableOpacity 
          style={[styles.loginButton, isLoading && styles.loginButtonDisabled]} 
          onPress={handleLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <ThemedText style={styles.loginButtonText}>Ingresar</ThemedText>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={onForgotPassword} style={styles.forgotPasswordContainer}>
          <ThemedText style={styles.forgotPasswordText}>
            ¿Olvidó su contraseña?
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
  loginButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  loginButtonDisabled: {
    backgroundColor: '#B0B0B0',
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  forgotPasswordContainer: {
    alignItems: 'center',
    marginTop: 15,
  },
  forgotPasswordText: {
    color: '#007AFF',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
