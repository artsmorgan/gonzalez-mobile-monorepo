import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Ionicons from '@expo/vector-icons/build/Ionicons';

import HierarchySearchModal from '@/components/HierarchySearchModal';
import {
  type HierarchySearchLevel,
  type HierarchySelectionPath,
} from '@/hooks/hierarchySearch';

export type HierarchyPickerLevel = HierarchySearchLevel;

export type HierarchyPickerValues = {
  empresaId: number | null;
  clienteId: number | null;
  divisionId: number | null;
  contratoId: number | null;
  sucursalId: number | null;
  puestoId?: number | null;
  plazaId?: number | null;
};

type AnyNode = Record<string, any>;

export type HierarchyPickerFieldsProps = {
  structure: AnyNode[];
  /** Niveles con búsqueda (cliente … plaza). Siempre se muestran empresa + división cuando aplica. */
  levels: readonly HierarchyPickerLevel[];
  values: HierarchyPickerValues;
  onChange: (values: HierarchyPickerValues) => void;
  isLoading?: boolean;
  /** Deshabilita selects y búsqueda (p. ej. jerarquía precargada y bloqueada). */
  disabled?: boolean;
  /** Valor vacío del Picker ("" o 0). Default "". */
  emptyPickerValue?: '' | 0;
  labels?: Partial<{
    empresa: string;
    cliente: string;
    division: string;
    contrato: string;
    sucursal: string;
    puesto: string;
    plaza: string;
    selectEmpresa: string;
    selectCliente: string;
    selectDivision: string;
    selectContrato: string;
    selectSucursal: string;
    selectPuesto: string;
    selectPlaza: string;
  }>;
  /** Etiqueta encima de cada campo */
  renderLabel?: (text: string) => React.ReactNode;
  pickerWrapperStyle?: ViewStyle;
  pickerStyle?: TextStyle;
  fieldGroupStyle?: ViewStyle;
};

/** Altura del select y del botón de búsqueda (sin incluir la etiqueta). */
const PICKER_CONTROL_HEIGHT = 52;

const DEFAULT_LABELS = {
  empresa: 'Empresa',
  cliente: 'Cliente',
  division: 'División',
  contrato: 'Contrato',
  sucursal: 'Sucursal',
  puesto: 'Puesto',
  plaza: 'Plaza',
  selectEmpresa: 'Seleccionar...',
  selectCliente: 'Seleccionar...',
  selectDivision: 'Seleccionar...',
  selectContrato: 'Seleccionar...',
  selectSucursal: 'Seleccionar...',
  selectPuesto: 'Seleccionar...',
  selectPlaza: 'Seleccionar...',
};

function getDivisionArray(cliente: AnyNode): AnyNode[] {
  if (Array.isArray(cliente?.division)) return cliente.division;
  if (Array.isArray(cliente?.divisiones)) return cliente.divisiones;
  return [];
}

