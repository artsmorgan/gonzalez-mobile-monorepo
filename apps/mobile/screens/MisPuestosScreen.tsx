import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import AppHeader from '@/components/AppHeader';
import AppFooter from '@/components/AppFooter';
import SlideMenu from '@/components/SlideMenu';
import MisPuestosSection from '@/components/MisPuestosSection';
import { useAuth } from '@/contexts/AuthContext';
import { RootStackParamList } from '../App';

type MisPuestosNavigationProp = NativeStackNavigationProp<RootStackParamList, 'MisPuestos'>;

/**
 * Módulo «Mis puestos»: abierto para todos los roles y tipos de usuario, tengan o no una marca. Lista los puestos del empleado según sus marcas de hoy en
 * adelante; cada uno abre una ventana con el mapa (ubicación del puesto y la actual del dispositivo) y permite elegir con qué aplicación de mapas llegar.
 */
export default function MisPuestosScreen() {
  const { refreshAccessToken, logout } = useAuth();
  const navigation = useNavigation<MisPuestosNavigationProp>();
  const [isMenuVisible, setIsMenuVisible] = useState(false);

  return (
    <ThemedView style={styles.container}>
      <AppHeader title="Mis puestos" onMenuPress={() => setIsMenuVisible(true)} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <ThemedView style={styles.content}>
          {/* Título del módulo: mismo encabezado que el resto de módulos (icono + título, subtítulo y línea inferior) */}
          <ThemedView style={styles.titleContainer}>
            <ThemedView style={styles.title}>
              <Ionicons name="business" size={24} color="#000000" />
              <ThemedText type="title" style={styles.titleText}>
                Mis puestos
              </ThemedText>
            </ThemedView>
            <ThemedText style={styles.subtitle}>Puestos donde tienes turnos de hoy en adelante</ThemedText>
          </ThemedView>

          <MisPuestosSection refreshAccessToken={refreshAccessToken} logout={logout} embedded />
        </ThemedView>
      </ScrollView>
      <AppFooter />
      <SlideMenu isVisible={isMenuVisible} onClose={() => setIsMenuVisible(false)} onHomePress={() => navigation.navigate('Home')} currentRoute="MisPuestos" />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  content: { width: '100%', maxWidth: 800, alignSelf: 'center' },

  titleContainer: {
    alignItems: 'center',
    marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    width: '100%',
  },
  title: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    gap: 10,
  },
  titleText: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
  },
});
