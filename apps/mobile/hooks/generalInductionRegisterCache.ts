import AsyncStorage from '@react-native-async-storage/async-storage';
import { persistSignatureRef, hydrateSignatureRef, reconcileSignatureFieldAfterSync, deleteSignatureLocalRef } from './fileStorage';

export const GIR_RECORDS_CACHE_KEY = 'general_induction_register_records_cache';

function parseGirPersonasJson(jsonStr: any): any[] {
  if (typeof jsonStr !== 'string') return Array.isArray(jsonStr) ? jsonStr : [];
  try {
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Convierte `firma` (data URI dibujado) de cada persona de la lista (colaboradores/capacitadores,
 * JSON-string) en una referencia local a expo-files, para no guardar base64 en
 * `general_induction_register_records_cache`/`evaluations_actions`. `previousJsonStr` (la misma
 * lista tal como estaba antes de este cambio) permite borrar el archivo huérfano cuando una firma
 * se reemplazó, emparejando por `id_local`.
 */
export async function localizeGirPersonasFirmas(jsonStr: any, previousJsonStr: any, prefix: string): Promise<any> {
  const parsed = parseGirPersonasJson(jsonStr);
  if (parsed.length === 0) return jsonStr;
  const previous = parseGirPersonasJson(previousJsonStr);
  const prevById = new Map(previous.map((p: any) => [String(p?.id_local ?? ''), p]));
  const next = await Promise.all(
    parsed.map(async (p: any) => {
      if (!p || typeof p !== 'object') return p;
      const previousRef = prevById.get(String(p.id_local ?? ''))?.firma ?? null;
      const nextRef = await persistSignatureRef({ value: p.firma, previousRef, prefix });
      return { ...p, firma: nextRef };
    })
  );
  return JSON.stringify(next);
}

/** Inversa de `localizeGirPersonasFirmas`: referencias locales -> data URI listo para `getBase64Only`. */
export async function hydrateGirPersonasFirmas(jsonStr: any): Promise<any> {
  const parsed = parseGirPersonasJson(jsonStr);
  if (parsed.length === 0) return jsonStr;
  const next = await Promise.all(
    parsed.map(async (p: any) => {
      if (!p || typeof p !== 'object' || !p.firma) return p;
      const hydrated = await hydrateSignatureRef(p.firma);
      return { ...p, firma: hydrated ?? p.firma };
    })
  );
  return JSON.stringify(next);
}

/**
 * Igual que `hydrateGirPersonasFirmas`, pero además retira el prefijo `data:...;base64,` de cada
 * firma (el endpoint espera base64 puro, igual que `getBase64Only` en la pantalla).
 */
export async function hydrateGirPersonasFirmasForApi(jsonStr: any): Promise<any> {
  const parsed = parseGirPersonasJson(jsonStr);
  if (parsed.length === 0) return jsonStr;
  const next = await Promise.all(
    parsed.map(async (p: any) => {
      if (!p || typeof p !== 'object' || !p.firma) return p;
      const hydrated = (await hydrateSignatureRef(p.firma)) ?? p.firma;
      const s = String(hydrated);
      const bare = s.startsWith('data:') ? (s.split(',').slice(1).join(',') || null) : s;
      return { ...p, firma: bare };
    })
  );
  return JSON.stringify(next);
}

/**
 * Tras sincronizar: reconcilia `firma` de cada persona contra la respuesta del servidor
 * (`serverJsonStr`), en vez de conservar ciegamente el valor local previo a la sincronización.
 * Empareja por `id_local`.
 */
export async function reconcileGirPersonasFirmasAfterSync(
  serverJsonStr: any,
  previousJsonStr: any,
  prefix: string
): Promise<any> {
  const serverParsed = parseGirPersonasJson(serverJsonStr);
  if (serverParsed.length === 0) return previousJsonStr ?? serverJsonStr;
  const previous = parseGirPersonasJson(previousJsonStr);
  const prevById = new Map(previous.map((p: any) => [String(p?.id_local ?? ''), p]));
  const next = await Promise.all(
    serverParsed.map(async (p: any, idx: number) => {
      if (!p || typeof p !== 'object') return p;
      const prev = prevById.get(String(p.id_local ?? '')) ?? previous[idx];
      const firma = await reconcileSignatureFieldAfterSync(p.firma, prev?.firma ?? null, prefix);
      return { ...p, firma: firma !== undefined ? firma : p.firma };
    })
  );
  return JSON.stringify(next);
}

export function girRecordSucursalId(r: any): number {
  return Number(r?.corpo_id ?? r?.sucursal_id ?? 0);
}

/** Lee todos los registros GIR del almacén dedicado; migra una vez desde evaluations_cache si está vacío. */
export async function readAllGeneralInductionRegisterRecords(): Promise<any[]> {
  try {
    const raw = await AsyncStorage.getItem(GIR_RECORDS_CACHE_KEY);
    let dedicated: any[] = [];
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) dedicated = parsed;
      } catch {
        dedicated = [];
      }
    }
    if (dedicated.length > 0) return dedicated;

    const ev = await AsyncStorage.getItem('evaluations_cache');
    if (!ev) return [];
    let cache: unknown;
    try {
      cache = JSON.parse(ev);
    } catch {
      return [];
    }
    if (!Array.isArray(cache)) return [];
    const gir = cache.filter((i: any) => i.type === 'general_induction_register');
    if (gir.length > 0) {
      await AsyncStorage.setItem(GIR_RECORDS_CACHE_KEY, JSON.stringify(gir));
    }
    return gir;
  } catch {
    return [];
  }
}

