import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, View } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useAuth } from '@/contexts/AuthContext';
import AppHeader from '@/components/AppHeader';
import AppFooter from '@/components/AppFooter';
import SlideMenu from '@/components/SlideMenu';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import * as Network from 'expo-network';
import { markNotificationsAsRead } from '@/hooks/notificationsFunctions';
import { eventBus } from '@/hooks/eventBus';

type NotificationsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Notifications'>;

interface Notification {
  id: number;
  title: string;
  description: string;
  watched: boolean;
  created_at: string;
}

export default function NotificationsScreen() {
  const { employee, refreshAccessToken, logout } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<NotificationsScreenNavigationProp>();
  
  // Notifications state
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [])
  );

  useEffect(() => {
    const handler = () => {
      fetchNotifications();
    };

    eventBus.on('notificationsUpdated', handler);
    return () => {
      eventBus.off('notificationsUpdated', handler);
    };
  }, []);

  const fetchNotifications = async () => {
    try {
      setIsLoading(true);

      // Verificar si existe la variable notifications en AsyncStorage
      let notificationsStr = await AsyncStorage.getItem('notifications');
      
      // Si no existe, crear un array vacío
      if (!notificationsStr) {
        await AsyncStorage.setItem('notifications', JSON.stringify([]));
        setNotifications([]);
      } else {
        const notificationsData = JSON.parse(notificationsStr);
        setNotifications(notificationsData);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
      Alert.alert('Error', 'No se pudieron cargar las notificaciones');
      setNotifications([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getConnectionStatus = async (): Promise<boolean> => {
    const networkState = await Network.getNetworkStateAsync();
    return networkState.isConnected && networkState.isInternetReachable ? true : false;
  };

  const markAsRead = async (notificationId: number) => {
    Alert.alert(
      'Confirmar',
      '¿Deseas marcar esta notificación como leída?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Marcar como leída',
          onPress: async () => {
            try {
              // Verificar conectividad
              const isConnected = await getConnectionStatus();

              if (isConnected) {
                // Con internet: llamar a la función API
                const data = await markNotificationsAsRead({
                  notificationIds: [notificationId],
                  refreshAccessToken,
                  logout,
                });

                if (data.status) {
                  // Actualizar AsyncStorage
                  const notificationsStr = await AsyncStorage.getItem('notifications');
                  if (notificationsStr) {
                    const notificationsData = JSON.parse(notificationsStr);
                    const updatedNotifications = notificationsData.map((n: Notification) => 
                      n.id === notificationId ? { ...n, watched: true } : n
                    );
                    await AsyncStorage.setItem('notifications', JSON.stringify(updatedNotifications));
                    setNotifications(updatedNotifications);
                    
                    // Emitir evento para actualizar el contador en AppHeader
                    eventBus.emit('notificationsUpdated');
                    eventBus.emit('notificationsUpdatedCounter');
                  }
                  Alert.alert('Éxito', 'Notificación marcada como leída');
                } else {
                  Alert.alert('Error', data.message || 'Error al marcar la notificación como leída');
                }
              } else {
                // Sin internet: modo offline
                const actionsStr = await AsyncStorage.getItem('notifications_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                
                // Verificar si ya existe una acción para esta notificación
                const existingActionIndex = actions.findIndex((a: any) => 
                  a.type === 'markAsRead' && a.notificationIds.includes(notificationId)
                );
                
                if (existingActionIndex === -1) {
                  // Agregar nueva acción
                  actions.push({
                    type: 'markAsRead',
                    notificationIds: [notificationId],
                  });
                  await AsyncStorage.setItem('notifications_actions', JSON.stringify(actions));
                }

                // Actualizar AsyncStorage
                const notificationsStr = await AsyncStorage.getItem('notifications');
                if (notificationsStr) {
                  const notificationsData = JSON.parse(notificationsStr);
                  const updatedNotifications = notificationsData.map((n: Notification) => 
                    n.id === notificationId ? { ...n, watched: true } : n
                  );
                  await AsyncStorage.setItem('notifications', JSON.stringify(updatedNotifications));
                  setNotifications(updatedNotifications);
                  
                  // Emitir evento para actualizar el contador en AppHeader
                  eventBus.emit('notificationsUpdated');
                  eventBus.emit('notificationsUpdatedCounter');
                }

                Alert.alert('Modo Offline', 'Notificación marcada como leída localmente. Se sincronizará cuando haya conexión.');
              }
            } catch (err) {
              console.error('Error marking notification as read:', err);
              Alert.alert('Error', 'No se pudo marcar la notificación como leída');
            }
          },
        },
      ]
    );
  };

  const markAllAsRead = async () => {
    // Obtener todas las notificaciones no leídas
    const unreadNotifications = notifications.filter(n => !n.watched);
    
    if (unreadNotifications.length === 0) {
      Alert.alert('Información', 'No hay notificaciones sin leer');
      return;
    }

    Alert.alert(
      'Confirmar',
      `¿Deseas marcar todas las notificaciones (${unreadNotifications.length}) como leídas?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Marcar todas como leídas',
          onPress: async () => {
            try {
              const unreadIds = unreadNotifications.map(n => n.id);
              
              // Verificar conectividad
              const isConnected = await getConnectionStatus();

              if (isConnected) {
                // Con internet: llamar a la función API
                const data = await markNotificationsAsRead({
                  notificationIds: unreadIds,
                  refreshAccessToken,
                  logout,
                });

                if (data.status) {
                  // Actualizar AsyncStorage
                  const notificationsStr = await AsyncStorage.getItem('notifications');
                  if (notificationsStr) {
                    const notificationsData = JSON.parse(notificationsStr);
                    const updatedNotifications = notificationsData.map((n: Notification) => ({
                      ...n,
                      watched: true,
                    }));
                    await AsyncStorage.setItem('notifications', JSON.stringify(updatedNotifications));
                    setNotifications(updatedNotifications);
                    
                    // Emitir evento para actualizar el contador en AppHeader
                    eventBus.emit('notificationsUpdated');
                    eventBus.emit('notificationsUpdatedCounter');
                  }
                  Alert.alert('Éxito', 'Todas las notificaciones han sido marcadas como leídas');
                } else {
                  Alert.alert('Error', data.message || 'Error al marcar las notificaciones como leídas');
                }
              } else {
                // Sin internet: modo offline
                const actionsStr = await AsyncStorage.getItem('notifications_actions');
                const actions = actionsStr ? JSON.parse(actionsStr) : [];
                
                // Agregar nueva acción con todos los IDs no leídos
                actions.push({
                  type: 'markAsRead',
                  notificationIds: unreadIds,
                });
                await AsyncStorage.setItem('notifications_actions', JSON.stringify(actions));

                // Actualizar AsyncStorage
                const notificationsStr = await AsyncStorage.getItem('notifications');
                if (notificationsStr) {
                  const notificationsData = JSON.parse(notificationsStr);
                  const updatedNotifications = notificationsData.map((n: Notification) => ({
                    ...n,
                    watched: true,
                  }));
                  await AsyncStorage.setItem('notifications', JSON.stringify(updatedNotifications));
                  setNotifications(updatedNotifications);
                  
                  // Emitir evento para actualizar el contador en AppHeader
                  eventBus.emit('notificationsUpdated');
                  eventBus.emit('notificationsUpdatedCounter');
                }

                Alert.alert('Modo Offline', 'Todas las notificaciones han sido marcadas como leídas localmente. Se sincronizarán cuando haya conexión.');
              }
            } catch (err) {
              console.error('Error marking all notifications as read:', err);
              Alert.alert('Error', 'No se pudieron marcar las notificaciones como leídas');
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch (error) {
      return dateString;
    }
  };

  // Handle menu press from header
  const handleMenuPress = () => {
    setIsMenuVisible(true);
  };

  // Handle menu close
  const handleMenuClose = () => {
    setIsMenuVisible(false);
  };

  // Handle home navigation from slide menu
  const handleHomePress = () => {
    navigation.navigate('Home');
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader onMenuPress={handleMenuPress} title="Notificaciones" />
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando notificaciones...</ThemedText>
        </ThemedView>
        <AppFooter />
        <SlideMenu 
          isVisible={isMenuVisible} 
          onClose={handleMenuClose}
          onHomePress={handleHomePress}
          currentRoute="Notifications"
        />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={handleMenuPress} title="Notificaciones" />
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <ThemedView style={styles.contentContainer}>
          {/* Module Title */}
          <ThemedView style={styles.titleContainer}>
            <ThemedText type="title" style={styles.title}>
              <Ionicons name="notifications" size={28} color="#007AFF" /> Notificaciones
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              Gestiona tus notificaciones
            </ThemedText>
          </ThemedView>

          {/* Mark All as Read Button */}
          {notifications.some(n => !n.watched) && (
            <TouchableOpacity style={styles.markAllButton} onPress={markAllAsRead}>
              <Ionicons name="checkmark-done" size={20} color="#fff" />
              <ThemedText style={styles.markAllButtonText}>
                Marcar todas como leídas
              </ThemedText>
            </TouchableOpacity>
          )}

          {/* Notifications List */}
          <ThemedView style={styles.notificationsContainer}>
            {notifications.length === 0 ? (
              <ThemedView style={styles.emptyContainer}>
                <Ionicons name="notifications-off-outline" size={80} color="#ccc" />
                <ThemedText style={styles.emptyText}>
                  No hay notificaciones
                </ThemedText>
              </ThemedView>
            ) : (
              notifications.map(notification => (
                <ThemedView 
                  key={notification.id} 
                  style={[
                    styles.notificationCard,
                    { backgroundColor: notification.watched ? '#FFF' : '#E5F1FF' }
                  ]}
                >
                  <ThemedView style={styles.notificationHeader}>
                    <ThemedText style={styles.notificationTitle}>
                      {notification.title}
                    </ThemedText>
                    <TouchableOpacity 
                      style={styles.eyeButton}
                      onPress={() => markAsRead(notification.id)}
                      disabled={notification.watched}
                    >
                      <Ionicons 
                        name={notification.watched ? "eye" : "eye-off"} 
                        size={24} 
                        color={notification.watched ? "#666" : "#007AFF"} 
                      />
                    </TouchableOpacity>
                  </ThemedView>
                  
                  <ThemedText style={styles.notificationDescription}>
                    {notification.description}
                  </ThemedText>
                  
                  <ThemedText style={styles.notificationDate}>
                    <Ionicons name="time-outline" size={14} color="#666" /> {formatDate(notification.created_at)}
                  </ThemedText>
                  
                </ThemedView>
              ))
            )}
          </ThemedView>
        </ThemedView>
      </ScrollView>
      
      <AppFooter />
      <SlideMenu 
        isVisible={isMenuVisible} 
        onClose={handleMenuClose}
        onHomePress={handleHomePress}
        currentRoute="Notifications"
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
    alignItems: 'center',
    padding: 20,
  },
  contentContainer: {
    width: '100%',
    maxWidth: 600,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    width: '100%',
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    opacity: 0.7,
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#34C759',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  markAllButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  notificationsContainer: {
    width: '100%',
    gap: 16,
  },
  notificationCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 16,
    gap: 8,
    position: 'relative',
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    backgroundColor: 'transparent',
  },
  notificationTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
    marginRight: 8,
  },
  eyeButton: {
    padding: 4,
  },
  notificationDescription: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  notificationDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
  },
  unreadBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#007AFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.5,
    textAlign: 'center',
  },
});

