import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PendingAction {
    id: string;
    type?: string;
    action?: string;
    [key: string]: any;
}

export interface PendingSyncActions {
    [storageKey: string]: PendingAction[];
}

/**
 * Obtiene todas las variables AsyncStorage que terminan en "_actions"
 * y que contienen acciones pendientes de sincronización
 */
export async function getPendingSyncActions(): Promise<PendingSyncActions> {
    const result: PendingSyncActions = {};

    // Lista de todas las variables AsyncStorage que terminan en "_actions"
    const actionStorageKeys = [
        'job_manuals_actions',
        'visitors_actions',
        'vehicles_actions',
        'bitacora_vehiculo_detenido_actions',
        'llaves_actions',
        'movimientos_llaves_actions',
        'llaveros_actions',
        'movimientos_llaveros_actions',
        'movimientos_activos_mantenimiento_actions',
        'articulo_mantenimiento_actions',
        'movimientos_articulos_mantenimiento_actions',
        'activo_mantenimiento_actions',
        'documentos_entregados_actions',
        'apreciacion_vulnerabilidad_actions',
        'notifications_actions',
        'lunchtime_actions',
        'notes_actions',
        'activities_actions',
        'evaluations_actions',
        'checklist_supervision_actions',
    ];

    // Obtener todas las acciones pendientes
    for (const key of actionStorageKeys) {
        try {
            const actionsStr = await AsyncStorage.getItem(key);
            if (actionsStr) {
                const actions = JSON.parse(actionsStr);
                if (Array.isArray(actions) && actions.length > 0) {
                    result[key] = actions;
                }
            }
        } catch (error) {
            console.error(`Error reading ${key}:`, error);
        }
    }

    return result;
}

/** Identificador estable para listar/eliminar (checklist create no tiene `id`). */
export function pendingActionRowId(storageKey: string, action: any, index: number): string {
    if (storageKey === 'checklist_supervision_actions' && action && typeof action === 'object') {
        return `checklist|${action.type || ''}|${action.id_local || ''}|${action.id ?? ''}`;
    }
    if (action?.id != null && action.id !== '') return String(action.id);
    if (action?.id_local) return String(action.id_local);
    return `${storageKey}-${index}`;
}

function checklistActionMatchesMarker(action: any, marker: string): boolean {
    if (!marker.startsWith('checklist|')) return false;
    const parts = marker.split('|');
    const type = parts[1] ?? '';
    const id_local = parts[2] ?? '';
    const id = parts[3] ?? '';
    return (
        String(action?.type || '') === type &&
        String(action?.id_local || '') === id_local &&
        String(action?.id ?? '') === id
    );
}

/**
 * Elimina una acción específica de su variable AsyncStorage
 */
export async function removePendingAction(
    storageKey: string,
    actionId: string
): Promise<boolean> {
    try {
        const actionsStr = await AsyncStorage.getItem(storageKey);
        if (!actionsStr) return false;

        const actions = JSON.parse(actionsStr);
        if (!Array.isArray(actions)) return false;

        const updatedActions = actions.filter((action: any) => {
            if (storageKey === 'checklist_supervision_actions' && actionId.startsWith('checklist|')) {
                return !checklistActionMatchesMarker(action, actionId);
            }
            return String(action.id) !== String(actionId);
        });

        if (updatedActions.length === actions.length) return false;

        // Si no quedan acciones, eliminar la clave, sino actualizarla
        if (updatedActions.length === 0) {
            await AsyncStorage.removeItem(storageKey);
        } else {
            await AsyncStorage.setItem(storageKey, JSON.stringify(updatedActions));
        }

        return true;
    } catch (error) {
        console.error(`Error removing action from ${storageKey}:`, error);
        return false;
    }
}

