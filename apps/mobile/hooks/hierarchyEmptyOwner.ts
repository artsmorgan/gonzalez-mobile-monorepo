/**
 * Quién muestra el botón «Descargar jerarquía». Módulo PURO (sin React Native) para probarlo en Node.
 *
 * Una pantalla puede tener a la vez el selector del FILTRO y el del FORMULARIO (o un formulario y su ventana de edición). Sin jerarquía descargada
 * cada selector mostraba su propio botón y se veía repetido. Ahora hay un botón por LUGAR: uno en el filtro y uno en el formulario. Dentro de
 * un mismo lugar solo lo muestra el selector que se montó más recientemente (el de la ventana o sección que la persona abrió en último lugar);
 * si ese desaparece, el botón pasa al anterior.
 */
export type HierarchyGroup = 'filtro' | 'formulario';

export type OwnerStore = {
  /** Registra un selector sin jerarquía; devuelve la función que lo quita. */
  register: (id: string) => () => void;
  /** Id del selector que debe mostrar el botón (el último registrado), o null. */
  getOwner: () => string | null;
  subscribe: (listener: () => void) => () => void;
  /** Solo para pruebas. */
  size: () => number;
};

export function createOwnerStore(): OwnerStore {
  let stack: string[] = [];
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  return {
    register(id) {
      stack = [...stack.filter((x) => x !== id), id];
      emit();
      return () => {
        const before = stack.length;
        stack = stack.filter((x) => x !== id);
        if (stack.length !== before) emit();
      };
    },
    getOwner: () => (stack.length ? stack[stack.length - 1]! : null),
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    size: () => stack.length,
  };
}

/** Un almacén por lugar: el botón del filtro y el del formulario no se estorban. */
const stores: Record<HierarchyGroup, OwnerStore> = { filtro: createOwnerStore(), formulario: createOwnerStore() };

export function ownerStoreFor(group: HierarchyGroup | undefined): OwnerStore {
  return stores[group === 'filtro' ? 'filtro' : 'formulario'];
}

let counter = 0;
export function nextHierarchyEmptyId(): string {
  counter += 1;
  return `hierarchy-empty-${counter}`;
}
