/**
 * Clave de idempotencia de una acción de la cola (issues #172 y #181): la MISMA acción reintentada (porque se agotó el plazo con la respuesta perdida, o
 * porque la cola se reprocesó) produce SIEMPRE la misma clave, y dos acciones distintas nunca la comparten. Viaja en `Idempotency-Key`; el servidor devuelve
 * el resultado ya guardado en lugar de repetir el efecto (`apps/server/utils/idempotency.ts`). Módulo puro: sin React Native ni Expo.
 *
 * Se arma con lo que identifica a la acción (su tipo, el registro y la hora de la acción, que se fija al encolar), no con un valor aleatorio generado al enviar,
 * porque entonces cada reintento tendría una clave nueva y no deduplicaría nada.
 */

const MIN_LEN = 16;
const MAX_LEN = 128;

/** FNV-1a de 32 bits en hexadecimal: no es criptográfico, solo da un sufijo estable para acortar o completar. */
const fnv = (text: string): string => {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
};

const clean = (part: string | number): string => String(part).trim().replace(/[^A-Za-z0-9._:-]+/g, "_");

export function actionIdempotencyKey(kind: string, ...parts: Array<string | number | null | undefined>): string {
    const bits = [kind, ...parts.map((p) => (p === null || p === undefined ? "" : p))].map(clean);
    let key = bits.join("-");
    if (key.length < MIN_LEN) key = `${key}-${fnv(key)}${fnv(key + "~")}`.slice(0, MAX_LEN);
    if (key.length > MAX_LEN) key = `${key.slice(0, MAX_LEN - 17)}-${fnv(key)}${fnv(key + "~")}`;
    return key;
}
