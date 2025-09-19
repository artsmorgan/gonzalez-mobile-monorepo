import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface PasswordRecoveryProps {
  userId: string;
  userInfo?: {
    token: string;
    name: string;
    email: string;
    username: string;
    telefono: string;
  };
}

export default function PasswordRecovery({ userId, userInfo }: PasswordRecoveryProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);

  const validatePasswordRules = (pwd: string): string[] => {
    const errors: string[] = [];
    
    // Mínimo 8 caracteres
    if (pwd.length < 8) {
      errors.push('Debe tener 8 caracteres o más');
    }
    
    // Mayúsculas y minúsculas
    if (!/[a-z]/.test(pwd) || !/[A-Z]/.test(pwd)) {
      errors.push('Debe haber tanto mayúsculas como minúsculas');
    }
    
    // Letras y números
    if (!/[a-zA-Z]/.test(pwd) || !/[0-9]/.test(pwd)) {
      errors.push('Debe haber tanto letras como números');
    }
    
    // Caracteres especiales
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(pwd)) {
      errors.push('Debe haber al menos un carácter especial');
    }
    
    return errors;
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    const errors = validatePasswordRules(text);
    setPasswordErrors(errors);
  };

  const validatePasswords = (): boolean => {
    if (!password.trim()) {
      Alert.alert('Error', 'Por favor ingresa una nueva contraseña');
      return false;
    }

    const errors = validatePasswordRules(password);
    if (errors.length > 0) {
      Alert.alert('Error', 'La contraseña no cumple con los requisitos de seguridad');
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
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
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
              <ThemedText style={styles.userInfoLabel}>Usuario: </ThemedText>
              {userInfo.username}
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

        {/* Cartel de recomendaciones */}
        <ThemedView style={styles.recommendationsContainer}>
          <ThemedText style={styles.recommendationsTitle}>Recomendaciones para crear una contraseña segura:</ThemedText>
          <View style={styles.recommendationsList}>
            <ThemedText style={styles.recommendationItem}>• No menos de 8 caracteres</ThemedText>
            <ThemedText style={styles.recommendationItem}>• Sin secuencias lógicas <ThemedText style={styles.exampleText}>abcd 1234 qwerty</ThemedText></ThemedText>
            <ThemedText style={styles.recommendationItem}>• Sin info nuestra <ThemedText style={styles.exampleText}>minadre miperro minacimiento</ThemedText></ThemedText>
            <ThemedText style={styles.recommendationItem}>• Combina mayúsculas y minúsculas <ThemedText style={styles.exampleText}>aDRnTi</ThemedText></ThemedText>
            <ThemedText style={styles.recommendationItem}>• Combina números y letras <ThemedText style={styles.exampleText}>a1DR4nT76i</ThemedText></ThemedText>
            <ThemedText style={styles.recommendationItem}>• Con caracteres especiales <ThemedText style={styles.exampleText}>aa18DR"4nT7:6i</ThemedText></ThemedText>
          </View>
        </ThemedView>

        <ThemedView style={styles.inputContainer}>
          <ThemedText style={styles.label}>Nueva contraseña</ThemedText>
          <View style={styles.passwordInputContainer}>
            <TextInput
              style={styles.passwordInput}
              value={password}
              onChangeText={handlePasswordChange}
              placeholder="Ingresa tu nueva contraseña"
              placeholderTextColor="#999"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons
                name={showPassword ? 'eye-off' : 'eye'}
                size={24}
                color="#666"
              />
            </TouchableOpacity>
          </View>
          
          {/* Mensajes de error de validación */}
          {passwordErrors.length > 0 && (
            <View style={styles.errorsContainer}>
              {passwordErrors.map((error, index) => (
                <ThemedText key={index} style={styles.errorText}>• {error}</ThemedText>
              ))}
            </View>
          )}
        </ThemedView>

        <ThemedView style={styles.inputContainer}>
          <ThemedText style={styles.label}>Confirmar contraseña</ThemedText>
          <View style={styles.passwordInputContainer}>
            <TextInput
              style={styles.passwordInput}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirma tu nueva contraseña"
              placeholderTextColor="#999"
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              <Ionicons
                name={showConfirmPassword ? 'eye-off' : 'eye'}
                size={24}
                color="#666"
              />
            </TouchableOpacity>
          </View>
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
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: '100%',
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
  recommendationsContainer: {
    width: '100%',
    backgroundColor: 'gray',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  recommendationsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
    color: '#007AFF',
  },
  recommendationsList: {
    gap: 8,
  },
  recommendationItem: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  exampleText: {
    color: '#dc3545',
    fontWeight: '500',
  },
  passwordInputContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#000',
    paddingRight: 50,
  },
  eyeIcon: {
    position: 'absolute',
    right: 12,
    padding: 4,
  },
  errorsContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#ffe6e6',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffcccc',
  },
  errorText: {
    color: '#dc3545',
    fontSize: 14,
    marginBottom: 4,
  },
});
