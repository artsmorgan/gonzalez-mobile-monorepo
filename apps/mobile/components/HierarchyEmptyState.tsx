import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { useNavigation } from '@react-navigation/native';

import { loadMainStructureTreeMerged } from '@/hooks/bitacoraMainStructureCache';
import { nextHierarchyEmptyId, ownerStoreFor, type HierarchyGroup } from '@/hooks/hierarchyEmptyOwner';
import {
  HIERARCHY_FALLBACK_NOTICE,
  HIERARCHY_GO_QUESTION,
  HIERARCHY_GO_TITLE,
  HIERARCHY_MISSING_TEXT,
  hasHierarchy,
  hierarchyIdsAreEmpty,
  hierarchyIdsFromMarca,
  marcaHierarchySummary,
  type HierarchyIds,
} from '@/hooks/hierarchyFallback';

type Props = {
  /**
   * Si se pasa, cuando no hay jerarquía y la persona tiene una marca actual, se llama una vez con los datos de esa marca (empresa, cliente,
   * contrato, sucursal, puesto y plaza) para que el formulario los use y se avise a la persona. Solo para formularios que ENVÍAN datos: los
   * filtros no lo usan (llenarlos ocultaría registros).
   */
  onUseMarca?: (values: HierarchyIds) => void;
  /** Lo que el formulario ya tiene elegido: si hay algo (p. ej. al editar un registro) no se pisa con la marca. */
  currentValues?: Partial<Record<keyof HierarchyIds, unknown>> | null;
  /** Dónde está el selector: el botón se muestra una vez en el filtro y una vez en el formulario. Por defecto, formulario. */
  group?: HierarchyGroup;
};

/**
 * Lugar de los selectores de jerarquía cuando la jerarquía no está descargada: explica por qué, ofrece ir al módulo «Jerarquía» (pidiendo
 * confirmación) y, en los formularios que envían datos, usa los de la marca actual avisándolo.
 */
export default function HierarchyEmptyState({ onUseMarca, currentValues, group = 'formulario' }: Props) {
  const navigation = useNavigation<{ navigate: (name: string) => void }>();
  const [marca, setMarca] = useState<unknown>(null);
  const [usingMarca, setUsingMarca] = useState(false);
  /** null = todavía verificando; false = la jerarquía sí está descargada (la pantalla solo estaba cargándola). */
  const [missing, setMissing] = useState<boolean | null>(null);
  const applied = useRef(false);
  const onUseRef = useRef(onUseMarca);
  onUseRef.current = onUseMarca;
  const emptyNow = hierarchyIdsAreEmpty(currentValues);

  // Un botón por lugar: uno en el filtro y uno en el formulario. Dentro del mismo lugar lo muestra solo el último selector que se montó.
  const idRef = useRef<string>('');
  if (!idRef.current) idRef.current = nextHierarchyEmptyId();
  const store = ownerStoreFor(group);
  const ownerId = useSyncExternalStore(store.subscribe, store.getOwner, store.getOwner);
  useEffect(() => {
    if (missing !== true) return;
    return store.register(idRef.current);
  }, [missing, store]);
  const showButton = ownerId === idRef.current;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        // Antes de decir nada se confirma que de verdad no hay jerarquía descargada: la lista de la pantalla también está vacía mientras carga.
        const tree = await loadMainStructureTreeMerged().catch(() => []);
        if (cancelled) return;
        if (hasHierarchy(tree)) {
          setMissing(false);
          return;
        }
        setMissing(true);
        const raw = await AsyncStorage.getItem('current_marca');
        const parsed = raw ? JSON.parse(raw) : null;
        if (cancelled) return;
        setMarca(parsed);
        const ids = hierarchyIdsFromMarca(parsed);
        // Solo con un formulario que envía datos, con una marca que trae puesto o sucursal, y sin nada elegido todavía.
        if (!applied.current && onUseRef.current && ids && emptyNow) {
          applied.current = true;
          onUseRef.current(ids);
          setUsingMarca(true);
        }
      } catch {
        /* sin marca: solo se ofrece descargar la jerarquía */
      }
    })();
    return () => {
      cancelled = true;
    };
    // Se evalúa al mostrarse: los cambios posteriores del formulario no deben volver a llenarlo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goToHierarchy = () => {
    Alert.alert(HIERARCHY_GO_TITLE, HIERARCHY_GO_QUESTION, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Ir a Jerarquía', onPress: () => navigation.navigate('Jerarquia') },
    ]);
  };

  const resumen = marcaHierarchySummary(marca);

  if (missing === null || missing === false) {
    return (
      <View style={styles.box}>
        <Text style={styles.text}>Cargando estructura...</Text>
      </View>
    );
  }

  return (
    <View style={styles.box} accessibilityLiveRegion="polite">
      <Text style={styles.text}>{HIERARCHY_MISSING_TEXT}</Text>
      {usingMarca ? (
        <Text style={styles.notice}>
          {HIERARCHY_FALLBACK_NOTICE}
          {resumen ? `: ${resumen}.` : '.'}
        </Text>
      ) : null}
      {showButton ? (
        <TouchableOpacity style={styles.button} onPress={goToHierarchy} activeOpacity={0.85}>
          <Ionicons name="git-network" size={18} color="#FFFFFF" />
          <Text style={styles.buttonText}>{HIERARCHY_GO_TITLE}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, padding: 12, backgroundColor: '#F7F7F7', gap: 8 },
  text: { fontSize: 14, color: '#333' },
  notice: { fontSize: 13, color: '#8A5300', backgroundColor: '#FFF4E0', borderRadius: 6, padding: 8 },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#007AFF', borderRadius: 8, paddingVertical: 12 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
