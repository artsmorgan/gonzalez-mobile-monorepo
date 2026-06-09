import { getFile } from '@/hooks/fileStorage';

/** Metadatos persistidos en caché (sin base64). `name` = ruta en expo-file o nombre en servidor. */
export type ArticuloMantenimientoArchivoCacheRef = {
  id: number;
  id_local?: string;
  name: string;
  original_name: string;
  type: string;
  extension: string;
};

export type ArticuloMantenimientoFileType = 'image' | 'audio' | 'video' | 'document';

export type ArticuloMantenimientoPendingFile = {
  id: string;
  type: ArticuloMantenimientoFileType;
  name: string;
  extension: string;
  localFileName: string;
  mimeType?: string;
};

export type ArticuloMantenimientoRemoteFile = {
  id: number;
  type: string;
  extension: string;
  name: string;
  original_name?: string;
  id_local?: string;
};

export function remoteArchivosFromUltimoMantenimiento(ultimo: any): ArticuloMantenimientoRemoteFile[] {
  const list = ultimo?.c_archivos_adjuntos_articulo_mantenimiento;
  if (!Array.isArray(list)) return [];
  return list
    .filter((f: any) => f && (f.name || f.original_name))
    .map((f: any) => ({
      id: Number(f?.id ?? 0),
      type: String(f?.type ?? 'file'),
      extension: String(f?.extension ?? ''),
      name: String(f?.name ?? f?.original_name ?? ''),
      original_name: f?.original_name != null ? String(f.original_name) : undefined,
      id_local: f?.id_local != null ? String(f.id_local) : undefined,
    }));
}

function apiFileType(type: string): string {
  const t = String(type || '').trim().toLowerCase();
  if (t === 'document') return 'file';
  return t || 'file';
}

function cacheFileType(type: string): string {
  const t = apiFileType(type);
  return t === 'file' ? 'file' : t;
}

/** Convierte un adjunto pendiente a referencia de caché (solo expo-file). */
export function pendingFileToArchivoAdjuntoRef(
  f: ArticuloMantenimientoPendingFile,
): ArticuloMantenimientoArchivoCacheRef {
  return {
    id: 0,
    id_local: f.id,
    name: String(f.localFileName || '').trim(),
    original_name: String(f.name || 'archivo'),
    type: cacheFileType(f.type),
    extension: String(f.extension || 'dat').replace(/^\./, ''),
  };
}

/** Normaliza un adjunto existente eliminando base64 y conservando referencias. */
export function archivoAdjuntoRefForCache(entry: any): ArticuloMantenimientoArchivoCacheRef | null {
  if (entry == null || typeof entry !== 'object') return null;
  const localName =
    entry.localFileName != null && String(entry.localFileName).trim() !== ''
      ? String(entry.localFileName).trim()
      : entry.stored_file_name != null && String(entry.stored_file_name).trim() !== ''
        ? String(entry.stored_file_name).trim()
        : '';
  const serverName = entry.name != null ? String(entry.name).trim() : '';
  const name = localName || serverName;
  if (!name && !entry.original_name) return null;

  return {
    id: Number(entry?.id ?? 0),
    id_local: entry?.id_local != null ? String(entry.id_local) : undefined,
    name: name || String(entry.original_name || 'archivo'),
    original_name: String(entry?.original_name || entry?.name || 'archivo'),
    type: cacheFileType(String(entry?.type ?? 'file')),
    extension: String(entry?.extension ?? 'dat').replace(/^\./, ''),
  };
}

