import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Network from 'expo-network';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import AppHeader from '@/components/AppHeader';
import AppFooter from '@/components/AppFooter';
import SlideMenu from '@/components/SlideMenu';
import { useAuth } from '@/contexts/AuthContext';
import authedFetch from '@/hooks/authedFetch';
import getModulesRelease from '@/hooks/getModulesRelease';
import { RootStackParamList } from '../App';

type ModuleVisibilityScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'ModuleVisibility'
>;

type ModuleVisibilityRow = {
  id: number;
  module_name: string;
  real_name: string;
  is_visible: boolean;
};

export default function ModuleVisibilityScreen() {
  const navigation = useNavigation<ModuleVisibilityScreenNavigationProp>();
  const { refreshAccessToken, logout } = useAuth();

  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [rows, setRows] = useState<ModuleVisibilityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const refreshOnlineStatus = useCallback(async () => {
    const networkState = await Network.getNetworkStateAsync();
    const ok = networkState.isConnected === true && networkState.isInternetReachable === true;
    setIsOnline(ok);
    return ok;
  }, []);

  const getApiUrl = () => {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');
    return String(apiUrl).replace(/\/+$/, '');
  };

  const syncModulesReleaseCache = useCallback(async () => {
    const result = await getModulesRelease({ refreshAccessToken, logout });
    if (result.status) {
      await AsyncStorage.setItem('modules_release', JSON.stringify(result.modules || []));
    }
  }, [refreshAccessToken, logout]);

  const parseRows = (modules: unknown[]): ModuleVisibilityRow[] =>
    modules
      .map((raw: any) => ({
        id: Number(raw?.id),
        module_name: String(raw?.module_name ?? '').trim(),
        real_name: String(raw?.real_name ?? raw?.module_name ?? '').trim(),
        is_visible: Boolean(raw?.is_visible),
      }))
      .filter((row) => Number.isFinite(row.id) && row.id > 0 && row.real_name !== '');

  const fetchRows = useCallback(async () => {
    const online = await refreshOnlineStatus();
    if (!online) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await authedFetch({
        url: `${getApiUrl()}/api/modules-release`,
        init: { method: 'GET', headers: { 'Content-Type': 'application/json' } },
        refreshAccessToken,
        logout,
      });
      if (!response) return;

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.status) {
        throw new Error(data?.message || `HTTP error! status: ${response.status}`);
      }

      setRows(parseRows(Array.isArray(data.modules) ? data.modules : []));
    } catch (error) {
      console.error('Error fetching module visibility:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'No se pudieron cargar los módulos');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [refreshAccessToken, logout, refreshOnlineStatus]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const executeToggleVisibility = async (row: ModuleVisibilityRow, nextVisible: boolean) => {
    setUpdatingId(row.id);
    try {
      const response = await authedFetch({
        url: `${getApiUrl()}/api/modules-release/${row.id}`,
        init: {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_visible: nextVisible }),
        },
        refreshAccessToken,
        logout,
      });
      if (!response) return;

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.status) {
        throw new Error(data?.message || 'No se pudo actualizar la visibilidad');
      }

      const updated = data?.data;
      setRows((prev) =>
        prev.map((item) =>
          item.id === row.id
            ? {
                ...item,
                is_visible: Boolean(updated?.is_visible ?? nextVisible),
                real_name: String(updated?.real_name ?? item.real_name),
                module_name: String(updated?.module_name ?? item.module_name),
              }
            : item
        )
      );

      await syncModulesReleaseCache();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo actualizar la visibilidad');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleTogglePress = (row: ModuleVisibilityRow) => {
    if (updatingId != null || isOnline === false) return;

    void (async () => {
      const online = await refreshOnlineStatus();
      if (!online) {
        Alert.alert('Sin conexión', 'Esta pantalla requiere conexión a internet.');
        return;
      }

      const targetVisible = !row.is_visible;
      const actionLabel = targetVisible ? 'mostrar' : 'ocultar';

      Alert.alert(
        'Confirmar cambio',
        `¿Desea ${actionLabel} el módulo "${row.real_name}"?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Aceptar',
            onPress: () => void executeToggleVisibility(row, targetVisible),
          },
        ],
        { cancelable: true }
      );
    })();
  };

  const handleMenuPress = () => setIsMenuVisible(true);
  const handleMenuClose = () => setIsMenuVisible(false);
  const handleHomePress = () => {
    navigation.navigate('Home');
    setIsMenuVisible(false);
  };

  return (
    <ThemedView style={styles.container}>
      <AppHeader title="Visibilidad de módulos" onMenuPress={handleMenuPress} />

      {isOnline === false ? (
        <ThemedView style={styles.banner}>
          <ThemedText style={styles.bannerTxt}>
            Sin conexión a internet. Esta pantalla no está disponible.
          </ThemedText>
        </ThemedView>
      ) : null}

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ThemedView style={styles.titleContainer}>
          <ThemedText type="title" style={styles.title}>
            <Ionicons name="eye" size={22} color="#000000" /> Visibilidad de módulos
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Activa o desactiva la visibilidad de los módulos en la aplicación. Requiere conexión a internet.
          </ThemedText>
        </ThemedView>

        {loading ? (
          <ThemedView style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#007AFF" />
            <ThemedText style={styles.loadingText}>Cargando módulos...</ThemedText>
          </ThemedView>
        ) : rows.length === 0 ? (
          <ThemedView style={styles.emptyBox}>
            <ThemedText style={styles.emptyText}>
              {isOnline === false
                ? 'Conéctate a internet para consultar la visibilidad de módulos.'
                : 'No hay módulos configurados.'}
            </ThemedText>
          </ThemedView>
        ) : (
          <ThemedView style={styles.listContainer}>
            {rows.map((row) => {
              const isUpdating = updatingId === row.id;
              return (
                <TouchableOpacity
                  key={row.id}
                  style={[styles.rowItem, isUpdating && styles.rowItemDisabled]}
                  onPress={() => handleTogglePress(row)}
                  disabled={isOnline === false || isUpdating}
                  activeOpacity={0.85}
                >
                  <View style={styles.rowTextWrap}>
                    <ThemedText style={styles.rowTitle}>{row.real_name}</ThemedText>
                    <ThemedText style={styles.rowSubtitle}>{row.module_name}</ThemedText>
                  </View>
                  <View style={styles.checkboxContainer}>
                    {isUpdating ? (
                      <ActivityIndicator size="small" color="#007AFF" />
                    ) : (
                      <View
                        style={[
                          styles.checkbox,
                          row.is_visible ? styles.checkboxChecked : styles.checkboxUnchecked,
                        ]}
                      >
                        {row.is_visible ? (
                          <Ionicons name="checkmark" size={16} color="#fff" />
                        ) : null}
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ThemedView>
        )}
      </ScrollView>

      <AppFooter />

      <SlideMenu
        isVisible={isMenuVisible}
        onClose={handleMenuClose}
        onHomePress={handleHomePress}
        currentRoute="ModuleVisibility"
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  banner: {
    backgroundColor: '#FFECEC',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#FFD6D6',
  },
  bannerTxt: {
    color: '#C00',
    textAlign: 'center',
    fontWeight: '600',
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    width: '100%',
    backgroundColor: 'transparent',
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
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: 'transparent',
  },
  loadingText: {
    marginTop: 12,
    color: '#666666',
  },
  emptyBox: {
    padding: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FAFAFA',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666666',
  },
  listContainer: {
    gap: 10,
    backgroundColor: 'transparent',
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  rowItemDisabled: {
    opacity: 0.7,
  },
  rowTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  rowSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: '#6B7280',
  },
  checkboxContainer: {
    marginLeft: 12,
    backgroundColor: '#fff',
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#34C759',
    borderColor: '#34C759',
  },
  checkboxUnchecked: {
    backgroundColor: '#fff',
    borderColor: '#E0E0E0',
  },
});
