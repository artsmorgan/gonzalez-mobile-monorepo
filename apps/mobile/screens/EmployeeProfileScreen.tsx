import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useAuth } from '@/contexts/AuthContext';
import AppHeader from '@/components/AppHeader';
import AppFooter from '@/components/AppFooter';
import SlideMenu from '@/components/SlideMenu';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import Ionicons from '@expo/vector-icons/build/Ionicons';

type EmployeeProfileScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'EmployeeProfile'>;

export default function EmployeeProfileScreen() {
  const { employee } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<EmployeeProfileScreenNavigationProp>();

  useEffect(() => {
    console.log(employee);
  }, [employee]);

  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  const formatDate = (dateString: string) => {
    try {
      // Handle YYYY-MM-DD format
      const date = new Date(dateString + 'T00:00:00');
      return date.getDate() + ' de ' + monthNames[date.getMonth()] + ' de ' + date.getFullYear();
    } catch (error) {
      console.log('error', error);
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

  // Handle menu press from header
  const handleMenuPress = () => {
    setIsMenuVisible(true);
  };

  // Handle menu close
  const handleMenuClose = () => {
    setIsMenuVisible(false);
  };

  // Handle back navigation
  const handleBack = () => {
    navigation.goBack();
  };

  // Handle home navigation from slide menu
  const handleHomePress = () => {
    navigation.navigate('Home');
  };

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'profile': return <Ionicons name="person" size={20} color='#000000' />;
    }
  };

  if (!employee) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader onMenuPress={handleMenuPress} title="Perfil de Empleado" />
        <ThemedView style={styles.errorContainer}>
          <ThemedText>No hay datos de empleado disponibles</ThemedText>
        </ThemedView>
        <AppFooter />
        <SlideMenu
          isVisible={isMenuVisible}
          onClose={handleMenuClose}
          onHomePress={handleHomePress}
          currentRoute="EmployeeProfile"
        />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={handleMenuPress} title="Perfil de Empleado" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
      >
        <ThemedView style={styles.contentContainer}>
          {/* Module Title */}
          <ThemedView style={styles.titleContainer}>
            <ThemedText type="title" style={styles.title}>
              {getActionIcon('profile')} Perfil de Empleado
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              Información personal y laboral
            </ThemedText>
          </ThemedView>

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
              <ThemedText style={styles.label}>Código:</ThemedText>
              <ThemedText style={styles.value}>{employee.codigo || 'No disponible'}</ThemedText>
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

          </ThemedView>
        </ThemedView>
      </ScrollView>
      <AppFooter />
      <SlideMenu
        isVisible={isMenuVisible}
        onClose={handleMenuClose}
        onHomePress={handleHomePress}
        currentRoute="EmployeeProfile"
      />
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
  backButton: {
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    width: '100%',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
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

