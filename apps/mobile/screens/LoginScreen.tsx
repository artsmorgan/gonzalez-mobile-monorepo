import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import React, { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';

type LoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

export default function LoginScreen() {
  const [cedula, setCedula] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberCedula, setRememberCedula] = useState(false);
  const { login } = useAuth();
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const insets = useSafeAreaInsets();

  // Cargar cédula guardada cuando la pantalla se enfoque
  useFocusEffect(
    useCallback(() => {
      const loadSavedCedula = async () => {
        try {
          const savedCedula = await AsyncStorage.getItem('remembered_cedula');
          if (savedCedula) {
            setCedula(savedCedula);
            setRememberCedula(true);
          }
        } catch (error) {
          console.error('Error loading saved cedula:', error);
        }
      };
      loadSavedCedula();
    }, [])
  );

  const handleLogin = async () => {
    if (!cedula.trim() || !password.trim()) {
      Alert.alert('Error', 'Por favor ingrese su cédula y contraseña');
      return;
    }

    setIsLoading(true);
    try {
      const result = await login(cedula.trim(), password);
      
      if (result.success) {
        // Guardar o eliminar la cédula según el checkbox
        try {
          if (rememberCedula) {
            await AsyncStorage.setItem('remembered_cedula', cedula.trim());
          } else {
            await AsyncStorage.removeItem('remembered_cedula');
          }
        } catch (storageError) {
          console.error('Error saving/removing cedula:', storageError);
        }
        
        const currentMarcaRaw = await AsyncStorage.getItem('current_marca');
        const hasCurrentMarca = Boolean(currentMarcaRaw && currentMarcaRaw.trim() !== '');
        if (hasCurrentMarca) {
          navigation.replace('Home');
        } else {
          navigation.replace('MarcarIngresoSalida');
        }
      } else if (result.passwordExpired) {
        Alert.alert('Contraseña vencida', result.error || 'Su contraseña ha vencido y debe cambiarla.');
        navigation.navigate('ForgotPassword');
      } else {
        Alert.alert('Error de autenticación', result.error || 'Credenciales incorrectas');
      }
    } catch (error) {
      Alert.alert('Error', 'Ocurrió un error inesperado');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    navigation.navigate('ForgotPassword');
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: Math.max(20, insets.top + 12),
              paddingBottom: Math.max(24, insets.bottom + 16),
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
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
                placeholder="Ingrese su cédula"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="numeric"
                returnKeyType="next"
              />
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => setRememberCedula(!rememberCedula)}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.checkbox,
                  rememberCedula ? styles.checkboxChecked : styles.checkboxUnchecked
                ]}>
                  {rememberCedula && (
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  )}
                </View>
                <ThemedText style={styles.checkboxLabel}>Recordar cédula</ThemedText>
              </TouchableOpacity>
            </ThemedView>

            <ThemedView style={styles.inputContainer}>
              <ThemedText style={styles.label}>Contraseña</ThemedText>
              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={styles.passwordInput}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Ingrese su contraseña"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={24}
                    color="#666666"
                  />
                </TouchableOpacity>
              </View>
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

            <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotPasswordContainer}>
              <ThemedText style={styles.forgotPasswordText}>
                ¿Olvidó su contraseña?
              </ThemedText>
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
    justifyContent: 'center',
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
    marginBottom: 16,
  },
  inputContainer: {
    width: '100%',
    gap: 8,
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
    color: '#000000',
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cccccc',
    borderRadius: 8,
    backgroundColor: '#ffffff',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000000',
  },
  eyeIcon: {
    paddingRight: 16,
    paddingLeft: 8,
  },
  loginButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
  },
  loginButtonDisabled: {
    backgroundColor: '#B0B0B0',
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  forgotPasswordContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  forgotPasswordText: {
    color: '#007AFF',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  checkboxChecked: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  checkboxUnchecked: {
    backgroundColor: '#ffffff',
    borderColor: '#cccccc',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#000000',
  },
});
