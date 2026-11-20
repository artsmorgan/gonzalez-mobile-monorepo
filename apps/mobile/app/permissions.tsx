import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, FlatList, ScrollView, TextInput } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import AppHeader from '@/components/AppHeader';
import AppFooter from '@/components/AppFooter';
import SlideMenu from '@/components/SlideMenu';
import { useAuth } from '@/contexts/AuthContext';
import authedFetch from '@/hooks/authedFetch';
import Constants from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

interface Role {
  name: string;
  actions: string[];
}

interface RuleAction {
  a: string;
  [key: number]: string;
}


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

export default function PermissionsScreen() {
  const { accessToken, refreshAccessToken, logout } = useAuth();
  const params = useLocalSearchParams();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [searchText, setSearchText] = useState('');

  // Parse parameters
  const ruleName = params.ruleName as string;
  const actionsParam = params.actions as string;
  let ruleActions: string[] = [];

  try {
    if (actionsParam) {
      const parsedActions = JSON.parse(actionsParam) as RuleAction;
      ruleActions = Object.entries(parsedActions)
        .filter(([key]) => key !== 'a')
        .map(([_, value]) => value);
    }
  } catch (e) {
    console.error('Error parsing actions:', e);
  }

  useEffect(() => {
    if (ruleName) {
      fetchRoles();
    }
  }, [ruleName]);

  // Filtrar roles basado en el texto de búsqueda (name)
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

      const response = await authedFetch({
        url: `${apiUrl}/api/reglas/roles?perm=${encodeURIComponent(ruleName)}`,
        init: {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
        refreshAccessToken,
        logout,
      });

      if (!response) {
        return;
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
    router.navigate('/(tabs)');
  };

  // Handle closing slide menu
  const handleMenuClose = () => {
    setIsMenuVisible(false);
  };

  const isActionActive = (roleAction: string): boolean => {
    return ruleActions.some(action => action.toLowerCase() === roleAction.toLowerCase());
  };
  
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

                const response = await authedFetch({
                    url: `${apiUrl}/api/reglas/roles`,
                    init: {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            action: action,
                            isActive: isActive,
                            roleName: roleName,
                            moduleName: moduleName
                        })
                    },
                    refreshAccessToken,
                    logout,
                });

                if (!response) {
                    Alert.alert('Sesión expirada', 'Por favor inicie sesión nuevamente.');
                    return;
                }

                if (!response.ok) {
                    Alert.alert('Error', `Error del servidor: ${response.status}`);
                } else {
                    const responseData = await response.json();
                    Alert.alert('Éxito', responseData.message);
                    fetchRoles();
                }
            }}
        ]);
    };

  const renderRoleItem = ({ item }: { item: Role }) => (
    <ThemedView style={styles.roleCard}>
      <ThemedText style={styles.roleName}>{item.name}</ThemedText>
      <View style={styles.actionsContainer}>
        {ruleActions.map((action, index) => (
          <TouchableOpacity
            key={`${item.name}-${action}-${index}`}
            style={[
              styles.actionButton,
              isActionActive(action) && item.actions.includes(action) && styles.activeActionButton
            ]}
            onPress={() => updateAction(action, item.actions.includes(action), item.name, ruleName)}
          >
            {getActionIcon(action, item.actions.includes(action))}
          </TouchableOpacity>
        ))}
      </View>
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
          currentRoute="permissions"
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
          currentRoute="permissions"
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
          Permisos por funcionalidad: {ruleName}
        </ThemedText>
      </ThemedView>

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
          keyExtractor={(item) => `role-${item.name}`}
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
        currentRoute="permissions"
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
  roleName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 16,
  },
  actionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
  // Icon styles
  iconContainer: {
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  horizontalLine: {
    width: 12,
    height: 2,
    backgroundColor: '#666666',
    marginVertical: 1,
  },
  plusVertical: {
    position: 'absolute',
    width: 2,
    height: 12,
    backgroundColor: '#666666',
  },
  plusHorizontal: {
    position: 'absolute',
    width: 12,
    height: 2,
    backgroundColor: '#666666',
  },
  pencilBody: {
    width: 2,
    height: 10,
    backgroundColor: '#666666',
    transform: [{ rotate: '45deg' }],
  },
  pencilTip: {
    position: 'absolute',
    top: -2,
    left: 7,
    width: 4,
    height: 4,
    backgroundColor: '#666666',
    transform: [{ rotate: '45deg' }],
  },
  trashCan: {
    width: 10,
    height: 12,
    borderWidth: 1,
    borderColor: '#666666',
    borderTopWidth: 0,
  },
  trashLid: {
    position: 'absolute',
    top: -2,
    left: -1,
    width: 12,
    height: 2,
    backgroundColor: '#666666',
  },
  curveArrow: {
    width: 12,
    height: 12,
    borderWidth: 2,
    borderColor: '#666666',
    borderRadius: 6,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    transform: [{ rotate: '45deg' }],
  },
  checkMark: {
    width: 8,
    height: 4,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#666666',
    transform: [{ rotate: '-45deg' }],
  },
  doublePlusLeft: {
    position: 'absolute',
    left: -2,
  },
  doublePlusRight: {
    position: 'absolute',
    right: -2,
  },
  questionMark: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666666',
  },
  dollarSign: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666666',
  },
  doublePencilLeft: {
    position: 'absolute',
    left: -2,
  },
  doublePencilRight: {
    position: 'absolute',
    right: -2,
  },
  circle: {
    width: 12,
    height: 12,
    borderWidth: 2,
    borderColor: '#666666',
    borderRadius: 6,
  },
  xMarkLeft: {
    position: 'absolute',
    width: 12,
    height: 2,
    backgroundColor: '#666666',
    transform: [{ rotate: '45deg' }],
  },
  xMarkRight: {
    position: 'absolute',
    width: 12,
    height: 2,
    backgroundColor: '#666666',
    transform: [{ rotate: '-45deg' }],
  },
});