/** Persiste el array completo de GIR y refleja en evaluations_cache (sin tocar otros tipos). */
export async function writeAllGeneralInductionRegisterRecords(records: any[]): Promise<void> {
  await AsyncStorage.setItem(GIR_RECORDS_CACHE_KEY, JSON.stringify(records));
  let rest: any[] = [];
  try {
    const ev = await AsyncStorage.getItem('evaluations_cache');
    if (ev) {
      const cache = JSON.parse(ev);
      rest = Array.isArray(cache) ? cache.filter((i: any) => i.type !== 'general_induction_register') : [];
    }
  } catch {
    rest = [];
  }
  const stamped = records.map((r) => ({ ...r, type: 'general_induction_register' }));
  await AsyncStorage.setItem('evaluations_cache', JSON.stringify([...rest, ...stamped]));
}

/** Reemplaza en caché los registros GIR de una sucursal por `mergedForSid`; mantiene el resto de sucursales. */
export async function replaceGeneralInductionRecordsForCorpo(
  sucursalId: number,
  mergedForSid: any[]
): Promise<void> {
  const sid = Number(sucursalId);
  const all = await readAllGeneralInductionRegisterRecords();
  const others = all.filter((r) => girRecordSucursalId(r) !== sid);
  await writeAllGeneralInductionRegisterRecords([...others, ...mergedForSid]);
}

/** Quita una imagen adjunta del registro en caché (por id de fila de imagen en BD). */
export async function removeImageFromGeneralInductionCache(registroKey: string, imageId: number): Promise<void> {
  const iid = Number(imageId);
  if (!Number.isFinite(iid)) return;
  const all = await readAllGeneralInductionRegisterRecords();
  const next = all.map((r) => {
    const match =
      String(r.id) === String(registroKey) || String(r.id_local) === String(registroKey);
    if (!match) return r;
    const imgs = Array.isArray(r.images) ? r.images.filter((im: any) => Number(im?.id) !== iid) : [];
    return { ...r, images: imgs };
  });
  await writeAllGeneralInductionRegisterRecords(next);
}

