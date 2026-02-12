import AppHeader from '../components/AppHeader';
import AppFooter from '../components/AppFooter';
import SlideMenu from '../components/SlideMenu';
import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import EmployeeProfile from '../components/EmployeeProfile';
import { useAuth } from '../contexts/AuthContext';
import { useQRScanner } from '../hooks/useQRScanner';
import React, { useCallback, useState, useEffect } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, Alert, View, Image, ScrollView } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

// Static mapping of company logos - Metro bundler requires static requires
const COMPANY_LOGOS: { [key: string]: any } = {
  'gonzalez': require('../assets/images/gonzalez-logo.png'),
  'charmander': require('../assets/images/charmander-logo.png'),
};

export default function HomeScreen() {
  const { isAuthenticated, isLoading, employee } = useAuth();
  const [currentCompany, setCurrentCompany] = useState<string | null>(null);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const { scanQR, QRScannerComponent } = useQRScanner();

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated && employee) {
        getCurrentUserStatus();
      }
      return () => {
        console.log('HomeScreen unfocused');
      };
    }, [isAuthenticated, employee])
  );

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigation.replace('Login');
    }
  }, [isAuthenticated, isLoading, navigation]);

  const getCurrentUserStatus = async () => {
    const current_marca = await AsyncStorage.getItem('current_marca');
    if (!current_marca) {
      setCurrentCompany(null);
      return;
    }
    const current_marca_data = JSON.parse(current_marca);

    switch (current_marca_data.empresa.id) {
      case 9:
        setCurrentCompany('gonzalez');
        break;
      case 10:
        setCurrentCompany('charmander');
        break;
    }
  };

  // Show loading spinner while checking authentication
  if (isLoading || !isAuthenticated) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <ThemedText style={styles.loadingText}>Verificando autenticación...</ThemedText>
      </ThemedView>
    );
  }

  // Handle menu press from header
  const handleMenuPress = () => {
    setIsMenuVisible(true);
  };

  // Handle profile navigation from slide menu
  const handleProfilePress = () => {
    navigation.navigate('EmployeeProfile');
  };

  // Handle home navigation from slide menu
  const handleHomePress = () => {
    // Already on home screen, just close menu
    setIsMenuVisible(false);
  };

  // Handle closing slide menu
  const handleMenuClose = () => {
    setIsMenuVisible(false);
  };

  const handleRolesPress = () => {
    navigation.navigate('Roles');
  };

  const handleRulesPress = () => {
    navigation.navigate('Rules');
  };

  const handleDigitalSignaturePress = () => {
    navigation.navigate('DigitalSignature');
  };

  const handleLunchTimePress = () => {
    navigation.navigate('LunchTime');
  };

  const handleMarcarIngresoSalidaPress = () => {
    navigation.navigate('MarcarIngresoSalida');
  };

  const handleNotesPress = () => {
    navigation.navigate('Notes');
  };

  const handleActivitiesPress = () => {
    navigation.navigate('Activities');
  };

  const handleVehiclesPress = () => {
    navigation.navigate('Vehicles');
  };

  const handleVisitorsPress = () => {
    navigation.navigate('Visitors');
  };

  const handleEvaluationsPress = () => {
    navigation.navigate('Evaluations');
  };

  const handleIncidentsPress = () => {
    navigation.navigate('Incidents');
  };

  const handleSurveysPress = () => {
    navigation.navigate('SatisfactionSurveys');
  };

  const handleTrainingsPress = () => {
    navigation.navigate('Trainings');
  };

  const handleVoiceNotesPress = () => {
    navigation.navigate('VoiceNotes');
  };

  const getActionIcon = (action: string, isActive: boolean) => {
    switch (action.toLowerCase()) {
      case 'profile': return <Ionicons name="person" size={30} color='#000000' />;
      case 'lunch-time': return <Ionicons name="hourglass" size={30} color='#000000' />;
      case 'digital-signature': return <Ionicons name="finger-print" size={30} color='#000000' />;
      case 'marcar-ingreso-salida': return <Ionicons name="time" size={30} color='#fff' />;
      case 'notes': return <Ionicons name="document" size={30} color='#000000' />;
      case 'activities': return <Ionicons name="list" size={30} color='#000000' />;
      case 'vehicles': return <Ionicons name="car" size={30} color='#000000' />;
      case 'visitors': return <Ionicons name="people" size={30} color='#000000' />;
      case 'evaluations': return <Ionicons name="clipboard" size={30} color='#000000' />;
      case 'incidents': return <Ionicons name="warning" size={30} color='#000000' />;
      case 'surveys': return <Ionicons name="document-text" size={30} color='#000000' />;
      case 'trainings': return <Ionicons name="school" size={30} color='#000000' />;
      case 'voice-notes': return <Ionicons name="mic" size={30} color='#000000' />;
      case 'logout': return <Ionicons name="log-out" size={30} color='#000000' />;
      case 'scan-qr': return <Ionicons name="scan" size={30} color='#fff' />;
    }
  };

  const handleScanQRPress = async () => {
    try {
      const qrData = await scanQR();
      if (qrData) {
        let data = atob(qrData);
        // Convertir a json separando por el caracter ":"
        let dataSplit = data.split(':');
        let dataJson = {
          session: dataSplit[0],
          user: dataSplit[1],
          latitude: dataSplit[2],
          longitude: dataSplit[3],
          timestamp: dataSplit[4],
        };
        Alert.alert(
          'QR Escaneado',
          `Datos del QR:\n\nSession: ${dataJson.session}\nUser: ${dataJson.user}\nLatitude: ${dataJson.latitude}\nLongitude: ${dataJson.longitude}\nHora: ${new Date(parseInt(dataJson.timestamp)).toISOString()}`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Cancelado', 'Escaneo de QR cancelado');
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo escanear el código QR');
      console.error('Error scanning QR:', error);
    }
  };

  const monthNames = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
  ];

  const formatDate = (dateString: string) => {
    try {
      // Convierte el string a número
      const timestamp = Number(dateString);

      // Si no es un número válido, lanza error
      if (isNaN(timestamp)) throw new Error("Invalid timestamp");

      // Crea el objeto Date
      const date = new Date(timestamp);

      // Obtiene hora y minutos en horario local
      let hours = date.getHours();
      const minutes = date.getMinutes();

      // AM / PM
      const ampm = hours >= 12 ? "pm" : "am";
      hours = hours % 12 || 12;

      // Formato final
      const formatted = `${hours}:${minutes.toString().padStart(2, "0")} ${ampm}`;

      return `${date.getDate()} de ${monthNames[date.getMonth()]} de ${date.getFullYear()}, ${formatted}`;
    } catch (error) {
      return dateString;
    }
  };

  // Show authenticated home screen
  return (
    <ThemedView style={styles.fullContainer}>
      <AppHeader onMenuPress={handleMenuPress} title="Inicio" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
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

          {/* Logo */}
          {currentCompany && COMPANY_LOGOS[currentCompany] && (
            <ThemedView style={styles.logoContainer}>
              <Image
                source={COMPANY_LOGOS[currentCompany]}
                style={styles.logo}
                resizeMode="contain"
              />
            </ThemedView>
          )}

          {/* Quick access buttons */}
          <ThemedView style={styles.quickAccessContainer}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Accesos Directos
            </ThemedText>

            <View style={styles.buttonsRow}>
              <TouchableOpacity
                style={styles.quickAccessButton}
                onPress={handleMarcarIngresoSalidaPress}
              >
                {getActionIcon('marcar-ingreso-salida', true)}
                <ThemedText style={styles.buttonText}>Marca</ThemedText>
              </TouchableOpacity>

            </View>


            <View style={styles.buttonsRow}>
              <TouchableOpacity
                style={[styles.quickAccessButton, styles.scanButton]}
                onPress={handleScanQRPress}
              >
                {getActionIcon('scan-qr', true)}
                <ThemedText style={styles.buttonText}>Escanear Firma</ThemedText>
              </TouchableOpacity>
            </View>
          </ThemedView>
        </ThemedView>
      </ScrollView>
      <SlideMenu
        isVisible={isMenuVisible}
        onClose={handleMenuClose}
        onHomePress={handleHomePress}
      />
      {QRScannerComponent}
      <AppFooter />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fullContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    padding: 20,
  },
  welcomeContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
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
  logoContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  logo: {
    width: 200,
    height: 150,
  },
  quickAccessContainer: {
    paddingHorizontal: 10,
  },
  sectionTitle: {
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 20,
    fontWeight: 'bold',
  },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  quickAccessButton: {
    backgroundColor: '#007AFF',
    paddingBottom: 10,
    paddingTop: 15,
    paddingHorizontal: 15,
    borderRadius: 10,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
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
    fontSize: 8,
    fontWeight: '600',
  },
  scanButton: {
    backgroundColor: '#34C759', // Verde para distinguir el botón de escaneo
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 16,
    opacity: 0.7,
  },
});

