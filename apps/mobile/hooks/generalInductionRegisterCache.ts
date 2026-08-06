import AsyncStorage from '@react-native-async-storage/async-storage';

export const GIR_RECORDS_CACHE_KEY = 'general_induction_register_records_cache';

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

  const merged = {
    ...plain,
    images,
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

export async function removeGeneralInductionRegisterFromCacheByKeys(recordId: string, idLocal?: string | null): Promise<void> {
  const all = await readAllGeneralInductionRegisterRecords();
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
