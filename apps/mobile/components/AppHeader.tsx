import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import React, { useState, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { eventBus } from '@/hooks/eventBus';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface AppHeaderProps {
  onMenuPress: () => void;
  title: string;
}

export default function AppHeader({ onMenuPress, title }: AppHeaderProps) {

  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Cargar contador al montar
    updateUnreadCount();

    // Escuchar evento de actualización de notificaciones
    const handler = () => {
      updateUnreadCount();
    };

    eventBus.on('notificationsUpdatedCounter', handler);
    return () => {
      eventBus.off('notificationsUpdatedCounter', handler);
    };
  }, []);

  const updateUnreadCount = async () => {
    try {
      const notificationsStr = await AsyncStorage.getItem('notifications');
      if (notificationsStr) {
        const notifications = JSON.parse(notificationsStr);
        const count = notifications.filter((n: any) => !n.watched).length;
        setUnreadCount(count);
      } else {
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error updating unread count:', error);
      setUnreadCount(0);
    }
  };

  const handleNotificationsPress = () => {
    navigation.navigate('Notifications');
  };

  return (
    <ThemedView style={styles.header}>
      <ThemedView style={styles.titleContainer}>
        {route.name !== 'Home' && (
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-undo" size={20} color="#ffffff" />
          </TouchableOpacity>
        )}
        <ThemedText type="subtitle" style={styles.title}>
          {title}
        </ThemedText>
      </ThemedView>
      <ThemedView style={styles.rightContainer}>
        <TouchableOpacity style={styles.notificationsButton} onPress={handleNotificationsPress}>
          <Ionicons name="notifications" size={26} color="#007AFF" />
          {unreadCount > 0 && (
            <ThemedView style={styles.badge}>
              <ThemedText style={styles.badgeText}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </ThemedText>
            </ThemedView>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuButton} onPress={onMenuPress}>
          <Ionicons name="menu" size={30} color="#007AFF" />
        </TouchableOpacity>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  titleContainer: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backButton: {
    backgroundColor: '#007AFF',
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    paddingHorizontal: 8,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: 'transparent',
  },
  notificationsButton: {
    position: 'relative',
    padding: 4,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    top: -2,
  },
  menuButton: {
    
  },
  menuIcon: {
    width: 24,
    height: 18,
    justifyContent: 'space-between',
  },
  menuLine: {
    height: 2,
    backgroundColor: '#007AFF',
    borderRadius: 1,
  },
});
