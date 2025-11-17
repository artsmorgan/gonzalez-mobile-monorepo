import AppHeader from '@/components/AppHeader';
import ForgotPassword from '@/components/ForgotPassword';
import LoginForm from '@/components/LoginForm';
import SlideMenu from '@/components/SlideMenu';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import EmployeeProfile from '@/components/EmployeeProfile';
import { useAuth } from '@/contexts/AuthContext';
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const { isAuthenticated, isLoading, employee } = useAuth();
  const [currentView, setCurrentView] = useState<'login' | 'forgot' | 'home' | 'profile'>('login');
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const router = useRouter();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <ThemedText style={styles.loadingText}>Verificando autenticación...</ThemedText>
      </ThemedView>
    );
  }

  // Show login form if not authenticated
  if (!isAuthenticated) {
    if (currentView === 'forgot') {
      return <ForgotPassword onBackToLogin={() => setCurrentView('login')} />;
    }
    
    return <LoginForm onForgotPassword={() => setCurrentView('forgot')} />;
  }

  // Set default view to home if authenticated
  if (isAuthenticated && (currentView === 'login' || currentView === 'forgot')) {
    setCurrentView('home');
  }

  // Handle menu press from header
  const handleMenuPress = () => {
    setIsMenuVisible(true);
  };

  // Handle profile navigation from slide menu
  const handleProfilePress = () => {
    router.navigate('/employee-profile');
  };

  // Handle home navigation from slide menu
  const handleHomePress = () => {
    setCurrentView('home');
  };

  // Handle closing slide menu
  const handleMenuClose = () => {
    setIsMenuVisible(false);
  };

  const handleRolesPress = () => {
    router.navigate('/roles');
  };

  const handleRulesPress = () => {
    router.navigate('/rules');
  };

  const handleDigitalSignaturePress = () => {
    router.navigate('/digital-signature');
  };

  const handleLunchTimePress = () => {
      router.navigate('/lunch-time');
  };

  // Show user profile screen
  if (currentView === 'profile') {
    return (
      <ThemedView style={styles.fullContainer}>
        <AppHeader onMenuPress={handleMenuPress} />
        <EmployeeProfile />
        <SlideMenu 
          isVisible={isMenuVisible} 
          onClose={handleMenuClose}
          onProfilePress={handleProfilePress}
          onHomePress={handleHomePress}
        />
      </ThemedView>
    );
  }

  // Show authenticated home screen
  return (
    <ThemedView style={styles.fullContainer}>
      <AppHeader onMenuPress={handleMenuPress} />
      <ThemedView style={styles.container}>
        {/* Welcome message at the top */}
        <ThemedView style={styles.welcomeContainer}>
          <ThemedText type="title" style={styles.welcomeText}>
            Bienvenido a la aplicación de Gonzalez
          </ThemedText>
          {employee && (
            <ThemedText style={styles.userText}>
              ¡Hola, {employee.name}!
            </ThemedText>
          )}
        </ThemedView>

        {/* Quick access buttons */}
        <ThemedView style={styles.quickAccessContainer}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Accesos Directos
          </ThemedText>
          
          <TouchableOpacity 
            style={styles.quickAccessButton} 
            onPress={handleProfilePress}
          >
            <ThemedText style={styles.buttonText}>👤 Perfil de Usuario</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.quickAccessButton} 
            onPress={handleRolesPress}
          >
            <ThemedText style={styles.buttonText}>🔐 Roles</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.quickAccessButton} 
            onPress={handleRulesPress}
          >
            <ThemedText style={styles.buttonText}>📋 Reglas</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.quickAccessButton} 
            onPress={handleDigitalSignaturePress}
          >
            <ThemedText style={styles.buttonText}>✍️ Firma Digital</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.quickAccessButton} 
            onPress={handleLunchTimePress}
          >
            <ThemedText style={styles.buttonText}>🍽️ Tiempo de Almuerzo</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ThemedView>
      <SlideMenu 
        isVisible={isMenuVisible} 
        onClose={handleMenuClose}
        onProfilePress={handleProfilePress}
        onHomePress={handleHomePress}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fullContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 20,
  },
  welcomeContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  welcomeText: {
    textAlign: 'center',
    marginBottom: 8,
  },
  userText: {
    textAlign: 'center',
    fontSize: 18,
    opacity: 0.8,
    marginTop: 8,
  },
  quickAccessContainer: {
    flex: 1,
    paddingHorizontal: 10,
  },
  sectionTitle: {
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 20,
    fontWeight: 'bold',
  },
  quickAccessButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginBottom: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 16,
    opacity: 0.7,
  },
});