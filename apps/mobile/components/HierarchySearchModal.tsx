import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/build/Ionicons';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import {
  HIERARCHY_SEARCH_LEVEL_LABELS,
  searchHierarchy,
  type HierarchySearchHit,
  type HierarchySearchLevel,
  type HierarchySelectionPath,
} from '@/hooks/hierarchySearch';

export type { HierarchySearchLevel, HierarchySelectionPath, HierarchySearchHit };

export interface HierarchySearchModalProps {
  visible: boolean;
  level: HierarchySearchLevel;
  /** Árbol ya cargado en pantalla; si falta, se lee de caché al buscar. */
  structure?: any[];
  onClose: () => void;
  onSelect: (path: HierarchySelectionPath, hit: HierarchySearchHit) => void;
}

export default function HierarchySearchModal({
  visible,
  level,
  structure,
  onClose,
  onSelect,
}: HierarchySearchModalProps) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [hits, setHits] = useState<HierarchySearchHit[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [resultsExpanded, setResultsExpanded] = useState(true);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setHits([]);
      setHasSearched(false);
      setIsSearching(false);
      setSearchError(null);
      setResultsExpanded(true);
    }
  }, [visible, level]);

  const runSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchError('Escriba un término de búsqueda.');
      setHits([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setHasSearched(true);
    setResultsExpanded(true);

    try {
      const { hits: found } = await searchHierarchy(level, trimmed, structure);
      setHits(found);
      if (found.length === 0) {
        setSearchError('No se encontraron coincidencias.');
      }
    } catch {
      setHits([]);
      setSearchError('No se pudo buscar en la jerarquía local.');
    } finally {
      setIsSearching(false);
    }
  }, [level, query, structure]);

  const handlePick = (hit: HierarchySearchHit) => {
    onSelect(hit.path, hit);
    onClose();
  };

  const placeholder =
    level === 'cliente'
      ? 'Nombre del cliente'
      : 'Nombre o código';

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <ThemedView style={styles.card}>
          <View style={styles.header}>
            <ThemedText style={styles.title}>{HIERARCHY_SEARCH_LEVEL_LABELS[level]}</ThemedText>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
          >
            <ThemedText style={styles.label}>Buscar</ThemedText>
            <View style={styles.searchRow}>
              <TextInput
                style={styles.input}
                value={query}
                onChangeText={setQuery}
                placeholder={placeholder}
                placeholderTextColor="#999"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                onSubmitEditing={() => void runSearch()}
              />
              <TouchableOpacity
                style={[styles.searchBtn, isSearching && styles.searchBtnDisabled]}
                onPress={() => void runSearch()}
                disabled={isSearching}
                activeOpacity={0.85}
              >
                {isSearching ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="search" size={22} color="#fff" />
                )}
              </TouchableOpacity>
            </View>

            {isSearching ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#007AFF" />
                <Text style={styles.loadingText}>Buscando en la jerarquía…</Text>
              </View>
            ) : null}

            {searchError && hasSearched && !isSearching ? (
              <Text style={styles.errorText}>{searchError}</Text>
            ) : null}

            {hasSearched && hits.length > 0 && !isSearching ? (
              <View style={styles.resultsBlock}>
                <TouchableOpacity
                  style={styles.resultsHeader}
                  onPress={() => setResultsExpanded((p) => !p)}
                  activeOpacity={0.85}
                >
                  <ThemedText style={styles.resultsHeaderText}>
                    Resultados ({hits.length})
                  </ThemedText>
                  <Ionicons
                    name={resultsExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color="#007AFF"
                  />
                </TouchableOpacity>

                {resultsExpanded ? (
                  <ThemedView style={styles.resultList}>
                    {hits.map((hit) => (
                      <TouchableOpacity
                        key={`${hit.path.empresaId}-${hit.id}-${hit.subtitle}`}
                        style={styles.resultItem}
                        onPress={() => handlePick(hit)}
                        activeOpacity={0.85}
                      >
                        <ThemedText style={styles.resultTitle}>{hit.title}</ThemedText>
                        <ThemedText style={styles.resultSubtitle}>{hit.subtitle}</ThemedText>
                      </TouchableOpacity>
                    ))}
                  </ThemedView>
                ) : null}
              </View>
            ) : null}
          </ScrollView>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 820,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    maxHeight: '88%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
  },
  body: {
    maxHeight: 520,
  },
  bodyContent: {
    padding: 14,
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#000',
    backgroundColor: '#fff',
  },
  searchBtn: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 48,
  },
  searchBtnDisabled: {
    opacity: 0.7,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  loadingText: {
    fontSize: 13,
    color: '#555',
  },
  errorText: {
    fontSize: 13,
    color: '#B00020',
    marginTop: 4,
  },
  resultsBlock: {
    marginTop: 8,
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  resultsHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#007AFF',
  },
  resultList: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  resultItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
    backgroundColor: '#FFFFFF',
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
  },
  resultSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
});
