import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, FlatList, TextInput } from 'react-native';
import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import AppHeader from '../components/AppHeader';
import AppFooter from '../components/AppFooter';
import SlideMenu from '../components/SlideMenu';
import { useAuth } from '../contexts/AuthContext';
import Constants from 'expo-constants';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import AsyncStorage from '@react-native-async-storage/async-storage';

type RolesScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Roles'>;

interface Role {
  id: number;
  name: string;
  description?: string;
  permissions?: string[];
}

export default function RolesScreen() {
  const navigation = useNavigation<RolesScreenNavigationProp>();
  const { accessToken, refreshAccessToken, logout } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    fetchRoles();
  }, []);

  // Filtrar roles basado en el texto de búsqueda
  const filteredRoles = useMemo(() => {
    if (!searchText.trim()) {
      return roles;
    }
    return roles.filter(role => 
      role.name.toLowerCase().includes(searchText.toLowerCase())
    );
  }, [roles, searchText]);

  const fetchRoles = async () => {
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

      const response = await fetch(`${apiUrl}/api/roles`, {
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
          return fetchRoles();
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
        setRoles(data);
      } else if (data.data && Array.isArray(data.data)) {
        setRoles(data.data);
      } else {
        throw new Error('Invalid data format received');
      }

    } catch (error) {
      console.error('Error fetching roles:', error);
      setError(error instanceof Error ? error.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  // Handle menu press from header
  const handleMenuPress = () => {
    setIsMenuVisible(true);
  };

  // Handle profile navigation from slide menu

  // Handle home navigation from slide menu
  const handleHomePress = () => {
    navigation.navigate('Home');
  };

  // Handle closing slide menu
  const handleMenuClose = () => {
    setIsMenuVisible(false);
  };

  const handleRolePress = (role: Role) => {
    // Aquí puedes agregar navegación a detalles del rol o edición
    Alert.alert(
      'Información del Rol',
      `Nombre: ${role.name}\n${role.description ? `Descripción: ${role.description}` : ''}`,
      [{ text: 'OK' }]
    );
  };

  const handlePermissionsPress = (role: Role) => {
    // Navegar a una pantalla de permisos por funcionalidad para este rol específico
    navigation.navigate('RolePermissions');
  };

  const renderRoleItem = ({ item }: { item: Role }) => (
    <ThemedView style={styles.roleCard}>
      <TouchableOpacity 
        style={styles.roleContent}
        onPress={() => handleRolePress(item)}
      >
        <ThemedText style={styles.roleName}>{item.name}</ThemedText>
        {item.description && (
          <ThemedText style={styles.roleDescription}>{item.description}</ThemedText>
        )}
        {item.permissions && item.permissions.length > 0 && (
          <View style={styles.permissionsContainer}>
            <ThemedText style={styles.permissionsLabel}>Permisos:</ThemedText>
            <View style={styles.permissionsList}>
              {item.permissions.slice(0, 3).map((permission, index) => (
                <View key={index} style={styles.permissionTag}>
                  <ThemedText style={styles.permissionText}>{permission}</ThemedText>
                </View>
              ))}
              {item.permissions.length > 3 && (
                <View style={styles.permissionTag}>
                  <ThemedText style={styles.permissionText}>+{item.permissions.length - 3} más</ThemedText>
                </View>
              )}
            </View>
          </View>
        )}
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.permissionsButton}
        onPress={() => handlePermissionsPress(item)}
      >
        <Text style={styles.permissionsButtonText}>Permisos por funcionalidad</Text>
      </TouchableOpacity>
    </ThemedView>
  );

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader onMenuPress={handleMenuPress} />
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando roles...</ThemedText>
        </ThemedView>
        <AppFooter />
        <SlideMenu 
          isVisible={isMenuVisible} 
          onClose={handleMenuClose}
          onHomePress={handleHomePress}
          currentRoute="roles"
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
          <TouchableOpacity style={styles.retryButton} onPress={fetchRoles}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </TouchableOpacity>
        </ThemedView>
        <AppFooter />
        <SlideMenu 
          isVisible={isMenuVisible} 
          onClose={handleMenuClose}
          onHomePress={handleHomePress}
          currentRoute="roles"
        />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <AppHeader onMenuPress={handleMenuPress} />

      <ThemedView style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar roles..."
          placeholderTextColor="#999999"
          value={searchText}
          onChangeText={setSearchText}
        />
      </ThemedView>

      <ThemedView style={styles.rolesContainer}>
        <FlatList
          data={filteredRoles}
          renderItem={renderRoleItem}
          keyExtractor={(item) => `role-${item.id}`}
          showsVerticalScrollIndicator={true}
          style={styles.rolesList}
          contentContainerStyle={styles.rolesListContent}
        />

        {filteredRoles.length === 0 && !loading && (
          <ThemedView style={styles.emptyContainer}>
            <ThemedText style={styles.emptyText}>
              {searchText.trim() 
                ? `No se encontraron roles que coincidan con "${searchText}"` 
                : 'No se encontraron roles'
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
        currentRoute="roles"
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    color: '#000000',
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  rolesContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  rolesList: {
    flex: 1,
  },
  rolesListContent: {
    paddingVertical: 10,
  },
  roleCard: {
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
  roleContent: {
    marginBottom: 12,
  },
  permissionsButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  permissionsButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  roleName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  roleDescription: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 12,
    lineHeight: 20,
  },
  permissionsContainer: {
    marginTop: 8,
  },
  permissionsLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#888888',
    marginBottom: 6,
  },
  permissionsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  permissionTag: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  permissionText: {
    fontSize: 11,
    color: '#666666',
    fontWeight: '500',
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
  },
  retryButtonText: {
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
