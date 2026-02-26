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

        // Filtrar la acción a eliminar
        const updatedActions = actions.filter((action: any) => action.id !== actionId);

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

