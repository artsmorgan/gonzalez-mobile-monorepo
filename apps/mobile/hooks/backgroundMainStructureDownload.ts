import { Alert } from 'react-native';
import * as Network from 'expo-network';

import { eventBus } from '@/hooks/eventBus';
import {
  regenerateAndDownloadMainStructure,
  type MainStructureModules,
  type MainStructureScope,
} from '@/hooks/mainStructureApi';

export const HIERARCHY_UPDATE_OVERLAY_SHOW_EVENT = 'hierarchyUpdateOverlayShow' as const;
export const HIERARCHY_UPDATE_OVERLAY_HIDE_EVENT = 'hierarchyUpdateOverlayHide' as const;

type AuthHandlers = {
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<unknown>;
};

type MarcaLike = {
  empresa?: { id?: number | null } | null;
  cliente?: { id?: number | null } | null;
  roleDivision?: { division?: { id?: number | null } | null } | null;
  contrato?: { id?: number | null } | null;
  corpo?: { id?: number | null } | null;
  puesto?: { id?: number | null } | null;
};

const HIERARCHY_DOWNLOAD_GLOBAL_KEY = '__MONITOREAPP_HIERARCHY_DOWNLOAD_SLOT__' as const;
type HierarchyDownloadSlot = { inFlight: Promise<void> | null };

function getHierarchyDownloadSlot(): HierarchyDownloadSlot {
  const g = globalThis as unknown as Record<string, HierarchyDownloadSlot>;
  if (!g[HIERARCHY_DOWNLOAD_GLOBAL_KEY]) {
    g[HIERARCHY_DOWNLOAD_GLOBAL_KEY] = { inFlight: null };
  }
  return g[HIERARCHY_DOWNLOAD_GLOBAL_KEY];
}

const DEFAULT_MODULES: MainStructureModules = {
  estructura: true,
  vehiculos: true,
  llaves: true,
  mantenimientos: true,
};

async function hasInternetConnection(): Promise<boolean> {
  const networkState = await Network.getNetworkStateAsync();
  return networkState.isConnected === true && networkState.isInternetReachable === true;
}

export function buildMainStructureScopeFromMarca(marca: MarcaLike | null | undefined): MainStructureScope {
  return {
    empresaId: marca?.empresa?.id ?? null,
    clienteId: marca?.cliente?.id ?? null,
    divisionId: marca?.roleDivision?.division?.id ?? null,
    contratoId: marca?.contrato?.id ?? null,
    sucursalId: marca?.corpo?.id ?? null,
    puestoId: marca?.puesto?.id ?? null,
  };
}

/**
 * Descarga/regenera la jerarquía en segundo plano (global, independiente de la pantalla).
 * Muestra overlay vía eventBus; cerrar la X solo oculta el aviso, no cancela la descarga.
 */
export function requestBackgroundMainStructureDownload(
  auth: AuthHandlers,
  marca: MarcaLike | null | undefined,
): void {
  const slot = getHierarchyDownloadSlot();
  if (slot.inFlight != null) {
    console.log('[hierarchyDownload] Omitido: ya hay una descarga en curso');
    return;
  }

  slot.inFlight = (async () => {
    let succeeded = false;
    try {
      if (!(await hasInternetConnection())) {
        console.log('[hierarchyDownload] Sin conexión, se omite la actualización de jerarquía');
        return;
      }

      eventBus.emit(HIERARCHY_UPDATE_OVERLAY_SHOW_EVENT);

      const scope = buildMainStructureScopeFromMarca(marca);
      await regenerateAndDownloadMainStructure(auth, {
        scope,
        modules: DEFAULT_MODULES,
        mergeWithExisting: true,
      });
      succeeded = true;
    } catch (error) {
      console.error('[hierarchyDownload] Error actualizando jerarquía:', error);
    } finally {
      eventBus.emit(HIERARCHY_UPDATE_OVERLAY_HIDE_EVENT);
      slot.inFlight = null;
      if (succeeded) {
        Alert.alert('Éxito', 'Se ha actualizado la jerarquía');
      }
    }
  })();
}
