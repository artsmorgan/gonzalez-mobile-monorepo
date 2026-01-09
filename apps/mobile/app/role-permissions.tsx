import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, FlatList, TextInput } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import AppHeader from '@/components/AppHeader';
import AppFooter from '@/components/AppFooter';
import SlideMenu from '@/components/SlideMenu';
import { useAuth } from '@/contexts/AuthContext';
import Constants from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Action {
  nombre: string;
  validate: boolean;
}

interface Module {
  module_name: string;
  actions: Action[];
}

export default function RolePermissionsScreen() {
  const { accessToken, refreshAccessToken, logout } = useAuth();
  const params = useLocalSearchParams();
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [searchText, setSearchText] = useState('');

  // Parse parameters
  const roleId = params.roleId as string;
  const roleName = params.roleName as string;

  // Filtrar módulos basado en el texto de búsqueda (module_name)
  const filteredModules = useMemo(() => {
    if (!searchText.trim()) {
      return modules;
    }
    return modules.filter(module => 
      module.module_name.toLowerCase().includes(searchText.toLowerCase())
    );
  }, [modules, searchText]);

  
  const updateAction = (action: string, isActive: boolean, roleName: string, moduleName: string) => {
    // ALERT de confirmacion
    let action_text = isActive ? 'desactivar' : 'activar';
    Alert.alert('Confirmacion', `¿Estás seguro de que deseas ${action_text} el permiso "${action}" para el rol "${roleName}" en "${moduleName}"?`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', style: 'destructive', onPress: async () => {
            const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
            if (!apiUrl) {
                Alert.alert('Error', 'URL del servidor no configurada');
                return;
            }
            let token = await AsyncStorage.getItem('access_token');
            
            // Try to refresh token if we don't have one
            if (!token) {
                const refreshed = await refreshAccessToken();
                if (!refreshed) {
                    Alert.alert('Error', 'No hay token de autenticación válido');
                    return;
                }
                token = await AsyncStorage.getItem('access_token');
            }

            const response = await fetch(`${apiUrl}/api/reglas/roles`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': '69420'
                },
                body: JSON.stringify({
                    action: action,
                    isActive: isActive,
                    roleName: moduleName,
                    moduleName: roleName
                })
            });

            if (response.status === 401 || response.status === 403) {
                // Token might be expired, try to refresh
                const refreshed = await refreshAccessToken();
                if (refreshed) {
                    // Retry the request with the new token
                    return updateAction(action, isActive, roleName, moduleName);
                } else {
                    // If refresh fails, logout the user
                    await logout();
                    Alert.alert('3', 'Sesión expirada. Por favor inicie sesión nuevamente.');
                    return;
                }
            }

            if (!response.ok) {
                Alert.alert('Error', `Error del servidor: ${response.status}`);
            } else {
                const responseData = await response.json();
                Alert.alert('Éxito', responseData.message);
                fetchRolePermissions();
            }
        }}
    ]);
};

  useEffect(() => {
    if (roleId) {
      fetchRolePermissions();
    }
  }, [roleId]);

  const fetchRolePermissions = async () => {
    try {
      setLoading(true);
      setError(null);

      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) {
        throw new Error('Server URL not configured');
      }

      let token = await AsyncStorage.getItem('access_token');
      
      if (!token) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
          throw new Error('No valid authentication token');
        }
        token = await AsyncStorage.getItem('access_token');
      }

      const response = await fetch(`${apiUrl}/api/roles/reglas?roleName=${roleName}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '69420'
        },
      });

      if (response.status === 401 || response.status === 403) { 
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          return fetchRolePermissions();
        } else {
          // If refresh fails, logout the user
          await logout();
          throw new Error('Session expired. Please login again.');
        }
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (Array.isArray(data)) {
        setModules(data);
      } else if (data.data && Array.isArray(data.data)) {
        setModules(data.data);
      } else {
        throw new Error('Invalid data format received');
      }

    } catch (error) {
      console.error('Error fetching role permissions:', error);
      setError(error instanceof Error ? error.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  
const getActionIcon = (action: string, isActive: boolean) => {
    switch (action.toLowerCase()) {
      case 'list': return <Ionicons name="list" size={16} color={isActive ? '#FFFFFF' : '#666666'} />;
      case 'create': return <Ionicons name="add" size={16} color={isActive ? '#FFFFFF' : '#666666'} />;
      case 'update': return <Ionicons name="pencil" size={16} color={isActive ? '#FFFFFF' : '#666666'} />;
      case 'delete': return <Ionicons name="trash" size={16} color={isActive ? '#FFFFFF' : '#666666'} />;
      case 'revert': return <Ionicons name="arrow-undo" size={16} color={isActive ? '#FFFFFF' : '#666666'} />;
      case 'aprobar': return <Ionicons name="checkmark" size={16} color={isActive ? '#FFFFFF' : '#666666'} />;
      case 'generarextra': return <Ionicons name="add" size={16} color={isActive ? '#FFFFFF' : '#666666'} />;
      case 'inactive': return <Ionicons name="close" size={16} color={isActive ? '#FFFFFF' : '#666666'} />;
      case 'pagos': return <Ionicons name="cash" size={16} color={isActive ? '#FFFFFF' : '#666666'} />;
      case 'editar_masivo': return <Ionicons name="pencil-sharp" size={16} color={isActive ? '#FFFFFF' : '#666666'} />;
      case 'marcar': return <Ionicons name="checkmark" size={16} color={isActive ? '#FFFFFF' : '#666666'} />;
      case 'cancel': return <Ionicons name="close" size={16} color={isActive ? '#FFFFFF' : '#666666'} />;
      default: return <Ionicons name="close" size={16} color={isActive ? '#FFFFFF' : '#666666'} />;
    }
  };

  // Handle menu press from header
  const handleMenuPress = () => {
    setIsMenuVisible(true);
  };

  // Handle profile navigation from slide menu

  // Handle home navigation from slide menu
  const handleHomePress = () => {
    router.navigate('/(tabs)');
  };

  // Handle closing slide menu
  const handleMenuClose = () => {
    setIsMenuVisible(false);
  };

  const handleModulePress = (module: Module) => {
    const actionsText = module.actions.length > 0 
      ? `Acciones: ${module.actions.map(action => `${action.nombre} (${action.validate ? 'Activo' : 'Inactivo'})`).join(', ')}` 
      : 'No hay acciones disponibles';
    
    Alert.alert(
      'Detalles del Módulo',
      `Módulo: ${module.module_name}\n${actionsText}`,
      [{ text: 'OK' }]
    );
  };

  const renderModuleItem = ({ item }: { item: Module }) => (
    <ThemedView style={styles.moduleCard}>
      <TouchableOpacity 
        style={styles.moduleContent}
        onPress={() => handleModulePress(item)}
      >
        <View style={styles.moduleHeader}>
          <ThemedText style={styles.moduleName}>{item.module_name}</ThemedText>
          <View style={styles.actionsCountIndicator}>
            <Text style={styles.actionsCountText}>
              {item.actions.length} acción{item.actions.length !== 1 ? 'es' : ''}
            </Text>
          </View>
        </View>
         
        {item.actions && item.actions.length > 0 && (
          <View style={styles.actionsContainer}>
            <ThemedText style={styles.actionsLabel}>Acciones disponibles:</ThemedText>
            <View style={styles.actionsList}>
              {item.actions.map((action, index) => (
                <TouchableOpacity
                    key={`${item.module_name}-${action.nombre}-${index}`}
                    style={[
                        styles.actionButton,
                        action.validate && item.actions.find(a => a.nombre === action.nombre)?.validate && styles.activeActionButton
                    ]}
                        onPress={() => updateAction(action.nombre, item.actions.find(a => a.nombre === action.nombre)?.validate || false, item.module_name, roleName)}
                    >
                    {getActionIcon(action.nombre, action.validate)}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </TouchableOpacity>
    </ThemedView>
  );

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader onMenuPress={handleMenuPress} />
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando permisos...</ThemedText>
        </ThemedView>
        <AppFooter />
        <SlideMenu 
          isVisible={isMenuVisible} 
          onClose={handleMenuClose}
          onHomePress={handleHomePress}
          currentRoute="role-permissions"
        />
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader onMenuPress={handleMenuPress} />
        <ThemedView style={styles.errorContainer}>
          <ThemedText style={styles.errorText}>Error: {error}</ThemedText>
          <TouchableOpacity style={styles.retryButton} onPress={fetchRolePermissions}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Volver</Text>
          </TouchableOpacity>
        </ThemedView>
        <AppFooter />
        <SlideMenu 
          isVisible={isMenuVisible} 
          onClose={handleMenuClose}
          onHomePress={handleHomePress}
          currentRoute="role-permissions"
        />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={handleMenuPress} />
      
      <ThemedView style={styles.headerContainer}>
        <TouchableOpacity style={styles.backButtonHeader} onPress={() => router.back()}>
          <ThemedText style={styles.backButtonHeaderText}>← Volver</ThemedText>
        </TouchableOpacity>
        <ThemedText type="title" style={styles.title}>
          Permisos del Rol: {roleName}
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar módulos..."
          placeholderTextColor="#999999"
          value={searchText}
          onChangeText={setSearchText}
        />
      </ThemedView>

      <ThemedView style={styles.modulesContainer}>
        <FlatList
          data={filteredModules}
          renderItem={renderModuleItem}
          keyExtractor={(item, index) => `module-${index}`}
          showsVerticalScrollIndicator={true}
          style={styles.modulesList}
          contentContainerStyle={styles.modulesListContent}
        />

        {filteredModules.length === 0 && !loading && (
          <ThemedView style={styles.emptyContainer}>
            <ThemedText style={styles.emptyText}>
              {searchText.trim() 
                ? `No se encontraron módulos que coincidan con "${searchText}"` 
                : 'No se encontraron módulos'
              }
            </ThemedText>
          </ThemedView>
        )}
      </ThemedView>

      <AppFooter />

      <SlideMenu 
        isVisible={isMenuVisible} 
        onClose={handleMenuClose}
        onHomePress={handleHomePress}
        currentRoute="role-permissions"
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButtonHeader: {
    marginBottom: 10,
  },
  backButtonHeaderText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333333',
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  modulesContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  modulesList: {
    flex: 1,
  },
  modulesListContent: {
    paddingVertical: 10,
  },
  moduleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  moduleContent: {
    marginBottom: 12,
  },
  moduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  moduleName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    flex: 1,
  },
  actionsCountIndicator: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginLeft: 10,
  },
  actionsCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1976D2',
    textAlign: 'center',
  },
  actionsContainer: {
    marginTop: 8,
  },
  actionsLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#888888',
    marginBottom: 6,
  },
  actionsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  actionTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  activeActionTag: {
    backgroundColor: '#007AFF',
  },
  inactiveActionTag: {
    // Grayscale 500
    backgroundColor: '#666666',
  },
  actionButton: {
    backgroundColor: '#F0F0F0',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 8,
  },
  activeActionButton: {
    backgroundColor: '#FF3B30',
  },
  actionButtonText: {
    fontSize: 12,
    color: '#666666',
    marginLeft: 4,
    fontWeight: '500',
  },
  activeActionButtonText: {
    color: '#FFFFFF',
  },
  actionText: {
    fontSize: 11,
    fontWeight: '500',
  },
  activeActionText: {
    color: '#FFFFFF',
  },
  inactiveActionText: {
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 10,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  backButton: {
    backgroundColor: '#6C757D',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
});
