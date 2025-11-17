import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import Ionicons from '@expo/vector-icons/build/Ionicons';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface AppHeaderProps {
  onMenuPress: () => void;
  title: string;
}

export default function AppHeader({ onMenuPress, title }: AppHeaderProps) {

  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();

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
      <TouchableOpacity style={styles.menuButton} onPress={onMenuPress}>
        <Ionicons name="menu" size={30} color="#007AFF" />
      </TouchableOpacity>
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
    paddingTop: 50, // Account for status bar
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
