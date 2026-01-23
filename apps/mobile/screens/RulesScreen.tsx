import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, FlatList, TextInput } from 'react-native';
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

type RulesScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Rules'>;

interface RuleAction {
  a: string;
  [key: number]: string;
}

interface Rule {
  nombre: string;
  descripcion: string;
  actions: RuleAction;
}

export default function RulesScreen() {
  const navigation = useNavigation<RulesScreenNavigationProp>();
  const { accessToken, refreshAccessToken, logout } = useAuth();
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    fetchRules();
  }, []);

  // Filtrar reglas basado en el texto de búsqueda (nombre y descripción)
  const filteredRules = useMemo(() => {
    if (!searchText.trim()) {
      return rules;
    }
    return rules.filter(rule =>
      rule.nombre.toLowerCase().includes(searchText.toLowerCase()) ||
      rule.descripcion.toLowerCase().includes(searchText.toLowerCase())
    );
  }, [rules, searchText]);

  const fetchRules = async () => {
    try {
      setLoading(true);
      setError(null);

      const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
      if (!apiUrl) {
        throw new Error('Server URL not configured');
      }

      let token = await AsyncStorage.getItem('access_token');

      // Try to refresh token if we don't have one
      if (!token) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
          throw new Error('No valid authentication token');
        }
        token = await AsyncStorage.getItem('access_token');
      }

      const response = await fetch(`${apiUrl}/api/reglas`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '69420'
        },
      });

      if (response.status === 401) {
        // Token might be expired, try to refresh
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          // Retry the request with the new token
          return fetchRules();
        } else {
          // If refresh fails, logout the user
          await logout();
          throw new Error('Session expired. Please login again.');
        }
      }

      if (response.status === 403) {
        if (logout) await logout();
        throw new Error('Acceso denegado');
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (Array.isArray(data)) {
        setRules(data);
      } else if (data.data && Array.isArray(data.data)) {
        setRules(data.data);
      } else {
        throw new Error('Invalid data format received');
      }

    } catch (error) {
      console.error('Error fetching rules:', error);
      setError(error instanceof Error ? error.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const showPermissions = (rule: Rule) => {
    navigation.navigate('Permissions');
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

  const renderRuleItem = ({ item }: { item: Rule }) => (
    <ThemedView style={styles.ruleCard}>
      <ThemedText style={styles.ruleTitle}>{item.nombre}</ThemedText>
      <ThemedText style={styles.ruleDescription}>{item.descripcion}</ThemedText>
      <TouchableOpacity
        style={styles.permissionButton}
        onPress={() => showPermissions(item)}
      >
        <Text style={styles.permissionButtonText}>Permisos por rol</Text>
      </TouchableOpacity>
    </ThemedView>
  );

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader onMenuPress={handleMenuPress} />
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Cargando reglas...</ThemedText>
        </ThemedView>
        <AppFooter />
        <SlideMenu
          isVisible={isMenuVisible}
          onClose={handleMenuClose}
          onHomePress={handleHomePress}
          currentRoute="rules"
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
          <TouchableOpacity style={styles.retryButton} onPress={fetchRules}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </TouchableOpacity>
        </ThemedView>
        <AppFooter />
        <SlideMenu
          isVisible={isMenuVisible}
          onClose={handleMenuClose}
          onHomePress={handleHomePress}
          currentRoute="rules"
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
          placeholder="Buscar funcionalidades..."
          placeholderTextColor="#999999"
          value={searchText}
          onChangeText={setSearchText}
        />
      </ThemedView>

      <ThemedView style={styles.rulesContainer}>
        {/* Rules List */}
        <FlatList
          data={filteredRules}
          renderItem={renderRuleItem}
          keyExtractor={(item, index) => `rule-${index}`}
          showsVerticalScrollIndicator={true}
          style={styles.rulesList}
          contentContainerStyle={styles.rulesListContent}
        />

        {filteredRules.length === 0 && !loading && (
          <ThemedView style={styles.emptyContainer}>
            <ThemedText style={styles.emptyText}>
              {searchText.trim()
                ? `No se encontraron reglas que coincidan con "${searchText}"`
                : 'No se encontraron reglas'
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
  rulesContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  rulesList: {
    flex: 1,
  },
  rulesListContent: {
    paddingVertical: 10,
  },
  ruleCard: {
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
  ruleTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 12,
  },
  ruleDescription: {
    fontSize: 15,
    color: '#666666',
    lineHeight: 22,
    marginBottom: 16,
  },
  permissionButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
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
