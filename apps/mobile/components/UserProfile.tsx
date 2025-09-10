import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useAuth } from '@/contexts/AuthContext';
import React from 'react';
import { StyleSheet } from 'react-native';

interface UserProfileProps {
  onClose?: () => void;
}

export default function UserProfile({ onClose }: UserProfileProps) {
  const { user } = useAuth();

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return dateString;
    }
  };

  const formatPhone = (phone: string) => {
    if (!phone) return 'No disponible';
    // Format phone number for better readability
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
    }
    return phone;
  };

  const formatCedula = (cedula: string, tipoCedula: string) => {
    if (!cedula) return 'No disponible';
    return `${tipoCedula || 'CC'} ${cedula}`;
  };

  if (!user) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>No hay datos de usuario disponibles</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.contentContainer}>
        <ThemedText type="title" style={styles.title}>
          Perfil de Usuario
        </ThemedText>

        <ThemedView style={styles.tableContainer}>
          
          <ThemedView style={styles.dataItem}>
            <ThemedText style={styles.label}>Nombre:</ThemedText>
            <ThemedText style={styles.value}>{user.name || 'No disponible'}</ThemedText>
          </ThemedView>

          <ThemedView style={styles.dataItem}>
            <ThemedText style={styles.label}>Cédula:</ThemedText>
            <ThemedText style={styles.value}>{formatCedula(user.cedula, user.tipoCedula)}</ThemedText>
          </ThemedView>

          <ThemedView style={styles.dataItem}>
            <ThemedText style={styles.label}>Email:</ThemedText>
            <ThemedText style={styles.value}>{user.email || 'No disponible'}</ThemedText>
          </ThemedView>

          <ThemedView style={styles.dataItem}>
            <ThemedText style={styles.label}>Teléfono:</ThemedText>
            <ThemedText style={styles.value}>{formatPhone(user.telefono)}</ThemedText>
          </ThemedView>

          <ThemedView style={styles.dataItem}>
            <ThemedText style={styles.label}>ID de Usuario:</ThemedText>
            <ThemedText style={styles.value}>{user.id || 'No disponible'}</ThemedText>
          </ThemedView>

          <ThemedView style={styles.dataItem}>
            <ThemedText style={styles.label}>Creado el:</ThemedText>
            <ThemedText style={styles.value}>{user.createdAt ? formatDate(user.createdAt) : 'No disponible'}</ThemedText>
          </ThemedView>
        </ThemedView>
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
  tableContainer: {
    width: '100%',
    gap: 16,
  },
  dataItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 4,
  },
  value: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
});
