import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import requestPlanillasToken from '@/hooks/requestPlanillasToken';

type PlanillasPasswordRevalidationModalProps = {
  visible: boolean;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<unknown>;
  onSuccess: () => void;
  onDismiss: () => void;
};

export default function PlanillasPasswordRevalidationModal({
  visible,
  refreshAccessToken,
  logout,
  onSuccess,
  onDismiss,
}: PlanillasPasswordRevalidationModalProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) {
      setPassword('');
      setShowPassword(false);
      setIsSubmitting(false);
    }
  }, [visible]);

  const submitPassword = async () => {
    if (isSubmitting) return;

    const trimmed = password.trim();
    if (!trimmed) {
      Alert.alert('Error', 'Por favor ingrese su contraseña de perfil empresarial');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await requestPlanillasToken({
        password: trimmed,
        refreshAccessToken,
        logout,
      });

      if (!result.success) {
        Alert.alert('Error', result.message);
        return;
      }

      setPassword('');
      onSuccess();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmPress = () => {
    if (isSubmitting) return;

    const trimmed = password.trim();
    if (!trimmed) {
      Alert.alert('Error', 'Por favor ingrese su contraseña de perfil empresarial');
      return;
    }

    Alert.alert(
      'Confirmar',
      '¿Desea validar su identidad con la contraseña ingresada?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: () => void submitPassword() },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onDismiss}
    >
      <View style={styles.modalBackdrop}>
        <ThemedView style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <ThemedText style={styles.modalTitle}>Validación de identidad</ThemedText>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={onDismiss}
              disabled={isSubmitting}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={22} color="#333" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            <ThemedText style={styles.message}>
              Por motivos de seguridad, necesitamos que vuelvas a validar tu identidad adjuntando la
              contraseña de tu perfil empresarial (Aquella que adjuntaste al ingresar al sistema)
            </ThemedText>

            <ThemedText style={styles.label}>Contraseña de perfil empresarial</ThemedText>
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                placeholder="Ingrese su contraseña"
                placeholderTextColor="#999"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSubmitting}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowPassword((prev) => !prev)}
                disabled={isSubmitting}
              >
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={24} color="#666666" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.confirmButton, isSubmitting && styles.confirmButtonDisabled]}
              onPress={handleConfirmPress}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <ThemedText style={styles.confirmButtonText}>Confirmar</ThemedText>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.exitButton, isSubmitting && styles.confirmButtonDisabled]}
              onPress={onDismiss}
              disabled={isSubmitting}
            >
              <ThemedText style={styles.exitButtonText}>Salir</ThemedText>
            </TouchableOpacity>
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '900',
    color: '#000',
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 18,
    backgroundColor: '#F2F2F2',
  },
  modalBody: {
    padding: 14,
    paddingBottom: 20,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: '#333333',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333333',
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
    marginBottom: 16,
  },
  passwordInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: '#000000',
  },
  eyeIcon: {
    padding: 12,
  },
  confirmButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 4,
  },
  confirmButtonDisabled: {
    opacity: 0.7,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  exitButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F2F2',
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 10,
  },
  exitButtonText: {
    color: '#333333',
    fontSize: 14,
    fontWeight: '700',
  },
});
