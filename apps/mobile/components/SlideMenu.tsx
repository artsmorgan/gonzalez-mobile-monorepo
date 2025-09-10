import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useAuth } from '@/contexts/AuthContext';
import React from 'react';
import { ActivityIndicator, Alert, Animated, Dimensions, Modal, StyleSheet, TouchableOpacity } from 'react-native';

interface SlideMenuProps {
  isVisible: boolean;
  onClose: () => void;
  onProfilePress: () => void;
  onHomePress: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MENU_WIDTH = SCREEN_WIDTH * 0.75;

export default function SlideMenu({ isVisible, onClose, onProfilePress, onHomePress }: SlideMenuProps) {
  const { user, logout } = useAuth();
  const slideAnim = React.useRef(new Animated.Value(MENU_WIDTH)).current;
  const [shouldRender, setShouldRender] = React.useState(false);
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  React.useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: MENU_WIDTH,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setShouldRender(false);
      });
    }
  }, [isVisible, slideAnim]);

  const handleLogout = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que deseas cerrar sesión?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Cerrar Sesión',
          style: 'destructive',
          onPress: async () => {
            setIsLoggingOut(true);
            onClose();
            try {
              const result = await logout();
              if (result && result.status) {
                // Show success message
                Alert.alert(
                  'Éxito',
                  result.message || 'Sesión cerrada correctamente',
                  [{ text: 'OK' }]
                );
              }
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert(
                'Error',
                'Ocurrió un error al cerrar sesión',
                [{ text: 'OK' }]
              );
            } finally {
              setIsLoggingOut(false);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleProfilePress = () => {
    onClose();
    onProfilePress();
  };

  const handleHomePress = () => {
    onClose();
    onHomePress();
  };

  if (!shouldRender) {
    return null;
  }

  return (
    <>
      {/* Overlay */}
      <TouchableOpacity 
        style={styles.overlay} 
        activeOpacity={1} 
        onPress={onClose}
      />
      
      {/* Slide Menu */}
      <Animated.View 
        style={[
          styles.menuContainer, 
          { transform: [{ translateX: slideAnim }] }
        ]}
      >
        <ThemedView style={styles.menu}>
          {/* Header Section */}
          <ThemedView style={styles.headerSection}>
            <ThemedText type="title" style={styles.appTitle}>
              Gonzalez App
            </ThemedText>
            {user && (
              <ThemedView style={styles.userInfo}>
                <ThemedText style={styles.userName}>{user.name}</ThemedText>
                <ThemedText style={styles.userEmail}>{user.email}</ThemedText>
              </ThemedView>
            )}
          </ThemedView>

          {/* Menu Options */}
          <ThemedView style={styles.menuOptions}>
            <TouchableOpacity style={styles.menuItem} onPress={handleHomePress}>
              <ThemedText style={styles.menuItemText}>Inicio</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleProfilePress}>
              <ThemedText style={styles.menuItemText}>Perfil de Usuario</ThemedText>
            </TouchableOpacity>
          </ThemedView>

          {/* Logout Section at Bottom */}
          <ThemedView style={styles.logoutSection}>
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <ThemedText style={styles.logoutButtonText}>🚪 Cerrar Sesión</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        </ThemedView>
      </Animated.View>

      {/* Logout Loading Modal */}
      <Modal
        visible={isLoggingOut}
        transparent={true}
        animationType="fade"
      >
        <ThemedView style={styles.loadingOverlay}>
          <ThemedView style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <ThemedText style={styles.loadingText}>
              Cerrando sesión...
            </ThemedText>
          </ThemedView>
        </ThemedView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 999,
  },
  menuContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: MENU_WIDTH,
    zIndex: 1000,
  },
  menu: {
    flex: 1,
    paddingTop: 50, // Account for status bar
  },
  headerSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  appTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  userInfo: {
    gap: 4,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
  },
  userEmail: {
    fontSize: 14,
    opacity: 0.7,
  },
  menuOptions: {
    flex: 1,
    paddingTop: 20,
    paddingBottom: 20,
  },
  menuItem: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '500',
  },
  logoutSection: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  logoutButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    backgroundColor: '#ffffff',
    padding: 30,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
    textAlign: 'center',
  },
});
