import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import Constants from 'expo-constants';
import React, { useState, useRef } from 'react';
import { ActivityIndicator, Alert, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

type VerifyCodeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'VerifyCode'>;
type VerifyCodeScreenRouteProp = RouteProp<RootStackParamList, 'VerifyCode'>;

// Función para ocultar el correo electrónico
const maskEmail = (text: string): string => {
  // Expresión regular para encontrar correos electrónicos
  const emailRegex = /([a-zA-Z0-9._-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  
  return text.replace(emailRegex, (match, localPart, domain) => {
    // Si la parte local tiene 3 o más caracteres
    if (localPart.length >= 3) {
      const firstTwo = localPart.substring(0, 2);
      const lastOne = localPart.substring(localPart.length - 1);
      const middleLength = localPart.length - 3;
      const maskedMiddle = '*'.repeat(middleLength);
      return `${firstTwo}${maskedMiddle}${lastOne}@${domain}`;
    }
    // Si tiene 2 caracteres, mostrar solo los 2 primeros
    else if (localPart.length === 2) {
      return `${localPart.substring(0, 2)}@${domain}`;
    }
    // Si tiene 1 carácter, mostrar solo ese
    else {
      return `${localPart}@${domain}`;
    }
  });
};

export default function VerifyCodeScreen() {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const navigation = useNavigation<VerifyCodeScreenNavigationProp>();
  const route = useRoute<VerifyCodeScreenRouteProp>();
  const { cedula, message } = route.params;

  // Referencias para los inputs
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const handleCodeChange = (text: string, index: number) => {
    // Solo permitir números
    if (text && !/^[0-9]$/.test(text)) {
      return;
    }

    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);

    // Auto-focus al siguiente input si se ingresó un número
    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    // Si se presiona backspace y el campo está vacío, ir al campo anterior
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyCode = async () => {
    // Validar que todos los inputs tengan un número
    const hasEmptyFields = code.some(digit => digit === '');
    if (hasEmptyFields) {
      Alert.alert('Error', 'Por favor ingresa el código completo de 6 dígitos');
      return;
    }

    // Combinar los números sin espacios
    const fullCode = code.join('');

    setIsLoading(true);

    try {
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) {
        Alert.alert('Error', 'URL del servidor no configurada');
        return;
      }

      const correo_usuario = message?.split('@')[0];
      if (!correo_usuario) {
        Alert.alert('Error', 'Correo electrónico no válido');
        return;
      }

      const response = await fetch(`${apiUrl}/api/password/check-recovery-password-token?token=${fullCode}&cedula=${cedula}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '69420'
        },
      });

      const responseData = await response.json();

      if (responseData.status) {
        // Si la verificación es exitosa, navegar a la pantalla de recuperación de contraseña
        navigation.navigate('RecoverPassword', {
          token: fullCode,
          employeeId: responseData.empleado?.id || '',
          employeeName: responseData.empleado?.nombre ? 
            `${responseData.empleado.nombre} ${responseData.empleado.apellido || ''} ${responseData.empleado.segundo_apellido || ''}`.trim() 
            : '',
          employeeEmail: responseData.empleado?.Email || '',
          employeeCedula: responseData.empleado?.cedula || cedula,
          employeeTelefono: responseData.empleado?.telefono || '',
        });
      } else {
        Alert.alert('Error', responseData.message || 'Código de verificación inválido');
      }
    } catch (error) {
      console.error('Error verifying code:', error);
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
          Verificar Código
        </ThemedText>
        
        {message && (
          <ThemedText style={styles.serverMessage}>
            {maskEmail(message)}
          </ThemedText>
        )}
        
        <ThemedText style={styles.description}>
          Ingresa el código de 6 dígitos que te enviamos para verificar tu identidad.
        </ThemedText>

        <View style={styles.codeContainer}>
          {code.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => { inputRefs.current[index] = ref; }}
              style={styles.codeInput}
              value={digit}
              onChangeText={(text) => handleCodeChange(text, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              keyboardType="numeric"
              maxLength={1}
              selectTextOnFocus
              editable={!isLoading}
            />
          ))}
        </View>

        <TouchableOpacity 
          style={[styles.verifyButton, isLoading && styles.verifyButtonDisabled]} 
          onPress={handleVerifyCode}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <ThemedText style={styles.verifyButtonText}>Verificar código</ThemedText>
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
    gap: 24,
    width: '100%',
    maxWidth: 400,
  },
  title: {
    textAlign: 'center',
    marginBottom: 8,
  },
  serverMessage: {
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
    color: '#007AFF',
    fontWeight: '500',
    marginTop: 8,
    paddingHorizontal: 16,
  },
  description: {
    textAlign: 'center',
    opacity: 0.7,
    fontSize: 14,
    lineHeight: 20,
  },
  codeContainer: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    width: '100%',
    marginVertical: 20,
  },
  codeInput: {
    width: 50,
    height: 60,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 8,
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  verifyButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginTop: 20,
  },
  verifyButtonDisabled: {
    backgroundColor: '#B0B0B0',
  },
  verifyButtonText: {
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

