import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Network from 'expo-network';
import Constants from 'expo-constants';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import AppHeader from '@/components/AppHeader';
import AppFooter from '@/components/AppFooter';
import SlideMenu from '@/components/SlideMenu';
import { useAuth } from '@/contexts/AuthContext';
import authedFetch from '@/hooks/authedFetch';
import {
  EmpleadoLite,
  formatEmpleadoNombre,
  searchEmployeesReportes,
} from '@/hooks/reportesFunctions';
import { RootStackParamList } from '../App';

type SuperAdminsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'SuperAdmins'>;

const SUPER_ADMINS_SLUG = 'super-admins';

type SuperAdminRow = {
  id: number;
  nombre: string;
  employee_cedula?: string;
  created_at?: string;
};

function parseSuperAdminRows(rows: unknown[]): SuperAdminRow[] {
  return rows
    .map((x: any) => ({
      id: Number(x?.id),
      nombre: String(x?.nombre ?? '').trim(),
      employee_cedula: x?.employee_cedula != null ? String(x.employee_cedula) : undefined,
      created_at: x?.created_at != null ? String(x.created_at) : undefined,
    }))
    .filter((x) => Number.isFinite(x.id) && x.id > 0 && x.nombre !== '');
}

export default function SuperAdminsScreen() {
  const navigation = useNavigation<SuperAdminsScreenNavigationProp>();
  const { refreshAccessToken, logout, employee } = useAuth();

  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [records, setRecords] = useState<SuperAdminRow[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formEmpleadoSearch, setFormEmpleadoSearch] = useState('');
  const [formEmpleadoResults, setFormEmpleadoResults] = useState<EmpleadoLite[]>([]);
  const [selectedEmpleado, setSelectedEmpleado] = useState<EmpleadoLite | null>(null);
  const [employeeSearchLoading, setEmployeeSearchLoading] = useState(false);

  useEffect(() => {
    if (employee && !employee.isSuperAdmin) {
      Alert.alert('Acceso denegado', 'Esta pantalla requiere permisos de super administrador.');
      navigation.goBack();
    }
  }, [employee, navigation]);

  const refreshOnlineStatus = useCallback(async () => {
    const networkState = await Network.getNetworkStateAsync();
    const ok = networkState.isConnected === true && networkState.isInternetReachable === true;
    setIsOnline(ok);
    return ok;
  }, []);

  const getApiUrl = () => {
    const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
    if (!apiUrl) throw new Error('Server URL not configured');
    return apiUrl;
  };

  const fetchRecords = useCallback(async () => {
    const online = await refreshOnlineStatus();
    if (!online) {
      setRecords([]);
      setLoadingRecords(false);
      return;
    }

    setLoadingRecords(true);
    try {
      const response = await authedFetch({
        url: `${getApiUrl()}/api/nomenclators/${SUPER_ADMINS_SLUG}`,
        init: { method: 'GET', headers: { 'Content-Type': 'application/json' } },
        refreshAccessToken,
        logout,
      });
      if (!response) return;

      const data = await response.json();
      if (!response.ok || !data?.status) {
        throw new Error(data?.message || `HTTP error! status: ${response.status}`);
      }

      setRecords(parseSuperAdminRows(Array.isArray(data.data) ? data.data : []));
    } catch (error) {
      console.error('Error fetching super admins:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'No se pudieron cargar los registros');
      setRecords([]);
    } finally {
      setLoadingRecords(false);
    }
  }, [refreshAccessToken, logout, refreshOnlineStatus]);

  useEffect(() => {
    void refreshOnlineStatus();
    void fetchRecords();
  }, [fetchRecords, refreshOnlineStatus]);

  const resetFormState = () => {
    setShowForm(false);
    setFormEmpleadoSearch('');
    setFormEmpleadoResults([]);
    setSelectedEmpleado(null);
    setEmployeeSearchLoading(false);
  };

  const openCreateForm = () => {
    setFormEmpleadoSearch('');
    setFormEmpleadoResults([]);
    setSelectedEmpleado(null);
    setShowForm(true);
  };

  const runSearchEmpleado = async () => {
    if (!formEmpleadoSearch.trim()) {
      Alert.alert('Buscar', 'Escriba código o nombre del empleado.');
      return;
    }

    setEmployeeSearchLoading(true);
    try {
      const res = await searchEmployeesReportes({
        q: formEmpleadoSearch.trim(),
        refreshAccessToken,
        logout,
      });
      if (!res.status) {
        Alert.alert('Error', res.message || 'No se pudo buscar empleados');
        return;
      }
      setFormEmpleadoResults(res.data || []);
    } finally {
      setEmployeeSearchLoading(false);
    }
  };

  const pickEmpleado = (empleado: EmpleadoLite) => {
    setSelectedEmpleado(empleado);
    setFormEmpleadoResults([]);
    setFormEmpleadoSearch('');
  };

  const clearSelectedEmpleado = () => {
    setSelectedEmpleado(null);
    setFormEmpleadoSearch('');
    setFormEmpleadoResults([]);
  };

  const saveRecord = async () => {
    const online = await refreshOnlineStatus();
    if (!online) {
      Alert.alert('Sin conexión', 'Esta pantalla requiere conexión a internet.');
      return;
    }

    if (!selectedEmpleado) {
      Alert.alert('Validación', 'Debe buscar y seleccionar un empleado.');
      return;
    }

    setSaving(true);
    try {
      const response = await authedFetch({
        url: `${getApiUrl()}/api/nomenclators/${SUPER_ADMINS_SLUG}`,
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ empleado_id: selectedEmpleado.id }),
        },
        refreshAccessToken,
        logout,
      });
      if (!response) return;

      const data = await response.json();
      if (!response.ok || !data?.status) {
        const message = String(data?.message ?? '').trim() || 'No se pudo guardar el registro';
        Alert.alert(
          response.status === 409 || response.status === 400 ? 'Advertencia' : 'Error',
          message,
        );
        return;
      }

      Alert.alert('Éxito', data?.message || 'Registro creado');
      resetFormState();
      await fetchRecords();
    } catch {
      Alert.alert('Error', 'No se pudo guardar el registro');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (row: SuperAdminRow) => {
    Alert.alert(
      'Eliminar registro',
      `¿Desea eliminar "${row.nombre}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => void deleteRecord(row),
        },
      ],
      { cancelable: true },
    );
  };

  const deleteRecord = async (row: SuperAdminRow) => {
    const online = await refreshOnlineStatus();
    if (!online) {
      Alert.alert('Sin conexión', 'Esta pantalla requiere conexión a internet.');
      return;
    }

    setSaving(true);
    try {
      const response = await authedFetch({
        url: `${getApiUrl()}/api/nomenclators/${SUPER_ADMINS_SLUG}/${row.id}`,
        init: { method: 'DELETE', headers: { 'Content-Type': 'application/json' } },
        refreshAccessToken,
        logout,
      });
      if (!response) return;

      const data = await response.json();
      if (!response.ok || !data?.status) {
        const message = String(data?.message ?? '').trim() || 'No se pudo eliminar el registro';
        Alert.alert(
          response.status === 409 || response.status === 400 ? 'Advertencia' : 'Error',
          message,
        );
        return;
      }

      Alert.alert('Éxito', data?.message || 'Registro eliminado');
      await fetchRecords();
    } catch {
      Alert.alert('Error', 'No se pudo eliminar el registro');
    } finally {
      setSaving(false);
    }
  };

  const formatCreatedAt = (value?: string) => {
    if (!value) return '';
    const d = new Date(value);
    if (!Number.isFinite(d.getTime())) return value;
    try {
      return d.toLocaleString('es-CR');
    } catch {
      return value;
    }
  };

  const handleMenuPress = () => setIsMenuVisible(true);
  const handleMenuClose = () => setIsMenuVisible(false);
  const handleHomePress = () => {
    navigation.navigate('Home');
    setIsMenuVisible(false);
  };

  return (
    <ThemedView style={styles.container}>
      <AppHeader title="Super admins" onMenuPress={handleMenuPress} />

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
            <Ionicons name="shield-checkmark" size={22} color="#000000" /> Super admins
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Lista de empleados autorizados como super administradores de la aplicación. Requiere conexión a internet.
          </ThemedText>
        </ThemedView>

        {!showForm ? (
          <TouchableOpacity
            style={[styles.primaryBtn, isOnline === false && styles.primaryBtnDisabled]}
            onPress={openCreateForm}
            activeOpacity={0.85}
            disabled={isOnline === false}
          >
            <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
            <ThemedText style={styles.primaryBtnText}>Nuevo registro</ThemedText>
          </TouchableOpacity>
        ) : (
          <ThemedView style={styles.formCard}>
            <ThemedText style={styles.formTitle}>Nuevo super admin</ThemedText>

            <ThemedText style={styles.label}>Empleado</ThemedText>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.inputFlex]}
                value={formEmpleadoSearch}
                onChangeText={setFormEmpleadoSearch}
                placeholder="Código o nombre del empleado"
                placeholderTextColor="#999"
                onSubmitEditing={() => void runSearchEmpleado()}
              />
              <TouchableOpacity
                style={styles.searchIconBtn}
                onPress={() => void runSearchEmpleado()}
                activeOpacity={0.85}
                disabled={employeeSearchLoading}
              >
                {employeeSearchLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="search" size={22} color="#fff" />
                )}
              </TouchableOpacity>
            </View>

            {formEmpleadoResults.length ? (
              <ThemedView style={styles.resultList}>
                {formEmpleadoResults.map((e) => (
                  <TouchableOpacity key={e.id} style={styles.resultItem} onPress={() => pickEmpleado(e)}>
                    <ThemedText>
                      {e.codigo} — {formatEmpleadoNombre(e)}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </ThemedView>
            ) : null}

            {selectedEmpleado ? (
              <ThemedView style={styles.selectedEmpleadoBox}>
                <ThemedText style={styles.selectedEmpleadoText}>
                  {selectedEmpleado.codigo} — {formatEmpleadoNombre(selectedEmpleado)}
                </ThemedText>
                <TouchableOpacity onPress={clearSelectedEmpleado} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={20} color="#FF3B30" />
                </TouchableOpacity>
              </ThemedView>
            ) : null}

            <View style={styles.formActions}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={resetFormState} disabled={saving}>
                <ThemedText style={styles.secondaryBtnText}>Cancelar</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, styles.primaryBtnInline, saving && { opacity: 0.7 }]}
                onPress={() => void saveRecord()}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="save-outline" size={18} color="#FFFFFF" />
                    <ThemedText style={styles.primaryBtnText}>Guardar</ThemedText>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ThemedView>
        )}

        {loadingRecords ? (
          <ThemedView style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#007AFF" />
            <ThemedText style={styles.loadingText}>Cargando registros...</ThemedText>
          </ThemedView>
        ) : records.length === 0 ? (
          <ThemedView style={styles.emptyBox}>
            <ThemedText style={styles.emptyText}>
              {isOnline === false
                ? 'Conéctate a internet para consultar los super admins.'
                : 'No hay super admins registrados.'}
            </ThemedText>
          </ThemedView>
        ) : (
          records.map((row) => (
            <ThemedView key={row.id} style={styles.recordRow}>
              <View style={styles.recordInfo}>
                <ThemedText style={styles.recordName}>{row.nombre}</ThemedText>
                {row.employee_cedula ? (
                  <ThemedText style={styles.recordMeta}>Cédula: {row.employee_cedula}</ThemedText>
                ) : null}
                {row.created_at ? (
                  <ThemedText style={styles.recordMeta}>Creado: {formatCreatedAt(row.created_at)}</ThemedText>
                ) : null}
              </View>
              <View style={styles.recordActions}>
                <TouchableOpacity style={styles.iconBtn} onPress={() => confirmDelete(row)} disabled={saving}>
                  <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            </ThemedView>
          ))
        )}
      </ScrollView>

      <AppFooter />

      <SlideMenu
        isVisible={isMenuVisible}
        onClose={handleMenuClose}
        onHomePress={handleHomePress}
        currentRoute="SuperAdmins"
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, flexGrow: 1, paddingBottom: 32 },
  banner: {
    backgroundColor: '#FFECEC',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#FFD6D6',
  },
  bannerTxt: { color: '#C00', textAlign: 'center', fontWeight: '600' },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    width: '100%',
  },
  title: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#555', textAlign: 'center' },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 12,
    marginBottom: 14,
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnInline: { flex: 1, marginBottom: 0 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  secondaryBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#D0D0D0',
    backgroundColor: '#F8F8F8',
  },
  secondaryBtnText: { color: '#333', fontSize: 14, fontWeight: '700' },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 14,
  },
  formTitle: { fontSize: 15, fontWeight: '900', color: '#007AFF', marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '700', color: '#333', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#D0D0D0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#000',
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  inputFlex: { flex: 1, marginBottom: 0 },
  searchIconBtn: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultList: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, overflow: 'hidden', marginBottom: 10 },
  resultItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#E8E8E8', backgroundColor: '#FFFFFF' },
  selectedEmpleadoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderWidth: 1,
    borderColor: '#C8E1FF',
    backgroundColor: '#EEF6FF',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  selectedEmpleadoText: { flex: 1, fontSize: 14, color: '#000' },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    backgroundColor: '#FAFAFA',
  },
  recordInfo: { flex: 1, paddingRight: 8 },
  recordName: { fontSize: 14, color: '#000', fontWeight: '600' },
  recordMeta: { fontSize: 12, color: '#666', marginTop: 2 },
  recordActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn: { padding: 6 },
  loadingBox: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  loadingText: { color: '#666', fontSize: 14 },
  emptyBox: { alignItems: 'center', paddingVertical: 20 },
  emptyText: { color: '#666', fontSize: 14, textAlign: 'center' },
});
