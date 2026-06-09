/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Persistencia de `articulos_puesto` en c_checklist_supervision: solo metadatos del artículo
 * y referencias locales (`localFileName`). Nunca base64 (los archivos van a c_archiculo_mantenimiento).
 */
export function sanitizeArticulosPuestoForPersistence(raw: unknown): string {
  if (raw == null) return "[]";

  let arr: any[];
  try {
    arr = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return typeof raw === "string" ? raw : "[]";
  }
  if (!Array.isArray(arr)) return "[]";

  const cleaned = arr.map((art) => {
    const a = art && typeof art === "object" ? art : {};
    const base: Record<string, unknown> = {
      id: a.id,
      nombre: a.nombre,
      tipo: a.tipo ?? "",
      cantidad_requerida: a.cantidad_requerida,
      cantidad_real: a.cantidad_real,
      estado: a.estado,
      observaciones: a.observaciones ?? "",
      created_at: a.created_at,
    };
    if (a.marca != null) base.marca = a.marca;
    if (a.serie != null) base.serie = a.serie;

    const files = Array.isArray(a.mantenimiento_files) ? a.mantenimiento_files : [];
    const refs = files
      .map((f: any) => {
        const localFileName =
          f?.localFileName != null && String(f.localFileName).trim() !== ""
            ? String(f.localFileName).trim()
            : "";
        if (!localFileName) return null;
        return {
          id: f.id,
          type: f.type,
          name: f.name ?? f.original_name,
          extension: f.extension,
          localFileName,
        };
      })
      .filter(Boolean);

    if (refs.length > 0) base.mantenimiento_files = refs;
    return base;
  });

  return JSON.stringify(cleaned);
}

/** Tras subir archivos al mantenimiento, omitir `mantenimiento_files` del checklist (ya están en BD). */
export function stripMantenimientoFilesFromArticulosPuesto(raw: unknown): string {
  if (raw == null) return "[]";
  let arr: any[];
  try {
    arr = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return typeof raw === "string" ? raw : "[]";
  }
  if (!Array.isArray(arr)) return "[]";

  const cleaned = arr.map((art) => {
    if (art == null || typeof art !== "object") return art;
    const { mantenimiento_files: _mf, file_base64: _fb, base64: _b, ...rest } = art as any;
    return rest;
  });

  return JSON.stringify(cleaned);
}