export function sanitizeArchivosAdjuntosForCache(list: unknown): ArticuloMantenimientoArchivoCacheRef[] {
  if (!Array.isArray(list)) return [];
  const out: ArticuloMantenimientoArchivoCacheRef[] = [];
  const seen = new Set<string>();
  for (const raw of list) {
    const ref = archivoAdjuntoRefForCache(raw);
    if (!ref || !ref.name) continue;
    const key = ref.id_local || `${ref.id}-${ref.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ref);
  }
  return out;
}

const MANTENIMIENTO_CACHE_MAX = 8;

/** Registro de mantenimiento apto para AsyncStorage (sin base64 ni campos binarios). */
export function sanitizeMantenimientoForCache(m: any): any {
  if (m == null || typeof m !== 'object') return m;
  const archivosRaw =
    m.c_archivos_adjuntos_articulo_mantenimiento ?? m.archivos ?? [];
  const archivos = sanitizeArchivosAdjuntosForCache(archivosRaw);
  const {
    base64: _b,
    file_base64: _fb,
    archivos: _a,
    c_archivos_adjuntos_articulo_mantenimiento: _c,
    ...rest
  } = m;
  return {
    ...rest,
    c_archivos_adjuntos_articulo_mantenimiento: archivos,
  };
}

export function sanitizeArticuloNodeForCache(art: any): any {
  if (art == null || typeof art !== 'object') return art;
  const mantenimientos = Array.isArray(art.mantenimientos)
    ? [...art.mantenimientos]
        .sort((a: any, b: any) => Number(b?.id ?? 0) - Number(a?.id ?? 0))
        .slice(0, MANTENIMIENTO_CACHE_MAX)
        .map(sanitizeMantenimientoForCache)
    : [];
  const ultimoRaw = art.ultimo_mantenimiento ?? art.ultimo_registro_mantenimiento ?? mantenimientos[0] ?? null;
  const ultimo = ultimoRaw ? sanitizeMantenimientoForCache(ultimoRaw) : null;
  const { mantenimiento_files: _mf, ...rest } = art;
  return {
    ...rest,
    mantenimientos,
    ultimo_mantenimiento: ultimo,
    ultimo_registro_mantenimiento: ultimo,
  };
}

export function sanitizeArticulosArrayForCache(articulos: any[]): any[] {
  if (!Array.isArray(articulos)) return [];
  return articulos.map(sanitizeArticuloNodeForCache);
}

/** Referencia en `articulos_puesto` (AsyncStorage / cola offline). Sin base64. */
export type ArticuloMantenimientoFileStorageRef = {
  id: string;
  type: ArticuloMantenimientoFileType;
  name: string;
  extension: string;
  localFileName: string;
};

/** Serializa artículos para `articulos_puesto` en caché/cola: solo refs expo-file, nunca base64. */
export function serializeArticulosPuestoForStorage(
  articulos: Array<{
    id: number;
    nombre: string;
    tipo?: string;
    cantidad_requerida: number;
    cantidad_real: number;
    estado: string;
    observaciones?: string;
    marca?: string;
    serie?: string;
    mantenimiento_files?: ArticuloMantenimientoPendingFile[];
  }>,
  createdAtIso: string,
): string {
  const rows = articulos.map((a) => {
    const row: Record<string, unknown> = {
      id: a.id,
      nombre: a.nombre,
      tipo: a.tipo ?? '',
      cantidad_requerida: a.cantidad_requerida,
      cantidad_real: a.cantidad_real,
      estado: a.estado,
      observaciones: a.observaciones ?? '',
      created_at: createdAtIso,
    };
    if (a.marca != null) row.marca = a.marca;
    if (a.serie != null) row.serie = a.serie;

    const files = (a.mantenimiento_files ?? [])
      .map((f) => {
        const localFileName = String(f.localFileName ?? '').trim();
        if (!localFileName) return null;
        return {
          id: f.id,
          type: f.type,
          name: f.name,
          extension: f.extension,
          localFileName,
        } satisfies ArticuloMantenimientoFileStorageRef;
      })
      .filter(Boolean);
    if (files.length > 0) row.mantenimiento_files = files;
    return row;
  });
  return JSON.stringify(rows);
}

/** Elimina base64 de entradas en `mantenimiento_files` (defensa al leer caché legacy). */
export function sanitizeMantenimientoFilesInArticulo(art: any): any {
  if (art == null || typeof art !== 'object') return art;
  const { mantenimiento_files, ...rest } = art;
  if (!Array.isArray(mantenimiento_files) || mantenimiento_files.length === 0) return rest;

  const refs = mantenimiento_files
    .map((f: any) => {
      const localFileName = String(f?.localFileName ?? '').trim();
      if (!localFileName) return null;
      return {
        id: f.id,
        type: f.type,
        name: f.name,
        extension: f.extension,
        localFileName,
      };
    })
    .filter(Boolean);

  if (refs.length === 0) return rest;
  return { ...rest, mantenimiento_files: refs };
}
/** `articulos_puesto` en caché de checklist: solo refs locales, nunca base64. */
export function sanitizeArticulosPuestoJsonForCache(raw: unknown): string | null | undefined {
  if (raw == null) return raw as null | undefined;
  let parsed: any[];
  try {
    parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return typeof raw === 'string' ? raw : undefined;
  }
  if (!Array.isArray(parsed)) return typeof raw === 'string' ? raw : JSON.stringify(parsed);
  return JSON.stringify(parsed.map(sanitizeMantenimientoFilesInArticulo));
}

/**
 * Hidrata `mantenimiento_files` leyendo expo-file. Solo para el body HTTP al API;
 * no usar el resultado para persistir en AsyncStorage ni en caché del checklist.
 */
export async function hydrateArticulosPuestoFilesForApi(articulosPuestoJson: string): Promise<string> {
  let parsed: any[];
  try {
    parsed = JSON.parse(articulosPuestoJson || '[]');
  } catch {
    return articulosPuestoJson;
  }
  if (!Array.isArray(parsed)) return articulosPuestoJson;

  const out: any[] = [];
  for (const art of parsed) {
    const files = art?.mantenimiento_files;
    if (!Array.isArray(files) || files.length === 0) {
      const { mantenimiento_files: _mf, ...rest } = art ?? {};
      out.push(rest);
      continue;
    }

    const hydrated: { type: string; original_name: string; extension: string; file_base64: string }[] = [];
    for (const f of files) {
      let raw = typeof f?.file_base64 === 'string' ? f.file_base64 : '';
      if (!raw && f?.localFileName) {
        try {
          const { base64 } = await getFile(String(f.localFileName).trim());
          raw = base64;
        } catch (e) {
          console.warn('[articuloMantenimientoFiles] No se pudo leer archivo local:', f.localFileName, e);
          continue;
        }
      }
      if (!raw) continue;
      if (raw.startsWith('data:')) {
        const i = raw.indexOf('base64,');
        if (i !== -1) raw = raw.slice(i + 7);
      }
      hydrated.push({
        type: apiFileType(f.type),
        original_name: String(f.original_name || f.name || 'archivo'),
        extension: String(f.extension || 'bin').replace(/^\./, ''),
        file_base64: raw,
      });
    }

    const { mantenimiento_files: _mf, ...rest } = art ?? {};
    if (hydrated.length === 0) {
      out.push(rest);
    } else {
      out.push({ ...rest, mantenimiento_files: hydrated });
    }
  }

  return JSON.stringify(out);
}
