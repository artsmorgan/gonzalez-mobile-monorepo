import React, { useState } from 'react';
import { StyleSheet, ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import AppHeader from '@/components/AppHeader';
import AppFooter from '@/components/AppFooter';
import SlideMenu from '@/components/SlideMenu';
import JerarquiaModule from '@/components/JerarquiaModule';
import { RootStackParamList } from '../App';

type JerarquiaScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Jerarquia'>;

export default function JerarquiaScreen() {
  const navigation = useNavigation<JerarquiaScreenNavigationProp>();
  const [isMenuVisible, setIsMenuVisible] = useState(false);

  const handleMenuPress = () => setIsMenuVisible(true);
  const handleMenuClose = () => setIsMenuVisible(false);
  const handleHomePress = () => {
    navigation.navigate('Home');
    setIsMenuVisible(false);
  };

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={handleMenuPress} title="Jerarquía" />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.moduleContainer}>
          <ThemedView style={styles.titleContainer}>
            <ThemedText type="title" style={styles.title}>
            <Ionicons name="git-network" size={20} color="#000000" />Jerarquía
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              Explora la jerarquía completa desde empresa hasta empleado. Actualiza la estructura cuando tengas
              conexión y utiliza los selectores para navegar por cada nivel.
            </ThemedText>
          </ThemedView>

          <JerarquiaModule />
        </View>
      </ScrollView>

      <AppFooter />
      <SlideMenu
        isVisible={isMenuVisible}
        onClose={handleMenuClose}
        onHomePress={handleHomePress}
        currentRoute="Jerarquia"
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  moduleContainer: {
    width: '100%',
    maxWidth: 800,
    alignSelf: 'center',
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    width: '100%',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
  },
});

