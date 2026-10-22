import { useCallback, useRef, useState } from 'react';
import { loadMainStructureTreeMerged } from '@/hooks/bitacoraMainStructureCache';

/**
 * Jerarquía local: una lectura por sesión de pantalla (fragmentos + fallback monolito).
 * No escribe en disco; reutiliza el árbol en memoria para filtros/listas.
 */
export function useLocalMainStructureTree<T extends unknown[] = unknown[]>() {
  const [structure, setStructure] = useState<T>([] as unknown as T);
  const structureRef = useRef<T>([] as unknown as T);
  const [isStructureLoading, setIsStructureLoading] = useState(false);
  const loadedOnceRef = useRef(false);

  const loadMainStructure = useCallback(async (options?: { force?: boolean }): Promise<T> => {
    if (!options?.force && loadedOnceRef.current && structureRef.current.length > 0) {
      return structureRef.current;
    }
    setIsStructureLoading(true);
    try {
      const tree = await loadMainStructureTreeMerged();
      const next = (Array.isArray(tree) ? tree : []) as T;
      structureRef.current = next;
      loadedOnceRef.current = true;
      setStructure(next);
      return next;
    } catch {
      structureRef.current = [] as unknown as T;
      setStructure([] as unknown as T);
      return [] as unknown as T;
    } finally {
      setIsStructureLoading(false);
    }
  }, []);

  const getStructureTree = useCallback((): T => {
    if (structureRef.current.length > 0) return structureRef.current;
    return (Array.isArray(structure) && structure.length > 0 ? structure : []) as T;
  }, [structure]);

  const invalidateStructureSession = useCallback(() => {
    loadedOnceRef.current = false;
    structureRef.current = [] as unknown as T;
    setStructure([] as unknown as T);
  }, []);

  return {
    structure,
    setStructure,
    structureRef,
    isStructureLoading,
    loadMainStructure,
    getStructureTree,
    invalidateStructureSession,
  };
}
