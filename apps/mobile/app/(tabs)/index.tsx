import AppHeader from '@/components/AppHeader';
import ForgotPassword from '@/components/ForgotPassword';
import LoginForm from '@/components/LoginForm';
import SlideMenu from '@/components/SlideMenu';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import UserProfile from '@/components/UserProfile';
import { useAuth } from '@/contexts/AuthContext';
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

export default function HomeScreen() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [currentView, setCurrentView] = useState<'login' | 'forgot' | 'home' | 'profile'>('login');
  const [isMenuVisible, setIsMenuVisible] = useState(false);

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
    setCurrentView('profile');
  };

  // Handle home navigation from slide menu
  const handleHomePress = () => {
    setCurrentView('home');
  };

  // Handle closing slide menu
  const handleMenuClose = () => {
    setIsMenuVisible(false);
  };

  // Show user profile screen
  if (currentView === 'profile') {
    return (
      <ThemedView style={styles.fullContainer}>
        <AppHeader onMenuPress={handleMenuPress} />
        <UserProfile />
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
        <ThemedView style={styles.contentContainer}>
          <ThemedText type="title" style={styles.welcomeText}>
            Bienvenido a la aplicación de Gonzalez
          </ThemedText>
          {user && (
            <ThemedText style={styles.userText}>
              ¡Hola, {user.name}!
            </ThemedText>
          )}
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  contentContainer: {
    alignItems: 'center',
    gap: 16,
  },
  welcomeText: {
    textAlign: 'center',
    marginBottom: 8,
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 16,
    opacity: 0.7,
  },
  userText: {
    textAlign: 'center',
    fontSize: 18,
    opacity: 0.8,
    marginTop: 8,
  },
});