function parsePickerId(raw: string | number, empty: '' | 0): number | null {
  if (raw === '' || raw === empty) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function DefaultLabel({ text }: { text: string }) {
  return <Text style={styles.defaultLabel}>{text}</Text>;
}

export default function HierarchyPickerFields({
  structure,
  levels,
  values,
  onChange,
  isLoading = false,
  disabled = false,
  emptyPickerValue = '',
  labels: labelsProp,
  renderLabel,
  pickerWrapperStyle,
  pickerStyle,
  fieldGroupStyle,
}: HierarchyPickerFieldsProps) {
  const labels = { ...DEFAULT_LABELS, ...labelsProp };
  const Label = renderLabel ?? ((text: string) => <DefaultLabel text={text} />);

  const [searchLevel, setSearchLevel] = useState<HierarchySearchLevel | null>(null);

  const empresas = useMemo(() => (Array.isArray(structure) ? structure : []), [structure]);
  const searchEnabled = empresas.length > 0 && !isLoading && !disabled;
  const showDivision = levels.length > 0;

  const clientes = useMemo((): AnyNode[] => {
    if (values.empresaId == null) return [];
    const emp = empresas.find((e: AnyNode) => Number(e.id) === Number(values.empresaId));
    const list = emp?.clientes;
    return Array.isArray(list) ? (list as AnyNode[]) : [];
  }, [empresas, values.empresaId]);

  const divisiones = useMemo((): AnyNode[] => {
    if (values.clienteId == null) return [];
    const cli = clientes.find((c: AnyNode) => Number(c.id) === Number(values.clienteId));
    return cli ? getDivisionArray(cli) : [];
  }, [clientes, values.clienteId]);

  const contratos = useMemo((): AnyNode[] => {
    if (values.divisionId == null) return [];
    const div = divisiones.find((d: AnyNode) => Number(d.id) === Number(values.divisionId));
    const list = div?.contratos;
    return Array.isArray(list) ? (list as AnyNode[]) : [];
  }, [divisiones, values.divisionId]);

  const sucursales = useMemo((): AnyNode[] => {
    if (values.contratoId == null) return [];
    const ct = contratos.find((c: AnyNode) => Number(c.id) === Number(values.contratoId));
    const list = ct?.sucursales;
    return Array.isArray(list) ? (list as AnyNode[]) : [];
  }, [contratos, values.contratoId]);

  const puestos = useMemo((): AnyNode[] => {
    if (values.sucursalId == null) return [];
    const suc = sucursales.find((s: AnyNode) => Number(s.id) === Number(values.sucursalId));
    const list = suc?.puestos;
    return Array.isArray(list) ? (list as AnyNode[]) : [];
  }, [sucursales, values.sucursalId]);

  const plazas = useMemo((): AnyNode[] => {
    if (values.puestoId == null) return [];
    const puesto = puestos.find((p: AnyNode) => Number(p.id) === Number(values.puestoId));
    const list = puesto?.plazas;
    return Array.isArray(list) ? (list as AnyNode[]) : [];
  }, [puestos, values.puestoId]);

  const emit = useCallback(
    (patch: Partial<HierarchyPickerValues>) => {
      onChange({ ...values, ...patch });
    },
    [onChange, values],
  );

  const applyPath = useCallback(
    (path: HierarchySelectionPath) => {
      onChange({
        empresaId: path.empresaId,
        clienteId: path.clienteId,
        divisionId: path.divisionId,
        contratoId: path.contratoId,
        sucursalId: path.sucursalId,
        puestoId: path.puestoId ?? null,
        plazaId: path.plazaId ?? null,
      });
    },
    [onChange],
  );

  const renderSearchButton = (level: HierarchySearchLevel) => (
    <TouchableOpacity
      style={[styles.searchIconBtn, !searchEnabled && styles.searchIconBtnDisabled]}
      onPress={() => searchEnabled && setSearchLevel(level)}
      activeOpacity={0.85}
      disabled={!searchEnabled}
      accessibilityLabel={`Buscar ${level}`}
    >
      <Ionicons name="search" size={20} color="#FFFFFF" />
    </TouchableOpacity>
  );

  const renderPickerRow = (
    label: string,
    selectLabel: string,
    selected: number | null,
    enabled: boolean,
    items: AnyNode[],
    onSelect: (id: number | null) => void,
    searchLevelKey?: HierarchySearchLevel,
  ) => {
    const pickerEnabled = enabled && !disabled;
    return (
    <View style={[styles.fieldGroup, fieldGroupStyle]}>
      {Label(label)}
      <View style={styles.pickerRow}>
        <View
          style={[
            styles.pickerContainer,
            styles.pickerContainerFlex,
            !pickerEnabled && styles.pickerDisabled,
            pickerWrapperStyle,
          ]}
        >
          <Picker
            selectedValue={selected ?? emptyPickerValue}
            onValueChange={(v) => onSelect(parsePickerId(v, emptyPickerValue))}
            style={pickerStyle ? [styles.picker, pickerStyle] : styles.picker}
            enabled={pickerEnabled}
          >
            <Picker.Item label={selectLabel} value={emptyPickerValue} color="#000000" />
            {items.map((item) => (
              <Picker.Item
                key={String(item.id)}
                label={String(item.nombre)}
                value={item.id}
                color="#000000"
              />
            ))}
          </Picker>
        </View>
        {searchLevelKey ? renderSearchButton(searchLevelKey) : null}
      </View>
    </View>
  );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator size="small" color="#007AFF" />
        <Text style={styles.loadingText}>Cargando estructura...</Text>
      </View>
    );
  }

  return (
    <>
      {renderPickerRow(
        labels.empresa,
        labels.selectEmpresa,
        values.empresaId,
        empresas.length > 0,
        empresas,
        (id) =>
          emit({
            empresaId: id,
            clienteId: null,
            divisionId: null,
            contratoId: null,
            sucursalId: null,
            puestoId: null,
            plazaId: null,
          }),
      )}

      {levels.includes('cliente') &&
        renderPickerRow(
          labels.cliente,
          labels.selectCliente,
          values.clienteId,
          values.empresaId != null,
          clientes,
          (id) =>
            emit({
              clienteId: id,
              divisionId: null,
              contratoId: null,
              sucursalId: null,
              puestoId: null,
              plazaId: null,
            }),
          'cliente',
        )}

      {showDivision &&
        renderPickerRow(
          labels.division,
          labels.selectDivision,
          values.divisionId,
          values.clienteId != null,
          divisiones,
          (id) =>
            emit({
              divisionId: id,
              contratoId: null,
              sucursalId: null,
              puestoId: null,
              plazaId: null,
            }),
        )}

      {levels.includes('contrato') &&
        renderPickerRow(
          labels.contrato,
          labels.selectContrato,
          values.contratoId,
          values.divisionId != null,
          contratos,
          (id) =>
            emit({
              contratoId: id,
              sucursalId: null,
              puestoId: null,
              plazaId: null,
            }),
          'contrato',
        )}

      {levels.includes('sucursal') &&
        renderPickerRow(
          labels.sucursal,
          labels.selectSucursal,
          values.sucursalId,
          values.contratoId != null,
          sucursales,
          (id) =>
            emit({
              sucursalId: id,
              puestoId: null,
              plazaId: null,
            }),
          'sucursal',
        )}

      {levels.includes('puesto') &&
        renderPickerRow(
          labels.puesto,
          labels.selectPuesto,
          values.puestoId ?? null,
          values.sucursalId != null,
          puestos,
          (id) =>
            emit({
              puestoId: id,
              plazaId: null,
            }),
          'puesto',
        )}

      {levels.includes('plaza') &&
        renderPickerRow(
          labels.plaza,
          labels.selectPlaza,
          values.plazaId ?? null,
          values.puestoId != null,
          plazas,
          (id) => emit({ plazaId: id }),
          'plaza',
        )}

      <HierarchySearchModal
        visible={searchLevel != null}
        level={searchLevel ?? 'cliente'}
        structure={structure}
        onClose={() => setSearchLevel(null)}
        onSelect={(path) => {
          applyPath(path);
          setSearchLevel(null);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  fieldGroup: {
    marginBottom: 10,
  },
  defaultLabel: {
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
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    height: PICKER_CONTROL_HEIGHT,
    minHeight: PICKER_CONTROL_HEIGHT,
  },
  pickerContainerFlex: {
    flex: 1,
    minWidth: 0,
  },
  pickerDisabled: {
    opacity: 0.55,
    backgroundColor: '#F3F4F6',
  },
  picker: {
    height: PICKER_CONTROL_HEIGHT,
    width: '100%',
    color: '#000000',
  },
  searchIconBtn: {
    backgroundColor: '#007AFF',
    height: PICKER_CONTROL_HEIGHT,
    minHeight: PICKER_CONTROL_HEIGHT,
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
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  loadingText: {
    fontSize: 13,
    color: '#555',
  },
});