/** Fusiona respuesta del servidor tras crear o actualizar (mantiene id_local si existe). */
export async function upsertGeneralInductionRegisterFromServerData(opts: {
  idLocal: string | null;
  serverRow: any;
}): Promise<void> {
  const { idLocal, serverRow } = opts;
  if (!serverRow) return;
  const plain = { ...serverRow };
  delete plain.c_imagenes_registro_induccion_general;
  delete plain.e_estructura_empresa;
  delete plain.e_estructura_cliente;
  delete plain.e_estructura_sucursal;

  const images = Array.isArray(serverRow.images)
    ? serverRow.images
    : (serverRow.c_imagenes_registro_induccion_general || []).map((img: any) => ({
        id: img.id,
        name: img.name,
        extension: img.extension || 'jpg',
        url: '',
      }));

  const all = await readAllGeneralInductionRegisterRecords();
  const idx = all.findIndex(
    (r) =>
      (idLocal != null && idLocal !== '' && String(r.id_local) === String(idLocal)) ||
      (idLocal != null && idLocal !== '' && String(r.id) === String(idLocal)) ||
      (plain.id != null && (r.id === plain.id || String(r.id) === String(plain.id)))
  );
  const previousRecord = idx >= 0 ? all[idx] : null;

  // El servidor devuelve las firmas en base64: se reconcilian contra las referencias locales ya
  // persistidas para que expo-files siempre corresponda al elemento ya sincronizado en cache.
  const reconciledColaboradores = await reconcileGirPersonasFirmasAfterSync(
    plain.colaboradores,
    previousRecord?.colaboradores,
    'gir_colaborador_firma'
  );
  const reconciledCapacitadores = await reconcileGirPersonasFirmasAfterSync(
    plain.capacitadores,
    previousRecord?.capacitadores,
    'gir_capacitador_firma'
  );

  const merged = {
    ...plain,
    images,
    colaboradores: reconciledColaboradores,
    capacitadores: reconciledCapacitadores,
    id: plain.id,
    id_local: idx >= 0 ? all[idx].id_local : idLocal || String(plain.id),
    synced: true,
    type: 'general_induction_register',
    corpo_id: Number(plain.corpo_id ?? plain.sucursal_id ?? 0),
  };

  const idLocalKey = idLocal != null && idLocal !== '' ? String(idLocal) : null;
  const serverIdKey = plain.id != null && plain.id !== '' ? String(plain.id) : null;

  const next = all.filter((r) => {
    if (idLocalKey && String(r.id_local || '') === idLocalKey) return false;
    if (idLocalKey && String(r.id || '') === idLocalKey) return false;
    if (serverIdKey && String(r.id || '') === serverIdKey) return false;
    return true;
  });
  next.push(merged);
  await writeAllGeneralInductionRegisterRecords(next);
}

/** Borra los archivos locales de las firmas de cada persona de una lista (colaboradores/capacitadores). */
export async function deleteGirPersonasFirmasLocalRefs(jsonStr: any): Promise<void> {
  const parsed = parseGirPersonasJson(jsonStr);
  await Promise.all(parsed.map((p: any) => (p?.firma ? deleteSignatureLocalRef(p.firma) : Promise.resolve())));
}

export async function removeGeneralInductionRegisterFromCacheByKeys(recordId: string, idLocal?: string | null): Promise<void> {
  const all = await readAllGeneralInductionRegisterRecords();
  const removed = all.find(
    (r) =>
      String(r.id) === String(recordId) ||
      String(r.id_local) === String(recordId) ||
      (idLocal != null && idLocal !== '' && String(r.id_local) === String(idLocal))
  );
  if (removed) {
    await deleteGirPersonasFirmasLocalRefs(removed.colaboradores);
    await deleteGirPersonasFirmasLocalRefs(removed.capacitadores);
  }
  await writeAllGeneralInductionRegisterRecords(
    all.filter(
      (r) =>
        !(
          String(r.id) === String(recordId) ||
          String(r.id_local) === String(recordId) ||
          (idLocal != null && idLocal !== '' && String(r.id_local) === String(idLocal))
        )
    )
  );
}
