import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import * as Network from 'expo-network';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import Constants from 'expo-constants';

import authedFetch from '@/hooks/authedFetch';
import { useAuth } from '@/contexts/AuthContext';

type AnyNode = Record<string, any>;

interface JerarquiaModuleProps {
  onSelectionChange?: (selection: {
    empresaId: number | null;
    clienteId: number | null;
    divisionId: number | null;
    contratoId: number | null;
    sucursalId: number | null;
    puestoId: number | null;
    plazaId: number | null;
    empleadoId: number | null;
  }) => void;
}

const JerarquiaModule: React.FC<JerarquiaModuleProps> = ({ onSelectionChange }) => {
  const { refreshAccessToken, logout } = useAuth();

  const [structure, setStructure] = useState<AnyNode[]>([]);
  const [isStructureLoading, setIsStructureLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [selectedEmpresaId, setSelectedEmpresaId] = useState<number | null>(null);
  const [selectedClienteId, setSelectedClienteId] = useState<number | null>(null);
  const [selectedDivisionId, setSelectedDivisionId] = useState<number | null>(null);
  const [selectedContratoId, setSelectedContratoId] = useState<number | null>(null);
  const [selectedSucursalId, setSelectedSucursalId] = useState<number | null>(null);
  const [selectedPuestoId, setSelectedPuestoId] = useState<number | null>(null);
  const [selectedPlazaId, setSelectedPlazaId] = useState<number | null>(null);
  const [selectedEmpleadoId, setSelectedEmpleadoId] = useState<number | null>(null);
  const [activeSummary, setActiveSummary] = useState<
    'empresa' | 'cliente' | 'division' | 'contrato' | 'sucursal' | 'puesto' | 'plaza' | 'empleado' | null
  >(null);

  const getConnectionStatus = async (): Promise<boolean> => {
    const state = await Network.getNetworkStateAsync();
    return !!(state.isConnected && state.isInternetReachable);
  };

  const resetSelection = () => {
    setSelectedEmpresaId(null);
    setSelectedClienteId(null);
    setSelectedDivisionId(null);
    setSelectedContratoId(null);
    setSelectedSucursalId(null);
    setSelectedPuestoId(null);
    setSelectedPlazaId(null);
    setSelectedEmpleadoId(null);
    setActiveSummary(null);
  };

  const notifySelectionChange = useCallback(
    (
      overrides: Partial<{
        empresaId: number | null;
        clienteId: number | null;
        divisionId: number | null;
        contratoId: number | null;
        sucursalId: number | null;
        puestoId: number | null;
        plazaId: number | null;
        empleadoId: number | null;
      }> = {},
    ) => {
      if (!onSelectionChange) return;
      onSelectionChange({
        empresaId: overrides.empresaId ?? selectedEmpresaId,
        clienteId: overrides.clienteId ?? selectedClienteId,
        divisionId: overrides.divisionId ?? selectedDivisionId,
        contratoId: overrides.contratoId ?? selectedContratoId,
        sucursalId: overrides.sucursalId ?? selectedSucursalId,
        puestoId: overrides.puestoId ?? selectedPuestoId,
        plazaId: overrides.plazaId ?? selectedPlazaId,
        empleadoId: overrides.empleadoId ?? selectedEmpleadoId,
      });
    },
    [
      onSelectionChange,
      selectedEmpresaId,
      selectedClienteId,
      selectedDivisionId,
      selectedContratoId,
      selectedSucursalId,
      selectedPuestoId,
      selectedPlazaId,
      selectedEmpleadoId,
    ],
  );

  const loadFromCache = useCallback(async () => {
    setIsStructureLoading(true);
    try {
      const cacheStr = await AsyncStorage.getItem('main_structure_cache');
      if (cacheStr) {
        try {
          const parsed = JSON.parse(cacheStr);
          if (Array.isArray(parsed)) {
            setStructure(parsed);
          } else {
            setStructure([]);
          }
        } catch {
          setStructure([]);
        }
      } else {
        setStructure([]);
      }
    } finally {
      setIsStructureLoading(false);
    }
  }, []);

  const refreshHierarchy = useCallback(async () => {
    const isConnected = await getConnectionStatus();
    if (!isConnected) {
      Alert.alert('Sin conexión', 'No hay conexión a internet. No es posible actualizar la jerarquía.');
      return;
    }

    Alert.alert(
      'Actualizar jerarquía',
      'Esto descargará nuevamente la estructura completa y reiniciará las selecciones actuales. ¿Desea continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Actualizar',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsRefreshing(true);
              resetSelection();

              const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
              if (!apiUrl) {
                throw new Error('Server URL not configured');
              }

              const response = await authedFetch({
                url: `${apiUrl}/api/main-structure`,
                init: {
                  method: 'GET',
                },
                refreshAccessToken,
                logout,
              });

              if (!response) {
                throw new Error('Sesión expirada');
              }

              const data = await response.json();

              if (!response.ok || !data?.status || !Array.isArray(data.structure)) {
                throw new Error(data?.message || 'Error al actualizar la jerarquía');
              }

              setStructure(data.structure);
              await AsyncStorage.setItem('main_structure_cache', JSON.stringify(data.structure));
            } catch (e) {
              Alert.alert(
                'Error',
                e instanceof Error ? e.message : 'No se pudo actualizar la jerarquía. Intente nuevamente.',
              );
            } finally {
              setIsRefreshing(false);
            }
          },
        },
      ],
    );
  }, [getConnectionStatus, refreshAccessToken, logout]);

  useEffect(() => {
    loadFromCache();
  }, [loadFromCache]);

  const empresas = useMemo(() => (Array.isArray(structure) ? structure : []), [structure]);

  const clientes = useMemo(() => {
    const emp = empresas.find((e: AnyNode) => Number(e.id) === Number(selectedEmpresaId));
    return emp?.clientes || [];
  }, [empresas, selectedEmpresaId]);

  const divisiones = useMemo(() => {
    const cli = clientes.find((c: AnyNode) => Number(c.id) === Number(selectedClienteId));
    return cli?.division || cli?.divisiones || [];
  }, [clientes, selectedClienteId]);

  const contratos = useMemo(() => {
    const div = divisiones.find((d: AnyNode) => Number(d.id) === Number(selectedDivisionId));
    return div?.contratos || [];
  }, [divisiones, selectedDivisionId]);

  const sucursales = useMemo(() => {
    const cont = contratos.find((c: AnyNode) => Number(c.id) === Number(selectedContratoId));
    return cont?.sucursales || [];
  }, [contratos, selectedContratoId]);

  const puestos = useMemo(() => {
    const suc = sucursales.find((s: AnyNode) => Number(s.id) === Number(selectedSucursalId));
    return suc?.puestos || [];
  }, [sucursales, selectedSucursalId]);

  const plazas = useMemo(() => {
    const puesto = puestos.find((p: AnyNode) => Number(p.id) === Number(selectedPuestoId));
    return puesto?.plazas || [];
  }, [puestos, selectedPuestoId]);

  const empleados = useMemo(() => {
    const plaza = plazas.find((p: AnyNode) => Number(p.id) === Number(selectedPlazaId));
    return plaza?.empleados || [];
  }, [plazas, selectedPlazaId]);

  const vehiculosSucursal = useMemo(() => {
    const suc = sucursales.find((s: AnyNode) => Number(s.id) === Number(selectedSucursalId));
    return suc?.vehiculos_corporativos || [];
  }, [sucursales, selectedSucursalId]);

  const articulosPuesto = useMemo(() => {
    const puesto = puestos.find((p: AnyNode) => Number(p.id) === Number(selectedPuestoId));
    return puesto?.articulos || [];
  }, [puestos, selectedPuestoId]);

  const handleEmpresaChange = (value: number | string) => {
    const id = value === '' ? null : Number(value);
    setSelectedEmpresaId(id);
    setSelectedClienteId(null);
    setSelectedDivisionId(null);
    setSelectedContratoId(null);
    setSelectedSucursalId(null);
    setSelectedPuestoId(null);
    setSelectedPlazaId(null);
    setSelectedEmpleadoId(null);
    setActiveSummary(id != null ? 'empresa' : null);
    notifySelectionChange({
      empresaId: id,
      clienteId: null,
      divisionId: null,
      contratoId: null,
      sucursalId: null,
      puestoId: null,
      plazaId: null,
      empleadoId: null,
    });
  };

  const handleClienteChange = (value: number | string) => {
    const id = value === '' ? null : Number(value);
    setSelectedClienteId(id);
    setSelectedDivisionId(null);
    setSelectedContratoId(null);
    setSelectedSucursalId(null);
    setSelectedPuestoId(null);
    setSelectedPlazaId(null);
    setSelectedEmpleadoId(null);
    setActiveSummary(id != null ? 'cliente' : selectedEmpresaId != null ? 'empresa' : null);
    notifySelectionChange({
      clienteId: id,
      divisionId: null,
      contratoId: null,
      sucursalId: null,
      puestoId: null,
      plazaId: null,
      empleadoId: null,
    });
  };

  const handleDivisionChange = (value: number | string) => {
    const id = value === '' ? null : Number(value);
    setSelectedDivisionId(id);
    setSelectedContratoId(null);
    setSelectedSucursalId(null);
    setSelectedPuestoId(null);
    setSelectedPlazaId(null);
    setSelectedEmpleadoId(null);
    setActiveSummary(id != null ? 'division' : selectedClienteId != null ? 'cliente' : null);
    notifySelectionChange({
      divisionId: id,
      contratoId: null,
      sucursalId: null,
      puestoId: null,
      plazaId: null,
      empleadoId: null,
    });
  };

  const handleContratoChange = (value: number | string) => {
    const id = value === '' ? null : Number(value);
    setSelectedContratoId(id);
    setSelectedSucursalId(null);
    setSelectedPuestoId(null);
    setSelectedPlazaId(null);
    setSelectedEmpleadoId(null);
    setActiveSummary(id != null ? 'contrato' : selectedDivisionId != null ? 'division' : null);
    notifySelectionChange({
      contratoId: id,
      sucursalId: null,
      puestoId: null,
      plazaId: null,
      empleadoId: null,
    });
  };

  const handleSucursalChange = (value: number | string) => {
    const id = value === '' ? null : Number(value);
    setSelectedSucursalId(id);
    setSelectedPuestoId(null);
    setSelectedPlazaId(null);
    setSelectedEmpleadoId(null);
    setActiveSummary(id != null ? 'sucursal' : selectedContratoId != null ? 'contrato' : null);
    notifySelectionChange({
      sucursalId: id,
      puestoId: null,
      plazaId: null,
      empleadoId: null,
    });
  };

  const handlePuestoChange = (value: number | string) => {
    const id = value === '' ? null : Number(value);
    setSelectedPuestoId(id);
    setSelectedPlazaId(null);
    setSelectedEmpleadoId(null);
    setActiveSummary(id != null ? 'puesto' : selectedSucursalId != null ? 'sucursal' : null);
    notifySelectionChange({
      puestoId: id,
      plazaId: null,
      empleadoId: null,
    });
  };

  const handlePlazaChange = (value: number | string) => {
    const id = value === '' ? null : Number(value);
    setSelectedPlazaId(id);
    setSelectedEmpleadoId(null);
    setActiveSummary(id != null ? 'plaza' : selectedPuestoId != null ? 'puesto' : null);
    notifySelectionChange({
      plazaId: id,
      empleadoId: null,
    });
  };

  const handleEmpleadoChange = (value: number | string) => {
    const id = value === '' ? null : Number(value);
    setSelectedEmpleadoId(id);
    setActiveSummary(id != null ? 'empleado' : selectedPlazaId != null ? 'plaza' : null);
    notifySelectionChange({ empleadoId: id });
  };

  const renderSummaryList = (title: string, items: AnyNode[], getLabel: (item: AnyNode) => string) => {
    if (!items || items.length === 0) return null;
    return (
      <View style={styles.summarySection}>
        <Text style={styles.summaryTitle}>
          {title} ({items.length})
        </Text>
        {items.map((item) => (
          <Text key={String(item.id)} style={styles.summaryItem}>
            • {getLabel(item)}
          </Text>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Jerarquía</Text>
        <TouchableOpacity
          style={[styles.refreshButton, (isRefreshing || isStructureLoading) && { opacity: 0.6 }]}
          onPress={refreshHierarchy}
          disabled={isRefreshing || isStructureLoading}
        >
          {isRefreshing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="refresh" size={18} color="#FFFFFF" />
          )}
          <Text style={styles.refreshButtonText}>Actualizar jerarquía</Text>
        </TouchableOpacity>
      </View>

      {isStructureLoading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.loadingText}>Cargando jerarquía desde cache...</Text>
        </View>
      )}

      {!isStructureLoading && empresas.length === 0 && (
        <Text style={styles.emptyText}>
          No hay datos de jerarquía en cache. Usa "Actualizar jerarquía" para descargarlos cuando tengas conexión.
        </Text>
      )}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Empresa */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Empresa</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedEmpresaId ?? ''}
              onValueChange={handleEmpresaChange}
              style={styles.picker}
            >
              <Picker.Item label="Seleccionar..." value="" />
              {empresas.map((e) => (
                <Picker.Item key={String(e.id)} label={String(e.nombre)} value={e.id} />
              ))}
            </Picker>
          </View>
        </View>

        {/* Cliente */}
        {selectedEmpresaId && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Cliente</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedClienteId ?? ''}
                onValueChange={handleClienteChange}
                style={styles.picker}
              >
                <Picker.Item label="Seleccionar..." value="" />
                {clientes.map((c: AnyNode) => (
                  <Picker.Item key={String(c.id)} label={String(c.nombre)} value={c.id} />
                ))}
              </Picker>
            </View>
            {activeSummary === 'empresa' &&
              renderSummaryList('Clientes de la empresa', clientes, (c: AnyNode) => String(c.nombre))}
          </View>
        )}

        {/* División */}
        {selectedClienteId && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>División</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedDivisionId ?? ''}
                onValueChange={handleDivisionChange}
                style={styles.picker}
              >
                <Picker.Item label="Seleccionar..." value="" />
                {divisiones.map((d: AnyNode) => (
                  <Picker.Item key={String(d.id)} label={String(d.nombre)} value={d.id} />
                ))}
              </Picker>
            </View>
            {activeSummary === 'cliente' &&
              renderSummaryList('Divisiones del cliente', divisiones, (d: AnyNode) => String(d.nombre))}
          </View>
        )}

        {/* Contrato */}
        {selectedDivisionId && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Contrato</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedContratoId ?? ''}
                onValueChange={handleContratoChange}
                style={styles.picker}
              >
                <Picker.Item label="Seleccionar..." value="" />
                {contratos.map((ct: AnyNode) => (
                  <Picker.Item key={String(ct.id)} label={String(ct.nombre)} value={ct.id} />
                ))}
              </Picker>
            </View>
            {activeSummary === 'division' &&
              renderSummaryList('Contratos de la división', contratos, (ct: AnyNode) => String(ct.nombre))}
          </View>
        )}

        {/* Sucursal */}
        {selectedContratoId && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Sucursal</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedSucursalId ?? ''}
                onValueChange={handleSucursalChange}
                style={styles.picker}
              >
                <Picker.Item label="Seleccionar..." value="" />
                {sucursales.map((s: AnyNode) => (
                  <Picker.Item key={String(s.id)} label={String(s.nombre)} value={s.id} />
                ))}
              </Picker>
            </View>
            {activeSummary === 'contrato' &&
              renderSummaryList('Sucursales del contrato', sucursales, (s: AnyNode) => String(s.nombre))}
            {activeSummary === 'sucursal' &&
              renderSummaryList(
                'Vehículos corporativos de la sucursal',
                vehiculosSucursal,
                (v: AnyNode) => `${v.placa || v.placa_vehiculo || 'Sin placa'} - ${v.marca || ''}`.trim(),
              )}
          </View>
        )}

        {/* Puesto */}
        {selectedSucursalId && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Puesto</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedPuestoId ?? ''}
                onValueChange={handlePuestoChange}
                style={styles.picker}
              >
                <Picker.Item label="Seleccionar..." value="" />
                {puestos.map((p: AnyNode) => (
                  <Picker.Item key={String(p.id)} label={String(p.nombre)} value={p.id} />
                ))}
              </Picker>
            </View>
            {activeSummary === 'sucursal' &&
              renderSummaryList('Puestos de la sucursal', puestos, (p: AnyNode) => String(p.nombre))}
            {activeSummary === 'puesto' &&
              renderSummaryList(
                'Artículos del puesto',
                articulosPuesto,
                (a: AnyNode) => `${a.nombre} (${a.tipo || 'N/A'})`,
              )}
          </View>
        )}

        {/* Plaza */}
        {selectedPuestoId && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Plaza</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedPlazaId ?? ''}
                onValueChange={handlePlazaChange}
                style={styles.picker}
              >
                <Picker.Item label="Seleccionar..." value="" />
                {plazas.map((pl: AnyNode) => (
                  <Picker.Item key={String(pl.id)} label={String(pl.nombre || pl.codigo || pl.id)} value={pl.id} />
                ))}
              </Picker>
            </View>
            {activeSummary === 'puesto' &&
              renderSummaryList('Plazas del puesto', plazas, (pl: AnyNode) =>
                String(pl.nombre || pl.codigo || `Plaza #${pl.id}`),
              )}
          </View>
        )}

        {/* Empleado */}
        {selectedPlazaId && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Empleado</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedEmpleadoId ?? ''}
                onValueChange={handleEmpleadoChange}
                style={styles.picker}
              >
                <Picker.Item label="Seleccionar..." value="" />
                {empleados.map((emp: AnyNode) => (
                  <Picker.Item
                    key={String(emp.id)}
                    label={String(
                      `${emp.nombre || ''} ${emp.primer_apellido || ''} ${emp.segundo_apellido || ''} - ${
                        emp.cedula || ''
                      }`.trim(),
                    )}
                    value={emp.id}
                  />
                ))}
              </Picker>
            </View>
            {activeSummary === 'plaza' &&
              renderSummaryList('Empleados de la plaza', empleados, (emp: AnyNode) =>
                String(
                  `${emp.nombre || ''} ${emp.primer_apellido || ''} ${emp.segundo_apellido || ''} - ${
                    emp.cedula || ''
                  }`.trim(),
                ),
              )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default JerarquiaModule;

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#F9F9F9',
    marginTop: 12,
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#007AFF',
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  loadingText: {
    fontSize: 12,
    color: '#333',
  },
  emptyText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  scroll: {
    maxHeight: 420,
  },
  scrollContent: {
    paddingBottom: 8,
    gap: 10,
  },
  fieldGroup: {
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    minHeight: 52,
  },
  picker: {
    height: 52,
    width: '100%',
    color: '#000000',
  },
  summarySection: {
    marginTop: 6,
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  summaryTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
    color: '#333',
  },
  summaryItem: {
    fontSize: 11,
    color: '#555',
  },
});

