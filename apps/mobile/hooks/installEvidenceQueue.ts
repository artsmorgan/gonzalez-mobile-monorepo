/**
 * Sella con la ubicación y la hora del momento cada acción que se guarda en una cola sin conexión (`*_actions`, issue #152).
 * La lógica está en `evidenceQueue.ts`; aquí solo se conecta con `AsyncStorage`. Se importa en `index.js` DESPUÉS de `installSecureStorage`
 * (envuelve los métodos que ese módulo ya reemplazó) y `installEvidenceFetch` es quien convierte el sello en cabeceras al reenviar.
 * Nunca hace fallar el guardado: ante cualquier error se guarda la cola tal como venía.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { captureEvidenceStamp } from './evidenceCapture';
import { EVIDENCE_STAMP_KEY, isQueueKey, stampQueueJson, takeStampFromBody } from './evidenceQueue';

type Storage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  multiSet: (pairs: readonly [string, string][]) => Promise<void>;
};

const target = AsyncStorage as unknown as Storage & { __evidenceQueue?: boolean };

export function installEvidenceQueue(): void {
  if (target.__evidenceQueue) return;
  target.__evidenceQueue = true;
  const originalGet = target.getItem.bind(target);
  const originalSet = target.setItem.bind(target);
  const originalMultiSet = target.multiSet.bind(target);

  const stamp = async (key: string, value: string): Promise<string> => {
    if (typeof value !== 'string' || value.length < 3) return value;
    try {
      if (isQueueKey(key)) return await stampQueueJson(value, () => originalGet(key), captureEvidenceStamp);
      // Fuera de las colas el sello no debe quedar: una fila de caché armada con el cuerpo de la acción lo reenviaría en una edición posterior
      // con la hora de la creación. La comprobación de texto evita analizar lo que no lo lleva.
      return value.includes(`"${EVIDENCE_STAMP_KEY}"`) ? takeStampFromBody(value).body : value;
    } catch {
      return value;
    }
  };

  target.setItem = async (key: string, value: string) => originalSet(key, await stamp(key, value));
  target.multiSet = async (pairs: readonly [string, string][]) =>
    originalMultiSet(await Promise.all(pairs.map(async ([k, v]) => [k, await stamp(k, v)] as [string, string])));
}

installEvidenceQueue();
