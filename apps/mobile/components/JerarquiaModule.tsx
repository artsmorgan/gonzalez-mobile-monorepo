import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

import { useAuth } from '@/contexts/AuthContext';
import { convertDateTimestampToLocalString } from '@/hooks/convertDateTimestampToLocalString';
import { loadMainStructureTreeMerged } from '@/hooks/bitacoraMainStructureCache';
import {
  regenerateAndDownloadMainStructure,
  type MainStructureModules,
  type MainStructureScope,
} from '@/hooks/mainStructureApi';
import HierarchySearchModal, { type HierarchySearchLevel } from '@/components/HierarchySearchModal';
import type { HierarchySelectionPath } from '@/hooks/hierarchySearch';

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

  /** Referencias estables: `logout`/`refreshAccessToken` del contexto cambian en cada render. */
  const authHandlersRef = useRef({ refreshAccessToken, logout });
  authHandlersRef.current = { refreshAccessToken, logout };

  const [structure, setStructure] = useState<AnyNode[]>([]);
  const [isStructureLoading, setIsStructureLoading] = useState(false);
  const [cacheHydrated, setCacheHydrated] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const [selectedEmpresaId, setSelectedEmpresaId] = useState<number | null>(null);
  const [selectedClienteId, setSelectedClienteId] = useState<number | null>(null);
  const [selectedDivisionId, setSelectedDivisionId] = useState<number | null>(null);
  const [selectedContratoId, setSelectedContratoId] = useState<number | null>(null);
  const [selectedSucursalId, setSelectedSucursalId] = useState<number | null>(null);
  const [selectedPuestoId, setSelectedPuestoId] = useState<number | null>(null);
  const [selectedPlazaId, setSelectedPlazaId] = useState<number | null>(null);
  const [selectedEmpleadoId, setSelectedEmpleadoId] = useState<number | null>(null);
  const [createdAt, setCreatedAt] = useState<number | null>(null);
  const [showGenerateOptions, setShowGenerateOptions] = useState(false);
  const [fragmentModules, setFragmentModules] = useState<MainStructureModules>({
    estructura: true,
    vehiculos: true,
    llaves: true,
    mantenimientos: true,
  });
  const [activeSummary, setActiveSummary] = useState<
    'empresa' | 'cliente' | 'division' | 'contrato' | 'sucursal' | 'puesto' | 'plaza' | 'empleado' | null
  >(null);
  const [hierarchySearchLevel, setHierarchySearchLevel] = useState<HierarchySearchLevel | null>(null);

  const getConnectionStatus = useCallback(async (): Promise<boolean> => {
    const networkState = await Network.getNetworkStateAsync();

    return (
      networkState.isConnected === true &&
      networkState.isInternetReachable === true
    );
  }, []);

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

  /** Solo lectura local (AsyncStorage / fragmentos), como el proyecto original al abrir el módulo. */
  const loadFromCache = useCallback(async () => {
    setIsStructureLoading(true);
    try {
      const mergedTree = await loadMainStructureTreeMerged();
      setStructure(Array.isArray(mergedTree) ? mergedTree : []);
    } catch {
      setStructure([]);
    } finally {
      setIsStructureLoading(false);
      setCacheHydrated(true);
    }
  }, []);

  const buildFragmentScope = useCallback((): MainStructureScope => {
    return {
      empresaId: selectedEmpresaId,
      clienteId: selectedClienteId,
      divisionId: selectedDivisionId,
      contratoId: selectedContratoId,
      sucursalId: selectedSucursalId,
      puestoId: selectedPuestoId,
    };
  }, [
    selectedEmpresaId,
    selectedClienteId,
    selectedDivisionId,
    selectedContratoId,
    selectedSucursalId,
    selectedPuestoId,
  ]);

  const scopeSummaryLabel = useMemo(() => {
    if (selectedPuestoId) return `Puesto #${selectedPuestoId}`;
    if (selectedSucursalId) return `Sucursal #${selectedSucursalId}`;
    if (selectedContratoId) return `Contrato #${selectedContratoId}`;
    if (selectedDivisionId) return `División #${selectedDivisionId}`;
    if (selectedClienteId) return `Cliente #${selectedClienteId}`;
    if (selectedEmpresaId) return `Empresa #${selectedEmpresaId}`;
    return 'Toda la organización';
  }, [
    selectedEmpresaId,
    selectedClienteId,
    selectedDivisionId,
    selectedContratoId,
    selectedSucursalId,
    selectedPuestoId,
  ]);

  const toggleFragmentModule = useCallback((key: keyof MainStructureModules) => {
    setFragmentModules((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      const anyOn = next.estructura || next.vehiculos || next.llaves || next.mantenimientos;
      return anyOn ? next : prev;
    });
  }, []);

  const loadCreatedAt = useCallback(async () => {
    const createdAtStr = await AsyncStorage.getItem('main_structure_created_at');
    if (createdAtStr) {
      setCreatedAt(Number(createdAtStr));
    }
  }, []);

  const isLocalHierarchyEmpty = useMemo(
    () =>
      cacheHydrated &&
      !isStructureLoading &&
      (!Array.isArray(structure) || structure.length === 0),
    [cacheHydrated, isStructureLoading, structure],
  );

  const canGenerateHierarchy = !isGenerating && !isStructureLoading;

  /** Genera en servidor (POST) y guarda fragmentos locales (formato main-structure.json). */
  const generateAndDownloadHierarchy = useCallback(async () => {
    const isConnected = await getConnectionStatus();
    if (!isConnected) {
      Alert.alert('Sin conexión', 'No hay conexión a internet. No es posible generar la jerarquía.');
      return;
    }

    const runGenerate = async () => {
      const scopeSnapshot = buildFragmentScope();
      const modulesSnapshot = { ...fragmentModules };
      try {
        Alert.alert('Generando jerarquía', 'Generando fragmentos en el servidor, por favor no cierre la ventana');
        setIsGenerating(true);
        resetSelection();
        const { structureTree, createdAt: incomingCreatedAt } = await regenerateAndDownloadMainStructure(
          authHandlersRef.current,
          {
            scope: scopeSnapshot,
            modules: modulesSnapshot,
            mergeWithExisting: true,
          },
        );
        setStructure(Array.isArray(structureTree) ? structureTree : []);
        if (incomingCreatedAt != null) {
          setCreatedAt(incomingCreatedAt);
        }
        Alert.alert('Éxito', 'Se ha generado y descargado la jerarquía');
      } catch (e) {
        Alert.alert(
          'Error',
          e instanceof Error ? e.message : 'No se pudo generar la jerarquía. Intente nuevamente.',
        );
      } finally {
        setIsGenerating(false);
      }
    };

    if (isLocalHierarchyEmpty) {
      await runGenerate();
      return;
    }

    Alert.alert(
      'Generar y descargar jerarquía',
      `Alcance: ${scopeSummaryLabel}.\n\nEsto generará una nueva estructura en el servidor, reemplazará la cache local y reiniciará las selecciones actuales. ¿Desea continuar?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Generar',
          style: 'destructive',
          onPress: () => void runGenerate(),
        },
      ],
    );
  }, [
    getConnectionStatus,
    buildFragmentScope,
    fragmentModules,
    isLocalHierarchyEmpty,
    scopeSummaryLabel,
  ]);

  useEffect(() => {
    void loadFromCache();
    void loadCreatedAt();
  }, [loadFromCache, loadCreatedAt]);

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

  const openHierarchySearch = (level: HierarchySearchLevel) => {
    setHierarchySearchLevel(level);
  };

  const applyHierarchyPath = useCallback(
    (path: HierarchySelectionPath) => {
      setSelectedEmpresaId(path.empresaId);
      setSelectedClienteId(path.clienteId);
      setSelectedDivisionId(path.divisionId);
      setSelectedContratoId(path.contratoId);
      setSelectedSucursalId(path.sucursalId);
      setSelectedPuestoId(path.puestoId);
      setSelectedPlazaId(path.plazaId);
      setSelectedEmpleadoId(null);

      let summary: typeof activeSummary = 'empresa';
      if (path.plazaId != null) summary = 'plaza';
      else if (path.puestoId != null) summary = 'puesto';
      else if (path.sucursalId != null) summary = 'sucursal';
      else if (path.contratoId != null) summary = 'contrato';
      else if (path.divisionId != null) summary = 'division';
      else if (path.clienteId != null) summary = 'cliente';
      setActiveSummary(summary);

      notifySelectionChange({
        empresaId: path.empresaId,
        clienteId: path.clienteId,
        divisionId: path.divisionId,
        contratoId: path.contratoId,
        sucursalId: path.sucursalId,
        puestoId: path.puestoId,
        plazaId: path.plazaId,
        empleadoId: null,
      });
    },
    [notifySelectionChange],
  );

  const hierarchySearchEnabled = empresas.length > 0 && !isStructureLoading;

  const renderHierarchySearchButton = (level: HierarchySearchLevel) => (
    <TouchableOpacity
      style={[styles.searchIconBtn, !hierarchySearchEnabled && styles.searchIconBtnDisabled]}
      onPress={() => hierarchySearchEnabled && openHierarchySearch(level)}
      activeOpacity={0.85}
      disabled={!hierarchySearchEnabled}
      accessibilityLabel={`Buscar ${level}`}
    >
      <Ionicons name="search" size={20} color="#FFFFFF" />
    </TouchableOpacity>
  );

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

  const renderModuleToggle = (key: keyof MainStructureModules, label: string) => {
    const active = fragmentModules[key];
    return (
      <TouchableOpacity
        key={key}
        style={styles.moduleToggleRow}
        onPress={() => toggleFragmentModule(key)}
        activeOpacity={0.85}
      >
        <Ionicons
          name={active ? 'checkbox' : 'square-outline'}
          size={22}
          color={active ? '#007AFF' : '#9CA3AF'}
        />
        <Text style={styles.moduleToggleLabel}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Jerarquía</Text>
        <TouchableOpacity
          style={[styles.refreshButton, (!canGenerateHierarchy || isGenerating) && { opacity: 0.6 }]}
          onPress={generateAndDownloadHierarchy}
          disabled={!canGenerateHierarchy || isGenerating}
        >
          {isGenerating ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="cloud-download-outline" size={18} color="#FFFFFF" />
          )}
          <Text style={styles.refreshButtonText}>Generar y descargar</Text>
        </TouchableOpacity>
      </View>

      {createdAt != null && Number.isFinite(createdAt) && (
        <Text style={styles.metaText}>
          Última generación local: {convertDateTimestampToLocalString(new Date(createdAt).toISOString())}
        </Text>
      )}

      <TouchableOpacity
        style={styles.optionsToggleRow}
        onPress={() => setShowGenerateOptions((v) => !v)}
        activeOpacity={0.85}
      >
        <Text style={styles.optionsToggleText}>Fragmentos a generar</Text>
        <Ionicons name={showGenerateOptions ? 'chevron-up' : 'chevron-down'} size={18} color="#007AFF" />
      </TouchableOpacity>

      {showGenerateOptions && (
        <View style={styles.optionsPanel}>
          <Text style={styles.optionsHint}>
            Alcance según selección actual: {scopeSummaryLabel}
          </Text>
          {renderModuleToggle('estructura', 'Jerarquía base (empresas, puestos, plazas, empleados)')}
          {renderModuleToggle('vehiculos', 'Vehículos corporativos y bitácora')}
          {renderModuleToggle('llaves', 'Llaves y llaveros')}
          {renderModuleToggle('mantenimientos', 'Artículos: mantenimientos y movimientos')}
        </View>
      )}

      {isStructureLoading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.loadingText}>Cargando jerarquía desde cache...</Text>
        </View>
      )}

      {!isStructureLoading && empresas.length === 0 && (
        <Text style={styles.emptyText}>
          No hay jerarquía en cache local. Usa "Generar y descargar" cuando tengas conexión.
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
              <Picker.Item label="Seleccionar..." value="" color="#000000" />
              {empresas.map((e) => (
                <Picker.Item key={String(e.id)} label={String(e.nombre)} value={e.id} color="#000000" />
              ))}
            </Picker>
          </View>
        </View>

        {/* Cliente */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Cliente</Text>
          <View style={styles.pickerRow}>
            <View style={[styles.pickerContainer, styles.pickerContainerFlex, !selectedEmpresaId && styles.pickerDisabled]}>
              <Picker
                selectedValue={selectedClienteId ?? ''}
                onValueChange={handleClienteChange}
                style={styles.picker}
                enabled={!!selectedEmpresaId}
              >
                <Picker.Item label="Seleccionar..." value="" color="#000000" />
                {clientes.map((c: AnyNode) => (
                  <Picker.Item key={String(c.id)} label={String(c.nombre)} value={c.id} color="#000000" />
                ))}
              </Picker>
            </View>
            {renderHierarchySearchButton('cliente')}
          </View>
          {activeSummary === 'empresa' &&
            renderSummaryList('Clientes de la empresa', clientes, (c: AnyNode) => String(c.nombre))}
        </View>

        {/* División */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>División</Text>
          <View style={[styles.pickerContainer, !selectedClienteId && styles.pickerDisabled]}>
            <Picker
              selectedValue={selectedDivisionId ?? ''}
              onValueChange={handleDivisionChange}
              style={styles.picker}
              enabled={!!selectedClienteId}
            >
              <Picker.Item label="Seleccionar..." value="" color="#000000" />
              {divisiones.map((d: AnyNode) => (
                <Picker.Item key={String(d.id)} label={String(d.nombre)} value={d.id} color="#000000" />
              ))}
            </Picker>
          </View>
          {activeSummary === 'cliente' &&
            renderSummaryList('Divisiones del cliente', divisiones, (d: AnyNode) => String(d.nombre))}
        </View>

        {/* Contrato */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Contrato</Text>
          <View style={styles.pickerRow}>
            <View style={[styles.pickerContainer, styles.pickerContainerFlex, !selectedDivisionId && styles.pickerDisabled]}>
              <Picker
                selectedValue={selectedContratoId ?? ''}
                onValueChange={handleContratoChange}
                style={styles.picker}
                enabled={!!selectedDivisionId}
              >
                <Picker.Item label="Seleccionar..." value="" color="#000000" />
                {contratos.map((ct: AnyNode) => (
                  <Picker.Item key={String(ct.id)} label={String(ct.nombre)} value={ct.id} color="#000000" />
                ))}
              </Picker>
            </View>
            {renderHierarchySearchButton('contrato')}
          </View>
          {activeSummary === 'division' &&
            renderSummaryList('Contratos de la división', contratos, (ct: AnyNode) => String(ct.nombre))}
        </View>

        {/* Sucursal */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Sucursal</Text>
          <View style={styles.pickerRow}>
            <View style={[styles.pickerContainer, styles.pickerContainerFlex, !selectedContratoId && styles.pickerDisabled]}>
              <Picker
                selectedValue={selectedSucursalId ?? ''}
                onValueChange={handleSucursalChange}
                style={styles.picker}
                enabled={!!selectedContratoId}
              >
                <Picker.Item label="Seleccionar..." value="" color="#000000" />
                {sucursales.map((s: AnyNode) => (
                  <Picker.Item key={String(s.id)} label={String(s.nombre)} value={s.id} color="#000000" />
                ))}
              </Picker>
            </View>
            {renderHierarchySearchButton('sucursal')}
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

        {/* Puesto */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Puesto</Text>
          <View style={styles.pickerRow}>
            <View style={[styles.pickerContainer, styles.pickerContainerFlex, !selectedSucursalId && styles.pickerDisabled]}>
              <Picker
                selectedValue={selectedPuestoId ?? ''}
                onValueChange={handlePuestoChange}
                style={styles.picker}
                enabled={!!selectedSucursalId}
              >
                <Picker.Item label="Seleccionar..." value="" color="#000000" />
                {puestos.map((p: AnyNode) => (
                  <Picker.Item key={String(p.id)} label={String(p.nombre)} value={p.id} color="#000000" />
                ))}
              </Picker>
            </View>
            {renderHierarchySearchButton('puesto')}
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

        {/* Plaza */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Plaza</Text>
          <View style={styles.pickerRow}>
            <View style={[styles.pickerContainer, styles.pickerContainerFlex, !selectedPuestoId && styles.pickerDisabled]}>
              <Picker
                selectedValue={selectedPlazaId ?? ''}
                onValueChange={handlePlazaChange}
                style={styles.picker}
                enabled={!!selectedPuestoId}
              >
                <Picker.Item label="Seleccionar..." value="" color="#000000" />
                {plazas.map((pl: AnyNode) => (
                  <Picker.Item key={String(pl.id)} label={String(pl.nombre || pl.codigo || pl.id)} value={pl.id} color="#000000" />
                ))}
              </Picker>
            </View>
            {renderHierarchySearchButton('plaza')}
          </View>
          {activeSummary === 'puesto' &&
            renderSummaryList('Plazas del puesto', plazas, (pl: AnyNode) =>
              String(pl.nombre || pl.codigo || `Plaza #${pl.id}`),
            )}
        </View>

        {/* Empleado */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Empleado</Text>
          <View style={[styles.pickerContainer, !selectedPlazaId && styles.pickerDisabled]}>
            <Picker
              selectedValue={selectedEmpleadoId ?? ''}
              onValueChange={handleEmpleadoChange}
              style={styles.picker}
              enabled={!!selectedPlazaId}
            >
              <Picker.Item label="Seleccionar..." value="" color="#000000" />
              {empleados.map((emp: AnyNode) => (
                <Picker.Item
                  key={String(emp.id)}
                  label={String(
                    `${emp.nombre || ''} ${emp.primer_apellido || ''} ${emp.segundo_apellido || ''} - ${
                      emp.cedula || ''
                    }`.trim(),
                  )}
                  value={emp.id}
                  color="#000000"
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

        {createdAt != null && Number.isFinite(createdAt) && (
            <Text style={[styles.label, { marginBottom: 0 }]}>
              Última descarga local: {convertDateTimestampToLocalString(new Date(createdAt).toISOString())}
            </Text>
        )}
      </ScrollView>

      <HierarchySearchModal
        visible={hierarchySearchLevel != null}
        level={hierarchySearchLevel ?? 'cliente'}
        structure={structure}
        onClose={() => setHierarchySearchLevel(null)}
        onSelect={(path) => applyHierarchyPath(path)}
      />
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  refreshButtonSecondary: {
    backgroundColor: '#5856D6',
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  metaText: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
  },
  optionsToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  optionsToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007AFF',
  },
  optionsPanel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    padding: 10,
    gap: 6,
    marginBottom: 4,
  },
  optionsHint: {
    fontSize: 11,
    color: '#555',
    marginBottom: 4,
  },
  moduleToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  moduleToggleLabel: {
    flex: 1,
    fontSize: 12,
    color: '#333',
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
    // Permitir que el contenido crezca según los selects e información
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
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pickerContainerFlex: {
    flex: 1,
    minWidth: 0,
  },
  searchIconBtn: {
    backgroundColor: '#007AFF',
    height: 52,
    minHeight: 52,
    width: 44,
    minWidth: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchIconBtnDisabled: {
    opacity: 0.45,
    backgroundColor: '#9CA3AF',
  },
  pickerDisabled: {
    opacity: 0.55,
    backgroundColor: '#F3F4F6',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    height: 52,
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

