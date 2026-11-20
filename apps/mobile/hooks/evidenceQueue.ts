/**
 * Evidencia de las acciones encoladas sin conexión (issue #152): parte PURA, sin dependencias de React Native para poder probarla en Node.
 *
 * Problema: las cabeceras `X-Evidence-*` se calculan al ENVIAR la petición. Una acción hecha sin internet a las 8:00 y sincronizada a las
 * 15:00 quedaba con la ubicación y la hora de las 15:00. Solución en dos puntos únicos, sin tocar cada pantalla ni cada ciclo de sincronización:
 *
 *  1. Al GUARDAR una cola (`*_actions` en AsyncStorage, ver `installEvidenceQueue.ts`) cada acción nueva recibe un sello con la ubicación y la
 *     hora de ese momento, dentro de su cuerpo (`payload` / `requestData` / `data` / `body`) bajo la clave `__evidencia`.
 *  2. Al REENVIAR, el `fetch` global (`installEvidenceFetch.ts`) saca el sello del cuerpo JSON, lo quita (el servidor no debe verlo) y manda
 *     sus valores como cabeceras `X-Evidence-*` en lugar de las del momento.
 *
 * Las acciones que ya estaban en la cola antes de esta versión no se sellan (se mandarían con una hora que no es la de captura): siguen
 * como hasta ahora. Las que no tienen cuerpo objeto (p. ej. `attendance_actions`) tampoco.
 */

export const EVIDENCE_STAMP_KEY = '__evidencia';

/** Dónde puede llevar una acción encolada el objeto que luego se envía como cuerpo de la petición. */
const BODY_CONTAINERS = ['payload', 'requestData', 'data', 'body'] as const;

/** Sello compacto: coordenadas como texto (como viajan en las cabeceras), hora en ms (`getHoraAccion`) y permiso negado. */
export type EvidenceStamp = { lat?: string; lng?: string; at: string; perm?: 'denied' };

export function isQueueKey(key: string): boolean {
  return /_actions$/.test(key);
}

/** Cabeceras `X-Evidence-*` del momento → sello (null si no traen ni la hora). */
export function stampFromHeaders(headers: Record<string, string> | null | undefined): EvidenceStamp | null {
  if (!headers) return null;
  const at = Number(headers['X-Evidence-At']);
  if (!Number.isFinite(at) || at <= 0) return null;
  const stamp: EvidenceStamp = { at: String(Math.round(at)) };
  if (headers['X-Evidence-Lat'] && headers['X-Evidence-Lng']) {
    stamp.lat = headers['X-Evidence-Lat'];
    stamp.lng = headers['X-Evidence-Lng'];
  }
  if (String(headers['X-Evidence-Perm'] ?? '').toLowerCase() === 'denied') stamp.perm = 'denied';
  return stamp;
}

/** Sello (venga de donde venga) → cabeceras; null si no es válido. Nunca confía en el formato: viene de un almacenamiento editable. */
export function headersFromStamp(raw: unknown): Record<string, string> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const s = raw as Record<string, unknown>;
  const at = Number(s.at);
  if (!Number.isFinite(at) || at <= 0) return null;
  const out: Record<string, string> = { 'X-Evidence-At': String(Math.round(at)) };
  const lat = Number(s.lat);
  const lng = Number(s.lng);
  if (s.lat != null && s.lng != null && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
    out['X-Evidence-Lat'] = String(lat);
    out['X-Evidence-Lng'] = String(lng);
  } else if (s.perm === 'denied') {
    out['X-Evidence-Perm'] = 'denied';
  }
  return out;
}

type QueueElement = Record<string, any>;

function bodyContainer(el: unknown): (typeof BODY_CONTAINERS)[number] | null {
  if (!el || typeof el !== 'object' || Array.isArray(el)) return null;
  for (const c of BODY_CONTAINERS) {
    const v = (el as QueueElement)[c];
    if (v && typeof v === 'object' && !Array.isArray(v)) return c;
  }
  return null;
}

