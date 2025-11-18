import AppHeader from '../components/AppHeader';
import AppFooter from '../components/AppFooter';
import SlideMenu from '../components/SlideMenu';
import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import { useAuth } from '../contexts/AuthContext';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import React, { useEffect, useState, useRef } from 'react';
import { ActivityIndicator, Alert, StyleSheet, TouchableOpacity, View, ScrollView, Modal, Image, Dimensions } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SignatureScreen from "react-native-signature-canvas";
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { jwtDecode } from 'jwt-decode';
import * as Network from 'expo-network';
import saveManualSignature from '@/hooks/saveManualSignature';
import getHoraAccion from '@/hooks/getHoraAccion';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type DigitalSignatureScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'DigitalSignature'>;

export default function DigitalSignatureScreen() {
  const { isAuthenticated, isLoading, employee, refreshAccessToken, logout } = useAuth();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [signatureHash, setSignatureHash] = useState<string | null>(null);
  const [isGeneratingSignature, setIsGeneratingSignature] = useState(false);
  const [signatureError, setSignatureError] = useState<string | null>(null);
  
  // QR refresh timer states
  const [refreshTimer, setRefreshTimer] = useState(20);
  const [isTimerActive, setIsTimerActive] = useState(false);
  
  // Manual signature modal states
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [manualSignature, setManualSignature] = useState<string | null>(null);
  const [isLoadingManualSignature, setIsLoadingManualSignature] = useState(false);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [isSavingSignature, setIsSavingSignature] = useState(false);
  const [signatureKey, setSignatureKey] = useState(0); // Key to force re-render
  const signatureRef = useRef<any>(null);
  
  const navigation = useNavigation<DigitalSignatureScreenNavigationProp>();

  useEffect(() => {
    // Request location permissions and start watching location
    (async () => {
      try {
        // Request foreground permissions
        const { status } = await Location.requestForegroundPermissionsAsync();
        
        if (status !== 'granted') {
          setLocationError('Permiso de ubicación denegado. Por favor, activa la ubicación en la configuración de tu dispositivo.');
          setIsLoadingLocation(false);
          return;
        }

        // Check if location services are enabled
        const isLocationEnabled = await Location.hasServicesEnabledAsync();
        if (!isLocationEnabled) {
          setLocationError('Los servicios de ubicación están desactivados. Por favor, activa la ubicación en tu dispositivo.');
          setIsLoadingLocation(false);
          return;
        }

        // Get initial location
        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        setLocation(currentLocation);
        setIsLoadingLocation(false);

        // Generate signature automatically after getting location (only once)
        await generateSignature(currentLocation);

        // Watch location changes in real-time (only update location, not signature)
        const subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 5000, // Update every 5 seconds
            distanceInterval: 10, // Update when moved 10 meters
          },
          (newLocation) => {
            setLocation(newLocation);
            // Don't regenerate signature on every location change
            // QR code should remain stable for presentation
          }
        );

        // Cleanup subscription on unmount
        return () => {
          subscription.remove();
        };
      } catch (error) {
        console.error('Error obteniendo ubicación:', error);
        setLocationError('Error al obtener la ubicación. Por favor, verifica que los servicios de ubicación estén habilitados.');
        setIsLoadingLocation(false);
      }
    })();
  }, []);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigation.replace('Home');
    }
  }, [isAuthenticated, isLoading, navigation]);

  // QR refresh timer effect
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    if (isTimerActive && refreshTimer > 0) {
      interval = setInterval(() => {
        setRefreshTimer((prev) => {
          if (prev <= 1) {
            // Timer reached 0, refresh QR
            if (location && employee) {
              generateSignature(location);
            }
            return 20; // Reset to 20 seconds
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isTimerActive, refreshTimer, location, employee]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      setIsTimerActive(false);
    };
  }, []);

  const handleMenuPress = () => {
    setIsMenuVisible(true);
  };

  const handleMenuClose = () => {
    setIsMenuVisible(false);
  };


  const handleHomePress = () => {
    navigation.navigate('Home');
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const generateSignature = async (currentLocation: Location.LocationObject) => {
    if (!employee) {
      setSignatureError('No se pudo obtener la información del empleado');
      return;
    }

    setIsGeneratingSignature(true);
    setSignatureError(null);

    try {
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) {
        throw new Error('Server URL not configured');
      }

      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const decodedToken = jwtDecode(token);
      const sessionId = JSON.parse(JSON.stringify(decodedToken)).sessionId;

      const horaAccion = await getHoraAccion();
      if (!horaAccion) {
        throw new Error('Hora de acción not found');
      }
      
      // Encode base64
      const hash = btoa(sessionId + ":" + employee.id + ":" + currentLocation.coords.latitude + ":" + currentLocation.coords.longitude + ":" + horaAccion);

      /*
      const requestData = {
        empleadoId: employee.id,
        timestamp: Date.now(),
        gps: {
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
          accuracy: currentLocation.coords.accuracy || 0,
        },
      };

      const response = await fetch(`${apiUrl}/api/digital-signature/generate-signature`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '69420',
        },
        body: JSON.stringify(requestData),
      });

      if (response.status === 401 || response.status === 403) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          return generateSignature(currentLocation);
        } else {
          // If refresh fails, logout the user
          await logout();
        }
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      console.log('data', data);
      */

      //if (data.status && data.hash) {
        setSignatureHash(hash);
        // Start the refresh timer when signature is generated successfully
        setIsTimerActive(true);
        setRefreshTimer(20);
      /*} else {
        throw new Error(data.message || 'Error al generar la firma');
      }*/
    } catch (error) {
      console.error('Error generating signature:', error);
      setSignatureError('Error al generar la firma digital. Por favor, intenta nuevamente.');
      // Stop timer on error
      setIsTimerActive(false);
    } finally {
      setIsGeneratingSignature(false);
    }
  };

  const fetchManualSignature = async () => {
    if (!employee) return;

    setIsLoadingManualSignature(true);
    try {
      /*
      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) {
        throw new Error('Server URL not configured');
      }

      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${apiUrl}/api/digital-signature/manual-signature/${employee.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '69420',
        },
      });

      if (response.status === 401 || response.status === 403) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          return fetchManualSignature();
        } else {
          // If refresh fails, logout the user
          await logout();
        }
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.status) {
        setManualSignature(data.manualSignature);
      }*/

      setManualSignature(employee.firmaManual);
    } catch (error) {
      console.error('Error fetching manual signature:', error);
      Alert.alert('Error', 'No se pudo cargar la firma manual');
    } finally {
      setIsLoadingManualSignature(false);
    }
  };

  const handleManualSignaturePress = () => {
    setIsModalVisible(true);
    fetchManualSignature();
  };

  const handleCloseModal = () => {
    setIsModalVisible(false);
    setIsDrawingMode(false);
  };

  const handleAddOrUpdateSignature = () => {
    setIsDrawingMode(true);
    setSignatureKey(prev => prev + 1); // Reset canvas
  };

  const handleOK = (signature: string) => {
    // Show confirmation dialog
    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que deseas guardar esta firma?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Guardar',
          onPress: () => saveSignature(signature),
        },
      ]
    );
  };

  const handleClear = () => {
    // Force re-render of the canvas by updating the key
    setSignatureKey(prev => prev + 1);
  };

  const saveSignature = async (signature: string) => {

    if (!employee) return;

    setIsSavingSignature(true);

    const networkState = await Network.getNetworkStateAsync();

    try {
      let status_result = false;
      let message_result = "";
      if (networkState.isConnected && networkState.isInternetReachable) {

        const data = await saveManualSignature({ signature, employeeId: employee.id, refreshAccessToken, logout });

        status_result = data.status;
        message_result = data.message;
      } else {
        status_result = true;
        await AsyncStorage.setItem('manual_signature_cache', signature);
      }

      if (status_result) {
        Alert.alert('Éxito', 'Firma guardada correctamente');
        employee.firmaManual = signature;
        setManualSignature(signature);
        setIsDrawingMode(false);
      } else {
        throw new Error(message_result || 'Error al guardar la firma');
      }
    } catch (error) {
      console.error('Error saving signature:', error);
      Alert.alert('Error', 'No se pudo guardar la firma');
    } finally {
      setIsSavingSignature(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'digital-signature': return <Ionicons name="finger-print" size={25} color='#000000' />;
      case 'timer': return <Ionicons name="hourglass" size={12.5} color='#000000' />;
      case 'manual': return <Ionicons name="pencil" size={20} color='#000000' />;
      case 'update': return <Ionicons name="pencil" size={20} color='#000000' />;
      case 'clear': return <Ionicons name="trash" size={20} color='#000000' />;
      case 'save': return <Ionicons name="save" size={20} color='#FFFFFF' />;
      case 'retry': return <Ionicons name="refresh" size={20} color='#FFFFFF' />;
      case 'error': return <Ionicons name="warning" size={17.5} color='#FFCC00' />; // yellow color
      default: return <Ionicons name="close" size={35} color='#FFFFFF' />;
    }
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <ThemedText style={styles.loadingText}>Cargando...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.fullContainer}>
      <AppHeader onMenuPress={handleMenuPress} title="Mi Firma Digital" />
      
      <ScrollView style={styles.scrollView}>
        <ThemedView style={styles.container}>

          {/* Module Title */}
          <ThemedView style={styles.titleContainer}>
            <ThemedText type="title" style={styles.title}>
              {getActionIcon('digital-signature')} Mi Firma Digital
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              Código QR de verificación
            </ThemedText>
          </ThemedView>

          {/* QR Code Section */}
          {isLoadingLocation ? (
            <ThemedView style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <ThemedText style={styles.loadingLocationText}>
                Obteniendo ubicación...
              </ThemedText>
            </ThemedView>
          ) : locationError ? (
            <ThemedView style={styles.errorContainer}>
              <ThemedText style={styles.errorText}>{getActionIcon('error')} {locationError}</ThemedText>
              <TouchableOpacity 
                style={styles.retryButton}
                onPress={() => {
                  setLocationError(null);
                  setIsLoadingLocation(true);
                  Location.requestForegroundPermissionsAsync().then(() => {
                    Location.getCurrentPositionAsync({
                      accuracy: Location.Accuracy.High,
                    }).then(async (loc) => {
                      setLocation(loc);
                      setIsLoadingLocation(false);
                      await generateSignature(loc);
                    }).catch((err) => {
                      setLocationError('Error al obtener la ubicación.');
                      setIsLoadingLocation(false);
                    });
                  });
                }}
              >
                <ThemedText style={styles.retryButtonText}>{getActionIcon('retry')}</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          ) : isGeneratingSignature ? (
            <ThemedView style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <ThemedText style={styles.loadingLocationText}>
                Generando firma digital...
              </ThemedText>
            </ThemedView>
          ) : signatureError ? (
            <ThemedView style={styles.errorContainer}>
              <ThemedText style={styles.errorText}>{getActionIcon('error')} {signatureError}</ThemedText>
              <TouchableOpacity 
                style={styles.retryButton}
                onPress={() => {
                  if (location) {
                    generateSignature(location);
                  }
                }}
              >
                <ThemedText style={styles.retryButtonText}>{getActionIcon('retry')}</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          ) : signatureHash && location ? (
            <ThemedView style={styles.qrContainer}>
              {/* QR Code */}
              <ThemedView style={styles.qrCodeWrapper}>
                <QRCode
                  value={signatureHash}
                  size={250}
                  color="#000000"
                  backgroundColor="#FFFFFF"
                />
              </ThemedView>

              {/* Refresh Timer */}
              <ThemedView style={styles.timerContainer}>
                <ThemedView style={styles.timerBadge}>
                  <ThemedText style={styles.timerText}>
                    {getActionIcon('timer')} Tu firma se refrescará en: {refreshTimer}s
                  </ThemedText>
                </ThemedView>
              </ThemedView>

              {/* Message below QR */}
              <ThemedText style={styles.qrMessage}>
                Presente este código QR a tu supervisor según se necesite
              </ThemedText>
              
            {/* Manual Signature Button - Always visible */}
              <ThemedView style={styles.manualSignatureButtonContainer}>
                <TouchableOpacity 
                  style={styles.manualSignatureButton}
                  onPress={handleManualSignaturePress}
                >
                  <ThemedText style={styles.manualSignatureButtonText}>
                    {getActionIcon('manual')} Firma Manual
                  </ThemedText>
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>
          ) : null}
        </ThemedView>
      </ScrollView>

      {/* Manual Signature Modal */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalOverlay}>
          <ThemedView style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Firma Manual</ThemedText>
              <TouchableOpacity onPress={handleCloseModal}>
                <ThemedText style={styles.closeButton}>✕</ThemedText>
              </TouchableOpacity>
            </View>

            {/* Modal Content */}
            <ScrollView style={styles.modalContent}>
              {isLoadingManualSignature ? (
                <View style={styles.modalLoadingContainer}>
                  <ActivityIndicator size="large" color="#007AFF" />
                  <ThemedText style={styles.modalLoadingText}>
                    Cargando firma...
                  </ThemedText>
                </View>
              ) : isDrawingMode ? (
                <View style={styles.signatureContainer}>
                  <ThemedText style={styles.signatureInstructions}>
                    Dibuja tu firma en el área blanca
                  </ThemedText>
                  <View style={styles.signatureCanvasWrapper}>
                    <SignatureScreen
                      key={signatureKey}
                      ref={signatureRef}
                      onOK={handleOK}
                      descriptionText=""
                      webStyle={`
                        body, html {
                          margin: 0;
                          padding: 0;
                          height: 100%;
                          width: 100%;
                        }
                        .m-signature-pad {
                          position: absolute;
                          top: 0;
                          left: 0;
                          right: 0;
                          bottom: 0;
                          margin: 0;
                          padding: 0;
                          box-shadow: none;
                          border: none;
                          background-color: #FFFFFF;
                        }
                        .m-signature-pad--body {
                          position: absolute;
                          top: 0;
                          left: 0;
                          right: 0;
                          bottom: 0;
                          border: none;
                          margin: 0;
                          padding: 0;
                        }
                        .m-signature-pad--body canvas {
                          width: 100% !important;
                          height: 100% !important;
                        }
                        .m-signature-pad--footer {
                          display: none;
                        }
                      `}
                    />
                  </View>
                  <View style={styles.signatureActions}>
                    <TouchableOpacity 
                      style={styles.signatureClearButton}
                      onPress={handleClear}
                    >
                      <ThemedText style={styles.signatureClearButtonText}>
                        {getActionIcon('clear')}
                      </ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.signatureSaveButton}
                      onPress={() => signatureRef.current?.readSignature()}
                      disabled={isSavingSignature}
                    >
                      {isSavingSignature ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <ThemedText style={styles.signatureSaveButtonText}>
                          {getActionIcon('save')}
                        </ThemedText>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.signatureDisplayContainer}>
                  {manualSignature ? (
                    <>
                      <ThemedText style={styles.signatureLabel}>
                        Tu firma actual:
                      </ThemedText>
                      <Image 
                        source={{ uri: manualSignature }}
                        style={styles.signatureImage}
                        resizeMode="contain"
                      />
                      <TouchableOpacity 
                        style={styles.updateSignatureButton}
                        onPress={handleAddOrUpdateSignature}
                      >
                        <ThemedText style={styles.updateSignatureButtonText}>
                          {getActionIcon('update')}
                        </ThemedText>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <ThemedText style={styles.noSignatureText}>
                        No tienes una firma manual registrada
                      </ThemedText>
                      <TouchableOpacity 
                        style={styles.addSignatureButton}
                        onPress={handleAddOrUpdateSignature}
                      >
                        <ThemedText style={styles.addSignatureButtonText}>
                          ➕ Añadir
                        </ThemedText>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}
            </ScrollView>
          </ThemedView>
        </View>
      </Modal>

      <SlideMenu 
        isVisible={isMenuVisible} 
        onClose={handleMenuClose}
        onHomePress={handleHomePress}
        currentRoute="digital-signature"
      />
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
  container: {
    flex: 1,
    padding: 20,
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
    gap: 16,
    minHeight: 300,
  },
  loadingLocationText: {
    fontSize: 16,
    opacity: 0.7,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 20,
    minHeight: 300,
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  qrContainer: {
    alignItems: 'center',
    gap: 15,
    paddingBottom: 20,
  },
  qrCodeWrapper: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  locationInfoCard: {
    width: '100%',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 20,
    gap: 12,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#007AFF',
    flex: 1,
    textAlign: 'right',
  },
  realtimeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 8,
  },
  pulseDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#34C759',
  },
  realtimeText: {
    fontSize: 14,
    color: '#34C759',
    fontWeight: '600',
  },
  hashContainer: {
    width: '100%',
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    padding: 16,
    gap: 8,
  },
  hashLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
    textAlign: 'center',
  },
  hashText: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#333333',
    textAlign: 'center',
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 16,
    opacity: 0.7,
  },
  qrMessage: {
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
    opacity: 0.8,
    lineHeight: 24,
  },
  manualSignatureButtonContainer: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  manualSignatureButton: {
    backgroundColor: '#34C759',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  manualSignatureButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    height: SCREEN_HEIGHT * 0.8,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  closeButton: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#666666',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  modalLoadingText: {
    marginTop: 16,
    fontSize: 16,
    opacity: 0.7,
  },
  signatureDisplayContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  signatureLabel: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
  },
  signatureImage: {
    width: SCREEN_WIDTH * 0.8,
    height: 200,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    marginBottom: 30,
  },
  noSignatureText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    opacity: 0.7,
  },
  addSignatureButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 10,
  },
  addSignatureButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  updateSignatureButton: {
    backgroundColor: '#FF9500',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 10,
  },
  updateSignatureButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  signatureContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  signatureInstructions: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '500',
  },
  signatureCanvasWrapper: {
    height: 200,
    width: '100%',
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    position: 'relative',
  },
  signatureActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 15,
  },
  signatureClearButton: {
    flex: 1,
    backgroundColor: '#FF3B30',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  signatureClearButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  signatureSaveButton: {
    flex: 1,
    backgroundColor: '#34C759',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  signatureSaveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  timerContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  timerBadge: {
    backgroundColor: '#007AFF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  timerText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});

