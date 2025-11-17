import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useAuth } from '@/contexts/AuthContext';
import React from 'react';
import { StyleSheet, ScrollView } from 'react-native';

interface EmployeeProfileProps {
  onClose?: () => void;
}

export default function EmployeeProfile({ onClose }: EmployeeProfileProps) {
  const { employee } = useAuth();

  const formatDate = (dateString: string) => {
    try {
      // Handle YYYY-MM-DD format
      const date = new Date(dateString + 'T00:00:00'); // Add time to avoid timezone issues
      return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
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

  const formatCedula = (cedula: string) => {
    if (!cedula) return 'No disponible';
    return cedula;
  };

  if (!employee) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>No hay datos de empleado disponibles</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
      >
        <ThemedView style={styles.contentContainer}>
          <ThemedText type="title" style={styles.title}>
            Perfil de Empleado
          </ThemedText>

          <ThemedView style={styles.tableContainer}>
            
            <ThemedView style={styles.dataItem}>
              <ThemedText style={styles.label}>Nombre:</ThemedText>
              <ThemedText style={styles.value}>{employee.name || 'No disponible'}</ThemedText>
            </ThemedView>

            <ThemedView style={styles.dataItem}>
              <ThemedText style={styles.label}>Cédula:</ThemedText>
              <ThemedText style={styles.value}>{formatCedula(employee.cedula)}</ThemedText>
            </ThemedView>

            <ThemedView style={styles.dataItem}>
              <ThemedText style={styles.label}>Email:</ThemedText>
              <ThemedText style={styles.value}>{employee.email || 'No disponible'}</ThemedText>
            </ThemedView>

            <ThemedView style={styles.dataItem}>
              <ThemedText style={styles.label}>Teléfono:</ThemedText>
              <ThemedText style={styles.value}>{formatPhone(employee.telefono)}</ThemedText>
            </ThemedView>

            <ThemedView style={styles.dataItem}>
              <ThemedText style={styles.label}>Fecha de Contratación:</ThemedText>
              <ThemedText style={styles.value}>{employee.fechaContratacion ? formatDate(employee.fechaContratacion) : 'No disponible'}</ThemedText>
            </ThemedView>

            <ThemedView style={styles.dataItem}>
              <ThemedText style={styles.label}>Roles y Divisiones:</ThemedText>
              <ThemedView style={styles.rolesContainer}>
                {employee.roles && employee.roles.length > 0 ? (
                  employee.roles.map((employeeRole, index) => (
                    <ThemedView key={index} style={styles.roleItem}>
                      <ThemedText style={styles.roleText}>
                        <ThemedText style={styles.roleLabel}>Rol: </ThemedText>
                        {employeeRole.role.name}
                      </ThemedText>
                      <ThemedText style={styles.roleText}>
                        <ThemedText style={styles.roleLabel}>División: </ThemedText>
                        {employeeRole.division.name}
                      </ThemedText>
                    </ThemedView>
                  ))
                ) : (
                  <ThemedText style={styles.value}>No hay roles asignados</ThemedText>
                )}
              </ThemedView>
            </ThemedView>
          </ThemedView>
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
  rolesContainer: {
    marginTop: 8,
    gap: 12,
    borderRadius: 6
  },
  roleItem: {
    padding: 12,
    backgroundColor: '#f0f8ff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d0e7ff',
  },
  roleText: {
    fontSize: 14,
    color: '#333333',
    marginBottom: 4,
  },
  roleLabel: {
    fontWeight: '600',
    color: '#007AFF',
  },
});