/** Huella de una acción sin su sello: sirve para reconocer, entre dos versiones de la cola, la misma acción. */
function fingerprint(el: QueueElement, container: string): string {
  const { [EVIDENCE_STAMP_KEY]: _omit, ...body } = el[container] as QueueElement;
  return JSON.stringify({ ...el, [container]: body });
}

/**
 * Sella las acciones NUEVAS de una cola que se va a guardar. `next` es el JSON que se guarda y `loadPrev` lee el que había (solo se llama si hay
 * acciones sin sello); devuelve `next` tal cual si no hay nada que sellar. Una acción que ya estaba en `prev` (misma huella) conserva su sello, o su ausencia si era anterior a esta versión.
 * `makeStamp` se llama una sola vez por guardado, solo si hay acciones nuevas.
 */
export async function stampQueueJson(next: string, loadPrev: () => Promise<string | null>, makeStamp: () => Promise<EvidenceStamp | null>): Promise<string> {
  let arr: unknown;
  try {
    arr = JSON.parse(next);
  } catch {
    return next;
  }
  if (!Array.isArray(arr)) return next;
  const pending = arr.filter((el) => {
    const c = bodyContainer(el);
    return c !== null && (el as QueueElement)[c][EVIDENCE_STAMP_KEY] == null;
  }) as QueueElement[];
  if (!pending.length) return next;

  const before = new Map<string, unknown>();
  const prev = await loadPrev().catch(() => null);
  if (prev) {
    try {
      const old = JSON.parse(prev);
      if (Array.isArray(old)) {
        for (const el of old) {
          const c = bodyContainer(el);
          if (c) before.set(fingerprint(el, c), (el as QueueElement)[c][EVIDENCE_STAMP_KEY] ?? null);
        }
      }
    } catch {
      /* la versión anterior no se puede leer: todas se tratan como nuevas */
    }
  }

  let fresh: EvidenceStamp | null | undefined;
  let changed = false;
  for (const el of pending) {
    const c = bodyContainer(el)!;
    const fp = fingerprint(el, c);
    if (before.has(fp)) {
      const kept = before.get(fp);
      if (kept != null) {
        el[c][EVIDENCE_STAMP_KEY] = kept;
        changed = true;
      }
      continue; // sin sello previo = acción anterior a esta versión: se queda como está
    }
    if (fresh === undefined) fresh = await makeStamp();
    if (fresh) {
      el[c][EVIDENCE_STAMP_KEY] = fresh;
      changed = true;
    }
  }
  return changed ? JSON.stringify(arr) : next;
}

const MAX_DEPTH = 4;

function strip(node: unknown, depth: number, found: { stamp: unknown }): void {
  if (!node || typeof node !== 'object' || depth > MAX_DEPTH) return;
  if (Array.isArray(node)) {
    for (const child of node) strip(child, depth + 1, found);
    return;
  }
  const obj = node as Record<string, unknown>;
  if (EVIDENCE_STAMP_KEY in obj) {
    if (found.stamp === undefined) found.stamp = obj[EVIDENCE_STAMP_KEY];
    delete obj[EVIDENCE_STAMP_KEY];
  }
  for (const child of Object.values(obj)) strip(child, depth + 1, found);
}

/**
 * Cuerpo JSON de una petición → su sello (si lo trae) y el cuerpo SIN el sello. Si el cuerpo no es JSON o no lleva sello se devuelve igual.
 * La búsqueda de texto evita analizar los cuerpos grandes (firmas, imágenes) que no llevan sello.
 */
export function takeStampFromBody(body: string): { stamp: unknown; body: string } {
  if (!body.includes(`"${EVIDENCE_STAMP_KEY}"`)) return { stamp: undefined, body };
  try {
    const parsed = JSON.parse(body);
    const found: { stamp: unknown } = { stamp: undefined };
    strip(parsed, 0, found);
    return { stamp: found.stamp, body: JSON.stringify(parsed) };
  } catch {
    return { stamp: undefined, body };
  }
}
