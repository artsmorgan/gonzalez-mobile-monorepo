import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { searchActaStructure, type StructureLite } from '@/hooks/reportesFunctions';

export type PuestoSalidaOption = { id: number; nombre: string; codigo?: string | null };

function formatStructureLite(item: StructureLite): string {
  const parts = [item.codigo, item.numero, item.nombre].filter(Boolean);
  return parts.join(' — ') || String(item.id);
}

interface PuestoSalidaPickerProps {
  value: PuestoSalidaOption | null;
  onChange: (option: PuestoSalidaOption | null) => void;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<unknown>;
  label?: string;
}

/** Buscador de puesto de salida por código o nombre: misma funcionalidad y apariencia que
 * el buscador de puesto de `ReportesPuestoModal.tsx` (búsqueda en servidor vía `searchActaStructure`). */
export default function PuestoSalidaPicker({
  value,
  onChange,
  refreshAccessToken,
  logout,
  label = 'Puesto de salida (opcional)',
}: PuestoSalidaPickerProps) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<StructureLite[]>([]);
  const [searching, setSearching] = useState(false);

  const runSearch = async () => {
    const trimmed = search.trim();
    if (!trimmed) {
      Alert.alert('Puesto', 'Escriba un nombre o código de puesto.');
      return;
    }
    setSearching(true);
    try {
      const res = await searchActaStructure({ entity: 'puesto', q: trimmed, refreshAccessToken, logout });
      const data = res.status ? res.data ?? [] : [];
      setResults(data);
      if (!data.length) Alert.alert('Puesto', 'Sin resultados.');
    } finally {
      setSearching(false);
    }
  };

  const selectPuesto = (it: StructureLite) => {
    onChange({ id: it.id, nombre: it.nombre, codigo: it.codigo ?? null });
    setSearch('');
    setResults([]);
  };

  const clearPuesto = () => {
    onChange(null);
    setSearch('');
    setResults([]);
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, styles.inputFlex]}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por nombre o código"
          placeholderTextColor="#999"
        />
        <TouchableOpacity style={styles.searchIconBtn} onPress={() => void runSearch()} disabled={searching} activeOpacity={0.85}>
          {searching ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="search" size={22} color="#fff" />}
        </TouchableOpacity>
      </View>
      {results.length > 0 && (
        <ThemedView style={styles.resultList}>
          {results.map((it) => (
            <TouchableOpacity key={`puesto-salida-${it.id}`} style={styles.resultItem} onPress={() => selectPuesto(it)}>
              <ThemedText>{formatStructureLite(it)}</ThemedText>
            </TouchableOpacity>
          ))}
        </ThemedView>
      )}
      {value && (
        <ThemedView style={styles.assignedUserItem}>
          <ThemedText style={styles.assignedUserTitle}>
            {value.nombre}
            {value.codigo ? ` (${value.codigo})` : ''}
          </ThemedText>
          <TouchableOpacity style={styles.removeUserButton} onPress={clearPuesto} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Ionicons name="trash-outline" size={18} color="#FF3B30" />
          </TouchableOpacity>
        </ThemedView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', marginTop: 8, marginBottom: 4 },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 6, color: '#333' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#fff',
    color: '#000',
  },
  inputFlex: { flex: 1 },
  searchIconBtn: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultList: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, overflow: 'hidden', marginTop: 6 },
  resultItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#E8E8E8', backgroundColor: '#FFFFFF' },
  assignedUserItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  assignedUserTitle: { fontSize: 14, color: '#000', flex: 1, paddingRight: 8 },
  removeUserButton: { padding: 4 },
});
