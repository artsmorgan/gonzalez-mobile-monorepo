import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  findNodeHandle,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type RecoverPasswordScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'RecoverPassword'>;
type RecoverPasswordScreenRouteProp = RouteProp<RootStackParamList, 'RecoverPassword'>;

export default function RecoverPasswordScreen() {
  const navigation = useNavigation<RecoverPasswordScreenNavigationProp>();
  const route = useRoute<RecoverPasswordScreenRouteProp>();
  const { token = '', employeeId = '', employeeName = '', employeeEmail = '', employeeCedula = '', employeeTelefono = '' } = route.params || {};
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const passwordFieldRef = useRef<View>(null);
  const confirmPasswordFieldRef = useRef<View>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates?.height ?? 0);
    });
    const onHide = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, []);

  const scrollFieldIntoView = (fieldRef: React.RefObject<View | null>) => {
    const scrollNode = findNodeHandle(scrollRef.current);
    const fieldNode = findNodeHandle(fieldRef.current);
    if (!scrollNode || !fieldNode) {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
      return;
    }

    const runMeasure = () => {
      UIManager.measureLayout(
        fieldNode,
        scrollNode,
        () => {
          scrollRef.current?.scrollToEnd({ animated: true });
        },
        (_left, top, _width, height) => {
          const targetY = Math.max(0, top - 24);
          scrollRef.current?.scrollTo({ y: targetY + Math.max(0, height - 40), animated: true });
        }
      );
    };

    // Esperar a que el teclado termine de animar / redimensionar el layout.
    setTimeout(runMeasure, Platform.OS === 'ios' ? 80 : 180);
  };

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

      const response = await fetch(`${apiUrl}/api/password/recover-password/${token}`, {
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
                navigation.replace('Home');
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
    navigation.replace('Home');
  };

  if (!token) {
    return (
      <ThemedView style={styles.container}>
        <ThemedView style={styles.contentContainer}>
          <ThemedText type="title" style={styles.title}>
            Error
          </ThemedText>
          <ThemedText style={styles.errorText}>
            Token de verificación no válido
          </ThemedText>
          <TouchableOpacity style={styles.backButton} onPress={handleBackToLogin}>
            <ThemedText style={styles.backButtonText}>Volver al inicio de sesión</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: Math.max(20, insets.top + 12),
              paddingBottom:
                Math.max(24, insets.bottom + 16) +
                (Platform.OS === 'android' ? keyboardHeight : Math.max(0, keyboardHeight * 0.15)),
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <ThemedView style={styles.contentContainer}>
            <ThemedText type="title" style={styles.title}>
              Recuperar Contraseña
            </ThemedText>
            
            {employeeName && employeeEmail && (
              <ThemedView style={styles.userInfoContainer}>
                <ThemedText style={styles.userInfoTitle}>Información del Usuario</ThemedText>
                <ThemedText style={styles.userInfoText}>
                  <ThemedText style={styles.userInfoLabel}>Nombre: </ThemedText>
                  {employeeName}
                </ThemedText>
                <ThemedText style={styles.userInfoText}>
                  <ThemedText style={styles.userInfoLabel}>Cédula: </ThemedText>
                  {employeeCedula}
                </ThemedText>
                <ThemedText style={styles.userInfoText}>
                  <ThemedText style={styles.userInfoLabel}>Email: </ThemedText>
                  {employeeEmail}
                </ThemedText>
                {employeeTelefono && (
                  <ThemedText style={styles.userInfoText}>
                    <ThemedText style={styles.userInfoLabel}>Teléfono: </ThemedText>
                    {employeeTelefono}
                  </ThemedText>
                )}
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

            <View style={styles.inputContainer} ref={passwordFieldRef} collapsable={false}>
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
                  returnKeyType="next"
                  onFocus={() => scrollFieldIntoView(passwordFieldRef)}
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
            </View>

            <View style={styles.inputContainer} ref={confirmPasswordFieldRef} collapsable={false}>
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
                  returnKeyType="done"
                  onSubmitEditing={handlePasswordReset}
                  onFocus={() => scrollFieldIntoView(confirmPasswordFieldRef)}
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
            </View>

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
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoiding: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 20,
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
    color: '#007AFF',
  },
  userInfoText: {
    fontSize: 14,
    marginBottom: 6,
    lineHeight: 20,
    color: '#6c757d',
  },
  userInfoLabel: {
    fontWeight: '600',
    fontSize: 14,
    color: '#333333',
  },
  inputContainer: {
    width: '100%',
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
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
    color: '#000000',
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
